import {
  assertValidContentPackageCatalogue,
  type ContentPackageCatalogue,
  type ContentPackageCatalogueEntry
} from "./content-package-catalogue";
import {
  assertValidContentPackageManifest,
  isContentPackageId,
  isSafeContentPackagePath,
  isSemver,
  type ContentPackageManifest,
  type ContentPackageSourceProvenance
} from "./content-package-spec";
import { perfCount, perfSpan, perfSpanSync } from "./performance";
import { invalidateInstalledContent } from "./installed-content-cache";
import { assertCanonicalCastBootstrapSnapshot } from "./language-curriculum-bootstrap";
import { isLocalizedContentValue, localized } from "./localized-content";
import {
  assertMemorizationMediaManifestReferences,
  packageImageMediaTypeForPath
} from "./package-media";
import {
  compareDeckFrameworkVersions,
  immutableDeckArtifactKey,
  projectDeckFrameworkVersion,
  validateDeckFrameworkVersion,
  validateDeckInteractionProfile,
  validateMediaPolicy
} from "./deck-framework";
import {
  animalsLegacyVersionMigrations,
  animalsPreviewPackageId,
  legacyPackageVersionMigration
} from "./package-version-migration";

type BufferValue = {
  readonly length: number;
  [Symbol.iterator](): IterableIterator<number>;
  subarray(start: number, end?: number): BufferValue;
  toString(encoding: "utf8"): string;
  readUInt16LE(offset: number): number;
  readUInt32LE(offset: number): number;
};

declare function require(name: "node:buffer"): {
  Buffer: {
    from(value: string | ArrayBuffer, encoding?: "utf8"): BufferValue;
    concat(buffers: readonly BufferValue[]): BufferValue;
  };
};
declare function require(name: "node:crypto"): {
  createHash(algorithm: "sha256"): {
    update(data: BufferValue): { digest(encoding: "hex"): string };
  };
};
declare function require(name: "node:zlib"): {
  inflateRawSync(data: BufferValue, options: { maxOutputLength: number }): BufferValue;
};
declare function require(name: "node:fs/promises"): {
  access(path: string): Promise<void>;
  chmod(path: string, mode: number): Promise<void>;
  mkdir(path: string, options: { recursive: boolean }): Promise<void>;
  readFile(path: string): Promise<BufferValue>;
  rename(oldPath: string, newPath: string): Promise<void>;
  rm(path: string, options: { recursive: boolean; force: boolean }): Promise<void>;
  stat(path: string): Promise<{ isDirectory(): boolean; size: number }>;
  writeFile(path: string, data: string | BufferValue): Promise<void>;
};
declare function require(name: "node:path"): {
  dirname(path: string): string;
  join(...paths: string[]): string;
  relative(from: string, to: string): string;
  resolve(...paths: string[]): string;
};
declare const process: {
  env: Record<string, string | undefined>;
};
declare function fetch(url: string, options: { redirect: "error"; signal: AbortSignal }): Promise<{
  readonly ok: boolean;
  readonly status: number;
  readonly statusText: string;
  readonly body: unknown;
  arrayBuffer(): Promise<ArrayBuffer>;
}>;
declare const AbortSignal: {
  timeout(milliseconds: number): AbortSignal;
};

const { Buffer } = require("node:buffer");
const { createHash } = require("node:crypto");
const { inflateRawSync } = require("node:zlib");
const { access, chmod, mkdir, readFile, rename, rm, stat, writeFile } = require("node:fs/promises");
const { dirname, join, relative, resolve } = require("node:path");

export const installedPackageRegistryFormatVersion = 1;
export const maxPackageArchiveSizeBytes = 100 * 1024 * 1024;
export const maxPackageUncompressedSizeBytes = 100 * 1024 * 1024;
export const maxPackageArchiveFileCount = 10000;

export interface InstalledPackageRegistry {
  readonly registryFormatVersion: 1;
  readonly updatedAt: string;
  readonly packages: readonly InstalledPackageRecord[];
}

export interface InstalledPackageRecord {
  readonly packageId: string;
  readonly packageVersion: string;
  readonly deckVersion?: string;
  readonly artifactRevision?: number;
  readonly displayName: string;
  readonly contentType: string;
  readonly capabilities?: ContentPackageManifest["capabilities"];
  readonly deckFamily?: ContentPackageManifest["deckFamily"];
  readonly topic?: ContentPackageManifest["topic"];
  readonly mediaPolicy?: ContentPackageManifest["mediaPolicy"];
  readonly interactionProfile?: ContentPackageManifest["interactionProfile"];
  readonly relatedPackageIds?: readonly string[];
  readonly contentSchemaVersion: string;
  readonly minimumWhackSmackerVersion: string;
  readonly source: ContentPackageSourceProvenance;
  readonly installedAt: string;
  readonly installPath: string;
  readonly manifestSha256: string;
  readonly archiveSha256: string;
  readonly archiveSize: number;
  readonly catalogueId: string;
}

export interface InstalledPackageRegistryValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
}

export interface InstallContentPackageOptions {
  readonly cataloguePath: string;
  readonly packageId: string;
  readonly packageVersion?: string;
  readonly deckVersion?: string;
  readonly artifactRevision?: number;
  readonly dataDir?: string;
  readonly installedAt?: string;
  readonly force?: boolean;
}

export interface InstallContentPackageResult {
  readonly installed: boolean;
  readonly record: InstalledPackageRecord;
  readonly installPath: string;
}

export interface RemoveContentPackageOptions {
  readonly dataDir?: string;
  readonly packageId: string;
  readonly packageVersion?: string;
  readonly deckVersion?: string;
  readonly artifactRevision?: number;
  readonly allVersions?: boolean;
  readonly removedAt?: string;
}

export interface RemoveContentPackageResult {
  readonly removed: readonly InstalledPackageRecord[];
}

export interface ContentPackageUpdate {
  readonly packageId: string;
  readonly installedVersion: string;
  readonly availableVersion: string;
  readonly catalogueEntry: ContentPackageCatalogueEntry;
}

export interface MigrateInstalledPackageRegistryVersionAxesOptions {
  readonly dataDir?: string;
  readonly migratedAt: string;
  readonly currentReleasePackageIds: readonly string[];
  readonly reserveCanonicalAnimalsRevision3?: boolean;
}

export interface MigrateInstalledPackageRegistryVersionAxesResult {
  readonly changed: boolean;
  readonly migratedRecordCount: number;
  readonly preservedLegacyInstallPaths: readonly string[];
  readonly registry: InstalledPackageRegistry;
}

export function resolveContentDataDirectory(dataDir?: string, env = process.env): string {
  if (dataDir !== undefined && dataDir.trim().length > 0) {
    return resolve(dataDir);
  }

  const xdgDataHome = env.XDG_DATA_HOME;
  if (xdgDataHome !== undefined && xdgDataHome.trim().length > 0) {
    return join(xdgDataHome, "whacksmacker", "content");
  }

  const home = env.HOME;
  if (home === undefined || home.trim().length === 0) {
    throw new Error("Cannot resolve content data directory without HOME or XDG_DATA_HOME. Use --data-dir.");
  }
  return join(home, ".local", "share", "whacksmacker", "content");
}

export async function loadContentPackageCatalogue(cataloguePath: string): Promise<ContentPackageCatalogue> {
  return perfSpan("package.catalogue.load", { cataloguePath }, async () => {
    perfCount("filesystem.read.count");
    const bytes = await readFile(cataloguePath);
    const catalogue = perfSpanSync("json.parse", { kind: "catalogue" }, () => {
      perfCount("json.parse.count");
      return JSON.parse(bytes.toString("utf8")) as unknown;
    });
    perfSpanSync("package.validation", { kind: "catalogue" }, () => {
      perfCount("package.validation.count");
      assertValidContentPackageCatalogue(catalogue);
    });
    return catalogue as ContentPackageCatalogue;
  });
}

export async function listAvailableContentPackages(cataloguePath: string): Promise<readonly ContentPackageCatalogueEntry[]> {
  const catalogue = await loadContentPackageCatalogue(cataloguePath);
  return [...catalogue.packages];
}

export function validateInstalledPackageRegistry(registry: unknown): InstalledPackageRegistryValidationResult {
  const errors: string[] = [];

  if (!isRecord(registry)) {
    return { valid: false, errors: ["Installed package registry must be a JSON object."] };
  }

  if (registry.registryFormatVersion !== installedPackageRegistryFormatVersion) {
    errors.push(`Unsupported registryFormatVersion: ${String(registry.registryFormatVersion)}`);
  }
  validateTimestamp(registry.updatedAt, "updatedAt", errors);
  validateRegistryPackages(registry.packages, errors);

  return { valid: errors.length === 0, errors };
}

export function assertValidInstalledPackageRegistry(registry: unknown): asserts registry is InstalledPackageRegistry {
  const result = validateInstalledPackageRegistry(registry);
  if (!result.valid) {
    throw new Error(`Invalid installed package registry:\n${result.errors.join("\n")}`);
  }
}

export async function loadInstalledPackageRegistry(dataDir?: string): Promise<InstalledPackageRegistry> {
  const contentDir = resolveContentDataDirectory(dataDir);
  const registryPath = join(contentDir, "registry.json");
  try {
    perfCount("filesystem.read.count");
    const bytes = await readFile(registryPath);
    const registry = perfSpanSync("json.parse", { kind: "installed-registry" }, () => {
      perfCount("json.parse.count");
      return JSON.parse(bytes.toString("utf8")) as unknown;
    });
    perfSpanSync("package.validation", { kind: "installed-registry" }, () => {
      perfCount("package.validation.count");
      assertValidInstalledPackageRegistry(registry);
    });
    return registry as InstalledPackageRegistry;
  } catch (error) {
    if (isMissingFileError(error)) {
      return emptyRegistry("1970-01-01T00:00:00Z");
    }
    throw error;
  }
}

export async function listInstalledContentPackages(dataDir?: string): Promise<readonly InstalledPackageRecord[]> {
  return (await loadInstalledPackageRegistry(dataDir)).packages;
}

export async function migrateInstalledPackageRegistryVersionAxes(
  options: MigrateInstalledPackageRegistryVersionAxesOptions
): Promise<MigrateInstalledPackageRegistryVersionAxesResult> {
  const contentDir = resolveContentDataDirectory(options.dataDir);
  const original = await loadInstalledPackageRegistry(contentDir);
  const currentIds = new Set(options.currentReleasePackageIds);
  const packages: InstalledPackageRecord[] = [];
  const preservedLegacyInstallPaths: string[] = [];
  let migratedRecordCount = 0;
  for (const record of original.packages) {
    if (record.deckVersion !== undefined || record.artifactRevision !== undefined) {
      packages.push(record);
      continue;
    }
    const animals = legacyPackageVersionMigration(record.packageId, record.packageVersion, animalsLegacyVersionMigrations);
    if (animals !== undefined && options.reserveCanonicalAnimalsRevision3 === true && record.packageId === animalsPreviewPackageId && animals.artifactRevision === 3) {
      preservedLegacyInstallPaths.push(record.installPath);
      migratedRecordCount += 1;
      continue;
    }
    if (animals !== undefined) {
      packages.push({ ...record, ...animals });
      migratedRecordCount += 1;
      continue;
    }
    if (record.packageVersion === "0.1.0" && currentIds.has(record.packageId)) {
      packages.push({ ...record, deckVersion: "0.0.1", artifactRevision: 1 });
      migratedRecordCount += 1;
      continue;
    }
    packages.push(record);
  }
  const registry: InstalledPackageRegistry = {
    registryFormatVersion: installedPackageRegistryFormatVersion,
    updatedAt: migratedRecordCount === 0 ? original.updatedAt : options.migratedAt,
    packages
  };
  assertValidInstalledPackageRegistry(registry);
  if (migratedRecordCount > 0) {
    await saveInstalledPackageRegistry(contentDir, registry);
    invalidateInstalledContent(contentDir);
  }
  return { changed: migratedRecordCount > 0, migratedRecordCount, preservedLegacyInstallPaths, registry };
}

export async function installContentPackage(options: InstallContentPackageOptions): Promise<InstallContentPackageResult> {
  const installedAt = options.installedAt ?? currentTimestamp();
  const contentDir = resolveContentDataDirectory(options.dataDir);
  const catalogue = await loadContentPackageCatalogue(options.cataloguePath);
  const entry = selectCatalogueEntry(catalogue, options.packageId, options.packageVersion, options.deckVersion, options.artifactRevision);
  let registry = await loadInstalledPackageRegistry(contentDir);
  const relativeInstallPath = packageInstallPath(entry);
  const finalInstallPath = join(contentDir, relativeInstallPath);
  const identityKey = immutableDeckArtifactKey(entry.packageId, entry);
  const existing = registry.packages.find((record) => immutableDeckArtifactKey(record.packageId, record) === identityKey);

  for (const dependency of entry.dependencies ?? []) {
    if (dependency.optional === true || registry.packages.some(record => record.packageId === dependency.packageId)) continue;
    if (!catalogue.packages.some(candidate => candidate.packageId === dependency.packageId)) continue;
    await installContentPackage({ ...options, packageId: dependency.packageId, packageVersion: undefined, force: false });
    registry = await loadInstalledPackageRegistry(contentDir);
  }

  const archive = await fetchPackageArchive(entry);
  verifyPackageArchive(entry, archive);
  if (existing !== undefined) {
    if (existing.archiveSha256 === entry.package.sha256 && existing.archiveSize === entry.package.size) {
      return { installed: false, record: existing, installPath: join(contentDir, existing.installPath) };
    }
    throw new Error(`Immutable package identity ${identityKey} is already installed with different bytes.`);
  }
  const zip = readPackageZip(archive);
  const manifestEntry = zip.entries.find((candidate) => candidate.path === "manifest.json");
  if (manifestEntry === undefined) {
    throw new Error("Package archive does not contain manifest.json.");
  }
  const manifest = JSON.parse(manifestEntry.data.toString("utf8")) as unknown;
  assertValidContentPackageManifest(manifest);
  validateManifestMatchesCatalogue(manifest, entry);
  validateDeclaredFiles(manifest, zip.entries);
  validateMemorizationPackageMedia(manifest, zip.entries);
  if (manifest.contentType === "language-curriculum") {
    const primaryPath = manifest.entryPoints.find(candidate => candidate.role === "primary")?.path;
    const primaryEntry = zip.entries.find(candidate => candidate.path === primaryPath);
    if (primaryEntry === undefined) {
      throw new Error("Language curriculum package has no readable primary content snapshot.");
    }
    let snapshot: unknown;
    try {
      snapshot = JSON.parse(primaryEntry.data.toString("utf8"));
    } catch (error) {
      throw new Error(`Language curriculum primary content snapshot is invalid JSON: ${error instanceof Error ? error.message : String(error)}`);
    }
    assertCanonicalCastBootstrapSnapshot(snapshot, {
      sourceLabel: `install:${manifest.packageId}`,
      requireOrdinaryContent: true
    });
  }

  const stagingPath = join(contentDir, ".staging", `${entry.packageId}-${entry.packageVersion}-${Date.now()}`);
  await rm(stagingPath, { recursive: true, force: true });
  await mkdir(stagingPath, { recursive: true });

  try {
    for (const file of zip.entries) {
      const destination = join(stagingPath, file.path);
      ensureInside(stagingPath, destination);
      await mkdir(dirname(destination), { recursive: true });
      await writeFile(destination, file.data);
      await chmod(destination, 0o444);
    }

    await assertPathMissing(finalInstallPath);
    await mkdir(dirname(finalInstallPath), { recursive: true });
    await rename(stagingPath, finalInstallPath);
  } catch (error) {
    await rm(stagingPath, { recursive: true, force: true }).catch(() => undefined);
    throw error;
  }

  const record: InstalledPackageRecord = {
    packageId: manifest.packageId,
    packageVersion: manifest.packageVersion,
    ...(manifest.deckVersion === undefined ? {} : { deckVersion: manifest.deckVersion }),
    ...(manifest.artifactRevision === undefined ? {} : { artifactRevision: manifest.artifactRevision }),
    displayName: localized(manifest.displayName, "en-US"),
    contentType: manifest.contentType,
    ...(manifest.capabilities === undefined ? {} : { capabilities: manifest.capabilities }),
    ...(manifest.deckFamily === undefined ? {} : { deckFamily: manifest.deckFamily }),
    ...(manifest.topic === undefined ? {} : { topic: manifest.topic }),
    ...(manifest.mediaPolicy === undefined ? {} : { mediaPolicy: manifest.mediaPolicy }),
    ...(manifest.interactionProfile === undefined ? {} : { interactionProfile: manifest.interactionProfile }),
    ...(manifest.relatedPackageIds === undefined ? {} : { relatedPackageIds: manifest.relatedPackageIds }),
    contentSchemaVersion: manifest.contentSchemaVersion,
    minimumWhackSmackerVersion: manifest.minimumWhackSmackerVersion,
    source: manifest.source,
    installedAt,
    installPath: relativeInstallPath,
    manifestSha256: sha256Hex(manifestEntry.data),
    archiveSha256: sha256Hex(archive),
    archiveSize: archive.length,
    catalogueId: catalogue.catalogueId
  };
  await saveInstalledPackageRegistry(contentDir, upsertRecord(registry, record, installedAt));
  invalidateInstalledContent(contentDir);

  return { installed: true, record, installPath: finalInstallPath };
}

export async function detectContentPackageUpdates(cataloguePath: string, dataDir?: string): Promise<readonly ContentPackageUpdate[]> {
  const catalogue = await loadContentPackageCatalogue(cataloguePath);
  const registry = await loadInstalledPackageRegistry(dataDir);
  const updates: ContentPackageUpdate[] = [];

  for (const installed of registry.packages) {
    const candidates = catalogue.packages
      .filter((entry) => entry.packageId === installed.packageId && compareDeckFrameworkVersions(entry, installed) > 0)
      .sort((left, right) => compareDeckFrameworkVersions(right, left));
    const newest = candidates[0];
    if (newest !== undefined) {
      updates.push({
        packageId: installed.packageId,
        installedVersion: installed.packageVersion,
        availableVersion: newest.packageVersion,
        catalogueEntry: newest
      });
    }
  }

  return updates.sort((left, right) => left.packageId.localeCompare(right.packageId));
}

export async function updateContentPackage(options: InstallContentPackageOptions): Promise<InstallContentPackageResult> {
  const updates = await detectContentPackageUpdates(options.cataloguePath, options.dataDir);
  const update = updates.find((candidate) => candidate.packageId === options.packageId);
  if (update === undefined) {
    throw new Error(`No update available for ${options.packageId}.`);
  }
  return installContentPackage({ ...options, packageVersion: update.availableVersion });
}

export async function removeContentPackage(options: RemoveContentPackageOptions): Promise<RemoveContentPackageResult> {
  const removedAt = options.removedAt ?? currentTimestamp();
  const contentDir = resolveContentDataDirectory(options.dataDir);
  const registry = await loadInstalledPackageRegistry(contentDir);
  const matches = registry.packages.filter((record) => {
    if (record.packageId !== options.packageId) {
      return false;
    }
    if (options.allVersions === true) {
      return true;
    }
    if (options.packageVersion !== undefined && record.packageVersion !== options.packageVersion) return false;
    const projected = projectDeckFrameworkVersion(record);
    if (options.deckVersion !== undefined && projected.deckVersion !== options.deckVersion) return false;
    if (options.artifactRevision !== undefined && projected.artifactRevision !== options.artifactRevision) return false;
    return true;
  });

  if (matches.length === 0) {
    throw new Error(`Package is not installed: ${options.packageId}${options.packageVersion === undefined ? "" : ` ${options.packageVersion}`}`);
  }
  if (options.packageVersion === undefined && options.allVersions !== true && matches.length > 1) {
    throw new Error(`Multiple versions of ${options.packageId} are installed. Specify --version or --all.`);
  }

  for (const record of matches) {
    const installPath = join(contentDir, record.installPath);
    ensureInside(contentDir, installPath);
    await rm(installPath, { recursive: true, force: true });
  }

  const removedKeys = new Set(matches.map((record) => immutableDeckArtifactKey(record.packageId, record)));
  const packages = registry.packages.filter((record) => !removedKeys.has(immutableDeckArtifactKey(record.packageId, record)));
  await saveInstalledPackageRegistry(contentDir, { registryFormatVersion: installedPackageRegistryFormatVersion, updatedAt: removedAt, packages });
  invalidateInstalledContent(contentDir);

  return { removed: matches };
}

async function fetchPackageArchive(entry: ContentPackageCatalogueEntry): Promise<BufferValue> {
  const url = new URL(entry.package.url);
  if (url.protocol === "file:") {
    return readFile(decodeURIComponent(url.pathname));
  }
  if (url.protocol === "https:") {
    const response = await fetch(entry.package.url, { redirect: "error", signal: AbortSignal.timeout(30000) });
    if (!response.ok) {
      throw new Error(`Failed to download package: HTTP ${response.status} ${response.statusText}`);
    }
    return Buffer.from(await response.arrayBuffer());
  }
  throw new Error(`Unsupported package URL scheme: ${url.protocol}`);
}

function verifyPackageArchive(entry: ContentPackageCatalogueEntry, archive: BufferValue): void {
  if (archive.length > maxPackageArchiveSizeBytes) {
    throw new Error(`Package archive exceeds size limit: ${archive.length}`);
  }
  if (archive.length !== entry.package.size) {
    throw new Error(`Package archive size mismatch: expected ${entry.package.size}, got ${archive.length}`);
  }
  const actualSha256 = sha256Hex(archive);
  if (actualSha256 !== entry.package.sha256) {
    throw new Error(`Package archive SHA-256 mismatch: expected ${entry.package.sha256}, got ${actualSha256}`);
  }
}

function readPackageZip(archive: BufferValue): { readonly entries: readonly ZipEntry[] } {
  const entries: ZipEntry[] = [];
  const archivePaths = new Set<string>();
  let totalUncompressedSize = 0;
  let offset = 0;

  while (offset + 30 <= archive.length && archive.readUInt32LE(offset) === 0x04034b50) {
    const generalPurposeFlags = archive.readUInt16LE(offset + 6);
    const compressionMethod = archive.readUInt16LE(offset + 8);
    const expectedCrc32 = archive.readUInt32LE(offset + 14);
    const compressedSize = archive.readUInt32LE(offset + 18);
    const uncompressedSize = archive.readUInt32LE(offset + 22);
    const fileNameLength = archive.readUInt16LE(offset + 26);
    const extraLength = archive.readUInt16LE(offset + 28);
    const nameStart = offset + 30;
    const dataStart = nameStart + fileNameLength + extraLength;
    if ((generalPurposeFlags & 0x0041) !== 0) {
      throw new Error("Package archive contains an encrypted entry.");
    }
    if ((generalPurposeFlags & 0x0008) !== 0) {
      throw new Error("Package archive data descriptors are not supported.");
    }
    if (compressedSize === 0xffffffff || uncompressedSize === 0xffffffff) {
      throw new Error("Package archive ZIP64 entries are not supported.");
    }
    const dataEnd = dataStart + compressedSize;
    if (dataStart > archive.length || dataEnd > archive.length) {
      throw new Error("Package archive has a truncated local file entry.");
    }
    const path = archive.subarray(nameStart, nameStart + fileNameLength).toString("utf8");
    const isDirectory = path.endsWith("/");
    const pathForValidation = isDirectory ? path.slice(0, -1) : path;
    if (!isSafeContentPackagePath(pathForValidation)) {
      throw new Error(`Unsafe package archive path: ${path}`);
    }
    if (archivePaths.has(path)) {
      throw new Error(`Duplicate package archive path: ${path}`);
    }
    archivePaths.add(path);
    if (isDirectory) {
      if (compressedSize !== 0 || uncompressedSize !== 0 || dataEnd !== dataStart) {
        throw new Error(`Package archive directory entry contains data: ${path}`);
      }
      offset = dataEnd;
      continue;
    }
    if (compressionMethod !== 0 && compressionMethod !== 8) {
      throw new Error("Unsupported package archive compression method.");
    }
    if (totalUncompressedSize + uncompressedSize > maxPackageUncompressedSizeBytes) {
      throw new Error(`Package archive exceeds uncompressed size limit: ${maxPackageUncompressedSizeBytes}`);
    }
    const compressedData = archive.subarray(dataStart, dataEnd);
    let data: BufferValue;
    if (compressionMethod === 0) {
      if (compressedSize !== uncompressedSize) {
        throw new Error(`Stored package archive entry size mismatch: ${path}`);
      }
      data = compressedData;
    } else {
      try {
        data = inflateRawSync(compressedData, {
          maxOutputLength: Math.max(1, maxPackageUncompressedSizeBytes - totalUncompressedSize)
        });
      } catch {
        throw new Error(`Invalid deflate data in package archive entry: ${path}`);
      }
      if (data.length !== uncompressedSize) {
        throw new Error(`Inflated package archive entry size mismatch: ${path}`);
      }
    }
    if (crc32(data) !== expectedCrc32) {
      throw new Error(`Package archive entry CRC-32 mismatch: ${path}`);
    }
    totalUncompressedSize += data.length;
    entries.push({ path, data });
    if (entries.length > maxPackageArchiveFileCount) {
      throw new Error(`Package archive exceeds file count limit: ${maxPackageArchiveFileCount}`);
    }
    offset = dataEnd;
  }

  if (entries.length === 0) {
    throw new Error("Package archive has no readable file entries.");
  }
  validateCentralDirectory(archive, archivePaths);
  return { entries };
}

function crc32(data: BufferValue): number {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

interface ZipEntry {
  readonly path: string;
  readonly data: BufferValue;
}

function validateCentralDirectory(archive: BufferValue, localPaths: ReadonlySet<string>): void {
  let offset = 0;
  while (offset + 4 <= archive.length) {
    const signature = archive.readUInt32LE(offset);
    if (signature === 0x02014b50) {
      break;
    }
    if (signature !== 0x04034b50) {
      offset += 1;
      continue;
    }
    const compressedSize = archive.readUInt32LE(offset + 18);
    const fileNameLength = archive.readUInt16LE(offset + 26);
    const extraLength = archive.readUInt16LE(offset + 28);
    offset += 30 + fileNameLength + extraLength + compressedSize;
  }

  const centralPaths = new Set<string>();
  while (offset + 46 <= archive.length && archive.readUInt32LE(offset) === 0x02014b50) {
    const fileNameLength = archive.readUInt16LE(offset + 28);
    const extraLength = archive.readUInt16LE(offset + 30);
    const commentLength = archive.readUInt16LE(offset + 32);
    const externalAttributes = archive.readUInt32LE(offset + 38);
    const nameStart = offset + 46;
    const path = archive.subarray(nameStart, nameStart + fileNameLength).toString("utf8");
    const unixMode = (externalAttributes >>> 16) & 0xffff;
    const fileType = unixMode & 0o170000;
    if (fileType === 0o120000 || fileType === 0o060000 || fileType === 0o020000 || fileType === 0o010000) {
      throw new Error(`Package archive contains unsupported special file: ${path}`);
    }
    centralPaths.add(path);
    offset = nameStart + fileNameLength + extraLength + commentLength;
  }
  for (const path of localPaths) {
    if (centralPaths.size > 0 && !centralPaths.has(path)) {
      throw new Error(`Package archive central directory is missing local path: ${path}`);
    }
  }
}

function validateManifestMatchesCatalogue(manifest: ContentPackageManifest, entry: ContentPackageCatalogueEntry): void {
  const checks: readonly [string, string, string][] = [
    ["packageId", manifest.packageId, entry.packageId],
    ["packageVersion", manifest.packageVersion, entry.packageVersion],
    ["contentType", manifest.contentType, entry.contentType],
    ["contentSchemaVersion", manifest.contentSchemaVersion, entry.contentSchemaVersion],
    ["source.commit", manifest.source.commit, entry.source.commit]
  ];
  for (const [field, actual, expected] of checks) {
    if (actual !== expected) {
      throw new Error(`Package manifest ${field} does not match catalogue entry: expected ${expected}, got ${actual}`);
    }
  }
  if (manifest.deckFamily !== entry.deckFamily) {
    throw new Error(`Package manifest deckFamily does not match catalogue entry: expected ${String(entry.deckFamily)}, got ${String(manifest.deckFamily)}`);
  }
  if (JSON.stringify(manifest.topic) !== JSON.stringify(entry.topic)) {
    throw new Error("Package manifest topic metadata does not match catalogue entry.");
  }
  if (manifest.deckVersion !== entry.deckVersion || manifest.artifactRevision !== entry.artifactRevision) {
    throw new Error("Package manifest immutable deck identity does not match catalogue entry.");
  }
  if (manifest.mediaPolicy !== entry.mediaPolicy || JSON.stringify(manifest.interactionProfile) !== JSON.stringify(entry.interactionProfile)) {
    throw new Error("Package manifest deck capability metadata does not match catalogue entry.");
  }
}

function validateDeclaredFiles(manifest: ContentPackageManifest, entries: readonly ZipEntry[]): void {
  const entryMap = new Map(entries.map((entry) => [entry.path, entry]));
  for (const file of manifest.files) {
    const entry = entryMap.get(file.path);
    if (entry === undefined) {
      throw new Error(`Package archive is missing declared file: ${file.path}`);
    }
    if (entry.data.length !== file.size) {
      throw new Error(`Declared file size mismatch for ${file.path}.`);
    }
    if (sha256Hex(entry.data) !== file.sha256) {
      throw new Error(`Declared file SHA-256 mismatch for ${file.path}.`);
    }
  }
}

function validateMemorizationPackageMedia(manifest: ContentPackageManifest, entries: readonly ZipEntry[]): void {
  const referencedPaths = new Set<string>();
  for (const file of manifest.files) {
    if (!file.path.startsWith("content/memorization/")
      || !file.path.endsWith(".json")
      || (file.mediaType !== "application/json" && file.mediaType !== "application/vnd.whacksmacker.memorization-items+json")) continue;
    const entry = entries.find((candidate) => candidate.path === file.path);
    if (entry === undefined) continue;
    let value: unknown;
    try {
      value = JSON.parse(entry.data.toString("utf8"));
    } catch (error) {
      throw new Error(`Memorization item file is invalid JSON: ${file.path}: ${error instanceof Error ? error.message : String(error)}`);
    }
    for (const reference of assertMemorizationMediaManifestReferences(value, manifest.files)) referencedPaths.add(reference.path);
  }
  for (const file of manifest.files.filter((candidate) => candidate.path.startsWith("media/"))) {
    const expectedMediaType = packageImageMediaTypeForPath(file.path);
    if (expectedMediaType === undefined || file.mediaType !== expectedMediaType) {
      throw new Error(`Package media record has an unsupported path or MIME type: ${file.path}`);
    }
    if (!referencedPaths.has(file.path)) throw new Error(`Package media asset is not referenced by a memorization Markdown block: ${file.path}`);
  }
}

async function saveInstalledPackageRegistry(contentDir: string, registry: InstalledPackageRegistry): Promise<void> {
  assertValidInstalledPackageRegistry(registry);
  await mkdir(contentDir, { recursive: true });
  await mkdir(join(contentDir, "cache", "downloads"), { recursive: true });
  await mkdir(join(contentDir, "packages"), { recursive: true });
  await writeFile(join(contentDir, "registry.json"), `${JSON.stringify(registry, null, 2)}\n`);
}

function upsertRecord(registry: InstalledPackageRegistry, record: InstalledPackageRecord, updatedAt: string): InstalledPackageRegistry {
  const key = immutableDeckArtifactKey(record.packageId, record);
  const packages = registry.packages.filter((candidate) => immutableDeckArtifactKey(candidate.packageId, candidate) !== key);
  packages.push(record);
  packages.sort((left, right) => {
    const packageOrder = left.packageId.localeCompare(right.packageId);
    return packageOrder === 0
      ? compareDeckFrameworkVersions(left, right) || left.packageVersion.localeCompare(right.packageVersion)
      : packageOrder;
  });
  return { registryFormatVersion: installedPackageRegistryFormatVersion, updatedAt, packages };
}

function validateRegistryPackages(value: unknown, errors: string[]): void {
  const keys = new Set<string>();
  if (!Array.isArray(value)) {
    errors.push("packages must be an array.");
    return;
  }
  for (const [index, record] of value.entries()) {
    if (!isRecord(record)) {
      errors.push(`packages[${index}] must be an object.`);
      continue;
    }
    const packageId = readString(record.packageId);
    const packageVersion = readString(record.packageVersion);
    validatePackageId(packageId, `packages[${index}].packageId`, errors);
    validateSemver(packageVersion, `packages[${index}].packageVersion`, errors);
    errors.push(...validateDeckFrameworkVersion({
      packageVersion,
      ...(typeof record.deckVersion === "string" ? { deckVersion: record.deckVersion } : {}),
      ...(typeof record.artifactRevision === "number" ? { artifactRevision: record.artifactRevision } : {})
    }, `packages[${index}]`).errors);
    if (record.deckFamily !== undefined && record.deckFamily !== "general" && record.deckFamily !== "specialized") {
      errors.push(`packages[${index}].deckFamily must be general or specialized when present.`);
    }
    validateInstalledTopicMetadata(record.topic, `packages[${index}].topic`, errors);
    if (record.mediaPolicy !== undefined) errors.push(...validateMediaPolicy(record.mediaPolicy, `packages[${index}].mediaPolicy`).errors);
    if (record.interactionProfile !== undefined) errors.push(...validateDeckInteractionProfile(record.interactionProfile, `packages[${index}].interactionProfile`).errors);
    validateTimestamp(record.installedAt, `packages[${index}].installedAt`, errors);
    if (!isSafeContentPackagePath(readString(record.installPath))) {
      errors.push(`packages[${index}].installPath must be a safe relative path.`);
    }
    for (const field of ["manifestSha256", "archiveSha256"] as const) {
      if (!/^[0-9a-f]{64}$/u.test(readString(record[field]))) {
        errors.push(`packages[${index}].${field} must be a lowercase 64-character SHA-256 digest.`);
      }
    }
    if (typeof record.archiveSize !== "number" || !Number.isSafeInteger(record.archiveSize) || record.archiveSize < 0) {
      errors.push(`packages[${index}].archiveSize must be a non-negative safe integer.`);
    }
    const key = immutableDeckArtifactKey(packageId, {
      packageVersion,
      ...(typeof record.deckVersion === "string" ? { deckVersion: record.deckVersion } : {}),
      ...(typeof record.artifactRevision === "number" ? { artifactRevision: record.artifactRevision } : {})
    });
    if (keys.has(key)) {
      errors.push(`Duplicate installed package: ${key}`);
    } else {
      keys.add(key);
    }
  }
}

function validateInstalledTopicMetadata(value: unknown, field: string, errors: string[]): void {
  if (value === undefined) return;
  if (!isRecord(value)) {
    errors.push(`${field} must be an object when present.`);
    return;
  }
  if (typeof value.id !== "string" || !/^[a-z0-9][a-z0-9-]*$/u.test(value.id)) errors.push(`${field}.id must be a stable lowercase slug.`);
  if (!isLocalizedContentValue(value.displayName)) errors.push(`${field}.displayName must be localized learner-facing text.`);
  if (!isLocalizedContentValue(value.deckDisplayName)) errors.push(`${field}.deckDisplayName must be localized learner-facing text.`);
}

function selectCatalogueEntry(
  catalogue: ContentPackageCatalogue,
  packageId: string,
  packageVersion?: string,
  deckVersion?: string,
  artifactRevision?: number
): ContentPackageCatalogueEntry {
  const matches = catalogue.packages.filter((entry) => {
    if (entry.packageId !== packageId || (packageVersion !== undefined && entry.packageVersion !== packageVersion)) return false;
    const projected = projectDeckFrameworkVersion(entry);
    return (deckVersion === undefined || projected.deckVersion === deckVersion)
      && (artifactRevision === undefined || projected.artifactRevision === artifactRevision);
  });
  if (matches.length === 0) {
    throw new Error(`Package not found in catalogue: ${packageId}${packageVersion === undefined ? "" : ` ${packageVersion}`}`);
  }
  return [...matches].sort((left, right) => compareDeckFrameworkVersions(right, left))[0];
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

function packageInstallPath(entry: ContentPackageCatalogueEntry): string {
  if (entry.deckVersion === undefined || entry.artifactRevision === undefined) return `packages/${entry.packageId}/${entry.packageVersion}`;
  return `packages/${entry.packageId}/deck-${entry.deckVersion}/revision-${entry.artifactRevision}`;
}

function validatePackageId(value: string, field: string, errors: string[]): void {
  if (!isContentPackageId(value)) {
    errors.push(`${field} must use reverse-domain package ID syntax.`);
  }
}

function validateSemver(value: string, field: string, errors: string[]): void {
  if (!isSemver(value)) {
    errors.push(`${field} must use MAJOR.MINOR.PATCH Semantic Versioning.`);
  }
}

function validateTimestamp(value: unknown, field: string, errors: string[]): void {
  const text = readString(value);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/u.test(text) || Number.isNaN(Date.parse(text))) {
    errors.push(`${field} must be an ISO 8601 UTC timestamp.`);
  }
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
  throw new Error(`Installed package path already exists: ${path}`);
}

function ensureInside(root: string, path: string): void {
  const relativePath = relative(root, path);
  if (relativePath === "" || relativePath.startsWith("..") || relativePath.includes("\\") || path === root) {
    if (path !== root) {
      throw new Error(`Path escapes content directory: ${path}`);
    }
  }
}

function emptyRegistry(updatedAt: string): InstalledPackageRegistry {
  return { registryFormatVersion: installedPackageRegistryFormatVersion, updatedAt, packages: [] };
}

function currentTimestamp(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/u, "Z");
}

function isMissingFileError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}

function sha256Hex(data: BufferValue): string {
  return createHash("sha256").update(data).digest("hex");
}

function readString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
