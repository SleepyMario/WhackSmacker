import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { spawn } from "node:child_process";
import { test } from "node:test";

import {
  assertInstalledCurriculumParticipants,
  contentPackageGeneratorTargets,
  generateContentPackage,
  assertProductionPackageProvenance,
  isContentPackageSourceFileAllowed,
  resolveContentPackageSourcePath,
  validateContentPackageManifest
} from "../dist/packages/core/index.js";

test("content package generator exposes the supported local package targets", () => {
  assert.deepEqual(
    contentPackageGeneratorTargets.map((target) => [target.id, target.packageId]),
    [
      ["linguistic-terminology", "com.sleepymario.language.linguistic-terminology"],
      ["vietnamese-curriculum", "com.sleepymario.language.vietnamese"],
      ["dutch-curriculum", "com.sleepymario.language.dutch"],
      ["arabic-curriculum", "com.sleepymario.language.arabic"],
      ["french-curriculum", "com.sleepymario.language.french"],
      ["german-curriculum", "com.sleepymario.language.german"],
      ["hindi-curriculum", "com.sleepymario.language.hindi"],
      ["japanese-curriculum", "com.sleepymario.language.japanese"],
      ["korean-curriculum", "com.sleepymario.language.korean"],
      ["russian-curriculum", "com.sleepymario.language.russian"],
      ["spanish-curriculum", "com.sleepymario.language.spanish"],
      ["thai-curriculum", "com.sleepymario.language.thai"],
      ["zulu-curriculum", "com.sleepymario.language.zulu"],
      ["vietnamese-core-reviews", "com.sleepymario.language.vietnamese.reviews"],
      ["dutch-core-reviews", "com.sleepymario.language.dutch.reviews"],
      ["arabic-core-reviews", "com.sleepymario.language.arabic.reviews"],
      ["french-core-reviews", "com.sleepymario.language.french.reviews"],
      ["german-core-reviews", "com.sleepymario.language.german.reviews"],
      ["hindi-core-reviews", "com.sleepymario.language.hindi.reviews"],
      ["japanese-core-reviews", "com.sleepymario.language.japanese.reviews"],
      ["korean-core-reviews", "com.sleepymario.language.korean.reviews"],
      ["russian-core-reviews", "com.sleepymario.language.russian.reviews"],
      ["spanish-core-reviews", "com.sleepymario.language.spanish.reviews"],
      ["thai-core-reviews", "com.sleepymario.language.thai.reviews"],
      ["zulu-core-reviews", "com.sleepymario.language.zulu.reviews"],
      ["chinese-simplified-traditional-level-1", "com.sleepymario.language.chinese-simplified-traditional.level-1"],
      ["chinese-simplified-traditional-level-1-vocabulary", "com.sleepymario.language.chinese-simplified-traditional.level-1-vocabulary"],
      ["chinese-simplified-traditional-level-2", "com.sleepymario.language.chinese-simplified-traditional.level-2"],
      ["chinese-simplified-traditional-level-2-vocabulary", "com.sleepymario.language.chinese-simplified-traditional.level-2-vocabulary"],
      ["chinese-simplified-traditional-level-3", "com.sleepymario.language.chinese-simplified-traditional.level-3"],
      ["chinese-simplified-traditional-level-3-vocabulary", "com.sleepymario.language.chinese-simplified-traditional.level-3-vocabulary"],
      ["vietnamese-custom-numbers-money-dates-time", "local.user.decks.vietnamese-numbers-money-dates-time"],
      ["vietnamese-custom-pronunciation-tones", "local.user.decks.vietnamese-pronunciation-tones"],
      ["vietnamese-custom-core-sentence-patterns", "local.user.decks.vietnamese-core-sentence-patterns"],
      ["vietnamese-custom-people-pronouns-languages", "local.user.decks.vietnamese-people-pronouns-languages"],
      ["vietnamese-custom-frequency-preference-comparison", "local.user.decks.vietnamese-frequency-preference-comparison"],
      ["vietnamese-custom-daily-life-common-actions", "local.user.decks.vietnamese-daily-life-common-actions"],
      ["vietnamese-custom-conversation-social-phrases", "local.user.decks.vietnamese-conversation-social-phrases"],
      ["vietnamese-custom-food-drink-restaurants", "local.user.decks.vietnamese-food-drink-restaurants"],
      ["vietnamese-custom-shopping-clothing", "local.user.decks.vietnamese-shopping-clothing"],
      ["vietnamese-custom-classifiers-common-objects", "local.user.decks.vietnamese-classifiers-common-objects"],
      ["vietnamese-custom-animals", "local.user.decks.vietnamese-animals"],
      ["vietnamese-custom-descriptions-opposites", "local.user.decks.vietnamese-descriptions-opposites"],
      ["vietnamese-custom-common-confusions", "local.user.decks.vietnamese-common-confusions"],
      ["dutch-general-animals-preview-001-100", "com.sleepymario.language.dutch.general.animals.preview-001-100"],
      ["dutch-specialized-medical-1", "com.sleepymario.language.dutch.specialized.medical-1"],
      ["chinese-traditional-specialized-medical-1", "com.sleepymario.language.chinese-traditional.specialized.medical-1"]
    ]
  );
  assert.equal(contentPackageGeneratorTargets.filter((target) => !target.id.startsWith("chinese-simplified-traditional-") && !target.id.startsWith("vietnamese-custom-")).every((target) => target.deckVersion === "0.0.1"), true);
  assert.equal(contentPackageGeneratorTargets.filter((target) => target.id.startsWith("vietnamese-custom-")).every((target) => target.deckVersion === "0.1.0"), true);
  assert.equal(contentPackageGeneratorTargets.find((target) => target.id === "chinese-simplified-traditional-level-1")?.deckVersion, "1.2.0");
  assert.equal(contentPackageGeneratorTargets.find((target) => target.id === "chinese-simplified-traditional-level-1-vocabulary")?.deckVersion, "1.0.0");
  assert.equal(contentPackageGeneratorTargets.find((target) => target.id === "chinese-simplified-traditional-level-2")?.deckVersion, "1.0.0");
  assert.equal(contentPackageGeneratorTargets.find((target) => target.id === "chinese-simplified-traditional-level-2-vocabulary")?.deckVersion, "1.0.0");
  assert.equal(contentPackageGeneratorTargets.find((target) => target.id === "chinese-simplified-traditional-level-3")?.deckVersion, "1.0.0");
  assert.equal(contentPackageGeneratorTargets.find((target) => target.id === "chinese-simplified-traditional-level-3-vocabulary")?.deckVersion, "1.0.0");
  assert.equal(contentPackageGeneratorTargets.find((target) => target.id === "chinese-simplified-traditional-level-1")?.artifactRevision, 3);
  assert.equal(contentPackageGeneratorTargets.every((target) => Number.isSafeInteger(target.artifactRevision) && target.artifactRevision > 0), true);
  assert.equal(contentPackageGeneratorTargets.find((target) => target.id === "dutch-general-animals-preview-001-100")?.artifactRevision, 3);
  assert.equal(contentPackageGeneratorTargets.find((target) => target.id === "japanese-core-reviews")?.interactionProfile?.labels, "independent");
});

test("Level I uses the approved character（word） presentation in both directions", async () => {
  const target = contentPackageGeneratorTargets.find((candidate) => candidate.id === "chinese-simplified-traditional-level-1");
  assert.equal(target?.notesPolicy, "omit");
  const directory = await mkdtemp(join(tmpdir(), "wsm-conversion-level-1-"));
  try {
    const result = await generateContentPackage({
      targetId: "chinese-simplified-traditional-level-1",
      outputDirectory: directory,
      generatedAt: "2026-09-04T16:00:00Z"
    });
    const archive = await readZip(result.filePath);
    const document = JSON.parse(archive.get("content/memorization/tghz2013-level-1.json").toString("utf8"));
    assert.equal(document.items.length, 2510);
    assert.equal(document.items.every((item) => /^.+（.{2,4}）$/u.test(item.prompt.text)), true);
    assert.equal(document.items.every((item) => /^.+（.{2,4}）$/u.test(item.answer.text)), true);
    assert.equal(document.items.every((item) => !/[“”「」。！？]/u.test(item.prompt.text)), true);
    assert.equal(document.items.every((item) => !/[“”「」。！？]/u.test(item.answer.text)), true);
    assert.equal(document.items.every((item) => item.examples.length >= 1 && item.examples.length <= 2), true);
    assert.equal(document.items.every((item) => item.examples.every((example) => !/例句中使用了/u.test(example))), true);
    assert.equal(document.items.every((item) => item.notes === undefined), true);

    const recording = document.items.find((item) => item.id.endsWith("1304-map-01/hans-to-hant"));
    assert.ok(recording);
    assert.equal(recording.prompt.text, "录（录取）");
    assert.equal(recording.answer.text, "錄（錄取）");
    assert.deepEqual(recording.examples, ["他收到大学的录取通知。", "他收到大學的錄取通知。"]);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("Level II uses the approved character（word） presentation with real paired examples", async () => {
  const target = contentPackageGeneratorTargets.find((candidate) => candidate.id === "chinese-simplified-traditional-level-2");
  assert.equal(target?.notesPolicy, "omit");
  assert.equal(target?.topic?.deckDisplayName, "Level II");
  const directory = await mkdtemp(join(tmpdir(), "wsm-conversion-level-2-"));
  try {
    const result = await generateContentPackage({
      targetId: "chinese-simplified-traditional-level-2",
      outputDirectory: directory,
      generatedAt: "2026-09-04T18:00:00Z"
    });
    const archive = await readZip(result.filePath);
    const document = JSON.parse(archive.get("content/memorization/tghz2013-level-2.json").toString("utf8"));
    assert.equal(document.items.length, 1854);
    assert.equal(document.items.every((item) => /^.+（.{2,}）$/u.test(item.prompt.text)), true);
    assert.equal(document.items.every((item) => /^.+（.{2,}）$/u.test(item.answer.text)), true);
    assert.equal(document.items.every((item) => !/[“”「」。！？]/u.test(item.prompt.text)), true);
    assert.equal(document.items.every((item) => !/[“”「」。！？]/u.test(item.answer.text)), true);
    assert.equal(document.items.every((item) => item.examples.length >= 1 && item.examples.length <= 2), true);
    assert.equal(document.items.every((item) => item.examples.every((example) => !/例句中使用了/u.test(example))), true);
    assert.equal(document.items.every((item) => item.notes === undefined), true);

    const zimbabwe = document.items.find((item) => item.id.endsWith("3509-map-01/hans-to-hant"));
    assert.ok(zimbabwe);
    assert.equal(zimbabwe.prompt.text, "韦（津巴布韦）");
    assert.equal(zimbabwe.answer.text, "韋（津巴布韋）");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("Level III uses the approved character（word） presentation with real paired examples", async () => {
  const target = contentPackageGeneratorTargets.find((candidate) => candidate.id === "chinese-simplified-traditional-level-3");
  assert.equal(target?.notesPolicy, "omit");
  assert.equal(target?.topic?.deckDisplayName, "Level III");
  const directory = await mkdtemp(join(tmpdir(), "wsm-conversion-level-3-"));
  try {
    const result = await generateContentPackage({
      targetId: "chinese-simplified-traditional-level-3",
      outputDirectory: directory,
      generatedAt: "2026-09-04T20:00:00Z"
    });
    const archive = await readZip(result.filePath);
    const document = JSON.parse(archive.get("content/memorization/tghz2013-level-3.json").toString("utf8"));
    assert.equal(document.items.length, 932);
    assert.equal(document.items.every((item) => /^.+（.{2,}）$/u.test(item.prompt.text)), true);
    assert.equal(document.items.every((item) => /^.+（.{2,}）$/u.test(item.answer.text)), true);
    assert.equal(document.items.every((item) => !/[“”「」。！？]/u.test(item.prompt.text)), true);
    assert.equal(document.items.every((item) => !/[“”「」。！？]/u.test(item.answer.text)), true);
    assert.equal(document.items.every((item) => item.examples.length >= 1 && item.examples.length <= 2), true);
    assert.equal(document.items.every((item) => item.examples.every((example) => !/例句中使用了/u.test(example))), true);
    assert.equal(document.items.every((item) => item.notes === undefined), true);

    const first = document.items.find((item) => item.id.endsWith("6509-map-01/hans-to-hant"));
    assert.ok(first);
    assert.equal(first.prompt.text, "戋（戋戋）");
    assert.equal(first.answer.text, "戔（戔戔）");
    assert.deepEqual(first.examples, ["戋戋是一个较少见的词语。", "戔戔是一個較少見的詞語。"]);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("content package generator preserves explicitly referenced image binaries with deterministic metadata and ordering", async () => {
  const root = await mkdtemp(join(tmpdir(), "wsm-package-media-generator-"));
  const sourceBase = join(root, "source");
  const repository = join(sourceBase, "language-curriculum-specialized");
  const deck = join(repository, "specialized-content", "medical", "dutch-english");
  const firstOutput = join(root, "first");
  const secondOutput = join(root, "second");
  const header = ["card_id", "deck", "kind", "source_chapter", "prompt_language", "answer_language", "prompt", "accepted_answers", "distractors", "explanation", "lexical_ids", "grammar_ids", "geographic_ids", "provenance_path", "provenance_locator", "provenance_evidence", "examples", "tags"];
  const prompt = "![Animal illustration](media/dog.webp)\n\ndog\n\nThe dog is running in the garden.";
  const answer = "![Wildlife image of a dog](media/dog.png)\n\n![Second wildlife image](media/dog.jpeg)\n\nde hond\n\nDe hond rent in de tuin.";
  const row = [
    "medical-nl-en/dog/source-to-target", "Medical I", "vocabulary", "1", "en", "nl", quoteTsv(prompt),
    JSON.stringify([answer]), "[]", "A dog vocabulary card.", JSON.stringify(["nl.animal.dog"]), "[]", "[]",
    "source/dog.md", "dog", "dog evidence", "[]", JSON.stringify(["medical", "animal"])
  ];
  const bytes = new Map([
    ["dog.webp", Buffer.from([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 0, 0xff, 0x80])],
    ["dog.png", Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0xff, 0x81])],
    ["dog.jpeg", Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 0xff, 0xd9])]
  ]);
  try {
    await mkdir(join(deck, "media"), { recursive: true });
    await writeFile(join(deck, "README.md"), "# Fixture\n");
    await writeFile(join(deck, "deck.json"), "{}\n");
    await writeFile(join(deck, "cards.tsv"), `${header.join("\t")}\n${row.join("\t")}\n`);
    await writeFile(join(repository, "LICENSE-CONTENT"), "fixture license\n");
    await writeFile(join(repository, "NOTICE"), "fixture notice\n");
    for (const [name, data] of bytes) await writeFile(join(deck, "media", name), data);

    const options = { targetId: "dutch-specialized-medical-1", generatedAt: "2026-08-03T00:00:00Z", sourceRoot: sourceBase };
    const first = await generateContentPackage({ ...options, outputDirectory: firstOutput });
    const second = await generateContentPackage({ ...options, outputDirectory: secondOutput });
    const archive = await readZip(first.filePath);
    const mediaRecords = first.manifest.files.filter(file => file.path.startsWith("media/"));

    assert.deepEqual(mediaRecords.map(file => [file.path, file.mediaType]), [
      ["media/dog.jpeg", "image/jpeg"], ["media/dog.png", "image/png"], ["media/dog.webp", "image/webp"]
    ]);
    for (const record of mediaRecords) {
      const expected = bytes.get(record.path.slice("media/".length));
      assert.deepEqual(archive.get(record.path), expected);
      assert.equal(record.size, expected.length);
      assert.equal(record.sha256, createHash("sha256").update(expected).digest("hex"));
      assert.notEqual(record.mediaType, "text/plain");
    }
    const collection = JSON.parse(archive.get("content/memorization/medical-i.json").toString("utf8"));
    assert.equal(collection.items[0].prompt.mediaType, "text/markdown");
    assert.equal(collection.items[0].answer.mediaType, "text/markdown");
    assert.deepEqual(collection.items[0].prompt.plainText.split("\n").filter(Boolean), ["[Image: Animal illustration]", "dog", "The dog is running in the garden."]);
    assert.equal(await fileSha256(first.filePath), await fileSha256(second.filePath));
    assert.equal(first.archiveSha256, second.archiveSha256);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

function quoteTsv(value) {
  return `"${value.replaceAll('"', '""')}"`;
}

test("Vietnamese reading and Review package targets both remain normalized at version 0.1.0", () => {
  const targets = new Map(contentPackageGeneratorTargets.map((target) => [target.id, target]));
  const reading = targets.get("vietnamese-curriculum");
  const reviews = targets.get("vietnamese-core-reviews");
  assert.equal(reading?.packageVersion, "0.1.0");
  assert.equal(reading?.contentSchemaVersion, "1.0.0");
  assert.deepEqual(reading?.readingContentInclude, [
    "README.md", "philosophy.md", "scope.md", "curriculum-map.md", "progress.md", "backlog.md", "decisions.md",
    "geography-ledger.json", "number-progression.json", "lexical-topics.json", "lexical-topic-audit.json", "lexical-topic-audit.md", "sino-vietnamese-lexicon.json", "sino-vietnamese-audit.json", "sino-vietnamese-audit.md", "name-pools", "units/README.md", "units/vietnamese-foundation", "units/vietnamese-core"
  ]);
  assert.equal(reviews?.packageId, "com.sleepymario.language.vietnamese.reviews");
  assert.equal(reviews?.packageVersion, "0.1.0");
  assert.deepEqual(reviews?.dependencies, [{
    packageId: "com.sleepymario.language.vietnamese",
    version: ">=0.1.0 <0.2.0",
    optional: true
  }]);
  assert.deepEqual(reviews?.include, ["README.md", "review-decks"]);
  assert.deepEqual(reviews?.license, { spdx: null, name: "Whacksmacker Curriculum Content License", path: "LICENSE-CONTENT" });
  assert.equal(isContentPackageSourceFileAllowed("number-progression.json"), true);
  assert.equal(isContentPackageSourceFileAllowed("lexical-topics.json"), true);
  assert.equal(isContentPackageSourceFileAllowed("lexical-topic-audit.json"), true);
  assert.equal(isContentPackageSourceFileAllowed("sino-vietnamese-lexicon.json"), true);
  assert.equal(isContentPackageSourceFileAllowed("sino-vietnamese-audit.json"), true);
});

test("Medical I generator targets retain exact specialized family and language package associations", () => {
  const targets = new Map(contentPackageGeneratorTargets.map((target) => [target.id, target]));
  const expected = [
    ["dutch-specialized-medical-1", "com.sleepymario.language.dutch.specialized.medical-1", "com.sleepymario.language.dutch"],
    ["chinese-traditional-specialized-medical-1", "com.sleepymario.language.chinese-traditional.specialized.medical-1", "com.sleepymario.language.chinese-traditional"]
  ];

  for (const [targetId, packageId, languagePackageId] of expected) {
    const target = targets.get(targetId);
    assert.equal(target?.packageId, packageId);
    assert.equal(target?.packageVersion, "0.1.0");
    assert.equal(target?.contentType, "specialized-review");
    assert.deepEqual(target?.capabilities, ["specialized-review"]);
    assert.equal(target?.deckFamily, "specialized");
    assert.deepEqual(target?.relatedPackageIds, [languagePackageId]);
  }
});

test("animal preview target is explicit-only general Dutch topic Review metadata", () => {
  const target = contentPackageGeneratorTargets.find((candidate) => candidate.id === "dutch-general-animals-preview-001-100");
  assert.equal(target?.explicitOnly, true);
  assert.equal(target?.packageId, "com.sleepymario.language.dutch.general.animals.preview-001-100");
  assert.equal(target?.packageVersion, "0.0.2");
  assert.equal(target?.displayName, "1–100");
  assert.equal(target?.contentType, "topic-review");
  assert.deepEqual(target?.capabilities, ["topic-review"]);
  assert.equal(target?.deckFamily, "general");
  assert.deepEqual(target?.topic, { id: "animals", displayName: "Animals", deckDisplayName: "1–100" });
  assert.deepEqual(target?.relatedPackageIds, ["com.sleepymario.language.dutch"]);
  assert.deepEqual(target?.languages, ["en", "nl"]);
  assert.equal(target?.sourcePath, "wsm-animals-en-nl-001-100-draft-v1.0.0");
  assert.deepEqual(target?.include, ["README.md", "cards.tsv"]);
  assert.deepEqual(target?.topicDeck, {
    id: "animals-preview-001-100",
    displayName: "1–100",
    outputFile: "animals-preview-001-100.json",
    unitStart: 1,
    unitEnd: 100
  });
});

test("Level I - Vocabulary contains 2815 ABC entries with regional Pinyin where Taiwan differs", async () => {
  const target = contentPackageGeneratorTargets.find((candidate) => candidate.id === "chinese-simplified-traditional-level-1-vocabulary");
  assert.equal(target?.notesPolicy, "omit");
  assert.equal(target?.topic?.deckDisplayName, "Level I - Vocabulary");
  assert.deepEqual(target?.languages, ["en", "zh-Latn-pinyin", "zh-Hans", "zh-Hant"]);
  assert.deepEqual(target?.include, ["README.md", "cards.tsv", "sources"]);

  const directory = await mkdtemp(join(tmpdir(), "wsm-conversion-level-1-vocabulary-"));
  try {
    const result = await generateContentPackage({
      targetId: "chinese-simplified-traditional-level-1-vocabulary",
      outputDirectory: directory,
      generatedAt: "2026-09-04T16:00:00Z"
    });
    const archive = await readZip(result.filePath);
    const document = JSON.parse(archive.get("content/memorization/tghz2013-level-1-vocabulary.json").toString("utf8"));
    assert.equal(document.items.length, 8445);
    assert.equal(new Set(document.items.flatMap((item) => item.testedLexicalIds)).size, 2815);
    assert.deepEqual(
      [...new Set(document.items.map((item) => item.prompt.language))].sort(),
      ["en", "zh-Hans", "zh-Latn-pinyin"]
    );
    assert.equal(document.items.every((item) => item.notes === undefined && item.examples.length >= 1 && item.examples.length <= 2), true);
    assert.equal(document.items.every((item) => item.outputs.length === 2), true);
    assert.equal(document.items.every((item) => item.interactionProfile.labels === "independent"), true);
    assert.equal(document.items.every((item) => !item.examples.some((example) => /例句中使用了/u.test(example))), true);
    assert.equal(document.items.filter((item) => JSON.stringify(item).includes("陸：")).length, 525);

    const substance = document.items.filter((item) => item.prompt.text.includes("物质 / 物質") || item.outputs.some((output) => output.content.text.includes("物质 / 物質")));
    assert.equal(substance.length, 3);
    assert.equal(substance.every((item) => JSON.stringify(item).includes("陸：wùzhì\\n台：wùzhí")), true);
    assert.equal(substance.every((item) => item.examples.includes("這種劇毒物質能直接穿透皮膚。")), true);

    const factory = document.items.filter((item) => item.prompt.text.includes("工厂 / 工廠") || item.outputs.some((output) => output.content.text.includes("工厂 / 工廠")));
    assert.equal(factory.length, 3);
    assert.equal(factory.every((item) => JSON.stringify(item).includes("gōng chǎng")), true);
    assert.equal(factory.every((item) => !JSON.stringify(item).includes("陸：") && !JSON.stringify(item).includes("台：")), true);

    const what = document.items.filter((item) => item.prompt.text.includes("什么 / 什麼") || item.outputs.some((output) => output.content.text.includes("什么 / 什麼")));
    assert.equal(what.length, 3);
    assert.equal(what.every((item) => item.examples.includes("你在看什麼？")), true);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("Level II - Vocabulary contains only new cumulative ABC entries", async () => {
  const target = contentPackageGeneratorTargets.find((candidate) => candidate.id === "chinese-simplified-traditional-level-2-vocabulary");
  assert.equal(target?.notesPolicy, "omit");
  assert.equal(target?.topic?.deckDisplayName, "Level II - Vocabulary");
  assert.deepEqual(target?.languages, ["en", "zh-Latn-pinyin", "zh-Hans", "zh-Hant"]);

  const parseTsv = (text) => {
    const rows = text.trimEnd().split("\n").map((line) => line.split("\t"));
    const header = rows.shift();
    return { rows, at: Object.fromEntries(header.map((name, index) => [name, index])) };
  };
  const levelOne = parseTsv(await readFile(join(process.cwd(), "review-content/chinese-simplified-traditional/level-1-vocabulary/sources/vocabulary.tsv"), "utf8"));
  const levelTwo = parseTsv(await readFile(join(process.cwd(), "review-content/chinese-simplified-traditional/level-2-vocabulary/sources/vocabulary.tsv"), "utf8"));
  const exclusions = parseTsv(await readFile(join(process.cwd(), "review-content/chinese-simplified-traditional/level-2-vocabulary/sources/level-1-exclusions.tsv"), "utf8"));
  const levelOneWords = new Set(levelOne.rows.map((row) => row[levelOne.at.simplified]));
  assert.equal(levelTwo.rows.length, 1474);
  assert.equal(exclusions.rows.length, 685);
  assert.equal(levelTwo.rows.some((row) => levelOneWords.has(row[levelTwo.at.simplified])), false);
  assert.equal(levelTwo.rows.some((row) => row[levelTwo.at.meaning] === "meaning to be reviewed"), false);

  const directory = await mkdtemp(join(tmpdir(), "wsm-conversion-level-2-vocabulary-"));
  try {
    const result = await generateContentPackage({
      targetId: "chinese-simplified-traditional-level-2-vocabulary",
      outputDirectory: directory,
      generatedAt: "2026-09-04T21:00:00Z"
    });
    const archive = await readZip(result.filePath);
    const document = JSON.parse(archive.get("content/memorization/tghz2013-level-2-vocabulary.json").toString("utf8"));
    assert.equal(document.items.length, 4422);
    assert.equal(new Set(document.items.flatMap((item) => item.testedLexicalIds)).size, 1474);
    assert.equal(document.items.every((item) => item.notes === undefined && item.examples.length >= 1 && item.examples.length <= 2), true);
    assert.equal(document.items.every((item) => item.outputs.length === 2), true);
    assert.equal(document.items.every((item) => item.interactionProfile.labels === "independent"), true);
    assert.equal(document.items.every((item) => !item.examples.some((example) => /例句中使用了/u.test(example))), true);
    assert.equal(document.items.filter((item) => JSON.stringify(item).includes("陸：")).length, 201);

    const zimbabwe = document.items.filter((item) => item.prompt.text.includes("津巴布韦 / 津巴布韋") || item.outputs.some((output) => output.content.text.includes("津巴布韦 / 津巴布韋")));
    assert.equal(zimbabwe.length, 3);
    assert.equal(zimbabwe.every((item) => JSON.stringify(item).includes("jīn bā bù wéi")), true);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("Level III - Vocabulary excludes both prior vocabulary levels", async () => {
  const target = contentPackageGeneratorTargets.find((candidate) => candidate.id === "chinese-simplified-traditional-level-3-vocabulary");
  assert.equal(target?.notesPolicy, "omit");
  assert.equal(target?.topic?.deckDisplayName, "Level III - Vocabulary");
  assert.deepEqual(target?.languages, ["en", "zh-Latn-pinyin", "zh-Hans", "zh-Hant"]);

  const parseTsv = (text) => {
    const rows = text.trimEnd().split("\n").map((line) => line.split("\t"));
    const header = rows.shift();
    return { rows, at: Object.fromEntries(header.map((name, index) => [name, index])) };
  };
  const levelOne = parseTsv(await readFile(join(process.cwd(), "review-content/chinese-simplified-traditional/level-1-vocabulary/sources/vocabulary.tsv"), "utf8"));
  const levelTwo = parseTsv(await readFile(join(process.cwd(), "review-content/chinese-simplified-traditional/level-2-vocabulary/sources/vocabulary.tsv"), "utf8"));
  const levelThree = parseTsv(await readFile(join(process.cwd(), "review-content/chinese-simplified-traditional/level-3-vocabulary/sources/vocabulary.tsv"), "utf8"));
  const exclusions = parseTsv(await readFile(join(process.cwd(), "review-content/chinese-simplified-traditional/level-3-vocabulary/sources/prior-level-exclusions.tsv"), "utf8"));
  const priorSimplified = new Set([
    ...levelOne.rows.map((row) => row[levelOne.at.simplified]),
    ...levelTwo.rows.map((row) => row[levelTwo.at.simplified])
  ]);
  assert.equal(priorSimplified.size, 4289);
  assert.equal(levelThree.rows.length, 39);
  assert.equal(exclusions.rows.length, 63);
  assert.equal(exclusions.rows.filter((row) => row[exclusions.at.prior_level] === "Level I").length, 41);
  assert.equal(exclusions.rows.filter((row) => row[exclusions.at.prior_level] === "Level II").length, 22);
  assert.equal(levelThree.rows.some((row) => priorSimplified.has(row[levelThree.at.simplified])), false);
  assert.equal(levelThree.rows.some((row) => row[levelThree.at.meaning] === "meaning to be reviewed"), false);

  const directory = await mkdtemp(join(tmpdir(), "wsm-conversion-level-3-vocabulary-"));
  try {
    const result = await generateContentPackage({
      targetId: "chinese-simplified-traditional-level-3-vocabulary",
      outputDirectory: directory,
      generatedAt: "2026-09-04T22:00:00Z"
    });
    const archive = await readZip(result.filePath);
    const document = JSON.parse(archive.get("content/memorization/tghz2013-level-3-vocabulary.json").toString("utf8"));
    assert.equal(document.items.length, 117);
    assert.equal(new Set(document.items.flatMap((item) => item.testedLexicalIds)).size, 39);
    assert.equal(document.items.every((item) => item.notes === undefined && item.examples.length >= 1 && item.examples.length <= 2), true);
    assert.equal(document.items.every((item) => item.outputs.length === 2), true);
    assert.equal(document.items.every((item) => item.interactionProfile.labels === "independent"), true);
    assert.equal(document.items.every((item) => !item.examples.some((example) => /例句中使用了/u.test(example))), true);
    assert.equal(document.items.filter((item) => JSON.stringify(item).includes("陸：")).length, 3);

    const fermentation = document.items.filter((item) => item.prompt.text.includes("酦酵 / 醱酵") || item.outputs.some((output) => output.content.text.includes("酦酵 / 醱酵")));
    assert.equal(fermentation.length, 3);
    assert.equal(fermentation.every((item) => JSON.stringify(item).includes("fermentation") && JSON.stringify(item).includes("fājiào")), true);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
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
    assert.equal(result.filePath.endsWith("com.sleepymario.language.linguistic-terminology-0.0.1-r1.wspkg"), true);
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

test("content package generator creates the authoritative Vietnamese reading and review packages through Chapter 30", async () => {
  const directory = await mkdtemp(join(tmpdir(), "wsm-vietnamese-package-"));
  try {
    const result = await generateContentPackage({ targetId: "vietnamese-curriculum", outputDirectory: directory, generatedAt: "2026-07-19T00:00:00Z" });
    const readingArchive = await readZip(result.filePath);
    const manifest = JSON.parse(readingArchive.get("manifest.json").toString("utf8"));
    const readingContent = JSON.parse(readingArchive.get("content/content.json").toString("utf8"));
    const { reviewArchive, reviewContent, reviewManifest } = await mergedSplitArchive(readingArchive, directory, "vietnamese-core-reviews");
    assert.equal(result.packageVersion, "0.1.0");
    assert.equal(manifest.packageVersion, "0.1.0");
    assert.equal(reviewManifest.packageId, "com.sleepymario.language.vietnamese.reviews");
    assert.equal(reviewManifest.packageVersion, "0.1.0");
    assert.deepEqual(validateContentPackageManifest(manifest).errors, []);
    for (const chapter of [1, 10, 11, 20, 29, 30]) {
      assert.ok(readingContent.files.some((file) => file.path === `units/vietnamese-core/chapter-${String(chapter).padStart(3,"0")}-basic-sentences-${chapter}/chapter.md`));
      assert.ok(readingContent.files.some((file) => file.path === `units/vietnamese-core/chapter-${String(chapter).padStart(3,"0")}-basic-sentences-${chapter}/reading-support.json`));
    }
    assert.equal(readingContent.files.some((file) => /units\/vietnamese-core\/chapter-(?:03[1-9]|0[4-9]\d|[1-9]\d{2,})-/u.test(file.path)), false);
    for (let chapter = 1; chapter <= 10; chapter += 1) {
      const path = `units/vietnamese-core/chapter-${String(chapter).padStart(3, "0")}-basic-sentences-${chapter}/chapter.md`;
      const source = await readFile(join(sourceRepositoryPath("vietnamese-curriculum"), path), "utf8");
      const packaged = readingContent.files.find((file) => file.path === path)?.text;
      assert.equal(packaged, source, `Chapter ${chapter} packages canonical source without compatibility rewriting`);
      assert.doesNotMatch(packaged, /^#{1,6}\s+(?:Content|Complete Rereading|Learner-facing Dialogue|Learner-facing Narrative)\s*$/imu);
      const type = chapter % 2 === 1 ? "Dialogue" : "Narrative";
      assert.equal((packaged.match(new RegExp(`^### ${type}$`, "gmu")) ?? []).length, 1, `Chapter ${chapter} packages one primary heading`);
      const primary = new RegExp(`^### ${type}\\s*$([\\s\\S]*?)(?=^###\\s+)`, "mu").exec(packaged)?.[1];
      const body = /^```text\s*\n([\s\S]*?)\n```/mu.exec(primary ?? "")?.[1];
      assert.ok(body, `Chapter ${chapter} packages one primary reading body`);
      assert.equal(packaged.split(body).length - 1, 1, `Chapter ${chapter} does not duplicate its primary reading`);
    }
    for (let start = 1; start <= 26; start += 5) {
      const end = start + 4;
      for (const level of ["easy", "hard"]) assert.ok(readingContent.files.some((file) => file.path === `units/vietnamese-core/chapter-${String(start).padStart(3,"0")}-${String(end).padStart(3,"0")}-grammar-${level}/chapter.md`));
    }
    assert.ok(readingContent.files.some((file) => file.path === "number-progression.json"));
    assert.ok(readingContent.files.some((file) => file.path === "lexical-topics.json"));
    assert.ok(readingContent.files.some((file) => file.path === "lexical-topic-audit.json"));
    assert.ok(readingContent.files.some((file) => file.path === "lexical-topic-audit.md"));
    assert.ok(readingContent.files.some((file) => file.path === "sino-vietnamese-lexicon.json"));
    assert.ok(readingContent.files.some((file) => file.path === "sino-vietnamese-audit.json"));
    assert.ok(readingContent.files.some((file) => file.path === "sino-vietnamese-audit.md"));
    const sourcePaths = reviewContent.files.filter((file) => /review-decks\/chapter-\d{3}-\d{3}\/cards\.tsv$/u.test(file.path)).map((file) => file.path).sort();
    assert.deepEqual(sourcePaths, Array.from({ length: 6 }, (_, i) => { const start = i * 5 + 1; return `review-decks/chapter-${String(start).padStart(3,"0")}-${String(start + 4).padStart(3,"0")}/cards.tsv`; }));
    const itemPaths = [...reviewArchive.keys()].filter((path) => path.startsWith("content/memorization/review-decks/")).sort();
    assert.deepEqual(itemPaths, Array.from({ length: 6 }, (_, i) => { const start = i * 5 + 1; return `content/memorization/review-decks/chapter-${String(start).padStart(3,"0")}-${String(start + 4).padStart(3,"0")}.json`; }));
    const items = itemPaths.flatMap((path) => JSON.parse(reviewArchive.get(path).toString("utf8")).items);
    assert.equal(items.length, 462);
    assert.equal(new Set(items.map((item) => item.cardId)).size, items.length);
    assert.equal(items.every((item) => item.kind === "vocabulary" && item.examples?.length >= 1 && item.examples.length <= 3), true);
    assert.deepEqual(new Set(items.map((item) => item.reviewDirection)), new Set(["vi-to-en", "en-to-vi"]));
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
    const additionalReviewBlocks = [
      { start: 26, end: 30, cards: 84 },
      { start: 31, end: 35, cards: 80 },
      { start: 36, end: 40, cards: 80 },
      { start: 41, end: 45, cards: 86 },
      { start: 46, end: 50, cards: 80 },
      { start: 51, end: 55, cards: 102 },
      { start: 56, end: 60, cards: 100 },
      { start: 61, end: 65, cards: 100 },
      { start: 66, end: 70, cards: 110 },
      { start: 71, end: 75, cards: 162 },
      { start: 76, end: 80, cards: 206 }
    ];
    const additionalReviewItems = additionalReviewBlocks.map(({ start, end, cards }) => {
      const slug = `${String(start).padStart(3, "0")}-${String(end).padStart(3, "0")}`;
      const itemPath = `content/memorization/review-decks/chapter-${slug}.json`;
      assert.equal(archive.has(itemPath), true, `Chapter ${start}-${end} review JSON is packaged`);
      const document = JSON.parse(archive.get(itemPath).toString("utf8"));
      assert.equal(document.items.length, cards, `Chapter ${start}-${end} review card count`);
      return document;
    });
    const allReviewItems = [
      ...reviewItems0105.items,
      ...reviewItems0610.items,
      ...reviewItems1115.items,
      ...reviewItems1620.items,
      ...reviewItems2125.items,
      ...additionalReviewItems.flatMap((document) => document.items)
    ];

    assert.equal(result.packageId, "com.sleepymario.language.dutch");
    assert.equal(result.filePath.endsWith("com.sleepymario.language.dutch-0.0.1-r1.wspkg"), true);
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
    assert.equal(cast.activeCast.schemaVersion, 2);
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
    const chapter1Path = "units/dutch-core/chapter-001-basic-sentences-1/chapter.md";
    const translationPath = "units/dutch-core/chapter-001-basic-sentences-1/reading-translation.en.json";
    const supportPath = "units/dutch-core/chapter-001-basic-sentences-1/reading-support.json";
    const chapter1Source = await readFile(join(sourceRepositoryPath("dutch-curriculum"), chapter1Path));
    const translationSource = await readFile(join(sourceRepositoryPath("dutch-curriculum"), translationPath));
    const chapter1Entry = content.files.find((file) => file.path === chapter1Path);
    const translationEntries = content.files.filter((file) => file.path.endsWith("/reading-translation.en.json"));
    assert.ok(chapter1Entry);
    assert.doesNotMatch(chapter1Entry.text, /Complete Rereading/u);
    assert.equal(chapter1Entry.text, chapter1Source.toString("utf8").split("\n").filter((line) => !/^#{1,6}\s+Content\s*$/iu.test(line.trim())).join("\n"));
    assert.equal(createHash("sha256").update(chapter1Source).digest("hex"), "497add825e7ba091e9f42f8a2c7f23fd122aabc4abeb0cc39a116a927dad57e3");
    assert.equal(translationEntries.length, 85);
    for (let chapterNumber = 1; chapterNumber <= 85; chapterNumber += 1) {
      const padded = String(chapterNumber).padStart(3, "0");
      const chapterFile = content.files.find((file) => file.path.includes(`/chapter-${padded}-`) && file.path.endsWith("/chapter.md") && !file.path.includes("grammar"));
      const translationFile = content.files.find((file) => file.path.includes(`/chapter-${padded}-`) && file.path.endsWith("/reading-translation.en.json"));
      assert.ok(chapterFile, `Chapter ${chapterNumber} source is packaged`);
      assert.ok(translationFile, `Chapter ${chapterNumber} translation is packaged`);
      assertChapterIntroductionRoles(chapterFile.text, JSON.parse(translationFile.text), chapterNumber);
    }
    assert.equal(content.files.some((file) => file.path === supportPath), true);
    for (let chapterNumber = 1; chapterNumber <= 85; chapterNumber += 1) {
      const padded = String(chapterNumber).padStart(3, "0");
      const supportEntry = content.files.find((file) => file.path.includes(`/chapter-${padded}-`) && file.path.endsWith("/reading-support.json"));
      assert.ok(supportEntry, `Chapter ${chapterNumber} semantic support is packaged`);
      const support = JSON.parse(supportEntry.text);
      assert.equal(support.semanticRoleSyntaxVersion, 1);
      assert.match(supportEntry.text, /\[\[grammar:[^\]\n]+\]\]/u);
      assert.doesNotMatch(supportEntry.text, /\*\*[^*]+\*\*/u);
      const introduction = support.audienceSections.find((section) => section.sourceHeading === "Brief Introduction");
      assert.ok(introduction, `Chapter ${chapterNumber} has semantic Brief Introduction support`);
      if (chapterNumber <= 75) {
        assert.notEqual(introduction.normal, introduction.expert, `Chapter ${chapterNumber} Normal and Expert introductions differ`);
      } else {
        assert.equal(introduction.normal, introduction.expert, `Chapter ${chapterNumber} preserves the exact authored grammar-only introduction`);
      }
    }
    const chapter1TranslationEntry = translationEntries.find((entry) => entry.path === translationPath);
    assert.ok(chapter1TranslationEntry);
    assert.equal(chapter1TranslationEntry.mediaType, "application/json");
    assert.deepEqual(Buffer.from(chapter1TranslationEntry.text, "utf8"), translationSource);
    const translation = JSON.parse(chapter1TranslationEntry.text);
    assert.deepEqual({
      schemaVersion: translation.schemaVersion,
      id: translation.id,
      language: translation.language,
      sourceLanguage: translation.sourceLanguage,
      sourcePath: translation.sourcePath,
      sourceSection: translation.sourceSection,
      readingType: translation.readingType
    }, {
      schemaVersion: 1,
      id: "dutch-core.chapter-001.learner-facing-dialogue.en",
      language: "en",
      sourceLanguage: "nl",
      sourcePath: "chapter.md",
      sourceSection: "Dialogue",
      readingType: "dialogue"
    });
    assert.deepEqual(translation.turns, [
      { speaker: "Alex", text: "Hello." },
      { speaker: "Sophie", text: "Hello." },
      { speaker: "Alex", text: "I'm Alex Chen." },
      { speaker: "Sophie", text: "I'm Sophie de Vries." },
      { speaker: "Alex", text: "I'm a student." },
      { speaker: "Sophie", text: "I'm a student." },
      { speaker: "Alex", text: "Hi, friend." },
      { speaker: "Marieke", text: "I'm Marieke Smit." },
      { speaker: "Marieke", text: "I'm a teacher." }
    ]);
    assert.equal(content.files.some((file) => file.path.startsWith("units/dutch-core/chapter-002-") && file.path.endsWith("reading-translation.en.json")), true);
    assert.match(readingArchive.get("content/content.json").toString("utf8"), /dutch-core\.chapter-001\.learner-facing-dialogue\.en/u);
    assert.ok(content.files.some((file) => file.path === "units/dutch-core/chapter-006-basic-sentences-6/chapter.md"));
    assert.ok(content.files.some((file) => file.path === "units/dutch-core/chapter-010-basic-sentences-10/chapter.md"));
    const chapter11Path = "units/dutch-core/chapter-011-asking-how-someone-is/chapter.md";
    assert.ok(content.files.some((file) => file.path === chapter11Path));
    assert.match(content.files.find((file) => file.path === chapter11Path).text, /^chapter:\s*11$/mu);
    for (let chapter = 12; chapter <= 85; chapter += 1) {
      assert.ok(content.files.some((file) => file.path.startsWith(`units/dutch-core/chapter-${String(chapter).padStart(3, "0")}-`) && file.path.endsWith("/chapter.md")));
    }
    assert.equal(content.files.some((file) => /^units\/dutch-core\/chapter-075-/u.test(file.path)), true);
    assert.equal(content.files.some((file) => /^units\/dutch-core\/chapter-080-/u.test(file.path)), true);
    assert.equal(content.files.some((file) => /^units\/dutch-core\/chapter-085-/u.test(file.path)), true);
    assert.equal(content.files.some((file) => /^units\/dutch-core\/chapter-086-/u.test(file.path)), false);
    assert.equal(content.files.some((file) => file.path === "lexical-topics.json"), true);
    assert.equal(content.files.some((file) => file.path === "lexical-topic-audit.json"), true);
    assert.equal(content.files.some((file) => file.path === "lexical-topic-audit.md"), true);
    assert.equal(content.files.some((file) => /chapter-011-015-grammar-(?:easy|hard)/u.test(file.path)), true);
    assert.equal(content.files.some((file) => file.path === "review-decks/chapter-011-015/cards.tsv"), true);
    assert.equal(content.files.some((file) => /chapter-016-020-grammar-(?:easy|hard)/u.test(file.path)), true);
    assert.equal(content.files.some((file) => file.path === "review-decks/chapter-016-020/cards.tsv"), true);
    assert.equal(content.files.some((file) => /chapter-021-025-grammar-(?:easy|hard)/u.test(file.path)), true);
    assert.equal(content.files.some((file) => file.path === "review-decks/chapter-021-025/cards.tsv"), true);
    for (const { start, end } of additionalReviewBlocks) {
      const slug = `${String(start).padStart(3, "0")}-${String(end).padStart(3, "0")}`;
      assert.equal(content.files.some((file) => file.path.includes(`chapter-${slug}-grammar-easy/chapter.md`)), true);
      assert.equal(content.files.some((file) => file.path.includes(`chapter-${slug}-grammar-hard/chapter.md`)), true);
      assert.equal(content.files.some((file) => file.path === `review-decks/chapter-${slug}/cards.tsv`), true);
    }
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
    assert.equal(reviewItems0105.items.length, 60);
    assert.equal(reviewItems0610.items.length, 84);
    assert.equal(reviewItems0610.items.every((item) => item.schemaVersion === 2), true);
    assert.equal(reviewItems1115.items.length, 74);
    assert.equal(reviewItems1620.items.length, 84);
    assert.equal(reviewItems2125.items.length, 80);
    assertCoreReviewItemsHaveExamples(allReviewItems, "Dutch");
    assertDutchReviewExamplesComeFromReadContent(allReviewItems, content.files);
    assertOrdinaryBidirectionalItems(allReviewItems, "Dutch");
    assert.equal(reviewItems0105.items[0].source.title, "Chapter 1-5");
    assert.equal(reviewItems0610.items[0].source.title, "Chapter 6-10");
    assert.equal(reviewItems1115.items[0].source.title, "Chapter 11-15");
    assert.equal(reviewItems1620.items[0].source.title, "Chapter 16-20");
    assert.equal(reviewItems2125.items[0].source.title, "Chapter 21-25");
    for (const [index, { start, end }] of additionalReviewBlocks.entries()) {
      assert.equal(additionalReviewItems[index].items[0].source.title, `Chapter ${start}-${end}`);
    }
    assert.ok(reviewItems0105.items.some((item) => item.prompt.text === "hallo" && item.answer.text === "hello"));
    assert.ok(reviewItems0105.items.some((item) => item.prompt.text === "hello" && item.answer.text === "hallo"));
    assert.ok(reviewItems0610.items.some((item) => item.prompt.text === "hebben" && item.answer.text === "have"));
    assert.ok(reviewItems0610.items.some((item) => item.prompt.text === "have" && item.answer.text === "hebben"));
    assert.ok(reviewItems0610.items.some((item) => item.prompt.text === "wonen" && item.answer.text === "live"));
    assert.ok(reviewItems0610.items.some((item) => item.prompt.text === "live" && item.answer.text === "wonen"));
    const halloItem = reviewItems0105.items.find((item) => item.prompt.text === "hallo" && item.answer.text === "hello");
    assert.deepEqual(halloItem.examples, ["Hallo."]);
    const bookItem = reviewItems0105.items.find((item) => item.prompt.text === "het boek" && item.answer.text === "book");
    assert.deepEqual(bookItem.examples, ["Dit is een boek."]);
    const hebItem = reviewItems0610.items.find((item) => item.prompt.text === "hebben" && item.answer.text === "have");
    assert.deepEqual(hebItem.examples, ["Ik heb de tas.", "Ik heb de telefoon.", "Ik heb een sleutel."]);
    const woonItem = reviewItems0610.items.find((item) => item.prompt.text === "wonen" && item.answer.text === "live");
    assert.equal(woonItem.examples?.length >= 1 && woonItem.examples.length <= 3, true);
    assert.equal(allReviewItems.some((item) => item.prompt.text === "Ik ben N" || item.answer.text === "Ik ben N"), false);
    assert.equal(allReviewItems.some((item) => item.prompt.text === "Ik heb N" || item.answer.text === "Ik heb N"), false);
    assert.equal(allReviewItems.some((item) => item.prompt.text === "${FOREIGN-NAME-1}" || item.answer.text === "${FOREIGN-NAME-1}"), false);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

const followerReadingPackageConfigs = [
  ["arabic", "Arabic", "ar", 40, 80, 5, 5],
  ["french", "French", "fr", 104, 208, 10, 10],
  ["german", "German", "de", 103, 206, 10, 10],
  ["hindi", "Hindi", "hi", 46, 92, 5, 5],
  ["japanese", "Japanese", "ja", 87, 260, 10, 10],
  ["russian", "Russian", "ru", 52, 104, 5, 5],
  ["spanish", "Spanish", "es", 56, 112, 5, 5],
  ["thai", "Thai", "th", 52, 104, 5, 5],
  ["zulu", "Zulu", "zu", 42, 84, 5, 5]
].map(([slug, name, language, senses, cards, readingSupport, chapters]) => ({ slug, name, language, senses, cards, readingSupport, chapters }));

for (const config of followerReadingPackageConfigs) {
  const participantSidecarsComplete = true;
  test(`content package generator creates approved ${config.name} chapters and authoritative Review milestones`, async () => {
    const directory = await mkdtemp(join(tmpdir(), `wsm-${config.slug}-package-`));

    try {
      const result = await generateContentPackage({
        targetId: `${config.slug}-curriculum`,
        outputDirectory: directory,
        generatedAt: "2026-07-21T00:00:00Z"
      });
      const readingArchive = await readZip(result.filePath);
      const manifest = JSON.parse(readingArchive.get("manifest.json").toString("utf8"));
      const readingContent = JSON.parse(readingArchive.get("content/content.json").toString("utf8"));
      const { reviewArchive, reviewManifest } = await mergedSplitArchive(readingArchive, directory, `${config.slug}-core-reviews`);
      const reviewItems = ["chapter-001-005", ...(config.chapters === 10 ? ["chapter-006-010"] : [])]
        .flatMap((block) => JSON.parse(reviewArchive.get(`content/memorization/review-decks/${block}.json`).toString("utf8")).items);
      const unitPrefix = `units/${config.slug}-core/`;
      const chapterFiles = readingContent.files.filter((file) => file.path.startsWith(unitPrefix)
        && /^chapter-\d{3}-/u.test(file.path.slice(unitPrefix.length))
        && !file.path.includes("-grammar-")
        && file.path.endsWith("/chapter.md"));

      assert.equal(result.packageId, `com.sleepymario.language.${config.slug}`);
      assert.equal(result.packageVersion, "0.1.0");
      assert.equal(manifest.packageId, `com.sleepymario.language.${config.slug}`);
      assert.equal(manifest.displayName, config.name);
      assert.equal(manifest.contentType, "language-curriculum");
      assert.deepEqual(manifest.capabilities, ["reading-curriculum"]);
      assert.deepEqual(manifest.relatedPackageIds, [`com.sleepymario.language.${config.slug}.reviews`]);
      assert.deepEqual(manifest.languages, ["en", config.language].sort());
      assert.deepEqual(validateContentPackageManifest(manifest).errors, []);
      assert.equal(chapterFiles.length, config.chapters);
      assert.deepEqual(chapterFiles.map((file) => Number.parseInt(file.text.match(/^chapter:\s*(\d+)$/mu)?.[1] ?? "0", 10)).sort((a, b) => a - b), Array.from({ length: config.chapters }, (_, index) => index + 1));
      assert.equal(readingContent.files.some((file) => new RegExp(`^${unitPrefix}chapter-(?:0${String(config.chapters + 1).padStart(2, "0")}|[1-9]\\d{2})-`, "u").test(file.path)), false);
      assert.equal(readingContent.files.some((file) => /(?:foundation|basic-life-sentences|review-decks)/u.test(file.path)), false);
      for (const level of ["easy", "hard"]) {
        assert.ok(readingContent.files.some((file) => file.path === `${unitPrefix}chapter-001-005-grammar-${level}/chapter.md`));
        if (config.chapters === 10) assert.ok(readingContent.files.some((file) => file.path === `${unitPrefix}chapter-006-010-grammar-${level}/chapter.md`));
      }
      assert.equal(readingContent.files.filter((file) => file.path.endsWith("/reading-translation.en.json")).length, config.chapters);
      assert.equal(readingContent.files.filter((file) => file.path.endsWith("/reading-support.json")).length, config.readingSupport);
      if (participantSidecarsComplete) {
        assert.equal(readingContent.files.filter((file) => file.path.endsWith("/chapter-participants.json")).length, config.chapters);
        assert.doesNotThrow(() => assertInstalledCurriculumParticipants(readingContent, manifest.packageId));
        const staleSnapshot = structuredClone(readingContent);
        const staleSidecar = staleSnapshot.files.find(file => file.path.endsWith("/chapter-participants.json"));
        const staleDocument = JSON.parse(staleSidecar.text);
        staleDocument.primaryReadingParticipants[0].label = "あき";
        staleSidecar.text = JSON.stringify(staleDocument);
        assert.throws(
          () => assertInstalledCurriculumParticipants(staleSnapshot, manifest.packageId),
          /(?:declared Dialogue participant CAST-001.*absent|CAST-001.*structural Dialogue label.*expected exact canonical full name)/u
        );
      }
      assert.ok(readingContent.files.some((file) => file.path === `${unitPrefix}cumulative-ledger.md`));
      assert.ok(readingContent.files.some((file) => file.path === "lexical-topics.json"));
      assert.ok(readingContent.files.some((file) => file.path === "lexical-topic-audit.json"));
      assert.ok(readingContent.files.some((file) => file.path === "lexical-topic-audit.md"));
      if (config.slug === "japanese") {
        const contextualFile = readingContent.files.find((file) => file.path === "japanese-contextual-readings.json");
        assert.ok(contextualFile);
        const contextual = JSON.parse(contextualFile.text);
        const what = contextual.entries.find((entry) => entry.writtenForm === "何");
        assert.deepEqual(what.logicalEntryValues, ["what", "何", "なん"]);
        assert.equal(what.occurrences.length, 1);
        assert.equal(what.occurrences[0].evidence, "これは" + "何ですか。");
        assert.equal(contextual.entries.some((entry) => entry.logicalEntryValues[2] === "なに"), false);
      }
      assert.ok(readingContent.files.some((file) => file.path === "vocabulary-forms.json"));
      assert.equal(readingArchive.has("LICENSE-CONTENT"), true);
      assert.equal(readingArchive.has("NOTICE"), true);
      assert.equal(reviewManifest.packageId, `com.sleepymario.language.${config.slug}.reviews`);
      assert.deepEqual(reviewManifest.relatedPackageIds, [`com.sleepymario.language.${config.slug}`]);
      assert.equal(reviewItems.length, config.cards);
      assert.equal(new Set(reviewItems.map((item) => item.testedLexicalIds.at(-1))).size, config.senses);
      const expectedDirections = config.language === "ja"
        ? new Set(["ja-to-en", "en-to-ja", "ja-Kana-to-ja"])
        : new Set([`${config.language}-to-en`, `en-to-${config.language}`]);
      assert.deepEqual(new Set(reviewItems.map((item) => item.reviewDirection)), expectedDirections);
      assertCoreReviewItemsHaveExamples(reviewItems, config.name);
      if (config.language !== "ja") assertOrdinaryBidirectionalItems(reviewItems, config.name);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

}

test("content package generator creates Korean Chapters 1 through 15 and all three authoritative Review milestones", async () => {
  const directory = await mkdtemp(join(tmpdir(), "wsm-korean-package-"));

  try {
    const result = await generateContentPackage({
      targetId: "korean-curriculum",
      outputDirectory: directory,
      generatedAt: "2026-07-21T00:00:00Z"
    });
    const readingArchive = await readZip(result.filePath);
    const manifest = JSON.parse(readingArchive.get("manifest.json").toString("utf8"));
    const readingContent = JSON.parse(readingArchive.get("content/content.json").toString("utf8"));
    const { reviewArchive, reviewManifest } = await mergedSplitArchive(readingArchive, directory, "korean-core-reviews");
    const reviewItems = ["chapter-001-005", "chapter-006-010", "chapter-011-015"]
      .flatMap((block) => JSON.parse(reviewArchive.get(`content/memorization/review-decks/${block}.json`).toString("utf8")).items);
    const chapterFiles = readingContent.files.filter((file) => /^units\/korean-core\/chapter-\d{3}-[^/]+\/chapter\.md$/u.test(file.path) && !file.path.includes("-grammar-"));

    assert.equal(result.packageId, "com.sleepymario.language.korean");
    assert.equal(result.packageVersion, "0.1.0");
    assert.equal(manifest.packageId, "com.sleepymario.language.korean");
    assert.equal(manifest.contentType, "language-curriculum");
    assert.deepEqual(manifest.capabilities, ["reading-curriculum"]);
    assert.deepEqual(manifest.relatedPackageIds, ["com.sleepymario.language.korean.reviews"]);
    assert.deepEqual(validateContentPackageManifest(manifest).errors, []);
    assert.deepEqual(chapterFiles.map((file) => file.path), [
      "units/korean-core/chapter-001-a-polite-first-meeting/chapter.md",
      "units/korean-core/chapter-002-a-room-at-home/chapter.md",
      "units/korean-core/chapter-003-what-is-this/chapter.md",
      "units/korean-core/chapter-004-minji-s-morning/chapter.md",
      "units/korean-core/chapter-005-going-out-together/chapter.md",
      "units/korean-core/chapter-006-a-new-classroom/chapter.md",
      "units/korean-core/chapter-007-ordering-a-snack/chapter.md",
      "units/korean-core/chapter-008-a-simple-daily-schedule/chapter.md",
      "units/korean-core/chapter-009-a-quiet-weekend/chapter.md",
      "units/korean-core/chapter-010-yesterday-at-the-market/chapter.md",
      "units/korean-core/chapter-011-books-at-the-library/chapter.md",
      "units/korean-core/chapter-012-after-class/chapter.md",
      "units/korean-core/chapter-013-choosing-dinner/chapter.md",
      "units/korean-core/chapter-014-a-saturday-outing/chapter.md",
      "units/korean-core/chapter-015-planning-tomorrow/chapter.md"
    ]);
    for (const level of ["easy", "hard"]) {
      assert.ok(readingContent.files.some((file) => file.path === `units/korean-core/chapter-001-005-grammar-${level}/chapter.md`));
      assert.ok(readingContent.files.some((file) => file.path === `units/korean-core/chapter-006-010-grammar-${level}/chapter.md`));
      assert.ok(readingContent.files.some((file) => file.path === `units/korean-core/chapter-011-015-grammar-${level}/chapter.md`));
    }
    assert.equal(readingContent.files.filter((file) => file.path.endsWith("/reading-translation.en.json")).length, 15);
    assert.equal(readingContent.files.filter((file) => file.path.endsWith("/reading-support.json")).length, 15);
    assert.equal(readingContent.files.filter((file) => file.path.endsWith("/chapter-participants.json")).length, 15);
    assert.doesNotThrow(() => assertInstalledCurriculumParticipants(readingContent, manifest.packageId));
    assert.ok(readingContent.files.some((file) => file.path === "units/korean-core/cumulative-ledger.md"));
    assert.ok(readingContent.files.some((file) => file.path === "lexical-topics.json"));
    assert.ok(readingContent.files.some((file) => file.path === "lexical-topic-audit.json"));
    assert.equal(readingContent.files.some((file) => /basic-(?:life-)?sentences|foundation/u.test(file.path)), false);
    assert.equal(reviewManifest.packageId, "com.sleepymario.language.korean.reviews");
    assert.deepEqual(reviewManifest.relatedPackageIds, ["com.sleepymario.language.korean"]);
    assert.equal(reviewItems.length, 264);
    assert.equal(new Set(reviewItems.map((item) => item.testedLexicalIds.at(-1))).size, 132);
    assert.deepEqual(new Set(reviewItems.map((item) => item.reviewDirection)), new Set(["ko-to-en", "en-to-ko"]));
    assertCoreReviewItemsHaveExamples(reviewItems, "Korean");
    assertOrdinaryBidirectionalItems(reviewItems, "Korean");
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

test("production generation requires clean committed source and generator provenance", () => {
  const clean = {
    sourceCommit: "1".repeat(40),
    sourceDirty: false,
    generatorCommit: "2".repeat(40),
    generatorDirty: false
  };
  assert.doesNotThrow(() => assertProductionPackageProvenance(clean));
  assert.throws(
    () => assertProductionPackageProvenance({ ...clean, sourceDirty: true }),
    /refuses dirty source commit/u
  );
  assert.throws(
    () => assertProductionPackageProvenance({ ...clean, generatorDirty: true }),
    /refuses dirty generator commit/u
  );
  assert.throws(
    () => assertProductionPackageProvenance({ ...clean, sourceCommit: "0".repeat(40) }),
    /requires an exact committed source SHA/u
  );
  assert.throws(
    () => assertProductionPackageProvenance({ ...clean, generatorCommit: "not-a-commit" }),
    /requires an exact committed generator SHA/u
  );
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
      "vietnamese-curriculum",
      "--target",
      "dutch-curriculum"
    ]);

    assert.equal(result.exitCode, 0);
    assert.match(result.stdout, /Package generated: com\.sleepymario\.language\.linguistic-terminology/);
    assert.match(result.stdout, /Package generated: com\.sleepymario\.language\.vietnamese/);
    assert.match(result.stdout, /Package generated: com\.sleepymario\.language\.dutch/);
    assert.doesNotMatch(result.stderr, /schema-v1 compatibility|legacy compatibility/u);
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
  assert.deepEqual(reviewManifest.license, { spdx: null, name: "Whacksmacker Curriculum Content License", path: "LICENSE-CONTENT" });
  return {
    archive: new Map([...readingArchive, ...[...reviewArchive].filter(([path]) => path !== "manifest.json" && path !== "content/content.json")]),
    content: { ...readingContent, files: [...readingContent.files, ...reviewContent.files] },
    reviewArchive,
    reviewContent,
    reviewManifest
  };
}

function assertManifestFilesExist(manifest, archive) {
  for (const file of manifest.files) {
    assert.equal(archive.has(file.path), true, `manifest-declared file is missing from archive: ${file.path}`);
  }
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

    if (/^#{1,6}\s+Content\s*$/imu.test(file.text)) {
      failures.push(`${label} (${packageId}) chapter ${chapter}: generated reading retains structural Content wrapper in ${file.path}`);
    }

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

function assertChapterIntroductionRoles(markdown, translation, chapterNumber) {
  const brief = /^#{2,4}\s+Brief Introduction\s*$\n([\s\S]*?)(?=^#{1,6}\s+)/mu.exec(markdown)?.[1]?.trim();
  const exactAuthored = /^audit_status:\s*["']?authored-exact-content["']?\s*$/mu.test(markdown);
  if (exactAuthored) {
    assert.ok(brief, `Chapter ${chapterNumber} has the exact authored Brief Introduction`);
    const primary = /^###\s+(Dialogue|Narrative)\s*$\n([\s\S]*?)(?=^#{1,6}\s+)/mu.exec(markdown);
    assert.ok(primary, `Chapter ${chapterNumber} has the authored primary reading`);
    const setup = primary[2].trim().split(/\n\s*\n/u)[0];
    if (primary[1] === "Dialogue") {
      if (Object.hasOwn(translation, "introduction")) {
        assert.equal(translation.introduction, setup, `Chapter ${chapterNumber} carries exact Dialogue setup when structural translation metadata includes it`);
      }
    } else {
      for (const key of ["introduction", "context", "setting", "participants", "sceneIntroduction"]) {
        assert.equal(Object.hasOwn(translation, key), false, `Chapter ${chapterNumber} Narrative translation has no ${key} preface`);
      }
    }
    return;
  }
  if ([76, 78, 80].includes(chapterNumber)) {
    assert.equal(brief, undefined, `Chapter ${chapterNumber} omits setup from learner-facing projection`);
    assert.match(markdown, /^##\s+Narrative\s*$\n\n\S/mu, `Chapter ${chapterNumber} begins directly with narrative`);
    for (const key of ["introduction", "context", "setting", "participants", "sceneIntroduction"]) {
      assert.equal(Object.hasOwn(translation, key), false, `Chapter ${chapterNumber} translation has no ${key} preface`);
    }
    return;
  }
  assert.ok(brief, `Chapter ${chapterNumber} has Brief Introduction`);
  assert.match(brief, /`[^`]+`|\[\[grammar:[^\]\n]+\]\]/u, `Chapter ${chapterNumber} Brief Introduction identifies taught grammar`);

  const reading = /^###\s+(?:Learner-facing\s+)?(?:Dialogue|Narrative|Controlled Reading|Read Content)\s*$\n([\s\S]*?)(?=^#{1,3}\s+|(?![\s\S]))/mu.exec(markdown);
  assert.ok(reading, `Chapter ${chapterNumber} has a primary Dialogue or Narrative`);
  const blocks = reading[1].trim().split(/\n\s*\n/u).filter(Boolean);
  assert.ok(blocks.length >= 2, `Chapter ${chapterNumber} reading starts with a separate scene introduction`);
  const scene = blocks[0].trim();
  assert.doesNotMatch(scene, /^\s*[^:\n]{1,40}\s*:\s*\S/mu, `Chapter ${chapterNumber} scene introduction precedes dialogue turns`);
  assert.match(scene, /[.!?]$/u, `Chapter ${chapterNumber} scene introduction is prose`);

  for (const key of ["introduction", "context", "setting", "participants", "sceneIntroduction"]) {
    assert.equal(Object.hasOwn(translation, key), false, `Chapter ${chapterNumber} translation has no ${key} preface`);
  }
  const serializedTranslation = JSON.stringify(translation);
  assert.equal(serializedTranslation.includes(brief), false, `Chapter ${chapterNumber} translation omits Brief Introduction`);
  assert.equal(serializedTranslation.includes(scene), false, `Chapter ${chapterNumber} translation omits scene introduction`);
}

function analyzeChapterReadFormatForTest(markdown) {
  const sections = extractReadSectionsForFormatTest(markdown);
  const hasSeparateIntroduction = /^#{2,4}\s+Brief Introduction\s*$[\s\S]+?(?=^#{1,6}\s+)/imu.test(markdown);
  const exactAuthored = /^audit_status:\s*"authored-exact-content"\s*$/mu.test(markdown);
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
      if ((previous === undefined || /^#{1,6}\s/u.test(previous) || /^(?:Pinyin|Meaning):$/u.test(previous))
        && !hasSeparateIntroduction) {
        dialogueBlockWithoutIntro = true;
      }
      const colonColumns = block.lines.map((line) => displayWidthForTest(line.slice(0, line.indexOf(":"))));
      if (!exactAuthored && new Set(colonColumns).size !== 1) {
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
    if (!/^#{2,4}\s+(?:Dialogue|Narrative|對話(?: \/ Learner-facing Dialogue)?|閱讀短文(?: \/ Learner-facing Controlled Reading)?|Learner-facing |Model Mini Dialogue|Model Dialogue|Model Mini Scene|Model Mini Text|Controlled Reading)/iu.test(lines[index])) {
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
  assert.equal(items.every(item => item.examples?.length >= 1 && item.examples.length <= 3), true, `${label} core review items must contain one to three literal primary-reading examples`);
}

function assertOrdinaryBidirectionalItems(items, label) {
  const groups = new Map();
  for (const item of items) {
    const targetLanguage = item.language.target;
    const targetToSource = item.prompt.language === targetLanguage && item.answer.language !== targetLanguage;
    const sourceToTarget = item.answer.language === targetLanguage && item.prompt.language !== targetLanguage;
    const targetForm = targetToSource ? item.prompt.text : sourceToTarget ? item.answer.text : undefined;
    if (targetForm === undefined) continue;
    const key = `${typeof item.source.title === "string" ? item.source.title : item.source.title.en}\0${targetForm}`;
    const record = groups.get(key) ?? { targetToSource: false, sourceToTarget: false };
    record.targetToSource ||= targetToSource;
    record.sourceToTarget ||= sourceToTarget;
    groups.set(key, record);
  }
  const missing = [...groups].filter(([, record]) => !record.targetToSource || !record.sourceToTarget).map(([key]) => key);
  assert.deepEqual(missing, [], `${label} ordinary review must contain both directions for every target form`);
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
    if (!/^###{0,1} (?:Dialogue|Narrative|對話(?: \/ Learner-facing Dialogue)?|閱讀短文(?: \/ Learner-facing Controlled Reading)?|Learner-facing (?:Dialogue|Controlled Reading))$/u.test(lines[index])) {
      continue;
    }
    const dialogue = /Dialogue/u.test(lines[index]);
    for (index += 1; index < lines.length && !/^### (?:新單字 \/ New Vocabulary|New Vocabulary)$/u.test(lines[index]); index++) {
      const line = lines[index].trimEnd();
      if (line.trim() === "" || line === "```text" || line === "```") {
        continue;
      }
      if (dialogue && /^\s*[^:\n]{1,40}\s*:\s*\S/u.test(line)) {
        const utterance = line.replace(/^.*?\s*:\s*(?=\S)/u, "");
        readLines.push(utterance, ...splitSentencesForTest(utterance));
      } else {
        readLines.push(...splitSentencesForTest(line));
      }
    }
  }

  return readLines;
}

function splitSentencesForTest(text) {
  return [...new Intl.Segmenter("nl", { granularity: "sentence" }).segment(text)]
    .map(({ segment }) => segment.trim())
    .filter(Boolean);
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
    const hasSeparateIntroduction = /^#{2,4}\s+Brief Introduction\s*$[\s\S]+?(?=^#{1,6}\s+)/imu.test(file.text);
    const authoredExact = /^audit_status:\s*["']?authored-exact-content["']?\s*$/mu.test(file.text);
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
      if ((previous < 0 || /^#{1,6}\s/u.test(lines[previous]) || /^(?:Pinyin|Meaning):$/u.test(lines[previous]))
        && !hasSeparateIntroduction) {
        missingIntroductions.push(`${file.path}:${index + 1}`);
      }

      const colonColumns = speakerLines.map((line) => displayWidthForTest(line.slice(0, line.indexOf(":"))));
      if (!authoredExact && new Set(colonColumns).size !== 1) {
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
      if ((previous < 0 || /^#{1,6}\s/u.test(lines[previous]) || /^(?:Pinyin|Meaning):$/u.test(lines[previous]))
        && !hasSeparateIntroduction) {
        missingIntroductions.push(`${file.path}:${start + 1}`);
      }

      const colonColumns = speakerLines.map((line) => displayWidthForTest(line.slice(0, line.indexOf(":"))));
      if (!authoredExact && new Set(colonColumns).size !== 1) {
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
