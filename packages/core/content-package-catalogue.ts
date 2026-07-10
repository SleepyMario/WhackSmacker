import {
  assertValidContentPackageManifest,
  isContentPackageId,
  isSemver,
  whackSmackerPackageExtension,
  type ContentPackageDependency,
  type ContentPackageLicense,
  type ContentPackageManifest,
  type ContentPackageSourceProvenance
} from "./content-package-spec";
import { isLocalizedContentValue, type LocalizedContentValue } from "./localized-content";

type BufferValue = {
  readonly length: number;
  readonly byteLength: number;
  [Symbol.iterator](): IterableIterator<number>;
  subarray(start: number, end?: number): BufferValue;
  toString(encoding: "utf8"): string;
  readUInt16LE(offset: number): number;
  readUInt32LE(offset: number): number;
};

declare function require(name: "node:buffer"): {
  Buffer: {
    from(value: string, encoding: "utf8"): BufferValue;
  };
};
declare function require(name: "node:crypto"): {
  createHash(algorithm: "sha256"): {
    update(data: BufferValue): { digest(encoding: "hex"): string };
  };
};
declare function require(name: "node:fs/promises"): {
  mkdir(path: string, options: { recursive: boolean }): Promise<void>;
  readdir(path: string): Promise<string[]>;
  readFile(path: string): Promise<BufferValue>;
  stat(path: string): Promise<{ isFile(): boolean; size: number }>;
  writeFile(path: string, data: string): Promise<void>;
};
declare function require(name: "node:path"): {
  dirname(path: string): string;
  join(...paths: string[]): string;
  resolve(...paths: string[]): string;
};

const { Buffer } = require("node:buffer");
const { createHash } = require("node:crypto");
const { mkdir, readdir, readFile, stat, writeFile } = require("node:fs/promises");
const { dirname, join, resolve } = require("node:path");

export const contentPackageCatalogueFormatVersion = 1;
export const whackSmackerPackageMediaType = "application/vnd.whacksmacker.package+zip";

export interface ContentPackageCatalogue {
  readonly catalogueFormatVersion: 1;
  readonly catalogueId: string;
  readonly displayName: LocalizedContentValue;
  readonly description: LocalizedContentValue;
  readonly generatedAt: string;
  readonly packages: readonly ContentPackageCatalogueEntry[];
}

export interface ContentPackageCatalogueEntry {
  readonly packageId: string;
  readonly packageVersion: string;
  readonly displayName: LocalizedContentValue;
  readonly description: LocalizedContentValue;
  readonly contentType: string;
  readonly contentSchemaVersion: string;
  readonly minimumWhackSmackerVersion: string;
  readonly languages?: readonly string[];
  readonly subjects?: readonly string[];
  readonly source: ContentPackageSourceProvenance;
  readonly package: ContentPackageCatalogueFile;
  readonly dependencies?: readonly ContentPackageDependency[];
  readonly license?: ContentPackageLicense;
  readonly homepage?: string;
  readonly authors?: readonly string[];
  readonly keywords?: readonly string[];
}

export interface ContentPackageCatalogueFile {
  readonly url: string;
  readonly mediaType: string;
  readonly size: number;
  readonly sha256: string;
}

export interface ContentPackageCatalogueValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
}

export interface GenerateLocalContentPackageCatalogueOptions {
  readonly packagesDirectory: string;
  readonly outputPath: string;
  readonly generatedAt: string;
  readonly catalogueId?: string;
  readonly displayName?: string;
  readonly description?: string;
}

export interface GeneratedLocalContentPackageCatalogueResult {
  readonly outputPath: string;
  readonly catalogue: ContentPackageCatalogue;
  readonly packageCount: number;
  readonly changed: boolean;
}

export function validateContentPackageCatalogue(catalogue: unknown): ContentPackageCatalogueValidationResult {
  const errors: string[] = [];

  if (!isRecord(catalogue)) {
    return { valid: false, errors: ["Catalogue must be a JSON object."] };
  }

  for (const field of requiredCatalogueFields) {
    if (!(field in catalogue)) {
      errors.push(`Missing required field: ${field}`);
    }
  }

  if (catalogue.catalogueFormatVersion !== contentPackageCatalogueFormatVersion) {
    errors.push(`Unsupported catalogueFormatVersion: ${String(catalogue.catalogueFormatVersion)}`);
  }

  validateCatalogueId(readString(catalogue.catalogueId), "catalogueId", errors);
  validateLocalizedContentValue(catalogue.displayName, "displayName", errors);
  validateLocalizedContentValue(catalogue.description, "description", errors);
  validateGeneratedAt(catalogue.generatedAt, errors);
  validateCataloguePackages(catalogue.packages, errors);

  return { valid: errors.length === 0, errors };
}

export function assertValidContentPackageCatalogue(catalogue: unknown): asserts catalogue is ContentPackageCatalogue {
  const result = validateContentPackageCatalogue(catalogue);
  if (!result.valid) {
    throw new Error(`Invalid content package catalogue:\n${result.errors.join("\n")}`);
  }
}

export async function generateLocalContentPackageCatalogue(
  options: GenerateLocalContentPackageCatalogueOptions
): Promise<GeneratedLocalContentPackageCatalogueResult> {
  const packagePaths = await findPackageArchives(options.packagesDirectory);
  const packages = await Promise.all(packagePaths.map((packagePath) => createCatalogueEntry(packagePath)));
  const catalogue: ContentPackageCatalogue = {
    catalogueFormatVersion: contentPackageCatalogueFormatVersion,
    catalogueId: options.catalogueId ?? "com.sleepymario.local",
    displayName: options.displayName ?? "Sleepy Mario Local Content Catalogue",
    description: options.description ?? "Local development catalogue for WhackSmacker content packages.",
    generatedAt: options.generatedAt,
    packages: sortCatalogueEntries(packages)
  };

  assertValidContentPackageCatalogue(catalogue);

  const json = `${JSON.stringify(catalogue, null, 2)}\n`;
  let changed = true;
  try {
    changed = (await readFile(options.outputPath)).toString("utf8") !== json;
  } catch {
    changed = true;
  }

  if (changed) {
    await mkdir(dirname(options.outputPath), { recursive: true });
    await writeFile(options.outputPath, json);
  }

  return {
    outputPath: options.outputPath,
    catalogue,
    packageCount: catalogue.packages.length,
    changed
  };
}

export function sortCatalogueEntries(entries: readonly ContentPackageCatalogueEntry[]): readonly ContentPackageCatalogueEntry[] {
  return [...entries].sort((left, right) => {
    const packageOrder = left.packageId.localeCompare(right.packageId);
    return packageOrder === 0 ? left.packageVersion.localeCompare(right.packageVersion) : packageOrder;
  });
}

async function createCatalogueEntry(packagePath: string): Promise<ContentPackageCatalogueEntry> {
  const archive = await readFile(packagePath);
  const manifest = readManifestFromPackageArchive(archive);
  const archiveStats = await stat(packagePath);

  return {
    packageId: manifest.packageId,
    packageVersion: manifest.packageVersion,
    displayName: manifest.displayName,
    description: manifest.description,
    contentType: manifest.contentType,
    contentSchemaVersion: manifest.contentSchemaVersion,
    minimumWhackSmackerVersion: manifest.minimumWhackSmackerVersion,
    ...(manifest.languages === undefined ? {} : { languages: [...manifest.languages].sort() }),
    ...(manifest.subjects === undefined ? {} : { subjects: [...manifest.subjects].sort() }),
    source: manifest.source,
    package: {
      url: pathToFileUrl(resolve(packagePath)),
      mediaType: whackSmackerPackageMediaType,
      size: archiveStats.size,
      sha256: sha256Hex(archive)
    },
    ...(manifest.dependencies === undefined ? {} : { dependencies: [...manifest.dependencies] }),
    ...(manifest.license === undefined ? {} : { license: manifest.license }),
    ...(manifest.homepage === undefined ? {} : { homepage: manifest.homepage }),
    ...(manifest.authors === undefined ? {} : { authors: [...manifest.authors] }),
    ...(manifest.keywords === undefined ? {} : { keywords: [...manifest.keywords].sort() })
  };
}

function readManifestFromPackageArchive(archive: BufferValue): ContentPackageManifest {
  let offset = 0;

  while (offset + 30 <= archive.length && archive.readUInt32LE(offset) === 0x04034b50) {
    const compressionMethod = archive.readUInt16LE(offset + 8);
    const compressedSize = archive.readUInt32LE(offset + 18);
    const uncompressedSize = archive.readUInt32LE(offset + 22);
    const fileNameLength = archive.readUInt16LE(offset + 26);
    const extraLength = archive.readUInt16LE(offset + 28);
    const nameStart = offset + 30;
    const dataStart = nameStart + fileNameLength + extraLength;
    const dataEnd = dataStart + compressedSize;

    if (dataEnd > archive.length) {
      throw new Error("Package archive has a truncated local file entry.");
    }

    const path = archive.subarray(nameStart, nameStart + fileNameLength).toString("utf8");
    if (path === "manifest.json") {
      if (compressionMethod !== 0 || compressedSize !== uncompressedSize) {
        throw new Error("manifest.json must be stored without compression in Point 3 catalogue generation.");
      }
      const manifest = JSON.parse(archive.subarray(dataStart, dataEnd).toString("utf8")) as unknown;
      assertValidContentPackageManifest(manifest);
      return manifest;
    }

    offset = dataEnd;
  }

  throw new Error("Package archive does not contain manifest.json.");
}

async function findPackageArchives(packagesDirectory: string): Promise<readonly string[]> {
  const entries = await readdir(packagesDirectory);
  const paths: string[] = [];
  for (const entry of entries.sort()) {
    if (!entry.endsWith(whackSmackerPackageExtension)) {
      continue;
    }
    const path = join(packagesDirectory, entry);
    if ((await stat(path)).isFile()) {
      paths.push(path);
    }
  }
  return paths;
}

function validateCataloguePackages(value: unknown, errors: string[]): void {
  const packageKeys = new Set<string>();
  const packageUrls = new Set<string>();

  if (!Array.isArray(value)) {
    errors.push("packages must be an array.");
    return;
  }

  for (const [index, entry] of value.entries()) {
    if (!isRecord(entry)) {
      errors.push(`packages[${index}] must be an object.`);
      continue;
    }

    const packageId = readString(entry.packageId);
    validateCatalogueId(packageId, `packages[${index}].packageId`, errors);
    validateSemver(readString(entry.packageVersion), `packages[${index}].packageVersion`, errors);
    validateLocalizedContentValue(entry.displayName, `packages[${index}].displayName`, errors);
    validateLocalizedContentValue(entry.description, `packages[${index}].description`, errors);
    validateNonEmptyString(entry.contentType, `packages[${index}].contentType`, errors);
    validateSemver(readString(entry.contentSchemaVersion), `packages[${index}].contentSchemaVersion`, errors);
    validateSemver(readString(entry.minimumWhackSmackerVersion), `packages[${index}].minimumWhackSmackerVersion`, errors);
    validateSource(entry.source, `packages[${index}].source`, errors);
    validatePackageFile(entry.package, `packages[${index}].package`, errors, packageUrls);
    validateDependencies(entry.dependencies, packageId, `packages[${index}].dependencies`, errors);

    const packageKey = `${packageId}@${readString(entry.packageVersion)}`;
    if (packageKeys.has(packageKey)) {
      errors.push(`Duplicate package entry: ${packageKey}`);
    } else {
      packageKeys.add(packageKey);
    }
  }
}

function validatePackageFile(value: unknown, field: string, errors: string[], packageUrls: Set<string>): void {
  if (!isRecord(value)) {
    errors.push(`${field} must be an object.`);
    return;
  }

  const url = readString(value.url);
  if (!isAllowedPackageUrl(url)) {
    errors.push(`${field}.url must be a valid file:// or https:// URL.`);
  } else if (packageUrls.has(url)) {
    errors.push(`Duplicate package URL: ${url}`);
  } else {
    packageUrls.add(url);
  }

  validateNonEmptyString(value.mediaType, `${field}.mediaType`, errors);

  if (typeof value.size !== "number" || !Number.isSafeInteger(value.size) || value.size < 0) {
    errors.push(`${field}.size must be a non-negative safe integer.`);
  }

  if (!/^[0-9a-f]{64}$/u.test(readString(value.sha256))) {
    errors.push(`${field}.sha256 must be a lowercase 64-character SHA-256 digest.`);
  }
}

function validateDependencies(value: unknown, packageId: string, field: string, errors: string[]): void {
  const dependencyIds = new Set<string>();
  if (value === undefined) {
    return;
  }
  if (!Array.isArray(value)) {
    errors.push(`${field} must be an array when present.`);
    return;
  }

  for (const [index, dependency] of value.entries()) {
    if (!isRecord(dependency)) {
      errors.push(`${field}[${index}] must be an object.`);
      continue;
    }

    const dependencyPackageId = readString(dependency.packageId);
    validateCatalogueId(dependencyPackageId, `${field}[${index}].packageId`, errors);
    if (dependencyPackageId === packageId) {
      errors.push("A package catalogue entry must not depend on itself.");
    }
    if (dependencyIds.has(dependencyPackageId)) {
      errors.push(`Duplicate dependency: ${dependencyPackageId}`);
    } else {
      dependencyIds.add(dependencyPackageId);
    }
    if (!isSemverRange(readString(dependency.version))) {
      errors.push(`${field}[${index}].version must be a documented SemVer-compatible range.`);
    }
    if (dependency.optional !== undefined && typeof dependency.optional !== "boolean") {
      errors.push(`${field}[${index}].optional must be a boolean when present.`);
    }
  }
}

function validateSource(value: unknown, field: string, errors: string[]): void {
  if (!isRecord(value)) {
    errors.push(`${field} must be an object.`);
    return;
  }
  validateNonEmptyString(value.repository, `${field}.repository`, errors);
  if (!/^[0-9a-f]{40}$/u.test(readString(value.commit))) {
    errors.push(`${field}.commit must be a 40-character lowercase hexadecimal Git commit.`);
  }
}

function isAllowedPackageUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "file:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function validateCatalogueId(value: string, field: string, errors: string[]): void {
  if (!isContentPackageId(value)) {
    errors.push(`${field} must use lowercase reverse-domain ID syntax.`);
  }
}

function validateSemver(value: string, field: string, errors: string[]): void {
  if (!isSemver(value)) {
    errors.push(`${field} must use MAJOR.MINOR.PATCH Semantic Versioning.`);
  }
}

function validateGeneratedAt(value: unknown, errors: string[]): void {
  const text = readString(value);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/u.test(text) || Number.isNaN(Date.parse(text))) {
    errors.push("generatedAt must be an ISO 8601 UTC timestamp.");
  }
}

function validateNonEmptyString(value: unknown, field: string, errors: string[]): void {
  if (typeof value !== "string" || value.trim().length === 0) {
    errors.push(`${field} must be a non-empty string.`);
  }
}

function validateLocalizedContentValue(value: unknown, field: string, errors: string[]): void {
  if (!isLocalizedContentValue(value)) {
    errors.push(`${field} must be a non-empty string or a non-empty locale-to-string object.`);
  }
}

function isSemverRange(value: string): boolean {
  return /^(?:[<>=~^]*\d+\.\d+\.\d+)(?:\s+[<>=~^]*\d+\.\d+\.\d+)*$/u.test(value);
}

function readString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sha256Hex(data: BufferValue): string {
  return createHash("sha256").update(data).digest("hex");
}

function pathToFileUrl(path: string): string {
  return new URL(path, "file://").href;
}

const requiredCatalogueFields = ["catalogueFormatVersion", "catalogueId", "displayName", "description", "generatedAt", "packages"] as const;
