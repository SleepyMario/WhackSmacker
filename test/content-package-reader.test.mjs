import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { test } from "node:test";

import {
  generateContentPackage,
  generateLocalContentPackageCatalogue,
  installContentPackage,
  listInstalledContentPackages,
  listInstalledMemorizationItemFiles,
  listInstalledReadablePackages,
  listReadableContentEntries,
  listReadingReviewItems,
  listReadingReviewSources,
  readInstalledContentEntry,
  readInstalledMemorizationItems,
  renderReadingContent
} from "../dist/packages/core/index.js";

test("installed readable packages are discovered from the registry", async () => {
  const fixture = await createInstalledReadingFixture();
  try {
    const packages = await listInstalledReadablePackages(fixture.dataDir);

    assert.deepEqual(packages.map((item) => item.packageId), ["com.sleepymario.language.korean"]);
  } finally {
    await fixture.cleanup();
  }
});

test("readable entries are listed from the installed source snapshot", async () => {
  const fixture = await createInstalledReadingFixture();
  try {
    const entries = await listReadableContentEntries("com.sleepymario.language.korean", fixture.dataDir);

    assert.ok(entries.some((entry) => entry.path === "README.md"));
    assert.ok(entries.some((entry) => entry.path === "units/introduction-to-hangul/README.md"));
    assert.equal(entries.every((entry) => entry.source === "snapshot"), true);
  } finally {
    await fixture.cleanup();
  }
});

test("installed content entry can be read and rendered", async () => {
  const fixture = await createInstalledReadingFixture();
  try {
    const result = await readInstalledContentEntry({
      dataDir: fixture.dataDir,
      packageId: "com.sleepymario.language.korean",
      path: "units/introduction-to-hangul/README.md"
    });
    const rendered = renderReadingContent(result);

    assert.equal(result.entry.mediaType, "text/markdown");
    assert.match(result.text, /Introduction to Hangul/);
    assert.match(rendered, /Korean Curriculum/);
    assert.match(rendered, /units\/introduction-to-hangul\/README\.md/);
  } finally {
    await fixture.cleanup();
  }
});

test("reader rejects unsafe requested paths", async () => {
  const fixture = await createInstalledReadingFixture();
  try {
    await assert.rejects(
      () =>
        readInstalledContentEntry({
          dataDir: fixture.dataDir,
          packageId: "com.sleepymario.language.korean",
          path: "../registry.json"
        }),
      /path must be package-relative and safe/
    );
  } finally {
    await fixture.cleanup();
  }
});

test("reading installed content does not write progress into package directories", async () => {
  const fixture = await createInstalledReadingFixture();
  try {
    await readInstalledContentEntry({
      dataDir: fixture.dataDir,
      packageId: "com.sleepymario.language.korean",
      path: "README.md"
    });

    await assert.rejects(() => stat(join(fixture.dataDir, "packages", "com.sleepymario.language.korean", "0.1.0", "progress.json")), /ENOENT/);
    await assert.rejects(() => stat(join(fixture.dataDir, "progress.json")), /ENOENT/);
  } finally {
    await fixture.cleanup();
  }
});

test("content read CLI lists packages files and renders selected content", async () => {
  const fixture = await createInstalledReadingFixture();
  try {
    const packages = await runCli(["content", "read", "--data-dir", fixture.dataDir]);
    const files = await runCli(["content", "files", "com.sleepymario.language.korean", "--data-dir", fixture.dataDir]);
    const rendered = await runCli([
      "content",
      "read",
      "com.sleepymario.language.korean",
      "--file",
      "units/introduction-to-hangul/README.md",
      "--data-dir",
      fixture.dataDir
    ]);

    assert.match(packages.stdout, /Readable content packages:/);
    assert.match(files.stdout, /units\/introduction-to-hangul\/README\.md/);
    assert.match(rendered.stdout, /Introduction to Hangul/);
  } finally {
    await fixture.cleanup();
  }
});

test("installed Korean package exposes Chapter 15 and split vocabulary review decks", async () => {
  const fixture = await createInstalledReadingFixture();
  try {
    const expectedReviewDecks = [
      {
        title: "Chapter 1-5",
        sourcePath: "review-decks/chapter-001-005/cards.tsv",
        itemPath: "content/memorization/review-decks/chapter-001-005.json",
        itemCount: 78
      },
      {
        title: "Chapter 6-10",
        sourcePath: "review-decks/chapter-006-010/cards.tsv",
        itemPath: "content/memorization/review-decks/chapter-006-010.json",
        itemCount: 84
      },
      {
        title: "Chapter 11-15",
        sourcePath: "review-decks/chapter-011-015/cards.tsv",
        itemPath: "content/memorization/review-decks/chapter-011-015.json",
        itemCount: 84
      }
    ];
    const installed = await listInstalledContentPackages(fixture.dataDir);
    const entries = await listReadableContentEntries("com.sleepymario.language.korean", fixture.dataDir);
    const chapter20 = await readInstalledContentEntry({
      dataDir: fixture.dataDir,
      packageId: "com.sleepymario.language.korean",
      path: "units/korean-core/chapter-015-basic-life-sentences-15/chapter.md"
    });
    const itemFiles = await listInstalledMemorizationItemFiles("com.sleepymario.language.korean", fixture.dataDir);
    const sources = await listReadingReviewSources({
      dataDir: fixture.dataDir,
      packageId: "com.sleepymario.language.korean"
    });

    assert.deepEqual(installed.map((record) => record.packageId), ["com.sleepymario.language.korean"]);
    assert.ok(entries.some((entry) => entry.path === "units/korean-core/chapter-015-basic-life-sentences-15/chapter.md"));
    for (const deck of expectedReviewDecks) {
      assert.ok(entries.some((entry) => entry.path === deck.sourcePath));
    }
    assert.equal(entries.some((entry) => entry.path === "review-decks/chapter-001-020/cards.tsv"), false);
    assert.equal(entries.some((entry) => entry.path === "review-decks/chapter-008-010/cards.tsv"), false);
    assert.equal(entries.some((entry) => entry.path === "review-decks/chapter-016-020/cards.tsv"), false);
    assert.match(chapter20.text, /Chapter 15 -- Basic Life Sentences XV/);
    assert.deepEqual(
      itemFiles.map((file) => file.path),
      expectedReviewDecks.map((deck) => deck.itemPath)
    );

    const allItems = [];
    for (const deck of expectedReviewDecks) {
      const deckSource = await readInstalledContentEntry({
        dataDir: fixture.dataDir,
        packageId: "com.sleepymario.language.korean",
        path: deck.sourcePath
      });
      const collection = await readInstalledMemorizationItems("com.sleepymario.language.korean", deck.itemPath, fixture.dataDir);
      const items = await listReadingReviewItems({
        dataDir: fixture.dataDir,
        packageId: "com.sleepymario.language.korean",
        sourcePath: deck.sourcePath
      });

      assert.match(deckSource.text, new RegExp(`^${deck.title}\\t`, "m"));
      assert.equal(collection.items.length, deck.itemCount);
      assert.equal(sources.some((source) => source.sourcePath === deck.sourcePath && source.title === deck.title), true);
      assert.equal(items.length, deck.itemCount);
      allItems.push(...items);
    }

    assert.equal(sources.some((source) => source.sourcePath === "review-decks/chapter-001-020/cards.tsv" || source.title === "Chapter 1-20"), false);
    assert.equal(sources.some((source) => source.sourcePath === "review-decks/chapter-008-010/cards.tsv" || source.title === "Chapter 8-10"), false);
    assert.equal(sources.some((source) => source.sourcePath === "review-decks/chapter-016-020/cards.tsv" || source.title === "Chapter 16-20"), false);
    assert.ok(allItems.some((item) => item.item.prompt.text === "안녕하세요" && item.item.answer.text === "hello"));
    assert.ok(allItems.some((item) => item.item.prompt.text === "hello" && item.item.answer.text === "안녕하세요"));
    assert.ok(allItems.some((item) => item.item.prompt.text === "은/는" && item.item.answer.text === "topic particle"));
    assert.ok(allItems.some((item) => item.item.prompt.text === "subject/existence marker" && item.item.answer.text === "이/가"));

    const forbiddenPatterns = [
      "저는 N입니다",
      "제 이름은 N입니다",
      "N입니까?",
      "N이에요/예요",
      "N이에요/예요?",
      "N이야/야",
      "N이야/야?",
      "N이다",
      "N인가?",
      "N이/가 있습니다",
      "N이/가 없습니다",
      "N이/가 있어요",
      "N이/가 없어요",
      "N이/가 있어",
      "N이/가 없어"
    ];
    assert.equal(
      allItems.some((item) => forbiddenPatterns.includes(item.item.prompt.text) || forbiddenPatterns.includes(item.item.answer.text)),
      false
    );
  } finally {
    await fixture.cleanup();
  }
});

test("installed Korean Chinese Vietnamese and Dutch packages expose expected reading and review sources", async () => {
  const fixture = await createInstalledLanguagePackageFixture();
  try {
    const installed = await listInstalledContentPackages(fixture.dataDir);
    const reviewSources = await listReadingReviewSources({ dataDir: fixture.dataDir });
    const koreanChapter20 = await readInstalledContentEntry({
      dataDir: fixture.dataDir,
      packageId: "com.sleepymario.language.korean",
      path: "units/korean-core/chapter-015-basic-life-sentences-15/chapter.md"
    });
    const vietnameseChapter5 = await readInstalledContentEntry({
      dataDir: fixture.dataDir,
      packageId: "com.sleepymario.language.vietnamese",
      path: "units/vietnamese-core/chapter-005-basic-sentences-5/chapter.md"
    });
    const chineseDeck = await readInstalledContentEntry({
      dataDir: fixture.dataDir,
      packageId: "com.sleepymario.language.chinese",
      path: "review-decks/pinyin-zhuyin/cards.tsv"
    });
    const dutchChapter5 = await readInstalledContentEntry({
      dataDir: fixture.dataDir,
      packageId: "com.sleepymario.language.dutch",
      path: "units/dutch-core/chapter-005-basic-sentences-5/chapter.md"
    });

    assert.deepEqual(
      installed.map((record) => [record.packageId, record.displayName]).sort(),
      [
        ["com.sleepymario.language.chinese", "Chinese - Mandarin"],
        ["com.sleepymario.language.dutch", "Dutch"],
        ["com.sleepymario.language.korean", "Korean Curriculum"],
        ["com.sleepymario.language.vietnamese", "Vietnamese Curriculum"]
      ]
    );
    assert.match(koreanChapter20.text, /Chapter 15 -- Basic Life Sentences XV/);
    assert.match(vietnameseChapter5.text, /Chapter 5 -- Basic Sentences V/);
    assert.match(chineseDeck.text, /^Pinyin-Zhuyin\tPinyin -> Zhuyin\tb\tㄅ/m);
    assert.match(dutchChapter5.text, /Chapter 5 -- Basic Sentences V/);

    const koreanSources = reviewSources.filter((source) => source.packageId === "com.sleepymario.language.korean");
    assert.deepEqual(
      koreanSources.map((source) => [source.title, source.sourcePath]).sort(),
      [
        ["Chapter 1-5", "review-decks/chapter-001-005/cards.tsv"],
        ["Chapter 11-15", "review-decks/chapter-011-015/cards.tsv"],
        ["Chapter 6-10", "review-decks/chapter-006-010/cards.tsv"]
      ]
    );
    assert.equal(reviewSources.some((source) => source.title === "Chapter 1-20"), false);
    assert.equal(reviewSources.some((source) => source.title === "Chapter 8-10"), false);
    assert.equal(reviewSources.some((source) => source.title === "Chapter 16-20"), false);
    assert.equal(reviewSources.some((source) => source.title === "Lessons 1-5"), false);

    const chineseSources = reviewSources.filter((source) => source.packageId === "com.sleepymario.language.chinese");
    assert.deepEqual(chineseSources.map((source) => source.title).sort(), ["Pinyin-Zhuyin", "Pinyin-Zhuyin with Tones"]);

    const vietnameseItems = await listReadingReviewItems({
      dataDir: fixture.dataDir,
      packageId: "com.sleepymario.language.vietnamese",
      sourcePath: "review-decks/chapter-001-005/cards.tsv"
    });
    assert.equal(vietnameseItems.length, 80);
    assert.ok(vietnameseItems.some((item) => item.item.prompt.text === "xin chào" && item.item.answer.text === "hello"));
    assert.ok(vietnameseItems.some((item) => item.item.prompt.text === "hello" && item.item.answer.text === "xin chào"));

    const dutchSources = reviewSources.filter((source) => source.packageId === "com.sleepymario.language.dutch");
    assert.deepEqual(dutchSources.map((source) => [source.title, source.sourcePath]), [["Chapter 1-5", "review-decks/chapter-001-005/cards.tsv"]]);
    const dutchItems = await listReadingReviewItems({
      dataDir: fixture.dataDir,
      packageId: "com.sleepymario.language.dutch",
      sourcePath: "review-decks/chapter-001-005/cards.tsv"
    });
    assert.equal(dutchItems.length, 80);
    assert.ok(dutchItems.some((item) => item.item.prompt.text === "hallo" && item.item.answer.text === "hello"));
    assert.ok(dutchItems.some((item) => item.item.prompt.text === "hello" && item.item.answer.text === "hallo"));

    const forbiddenPatterns = [
      "저는 N입니다",
      "제 이름은 N입니다",
      "N입니까?",
      "N이에요/예요",
      "N이에요/예요?",
      "N이야/야",
      "N이야/야?",
      "N이다",
      "N인가?",
      "N이/가 있습니다",
      "N이/가 없습니다",
      "N이/가 있어요",
      "N이/가 없어요",
      "N이/가 있어",
      "N이/가 없어",
      "Tôi là N",
      "Tên tôi là N",
      "Đây là N",
      "Đây có phải là N không?",
      "Có N",
      "Ik ben N",
      "Mijn naam is N",
      "Dit is N",
      "Is dit N?",
      "Er is N"
    ];
    const koreanVietnameseAndDutchItemFiles = [
      ...(await listInstalledMemorizationItemFiles("com.sleepymario.language.korean", fixture.dataDir)),
      ...(await listInstalledMemorizationItemFiles("com.sleepymario.language.vietnamese", fixture.dataDir)),
      ...(await listInstalledMemorizationItemFiles("com.sleepymario.language.dutch", fixture.dataDir))
    ];
    for (const file of koreanVietnameseAndDutchItemFiles) {
      const collection = await readInstalledMemorizationItems(file.packageId, file.path, fixture.dataDir);
      assert.equal(
        collection.items.some((item) => forbiddenPatterns.includes(item.prompt.text) || forbiddenPatterns.includes(item.answer.text)),
        false
      );
    }

    await assert.rejects(
      () => stat(join(fixture.dataDir, "packages", "com.sleepymario.language.vietnamese", "0.1.0", "progress.json")),
      /ENOENT/
    );
    await assert.rejects(
      () => stat(join(fixture.dataDir, "packages", "com.sleepymario.language.chinese", "0.1.0", "progress.json")),
      /ENOENT/
    );
    await assert.rejects(
      () => stat(join(fixture.dataDir, "packages", "com.sleepymario.language.dutch", "0.1.0", "progress.json")),
      /ENOENT/
    );
  } finally {
    await fixture.cleanup();
  }
});

async function createInstalledReadingFixture() {
  const root = await mkdtemp(join(tmpdir(), "wsm-content-reader-"));
  const packageDirectory = join(root, "packages");
  const cataloguePath = join(root, "catalogue", "catalogue.json");
  const dataDir = join(root, "data", "content");
  await generateContentPackage({
    targetId: "korean-curriculum",
    outputDirectory: packageDirectory,
    generatedAt: "2026-07-06T00:00:00Z"
  });
  await generateLocalContentPackageCatalogue({
    packagesDirectory: packageDirectory,
    outputPath: cataloguePath,
    generatedAt: "2026-07-06T00:00:00Z"
  });
  await installContentPackage({
    cataloguePath,
    dataDir,
    packageId: "com.sleepymario.language.korean",
    installedAt: "2026-07-06T00:00:00Z"
  });

  return {
    root,
    dataDir,
    cleanup: () => rm(root, { recursive: true, force: true })
  };
}

async function createInstalledLanguagePackageFixture() {
  const root = await mkdtemp(join(tmpdir(), "wsm-language-packages-"));
  const packageDirectory = join(root, "packages");
  const cataloguePath = join(root, "catalogue", "catalogue.json");
  const dataDir = join(root, "data", "content");
  for (const targetId of ["korean-curriculum", "chinese-curriculum", "vietnamese-curriculum", "dutch-curriculum"]) {
    await generateContentPackage({
      targetId,
      outputDirectory: packageDirectory,
      generatedAt: "2026-07-06T00:00:00Z"
    });
  }
  await generateLocalContentPackageCatalogue({
    packagesDirectory: packageDirectory,
    outputPath: cataloguePath,
    generatedAt: "2026-07-06T00:00:00Z"
  });
  for (const packageId of [
    "com.sleepymario.language.korean",
    "com.sleepymario.language.chinese",
    "com.sleepymario.language.vietnamese",
    "com.sleepymario.language.dutch"
  ]) {
    await installContentPackage({
      cataloguePath,
      dataDir,
      packageId,
      installedAt: "2026-07-06T00:00:00Z"
    });
  }

  return {
    root,
    dataDir,
    cleanup: () => rm(root, { recursive: true, force: true })
  };
}

async function runCli(args) {
  const child = spawn(process.execPath, ["dist/main.js", ...args], { cwd: process.cwd(), stdio: ["ignore", "pipe", "pipe"] });
  let stdout = "";
  let stderr = "";
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => {
    stdout += chunk;
  });
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
  });
  const exitCode = await new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("close", resolve);
  });
  assert.equal(exitCode, 0, stderr);
  return { stdout, stderr };
}
