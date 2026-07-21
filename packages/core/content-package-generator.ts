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
  pedagogicalContentForMemorizationItem,
  type MemorizationItem,
  type MemorizationItemCollection,
  type MemorizationItemV1,
  type MemorizationItemV2
} from "./memorization-item";
import { pedagogicalFingerprint } from "./pedagogical-fingerprint";
import type { LocalizedContentValue } from "./localized-content";
import {
  assertLanguageCurriculumChapter5170Requirements,
  assertLanguageCurriculumChapter71140Requirements,
  assertLanguageCurriculumStage71140Coverage,
  type BroaderTopicRecord
} from "./language-curriculum-policy";
import { removeCompleteRereadingSection, removeContentWrapperHeading } from "./curriculum-display";

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
  isAbsolute(path: string): boolean;
  join(...paths: string[]): string;
  relative(from: string, to: string): string;
  resolve(...paths: string[]): string;
  sep: string;
};
declare const process: {
  cwd(): string;
  env: Record<string, string | undefined>;
};

const packageMetadata = require("../../../package.json");
const whackSmackerApplicationVersion = packageMetadata.version;
const { Buffer } = require("node:buffer");
const { createHash } = require("node:crypto");
const { execFileSync } = require("node:child_process");
const { access, mkdir, readdir, readFile, stat, writeFile } = require("node:fs/promises");
const { dirname, isAbsolute, join, relative, resolve, sep } = require("node:path");

export interface ContentPackageGeneratorTarget {
  readonly id: string;
  readonly packageId: string;
  readonly displayName: LocalizedContentValue;
  readonly description: LocalizedContentValue;
  readonly contentType: ContentPackageManifest["contentType"];
  readonly capabilities?: ContentPackageManifest["capabilities"];
  readonly relatedPackageIds?: readonly string[];
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
  readonly readingContentInclude?: readonly string[];
}

export interface GenerateContentPackageOptions {
  readonly targetId: string;
  readonly outputDirectory: string;
  readonly generatedAt: string;
  readonly sourceRoot?: string;
  readonly env?: Readonly<Record<string, string | undefined>>;
}

export interface ContentPackageSourceResolution {
  readonly configuredPath: string;
  readonly resolvedPath: string;
  readonly sourceRootSelection: string;
}

export const contentPackageSourceRootEnvironmentVariable = "WHACKSMACKER_PACKAGE_SOURCE_ROOT";

export interface GeneratedContentPackageResult {
  readonly targetId: string;
  readonly packageId: string;
  readonly packageVersion: string;
  readonly filePath: string;
  readonly manifest: ContentPackageManifest;
  readonly archiveSha256: string;
}

export const contentPackageGeneratorName = "whacksmacker-content-builder";

const legacyGeneratorTargets: readonly ContentPackageGeneratorTarget[] = [
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
      "geography-ledger.json",
      "number-progression.json",
      "lexical-topics.json",
      "lexical-topic-audit.json",
      "lexical-topic-audit.md",
      "sino-vietnamese-lexicon.json",
      "sino-vietnamese-audit.json",
      "sino-vietnamese-audit.md",
      "name-pools",
      "review-decks",
      "research",
      "units"
    ],
    readingContentInclude: [
      "README.md",
      "philosophy.md",
      "scope.md",
      "curriculum-map.md",
      "progress.md",
      "backlog.md",
      "decisions.md",
      "geography-ledger.json",
      "number-progression.json",
      "lexical-topics.json",
      "lexical-topic-audit.json",
      "lexical-topic-audit.md",
      "sino-vietnamese-lexicon.json",
      "sino-vietnamese-audit.json",
      "sino-vietnamese-audit.md",
      "name-pools",
      "units/README.md",
      "units/vietnamese-foundation",
      "units/vietnamese-core"
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
      "lexical-topics.json",
      "lexical-topic-audit.json",
      "lexical-topic-audit.md",
      "name-pools",
      "review-decks",
      "research",
      "units"
    ]
  },
  {
    id: "arabic-curriculum",
    packageId: "com.sleepymario.language.arabic",
    displayName: "Arabic",
    description: "Arabic language curriculum content generated from the rebuilt canonical Chapters 1 through 5 source.",
    contentType: "language-curriculum",
    contentSchemaVersion: "1.0.0",
    packageVersion: "0.1.0",
    sourcePath: "../arabic-curriculum",
    sourceRepository: "https://github.com/SleepyMario/arabic-curriculum",
    languages: ["ar", "en"],
    subjects: ["language", "arabic"],
    license: { spdx: null, name: null, path: null },
    include: ["README.md", "lexical-topics.json", "lexical-topic-audit.json", "lexical-topic-audit.md", "units"]
  },
  {
    id: "french-curriculum",
    packageId: "com.sleepymario.language.french",
    displayName: "French",
    description: "French language curriculum content generated from the rebuilt canonical Chapters 1 through 5 source.",
    contentType: "language-curriculum",
    contentSchemaVersion: "1.0.0",
    packageVersion: "0.1.0",
    sourcePath: "../french-curriculum",
    sourceRepository: "https://github.com/SleepyMario/french-curriculum",
    languages: ["fr", "en"],
    subjects: ["language", "french"],
    license: { spdx: null, name: null, path: null },
    include: ["README.md", "lexical-topics.json", "lexical-topic-audit.json", "lexical-topic-audit.md", "units"]
  },
  {
    id: "german-curriculum",
    packageId: "com.sleepymario.language.german",
    displayName: "German",
    description: "German language curriculum content generated from the rebuilt canonical Chapters 1 through 5 source.",
    contentType: "language-curriculum",
    contentSchemaVersion: "1.0.0",
    packageVersion: "0.1.0",
    sourcePath: "../german-curriculum",
    sourceRepository: "https://github.com/SleepyMario/german-curriculum",
    languages: ["de", "en"],
    subjects: ["language", "german"],
    license: { spdx: null, name: null, path: null },
    include: ["README.md", "lexical-topics.json", "lexical-topic-audit.json", "lexical-topic-audit.md", "units"]
  },
  {
    id: "hindi-curriculum",
    packageId: "com.sleepymario.language.hindi",
    displayName: "Hindi",
    description: "Hindi language curriculum content generated from the rebuilt canonical Chapters 1 through 5 source.",
    contentType: "language-curriculum",
    contentSchemaVersion: "1.0.0",
    packageVersion: "0.1.0",
    sourcePath: "../hindi-curriculum",
    sourceRepository: "https://github.com/SleepyMario/hindi-curriculum",
    languages: ["hi", "en"],
    subjects: ["language", "hindi"],
    license: { spdx: null, name: null, path: null },
    include: ["README.md", "lexical-topics.json", "lexical-topic-audit.json", "lexical-topic-audit.md", "units"]
  },
  {
    id: "japanese-curriculum",
    packageId: "com.sleepymario.language.japanese",
    displayName: "Japanese",
    description: "Japanese language curriculum content generated from the rebuilt canonical Chapters 1 through 5 source.",
    contentType: "language-curriculum",
    contentSchemaVersion: "1.0.0",
    packageVersion: "0.1.0",
    sourcePath: "../japanese-curriculum",
    sourceRepository: "https://github.com/SleepyMario/japanese-curriculum",
    languages: ["ja", "en"],
    subjects: ["language", "japanese"],
    license: { spdx: null, name: null, path: null },
    include: ["README.md", "lexical-topics.json", "lexical-topic-audit.json", "lexical-topic-audit.md", "units"]
  },
  {
    id: "korean-curriculum",
    packageId: "com.sleepymario.language.korean",
    displayName: "Korean",
    description: "Korean language curriculum content generated from the rebuilt canonical Chapters 1 through 5 source.",
    contentType: "language-curriculum",
    contentSchemaVersion: "1.0.0",
    packageVersion: "0.1.0",
    sourcePath: "../korean-curriculum",
    sourceRepository: "https://github.com/SleepyMario/korean-curriculum",
    languages: ["ko", "en"],
    subjects: ["language", "korean"],
    license: { spdx: null, name: null, path: null },
    include: [
      "README.md",
      "lexical-topics.json",
      "lexical-topic-audit.json",
      "lexical-topic-audit.md",
      "units"
    ]
  },
  {
    id: "russian-curriculum",
    packageId: "com.sleepymario.language.russian",
    displayName: "Russian",
    description: "Russian language curriculum content generated from the rebuilt canonical Chapters 1 through 5 source.",
    contentType: "language-curriculum",
    contentSchemaVersion: "1.0.0",
    packageVersion: "0.1.0",
    sourcePath: "../russian-curriculum",
    sourceRepository: "https://github.com/SleepyMario/russian-curriculum",
    languages: ["ru", "en"],
    subjects: ["language", "russian"],
    license: { spdx: null, name: null, path: null },
    include: ["README.md", "lexical-topics.json", "lexical-topic-audit.json", "lexical-topic-audit.md", "units"]
  },
  {
    id: "spanish-curriculum",
    packageId: "com.sleepymario.language.spanish",
    displayName: "Spanish",
    description: "Spanish language curriculum content generated from the rebuilt canonical Chapters 1 through 5 source.",
    contentType: "language-curriculum",
    contentSchemaVersion: "1.0.0",
    packageVersion: "0.1.0",
    sourcePath: "../spanish-curriculum",
    sourceRepository: "https://github.com/SleepyMario/spanish-curriculum",
    languages: ["es", "en"],
    subjects: ["language", "spanish"],
    license: { spdx: null, name: null, path: null },
    include: ["README.md", "lexical-topics.json", "lexical-topic-audit.json", "lexical-topic-audit.md", "units"]
  },
  {
    id: "thai-curriculum",
    packageId: "com.sleepymario.language.thai",
    displayName: "Thai",
    description: "Thai language curriculum content generated from the rebuilt canonical Chapters 1 through 5 source.",
    contentType: "language-curriculum",
    contentSchemaVersion: "1.0.0",
    packageVersion: "0.1.0",
    sourcePath: "../thai-curriculum",
    sourceRepository: "https://github.com/SleepyMario/thai-curriculum",
    languages: ["th", "en"],
    subjects: ["language", "thai"],
    license: { spdx: null, name: null, path: null },
    include: ["README.md", "lexical-topics.json", "lexical-topic-audit.json", "lexical-topic-audit.md", "units"]
  },
  {
    id: "zulu-curriculum",
    packageId: "com.sleepymario.language.zulu",
    displayName: "Zulu",
    description: "Zulu language curriculum content generated from the rebuilt canonical Chapters 1 through 5 source.",
    contentType: "language-curriculum",
    contentSchemaVersion: "1.0.0",
    packageVersion: "0.1.0",
    sourcePath: "../zulu-curriculum",
    sourceRepository: "https://github.com/SleepyMario/zulu-curriculum",
    languages: ["zu", "en"],
    subjects: ["language", "zulu"],
    license: { spdx: null, name: null, path: null },
    include: ["README.md", "lexical-topics.json", "lexical-topic-audit.json", "lexical-topic-audit.md", "units"]
  }
];

const reviewPackageByReadingPackage = new Map<string, string>([
  ["com.sleepymario.language.vietnamese", "com.sleepymario.language.vietnamese.reviews"],
  ["com.sleepymario.language.dutch", "com.sleepymario.language.dutch.reviews"],
  ["com.sleepymario.language.arabic", "com.sleepymario.language.arabic.reviews"],
  ["com.sleepymario.language.french", "com.sleepymario.language.french.reviews"],
  ["com.sleepymario.language.german", "com.sleepymario.language.german.reviews"],
  ["com.sleepymario.language.hindi", "com.sleepymario.language.hindi.reviews"],
  ["com.sleepymario.language.japanese", "com.sleepymario.language.japanese.reviews"],
  ["com.sleepymario.language.korean", "com.sleepymario.language.korean.reviews"],
  ["com.sleepymario.language.russian", "com.sleepymario.language.russian.reviews"],
  ["com.sleepymario.language.spanish", "com.sleepymario.language.spanish.reviews"],
  ["com.sleepymario.language.thai", "com.sleepymario.language.thai.reviews"],
  ["com.sleepymario.language.zulu", "com.sleepymario.language.zulu.reviews"]
]);

const readingTargets = legacyGeneratorTargets.map((target): ContentPackageGeneratorTarget => {
  if (target.contentType === "linguistic-terminology") return { ...target, capabilities: ["technical"] };
  const baseId = target.localization?.role === "source-language-pack" ? target.localization.basePackageId : target.packageId;
  const relatedReview = reviewPackageByReadingPackage.get(baseId);
  return {
    ...target,
    capabilities: ["reading-curriculum"],
    ...(relatedReview === undefined ? {} : { relatedPackageIds: [relatedReview] }),
    license: {
      spdx: "CC-BY-NC-4.0",
      name: "Creative Commons Attribution-NonCommercial 4.0 International",
      path: "LICENSE-CONTENT"
    }
  };
});

const coreReviewTargets: readonly {
  readonly slug: string;
  readonly name: string;
  readonly readingId?: string;
  readonly languages: readonly string[];
  readonly packageVersion: string;
}[] = [
  { slug: "vietnamese", name: "Vietnamese", readingId: "com.sleepymario.language.vietnamese", languages: ["vi", "en"], packageVersion: "0.2.0" },
  { slug: "dutch", name: "Dutch", readingId: "com.sleepymario.language.dutch", languages: ["nl", "en"], packageVersion: "0.1.0" },
  { slug: "arabic", name: "Arabic", readingId: "com.sleepymario.language.arabic", languages: ["ar", "en"], packageVersion: "0.1.0" },
  { slug: "french", name: "French", readingId: "com.sleepymario.language.french", languages: ["fr", "en"], packageVersion: "0.1.0" },
  { slug: "german", name: "German", readingId: "com.sleepymario.language.german", languages: ["de", "en"], packageVersion: "0.1.0" },
  { slug: "hindi", name: "Hindi", readingId: "com.sleepymario.language.hindi", languages: ["hi", "en"], packageVersion: "0.1.0" },
  { slug: "japanese", name: "Japanese", readingId: "com.sleepymario.language.japanese", languages: ["ja", "en"], packageVersion: "0.1.0" },
  { slug: "korean", name: "Korean", readingId: "com.sleepymario.language.korean", languages: ["ko", "en"], packageVersion: "0.1.0" },
  { slug: "russian", name: "Russian", readingId: "com.sleepymario.language.russian", languages: ["ru", "en"], packageVersion: "0.1.0" },
  { slug: "spanish", name: "Spanish", readingId: "com.sleepymario.language.spanish", languages: ["es", "en"], packageVersion: "0.1.0" },
  { slug: "thai", name: "Thai", readingId: "com.sleepymario.language.thai", languages: ["th", "en"], packageVersion: "0.1.0" },
  { slug: "zulu", name: "Zulu", readingId: "com.sleepymario.language.zulu", languages: ["zu", "en"], packageVersion: "0.1.0" }
];

const generatedCoreReviewTargets: readonly ContentPackageGeneratorTarget[] = coreReviewTargets.map(({ slug, name, readingId, languages, packageVersion }) => ({
  id: `${slug}-core-reviews`,
  packageId: readingId === undefined ? `com.sleepymario.language.${slug}.reviews` : `${readingId}.reviews`,
  displayName: `${name} Core Reviews`,
  description: readingId === undefined
    ? `GPL core review decks for ${name}; this metadata does not declare a full reading curriculum package.`
    : `GPL core review decks for ${name}, usable without a reading curriculum package.`,
  contentType: "core-review",
  capabilities: ["core-review"],
  ...(readingId === undefined ? {} : { relatedPackageIds: [readingId] }),
  contentSchemaVersion: slug === "vietnamese" || slug === "dutch" ? "2.0.0" : "1.0.0",
  packageVersion,
  sourcePath: `review-content/${slug}`,
  sourceRepository: "https://github.com/SleepyMario/whacksmacker",
  languages,
  subjects: ["language", "review"],
  dependencies: slug === "vietnamese"
    ? [{ packageId: readingId, version: ">=0.1.0 <0.2.0", optional: true }]
    : [],
  license: { spdx: "GPL-3.0-or-later", name: "GNU General Public License version 3 or later", path: "LICENSE-SOFTWARE" },
  include: ["README.md", "LICENSE-SOFTWARE", "review-decks"]
} as ContentPackageGeneratorTarget));

export const contentPackageGeneratorTargets: readonly ContentPackageGeneratorTarget[] = [...readingTargets, ...generatedCoreReviewTargets];

export async function generateContentPackage(options: GenerateContentPackageOptions): Promise<GeneratedContentPackageResult> {
  const target = getContentPackageGeneratorTarget(options.targetId);
  const sourceResolution = resolveContentPackageSourcePath(target.sourcePath, {
    sourceRoot: options.sourceRoot,
    env: options.env
  });
  const sourceRoot = sourceResolution.resolvedPath;
  let sourceFiles: readonly SourceFile[];
  try {
    await access(sourceRoot);
    sourceFiles = [
      ...await collectSourceFiles(sourceRoot, await sourceIncludesForTarget(target, sourceRoot)),
      ...await packagedReadingSupportFiles(target, sourceRoot)
    ];
  } catch (error) {
    throw contentPackageSourceError(sourceResolution, error);
  }
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
  const reviewEvidenceFiles = target.capabilities?.includes("core-review")
    ? await collectReviewEvidenceFiles(target, options.env)
    : [];
  const memorizationFiles = target.capabilities?.includes("core-review") ? buildMemorizationFiles(target, sourceFiles, reviewEvidenceFiles, options.generatedAt) : [];
  const packagedSourceFiles = sourceFiles
    .filter((file) => packagedCurriculumMetadataPaths.has(file.path) || file.path === target.license?.path || file.path === "NOTICE")
    .map((file) => ({ record: createFileRecord(file.path, file.mediaType, file.buffer), buffer: file.buffer }));

  const manifest: ContentPackageManifest = {
    packageFormatVersion: whackSmackerPackageFormatVersion,
    packageId: target.packageId,
    packageVersion: target.packageVersion,
    displayName: target.displayName,
    description: target.description,
    contentType: target.contentType,
    ...(target.capabilities === undefined ? {} : { capabilities: target.capabilities }),
    ...(target.relatedPackageIds === undefined ? {} : { relatedPackageIds: target.relatedPackageIds }),
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

const readingSupportPackages: Readonly<Record<string, readonly { readonly source: string; readonly destination: string }[]>> = {
  "vietnamese-curriculum": Array.from({ length: 50 }, (_, index) => index + 1).map((chapter) => ({
    source: `curriculum-support/vietnamese/chapter-${String(chapter).padStart(3, "0")}/reading-support.json`,
    destination: `units/vietnamese-core/chapter-${String(chapter).padStart(3, "0")}-basic-sentences-${chapter}/reading-support.json`
  })),
  "japanese-curriculum": [
    [1, "chapter-001-a-first-meeting"],
    [2, "chapter-002-a-quiet-room"],
    [3, "chapter-003-what-is-this"],
    [4, "chapter-004-at-the-cafe"],
    [5, "chapter-005-an-invitation"]
  ].map(([chapter, directory]) => ({
    source: `curriculum-support/japanese/chapter-${String(chapter).padStart(3, "0")}/reading-support.json`,
    destination: `units/japanese-core/${directory}/reading-support.json`
  })),
  "thai-curriculum": [
    [1, "chapter-001-a-polite-meeting"],
    [2, "chapter-002-one-quiet-room"],
    [3, "chapter-003-what-is-this"],
    [4, "chapter-004-mali-s-morning"],
    [5, "chapter-005-a-market-plan"]
  ].map(([chapter, directory]) => ({
    source: `curriculum-support/thai/chapter-${String(chapter).padStart(3, "0")}/reading-support.json`,
    destination: `units/thai-core/${directory}/reading-support.json`
  })),
  "dutch-curriculum": [
    [1, "chapter-001-basic-sentences-1"],
    [2, "chapter-002-basic-sentences-2"],
    [3, "chapter-003-basic-sentences-3"],
    [4, "chapter-004-basic-sentences-4"],
    [5, "chapter-005-basic-sentences-5"],
    [6, "chapter-006-basic-sentences-6"],
    [7, "chapter-007-basic-sentences-7"],
    [8, "chapter-008-basic-sentences-8"],
    [9, "chapter-009-basic-sentences-9"],
    [10, "chapter-010-basic-sentences-10"],
    [11, "chapter-011-asking-how-someone-is"],
    [12, "chapter-012-a-simple-daily-routine"],
    [13, "chapter-013-ordering-politely"],
    [14, "chapter-014-two-places-in-a-day"],
    [15, "chapter-015-asking-where-someone-lives"],
    [16, "chapter-016-working-at-the-library"],
    [17, "chapter-017-making-a-plan"],
    [18, "chapter-018-a-quiet-evening"],
    [19, "chapter-019-asking-for-help"],
    [20, "chapter-020-an-appointment-in-town"],
    [21, "chapter-021-meeting-the-family"],
    [22, "chapter-022-an-afternoon-together"],
    [23, "chapter-023-planning-the-evening"],
    [24, "chapter-024-dinner-at-home"],
    [25, "chapter-025-going-to-the-museum"],
    [26, "chapter-026-a-busy-saturday"],
    [27, "chapter-027-choosing-a-birthday-gift"],
    [28, "chapter-028-preparing-for-a-workday"],
    [29, "chapter-029-planning-a-picnic"],
    [30, "chapter-030-a-shared-family-room"],
    [31, "chapter-031-the-school-project"],
    [32, "chapter-032-helping-at-the-animal-shelter"],
    [33, "chapter-033-choosing-market-produce"],
    [34, "chapter-034-getting-ready-for-the-day"],
    [35, "chapter-035-comparing-two-routes"],
    [36, "chapter-036-sending-a-parcel"],
    [37, "chapter-037-finding-a-library-book"],
    [38, "chapter-038-looking-at-old-photographs"],
    [39, "chapter-039-a-weekly-sports-schedule"],
    [40, "chapter-040-the-lost-and-found-box"],
    [41, "chapter-041-counting-stock-in-the-shop"],
    [42, "chapter-042-ten-breakfast-orders"],
    [43, "chapter-043-the-school-sports-day"],
    [44, "chapter-044-books-for-the-reading-club"],
    [45, "chapter-045-a-cycling-route"],
    [46, "chapter-046-supplies-for-the-cafe"],
    [47, "chapter-047-shopping-for-two-families"],
    [48, "chapter-048-measuring-the-new-room"],
    [49, "chapter-049-prices-at-the-market"],
    [50, "chapter-050-packing-aid-parcels"],
    [51, "chapter-051-planning-the-school-excursion"],
    [52, "chapter-052-the-renovated-shop"],
    [53, "chapter-053-remembering-the-old-classroom"],
    [54, "chapter-054-a-market-day-in-the-past"],
    [55, "chapter-055-organizing-a-volunteer-event"],
    [56, "chapter-056-cooking-for-the-community"],
    [57, "chapter-057-library-rules-and-permission"],
    [58, "chapter-058-the-weather-and-the-journey"],
    [59, "chapter-059-finishing-a-research-project"],
    [60, "chapter-060-after-the-community-festival"],
    [61, "chapter-061-a-conditional-health-plan"],
    [62, "chapter-062-before-the-tram-museum-opened"],
    [63, "chapter-063-first-experiences-at-work"],
    [64, "chapter-064-living-in-the-same-neighborhood"],
    [65, "chapter-065-preparing-a-health-information-day"],
    [66, "chapter-066-how-the-community-center-is-run"],
    [67, "chapter-067-people-who-help-the-neighborhood"],
    [68, "chapter-068-a-cafe-that-keeps-changing"],
    [69, "chapter-069-a-formal-information-request"],
    [70, "chapter-070-reporting-the-meeting"],
    [71, "chapter-071-planning-a-weekend-hike"],
    [72, "chapter-072-a-shelter-dog-finds-a-foster-home"],
    [73, "chapter-073-cooking-a-birthday-dinner-together"],
    [74, "chapter-074-making-a-first-ceramic-bowl"],
    [75, "chapter-075-fixing-the-wifi-before-a-family-call"]
  ].map(([chapter, directory]) => ({
    source: `curriculum-support/dutch/chapter-${String(chapter).padStart(3, "0")}/reading-support.json`,
    destination: `units/dutch-core/${directory}/reading-support.json`
  }))
};

async function packagedReadingSupportFiles(target: ContentPackageGeneratorTarget, sourceRoot: string): Promise<readonly SourceFile[]> {
  return Promise.all((readingSupportPackages[target.id] ?? []).map(async ({ source, destination }) => {
    const buffer = await readFile(resolve(repositoryRoot, source));
    const text = buffer.toString("utf8");
    const support = JSON.parse(text) as unknown;
    await assertValidReadingSupport(support, source, sourceRoot, destination);
    return { path: destination, mediaType: "application/json", size: buffer.length, sha256: sha256Hex(buffer), text, buffer };
  }));
}

async function assertValidReadingSupport(value: unknown, source: string, sourceRoot: string, destination: string): Promise<void> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error(`${source}: reading support must be an object`);
  const audienceSections = (value as Record<string, unknown>).audienceSections;
  if (!Array.isArray(audienceSections)) throw new Error(`${source}: audienceSections must be an array`);
  for (const [index, candidate] of audienceSections.entries()) {
    if (typeof candidate !== "object" || candidate === null || Array.isArray(candidate)) throw new Error(`${source}: audienceSections[${index}] must be an object`);
    const section = candidate as Record<string, unknown>;
    for (const key of ["sourceHeading", "normal", "expert"] as const) {
      if (typeof section[key] !== "string" || (section[key] as string).trim().length === 0) throw new Error(`${source}: audienceSections[${index}].${key} must be a nonempty string`);
    }
    if (section.normalHeading !== undefined && section.normalHeading !== null
      && (typeof section.normalHeading !== "string" || section.normalHeading.trim().length === 0)) {
      throw new Error(`${source}: audienceSections[${index}].normalHeading must be a nonempty string or null`);
    }
    if (section.expertHeading !== undefined
      && (typeof section.expertHeading !== "string" || section.expertHeading.trim().length === 0)) {
      throw new Error(`${source}: audienceSections[${index}].expertHeading must be a nonempty string`);
    }
  }
  const characters = (value as Record<string, unknown>).characters;
  if (characters === undefined) return;
  if (typeof characters !== "object" || characters === null || Array.isArray(characters)) throw new Error(`${source}: characters must be an object`);
  const entries = (characters as Record<string, unknown>).entries;
  if (!Array.isArray(entries)) throw new Error(`${source}: characters.entries must preserve internal identity and evidence`);
  const chapterPath = resolve(sourceRoot, dirname(destination), "chapter.md");
  const chapter = (await readFile(chapterPath)).toString("utf8");
  for (const [index, candidate] of entries.entries()) {
    if (typeof candidate !== "object" || candidate === null || Array.isArray(candidate)) throw new Error(`${source}: characters.entries[${index}] must be an object`);
    const entry = candidate as Record<string, unknown>;
    for (const key of ["word", "characters", "meaning", "lexicalEntryId", "senseId", "usage"] as const) {
      if (typeof entry[key] !== "string" || entry[key].trim().length === 0 || entry[key] !== entry[key].normalize("NFC")) {
        throw new Error(`${source}: characters.entries[${index}].${key} must be a nonempty NFC string`);
      }
    }
    if (!Number.isInteger(entry.firstIntroductionChapter) || (entry.firstIntroductionChapter as number) < 1) {
      throw new Error(`${source}: characters.entries[${index}].firstIntroductionChapter must be a positive integer`);
    }
    const provenance = entry.provenance;
    if (typeof provenance !== "object" || provenance === null || Array.isArray(provenance)
      || ["path", "section", "locator"].some((key) => typeof (provenance as Record<string, unknown>)[key] !== "string" || ((provenance as Record<string, unknown>)[key] as string).trim().length === 0)) {
      throw new Error(`${source}: characters.entries[${index}].provenance must contain path, section, and locator`);
    }
    if ((provenance as Record<string, unknown>).path !== destination.replace(/reading-support\.json$/u, "chapter.md")) {
      throw new Error(`${source}: characters.entries[${index}].provenance.path must identify the packaged canonical chapter`);
    }
    if (!/^(?:Learner-facing )?(?:Dialogue|Narrative|Controlled Reading|Read Content)$/u.test((provenance as Record<string, unknown>).section as string)) {
      throw new Error(`${source}: characters.entries[${index}].provenance.section must identify primary reading content`);
    }
    if (!chapter.includes(entry.usage as string)) throw new Error(`${source}: characters.entries[${index}].usage is not literal primary reading evidence`);
  }
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
const geographyLedgerPath = "geography-ledger.json";
const numberProgressionPath = "number-progression.json";
const lexicalTopicsPath = "lexical-topics.json";
const lexicalTopicAuditPath = "lexical-topic-audit.json";
const sinoVietnameseLexiconPath = "sino-vietnamese-lexicon.json";
const sinoVietnameseAuditPath = "sino-vietnamese-audit.json";
const packagedCurriculumMetadataPaths = new Set([canonicalCastPath, geographyLedgerPath, numberProgressionPath, lexicalTopicsPath, lexicalTopicAuditPath, sinoVietnameseLexiconPath, sinoVietnameseAuditPath]);

async function sourceIncludesForTarget(target: ContentPackageGeneratorTarget, sourceRoot: string): Promise<readonly string[]> {
  const separatedIncludes = target.capabilities?.includes("reading-curriculum")
    ? [...(target.readingContentInclude ?? target.include.filter((include) => include === "units" || include.startsWith("units/") || include === "name-pools" || include.startsWith("name-pools/") || include === geographyLedgerPath || include === lexicalTopicsPath || include === lexicalTopicAuditPath || include === "lexical-topic-audit.md" || include === sinoVietnameseLexiconPath || include === sinoVietnameseAuditPath || include === "sino-vietnamese-audit.md"))]
    : [...target.include];
  if (target.license?.path !== undefined && target.license.path !== null && !separatedIncludes.includes(target.license.path)) separatedIncludes.push(target.license.path);
  if (target.capabilities?.includes("reading-curriculum")) {
    try { await access(resolve(sourceRoot, "NOTICE")); separatedIncludes.push("NOTICE"); } catch { /* legacy repository without notice */ }
  }
  const castAlreadyIncluded = target.include.some((include) => canonicalCastPath === include || canonicalCastPath.startsWith(`${include}/`));
  if (target.contentType !== "language-curriculum" || castAlreadyIncluded) {
    return separatedIncludes;
  }
  try {
    await access(resolve(sourceRoot, canonicalCastPath));
    return [...separatedIncludes, canonicalCastPath];
  } catch {
    return separatedIncludes;
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
  if (!isContentPackageSourceFileAllowed(relativePath)) {
    return;
  }

  const sourceBuffer = await readFile(absolutePath);
  const sourceText = sourceBuffer.toString("utf8");
  const text = /\/chapter(?:\.(?:en|zh-TW))?\.md$/u.test(relativePath)
    ? removeContentWrapperHeading(removeCompleteRereadingSection(sourceText))
    : sourceText;
  const buffer = text === sourceText ? sourceBuffer : Buffer.from(text, "utf8");
  if (relativePath === geographyLedgerPath) {
    try {
      JSON.parse(text);
    } catch (error) {
      throw new Error(`Invalid ${geographyLedgerPath}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  if (relativePath.endsWith("/reading-translation.en.json")) {
    assertNaturalEnglishTranslationHasNoIntroduction(relativePath, text);
  }
  files.push({
    path: relativePath,
    mediaType: mediaTypeForPath(relativePath),
    size: buffer.length,
    sha256: sha256Hex(buffer),
    text,
    buffer
  });
}

function assertNaturalEnglishTranslationHasNoIntroduction(path: string, text: string): void {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch (error) {
    throw new Error(`Invalid ${path}: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`Invalid ${path}: structured reading translation must be a JSON object.`);
  }
  for (const key of ["introduction", "context", "setting", "participants", "sceneIntroduction"]) {
    if (Object.prototype.hasOwnProperty.call(value, key)) {
      throw new Error(`Invalid ${path}: Natural English Translation must contain translated reading content only; prefatory field ${key} is prohibited.`);
    }
  }
}

export function isContentPackageSourceFileAllowed(path: string): boolean {
  return path.endsWith(".md")
    || path.endsWith(".tsv")
    || packagedCurriculumMetadataPaths.has(path)
    || path.endsWith("/reading-translation.en.json")
    || path.endsWith("/reading-support.json")
    || path === ".gitignore"
    || path === "LICENSE-CONTENT"
    || path === "LICENSE-SOFTWARE"
    || path === "NOTICE";
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
  evidenceFiles: readonly SourceFile[],
  generatedAt: string
): readonly GeneratedMemorizationFile[] {
  const reviewExampleIndex = buildReviewExampleIndex(target, evidenceFiles);
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

async function collectReviewEvidenceFiles(
  target: ContentPackageGeneratorTarget,
  env: Readonly<Record<string, string | undefined>> | undefined
): Promise<readonly SourceFile[]> {
  const readingPackageId = target.relatedPackageIds?.[0];
  const readingTarget = readingTargets.find((candidate) => candidate.packageId === readingPackageId && candidate.localization?.role !== "source-language-pack");
  if (readingTarget === undefined) return [];
  const resolution = resolveContentPackageSourcePath(readingTarget.sourcePath, { env });
  try {
    await access(resolution.resolvedPath);
    return collectSourceFiles(resolution.resolvedPath, await sourceIncludesForTarget(readingTarget, resolution.resolvedPath));
  } catch (error) {
    throw contentPackageSourceError(resolution, error);
  }
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
  const v2Header = ["card_id", "deck", "kind", "source_chapter", "prompt_language", "answer_language", "prompt", "accepted_answers", "distractors", "explanation", "lexical_ids", "grammar_ids", "geographic_ids", "provenance_path", "provenance_locator", "provenance_evidence", "tags"];
  const v2ExamplesHeader = [...v2Header.slice(0, -1), "examples", "tags"];
  const usesV2Rows = (header.length === v2Header.length && header.every((field, index) => field === v2Header[index]))
    || (header.length === v2ExamplesHeader.length && header.every((field, index) => field === v2ExamplesHeader[index]));
  const usesLocalizedRows = header.length === localizedHeader.length && header.every((field, index) => field === localizedHeader[index]);
  if (!usesV2Rows && !usesLocalizedRows && (header.length !== legacyHeader.length || header.some((field, index) => field !== legacyHeader[index]))) {
    throw new Error(`Review deck cards file has unsupported header: ${file.path}`);
  }

  if (usesV2Rows) {
    const items = body.map((row, index) => reviewDeckV2RowToItem(target, file.path, row, index + 1, generatedAt, header.length === v2ExamplesHeader.length));
    return { schemaVersion: 2, items };
  }

  const completeBody = ordinaryReviewRowsWithRequiredDirections(target, body, usesLocalizedRows);
  const items: MemorizationItemV1[] = completeBody.map((row, index) => reviewDeckRowToItem(target, file.path, row, index + 1, generatedAt, reviewExampleIndex, usesLocalizedRows) as MemorizationItemV1);
  return { schemaVersion: 1, items };
}

function ordinaryReviewRowsWithRequiredDirections(
  target: ContentPackageGeneratorTarget,
  rows: readonly (readonly string[])[],
  localizedRows: boolean
): readonly (readonly string[])[] {
  if (/^(?:chinese-|japanese-)/u.test(target.id)) return rows;
  const targetLanguage = target.targetLanguage ?? target.languages?.find((language) => language !== "en") ?? "en";
  const seen = new Map<string, { targetToSource: boolean; sourceToTarget: boolean; row: readonly string[] }>();
  for (const row of rows) {
    const direction = row[1]?.match(/^(.+?) -> (.+?)$/u);
    if (direction === null || direction === undefined) continue;
    const promptLanguage = languageCodeForReviewLabel(direction[1]);
    const answerLanguage = languageCodeForReviewLabel(direction[2]);
    const targetToSource = promptLanguage === targetLanguage && answerLanguage !== targetLanguage;
    const sourceToTarget = answerLanguage === targetLanguage && promptLanguage !== targetLanguage;
    if (!targetToSource && !sourceToTarget) continue;
    const targetForm = decodeReviewDeckField(row[targetToSource ? 2 : 3] ?? "");
    const key = `${row[0]}\0${targetForm}`;
    const record = seen.get(key) ?? { targetToSource: false, sourceToTarget: false, row };
    record.targetToSource ||= targetToSource;
    record.sourceToTarget ||= sourceToTarget;
    if (targetToSource) record.row = row;
    seen.set(key, record);
  }
  const additions: readonly string[][] = [...seen.values()].flatMap((record) => {
    if (record.targetToSource === record.sourceToTarget) return [];
    const row = [...record.row];
    const direction = row[1]?.match(/^(.+?) -> (.+?)$/u);
    if (direction === null || direction === undefined) return [];
    row[1] = `${direction[2]} -> ${direction[1]}`;
    [row[2], row[3]] = [row[3] ?? "", row[2] ?? ""];
    if (localizedRows) {
      [row[4], row[5]] = [row[5] ?? "", row[4] ?? ""];
      [row[6], row[7]] = [row[7] ?? "", row[6] ?? ""];
    }
    return [row];
  });
  return [...rows, ...additions];
}

function reviewDeckV2RowToItem(
  target: ContentPackageGeneratorTarget,
  sourcePath: string,
  row: readonly string[],
  rowNumber: number,
  generatedAt: string,
  includesExamples: boolean
): MemorizationItemV2 {
  if (row.length !== (includesExamples ? 18 : 17)) throw new Error(`Review deck v2 row ${rowNumber + 1} has the wrong number of tab-separated fields in ${sourcePath}`);
  const [cardId, deckTitle, kind, chapterText, promptLanguage, answerLanguage, prompt, acceptedJson, distractorsJson,
    explanation, lexicalJson, grammarJson, geographicJson, provenancePath, provenanceLocator, provenanceEvidence] = row;
  const examples = includesExamples
    ? parseV2StringArray(row[16] ?? "", "examples", sourcePath, rowNumber)
    : [provenanceEvidence];
  const tagsJson = row[includesExamples ? 17 : 16] ?? "";
  const range = deckTitle.match(/^Chapter (\d+)-(\d+)$/u);
  if (range === null) throw new Error(`Review deck v2 row ${rowNumber + 1} has an invalid five-chapter deck title: ${deckTitle}`);
  const chapterStart = Number.parseInt(range[1], 10);
  const chapterEnd = Number.parseInt(range[2], 10);
  const sourceChapter = Number.parseInt(chapterText, 10);
  const acceptedAnswers = parseV2StringArray(acceptedJson, "accepted_answers", sourcePath, rowNumber);
  const distractors = parseV2StringArray(distractorsJson, "distractors", sourcePath, rowNumber);
  const testedLexicalIds = parseV2StringArray(lexicalJson, "lexical_ids", sourcePath, rowNumber);
  const testedGrammarIds = parseV2StringArray(grammarJson, "grammar_ids", sourcePath, rowNumber);
  const testedGeographicIds = parseV2StringArray(geographicJson, "geographic_ids", sourcePath, rowNumber);
  const tags = parseV2StringArray(tagsJson, "tags", sourcePath, rowNumber);
  if (!Number.isSafeInteger(sourceChapter) || sourceChapter < chapterStart || sourceChapter > chapterEnd) {
    throw new Error(`Review deck v2 row ${rowNumber + 1} source chapter is outside its deck block in ${sourcePath}`);
  }
  const reviewDirection = `${promptLanguage}-to-${answerLanguage}`;
  const targetLanguage = target.targetLanguage ?? target.languages?.find((language) => language !== "en") ?? answerLanguage;
  const sourceLanguage = target.languages?.find((language) => language !== targetLanguage) ?? "en";
  if (target.capabilities?.includes("core-review")) {
    if (kind !== "vocabulary") throw new Error(`Normal core review row ${rowNumber + 1} must be a vocabulary card in ${sourcePath}`);
    const targetToSource = promptLanguage === targetLanguage && answerLanguage === sourceLanguage;
    const sourceToTarget = promptLanguage === sourceLanguage && answerLanguage === targetLanguage;
    const japaneseReadingToTarget = targetLanguage === "ja" && promptLanguage === "ja-Kana" && answerLanguage === "ja";
    if (!targetToSource && !sourceToTarget && !japaneseReadingToTarget) {
      throw new Error(`Normal core review row ${rowNumber + 1} has an unsupported review direction in ${sourcePath}`);
    }
    if (distractors.length > 0) throw new Error(`Normal core review row ${rowNumber + 1} must not contain distractors in ${sourcePath}`);
    if (testedLexicalIds.length === 0) throw new Error(`Normal core review row ${rowNumber + 1} must identify its canonical lexical item in ${sourcePath}`);
    if (testedGrammarIds.length > 0) throw new Error(`Normal core review row ${rowNumber + 1} must not test grammar in ${sourcePath}`);
  }
  const deckId = `${targetLanguage}-core-review-${String(chapterStart).padStart(3, "0")}-${String(chapterEnd).padStart(3, "0")}`;
  const item: MemorizationItemV2 = {
    schemaVersion: 2,
    id: cardId,
    cardId,
    pedagogicalFingerprint: "0".repeat(64),
    kind: kind as MemorizationItemV2["kind"],
    deck: { id: deckId, title: deckTitle, chapterStart, chapterEnd },
    sourceChapters: [sourceChapter],
    reviewDirection,
    prompt: { text: prompt, plainText: prompt, language: promptLanguage, mediaType: "text/plain" },
    answer: { text: acceptedAnswers[0] ?? "", plainText: acceptedAnswers[0] ?? "", language: answerLanguage, mediaType: "text/plain" },
    acceptedAnswers,
    distractors,
    explanation,
    testedMeaning: acceptedAnswers.join(" | "),
    testedLexicalIds,
    testedGrammarIds,
    testedGeographicIds,
    testedCastIds: [],
    testedSkillIds: [],
    provenance: { path: provenancePath, locator: provenanceLocator, evidence: provenanceEvidence },
    examples,
    notes: explanation,
    tags,
    source: { path: sourcePath, title: deckTitle },
    language: { target: targetLanguage, base: "en", script: scriptLabelForTarget(target) },
    createdAt: generatedAt,
    updatedAt: generatedAt
  };
  return { ...item, pedagogicalFingerprint: pedagogicalFingerprint(pedagogicalContentForMemorizationItem(item)) };
}

function parseV2StringArray(value: string, field: string, sourcePath: string, rowNumber: number): string[] {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed) || parsed.some((entry) => typeof entry !== "string")) throw new Error("not a string array");
    return parsed;
  } catch (error) {
    throw new Error(`Review deck v2 row ${rowNumber + 1} ${field} must be a JSON string array in ${sourcePath}: ${error instanceof Error ? error.message : String(error)}`);
  }
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
  const missingSourceExample = target.capabilities?.includes("core-review") && isCoreReviewDeckRow(sourceChapter) && examples.length === 0;
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
    tags: [slugForPath(curriculumIdentityTargetId(target)), "review-deck", deckSlug, entrySlug, ...(missingSourceExample ? ["missing-source-example"] : [])],
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
      || /^###\s+(?:Dialogue|Narrative|Learner-facing Dialogue|Controlled Reading|New Vocabulary|New Grammar|New Grammar \/ Pattern|Hanja|Usage Notes|.* Usage Notes|Register|Register \/ Regional Notes|Register and Context Notes|Model Mini Dialogue|Model Mini Text)\b/iu.test(trimmed)) {
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
  let readContentKind: "dialogue" | "narrative" | undefined;
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
    if (/^#{2,4}\s+(?:Dialogue|Narrative|對話(?: \/ Learner-facing Dialogue)?|閱讀短文(?: \/ Learner-facing Controlled Reading)?|Model Dialogue|Model Mini Dialogue|Model Mini Text|Learner-facing Dialogue|Learner-facing Controlled Reading|Controlled Reading)(?:\b|$)/iu.test(trimmed)) {
      inReadContentSection = true;
      readContentKind = /(?:Dialogue|對話)/iu.test(trimmed) ? "dialogue" : "narrative";
      continue;
    }
    if (/^#{2,4}\s+/u.test(trimmed)) {
      inReadContentSection = false;
      readContentKind = undefined;
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
    const normalized = normalizeExampleSourceLine(rawLine);
    const lines = normalized === undefined
      ? []
      : readContentKind === "dialogue"
        ? [normalized.replace(/^[^:]{1,40}?\s*:\s+/u, "")]
        : splitExampleSentences(normalized);
    for (const line of lines) {
      if (examples.includes(line)) {
        continue;
      }
      examples.push(line);
    }
  }
  return examples;
}

function splitExampleSentences(text: string): readonly string[] {
  return [...new Intl.Segmenter(undefined, { granularity: "sentence" }).segment(text)]
    .map(({ segment }) => segment.trim())
    .filter((segment) => segment.length > 0);
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
  return target.contentType === "language-curriculum" || target.contentType === "core-review";
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
  _target: ContentPackageGeneratorTarget,
  direction: string,
  _promptLabel: string,
  _answerLabel: string
): string {
  return slugForPath(direction);
}

function scriptLabelForTarget(target: ContentPackageGeneratorTarget): string {
  const targetLanguage = target.targetLanguage ?? target.languages?.find((language) => language !== "en");
  const scriptByLanguage: Readonly<Record<string, string>> = {
    ar: "Arabic", de: "Latin", es: "Latin", fr: "Latin", hi: "Devanagari", ja: "Japanese",
    ko: "Hangul", nl: "Latin", ru: "Cyrillic", th: "Thai", vi: "Latin", zu: "Latin"
  };
  if (targetLanguage !== undefined && scriptByLanguage[targetLanguage] !== undefined) return scriptByLanguage[targetLanguage];
  switch (curriculumIdentityTargetId(target)) {
    case "vietnamese-curriculum":
      return "Vietnamese";
    case "dutch-curriculum":
      return "Dutch";
    default:
      return "text";
  }
}

function curriculumIdentityTargetId(target: ContentPackageGeneratorTarget): string {
  if (!target.capabilities?.includes("core-review")) return target.id;
  const relatedId = target.relatedPackageIds?.[0];
  return legacyGeneratorTargets.find(candidate => candidate.packageId === relatedId)?.id ?? target.id;
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

export function resolveContentPackageSourcePath(sourcePath: string, options: {
  readonly sourceRoot?: string;
  readonly repositoryRoot?: string;
  readonly env?: Readonly<Record<string, string | undefined>>;
} = {}): ContentPackageSourceResolution {
  const baseRepositoryRoot = resolve(options.repositoryRoot ?? repositoryRoot);
  if (isAbsolute(sourcePath)) {
    return { configuredPath: sourcePath, resolvedPath: resolve(sourcePath), sourceRootSelection: "absolute sourcePath" };
  }
  const env = options.env ?? process.env;
  const optionProvided = options.sourceRoot !== undefined;
  const environmentProvided = Object.prototype.hasOwnProperty.call(env, contentPackageSourceRootEnvironmentVariable);
  const configuredRoot = optionProvided ? options.sourceRoot : environmentProvided ? env[contentPackageSourceRootEnvironmentVariable] : undefined;
  if (configuredRoot !== undefined) {
    if (configuredRoot.trim().length === 0) {
      const selection = optionProvided ? "explicit sourceRoot option" : `${contentPackageSourceRootEnvironmentVariable} environment variable`;
      throw new Error(`Content package source root selected by ${selection} must not be empty. Configured source path: "${sourcePath}".`);
    }
    const resolvedRoot = resolve(baseRepositoryRoot, configuredRoot);
    const pathBelowRoot = sourcePath.replace(/^(?:\.\.\/)+/u, "").replace(/^\.\//u, "");
    return {
      configuredPath: sourcePath,
      resolvedPath: resolve(resolvedRoot, pathBelowRoot),
      sourceRootSelection: optionProvided
        ? `explicit sourceRoot option "${configuredRoot}"`
        : `${contentPackageSourceRootEnvironmentVariable} environment variable "${configuredRoot}"`
    };
  }
  return {
    configuredPath: sourcePath,
    resolvedPath: resolve(baseRepositoryRoot, sourcePath),
    sourceRootSelection: `legacy process working directory "${baseRepositoryRoot}"`
  };
}

function contentPackageSourceError(resolution: ContentPackageSourceResolution, cause: unknown): Error {
  const detail = cause instanceof Error ? cause.message : String(cause);
  return new Error(
    `Content package source could not be read. Configured source path: "${resolution.configuredPath}". ` +
    `Resolved source path: "${resolution.resolvedPath}". Source root selection: ${resolution.sourceRootSelection}. Cause: ${detail}`
  );
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
