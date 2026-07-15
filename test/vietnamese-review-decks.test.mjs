import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";

const curriculumRoot = join(process.cwd(), "..", "vietnamese-curriculum-lesson1");
const deckPaths = [
  "review-content/vietnamese/review-decks/chapter-001-005/cards.tsv",
  "review-content/vietnamese/review-decks/chapter-006-010/cards.tsv"
];

test("authoritative Vietnamese v2 decks contain 20 legal, unique, provenance-backed cards each", async () => {
  const corpus = await curriculumCorpus(curriculumRoot);
  const allIds = new Set();
  for (const [deckIndex, deckPath] of deckPaths.entries()) {
    const rows = parseDeck(await readFile(deckPath, "utf8"));
    const start = deckIndex === 0 ? 1 : 6;
    const end = deckIndex === 0 ? 5 : 10;
    assert.equal(rows.length, 20);
    assert.deepEqual([...new Set(rows.map(row => row.sourceChapter))], [start, start + 1, start + 2, start + 3, end]);
    assert.deepEqual(rows.map(row => row.sourceChapter), [start,start,start,start,start+1,start+1,start+1,start+1,start+2,start+2,start+2,start+2,start+3,start+3,start+3,start+3,end,end,end,end]);
    for (const row of rows) {
      assert.equal(allIds.has(row.cardId), false, `duplicate card ID ${row.cardId}`);
      allIds.add(row.cardId);
      assert.equal(row.sourceChapter >= start && row.sourceChapter <= end, true);
      assert.equal(row.prompt, row.prompt.normalize("NFC"));
      for (const text of [...row.acceptedAnswers, ...row.distractors, row.explanation, row.provenanceEvidence]) assert.equal(text, text.normalize("NFC"));
      const accepted = new Set(row.acceptedAnswers.map(normalized));
      assert.equal(row.distractors.some(value => accepted.has(normalized(value))), false);
      const source = await readFile(join(curriculumRoot, row.provenancePath), "utf8");
      assert.equal(source.includes(row.provenanceEvidence), true, `${row.cardId} evidence must be literal in its source chapter`);
      for (const id of row.canonicalIds) {
        assert.equal(corpus.includes(id), true, `${row.cardId} references unknown canonical ID ${id}`);
        if (!id.startsWith("geo.")) {
          const introducingChapters = chapterAttestations(corpus, id);
          assert.equal(introducingChapters.some(chapter => chapter <= end), true, `${id} is not legal by Chapter ${end}`);
        }
      }
      assert.doesNotMatch(JSON.stringify(row), /Tôi đi đến thư viện\.|vi\.preposition\.den/u);
    }
  }
  assert.equal(allIds.size, 40);
});

function parseDeck(text) {
  const lines = text.trimEnd().split("\n");
  assert.equal(lines[0], "card_id\tdeck\tkind\tsource_chapter\tprompt_language\tanswer_language\tprompt\taccepted_answers\tdistractors\texplanation\tlexical_ids\tgrammar_ids\tgeographic_ids\tprovenance_path\tprovenance_locator\tprovenance_evidence\ttags");
  return lines.slice(1).map(line => {
    const fields = line.split("\t");
    assert.equal(fields.length, 17);
    return {
      cardId: fields[0], sourceChapter: Number(fields[3]), prompt: fields[6],
      acceptedAnswers: JSON.parse(fields[7]), distractors: JSON.parse(fields[8]), explanation: fields[9],
      canonicalIds: [...JSON.parse(fields[10]), ...JSON.parse(fields[11]), ...JSON.parse(fields[12])],
      provenancePath: fields[13], provenanceEvidence: fields[15]
    };
  });
}

async function curriculumCorpus(root) {
  const chunks = [];
  async function visit(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) await visit(path);
      else if (/\.(?:md|json)$/u.test(entry.name)) chunks.push(`\nFILE:${path}\n${await readFile(path, "utf8")}`);
    }
  }
  await visit(root);
  return chunks.join("");
}

function chapterAttestations(corpus, id) {
  const chapters = [];
  for (const section of corpus.split("\nFILE:").slice(1)) {
    if (!section.includes(id)) continue;
    const chapter = section.match(/chapter-(\d{3})-[^\n/]+\/[^\n]*\n/u)?.[1];
    if (chapter !== undefined) chapters.push(Number(chapter));
  }
  return chapters;
}

function normalized(value) {
  return value.normalize("NFC").trim().replace(/\s+/gu, " ");
}
