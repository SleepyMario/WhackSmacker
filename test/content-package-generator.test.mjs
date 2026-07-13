import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { spawn } from "node:child_process";
import { test } from "node:test";

import {
  contentPackageGeneratorTargets,
  generateContentPackage,
  resolveContentPackageSourcePath,
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
      ["english-curriculum", "com.sleepymario.language.english"],
      ["english-curriculum-source-zh-tw", "com.sleepymario.language.english.source.zh-tw"],
      ["english-curriculum-source-en", "com.sleepymario.language.english.source.en"],
      ["japanese-curriculum", "com.sleepymario.language.japanese"],
      ["vietnamese-curriculum", "com.sleepymario.language.vietnamese"],
      ["dutch-curriculum", "com.sleepymario.language.dutch"],
      ["german-curriculum", "com.sleepymario.language.german"],
      ["french-curriculum", "com.sleepymario.language.french"],
      ["spanish-curriculum", "com.sleepymario.language.spanish"],
      ["korean-core-reviews", "com.sleepymario.language.korean.reviews"],
      ["chinese-traditional-core-reviews", "com.sleepymario.language.chinese.mandarin.traditional.reviews"],
      ["chinese-simplified-core-reviews", "com.sleepymario.language.chinese.mandarin.simplified.reviews"],
      ["english-core-reviews", "com.sleepymario.language.english.reviews"],
      ["japanese-core-reviews", "com.sleepymario.language.japanese.reviews"],
      ["vietnamese-core-reviews", "com.sleepymario.language.vietnamese.reviews"],
      ["dutch-core-reviews", "com.sleepymario.language.dutch.reviews"],
      ["german-core-reviews", "com.sleepymario.language.german.reviews"],
      ["french-core-reviews", "com.sleepymario.language.french.reviews"],
      ["spanish-core-reviews", "com.sleepymario.language.spanish.reviews"]
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
    const readingArchive = await readZip(result.filePath);
    const manifest = JSON.parse(readingArchive.get("manifest.json").toString("utf8"));
    const { archive, content } = await mergedSplitArchive(readingArchive, directory, "korean-core-reviews");

    assert.equal(result.packageId, "com.sleepymario.language.korean");
    assert.equal(result.filePath.endsWith("com.sleepymario.language.korean-0.1.0.wspkg"), true);
    assert.deepEqual(validateContentPackageManifest(manifest).errors, []);
    assert.equal(manifest.contentType, "language-curriculum");
    assert.equal(manifest.dependencies[0].packageId, "com.sleepymario.language.linguistic-terminology");
    assert.equal(content.packageId, "com.sleepymario.language.korean");
    assertOddEvenChapterFormats(content.files, "Korean", content.packageId);
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
    assert.match(koreanChapter1.text, /마리아: 안녕하세요\. 저는 마리아 가르시아입니다\./u);
    assert.match(koreanChapter1.text, /김민준: 안녕하세요\. 저는 김민준입니다\./u);
    assert.doesNotMatch(koreanChapter1.text, /Maria/u);
    assert.doesNotMatch(koreanChapter1.text, /^마리아 가르시아:/mu);
    assert.doesNotMatch(koreanChapter1.text, /^A: /mu);
    assert.doesNotMatch(koreanChapter1.text, /^B: /mu);
    assertNoGenericDialogueSpeakerLabels(content.files, "Korean");
    assertDialogueBlocksHaveIntroductionsAndAlignedColons(content.files, "Korean");
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

    for (const deck of expectedReviewDecks) {
      assert.ok(content.files.some((file) => file.path === deck.sourcePath));
      assert.equal(archive.has(deck.itemPath), true);
    }
    assert.equal(content.files.some((file) => file.path === "review-decks/chapter-001-020/cards.tsv"), false);
    assert.equal(content.files.some((file) => file.path === "review-decks/chapter-008-010/cards.tsv"), false);
    assert.equal(archive.has("content/memorization/review-decks/chapter-001-020.json"), false);
    assert.equal(archive.has("content/memorization/review-decks/chapter-008-010.json"), false);

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
    assert.equal(allReviewItems.some((item) => item.source.title === "Chapter 16-20"), true);
    assert.equal(allReviewItems.some((item) => item.source.title === "Chapter 21-25"), true);
    assert.equal(allReviewItems.some((item) => item.source.title === "Chapter 26-30"), true);
    assert.equal(allReviewItems.some((item) => item.source.title === "Chapter 31-35"), true);
    assert.equal(allReviewItems.some((item) => item.source.title === "Chapter 36-40"), true);
    assert.equal(allReviewItems.some((item) => item.source.title === "Chapter 41-45"), true);
    assert.equal(allReviewItems.some((item) => item.source.title === "Chapter 46-50"), true);
    assert.equal(allReviewItems.some((item) => item.prompt.text === "저는 N입니다" || item.answer.text === "저는 N입니다"), false);

    const studentItem = allReviewItems.find((item) => item.prompt.text === "학생" && item.answer.text === "student");
    const helloItem = allReviewItems.find((item) => item.prompt.text === "안녕하세요" && item.answer.text === "hello");
    const existsItem = allReviewItems.find((item) => item.prompt.text === "있다" && item.answer.text === "to exist / to have");
    const markerItem = allReviewItems.find((item) => item.prompt.text === "이/가" && item.answer.text === "subject/existence marker");
    assert.equal([helloItem, studentItem, existsItem, markerItem].every(item => item.examples === undefined), true);
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
    const grammarSummary3135 = assertKoreanGrammarSummaryPair(content.files, "031", "035", [
      "- KOR-GRAMMAR-031A -- V-아서/어서", "- KOR-GRAMMAR-031B -- N 전에",
      "- KOR-GRAMMAR-032A -- 그런데", "- KOR-GRAMMAR-032B -- N까지",
      "- KOR-GRAMMAR-033A -- 그래서", "- KOR-GRAMMAR-033B -- V-아/어 보다",
      "- KOR-GRAMMAR-034A -- 그리고", "- KOR-GRAMMAR-034B -- N마다",
      "- KOR-GRAMMAR-035A -- V-지만", "- KOR-GRAMMAR-035B -- N보다"
    ]);
    const grammarSummary3640 = assertKoreanGrammarSummaryPair(content.files, "036", "040", [
      "- KOR-GRAMMAR-036A -- 그러나", "- KOR-GRAMMAR-036B -- V-(으)려고 하다",
      "- KOR-GRAMMAR-037A -- V-고 나서", "- KOR-GRAMMAR-037B -- N에서 N까지",
      "- KOR-GRAMMAR-038A -- V-기 때문에", "- KOR-GRAMMAR-038B -- V-(으)ㄹ 수 있다",
      "- KOR-GRAMMAR-039A -- 그래서", "- KOR-GRAMMAR-039B -- N도 N도",
      "- KOR-GRAMMAR-040A -- V-는데", "- KOR-GRAMMAR-040B -- V-(으)ㄴ 적이 있다"
    ]);
    const grammarSummary4145 = assertKoreanGrammarSummaryPair(content.files, "041", "045", [
      "- KOR-GRAMMAR-041 -- Native Korean number + counter",
      "- KOR-GRAMMAR-042 -- Native Korean 11-20 and 스무 before counters",
      "- KOR-GRAMMAR-043 -- 몇 + counter",
      "- KOR-GRAMMAR-044 -- Native hours and ages with Sino-Korean minutes",
      "- KOR-GRAMMAR-045 -- Sino-Korean number formation and counters"
    ]);
    const grammarSummary4650 = assertKoreanGrammarSummaryPair(content.files, "046", "050", [
      "- KOR-GRAMMAR-046 -- Sino-Korean calendar dates and numbered locations",
      "- KOR-GRAMMAR-047 -- Neutral 명 and honorific 분",
      "- KOR-GRAMMAR-048 -- N씩 distribution",
      "- KOR-GRAMMAR-049 -- Quantity + 정도 for approximation",
      "- KOR-GRAMMAR-050 -- Selecting native and Sino-Korean numbers by context"
    ]);
    assertKoreanChapters3135And3640(content.files);
    assertKoreanChapters4150(content.files);
    assertKoreanGrammarSummariesAreBlockSpecific([grammarSummary0105, grammarSummary0610, grammarSummary1115, grammarSummary3135, grammarSummary3640, grammarSummary4145, grammarSummary4650]);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("content package generator creates a valid Chinese - Mandarin Traditional package with conversion and core decks", async () => {
  const directory = await mkdtemp(join(tmpdir(), "wsm-chinese-traditional-package-"));

  try {
    const result = await generateContentPackage({
      targetId: "chinese-mandarin-traditional-curriculum",
      outputDirectory: directory,
      generatedAt: "2026-07-06T00:00:00Z"
    });
    const readingArchive = await readZip(result.filePath);
    const manifest = JSON.parse(readingArchive.get("manifest.json").toString("utf8"));
    const { archive, content } = await mergedSplitArchive(readingArchive, directory, "chinese-traditional-core-reviews");
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
      },
      {
        title: "Chapter 1-5",
        sourcePath: "review-decks/mandarin-traditional-chapter-001-005/cards.tsv",
        itemPath: "content/memorization/review-decks/mandarin-traditional-chapter-001-005.json",
        itemCount: 120
      }
    ];

    assert.equal(result.packageId, "com.sleepymario.language.chinese.mandarin.traditional");
    assert.equal(result.filePath.endsWith("com.sleepymario.language.chinese.mandarin.traditional-0.1.0.wspkg"), true);
    assert.deepEqual(validateContentPackageManifest(manifest).errors, []);
    assert.equal(manifest.displayName, "Chinese - Mandarin (Traditional)");
    assert.equal(manifest.description, "Chinese - Mandarin Traditional language curriculum content generated from the canonical Chinese curriculum repository.");
    assert.equal(manifest.contentType, "language-curriculum");
    assert.equal(content.packageId, "com.sleepymario.language.chinese.mandarin.traditional");
    assertOddEvenChapterFormats(content.files, "Chinese Traditional", content.packageId);
    assertUsefulChapterTitles(content.files);
    assertDialogueBlocksHaveIntroductionsAndAlignedColons(content.files, "Chinese Traditional");
    assert.ok(content.files.some((file) => file.path === "units/mandarin-traditional/introduction-to-hanyu-pinyin/chapter.md"));
    assert.ok(content.files.some((file) => file.path === "units/mandarin-traditional/chapter-001-basic-sentences-1/chapter.md"));
    assert.ok(content.files.some((file) => file.path === "units/mandarin-traditional/chapter-005-basic-sentences-5/chapter.md"));
    assert.ok(content.files.some((file) => file.path === "units/mandarin-traditional/chapter-001-005-grammar-easy/chapter.md"));
    assert.ok(content.files.some((file) => file.path === "units/mandarin-traditional/chapter-001-005-grammar-hard/chapter.md"));
    assert.equal(content.files.some((file) => file.path === "units/mandarin-traditional/chapter-006-basic-sentences-6/chapter.md"), true);
    assert.equal(content.files.some((file) => file.path.startsWith("units/mandarin-simplified/")), false);
    assert.equal(content.files.some((file) => file.path === "review-decks/mandarin-simplified-chapter-001-005/cards.tsv"), false);
    assert.equal(archive.has("content/memorization/review-decks/mandarin-simplified-chapter-001-005.json"), false);

    for (const deck of expectedReviewDecks) {
      assert.ok(content.files.some((file) => file.path === deck.sourcePath));
      assert.equal(archive.has(deck.itemPath), true);
      const collection = JSON.parse(archive.get(deck.itemPath).toString("utf8"));
      assert.equal(collection.items.length, deck.itemCount);
      assert.equal(collection.items[0].source.title, deck.title);
      assert.equal(collection.items[0].source.path, deck.sourcePath);
    }

    const conversionItems = expectedReviewDecks
      .filter((deck) => deck.sourcePath.startsWith("review-decks/pinyin-"))
      .flatMap((deck) => JSON.parse(archive.get(deck.itemPath).toString("utf8")).items);
    const coreItems = JSON.parse(archive.get("content/memorization/review-decks/mandarin-traditional-chapter-001-005.json").toString("utf8")).items;
    assert.equal(conversionItems.some((item) => item.examples !== undefined), false);
    assert.ok(conversionItems.some((item) => item.prompt.text === "b" && item.answer.text === "ㄅ"));
    assert.ok(conversionItems.some((item) => item.prompt.text === "ㄅ" && item.answer.text === "b"));
    assert.ok(conversionItems.some((item) => item.prompt.text === "mā" && item.answer.text === "ㄇㄚ"));
    assert.ok(conversionItems.some((item) => item.prompt.text === "ㄇㄚˊ" && item.answer.text === "má"));
    assert.equal(conversionItems.some((item) => item.kind === "sentence" || item.kind === "concept"), false);
    assertCoreReviewItemsHaveExamples(coreItems, "Traditional Mandarin");
    assert.equal(coreItems.length, 120);
    assert.ok(coreItems.some((item) => item.prompt.text === "Meaning: hello" && item.answer.text.includes("Characters: 你好")));
    assert.ok(coreItems.some((item) => item.prompt.text === "Characters: 學生" && item.answer.text.includes("Pinyin: xuéshēng")));
    assert.ok(coreItems.some((item) => item.prompt.text.includes("Pinyin: nǐ hǎo") && item.prompt.text.includes("Zhuyin: ㄋㄧˇ ㄏㄠˇ")));
    assert.ok(coreItems.every((item) => item.examples === undefined));
    const pinyinIntro = content.files.find((file) => file.path === "units/mandarin-traditional/introduction-to-hanyu-pinyin/chapter.md").text;
    const chapter1 = content.files.find((file) => file.path === "units/mandarin-traditional/chapter-001-basic-sentences-1/chapter.md").text;
    assert.match(pinyinIntro, /Hanyu Pinyin is the standard romanization system/);
    assert.match(chapter1, /我是馬莉亞/);
    assert.match(chapter1, /我是林雅婷/);
    assert.match(chapter1, /\|\s*學生\s*\|\s*xuéshēng\s*\|\s*ㄒㄩㄝˊ ㄕㄥ\s*\|\s*student\s*\|/);
    assert.match(chapter1, /Lín Yǎtíng: Wǒ shì Lín Yǎtíng\./);
    assert.match(chapter1, /Lin Yating: I am Lin Yating\./);
    assert.doesNotMatch(chapter1, /\$\{|FOREIGN-NAME|LOCAL-NAME/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("content package generator creates a valid Chinese - Mandarin Simplified package with core review deck", async () => {
  const directory = await mkdtemp(join(tmpdir(), "wsm-chinese-simplified-package-"));

  try {
    const result = await generateContentPackage({
      targetId: "chinese-mandarin-simplified-curriculum",
      outputDirectory: directory,
      generatedAt: "2026-07-06T00:00:00Z"
    });
    const readingArchive = await readZip(result.filePath);
    const manifest = JSON.parse(readingArchive.get("manifest.json").toString("utf8"));
    const { archive, content } = await mergedSplitArchive(readingArchive, directory, "chinese-simplified-core-reviews");

    assert.equal(result.packageId, "com.sleepymario.language.chinese.mandarin.simplified");
    assert.equal(result.filePath.endsWith("com.sleepymario.language.chinese.mandarin.simplified-0.1.0.wspkg"), true);
    assert.deepEqual(validateContentPackageManifest(manifest).errors, []);
    assert.equal(manifest.displayName, "Chinese - Mandarin (Simplified)");
    assert.equal(manifest.description, "Chinese - Mandarin Simplified language curriculum content generated from the canonical Chinese curriculum repository.");
    assert.equal(manifest.contentType, "language-curriculum");
    assert.equal(content.packageId, "com.sleepymario.language.chinese.mandarin.simplified");
    assertOddEvenChapterFormats(content.files, "Chinese Simplified", content.packageId);
    assertUsefulChapterTitles(content.files);
    assertDialogueBlocksHaveIntroductionsAndAlignedColons(content.files, "Chinese Simplified");
    assert.ok(content.files.some((file) => file.path === "units/mandarin-simplified/introduction-to-hanyu-pinyin/chapter.md"));
    assert.ok(content.files.some((file) => file.path === "units/mandarin-simplified/chapter-001-basic-sentences-1/chapter.md"));
    assert.ok(content.files.some((file) => file.path === "units/mandarin-simplified/chapter-005-basic-sentences-5/chapter.md"));
    assert.ok(content.files.some((file) => file.path === "units/mandarin-simplified/chapter-001-005-grammar-easy/chapter.md"));
    assert.ok(content.files.some((file) => file.path === "units/mandarin-simplified/chapter-001-005-grammar-hard/chapter.md"));
    assert.equal(content.files.some((file) => file.path === "units/mandarin-simplified/chapter-006-basic-sentences-6/chapter.md"), true);
    assert.equal(content.files.some((file) => file.path.startsWith("units/mandarin-traditional/")), false);
    assert.ok(content.files.some((file) => file.path === "review-decks/mandarin-simplified-chapter-001-005/cards.tsv"));
    assert.equal(content.files.some((file) => file.path === "review-decks/mandarin-traditional-chapter-001-005/cards.tsv"), false);
    assert.equal(content.files.some((file) => file.path.startsWith("review-decks/pinyin-zhuyin")), false);
    assert.equal(archive.has("content/memorization/review-decks/mandarin-simplified-chapter-001-005.json"), true);
    const coreItems = JSON.parse(archive.get("content/memorization/review-decks/mandarin-simplified-chapter-001-005.json").toString("utf8")).items;
    assert.equal(coreItems.length, 120);
    assertCoreReviewItemsHaveExamples(coreItems, "Simplified Mandarin");
    assert.ok(coreItems.some((item) => item.prompt.text === "Meaning: hello" && item.answer.text.includes("Characters: 你好")));
    assert.ok(coreItems.some((item) => item.prompt.text === "Characters: 学生" && item.answer.text.includes("Pinyin: xuéshēng")));
    assert.equal(coreItems.some((item) => item.prompt.text.includes("Zhuyin:") || item.answer.text.includes("Zhuyin:")), false);
    const chapter1 = content.files.find((file) => file.path === "units/mandarin-simplified/chapter-001-basic-sentences-1/chapter.md").text;
    assert.match(chapter1, /我是玛莉亚/);
    assert.match(chapter1, /我是林雅婷/);
    assert.match(chapter1, /我是学生/);
    assert.match(chapter1, /\|\s*学生\s*\|\s*xuéshēng\s*\|\s*student\s*\|/);
    assert.match(chapter1, /Lín Yǎtíng: Wǒ shì Lín Yǎtíng\./);
    assert.match(chapter1, /Lin Yating: I am Lin Yating\./);
    assert.doesNotMatch(chapter1, /\$\{|FOREIGN-NAME|LOCAL-NAME|ㄒㄩㄝˊ/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("content package generator creates a valid Japanese package with Core review deck", async () => {
  const directory = await mkdtemp(join(tmpdir(), "wsm-japanese-package-"));

  try {
    const result = await generateContentPackage({
      targetId: "japanese-curriculum",
      outputDirectory: directory,
      generatedAt: "2026-07-06T00:00:00Z"
    });
    const readingArchive = await readZip(result.filePath);
    const manifest = JSON.parse(readingArchive.get("manifest.json").toString("utf8"));
    const { archive, content } = await mergedSplitArchive(readingArchive, directory, "japanese-core-reviews");

    assert.equal(result.packageId, "com.sleepymario.language.japanese");
    assert.equal(result.filePath.endsWith("com.sleepymario.language.japanese-0.1.0.wspkg"), true);
    assert.deepEqual(validateContentPackageManifest(manifest).errors, []);
    assert.equal(manifest.displayName, "Japanese");
    assert.equal(manifest.contentType, "language-curriculum");
    assert.equal(content.packageId, "com.sleepymario.language.japanese");
    assertOddEvenChapterFormats(content.files, "Japanese", content.packageId);
    assertUsefulChapterTitles(content.files);
    assertDialogueBlocksHaveIntroductionsAndAlignedColons(content.files, "Japanese");
    assert.ok(content.files.some((file) => file.path === "units/introduction-to-japanese-writing/hiragana/chapter.md"));
    assert.ok(content.files.some((file) => file.path === "units/introduction-to-japanese-writing/katakana/chapter.md"));
    assert.ok(content.files.some((file) => file.path === "units/introduction-to-japanese-writing/introduction-to-kanji/chapter.md"));
    assert.ok(content.files.some((file) => file.path === "units/japanese-core/chapter-001-basic-sentences-1/chapter.md"));
    assert.ok(content.files.some((file) => file.path === "units/japanese-core/chapter-005-basic-sentences-5/chapter.md"));
    assert.ok(content.files.some((file) => file.path === "units/japanese-core/chapter-001-005-grammar-easy/chapter.md"));
    assert.ok(content.files.some((file) => file.path === "units/japanese-core/chapter-001-005-grammar-hard/chapter.md"));
    assert.equal(content.files.some((file) => file.path === "units/japanese-core/chapter-006-basic-sentences-6/chapter.md"), true);
    for (const chapter of [11, 12, 13, 14, 15, 16, 17, 18, 19, 20]) {
      const chapterFile = content.files.find((file) => !file.path.includes("-grammar-") && new RegExp(`units/japanese-core/chapter-${String(chapter).padStart(3, "0")}-[^/]+/chapter\\.md$`).test(file.path));
      assert.ok(chapterFile);
      const sourceText = await readFile(join(sourceRepositoryPath("japanese-curriculum"), chapterFile.path), "utf8");
      assert.match(sourceText, new RegExp(`JPN-GRAMMAR-${String(chapter).padStart(3, "0")}`));
      const readBlock = sourceText.split("```text")[1]?.split("```")[0] ?? "";
      const readLines = readBlock.trim().split(/\r?\n/u).filter((line) => line.trim());
      assert.ok(readLines.length >= 6 && readLines.length <= 20, `Japanese Chapter ${chapter} must have 6-20 learner-facing lines`);
      const vocabularySection = sourceText.match(/### New Vocabulary\s+\n([\s\S]*?)\n### New Grammar/u)?.[1] ?? "";
      const vocabularyRows = vocabularySection.split("\n").filter((line) => /^\|[^-].*\|$/u.test(line.trim())).slice(1);
      assert.equal(vocabularyRows.length, 8, `Japanese Chapter ${chapter} must have 8 new vocabulary items`);
    }
    const newGrammarIds = content.files
      .filter((file) => /^units\/japanese-core\/chapter-0(?:1[1-9]|20)-[^/]+\/chapter\.md$/u.test(file.path))
      .filter((file) => !file.path.includes("-grammar-"))
      .flatMap((file) => file.text.match(/JPN-GRAMMAR-\d{3}/gu) ?? []);
    assert.deepEqual([...new Set(newGrammarIds)], Array.from({ length: 10 }, (_, index) => `JPN-GRAMMAR-${String(index + 11).padStart(3, "0")}`));
    for (const block of ["011-015", "016-020"]) {
      const easy = content.files.find((file) => file.path === `units/japanese-core/chapter-${block}-grammar-easy/chapter.md`);
      const hard = content.files.find((file) => file.path === `units/japanese-core/chapter-${block}-grammar-hard/chapter.md`);
      assert.ok(easy);
      assert.ok(hard);
      assert.deepEqual(easy.text.match(/JPN-GRAMMAR-\d{3}/gu), hard.text.match(/JPN-GRAMMAR-\d{3}/gu));
    }
    assert.ok(content.files.some((file) => file.path === "review-decks/chapter-001-005/cards.tsv"));
    assert.equal(archive.has("content/memorization/review-decks/chapter-001-005.json"), true);
    const reviewItems = JSON.parse(archive.get("content/memorization/review-decks/chapter-001-005.json").toString("utf8")).items;
    assert.equal(reviewItems.length, 120);
    assertCoreReviewItemsHaveExamples(reviewItems, "Japanese");
    assert.equal(reviewItems[0].source.title, "Chapter 1-5");
    assert.ok(reviewItems.some((item) => item.prompt.text === "Meaning: hello" && item.answer.text.includes("Japanese: こんにちは")));
    assert.ok(reviewItems.some((item) => item.prompt.text === "Japanese: 学生" && item.answer.text.includes("Reading: がくせい")));
    assert.ok(reviewItems.some((item) => item.prompt.text === "Reading: がくせい" && item.answer.text.includes("Japanese: 学生")));
    assert.ok(reviewItems.every((item) => item.examples === undefined));
    for (const [block, title] of [["011-015", "Chapter 11-15"], ["016-020", "Chapter 16-20"]]) {
      const sourcePath = `review-decks/chapter-${block}/cards.tsv`;
      const itemPath = `content/memorization/review-decks/chapter-${block}.json`;
      assert.ok(content.files.some((file) => file.path === sourcePath));
      assert.equal(archive.has(itemPath), true);
      const items = JSON.parse(archive.get(itemPath).toString("utf8")).items;
      assert.equal(items.length, 120);
      assertCoreReviewItemsHaveExamples(items, `Japanese ${title}`);
      assert.ok(items.some((item) => item.prompt.text.startsWith("Meaning:") && item.answer.text.includes("Japanese:") && item.answer.text.includes("Reading:")));
      assert.ok(items.some((item) => item.prompt.text.startsWith("Japanese:") && item.answer.text.includes("Meaning:") && item.answer.text.includes("Reading:")));
      assert.ok(items.some((item) => item.prompt.text.startsWith("Reading:") && item.answer.text.includes("Meaning:") && item.answer.text.includes("Japanese:")));
    }
    assert.match(content.files.find((file) => file.path === "units/introduction-to-japanese-writing/hiragana/chapter.md").text, /future work/);
    assert.match(content.files.find((file) => file.path === "units/introduction-to-japanese-writing/katakana/chapter.md").text, /future work/);
    assert.match(content.files.find((file) => file.path === "units/introduction-to-japanese-writing/introduction-to-kanji/chapter.md").text, /future work/);
    const chapter1 = content.files.find((file) => file.path === "units/japanese-core/chapter-001-basic-sentences-1/chapter.md").text;
    assert.match(chapter1, /マリア\s+: 私はマリアです。/);
    assert.match(chapter1, /佐藤さくら: 私は佐藤さくらです。/);
    assert.match(chapter1, /マリア\s+: 私は学生です。/);
    assert.match(chapter1, /\|\s*学生\s*\|\s*がくせい\s*\|\s*student\s*\|/);
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
    const readingArchive = await readZip(result.filePath);
    const manifest = JSON.parse(readingArchive.get("manifest.json").toString("utf8"));
    const { archive, content } = await mergedSplitArchive(readingArchive, directory, "vietnamese-core-reviews");
    const itemPath = "content/memorization/review-decks/chapter-001-005.json";
    const reviewItems = JSON.parse(archive.get(itemPath).toString("utf8"));
    const chapter3640ItemPath = "content/memorization/review-decks/chapter-036-040.json";
    const chapter3640Items = JSON.parse(archive.get(chapter3640ItemPath).toString("utf8"));

    assert.equal(result.packageId, "com.sleepymario.language.vietnamese");
    assert.equal(result.filePath.endsWith("com.sleepymario.language.vietnamese-0.1.0.wspkg"), true);
    assert.deepEqual(validateContentPackageManifest(manifest).errors, []);
    assert.equal(manifest.contentType, "language-curriculum");
    assert.equal(content.packageId, "com.sleepymario.language.vietnamese");
    assertOddEvenChapterFormats(content.files, "Vietnamese", content.packageId);
    assertUsefulChapterTitles(content.files);
    assertNoGenericDialogueSpeakerLabels(content.files, "Vietnamese", reviewItems.items);
    assertDialogueBlocksHaveIntroductionsAndAlignedColons(content.files, "Vietnamese");
    assert.ok(content.files.some((file) => file.path === "name-pools/initial-name-pools.md"));
    assert.ok(content.files.some((file) => file.path === "units/vietnamese-core/chapter-005-basic-sentences-5/chapter.md"));
    assert.ok(content.files.some((file) => file.path === "review-decks/chapter-001-005/cards.tsv"));
    assert.equal(content.files.some((file) => file.path === "units/vietnamese-core/chapter-006-basic-sentences-6/chapter.md"), true);
    assert.equal(content.files.some((file) => file.path === "units/vietnamese-core/chapter-026-basic-sentences-26/chapter.md"), true);
    assert.equal(content.files.some((file) => file.path === "units/vietnamese-core/chapter-030-basic-sentences-30/chapter.md"), true);
    assert.equal(content.files.some((file) => file.path === "units/vietnamese-core/chapter-026-030-grammar-easy/chapter.md"), true);
    assert.equal(content.files.some((file) => file.path === "units/vietnamese-core/chapter-026-030-grammar-hard/chapter.md"), true);
    assert.equal(content.files.some((file) => file.path === "review-decks/chapter-026-030/cards.tsv"), true);
    assert.equal(archive.has("content/memorization/review-decks/chapter-026-030.json"), true);
    for (const chapter of [36, 37, 38, 39, 40]) {
      assert.equal(content.files.some((file) => file.path === `units/vietnamese-core/chapter-0${chapter}-basic-sentences-${chapter}/chapter.md`), true);
    }
    assert.equal(content.files.some((file) => file.path === "units/vietnamese-core/chapter-036-040-grammar-easy/chapter.md"), true);
    assert.equal(content.files.some((file) => file.path === "units/vietnamese-core/chapter-036-040-grammar-hard/chapter.md"), true);
    assert.equal(content.files.some((file) => file.path === "review-decks/chapter-036-040/cards.tsv"), true);
    assert.equal(archive.has(chapter3640ItemPath), true);
    assert.equal(chapter3640Items.items.length, 50);
    assertCoreReviewItemsHaveExamples(chapter3640Items.items, "Vietnamese Chapters 36-40");
    assertVietnameseChapters3640(content.files);
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

function assertVietnameseChapters3640(files) {
  const expectedTypes = new Map([[36, "narrative"], [37, "dialogue"], [38, "narrative"], [39, "dialogue"], [40, "narrative"]]);
  const expectedCategories = new Map([
    [36, ["connector: concessive contrast", "aspect: completive"]],
    [37, ["connector: additive discourse linker", "speech act: polite request"]],
    [38, ["connector: temporal subordination", "degree: gradual change"]],
    [39, ["connector: spoken consequence", "modality: permission"]],
    [40, ["connector: simultaneous coordination", "voice: passive-like affected construction"]]
  ]);
  const grammarIds = [];

  for (const [chapter, expectedType] of expectedTypes) {
    const path = `units/vietnamese-core/chapter-0${chapter}-basic-sentences-${chapter}/chapter.md`;
    const markdown = files.find((file) => file.path === path)?.text;
    assert.ok(markdown, `missing Vietnamese chapter ${chapter}`);
    const analysis = analyzeChapterReadFormatForTest(markdown);
    assert.equal(analysis.detected, expectedType, `Vietnamese chapter ${chapter} read format`);
    assert.deepEqual(analysis.genericSpeakerLabels, []);
    assert.equal(analysis.dialogueBlockWithoutIntro, false);
    assert.equal(analysis.misalignedDialogueColons, false);

    const grammarPoint = markdown.match(/^grammar_point:\s*"([^"]+)"$/mu)?.[1] ?? "";
    const ids = [...grammarPoint.matchAll(/VIE-GRAMMAR-\d{3}[AB]/gu)].map((match) => match[0]);
    assert.equal(ids.length, 2, `Vietnamese chapter ${chapter} must introduce two grammar IDs`);
    grammarIds.push(...ids);

    const categories = (markdown.match(/^grammar_categories:\s*"([^"]+)"$/mu)?.[1] ?? "").split("; ");
    assert.deepEqual(categories, expectedCategories.get(chapter));
    assert.equal(categories.filter((category) => category.startsWith("connector:")).length, 1);

    const readSection = extractReadSectionsForFormatTest(markdown)[0];
    const learnerLines = readSection.lines.filter((line) => line.trim().length > 0 && line !== "```text" && line !== "```");
    assert.ok(learnerLines.length >= 10 && learnerLines.length <= 30, `Vietnamese chapter ${chapter} read-line count`);
    const vocabularyRows = markdown.split("\n").filter((line) => /^\| [^|-].*\|$/u.test(line) && !/^\| Vietnamese /u.test(line));
    assert.ok(vocabularyRows.length >= 6 && vocabularyRows.length <= 20, `Vietnamese chapter ${chapter} vocabulary count`);
    assert.doesNotMatch(markdown, /placeholder|TODO|TBD|\b[ABC]\s*:/iu);
  }

  assert.equal(grammarIds.length, 10);
  assert.equal(new Set(grammarIds).size, 10);

  const easy = files.find((file) => file.path === "units/vietnamese-core/chapter-036-040-grammar-easy/chapter.md")?.text ?? "";
  const hard = files.find((file) => file.path === "units/vietnamese-core/chapter-036-040-grammar-hard/chapter.md")?.text ?? "";
  const inventory = (markdown) => [...markdown.matchAll(/^- (VIE-GRAMMAR-\d{3}[AB] -- .+)$/gmu)].map((match) => match[1]);
  assert.equal(easy.includes("Chapters 36-40"), true);
  assert.equal(hard.includes("Chapters 36-40"), true);
  assert.deepEqual(inventory(easy), inventory(hard));
  assert.equal(inventory(easy).length, 10);
}

test("content package generator creates a valid Dutch package", async () => {
  const directory = await mkdtemp(join(tmpdir(), "wsm-dutch-package-"));

  try {
    const result = await generateContentPackage({
      targetId: "dutch-curriculum",
      outputDirectory: directory,
      generatedAt: "2026-07-06T00:00:00Z"
    });
    const readingArchive = await readZip(result.filePath);
    const manifest = JSON.parse(readingArchive.get("manifest.json").toString("utf8"));
    const { archive, content } = await mergedSplitArchive(readingArchive, directory, "dutch-core-reviews");
    const itemPath0105 = "content/memorization/review-decks/chapter-001-005.json";
    const itemPath0610 = "content/memorization/review-decks/chapter-006-010.json";
    const itemPath1115 = "content/memorization/review-decks/chapter-011-015.json";
    const itemPath1620 = "content/memorization/review-decks/chapter-016-020.json";
    const itemPath2125 = "content/memorization/review-decks/chapter-021-025.json";
    const reviewItems0105 = JSON.parse(archive.get(itemPath0105).toString("utf8"));
    const reviewItems0610 = JSON.parse(archive.get(itemPath0610).toString("utf8"));
    const reviewItems1115 = JSON.parse(archive.get(itemPath1115).toString("utf8"));
    const reviewItems1620 = JSON.parse(archive.get(itemPath1620).toString("utf8"));
    const reviewItems2125 = JSON.parse(archive.get(itemPath2125).toString("utf8"));
    const allReviewItems = [...reviewItems0105.items, ...reviewItems0610.items, ...reviewItems1115.items, ...reviewItems1620.items, ...reviewItems2125.items];

    assert.equal(result.packageId, "com.sleepymario.language.dutch");
    assert.equal(result.filePath.endsWith("com.sleepymario.language.dutch-0.1.0.wspkg"), true);
    assert.deepEqual(validateContentPackageManifest(manifest).errors, []);
    assert.equal(manifest.displayName, "Dutch");
    assert.equal(manifest.contentType, "language-curriculum");
    assert.equal(content.packageId, "com.sleepymario.language.dutch");
    const castPath = "name-pools/canonical-cast.json";
    const castSource = await readFile(join(sourceRepositoryPath("dutch-curriculum"), castPath));
    const castEntry = content.files.find((file) => file.path === castPath);
    const castRecord = manifest.files.find((file) => file.path === castPath);
    assert.ok(castEntry);
    assert.ok(castRecord);
    assert.equal(castEntry.mediaType, "application/json");
    assert.equal(castRecord.mediaType, "application/json");
    assert.equal(castRecord.size, castSource.length);
    assert.equal(castRecord.sha256, createHash("sha256").update(castSource).digest("hex"));
    assert.deepEqual(archive.get(castPath), castSource);
    const cast = JSON.parse(castEntry.text);
    assert.equal(cast.cast.length, 30);
    assert.equal(cast.deckPersonPool.length, 30);
    assert.equal(cast.activeCast.schemaVersion, 1);
    assert.equal(cast.activeCast.progression.length, 30);
    assert.deepEqual(new Set(cast.activeCast.progression), new Set(cast.cast.map((person) => person.id)));
    assert.equal(new Set(cast.cast.map((person) => person.id)).size, 30);
    const packagedCastValidation = await runNode(
      [join(dirname(sourceRepositoryPath("dutch-curriculum")),"language-learning-curriculum-builder","scripts","validate-packaged-cast.mjs")],
      archive.get("content/content.json")
    );
    assert.equal(packagedCastValidation.exitCode, 0, packagedCastValidation.stderr);
    assert.match(packagedCastValidation.stdout, /packaged canonical cast passed/u);
    assertOddEvenChapterFormats(content.files, "Dutch", content.packageId);
    assertUsefulChapterTitles(content.files);
    assertNoGenericDialogueSpeakerLabels(content.files, "Dutch", allReviewItems);
    assertDialogueBlocksHaveIntroductionsAndAlignedColons(content.files, "Dutch");
    assert.ok(content.files.some((file) => file.path === "name-pools/initial-name-pools.md"));
    assert.ok(content.files.some((file) => file.path === "units/dutch-core/chapter-005-basic-sentences-5/chapter.md"));
    assert.ok(content.files.some((file) => file.path === "units/dutch-core/chapter-006-basic-sentences-6/chapter.md"));
    assert.ok(content.files.some((file) => file.path === "units/dutch-core/chapter-010-basic-sentences-10/chapter.md"));
    const chapter11Path = "units/dutch-core/chapter-011-asking-how-someone-is/chapter.md";
    assert.ok(content.files.some((file) => file.path === chapter11Path));
    assert.match(content.files.find((file) => file.path === chapter11Path).text, /^chapter:\s*11$/mu);
    for (const chapter of [12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25]) {
      assert.ok(content.files.some((file) => file.path.startsWith(`units/dutch-core/chapter-${String(chapter).padStart(3, "0")}-`) && file.path.endsWith("/chapter.md")));
    }
    assert.equal(content.files.some((file) => /^units\/dutch-core\/chapter-026-/u.test(file.path)), false);
    assert.equal(content.files.some((file) => /chapter-011-015-grammar-(?:easy|hard)/u.test(file.path)), true);
    assert.equal(content.files.some((file) => file.path === "review-decks/chapter-011-015/cards.tsv"), true);
    assert.equal(content.files.some((file) => /chapter-016-020-grammar-(?:easy|hard)/u.test(file.path)), true);
    assert.equal(content.files.some((file) => file.path === "review-decks/chapter-016-020/cards.tsv"), true);
    assert.equal(content.files.some((file) => /chapter-021-025-grammar-(?:easy|hard)/u.test(file.path)), true);
    assert.equal(content.files.some((file) => file.path === "review-decks/chapter-021-025/cards.tsv"), true);
    assert.equal(archive.get("content/content.json").includes(Buffer.from(chapter11Path)), true);
    assert.ok(content.files.some((file) => file.path === "units/dutch-core/chapter-006-010-grammar-easy/chapter.md"));
    assert.ok(content.files.some((file) => file.path === "units/dutch-core/chapter-006-010-grammar-hard/chapter.md"));
    assert.ok(content.files.some((file) => file.path === "review-decks/chapter-001-005/cards.tsv"));
    assert.ok(content.files.some((file) => file.path === "review-decks/chapter-006-010/cards.tsv"));
    assert.equal(archive.has(itemPath0105), true);
    assert.equal(archive.has(itemPath0610), true);
    assert.equal(archive.has(itemPath1115), true);
    assert.equal(archive.has(itemPath1620), true);
    assert.equal(archive.has(itemPath2125), true);
    assert.equal(reviewItems0105.items.length, 38);
    assert.equal(reviewItems0610.items.length, 40);
    assert.equal(reviewItems1115.items.length, 30);
    assert.equal(reviewItems1620.items.length, 30);
    assert.equal(reviewItems2125.items.length, 15);
    assertCoreReviewItemsHaveExamples(allReviewItems, "Dutch");
    assertDutchReviewExamplesComeFromReadContent(allReviewItems, content.files);
    assert.equal(reviewItems0105.items[0].source.title, "Chapter 1-5");
    assert.equal(reviewItems0610.items[0].source.title, "Chapter 6-10");
    assert.equal(reviewItems1115.items[0].source.title, "Chapter 11-15");
    assert.equal(reviewItems1620.items[0].source.title, "Chapter 16-20");
    assert.equal(reviewItems2125.items[0].source.title, "Chapter 21-25");
    assert.ok(reviewItems0105.items.some((item) => item.prompt.text === "hallo" && item.answer.text === "hello"));
    assert.ok(reviewItems0105.items.some((item) => item.prompt.text === "hello" && item.answer.text === "hallo"));
    assert.ok(reviewItems0610.items.some((item) => item.prompt.text === "heb" && item.answer.text === "have"));
    assert.ok(reviewItems0610.items.some((item) => item.prompt.text === "have" && item.answer.text === "heb"));
    assert.ok(reviewItems0610.items.some((item) => item.prompt.text === "woon" && item.answer.text === "live"));
    assert.ok(reviewItems0610.items.some((item) => item.prompt.text === "live" && item.answer.text === "woon"));
    const halloItem = reviewItems0105.items.find((item) => item.prompt.text === "hallo" && item.answer.text === "hello");
    assert.equal(halloItem.examples, undefined);
    const bookItem = reviewItems0105.items.find((item) => item.prompt.text === "het boek" && item.answer.text === "book");
    assert.equal(bookItem.examples, undefined);
    const hebItem = reviewItems0610.items.find((item) => item.prompt.text === "heb" && item.answer.text === "have");
    assert.equal(hebItem.examples, undefined);
    const woonItem = reviewItems0610.items.find((item) => item.prompt.text === "woon" && item.answer.text === "live");
    assert.equal(woonItem.examples, undefined);
    assert.equal(allReviewItems.some((item) => item.prompt.text === "Ik ben N" || item.answer.text === "Ik ben N"), false);
    assert.equal(allReviewItems.some((item) => item.prompt.text === "Ik heb N" || item.answer.text === "Ik heb N"), false);
    assert.equal(allReviewItems.some((item) => item.prompt.text === "${FOREIGN-NAME-1}" || item.answer.text === "${FOREIGN-NAME-1}"), false);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("content package generator creates a valid English package", async () => {
  const directory = await mkdtemp(join(tmpdir(), "wsm-english-package-"));

  try {
    const result = await generateContentPackage({
      targetId: "english-curriculum",
      outputDirectory: directory,
      generatedAt: "2026-07-06T00:00:00Z"
    });
    const readingArchive = await readZip(result.filePath);
    const manifest = JSON.parse(readingArchive.get("manifest.json").toString("utf8"));
    const { archive, content } = await mergedSplitArchive(readingArchive, directory, "english-core-reviews");
    const itemPath = "content/memorization/review-decks/chapter-001-005.json";
    const reviewItems = JSON.parse(archive.get(itemPath).toString("utf8"));

    assert.equal(result.packageId, "com.sleepymario.language.english");
    assert.equal(result.filePath.endsWith("com.sleepymario.language.english-0.1.0.wspkg"), true);
    assert.deepEqual(validateContentPackageManifest(manifest).errors, []);
    assert.deepEqual(manifest.displayName, { "zh-TW": "英文", en: "English" });
    assert.deepEqual(manifest.languages, ["en", "zh-TW"]);
    assert.equal(manifest.contentType, "language-curriculum");
    assert.equal(content.packageId, "com.sleepymario.language.english");
    assert.equal("instructionalLanguages" in content, false);
    assert.equal(content.defaultSourceLocale, "zh-TW");
    assert.equal(content.defaultSourcePackageId, "com.sleepymario.language.english.source.zh-tw");
    assert.equal("contentLocales" in content, false);
    assert.equal(manifest.localization.role, "base-curriculum");
    assert.equal(content.targetLanguage, "en");
    const englishZhFiles = content.files.map((file) => ({ ...file, text: typeof file.text === "string" ? file.text : file.text["zh-TW"] }));
    assertOddEvenChapterFormats(englishZhFiles, "English", content.packageId);
    assertUsefulChapterTitles(englishZhFiles);
    assertNoGenericDialogueSpeakerLabels(englishZhFiles, "English", reviewItems.items);
    assertDialogueBlocksHaveIntroductionsAndAlignedColons(englishZhFiles, "English");
    assert.ok(content.files.some((file) => file.path === "name-pools/initial-name-pools.md"));
    assert.ok(content.files.some((file) => file.path === "units/english-core/chapter-001-basic-sentences-1/chapter.md"));
    assert.ok(content.files.some((file) => file.path === "units/english-core/chapter-005-basic-sentences-5/chapter.md"));
    assert.ok(content.files.some((file) => file.path === "units/english-core/chapter-001-005-grammar-easy/chapter.md"));
    assert.ok(content.files.some((file) => file.path === "units/english-core/chapter-001-005-grammar-hard/chapter.md"));
    assert.ok(content.files.some((file) => file.path === "review-decks/chapter-001-005/cards.tsv"));
    assert.equal(archive.has(itemPath), true);
    assert.equal(reviewItems.items.length, 40);
    assertCoreReviewItemsHaveExamples(reviewItems.items, "English");
    assertEnglishReviewExamplesComeFromReadContent(reviewItems.items, englishZhFiles);
    assert.equal(reviewItems.items[0].source.title, "Chapter 1-5");
    assert.equal(reviewItems.items[0].id, "review-decks/chapter-001-005/0001-english-target---english-vocabulary");
    assert.equal(reviewItems.items[1].id, "review-decks/chapter-001-005/0002-english---english-target-vocabulary");
    assert.ok(reviewItems.items.some((item) => item.prompt.text === "hello" && item.answer.text === "greeting"));
    assert.ok(reviewItems.items.some((item) => item.prompt.text === "greeting" && item.answer.text === "hello"));
    const helloItem = reviewItems.items.find((item) => item.prompt.text === "hello");
    assert.equal(helloItem.examples, undefined);
    const questionItem = reviewItems.items.find((item) => item.prompt.text === "question");
    assert.equal(questionItem.examples, undefined);
    assert.equal(reviewItems.items.some((item) => item.prompt.text === "I am N" || item.answer.text === "I am N"), false);
    assert.ok(reviewItems.items.every((item) => item.language.target === "en" && item.language.base === "en"));
    assert.ok(reviewItems.items.some((item) => item.prompt.language === "zh-TW" && item.answer.language === "en"));
    assert.ok(reviewItems.items.some((item) => item.prompt.language === "en" && item.answer.language === "zh-TW"));
    const sourceToTarget = reviewItems.items.filter((item) => item.prompt.language === "zh-TW");
    assert.ok(sourceToTarget.every((item) => item.prompt.text.toLowerCase() !== item.answer.text.toLowerCase()));

    const localizedChapters = content.files.filter((file) => /^units\/english-core\/chapter-00[1-5]-basic-sentences-[1-5]\/chapter\.md$/u.test(file.path));
    assert.equal(localizedChapters.length, 5);
    for (const file of localizedChapters) {
      assert.equal(typeof file.text, "string");
      assert.doesNotMatch(file.text, /[\u3400-\u9fff]/u);
    }
    const easy = content.files.find((file) => file.path === "units/english-core/chapter-001-005-grammar-easy/chapter.md").text;
    const hard = content.files.find((file) => file.path === "units/english-core/chapter-001-005-grammar-hard/chapter.md").text;
    assert.match(easy, /Grammar - Easy/u);
    assert.match(hard, /Grammar - Hard/u);
    assert.deepEqual(easy.match(/ENG-GRAMMAR-00[1-5]/gu), hard.match(/ENG-GRAMMAR-00[1-5]/gu));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("source-language package variants reference the base cast without inventing a package-local cast", async () => {
  const directory = await mkdtemp(join(tmpdir(), "wsm-english-source-packages-"));

  try {
    for (const targetId of ["english-curriculum-source-zh-tw", "english-curriculum-source-en"]) {
      const result = await generateContentPackage({ targetId, outputDirectory: directory, generatedAt: "2026-07-06T00:00:00Z" });
      const archive = await readZip(result.filePath);
      const manifest = JSON.parse(archive.get("manifest.json").toString("utf8"));
      const content = JSON.parse(archive.get("content/content.json").toString("utf8"));
      assert.equal(manifest.localization.role, "source-language-pack");
      assert.equal(manifest.localization.basePackageId, "com.sleepymario.language.english");
      assert.equal(content.basePackageId, "com.sleepymario.language.english");
      assert.equal(content.files.some((file) => file.path === "name-pools/canonical-cast.json"), false);
      assert.equal(manifest.files.some((file) => file.path === "name-pools/canonical-cast.json"), false);
      assert.equal(archive.has("name-pools/canonical-cast.json"), false);
    }
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
    const readingArchive = await readZip(result.filePath);
    const manifest = JSON.parse(readingArchive.get("manifest.json").toString("utf8"));
    const { archive, content } = await mergedSplitArchive(readingArchive, directory, "german-core-reviews");
    const itemPath = "content/memorization/review-decks/chapter-001-005.json";
    const reviewItems = JSON.parse(archive.get(itemPath).toString("utf8"));

    assert.equal(result.packageId, "com.sleepymario.language.german");
    assert.equal(result.filePath.endsWith("com.sleepymario.language.german-0.1.0.wspkg"), true);
    assert.deepEqual(validateContentPackageManifest(manifest).errors, []);
    assert.equal(manifest.displayName, "German");
    assert.equal(manifest.contentType, "language-curriculum");
    assert.equal(content.packageId, "com.sleepymario.language.german");
    assertOddEvenChapterFormats(content.files, "German", content.packageId);
    assertUsefulChapterTitles(content.files);
    assertNoGenericDialogueSpeakerLabels(content.files, "German", reviewItems.items);
    assertDialogueBlocksHaveIntroductionsAndAlignedColons(content.files, "German");
    assert.ok(content.files.some((file) => file.path === "name-pools/initial-name-pools.md"));
    assert.ok(content.files.some((file) => file.path === "units/german-core/chapter-001-basic-sentences-1/chapter.md"));
    assert.ok(content.files.some((file) => file.path === "units/german-core/chapter-005-basic-sentences-5/chapter.md"));
    assert.ok(content.files.some((file) => file.path === "review-decks/chapter-001-005/cards.tsv"));
    assert.equal(content.files.some((file) => file.path === "units/german-core/chapter-006-basic-sentences-6/chapter.md"), true);
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
    const readingArchive = await readZip(result.filePath);
    const manifest = JSON.parse(readingArchive.get("manifest.json").toString("utf8"));
    const { archive, content } = await mergedSplitArchive(readingArchive, directory, "french-core-reviews");
    const itemPath = "content/memorization/review-decks/chapter-001-005.json";
    const reviewItems = JSON.parse(archive.get(itemPath).toString("utf8"));

    assert.equal(result.packageId, "com.sleepymario.language.french");
    assert.equal(result.filePath.endsWith("com.sleepymario.language.french-0.1.0.wspkg"), true);
    assert.deepEqual(validateContentPackageManifest(manifest).errors, []);
    assert.equal(manifest.displayName, "French");
    assert.equal(manifest.contentType, "language-curriculum");
    assert.equal(content.packageId, "com.sleepymario.language.french");
    assertOddEvenChapterFormats(content.files, "French", content.packageId);
    assertUsefulChapterTitles(content.files);
    assertNoGenericDialogueSpeakerLabels(content.files, "French", reviewItems.items);
    assertDialogueBlocksHaveIntroductionsAndAlignedColons(content.files, "French");
    assert.ok(content.files.some((file) => file.path === "name-pools/initial-name-pools.md"));
    assert.ok(content.files.some((file) => file.path === "units/french-core/chapter-001-basic-sentences-1/chapter.md"));
    assert.ok(content.files.some((file) => file.path === "units/french-core/chapter-005-basic-sentences-5/chapter.md"));
    assert.ok(content.files.some((file) => file.path === "review-decks/chapter-001-005/cards.tsv"));
    assert.equal(content.files.some((file) => file.path === "units/french-core/chapter-006-basic-sentences-6/chapter.md"), true);
    assert.equal(archive.has(itemPath), true);
    assert.equal(reviewItems.items.length, 32);
    assertCoreReviewItemsHaveExamples(reviewItems.items, "French");
    assert.equal(reviewItems.items[0].source.title, "Chapter 1-5");
    assert.ok(reviewItems.items.some((item) => item.prompt.text === "bonjour" && item.answer.text === "hello; good day"));
    assert.ok(reviewItems.items.some((item) => item.prompt.text === "hello; good day" && item.answer.text === "bonjour"));
    const bonjourItem = reviewItems.items.find((item) => item.prompt.text === "bonjour" && item.answer.text === "hello; good day");
    assert.equal(bonjourItem.examples, undefined);
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
    const readingArchive = await readZip(result.filePath);
    const manifest = JSON.parse(readingArchive.get("manifest.json").toString("utf8"));
    const { archive, content } = await mergedSplitArchive(readingArchive, directory, "spanish-core-reviews");
    const itemPath = "content/memorization/review-decks/chapter-001-005.json";
    const reviewItems = JSON.parse(archive.get(itemPath).toString("utf8"));

    assert.equal(result.packageId, "com.sleepymario.language.spanish");
    assert.equal(result.filePath.endsWith("com.sleepymario.language.spanish-0.1.0.wspkg"), true);
    assert.deepEqual(validateContentPackageManifest(manifest).errors, []);
    assert.equal(manifest.displayName, "Spanish");
    assert.equal(manifest.contentType, "language-curriculum");
    assert.equal(content.packageId, "com.sleepymario.language.spanish");
    assertOddEvenChapterFormats(content.files, "Spanish", content.packageId);
    assertUsefulChapterTitles(content.files);
    assertNoGenericDialogueSpeakerLabels(content.files, "Spanish", reviewItems.items);
    assertDialogueBlocksHaveIntroductionsAndAlignedColons(content.files, "Spanish");
    assert.ok(content.files.some((file) => file.path === "name-pools/initial-name-pools.md"));
    assert.ok(content.files.some((file) => file.path === "units/spanish-core/chapter-001-basic-sentences-1/chapter.md"));
    assert.ok(content.files.some((file) => file.path === "units/spanish-core/chapter-005-basic-sentences-5/chapter.md"));
    assert.ok(content.files.some((file) => file.path === "review-decks/chapter-001-005/cards.tsv"));
    assert.equal(content.files.some((file) => file.path === "units/spanish-core/chapter-006-basic-sentences-6/chapter.md"), true);
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
      "english-curriculum",
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
    assert.match(result.stdout, /Package generated: com\.sleepymario\.language\.english/);
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

async function mergedSplitArchive(readingArchive, directory, reviewTargetId) {
  const readingContent = JSON.parse(readingArchive.get("content/content.json").toString("utf8"));
  assert.equal(readingContent.files.some(file => file.path.startsWith("review-decks/")), false);
  assert.equal([...readingArchive.keys()].some(path => path.startsWith("content/memorization/")), false);
  const reviewResult = await generateContentPackage({
    targetId: reviewTargetId,
    outputDirectory: directory,
    generatedAt: "2026-07-06T00:00:00Z"
  });
  const reviewArchive = await readZip(reviewResult.filePath);
  const reviewManifest = JSON.parse(reviewArchive.get("manifest.json").toString("utf8"));
  const reviewContent = JSON.parse(reviewArchive.get("content/content.json").toString("utf8"));
  assert.deepEqual(reviewManifest.capabilities, ["core-review"]);
  assert.equal(reviewManifest.license.spdx, "GPL-3.0-or-later");
  return {
    archive: new Map([...readingArchive, ...[...reviewArchive].filter(([path]) => path !== "manifest.json" && path !== "content/content.json")]),
    content: { ...readingContent, files: [...readingContent.files, ...reviewContent.files] }
  };
}

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

function assertOddEvenChapterFormats(files, label, packageId) {
  const failures = [];

  for (const file of files.filter((candidate) => candidate.path.startsWith("units/") && candidate.path.endsWith("/chapter.md"))) {
    if (/grammar-(?:easy|hard)\/chapter\.md$/u.test(file.path)) {
      continue;
    }
    const chapterMatch = file.text.match(/^chapter:\s*(\d+)$/mu);
    if (chapterMatch === null) {
      continue;
    }

    const chapter = Number.parseInt(chapterMatch[1], 10);
    const expected = chapter % 2 === 1 ? "dialogue" : "narrative";
    const analysis = analyzeChapterReadFormatForTest(file.text);

    if (analysis.genericSpeakerLabels.length > 0) {
      failures.push(`${label} (${packageId}) chapter ${chapter}: placeholder speaker labels ${analysis.genericSpeakerLabels.join(", ")} in ${file.path}`);
    }
    if (analysis.dialogueBlockWithoutIntro) {
      failures.push(`${label} (${packageId}) chapter ${chapter}: dialogue block lacks participant/relationship intro in ${file.path}`);
    }
    if (analysis.misalignedDialogueColons) {
      failures.push(`${label} (${packageId}) chapter ${chapter}: dialogue speaker-label colons are not display-width aligned in ${file.path}`);
    }
    if (analysis.detected !== expected) {
      failures.push(`${label} (${packageId}) chapter ${chapter}: expected ${expected}, detected ${analysis.detected} in ${file.path}`);
    }
  }

  assert.deepEqual(failures, [], `${label} generated package chapters must follow odd dialogue / even narrative format`);
}

function analyzeChapterReadFormatForTest(markdown) {
  const sections = extractReadSectionsForFormatTest(markdown);
  const speakerLines = sections.flatMap((section) => section.lines.filter(isDialogueSpeakerLineForTest));
  const headingSuggestsDialogue = sections.some((section) => /dialogue/iu.test(section.heading));
  const genericSpeakerLabels = speakerLines
    .filter((line) => /^\s*[A-Z]\s*:\s/u.test(line))
    .map((line) => line.trim());
  const detected = headingSuggestsDialogue || speakerLines.length >= 2 ? "dialogue" : "narrative";
  let dialogueBlockWithoutIntro = false;
  let misalignedDialogueColons = false;

  for (const section of sections) {
    for (const block of contiguousSpeakerBlocksForTest(section.lines)) {
      if (block.lines.length < 2) {
        continue;
      }
      const previous = previousNonBlankLineForTest(section.lines, block.start - 1);
      if (previous === undefined || /^#{1,6}\s/u.test(previous) || /^(?:Pinyin|Meaning):$/u.test(previous)) {
        dialogueBlockWithoutIntro = true;
      }
      const colonColumns = block.lines.map((line) => displayWidthForTest(line.slice(0, line.indexOf(":"))));
      if (new Set(colonColumns).size !== 1) {
        misalignedDialogueColons = true;
      }
    }
  }

  return { detected, genericSpeakerLabels, dialogueBlockWithoutIntro, misalignedDialogueColons };
}

function extractReadSectionsForFormatTest(markdown) {
  const lines = markdown.replace(/\r\n?/gu, "\n").split("\n");
  const sections = [];

  for (let index = 0; index < lines.length; index++) {
    if (!/^#{2,4}\s+(?:對話(?: \/ Learner-facing Dialogue)?|閱讀短文(?: \/ Learner-facing Controlled Reading)?|Learner-facing |Model Mini Dialogue|Model Dialogue|Model Mini Scene|Model Mini Text|Controlled Reading)/iu.test(lines[index])) {
      continue;
    }
    let end = lines.length;
    for (let next = index + 1; next < lines.length; next++) {
      if (/^#{2,4}\s+/u.test(lines[next])) {
        end = next;
        break;
      }
    }
    sections.push({ heading: lines[index], lines: lines.slice(index, end) });
  }

  return sections;
}

function isDialogueSpeakerLineForTest(line) {
  return /^(?!\s*[-*])\s*([^:]{1,24}?)\s*:\s+\S/u.test(line)
    && !/^\s*(?:Pinyin|Meaning|Reading|Characters|Notes?|Context)\s*:/iu.test(line);
}

function contiguousSpeakerBlocksForTest(lines) {
  const blocks = [];
  for (let index = 0; index < lines.length; index++) {
    if (!isDialogueSpeakerLineForTest(lines[index])) {
      continue;
    }
    const start = index;
    const blockLines = [];
    for (; index < lines.length; index++) {
      if (lines[index].trim() === "" || /^#{1,6}\s/u.test(lines[index])) {
        break;
      }
      if (isDialogueSpeakerLineForTest(lines[index])) {
        blockLines.push(lines[index]);
      }
    }
    blocks.push({ start, lines: blockLines });
  }
  return blocks;
}

function previousNonBlankLineForTest(lines, start) {
  for (let index = start; index >= 0; index--) {
    if (lines[index].trim() !== "" && !lines[index].startsWith("```")) {
      return lines[index];
    }
  }
  return undefined;
}

function assertCoreReviewItemsHaveExamples(items, label) {
  assert.equal(items.every(item => item.examples === undefined), true, `${label} independent core reviews must not embed CC reading examples`);
}

function assertDutchReviewExamplesComeFromReadContent(items, contentFiles) {
  const readContentLines = new Set(contentFiles
    .filter((file) => /^units\/dutch-core\/chapter-\d{3}-[^/]+\/chapter\.md$/u.test(file.path) && !/grammar-(?:easy|hard)/u.test(file.path))
    .flatMap((file) => extractLearnerFacingReadContentLinesForTest(file.text)));
  const invalidExamples = items.flatMap((item) => (item.examples ?? [])
    .filter((example) => !readContentLines.has(example))
    .map((example) => `${item.prompt.text} -> ${item.answer.text}: ${example}`));

  assert.deepEqual(invalidExamples, [], "Dutch examples must be literal lines from learner-facing read content only");
}

function assertEnglishReviewExamplesComeFromReadContent(items, contentFiles) {
  const readContentLines = new Set(contentFiles
    .filter((file) => /^units\/english-core\/chapter-\d{3}-basic-sentences-\d+\/chapter\.md$/u.test(file.path))
    .flatMap((file) => extractLearnerFacingReadContentLinesForTest(file.text)));
  const invalidExamples = items.flatMap((item) => (item.examples ?? [])
    .filter((example) => !readContentLines.has(example))
    .map((example) => `${item.prompt.text} -> ${item.answer.text}: ${example}`));

  assert.deepEqual(invalidExamples, [], "English examples must be literal lines from learner-facing read content only");
}

function extractLearnerFacingReadContentLinesForTest(markdown) {
  const lines = markdown.split(/\r?\n/u);
  const readLines = [];

  for (let index = 0; index < lines.length; index++) {
    if (!/^### (?:對話(?: \/ Learner-facing Dialogue)?|閱讀短文(?: \/ Learner-facing Controlled Reading)?|Learner-facing (?:Dialogue|Controlled Reading))$/u.test(lines[index])) {
      continue;
    }
    for (index += 1; index < lines.length && !/^### (?:新單字 \/ New Vocabulary|New Vocabulary)$/u.test(lines[index]); index++) {
      const line = lines[index].trimEnd();
      if (line.trim() === "" || line === "```text" || line === "```") {
        continue;
      }
      readLines.push(line);
    }
  }

  return readLines;
}

function assertNoGenericDialogueSpeakerLabels(files, label, reviewItems = []) {
  const chapterMatches = files
    .filter((file) => file.path.startsWith("units/") && file.path.endsWith("/chapter.md"))
    .flatMap((file) => file.text
      .split(/\r?\n/u)
      .map((line, index) => ({ file, line, index }))
      .filter(({ line }) => /^\s*[A-Z]:\s/u.test(line))
      .map(({ file, line, index }) => `${file.path}:${index + 1}: ${line.trim()}`));
  const reviewMatches = reviewItems.flatMap((item) => (item.examples ?? [])
    .filter((example) => /^[A-Z]:\s/u.test(example))
    .map((example) => `${item.prompt.text} -> ${item.answer.text}: ${example}`));

  assert.deepEqual(chapterMatches, [], `${label} read content must use real dialogue speaker names`);
  assert.deepEqual(reviewMatches, [], `${label} review examples must preserve real dialogue speaker names`);
}

function assertDialogueBlocksHaveIntroductionsAndAlignedColons(files, label) {
  const missingIntroductions = [];
  const misaligned = [];

  for (const file of files.filter((candidate) => candidate.path.startsWith("units/") && candidate.path.endsWith("/chapter.md"))) {
    const lines = file.text.split(/\r?\n/u);
    for (let index = 0; index < lines.length; index++) {
      if (lines[index] !== "```text") {
        continue;
      }
      const block = [];
      let end = index + 1;
      for (; end < lines.length && lines[end] !== "```"; end++) {
        block.push(lines[end]);
      }
      const speakerLines = block.filter((line) => /^(\S[^:]*?)\s*:\s/u.test(line));
      if (speakerLines.length < 2) {
        continue;
      }

      let previous = index - 1;
      while (previous >= 0 && lines[previous].trim() === "") {
        previous--;
      }
      if (previous < 0 || /^#{1,6}\s/u.test(lines[previous]) || /^(?:Pinyin|Meaning):$/u.test(lines[previous])) {
        missingIntroductions.push(`${file.path}:${index + 1}`);
      }

      const colonColumns = speakerLines.map((line) => displayWidthForTest(line.slice(0, line.indexOf(":"))));
      if (new Set(colonColumns).size !== 1) {
        misaligned.push(`${file.path}:${index + 1}: ${speakerLines.slice(0, 3).join(" | ")}`);
      }
    }

    let inFence = false;
    for (let index = 0; index < lines.length; index++) {
      if (lines[index].startsWith("```")) {
        inFence = !inFence;
        continue;
      }
      if (inFence || /^\s*-/u.test(lines[index]) || !/^(\S[^:]*?)\s*:\s/u.test(lines[index])) {
        continue;
      }
      const heading = nearestPreviousHeading(lines, index);
      if (!heading || !/dialogue/iu.test(heading)) {
        continue;
      }

      const start = index;
      const speakerLines = [];
      for (; index < lines.length; index++) {
        const line = lines[index];
        if (line.trim() === "" || /^#{1,6}\s/u.test(line)) {
          break;
        }
        if (!/^\s*-/u.test(line) && /^(\S[^:]*?)\s*:\s/u.test(line)) {
          speakerLines.push(line);
        }
      }
      if (speakerLines.length < 2) {
        continue;
      }

      let previous = start - 1;
      while (previous >= 0 && lines[previous].trim() === "") {
        previous--;
      }
      if (previous < 0 || /^#{1,6}\s/u.test(lines[previous]) || /^(?:Pinyin|Meaning):$/u.test(lines[previous])) {
        missingIntroductions.push(`${file.path}:${start + 1}`);
      }

      const colonColumns = speakerLines.map((line) => displayWidthForTest(line.slice(0, line.indexOf(":"))));
      if (new Set(colonColumns).size !== 1) {
        misaligned.push(`${file.path}:${start + 1}: ${speakerLines.slice(0, 3).join(" | ")}`);
      }
    }
  }

  assert.deepEqual(missingIntroductions, [], `${label} dialogue blocks must have participant introductions`);
  assert.deepEqual(misaligned, [], `${label} dialogue speaker-label colons must align`);
}

function nearestPreviousHeading(lines, start) {
  for (let index = start - 1; index >= 0; index--) {
    if (/^#{1,6}\s/u.test(lines[index])) {
      return lines[index];
    }
  }
  return "";
}

function displayWidthForTest(value) {
  let width = 0;
  for (const char of [...value]) {
    const codePoint = char.codePointAt(0);
    width += isWideCodePointForTest(codePoint) ? 2 : 1;
  }
  return width;
}

function isWideCodePointForTest(codePoint) {
  return codePoint >= 0x1100 && (
    codePoint <= 0x115f ||
    codePoint === 0x2329 ||
    codePoint === 0x232a ||
    (codePoint >= 0x2e80 && codePoint <= 0xa4cf) ||
    (codePoint >= 0xac00 && codePoint <= 0xd7a3) ||
    (codePoint >= 0xf900 && codePoint <= 0xfaff) ||
    (codePoint >= 0xfe10 && codePoint <= 0xfe19) ||
    (codePoint >= 0xfe30 && codePoint <= 0xfe6f) ||
    (codePoint >= 0xff00 && codePoint <= 0xff60) ||
    (codePoint >= 0xffe0 && codePoint <= 0xffe6)
  );
}

function assertKoreanStrictReadContentExamples(items, contentFiles) {
  const readContentLines = new Set(
    contentFiles
      .filter((file) => /^units\/korean-core\/chapter-\d{3}-basic-(?:life-)?sentences-\d+\/chapter\.md$/u.test(file.path))
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
      const match = file.path.match(/^units\/korean-core\/chapter-0*(\d+)-basic-(?:life-)?sentences-\d+\/chapter\.md$/u);
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
      return match[1].split("; ").map((grammarPoint) => `- ${grammarPoint}`);
    })
    .flat();
}

function assertKoreanChapters3135And3640(files) {
  const expected = new Map([
    [31, { title: "Community Center Event", type: "dialogue", connector: "V-아서/어서", other: "N 전에" }],
    [32, { title: "Rainy Morning Commute", type: "narrative", connector: "그런데", other: "N까지" }],
    [33, { title: "The Lost Wallet Desk", type: "dialogue", connector: "그래서", other: "V-아/어 보다" }],
    [34, { title: "Recycling Day", type: "narrative", connector: "그리고", other: "N마다" }],
    [35, { title: "Cooking Class Choices", type: "dialogue", connector: "V-지만", other: "N보다" }],
    [36, { title: "Neighborhood Repair Notice", type: "narrative", connector: "그러나", other: "V-(으)려고 하다" }],
    [37, { title: "Bus Transfer Help", type: "dialogue", connector: "V-고 나서", other: "N에서 N까지" }],
    [38, { title: "Weather Report and Plans", type: "narrative", connector: "V-기 때문에", other: "V-(으)ㄹ 수 있다" }],
    [39, { title: "Study Group Presentation", type: "dialogue", connector: "그래서", other: "N도 N도" }],
    [40, { title: "A Quiet Museum Visit", type: "narrative", connector: "V-는데", other: "V-(으)ㄴ 적이 있다" }]
  ]);
  const chapterFiles = files.filter((file) => /^units\/korean-core\/chapter-0*(?:3[1-9]|40)-basic-sentences-\d+\/chapter\.md$/u.test(file.path));
  assert.equal(chapterFiles.length, 10);

  for (const file of chapterFiles) {
    const chapter = Number.parseInt(file.text.match(/^chapter:\s*(\d+)$/mu)?.[1] ?? "0", 10);
    const specification = expected.get(chapter);
    assert.ok(specification, `unexpected Korean chapter ${chapter}`);
    assert.match(file.text, new RegExp(`^title: "${specification.title}"$`, "mu"));
    assert.match(file.text, specification.type === "dialogue" ? /^### Learner-facing Dialogue$/mu : /^### Learner-facing Controlled Reading$/mu);
    const grammarPoint = file.text.match(/^grammar_point:\s*"([^"]+)"$/mu)?.[1]?.split("; ") ?? [];
    assert.deepEqual(grammarPoint, [
      `KOR-GRAMMAR-${String(chapter).padStart(3, "0")}A -- ${specification.connector}`,
      `KOR-GRAMMAR-${String(chapter).padStart(3, "0")}B -- ${specification.other}`
    ]);
    assert.equal(specification.connector !== specification.other, true);
  }
}

function assertKoreanChapters4150(files) {
  const chapterFiles = files.filter((file) => /^units\/korean-core\/chapter-0*(?:4[1-9]|50)-basic-sentences-\d+\/chapter\.md$/u.test(file.path));
  assert.equal(chapterFiles.length, 10);
  for (const file of chapterFiles) {
    const chapter = Number.parseInt(file.text.match(/^chapter:\s*(\d+)$/mu)?.[1] ?? "0", 10);
    assert.match(file.text, chapter % 2 === 1 ? /^### Learner-facing Dialogue$/mu : /^### Learner-facing Controlled Reading$/mu);
    assert.match(file.text, new RegExp(`^grammar_id: "KOR-GRAMMAR-${String(chapter).padStart(3, "0")}"$`, "mu"));
    assert.match(file.text, /(?:한 개|스무 개|몇 명|두 시|이십 쪽|칠월|서른두 분|한 장씩|마흔 명 정도|컵 백 개)/u);
  }
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
    if (/^#{2,4}\s+(?:Model Mini Dialogue|Model Mini Text|Learner-facing Dialogue|Learner-facing Controlled Reading|Controlled Reading)\b/iu.test(trimmed)) {
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
    if (inReadSection && !inFence && trimmed.length > 0) {
      lines.push(trimmed);
      continue;
    }
    if (inTextFence && trimmed.length > 0) {
      lines.push(trimmed);
    }
  }
  return lines;
}

function assertUsefulChapterTitles(files) {
  const chapterFiles = files.filter((file) => file.path.endsWith("/chapter.md") && !/grammar-(?:easy|hard)\/chapter\.md$/u.test(file.path));
  assert.ok(chapterFiles.length > 0);

  for (const file of chapterFiles) {
    const title = file.text.match(/^title:\s*"([^"]+)"$/mu)?.[1]?.trim();
    const heading = file.text.match(/^#\s+(.+)$/mu)?.[1]?.trim();
    for (const value of [title, heading].filter((candidate) => candidate !== undefined)) {
      assert.doesNotMatch(value, /^(?:\.{3}|…|[\p{P}\p{S}\s]*)$/u, `${file.path} has an invalid placeholder title`);
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

function sourceRepositoryPath(repositoryName) {
  return resolveContentPackageSourcePath(`../${repositoryName}`).resolvedPath;
}

async function runNode(args, input) {
  const child = spawn(process.execPath, args, {
    cwd: process.cwd(),
    stdio: [input === undefined ? "ignore" : "pipe", "pipe", "pipe"]
  });

  if (input !== undefined) {
    child.stdin.end(input);
  }

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
