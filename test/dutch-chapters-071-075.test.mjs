import assert from "node:assert/strict";
import { access, mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import {
  assertLanguageCurriculumChapter71140Requirements,
  generateContentPackage,
  generateLocalContentPackageCatalogue,
  installContentPackage
} from "../dist/packages/core/index.js";
import {
  buildLanguageTree,
  renderLanguageTreeRightPane,
  renderTwoPaneLanguageTree
} from "../dist/apps/cli/interactive-menu.js";

const curriculumRoot = join(process.cwd(), "..", "dutch-curriculum");
const unitRoot = join(curriculumRoot, "units", "dutch-core");
const supportRoot = join(process.cwd(), "curriculum-support", "dutch");
const reviewRoot = join(process.cwd(), "review-content", "dutch", "review-decks");
const expected = new Map([
  [71, { directory: "chapter-071-planning-a-weekend-hike", title: "Planning a Weekend Hike", topic: "travel.hiking", cast: ["CAST-013", "CAST-001", "CAST-012"] }],
  [72, { directory: "chapter-072-a-shelter-dog-finds-a-foster-home", title: "A Shelter Dog Finds a Foster Home", topic: "animals.pets", cast: ["CAST-004", "CAST-002", "CAST-010"] }],
  [73, { directory: "chapter-073-cooking-a-birthday-dinner-together", title: "Cooking a Birthday Dinner Together", topic: "food.cooking", cast: ["CAST-002", "CAST-006", "CAST-005"] }],
  [74, { directory: "chapter-074-making-a-first-ceramic-bowl", title: "Making a First Ceramic Bowl", topic: "leisure.crafts", cast: ["CAST-008", "CAST-001", "CAST-011"] }],
  [75, { directory: "chapter-075-fixing-the-wifi-before-a-family-call", title: "Fixing the Wi-Fi Before a Family Call", topic: "technology.networking", cast: ["CAST-001", "CAST-012", "CAST-021", "CAST-002"] }]
]);
const expectedGrammarPatterns = [
  "tenzij + subordinate clause",
  "hoe + comparative, hoe + comparative",
  "zolang + subordinate clause",
  "blijken te + infinitive",
  "door + te-infinitive",
  "niet alleen X, maar ook Y",
  "zonder + te-infinitive",
  "alsof + subordinate clause",
  "mocht + subject + infinitive, dan + main clause",
  "ongeacht of + subordinate clause"
];
const patternsByChapter = new Map([
  [71, expectedGrammarPatterns.slice(0, 2)],
  [72, expectedGrammarPatterns.slice(2, 4)],
  [73, expectedGrammarPatterns.slice(4, 6)],
  [74, expectedGrammarPatterns.slice(6, 8)],
  [75, expectedGrammarPatterns.slice(8, 10)]
]);
const blue = (text) => `\x1b[34m${text}\x1b[0m`;

function sentences(text) {
  return text.trim().split(/(?<=[.!?])\s+/u).filter(Boolean);
}

function sourceSentences(markdown, chapter) {
  const heading = chapter % 2 === 1 ? "Dialogue" : "Narrative";
  const section = markdown.split(new RegExp(`^### ${heading}$`, "mu"))[1].split(/^### /mu)[0].trim();
  const content = section.split(/\n\s*\n/u).slice(1).join("\n");
  if (heading === "Dialogue") {
    return content.split("\n").flatMap((line) => sentences(line.replace(/^[^:]+:\s*/u, "")));
  }
  return content.split(/\n\s*\n/u).flatMap(sentences);
}

function translationSentences(translation) {
  return (translation.turns ?? translation.paragraphs).flatMap((entry) => sentences(typeof entry === "string" ? entry : entry.text));
}

function breakdownEvidence(text) {
  return [...text.matchAll(/^- (.+?) —/gmu)].map((match) => match[1]);
}

function grammarIdentities(markdown) {
  return [...markdown.matchAll(/^- Principal:\s*(DUT-GRAMMAR-\d{3}[A-Z])\s*\|/gmu)].map((match) => match[1]);
}

function vocabularyIdentities(markdown) {
  return [...markdown.matchAll(/`(nl\.[a-z-]+\.[a-z0-9-]+)`\s*\/\s*`(nl\.[a-z-]+\.[a-z0-9-]+\.[a-z0-9-]+)`/gmu)].map((match) => [match[1], match[2]]);
}

async function chapterSources() {
  return Promise.all([...expected].map(async ([chapter, info]) => ({
    chapter,
    markdown: await readFile(join(unitRoot, info.directory, "chapter.md"), "utf8")
  })));
}

test("Dutch Chapters 71-75 are consecutive, alternate format, and Chapter 76 is absent", async () => {
  const directories = await readdir(unitRoot);
  assert.deepEqual([...expected].map(([chapter, info]) => directories.includes(info.directory) ? chapter : 0), [71, 72, 73, 74, 75]);
  assert.equal(directories.some((directory) => /^chapter-076-/u.test(directory)), false);
  const sources = await chapterSources();
  for (const { chapter, markdown } of sources) {
    assert.match(markdown, new RegExp(`^# Chapter ${chapter} -- ${expected.get(chapter).title}$`, "mu"));
    assert.match(markdown, chapter % 2 === 1 ? /^### Dialogue$/mu : /^### Narrative$/mu);
  }
  const allEarlier = [];
  for (const directory of directories.filter((entry) => /^chapter-\d{3}-(?!\d{3}-grammar)/u.test(entry) && !entry.includes("grammar"))) {
    const chapter = Number(/^chapter-(\d{3})-/u.exec(directory)[1]);
    allEarlier.push({ chapter, markdown: await readFile(join(unitRoot, directory, "chapter.md"), "utf8") });
  }
  const results = assertLanguageCurriculumChapter71140Requirements(allEarlier);
  assert.deepEqual(results.map((result) => [result.chapter, result.newPrincipalGrammarPointCount]), [[71, 2], [72, 2], [73, 2], [74, 2], [75, 2]]);
});

test("each authored reading has a complete new-sense inventory and four aligned 32-sentence sequences", async () => {
  for (const [chapter, info] of expected) {
    const markdown = await readFile(join(unitRoot, info.directory, "chapter.md"), "utf8");
    const source = sourceSentences(markdown, chapter);
    const translation = JSON.parse(await readFile(join(unitRoot, info.directory, "reading-translation.en.json"), "utf8"));
    const support = JSON.parse(await readFile(join(supportRoot, `chapter-${String(chapter).padStart(3, "0")}`, "reading-support.json"), "utf8"));
    const normal = breakdownEvidence(support.breakdown.normal);
    const expert = breakdownEvidence(support.breakdown.expert);
    assert.equal(source.length, 32, `Chapter ${chapter} source sentences`);
    assert.equal(translationSentences(translation).length, 32, `Chapter ${chapter} translation sentences`);
    assert.equal(normal.length, 32, `Chapter ${chapter} Normal breakdown`);
    assert.equal(expert.length, 32, `Chapter ${chapter} Expert breakdown`);
    assert.deepEqual(normal, source, `Chapter ${chapter} Normal source order`);
    assert.deepEqual(expert, source, `Chapter ${chapter} Expert source order`);
    assert.equal(new Set(source).size, 32, `Chapter ${chapter} source contains no duplicate sentence`);
    const expectedSenseCount = chapter === 75 ? 17 : 16;
    assert.equal(vocabularyIdentities(markdown).length, expectedSenseCount, `Chapter ${chapter} lexical identity count`);
    assert.equal(new Set(vocabularyIdentities(markdown).map((identity) => identity[1])).size, expectedSenseCount);
    assert.equal(grammarIdentities(markdown).length, 2, `Chapter ${chapter} grammar identity count`);
    assert.equal(support.semanticSpanPolicyVersion, 1, `Chapter ${chapter} opts into narrow semantic spans`);
    const supportText = JSON.stringify(support);
    assert.doesNotMatch(supportText, /\[\[grammar:[^\]]*[.!?。！？]\]\]/u, `Chapter ${chapter} does not colour a complete sentence`);
    for (const match of supportText.matchAll(/\[\[grammar:([^\]]+)\]\]/gu)) {
      assert.ok(match[1].length <= 100 && match[1].trim().split(/\s+/u).length <= 12, `Chapter ${chapter} semantic span stays narrow`);
    }
  }
});

test("Grammar Easy and Hard preserve the identical authored ten-ID inventory and patterns", async () => {
  const summaries = await Promise.all(["easy", "hard"].map((level) => readFile(join(unitRoot, `chapter-071-075-grammar-${level}`, "chapter.md"), "utf8")));
  const ids = summaries.map((markdown) => [...markdown.matchAll(/^- (DUT-GRAMMAR-\d{3}[A-Z]) -- `(.+)`$/gmu)].map((match) => [match[1], match[2]]));
  assert.deepEqual(ids[0], ids[1]);
  assert.equal(ids[0].length, 10);
  assert.deepEqual(ids[0].map(([, pattern]) => pattern), expectedGrammarPatterns);
  assert.deepEqual(ids[0].map(([id]) => id), (await chapterSources()).flatMap(({ markdown }) => grammarIdentities(markdown)));
});

test("installed Chapters and Grammar 71-75 preserve semantic blue spans without coloring prose or navigation", async () => {
  const fixture = await installedDutch();
  try {
    const tree = await buildLanguageTree(fixture.dataDir, "developer");
    const dutch = tree.children.find((node) => node.label === "Dutch");
    const read = dutch?.children.find((node) => node.label === "Read content");
    assert.ok(read);

    const navigationTree = await buildLanguageTree(fixture.dataDir);
    const navigationRead = navigationTree.children
      .find((node) => node.label === "Dutch")
      ?.children.find((node) => node.label === "Read content");
    assert.ok(navigationRead);
    const chapter71Index = navigationRead.children.findIndex((node) => node.filePath === "units/dutch-core/chapter-071-planning-a-weekend-hike/chapter.md");
    const grammarIndex = navigationRead.children.findIndex((node) => node.filePath === "units/dutch-core/chapter-071-075-grammar-easy/chapter.md");
    assert.ok(chapter71Index >= 0 && grammarIndex > chapter71Index);
    const finalBlock = navigationRead.children.slice(chapter71Index, grammarIndex + 1);
    assert.deepEqual(finalBlock.map((node) => node.label), [
      "Chapter 71 -- Planning a Weekend Hike",
      "Chapter 72 -- A Shelter Dog Finds a Foster Home",
      "Chapter 73 -- Cooking a Birthday Dinner Together",
      "Chapter 74 -- Making a First Ceramic Bowl",
      "Chapter 75 -- Fixing the Wi-Fi Before a Family Call",
      "Review -- Chapters 71–75",
      "Grammar"
    ]);
    assert.equal(finalBlock.some((node) => /\[\[grammar:|`/u.test(node.label)), false, "semantic markup never enters navigation labels");

    for (const [chapterNumber, patterns] of patternsByChapter) {
      const padded = String(chapterNumber).padStart(3, "0");
      const chapter = read.children.find((node) =>
        node.filePath?.includes(`chapter-${padded}-`)
        && node.filePath.endsWith("/chapter.md")
        && !node.filePath.includes("grammar")
      );
      assert.ok(chapter, `Chapter ${chapterNumber} is installed`);
      for (const mode of ["normal", "expert", "developer"]) {
        const markdown = await renderLanguageTreeRightPane(chapter, { dataDir: fixture.dataDir, displayMode: mode });
        const ansi = renderTwoPaneLanguageTree(tree, new Set(), 0, markdown, true, 0, 600, "en-US", "navigation", 320, 0, mode);
        const noColor = renderTwoPaneLanguageTree(tree, new Set(), 0, markdown, false, 0, 600, "en-US", "navigation", 320, 0, mode);
        for (const pattern of patterns) assert.ok(ansi.includes(blue(pattern)), `Chapter ${chapterNumber} ${mode} renders ${pattern} blue`);
        assert.doesNotMatch(ansi, /\x1b\[34m(?:This chapter|Use |The main plan|when later evidence|to explain how|to add a second|when one action|when something|for a possible future|when the result)/u, `Chapter ${chapterNumber} ${mode} keeps explanatory prose neutral`);
        assert.equal(renderedOutputText(stripAnsi(ansi)), renderedOutputText(noColor), `Chapter ${chapterNumber} ${mode} NO_COLOR text exactly matches ANSI-stripped output`);
        assert.doesNotMatch(noColor, /\x1b\[|\[\[(?:grammar|emphasis):|`/u);
        assert.doesNotMatch(ansi, /\x1b\[34m(?:Brief Introduction|Grammar|Dutch Usage Notes)\x1b\[0m/u, "section headings do not inherit body grammar color");
      }
    }

    const chapter71 = read.children.find((node) => node.filePath?.includes("chapter-071-") && !node.filePath.includes("grammar"));
    const chapter72 = read.children.find((node) => node.filePath?.includes("chapter-072-") && !node.filePath.includes("grammar"));
    const chapter73 = read.children.find((node) => node.filePath?.includes("chapter-073-") && !node.filePath.includes("grammar"));
    const chapter74 = read.children.find((node) => node.filePath?.includes("chapter-074-") && !node.filePath.includes("grammar"));
    const chapter75 = read.children.find((node) => node.filePath?.includes("chapter-075-") && !node.filePath.includes("grammar"));
    const normal71 = renderPane(tree, await renderLanguageTreeRightPane(chapter71, { dataDir: fixture.dataDir, displayMode: "normal" }), "normal");
    const expert72 = renderPane(tree, await renderLanguageTreeRightPane(chapter72, { dataDir: fixture.dataDir, displayMode: "expert" }), "expert");
    const normal73 = renderPane(tree, await renderLanguageTreeRightPane(chapter73, { dataDir: fixture.dataDir, displayMode: "normal" }), "normal");
    const normal74 = renderPane(tree, await renderLanguageTreeRightPane(chapter74, { dataDir: fixture.dataDir, displayMode: "normal" }), "normal");
    const normal75 = renderPane(tree, await renderLanguageTreeRightPane(chapter75, { dataDir: fixture.dataDir, displayMode: "normal" }), "normal");
    assert.ok(normal71.includes(blue("tenzij")));
    assert.match(normal71, /\x1b\[34m[^\x1b]*subordinate clause[^\x1b]*\x1b\[0m/u);
    assert.match(normal71, /\x1b\[34m[^\x1b]*comparative[^\x1b]*\x1b\[0m/u);
    assert.ok(expert72.includes(blue("Blijken")));
    assert.ok(expert72.includes(blue("te-infinitive")));
    assert.ok(normal73.includes(blue("niet alleen X, maar ook Y")));
    assert.ok(normal74.includes(blue("alsof")));
    assert.ok(normal75.includes(blue("conditional clause")));
    assert.ok(normal75.includes(blue("ongeacht of")));

    const grammar = read.children.find((node) => /chapter-071-075-grammar-easy/u.test(node.filePath ?? ""));
    assert.ok(grammar);
    for (const mode of ["normal", "expert", "developer"]) {
      const markdown = await renderLanguageTreeRightPane(grammar, { dataDir: fixture.dataDir, displayMode: mode });
      const ansi = renderPane(tree, markdown, mode);
      for (const pattern of expectedGrammarPatterns) assert.ok(ansi.includes(blue(pattern)), `Grammar ${mode} renders ${pattern} blue`);
      assert.doesNotMatch(ansi, /\x1b\[34m(?:Use |The construction|Example|Literal example)/u, `Grammar ${mode} keeps prose neutral`);
      const noColor = renderTwoPaneLanguageTree(tree, new Set(), 0, markdown, false, 0, 600, "en-US", "navigation", 320, 0, mode);
      assert.equal(renderedOutputText(stripAnsi(ansi)), renderedOutputText(noColor), `Grammar ${mode} NO_COLOR text exactly matches ANSI-stripped output`);
    }

    const headingFixture = renderPane(tree, "### Language Notes\n\nThe [[grammar:subordinate clause]] keeps ordinary prose neutral.", "normal");
    assert.ok(headingFixture.includes(blue("subordinate clause")));
    assert.doesNotMatch(headingFixture, /\x1b\[34mLanguage Notes/u);
    assert.doesNotMatch(headingFixture, /\x1b\[34mkeeps ordinary prose neutral/u);
  } finally {
    await fixture.cleanup();
  }
});

test("Review 71-75 contains exactly two literal cards for all 81 new senses", async () => {
  const path = join(reviewRoot, "chapter-071-075", "cards.tsv");
  const lines = (await readFile(path, "utf8")).trimEnd().split("\n");
  const rows = lines.slice(1).map((line) => line.split("\t"));
  assert.equal(rows.length, 162);
  assert.equal(new Set(rows.map((row) => row[0])).size, 162);
  const bySense = new Map();
  for (const row of rows) {
    assert.equal(row.length, 18);
    const [lexicalId, senseId] = JSON.parse(row[10]);
    const pair = bySense.get(senseId) ?? [];
    pair.push(`${row[4]}->${row[5]}`);
    bySense.set(senseId, pair);
    assert.ok(senseId.startsWith(`${lexicalId}.`));
    assert.deepEqual(JSON.parse(row[11]), []);
    const examples = JSON.parse(row[16]);
    assert.ok(examples.length >= 1 && examples.length <= 3);
    const source = await readFile(join(curriculumRoot, row[13]), "utf8");
    assert.equal(examples.every((example) => sourceSentences(source, Number(row[3])).includes(example)), true);
    assert.equal(sourceSentences(source, Number(row[3])).includes(row[15]), true);
  }
  assert.equal(bySense.size, 81);
  for (const directions of bySense.values()) assert.deepEqual(directions.sort(), ["en->nl", "nl->en"]);
});

test("all sense and Review card IDs remain unique and proposed lexical IDs do not collide with Chapters 1-70", async () => {
  const baselineLexical = new Set();
  const proposedLexical = new Set();
  const senses = new Set();
  const cards = new Set();
  for (const directory of (await readdir(reviewRoot)).filter((entry) => /^chapter-\d{3}-\d{3}$/u.test(entry)).sort()) {
    const rows = (await readFile(join(reviewRoot, directory, "cards.tsv"), "utf8")).trimEnd().split("\n").slice(1).map((line) => line.split("\t"));
    for (const row of rows) {
      assert.equal(cards.has(row[0]), false, row[0]);
      cards.add(row[0]);
      if (row[4] !== "nl") continue;
      const [lexicalId, senseId] = JSON.parse(row[10]);
      assert.equal(senses.has(senseId), false, senseId);
      senses.add(senseId);
      if (Number(row[3]) <= 70) baselineLexical.add(lexicalId);
      else {
        assert.equal(baselineLexical.has(lexicalId), false, lexicalId);
        assert.equal(proposedLexical.has(lexicalId), false, lexicalId);
        proposedLexical.add(lexicalId);
      }
    }
  }
  assert.equal(senses.size, 686);
  assert.equal(proposedLexical.size, 81);
  assert.equal([...senses].filter((senseId) => /(?:wandelroute|pleeggezin|verjaardagsdiner|pottenbakkerij|wifi-lampje)/u.test(senseId)).length, 5);
});

test("topic diversity, cast continuity, and number continuity are recorded through Chapter 75", async () => {
  const topics = JSON.parse(await readFile(join(curriculumRoot, "lexical-topics.json"), "utf8"));
  const cast = JSON.parse(await readFile(join(curriculumRoot, "name-pools", "canonical-cast.json"), "utf8"));
  const numbers = JSON.parse(await readFile(join(curriculumRoot, "number-progression.json"), "utf8"));
  const reviewRows = (await readFile(join(reviewRoot, "chapter-071-075", "cards.tsv"), "utf8")).trimEnd().split("\n").slice(1).map((line) => line.split("\t"));
  assert.equal(topics.max_ordinary_chapter, 75);
  assert.equal(numbers.highestCompletedChapter, 75);
  assert.equal(numbers.magnitudeBlocks.at(-1).status, "in-progress");
  assert.deepEqual(numbers.reviewDecks.at(-1).cards.map((card) => card.mode).sort(), ["contextual", "digits-to-words", "words-to-digits"]);
  assert.deepEqual(numbers.reviewDecks.at(-1).cards.map((card) => card.testedValues), [[24, 40], [24, 40], [24, 40]]);
  assert.equal(reviewRows.some((row) => JSON.parse(row[10]).some((id) => id.startsWith("nl.numeral."))), false, "inherited number evidence is not relabelled as a new lexical sense");
  assert.equal(cast.activeCast.legacyMigration.status, "complete-through-chapter-75");
  const permitted = new Set(cast.activeCast.progression.slice(0, 14));
  for (const [chapter, info] of expected) {
    assert.equal(info.cast.every((id) => permitted.has(id)), true, `Chapter ${chapter} cast is active`);
    const topic = topics.topics.find((candidate) => candidate.topic_id === info.topic);
    assert.ok(topic, info.topic);
    assert.equal(topic.chapter_attestations.includes(chapter), true);
    const chapterSenseCount = [...topic.anchor_senses, ...topic.initial_expansion_senses, ...topic.later_expansion_senses].filter((sense) => sense.first_introduction_chapter === chapter).length;
    assert.equal(chapterSenseCount, chapter === 75 ? 17 : 16, `${info.topic} Chapter ${chapter} senses`);
  }
  assert.equal(new Set([...expected.values()].map((info) => info.topic)).size, 5);
  await assert.rejects(access(join(unitRoot, "chapter-076")));
});

async function installedDutch() {
  const root = await mkdtemp(join(tmpdir(), "wsm-dutch-071-075-semantic-"));
  const packageDirectory = join(root, "packages");
  const cataloguePath = join(root, "catalogue.json");
  const dataDir = join(root, "data");
  await generateContentPackage({ targetId: "dutch-curriculum", outputDirectory: packageDirectory, generatedAt: "2026-07-20T00:00:00Z" });
  await generateContentPackage({ targetId: "dutch-core-reviews", outputDirectory: packageDirectory, generatedAt: "2026-07-20T00:00:00Z" });
  await generateLocalContentPackageCatalogue({ packagesDirectory: packageDirectory, outputPath: cataloguePath, generatedAt: "2026-07-20T00:00:00Z" });
  await installContentPackage({ cataloguePath, dataDir, packageId: "com.sleepymario.language.dutch", installedAt: "2026-07-20T00:00:00Z" });
  await installContentPackage({ cataloguePath, dataDir, packageId: "com.sleepymario.language.dutch.reviews", installedAt: "2026-07-20T00:00:00Z" });
  return { dataDir, cleanup: () => rm(root, { recursive: true, force: true }) };
}

function renderPane(tree, markdown, mode) {
  return renderTwoPaneLanguageTree(tree, new Set(), 0, markdown, true, 0, 600, "en-US", "navigation", 320, 0, mode);
}

function stripAnsi(text) {
  return text.replace(/\x1b\[[0-9;]*m/gu, "");
}

function renderedOutputText(text) {
  const lines = text.split("\n");
  const border = /^\+(-+)\+(-+)\+(-+)\+$/u.exec(lines[0] ?? "");
  assert.ok(border, "rendered pane has measurable columns");
  const leftWidth = border[1].length;
  const outputWidth = border[2].length;
  return lines
    .filter((line) => line.startsWith("|"))
    .map((line) => line.slice(leftWidth + 2, leftWidth + 2 + outputWidth).trim())
    .join(" ")
    .replace(/\s+/gu, " ")
    .trim();
}
