import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";

const workspace = join(process.cwd(), "..");
const configs = [
  { slug: "french", code: "fr", prefix: "FRA", senses: 44, cards: 88, lines: 38, directions: ["en-to-fr", "fr-to-en"] },
  { slug: "german", code: "de", prefix: "GER", senses: 48, cards: 96, lines: 40, directions: ["de-to-en", "en-to-de"] },
  { slug: "japanese", code: "ja", prefix: "JPN", senses: 43, cards: 129, lines: 40, directions: ["en-to-ja", "ja-Kana-to-ja", "ja-to-en"] },
  { slug: "korean", code: "ko", prefix: "KOR", senses: 45, cards: 90, lines: 40, directions: ["en-to-ko", "ko-to-en"] }
];

for (const config of configs) {
  test(`${config.slug} Chapters 6–10 reconstruct lexical, grammar, support, and Review evidence`, async () => {
    const repository = join(workspace, `${config.slug}-curriculum`);
    const unitRoot = join(repository, "units", `${config.slug}-core`);
    const directories = (await readdir(unitRoot, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory() && /^chapter-0(?:0[6-9]|10)-/u.test(entry.name) && !entry.name.includes("grammar"))
      .map((entry) => entry.name)
      .sort();
    assert.equal(directories.length, 5);

    const reconstructed = [];
    const grammarIds = [];
    let learnerFacingLines = 0;
    for (const [offset, directory] of directories.entries()) {
      const chapter = offset + 6;
      const markdown = await readFile(join(unitRoot, directory, "chapter.md"), "utf8");
      const reading = primaryReading(markdown);
      const translation = JSON.parse(await readFile(join(unitRoot, directory, "reading-translation.en.json"), "utf8"));
      const translated = translation.readingType === "dialogue" ? translation.turns : translation.sentences;
      const ledger = parseMarkdownTable(await readFile(join(unitRoot, directory, "ledger.md"), "utf8"), "| Entry ID | Sense ID | Form | Meaning | POS | Reading line |");
      const grammarId = `${config.prefix}-GRAMMAR-${String(chapter).padStart(3, "0")}`;
      assert.match(markdown, new RegExp(`^chapter: ${chapter}$`, "mu"));
      assert.match(markdown, new RegExp(`grammar_id: "${grammarId}"`, "u"));
      assert.equal(reading.length, translated.length);
      assert.equal(reading.length >= 6, true);
      assert.equal(JSON.stringify(translation), JSON.stringify(translation).normalize("NFC"));
      assert.doesNotMatch(markdown, /TODO|FIXME|placeholder|dummy/iu);
      learnerFacingLines += reading.length;
      grammarIds.push(grammarId);
      for (const row of ledger) {
        const line = Number(row[5]);
        assert.equal(line >= 1 && line <= reading.length, true, `${row[1]} locator`);
        reconstructed.push({ chapter, directory, lexicalId: row[0], senseId: row[1], canonical: row[2], evidence: reading[line - 1], line });
      }
      const support = JSON.parse(await readFile(join(process.cwd(), "curriculum-support", config.slug, `chapter-${String(chapter).padStart(3, "0")}`, "reading-support.json"), "utf8"));
      for (const line of reading) {
        assert.equal(support.breakdown.normal.includes(line), true, `${config.slug} ${chapter} Normal breakdown omits a line`);
        assert.equal(support.breakdown.expert.includes(line), true, `${config.slug} ${chapter} Expert breakdown omits a line`);
      }
    }
    assert.equal(learnerFacingLines, config.lines);
    assert.equal(reconstructed.length, config.senses);
    assert.equal(new Set(reconstructed.map((sense) => sense.senseId)).size, config.senses);

    const cumulative = parseMarkdownTable(await readFile(join(unitRoot, "cumulative-ledger.md"), "utf8"), "| Entry ID | Sense ID | Learner-facing form | Meaning | POS | First | Review | Provenance | Line |")
      .filter((row) => Number(row[5]) >= 6 && Number(row[5]) <= 10);
    assert.deepEqual(new Set(cumulative.map((row) => row[1])), new Set(reconstructed.map((sense) => sense.senseId)));

    const vocabulary = JSON.parse(await readFile(join(repository, "vocabulary-forms.json"), "utf8"));
    const rows = vocabulary.displayRows.filter((row) => row.chapter >= 6 && row.chapter <= 10);
    const occurrences = new Map(vocabulary.occurrences.map((occurrence) => [occurrence.id, occurrence]));
    assert.equal(rows.length, config.senses);
    assert.deepEqual(new Set(rows.map((row) => row.canonicalSenseId)), new Set(reconstructed.map((sense) => sense.senseId)));
    for (const row of rows) {
      const occurrence = occurrences.get(row.occurrenceId);
      const source = reconstructed.find((sense) => sense.senseId === row.canonicalSenseId);
      assert.ok(occurrence && source);
      assert.equal(occurrence.sentenceOrExample, source.evidence);
      assert.equal(source.evidence.normalize("NFC").includes(row.surfaceForm.normalize("NFC")), true, `${row.id} surface evidence`);
    }

    const cards = parseDeck(await readFile(join(process.cwd(), "review-content", config.slug, "review-decks", "chapter-006-010", "cards.tsv"), "utf8"));
    assert.equal(cards.length, config.cards);
    assert.equal(new Set(cards.map((card) => card.id)).size, config.cards);
    assert.deepEqual(new Set(cards.map((card) => card.senseId)), new Set(reconstructed.map((sense) => sense.senseId)));
    const directionsBySense = new Map();
    for (const card of cards) {
      const source = reconstructed.find((sense) => sense.senseId === card.senseId);
      assert.ok(source);
      assert.equal(card.chapter, source.chapter);
      assert.equal(card.locator, `${/dialogue/iu.test((await readFile(join(unitRoot, source.directory, "chapter.md"), "utf8")).match(/^type:\s*"?([^"\n]+)/mu)?.[1] ?? "") ? "Dialogue" : "Narrative"} > line ${source.line}`);
      assert.equal(card.evidence, source.evidence);
      assert.equal(card.examples.includes(source.evidence), true);
      const directions = directionsBySense.get(card.senseId) ?? new Set();
      directions.add(`${card.promptLanguage}-to-${card.answerLanguage}`);
      directionsBySense.set(card.senseId, directions);
    }
    for (const directions of directionsBySense.values()) assert.deepEqual([...directions].sort(), [...config.directions].sort());

    for (const level of ["easy", "hard"]) {
      const summary = await readFile(join(unitRoot, `chapter-006-010-grammar-${level}`, "chapter.md"), "utf8");
      assert.deepEqual([...new Set(summary.match(new RegExp(`${config.prefix}-GRAMMAR-\\d{3}`, "gu")))], grammarIds);
    }
  });
}

function primaryReading(markdown) {
  const match = /^### (Dialogue|Narrative)\s*$\n([\s\S]*?)(?=^### New Vocabulary\s*$)/mu.exec(markdown);
  assert.ok(match);
  return match[2].trim().split(/\r?\n/u).map((line) => match[1] === "Dialogue" ? line.replace(/^[^:]+:\s*/u, "").trim() : line.trim()).filter(Boolean);
}

function parseMarkdownTable(text, header) {
  const lines = text.split(/\r?\n/u);
  const start = lines.indexOf(header);
  assert.notEqual(start, -1, header);
  const rows = [];
  for (const line of lines.slice(start + 2)) {
    if (!line.startsWith("|")) break;
    rows.push(line.slice(1, -1).split("|").map((cell) => cell.trim()));
  }
  return rows;
}

function parseDeck(text) {
  return text.trimEnd().split("\n").slice(1).map((line) => {
    const fields = line.split("\t");
    assert.equal(fields.length, 18);
    return {
      id: fields[0],
      chapter: Number(fields[3]),
      promptLanguage: fields[4],
      answerLanguage: fields[5],
      senseId: JSON.parse(fields[10]).at(-1),
      locator: fields[14],
      evidence: fields[15],
      examples: JSON.parse(fields[16])
    };
  });
}
