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

    assert.equal(entries.some((entry) => entry.path === "README.md"), false);
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
      path: "units/introduction-to-hangul/README.md"
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

test("rendered reading content hides useless Status table columns", () => {
  const rendered = renderReadingContent({
    package: {
      packageId: "com.sleepymario.language.korean",
      packageVersion: "0.1.0",
      displayName: "Korean Curriculum",
      installPath: "packages/com.sleepymario.language.korean/0.1.0",
      installedAt: "2026-07-09T00:00:00Z",
      source: { type: "file", path: "/tmp/korean.wspkg" }
    },
    entry: {
      path: "units/korean-core/chapter-001-basic-life-sentences-1/chapter.md",
      mediaType: "text/markdown",
      title: "Chapter 1",
      source: "snapshot"
    },
    text: [
      "# Chapter 1",
      "",
      "| Korean Word | Hanja Form | Status | Note |",
      "|---|---|---|---|",
      "| 학생 | 學生 | reference-only | Useful common word. |"
    ].join("\n")
  });

  assert.match(rendered, /\| Korean Word \| Hanja Form \| Note \|/u);
  assert.match(rendered, /\| 학생 \| 學生 \| Useful common word\. \|/u);
  assert.doesNotMatch(rendered, /Status|reference-only/u);
});

test("rendered reading content normalizes noun-only vocabulary notes", () => {
  const rendered = renderReadingContent({
    package: {
      packageId: "com.sleepymario.language.korean",
      packageVersion: "0.1.0",
      displayName: "Korean Curriculum",
      installPath: "packages/com.sleepymario.language.korean/0.1.0",
      installedAt: "2026-07-09T00:00:00Z",
      source: { type: "file", path: "/tmp/korean.wspkg" }
    },
    entry: {
      path: "units/korean-core/chapter-001-basic-life-sentences-1/chapter.md",
      mediaType: "text/markdown",
      title: "Chapter 1",
      source: "snapshot"
    },
    text: [
      "# Chapter 1",
      "",
      "| Korean | Meaning | Notes |",
      "|---|---|---|",
      "| 학생 | student | Can fill the N slot. |",
      "| 저 | I, me | Used inside `저는`. |",
      "| 한국 | Korea | New noun; not self-ID here. |"
    ].join("\n")
  });

  assert.match(rendered, /\| 학생 \| student \| Noun \|/u);
  assert.match(rendered, /\| 한국 \| Korea \| Noun \|/u);
  assert.match(rendered, /\| 저 \| I, me \| Used inside `저는`\. \|/u);
  assert.doesNotMatch(rendered, /Can fill the N slot|New noun; not self-ID here/u);
});

test("reading projections hide developer blocks by default and preserve uninterrupted infinitive rows", () => {
  const result = {
    package: {
      packageId: "com.sleepymario.language.dutch",
      packageVersion: "0.1.0",
      displayName: "Dutch Curriculum"
    },
    entry: {
      path: "units/dutch-core/chapter-001-basic-sentences-1/chapter.md",
      mediaType: "text/markdown",
      title: "Chapter 1",
      source: "snapshot"
    },
    text: [
      "# Chapter 1",
      "",
      "The infinitive row gives the base verb form.",
      "",
      "<!-- whacksmacker:developer-only:start -->",
      "It does not introduce `je`, `jij`, or `u` yet.",
      "<!-- whacksmacker:developer-only:end -->",
      "",
      "| Dutch | Meaning | Notes |",
      "|---|---|---|",
      "| ben | am | Verb |",
      "| zijn | to be | Infinitive |",
      "| de student | student | Noun |",
      "| de docent | teacher | Noun |"
    ].join("\n")
  };

  const normal = renderReadingContent(result);
  const developer = renderReadingContent(result, "developer");

  assert.doesNotMatch(normal, /does not introduce/u);
  assert.match(normal, /infinitive row gives the base verb form/u);
  const expectedVocabulary = [
    "| Dutch | Meaning | Notes |",
    "| --- | --- | --- |",
    "| ben | am | Verb |",
    "| zijn | to be | Infinitive |",
    "|  |  |  |",
    "| de student | student | Noun |",
    "|  |  |  |",
    "| de docent | teacher | Noun |"
  ].join("\n");
  assert.match(normal, new RegExp(expectedVocabulary.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "u"));
  assert.doesNotMatch(normal, /<br\s*\/?/iu);
  assert.match(developer, /It does not introduce `je`, `jij`, or `u` yet\./u);
  assert.match(developer, new RegExp(expectedVocabulary.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "u"));
  assert.equal(result.text.split("\n").filter((line) => line.startsWith("|") && !line.startsWith("|---")).length, 5);
});

test("installed Korean package exposes Chapter 15 and split vocabulary review decks", async () => {
  const fixture = await createInstalledReadingFixture();
  try {
    const expectedReviewDecks = [
      {
        title: "Chapter 1-5",
        sourcePath: "review-decks/chapter-001-005/cards.tsv",
        itemPath: "content/memorization/review-decks/chapter-001-005.json",
        itemCount: 46
      },
      {
        title: "Chapter 6-10",
        sourcePath: "review-decks/chapter-006-010/cards.tsv",
        itemPath: "content/memorization/review-decks/chapter-006-010.json",
        itemCount: 52
      },
      {
        title: "Chapter 11-15",
        sourcePath: "review-decks/chapter-011-015/cards.tsv",
        itemPath: "content/memorization/review-decks/chapter-011-015.json",
        itemCount: 28
      },
      {
        title: "Chapter 16-20",
        sourcePath: "review-decks/chapter-016-020/cards.tsv",
        itemPath: "content/memorization/review-decks/chapter-016-020.json",
        itemCount: 40
      },
      {
        title: "Chapter 21-25",
        sourcePath: "review-decks/chapter-021-025/cards.tsv",
        itemPath: "content/memorization/review-decks/chapter-021-025.json",
        itemCount: 40
      },
      {
        title: "Chapter 26-30",
        sourcePath: "review-decks/chapter-026-030/cards.tsv",
        itemPath: "content/memorization/review-decks/chapter-026-030.json",
        itemCount: 40
      },
      {
        title: "Chapter 31-35",
        sourcePath: "review-decks/chapter-031-035/cards.tsv",
        itemPath: "content/memorization/review-decks/chapter-031-035.json",
        itemCount: 60
      },
      {
        title: "Chapter 36-40",
        sourcePath: "review-decks/chapter-036-040/cards.tsv",
        itemPath: "content/memorization/review-decks/chapter-036-040.json",
        itemCount: 60
      },
      {
        title: "Chapter 41-45",
        sourcePath: "review-decks/chapter-041-045/cards.tsv",
        itemPath: "content/memorization/review-decks/chapter-041-045.json",
        itemCount: 60
      },
      {
        title: "Chapter 46-50",
        sourcePath: "review-decks/chapter-046-050/cards.tsv",
        itemPath: "content/memorization/review-decks/chapter-046-050.json",
        itemCount: 60
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

    assert.deepEqual(installed.map((record) => record.packageId), ["com.sleepymario.language.korean", "com.sleepymario.language.korean.reviews"]);
    assert.ok(entries.some((entry) => entry.path === "units/korean-core/chapter-015-basic-life-sentences-15/chapter.md"));
    assert.ok(entries.some((entry) => entry.path === "units/korean-core/chapter-031-basic-sentences-31/chapter.md"));
    assert.ok(entries.some((entry) => entry.path === "units/korean-core/chapter-040-basic-sentences-40/chapter.md"));
    assert.ok(entries.some((entry) => entry.path === "units/korean-core/chapter-041-basic-sentences-41/chapter.md"));
    assert.ok(entries.some((entry) => entry.path === "units/korean-core/chapter-050-basic-sentences-50/chapter.md"));
    assert.equal(entries.some((entry) => entry.path.startsWith("review-decks/")), false);
    assert.equal(entries.some((entry) => entry.path === "review-decks/chapter-001-020/cards.tsv"), false);
    assert.equal(entries.some((entry) => entry.path === "review-decks/chapter-008-010/cards.tsv"), false);
    assert.match(chapter20.text, /Chapter 15 -- Casual Absence I/);
    assert.deepEqual(itemFiles, []);

    const allItems = [];
    for (const deck of expectedReviewDecks) {
      const items = await listReadingReviewItems({
        dataDir: fixture.dataDir,
        packageId: "com.sleepymario.language.korean",
        sourcePath: deck.sourcePath
      });

      assert.equal(sources.some((source) => source.sourcePath === deck.sourcePath && source.title === deck.title), true);
      assert.equal(items.length, deck.itemCount);
      allItems.push(...items);
    }

    assert.equal(sources.some((source) => source.sourcePath === "review-decks/chapter-001-020/cards.tsv" || source.title === "Chapter 1-20"), false);
    assert.equal(sources.some((source) => source.sourcePath === "review-decks/chapter-008-010/cards.tsv" || source.title === "Chapter 8-10"), false);
    assert.ok(allItems.some((item) => item.item.prompt.text === "안녕하세요" && item.item.answer.text === "hello"));
    assert.ok(allItems.some((item) => item.item.prompt.text === "hello" && item.item.answer.text === "안녕하세요"));
    assert.ok(allItems.some((item) => item.item.prompt.text === "은/는" && item.item.answer.text === "topic particle"));
    assert.ok(allItems.some((item) => item.item.prompt.text === "subject/existence marker" && item.item.answer.text === "이/가"));
    assert.equal(
      allItems.some((item) => ["사람", "언니", "연필", "소파", "시간"].includes(item.item.prompt.text) || ["사람", "언니", "연필", "소파", "시간"].includes(item.item.answer.text)),
      false
    );

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
    const dutchEntries = await listReadableContentEntries("com.sleepymario.language.dutch", fixture.dataDir);
    const dutchChapter1Translation = await readInstalledContentEntry({
      dataDir: fixture.dataDir,
      packageId: "com.sleepymario.language.dutch",
      path: "units/dutch-core/chapter-001-basic-sentences-1/reading-translation.en.json"
    });
    const dutchChapter11 = await readInstalledContentEntry({
      dataDir: fixture.dataDir,
      packageId: "com.sleepymario.language.dutch",
      path: "units/dutch-core/chapter-011-asking-how-someone-is/chapter.md"
    });
    const dutchChapter15 = await readInstalledContentEntry({
      dataDir: fixture.dataDir,
      packageId: "com.sleepymario.language.dutch",
      path: "units/dutch-core/chapter-015-asking-where-someone-lives/chapter.md"
    });
    const englishChapter1 = await readInstalledContentEntry({
      dataDir: fixture.dataDir,
      packageId: "com.sleepymario.language.english",
      path: "units/english-core/chapter-001-basic-sentences-1/chapter.md"
    });
    const englishChapter1EnglishLocale = await readInstalledContentEntry({
      dataDir: fixture.dataDir,
      packageId: "com.sleepymario.language.english",
      path: "units/english-core/chapter-001-basic-sentences-1/chapter.md",
      locale: "en-US"
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
      installed.filter(record => record.contentType !== "core-review").map((record) => [record.packageId, record.displayName]).sort(),
      [
        ["com.sleepymario.language.chinese.mandarin.simplified", "Chinese - Mandarin (Simplified)"],
        ["com.sleepymario.language.chinese.mandarin.traditional", "Chinese - Mandarin (Traditional)"],
        ["com.sleepymario.language.dutch", "Dutch"],
        ["com.sleepymario.language.english", "English"],
        ["com.sleepymario.language.french", "French"],
        ["com.sleepymario.language.german", "German"],
        ["com.sleepymario.language.japanese", "Japanese"],
        ["com.sleepymario.language.korean", "Korean Curriculum"],
        ["com.sleepymario.language.spanish", "Spanish"],
        ["com.sleepymario.language.vietnamese", "Vietnamese Curriculum"]
      ]
    );
    assert.match(koreanChapter20.text, /Chapter 15 -- Casual Absence I/);
    assert.match(vietnameseChapter5.text, /Chapter 5 — What Is in the Classroom/);
    assert.match(dutchChapter11.text, /Chapter 11 -- Asking How Someone Is/);
    assert.match(dutchChapter15.text, /Chapter 15 -- Asking Where Someone Lives/);
    assert.equal(dutchEntries.some((entry) => entry.path === "units/dutch-core/chapter-011-asking-how-someone-is/chapter.md"), true);
    assert.equal(dutchEntries.some((entry) => entry.path === "units/dutch-core/chapter-015-asking-where-someone-lives/chapter.md"), true);
    assert.equal(dutchEntries.filter((entry) => entry.path.endsWith("/reading-translation.en.json")).length, 70);
    assert.equal(dutchChapter1Translation.entry.mediaType, "application/json");
    const installedTranslation = JSON.parse(dutchChapter1Translation.text);
    assert.equal(installedTranslation.id, "dutch-core.chapter-001.learner-facing-dialogue.en");
    assert.equal(installedTranslation.language, "en");
    assert.equal(installedTranslation.turns.length, 9);
    assert.deepEqual(installedTranslation.turns.at(-1), { speaker: "Marieke", text: "I'm a teacher." });
    assert.equal(dutchEntries.some((entry) => entry.path.startsWith("units/dutch-core/chapter-002-") && entry.path.endsWith("reading-translation.en.json")), true);
    assert.equal(dutchEntries.some((entry) => entry.path.startsWith("units/dutch-core/chapter-010-") && entry.path.endsWith("reading-translation.en.json")), true);
    assert.equal(dutchEntries.some((entry) => entry.path.startsWith("units/dutch-core/chapter-016-") && entry.path.endsWith("reading-translation.en.json")), true);
    assert.equal(dutchEntries.some((entry) => entry.path.startsWith("units/dutch-core/chapter-020-") && entry.path.endsWith("reading-translation.en.json")), true);
    assert.equal(dutchEntries.some((entry) => /^units\/dutch-core\/chapter-016-/u.test(entry.path)), true);
    assert.equal(dutchEntries.some((entry) => /^units\/dutch-core\/chapter-020-/u.test(entry.path)), true);
    assert.equal(dutchEntries.some((entry) => /^units\/dutch-core\/chapter-021-/u.test(entry.path)), true);
    assert.equal(dutchEntries.some((entry) => /^units\/dutch-core\/chapter-025-/u.test(entry.path)), true);
    assert.equal(dutchEntries.some((entry) => /^units\/dutch-core\/chapter-070-/u.test(entry.path)), true);
    assert.equal(dutchEntries.some((entry) => /^units\/dutch-core\/chapter-071-/u.test(entry.path)), false);
    assert.match(chineseTraditionalPinyinIntro.text, /Hanyu Pinyin is the standard romanization system/);
    assert.match(chineseTraditionalChapter1.text, /我是馬莉亞/);
    assert.match(chineseTraditionalChapter1.text, /我是林雅婷/);
    assert.match(chineseTraditionalChapter1.text, /我是學生/);
    assert.match(englishChapter1.text, /Chapter 1 -- First Introductions/);
    assert.match(englishChapter1.text, /This chapter introduces simple English identity sentences with `I am`/);
    assert.doesNotMatch(englishChapter1.text, /[\u3400-\u9fff]/u);
    assert.match(englishChapter1.text, /Maria  : Hello\./);
    assert.match(englishChapter1EnglishLocale.text, /Chapter 1 -- First Introductions/);
    assert.match(englishChapter1EnglishLocale.text, /This chapter introduces simple English identity sentences with `I am`/);
    assert.doesNotMatch(englishChapter1EnglishLocale.text, /[\u3400-\u9fff]/u);
    assert.match(chineseTraditionalChapter1.text, /\|\s*學生\s*\|\s*xuéshēng\s*\|\s*ㄒㄩㄝˊ ㄕㄥ\s*\|\s*student\s*\|/);
    assert.match(chineseTraditionalChapter1.text, /Lín Yǎtíng: Wǒ shì Lín Yǎtíng\./);
    assert.match(chineseTraditionalChapter1.text, /Lin Yating: I am Lin Yating\./);
    assert.doesNotMatch(chineseTraditionalChapter1.text, /\$\{|FOREIGN-NAME|LOCAL-NAME/);
    assert.match(chineseSimplifiedPinyinIntro.text, /Hanyu Pinyin is the standard romanization system/);
    assert.match(chineseSimplifiedChapter1.text, /我是玛莉亚/);
    assert.match(chineseSimplifiedChapter1.text, /我是林雅婷/);
    assert.match(chineseSimplifiedChapter1.text, /我是学生/);
    assert.match(chineseSimplifiedChapter1.text, /\|\s*学生\s*\|\s*xuéshēng\s*\|\s*student\s*\|/);
    assert.doesNotMatch(chineseSimplifiedChapter1.text, /\$\{|FOREIGN-NAME|LOCAL-NAME|ㄒㄩㄝˊ/);
    assert.match(japaneseHiragana.text, /future work/);
    assert.match(japaneseChapter1.text, /マリア\s+: 私はマリアです。/);
    assert.match(japaneseChapter1.text, /佐藤さくら: 私は佐藤さくらです。/);
    assert.match(japaneseChapter1.text, /マリア\s+: 私は学生です。/);
    assert.match(japaneseChapter1.text, /\|\s*学生\s*\|\s*がくせい\s*\|\s*student\s*\|/);
    assert.doesNotMatch(japaneseChapter1.text, /\$\{|FOREIGN-NAME|LOCAL-NAME/);
    assert.match(dutchChapter5.text, /Chapter 5 -- There Is \/ There Are I/);
    assert.match(germanChapter1.text, /Chapter 1 -- Greetings and Identity/);
    assert.match(germanChapter1.text, /Ich bin Alex/);
    assert.match(germanChapter1.text, /Ich bin Lena/);
    assert.match(germanChapter5.text, /Chapter 5 -- First Wellbeing Questions/);
    assert.match(frenchChapter1.text, /Je suis Alex/);
    assert.match(frenchChapter1.text, /Je suis Camille/);
    assert.match(spanishChapter1.text, /Soy Alex/);
    assert.match(spanishChapter1.text, /Soy Lucía/);

    const koreanSources = reviewSources.filter((source) => source.packageId === "com.sleepymario.language.korean");
    assert.deepEqual(
      koreanSources.map((source) => [source.title, source.sourcePath]).sort(),
      [
        ["Chapter 1-5", "review-decks/chapter-001-005/cards.tsv"],
        ["Chapter 11-15", "review-decks/chapter-011-015/cards.tsv"],
        ["Chapter 16-20", "review-decks/chapter-016-020/cards.tsv"],
        ["Chapter 21-25", "review-decks/chapter-021-025/cards.tsv"],
        ["Chapter 26-30", "review-decks/chapter-026-030/cards.tsv"],
        ["Chapter 31-35", "review-decks/chapter-031-035/cards.tsv"],
        ["Chapter 36-40", "review-decks/chapter-036-040/cards.tsv"],
        ["Chapter 41-45", "review-decks/chapter-041-045/cards.tsv"],
        ["Chapter 46-50", "review-decks/chapter-046-050/cards.tsv"],
        ["Chapter 6-10", "review-decks/chapter-006-010/cards.tsv"]
      ]
    );
    assert.equal(reviewSources.some((source) => source.title === "Chapter 1-20"), false);
    assert.equal(reviewSources.some((source) => source.title === "Chapter 8-10"), false);
    assert.equal(reviewSources.some((source) => source.title === "Lessons 1-5"), false);

    const chineseTraditionalSources = reviewSources.filter((source) => source.packageId === "com.sleepymario.language.chinese.mandarin.traditional");
    assert.deepEqual(chineseTraditionalSources.map((source) => source.title).sort(), ["Chapter 1-5", "Chapter 6-10", "Pinyin-Zhuyin", "Pinyin-Zhuyin with Tones"]);
    assert.ok(chineseTraditionalSources.some((source) => source.title === "Chapter 1-5" && source.sourcePath === "review-decks/mandarin-traditional-chapter-001-005/cards.tsv"));
    const chineseSimplifiedSources = reviewSources.filter((source) => source.packageId === "com.sleepymario.language.chinese.mandarin.simplified");
    assert.deepEqual(chineseSimplifiedSources.map((source) => [source.title, source.sourcePath]), [
      ["Chapter 1-5", "review-decks/mandarin-simplified-chapter-001-005/cards.tsv"],
      ["Chapter 6-10", "review-decks/mandarin-simplified-chapter-006-010/cards.tsv"]
    ]);
    const japaneseSources = reviewSources.filter((source) => source.packageId === "com.sleepymario.language.japanese");
    assert.deepEqual(japaneseSources.map((source) => [source.title, source.sourcePath]), [
      ["Chapter 1-5", "review-decks/chapter-001-005/cards.tsv"],
      ["Chapter 6-10", "review-decks/chapter-006-010/cards.tsv"],
      ["Chapter 11-15", "review-decks/chapter-011-015/cards.tsv"],
      ["Chapter 16-20", "review-decks/chapter-016-020/cards.tsv"]
    ]);

    const vietnameseItems = await listReadingReviewItems({
      dataDir: fixture.dataDir,
      packageId: "com.sleepymario.language.vietnamese",
      sourcePath: "review-decks/chapter-001-005/cards.tsv"
    });
    assert.equal(vietnameseItems.length, 64);
    assert.ok(vietnameseItems.every((item) => item.item.schemaVersion === 2));
    assert.ok(vietnameseItems.some((item) => item.item.prompt.text === "xin chào" && item.item.acceptedAnswers.includes("hello")));
    assert.ok(vietnameseItems.some((item) => item.item.prompt.text === "hello" && item.item.acceptedAnswers.includes("xin chào")));
    const vietnameseItems610 = await listReadingReviewItems({
      dataDir: fixture.dataDir,
      packageId: "com.sleepymario.language.vietnamese",
      sourcePath: "review-decks/chapter-006-010/cards.tsv"
    });
    assert.equal(vietnameseItems610.length, 64);
    assert.equal(new Set([...vietnameseItems, ...vietnameseItems610].map((item) => item.item.cardId)).size, 128);
    assert.ok(vietnameseItems610.some((item) => item.item.prompt.text === "đi" && item.item.acceptedAnswers.includes("go; be going in context")));
    const vietnameseSources = reviewSources.filter((source) => source.packageId === "com.sleepymario.language.vietnamese");
    assert.deepEqual(vietnameseSources.map((source) => [source.title, source.sourcePath]), Array.from({ length: 10 }, (_, index) => {
      const start = index * 5 + 1;
      return [`Chapter ${start}-${start + 4}`, `review-decks/chapter-${String(start).padStart(3, "0")}-${String(start + 4).padStart(3, "0")}/cards.tsv`];
    }));

    const dutchSources = reviewSources.filter((source) => source.packageId === "com.sleepymario.language.dutch");
    assert.deepEqual(dutchSources.map((source) => [source.title, source.sourcePath]), [
      ["Chapter 1-5", "review-decks/chapter-001-005/cards.tsv"],
      ["Chapter 6-10", "review-decks/chapter-006-010/cards.tsv"],
      ["Chapter 11-15", "review-decks/chapter-011-015/cards.tsv"],
      ["Chapter 16-20", "review-decks/chapter-016-020/cards.tsv"],
      ["Chapter 21-25", "review-decks/chapter-021-025/cards.tsv"],
      ["Chapter 26-30", "review-decks/chapter-026-030/cards.tsv"],
      ["Chapter 31-35", "review-decks/chapter-031-035/cards.tsv"],
      ["Chapter 36-40", "review-decks/chapter-036-040/cards.tsv"],
      ["Chapter 41-45", "review-decks/chapter-041-045/cards.tsv"],
      ["Chapter 46-50", "review-decks/chapter-046-050/cards.tsv"],
      ["Chapter 51-55", "review-decks/chapter-051-055/cards.tsv"],
      ["Chapter 56-60", "review-decks/chapter-056-060/cards.tsv"],
      ["Chapter 61-65", "review-decks/chapter-061-065/cards.tsv"],
      ["Chapter 66-70", "review-decks/chapter-066-070/cards.tsv"]
    ]);
    const dutchItems = await listReadingReviewItems({
      dataDir: fixture.dataDir,
      packageId: "com.sleepymario.language.dutch",
      sourcePath: "review-decks/chapter-001-005/cards.tsv"
    });
    assert.equal(dutchItems.length, 70);
    assert.ok(dutchItems.some((item) => item.item.prompt.text === "hallo" && item.item.answer.text === "hello"));
    assert.ok(dutchItems.some((item) => item.item.prompt.text === "hello" && item.item.answer.text === "hallo"));
    const dutchItems0610 = await listReadingReviewItems({
      dataDir: fixture.dataDir,
      packageId: "com.sleepymario.language.dutch",
      sourcePath: "review-decks/chapter-006-010/cards.tsv"
    });
    assert.equal(dutchItems0610.length, 80);
    assert.ok(dutchItems0610.some((item) => item.item.prompt.text === "heb" && item.item.answer.text === "have"));
    assert.ok(dutchItems0610.some((item) => item.item.prompt.text === "live" && item.item.answer.text === "woon"));
    const dutchItems1115 = await listReadingReviewItems({
      dataDir: fixture.dataDir,
      packageId: "com.sleepymario.language.dutch",
      sourcePath: "review-decks/chapter-011-015/cards.tsv"
    });
    assert.equal(dutchItems1115.length, 66);
    assert.ok(dutchItems1115.some((item) => item.item.prompt.text === "waar" && item.item.answer.text === "where"));
    assert.ok(dutchItems1115.some((item) => item.item.prompt.text === "goed" && item.item.acceptedAnswers.includes("well")));
    assert.equal(dutchItems1115.some((item) => (item.item.examples ?? []).some((example) => example.includes("Alex"))), false);

    const germanSources = reviewSources.filter((source) => source.packageId === "com.sleepymario.language.german");
    assert.deepEqual(germanSources.map((source) => [source.title, source.sourcePath]), [
      ["Chapter 1-5", "review-decks/chapter-001-005/cards.tsv"],
      ["Chapter 6-10", "review-decks/chapter-006-010/cards.tsv"]
    ]);
    const germanItems = await listReadingReviewItems({
      dataDir: fixture.dataDir,
      packageId: "com.sleepymario.language.german",
      sourcePath: "review-decks/chapter-001-005/cards.tsv"
    });
    assert.equal(germanItems.length, 54);
    assert.ok(germanItems.some((item) => item.item.prompt.text === "hallo" && item.item.answer.text === "hello"));
    assert.ok(germanItems.some((item) => item.item.prompt.text === "hello" && item.item.answer.text === "hallo"));

    const frenchSources = reviewSources.filter((source) => source.packageId === "com.sleepymario.language.french");
    assert.deepEqual(frenchSources.map((source) => [source.title, source.sourcePath]), [
      ["Chapter 1-5", "review-decks/chapter-001-005/cards.tsv"],
      ["Chapter 6-10", "review-decks/chapter-006-010/cards.tsv"]
    ]);
    const frenchItems = await listReadingReviewItems({
      dataDir: fixture.dataDir,
      packageId: "com.sleepymario.language.french",
      sourcePath: "review-decks/chapter-001-005/cards.tsv"
    });
    assert.equal(frenchItems.length, 32);
    assert.ok(frenchItems.some((item) => item.item.prompt.text === "bonjour" && item.item.answer.text === "hello; good day"));
    assert.ok(frenchItems.some((item) => item.item.prompt.text === "hello; good day" && item.item.answer.text === "bonjour"));

    const spanishSources = reviewSources.filter((source) => source.packageId === "com.sleepymario.language.spanish");
    assert.deepEqual(spanishSources.map((source) => [source.title, source.sourcePath]), [
      ["Chapter 1-5", "review-decks/chapter-001-005/cards.tsv"],
      ["Chapter 6-10", "review-decks/chapter-006-010/cards.tsv"]
    ]);
    const spanishItems = await listReadingReviewItems({
      dataDir: fixture.dataDir,
      packageId: "com.sleepymario.language.spanish",
      sourcePath: "review-decks/chapter-001-005/cards.tsv"
    });
    assert.equal(spanishItems.length, 30);
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
      () => stat(join(fixture.dataDir, "packages", "com.sleepymario.language.vietnamese", "0.2.0", "progress.json")),
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
  await generateContentPackage({ targetId: "korean-core-reviews", outputDirectory: packageDirectory, generatedAt: "2026-07-06T00:00:00Z" });
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
  await installContentPackage({ cataloguePath, dataDir, packageId: "com.sleepymario.language.korean.reviews", installedAt: "2026-07-06T00:00:00Z" });

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
    "english-curriculum",
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
  for (const targetId of ["korean-core-reviews", "chinese-traditional-core-reviews", "chinese-simplified-core-reviews", "english-core-reviews", "japanese-core-reviews", "vietnamese-core-reviews", "dutch-core-reviews", "german-core-reviews", "french-core-reviews", "spanish-core-reviews"]) {
    await generateContentPackage({ targetId, outputDirectory: packageDirectory, generatedAt: "2026-07-06T00:00:00Z" });
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
    "com.sleepymario.language.english",
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
  for (const packageId of ["com.sleepymario.language.korean.reviews", "com.sleepymario.language.chinese.mandarin.traditional.reviews", "com.sleepymario.language.chinese.mandarin.simplified.reviews", "com.sleepymario.language.english.reviews", "com.sleepymario.language.japanese.reviews", "com.sleepymario.language.vietnamese.reviews", "com.sleepymario.language.dutch.reviews", "com.sleepymario.language.german.reviews", "com.sleepymario.language.french.reviews", "com.sleepymario.language.spanish.reviews"]) {
    await installContentPackage({ cataloguePath, dataDir, packageId, installedAt: "2026-07-06T00:00:00Z" });
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
