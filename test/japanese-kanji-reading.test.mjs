import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";

import {
  assertValidJapaneseStructuredReviewItems,
  japaneseExpressionContainsKanji,
  japaneseMoraCount,
  validateJapaneseContextualReadingDocument,
  validateJapaneseVocabularyEntry
} from "../dist/packages/core/index.js";

const reviewRoot = join(process.cwd(), "review-content", "japanese", "review-decks");
const curriculumRoot = join(process.cwd(), "..", "japanese-curriculum");

test("Japanese vocabulary entries use two values without kanji and three with kanji", () => {
  const valid = [
    ["dog", "犬", "いぬ"],
    ["animal", "動物", "どうぶつ"],
    ["to eat", "食べる", "たべる"],
    ["tea", "お茶", "おちゃ"],
    ["kitten", "子猫", "こねこ"],
    ["canned coffee", "缶コーヒー", "かんこーひー"],
    ["cat", "ねこ"],
    ["lion", "ライオン"],
    ["coffee", "コーヒー"]
  ];
  for (const values of valid) {
    assert.deepEqual(validateJapaneseVocabularyEntry(values), { valid: true, errors: [] }, values.join(" / "));
  }
  assert.equal(japaneseExpressionContainsKanji("犬"), true);
  assert.equal(japaneseExpressionContainsKanji("お茶"), true);
  assert.equal(japaneseExpressionContainsKanji("缶・コーヒー"), true);
  assert.equal(japaneseExpressionContainsKanji("缶 コーヒー"), true);
  assert.equal(japaneseExpressionContainsKanji("ライオン"), false);
  assert.equal(validateJapaneseVocabularyEntry(["canned coffee", "缶・コーヒー", "かん・こーひー"]).valid, true);
  assert.equal(validateJapaneseVocabularyEntry(["canned coffee", "缶 コーヒー", "かん こーひー"]).valid, true);
});

test("Japanese vocabulary validation rejects missing, extra, unsafe, and incomplete readings", () => {
  const invalid = [
    [["dog", "犬"], /exactly 3 values/u],
    [["dog", "犬", ""], /nonempty string/u],
    [["cat", "ねこ", "ねこ"], /exactly 2 values/u],
    [["dog", "犬", "い犬"], /must not contain kanji/u],
    [["dog", "犬", "inu"], /must not contain romaji/u],
    [["dog", "犬", "イヌ"], /must not contain ordinary katakana/u],
    [["to eat", "食べる", "た"], /reading is incomplete/u],
    [["canned coffee", "缶・コーヒー", "かんこーひー"], /preserve.*punctuation and spaces/u]
  ];
  for (const [values, message] of invalid) {
    const result = validateJapaneseVocabularyEntry(values);
    assert.equal(result.valid, false, values.join(" / "));
    assert.match(result.errors.join("\n"), message);
  }
});

test("authoritative Japanese TSV decks obey the variable-width logical entry rule", async () => {
  const contextual = JSON.parse(await readFile(join(curriculumRoot, "japanese-contextual-readings.json"), "utf8"));
  assert.equal(validateJapaneseContextualReadingDocument(contextual).size, 87);
  for (const block of ["chapter-001-005", "chapter-006-010"]) {
    const path = join(reviewRoot, block, "cards.tsv");
    const items = parseJapaneseDeck(await readFile(path, "utf8"));
    const [start, end] = block.match(/(\d+)-(\d+)/u).slice(1).map(Number);
    const deckContext = { ...contextual, entries: contextual.entries.filter((entry) => entry.firstIntroductionChapter >= start && entry.firstIntroductionChapter <= end) };
    assert.doesNotThrow(() => assertValidJapaneseStructuredReviewItems(items, path, deckContext));
    for (const group of groupByLexicalIdentity(items).values()) {
      const sourceToTarget = group.find((item) => item.promptLanguage === "en");
      const targetToSource = group.find((item) => item.promptLanguage === "ja");
      assert.ok(sourceToTarget);
      assert.ok(targetToSource);
      const hasKanji = japaneseExpressionContainsKanji(targetToSource.prompt);
      assert.deepEqual(
        labels(sourceToTarget.acceptedAnswers[0]),
        hasKanji ? ["Reading", "Japanese"] : ["Japanese"]
      );
      assert.deepEqual(
        labels(targetToSource.acceptedAnswers[0]),
        hasKanji ? ["Meaning", "Reading"] : ["Meaning"]
      );
    }
  }
  const what = contextual.entries.find((entry) => entry.writtenForm === "何");
  assert.deepEqual(what.logicalEntryValues, ["what", "何", "なん"]);
  assert.equal(what.lexicalEntryId, "ja.pronoun.nan");
  assert.equal(what.senseId, "ja.pronoun.nan.what");
  assert.deepEqual(what.occurrences.map((occurrence) => occurrence.evidence), ["これは何ですか。"]);
  assert.equal(contextual.entries.some((entry) => entry.logicalEntryValues[2] === "なに"), false);
});

test("contextual reading identities reject wrong-reading examples and mixed identities", () => {
  const document = contextualFixture();
  const items = [
    ...syntheticContextualItems(document.entries[0], "ja-core-review-001-005"),
    ...syntheticContextualItems(document.entries[1], "ja-core-review-001-005")
  ];
  assert.doesNotThrow(() => assertValidJapaneseStructuredReviewItems(items, "review-decks/test/cards.tsv", document));
  assert.notEqual(items[0].cardId, items[3].cardId);
  const wrongExample = items.map((item, index) => index === 0 ? { ...item, examples: ["何を食べますか。"] } : item);
  assert.throws(() => assertValidJapaneseStructuredReviewItems(wrongExample, "review-decks/test/cards.tsv", document), /example does not map to an occurrence with the same reading identity/u);
  const wrongReading = items.map((item, index) => index === 0 ? { ...item, acceptedAnswers: ["Reading: なに; Japanese: 何"] } : item);
  assert.throws(() => assertValidJapaneseStructuredReviewItems(wrongReading, "review-decks/test/cards.tsv", document), /disagrees with canonical contextual identity|same complete lexical reading/u);
  const merged = structuredClone(document);
  merged.entries[0].occurrences.push(merged.entries[1].occurrences[0]);
  assert.throws(() => validateJapaneseContextualReadingDocument(merged), /exact written-form occurrence must use canonical reading/u);
});

test("ambiguous C prompts require a deterministic literal-context discriminator", () => {
  const document = contextualFixture();
  const items = document.entries.flatMap((entry) => syntheticContextualItems(entry, "ja-core-review-001-005"));
  const ambiguous = items.map((item, index) => index === 2 ? { ...item, prompt: "何" } : item);
  assert.throws(() => assertValidJapaneseStructuredReviewItems(ambiguous, "review-decks/test/cards.tsv", document), /ambiguous C card/u);
  assert.equal(japaneseMoraCount("だ"), 1);
  assert.equal(japaneseMoraCount("なん"), 2);
  assert.equal(japaneseMoraCount("きゃ"), 1);
  assert.equal(japaneseMoraCount("きっ"), 2);
});

test("Japanese structured Review validation rejects malformed rows in the actual TSV model", () => {
  const valid = syntheticStructuredItems("食べる", "たべる");
  assert.doesNotThrow(() => assertValidJapaneseStructuredReviewItems(valid, "review-decks/test/cards.tsv"));

  const cases = [
    [valid.slice(0, 2), /exactly one Japanese-to-meaning card/u],
    [valid.map((item, index) => index === 0 ? { ...item, acceptedAnswers: ["Japanese: 食べる"] } : item), /Reading, Japanese/u],
    [valid.map((item, index) => index === 0 ? { ...item, acceptedAnswers: ["Reading: ; Japanese: 食べる"] } : item), /empty Reading/u],
    [valid.map((item, index) => index === 1 ? { ...item, prompt: "た" } : item), /complete lexical hiragana reading/u],
    [valid.map((item, index) => index === 2 ? { ...item, acceptedAnswers: ["Meaning: to eat; Reading: 食べる"] } : item), /same complete lexical reading/u]
  ];
  for (const [items, message] of cases) {
    assert.throws(() => assertValidJapaneseStructuredReviewItems(items, "review-decks/test/cards.tsv"), message);
  }
});

test("Japanese TSV parsing rejects a malformed fixed-width row", async () => {
  const path = join(reviewRoot, "chapter-001-005", "cards.tsv");
  const lines = (await readFile(path, "utf8")).trimEnd().split("\n");
  const fields = lines[1].split("\t");
  lines[1] = fields.slice(0, -1).join("\t");
  assert.throws(() => parseJapaneseDeck(lines.join("\n")), /row 2/u);
});

function parseJapaneseDeck(text) {
  const rows = text.trimEnd().split(/\r?\n/u);
  const header = rows[0].split("\t");
  assert.equal(header.length, 18);
  return rows.slice(1).map((line, index) => {
    const fields = line.split("\t");
    assert.equal(fields.length, 18, `row ${index + 2}`);
    return {
      cardId: fields[0],
      sourceChapter: Number(fields[3]),
      promptLanguage: fields[4],
      answerLanguage: fields[5],
      prompt: fields[6],
      acceptedAnswers: JSON.parse(fields[7]),
      testedLexicalIds: JSON.parse(fields[10]),
      provenance: { path: fields[13], locator: fields[14], evidence: fields[15] },
      examples: JSON.parse(fields[16])
    };
  });
}

function contextualFixture() {
  const entry = (romanization, reading, chapter, evidence, locator) => ({
    lexicalEntryId: `ja.pronoun.${romanization}`,
    senseId: `ja.pronoun.${romanization}.what`,
    writtenForm: "何",
    meaning: "what",
    partOfSpeech: "pronoun",
    firstIntroductionChapter: chapter,
    logicalEntryValues: ["what", "何", reading],
    occurrences: [{
      occurrenceId: `ja.fixture.${romanization}.occurrence`, chapter,
      sourcePath: `units/japanese-core/chapter-00${chapter}/chapter.md`,
      sourceLocator: locator, evidence, surfaceForm: "何", contextualReading: reading
    }]
  });
  return {
    schemaVersion: 1,
    policy: "japanese-contextual-reading-identity-policy",
    curriculumId: "fixture",
    auditedThroughChapter: 3,
    entries: [
      entry("nan", "なん", 1, "これは何ですか。", "Dialogue > line 1"),
      entry("nani", "なに", 3, "何を食べますか。", "Dialogue > line 2")
    ]
  };
}

function syntheticContextualItems(entry, deckId) {
  const slug = entry.senseId.replaceAll(".", "-");
  const base = {
    sourceChapter: entry.firstIntroductionChapter,
    testedLexicalIds: [entry.lexicalEntryId, entry.senseId],
    examples: [entry.occurrences[0].evidence],
    provenance: {
      path: entry.occurrences[0].sourcePath,
      locator: entry.occurrences[0].sourceLocator,
      evidence: entry.occurrences[0].evidence
    }
  };
  return [
    { ...base, cardId: `${deckId}/${slug}/a-english-to-japanese`, promptLanguage: "en", answerLanguage: "ja", prompt: "what", acceptedAnswers: [`Reading: ${entry.logicalEntryValues[2]}; Japanese: 何`] },
    { ...base, cardId: `${deckId}/${slug}/b-reading-to-japanese`, promptLanguage: "ja-Kana", answerLanguage: "ja", prompt: entry.logicalEntryValues[2], acceptedAnswers: ["Meaning: what; Japanese: 何"] },
    { ...base, cardId: `${deckId}/${slug}/c-japanese-to-english`, promptLanguage: "ja", answerLanguage: "en", prompt: `Japanese: 何; Context: ${entry.occurrences[0].evidence}`, acceptedAnswers: [`Meaning: what; Reading: ${entry.logicalEntryValues[2]}`] }
  ];
}

function groupByLexicalIdentity(items) {
  const groups = new Map();
  for (const item of items) {
    const key = item.testedLexicalIds.join("\0");
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  return groups;
}

function labels(answer) {
  return [...answer.matchAll(/(?:^|; )(Meaning|Reading|Japanese): /gu)].map((match) => match[1]);
}

function syntheticStructuredItems(written, reading) {
  const base = {
    acceptedAnswers: [],
    testedLexicalIds: ["ja.verb.taberu", "ja.verb.taberu.eat"]
  };
  return [
    {
      ...base,
      cardId: "test/a",
      promptLanguage: "en",
      answerLanguage: "ja",
      prompt: "to eat",
      acceptedAnswers: [`Reading: ${reading}; Japanese: ${written}`]
    },
    {
      ...base,
      cardId: "test/b",
      promptLanguage: "ja-Kana",
      answerLanguage: "ja",
      prompt: reading,
      acceptedAnswers: [`Meaning: to eat; Japanese: ${written}`]
    },
    {
      ...base,
      cardId: "test/c",
      promptLanguage: "ja",
      answerLanguage: "en",
      prompt: written,
      acceptedAnswers: [`Meaning: to eat; Reading: ${reading}`]
    }
  ];
}
