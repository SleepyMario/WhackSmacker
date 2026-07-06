import {
  listInstalledContentPackages,
  resolveContentDataDirectory,
  type InstalledPackageRecord
} from "./content-package-manager";
import {
  assertValidContentPackageManifest,
  isSafeContentPackagePath,
  type ContentPackageManifest
} from "./content-package-spec";

type BufferValue = {
  toString(encoding: "utf8"): string;
};

declare function require(name: "node:fs/promises"): {
  readFile(path: string): Promise<BufferValue>;
};
declare function require(name: "node:path"): {
  join(...paths: string[]): string;
  relative(from: string, to: string): string;
};

const { readFile } = require("node:fs/promises");
const { join, relative } = require("node:path");

export const memorizationItemSchemaVersion = 1;
export const memorizationItemFileMediaType = "application/vnd.whacksmacker.memorization-items+json";
export const memorizationItemKinds = ["basic-card", "cloze", "vocabulary", "sentence", "concept"] as const;

export interface MemorizationItem {
  readonly schemaVersion: 1;
  readonly id: string;
  readonly kind: (typeof memorizationItemKinds)[number];
  readonly prompt: MemorizationContentBlock;
  readonly answer: MemorizationContentBlock;
  readonly hints?: readonly string[];
  readonly notes?: string;
  readonly tags?: readonly string[];
  readonly source?: MemorizationItemSource;
  readonly language?: MemorizationLanguageMetadata;
  readonly difficulty?: MemorizationDifficultyMetadata;
  readonly createdAt?: string;
  readonly updatedAt?: string;
}

export interface MemorizationContentBlock {
  readonly text: string;
  readonly plainText?: string;
  readonly language?: string;
  readonly mediaType?: "text/plain" | "text/markdown";
}

export interface MemorizationItemSource {
  readonly path: string;
  readonly anchor?: string;
  readonly title?: string;
}

export interface MemorizationLanguageMetadata {
  readonly target?: string;
  readonly base?: string;
  readonly script?: string;
}

export interface MemorizationDifficultyMetadata {
  readonly level?: number;
  readonly label?: string;
}

export interface MemorizationItemCollection {
  readonly schemaVersion: 1;
  readonly items: readonly MemorizationItem[];
}

export interface MemorizationItemValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
}

export interface InstalledMemorizationItemFile {
  readonly packageId: string;
  readonly packageVersion: string;
  readonly path: string;
  readonly mediaType: string;
}

export interface InstalledMemorizationItems {
  readonly packageId: string;
  readonly packageVersion: string;
  readonly path: string;
  readonly items: readonly MemorizationItem[];
}

export function validateMemorizationItem(item: unknown): MemorizationItemValidationResult {
  const errors: string[] = [];
  validateItem(item, "item", errors);
  return { valid: errors.length === 0, errors };
}

export function assertValidMemorizationItem(item: unknown): asserts item is MemorizationItem {
  const result = validateMemorizationItem(item);
  if (!result.valid) {
    throw new Error(`Invalid memorization item:\n${result.errors.join("\n")}`);
  }
}

export function validateMemorizationItemCollection(collection: unknown): MemorizationItemValidationResult {
  const errors: string[] = [];
  if (!isRecord(collection)) {
    return { valid: false, errors: ["collection must be a JSON object."] };
  }
  if (collection.schemaVersion !== memorizationItemSchemaVersion) {
    errors.push(`collection.schemaVersion must be ${memorizationItemSchemaVersion}.`);
  }
  if (!Array.isArray(collection.items)) {
    errors.push("collection.items must be an array.");
  } else {
    const ids = new Set<string>();
    for (const [index, item] of collection.items.entries()) {
      validateItem(item, `collection.items[${index}]`, errors);
      if (isRecord(item) && typeof item.id === "string") {
        if (ids.has(item.id)) {
          errors.push(`Duplicate memorization item ID: ${item.id}`);
        } else {
          ids.add(item.id);
        }
      }
    }
  }
  return { valid: errors.length === 0, errors };
}

export function assertValidMemorizationItemCollection(collection: unknown): asserts collection is MemorizationItemCollection {
  const result = validateMemorizationItemCollection(collection);
  if (!result.valid) {
    throw new Error(`Invalid memorization item collection:\n${result.errors.join("\n")}`);
  }
}

export function normalizeMemorizationItemCollection(value: unknown): MemorizationItemCollection {
  if (isRecord(value) && Array.isArray(value.items)) {
    assertValidMemorizationItemCollection(value);
    return value;
  }
  assertValidMemorizationItem(value);
  return { schemaVersion: memorizationItemSchemaVersion, items: [value] };
}

export async function listInstalledMemorizationItemFiles(
  packageId: string,
  dataDir?: string,
  packageVersion?: string
): Promise<readonly InstalledMemorizationItemFile[]> {
  const selected = await selectInstalledPackage(packageId, dataDir, packageVersion);
  const manifest = await readInstalledManifest(installedPackageRoot(selected, dataDir));
  return manifest.files
    .filter((file) => isMemorizationItemPath(file.path) && isMemorizationItemMediaType(file.mediaType))
    .map((file) => ({
      packageId: selected.packageId,
      packageVersion: selected.packageVersion,
      path: file.path,
      mediaType: file.mediaType
    }))
    .sort((left, right) => left.path.localeCompare(right.path));
}

export async function readInstalledMemorizationItems(
  packageId: string,
  path: string,
  dataDir?: string,
  packageVersion?: string
): Promise<InstalledMemorizationItems> {
  if (!isMemorizationItemPath(path)) {
    throw new Error(`Memorization item path must be under content/memorization and safe: ${path}`);
  }
  const selected = await selectInstalledPackage(packageId, dataDir, packageVersion);
  const root = installedPackageRoot(selected, dataDir);
  const manifest = await readInstalledManifest(root);
  const declaredFile = manifest.files.find((file) => file.path === path && isMemorizationItemMediaType(file.mediaType));
  if (declaredFile === undefined) {
    throw new Error(`Memorization item file is not declared by the installed package manifest: ${path}`);
  }
  const destination = join(root, path);
  ensureInside(root, destination);
  const collection = normalizeMemorizationItemCollection(JSON.parse((await readFile(destination)).toString("utf8")) as unknown);
  return {
    packageId: selected.packageId,
    packageVersion: selected.packageVersion,
    path,
    items: collection.items
  };
}

function validateItem(value: unknown, field: string, errors: string[]): void {
  if (!isRecord(value)) {
    errors.push(`${field} must be a JSON object.`);
    return;
  }
  const allowed = new Set([
    "schemaVersion",
    "id",
    "kind",
    "prompt",
    "answer",
    "hints",
    "notes",
    "tags",
    "source",
    "language",
    "difficulty",
    "createdAt",
    "updatedAt"
  ]);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      errors.push(`${field}.${key} is not allowed in memorization items.`);
    }
  }
  if (value.schemaVersion !== memorizationItemSchemaVersion) {
    errors.push(`${field}.schemaVersion must be ${memorizationItemSchemaVersion}.`);
  }
  if (!isSafeItemId(readString(value.id))) {
    errors.push(`${field}.id must be stable, package-relative, and safe.`);
  }
  if (!memorizationItemKinds.includes(readString(value.kind) as MemorizationItem["kind"])) {
    errors.push(`${field}.kind must be one of: ${memorizationItemKinds.join(", ")}.`);
  }
  validateContentBlock(value.prompt, `${field}.prompt`, errors);
  validateContentBlock(value.answer, `${field}.answer`, errors);
  validateStringArray(value.hints, `${field}.hints`, errors, false);
  validateStringArray(value.tags, `${field}.tags`, errors, true);
  if (value.notes !== undefined && typeof value.notes !== "string") {
    errors.push(`${field}.notes must be a string when present.`);
  }
  validateSource(value.source, `${field}.source`, errors);
  validateLanguage(value.language, `${field}.language`, errors);
  validateDifficulty(value.difficulty, `${field}.difficulty`, errors);
  validateTimestamp(value.createdAt, `${field}.createdAt`, errors);
  validateTimestamp(value.updatedAt, `${field}.updatedAt`, errors);
  for (const forbidden of ["dueAt", "interval", "easeFactor", "reviewHistory", "progress", "settings", "providerDeck", "providerNoteId"]) {
    if (forbidden in value) {
      errors.push(`${field}.${forbidden} is user progress, scheduler state, settings, or provider-specific data and is not allowed.`);
    }
  }
}

function validateContentBlock(value: unknown, field: string, errors: string[]): void {
  if (!isRecord(value)) {
    errors.push(`${field} must be an object.`);
    return;
  }
  const allowed = new Set(["text", "plainText", "language", "mediaType"]);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      errors.push(`${field}.${key} is not allowed.`);
    }
  }
  validateNonEmptyString(value.text, `${field}.text`, errors);
  if (value.plainText !== undefined && typeof value.plainText !== "string") {
    errors.push(`${field}.plainText must be a string when present.`);
  }
  if (value.language !== undefined) {
    validateNonEmptyString(value.language, `${field}.language`, errors);
  }
  if (value.mediaType !== undefined && value.mediaType !== "text/plain" && value.mediaType !== "text/markdown") {
    errors.push(`${field}.mediaType must be text/plain or text/markdown.`);
  }
}

function validateSource(value: unknown, field: string, errors: string[]): void {
  if (value === undefined) {
    return;
  }
  if (!isRecord(value)) {
    errors.push(`${field} must be an object when present.`);
    return;
  }
  if (!isSafeContentPackagePath(readString(value.path))) {
    errors.push(`${field}.path must be a safe package-relative path.`);
  }
  if (value.anchor !== undefined) {
    validateNonEmptyString(value.anchor, `${field}.anchor`, errors);
  }
  if (value.title !== undefined) {
    validateNonEmptyString(value.title, `${field}.title`, errors);
  }
}

function validateLanguage(value: unknown, field: string, errors: string[]): void {
  if (value === undefined) {
    return;
  }
  if (!isRecord(value)) {
    errors.push(`${field} must be an object when present.`);
    return;
  }
  for (const key of ["target", "base", "script"] as const) {
    if (value[key] !== undefined) {
      validateNonEmptyString(value[key], `${field}.${key}`, errors);
    }
  }
}

function validateDifficulty(value: unknown, field: string, errors: string[]): void {
  if (value === undefined) {
    return;
  }
  if (!isRecord(value)) {
    errors.push(`${field} must be an object when present.`);
    return;
  }
  if (value.level !== undefined) {
    const level = value.level;
    if (typeof level !== "number" || !Number.isSafeInteger(level) || level < 1 || level > 10) {
      errors.push(`${field}.level must be an integer from 1 through 10.`);
    }
  }
  if (value.label !== undefined) {
    validateNonEmptyString(value.label, `${field}.label`, errors);
  }
}

function validateStringArray(value: unknown, field: string, errors: string[], tagSyntax: boolean): void {
  if (value === undefined) {
    return;
  }
  if (!Array.isArray(value)) {
    errors.push(`${field} must be an array when present.`);
    return;
  }
  const seen = new Set<string>();
  for (const [index, item] of value.entries()) {
    if (typeof item !== "string" || item.trim().length === 0) {
      errors.push(`${field}[${index}] must be a non-empty string.`);
      continue;
    }
    if (tagSyntax && !/^[a-z0-9][a-z0-9._-]*$/u.test(item)) {
      errors.push(`${field}[${index}] must use lowercase tag syntax.`);
    }
    if (seen.has(item)) {
      errors.push(`${field} contains duplicate value: ${item}`);
    }
    seen.add(item);
  }
}

function validateTimestamp(value: unknown, field: string, errors: string[]): void {
  if (value === undefined) {
    return;
  }
  const text = readString(value);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/u.test(text) || Number.isNaN(Date.parse(text))) {
    errors.push(`${field} must be an ISO 8601 UTC timestamp.`);
  }
}

function validateNonEmptyString(value: unknown, field: string, errors: string[]): void {
  if (typeof value !== "string" || value.trim().length === 0) {
    errors.push(`${field} must be a non-empty string.`);
  }
}

function isSafeItemId(value: string): boolean {
  return isSafeContentPackagePath(value) && /^[a-z0-9](?:[a-z0-9._/-]*[a-z0-9])?$/u.test(value);
}

function isMemorizationItemPath(path: string): boolean {
  return isSafeContentPackagePath(path) && path.startsWith("content/memorization/") && path.endsWith(".json");
}

function isMemorizationItemMediaType(mediaType: string): boolean {
  return mediaType === "application/json" || mediaType === memorizationItemFileMediaType;
}

async function selectInstalledPackage(packageId: string, dataDir?: string, packageVersion?: string): Promise<InstalledPackageRecord> {
  const matches = (await listInstalledContentPackages(dataDir)).filter(
    (record) => record.packageId === packageId && (packageVersion === undefined || record.packageVersion === packageVersion)
  );
  if (matches.length === 0) {
    throw new Error(`Installed package not found: ${packageId}${packageVersion === undefined ? "" : ` ${packageVersion}`}`);
  }
  return [...matches].sort((left, right) => compareSemver(right.packageVersion, left.packageVersion))[0];
}

function installedPackageRoot(record: InstalledPackageRecord, dataDir?: string): string {
  return join(resolveContentDataDirectory(dataDir), record.installPath);
}

async function readInstalledManifest(root: string): Promise<ContentPackageManifest> {
  const manifest = JSON.parse((await readFile(join(root, "manifest.json"))).toString("utf8")) as unknown;
  assertValidContentPackageManifest(manifest);
  return manifest;
}

function compareSemver(left: string, right: string): number {
  const leftParts = left.split(".").map(Number);
  const rightParts = right.split(".").map(Number);
  for (let index = 0; index < 3; index += 1) {
    const difference = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);
    if (difference !== 0) {
      return difference;
    }
  }
  return 0;
}

function ensureInside(root: string, path: string): void {
  const relativePath = relative(root, path);
  if (relativePath.startsWith("..") || relativePath.includes("\\") || relativePath === "") {
    throw new Error(`Memorization item path escapes installed package: ${path}`);
  }
}

function readString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
