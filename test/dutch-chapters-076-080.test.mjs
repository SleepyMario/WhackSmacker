import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import {
  generateContentPackage,
  generateLocalContentPackageCatalogue,
  installContentPackage,
} from "../dist/packages/core/index.js";
import { buildLanguageTree, renderLanguageTreeRightPane } from "../dist/apps/cli/interactive-menu.js";

const appRoot = process.cwd();
const curriculumRoot = join(appRoot, "..", "dutch-curriculum");
const unitRoot = join(curriculumRoot, "units", "dutch-core");
const supportRoot = join(appRoot, "curriculum-support", "dutch");
const reviewPath = join(appRoot, "review-content", "dutch", "review-decks", "chapter-076-080", "cards.tsv");
const chapters = new Map([
  [76, ["chapter-076-a-new-home-for-noor", "narrative"]],
  [77, ["chapter-077-the-bag-for-the-party", "dialogue"]],
  [78, ["chapter-078-a-morning-in-the-garden", "narrative"]],
  [79, ["chapter-079-building-a-bookcase-together", "dialogue"]],
  [80, ["chapter-080-the-first-week-of-the-course", "narrative"]],
]);
const grammarIds = [
  "DUT-GRAMMAR-INV-A1-BASIC-PLACE-PREPOSITIONS",
  "DUT-GRAMMAR-INV-A1-DISTAL-DEMONSTRATIVES",
  "DUT-GRAMMAR-INV-A1-GENERAL-WH-QUESTIONS",
  "DUT-GRAMMAR-INV-A1-OBJECT-PRONOUN-PARADIGM-BASIC",
  "DUT-GRAMMAR-INV-A1-PRESENT-INDICATIVE-REGULAR",
  "DUT-GRAMMAR-INV-A1-SUBJECT-FINITE-AGREEMENT",
  "DUT-GRAMMAR-INV-A1-BASIC-IMPERATIVE",
  "DUT-GRAMMAR-INV-A1-SEPARABLE-VERBS-GENERAL",
  "DUT-GRAMMAR-INV-A1-BASIC-TIME-PREPOSITIONS",
  "DUT-GRAMMAR-INV-A2-ORDINAL-NUMERALS-BASIC",
];

function splitSentences(text) {
  return text.trim().split(/(?<=[.!?])(?:[”"])?\s+/u).filter(Boolean);
}

function readingSentences(markdown, mode) {
  const section = markdown.split(new RegExp(`^#{2,3} ${mode === "dialogue" ? "Dialogue" : "Narrative"}$`, "mu"))[1].split(/^#{2,3} /mu)[0].trim();
  if (mode === "dialogue") {
    return section.split("\n")
      .filter((line) => /^[^:]+:\s*/u.test(line))
      .flatMap((line) => splitSentences(line.replace(/^[^:]+:\s*/u, "")));
  }
  return section.split(/\n\s*\n/u).flatMap(splitSentences);
}

function translationSentences(value) {
  return (value.turns ?? value.paragraphs).flatMap((entry) => splitSentences(typeof entry === "string" ? entry : entry.text));
}

function breakdownSentences(value) {
  return [...value.matchAll(/^- (.+?) —/gmu)]
    .map((match) => match[1].replace(/\[\[(?:grammar|emphasis):([^\]]+)\]\]/gu, "$1"));
}

test("Dutch Chapters 76–80 use the approved modes and aligned 36-sentence support", async () => {
  const directories = await readdir(unitRoot);
  assert.equal(directories.some((directory) => /^chapter-081-/u.test(directory)), false);
  for (const [chapter, [directory, mode]] of chapters) {
    assert.equal(directories.includes(directory), true, `Chapter ${chapter} source directory`);
    const markdown = await readFile(join(unitRoot, directory, "chapter.md"), "utf8");
    const source = readingSentences(markdown, mode);
    const translation = JSON.parse(await readFile(join(unitRoot, directory, "reading-translation.en.json"), "utf8"));
    const support = JSON.parse(await readFile(join(supportRoot, `chapter-${String(chapter).padStart(3, "0")}`, "reading-support.json"), "utf8"));
    assert.match(markdown, new RegExp(`^#{2,3} ${mode === "dialogue" ? "Dialogue" : "Narrative"}$`, "mu"));
    if (mode === "narrative") {
      assert.doesNotMatch(markdown, /^## Brief Introduction$/mu);
      assert.equal(support.audienceSections.some((section) => section.sourceHeading === "Brief Introduction"), false);
    }
    assert.equal(source.length, 36, `Chapter ${chapter} source sentences`);
    assert.equal(translationSentences(translation).length, 36, `Chapter ${chapter} translation sentences`);
    assert.deepEqual(breakdownSentences(support.breakdown.normal), source, `Chapter ${chapter} Normal parity`);
    assert.deepEqual(breakdownSentences(support.breakdown.expert), source, `Chapter ${chapter} Expert parity`);
  }
});

test("Grammar Easy and Hard 76–80 expose the same ten canonical identities", async () => {
  const summaries = await Promise.all(["easy", "hard"].map((level) => readFile(join(unitRoot, `chapter-076-080-grammar-${level}`, "chapter.md"), "utf8")));
  const identities = summaries.map((markdown) => [...markdown.matchAll(/Grammar ID:\s*`([^`]+)`/gu)].map((match) => match[1]));
  assert.deepEqual(identities[0], grammarIds);
  assert.deepEqual(identities[1], grammarIds);
  const coverage = JSON.parse(await readFile(join(curriculumRoot, "grammar-coverage.json"), "utf8"));
  assert.equal(coverage.highestAuthoredChapter, 80);
  assert.deepEqual(coverage.chapterMappings.slice(-5).flatMap((row) => row.newGrammarIds), grammarIds);
  for (const id of grammarIds) {
    const row = coverage.structures.find((candidate) => candidate.grammarId === id);
    assert.equal(row.status, "introduced", id);
    assert.equal(row.easyReference.grammarId, id);
    assert.equal(row.hardReference.grammarId, id);
    assert.equal(row.normalReference.grammarId, id);
    assert.equal(row.expertReference.grammarId, id);
  }
});

test("Review 76–80 contains exactly 103 senses and 206 literal bidirectional cards", async () => {
  const lines = (await readFile(reviewPath, "utf8")).trimEnd().split(/\r?\n/u);
  const rows = lines.slice(1).map((line) => line.split("\t"));
  assert.equal(rows.length, 206);
  assert.equal(new Set(rows.map((row) => row[0])).size, 206);
  const bySense = new Map();
  for (const row of rows) {
    assert.equal(row.length, 18);
    assert.deepEqual(JSON.parse(row[11]), []);
    const [lexicalId, senseId] = JSON.parse(row[10]);
    assert.equal(senseId.startsWith(`${lexicalId}.`), true);
    const pair = bySense.get(senseId) ?? [];
    pair.push(`${row[4]}->${row[5]}`);
    bySense.set(senseId, pair);
    const source = await readFile(join(curriculumRoot, row[13]), "utf8");
    const mode = chapters.get(Number(row[3]))[1];
    const sourceLines = readingSentences(source, mode);
    const examples = JSON.parse(row[16]);
    assert.equal(examples.length >= 1 && examples.length <= 3, true);
    assert.equal(examples.every((example) => sourceLines.includes(example)), true, senseId);
    assert.equal(sourceLines.includes(row[15]), true, `${senseId} provenance evidence`);
  }
  assert.equal(bySense.size, 103);
  for (const directions of bySense.values()) assert.deepEqual(directions.sort(), ["en->nl", "nl->en"]);
});

test("generated and installed Dutch packages expose Chapters, Review, and Grammar 76–80 but no Chapter 81", async () => {
  const root = await mkdtemp(join(tmpdir(), "wsm-dutch-076-080-"));
  const packagesDirectory = join(root, "packages");
  const cataloguePath = join(root, "catalogue.json");
  const dataDir = join(root, "data");
  try {
    const reading = await generateContentPackage({ targetId: "dutch-curriculum", outputDirectory: packagesDirectory, generatedAt: "2026-07-23T00:00:00Z" });
    const review = await generateContentPackage({ targetId: "dutch-core-reviews", outputDirectory: packagesDirectory, generatedAt: "2026-07-23T00:00:00Z" });
    await generateLocalContentPackageCatalogue({ packagesDirectory, outputPath: cataloguePath, generatedAt: "2026-07-23T00:00:00Z" });
    await installContentPackage({ cataloguePath, dataDir, packageId: "com.sleepymario.language.dutch", installedAt: "2026-07-23T00:00:00Z" });
    await installContentPackage({ cataloguePath, dataDir, packageId: "com.sleepymario.language.dutch.reviews", installedAt: "2026-07-23T00:00:00Z" });

    const readingContent = JSON.parse(await readFile(join(dataDir, "packages", "com.sleepymario.language.dutch", reading.packageVersion, "content", "content.json"), "utf8"));
    const reviewContent = JSON.parse(await readFile(join(dataDir, "packages", "com.sleepymario.language.dutch.reviews", review.packageVersion, "content", "content.json"), "utf8"));
    for (const [, [directory]] of chapters) assert.equal(readingContent.files.some((file) => file.path === `units/dutch-core/${directory}/chapter.md`), true, directory);
    assert.equal(readingContent.files.some((file) => /^units\/dutch-core\/chapter-081-/u.test(file.path)), false);
    assert.equal(reviewContent.files.some((file) => file.path === "review-decks/chapter-076-080/cards.tsv"), true);

    const tree = await buildLanguageTree(dataDir);
    const dutch = tree.children.find((node) => node.label === "Dutch");
    const read = dutch?.children.find((node) => node.label === "Read content");
    assert.ok(read);
    for (const chapter of chapters.keys()) {
      const node = read.children.find((candidate) => candidate.label.startsWith(`Chapter ${chapter} --`));
      assert.ok(node, `Chapter ${chapter} menu node`);
      const rendered = await renderLanguageTreeRightPane(node, { dataDir, displayMode: "normal" });
      assert.match(rendered, new RegExp(`Chapter ${chapter}`), `Chapter ${chapter} opens`);
      if (chapters.get(chapter)[1] === "narrative") {
        assert.doesNotMatch(rendered, /Brief Introduction/u);
        assert.match(rendered, /^## Narrative\s*\n\n\S/mu, `Chapter ${chapter} begins its reading with narrative content`);
      }
    }
    assert.equal(read.children.some((node) => node.label.startsWith("Chapter 81 --")), false);
    assert.equal(read.children.some((node) => node.label === "Review -- Chapters 76–80"), true);
    const grammarEasy = read.children.find((node) => node.filePath === "units/dutch-core/chapter-076-080-grammar-easy/chapter.md");
    assert.ok(grammarEasy, "Grammar Easy 76–80 normal-mode menu node");
    assert.match(await renderLanguageTreeRightPane(grammarEasy, { dataDir, displayMode: "normal" }), /Grammar Easy -- Chapters 76–80/u);

    const expertTree = await buildLanguageTree(dataDir, "expert");
    const expertRead = expertTree.children.find((node) => node.label === "Dutch")?.children.find((node) => node.label === "Read content");
    const grammarHard = expertRead?.children.find((node) => node.filePath === "units/dutch-core/chapter-076-080-grammar-hard/chapter.md");
    assert.ok(grammarHard, "Grammar Hard 76–80 expert-mode menu node");
    assert.match(await renderLanguageTreeRightPane(grammarHard, { dataDir, displayMode: "expert" }), /Grammar Hard -- Chapters 76–80/u);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
