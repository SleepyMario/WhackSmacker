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
      ["chinese-curriculum", "com.sleepymario.language.chinese"],
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
    assert.ok(content.files.some((file) => file.path === "units/introduction-to-hangul/README.md"));
    assert.ok(content.files.some((file) => file.path === "units/introduction-to-hangul/chapter-01-vowels/unit-01-simple-vowels.md"));
    assert.ok(content.files.some((file) => file.path === "units/korean-core/chapter-015-basic-life-sentences-15/chapter.md"));
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
    assert.ok(allReviewItems.some((item) => item.prompt.text === "안녕하세요" && item.answer.text === "hello"));
    assert.ok(allReviewItems.some((item) => item.prompt.text === "hello" && item.answer.text === "안녕하세요"));
    assert.ok(allReviewItems.some((item) => item.prompt.text === "topic particle" && item.answer.text === "은/는"));
    assert.ok(allReviewItems.some((item) => item.prompt.text === "이/가" && item.answer.text === "subject/existence marker"));
    assert.equal(allReviewItems.some((item) => item.source.title === "Chapter 1-20"), false);
    assert.equal(allReviewItems.some((item) => item.source.title === "Chapter 8-10"), false);
    assert.equal(allReviewItems.some((item) => item.source.title === "Chapter 16-20"), false);
    assert.equal(allReviewItems.some((item) => item.prompt.text === "저는 N입니다" || item.answer.text === "저는 N입니다"), false);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("content package generator creates a valid Chinese - Mandarin package with conversion decks", async () => {
  const directory = await mkdtemp(join(tmpdir(), "wsm-chinese-package-"));

  try {
    const result = await generateContentPackage({
      targetId: "chinese-curriculum",
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

    assert.equal(result.packageId, "com.sleepymario.language.chinese");
    assert.equal(result.filePath.endsWith("com.sleepymario.language.chinese-0.1.0.wspkg"), true);
    assert.deepEqual(validateContentPackageManifest(manifest).errors, []);
    assert.equal(manifest.displayName, "Chinese - Mandarin");
    assert.equal(manifest.description, "Chinese - Mandarin language curriculum content generated from the canonical Chinese curriculum repository.");
    assert.equal(manifest.contentType, "language-curriculum");
    assert.equal(content.packageId, "com.sleepymario.language.chinese");

    for (const deck of expectedReviewDecks) {
      assert.ok(content.files.some((file) => file.path === deck.sourcePath));
      assert.equal(archive.has(deck.itemPath), true);
      const collection = JSON.parse(archive.get(deck.itemPath).toString("utf8"));
      assert.equal(collection.items.length, deck.itemCount);
      assert.equal(collection.items[0].source.title, deck.title);
      assert.equal(collection.items[0].source.path, deck.sourcePath);
    }

    const allItems = expectedReviewDecks.flatMap((deck) => JSON.parse(archive.get(deck.itemPath).toString("utf8")).items);
    assert.ok(allItems.some((item) => item.prompt.text === "b" && item.answer.text === "ㄅ"));
    assert.ok(allItems.some((item) => item.prompt.text === "ㄅ" && item.answer.text === "b"));
    assert.ok(allItems.some((item) => item.prompt.text === "mā" && item.answer.text === "ㄇㄚ"));
    assert.ok(allItems.some((item) => item.prompt.text === "ㄇㄚˊ" && item.answer.text === "má"));
    assert.equal(allItems.some((item) => item.kind === "sentence" || item.kind === "concept"), false);
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
    assert.ok(content.files.some((file) => file.path === "name-pools/initial-name-pools.md"));
    assert.ok(content.files.some((file) => file.path === "units/vietnamese-core/chapter-005-basic-sentences-5/chapter.md"));
    assert.ok(content.files.some((file) => file.path === "review-decks/chapter-001-005/cards.tsv"));
    assert.equal(content.files.some((file) => file.path.includes("lessons-001-005") || file.path.includes("lesson-001")), false);
    assert.equal(archive.has(itemPath), true);
    assert.equal(archive.has("content/memorization/review-decks/lessons-001-005.json"), false);
    assert.equal(reviewItems.items.length, 80);
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
    assert.ok(content.files.some((file) => file.path === "name-pools/initial-name-pools.md"));
    assert.ok(content.files.some((file) => file.path === "units/dutch-core/chapter-005-basic-sentences-5/chapter.md"));
    assert.ok(content.files.some((file) => file.path === "review-decks/chapter-001-005/cards.tsv"));
    assert.equal(content.files.some((file) => file.path === "units/dutch-core/chapter-006-basic-sentences-6/chapter.md"), false);
    assert.equal(archive.has(itemPath), true);
    assert.equal(reviewItems.items.length, 80);
    assert.equal(reviewItems.items[0].source.title, "Chapter 1-5");
    assert.ok(reviewItems.items.some((item) => item.prompt.text === "hallo" && item.answer.text === "hello"));
    assert.ok(reviewItems.items.some((item) => item.prompt.text === "hello" && item.answer.text === "hallo"));
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
    assert.ok(content.files.some((file) => file.path === "name-pools/initial-name-pools.md"));
    assert.ok(content.files.some((file) => file.path === "units/german-core/chapter-001-basic-sentences-1/chapter.md"));
    assert.ok(content.files.some((file) => file.path === "units/german-core/chapter-005-basic-sentences-5/chapter.md"));
    assert.ok(content.files.some((file) => file.path === "review-decks/chapter-001-005/cards.tsv"));
    assert.equal(content.files.some((file) => file.path === "units/german-core/chapter-006-basic-sentences-6/chapter.md"), false);
    assert.equal(archive.has(itemPath), true);
    assert.equal(reviewItems.items.length, 80);
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
    assert.ok(content.files.some((file) => file.path === "name-pools/initial-name-pools.md"));
    assert.ok(content.files.some((file) => file.path === "units/french-core/chapter-001-basic-sentences-1/chapter.md"));
    assert.ok(content.files.some((file) => file.path === "units/french-core/chapter-005-basic-sentences-5/chapter.md"));
    assert.ok(content.files.some((file) => file.path === "review-decks/chapter-001-005/cards.tsv"));
    assert.equal(content.files.some((file) => file.path === "units/french-core/chapter-006-basic-sentences-6/chapter.md"), false);
    assert.equal(archive.has(itemPath), true);
    assert.equal(reviewItems.items.length, 80);
    assert.equal(reviewItems.items[0].source.title, "Chapter 1-5");
    assert.ok(reviewItems.items.some((item) => item.prompt.text === "bonjour" && item.answer.text === "hello; good day"));
    assert.ok(reviewItems.items.some((item) => item.prompt.text === "hello; good day" && item.answer.text === "bonjour"));
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
    assert.ok(content.files.some((file) => file.path === "name-pools/initial-name-pools.md"));
    assert.ok(content.files.some((file) => file.path === "units/spanish-core/chapter-001-basic-sentences-1/chapter.md"));
    assert.ok(content.files.some((file) => file.path === "units/spanish-core/chapter-005-basic-sentences-5/chapter.md"));
    assert.ok(content.files.some((file) => file.path === "review-decks/chapter-001-005/cards.tsv"));
    assert.equal(content.files.some((file) => file.path === "units/spanish-core/chapter-006-basic-sentences-6/chapter.md"), false);
    assert.equal(archive.has(itemPath), true);
    assert.equal(reviewItems.items.length, 80);
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
      "chinese-curriculum",
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
    assert.match(result.stdout, /Package generated: com\.sleepymario\.language\.chinese/);
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
