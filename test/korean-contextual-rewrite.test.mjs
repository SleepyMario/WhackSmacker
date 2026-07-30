import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";

const workspace = join(process.cwd(), "..");
const repository = join(workspace, "korean-curriculum");
const expectedPath = join(process.cwd(), "test", "fixtures", "expected-korean-contextual-rewrite.json");
const vocabularyPath = join(repository, "vocabulary-forms.json");
const deckDirectories = ["chapter-001-005", "chapter-006-010", "chapter-011-015"];

test("Korean contextual rewrite matches the independent authored semantic inventory", async () => {
  const expected = JSON.parse(await readFile(expectedPath, "utf8"));
  assert.equal(expected.curriculumId, "korean-core");
  assert.deepEqual(expected.packageIds, [
    "com.sleepymario.language.korean",
    "com.sleepymario.language.korean.reviews"
  ]);
  assert.equal(expected.packageVersion, "0.1.0");
  assert.equal(expected.chapters.length, 15);

  const readingsByChapter = new Map();
  const castCounts = new Map();
  let learnerFacingLines = 0;
  for (const chapter of expected.chapters) {
    const source = await readFile(join(repository, chapter.path), "utf8");
    const root = join(repository, chapter.path, "..");
    const translation = JSON.parse(await readFile(join(root, "reading-translation.en.json"), "utf8"));
    const participants = JSON.parse(await readFile(join(root, "chapter-participants.json"), "utf8"));
    const support = JSON.parse(await readFile(join(process.cwd(), "curriculum-support", "korean", `chapter-${String(chapter.chapter).padStart(3, "0")}`, "reading-support.json"), "utf8"));
    const readingLines = primaryReadingLines(source);
    const translations = (translation.readingType === "dialogue" ? translation.turns : translation.sentences)
      .map(item => typeof item === "string" ? item : item.text);

    assert.match(source, new RegExp(`^# Chapter ${chapter.chapter} -- ${escapeRegExp(chapter.title)}$`, "mu"));
    assert.match(source, new RegExp(`^grammar_id: "${chapter.grammarId}"$`, "mu"));
    assert.deepEqual(readingLines, chapter.readingLines, `Chapter ${chapter.chapter} primary reading`);
    assert.deepEqual(translations, chapter.translations, `Chapter ${chapter.chapter} translations`);
    assert.deepEqual(participants.canonicalCastIds, chapter.participants, `Chapter ${chapter.chapter} participants`);
    assert.deepEqual(frontmatterArray(source, "first_profile_person_ids"), chapter.firstProfilePersonIds);
    assert.equal(exerciseNumbers(source).join(","), "1,2,3,4");
    for (const audience of ["normal", "expert"]) {
      for (const line of readingLines) assert.equal(support.breakdown[audience].includes(line), true, `Chapter ${chapter.chapter} ${audience}: ${line}`);
    }
    if (Array.isArray(support.readingItems)) {
      for (const item of support.readingItems) assert.equal(readingLines.includes(stripDialogueSpeaker(item.evidence ?? item.sourceText)), true);
    }
    readingsByChapter.set(chapter.chapter, readingLines);
    learnerFacingLines += readingLines.length;
    for (const id of chapter.participants) castCounts.set(id, (castCounts.get(id) ?? 0) + 1);
  }

  assert.equal(learnerFacingLines, 110);
  assert.deepEqual(Object.fromEntries(castCounts), {
    "CAST-001": 5,
    "CAST-002": 5,
    "CAST-003": 7,
    "CAST-004": 5,
    "CAST-005": 4
  });
  assert.deepEqual(expected.chapters.map(chapter => chapter.grammarId), Array.from(
    { length: 15 },
    (_, index) => `KOR-GRAMMAR-${String(index + 1).padStart(3, "0")}`
  ));

  const firstProfiles = expected.chapters.flatMap(chapter => chapter.firstProfilePersonIds.map(id => [id, chapter.chapter]));
  assert.deepEqual(firstProfiles, [
    ["CAST-001", 1],
    ["CAST-002", 1],
    ["CAST-003", 3],
    ["CAST-004", 3],
    ["CAST-005", 7]
  ]);
  const introductions = [
    [1, "20-year-old university student 김민지", "32-year-old middle-school teacher 이준호"],
    [3, "21-year-old design student 박서연", "24-year-old rehabilitation assistant 최도윤"],
    [7, "45-year-old public librarian 정수진"]
  ];
  for (const [chapterNumber, ...profiles] of introductions) {
    const source = await readFile(join(repository, expected.chapters[chapterNumber - 1].path), "utf8");
    for (const profile of profiles) assert.equal(source.includes(profile), true);
  }
  const chapter7Participants = JSON.parse(await readFile(join(
    repository,
    expected.chapters[6].path,
    "..",
    "chapter-participants.json"
  ), "utf8"));
  assert.deepEqual(chapter7Participants.unnamedFunctionalParticipants.map(item => item.localId), ["ROLE-CLERK"]);

  const vocabulary = JSON.parse(await readFile(vocabularyPath, "utf8"));
  assert.equal(vocabulary.curriculumId, "korean-core");
  assert.equal(vocabulary.displayRows.length, 133);
  assert.equal(vocabulary.occurrences.length, 133);
  assert.equal(new Set(vocabulary.displayRows.map(row => row.canonicalLexicalId)).size, 132);
  assert.equal(new Set(vocabulary.displayRows.map(row => row.canonicalSenseId)).size, 132);
  const occurrences = new Map(vocabulary.occurrences.map(item => [item.id, item]));
  for (const row of vocabulary.displayRows) {
    const occurrence = occurrences.get(row.occurrenceId);
    assert.ok(occurrence, row.occurrenceId);
    assert.equal(occurrence.chapter, row.chapter);
    assert.equal(readingsByChapter.get(row.chapter).includes(stripDialogueSpeaker(occurrence.sentenceOrExample)), true, row.id);
    assert.equal(occurrence.sentenceOrExample.includes(row.surfaceForm), true, row.id);
    for (let chapter = 1; chapter < row.chapter; chapter += 1) {
      assert.equal(readingsByChapter.get(chapter).some(line => containsExactSurface(line, row.surfaceForm)), false, `${row.id} appears in Chapter ${chapter}`);
    }
  }

  const decks = await Promise.all(deckDirectories.map(async directory => parseDeck(await readFile(
    join(process.cwd(), "review-content", "korean", "review-decks", directory, "cards.tsv"),
    "utf8"
  ))));
  assert.deepEqual(decks.map(cards => cards.length), [94, 90, 80]);
  const cards = decks.flat();
  assert.equal(cards.length, 264);
  assert.equal(new Set(cards.map(card => card.card_id)).size, 264);
  for (const card of cards) {
    const reading = readingsByChapter.get(Number(card.source_chapter));
    assert.equal(reading.includes(stripDialogueSpeaker(card.provenance_evidence)), true, card.card_id);
    for (const example of parseJsonTsvField(card.examples)) assert.equal(reading.includes(stripDialogueSpeaker(example)), true, `${card.card_id}: ${example}`);
  }

  const allReading = [...readingsByChapter.values()].flat();
  for (const value of ["주스는요?", "우유는요?", "빵은요?", "운동 안 해요"]) {
    assert.equal(allReading.some(line => line.includes(value)), true, value);
  }
  assert.equal(vocabulary.displayRows.some(row => row.canonicalForm === "이것"), true);
  assert.equal(readingsByChapter.get(3).some(line => line.includes("이게")), true);
  assert.equal(readingsByChapter.get(3).some(line => line.includes("이건")), true);
  assert.equal(allReading.filter(line => line.includes("고 싶어요")).every(line => readingsByChapter.get(13).includes(line)), true);
  assert.equal(allReading.filter(line => /(?:으러|러)\s/u.test(line)).every(line => readingsByChapter.get(14).includes(line)), true);
  assert.equal(allReading.filter(line => line.includes("ㄹ까요")).length, 0);
  assert.equal(allReading.filter(line => line.includes("까요?")).every(line => readingsByChapter.get(15).includes(line)), true);
});

function primaryReadingLines(markdown) {
  const match = /^### (Dialogue|Narrative)\s*$\n([\s\S]*?)(?=^### New Vocabulary\s*$)/mu.exec(markdown);
  assert.ok(match);
  const lines = match[2].trim().replace(/^[\s\S]*?\n\s*\n/u, "").split(/\r?\n/u).map(line => line.trim()).filter(Boolean);
  return match[1] === "Dialogue" ? lines.map(line => line.replace(/^[^:：]+[:：]\s*/u, "")) : lines;
}

function exerciseNumbers(markdown) {
  const match = /^### Simple Exercises\s*$\n([\s\S]*?)(?=^#{1,3}\s|^<!--|(?![\s\S]))/mu.exec(markdown);
  assert.ok(match);
  return match[1].split(/\r?\n/u).flatMap(line => {
    const item = /^(\d+)\.\s+\S/u.exec(line);
    return item === null ? [] : [Number(item[1])];
  });
}

function frontmatterArray(markdown, field) {
  const match = new RegExp(`^${field}: (\\[[^\\n]*\\])$`, "mu").exec(markdown);
  assert.ok(match);
  return JSON.parse(match[1]);
}

function parseDeck(text) {
  const [header, ...lines] = text.trimEnd().split("\n");
  const columns = header.split("\t");
  return lines.map(line => Object.fromEntries(line.split("\t").map((value, index) => [columns[index], value])));
}

function parseJsonTsvField(value) {
  return JSON.parse(value.startsWith('"') && value.endsWith('"')
    ? value.slice(1, -1).replaceAll('""', '"')
    : value);
}

function stripDialogueSpeaker(value) {
  return value.replace(/^[^:]+:\s*/u, "");
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

function containsExactSurface(value, surface) {
  return new RegExp(`(?<![\\p{L}\\p{M}])${escapeRegExp(surface)}(?![\\p{L}\\p{M}])`, "u").test(value);
}
