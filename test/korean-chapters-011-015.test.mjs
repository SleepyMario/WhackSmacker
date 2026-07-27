import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";

const workspace = join(process.cwd(), "..");
const repository = join(workspace, "korean-curriculum");
const unitRoot = join(repository, "units", "korean-core");
const expectedDirectories = new Map([
  [11, "chapter-011-books-at-the-library"],
  [12, "chapter-012-after-class"],
  [13, "chapter-013-choosing-dinner"],
  [14, "chapter-014-a-saturday-outing"],
  [15, "chapter-015-planning-tomorrow"]
]);
const expectedGrammarIds = Array.from({ length: 5 }, (_, index) => `KOR-GRAMMAR-${String(index + 11).padStart(3, "0")}`);
const deckPath = join(process.cwd(), "review-content", "korean", "review-decks", "chapter-011-015", "cards.tsv");

test("Korean Chapters 11–15 reconstruct authored readings, ledgers, support, participants, and Review", async () => {
  const found = (await readdir(unitRoot, { withFileTypes: true }))
    .filter(entry => entry.isDirectory() && /^chapter-0(?:11|12|13|14|15)-/u.test(entry.name) && !entry.name.includes("grammar"))
    .map(entry => entry.name)
    .sort();
  assert.deepEqual(found, [...expectedDirectories.values()]);

  const reconstructed = [];
  for (const [chapter, directory] of expectedDirectories) {
    const root = join(unitRoot, directory);
    const markdown = await readFile(join(root, "chapter.md"), "utf8");
    const translation = JSON.parse(await readFile(join(root, "reading-translation.en.json"), "utf8"));
    const participants = JSON.parse(await readFile(join(root, "chapter-participants.json"), "utf8"));
    const support = JSON.parse(await readFile(join(process.cwd(), "curriculum-support", "korean", `chapter-${String(chapter).padStart(3, "0")}`, "reading-support.json"), "utf8"));
    const ledger = parseMarkdownTable(await readFile(join(root, "ledger.md"), "utf8"), "| Entry ID | Sense ID | Form | Meaning | POS | Reading line |");
    const reading = primaryReadingLines(markdown);
    const heading = chapter % 2 === 1 ? "Dialogue" : "Narrative";

    assert.match(markdown, new RegExp(`^chapter: ${chapter}$`, "mu"));
    assert.match(markdown, new RegExp(`^type: ${chapter % 2 === 1 ? "dialogue" : "narrative"}$`, "mu"));
    assert.match(markdown, new RegExp(`grammar_id: "KOR-GRAMMAR-${String(chapter).padStart(3, "0")}"`, "u"));
    assert.ok(markdown.indexOf(`### ${heading}`) < markdown.indexOf("### New Vocabulary"));
    assert.ok(markdown.indexOf("### New Vocabulary") < markdown.indexOf("### Grammar"));
    assert.equal(reading.length, 8);
    assert.equal(ledger.length, 8);
    assert.equal(translation.readingType, chapter % 2 === 1 ? "dialogue" : "narrative");
    const translated = translation.readingType === "dialogue" ? translation.turns : translation.sentences;
    assert.equal(translated.length, 8);
    assert.equal(JSON.stringify(translation), JSON.stringify(translation).normalize("NFC"));
    if (translation.readingType === "dialogue") {
      assert.deepEqual(translation.turns.map(turn => turn.speaker), structuralDialogueLabels(markdown));
    }

    assert.deepEqual(participants.canonicalCastIds, ["CAST-001", "CAST-002"]);
    assert.deepEqual(new Set(participants.primaryReadingParticipants.map(person => person.participantId)), new Set(["CAST-001", "CAST-002"]));
    assert.deepEqual(new Set(participants.introductionParticipants.map(person => person.label)), new Set(["김민지", "이준호"]));
    assert.deepEqual(new Set(participants.supportParticipants.map(person => person.label)), new Set(["김민지", "이준호"]));

    const supportIntroduction = support.audienceSections.find(section => section.sourceHeading === "Brief Introduction");
    assert.ok(supportIntroduction?.normal.includes("김민지"));
    assert.ok(supportIntroduction?.normal.includes("이준호"));
    for (const audience of ["normal", "expert"]) {
      const rows = support.breakdown[audience].split("\n").filter(line => line.startsWith("- "));
      assert.equal(rows.length, 8);
      for (const line of reading) assert.equal(support.breakdown[audience].includes(line), true, `${chapter} ${audience}: ${line}`);
    }
    assert.equal(support.readingItems.length, 8);

    for (const row of ledger) {
      const line = Number(row[5]);
      assert.equal(line >= 1 && line <= 8, true);
      const evidence = reading[line - 1];
      reconstructed.push({
        chapter,
        directory,
        entryId: row[0],
        senseId: row[1],
        form: row[2],
        meaning: row[3],
        evidence,
        line
      });
    }
  }

  assert.equal(reconstructed.length, 40);
  assert.equal(new Set(reconstructed.map(item => item.entryId)).size, 40);
  assert.equal(new Set(reconstructed.map(item => item.senseId)).size, 40);

  const cumulative = parseMarkdownTable(
    await readFile(join(unitRoot, "cumulative-ledger.md"), "utf8"),
    "| Entry ID | Sense ID | Learner-facing form | Meaning | POS | First | Review | Provenance | Line |"
  ).filter(row => Number(row[5]) >= 11 && Number(row[5]) <= 15);
  assert.equal(cumulative.length, 40);
  assert.deepEqual(new Set(cumulative.map(row => row[1])), new Set(reconstructed.map(item => item.senseId)));

  const vocabulary = JSON.parse(await readFile(join(repository, "vocabulary-forms.json"), "utf8"));
  const displayRows = vocabulary.displayRows.filter(row => row.chapter >= 11 && row.chapter <= 15);
  const occurrences = new Map(vocabulary.occurrences.map(occurrence => [occurrence.id, occurrence]));
  assert.equal(displayRows.length, 40);
  assert.deepEqual(new Set(displayRows.map(row => row.canonicalSenseId)), new Set(reconstructed.map(item => item.senseId)));
  for (const row of displayRows) {
    const occurrence = occurrences.get(row.occurrenceId);
    const source = reconstructed.find(item => item.senseId === row.canonicalSenseId);
    assert.ok(occurrence && source);
    assert.equal(occurrence.sentenceOrExample, source.evidence);
  }

  const cards = parseDeck(await readFile(deckPath, "utf8"));
  assert.equal(cards.length, 80);
  assert.equal(new Set(cards.map(card => card.id)).size, 80);
  assert.deepEqual(new Set(cards.map(card => card.senseId)), new Set(reconstructed.map(item => item.senseId)));
  const directions = new Map();
  for (const card of cards) {
    const source = reconstructed.find(item => item.senseId === card.senseId);
    assert.ok(source);
    assert.equal(card.chapter, source.chapter);
    assert.equal(card.evidence, source.evidence);
    assert.equal(card.examples.includes(source.evidence), true);
    assert.deepEqual(card.distractors, []);
    assert.deepEqual(card.grammarIds, []);
    const set = directions.get(card.senseId) ?? new Set();
    set.add(`${card.promptLanguage}-to-${card.answerLanguage}`);
    directions.set(card.senseId, set);
  }
  for (const set of directions.values()) assert.deepEqual([...set].sort(), ["en-to-ko", "ko-to-en"]);

  for (const level of ["easy", "hard"]) {
    const summary = await readFile(join(unitRoot, `chapter-011-015-grammar-${level}`, "chapter.md"), "utf8");
    assert.deepEqual([...new Set(summary.match(/KOR-GRAMMAR-\d{3}/gu))], expectedGrammarIds);
  }
});

function sectionBody(markdown, title, level = 3) {
  const lines = markdown.replace(/\r\n?/gu, "\n").split("\n");
  const start = lines.findIndex(line => line === `${"#".repeat(level)} ${title}`);
  assert.notEqual(start, -1, `${title} heading`);
  const end = lines.findIndex((line, index) => index > start && new RegExp(`^#{1,${level}}\\s+`, "u").test(line));
  return lines.slice(start + 1, end < 0 ? lines.length : end).join("\n").trim();
}

function primaryReadingLines(markdown) {
  const dialogue = /^### Dialogue$/mu.test(markdown);
  const section = sectionBody(markdown, dialogue ? "Dialogue" : "Narrative");
  const blocks = section.split(/\n\s*\n/u).filter(Boolean);
  const body = blocks.slice(1).join("\n").split(/\r?\n/u).map(line => line.trim()).filter(Boolean);
  return body.map(line => dialogue ? line.replace(/^[^:：]+[:：]\s*/u, "") : line);
}

function structuralDialogueLabels(markdown) {
  if (!/^### Dialogue$/mu.test(markdown)) return [];
  const section = sectionBody(markdown, "Dialogue");
  return section.split(/\r?\n/u).flatMap(line => {
    const match = /^([^:：\n]+)[:：]\s*\S/u.exec(line.trim());
    return match === null ? [] : [match[1].trim()];
  });
}

function parseMarkdownTable(text, header) {
  const lines = text.split(/\r?\n/u);
  const start = lines.indexOf(header);
  assert.notEqual(start, -1, header);
  const rows = [];
  for (const line of lines.slice(start + 2)) {
    if (!line.startsWith("|")) break;
    rows.push(line.slice(1, -1).split("|").map(cell => cell.trim()));
  }
  return rows;
}

function parseDeck(text) {
  const [header, ...lines] = text.trimEnd().split("\n");
  const columns = header.split("\t");
  return lines.map(line => {
    const row = Object.fromEntries(line.split("\t").map((value, index) => [columns[index], value]));
    const lexicalIds = JSON.parse(row.lexical_ids);
    return {
      id: row.card_id,
      chapter: Number(row.source_chapter),
      promptLanguage: row.prompt_language,
      answerLanguage: row.answer_language,
      distractors: JSON.parse(row.distractors),
      grammarIds: JSON.parse(row.grammar_ids),
      senseId: lexicalIds.at(-1),
      evidence: row.provenance_evidence,
      examples: JSON.parse(row.examples)
    };
  });
}
