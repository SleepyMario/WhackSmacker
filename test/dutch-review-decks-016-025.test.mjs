import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";

const curriculumRoot = join(process.cwd(), "..", "dutch-curriculum");
const header = "card_id\tdeck\tkind\tsource_chapter\tprompt_language\tanswer_language\tprompt\taccepted_answers\tdistractors\texplanation\tlexical_ids\tgrammar_ids\tgeographic_ids\tprovenance_path\tprovenance_locator\tprovenance_evidence\texamples\ttags";

const blocks = [
  {
    start: 16,
    end: 20,
    senses: 42,
    cards: 84,
    sourceCounts: { 16: 12, 17: 18, 18: 18, 19: 20, 20: 16 },
    exampleCounts: { 1: 60, 2: 20, 3: 4 },
    threeExamplePrompts: ["we", "zij"]
  },
  {
    start: 21,
    end: 25,
    senses: 40,
    cards: 80,
    sourceCounts: { 21: 18, 22: 18, 23: 14, 24: 12, 25: 18 },
    exampleCounts: { 1: 58, 2: 16, 3: 6 },
    threeExamplePrompts: ["dat", "de film", "mee"]
  }
];

for (const config of blocks) {
  test(`Dutch Chapters ${config.start}–${config.end} review exactly covers the cumulative inventory in both directions`, async () => {
    const slug = `${String(config.start).padStart(3, "0")}-${String(config.end).padStart(3, "0")}`;
    const deckPath = `review-content/dutch/review-decks/chapter-${slug}/cards.tsv`;
    const rows = parseDeck(await readFile(deckPath, "utf8"));

    assert.equal(rows.length, config.cards);
    assert.deepEqual(countBy(rows, (row) => row.sourceChapter), config.sourceCounts);
    assert.deepEqual(countBy(rows, (row) => row.examples.length), config.exampleCounts);

    const cardIds = new Set();
    const directionsBySense = new Map();
    const sourceCache = new Map();
    for (const [index, row] of rows.entries()) {
      assert.equal(cardIds.has(row.cardId), false, `duplicate card ID ${row.cardId}`);
      cardIds.add(row.cardId);
      assert.equal(row.deck, `Chapter ${config.start}-${config.end}`);
      assert.equal(row.kind, "vocabulary");
      assert.equal(row.sourceChapter >= config.start && row.sourceChapter <= config.end, true);
      assert.deepEqual(row.distractors, []);
      assert.deepEqual(row.grammarIds, []);
      assert.equal(row.lexicalIds.length, 2);
      const [entryId, senseId] = row.lexicalIds;
      assert.match(entryId, /^nl\.[a-z]+\.[a-z0-9-]+$/u);
      assert.equal(senseId.startsWith(`${entryId}.`), true);

      const direction = `${row.promptLanguage}-to-${row.answerLanguage}`;
      assert.equal(direction === "nl-to-en" || direction === "en-to-nl", true);
      const directions = directionsBySense.get(senseId) ?? new Set();
      directions.add(direction);
      directionsBySense.set(senseId, directions);

      const directionSlug = index % 2 === 0 ? "target-to-source" : "source-to-target";
      assert.equal(row.cardId, `nl-core-review-${slug}/${senseId.replaceAll(".", "-")}/${directionSlug}`);
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

      assert.equal(row.examples.length >= 1 && row.examples.length <= 3, true, `${row.cardId} example count`);
      assert.equal(new Set(row.examples).size, row.examples.length, `${row.cardId} duplicate examples`);
      let reading = sourceCache.get(row.provenancePath);
      if (reading === undefined) {
        reading = primaryReadingUnits(await readFile(join(curriculumRoot, row.provenancePath), "utf8"));
        sourceCache.set(row.provenancePath, reading);
      }
      const evidence = reading.find((unit) => unit.locator === row.provenanceLocator)?.text;
      assert.equal(evidence, row.provenanceEvidence, `${row.cardId} locator does not resolve`);
      const literalLines = new Set(reading.map((unit) => unit.text));
      for (const example of row.examples) {
        assert.equal(literalLines.has(example), true, `${row.cardId} invalid example: ${example}`);
      }
      for (const value of [row.cardId, row.prompt, ...row.acceptedAnswers, ...row.examples]) {
        assert.equal(value, value.normalize("NFC"));
        assert.equal(value, value.trim());
      }
    }

    assert.equal(directionsBySense.size, config.senses);
    for (const [senseId, directions] of directionsBySense) {
      assert.deepEqual([...directions].sort(), ["en-to-nl", "nl-to-en"], senseId);
    }

    const ledgerInventory = await canonicalLedgerInventory(config.start, config.end);
    assert.equal(ledgerInventory.length, config.senses);
    const targetRows = rows.filter((row) => row.promptLanguage === "nl");
    assert.deepEqual(targetRows.map((row) => ({ form: row.prompt, first: row.sourceChapter })), ledgerInventory);
    assert.deepEqual(
      targetRows.filter((row) => row.examples.length === 3).map((row) => row.prompt),
      config.threeExamplePrompts
    );
  });
}

async function canonicalLedgerInventory(startChapter, endChapter) {
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
    if (first >= startChapter && first <= endChapter && cells[5] === "yes") {
      inventory.push({ form: cells[1], first, ledgerOrder });
    }
    ledgerOrder += 1;
  }
  return inventory.sort((left, right) => left.first - right.first || left.ledgerOrder - right.ledgerOrder)
    .map(({ form, first }) => ({ form, first }));
}

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

function primaryReadingUnits(markdown) {
  const chapter = Number.parseInt(/^chapter:\s*(\d+)$/mu.exec(markdown)?.[1] ?? "0", 10);
  const section = /^### (Dialogue|Narrative)\n\n([\s\S]*?)(?=^### New Vocabulary$)/mu.exec(markdown);
  assert.ok(section, `Chapter ${chapter} has primary reading`);
  const kind = section[1];
  const blocks = section[2].trim().split(/\n\s*\n/u).filter(Boolean);
  assert.ok(blocks.length >= 2, `Chapter ${chapter} has scene introduction and body`);
  const bodyBlocks = blocks.slice(1);

  if (kind === "Dialogue") {
    return bodyBlocks.join("\n").split(/\r?\n/u).filter(Boolean).map((line, index) => {
      const match = /^.*?\s*:\s*(.+)$/u.exec(line);
      assert.ok(match, `Chapter ${chapter} dialogue line ${index + 1}`);
      return { locator: `Dialogue > line ${index + 1}`, text: match[1].trim() };
    });
  }

  if (chapter <= 20) {
    return bodyBlocks.join("\n").split(/\r?\n/u).filter((line) => line.trim().length > 0)
      .map((line, index) => ({ locator: `Narrative > line ${index + 1}`, text: line.trim() }));
  }

  return bodyBlocks.flatMap((paragraph, paragraphIndex) => splitSentences(paragraph)
    .map((sentence, sentenceIndex) => ({
      locator: `Narrative > paragraph ${paragraphIndex + 1} > sentence ${sentenceIndex + 1}`,
      text: sentence
    })));
}

function splitSentences(text) {
  return [...new Intl.Segmenter("nl", { granularity: "sentence" }).segment(text)]
    .map(({ segment }) => segment.trim())
    .filter(Boolean);
}

function countBy(values, select) {
  const counts = {};
  for (const value of values) counts[select(value)] = (counts[select(value)] ?? 0) + 1;
  return counts;
}
