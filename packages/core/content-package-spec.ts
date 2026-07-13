export const whackSmackerPackageFormatVersion = 1;
export const whackSmackerPackageExtension = ".wspkg";

export const knownContentPackageTypes = [
  "language-curriculum",
  "core-review",
  "curriculum-source-language-pack",
  "linguistic-terminology",
  "mathematics-curriculum",
  "geography-dataset",
  "chess-content",
  "demonstration"
] as const;

export const knownContentPackageEntryPointRoles = ["primary", "index", "search-index", "metadata"] as const;

export interface ContentPackageManifest {
  readonly packageFormatVersion: 1;
  readonly packageId: string;
  readonly packageVersion: string;
  readonly displayName: LocalizedContentValue;
  readonly description: LocalizedContentValue;
  readonly contentType: string;
  readonly capabilities?: readonly ContentPackageCapability[];
  readonly relatedPackageIds?: readonly string[];
  readonly contentSchemaVersion: string;
  readonly minimumWhackSmackerVersion: string;
  readonly languages?: readonly string[];
  readonly subjects?: readonly string[];
  readonly source: ContentPackageSourceProvenance;
  readonly generatedAt: string;
  readonly generator: ContentPackageGeneratorProvenance;
  readonly entryPoints: readonly ContentPackageEntryPoint[];
  readonly dependencies?: readonly ContentPackageDependency[];
  readonly files: readonly ContentPackageFileRecord[];
  readonly license?: ContentPackageLicense;
  readonly homepage?: string;
  readonly authors?: readonly string[];
  readonly keywords?: readonly string[];
  readonly localization?: ContentPackageLocalizationMetadata;
}

export type ContentPackageCapability = "reading-curriculum" | "core-review" | "technical";

export type ContentPackageLocalizationMetadata =
  | { readonly role: "base-curriculum"; readonly schemaVersion: string; readonly targetLanguage: string; readonly defaultSourceLocale: string; readonly defaultSourcePackageId: string }
  | { readonly role: "source-language-pack"; readonly schemaVersion: string; readonly basePackageId: string; readonly sourceLocale: string; readonly targetLanguage: string; readonly compatibleBaseVersion: string; readonly isDefault?: boolean };

export interface ContentPackageSourceProvenance {
  readonly repository: string;
  readonly commit: string;
  readonly path?: string;
  readonly dirty?: boolean;
}

export interface ContentPackageGeneratorProvenance {
  readonly name: string;
  readonly version: string;
  readonly commit?: string;
}

export interface ContentPackageEntryPoint {
  readonly id: string;
  readonly mediaType: string;
  readonly path: string;
  readonly role: (typeof knownContentPackageEntryPointRoles)[number];
}

export interface ContentPackageDependency {
  readonly packageId: string;
  readonly version: string;
  readonly optional?: boolean;
}

export interface ContentPackageFileRecord {
  readonly path: string;
  readonly mediaType: string;
  readonly size: number;
  readonly sha256: string;
}

export interface ContentPackageLicense {
  readonly spdx?: string | null;
  readonly name?: string | null;
  readonly path?: string | null;
}

export interface ContentPackageValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
}

export function validateContentPackageManifest(manifest: unknown): ContentPackageValidationResult {
  const errors: string[] = [];

  if (!isRecord(manifest)) {
    return { valid: false, errors: ["Manifest must be a JSON object."] };
  }

  for (const field of requiredManifestFields) {
    if (!(field in manifest)) {
      errors.push(`Missing required field: ${field}`);
    }
  }

  if (manifest.packageFormatVersion !== whackSmackerPackageFormatVersion) {
    errors.push(`Unsupported packageFormatVersion: ${String(manifest.packageFormatVersion)}`);
  }

  validatePackageId(readString(manifest.packageId), "packageId", errors);
  validateSemver(readString(manifest.packageVersion), "packageVersion", errors);
  validateLocalizedContentValue(manifest.displayName, "displayName", errors);
  validateLocalizedContentValue(manifest.description, "description", errors);
  validateContentType(readString(manifest.contentType), errors);
  validateCapabilities(manifest.capabilities, errors);
  validateRelatedPackageIds(manifest.relatedPackageIds, readString(manifest.packageId), errors);
  validateSemver(readString(manifest.contentSchemaVersion), "contentSchemaVersion", errors);
  validateSemver(readString(manifest.minimumWhackSmackerVersion), "minimumWhackSmackerVersion", errors);
  validateSource(manifest.source, errors);
  validateGeneratedAt(manifest.generatedAt, errors);
  validateGenerator(manifest.generator, errors);

  const files = validateFiles(manifest.files, errors);
  validateEntryPoints(manifest.entryPoints, files, errors);
  validateDependencies(manifest.dependencies, readString(manifest.packageId), errors);
  validateLicense(manifest.license, files, errors);
  validateLocalization(manifest.localization, errors);

  return { valid: errors.length === 0, errors };
}

function validateCapabilities(value: unknown, errors: string[]): void {
  if (value === undefined) return;
  if (!Array.isArray(value) || value.length === 0) { errors.push("capabilities must be a non-empty array when present."); return; }
  const allowed = new Set(["reading-curriculum", "core-review", "technical"]);
  const seen = new Set<string>();
  for (const [index, capability] of value.entries()) {
    if (typeof capability !== "string" || !allowed.has(capability)) errors.push(`capabilities[${index}] is unsupported.`);
    else if (seen.has(capability)) errors.push(`Duplicate capability: ${capability}`);
    else seen.add(capability);
  }
}

function validateRelatedPackageIds(value: unknown, ownId: string, errors: string[]): void {
  if (value === undefined) return;
  if (!Array.isArray(value)) { errors.push("relatedPackageIds must be an array when present."); return; }
  const seen = new Set<string>();
  for (const [index, id] of value.entries()) {
    const packageId = typeof id === "string" ? id : "";
    validatePackageId(packageId, `relatedPackageIds[${index}]`, errors);
    if (packageId === ownId) errors.push("relatedPackageIds must not contain packageId.");
    if (seen.has(packageId)) errors.push(`Duplicate relatedPackageId: ${packageId}`);
    seen.add(packageId);
  }
}

function validateLocalization(value: unknown, errors: string[]): void {
  if (value === undefined) return;
  if (!isRecord(value) || (value.role !== "base-curriculum" && value.role !== "source-language-pack")) {
    errors.push("localization must declare a supported role."); return;
  }
  validateSemver(readString(value.schemaVersion), "localization.schemaVersion", errors);
  validateNonEmptyString(value.targetLanguage, "localization.targetLanguage", errors);
  if (value.role === "base-curriculum") {
    validateNonEmptyString(value.defaultSourceLocale, "localization.defaultSourceLocale", errors);
    validatePackageId(readString(value.defaultSourcePackageId), "localization.defaultSourcePackageId", errors);
  } else {
    validatePackageId(readString(value.basePackageId), "localization.basePackageId", errors);
    validateNonEmptyString(value.sourceLocale, "localization.sourceLocale", errors);
    validateNonEmptyString(value.compatibleBaseVersion, "localization.compatibleBaseVersion", errors);
    if (value.isDefault !== undefined && typeof value.isDefault !== "boolean") errors.push("localization.isDefault must be boolean.");
  }
}

export function assertValidContentPackageManifest(manifest: unknown): asserts manifest is ContentPackageManifest {
  const result = validateContentPackageManifest(manifest);

  if (!result.valid) {
    throw new Error(`Invalid content package manifest:\n${result.errors.join("\n")}`);
  }
}

export function isSafeContentPackagePath(value: string): boolean {
  if (value.length === 0 || value.startsWith("/") || value.includes("\\") || value.includes("\0")) {
    return false;
  }

  return !value.split("/").some((segment) => segment.length === 0 || segment === "." || segment === "..");
}

export function isContentPackageId(value: string): boolean {
  return /^[a-z0-9][a-z0-9-]*(?:\.[a-z0-9][a-z0-9-]*){2,}$/u.test(value);
}

export function isSemver(value: string): boolean {
  return /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/u.test(value);
}

const requiredManifestFields = [
  "packageFormatVersion",
  "packageId",
  "packageVersion",
  "displayName",
  "description",
  "contentType",
  "contentSchemaVersion",
  "minimumWhackSmackerVersion",
  "source",
  "generatedAt",
  "generator",
  "entryPoints",
  "files"
] as const;

function validateSource(value: unknown, errors: string[]): void {
  if (!isRecord(value)) {
    errors.push("source must be an object.");
    return;
  }

  validateNonEmptyString(value.repository, "source.repository", errors);
  if (!isGitCommit(readString(value.commit))) {
    errors.push("source.commit must be a 40-character lowercase hexadecimal Git commit.");
  }

  if (value.path !== undefined && !isSafeContentPackagePath(readString(value.path))) {
    errors.push("source.path must be a safe relative path.");
  }

  if (value.dirty !== undefined && typeof value.dirty !== "boolean") {
    errors.push("source.dirty must be a boolean when present.");
  }
}

function validateGenerator(value: unknown, errors: string[]): void {
  if (!isRecord(value)) {
    errors.push("generator must be an object.");
    return;
  }

  validateNonEmptyString(value.name, "generator.name", errors);
  validateSemver(readString(value.version), "generator.version", errors);

  if (value.commit !== undefined && !isGitCommit(readString(value.commit))) {
    errors.push("generator.commit must be a 40-character lowercase hexadecimal Git commit when present.");
  }
}

function validateFiles(value: unknown, errors: string[]): Set<string> {
  const paths = new Set<string>();

  if (!Array.isArray(value)) {
    errors.push("files must be an array.");
    return paths;
  }

  for (const [index, file] of value.entries()) {
    if (!isRecord(file)) {
      errors.push(`files[${index}] must be an object.`);
      continue;
    }

    const path = readString(file.path);
    if (!isSafeContentPackagePath(path)) {
      errors.push(`files[${index}].path must be a safe relative path.`);
    } else if (paths.has(path)) {
      errors.push(`Duplicate file path: ${path}`);
    } else {
      paths.add(path);
    }

    validateNonEmptyString(file.mediaType, `files[${index}].mediaType`, errors);

    if (typeof file.size !== "number" || !Number.isSafeInteger(file.size) || file.size < 0) {
      errors.push(`files[${index}].size must be a non-negative safe integer.`);
    }

    if (!/^[0-9a-f]{64}$/u.test(readString(file.sha256))) {
      errors.push(`files[${index}].sha256 must be a lowercase 64-character SHA-256 digest.`);
    }
  }

  return paths;
}

function validateEntryPoints(value: unknown, files: ReadonlySet<string>, errors: string[]): void {
  const ids = new Set<string>();
  let hasPrimary = false;

  if (!Array.isArray(value) || value.length === 0) {
    errors.push("entryPoints must be a non-empty array.");
    return;
  }

  for (const [index, entryPoint] of value.entries()) {
    if (!isRecord(entryPoint)) {
      errors.push(`entryPoints[${index}] must be an object.`);
      continue;
    }

    const id = readString(entryPoint.id);
    if (!/^[a-z0-9][a-z0-9-]*$/u.test(id)) {
      errors.push(`entryPoints[${index}].id must use lowercase ASCII letters, digits, and hyphens.`);
    } else if (ids.has(id)) {
      errors.push(`Duplicate entry point ID: ${id}`);
    } else {
      ids.add(id);
    }

    validateNonEmptyString(entryPoint.mediaType, `entryPoints[${index}].mediaType`, errors);

    const path = readString(entryPoint.path);
    if (!isSafeContentPackagePath(path)) {
      errors.push(`entryPoints[${index}].path must be a safe relative path.`);
    } else if (!files.has(path)) {
      errors.push(`Entry point references undeclared file: ${path}`);
    }

    const role = readString(entryPoint.role);
    if (!knownContentPackageEntryPointRoles.includes(role as ContentPackageEntryPoint["role"])) {
      errors.push(`Unsupported entry point role: ${role}`);
    }
    if (role === "primary") {
      hasPrimary = true;
    }
  }

  if (!hasPrimary) {
    errors.push("At least one primary entry point is required.");
  }
}

function validateDependencies(value: unknown, packageId: string, errors: string[]): void {
  const dependencyIds = new Set<string>();

  if (value === undefined) {
    return;
  }

  if (!Array.isArray(value)) {
    errors.push("dependencies must be an array when present.");
    return;
  }

  for (const [index, dependency] of value.entries()) {
    if (!isRecord(dependency)) {
      errors.push(`dependencies[${index}] must be an object.`);
      continue;
    }

    const dependencyPackageId = readString(dependency.packageId);
    validatePackageId(dependencyPackageId, `dependencies[${index}].packageId`, errors);
    if (dependencyPackageId === packageId) {
      errors.push("A package must not depend on itself.");
    }
    if (dependencyIds.has(dependencyPackageId)) {
      errors.push(`Duplicate dependency: ${dependencyPackageId}`);
    } else {
      dependencyIds.add(dependencyPackageId);
    }

    if (!isSemverRange(readString(dependency.version))) {
      errors.push(`dependencies[${index}].version must be a documented SemVer-compatible range.`);
    }

    if (dependency.optional !== undefined && typeof dependency.optional !== "boolean") {
      errors.push(`dependencies[${index}].optional must be a boolean when present.`);
    }
  }
}

function validateLicense(value: unknown, files: ReadonlySet<string>, errors: string[]): void {
  if (value === undefined) {
    return;
  }

  if (!isRecord(value)) {
    errors.push("license must be an object when present.");
    return;
  }

  if (value.path !== null && value.path !== undefined) {
    const licensePath = readString(value.path);
    if (!isSafeContentPackagePath(licensePath)) {
      errors.push("license.path must be a safe relative path.");
    } else if (!files.has(licensePath)) {
      errors.push("license.path must reference a file declared in files.");
    }
  }
}

function validatePackageId(value: string, field: string, errors: string[]): void {
  if (!isContentPackageId(value)) {
    errors.push(`${field} must use reverse-domain package ID syntax.`);
  }
}

function validateContentType(value: string, errors: string[]): void {
  if (knownContentPackageTypes.includes(value as (typeof knownContentPackageTypes)[number])) {
    return;
  }

  if (!isContentPackageId(value)) {
    errors.push("contentType must be a known type or a namespaced custom content type.");
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

function isGitCommit(value: string): boolean {
  return /^[0-9a-f]{40}$/u.test(value);
}

function readString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
import { isLocalizedContentValue, type LocalizedContentValue } from "./localized-content";
