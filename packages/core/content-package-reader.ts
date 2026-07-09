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

export interface InstalledReadablePackage {
  readonly packageId: string;
  readonly packageVersion: string;
  readonly displayName: string;
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
}

export interface ReadInstalledContentEntryResult {
  readonly package: InstalledReadablePackage;
  readonly entry: ReadableContentEntry;
  readonly text: string;
}

export async function listInstalledReadablePackages(dataDir?: string): Promise<readonly InstalledReadablePackage[]> {
  return (await listInstalledContentPackages(dataDir)).map(toReadablePackage);
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
  const readablePackage = toReadablePackage(selected);
  const snapshot = await readSnapshot(root);

  if (snapshot !== null) {
    const file = snapshot.files.find((candidate) => candidate.path === options.path);
    if (file === undefined || !isReadableMediaType(file.mediaType)) {
      throw new Error(`Readable content entry not found: ${options.path}`);
    }
    return {
      package: readablePackage,
      entry: { path: file.path, mediaType: file.mediaType, title: file.path, source: "snapshot" },
      text: file.text
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
  readonly files: readonly SourceMarkdownFile[];
}

interface SourceMarkdownFile {
  readonly path: string;
  readonly mediaType: string;
  readonly text: string;
}

function isSnapshot(value: unknown): value is SourceMarkdownSnapshot {
  if (!isRecord(value) || value.contentSchema !== "whacksmacker-source-markdown-snapshot-v1" || !Array.isArray(value.files)) {
    return false;
  }
  return value.files.every(
    (file) => isRecord(file) && typeof file.path === "string" && typeof file.mediaType === "string" && typeof file.text === "string"
  );
}

function isReadableMediaType(mediaType: string): boolean {
  return mediaType === "text/markdown" || mediaType === "text/plain" || mediaType === "application/json" || mediaType === "text/tab-separated-values";
}

function toReadablePackage(record: InstalledPackageRecord): InstalledReadablePackage {
  return {
    packageId: record.packageId,
    packageVersion: record.packageVersion,
    displayName: record.displayName,
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
