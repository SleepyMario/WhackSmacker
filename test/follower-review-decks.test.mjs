import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { contentPackageGeneratorTargets, generateContentPackage, validateContentPackageManifest } from "../dist/packages/core/index.js";

const root = join(process.cwd(), "..");
const header = "card_id\tdeck\tkind\tsource_chapter\tprompt_language\tanswer_language\tprompt\taccepted_answers\tdistractors\texplanation\tlexical_ids\tgrammar_ids\tgeographic_ids\tprovenance_path\tprovenance_locator\tprovenance_evidence\texamples\ttags";
const licenseSha256 = "c2db9f2b69f04481c3647953636e96f0752c17705b1250edcc2d3c20b9e060c5";
const noticeSha256 = "6cc450547e608fb817b725bdfa5af11c7394f37dee1ace0bad7da42a1f355c34";
const reconstructed = JSON.parse(await readFile(join(process.cwd(), "test", "fixtures", "follower-reconstructed-inventories.json"), "utf8"));
const configs = [
  ["arabic", "Arabic", "ar", "ARA", 42, 84],
  ["french", "French", "fr", "FRA", 60, 120],
  ["german", "German", "de", "GER", 55, 110],
  ["hindi", "Hindi", "hi", "HIN", 51, 102],
  ["japanese", "Japanese", "ja", "JPN", 44, 132],
  ["korean", "Korean", "ko", "KOR", 47, 94],
  ["russian", "Russian", "ru", "RUS", 52, 104],
  ["spanish", "Spanish", "es", "SPA", 56, 112],
  ["thai", "Thai", "th", "THA", 61, 122],
  ["zulu", "Zulu", "zu", "ZUL", 43, 86]
].map(([slug, name, code, prefix, senses, cards]) => ({ slug, name, code, prefix, senses, cards, core: `${slug}-core` }));

for (const config of configs) {
  test(`${config.name} Chapters 1–5, ledgers, grammar summaries, topics, and Review agree`, async () => {
    const repo = join(root, `${config.slug}-curriculum`);
    const unitRoot = join(repo, "units", config.core);
    const files = await readdir(unitRoot, { withFileTypes: true });
    const chapterDirs = files.filter(entry => entry.isDirectory() && /^chapter-00[1-5]-/u.test(entry.name) && !/grammar/u.test(entry.name)).map(entry => entry.name).sort();
    assert.equal(chapterDirs.length, 5);
    assert.equal(files.some(entry => /^chapter-006-/u.test(entry.name)), false);

    let learnerSentences = 0;
    for (const [index, directory] of chapterDirs.entries()) {
      const chapter = index + 1;
      const markdown = await readFile(join(unitRoot, directory, "chapter.md"), "utf8");
      const ledger = await readFile(join(unitRoot, directory, "ledger.md"), "utf8");
      const translation = JSON.parse(await readFile(join(unitRoot, directory, "reading-translation.en.json"), "utf8"));
      assert.match(markdown, new RegExp(`^chapter: ${chapter}$`, "mu"));
      assert.match(markdown, chapter % 2 === 1 ? /^### Dialogue$/mu : /^### Narrative$/mu);
      assert.doesNotMatch(markdown, chapter % 2 === 1 ? /^### Narrative$/mu : /^### Dialogue$/mu);
      assert.match(markdown, new RegExp(`${config.prefix}-GRAMMAR-${String(chapter).padStart(3, "0")}`, "u"));
      assert.match(markdown, /^### Grammar$/mu);
      assert.doesNotMatch(markdown, /\*\*[^*]+\*\*/u, "grammar roles use established semantic/code markup, not raw bold");
      assert.match(ledger, /New canonical lexical senses: [1-9]\d*$/mu);
      assert.equal(translation.readingType, chapter % 2 === 1 ? "dialogue" : "narrative");
      const aligned = translation.readingType === "dialogue" ? translation.turns : translation.sentences;
      assert.equal(aligned.length, 6);
      learnerSentences += aligned.length;
      assert.equal(JSON.stringify(translation), JSON.stringify(translation).normalize("NFC"));
      assert.doesNotMatch(markdown, /TODO|FIXME|placeholder|dummy/iu);
    }
    assert.equal(learnerSentences, 30);

    const cumulative = await readFile(join(unitRoot, "cumulative-ledger.md"), "utf8");
    const lexicalRows = parseLedger(cumulative, "## Vocabulary Inventory");
    const grammarRows = parseLedger(cumulative, "## Grammar Inventory");
    assert.equal(lexicalRows.length, config.senses);
    assert.equal(new Set(lexicalRows.map(row => row[0])).size, config.senses);
    assert.equal(new Set(lexicalRows.map(row => row[1])).size, config.senses);
    assert.equal(grammarRows.length, 5);
    assert.deepEqual(grammarRows.map(row => row[0]), Array.from({ length: 5 }, (_, index) => `${config.prefix}-GRAMMAR-${String(index + 1).padStart(3, "0")}`));

    const easy = await readFile(join(unitRoot, "chapter-001-005-grammar-easy", "chapter.md"), "utf8");
    const hard = await readFile(join(unitRoot, "chapter-001-005-grammar-hard", "chapter.md"), "utf8");
    const easyIds = [...easy.matchAll(new RegExp(`${config.prefix}-GRAMMAR-\\d{3}`, "gu"))].map(match => match[0]);
    const hardIds = [...hard.matchAll(new RegExp(`${config.prefix}-GRAMMAR-\\d{3}`, "gu"))].map(match => match[0]);
    assert.deepEqual(easyIds, hardIds);
    assert.deepEqual([...new Set(easyIds)], grammarRows.map(row => row[0]));
    assert.match(easy, /## Plain Summary/u);
    assert.match(hard, /## Structural Summary/u);
    assert.match(hard, /`[^`]*(?:subject|copula|particle|classifier|case|agreement|verb|noun|clause|pronoun|adverb|infinitive)[^`]*`/iu);

    const topics = JSON.parse(await readFile(join(repo, "lexical-topics.json"), "utf8"));
    const topicSenseIds = topics.topics.flatMap(topic => topic.senses.map(sense => sense.sense_id));
    assert.equal(topics.max_ordinary_chapter, 5);
    assert.deepEqual(new Set(topicSenseIds), new Set(lexicalRows.map(row => row[1])));
    const audit = JSON.parse(await readFile(join(repo, "lexical-topic-audit.json"), "utf8"));
    assert.equal(audit.canonical_senses, config.senses);
    assert.equal(audit.assigned_unique_senses, config.senses);
    assert.deepEqual(audit.unassigned_senses, []);

    const deck = parseDeck(await readFile(join(process.cwd(), "review-content", config.slug, "review-decks", "chapter-001-005", "cards.tsv"), "utf8"));
    assert.equal(deck.length, config.cards);
    assert.equal(new Set(deck.map(row => row.cardId)).size, config.cards);
    const senses = new Map();
    for (const row of deck) {
      assert.equal(row.kind, "vocabulary");
      assert.equal(row.grammarIds.length, 0);
      assert.equal(row.distractors.length, 0);
      assert.equal(row.lexicalIds.length, 2);
      assert.equal(row.examples.length >= 1 && row.examples.length <= 3, true);
      assert.equal(row.provenanceEvidence, row.examples[0]);
      const source = await readFile(join(repo, row.provenancePath), "utf8");
      const reading = primaryReading(source);
      assert.equal(reading[row.line - 1], row.provenanceEvidence, `${row.cardId} locator/evidence mismatch`);
      for (const example of row.examples) assert.equal(reading.includes(example), true, `${row.cardId} example is not literal`);
      const directions = senses.get(row.lexicalIds[1]) ?? new Set();
      directions.add(`${row.promptLanguage}-to-${row.answerLanguage}`);
      senses.set(row.lexicalIds[1], directions);
      for (const value of [row.cardId, row.prompt, ...row.acceptedAnswers, ...row.examples]) assert.equal(value, value.normalize("NFC"));
    }
    assert.deepEqual(new Set(senses.keys()), new Set(lexicalRows.map(row => row[1])));
    const expectedDirections = config.code === "ja" ? ["en-to-ja", "ja-Kana-to-ja", "ja-to-en"] : [`${config.code}-to-en`, `en-to-${config.code}`].sort();
    for (const directions of senses.values()) assert.deepEqual([...directions].sort(), [...expectedDirections].sort());

    assert.equal(await sha256(join(repo, "LICENSE-CONTENT")), licenseSha256);
    assert.equal(await sha256(join(repo, "NOTICE")), noticeSha256);
  });
}

test("independently reconstructed chapter inventories match both ledgers and Review", async () => {
  for (const config of configs) {
    const expected = Object.entries(reconstructed.languages[config.slug].chapters).flatMap(([chapter, record]) =>
      record.senses.map((sense) => ({ ...sense, chapter: Number(chapter), directory: record.directory }))
    );
    const repo = join(root, `${config.slug}-curriculum`);
    for (const sense of expected) {
      const source = await readFile(join(repo, "units", config.core, sense.directory, "chapter.md"), "utf8");
      assert.equal(primaryReading(source)[sense.line - 1], sense.evidence, `${sense.senseId}: reconstructed first occurrence changed`);
    }
    const ledgerRows = parseLedger(await readFile(join(repo, "units", config.core, "cumulative-ledger.md"), "utf8"), "## Vocabulary Inventory");
    const deckRows = parseDeck(await readFile(join(process.cwd(), "review-content", config.slug, "review-decks", "chapter-001-005", "cards.tsv"), "utf8"));
    reconcileReconstructedInventory(expected, ledgerRows.map((row) => row[1]), deckRows.map((row) => row.lexicalIds[1]));
    for (const row of ledgerRows) {
      const expectedSense = expected.find((sense) => sense.senseId === row[1]);
      assert.ok(expectedSense, row[1]);
      assert.equal(Number(row[5]), expectedSense.chapter, `${row[1]} first chapter`);
      assert.equal(Number(row[8]), expectedSense.line, `${row[1]} first line`);
      assert.equal(row[2], expectedSense.form, `${row[1]} form`);
      assert.equal(row[3], expectedSense.meaning, `${row[1]} meaning`);
    }
  }
});

test("ledger and Review agreement cannot conceal an omitted taught sense", () => {
  const expected = Object.values(reconstructed.languages.french.chapters).flatMap((chapter) => chapter.senses);
  const incompleteLedger = expected.slice(1).map((sense) => sense.senseId);
  const incompleteReview = expected.slice(1).flatMap((sense) => [sense.senseId, sense.senseId]);
  assert.throws(
    () => reconcileReconstructedInventory(expected, incompleteLedger, incompleteReview),
    /reconstructed chapter inventory mismatch/u
  );
});

test("repaired French, German, Russian, Spanish, Thai, and Zulu grammar examples enforce the taught rules", async () => {
  const summaries = async (slug) => {
    const rootPath = join(root, `${slug}-curriculum`, "units", `${slug}-core`);
    return {
      easy: await readFile(join(rootPath, "chapter-001-005-grammar-easy", "chapter.md"), "utf8"),
      hard: await readFile(join(rootPath, "chapter-001-005-grammar-hard", "chapter.md"), "utf8")
    };
  };
  const french = await summaries("french");
  assert.match(french.easy, /Example: `On va acheter des tomates\.`/u);
  assert.match(french.hard, /Profession predicates.*omit the article/su);
  assert.doesNotMatch(french.hard, /Example: `On va au marché demain \?`/u);
  const german = await summaries("german");
  assert.match(german.easy, /Example: `Wo ist das Handy\?`/u);
  assert.match(german.hard, /polar question.*verb-first order/su);
  assert.doesNotMatch(german.easy, /Heute \+ Verb \+ subject/u);
  const russian = await summaries("russian");
  assert.match(russian.easy, /Example: `Где телефон\?`/u);
  assert.match(russian.easy, /Example: `Иван ест хлеб\.`/u);
  assert.doesNotMatch(russian.easy, /Example: `На столе вода\.`/u);
  const spanish = await summaries("spanish");
  assert.match(spanish.easy, /Example: `Vamos a comprar fruta\.`/u);
  assert.match(spanish.hard, /el agua.*remains feminine/su);
  const thai = await summaries("thai");
  assert.match(thai.easy, /subject \+ verb \+ object/u);
  assert.match(thai.hard, /`แก้ว` for glasses of a drink/u);
  assert.doesNotMatch(thai.easy, /subject \+ object \+ verb/u);
  const zulu = await summaries("zulu");
  for (const text of [zulu.easy, zulu.hard]) {
    assert.match(text, /Example: `Likuphi ipeni\?`/u);
    assert.match(text, /Example: `UThandi uphatha isikhwama\.`/u);
    assert.match(text, /Example: `Asihambe manje\.`/u);
    assert.doesNotMatch(text, /Example: `Yini le\?`/u);
  }
});

test("target scripts and language-specific conventions are preserved", async () => {
  const sample = async (slug, core, chapter) => primaryReading(await readFile(join(root, `${slug}-curriculum`, "units", core, chapter, "chapter.md"), "utf8").catch(async () => {
    const dirs = await readdir(join(root, `${slug}-curriculum`, "units", core));
    const dir = dirs.find(value => value.startsWith(chapter) && !value.includes("grammar"));
    return readFile(join(root, `${slug}-curriculum`, "units", core, dir, "chapter.md"), "utf8");
  }));
  const scripts = [
    ["arabic", /\p{Script=Arabic}/u], ["hindi", /\p{Script=Devanagari}/u], ["japanese", /[\p{Script=Hiragana}\p{Script=Han}]/u],
    ["korean", /\p{Script=Hangul}/u], ["russian", /\p{Script=Cyrillic}/u], ["thai", /\p{Script=Thai}/u]
  ];
  for (const [slug, pattern] of scripts) {
    const config = configs.find(value => value.slug === slug);
    const lines = await sample(slug, config.core, "chapter-001-");
    assert.equal(lines.every(line => pattern.test(line)), true, slug);
  }
  const spanish = await readFile(join(root, "spanish-curriculum", "units", "spanish-core", "README.md"), "utf8");
  assert.match(spanish, /`tú`.*`ustedes`/su);
  assert.doesNotMatch(spanish, /`vosotros`.*(?:use|uses)/iu);
  const korean = (await sample("korean", "korean-core", "chapter-001-")).join("\n");
  assert.match(korean, /요/u);
  const arabic = (await sample("arabic", "arabic-core", "chapter-001-")).join("\n");
  assert.match(arabic, /[ًٌٍَُِّْ]/u);
});

test("Japanese and Thai core sidecars provide exact noninvented reading support", async () => {
  let japaneseItems = 0;
  let thaiItems = 0;
  const japaneseSenseIds = new Set();
  for (let chapter = 1; chapter <= 5; chapter += 1) {
    const padded = String(chapter).padStart(3, "0");
    const japanese = JSON.parse(await readFile(join(process.cwd(), "curriculum-support", "japanese", `chapter-${padded}`, "reading-support.json"), "utf8"));
    const thai = JSON.parse(await readFile(join(process.cwd(), "curriculum-support", "thai", `chapter-${padded}`, "reading-support.json"), "utf8"));
    japaneseItems += japanese.readingItems.length;
    thaiItems += thai.readingItems.length;
    for (const item of japanese.readingItems) {
      assert.match(item.reading, /^[\p{Script=Hiragana}\p{Script=Katakana}ー]+$/u);
      assert.equal(item.evidence.includes(item.surface), true);
      japaneseSenseIds.add(item.senseId);
    }
    for (const item of thai.readingItems) {
      assert.doesNotMatch(item.wordBoundaryGuide, /[A-Za-z0-9]/u);
      assert.equal(item.wordBoundaryGuide.replaceAll(" ", ""), item.sourceText.replaceAll(" ", ""));
    }
  }
  assert.equal(japaneseItems, 44);
  assert.deepEqual(japaneseSenseIds, new Set(Object.values(reconstructed.languages.japanese.chapters).flatMap((chapter) => chapter.senses.map((sense) => sense.senseId))));
  assert.equal(thaiItems, 30);
});

test("follower metadata recognizes all ten decks and only the integrated Korean curriculum target", async () => {
  const targets = new Map(contentPackageGeneratorTargets.map(target => [target.id, target]));
  for (const config of configs) {
    const integratedReadingPackage = config.slug === "korean";
    assert.equal(targets.has(`${config.slug}-curriculum`), integratedReadingPackage, `${config.name} curriculum integration scope changed`);
    const target = targets.get(`${config.slug}-core-reviews`);
    assert.ok(target);
    assert.equal(target.packageId, `com.sleepymario.language.${config.slug}.reviews`);
    assert.equal(target.contentType, "core-review");
    assert.deepEqual(target.capabilities, ["core-review"]);
    assert.deepEqual(target.relatedPackageIds, integratedReadingPackage ? ["com.sleepymario.language.korean"] : undefined);
  }
  const directory = await mkdtemp(join(tmpdir(), "wsm-follower-reviews-"));
  try {
    for (const config of configs) {
      const result = await generateContentPackage({ targetId: `${config.slug}-core-reviews`, outputDirectory: directory, generatedAt: "2026-07-20T00:00:00Z" });
      assert.deepEqual(validateContentPackageManifest(result.manifest).errors, []);
      assert.equal(result.manifest.packageId, `com.sleepymario.language.${config.slug}.reviews`);
      assert.deepEqual(result.manifest.relatedPackageIds, config.slug === "korean" ? ["com.sleepymario.language.korean"] : undefined);
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

function parseLedger(text, heading) {
  const lines = text.split(/\r?\n/u);
  const start = lines.indexOf(heading);
  assert.notEqual(start, -1);
  const rows = [];
  for (const line of lines.slice(start + 1)) {
    if (/^##\s/u.test(line)) break;
    if (!line.startsWith("|") || /^\|---/u.test(line) || /\| (?:ID|Entry ID) \|/u.test(line)) continue;
    rows.push(line.slice(1, -1).split("|").map(cell => cell.trim()));
  }
  return rows;
}

function parseDeck(text) {
  const lines = text.trimEnd().split("\n");
  assert.equal(lines[0], header);
  return lines.slice(1).map(line => {
    const fields = line.split("\t");
    assert.equal(fields.length, 18);
    const locator = /^(?:Dialogue|Narrative) > line (\d+)$/u.exec(fields[14]);
    assert.ok(locator);
    return { cardId: fields[0], kind: fields[2], promptLanguage: fields[4], answerLanguage: fields[5], prompt: fields[6], acceptedAnswers: JSON.parse(fields[7]), distractors: JSON.parse(fields[8]), lexicalIds: JSON.parse(fields[10]), grammarIds: JSON.parse(fields[11]), provenancePath: fields[13], line: Number(locator[1]), provenanceEvidence: fields[15], examples: JSON.parse(fields[16]) };
  });
}

function primaryReading(markdown) {
  const match = /^### (Dialogue|Narrative)$\n\n[^\n]+\n\n([\s\S]*?)(?=^###\s)/mu.exec(markdown);
  assert.ok(match);
  return match[2].trim().split(/\r?\n/u).map(line => match[1] === "Dialogue" ? line.replace(/^.*?:\s*/u, "").trim() : line.trim()).filter(Boolean);
}

async function sha256(path) {
  return createHash("sha256").update(await readFile(path)).digest("hex");
}

function reconcileReconstructedInventory(expected, ledgerSenseIds, reviewSenseIds) {
  const expectedIds = new Set(expected.map((sense) => sense.senseId));
  const ledgerIds = new Set(ledgerSenseIds);
  const reviewIds = new Set(reviewSenseIds);
  const equal = (left, right) => left.size === right.size && [...left].every((value) => right.has(value));
  if (!equal(expectedIds, ledgerIds) || !equal(expectedIds, reviewIds)) {
    throw new Error("reconstructed chapter inventory mismatch: ledger and Review may agree with each other while both omit a taught sense");
  }
}
