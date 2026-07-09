import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { test } from "node:test";

import {
  contentPackageGeneratorTargets,
  generateContentPackage,
  validateContentPackageManifest
} from "../dist/packages/core/index.js";

test("content package generator exposes the supported local package targets", () => {
  assert.deepEqual(
    contentPackageGeneratorTargets.map((target) => [target.id, target.packageId]),
    [
      ["linguistic-terminology", "com.sleepymario.language.linguistic-terminology"],
      ["korean-curriculum", "com.sleepymario.language.korean"],
      ["chinese-mandarin-traditional-curriculum", "com.sleepymario.language.chinese.mandarin.traditional"],
      ["chinese-mandarin-simplified-curriculum", "com.sleepymario.language.chinese.mandarin.simplified"],
      ["japanese-curriculum", "com.sleepymario.language.japanese"],
      ["vietnamese-curriculum", "com.sleepymario.language.vietnamese"],
      ["dutch-curriculum", "com.sleepymario.language.dutch"],
      ["german-curriculum", "com.sleepymario.language.german"],
      ["french-curriculum", "com.sleepymario.language.french"],
      ["spanish-curriculum", "com.sleepymario.language.spanish"]
    ]
  );
});

test("content package generator creates a valid Linguistic Terminology package", async () => {
  const directory = await mkdtemp(join(tmpdir(), "wsm-terminology-package-"));

  try {
    const result = await generateContentPackage({
      targetId: "linguistic-terminology",
      outputDirectory: directory,
      generatedAt: "2026-07-06T00:00:00Z"
    });
    const archive = await readZip(result.filePath);
    const manifest = JSON.parse(archive.get("manifest.json").toString("utf8"));
    const content = JSON.parse(archive.get("content/content.json").toString("utf8"));

    assert.equal(result.packageId, "com.sleepymario.language.linguistic-terminology");
    assert.equal(result.filePath.endsWith("com.sleepymario.language.linguistic-terminology-0.1.0.wspkg"), true);
    assert.equal(archive.has("manifest.json"), true);
    assert.equal(archive.has("content/content.json"), true);
    assert.deepEqual(validateContentPackageManifest(manifest).errors, []);
    assert.equal(manifest.contentType, "linguistic-terminology");
    assert.equal(manifest.entryPoints[0].path, "content/content.json");
    assert.equal(content.packageId, "com.sleepymario.language.linguistic-terminology");
    assert.ok(content.files.some((file) => file.path === "terms/korean.md"));
    assert.ok(content.files.some((file) => file.text.includes("## 받침")));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("content package generator creates a valid Korean Curriculum package", async () => {
  const directory = await mkdtemp(join(tmpdir(), "wsm-korean-package-"));

  try {
    const result = await generateContentPackage({
      targetId: "korean-curriculum",
      outputDirectory: directory,
      generatedAt: "2026-07-06T00:00:00Z"
    });
    const archive = await readZip(result.filePath);
    const manifest = JSON.parse(archive.get("manifest.json").toString("utf8"));
    const content = JSON.parse(archive.get("content/content.json").toString("utf8"));

    assert.equal(result.packageId, "com.sleepymario.language.korean");
    assert.equal(result.filePath.endsWith("com.sleepymario.language.korean-0.1.0.wspkg"), true);
    assert.deepEqual(validateContentPackageManifest(manifest).errors, []);
    assert.equal(manifest.contentType, "language-curriculum");
    assert.equal(manifest.dependencies[0].packageId, "com.sleepymario.language.linguistic-terminology");
    assert.equal(content.packageId, "com.sleepymario.language.korean");
    assertUsefulChapterTitles(content.files);
    assert.ok(content.files.some((file) => file.path === "units/introduction-to-hangul/README.md"));
    assert.ok(content.files.some((file) => file.path === "units/introduction-to-hangul/chapter-01-vowels/unit-01-simple-vowels.md"));
    assert.ok(content.files.some((file) => file.path === "units/korean-core/chapter-015-basic-life-sentences-15/chapter.md"));
    const koreanChapter1 = content.files.find((file) => file.path === "units/korean-core/chapter-001-basic-life-sentences-1/chapter.md");
    assert.ok(koreanChapter1);
    assert.match(koreanChapter1.text, /title: "Names and First Greetings"/u);
    assert.match(koreanChapter1.text, /^# Chapter 1 -- Names and First Greetings$/mu);
    assert.doesNotMatch(koreanChapter1.text, /Basic Life Sentences I: Greeting and Identity/u);
    assert.match(koreanChapter1.text, /\| Korean\s+\| Meaning\s+\| Notes\s+\|/u);
    assert.match(koreanChapter1.text, /마리아: 안녕하세요\. 저는 마리아입니다\./u);
    assert.match(koreanChapter1.text, /김민준: 안녕하세요\. 저는 김민준입니다\./u);
    assert.doesNotMatch(koreanChapter1.text, /Maria/u);
    assert.doesNotMatch(koreanChapter1.text, /^마리아 가르시아:/mu);
    assert.doesNotMatch(koreanChapter1.text, /^A: /mu);
    assert.doesNotMatch(koreanChapter1.text, /^B: /mu);
    assert.doesNotMatch(koreanChapter1.text, /\.\.\/\.\.\/\.\.\/name-pools/u);
    assert.doesNotMatch(koreanChapter1.text, /^## Cumulative Ledger$/mu);
    assert.doesNotMatch(koreanChapter1.text, /^## Legality Audit$/mu);
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
      }
    ];

    for (const deck of expectedReviewDecks) {
      assert.ok(content.files.some((file) => file.path === deck.sourcePath));
      assert.equal(archive.has(deck.itemPath), true);
    }
    assert.equal(content.files.some((file) => file.path === "review-decks/chapter-001-020/cards.tsv"), false);
    assert.equal(content.files.some((file) => file.path === "review-decks/chapter-008-010/cards.tsv"), false);
    assert.equal(content.files.some((file) => file.path === "review-decks/chapter-016-020/cards.tsv"), false);
    assert.equal(archive.has("content/memorization/review-decks/chapter-001-020.json"), false);
    assert.equal(archive.has("content/memorization/review-decks/chapter-008-010.json"), false);
    assert.equal(archive.has("content/memorization/review-decks/chapter-016-020.json"), false);

    const reviewCollections = expectedReviewDecks.map((deck) => ({
      deck,
      collection: JSON.parse(archive.get(deck.itemPath).toString("utf8"))
    }));

    for (const { deck, collection } of reviewCollections) {
      assert.equal(collection.schemaVersion, 1);
      assert.equal(collection.items.length, deck.itemCount);
      assert.equal(collection.items[0].source.title, deck.title);
      assert.equal(collection.items[0].source.path, deck.sourcePath);
    }

    const allReviewItems = reviewCollections.flatMap(({ collection }) => collection.items);
    assertKoreanStrictReadContentExamples(allReviewItems, content.files);
    assert.ok(allReviewItems.some((item) => item.prompt.text === "안녕하세요" && item.answer.text === "hello"));
    assert.ok(allReviewItems.some((item) => item.prompt.text === "hello" && item.answer.text === "안녕하세요"));
    assert.ok(allReviewItems.some((item) => item.prompt.text === "topic particle" && item.answer.text === "은/는"));
    assert.ok(allReviewItems.some((item) => item.prompt.text === "이/가" && item.answer.text === "subject/existence marker"));
    assert.equal(allReviewItems.some((item) => item.source.title === "Chapter 1-20"), false);
    assert.equal(allReviewItems.some((item) => item.source.title === "Chapter 8-10"), false);
    assert.equal(allReviewItems.some((item) => item.source.title === "Chapter 16-20"), false);
    assert.equal(allReviewItems.some((item) => item.prompt.text === "저는 N입니다" || item.answer.text === "저는 N입니다"), false);

    const studentItem = allReviewItems.find((item) => item.prompt.text === "학생" && item.answer.text === "student");
    const helloItem = allReviewItems.find((item) => item.prompt.text === "안녕하세요" && item.answer.text === "hello");
    const existsItem = allReviewItems.find((item) => item.prompt.text === "있다" && item.answer.text === "to exist / to have");
    const markerItem = allReviewItems.find((item) => item.prompt.text === "이/가" && item.answer.text === "subject/existence marker");
    assert.deepEqual(helloItem.examples, ["마리아: 안녕하세요. 저는 마리아입니다.", "김민준: 안녕하세요. 저는 김민준입니다.", "안녕하세요."]);
    assert.deepEqual(studentItem.examples, ["저는 학생입니다.", "A: 학생입니까?", "B: 네, 학생입니다."]);
    assert.deepEqual(existsItem.examples, ["교실: 학생이 있습니다.", "학교: 선생님이 있습니다.", "집: 가족이 있습니다."]);
    assert.deepEqual(markerItem.examples, ["교실: 학생이 있습니다.", "학교: 선생님이 있습니다.", "집: 가족이 있습니다."]);
    assert.deepEqual(findReviewTerms(allReviewItems, ["사람", "언니", "연필", "소파", "시간"]), []);
    assert.ok(findReviewTerms(allReviewItems, ["학생", "나", "문", "지도", "식탁"]).length >= 5);

    const grammarSummary0105 = assertKoreanGrammarSummaryPair(content.files, "001", "005", [
      "- KOR-GRAMMAR-001 -- 저는 N입니다",
      "- KOR-GRAMMAR-002 -- 제 이름은 N입니다",
      "- KOR-GRAMMAR-003 -- N입니까?",
      "- KOR-GRAMMAR-004 -- N이에요/예요",
      "- KOR-GRAMMAR-005 -- N이에요/예요?"
    ]);
    const grammarSummary0610 = assertKoreanGrammarSummaryPair(content.files, "006", "010", [
      "- KOR-GRAMMAR-006 -- N이야/야",
      "- KOR-GRAMMAR-007 -- N이야/야?",
      "- KOR-GRAMMAR-008 -- N이다",
      "- KOR-GRAMMAR-009 -- N인가?",
      "- KOR-GRAMMAR-010 -- N이/가 있습니다"
    ]);
    const grammarSummary1115 = assertKoreanGrammarSummaryPair(content.files, "011", "015", [
      "- KOR-GRAMMAR-011 -- N이/가 없습니다",
      "- KOR-GRAMMAR-012 -- N이/가 있어요",
      "- KOR-GRAMMAR-013 -- N이/가 없어요",
      "- KOR-GRAMMAR-014 -- N이/가 있어",
      "- KOR-GRAMMAR-015 -- N이/가 없어"
    ]);
    assertKoreanGrammarSummariesAreBlockSpecific([grammarSummary0105, grammarSummary0610, grammarSummary1115]);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("content package generator creates a valid Chinese - Mandarin Traditional package with conversion decks", async () => {
  const directory = await mkdtemp(join(tmpdir(), "wsm-chinese-traditional-package-"));

  try {
    const result = await generateContentPackage({
      targetId: "chinese-mandarin-traditional-curriculum",
      outputDirectory: directory,
      generatedAt: "2026-07-06T00:00:00Z"
    });
    const archive = await readZip(result.filePath);
    const manifest = JSON.parse(archive.get("manifest.json").toString("utf8"));
    const content = JSON.parse(archive.get("content/content.json").toString("utf8"));
    const expectedReviewDecks = [
      {
        title: "Pinyin-Zhuyin",
        sourcePath: "review-decks/pinyin-zhuyin/cards.tsv",
        itemPath: "content/memorization/review-decks/pinyin-zhuyin.json",
        itemCount: 174
      },
      {
        title: "Pinyin-Zhuyin with Tones",
        sourcePath: "review-decks/pinyin-zhuyin-with-tones/cards.tsv",
        itemPath: "content/memorization/review-decks/pinyin-zhuyin-with-tones.json",
        itemCount: 206
      }
    ];

    assert.equal(result.packageId, "com.sleepymario.language.chinese.mandarin.traditional");
    assert.equal(result.filePath.endsWith("com.sleepymario.language.chinese.mandarin.traditional-0.1.0.wspkg"), true);
    assert.deepEqual(validateContentPackageManifest(manifest).errors, []);
    assert.equal(manifest.displayName, "Chinese - Mandarin (Traditional)");
    assert.equal(manifest.description, "Chinese - Mandarin Traditional language curriculum content generated from the canonical Chinese curriculum repository.");
    assert.equal(manifest.contentType, "language-curriculum");
    assert.equal(content.packageId, "com.sleepymario.language.chinese.mandarin.traditional");
    assertUsefulChapterTitles(content.files);
    assert.ok(content.files.some((file) => file.path === "units/mandarin-traditional/introduction-to-hanyu-pinyin/chapter.md"));
    assert.ok(content.files.some((file) => file.path === "units/mandarin-traditional/chapter-001-basic-sentences-1/chapter.md"));
    assert.ok(content.files.some((file) => file.path === "units/mandarin-traditional/chapter-005-basic-sentences-5/chapter.md"));
    assert.equal(content.files.some((file) => file.path === "units/mandarin-traditional/chapter-006-basic-sentences-6/chapter.md"), false);
    assert.equal(content.files.some((file) => file.path.startsWith("units/mandarin-simplified/")), false);
    assert.equal(content.files.some((file) => file.path === "review-decks/chapter-001-005/cards.tsv"), false);
    assert.equal(archive.has("content/memorization/review-decks/chapter-001-005.json"), false);

    for (const deck of expectedReviewDecks) {
      assert.ok(content.files.some((file) => file.path === deck.sourcePath));
      assert.equal(archive.has(deck.itemPath), true);
      const collection = JSON.parse(archive.get(deck.itemPath).toString("utf8"));
      assert.equal(collection.items.length, deck.itemCount);
      assert.equal(collection.items[0].source.title, deck.title);
      assert.equal(collection.items[0].source.path, deck.sourcePath);
    }

    const allItems = expectedReviewDecks.flatMap((deck) => JSON.parse(archive.get(deck.itemPath).toString("utf8")).items);
    assert.equal(allItems.some((item) => item.examples !== undefined), false);
    assert.ok(allItems.some((item) => item.prompt.text === "b" && item.answer.text === "ㄅ"));
    assert.ok(allItems.some((item) => item.prompt.text === "ㄅ" && item.answer.text === "b"));
    assert.ok(allItems.some((item) => item.prompt.text === "mā" && item.answer.text === "ㄇㄚ"));
    assert.ok(allItems.some((item) => item.prompt.text === "ㄇㄚˊ" && item.answer.text === "má"));
    assert.equal(allItems.some((item) => item.kind === "sentence" || item.kind === "concept"), false);
    assert.equal(allItems.some((item) => item.source.title === "Chapter 1-5"), false);
    const pinyinIntro = content.files.find((file) => file.path === "units/mandarin-traditional/introduction-to-hanyu-pinyin/chapter.md").text;
    const chapter1 = content.files.find((file) => file.path === "units/mandarin-traditional/chapter-001-basic-sentences-1/chapter.md").text;
    assert.match(pinyinIntro, /Hanyu Pinyin is the standard romanization system/);
    assert.match(chapter1, /我是Alex Chen/);
    assert.match(chapter1, /我是林雅婷/);
    assert.match(chapter1, /\| 學生 \| xuéshēng \| ㄒㄩㄝˊ ㄕㄥ \| student \|/);
    assert.match(chapter1, /Pinyin: Wǒ shì Lín Yǎtíng\./);
    assert.match(chapter1, /Meaning: I am Lin Yating\./);
    assert.doesNotMatch(chapter1, /\$\{|FOREIGN-NAME|LOCAL-NAME/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("content package generator creates a valid Chinese - Mandarin Simplified package without Core review deck", async () => {
  const directory = await mkdtemp(join(tmpdir(), "wsm-chinese-simplified-package-"));

  try {
    const result = await generateContentPackage({
      targetId: "chinese-mandarin-simplified-curriculum",
      outputDirectory: directory,
      generatedAt: "2026-07-06T00:00:00Z"
    });
    const archive = await readZip(result.filePath);
    const manifest = JSON.parse(archive.get("manifest.json").toString("utf8"));
    const content = JSON.parse(archive.get("content/content.json").toString("utf8"));

    assert.equal(result.packageId, "com.sleepymario.language.chinese.mandarin.simplified");
    assert.equal(result.filePath.endsWith("com.sleepymario.language.chinese.mandarin.simplified-0.1.0.wspkg"), true);
    assert.deepEqual(validateContentPackageManifest(manifest).errors, []);
    assert.equal(manifest.displayName, "Chinese - Mandarin (Simplified)");
    assert.equal(manifest.description, "Chinese - Mandarin Simplified language curriculum content generated from the canonical Chinese curriculum repository.");
    assert.equal(manifest.contentType, "language-curriculum");
    assert.equal(content.packageId, "com.sleepymario.language.chinese.mandarin.simplified");
    assertUsefulChapterTitles(content.files);
    assert.ok(content.files.some((file) => file.path === "units/mandarin-simplified/introduction-to-hanyu-pinyin/chapter.md"));
    assert.ok(content.files.some((file) => file.path === "units/mandarin-simplified/chapter-001-basic-sentences-1/chapter.md"));
    assert.ok(content.files.some((file) => file.path === "units/mandarin-simplified/chapter-005-basic-sentences-5/chapter.md"));
    assert.equal(content.files.some((file) => file.path === "units/mandarin-simplified/chapter-006-basic-sentences-6/chapter.md"), false);
    assert.equal(content.files.some((file) => file.path.startsWith("units/mandarin-traditional/")), false);
    assert.equal(content.files.some((file) => file.path.startsWith("review-decks/")), false);
    assert.equal([...archive.keys()].some((path) => path.startsWith("content/memorization/")), false);
    const chapter1 = content.files.find((file) => file.path === "units/mandarin-simplified/chapter-001-basic-sentences-1/chapter.md").text;
    assert.match(chapter1, /我是Alex Chen/);
    assert.match(chapter1, /我是林雅婷/);
    assert.match(chapter1, /我是学生/);
    assert.match(chapter1, /\| 学生 \| xuéshēng \| student \|/);
    assert.match(chapter1, /Pinyin: Wǒ shì Lín Yǎtíng\./);
    assert.match(chapter1, /Meaning: I am Lin Yating\./);
    assert.doesNotMatch(chapter1, /\$\{|FOREIGN-NAME|LOCAL-NAME|ㄒㄩㄝˊ/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("content package generator creates a valid Japanese package without Core review deck", async () => {
  const directory = await mkdtemp(join(tmpdir(), "wsm-japanese-package-"));

  try {
    const result = await generateContentPackage({
      targetId: "japanese-curriculum",
      outputDirectory: directory,
      generatedAt: "2026-07-06T00:00:00Z"
    });
    const archive = await readZip(result.filePath);
    const manifest = JSON.parse(archive.get("manifest.json").toString("utf8"));
    const content = JSON.parse(archive.get("content/content.json").toString("utf8"));

    assert.equal(result.packageId, "com.sleepymario.language.japanese");
    assert.equal(result.filePath.endsWith("com.sleepymario.language.japanese-0.1.0.wspkg"), true);
    assert.deepEqual(validateContentPackageManifest(manifest).errors, []);
    assert.equal(manifest.displayName, "Japanese");
    assert.equal(manifest.contentType, "language-curriculum");
    assert.equal(content.packageId, "com.sleepymario.language.japanese");
    assertUsefulChapterTitles(content.files);
    assert.ok(content.files.some((file) => file.path === "units/introduction-to-japanese-writing/hiragana/chapter.md"));
    assert.ok(content.files.some((file) => file.path === "units/introduction-to-japanese-writing/katakana/chapter.md"));
    assert.ok(content.files.some((file) => file.path === "units/introduction-to-japanese-writing/introduction-to-kanji/chapter.md"));
    assert.ok(content.files.some((file) => file.path === "units/japanese-core/chapter-001-basic-sentences-1/chapter.md"));
    assert.ok(content.files.some((file) => file.path === "units/japanese-core/chapter-005-basic-sentences-5/chapter.md"));
    assert.equal(content.files.some((file) => file.path === "units/japanese-core/chapter-006-basic-sentences-6/chapter.md"), false);
    assert.equal(content.files.some((file) => file.path === "review-decks/chapter-001-005/cards.tsv"), false);
    assert.equal([...archive.keys()].some((path) => path.startsWith("content/memorization/")), false);
    assert.match(content.files.find((file) => file.path === "units/introduction-to-japanese-writing/hiragana/chapter.md").text, /future work/);
    assert.match(content.files.find((file) => file.path === "units/introduction-to-japanese-writing/katakana/chapter.md").text, /future work/);
    assert.match(content.files.find((file) => file.path === "units/introduction-to-japanese-writing/introduction-to-kanji/chapter.md").text, /future work/);
    const chapter1 = content.files.find((file) => file.path === "units/japanese-core/chapter-001-basic-sentences-1/chapter.md").text;
    assert.match(chapter1, /アレックスです/);
    assert.match(chapter1, /さくらです/);
    assert.match(chapter1, /学生（がくせい）/);
    assert.match(chapter1, /Meaning: I am a student\./);
    assert.doesNotMatch(chapter1, /\$\{|FOREIGN-NAME|LOCAL-NAME/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("content package generator creates a valid Vietnamese Curriculum package", async () => {
  const directory = await mkdtemp(join(tmpdir(), "wsm-vietnamese-package-"));

  try {
    const result = await generateContentPackage({
      targetId: "vietnamese-curriculum",
      outputDirectory: directory,
      generatedAt: "2026-07-06T00:00:00Z"
    });
    const archive = await readZip(result.filePath);
    const manifest = JSON.parse(archive.get("manifest.json").toString("utf8"));
    const content = JSON.parse(archive.get("content/content.json").toString("utf8"));
    const itemPath = "content/memorization/review-decks/chapter-001-005.json";
    const reviewItems = JSON.parse(archive.get(itemPath).toString("utf8"));

    assert.equal(result.packageId, "com.sleepymario.language.vietnamese");
    assert.equal(result.filePath.endsWith("com.sleepymario.language.vietnamese-0.1.0.wspkg"), true);
    assert.deepEqual(validateContentPackageManifest(manifest).errors, []);
    assert.equal(manifest.contentType, "language-curriculum");
    assert.equal(content.packageId, "com.sleepymario.language.vietnamese");
    assertUsefulChapterTitles(content.files);
    assert.ok(content.files.some((file) => file.path === "name-pools/initial-name-pools.md"));
    assert.ok(content.files.some((file) => file.path === "units/vietnamese-core/chapter-005-basic-sentences-5/chapter.md"));
    assert.ok(content.files.some((file) => file.path === "review-decks/chapter-001-005/cards.tsv"));
    assert.equal(content.files.some((file) => file.path === "units/vietnamese-core/chapter-006-basic-sentences-6/chapter.md"), false);
    assert.equal(content.files.some((file) => file.path.includes("lessons-001-005") || file.path.includes("lesson-001")), false);
    assert.equal(archive.has(itemPath), true);
    assert.equal(archive.has("content/memorization/review-decks/lessons-001-005.json"), false);
    assert.equal(reviewItems.items.length, 46);
    assertCoreReviewItemsHaveExamples(reviewItems.items, "Vietnamese");
    assert.equal(reviewItems.items[0].source.title, "Chapter 1-5");
    assert.ok(reviewItems.items.some((item) => item.prompt.text === "xin chào" && item.answer.text === "hello"));
    assert.ok(reviewItems.items.some((item) => item.prompt.text === "hello" && item.answer.text === "xin chào"));
    assert.equal(reviewItems.items.some((item) => item.source.title === "Lessons 1-5"), false);
    assert.equal(reviewItems.items.some((item) => item.prompt.text === "Tôi là N" || item.answer.text === "Tôi là N"), false);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("content package generator creates a valid Dutch package", async () => {
  const directory = await mkdtemp(join(tmpdir(), "wsm-dutch-package-"));

  try {
    const result = await generateContentPackage({
      targetId: "dutch-curriculum",
      outputDirectory: directory,
      generatedAt: "2026-07-06T00:00:00Z"
    });
    const archive = await readZip(result.filePath);
    const manifest = JSON.parse(archive.get("manifest.json").toString("utf8"));
    const content = JSON.parse(archive.get("content/content.json").toString("utf8"));
    const itemPath = "content/memorization/review-decks/chapter-001-005.json";
    const reviewItems = JSON.parse(archive.get(itemPath).toString("utf8"));

    assert.equal(result.packageId, "com.sleepymario.language.dutch");
    assert.equal(result.filePath.endsWith("com.sleepymario.language.dutch-0.1.0.wspkg"), true);
    assert.deepEqual(validateContentPackageManifest(manifest).errors, []);
    assert.equal(manifest.displayName, "Dutch");
    assert.equal(manifest.contentType, "language-curriculum");
    assert.equal(content.packageId, "com.sleepymario.language.dutch");
    assertUsefulChapterTitles(content.files);
    assert.ok(content.files.some((file) => file.path === "name-pools/initial-name-pools.md"));
    assert.ok(content.files.some((file) => file.path === "units/dutch-core/chapter-005-basic-sentences-5/chapter.md"));
    assert.ok(content.files.some((file) => file.path === "review-decks/chapter-001-005/cards.tsv"));
    assert.equal(content.files.some((file) => file.path === "units/dutch-core/chapter-006-basic-sentences-6/chapter.md"), false);
    assert.equal(archive.has(itemPath), true);
    assert.equal(reviewItems.items.length, 38);
    assertCoreReviewItemsHaveExamples(reviewItems.items, "Dutch");
    assert.equal(reviewItems.items[0].source.title, "Chapter 1-5");
    assert.ok(reviewItems.items.some((item) => item.prompt.text === "hallo" && item.answer.text === "hello"));
    assert.ok(reviewItems.items.some((item) => item.prompt.text === "hello" && item.answer.text === "hallo"));
    const halloItem = reviewItems.items.find((item) => item.prompt.text === "hallo" && item.answer.text === "hello");
    assert.deepEqual(halloItem.examples, ["A: Hallo.", "B: Hallo."]);
    const studentItem = reviewItems.items.find((item) => item.prompt.text === "student" && item.answer.text === "student");
    assert.deepEqual(studentItem.examples, ["A: Ik ben student.", "B: Ik ben student.", "A: Is er een student?"]);
    assert.equal(reviewItems.items.some((item) => item.prompt.text === "Ik ben N" || item.answer.text === "Ik ben N"), false);
    assert.equal(reviewItems.items.some((item) => item.prompt.text === "${FOREIGN-NAME-1}" || item.answer.text === "${FOREIGN-NAME-1}"), false);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("content package generator creates a valid German package", async () => {
  const directory = await mkdtemp(join(tmpdir(), "wsm-german-package-"));

  try {
    const result = await generateContentPackage({
      targetId: "german-curriculum",
      outputDirectory: directory,
      generatedAt: "2026-07-06T00:00:00Z"
    });
    const archive = await readZip(result.filePath);
    const manifest = JSON.parse(archive.get("manifest.json").toString("utf8"));
    const content = JSON.parse(archive.get("content/content.json").toString("utf8"));
    const itemPath = "content/memorization/review-decks/chapter-001-005.json";
    const reviewItems = JSON.parse(archive.get(itemPath).toString("utf8"));

    assert.equal(result.packageId, "com.sleepymario.language.german");
    assert.equal(result.filePath.endsWith("com.sleepymario.language.german-0.1.0.wspkg"), true);
    assert.deepEqual(validateContentPackageManifest(manifest).errors, []);
    assert.equal(manifest.displayName, "German");
    assert.equal(manifest.contentType, "language-curriculum");
    assert.equal(content.packageId, "com.sleepymario.language.german");
    assertUsefulChapterTitles(content.files);
    assert.ok(content.files.some((file) => file.path === "name-pools/initial-name-pools.md"));
    assert.ok(content.files.some((file) => file.path === "units/german-core/chapter-001-basic-sentences-1/chapter.md"));
    assert.ok(content.files.some((file) => file.path === "units/german-core/chapter-005-basic-sentences-5/chapter.md"));
    assert.ok(content.files.some((file) => file.path === "review-decks/chapter-001-005/cards.tsv"));
    assert.equal(content.files.some((file) => file.path === "units/german-core/chapter-006-basic-sentences-6/chapter.md"), false);
    assert.equal(archive.has(itemPath), true);
    assert.equal(reviewItems.items.length, 54);
    assertCoreReviewItemsHaveExamples(reviewItems.items, "German");
    assert.equal(reviewItems.items[0].source.title, "Chapter 1-5");
    assert.ok(reviewItems.items.some((item) => item.prompt.text === "hallo" && item.answer.text === "hello"));
    assert.ok(reviewItems.items.some((item) => item.prompt.text === "hello" && item.answer.text === "hallo"));
    assert.equal(reviewItems.items.some((item) => item.prompt.text === "Ich bin N" || item.answer.text === "Ich bin N"), false);
    assert.equal(reviewItems.items.some((item) => item.prompt.text === "Wie geht es dir?" || item.answer.text === "Wie geht es dir?"), false);
    assert.equal(reviewItems.items.some((item) => item.prompt.text === "Alex Chen" || item.answer.text === "Alex Chen"), false);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("content package generator creates a valid French package", async () => {
  const directory = await mkdtemp(join(tmpdir(), "wsm-french-package-"));

  try {
    const result = await generateContentPackage({
      targetId: "french-curriculum",
      outputDirectory: directory,
      generatedAt: "2026-07-06T00:00:00Z"
    });
    const archive = await readZip(result.filePath);
    const manifest = JSON.parse(archive.get("manifest.json").toString("utf8"));
    const content = JSON.parse(archive.get("content/content.json").toString("utf8"));
    const itemPath = "content/memorization/review-decks/chapter-001-005.json";
    const reviewItems = JSON.parse(archive.get(itemPath).toString("utf8"));

    assert.equal(result.packageId, "com.sleepymario.language.french");
    assert.equal(result.filePath.endsWith("com.sleepymario.language.french-0.1.0.wspkg"), true);
    assert.deepEqual(validateContentPackageManifest(manifest).errors, []);
    assert.equal(manifest.displayName, "French");
    assert.equal(manifest.contentType, "language-curriculum");
    assert.equal(content.packageId, "com.sleepymario.language.french");
    assertUsefulChapterTitles(content.files);
    assert.ok(content.files.some((file) => file.path === "name-pools/initial-name-pools.md"));
    assert.ok(content.files.some((file) => file.path === "units/french-core/chapter-001-basic-sentences-1/chapter.md"));
    assert.ok(content.files.some((file) => file.path === "units/french-core/chapter-005-basic-sentences-5/chapter.md"));
    assert.ok(content.files.some((file) => file.path === "review-decks/chapter-001-005/cards.tsv"));
    assert.equal(content.files.some((file) => file.path === "units/french-core/chapter-006-basic-sentences-6/chapter.md"), false);
    assert.equal(archive.has(itemPath), true);
    assert.equal(reviewItems.items.length, 32);
    assertCoreReviewItemsHaveExamples(reviewItems.items, "French");
    assert.equal(reviewItems.items[0].source.title, "Chapter 1-5");
    assert.ok(reviewItems.items.some((item) => item.prompt.text === "bonjour" && item.answer.text === "hello; good day"));
    assert.ok(reviewItems.items.some((item) => item.prompt.text === "hello; good day" && item.answer.text === "bonjour"));
    const bonjourItem = reviewItems.items.find((item) => item.prompt.text === "bonjour" && item.answer.text === "hello; good day");
    assert.deepEqual(bonjourItem.examples, ["A: Bonjour.", "B: Bonjour."]);
    assert.equal(reviewItems.items.some((item) => item.prompt.text === "Je suis N" || item.answer.text === "Je suis N"), false);
    assert.equal(reviewItems.items.some((item) => item.prompt.text === "Ça va ?" || item.answer.text === "Ça va ?"), false);
    assert.equal(reviewItems.items.some((item) => item.prompt.text === "Alex Chen" || item.answer.text === "Alex Chen"), false);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("content package generator creates a valid Spanish package", async () => {
  const directory = await mkdtemp(join(tmpdir(), "wsm-spanish-package-"));

  try {
    const result = await generateContentPackage({
      targetId: "spanish-curriculum",
      outputDirectory: directory,
      generatedAt: "2026-07-06T00:00:00Z"
    });
    const archive = await readZip(result.filePath);
    const manifest = JSON.parse(archive.get("manifest.json").toString("utf8"));
    const content = JSON.parse(archive.get("content/content.json").toString("utf8"));
    const itemPath = "content/memorization/review-decks/chapter-001-005.json";
    const reviewItems = JSON.parse(archive.get(itemPath).toString("utf8"));

    assert.equal(result.packageId, "com.sleepymario.language.spanish");
    assert.equal(result.filePath.endsWith("com.sleepymario.language.spanish-0.1.0.wspkg"), true);
    assert.deepEqual(validateContentPackageManifest(manifest).errors, []);
    assert.equal(manifest.displayName, "Spanish");
    assert.equal(manifest.contentType, "language-curriculum");
    assert.equal(content.packageId, "com.sleepymario.language.spanish");
    assertUsefulChapterTitles(content.files);
    assert.ok(content.files.some((file) => file.path === "name-pools/initial-name-pools.md"));
    assert.ok(content.files.some((file) => file.path === "units/spanish-core/chapter-001-basic-sentences-1/chapter.md"));
    assert.ok(content.files.some((file) => file.path === "units/spanish-core/chapter-005-basic-sentences-5/chapter.md"));
    assert.ok(content.files.some((file) => file.path === "review-decks/chapter-001-005/cards.tsv"));
    assert.equal(content.files.some((file) => file.path === "units/spanish-core/chapter-006-basic-sentences-6/chapter.md"), false);
    assert.equal(archive.has(itemPath), true);
    assert.equal(reviewItems.items.length, 30);
    assertCoreReviewItemsHaveExamples(reviewItems.items, "Spanish");
    assert.equal(reviewItems.items[0].source.title, "Chapter 1-5");
    assert.ok(reviewItems.items.some((item) => item.prompt.text === "hola" && item.answer.text === "hello; hi"));
    assert.ok(reviewItems.items.some((item) => item.prompt.text === "hello; hi" && item.answer.text === "hola"));
    assert.equal(reviewItems.items.some((item) => item.prompt.text === "Soy N" || item.answer.text === "Soy N"), false);
    assert.equal(reviewItems.items.some((item) => item.prompt.text === "¿Cómo estás?" || item.answer.text === "¿Cómo estás?"), false);
    assert.equal(reviewItems.items.some((item) => item.prompt.text === "Alex Chen" || item.answer.text === "Alex Chen"), false);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("content package generation is deterministic for identical inputs", async () => {
  const firstDirectory = await mkdtemp(join(tmpdir(), "wsm-package-first-"));
  const secondDirectory = await mkdtemp(join(tmpdir(), "wsm-package-second-"));

  try {
    const first = await generateContentPackage({
      targetId: "linguistic-terminology",
      outputDirectory: firstDirectory,
      generatedAt: "2026-07-06T00:00:00Z"
    });
    const second = await generateContentPackage({
      targetId: "linguistic-terminology",
      outputDirectory: secondDirectory,
      generatedAt: "2026-07-06T00:00:00Z"
    });

    assert.equal(await fileSha256(first.filePath), await fileSha256(second.filePath));
    assert.equal(first.archiveSha256, second.archiveSha256);
  } finally {
    await rm(firstDirectory, { recursive: true, force: true });
    await rm(secondDirectory, { recursive: true, force: true });
  }
});

test("content package generator CLI can build all local test targets", async () => {
  const directory = await mkdtemp(join(tmpdir(), "wsm-package-cli-"));

  try {
    const result = await runNode([
      "dist/packages/core/content-package-generator-cli.js",
      "--output-dir",
      directory,
      "--target",
      "linguistic-terminology",
      "--target",
      "korean-curriculum",
      "--target",
      "chinese-mandarin-traditional-curriculum",
      "--target",
      "chinese-mandarin-simplified-curriculum",
      "--target",
      "japanese-curriculum",
      "--target",
      "vietnamese-curriculum",
      "--target",
      "dutch-curriculum",
      "--target",
      "german-curriculum",
      "--target",
      "french-curriculum",
      "--target",
      "spanish-curriculum"
    ]);

    assert.equal(result.exitCode, 0);
    assert.match(result.stdout, /Package generated: com\.sleepymario\.language\.linguistic-terminology/);
    assert.match(result.stdout, /Package generated: com\.sleepymario\.language\.korean/);
    assert.match(result.stdout, /Package generated: com\.sleepymario\.language\.chinese\.mandarin\.traditional/);
    assert.match(result.stdout, /Package generated: com\.sleepymario\.language\.chinese\.mandarin\.simplified/);
    assert.match(result.stdout, /Package generated: com\.sleepymario\.language\.japanese/);
    assert.match(result.stdout, /Package generated: com\.sleepymario\.language\.vietnamese/);
    assert.match(result.stdout, /Package generated: com\.sleepymario\.language\.dutch/);
    assert.match(result.stdout, /Package generated: com\.sleepymario\.language\.german/);
    assert.match(result.stdout, /Package generated: com\.sleepymario\.language\.french/);
    assert.match(result.stdout, /Package generated: com\.sleepymario\.language\.spanish/);
    assert.equal(result.stderr, "");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

async function readZip(filePath) {
  const buffer = await readFile(filePath);
  const entries = new Map();
  let offset = 0;

  while (buffer.readUInt32LE(offset) === 0x04034b50) {
    const compressionMethod = buffer.readUInt16LE(offset + 8);
    assert.equal(compressionMethod, 0);

    const compressedSize = buffer.readUInt32LE(offset + 18);
    const fileNameLength = buffer.readUInt16LE(offset + 26);
    const extraLength = buffer.readUInt16LE(offset + 28);
    const nameStart = offset + 30;
    const dataStart = nameStart + fileNameLength + extraLength;
    const name = buffer.subarray(nameStart, nameStart + fileNameLength).toString("utf8");
    const data = buffer.subarray(dataStart, dataStart + compressedSize);
    entries.set(name, data);
    offset = dataStart + compressedSize;
  }

  return entries;
}

function assertCoreReviewItemsHaveExamples(items, label) {
  const missing = items.filter((item) => (item.examples?.length ?? 0) === 0);
  const tooMany = items.filter((item) => (item.examples?.length ?? 0) > 3);
  const tableExamples = items.flatMap((item) => (item.examples ?? [])
    .filter((example) => example.startsWith("|"))
    .map((example) => `${item.prompt.text} -> ${item.answer.text}: ${example}`));

  assert.deepEqual(
    missing.map((item) => `${item.prompt.text} -> ${item.answer.text}`),
    [],
    `${label} core review items must have source examples`
  );
  assert.deepEqual(
    tooMany.map((item) => `${item.prompt.text} -> ${item.answer.text}`),
    [],
    `${label} core review items must have at most 3 source examples`
  );
  assert.deepEqual(tableExamples, [], `${label} core review items must not use vocabulary table rows as examples`);
}

function assertKoreanStrictReadContentExamples(items, contentFiles) {
  const readContentLines = new Set(
    contentFiles
      .filter((file) => /^units\/korean-core\/chapter-\d+[^/]*\/chapter\.md$/u.test(file.path))
      .flatMap((file) => extractKoreanReadContentLinesForTest(file.text))
  );
  const invalidExamples = [];
  const tooMany = [];
  const missingTagged = [];

  for (const item of items) {
    if ((item.examples?.length ?? 0) > 3) {
      tooMany.push(`${item.prompt.text} -> ${item.answer.text}`);
    }
    if (item.tags?.includes("missing-source-example")) {
      missingTagged.push(`${item.prompt.text} -> ${item.answer.text}`);
      assert.equal(item.examples, undefined);
    }
    for (const example of item.examples ?? []) {
      if (!readContentLines.has(example)) {
        invalidExamples.push(`${item.prompt.text} -> ${item.answer.text}: ${example}`);
      }
      assert.doesNotMatch(example, /^\|/u);
      assert.doesNotMatch(example, /^Meaning:/iu);
      assert.doesNotMatch(example, /KOR-GRAMMAR/u);
    }
  }

  assert.deepEqual(invalidExamples, [], "Korean examples must be literal lines from read content only");
  assert.deepEqual(tooMany, [], "Korean review items must have at most 3 examples");
  assert.deepEqual(missingTagged, [], "Korean review items must not ship missing-source-example placeholders");
}

function findReviewTerms(items, terms) {
  const termSet = new Set(terms);
  return items
    .filter((item) => termSet.has(item.prompt.text) || termSet.has(item.answer.text))
    .map((item) => `${item.prompt.text} -> ${item.answer.text}`);
}

function grammarInventoryLines(markdown) {
  return markdown.split(/\r?\n/u).filter((line) => /^- KOR-GRAMMAR-\d+/u.test(line));
}

function grammarSharedCoverageLines(markdown) {
  const lines = [];
  let inSharedCoverage = false;
  for (const line of markdown.split(/\r?\n/u)) {
    if (line === "## Shared Coverage") {
      inSharedCoverage = true;
      continue;
    }
    if (inSharedCoverage && line.startsWith("## ")) {
      break;
    }
    if (inSharedCoverage && line.startsWith("- ")) {
      lines.push(line);
    }
  }
  return lines;
}

function assertKoreanGrammarSummaryPair(files, start, end, expectedInventory) {
  const grammarEasy = files.find((file) => file.path === `units/korean-core/chapter-${start}-${end}-grammar-easy/chapter.md`);
  const grammarHard = files.find((file) => file.path === `units/korean-core/chapter-${start}-${end}-grammar-hard/chapter.md`);
  assert.ok(grammarEasy);
  assert.ok(grammarHard);
  assert.match(grammarEasy.text, /^# Grammar - Easy$/mu);
  assert.match(grammarHard.text, /^# Grammar - Hard$/mu);
  assert.match(grammarEasy.text, /^## Plain Summary$/mu);
  assert.match(grammarHard.text, /^## Technical Summary$/mu);
  assert.deepEqual(grammarInventoryLines(grammarEasy.text), grammarInventoryLines(grammarHard.text));
  assert.deepEqual(grammarSharedCoverageLines(grammarEasy.text), grammarSharedCoverageLines(grammarHard.text));
  assert.ok(grammarSharedCoverageLines(grammarEasy.text).length <= 6, "Shared Coverage should stay a short checklist");
  assert.deepEqual(grammarInventoryLines(grammarEasy.text), expectedInventory);
  assert.deepEqual(grammarInventoryLines(grammarEasy.text), koreanGrammarInventoryFromChapterFiles(files, start, end));
  assert.notEqual(normalizeGrammarSummaryText(grammarEasy.text), normalizeGrammarSummaryText(grammarHard.text));
  const easyExplanation = grammarSection(grammarEasy.text, "## Plain Summary");
  const hardExplanation = grammarSection(grammarHard.text, "## Technical Summary");
  assert.notEqual(normalizeGrammarSummaryText(easyExplanation), normalizeGrammarSummaryText(hardExplanation));
  assert.ok(
    grammarProseSimilarity(easyExplanation, hardExplanation) < 0.45,
    "Easy and Hard explanation prose must not be near-identical"
  );
  assert.notDeepEqual(paragraphShapes(easyExplanation), paragraphShapes(hardExplanation), "Easy and Hard should not use the same paragraph structure");
  assert.match(grammarEasy.text, /\b(?:you|Use|means|For now|Do not worry|Think of)\b/u);
  assert.match(grammarHard.text, /\b(?:copula|declarative|interrogative|existential|register|predicate|deferential)\b/u);
  return {
    start,
    end,
    easyText: grammarEasy.text,
    hardText: grammarHard.text,
    inventory: grammarInventoryLines(grammarEasy.text),
    sharedCoverage: grammarSharedCoverageLines(grammarEasy.text)
  };
}

function assertKoreanGrammarSummariesAreBlockSpecific(summaries) {
  for (let leftIndex = 0; leftIndex < summaries.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < summaries.length; rightIndex += 1) {
      const left = summaries[leftIndex];
      const right = summaries[rightIndex];
      assert.notDeepEqual(left.inventory, right.inventory, `${left.start}-${left.end} and ${right.start}-${right.end} grammar inventories must differ`);
      assert.notDeepEqual(left.sharedCoverage, right.sharedCoverage, `${left.start}-${left.end} and ${right.start}-${right.end} shared coverage must differ`);
      assert.notEqual(normalizeGrammarSummaryText(left.easyText), normalizeGrammarSummaryText(right.easyText));
      assert.notEqual(normalizeGrammarSummaryText(left.hardText), normalizeGrammarSummaryText(right.hardText));
    }
  }
}

function koreanGrammarInventoryFromChapterFiles(files, start, end) {
  const startNumber = Number.parseInt(start, 10);
  const endNumber = Number.parseInt(end, 10);
  return files
    .filter((file) => {
      const match = file.path.match(/^units\/korean-core\/chapter-0*(\d+)-basic-life-sentences-\d+\/chapter\.md$/u);
      if (match === null) {
        return false;
      }
      const chapterNumber = Number.parseInt(match[1], 10);
      return chapterNumber >= startNumber && chapterNumber <= endNumber;
    })
    .sort((left, right) => left.path.localeCompare(right.path))
    .map((file) => {
      const match = file.text.match(/^grammar_point:\s*"([^"]+)"$/mu);
      assert.ok(match, `${file.path} must declare a grammar_point`);
      return `- ${match[1]}`;
    });
}

function grammarSection(markdown, heading) {
  const lines = [];
  let inSection = false;
  for (const line of markdown.split(/\r?\n/u)) {
    if (line === heading) {
      inSection = true;
      continue;
    }
    if (inSection && line.startsWith("## ")) {
      break;
    }
    if (inSection) {
      lines.push(line);
    }
  }
  return lines.join("\n");
}

function normalizeGrammarSummaryText(markdown) {
  return markdown.replace(/\s+/gu, " ").trim();
}

function grammarProseSimilarity(left, right) {
  const leftWords = grammarWordSet(left);
  const rightWords = grammarWordSet(right);
  const intersection = [...leftWords].filter((word) => rightWords.has(word)).length;
  const union = new Set([...leftWords, ...rightWords]).size;
  return union === 0 ? 0 : intersection / union;
}

function grammarWordSet(text) {
  const stopWords = new Set([
    "a", "an", "and", "are", "as", "at", "be", "by", "for", "from", "in", "is", "it", "of", "on", "or", "the", "this", "to", "with"
  ]);
  return new Set(text
    .toLowerCase()
    .replace(/`[^`]+`/gu, " ")
    .split(/[^a-z가-힣]+/u)
    .filter((word) => word.length > 2 && !stopWords.has(word)));
}

function paragraphShapes(markdown) {
  return markdown
    .split(/\n{2,}/u)
    .map((paragraph) => {
      const trimmed = paragraph.trim();
      if (trimmed.length === 0) {
        return undefined;
      }
      if (trimmed.startsWith("- ")) {
        return "list";
      }
      return trimmed.split(/\s+/u).length;
    })
    .filter((shape) => shape !== undefined);
}

function extractKoreanReadContentLinesForTest(markdown) {
  const lines = [];
  let inFrontMatter = false;
  let inReadSection = false;
  let inFence = false;
  let inTextFence = false;
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
    if (/^#{2,4}\s+(?:Model Mini Dialogue|Model Mini Text|Learner-facing Dialogue|Controlled Reading)\b/iu.test(trimmed)) {
      inReadSection = true;
      continue;
    }
    if (/^#{2,4}\s+/u.test(trimmed)) {
      inReadSection = false;
      continue;
    }
    if (trimmed.startsWith("```")) {
      if (inFence) {
        inFence = false;
        inTextFence = false;
      } else {
        inFence = true;
        inTextFence = inReadSection && /^```(?:text)?\s*$/iu.test(trimmed);
      }
      continue;
    }
    if (inTextFence && trimmed.length > 0) {
      lines.push(trimmed);
    }
  }
  return lines;
}

function assertUsefulChapterTitles(files) {
  const chapterFiles = files.filter((file) => file.path.endsWith("/chapter.md"));
  assert.ok(chapterFiles.length > 0);

  for (const file of chapterFiles) {
    const title = file.text.match(/^title:\s*"([^"]+)"$/mu)?.[1]?.trim();
    const heading = file.text.match(/^#\s+(.+)$/mu)?.[1]?.trim();
    for (const value of [title, heading].filter((candidate) => candidate !== undefined)) {
      assert.doesNotMatch(value, /^(?:\.{3}|…|\W*)$/u, `${file.path} has an invalid placeholder title`);
      assert.doesNotMatch(value, /\bBasic (?:Life )?Sentences\b/u, `${file.path} still uses a basic-sentences placeholder title`);
    }
  }

  const koreanChapter1 = chapterFiles.find((file) => file.path === "units/korean-core/chapter-001-basic-life-sentences-1/chapter.md");
  if (koreanChapter1 !== undefined) {
    assert.match(koreanChapter1.text, /title: "Names and First Greetings"/u);
    assert.match(koreanChapter1.text, /^# Chapter 1 -- Names and First Greetings$/mu);
  }
}

async function fileSha256(path) {
  return createHash("sha256").update(await readFile(path)).digest("hex");
}

async function runNode(args) {
  const child = spawn(process.execPath, args, {
    cwd: process.cwd(),
    stdio: ["ignore", "pipe", "pipe"]
  });

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
    const timeout = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`CLI timed out: ${args.join(" ")}`));
    }, 10000);

    child.on("error", reject);
    child.on("close", (code) => {
      clearTimeout(timeout);
      resolve(code);
    });
  });

  return { exitCode, stdout, stderr };
}
