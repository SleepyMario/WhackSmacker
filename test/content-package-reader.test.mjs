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

test("installed Korean Chinese Japanese Vietnamese Dutch German French and Spanish packages expose expected reading and review sources", async () => {
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
      packageId: "com.sleepymario.language.chinese.mandarin.traditional",
      path: "review-decks/pinyin-zhuyin/cards.tsv"
    });
    const chineseTraditionalPinyinIntro = await readInstalledContentEntry({
      dataDir: fixture.dataDir,
      packageId: "com.sleepymario.language.chinese.mandarin.traditional",
      path: "units/mandarin-traditional/introduction-to-hanyu-pinyin/chapter.md"
    });
    const chineseTraditionalChapter1 = await readInstalledContentEntry({
      dataDir: fixture.dataDir,
      packageId: "com.sleepymario.language.chinese.mandarin.traditional",
      path: "units/mandarin-traditional/chapter-001-basic-sentences-1/chapter.md"
    });
    const chineseSimplifiedPinyinIntro = await readInstalledContentEntry({
      dataDir: fixture.dataDir,
      packageId: "com.sleepymario.language.chinese.mandarin.simplified",
      path: "units/mandarin-simplified/introduction-to-hanyu-pinyin/chapter.md"
    });
    const chineseSimplifiedChapter1 = await readInstalledContentEntry({
      dataDir: fixture.dataDir,
      packageId: "com.sleepymario.language.chinese.mandarin.simplified",
      path: "units/mandarin-simplified/chapter-001-basic-sentences-1/chapter.md"
    });
    const japaneseHiragana = await readInstalledContentEntry({
      dataDir: fixture.dataDir,
      packageId: "com.sleepymario.language.japanese",
      path: "units/introduction-to-japanese-writing/hiragana/chapter.md"
    });
    const japaneseChapter1 = await readInstalledContentEntry({
      dataDir: fixture.dataDir,
      packageId: "com.sleepymario.language.japanese",
      path: "units/japanese-core/chapter-001-basic-sentences-1/chapter.md"
    });
    const dutchChapter5 = await readInstalledContentEntry({
      dataDir: fixture.dataDir,
      packageId: "com.sleepymario.language.dutch",
      path: "units/dutch-core/chapter-005-basic-sentences-5/chapter.md"
    });
    const germanChapter1 = await readInstalledContentEntry({
      dataDir: fixture.dataDir,
      packageId: "com.sleepymario.language.german",
      path: "units/german-core/chapter-001-basic-sentences-1/chapter.md"
    });
    const germanChapter5 = await readInstalledContentEntry({
      dataDir: fixture.dataDir,
      packageId: "com.sleepymario.language.german",
      path: "units/german-core/chapter-005-basic-sentences-5/chapter.md"
    });
    const frenchChapter1 = await readInstalledContentEntry({
      dataDir: fixture.dataDir,
      packageId: "com.sleepymario.language.french",
      path: "units/french-core/chapter-001-basic-sentences-1/chapter.md"
    });
    const spanishChapter1 = await readInstalledContentEntry({
      dataDir: fixture.dataDir,
      packageId: "com.sleepymario.language.spanish",
      path: "units/spanish-core/chapter-001-basic-sentences-1/chapter.md"
    });

    assert.deepEqual(
      installed.map((record) => [record.packageId, record.displayName]).sort(),
      [
        ["com.sleepymario.language.chinese.mandarin.simplified", "Chinese - Mandarin (Simplified)"],
        ["com.sleepymario.language.chinese.mandarin.traditional", "Chinese - Mandarin (Traditional)"],
        ["com.sleepymario.language.dutch", "Dutch"],
        ["com.sleepymario.language.french", "French"],
        ["com.sleepymario.language.german", "German"],
        ["com.sleepymario.language.japanese", "Japanese"],
        ["com.sleepymario.language.korean", "Korean Curriculum"],
        ["com.sleepymario.language.spanish", "Spanish"],
        ["com.sleepymario.language.vietnamese", "Vietnamese Curriculum"]
      ]
    );
    assert.match(koreanChapter20.text, /Chapter 15 -- Basic Life Sentences XV/);
    assert.match(vietnameseChapter5.text, /Chapter 5 -- Basic Sentences V/);
    assert.match(chineseDeck.text, /^Pinyin-Zhuyin\tPinyin -> Zhuyin\tb\tㄅ/m);
    assert.match(chineseTraditionalPinyinIntro.text, /Hanyu Pinyin is the standard romanization system/);
    assert.match(chineseTraditionalChapter1.text, /我是Alex Chen/);
    assert.match(chineseTraditionalChapter1.text, /我是林雅婷/);
    assert.match(chineseTraditionalChapter1.text, /我是學生/);
    assert.match(chineseTraditionalChapter1.text, /\| 學生 \| xuéshēng \| ㄒㄩㄝˊ ㄕㄥ \| student \|/);
    assert.match(chineseTraditionalChapter1.text, /Pinyin: Wǒ shì Lín Yǎtíng\./);
    assert.match(chineseTraditionalChapter1.text, /Meaning: I am Lin Yating\./);
    assert.doesNotMatch(chineseTraditionalChapter1.text, /\$\{|FOREIGN-NAME|LOCAL-NAME/);
    assert.match(chineseSimplifiedPinyinIntro.text, /Hanyu Pinyin is the standard romanization system/);
    assert.match(chineseSimplifiedChapter1.text, /我是Alex Chen/);
    assert.match(chineseSimplifiedChapter1.text, /我是林雅婷/);
    assert.match(chineseSimplifiedChapter1.text, /我是学生/);
    assert.match(chineseSimplifiedChapter1.text, /\| 学生 \| xuéshēng \| student \|/);
    assert.doesNotMatch(chineseSimplifiedChapter1.text, /\$\{|FOREIGN-NAME|LOCAL-NAME|ㄒㄩㄝˊ/);
    assert.match(japaneseHiragana.text, /future work/);
    assert.match(japaneseChapter1.text, /アレックスです/);
    assert.match(japaneseChapter1.text, /さくらです/);
    assert.match(japaneseChapter1.text, /学生（がくせい）/);
    assert.match(japaneseChapter1.text, /Meaning: I am a student\./);
    assert.doesNotMatch(japaneseChapter1.text, /\$\{|FOREIGN-NAME|LOCAL-NAME/);
    assert.match(dutchChapter5.text, /Chapter 5 -- Basic Sentences V/);
    assert.match(germanChapter1.text, /Chapter 1 -- Basic Sentences I/);
    assert.match(germanChapter1.text, /Ich bin Alex Chen/);
    assert.match(germanChapter1.text, /Ich bin Lena Müller/);
    assert.match(germanChapter5.text, /Chapter 5 -- Basic Sentences V/);
    assert.match(frenchChapter1.text, /Je suis Alex Chen/);
    assert.match(frenchChapter1.text, /Je suis Camille Martin/);
    assert.match(spanishChapter1.text, /Soy Alex Chen/);
    assert.match(spanishChapter1.text, /Soy Lucía García/);

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

    const chineseTraditionalSources = reviewSources.filter((source) => source.packageId === "com.sleepymario.language.chinese.mandarin.traditional");
    assert.deepEqual(chineseTraditionalSources.map((source) => source.title).sort(), ["Pinyin-Zhuyin", "Pinyin-Zhuyin with Tones"]);
    assert.equal(chineseTraditionalSources.some((source) => source.title === "Chapter 1-5" || source.sourcePath === "review-decks/chapter-001-005/cards.tsv"), false);
    const chineseSimplifiedSources = reviewSources.filter((source) => source.packageId === "com.sleepymario.language.chinese.mandarin.simplified");
    assert.deepEqual(chineseSimplifiedSources, []);
    const japaneseSources = reviewSources.filter((source) => source.packageId === "com.sleepymario.language.japanese");
    assert.deepEqual(japaneseSources, []);
    assert.equal(reviewSources.some((source) => source.packageId === "com.sleepymario.language.japanese" && source.title === "Chapter 1-5"), false);

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

    const germanSources = reviewSources.filter((source) => source.packageId === "com.sleepymario.language.german");
    assert.deepEqual(germanSources.map((source) => [source.title, source.sourcePath]), [["Chapter 1-5", "review-decks/chapter-001-005/cards.tsv"]]);
    const germanItems = await listReadingReviewItems({
      dataDir: fixture.dataDir,
      packageId: "com.sleepymario.language.german",
      sourcePath: "review-decks/chapter-001-005/cards.tsv"
    });
    assert.equal(germanItems.length, 80);
    assert.ok(germanItems.some((item) => item.item.prompt.text === "hallo" && item.item.answer.text === "hello"));
    assert.ok(germanItems.some((item) => item.item.prompt.text === "hello" && item.item.answer.text === "hallo"));

    const frenchSources = reviewSources.filter((source) => source.packageId === "com.sleepymario.language.french");
    assert.deepEqual(frenchSources.map((source) => [source.title, source.sourcePath]), [["Chapter 1-5", "review-decks/chapter-001-005/cards.tsv"]]);
    const frenchItems = await listReadingReviewItems({
      dataDir: fixture.dataDir,
      packageId: "com.sleepymario.language.french",
      sourcePath: "review-decks/chapter-001-005/cards.tsv"
    });
    assert.equal(frenchItems.length, 80);
    assert.ok(frenchItems.some((item) => item.item.prompt.text === "bonjour" && item.item.answer.text === "hello; good day"));
    assert.ok(frenchItems.some((item) => item.item.prompt.text === "hello; good day" && item.item.answer.text === "bonjour"));

    const spanishSources = reviewSources.filter((source) => source.packageId === "com.sleepymario.language.spanish");
    assert.deepEqual(spanishSources.map((source) => [source.title, source.sourcePath]), [["Chapter 1-5", "review-decks/chapter-001-005/cards.tsv"]]);
    const spanishItems = await listReadingReviewItems({
      dataDir: fixture.dataDir,
      packageId: "com.sleepymario.language.spanish",
      sourcePath: "review-decks/chapter-001-005/cards.tsv"
    });
    assert.equal(spanishItems.length, 80);
    assert.ok(spanishItems.some((item) => item.item.prompt.text === "hola" && item.item.answer.text === "hello; hi"));
    assert.ok(spanishItems.some((item) => item.item.prompt.text === "hello; hi" && item.item.answer.text === "hola"));

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
      "Er is N",
      "Ich bin N",
      "Ich heiße N",
      "Wie heißt du?",
      "Das ist N",
      "Wie geht es dir?",
      "Je suis N",
      "Je m'appelle N",
      "Comment tu t'appelles ?",
      "C'est N",
      "Ça va ?",
      "Soy N",
      "Me llamo N",
      "¿Cómo te llamas?",
      "Este es N / Esta es N",
      "¿Cómo estás?"
    ];
    const languageReviewItemFiles = [
      ...(await listInstalledMemorizationItemFiles("com.sleepymario.language.korean", fixture.dataDir)),
      ...(await listInstalledMemorizationItemFiles("com.sleepymario.language.vietnamese", fixture.dataDir)),
      ...(await listInstalledMemorizationItemFiles("com.sleepymario.language.dutch", fixture.dataDir)),
      ...(await listInstalledMemorizationItemFiles("com.sleepymario.language.german", fixture.dataDir)),
      ...(await listInstalledMemorizationItemFiles("com.sleepymario.language.french", fixture.dataDir)),
      ...(await listInstalledMemorizationItemFiles("com.sleepymario.language.spanish", fixture.dataDir))
    ];
    for (const file of languageReviewItemFiles) {
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
      () => stat(join(fixture.dataDir, "packages", "com.sleepymario.language.chinese.mandarin.traditional", "0.1.0", "progress.json")),
      /ENOENT/
    );
    await assert.rejects(
      () => stat(join(fixture.dataDir, "packages", "com.sleepymario.language.japanese", "0.1.0", "progress.json")),
      /ENOENT/
    );
    await assert.rejects(
      () => stat(join(fixture.dataDir, "packages", "com.sleepymario.language.dutch", "0.1.0", "progress.json")),
      /ENOENT/
    );
    await assert.rejects(
      () => stat(join(fixture.dataDir, "packages", "com.sleepymario.language.german", "0.1.0", "progress.json")),
      /ENOENT/
    );
    await assert.rejects(
      () => stat(join(fixture.dataDir, "packages", "com.sleepymario.language.french", "0.1.0", "progress.json")),
      /ENOENT/
    );
    await assert.rejects(
      () => stat(join(fixture.dataDir, "packages", "com.sleepymario.language.spanish", "0.1.0", "progress.json")),
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
  for (const targetId of [
    "korean-curriculum",
    "chinese-mandarin-traditional-curriculum",
    "chinese-mandarin-simplified-curriculum",
    "japanese-curriculum",
    "vietnamese-curriculum",
    "dutch-curriculum",
    "german-curriculum",
    "french-curriculum",
    "spanish-curriculum"
  ]) {
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
    "com.sleepymario.language.chinese.mandarin.traditional",
    "com.sleepymario.language.chinese.mandarin.simplified",
    "com.sleepymario.language.japanese",
    "com.sleepymario.language.vietnamese",
    "com.sleepymario.language.dutch",
    "com.sleepymario.language.german",
    "com.sleepymario.language.french",
    "com.sleepymario.language.spanish"
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
