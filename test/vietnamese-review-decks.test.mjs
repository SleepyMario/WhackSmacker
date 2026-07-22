import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";

import { projectReviewTextForMode } from "../dist/packages/core/index.js";

const curriculumRoot = join(process.cwd(), "..", "vietnamese-curriculum");
const ledgerPath = join(curriculumRoot, "units/vietnamese-core/cumulative-ledger.md");
const deckPaths = [
  "review-content/vietnamese/review-decks/chapter-001-005/cards.tsv",
  "review-content/vietnamese/review-decks/chapter-006-010/cards.tsv",
  "review-content/vietnamese/review-decks/chapter-011-015/cards.tsv",
  "review-content/vietnamese/review-decks/chapter-016-020/cards.tsv",
  "review-content/vietnamese/review-decks/chapter-021-025/cards.tsv",
  "review-content/vietnamese/review-decks/chapter-026-030/cards.tsv",
  "review-content/vietnamese/review-decks/chapter-031-035/cards.tsv",
  "review-content/vietnamese/review-decks/chapter-036-040/cards.tsv",
  "review-content/vietnamese/review-decks/chapter-041-045/cards.tsv",
  "review-content/vietnamese/review-decks/chapter-046-050/cards.tsv"
];
const header = "card_id\tdeck\tkind\tsource_chapter\tprompt_language\tanswer_language\tprompt\taccepted_answers\tdistractors\texplanation\tlexical_ids\tgrammar_ids\tgeographic_ids\tprovenance_path\tprovenance_locator\tprovenance_evidence\texamples\ttags";

test("Vietnamese review decks exactly cover the canonical newly introduced lexical inventory", async () => {
  const inventory = parseCanonicalInventory(await readFile(ledgerPath, "utf8"));
  const decks = await Promise.all(deckPaths.map(async (path) => parseDeck(await readFile(path, "utf8"), path)));
  const report = await auditVietnameseReviewDecks(inventory, decks);

  assert.deepEqual(report, {
    "chapter-001-005": { inventoryCount: 30, cardCount: 60 },
    "chapter-006-010": { inventoryCount: 36, cardCount: 72 },
    "chapter-011-015": { inventoryCount: 47, cardCount: 94 },
    "chapter-016-020": { inventoryCount: 43, cardCount: 86 },
    "chapter-021-025": { inventoryCount: 40, cardCount: 80 },
    "chapter-026-030": { inventoryCount: 35, cardCount: 70 },
    "chapter-031-035": { inventoryCount: 37, cardCount: 74 },
    "chapter-036-040": { inventoryCount: 42, cardCount: 84 },
    "chapter-041-045": { inventoryCount: 51, cardCount: 102 },
    "chapter-046-050": { inventoryCount: 39, cardCount: 78 }
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
      const learnerMeaning = projectReviewTextForMode(canonical.meaning, "normal");
      const numeral = row.tags.includes("number");
      if (numeral) {
        if (targetToSource) {
          assert.equal(row.prompt, canonical.form);
          assert.match(row.acceptedAnswers[0], /^\d+$/u);
          assert.equal(row.acceptedAnswers.includes(learnerMeaning), true);
        } else {
          assert.match(row.prompt, /^\d+$/u);
          assert.deepEqual(row.acceptedAnswers, [canonical.form]);
        }
      } else if (targetToSource) {
        assert.equal(row.prompt, canonical.form);
        const permittedEnglishAnswers = new Set([learnerMeaning, ...learnerMeaning.split(";").map((value) => value.trim())]);
        assert.equal(row.acceptedAnswers[0], learnerMeaning);
        assert.equal(row.acceptedAnswers.every((value) => permittedEnglishAnswers.has(value)), true, `${row.cardId}: unexpected accepted answer`);
        assert.equal(new Set(row.acceptedAnswers).size, row.acceptedAnswers.length);
      } else {
        assert.equal(row.prompt, learnerMeaning);
        const regionalOrContextualVariants = new Map([
          ["vi.noun.goi-cuon.fresh-spring-roll", ["nem cuốn"]],
          ["vi.noun.bun-bo.spicy-beef-rice-noodle-soup", ["bún bò Huế"]]
        ]);
        const permittedTargetAnswers = [canonical.form, ...(regionalOrContextualVariants.get(canonical.senseId) ?? [])];
        assert.deepEqual(row.acceptedAnswers, permittedTargetAnswers);
      }
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

  assert.equal(allSenseIds.size, inventory.filter((item) => item.firstIntroductionChapter <= 50).length * 2);
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

test("Vietnamese đây review uses a concise learner answer in both directions", async () => {
  const paths = await Promise.all(deckPaths.map(async (path) => ({ path, text: await readFile(path, "utf8") })));
  const firstDeck = parseDeck(paths[0].text, paths[0].path);
  const rows = firstDeck.rows.filter((row) => row.lexicalIds[1] === "vi.demonstrative.day.proximal-presentational");

  assert.equal(rows.length, 2);
  assert.deepEqual(rows.map((row) => [row.promptLanguage, row.answerLanguage]), [["vi", "en"], ["en", "vi"]]);
  assert.equal(rows.find((row) => row.promptLanguage === "vi").prompt, "đây");
  assert.deepEqual(rows.find((row) => row.promptLanguage === "vi").acceptedAnswers, ["this; here"]);
  assert.equal(rows.find((row) => row.promptLanguage === "en").prompt, "this; here");
  assert.deepEqual(rows.find((row) => row.promptLanguage === "en").acceptedAnswers, ["đây"]);
  assert.equal(paths.every(({ text }) => !/taught frame|attested frame|licensed construction/iu.test(text)), true);
});

test("Vietnamese grammar frames cannot enter lexical Review", async () => {
  const decks = await Promise.all(deckPaths.map(async (path) => parseDeck(await readFile(path, "utf8"), path)));
  const senseIds = new Set(decks.flatMap((deck) => deck.rows.flatMap((row) => row.lexicalIds)));
  const forbiddenGrammarSenses = [
    "vi.phrase.co-phai.polar-identity-frame",
    "vi.phrase.khong-phai-la.negative-identity",
    "vi.particle.khong.polarity",
    "vi.particle.dang.currently-be-in-the-process-of",
    "vi.particle.da.already-completed",
    "vi.particle.chua.not-yet-yet-in-a-question",
    "vi.particle.se.will-future",
    "vi.particle.bi.be-affected-by-suffer-from",
    "vi.particle.nen.should-ought-to",
    "vi.particle.nhung.plural-marker-for-a-group",
    "vi.particle.cac.plural-marker-for-an-identified-set",
    "vi.particle.hon.more-comparative-marker",
    "vi.particle.xong.finished-completion-marker",
    "vi.particle.duoc.beneficial-affected",
    "vi.classifier.cai.general-classifier-for-suitable-inanimate-objects",
    "vi.classifier.quyen.classifier-for-books",
    "vi.classifier.nguoi.human-classifier",
    "vi.classifier.chiec.classifier-for-vehicles-and-selected-objects",
    "vi.classifier.con.animal-classifier",
    "vi.particle.thi.then-in-a-conditional-result",
    "vi.classifier.to.classifier-for-sheets-of-paper",
    "vi.classifier.ban.classifier-for-copies-or-versions"
  ];
  for (const senseId of forbiddenGrammarSenses) assert.equal(senseIds.has(senseId), false, senseId);
  assert.equal(decks.every((deck) => deck.rows.every((row) => row.grammarIds.length === 0)), true);
  const firstDeck = decks[0];
  const noRows = firstDeck.rows.filter((row) => row.lexicalIds.includes("vi.response.khong.no"));
  assert.equal(noRows.length, 2);
  assert.deepEqual(noRows.map((row) => row.prompt), ["không", "no"]);
  assert.equal(noRows.every((row) => row.examples.length === 1 && row.examples[0].startsWith("Không,")), true);
});

test("Vietnamese omitted Chapter 12 and 18 senses have exact first introductions and Review directions", async () => {
  const inventory = parseCanonicalInventory(await readFile(ledgerPath, "utf8"));
  const bySense = new Map(inventory.map((item) => [item.senseId, item]));
  assert.equal(bySense.get("vi.preposition.cho.preparation-for")?.firstIntroductionChapter, 12);
  assert.equal(bySense.get("vi.noun.nha.house-home")?.firstIntroductionChapter, 18);
  assert.equal(bySense.get("vi.preposition.trong.in-inside")?.firstIntroductionChapter, 18);
  assert.equal(bySense.get("vi.noun.phong.room")?.firstIntroductionChapter, 18);

  const before12 = await Promise.all(Array.from({ length: 11 }, (_, index) => readFile(join(curriculumRoot, canonicalPath(index + 1)), "utf8")));
  assert.equal(before12.some((source) => /(^|[^\p{L}\p{M}])cho([^\p{L}\p{M}]|$)/iu.test(extractLearnerFacingLines(source).join("\n"))), false);
  assert.equal(before12.some((source) => /chợ/iu.test(source)), true, "chợ remains an excluded lexical identity");

  const chapters1to17 = await Promise.all(Array.from({ length: 17 }, async (_, index) => readFile(join(curriculumRoot, canonicalPath(index + 1)), "utf8")));
  const vocabularyForms = chapters1to17.flatMap((source) => [...source.matchAll(/^\| ([^|]+) \|/gmu)].map((match) => match[1].trim().toLocaleLowerCase("vi")));
  assert.equal(vocabularyForms.includes("nhà"), false);
  assert.equal(vocabularyForms.includes("trong"), false);
  assert.equal(vocabularyForms.includes("phòng"), false);
  assert.equal(vocabularyForms.includes("nhà hàng"), true);
  assert.equal(vocabularyForms.some((form) => ["phòng học", "nhân viên văn phòng"].includes(form)), true);

  const chapter18 = await readFile(join(curriculumRoot, canonicalPath(18)), "utf8");
  assert.doesNotMatch(chapter18, /Màn hình ở phòng\./u);
  assert.match(chapter18, /Màn hình ở trong phòng\./u);
  const deck11 = parseDeck(await readFile(join(process.cwd(), deckPaths[2]), "utf8"), deckPaths[2]);
  const deck16 = parseDeck(await readFile(join(process.cwd(), deckPaths[3]), "utf8"), deckPaths[3]);
  assert.deepEqual(deck11.rows.filter((row) => row.lexicalIds[1] === "vi.preposition.cho.preparation-for").map((row) => `${row.promptLanguage}->${row.answerLanguage}`).sort(), ["en->vi", "vi->en"]);
  for (const sense of ["vi.noun.nha.house-home", "vi.preposition.trong.in-inside", "vi.noun.phong.room"]) {
    assert.deepEqual(deck16.rows.filter((row) => row.lexicalIds[1] === sense).map((row) => `${row.promptLanguage}->${row.answerLanguage}`).sort(), ["en->vi", "vi->en"]);
  }
  assert.equal([...deck11.rows, ...deck16.rows].every((row) => row.grammarIds.length === 0), true);
});

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
        examples: JSON.parse(fields[16]),
        tags: JSON.parse(fields[17])
      };
    })
  };
}

function extractLearnerFacingLines(markdown) {
  const match = markdown.match(/### Learner-facing (?:Dialogue|Narrative)[\s\S]*?```text\n([\s\S]*?)\n```/u);
  if (match !== null) return match[1].split("\n").filter((line) => line.trim().length > 0).map((line) => {
    const dialogue = line.match(/^.*?\s*:\s*(.+)$/u);
    return (dialogue?.[1] ?? line).trim();
  });

  const lines = markdown.split(/\r?\n/u);
  const start = lines.findIndex((line) => /^### (?:Dialogue|Narrative)$/u.test(line));
  const end = lines.findIndex((line, index) => index > start && /^###\s/u.test(line));
  assert.notEqual(start, -1, "chapter must have a dialogue or narrative block");
  const dialogue = lines[start] === "### Dialogue";
  const blocks = lines.slice(start + 1, end).join("\n").trim().split(/\n\s*\n/u).filter(Boolean);
  return blocks.slice(1).flatMap((block) => block.split(/\r?\n/u)).filter((line) => line.trim().length > 0).flatMap((line) => {
    if (!dialogue) return line.trim().split(/(?<=[.!?])\s+/u);
    const spoken = line.match(/^.*?\s*:\s*(.+)$/u);
    return spoken === null ? [] : [spoken[1].trim()];
  });
}

function locateLearnerFacingLine(markdown, locator) {
  const lineMatch = locator.match(/^(?:Content > Learner-facing )?(Dialogue|Narrative) > line (\d+)$/u);
  if (lineMatch !== null) {
    assert.match(markdown, new RegExp("### (?:Learner-facing )?" + lineMatch[1], "u"));
    return extractLearnerFacingLines(markdown)[Number(lineMatch[2]) - 1];
  }
  const sentenceMatch = locator.match(/^Narrative > paragraph (\d+) > sentence (\d+)$/u);
  assert.ok(sentenceMatch, "unsupported provenance locator: " + locator);
  const lines = markdown.split(/\r?\n/u);
  const start = lines.indexOf("### Narrative");
  const end = lines.findIndex((line, index) => index > start && /^###\s/u.test(line));
  const paragraphs = lines.slice(start + 1, end).join("\n").trim().split(/\n\s*\n/u).filter(Boolean).slice(1);
  const paragraph = paragraphs[Number(sentenceMatch[1]) - 1];
  assert.ok(paragraph, `missing narrative paragraph in ${locator}`);
  return paragraph.trim().split(/(?<=[.!?])\s+/u)[Number(sentenceMatch[2]) - 1];
}

function canonicalPath(chapter) {
  return "units/vietnamese-core/chapter-" + String(chapter).padStart(3, "0") + "-basic-sentences-" + chapter + "/chapter.md";
}

function unquote(value) {
  const match = value.match(/^`([\s\S]*)`$/u);
  return match?.[1] ?? value;
}
