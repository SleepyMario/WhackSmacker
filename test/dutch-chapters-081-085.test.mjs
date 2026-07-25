import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";

const curriculumRoot = join(process.cwd(), "..", "dutch-curriculum");
const unitsRoot = join(curriculumRoot, "units", "dutch-core");
const reviewPath = join(process.cwd(), "review-content", "dutch", "review-decks", "chapter-081-085", "cards.tsv");
const chapters = new Map([
  [81, ["chapter-081-a-new-member-of-the-study-group", "dialogue"]],
  [82, ["chapter-082-emmas-first-photo-exhibition", "narrative"]],
  [83, ["chapter-083-a-safe-route-to-the-station", "dialogue"]],
  [84, ["chapter-084-furnishing-noors-studio", "narrative"]],
  [85, ["chapter-085-preparing-a-school-presentation", "dialogue"]]
]);

test("Dutch Chapters 81-85 preserve modes, 160 reading units, and introduction boundaries", async () => {
  let units = 0;
  for (const [chapter, [directory, mode]] of chapters) {
    const root = join(unitsRoot, directory);
    const [markdown, translation] = await Promise.all([
      readFile(join(root, "chapter.md"), "utf8"),
      readJson(join(root, "reading-translation.en.json"))
    ]);
    assert.match(markdown, new RegExp(`^chapter: ${chapter}$`, "mu"));
    assert.match(markdown, new RegExp(`^type: "${mode}"$`, "mu"));
    assert.match(markdown, /^### Brief Introduction$/mu);
    assert.equal(translation.chapter, chapter);
    assert.equal(translation.mode, mode);
    assert.equal(typeof translation.introduction, "string");
    assert.ok(translation.introduction.length > 0);
    const readingUnits = mode === "dialogue" ? translation.turns : translation.sentences;
    assert.equal(readingUnits.length, 32, `Chapter ${chapter}`);
    assert.equal(readingUnits.some((unit) => Object.values(unit).includes(translation.introduction)), false);
    units += readingUnits.length;
  }
  assert.equal(units, 160);
  assert.equal((await readdir(unitsRoot)).some((directory) => /^chapter-086-/u.test(directory)), false);
});

test("Dutch Chapters 81-85 introduce exactly 75 lexical senses and 150 pure bidirectional Review cards", async () => {
  const forms = await readJson(join(curriculumRoot, "vocabulary-forms.json"));
  const rows = forms.displayRows.filter((row) => row.chapter >= 81 && row.chapter <= 85);
  assert.equal(rows.length, 75);
  assert.equal(new Set(rows.map((row) => row.canonicalSenseId)).size, 75);
  for (const row of rows) assert.equal(row.chapter, Number(/chapter-(\d{3})-/u.exec(row.sourcePath)?.[1]));

  const cards = parseTsv(await readFile(reviewPath, "utf8"));
  assert.equal(cards.length, 150);
  assert.equal(new Set(cards.map((card) => card.card_id)).size, 150);
  assert.equal(cards.every((card) => JSON.parse(card.grammar_ids).length === 0), true);
  assert.equal(cards.every((card) => card.kind === "vocabulary"), true);
  assert.equal(cards.every((card) => JSON.parse(card.lexical_ids).length === 2), true);
  const bySense = new Map();
  for (const card of cards) {
    const senseId = JSON.parse(card.lexical_ids).at(-1);
    bySense.set(senseId, [...(bySense.get(senseId) ?? []), card]);
  }
  assert.equal(bySense.size, 75);
  for (const [senseId, pair] of bySense) {
    assert.equal(pair.length, 2, senseId);
    assert.deepEqual(new Set(pair.map((card) => `${card.prompt_language}-to-${card.answer_language}`)), new Set(["nl-to-en", "en-to-nl"]));
    for (const card of pair) {
      const source = await readFile(join(curriculumRoot, card.provenance_path), "utf8");
      assert.match(source, new RegExp(escapeRegExp(card.provenance_evidence)), card.card_id);
      assert.equal(sectionBody(source, "Brief Introduction").includes(card.provenance_evidence), false);
    }
  }
});

test("Dutch Grammar Easy and Hard preserve the same ten chapter identities", async () => {
  const [easy, hard] = await Promise.all(["easy", "hard"].map((variant) => readFile(join(unitsRoot, `chapter-081-085-grammar-${variant}`, "chapter.md"), "utf8")));
  const ids = (markdown) => [...markdown.matchAll(/^### (DUT-GRAMMAR-[A-Z0-9-]+) —/gmu)].map((match) => match[1]);
  assert.equal(ids(easy).length, 10);
  assert.deepEqual(ids(hard), ids(easy));
  const coverage = await readJson(join(curriculumRoot, "grammar-coverage.json"));
  for (const [chapter, [directory]] of chapters) {
    const source = await readFile(join(unitsRoot, directory, "chapter.md"), "utf8");
    const frontmatterIds = JSON.parse(/^grammar_ids: (\[[^\n]+\])$/mu.exec(source)?.[1] ?? "[]");
    assert.equal(frontmatterIds.length, 2);
    assert.deepEqual(ids(easy).slice((chapter - 81) * 2, (chapter - 80) * 2), frontmatterIds);
    for (const grammarId of frontmatterIds) {
      const mapping = coverage.chapterMappings.find((entry) => entry.chapter === chapter);
      assert.ok(mapping?.newGrammarIds.includes(grammarId), grammarId);
    }
  }
});

test("Dutch cast progression and first profiles remain exact through Chapter 85", async () => {
  const expectedFirst = new Map([[81, ["CAST-014"]], [82, ["CAST-015"]], [83, ["CAST-016"]], [84, []], [85, []]]);
  const appearanceCounts = new Map([["CAST-014", 0], ["CAST-015", 0], ["CAST-016", 0]]);
  for (const [chapter, [directory]] of chapters) {
    const [source, participants] = await Promise.all([
      readFile(join(unitsRoot, directory, "chapter.md"), "utf8"),
      readJson(join(unitsRoot, directory, "chapter-participants.json"))
    ]);
    assert.ok(participants.canonicalCastIds.length <= 4);
    for (const castId of appearanceCounts.keys()) {
      if (participants.canonicalCastIds.includes(castId)) appearanceCounts.set(castId, appearanceCounts.get(castId) + 1);
    }
    const firstProfiles = JSON.parse(/^first_profile_person_ids: (\[[^\n]*\])$/mu.exec(source)?.[1] ?? "[]");
    assert.deepEqual(firstProfiles, expectedFirst.get(chapter));
  }
  assert.deepEqual([...appearanceCounts], [["CAST-014", 3], ["CAST-015", 4], ["CAST-016", 3]]);
  const ledger = await readFile(join(curriculumRoot, "name-pools", "appearance-ledger.md"), "utf8");
  assert.match(ledger, /CAST-014[\s\S]*2 remaining through Chapter 100/u);
  assert.match(ledger, /CAST-015[\s\S]*1 remaining through Chapter 100/u);
  assert.match(ledger, /CAST-016[\s\S]*2 remaining through Chapter 100/u);
});

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

function parseTsv(text) {
  const [header, ...lines] = text.trimEnd().split("\n");
  const columns = header.split("\t");
  return lines.map((line) => Object.fromEntries(line.split("\t").map((value, index) => [columns[index], value])));
}

function sectionBody(markdown, heading) {
  const match = new RegExp(`^#{1,6} ${escapeRegExp(heading)}$\\n([\\s\\S]*?)(?=^#{1,6} )`, "mu").exec(markdown);
  return match?.[1]?.trim() ?? "";
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}
