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
import { isLocalizedContentValue, localized, type LocalizedContentValue } from "./localized-content";

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

export interface InstalledReadablePackage {
  readonly packageId: string;
  readonly packageVersion: string;
  readonly displayName: string;
  readonly description?: string;
  readonly contentType: string;
}

export interface ReadableContentEntry {
  readonly path: string;
  readonly mediaType: string;
  readonly title: string;
  readonly source: "snapshot" | "package-file";
}

export interface ReadInstalledContentEntryOptions {
  readonly dataDir?: string;
  readonly packageId: string;
  readonly packageVersion?: string;
  readonly path: string;
  readonly locale?: string;
}

export interface ReadInstalledContentEntryResult {
  readonly package: InstalledReadablePackage;
  readonly entry: ReadableContentEntry;
  readonly text: string;
}

export async function listInstalledReadablePackages(dataDir?: string, locale = "en-US"): Promise<readonly InstalledReadablePackage[]> {
  return Promise.all((await listInstalledContentPackages(dataDir)).filter(record => record.contentType !== "curriculum-source-language-pack").map(async (record) => {
    const manifest = await readInstalledManifest(installedPackageRoot(record, dataDir));
    return toReadablePackage(record, manifest, locale);
  }));
}

export async function listReadableContentEntries(
  packageId: string,
  dataDir?: string,
  packageVersion?: string
): Promise<readonly ReadableContentEntry[]> {
  const selected = await selectInstalledPackage(packageId, dataDir, packageVersion);
  const root = installedPackageRoot(selected, dataDir);
  const snapshot = await readSnapshot(root);
  if (snapshot !== null) {
    return snapshot.files
      .filter((file) => isReadableMediaType(file.mediaType))
      .filter((file) => snapshot.localizedPaths === undefined || snapshot.localizedPaths.includes(file.path))
      .map((file) => ({
        path: file.path,
        mediaType: file.mediaType,
        title: file.path,
        source: "snapshot" as const
      }))
      .sort((left, right) => left.path.localeCompare(right.path));
  }

  const manifest = await readInstalledManifest(root);
  return manifest.files
    .filter((file) => isReadableMediaType(file.mediaType))
    .map((file) => ({
      path: file.path,
      mediaType: file.mediaType,
      title: file.path,
      source: "package-file" as const
    }))
    .sort((left, right) => left.path.localeCompare(right.path));
}

export async function readInstalledContentEntry(options: ReadInstalledContentEntryOptions): Promise<ReadInstalledContentEntryResult> {
  if (!isSafeContentPackagePath(options.path)) {
    throw new Error(`Readable content path must be package-relative and safe: ${options.path}`);
  }

  const selected = await selectInstalledPackage(options.packageId, options.dataDir, options.packageVersion);
  const root = installedPackageRoot(selected, options.dataDir);
  const manifest = await readInstalledManifest(root);
  const readablePackage = toReadablePackage(selected, manifest, options.locale ?? "en-US");
  const snapshot = await readSnapshot(root);

  if (snapshot !== null) {
    const file = snapshot.files.find((candidate) => candidate.path === options.path);
    if (file === undefined || !isReadableMediaType(file.mediaType)) {
      throw new Error(`Readable content entry not found: ${options.path}`);
    }
    const overlayText = await readSelectedSourceOverlayText(manifest, selected, file.path, options.locale, options.dataDir);
    return {
      package: readablePackage,
      entry: { path: file.path, mediaType: file.mediaType, title: file.path, source: "snapshot" },
      text: overlayText ?? localized(file.text, options.locale ?? "en-US")
    };
  }

  const entries = await listReadableContentEntries(options.packageId, options.dataDir, options.packageVersion);
  const entry = entries.find((candidate) => candidate.path === options.path);
  if (entry === undefined) {
    throw new Error(`Readable content entry not found: ${options.path}`);
  }
  const destination = join(root, entry.path);
  ensureInside(root, destination);
  return {
    package: readablePackage,
    entry,
    text: (await readFile(destination)).toString("utf8")
  };
}

async function readSelectedSourceOverlayText(manifest: ContentPackageManifest, base: InstalledPackageRecord, path: string, locale: string | undefined, dataDir?: string): Promise<string | undefined> {
  const metadata = manifest.localization;
  if (metadata?.role !== "base-curriculum") return undefined;
  const selectedLocale = canonicalSourceLocale(locale ?? metadata.defaultSourceLocale);
  const candidates = [selectedLocale, metadata.defaultSourceLocale].filter((value, index, all) => all.indexOf(value) === index);
  const installed = await listInstalledContentPackages(dataDir);
  for (const candidateLocale of candidates) {
    for (const record of installed.filter(item => item.contentType === "curriculum-source-language-pack")) {
      const root = installedPackageRoot(record, dataDir);
      const sourceManifest = await readInstalledManifest(root);
      if (sourceManifest.localization?.role !== "source-language-pack" || sourceManifest.localization.basePackageId !== base.packageId || sourceManifest.localization.sourceLocale !== candidateLocale) continue;
      try {
        const overlay = JSON.parse((await readFile(join(root, "content", "content.json"))).toString("utf8")) as { files?: readonly { path: string; text: string }[] };
        const match = overlay.files?.find(file => file.path === path);
        if (match !== undefined) return match.text;
      } catch { continue; }
    }
  }
  return undefined;
}

function canonicalSourceLocale(locale: string): string {
  if (locale === "zh-Hant-TW" || locale === "zh-TW") return "zh-TW";
  if (locale === "en-US" || locale === "en") return "en";
  return locale;
}

export function renderReadingContent(result: ReadInstalledContentEntryResult): string {
  return [
    result.package.displayName,
    `${result.package.packageId} ${result.package.packageVersion}`,
    result.entry.path,
    "",
    renderLearnerReadingText(result.text).trimEnd(),
    ""
  ].join("\n");
}

function renderLearnerReadingText(text: string): string {
  const output: string[] = [];
  const lines = text.replace(/\r\n?/gu, "\n").split("\n");
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    if (isMarkdownTableLine(line)) {
      const tableLines = [line];
      while (index + 1 < lines.length && isMarkdownTableLine(lines[index + 1] ?? "")) {
        index += 1;
        tableLines.push(lines[index] ?? "");
      }
      output.push(...removeStatusTableColumn(tableLines));
      continue;
    }
    output.push(line);
  }
  return output.join("\n");
}

function isMarkdownTableLine(line: string): boolean {
  const trimmed = line.trim();
  return trimmed.startsWith("|") && trimmed.endsWith("|") && trimmed.slice(1, -1).includes("|");
}

function removeStatusTableColumn(lines: readonly string[]): readonly string[] {
  const rows = lines.map((line) => line.trim().slice(1, -1).split("|").map((cell) => cell.trim()));
  const header = rows.find((row) => !row.every((cell) => /^:?-{3,}:?$/u.test(cell))) ?? [];
  const visibleColumns = Array.from({ length: Math.max(...rows.map((row) => row.length)) }, (_, column) => column)
    .filter((column) => (header[column] ?? "").trim().toLowerCase() !== "status");
  const noteColumn = visibleColumns.findIndex((column) => (header[column] ?? "").trim().toLowerCase() === "notes");
  if (visibleColumns.length === 0) {
    return lines;
  }
  return rows.map((row) => `| ${visibleColumns.map((column, visibleColumn) => {
    const cell = row[column] ?? "";
    return visibleColumn === noteColumn && !row.every((value) => /^:?-{3,}:?$/u.test(value))
      ? normalizeVocabularyNote(cell)
      : cell;
  }).join(" | ")} |`);
}

function normalizeVocabularyNote(note: string): string {
  const normalized = note.trim();
  if (/^(?:Can fill the N slot\.|New noun; not self-ID here\.)$/iu.test(normalized)) {
    return "Noun";
  }
  return note;
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

async function readSnapshot(root: string): Promise<SourceMarkdownSnapshot | null> {
  try {
    const snapshot = JSON.parse((await readFile(join(root, "content", "content.json"))).toString("utf8")) as unknown;
    if (!isSnapshot(snapshot)) {
      return null;
    }
    return snapshot;
  } catch {
    return null;
  }
}

interface SourceMarkdownSnapshot {
  readonly contentSchema: "whacksmacker-source-markdown-snapshot-v1";
  readonly defaultContentLocale?: string;
  readonly localizedPaths?: readonly string[];
  readonly files: readonly SourceMarkdownFile[];
}

interface SourceMarkdownFile {
  readonly path: string;
  readonly mediaType: string;
  readonly text: LocalizedContentValue;
}

function isSnapshot(value: unknown): value is SourceMarkdownSnapshot {
  if (!isRecord(value) || value.contentSchema !== "whacksmacker-source-markdown-snapshot-v1" || !Array.isArray(value.files)) {
    return false;
  }
  return value.files.every(
    (file) => isRecord(file) && typeof file.path === "string" && typeof file.mediaType === "string" &&
      isLocalizedContentValue(file.text)
  );
}

function isReadableMediaType(mediaType: string): boolean {
  return mediaType === "text/markdown" || mediaType === "text/plain" || mediaType === "application/json" || mediaType === "text/tab-separated-values";
}

function toReadablePackage(record: InstalledPackageRecord, manifest: ContentPackageManifest, locale: string): InstalledReadablePackage {
  return {
    packageId: record.packageId,
    packageVersion: record.packageVersion,
    displayName: localized(manifest.displayName, locale),
    description: localized(manifest.description, locale),
    contentType: record.contentType
  };
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
    throw new Error(`Readable content path escapes installed package: ${path}`);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
