import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";
import { promisify } from "node:util";
import { assertSinoVietnameseLexicon } from "../dist/packages/core/index.js";

const appRoot = process.cwd();
const curriculumRoot = join(appRoot, "..", "vietnamese-curriculum");
const supportRoot = join(appRoot, "curriculum-support", "vietnamese");
const execFileAsync = promisify(execFile);

test("repaired Chapters 1-3 retain stable Sino-Vietnamese source and section formatting", async () => {
  const expectedChapters = new Map([
    ["../vietnamese-curriculum/units/vietnamese-core/chapter-001-basic-sentences-1/chapter.md", "a9cffbd95ef24109ec211b48f8e2c7d5bff4bbdce04f217b98f6702b2da6bd2f"],
    ["../vietnamese-curriculum/units/vietnamese-core/chapter-002-basic-sentences-2/chapter.md", "5029c5851747c8fdb8f450658aa705ad1146e63e20811c4f0b8a828b03c16e6e"],
    ["../vietnamese-curriculum/units/vietnamese-core/chapter-003-basic-sentences-3/chapter.md", "e85f4fc43cf11f234c576c8c7a35c675fdae3699d53a02b15a759cb7560d7d7b"]
  ]);
  const expectedCharacterSections = new Map([
    [1, "578c5b13f6f1604e000accf656767ee761e01edff1569f137617b82c9a203799"],
    [2, "87f25ead8f3b2717d3b58d99f94df9649f32aaf0380fb815e2137cc881d0d899"],
    [3, "b2a8f362b2c182269374360c115c681c1fe5b40ffd17581271b11ff312b9b8f9"]
  ]);
  for (const [path, digest] of expectedChapters) {
    const content = await readFile(join(appRoot, path), "utf8");
    const primary = /^### (?:Dialogue|Narrative)\s*$[\s\S]*?^```text\s*$\n([\s\S]*?)\n^```\s*$/mu.exec(content)?.[1];
    assert.ok(primary, path);
    assert.equal(createHash("sha256").update(primary).digest("hex"), digest, path);
  }
  for (const chapter of [1, 2, 3]) {
    const support = JSON.parse(await readFile(join(supportRoot, `chapter-${String(chapter).padStart(3, "0")}`, "reading-support.json"), "utf8"));
    const semanticCharacters = structuredClone(support.characters);
    for (const entry of semanticCharacters.entries) delete entry.provenance.section;
    assert.equal(createHash("sha256").update(JSON.stringify(semanticCharacters)).digest("hex"), expectedCharacterSections.get(chapter));
    assert.equal(support.characters.heading, "Sino-Vietnamese Vocabulary");
    assert.match(support.characters.normal, /^\| Word \| Characters \| Meaning \| Usage \|/u);
    assert.match(support.characters.expert, /^\| Word \| Characters \| Meaning \| Usage \|/u);
    for (const entry of support.characters.entries) assert.deepEqual(Object.keys(entry), ["word", "characters", "meaning", "lexicalEntryId", "senseId", "firstIntroductionChapter", "usage", "provenance"]);
  }
});

test("complete Sino-Vietnamese inventory resolves to canonical senses and earliest learner-facing evidence", async () => {
  const lexicon = JSON.parse(await readFile(join(curriculumRoot, "sino-vietnamese-lexicon.json"), "utf8"));
  const lexicalAudit = JSON.parse(await readFile(join(curriculumRoot, "lexical-topic-audit.json"), "utf8"));
  const canonicalBySenseId = new Map();
  for (const sense of lexicalAudit.canonical_senses) {
    const markdown = await readFile(join(curriculumRoot, sense.provenance_path), "utf8");
    canonicalBySenseId.set(sense.sense_id, { lexicalId: sense.lexical_id, firstChapter: sense.first_introduction_chapter, learnerFacingText: learnerFacingText(markdown) });
  }
  assert.deepEqual(assertSinoVietnameseLexicon(lexicon, { canonicalBySenseId }), { lexicalSenseCount: 59, constituentMorphemeCount: 86, chapterCount: 26 });
  assert.equal(new Set(lexicon.records.map((record) => record.record_id)).size, lexicon.records.length);
  assert.equal(new Set(lexicon.records.map((record) => record.canonical_sense_id)).size, lexicon.records.length);
  assert.equal(lexicon.records.every((record) => record.characters.normalize("NFC") === record.characters && record.han_viet_reading_or_constituent_readings.every((reading) => reading.normalize("NFC") === reading)), true);
});

test("Chapters 4-30 use sections only for eligible newly introduced senses", async () => {
  const audit = JSON.parse(await readFile(join(curriculumRoot, "sino-vietnamese-audit.json"), "utf8"));
  const lexicon = JSON.parse(await readFile(join(curriculumRoot, "sino-vietnamese-lexicon.json"), "utf8"));
  const expectedByChapter = new Map();
  for (const record of lexicon.records) {
    const list = expectedByChapter.get(record.first_introduced_chapter) ?? [];
    list.push(record.canonical_sense_id);
    expectedByChapter.set(record.first_introduced_chapter, list);
  }
  assert.deepEqual(audit.chapters_without_sections, [4, 14, 15, 27]);
  for (let chapter = 4; chapter <= 30; chapter += 1) {
    const support = JSON.parse(await readFile(join(supportRoot, `chapter-${String(chapter).padStart(3, "0")}`, "reading-support.json"), "utf8"));
    const expected = expectedByChapter.get(chapter) ?? [];
    if (expected.length === 0) {
      assert.equal(support.characters, undefined, `Chapter ${chapter} must not fabricate an empty section`);
      continue;
    }
    assert.equal(support.characters.heading, "Sino-Vietnamese Vocabulary");
    assert.deepEqual(support.characters.entries.map((entry) => entry.senseId).sort(), expected.sort(), `Chapter ${chapter}`);
    assert.equal(support.characters.entries.every((entry) => entry.firstIntroductionChapter === chapter), true);
    assert.match(support.characters.normal, /^\| Word \| Characters \| Meaning \| Usage \|/u);
    assert.match(support.characters.expert, /^\| Word \| Characters \| Meaning \| Usage \|/u);
  }
});

test("sense identity excludes grammar lookalikes and rejects speculative or duplicate canonical records", async () => {
  const lexicon = JSON.parse(await readFile(join(curriculumRoot, "sino-vietnamese-lexicon.json"), "utf8"));
  const fruit = lexicon.records.find((record) => record.canonical_sense_id === "vi.noun.cam.orange-fruit");
  assert.equal(fruit.characters, "柑");
  assert.equal(lexicon.records.some((record) => record.canonical_sense_id === "vi.particle.khong.polarity"), false);

  const duplicate = structuredClone(lexicon);
  duplicate.records.push(structuredClone(duplicate.records[0]));
  assert.throws(() => assertSinoVietnameseLexicon(duplicate), /Duplicate/u);
  const speculative = structuredClone(lexicon);
  speculative.records[0].status = "speculative";
  assert.throws(() => assertSinoVietnameseLexicon(speculative), /speculative/u);
  const invalidCharacter = structuredClone(lexicon);
  invalidCharacter.records[0].characters = "ABC";
  assert.throws(() => assertSinoVietnameseLexicon(invalidCharacter), /Han characters|reconstruct/u);
  const decomposed = structuredClone(lexicon);
  decomposed.records[0].citation_form = decomposed.records[0].citation_form.normalize("NFD");
  assert.throws(() => assertSinoVietnameseLexicon(decomposed), /NFC/u);
});

test("Sino-Vietnamese metadata leaves lexical topics, reviews, and the Chapter 30 boundary unchanged", async () => {
  const topics = JSON.parse(await readFile(join(curriculumRoot, "lexical-topics.json"), "utf8"));
  const lexicalAudit = JSON.parse(await readFile(join(curriculumRoot, "lexical-topic-audit.json"), "utf8"));
  const sinoAudit = JSON.parse(await readFile(join(curriculumRoot, "sino-vietnamese-audit.json"), "utf8"));
  assert.equal(topics.max_ordinary_chapter, 30);
  assert.equal(topics.topics.length, 28);
  assert.equal(JSON.stringify(topics).includes("sino-vietnamese"), false);
  assert.deepEqual(lexicalAudit.review_findings.map((finding) => finding.card_count), [60, 72, 94, 86, 80, 70]);
  assert.equal(lexicalAudit.review_findings.every((finding) => finding.mismatch_count === 0 && finding.card_count === finding.canonical_sense_count * 2), true);
  assert.equal(sinoAudit.preservation.lexical_topics_changed, false);
  assert.equal(sinoAudit.preservation.review_cards_changed, false);
  const units = await readdir(join(curriculumRoot, "units", "vietnamese-core"));
  assert.equal(units.some((entry) => entry.startsWith("chapter-030-basic-sentences-30")), true);
  assert.equal(units.some((entry) => /^chapter-(?:03[1-9]|0[4-9]\d|[1-9]\d{2,})-/u.test(entry)), false);
});

test("generated Sino-Vietnamese inventory, audit, and support files are current", async () => {
  await execFileAsync(process.execPath, ["scripts/generate-sino-vietnamese-audit.mjs", "--check"], { cwd: appRoot });
});

function learnerFacingText(markdown) {
  const lines = markdown.split(/\r?\n/u);
  const chunks = [];
  let activeLevel = 0;
  for (const line of lines) {
    const heading = /^(#{2,6})\s+(.+)$/u.exec(line);
    if (heading !== null) {
      const level = heading[1].length;
      if (/^(?:Learner-facing )?(?:Dialogue|Narrative)$/u.test(heading[2])) activeLevel = level;
      else if (activeLevel !== 0 && level <= activeLevel) activeLevel = 0;
    } else if (activeLevel !== 0) chunks.push(line);
  }
  return chunks.join("\n");
}
