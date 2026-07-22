import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";

const deckPath = "review-content/dutch/review-decks/chapter-006-010/cards.tsv";
const curriculumRoot = join(process.cwd(), "..", "dutch-curriculum");
const header = "card_id\tdeck\tkind\tsource_chapter\tprompt_language\tanswer_language\tprompt\taccepted_answers\tdistractors\texplanation\tlexical_ids\tgrammar_ids\tgeographic_ids\tprovenance_path\tprovenance_locator\tprovenance_evidence\texamples\ttags";

test("Dutch Chapter 8 identifies eten and drinken only as the attested verb senses", async () => {
  const chapter = await readFile(join(curriculumRoot, "units/dutch-core/chapter-008-basic-sentences-8/chapter.md"), "utf8");
  assert.match(chapter, /^\| eten \| to eat \| verb \|\s*\|$/mu);
  assert.match(chapter, /^\| drinken \| to drink \| verb \|\s*\|$/mu);
  assert.doesNotMatch(chapter, /^\| eten \| food;/mu);
  assert.doesNotMatch(chapter, /^\| drinken \| drink;/mu);

  const rows = parseDeck(await readFile(deckPath, "utf8"));
  const chapterEightActionRows = rows.filter((row) => row.sourceChapter === 8 && ["eten", "drinken", "to eat", "to drink"].includes(row.prompt));
  assert.deepEqual(
    chapterEightActionRows.map((row) => row.lexicalIds),
    [
      ["nl.verb.eten", "nl.verb.eten.consume-food"],
      ["nl.verb.eten", "nl.verb.eten.consume-food"],
      ["nl.verb.drinken", "nl.verb.drinken.consume-liquid"],
      ["nl.verb.drinken", "nl.verb.drinken.consume-liquid"]
    ]
  );
  assert.equal(rows.some((row) => row.lexicalIds.some((id) => /^nl\.noun\.(?:eten|drinken)(?:\.|$)/u.test(id))), false);
});

test("Dutch Chapters 6–10 review exactly covers 42 canonical senses in both directions", async () => {
  const original = await readFile(deckPath, "utf8");
  const rows = parseDeck(original);
  assert.equal(rows.length, 84);
  assert.deepEqual(countBy(rows, (row) => row.sourceChapter), { 6: 16, 7: 16, 8: 20, 9: 16, 10: 16 });
  assert.deepEqual(countBy(rows, (row) => row.examples.length), { 1: 52, 2: 22, 3: 10 });
  assert.equal(await readFile(deckPath, "utf8"), original);

  const ids = new Set();
  const directionsBySense = new Map();
  for (const [index, row] of rows.entries()) {
    assert.equal(ids.has(row.cardId), false, "duplicate card ID " + row.cardId);
    ids.add(row.cardId);
    assert.equal(row.kind, "vocabulary");
    assert.equal(row.sourceChapter >= 6 && row.sourceChapter <= 10, true);
    assert.equal(row.deck, "Chapter 6-10");
    assert.doesNotMatch(row.deck, /5-10|5–10/u);
    assert.deepEqual(row.distractors, []);
    assert.deepEqual(row.grammarIds, []);
    assert.equal(row.lexicalIds.length, 2);
    const [entryId, senseId] = row.lexicalIds;
    assert.match(entryId, /^nl\.[a-z]+\.[a-z0-9-]+$/u);
    assert.equal(senseId.startsWith(entryId + "."), true);
    const direction = row.promptLanguage + "-to-" + row.answerLanguage;
    assert.equal(direction === "nl-to-en" || direction === "en-to-nl", true);
    const directions = directionsBySense.get(senseId) ?? new Set();
    directions.add(direction);
    directionsBySense.set(senseId, directions);
    const directionSlug = index % 2 === 0 ? "target-to-source" : "source-to-target";
    assert.equal(row.cardId, "nl-core-review-006-010/" + senseId.replaceAll(".", "-") + "/" + directionSlug);
    assert.equal(row.tags.includes(directionSlug), true);
    if (index % 2 === 0) {
      assert.equal(row.promptLanguage, "nl");
      assert.equal(row.answerLanguage, "en");
    } else {
      assert.equal(row.promptLanguage, "en");
      assert.equal(row.answerLanguage, "nl");
      const forward = rows[index - 1];
      assert.deepEqual(row.lexicalIds, forward.lexicalIds);
      assert.equal(row.prompt, forward.acceptedAnswers.join("; "));
      assert.deepEqual(row.acceptedAnswers, [forward.prompt]);
      assert.deepEqual(row.examples, forward.examples);
      assert.equal(row.provenancePath, forward.provenancePath);
      assert.equal(row.provenanceLocator, forward.provenanceLocator);
      assert.equal(row.provenanceEvidence, forward.provenanceEvidence);
    }

    assert.equal(row.examples.length >= 1 && row.examples.length <= 3, true, row.cardId + " example count");
    assert.equal(new Set(row.examples).size, row.examples.length, row.cardId + " duplicate examples");
    const source = await readFile(join(curriculumRoot, row.provenancePath), "utf8");
    const reading = primaryReadingLines(source);
    assert.equal(reading.includes(row.provenanceEvidence), true, row.cardId + " evidence is not primary reading");
    assert.equal(resolveLocator(reading, row.provenanceLocator), row.provenanceEvidence, row.cardId + " locator does not resolve");
    for (const example of row.examples) assert.equal(reading.includes(example), true, row.cardId + " invalid example: " + example);
    for (const value of [row.cardId, row.prompt, ...row.acceptedAnswers, ...row.examples]) {
      assert.equal(value, value.normalize("NFC"));
      assert.equal(value, value.trim());
    }
  }

  assert.equal(directionsBySense.size, 42);
  for (const [senseId, directions] of directionsBySense) {
    assert.deepEqual([...directions].sort(), ["en-to-nl", "nl-to-en"], senseId);
  }

  const ledgerInventory = await canonicalLedgerInventory();
  assert.equal(ledgerInventory.length, 42);
  const targetRows = rows.filter((row) => row.promptLanguage === "nl");
  assert.deepEqual(targetRows.map((row) => ({ form: row.prompt, first: row.sourceChapter })).sort(compareInventory), ledgerInventory.sort(compareInventory));
  assert.equal(targetRows.some((row) => row.sourceChapter <= 5 || row.sourceChapter >= 11), false);
  assert.deepEqual(
    targetRows.filter((row) => row.examples.length === 3).map((row) => row.prompt),
    ["hebben", "je", "willen", "gaan", "naar"]
  );
});

async function canonicalLedgerInventory() {
  const ledger = await readFile(join(curriculumRoot, "units/dutch-core/cumulative-ledger.md"), "utf8");
  const lines = ledger.split(/\r?\n/u);
  const start = lines.indexOf("## Vocabulary Inventory");
  const inventory = [];
  let ledgerOrder = 0;
  for (const line of lines.slice(start + 1)) {
    if (/^##\s/u.test(line)) break;
    if (!line.startsWith("|") || /^\|(?:---| Lemma)/u.test(line)) continue;
    const cells = line.slice(1, -1).split("|").map((cell) => cell.trim());
    const first = Number.parseInt(cells[2] ?? "", 10);
    if (first >= 6 && first <= 10 && cells[5] === "yes") inventory.push({ form: /nl\.verb\.|verbClass/u.test(cells[6]) ? cells[0] : cells[1], first, ledgerOrder });
    ledgerOrder += 1;
  }
  return inventory.sort((left, right) => left.first - right.first || left.ledgerOrder - right.ledgerOrder)
    .map(({ form, first }) => ({ form, first }));
}

function compareInventory(left, right) { return left.first - right.first || left.form.localeCompare(right.form, "nl"); }

function parseDeck(text) {
  const lines = text.trimEnd().split("\n");
  assert.equal(lines[0], header);
  return lines.slice(1).map((line) => {
    const fields = line.split("\t");
    assert.equal(fields.length, 18);
    return {
      cardId: fields[0], deck: fields[1], kind: fields[2], sourceChapter: Number(fields[3]),
      promptLanguage: fields[4], answerLanguage: fields[5], prompt: fields[6],
      acceptedAnswers: JSON.parse(fields[7]), distractors: JSON.parse(fields[8]),
      lexicalIds: JSON.parse(fields[10]), grammarIds: JSON.parse(fields[11]),
      provenancePath: fields[13], provenanceLocator: fields[14], provenanceEvidence: fields[15],
      examples: JSON.parse(fields[16]), tags: JSON.parse(fields[17])
    };
  });
}

function resolveLocator(reading, locator) {
  const match = /^(?:Dialogue|Narrative) > line (\d+)$/u.exec(locator);
  assert.ok(match, "invalid locator " + locator);
  return reading[Number.parseInt(match[1], 10) - 1];
}

function primaryReadingLines(markdown) {
  const lines = markdown.split(/\r?\n/u);
  const start = lines.findIndex((line) => /^### (?:Dialogue|Narrative)$/u.test(line));
  const end = lines.findIndex((line, index) => index > start && /^###\s/u.test(line));
  const dialogue = /Dialogue$/u.test(lines[start] ?? "");
  const blocks = lines.slice(start + 1, end).join("\n").trim().split(/\n\s*\n/u).filter(Boolean);
  const bodyLines = blocks.slice(1).join("\n").split(/\r?\n/u).filter((line) => line.trim().length > 0);
  return bodyLines.flatMap((line) => {
    if (!dialogue) return [line.trim()];
    const match = line.match(/^.*?\s*:\s*(.+)$/u);
    return match === null ? [] : [match[1].trim()];
  });
}

function countBy(values, select) {
  const counts = {};
  for (const value of values) counts[select(value)] = (counts[select(value)] ?? 0) + 1;
  return counts;
}
