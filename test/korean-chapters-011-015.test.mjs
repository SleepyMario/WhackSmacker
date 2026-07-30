import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import {
  assertCanonicalSectionAndGrammarRules,
  auditActiveCast,
  generateContentPackage,
  generateLocalContentPackageCatalogue,
  installContentPackage
} from "../dist/packages/core/index.js";
import { buildLanguageTree, renderLanguageTreeRightPane, renderTwoPaneLanguageTree } from "../dist/apps/cli/interactive-menu.js";

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
const expectedAllParticipants = new Map([
  [1, ["CAST-001", "CAST-002"]],
  [2, []],
  [3, ["CAST-003", "CAST-004"]],
  [4, ["CAST-001", "CAST-002"]],
  [5, ["CAST-003", "CAST-004"]],
  [6, ["CAST-003"]],
  [7, ["CAST-005"]],
  [8, ["CAST-002"]],
  [9, ["CAST-004", "CAST-005"]],
  [10, ["CAST-001", "CAST-002"]],
  [11, ["CAST-003", "CAST-005"]],
  [12, ["CAST-001", "CAST-003"]],
  [13, ["CAST-003", "CAST-004"]],
  [14, ["CAST-002", "CAST-005"]],
  [15, ["CAST-001", "CAST-003", "CAST-004"]]
]);
const expectedParticipants = new Map([...expectedAllParticipants].filter(([chapter]) => chapter >= 11));
const expectedParticipantLabels = new Map([
  ["CAST-001", "김민지"],
  ["CAST-002", "이준호"],
  ["CAST-003", "박서연"],
  ["CAST-004", "최도윤"],
  ["CAST-005", "정수진"]
]);
const deckPath = join(process.cwd(), "review-content", "korean", "review-decks", "chapter-011-015", "cards.tsv");

test("Korean Chapters 11–15 reconstruct authored readings, ledgers, support, participants, and Review", async () => {
  const found = (await readdir(unitRoot, { withFileTypes: true }))
    .filter(entry => entry.isDirectory() && /^chapter-0(?:11|12|13|14|15)-/u.test(entry.name) && !entry.name.includes("grammar"))
    .map(entry => entry.name)
    .sort();
  assert.deepEqual(found, [...expectedDirectories.values()]);

  const reconstructed = [];
  const participantSets = [];
  const blockParticipants = new Set();
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
    assert.match(markdown, new RegExp(`^# Chapter ${chapter} -- `, "mu"));
    assert.ok(markdown.indexOf(`### ${heading}`) < markdown.indexOf("### New Vocabulary"));
    assert.ok(markdown.indexOf("### New Vocabulary") < markdown.indexOf("### Grammar"));
    assert.ok(markdown.indexOf("### Grammar") < markdown.indexOf("### Simple Exercises"));
    const exercises = sectionBody(markdown, "Simple Exercises").split(/\r?\n/u).filter(line => /^\d+\.\s+\S/u.test(line));
    assert.deepEqual(exercises.map(line => Number.parseInt(line, 10)), [1, 2, 3, 4]);
    assert.equal(reading.length, 8);
    assert.equal(ledger.length, 8);
    assert.equal(translation.readingType, chapter % 2 === 1 ? "dialogue" : "narrative");
    const translated = translation.readingType === "dialogue" ? translation.turns : translation.sentences;
    assert.equal(translated.length, 8);
    assert.equal(JSON.stringify(translation), JSON.stringify(translation).normalize("NFC"));
    if (translation.readingType === "dialogue") {
      assert.deepEqual(translation.turns.map(turn => turn.speaker), structuralDialogueLabels(markdown));
    }

    const expectedIds = expectedParticipants.get(chapter);
    assert.deepEqual(participants.canonicalCastIds, expectedIds);
    assert.deepEqual(new Set(participants.primaryReadingParticipants.map(person => person.participantId)), new Set(expectedIds));
    assert.deepEqual(new Set(participants.introductionParticipants.map(person => person.label)), new Set(expectedIds.map(id => expectedParticipantLabels.get(id))));
    assert.deepEqual(new Set(participants.supportParticipants.map(person => person.label)), new Set(expectedIds.map(id => expectedParticipantLabels.get(id))));
    participantSets.push([...expectedIds].sort().join("|"));
    for (const id of expectedIds) blockParticipants.add(id);

    const supportIntroduction = support.audienceSections.find(section => section.sourceHeading === "Brief Introduction");
    assert.ok(supportIntroduction);
    const sourceIntroduction = sectionBody(markdown, "Brief Introduction", 2);
    for (const label of [...participants.primaryReadingParticipants, ...participants.translationParticipants].map(person => person.label)) {
      assert.equal(sourceIntroduction.includes(label), false, `${chapter}: source Brief Introduction excludes ${label}`);
      assert.equal(supportIntroduction.normal.includes(label), false, `${chapter}: Normal Brief Introduction excludes ${label}`);
      assert.equal(supportIntroduction.expert.includes(label), false, `${chapter}: Expert Brief Introduction excludes ${label}`);
    }
    for (const value of [sourceIntroduction, supportIntroduction.normal, supportIntroduction.expert]) {
      assert.doesNotMatch(value, /[\p{Script=Han}\p{Script=Hangul}][\p{L}\p{M} .'-]*\([A-Z][A-Za-z .'-]+\)/u);
    }
    assert.doesNotThrow(() => assertCanonicalSectionAndGrammarRules({
      markdown,
      source: `units/korean-core/${directory}/chapter.md`,
      readingSupport: support,
      readingTranslation: translation,
      chapterParticipants: participants
    }));
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

  assert.deepEqual(blockParticipants, new Set(["CAST-001", "CAST-002", "CAST-003", "CAST-004", "CAST-005"]));
  assert.equal(new Set(participantSets).size > 1, true, "the five-chapter block varies meaningful cast participation");

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


test("Korean Chapters 1–15 preserve the shared cast, introduction, exercise, and trajectory invariants", async () => {
  const cast = JSON.parse(await readFile(join(repository, "name-pools", "canonical-cast.json"), "utf8"));
  const directories = (await readdir(unitRoot, { withFileTypes: true }))
    .filter(entry => entry.isDirectory() && /^chapter-\d{3}-/u.test(entry.name) && !entry.name.includes("grammar"))
    .map(entry => entry.name);
  const byChapter = new Map(directories.map(directory => [Number.parseInt(/^chapter-(\d{3})-/u.exec(directory)?.[1] ?? "0", 10), directory]));
  const auditChapters = [];
  const seen = new Set();
  const blockSignatures = new Map([[1, []], [6, []], [11, []]]);

  for (let chapter = 1; chapter <= 15; chapter += 1) {
    const directory = byChapter.get(chapter);
    assert.ok(directory, `Chapter ${chapter} directory`);
    const root = join(unitRoot, directory);
    const markdown = await readFile(join(root, "chapter.md"), "utf8");
    const translation = JSON.parse(await readFile(join(root, "reading-translation.en.json"), "utf8"));
    const participants = JSON.parse(await readFile(join(root, "chapter-participants.json"), "utf8"));
    const support = JSON.parse(await readFile(join(process.cwd(), "curriculum-support", "korean", `chapter-${String(chapter).padStart(3, "0")}`, "reading-support.json"), "utf8"));
    const expectedIds = expectedAllParticipants.get(chapter);
    assert.deepEqual(participants.canonicalCastIds, expectedIds, `Chapter ${chapter} canonical participants`);
    for (const id of expectedIds) seen.add(id);
    const blockStart = chapter <= 5 ? 1 : chapter <= 10 ? 6 : 11;
    blockSignatures.get(blockStart).push([...expectedIds].sort().join("|"));

    assert.match(markdown, new RegExp(`^# Chapter ${chapter} -- `, "mu"));
    const exercises = sectionBody(markdown, "Simple Exercises").split(/\r?\n/u).filter(line => /^\d+\.\s+\S/u.test(line));
    assert.deepEqual(exercises.map(line => Number.parseInt(line, 10)), [1, 2, 3, 4], `Chapter ${chapter} exercises`);
    const sourceIntroduction = sectionBody(markdown, "Brief Introduction", 2);
    const supportIntroduction = support.audienceSections.find(section => section.sourceHeading === "Brief Introduction");
    assert.ok(supportIntroduction, `Chapter ${chapter} support Brief Introduction`);
    for (const value of [sourceIntroduction, supportIntroduction.normal, supportIntroduction.expert]) {
      assert.doesNotMatch(value, /[\p{Script=Han}\p{Script=Hangul}][\p{L}\p{M} .'-]*\([A-Z][A-Za-z .'-]+\)/u);
    }
    assert.doesNotThrow(() => assertCanonicalSectionAndGrammarRules({
      markdown,
      source: `units/korean-core/${directory}/chapter.md`,
      readingSupport: support,
      readingTranslation: translation,
      chapterParticipants: participants
    }));
    auditChapters.push({
      chapter,
      authorship: "new",
      migrationStatus: "compliant",
      participatingPersonIds: participants.canonicalCastIds,
      meaningfulPersonIds: participants.canonicalCastIds
    });
  }

  assert.deepEqual(seen, new Set(["CAST-001", "CAST-002", "CAST-003", "CAST-004", "CAST-005"]));
  for (const [start, signatures] of blockSignatures) {
    assert.equal(new Set(signatures).size > 1, true, `Chapters ${start}-${start + 4} vary canonical participation`);
  }
  assert.doesNotThrow(() => auditActiveCast({
    canonicalPersonIds: cast.cast.map(person => person.id),
    progression: cast.activeCast.progression,
    chapters: auditChapters
  }));
});

test("installed Korean Chapters 10 and 11 share canonical menu formatting and yellow chapter-token coloring", async () => {
  const root = await mkdtemp(join(tmpdir(), "wsm-korean-menu-010-011-"));
  const packages = join(root, "packages");
  const catalogue = join(root, "catalogue.json");
  const dataDir = join(root, "data");
  try {
    await generateContentPackage({ targetId: "korean-curriculum", outputDirectory: packages, generatedAt: "2026-07-28T00:00:00Z" });
    await generateLocalContentPackageCatalogue({ packagesDirectory: packages, outputPath: catalogue, generatedAt: "2026-07-28T00:00:00Z" });
    await installContentPackage({ cataloguePath: catalogue, dataDir, packageId: "com.sleepymario.language.korean", installedAt: "2026-07-28T00:00:00Z" });
    const tree = await buildLanguageTree(dataDir, "normal");
    const korean = tree.children.find(node => node.label === "Korean");
    const read = korean?.children?.find(node => node.label === "Read content");
    assert.ok(read);
    const chapters = [10, 11].map(number => {
      const padded = String(number).padStart(3, "0");
      const node = read.children.find(candidate => candidate.filePath?.includes(`/chapter-${padded}-`) && !candidate.filePath.includes("grammar"));
      assert.ok(node, `installed Chapter ${number}`);
      return node;
    });
    for (const [index, node] of chapters.entries()) {
      const rendered = await renderLanguageTreeRightPane(node, { dataDir, displayMode: "normal" });
      assert.match(rendered, /^### Simple Exercises$/mu, `installed Chapter ${index + 10} exercises heading`);
      assert.deepEqual(sectionBody(rendered, "Simple Exercises").split(/\r?\n/u).filter(line => /^\d+\.\s+\S/u.test(line)).map(line => Number.parseInt(line, 10)), [1, 2, 3, 4]);
    }
    const mini = { id: "root", label: "Korean", kind: "root", children: chapters };
    const output = renderTwoPaneLanguageTree(mini, new Set(["root"]), 1, "Preview", true, 0, 20, "en-US", "navigation", 180);
    const plain = stripAnsi(output);
    assert.match(plain, /Ch 10 -- Photographs for the Library Display/u);
    assert.match(plain, /Ch 11 -- Choosing Library Materials/u);
    for (const number of [10, 11]) assert.match(output, new RegExp(`\x1b\\[33mCh ${number}\x1b\\[0m(?:\x1b\\[[0-9;]*m)* --`, "u"));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

function sectionBody(markdown, title, level = 3) {
  const lines = markdown.replace(/\r\n?/gu, "\n").split("\n");
  const start = lines.findIndex(line => line === `${"#".repeat(level)} ${title}`);
  assert.notEqual(start, -1, `${title} heading`);
  const end = lines.findIndex((line, index) => index > start && /^#{1,6}\s+/u.test(line));
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
    const lexicalIds = parseJsonTsvField(row.lexical_ids);
    return {
      id: row.card_id,
      chapter: Number(row.source_chapter),
      promptLanguage: row.prompt_language,
      answerLanguage: row.answer_language,
      distractors: parseJsonTsvField(row.distractors),
      grammarIds: parseJsonTsvField(row.grammar_ids),
      senseId: lexicalIds.at(-1),
      evidence: row.provenance_evidence,
      examples: parseJsonTsvField(row.examples)
    };
  });
}

function parseJsonTsvField(value) {
  return JSON.parse(value.startsWith('"') && value.endsWith('"')
    ? value.slice(1, -1).replaceAll('""', '"')
    : value);
}

function stripAnsi(value) { return value.replace(/\x1b\[[0-9;]*m/gu, ""); }
