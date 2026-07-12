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
import type { LocalizedContentValue } from "./localized-content";
import {
  assertLanguageCurriculumChapter5170Requirements,
  assertLanguageCurriculumChapter71140Requirements,
  assertLanguageCurriculumStage71140Coverage,
  type BroaderTopicRecord
} from "./language-curriculum-policy";

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
  execFileSync(command: string, args: readonly string[], options: { cwd: string; encoding: "utf8"; stdio?: readonly ["ignore", "pipe", "pipe"] }): string;
};
declare function require(name: "node:fs/promises"): {
  access(path: string): Promise<void>;
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
const { access, mkdir, readdir, readFile, stat, writeFile } = require("node:fs/promises");
const { dirname, join, relative, resolve, sep } = require("node:path");

export interface ContentPackageGeneratorTarget {
  readonly id: string;
  readonly packageId: string;
  readonly displayName: LocalizedContentValue;
  readonly description: LocalizedContentValue;
  readonly contentType: ContentPackageManifest["contentType"];
  readonly contentSchemaVersion: string;
  readonly packageVersion: string;
  readonly sourcePath: string;
  readonly sourceRepository: string;
  readonly languages?: readonly string[];
  readonly defaultContentLocale?: string;
  readonly targetLanguage?: string;
  readonly localization?: ContentPackageManifest["localization"];
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
      "review-decks/README.md",
      "review-decks/pinyin-zhuyin",
      "review-decks/pinyin-zhuyin-with-tones",
      "review-decks/mandarin-traditional-chapter-001-005",
      "review-decks/mandarin-traditional-chapter-006-010",
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
      "review-decks/README.md",
      "review-decks/mandarin-simplified-chapter-001-005",
      "review-decks/mandarin-simplified-chapter-006-010",
      "research",
      "units/README.md",
      "units/mandarin-simplified"
    ]
  },
  {
    id: "english-curriculum",
    packageId: "com.sleepymario.language.english",
    displayName: { "zh-TW": "英文", en: "English" },
    description: { "zh-TW": "以中文（臺灣）學習英文的在地化課程。", en: "A localized curriculum for learning English." },
    contentType: "language-curriculum",
    contentSchemaVersion: "1.0.0",
    packageVersion: "0.1.0",
    sourcePath: "../english-curriculum",
    sourceRepository: "https://github.com/SleepyMario/english-curriculum",
    languages: ["zh-TW", "en"],
    targetLanguage: "en",
    localization: { role: "base-curriculum", schemaVersion: "1.0.0", targetLanguage: "en", defaultSourceLocale: "zh-TW", defaultSourcePackageId: "com.sleepymario.language.english.source.zh-tw" },
    dependencies: [{ packageId: "com.sleepymario.language.english.source.zh-tw", version: ">=0.1.0 <1.0.0" }],
    subjects: ["language", "english"],
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
    id: "english-curriculum-source-zh-tw",
    packageId: "com.sleepymario.language.english.source.zh-tw",
    displayName: "英文課程中文（臺灣）來源包",
    description: "英文課程的中文（臺灣）教學在地化內容。",
    contentType: "curriculum-source-language-pack",
    contentSchemaVersion: "1.0.0",
    packageVersion: "0.1.0",
    sourcePath: "../english-curriculum",
    sourceRepository: "https://github.com/SleepyMario/english-curriculum",
    languages: ["zh-TW"], targetLanguage: "en",
    localization: { role: "source-language-pack", schemaVersion: "1.0.0", basePackageId: "com.sleepymario.language.english", sourceLocale: "zh-TW", targetLanguage: "en", compatibleBaseVersion: ">=0.1.0 <1.0.0", isDefault: true },
    subjects: ["language", "english", "localization"], license: { spdx: null, name: null, path: null }, include: ["review-decks/chapter-001-005/cards.tsv", "units/english-core"]
  },
  {
    id: "english-curriculum-source-en",
    packageId: "com.sleepymario.language.english.source.en",
    displayName: "English Curriculum Source Pack",
    description: "English instructional localization for the English curriculum.",
    contentType: "curriculum-source-language-pack",
    contentSchemaVersion: "1.0.0",
    packageVersion: "0.1.0",
    sourcePath: "../english-curriculum",
    sourceRepository: "https://github.com/SleepyMario/english-curriculum",
    languages: ["en"], targetLanguage: "en",
    localization: { role: "source-language-pack", schemaVersion: "1.0.0", basePackageId: "com.sleepymario.language.english", sourceLocale: "en", targetLanguage: "en", compatibleBaseVersion: ">=0.1.0 <1.0.0" },
    subjects: ["language", "english", "localization"], license: { spdx: null, name: null, path: null }, include: ["review-decks/chapter-001-005/cards.tsv", "units/english-core"]
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
  const sourceFiles = await collectSourceFiles(sourceRoot, await sourceIncludesForTarget(target, sourceRoot));
  if (target.contentType === "language-curriculum") {
    const chapters = sourceFiles
      .filter((file) => isReadableChapterMarkdownPath(file.path))
      .map((file) => ({ chapter: Number.parseInt(chapterNumberForPath(file.path) ?? "0", 10), markdown: file.text }));
    assertLanguageCurriculumChapter5170Requirements(chapters);
    const topicInventoryFile = sourceFiles.find((file) => file.path === "units/broader-topic-inventory.json");
    const broaderTopics = topicInventoryFile === undefined ? [] : JSON.parse(topicInventoryFile.text) as BroaderTopicRecord[];
    assertLanguageCurriculumChapter71140Requirements(chapters, broaderTopics);
    if (chapters.some((chapter) => chapter.chapter === 140)) assertLanguageCurriculumStage71140Coverage(chapters, { requireCompleteStage: true });
  }
  const sourceCommit = normalizeGitCommit(readGitValue(sourceRoot, ["rev-parse", "HEAD"]));
  const sourceDirty = readGitValue(sourceRoot, ["status", "--short"]).trim().length > 0;
  const generatorCommit = readGitValue(repositoryRoot, ["rev-parse", "HEAD"]);

  const content = buildContentSnapshot(target, sourceRoot, sourceFiles, sourceCommit, sourceDirty);
  const contentBuffer = Buffer.from(`${JSON.stringify(content, null, 2)}\n`, "utf8");
  const contentFile = createFileRecord("content/content.json", "application/json", contentBuffer);
  const memorizationFiles = target.localization?.role === "source-language-pack" ? [] : buildMemorizationFiles(target, sourceFiles, options.generatedAt);
  const packagedSourceFiles = sourceFiles
    .filter((file) => target.contentType === "language-curriculum" && file.path === canonicalCastPath)
    .map((file) => ({ record: createFileRecord(file.path, file.mediaType, file.buffer), buffer: file.buffer }));

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
    files: [contentFile, ...packagedSourceFiles.map((file) => file.record), ...memorizationFiles.map((file) => file.record)],
    ...(target.license === undefined ? {} : { license: target.license })
    ,...(target.localization === undefined ? {} : { localization: target.localization })
  };

  assertValidContentPackageManifest(manifest);

  const manifestBuffer = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  const archiveBuffer = createDeterministicZip([
    { path: "manifest.json", data: manifestBuffer },
    { path: contentFile.path, data: contentBuffer },
    ...packagedSourceFiles.map((file) => ({ path: file.record.path, data: file.buffer })),
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
  readonly buffer: BufferValue;
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
const canonicalCastPath = "name-pools/canonical-cast.json";

async function sourceIncludesForTarget(target: ContentPackageGeneratorTarget, sourceRoot: string): Promise<readonly string[]> {
  const castAlreadyIncluded = target.include.some((include) => canonicalCastPath === include || canonicalCastPath.startsWith(`${include}/`));
  if (target.contentType !== "language-curriculum" || castAlreadyIncluded) {
    return target.include;
  }
  try {
    await access(resolve(sourceRoot, canonicalCastPath));
    return [...target.include, canonicalCastPath];
  } catch {
    return target.include;
  }
}

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
  if (!relativePath.endsWith(".md") && !relativePath.endsWith(".tsv") && relativePath !== canonicalCastPath && relativePath !== ".gitignore") {
    return;
  }

  const buffer = await readFile(absolutePath);
  files.push({
    path: relativePath,
    mediaType: mediaTypeForPath(relativePath),
    size: buffer.length,
    sha256: sha256Hex(buffer),
    text: buffer.toString("utf8"),
    buffer
  });
}

function buildContentSnapshot(
  target: ContentPackageGeneratorTarget,
  sourceRoot: string,
  sourceFiles: readonly SourceFile[],
  sourceCommit: string,
  sourceDirty: boolean
): unknown {
  if (target.localization?.role === "source-language-pack") {
    return buildSourceLanguageOverlay(target, sourceFiles, sourceCommit, sourceDirty);
  }
  return {
    contentSchema: "whacksmacker-source-markdown-snapshot-v1",
    packageId: target.packageId,
    source: {
      repository: target.sourceRepository,
      commit: sourceCommit,
      dirty: sourceDirty
    },
    sourceRootName: sourceRoot.split(sep).at(-1) ?? target.id,
    ...(target.targetLanguage === undefined ? {} : { targetLanguage: target.targetLanguage }),
    ...(target.localization?.role !== "base-curriculum" ? {} : { defaultSourceLocale: target.localization.defaultSourceLocale, defaultSourcePackageId: target.localization.defaultSourcePackageId }),
    ...(target.localization?.role !== "base-curriculum" ? {} : { localizedPaths: sourceFiles.filter(file => file.path.endsWith(".en.md")).map(file => file.path.replace(/\.en\.md$/u, ".md")) }),
    files: target.localization?.role === "base-curriculum" ? baseCurriculumSnapshotFiles(sourceFiles) : localizedSnapshotFiles(sourceFiles)
  };
}

function baseCurriculumSnapshotFiles(sourceFiles: readonly SourceFile[]): readonly unknown[] {
  const english = new Map(sourceFiles.filter(file => file.path.endsWith(".en.md")).map(file => [file.path.replace(/\.en\.md$/u, ".md"), file]));
  return sourceFiles.flatMap(file => {
    if (/\.(?:en|zh-TW)\.md$/u.test(file.path)) return [];
    const canonical = english.get(file.path) ?? file;
    return [{ path: file.path, mediaType: file.mediaType, size: canonical.size, sha256: canonical.sha256, text: canonical.text }];
  });
}

function buildSourceLanguageOverlay(target: ContentPackageGeneratorTarget, sourceFiles: readonly SourceFile[], sourceCommit: string, sourceDirty: boolean): unknown {
  const metadata = target.localization;
  if (metadata?.role !== "source-language-pack") throw new Error("Source overlay target requires source-language-pack metadata.");
  const locale = metadata.sourceLocale;
  const localizedPaths = new Set(sourceFiles.filter(file => file.path.endsWith(".en.md")).map(file => file.path.replace(/\.en\.md$/u, ".md")));
  const variants = sourceFiles.flatMap(file => {
    if (locale === "en") {
      if (!file.path.endsWith(".en.md")) return [];
      return [{ path: file.path.replace(/\.en\.md$/u, ".md"), text: file.text }];
    }
    if (file.path.endsWith(".en.md") || !localizedPaths.has(file.path)) return [];
    return [{ path: file.path, text: file.text }];
  });
  const review = sourceFiles.filter(file => isReviewDeckCardsPath(file.path)).flatMap(file => parseTabSeparatedRows(file.text).slice(1).map((row, index) => ({
    sourcePath: file.path, rowNumber: index + 1,
    prompt: decodeReviewDeckField(row[locale === "en" ? 6 : 4] || row[2]),
    answer: decodeReviewDeckField(row[locale === "en" ? 7 : 5] || row[3]),
    notes: row[locale === "en" ? 11 : 10],
    title: row[0].split(/\s+\/\s+/u)[locale === "en" ? 1 : 0] ?? row[0]
  })));
  return { contentSchema: "whacksmacker-curriculum-source-overlay-v1", packageId: target.packageId, basePackageId: metadata.basePackageId, sourceLocale: locale, targetLanguage: metadata.targetLanguage, source: { repository: target.sourceRepository, commit: sourceCommit, dirty: sourceDirty }, files: variants, review };
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
  const reviewExampleIndex = buildReviewExampleIndex(target, sourceFiles);
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
  const legacyHeader = ["deck", "direction", "front", "back", "source_chapter", "entry_type", "notes"];
  const localizedHeader = ["deck", "direction", "front", "back", "front_zh_tw", "back_zh_tw", "front_en", "back_en", "source_chapter", "entry_type", "notes_zh_tw", "notes_en"];
  const usesLocalizedRows = header.length === localizedHeader.length && header.every((field, index) => field === localizedHeader[index]);
  if (!usesLocalizedRows && (header.length !== legacyHeader.length || header.some((field, index) => field !== legacyHeader[index]))) {
    throw new Error(`Review deck cards file has unsupported header: ${file.path}`);
  }

  const items: MemorizationItem[] = body.map((row, index) => reviewDeckRowToItem(target, file.path, row, index + 1, generatedAt, reviewExampleIndex, usesLocalizedRows));
  return { schemaVersion: 1, items };
}

function reviewDeckRowToItem(
  target: ContentPackageGeneratorTarget,
  sourcePath: string,
  row: readonly string[],
  rowNumber: number,
  generatedAt: string,
  reviewExampleIndex: ReviewExampleIndex,
  localizedRow = false
): MemorizationItem {
  if (row.length !== (localizedRow ? 12 : 7)) {
    throw new Error(`Review deck row ${rowNumber + 1} has the wrong number of tab-separated fields in ${sourcePath}`);
  }
  const [deck, direction, rawFront, rawBack] = row;
  const sourceChapter = row[localizedRow ? 8 : 4];
  const entryType = row[localizedRow ? 9 : 5];
  const notes = row[localizedRow ? 10 : 6];
  const front = decodeReviewDeckField(rawFront);
  const back = decodeReviewDeckField(rawBack);
  const frontLocalized: LocalizedContentValue = localizedRow && row[4].length + row[6].length > 0 ? { "zh-TW": decodeReviewDeckField(row[4]), en: decodeReviewDeckField(row[6]) } : localizedReviewField(front);
  const backLocalized: LocalizedContentValue = localizedRow && row[5].length + row[7].length > 0 ? { "zh-TW": decodeReviewDeckField(row[5]), en: decodeReviewDeckField(row[7]) } : localizedReviewField(back);
  const frontValue = target.localization?.role === "base-curriculum" && typeof frontLocalized !== "string" ? frontLocalized.en : frontLocalized;
  const backValue = target.localization?.role === "base-curriculum" && typeof backLocalized !== "string" ? backLocalized.en : backLocalized;
  if (deck.trim().length === 0 || direction.trim().length === 0 || (!localizedRow && (front.trim().length === 0 || back.trim().length === 0))) {
    throw new Error(`Review deck row ${rowNumber + 1} has an empty required field in ${sourcePath}`);
  }
  const directionMatch = direction.match(/^(.+?) -> (.+?)$/u);
  if (directionMatch === null) {
    throw new Error(`Review deck row ${rowNumber + 1} has unsupported direction: ${direction}`);
  }
  const [, promptLabel, answerLabel] = directionMatch;
  const promptLanguage = languageCodeForReviewLabel(promptLabel);
  const answerLanguage = languageCodeForReviewLabel(answerLabel);
  const targetLanguage = target.targetLanguage ?? target.languages?.find((language) => language !== "en") ?? promptLanguage ?? answerLanguage;

  const deckSlug = slugForPath(sourcePath.replace(/^review-decks\//u, "").replace(/\/cards\.tsv$/u, ""));
  const entrySlug = slugForPath(entryType);
  const directionSlug = stableDirectionSlug(target, direction, promptLabel, answerLabel);
  const itemId = `review-decks/${deckSlug}/${String(rowNumber).padStart(4, "0")}-${directionSlug}-${entrySlug}`;
  const examples = examplesForReviewRow(reviewExampleIndex, {
    sourceChapter,
    promptLabel,
    answerLabel,
    front,
    back
  });
  const missingSourceExample = isCoreReviewDeckRow(sourceChapter) && examples.length === 0;
  if (missingSourceExample) {
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
      text: frontValue,
      plainText: frontValue,
      ...(promptLanguage === undefined ? {} : { language: promptLanguage }),
      mediaType: "text/plain"
    },
    answer: {
      text: backValue,
      plainText: backValue,
      ...(answerLanguage === undefined ? {} : { language: answerLanguage }),
      mediaType: "text/plain"
    },
    notes: localizedRow ? `Deck: ${deck.split(/\s+\/\s+/u)[1] ?? deck}. ${row[11]}` : localizedReviewNotes(deck, notes),
    ...(examples.length === 0 ? {} : { examples }),
    tags: [slugForPath(target.id), "review-deck", deckSlug, entrySlug, ...(missingSourceExample ? ["missing-source-example"] : [])],
    source: {
      path: sourcePath,
      title: target.localization?.role === "base-curriculum" ? (deck.split(/\s+\/\s+/u)[1] ?? deck) : localizedReviewTitle(deck)
    },
    language: {
      ...(targetLanguage === undefined ? {} : { target: targetLanguage }),
      base: target.defaultContentLocale ?? "en",
      script: scriptLabelForTarget(target)
    },
    createdAt: generatedAt,
    updatedAt: generatedAt
  };
}

function localizedReviewField(value: string): LocalizedContentValue {
  const match = value.match(/^中文（臺灣）:\s*(.*?)\nEnglish support:\s*(.+)$/su);
  return match === null ? value : { "zh-TW": match[1].trim(), en: match[2].trim() };
}

function localizedReviewTitle(value: string): LocalizedContentValue {
  const parts = value.split(/\s+\/\s+/u);
  return parts.length === 2 ? { "zh-TW": parts[0], en: parts[1] } : value;
}

function localizedReviewNotes(deck: string, notes: string): LocalizedContentValue {
  const title = localizedReviewTitle(deck);
  const parts = notes.split(/\s+\/\s+/u);
  if (typeof title === "string" && parts.length !== 2) return `Deck: ${deck}. ${notes}`;
  return {
    "zh-TW": `牌組：${typeof title === "string" ? title : title["zh-TW"]}。${parts[0] ?? notes}`,
    en: `Deck: ${typeof title === "string" ? title : title.en}. ${parts[1] ?? notes}`
  };
}

function localizedSnapshotFiles(sourceFiles: readonly SourceFile[]): readonly { readonly path: string; readonly mediaType: string; readonly size: number; readonly sha256: string; readonly text: LocalizedContentValue }[] {
  const localizedVariants = new Map<string, Map<string, SourceFile>>();
  for (const file of sourceFiles) {
    const match = file.path.match(/^(.*)\.(en|zh-TW)(\.md)$/u);
    if (match === null) continue;
    const logicalPath = `${match[1]}${match[3]}`;
    const variants = localizedVariants.get(logicalPath) ?? new Map<string, SourceFile>();
    variants.set(match[2], file);
    localizedVariants.set(logicalPath, variants);
  }
  const output: { path: string; mediaType: string; size: number; sha256: string; text: LocalizedContentValue }[] = [];
  for (const file of sourceFiles) {
    if (/\.(?:en|zh-TW)\.md$/u.test(file.path)) continue;
    const variants = localizedVariants.get(file.path);
    if (variants === undefined) {
      output.push({ path: file.path, mediaType: file.mediaType, size: file.size, sha256: file.sha256, text: file.text });
      continue;
    }
    const text: Record<string, string> = { "zh-TW": file.text };
    for (const [locale, variant] of variants) text[locale] = variant.text;
    output.push({ path: file.path, mediaType: file.mediaType, size: file.size, sha256: file.sha256, text });
  }
  return output;
}

interface ReviewExampleIndex {
  readonly byChapter: ReadonlyMap<string, readonly string[]>;
  readonly allLines: readonly string[];
  readonly strictReadContentOnly: boolean;
}

interface ReviewExampleRow {
  readonly sourceChapter: string;
  readonly promptLabel: string;
  readonly answerLabel: string;
  readonly front: string;
  readonly back: string;
}

function buildReviewExampleIndex(target: ContentPackageGeneratorTarget, sourceFiles: readonly SourceFile[]): ReviewExampleIndex {
  const byChapter = new Map<string, string[]>();
  const allLines: string[] = [];
  const strictReadContentOnly = isLanguageCurriculumTarget(target);
  for (const file of sourceFiles) {
    if (!isReadableChapterMarkdownPath(file.path)) {
      continue;
    }
    const chapter = chapterNumberForPath(file.path);
    if (chapter === undefined) {
      continue;
    }
    const lines = strictReadContentOnly
      ? extractStrictReadContentExampleLines(file.text)
      : extractLearnerFacingExampleLines(file.text);
    if (lines.length === 0) {
      continue;
    }
    byChapter.set(chapter, [...(byChapter.get(chapter) ?? []), ...lines]);
    for (const line of lines) {
      if (!allLines.includes(line)) {
        allLines.push(line);
      }
    }
  }
  return { byChapter, allLines, strictReadContentOnly };
}

function examplesForReviewRow(index: ReviewExampleIndex, row: ReviewExampleRow): readonly string[] {
  const sourceChapter = row.sourceChapter.trim();
  if (!/^\d+$/u.test(sourceChapter)) {
    return [];
  }
  const chapterKey = String(Number.parseInt(sourceChapter, 10));
  const chapterLines = index.byChapter.get(chapterKey) ?? [];
  const sourceLines = index.strictReadContentOnly
    ? [...chapterLines, ...index.allLines.filter((line) => !chapterLines.includes(line))]
    : chapterLines;
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
  const frontFields = structuredReviewSearchFields(row.front);
  const backFields = structuredReviewSearchFields(row.back);
  const targetTermKeys = ["characters", "japanese"];
  const terms = row.promptLabel === "English"
    ? reviewSearchTermValues(backFields, row.back, targetTermKeys)
    : row.answerLabel === "English"
      ? reviewSearchTermValues(frontFields, row.front, targetTermKeys)
      : [
        ...reviewSearchTermValues(frontFields, row.front, targetTermKeys),
        ...reviewSearchTermValues(backFields, row.back, targetTermKeys)
      ];
  return terms.flatMap(splitReviewSearchTerm).filter((term, index, all) => all.indexOf(term) === index);
}

function decodeReviewDeckField(value: string): string {
  return value.replace(/\\n/gu, "\n").replace(/\\t/gu, "\t").replace(/\\\\/gu, "\\");
}

function structuredReviewSearchFields(value: string): ReadonlyMap<string, string> {
  const fields = new Map<string, string>();
  for (const line of value.replace(/\r\n?/gu, "\n").split("\n")) {
    const match = line.match(/^(Meaning|Pinyin|Zhuyin|Characters|Reading|Japanese):\s*(.+)$/iu);
    if (match === null) {
      continue;
    }
    const key = match[1]?.toLowerCase();
    const fieldValue = match[2]?.trim();
    if (key !== undefined && fieldValue !== undefined && fieldValue.length > 0) {
      fields.set(key, fieldValue);
    }
  }
  return fields;
}

function reviewSearchTermValues(fields: ReadonlyMap<string, string>, fallback: string, preferredKeys: readonly string[]): readonly string[] {
  const terms = preferredKeys
    .map((key) => fields.get(key))
    .filter((value): value is string => value !== undefined && value.trim().length > 0);
  return terms.length > 0 ? terms : [fallback];
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
  if (term === "이다") {
    return ["이에요", "예요", "입니다"];
  }
  if (!/^[가-힣]+다$/u.test(term) || term.length < 2) {
    return [];
  }
  const stem = term.slice(0, -1);
  const alternatives = stem.length === 0 ? [] : [stem];
  if (term.endsWith("하다") && term.length > 2) {
    alternatives.push(term.slice(0, -2));
  }
  return alternatives;
}

function lineMatchesReviewTerm(line: string, term: string): boolean {
  if (term.length === 0) {
    return false;
  }
  const escaped = escapeRegExp(term);
  if (containsHangul(term)) {
    return line.includes(term) || compactKoreanText(line).includes(compactKoreanText(term));
  }
  if (containsNonLatinScript(term)) {
    return line.includes(term);
  }
  if (containsWordLikeCharacters(term)) {
    return new RegExp(`(^|[^\\p{L}\\p{N}_])${escaped}([^\\p{L}\\p{N}_]|$)`, "iu").test(line);
  }
  return line.includes(term);
}

function containsHangul(value: string): boolean {
  return /[\u1100-\u11ff\uac00-\ud7af]/u.test(value);
}

function containsNonLatinScript(value: string): boolean {
  return /[\u1100-\u11ff\u3040-\u30ff\u3100-\u312f\u31a0-\u31bf\u3400-\u4dbf\u4e00-\u9fff\uac00-\ud7af]/u.test(value);
}

function compactKoreanText(value: string): string {
  return value.replace(/[\s\u200b-\u200d\ufeff]+/gu, "");
}

function containsWordLikeCharacters(value: string): boolean {
  return /[\p{L}\p{N}_]/u.test(value);
}

function escapeRegExp(value: string): string {
  return value.replace(/[\\^$.*+?()[\]{}|]/gu, "\\$&");
}

function isReadableChapterMarkdownPath(path: string): boolean {
  return /^units\/.+\/chapter-\d+[^/]*\/chapter\.md$/u.test(path) && !/-grammar-(?:easy|hard)\/chapter\.md$/u.test(path);
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

function extractStrictReadContentExampleLines(markdown: string): readonly string[] {
  const examples: string[] = [];
  let inFrontMatter = false;
  let inReadContentSection = false;
  let inCodeFence = false;
  let inReadContentTextFence = false;
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
    if (/^#{2,4}\s+(?:對話(?: \/ Learner-facing Dialogue)?|閱讀短文(?: \/ Learner-facing Controlled Reading)?|Model Dialogue|Model Mini Dialogue|Model Mini Text|Learner-facing Dialogue|Learner-facing Controlled Reading|Controlled Reading)(?:\b|$)/iu.test(trimmed)) {
      inReadContentSection = true;
      continue;
    }
    if (/^#{2,4}\s+/u.test(trimmed)) {
      inReadContentSection = false;
      continue;
    }
    if (trimmed.startsWith("```")) {
      if (inCodeFence) {
        inCodeFence = false;
        inReadContentTextFence = false;
      } else {
        inCodeFence = true;
        inReadContentTextFence = inReadContentSection && /^```(?:text)?\s*$/iu.test(trimmed);
      }
      continue;
    }
    if (!inReadContentSection || (inCodeFence && !inReadContentTextFence)) {
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
    || /^Context:/iu.test(trimmed)
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

function isLanguageCurriculumTarget(target: ContentPackageGeneratorTarget): boolean {
  return target.contentType === "language-curriculum";
}

function languageCodeForReviewLabel(label: string): string | undefined {
  switch (label) {
    case "English":
    case "English Target":
      return "en";
    case "Chinese (Taiwan)":
      return "zh-TW";
    case "Korean":
      return "ko";
    case "Japanese":
      return "ja";
    case "Reading":
      return "ja-Kana";
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

function stableDirectionSlug(
  target: ContentPackageGeneratorTarget,
  direction: string,
  promptLabel: string,
  answerLabel: string
): string {
  if (target.id === "english-curriculum") {
    if (promptLabel === "English Target" && answerLabel === "Chinese (Taiwan)") {
      return slugForPath("English Target -> English");
    }
    if (promptLabel === "Chinese (Taiwan)" && answerLabel === "English Target") {
      return slugForPath("English -> English Target");
    }
  }
  return slugForPath(direction);
}

function scriptLabelForTarget(target: ContentPackageGeneratorTarget): string {
  switch (target.id) {
    case "korean-curriculum":
      return "Hangul";
    case "chinese-mandarin-traditional-curriculum":
      return "Pinyin/Zhuyin";
    case "chinese-mandarin-simplified-curriculum":
      return "Pinyin";
    case "english-curriculum":
      return "English";
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
    return execFileSync("git", [...args], { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  } catch (error) {
    if (typeof error === "object" && error !== null && "stdout" in error && typeof error.stdout === "string") {
      return error.stdout.trim();
    }
    throw error;
  }
}

function normalizeGitCommit(value: string): string {
  return /^[0-9a-f]{40}$/u.test(value) ? value : "0".repeat(40);
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
