import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";

const curriculumRoot = join(process.cwd(), "..", "vietnamese-curriculum");
const ledgerPath = join(curriculumRoot, "units/vietnamese-core/cumulative-ledger.md");
const deckPaths = [
  "review-content/vietnamese/review-decks/chapter-001-005/cards.tsv",
  "review-content/vietnamese/review-decks/chapter-006-010/cards.tsv"
];
const header = "card_id\tdeck\tkind\tsource_chapter\tprompt_language\tanswer_language\tprompt\taccepted_answers\tdistractors\texplanation\tlexical_ids\tgrammar_ids\tgeographic_ids\tprovenance_path\tprovenance_locator\tprovenance_evidence\texamples\ttags";

test("Vietnamese review decks exactly cover the canonical newly introduced lexical inventory", async () => {
  const inventory = parseCanonicalInventory(await readFile(ledgerPath, "utf8"));
  const decks = await Promise.all(deckPaths.map(async (path) => parseDeck(await readFile(path, "utf8"), path)));
  const report = await auditVietnameseReviewDecks(inventory, decks);

  assert.deepEqual(report, {
    "chapter-001-005": { inventoryCount: 32, cardCount: 64 },
    "chapter-006-010": { inventoryCount: 32, cardCount: 64 }
  });
});

test("Vietnamese review audit rejects missing, extra, unsupported-direction, invented, and out-of-block cards", async () => {
  const inventory = parseCanonicalInventory(await readFile(ledgerPath, "utf8"));
  const decks = await Promise.all(deckPaths.map(async (path) => parseDeck(await readFile(path, "utf8"), path)));
  const clone = () => structuredClone(decks);

  const missing = clone();
  missing[0].rows.pop();
  await assert.rejects(auditVietnameseReviewDecks(inventory, missing), /inventory mismatch|missing/u);

  const extra = clone();
  extra[0].rows.push({ ...extra[0].rows[0], cardId: extra[0].rows[0].cardId + "-extra" });
  await assert.rejects(auditVietnameseReviewDecks(inventory, extra), /inventory mismatch|exactly one card/u);

  const unsupported = clone();
  unsupported[0].rows[0].promptLanguage = "fr";
  await assert.rejects(auditVietnameseReviewDecks(inventory, unsupported), /direction/u);

  const invented = clone();
  invented[0].rows[0].provenanceEvidence = "Xin chào, bạn khỏe không?";
  await assert.rejects(auditVietnameseReviewDecks(inventory, invented), /literal learner-facing line/u);

  const late = clone();
  late[1].rows[0].sourceChapter = 11;
  await assert.rejects(auditVietnameseReviewDecks(inventory, late), /outside block|first-introduction/u);
});

async function auditVietnameseReviewDecks(inventory, decks) {
  const allCardIds = new Set();
  const allSenseIds = new Map();
  const report = {};

  for (const deck of decks) {
    const [start, end] = deck.block;
    const key = "chapter-" + String(start).padStart(3, "0") + "-" + String(end).padStart(3, "0");
    const expected = inventory.filter((item) => item.firstIntroductionChapter >= start && item.firstIntroductionChapter <= end);
    const expectedBySense = new Map(expected.map((item) => [item.senseId, item]));
    const actualSenseCounts = new Map();

    assert.equal(deck.rows.length, expected.length * 2, key + " inventory mismatch: expected " + expected.length * 2 + " cards, got " + deck.rows.length);

    for (const row of deck.rows) {
      assert.equal(allCardIds.has(row.cardId), false, "duplicate card ID " + row.cardId);
      allCardIds.add(row.cardId);
      assert.equal(row.kind, "vocabulary", row.cardId + " must be a vocabulary card");
      const targetToSource = row.promptLanguage === "vi" && row.answerLanguage === "en";
      const sourceToTarget = row.promptLanguage === "en" && row.answerLanguage === "vi";
      assert.equal(targetToSource || sourceToTarget, true, row.cardId + " has an unsupported direction");
      assert.deepEqual(row.distractors, [], row.cardId + " must not contain distractors");
      assert.deepEqual(row.grammarIds, [], row.cardId + " must not test grammar");
      assert.equal(row.sourceChapter >= start && row.sourceChapter <= end, true, row.cardId + " is outside block");
      assert.equal(row.acceptedAnswers.length >= 1, true, row.cardId + " needs an English answer");

      const [entryId, senseId] = row.lexicalIds;
      assert.equal(row.lexicalIds.length, 2, row.cardId + " must identify one entry and one sense");
      const canonical = expectedBySense.get(senseId);
      assert.ok(canonical, row.cardId + " has no matching newly introduced inventory item: " + senseId);
      const directionKey = senseId + ":" + row.promptLanguage + "-to-" + row.answerLanguage;
      actualSenseCounts.set(directionKey, (actualSenseCounts.get(directionKey) ?? 0) + 1);
      assert.equal(entryId, canonical.entryId);
      assert.equal(row.prompt, targetToSource ? canonical.form : canonical.meaning);
      assert.deepEqual(row.acceptedAnswers, [targetToSource ? canonical.meaning : canonical.form]);
      assert.equal(row.sourceChapter, canonical.firstIntroductionChapter, row.cardId + " has an inaccurate first-introduction chapter");
      assert.equal(row.provenancePath, canonicalPath(row.sourceChapter));
      assert.equal(allSenseIds.has(directionKey), false, directionKey + " appears more than once");
      allSenseIds.set(directionKey, key);

      const source = await readFile(join(curriculumRoot, row.provenancePath), "utf8");
      const located = locateLearnerFacingLine(source, row.provenanceLocator);
      assert.equal(located, row.provenanceEvidence, row.cardId + " provenance locator does not resolve to its literal learner-facing line");
      assert.equal(extractLearnerFacingLines(source).includes(row.provenanceEvidence), true, row.cardId + " evidence is not a literal learner-facing line");
      assert.equal(row.examples.length >= 1 && row.examples.length <= 3, true, row.cardId + " must have one to three examples");
      assert.equal(new Set(row.examples).size, row.examples.length, row.cardId + " has duplicate examples");
      for (const example of row.examples) {
        assert.equal(extractLearnerFacingLines(source).includes(example), true, row.cardId + " has a non-literal or invalidly sourced example: " + example);
      }

      for (const value of [
        row.cardId, row.prompt, ...row.acceptedAnswers, row.explanation,
        ...row.lexicalIds, ...row.geographicIds, row.provenancePath,
        row.provenanceLocator, row.provenanceEvidence
      ]) {
        assert.equal(value, value.normalize("NFC"), row.cardId + " contains non-NFC text");
        assert.equal(value, value.trim(), row.cardId + " contains leading or trailing whitespace");
      }
    }

    for (const item of expected) {
      assert.equal(actualSenseCounts.get(item.senseId + ":vi-to-en"), 1, item.senseId + " needs Vietnamese-to-English");
      assert.equal(actualSenseCounts.get(item.senseId + ":en-to-vi"), 1, item.senseId + " needs English-to-Vietnamese");
    }
    report[key] = { inventoryCount: expected.length, cardCount: deck.rows.length };
  }

  assert.equal(allSenseIds.size, inventory.filter((item) => item.firstIntroductionChapter <= 10).length * 2);
  return report;
}

function parseCanonicalInventory(markdown) {
  const rows = markdown.split(/\r?\n/u).filter((line) => /^\| `vi\./u.test(line));
  return rows.map((line) => {
    const cells = line.split("|").slice(1, -1).map((cell) => cell.trim());
    const ids = [...cells[0].matchAll(/`([^`]+)`/gu)].map((match) => match[1]);
    assert.equal(ids.length, 2);
    const entryId = ids[0];
    const senseId = ids[1].startsWith(".") ? entryId + ids[1] : ids[1];
    return {
      entryId,
      senseId,
      form: unquote(cells[1]),
      meaning: cells[3],
      firstIntroductionChapter: Number(cells[4]),
      attestation: unquote(cells[5])
    };
  });
}

function parseDeck(text, path) {
  const lines = text.trimEnd().split("\n");
  assert.equal(lines[0], header);
  const blockMatch = path.match(/chapter-(\d{3})-(\d{3})/u);
  assert.ok(blockMatch);
  return {
    path,
    block: [Number(blockMatch[1]), Number(blockMatch[2])],
    rows: lines.slice(1).map((line) => {
      const fields = line.split("\t");
      assert.equal(fields.length, 18);
      return {
        cardId: fields[0],
        kind: fields[2],
        sourceChapter: Number(fields[3]),
        promptLanguage: fields[4],
        answerLanguage: fields[5],
        prompt: fields[6],
        acceptedAnswers: JSON.parse(fields[7]),
        distractors: JSON.parse(fields[8]),
        explanation: fields[9],
        lexicalIds: JSON.parse(fields[10]),
        grammarIds: JSON.parse(fields[11]),
        geographicIds: JSON.parse(fields[12]),
        provenancePath: fields[13],
        provenanceLocator: fields[14],
        provenanceEvidence: fields[15],
        examples: JSON.parse(fields[16])
      };
    })
  };
}

function extractLearnerFacingLines(markdown) {
  const match = markdown.match(/### Learner-facing (?:Dialogue|Narrative)[\s\S]*?```text\n([\s\S]*?)\n```/u);
  assert.ok(match, "chapter must have a learner-facing dialogue or narrative text block");
  return match[1].split("\n").filter((line) => line.trim().length > 0).map((line) => {
    const dialogue = line.match(/^.*?\s*:\s*(.+)$/u);
    return (dialogue?.[1] ?? line).trim();
  });
}

function locateLearnerFacingLine(markdown, locator) {
  const match = locator.match(/^Content > Learner-facing (Dialogue|Narrative) > line (\d+)$/u);
  assert.ok(match, "unsupported provenance locator: " + locator);
  assert.match(markdown, new RegExp("### Learner-facing " + match[1], "u"));
  return extractLearnerFacingLines(markdown)[Number(match[2]) - 1];
}

function canonicalPath(chapter) {
  return "units/vietnamese-core/chapter-" + String(chapter).padStart(3, "0") + "-basic-sentences-" + chapter + "/chapter.md";
}

function unquote(value) {
  const match = value.match(/^`([\s\S]*)`$/u);
  return match?.[1] ?? value;
}
