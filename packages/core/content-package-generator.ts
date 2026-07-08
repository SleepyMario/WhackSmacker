import {
  assertValidContentPackageManifest,
  type ContentPackageFileRecord,
  type ContentPackageManifest,
  whackSmackerPackageExtension,
  whackSmackerPackageFormatVersion
} from "./content-package-spec";
import {
  assertValidMemorizationItemCollection,
  memorizationItemFileMediaType,
  type MemorizationItem,
  type MemorizationItemCollection
} from "./memorization-item";

type BufferValue = {
  readonly length: number;
  [Symbol.iterator](): IterableIterator<number>;
  toString(encoding: "utf8"): string;
  writeUInt16LE(value: number, offset: number): void;
  writeUInt32LE(value: number, offset: number): void;
};

declare function require(name: "../../../package.json"): { version: string };
declare function require(name: "node:buffer"): {
  Buffer: {
    from(value: string, encoding: "utf8"): BufferValue;
    alloc(size: number): BufferValue;
    concat(buffers: readonly BufferValue[]): BufferValue;
  };
};
declare function require(name: "node:crypto"): {
  createHash(algorithm: "sha256"): {
    update(data: BufferValue): { digest(encoding: "hex"): string };
  };
};
declare function require(name: "node:child_process"): {
  execFileSync(command: string, args: readonly string[], options: { cwd: string; encoding: "utf8" }): string;
};
declare function require(name: "node:fs/promises"): {
  mkdir(path: string, options: { recursive: boolean }): Promise<void>;
  readdir(path: string): Promise<string[]>;
  readFile(path: string): Promise<BufferValue>;
  stat(path: string): Promise<{ isDirectory(): boolean; isFile(): boolean }>;
  writeFile(path: string, data: BufferValue): Promise<void>;
};
declare function require(name: "node:path"): {
  dirname(path: string): string;
  join(...paths: string[]): string;
  relative(from: string, to: string): string;
  resolve(...paths: string[]): string;
  sep: string;
};
declare const process: {
  cwd(): string;
};

const packageMetadata = require("../../../package.json");
const whackSmackerApplicationVersion = packageMetadata.version;
const { Buffer } = require("node:buffer");
const { createHash } = require("node:crypto");
const { execFileSync } = require("node:child_process");
const { mkdir, readdir, readFile, stat, writeFile } = require("node:fs/promises");
const { dirname, join, relative, resolve, sep } = require("node:path");

export interface ContentPackageGeneratorTarget {
  readonly id: string;
  readonly packageId: string;
  readonly displayName: string;
  readonly description: string;
  readonly contentType: ContentPackageManifest["contentType"];
  readonly contentSchemaVersion: string;
  readonly packageVersion: string;
  readonly sourcePath: string;
  readonly sourceRepository: string;
  readonly languages?: readonly string[];
  readonly subjects?: readonly string[];
  readonly dependencies?: ContentPackageManifest["dependencies"];
  readonly license?: ContentPackageManifest["license"];
  readonly include: readonly string[];
}

export interface GenerateContentPackageOptions {
  readonly targetId: string;
  readonly outputDirectory: string;
  readonly generatedAt: string;
}

export interface GeneratedContentPackageResult {
  readonly targetId: string;
  readonly packageId: string;
  readonly packageVersion: string;
  readonly filePath: string;
  readonly manifest: ContentPackageManifest;
  readonly archiveSha256: string;
}

export const contentPackageGeneratorName = "whacksmacker-content-builder";

export const contentPackageGeneratorTargets: readonly ContentPackageGeneratorTarget[] = [
  {
    id: "linguistic-terminology",
    packageId: "com.sleepymario.language.linguistic-terminology",
    displayName: "Linguistic Terminology",
    description: "Technical linguistic glossary content generated from the canonical terminology repository.",
    contentType: "linguistic-terminology",
    contentSchemaVersion: "1.0.0",
    packageVersion: "0.1.0",
    sourcePath: "../linguistic-terminology",
    sourceRepository: "https://github.com/SleepyMario/linguistic-terminology",
    languages: ["en", "ko"],
    subjects: ["language", "linguistics", "terminology"],
    license: { spdx: null, name: null, path: null },
    include: ["README.md", "STYLE_GUIDE.md", "INDEX.md", "decisions.md", "backlog.md", "terms"]
  },
  {
    id: "korean-curriculum",
    packageId: "com.sleepymario.language.korean",
    displayName: "Korean Curriculum",
    description: "Korean language curriculum content generated from the canonical Korean curriculum repository.",
    contentType: "language-curriculum",
    contentSchemaVersion: "1.0.0",
    packageVersion: "0.1.0",
    sourcePath: "../korean-curriculum",
    sourceRepository: "https://github.com/SleepyMario/korean-curriculum",
    languages: ["ko", "en"],
    subjects: ["language", "korean"],
    dependencies: [{ packageId: "com.sleepymario.language.linguistic-terminology", version: ">=0.1.0 <1.0.0", optional: true }],
    license: { spdx: null, name: null, path: null },
    include: [
      "README.md",
      "philosophy.md",
      "scope.md",
      "curriculum-map.md",
      "progress.md",
      "backlog.md",
      "decisions.md",
      "review-decks",
      "research",
      "units"
    ]
  },
  {
    id: "chinese-mandarin-traditional-curriculum",
    packageId: "com.sleepymario.language.chinese.mandarin.traditional",
    displayName: "Chinese - Mandarin (Traditional)",
    description: "Chinese - Mandarin Traditional language curriculum content generated from the canonical Chinese curriculum repository.",
    contentType: "language-curriculum",
    contentSchemaVersion: "1.0.0",
    packageVersion: "0.1.0",
    sourcePath: "../chinese-curriculum",
    sourceRepository: "https://github.com/SleepyMario/chinese-curriculum",
    languages: ["zh-Hant", "en"],
    subjects: ["language", "chinese", "mandarin", "traditional"],
    license: { spdx: null, name: null, path: null },
    include: [
      "README.md",
      "philosophy.md",
      "scope.md",
      "curriculum-map.md",
      "progress.md",
      "backlog.md",
      "decisions.md",
      "name-pools",
      "review-decks",
      "research",
      "units/README.md",
      "units/mandarin-traditional"
    ]
  },
  {
    id: "chinese-mandarin-simplified-curriculum",
    packageId: "com.sleepymario.language.chinese.mandarin.simplified",
    displayName: "Chinese - Mandarin (Simplified)",
    description: "Chinese - Mandarin Simplified language curriculum content generated from the canonical Chinese curriculum repository.",
    contentType: "language-curriculum",
    contentSchemaVersion: "1.0.0",
    packageVersion: "0.1.0",
    sourcePath: "../chinese-curriculum",
    sourceRepository: "https://github.com/SleepyMario/chinese-curriculum",
    languages: ["zh-Hans", "en"],
    subjects: ["language", "chinese", "mandarin", "simplified"],
    license: { spdx: null, name: null, path: null },
    include: [
      "README.md",
      "philosophy.md",
      "scope.md",
      "curriculum-map.md",
      "progress.md",
      "backlog.md",
      "decisions.md",
      "name-pools",
      "research",
      "units/README.md",
      "units/mandarin-simplified"
    ]
  },
  {
    id: "japanese-curriculum",
    packageId: "com.sleepymario.language.japanese",
    displayName: "Japanese",
    description: "Japanese language curriculum content generated from the canonical Japanese curriculum repository.",
    contentType: "language-curriculum",
    contentSchemaVersion: "1.0.0",
    packageVersion: "0.1.0",
    sourcePath: "../japanese-curriculum",
    sourceRepository: "https://github.com/SleepyMario/japanese-curriculum",
    languages: ["ja", "en"],
    subjects: ["language", "japanese"],
    license: { spdx: null, name: null, path: null },
    include: [
      "README.md",
      "philosophy.md",
      "scope.md",
      "curriculum-map.md",
      "progress.md",
      "backlog.md",
      "decisions.md",
      "name-pools",
      "review-decks",
      "research",
      "units"
    ]
  },
  {
    id: "vietnamese-curriculum",
    packageId: "com.sleepymario.language.vietnamese",
    displayName: "Vietnamese Curriculum",
    description: "Vietnamese language curriculum content generated from the canonical Vietnamese curriculum repository.",
    contentType: "language-curriculum",
    contentSchemaVersion: "1.0.0",
    packageVersion: "0.1.0",
    sourcePath: "../vietnamese-curriculum",
    sourceRepository: "https://github.com/SleepyMario/vietnamese-curriculum",
    languages: ["vi", "en"],
    subjects: ["language", "vietnamese"],
    license: { spdx: null, name: null, path: null },
    include: [
      "README.md",
      "philosophy.md",
      "scope.md",
      "curriculum-map.md",
      "progress.md",
      "backlog.md",
      "decisions.md",
      "name-pools",
      "review-decks",
      "research",
      "units"
    ]
  },
  {
    id: "dutch-curriculum",
    packageId: "com.sleepymario.language.dutch",
    displayName: "Dutch",
    description: "Dutch language curriculum content generated from the canonical Dutch curriculum repository.",
    contentType: "language-curriculum",
    contentSchemaVersion: "1.0.0",
    packageVersion: "0.1.0",
    sourcePath: "../dutch-curriculum",
    sourceRepository: "https://github.com/SleepyMario/dutch-curriculum",
    languages: ["nl", "en"],
    subjects: ["language", "dutch"],
    license: { spdx: null, name: null, path: null },
    include: [
      "README.md",
      "philosophy.md",
      "scope.md",
      "curriculum-map.md",
      "progress.md",
      "backlog.md",
      "decisions.md",
      "name-pools",
      "review-decks",
      "research",
      "units"
    ]
  },
  {
    id: "german-curriculum",
    packageId: "com.sleepymario.language.german",
    displayName: "German",
    description: "German language curriculum content generated from the canonical German curriculum repository.",
    contentType: "language-curriculum",
    contentSchemaVersion: "1.0.0",
    packageVersion: "0.1.0",
    sourcePath: "../german-curriculum",
    sourceRepository: "https://github.com/SleepyMario/german-curriculum",
    languages: ["de", "en"],
    subjects: ["language", "german"],
    license: { spdx: null, name: null, path: null },
    include: [
      "README.md",
      "philosophy.md",
      "scope.md",
      "curriculum-map.md",
      "progress.md",
      "backlog.md",
      "decisions.md",
      "name-pools",
      "review-decks",
      "research",
      "units"
    ]
  },
  {
    id: "french-curriculum",
    packageId: "com.sleepymario.language.french",
    displayName: "French",
    description: "French language curriculum content generated from the canonical French curriculum repository.",
    contentType: "language-curriculum",
    contentSchemaVersion: "1.0.0",
    packageVersion: "0.1.0",
    sourcePath: "../french-curriculum",
    sourceRepository: "https://github.com/SleepyMario/french-curriculum",
    languages: ["fr", "en"],
    subjects: ["language", "french"],
    license: { spdx: null, name: null, path: null },
    include: [
      "README.md",
      "philosophy.md",
      "scope.md",
      "curriculum-map.md",
      "progress.md",
      "backlog.md",
      "decisions.md",
      "name-pools",
      "review-decks",
      "research",
      "units"
    ]
  },
  {
    id: "spanish-curriculum",
    packageId: "com.sleepymario.language.spanish",
    displayName: "Spanish",
    description: "Spanish language curriculum content generated from the canonical Spanish curriculum repository.",
    contentType: "language-curriculum",
    contentSchemaVersion: "1.0.0",
    packageVersion: "0.1.0",
    sourcePath: "../spanish-curriculum",
    sourceRepository: "https://github.com/SleepyMario/spanish-curriculum",
    languages: ["es", "en"],
    subjects: ["language", "spanish"],
    license: { spdx: null, name: null, path: null },
    include: [
      "README.md",
      "philosophy.md",
      "scope.md",
      "curriculum-map.md",
      "progress.md",
      "backlog.md",
      "decisions.md",
      "name-pools",
      "review-decks",
      "research",
      "units"
    ]
  }
];

export async function generateContentPackage(options: GenerateContentPackageOptions): Promise<GeneratedContentPackageResult> {
  const target = getContentPackageGeneratorTarget(options.targetId);
  const sourceRoot = resolveSourcePath(target.sourcePath);
  const sourceFiles = await collectSourceFiles(sourceRoot, target.include);
  const sourceCommit = readGitValue(sourceRoot, ["rev-parse", "HEAD"]);
  const sourceDirty = readGitValue(sourceRoot, ["status", "--short"]).trim().length > 0;
  const generatorCommit = readGitValue(repositoryRoot, ["rev-parse", "HEAD"]);

  const content = buildContentSnapshot(target, sourceRoot, sourceFiles, sourceCommit, sourceDirty);
  const contentBuffer = Buffer.from(`${JSON.stringify(content, null, 2)}\n`, "utf8");
  const contentFile = createFileRecord("content/content.json", "application/json", contentBuffer);
  const memorizationFiles = buildMemorizationFiles(target, sourceFiles, options.generatedAt);

  const manifest: ContentPackageManifest = {
    packageFormatVersion: whackSmackerPackageFormatVersion,
    packageId: target.packageId,
    packageVersion: target.packageVersion,
    displayName: target.displayName,
    description: target.description,
    contentType: target.contentType,
    contentSchemaVersion: target.contentSchemaVersion,
    minimumWhackSmackerVersion: whackSmackerApplicationVersion,
    ...(target.languages === undefined ? {} : { languages: [...target.languages].sort() }),
    ...(target.subjects === undefined ? {} : { subjects: [...target.subjects].sort() }),
    source: {
      repository: target.sourceRepository,
      commit: sourceCommit,
      ...(sourceDirty ? { dirty: true } : {})
    },
    generatedAt: options.generatedAt,
    generator: {
      name: contentPackageGeneratorName,
      version: whackSmackerApplicationVersion,
      commit: generatorCommit
    },
    entryPoints: [
      {
        id: "primary",
        mediaType: "application/json",
        path: contentFile.path,
        role: "primary"
      }
    ],
    ...(target.dependencies === undefined ? { dependencies: [] } : { dependencies: [...target.dependencies] }),
    files: [contentFile, ...memorizationFiles.map((file) => file.record)],
    ...(target.license === undefined ? {} : { license: target.license })
  };

  assertValidContentPackageManifest(manifest);

  const manifestBuffer = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  const archiveBuffer = createDeterministicZip([
    { path: "manifest.json", data: manifestBuffer },
    { path: contentFile.path, data: contentBuffer },
    ...memorizationFiles.map((file) => ({ path: file.record.path, data: file.buffer }))
  ]);
  const filePath = join(options.outputDirectory, `${target.packageId}-${target.packageVersion}${whackSmackerPackageExtension}`);

  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, archiveBuffer);

  return {
    targetId: target.id,
    packageId: target.packageId,
    packageVersion: target.packageVersion,
    filePath,
    manifest,
    archiveSha256: sha256Hex(archiveBuffer)
  };
}

export function getContentPackageGeneratorTarget(targetId: string): ContentPackageGeneratorTarget {
  const target = contentPackageGeneratorTargets.find((candidate) => candidate.id === targetId);
  if (target === undefined) {
    throw new Error(`Unknown content package target: ${targetId}`);
  }

  return target;
}

interface SourceFile {
  readonly path: string;
  readonly mediaType: string;
  readonly size: number;
  readonly sha256: string;
  readonly text: string;
}

interface ArchiveEntry {
  readonly path: string;
  readonly data: BufferValue;
}

interface GeneratedMemorizationFile {
  readonly record: ContentPackageFileRecord;
  readonly buffer: BufferValue;
}

const repositoryRoot = process.cwd();

async function collectSourceFiles(sourceRoot: string, includes: readonly string[]): Promise<readonly SourceFile[]> {
  const files: SourceFile[] = [];

  for (const include of includes) {
    const absolute = resolve(sourceRoot, include);
    if (!absolute.startsWith(sourceRoot)) {
      throw new Error(`Source include escapes repository root: ${include}`);
    }

    await collectPath(sourceRoot, absolute, files);
  }

  return files.sort((left, right) => left.path.localeCompare(right.path));
}

async function collectPath(sourceRoot: string, absolutePath: string, files: SourceFile[]): Promise<void> {
  const stats = await stat(absolutePath);

  if (stats.isDirectory()) {
    const entries = await readdir(absolutePath);
    for (const entry of entries.sort()) {
      if (entry === ".git") {
        continue;
      }
      await collectPath(sourceRoot, join(absolutePath, entry), files);
    }
    return;
  }

  if (!stats.isFile()) {
    return;
  }

  const relativePath = normalizeArchivePath(relative(sourceRoot, absolutePath));
  if (!relativePath.endsWith(".md") && !relativePath.endsWith(".tsv") && relativePath !== ".gitignore") {
    return;
  }

  const buffer = await readFile(absolutePath);
  files.push({
    path: relativePath,
    mediaType: mediaTypeForPath(relativePath),
    size: buffer.length,
    sha256: sha256Hex(buffer),
    text: buffer.toString("utf8")
  });
}

function buildContentSnapshot(
  target: ContentPackageGeneratorTarget,
  sourceRoot: string,
  sourceFiles: readonly SourceFile[],
  sourceCommit: string,
  sourceDirty: boolean
): unknown {
  return {
    contentSchema: "whacksmacker-source-markdown-snapshot-v1",
    packageId: target.packageId,
    source: {
      repository: target.sourceRepository,
      commit: sourceCommit,
      dirty: sourceDirty
    },
    sourceRootName: sourceRoot.split(sep).at(-1) ?? target.id,
    files: sourceFiles.map((file) => ({
      path: file.path,
      mediaType: file.mediaType,
      size: file.size,
      sha256: file.sha256,
      text: file.text
    }))
  };
}

function createFileRecord(path: string, mediaType: string, data: BufferValue): ContentPackageFileRecord {
  return {
    path,
    mediaType,
    size: data.length,
    sha256: sha256Hex(data)
  };
}

function buildMemorizationFiles(
  target: ContentPackageGeneratorTarget,
  sourceFiles: readonly SourceFile[],
  generatedAt: string
): readonly GeneratedMemorizationFile[] {
  const reviewExampleIndex = buildReviewExampleIndex(sourceFiles);
  return sourceFiles
    .filter((file) => isReviewDeckCardsPath(file.path))
    .map((file) => {
      const collection = parseReviewDeckCards(target, file, generatedAt, reviewExampleIndex);
      assertValidMemorizationItemCollection(collection);
      const buffer = Buffer.from(`${JSON.stringify(collection, null, 2)}\n`, "utf8");
      const outputPath = `content/memorization/${file.path.replace(/\/cards\.tsv$/u, ".json")}`;
      return {
        record: createFileRecord(outputPath, memorizationItemFileMediaType, buffer),
        buffer
      };
    });
}

function parseReviewDeckCards(
  target: ContentPackageGeneratorTarget,
  file: SourceFile,
  generatedAt: string,
  reviewExampleIndex: ReviewExampleIndex
): MemorizationItemCollection {
  const rows = parseTabSeparatedRows(file.text);
  if (rows.length === 0) {
    throw new Error(`Review deck cards file is empty: ${file.path}`);
  }
  const [header, ...body] = rows;
  const expectedHeader = ["deck", "direction", "front", "back", "source_chapter", "entry_type", "notes"];
  if (header.length !== expectedHeader.length || header.some((field, index) => field !== expectedHeader[index])) {
    throw new Error(`Review deck cards file has unsupported header: ${file.path}`);
  }

  const items: MemorizationItem[] = body.map((row, index) => reviewDeckRowToItem(target, file.path, row, index + 1, generatedAt, reviewExampleIndex));
  return { schemaVersion: 1, items };
}

function reviewDeckRowToItem(
  target: ContentPackageGeneratorTarget,
  sourcePath: string,
  row: readonly string[],
  rowNumber: number,
  generatedAt: string,
  reviewExampleIndex: ReviewExampleIndex
): MemorizationItem {
  if (row.length !== 7) {
    throw new Error(`Review deck row ${rowNumber + 1} must have 7 tab-separated fields in ${sourcePath}`);
  }
  const [deck, direction, front, back, sourceChapter, entryType, notes] = row;
  if (deck.trim().length === 0 || direction.trim().length === 0 || front.trim().length === 0 || back.trim().length === 0) {
    throw new Error(`Review deck row ${rowNumber + 1} has an empty required field in ${sourcePath}`);
  }
  const directionMatch = direction.match(/^(.+?) -> (.+?)$/u);
  if (directionMatch === null) {
    throw new Error(`Review deck row ${rowNumber + 1} has unsupported direction: ${direction}`);
  }
  const [, promptLabel, answerLabel] = directionMatch;
  const promptLanguage = languageCodeForReviewLabel(promptLabel);
  const answerLanguage = languageCodeForReviewLabel(answerLabel);
  const targetLanguage = target.languages?.find((language) => language !== "en") ?? promptLanguage ?? answerLanguage;

  const deckSlug = slugForPath(sourcePath.replace(/^review-decks\//u, "").replace(/\/cards\.tsv$/u, ""));
  const entrySlug = slugForPath(entryType);
  const directionSlug = slugForPath(direction);
  const itemId = `review-decks/${deckSlug}/${String(rowNumber).padStart(4, "0")}-${directionSlug}-${entrySlug}`;
  const examples = examplesForReviewRow(reviewExampleIndex, {
    sourceChapter,
    promptLabel,
    answerLabel,
    front,
    back
  });
  if (isCoreReviewDeckRow(sourceChapter) && examples.length === 0) {
    throw new Error(
      `Review deck row ${rowNumber + 1} in ${sourcePath} has no learner-facing source example for ${front} -> ${back}. ` +
      "Core vocabulary review cards must have at least one literal source example."
    );
  }

  return {
    schemaVersion: 1,
    id: itemId,
    kind: "vocabulary",
    prompt: {
      text: front,
      plainText: front,
      ...(promptLanguage === undefined ? {} : { language: promptLanguage }),
      mediaType: "text/plain"
    },
    answer: {
      text: back,
      plainText: back,
      ...(answerLanguage === undefined ? {} : { language: answerLanguage }),
      mediaType: "text/plain"
    },
    notes: `Deck: ${deck}. ${notes}`,
    ...(examples.length === 0 ? {} : { examples }),
    tags: [slugForPath(target.id), "review-deck", deckSlug, entrySlug],
    source: {
      path: sourcePath,
      title: deck
    },
    language: {
      ...(targetLanguage === undefined ? {} : { target: targetLanguage }),
      base: "en",
      script: scriptLabelForTarget(target)
    },
    createdAt: generatedAt,
    updatedAt: generatedAt
  };
}

interface ReviewExampleIndex {
  readonly byChapter: ReadonlyMap<string, readonly string[]>;
}

interface ReviewExampleRow {
  readonly sourceChapter: string;
  readonly promptLabel: string;
  readonly answerLabel: string;
  readonly front: string;
  readonly back: string;
}

function buildReviewExampleIndex(sourceFiles: readonly SourceFile[]): ReviewExampleIndex {
  const byChapter = new Map<string, string[]>();
  for (const file of sourceFiles) {
    if (!isReadableChapterMarkdownPath(file.path)) {
      continue;
    }
    const chapter = chapterNumberForPath(file.path);
    if (chapter === undefined) {
      continue;
    }
    const lines = extractLearnerFacingExampleLines(file.text);
    if (lines.length === 0) {
      continue;
    }
    byChapter.set(chapter, [...(byChapter.get(chapter) ?? []), ...lines]);
  }
  return { byChapter };
}

function examplesForReviewRow(index: ReviewExampleIndex, row: ReviewExampleRow): readonly string[] {
  const sourceChapter = row.sourceChapter.trim();
  if (!/^\d+$/u.test(sourceChapter)) {
    return [];
  }
  const chapterKey = String(Number.parseInt(sourceChapter, 10));
  const sourceLines = index.byChapter.get(chapterKey) ?? [];
  if (sourceLines.length === 0) {
    return [];
  }
  const terms = reviewExampleSearchTerms(row);
  const examples: string[] = [];
  for (const term of terms) {
    for (const line of sourceLines) {
      if (lineMatchesReviewTerm(line, term) && !examples.includes(line)) {
        examples.push(line);
        if (examples.length >= 3) {
          return examples;
        }
      }
    }
  }
  return examples;
}

function isCoreReviewDeckRow(sourceChapter: string): boolean {
  return /^\d+$/u.test(sourceChapter.trim());
}

function reviewExampleSearchTerms(row: ReviewExampleRow): readonly string[] {
  const terms = row.promptLabel === "English"
    ? [row.back]
    : row.answerLabel === "English"
      ? [row.front]
      : [row.front, row.back];
  return terms.flatMap(splitReviewSearchTerm).filter((term, index, all) => all.indexOf(term) === index);
}

function splitReviewSearchTerm(value: string): readonly string[] {
  const baseTerms = value
    .split(/\s*;\s*/u)
    .map((term) => term.trim())
    .filter((term) => term.length > 0 && !/^N$/u.test(term));
  return baseTerms
    .flatMap((term) => [term, ...splitSlashAlternatives(term), ...koreanPredicateStemAlternatives(term)])
    .filter((term, index, all) => all.indexOf(term) === index);
}

function splitSlashAlternatives(term: string): readonly string[] {
  if (!term.includes("/")) {
    return [];
  }
  return term.split(/\s*\/\s*/u).map((part) => part.trim()).filter((part) => part.length > 0);
}

function koreanPredicateStemAlternatives(term: string): readonly string[] {
  if (term === "있다" || term === "없다") {
    return [term.slice(0, -1)];
  }
  if (!/^[가-힣]+다$/u.test(term) || term.length < 3) {
    return [];
  }
  return [term.slice(0, -1)];
}

function lineMatchesReviewTerm(line: string, term: string): boolean {
  if (term.length === 0) {
    return false;
  }
  const escaped = escapeRegExp(term);
  if (containsNonLatinScript(term)) {
    return line.includes(term);
  }
  if (containsWordLikeCharacters(term)) {
    return new RegExp(`(^|[^\\p{L}\\p{N}_])${escaped}([^\\p{L}\\p{N}_]|$)`, "iu").test(line);
  }
  return line.includes(term);
}

function containsNonLatinScript(value: string): boolean {
  return /[\u1100-\u11ff\u3040-\u30ff\u3100-\u312f\u31a0-\u31bf\u3400-\u4dbf\u4e00-\u9fff\uac00-\ud7af]/u.test(value);
}

function containsWordLikeCharacters(value: string): boolean {
  return /[\p{L}\p{N}_]/u.test(value);
}

function escapeRegExp(value: string): string {
  return value.replace(/[\\^$.*+?()[\]{}|]/gu, "\\$&");
}

function isReadableChapterMarkdownPath(path: string): boolean {
  return /^units\/.+\/chapter-\d+[^/]*\/chapter\.md$/u.test(path);
}

function chapterNumberForPath(path: string): string | undefined {
  const match = path.match(/\/chapter-0*(\d+)[^/]*\/chapter\.md$/u);
  return match?.[1];
}

function extractLearnerFacingExampleLines(markdown: string): readonly string[] {
  const examples: string[] = [];
  let inFrontMatter = false;
  let inExampleSection = false;
  let inCodeFence = false;
  let inLearnerTextFence = false;
  for (const [index, rawLine] of markdown.replace(/\r\n?/gu, "\n").split("\n").entries()) {
    const trimmed = rawLine.trim();
    if (index === 0 && trimmed === "---") {
      inFrontMatter = true;
      continue;
    }
    if (inFrontMatter) {
      if (trimmed === "---") {
        inFrontMatter = false;
      }
      continue;
    }
    if (trimmed.startsWith("```")) {
      if (inCodeFence) {
        inCodeFence = false;
        inLearnerTextFence = false;
      } else {
        inCodeFence = true;
        inLearnerTextFence = inExampleSection && /^```(?:text)?\s*$/iu.test(trimmed);
      }
      continue;
    }
    if (inCodeFence && !inLearnerTextFence) {
      continue;
    }
    if (/^##\s+(?:Brief Introduction|Content|Simple Exercises|Model Mini Dialogue|Model Mini Text)\b/iu.test(trimmed)
      || /^###\s+(?:Learner-facing Dialogue|Controlled Reading|New Vocabulary|New Grammar|New Grammar \/ Pattern|Hanja|Usage Notes|.* Usage Notes|Register|Register \/ Regional Notes|Register and Context Notes|Model Mini Dialogue|Model Mini Text)\b/iu.test(trimmed)) {
      inExampleSection = true;
      continue;
    }
    if (/^##\s+(?:Cumulative Ledger|Ledger|Legality Audit|Mastery Criteria)\b/iu.test(trimmed)) {
      inExampleSection = false;
      continue;
    }
    if (/^#{2,4}\s+/u.test(trimmed)) {
      continue;
    }
    if (!inExampleSection && !/^\s*(?:[-*]|\d+\.)\s+/u.test(rawLine)) {
      continue;
    }
    const line = normalizeExampleSourceLine(rawLine);
    if (line === undefined || examples.includes(line)) {
      continue;
    }
    examples.push(line);
  }
  return examples;
}

function normalizeExampleSourceLine(line: string): string | undefined {
  const trimmed = line.trim();
  if (trimmed.length === 0
    || trimmed.startsWith("#")
    || /^---+$/u.test(trimmed)
    || /^\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?$/u.test(trimmed)
    || /^Names from\b/u.test(trimmed)
    || /^Meaning:/iu.test(trimmed)
    || /^(?:Pinyin|Zhuyin):/iu.test(trimmed)
    || /^See `?ledger\.md`?\./iu.test(trimmed)
    || /^Choices:$/iu.test(trimmed)) {
    return undefined;
  }
  const withoutListMarker = trimmed.replace(/^\s*(?:[-*]|\d+\.)\s+/u, "").trim();
  if (withoutListMarker.length === 0
    || /^```/u.test(withoutListMarker)
    || /^`[^`]+`\s*--\s*/u.test(withoutListMarker)
    || /^`?[A-Z]{2,3}-GRAMMAR-\d+/u.test(withoutListMarker)) {
    return undefined;
  }
  return withoutListMarker;
}

function languageCodeForReviewLabel(label: string): string | undefined {
  switch (label) {
    case "English":
      return "en";
    case "Korean":
      return "ko";
    case "Japanese":
      return "ja";
    case "Vietnamese":
      return "vi";
    case "Dutch":
      return "nl";
    case "German":
      return "de";
    case "French":
      return "fr";
    case "Spanish":
      return "es";
    case "Pinyin":
      return "zh-Latn-pinyin";
    case "Zhuyin":
      return "zh-Bopo";
    default:
      return undefined;
  }
}

function scriptLabelForTarget(target: ContentPackageGeneratorTarget): string {
  switch (target.id) {
    case "korean-curriculum":
      return "Hangul";
    case "chinese-mandarin-traditional-curriculum":
      return "Pinyin/Zhuyin";
    case "chinese-mandarin-simplified-curriculum":
      return "Pinyin";
    case "japanese-curriculum":
      return "Japanese";
    case "vietnamese-curriculum":
      return "Vietnamese";
    case "dutch-curriculum":
      return "Dutch";
    case "german-curriculum":
      return "German";
    case "french-curriculum":
      return "French";
    case "spanish-curriculum":
      return "Spanish";
    default:
      return "text";
  }
}

function parseTabSeparatedRows(text: string): readonly (readonly string[])[] {
  return text
    .trimEnd()
    .split(/\r?\n/u)
    .filter((line) => line.trim().length > 0)
    .map((line) => line.split("\t"));
}

function isReviewDeckCardsPath(path: string): boolean {
  return /^review-decks\/[^/]+\/cards\.tsv$/u.test(path);
}

function slugForPath(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9._/-]+/gu, "-")
    .replace(/^-+|-+$/gu, "")
    .replace(/\/-+|-+\//gu, "/");
  return slug.length === 0 ? "deck" : slug;
}

function createDeterministicZip(entries: readonly ArchiveEntry[]): BufferValue {
  const sortedEntries = [...entries].sort((left, right) => left.path.localeCompare(right.path));
  const localParts: BufferValue[] = [];
  const centralParts: BufferValue[] = [];
  let offset = 0;

  for (const entry of sortedEntries) {
    const name = Buffer.from(entry.path, "utf8");
    const crc = crc32(entry.data);
    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0x0800, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt16LE(0, 10);
    localHeader.writeUInt16LE(33, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(entry.data.length, 18);
    localHeader.writeUInt32LE(entry.data.length, 22);
    localHeader.writeUInt16LE(name.length, 26);
    localHeader.writeUInt16LE(0, 28);
    localParts.push(localHeader, name, entry.data);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0x0800, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt16LE(0, 12);
    centralHeader.writeUInt16LE(33, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(entry.data.length, 20);
    centralHeader.writeUInt32LE(entry.data.length, 24);
    centralHeader.writeUInt16LE(name.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);
    centralParts.push(centralHeader, name);

    offset += localHeader.length + name.length + entry.data.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(sortedEntries.length, 8);
  end.writeUInt16LE(sortedEntries.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, centralDirectory, end]);
}

function crc32(buffer: BufferValue): number {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ byte) & 0xff];
  }
  return (crc ^ 0xffffffff) >>> 0;
}

const crcTable = Array.from({ length: 256 }, (_value, index) => {
  let c = index;
  for (let bit = 0; bit < 8; bit += 1) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  return c >>> 0;
});

function sha256Hex(data: BufferValue): string {
  return createHash("sha256").update(data).digest("hex");
}

function resolveSourcePath(sourcePath: string): string {
  return resolve(repositoryRoot, sourcePath);
}

function readGitValue(cwd: string, args: readonly string[]): string {
  try {
    return execFileSync("git", [...args], { cwd, encoding: "utf8" }).trim();
  } catch (error) {
    if (typeof error === "object" && error !== null && "stdout" in error && typeof error.stdout === "string") {
      return error.stdout.trim();
    }
    throw error;
  }
}

function mediaTypeForPath(path: string): string {
  if (path.endsWith(".md")) {
    return "text/markdown";
  }
  if (path.endsWith(".tsv")) {
    return "text/tab-separated-values";
  }
  if (path.endsWith(".json")) {
    return "application/json";
  }
  return "text/plain";
}

function normalizeArchivePath(path: string): string {
  return path.split(sep).join("/");
}
