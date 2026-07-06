import {
  assertValidInstalledPackageRegistry,
  resolveContentDataDirectory,
  type InstalledPackageRegistry
} from "./content-package-manager";
import {
  assertValidReviewProgressStore,
  type ReviewProgressStore
} from "./review-scheduler";
import {
  defaultReviewProgressDirectoryForContentDataDirectory,
  resolveReviewProgressDirectory
} from "./review-progress-store";
import {
  migrateUserDataBackupToLatest,
  userDataBackupFormatVersion
} from "./user-data-migration";

type BufferValue = {
  readonly length: number;
  toString(encoding: "utf8"): string;
};

declare function require(name: "node:crypto"): {
  createHash(algorithm: "sha256"): {
    update(data: string): { digest(encoding: "hex"): string };
  };
};
declare function require(name: "node:fs/promises"): {
  access(path: string): Promise<void>;
  mkdir(path: string, options: { recursive: boolean }): Promise<void>;
  readFile(path: string): Promise<BufferValue>;
  rename(oldPath: string, newPath: string): Promise<void>;
  rm(path: string, options: { recursive: boolean; force: boolean }): Promise<void>;
  writeFile(path: string, data: string): Promise<void>;
};
declare function require(name: "node:path"): {
  basename(path: string): string;
  dirname(path: string): string;
  join(...paths: string[]): string;
  relative(from: string, to: string): string;
  resolve(...paths: string[]): string;
};
declare function require(name: "../../../package.json"): { version: string };

const { createHash } = require("node:crypto");
const { access, mkdir, readFile, rename, rm, writeFile } = require("node:fs/promises");
const { basename, dirname, join, relative, resolve } = require("node:path");
const packageMetadata = require("../../../package.json");

export interface UserDataBackup {
  readonly backupFormatVersion: 1;
  readonly createdAt: string;
  readonly whackSmackerVersion: string;
  readonly includedSections: readonly UserDataBackupSectionName[];
  readonly sections: UserDataBackupSections;
  readonly restoreHints: UserDataRestoreHints;
}

export interface UserDataBackupSections {
  readonly installedPackageRegistry?: UserDataBackupSection<InstalledPackageRegistry>;
  readonly reviewProgress?: UserDataBackupSection<ReviewProgressStore>;
  readonly settings?: UserDataBackupSection<unknown>;
}

export interface UserDataBackupSection<T> {
  readonly path: string;
  readonly sha256: string;
  readonly data: T;
}

export interface UserDataRestoreHints {
  readonly installedPackages: readonly UserDataInstalledPackageHint[];
}

export interface UserDataInstalledPackageHint {
  readonly packageId: string;
  readonly packageVersion: string;
  readonly displayName: string;
  readonly sourceRepository: string;
  readonly sourceCommit: string;
}

export type UserDataBackupSectionName = "installedPackageRegistry" | "reviewProgress" | "settings";

export interface CreateUserDataBackupOptions {
  readonly dataDir?: string;
  readonly progressDir?: string;
  readonly settingsDir?: string;
  readonly createdAt: string;
  readonly whackSmackerVersion?: string;
}

type MutableBackupSections = {
  installedPackageRegistry?: UserDataBackupSection<InstalledPackageRegistry>;
  reviewProgress?: UserDataBackupSection<ReviewProgressStore>;
  settings?: UserDataBackupSection<unknown>;
};

export interface WriteUserDataBackupOptions extends CreateUserDataBackupOptions {
  readonly outputPath: string;
}

export interface RestoreUserDataBackupOptions {
  readonly backupPath: string;
  readonly dataDir?: string;
  readonly progressDir?: string;
  readonly settingsDir?: string;
  readonly force?: boolean;
}

export interface RestoreUserDataBackupResult {
  readonly restored: readonly UserDataBackupSectionName[];
  readonly paths: readonly string[];
}

export interface BackupInspection {
  readonly valid: boolean;
  readonly backupFormatVersion?: number;
  readonly createdAt?: string;
  readonly whackSmackerVersion?: string;
  readonly includedSections: readonly string[];
  readonly installedPackages: readonly UserDataInstalledPackageHint[];
  readonly errors: readonly string[];
}

export async function createUserDataBackup(options: CreateUserDataBackupOptions): Promise<UserDataBackup> {
  const createdAt = options.createdAt;
  assertTimestamp(createdAt, "createdAt");
  const contentDir = resolveContentDataDirectory(options.dataDir);
  const progressDir = resolveProgressDir(contentDir, options.progressDir);
  const settingsDir = resolveSettingsDir(contentDir, options.settingsDir);
  const sections: MutableBackupSections = {};

  const registry = await readOptionalJson(join(contentDir, "registry.json"));
  if (registry !== undefined) {
    assertValidInstalledPackageRegistry(registry);
    sections.installedPackageRegistry = makeSection("content/registry.json", registry);
  }

  const progress = await readOptionalJson(join(progressDir, "review-progress.json"));
  if (progress !== undefined) {
    assertValidReviewProgressStore(progress);
    sections.reviewProgress = makeSection("progress/review-progress.json", progress);
  }

  const settings = await readOptionalJson(join(settingsDir, "settings.json"));
  if (settings !== undefined) {
    sections.settings = makeSection("settings/settings.json", settings);
  }

  const includedSections = sectionNames(sections);
  const backup: UserDataBackup = {
    backupFormatVersion: userDataBackupFormatVersion,
    createdAt,
    whackSmackerVersion: options.whackSmackerVersion ?? packageMetadata.version,
    includedSections,
    sections,
    restoreHints: {
      installedPackages: sections.installedPackageRegistry?.data.packages.map((record) => ({
        packageId: record.packageId,
        packageVersion: record.packageVersion,
        displayName: record.displayName,
        sourceRepository: record.source.repository,
        sourceCommit: record.source.commit
      })) ?? []
    }
  };
  assertValidUserDataBackup(backup);
  return backup;
}

export async function writeUserDataBackup(options: WriteUserDataBackupOptions): Promise<UserDataBackup> {
  if (options.outputPath.trim().length === 0) {
    throw new Error("--output is required.");
  }
  const backup = await createUserDataBackup(options);
  const outputPath = resolve(options.outputPath);
  await writeJsonAtomic(outputPath, backup, true);
  return backup;
}

export async function readUserDataBackup(path: string): Promise<UserDataBackup> {
  if (path.trim().length === 0) {
    throw new Error("Backup path is required.");
  }
  const backup = JSON.parse((await readFile(path)).toString("utf8")) as unknown;
  const migrated = migrateUserDataBackupToLatest(backup).backup;
  assertValidUserDataBackup(migrated);
  return migrated;
}

export async function inspectUserDataBackup(path: string): Promise<BackupInspection> {
  try {
    const backup = await readUserDataBackup(path);
    return {
      valid: true,
      backupFormatVersion: backup.backupFormatVersion,
      createdAt: backup.createdAt,
      whackSmackerVersion: backup.whackSmackerVersion,
      includedSections: backup.includedSections,
      installedPackages: backup.restoreHints.installedPackages,
      errors: []
    };
  } catch (error) {
    return {
      valid: false,
      includedSections: [],
      installedPackages: [],
      errors: [error instanceof Error ? error.message : String(error)]
    };
  }
}

export async function restoreUserDataBackup(options: RestoreUserDataBackupOptions): Promise<RestoreUserDataBackupResult> {
  const backup = await readUserDataBackup(options.backupPath);
  const contentDir = resolveContentDataDirectory(options.dataDir);
  const progressDir = resolveProgressDir(contentDir, options.progressDir);
  const settingsDir = resolveSettingsDir(contentDir, options.settingsDir);
  const writes: Array<{ readonly name: UserDataBackupSectionName; readonly path: string; readonly data: unknown }> = [];

  if (backup.sections.installedPackageRegistry !== undefined) {
    writes.push({ name: "installedPackageRegistry", path: join(contentDir, "registry.json"), data: backup.sections.installedPackageRegistry.data });
  }
  if (backup.sections.reviewProgress !== undefined) {
    writes.push({ name: "reviewProgress", path: join(progressDir, "review-progress.json"), data: backup.sections.reviewProgress.data });
  }
  if (backup.sections.settings !== undefined) {
    writes.push({ name: "settings", path: join(settingsDir, "settings.json"), data: backup.sections.settings.data });
  }

  if (options.force !== true) {
    for (const write of writes) {
      await assertPathMissing(write.path);
    }
  }

  const restored: UserDataBackupSectionName[] = [];
  const paths: string[] = [];
  for (const write of writes) {
    assertRestorePath(write.path, contentDir, progressDir, settingsDir);
    await writeJsonAtomic(write.path, write.data, true);
    restored.push(write.name);
    paths.push(write.path);
  }
  return { restored, paths };
}

export async function migrateUserDataBackupFile(inputPath: string, outputPath: string): Promise<UserDataBackup> {
  const backup = await readUserDataBackup(inputPath);
  await writeJsonAtomic(resolve(outputPath), backup, true);
  return backup;
}

export function validateUserDataBackup(backup: unknown): { readonly valid: boolean; readonly errors: readonly string[] } {
  const errors: string[] = [];
  if (!isRecord(backup)) {
    return { valid: false, errors: ["Backup must be a JSON object."] };
  }
  if (backup.backupFormatVersion !== userDataBackupFormatVersion) {
    errors.push(`Unsupported backupFormatVersion: ${String(backup.backupFormatVersion)}`);
  }
  validateTimestamp(backup.createdAt, "createdAt", errors);
  if (typeof backup.whackSmackerVersion !== "string" || backup.whackSmackerVersion.trim().length === 0) {
    errors.push("whackSmackerVersion must be a non-empty string.");
  }
  if (!Array.isArray(backup.includedSections)) {
    errors.push("includedSections must be an array.");
  }
  validateSections(backup.sections, backup.includedSections, errors);
  validateRestoreHints(backup.restoreHints, errors);
  return { valid: errors.length === 0, errors };
}

export function assertValidUserDataBackup(backup: unknown): asserts backup is UserDataBackup {
  const result = validateUserDataBackup(backup);
  if (!result.valid) {
    throw new Error(`Invalid user data backup:\n${result.errors.join("\n")}`);
  }
}

function validateSections(sections: unknown, includedSections: unknown, errors: string[]): void {
  if (!isRecord(sections)) {
    errors.push("sections must be an object.");
    return;
  }
  for (const [name, path, validator] of [
    ["installedPackageRegistry", "content/registry.json", assertValidInstalledPackageRegistry],
    ["reviewProgress", "progress/review-progress.json", assertValidReviewProgressStore]
  ] as const) {
    const section = sections[name];
    if (section === undefined) {
      continue;
    }
    validateSection(section, name, path, errors, validator);
  }
  if (sections.settings !== undefined) {
    validateSection(sections.settings, "settings", "settings/settings.json", errors);
  }
  if (Array.isArray(includedSections)) {
    const actual = sectionNames(sections as Partial<UserDataBackupSections>);
    for (const name of includedSections) {
      if (!actual.includes(name as UserDataBackupSectionName)) {
        errors.push(`includedSections contains missing section: ${String(name)}`);
      }
    }
  }
}

function validateSection(
  section: unknown,
  name: string,
  expectedPath: string,
  errors: string[],
  validator?: (value: unknown) => void
): void {
  if (!isRecord(section)) {
    errors.push(`sections.${name} must be an object.`);
    return;
  }
  if (section.path !== expectedPath) {
    errors.push(`sections.${name}.path must be ${expectedPath}.`);
  }
  if (!/^[0-9a-f]{64}$/u.test(readString(section.sha256))) {
    errors.push(`sections.${name}.sha256 must be a lowercase SHA-256 digest.`);
  }
  if (!("data" in section)) {
    errors.push(`sections.${name}.data is required.`);
    return;
  }
  if (sha256Json(section.data) !== section.sha256) {
    errors.push(`sections.${name}.sha256 does not match section data.`);
  }
  if (validator !== undefined) {
    try {
      validator(section.data);
    } catch (error) {
      errors.push(`sections.${name}.data is invalid: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

function validateRestoreHints(value: unknown, errors: string[]): void {
  if (!isRecord(value) || !Array.isArray(value.installedPackages)) {
    errors.push("restoreHints.installedPackages must be an array.");
  }
}

function makeSection<T>(path: string, data: T): UserDataBackupSection<T> {
  return { path, sha256: sha256Json(data), data };
}

function sectionNames(sections: Partial<UserDataBackupSections>): UserDataBackupSectionName[] {
  return (["installedPackageRegistry", "reviewProgress", "settings"] as const).filter((name) => sections[name] !== undefined);
}

async function readOptionalJson(path: string): Promise<unknown | undefined> {
  try {
    return JSON.parse((await readFile(path)).toString("utf8")) as unknown;
  } catch (error) {
    if (isMissingFileError(error)) {
      return undefined;
    }
    throw error;
  }
}

async function writeJsonAtomic(path: string, data: unknown, overwrite: boolean): Promise<void> {
  const absolute = resolve(path);
  if (!overwrite) {
    await assertPathMissing(absolute);
  }
  await mkdir(dirname(absolute), { recursive: true });
  const temporary = join(dirname(absolute), `.${basename(absolute)}.${Date.now()}.tmp`);
  await writeFile(temporary, `${canonicalJson(data)}\n`);
  await rename(temporary, absolute);
}

async function assertPathMissing(path: string): Promise<void> {
  try {
    await access(path);
  } catch (error) {
    if (isMissingFileError(error)) {
      return;
    }
    throw error;
  }
  throw new Error(`Refusing to overwrite existing user data without --force: ${path}`);
}

function assertRestorePath(path: string, contentDir: string, progressDir: string, settingsDir: string): void {
  const allowed = [join(contentDir, "registry.json"), join(progressDir, "review-progress.json"), join(settingsDir, "settings.json")].map((path) =>
    resolve(path)
  );
  if (!allowed.includes(resolve(path))) {
    throw new Error(`Unsafe restore path: ${path}`);
  }
  for (const root of [join(contentDir, "packages"), join(contentDir, "cache")]) {
    const relativePath = relative(resolve(root), resolve(path));
    if (relativePath === "" || (!relativePath.startsWith("..") && !relativePath.includes("\\"))) {
      throw new Error(`Restore path must not target package content or caches: ${path}`);
    }
  }
}

function resolveProgressDir(contentDir: string, progressDir?: string): string {
  return progressDir === undefined ? defaultReviewProgressDirectoryForContentDataDirectory(contentDir) : resolveReviewProgressDirectory(progressDir);
}

function resolveSettingsDir(contentDir: string, settingsDir?: string): string {
  return settingsDir === undefined ? join(dirname(resolveContentDataDirectory(contentDir)), "settings") : resolve(settingsDir);
}

function sha256Json(value: unknown): string {
  return createHash("sha256").update(canonicalJson(value)).digest("hex");
}

function canonicalJson(value: unknown): string {
  return JSON.stringify(sortJson(value), null, 2);
}

function sortJson(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortJson);
  }
  if (isRecord(value)) {
    const output: Record<string, unknown> = {};
    for (const key of Object.keys(value).sort()) {
      output[key] = sortJson(value[key]);
    }
    return output;
  }
  return value;
}

function validateTimestamp(value: unknown, field: string, errors: string[]): void {
  const text = readString(value);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/u.test(text) || Number.isNaN(Date.parse(text))) {
    errors.push(`${field} must be an ISO 8601 UTC timestamp.`);
  }
}

function assertTimestamp(value: string, field: string): void {
  const errors: string[] = [];
  validateTimestamp(value, field, errors);
  if (errors.length > 0) {
    throw new Error(errors.join("\n"));
  }
}

function readString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isMissingFileError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}
