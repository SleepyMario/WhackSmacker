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
import { isLocalizedContentValue, type LocalizedContentValue } from "./localized-content";
import { assertCanonicalLexicalRecord, type CanonicalLexicalRecord, type LearnerFacingVocabularyRecord } from "./language-curriculum-policy";
import { pedagogicalFingerprint, type PedagogicalContent } from "./pedagogical-fingerprint";

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
export const memorizationItemSchemaVersionV2 = 2;
export const memorizationItemFileMediaType = "application/vnd.whacksmacker.memorization-items+json";
export const memorizationItemKinds = ["basic-card", "cloze", "vocabulary", "sentence", "concept"] as const;

export interface MemorizationItemV1 {
  readonly schemaVersion: 1;
  readonly id: string;
  readonly kind: (typeof memorizationItemKinds)[number];
  readonly prompt: MemorizationContentBlock;
  readonly answer: MemorizationContentBlock;
  readonly hints?: readonly LocalizedContentValue[];
  readonly notes?: LocalizedContentValue;
  readonly examples?: readonly string[];
  readonly tags?: readonly string[];
  readonly source?: MemorizationItemSource;
  readonly language?: MemorizationLanguageMetadata;
  readonly difficulty?: MemorizationDifficultyMetadata;
  /** Package-preserved language-adaptive lexical data for isolated vocabulary. */
  readonly lexicalMetadata?: LearnerFacingVocabularyRecord;
  readonly createdAt?: string;
  readonly updatedAt?: string;
}

export interface MemorizationItemV2 extends Omit<MemorizationItemV1, "schemaVersion"> {
  readonly schemaVersion: 2;
  readonly cardId: string;
  readonly pedagogicalFingerprint: string;
  readonly deck: {
    readonly id: string;
    readonly title: string;
    readonly chapterStart: number;
    readonly chapterEnd: number;
  };
  readonly sourceChapters: readonly number[];
  readonly reviewDirection: string;
  readonly acceptedAnswers: readonly string[];
  readonly distractors: readonly string[];
  readonly explanation: string;
  readonly testedMeaning: string;
  readonly testedLexicalIds: readonly string[];
  readonly testedGrammarIds: readonly string[];
  readonly testedGeographicIds: readonly string[];
  readonly testedCastIds: readonly string[];
  readonly testedSkillIds: readonly string[];
  readonly provenance: {
    readonly path: string;
    readonly locator: string;
    readonly evidence: string;
  };
}

export type MemorizationItem = MemorizationItemV1 | MemorizationItemV2;

export interface MemorizationContentBlock {
  readonly text: LocalizedContentValue;
  readonly plainText?: LocalizedContentValue;
  readonly language?: string;
  readonly mediaType?: "text/plain" | "text/markdown";
}

export interface MemorizationItemSource {
  readonly path: string;
  readonly anchor?: string;
  readonly title?: LocalizedContentValue;
}

export interface MemorizationLanguageMetadata {
  readonly target?: string;
  readonly base?: string;
  readonly script?: string;
}

export interface MemorizationDifficultyMetadata {
  readonly level?: number;
  readonly label?: LocalizedContentValue;
}

export type MemorizationItemCollection =
  | { readonly schemaVersion: 1; readonly items: readonly MemorizationItemV1[] }
  | { readonly schemaVersion: 2; readonly items: readonly MemorizationItemV2[] };

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
  if (collection.schemaVersion !== 1 && collection.schemaVersion !== 2) {
    errors.push("collection.schemaVersion must be 1 or 2.");
  }
  if (!Array.isArray(collection.items)) {
    errors.push("collection.items must be an array.");
  } else {
    const ids = new Set<string>();
    for (const [index, item] of collection.items.entries()) {
      validateItem(item, `collection.items[${index}]`, errors);
      if (isRecord(item) && item.schemaVersion !== collection.schemaVersion) {
        errors.push(`collection.items[${index}].schemaVersion must match collection.schemaVersion.`);
      }
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
  return value.schemaVersion === 2
    ? { schemaVersion: 2, items: [value] as MemorizationItemV2[] }
    : { schemaVersion: 1, items: [value] as MemorizationItemV1[] };
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
  packageVersion?: string,
  sourceLocale?: string
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
  const items = await applySourceReviewOverlay(collection.items, selected, sourceLocale, dataDir);
  return {
    packageId: selected.packageId,
    packageVersion: selected.packageVersion,
    path,
    items
  };
}

async function applySourceReviewOverlay(items: readonly MemorizationItem[], base: InstalledPackageRecord, locale: string | undefined, dataDir?: string): Promise<readonly MemorizationItem[]> {
  const baseRoot = installedPackageRoot(base, dataDir);
  const baseManifest = await readInstalledManifest(baseRoot);
  if (baseManifest.localization?.role !== "base-curriculum") return items;
  const selected = locale === "zh-Hant-TW" || locale === "zh-TW" ? "zh-TW" : locale === "en-US" || locale === "en" ? "en" : baseManifest.localization.defaultSourceLocale;
  const locales = [selected, baseManifest.localization.defaultSourceLocale].filter((value, index, all) => all.indexOf(value) === index);
  for (const candidate of locales) {
    for (const record of await listInstalledContentPackages(dataDir)) {
      if (record.contentType !== "curriculum-source-language-pack") continue;
      const root = installedPackageRoot(record, dataDir);
      const manifest = await readInstalledManifest(root);
      if (manifest.localization?.role !== "source-language-pack" || manifest.localization.basePackageId !== base.packageId || manifest.localization.sourceLocale !== candidate) continue;
      try {
        const overlay = JSON.parse((await readFile(join(root, "content", "content.json"))).toString("utf8")) as { review?: readonly { sourcePath: string; rowNumber: number; prompt: string; answer: string; notes: string; title: string }[] };
        return items.flatMap(item => {
          const rowNumber = Number.parseInt(item.id.match(/\/(\d{4})-/u)?.[1] ?? "0", 10);
          const value = overlay.review?.find(entry => entry.sourcePath === item.source?.path && entry.rowNumber === rowNumber);
          if (value === undefined) return [];
          return [{ ...item,
            prompt: value.prompt.length === 0 ? item.prompt : { ...item.prompt, text: value.prompt, plainText: value.prompt },
            answer: value.answer.length === 0 ? item.answer : { ...item.answer, text: value.answer, plainText: value.answer },
            notes: value.notes,
            source: item.source === undefined ? undefined : { ...item.source, title: value.title }
          }];
        });
      } catch { continue; }
    }
  }
  return items;
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
    "examples",
    "tags",
    "source",
    "language",
    "difficulty",
    "lexicalMetadata",
    "createdAt",
    "updatedAt",
    ...(value.schemaVersion === 2 ? [
      "cardId", "pedagogicalFingerprint", "deck", "sourceChapters", "reviewDirection",
      "acceptedAnswers", "distractors", "explanation", "testedMeaning", "testedLexicalIds",
      "testedGrammarIds", "testedGeographicIds", "testedCastIds", "testedSkillIds", "provenance"
    ] : [])
  ]);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      errors.push(`${field}.${key} is not allowed in memorization items.`);
    }
  }
  if (value.schemaVersion !== 1 && value.schemaVersion !== 2) {
    errors.push(`${field}.schemaVersion must be 1 or 2.`);
  }
  if (!isSafeItemId(readString(value.id))) {
    errors.push(`${field}.id must be stable, package-relative, and safe.`);
  }
  if (!memorizationItemKinds.includes(readString(value.kind) as MemorizationItem["kind"])) {
    errors.push(`${field}.kind must be one of: ${memorizationItemKinds.join(", ")}.`);
  }
  validateContentBlock(value.prompt, `${field}.prompt`, errors);
  validateContentBlock(value.answer, `${field}.answer`, errors);
  validateLocalizedContentArray(value.hints, `${field}.hints`, errors);
  validateStringArray(value.tags, `${field}.tags`, errors, true);
  if (value.notes !== undefined && !isLocalizedContentValue(value.notes)) {
    errors.push(`${field}.notes must be a string or locale-to-string object when present.`);
  }
  validateStringArray(value.examples, `${field}.examples`, errors, false);
  if (value.schemaVersion === 2 && value.examples !== undefined) {
    if (!Array.isArray(value.examples) || value.examples.length < 1 || value.examples.length > 3) {
      errors.push(`${field}.examples must contain between one and three literal review examples when present.`);
    } else {
      for (const [index, example] of value.examples.entries()) {
        if (typeof example === "string" && (example !== example.normalize("NFC") || example !== example.trim())) {
          errors.push(`${field}.examples[${index}] must use NFC with no leading or trailing whitespace.`);
        }
      }
    }
  }
  validateSource(value.source, `${field}.source`, errors);
  validateLanguage(value.language, `${field}.language`, errors);
  validateDifficulty(value.difficulty, `${field}.difficulty`, errors);
  validateLexicalMetadata(value.lexicalMetadata, `${field}.lexicalMetadata`, errors);
  validateTimestamp(value.createdAt, `${field}.createdAt`, errors);
  validateTimestamp(value.updatedAt, `${field}.updatedAt`, errors);
  if (value.schemaVersion === 2) validateV2Fields(value, field, errors);
  for (const forbidden of ["dueAt", "interval", "easeFactor", "reviewHistory", "progress", "settings", "providerDeck", "providerNoteId"]) {
    if (forbidden in value) {
      errors.push(`${field}.${forbidden} is user progress, scheduler state, settings, or provider-specific data and is not allowed.`);
    }
  }
}

function validateV2Fields(value: Record<string, unknown>, field: string, errors: string[]): void {
  if (!isSafeItemId(readString(value.cardId)) || value.cardId !== value.id) {
    errors.push(`${field}.cardId must be a safe stable ID equal to id.`);
  }
  if (!/^[a-f0-9]{64}$/u.test(readString(value.pedagogicalFingerprint))) {
    errors.push(`${field}.pedagogicalFingerprint must be a lowercase SHA-256 hex digest.`);
  }
  if (!isRecord(value.deck) || !isSafeItemId(readString(value.deck.id)) || typeof value.deck.title !== "string") {
    errors.push(`${field}.deck must declare a safe id and non-empty title.`);
  } else {
    validateChapter(value.deck.chapterStart, `${field}.deck.chapterStart`, errors);
    validateChapter(value.deck.chapterEnd, `${field}.deck.chapterEnd`, errors);
    if (typeof value.deck.chapterStart === "number" && typeof value.deck.chapterEnd === "number" && value.deck.chapterEnd - value.deck.chapterStart !== 4) {
      errors.push(`${field}.deck must cover exactly five consecutive chapters.`);
    }
  }
  validateChapterArray(value.sourceChapters, `${field}.sourceChapters`, errors);
  validateNonEmptyString(value.reviewDirection, `${field}.reviewDirection`, errors);
  validateNonEmptyUniqueNfcStrings(value.acceptedAnswers, `${field}.acceptedAnswers`, errors, false);
  validateNonEmptyUniqueNfcStrings(value.distractors, `${field}.distractors`, errors, true);
  validateNonEmptyString(value.explanation, `${field}.explanation`, errors);
  validateNonEmptyString(value.testedMeaning, `${field}.testedMeaning`, errors);
  for (const name of ["testedLexicalIds", "testedGrammarIds", "testedGeographicIds", "testedCastIds", "testedSkillIds"] as const) {
    validateNonEmptyUniqueNfcStrings(value[name], `${field}.${name}`, errors, true);
  }
  if (Array.isArray(value.acceptedAnswers) && Array.isArray(value.distractors)) {
    const accepted = new Set(value.acceptedAnswers.map(normalizedText));
    for (const distractor of value.distractors) if (accepted.has(normalizedText(distractor))) errors.push(`${field}.acceptedAnswers and distractors must not overlap.`);
  }
  if (!isRecord(value.provenance) || !isSafeContentPackagePath(readString(value.provenance.path))) {
    errors.push(`${field}.provenance must declare a safe curriculum path.`);
  } else {
    validateNonEmptyString(value.provenance.locator, `${field}.provenance.locator`, errors);
    validateNonEmptyString(value.provenance.evidence, `${field}.provenance.evidence`, errors);
  }
  if (isV2Shape(value)) {
    const expected = pedagogicalFingerprint(pedagogicalContentForMemorizationItem(value));
    if (value.pedagogicalFingerprint !== expected) errors.push(`${field}.pedagogicalFingerprint does not match pedagogically material content.`);
  }
}

export function pedagogicalContentForMemorizationItem(item: MemorizationItemV2): PedagogicalContent {
  const requiredCanonicalIds = [
    ...item.testedLexicalIds, ...item.testedGrammarIds, ...item.testedGeographicIds,
    ...item.testedCastIds, ...item.testedSkillIds
  ];
  return {
    prompt: item.prompt.text,
    acceptedAnswers: item.acceptedAnswers,
    testedMeaning: item.testedMeaning,
    direction: item.reviewDirection,
    cardType: item.kind,
    requiredCanonicalIds,
    distractors: item.distractors,
    expectedInterpretation: item.explanation
  };
}

function isV2Shape(value: Record<string, unknown>): value is Record<string, unknown> & MemorizationItemV2 {
  return value.schemaVersion === 2 && Array.isArray(value.acceptedAnswers) && Array.isArray(value.distractors)
    && Array.isArray(value.testedLexicalIds) && Array.isArray(value.testedGrammarIds)
    && Array.isArray(value.testedGeographicIds) && Array.isArray(value.testedCastIds) && Array.isArray(value.testedSkillIds)
    && isRecord(value.prompt) && typeof value.reviewDirection === "string" && typeof value.testedMeaning === "string" && typeof value.explanation === "string";
}

function validateChapter(value: unknown, field: string, errors: string[]): void {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1) errors.push(`${field} must be a positive integer.`);
}

function validateChapterArray(value: unknown, field: string, errors: string[]): void {
  if (!Array.isArray(value) || value.length === 0) { errors.push(`${field} must be a non-empty chapter array.`); return; }
  for (const [index, chapter] of value.entries()) validateChapter(chapter, `${field}[${index}]`, errors);
  if (new Set(value).size !== value.length) errors.push(`${field} must not contain duplicates.`);
}

function validateNonEmptyUniqueNfcStrings(value: unknown, field: string, errors: string[], allowEmpty: boolean): void {
  if (!Array.isArray(value) || (!allowEmpty && value.length === 0)) { errors.push(`${field} must be ${allowEmpty ? "an" : "a non-empty"} array.`); return; }
  const seen = new Set<string>();
  for (const [index, entry] of value.entries()) {
    if (typeof entry !== "string" || entry.trim() === "") { errors.push(`${field}[${index}] must be a non-empty string.`); continue; }
    if (entry !== entry.normalize("NFC")) errors.push(`${field}[${index}] must use Unicode NFC.`);
    const normalized = normalizedText(entry);
    if (seen.has(normalized)) errors.push(`${field} contains duplicate value: ${entry}`);
    seen.add(normalized);
  }
}

function normalizedText(value: unknown): string {
  return typeof value === "string" ? value.normalize("NFC").trim().replace(/\s+/gu, " ") : "";
}

function validateLexicalMetadata(value: unknown, field: string, errors: string[]): void {
  if (value === undefined) return;
  if (!isRecord(value) || typeof value.learnerFacingForm !== "string" || value.learnerFacingForm.trim() === "") {
    errors.push(`${field} must be a language-adaptive vocabulary record with learnerFacingForm.`);
    return;
  }
  if (value.lexicalType === "noun" && (typeof value.lemma !== "string" || value.lemma.trim() === "")) errors.push(`${field}.lemma is required for noun records.`);
  if (value.lexicalType === "measure-expression") {
    if (!['MW', 'classifier', 'counter'].includes(readString(value.grammaticalType))) errors.push(`${field}.grammaticalType must be MW, classifier, or counter.`);
    if (typeof value.semanticScope !== "string" || value.semanticScope.trim() === "") errors.push(`${field}.semanticScope is required for grammatical measure expressions.`);
  }
  if ("lexicalEntryId" in value || "senseId" in value) {
    try { assertCanonicalLexicalRecord(value as unknown as CanonicalLexicalRecord); }
    catch (error) { errors.push(`${field}: ${error instanceof Error ? error.message : String(error)}`); }
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
  validateLocalizedContent(value.text, `${field}.text`, errors);
  if (value.plainText !== undefined && !isLocalizedContentValue(value.plainText, true)) {
    errors.push(`${field}.plainText must be a string or locale-to-string object when present.`);
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
    validateLocalizedContent(value.title, `${field}.title`, errors);
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
    validateLocalizedContent(value.label, `${field}.label`, errors);
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

function validateLocalizedContent(value: unknown, field: string, errors: string[]): void {
  if (!isLocalizedContentValue(value)) {
    errors.push(`${field} must be a non-empty string or a non-empty locale-to-string object.`);
  }
}

function validateLocalizedContentArray(value: unknown, field: string, errors: string[]): void {
  if (value === undefined) {
    return;
  }
  if (!Array.isArray(value)) {
    errors.push(`${field} must be an array when present.`);
    return;
  }
  for (const [index, item] of value.entries()) {
    validateLocalizedContent(item, `${field}[${index}]`, errors);
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
