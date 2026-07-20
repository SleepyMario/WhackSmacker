import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";

const appRoot = process.cwd();
const curriculumRoot = join(appRoot, "..", "vietnamese-curriculum");
const unitsRoot = join(curriculumRoot, "units", "vietnamese-core");
const supportRoot = join(appRoot, "curriculum-support", "vietnamese");
const prohibitedNormalPhrases = [
  "Vietnamese Usage Notes",
  "Vietnamese Orthography and Word Boundaries",
  "Vietnamese Word Boundaries and Register",
  "Vietnamese Orthography and Usage",
  "Register Note",
  "Register and Word Boundaries",
  "taught frame",
  "orthographic word boundaries",
  "discourse-level contrast",
  "pragmatic interpretation",
  "deictic reference",
  "interlocutor hierarchy",
  "morphosyntactic distribution"
];

test("Vietnamese Normal Language Notes inventory covers every applicable Chapter 1-50 source section", async () => {
  const audit = JSON.parse(await readFile(join(curriculumRoot, "normal-language-notes-audit.json"), "utf8"));
  const unitDirectories = await readdir(unitsRoot);
  const found = new Map();
  const chaptersWithNotes = [];
  let sourceSectionCount = 0;

  for (let chapter = 1; chapter <= 50; chapter += 1) {
    const padded = String(chapter).padStart(3, "0");
    const directory = unitDirectories.find((name) => name.startsWith(`chapter-${padded}-basic-sentences-`));
    assert.ok(directory, `Chapter ${chapter} exists`);
    const markdown = await readFile(join(unitsRoot, directory, "chapter.md"), "utf8");
    const support = JSON.parse(await readFile(join(supportRoot, `chapter-${padded}`, "reading-support.json"), "utf8"));
    const headings = explanatoryHeadings(markdown);
    if (headings.length > 0) chaptersWithNotes.push(chapter);
    sourceSectionCount += headings.length;

    const projectedRecords = support.audienceSections.filter((section) => headings.includes(section.sourceHeading));
    assert.equal(projectedRecords.length, headings.length, `Chapter ${chapter} support resolves every explanatory source heading`);
    for (const [index, heading] of headings.entries()) {
      const list = found.get(heading) ?? [];
      list.push(chapter);
      found.set(heading, list);
      const record = projectedRecords.find((section) => section.sourceHeading === heading);
      assert.equal(record.normalHeading, chapter === 1 && index === 1 ? null : "Language Notes");
      assert.equal(record.normal.trim().length > 0, true);
      assert.equal(record.expert.startsWith(sectionBody(markdown, heading)), true, `Chapter ${chapter} retains its technical source explanation`);
      for (const phrase of prohibitedNormalPhrases) assert.doesNotMatch(record.normal, new RegExp(escapeRegExp(phrase), "iu"));
    }
  }

  assert.equal(unitDirectories.some((name) => name.startsWith("chapter-051-")), false);
  assert.equal(sourceSectionCount, 49);
  assert.deepEqual(chaptersWithNotes, audit.chapters_affected);
  assert.deepEqual(audit.chapters_requiring_no_change, [7, 10]);
  assert.deepEqual(Object.fromEntries(audit.headings_found_before_normalization.map((entry) => [entry.heading, entry.chapters])), Object.fromEntries(found));
  assert.equal(audit.canonical_normal_heading, "Language Notes");
  assert.equal(audit.preservation.dialogue_or_narrative_changed, false);
  assert.equal(audit.preservation.sino_vietnamese_records_changed, false);
  assert.equal(audit.preservation.review_card_count_changed, false);
});

function explanatoryHeadings(markdown) {
  return markdown.split(/\r?\n/u).flatMap((line) => {
    const match = /^###\s+(.+?)\s*$/u.exec(line);
    if (match === null) return [];
    return /^(?:Vietnamese (?:Usage Notes|Orthography and Word Boundaries|Word Boundaries and Register|Orthography and Usage)|Register Note|Register and Word Boundaries)$/u.test(match[1]) ? [match[1]] : [];
  });
}

function sectionBody(markdown, title) {
  const lines = markdown.replace(/\r\n?/gu, "\n").split("\n");
  const start = lines.findIndex((line) => new RegExp(`^(#{1,6})\\s+${escapeRegExp(title)}\\s*$`, "u").test(line));
  assert.notEqual(start, -1);
  const level = /^(#{1,6})\s/u.exec(lines[start])?.[1].length ?? 1;
  const endOffset = lines.slice(start + 1).findIndex((line) => {
    const heading = /^(#{1,6})\s/u.exec(line);
    return heading !== null && heading[1].length <= level;
  });
  const end = endOffset < 0 ? lines.length : start + 1 + endOffset;
  return lines.slice(start + 1, end).join("\n").trim();
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}
