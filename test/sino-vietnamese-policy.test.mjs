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

test("Chapters 1-3 retain the original Sino-Vietnamese source and section formatting", async () => {
  const expectedChapters = new Map([
    ["../vietnamese-curriculum/units/vietnamese-core/chapter-001-basic-sentences-1/chapter.md", "2af0e00b8b0744764d98e44406dac7c521ed986335aaaa6712c33036a25df2a0"],
    ["../vietnamese-curriculum/units/vietnamese-core/chapter-002-basic-sentences-2/chapter.md", "66fb27b413030d4b19b5c389bc7d09fbf30192846e0d5add528ec9d54dc3004b"],
    ["../vietnamese-curriculum/units/vietnamese-core/chapter-003-basic-sentences-3/chapter.md", "0faaa07b7d153360032eafa1bfb55f731be7cfcefbbe9f50604e9e7d2f186215"]
  ]);
  const expectedCharacterSections = new Map([
    [1, "1e2c15a744634ccfa753e99c8251ec439e9c957733e4a3dd29ebe9c9667f55cc"],
    [2, "363adfab3ba2096481484c61b1d220da035130ff16c59e4f2e617b19bf4d43b2"],
    [3, "178d94eb90030d123378fcc7e552e912a4804cedc86304d73927861a5738e21d"]
  ]);
  for (const [path, digest] of expectedChapters) {
    const content = await readFile(join(appRoot, path));
    assert.equal(createHash("sha256").update(content).digest("hex"), digest, path);
  }
  for (const chapter of [1, 2, 3]) {
    const support = JSON.parse(await readFile(join(supportRoot, `chapter-${String(chapter).padStart(3, "0")}`, "reading-support.json"), "utf8"));
    assert.equal(createHash("sha256").update(JSON.stringify(support.characters)).digest("hex"), expectedCharacterSections.get(chapter));
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
  assert.deepEqual(assertSinoVietnameseLexicon(lexicon, { canonicalBySenseId }), { lexicalSenseCount: 105, constituentMorphemeCount: 153, chapterCount: 44 });
  assert.equal(new Set(lexicon.records.map((record) => record.record_id)).size, lexicon.records.length);
  assert.equal(new Set(lexicon.records.map((record) => record.canonical_sense_id)).size, lexicon.records.length);
  assert.equal(lexicon.records.every((record) => record.characters.normalize("NFC") === record.characters && record.han_viet_reading_or_constituent_readings.every((reading) => reading.normalize("NFC") === reading)), true);
});

test("Chapters 4-50 use sections only for eligible newly introduced senses", async () => {
  const audit = JSON.parse(await readFile(join(curriculumRoot, "sino-vietnamese-audit.json"), "utf8"));
  const lexicon = JSON.parse(await readFile(join(curriculumRoot, "sino-vietnamese-lexicon.json"), "utf8"));
  const expectedByChapter = new Map();
  for (const record of lexicon.records) {
    const list = expectedByChapter.get(record.first_introduced_chapter) ?? [];
    list.push(record.canonical_sense_id);
    expectedByChapter.set(record.first_introduced_chapter, list);
  }
  assert.deepEqual(audit.chapters_without_sections, [4, 14, 15, 27, 42, 45]);
  for (let chapter = 4; chapter <= 50; chapter += 1) {
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

test("sense identity separates homonyms and rejects speculative or duplicate canonical records", async () => {
  const lexicon = JSON.parse(await readFile(join(curriculumRoot, "sino-vietnamese-lexicon.json"), "utf8"));
  const fruit = lexicon.records.find((record) => record.canonical_sense_id === "vi.noun.cam.orange-fruit");
  const zero = lexicon.records.find((record) => record.canonical_sense_id === "vi.numeral.khong.zero");
  assert.equal(fruit.characters, "柑");
  assert.equal(zero.characters, "空");
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

test("Sino-Vietnamese metadata leaves lexical topics, reviews, and the Chapter 50 boundary unchanged", async () => {
  const topics = JSON.parse(await readFile(join(curriculumRoot, "lexical-topics.json"), "utf8"));
  const lexicalAudit = JSON.parse(await readFile(join(curriculumRoot, "lexical-topic-audit.json"), "utf8"));
  const sinoAudit = JSON.parse(await readFile(join(curriculumRoot, "sino-vietnamese-audit.json"), "utf8"));
  assert.equal(topics.max_ordinary_chapter, 50);
  assert.equal(topics.topics.length, 33);
  assert.equal(JSON.stringify(topics).includes("sino-vietnamese"), false);
  assert.deepEqual(lexicalAudit.review_findings.map((finding) => finding.card_count), [60, 72, 94, 86, 80, 70, 74, 84, 102, 78]);
  assert.equal(lexicalAudit.review_findings.every((finding) => finding.mismatch_count === 0 && finding.card_count === finding.canonical_sense_count * 2), true);
  assert.equal(sinoAudit.preservation.lexical_topics_changed, false);
  assert.equal(sinoAudit.preservation.review_cards_changed, false);
  const units = await readdir(join(curriculumRoot, "units", "vietnamese-core"));
  assert.equal(units.some((entry) => entry.startsWith("chapter-050-basic-sentences-50")), true);
  assert.equal(units.some((entry) => entry.startsWith("chapter-051-")), false);
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
