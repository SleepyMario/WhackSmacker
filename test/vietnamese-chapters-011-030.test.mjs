import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";

const root = join(process.cwd(), "..", "vietnamese-curriculum", "units", "vietnamese-core");

async function chapterSources() {
  const entries = await readdir(root, { withFileTypes: true });
  return Promise.all(entries
    .filter((entry) => entry.isDirectory() && /^chapter-(?:01[1-9]|02\d|030)-basic-sentences-/u.test(entry.name))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(async (entry) => ({ directory: entry.name, markdown: await readFile(join(root, entry.name, "chapter.md"), "utf8") })));
}

function chapterNumber(directory) { return Number(/^chapter-(\d{3})-/u.exec(directory)?.[1]); }
function primaryUnits(markdown, type, chapter) {
  const section = new RegExp(`^### ${type}\\s*$([\\s\\S]*?)(?=^### New Vocabulary\\s*$)`, "mu").exec(markdown)?.[1] ?? "";
  const body = section.trim().split(/\n\s*\n/u).slice(1).join("\n");
  if (type === "Dialogue") return body.split(/\r?\n/u).filter((line) => /:\s+/u.test(line));
  if (chapter <= 20) return body.split(/\r?\n/u).map((line) => line.trim()).filter(Boolean);
  return [...new Intl.Segmenter("vi", { granularity: "sentence" }).segment(body.replace(/\n+/gu, " "))].map(({ segment }) => segment.trim()).filter(Boolean);
}

test("Vietnamese Core Chapters 11-30 form one cumulative alternating sequence and Chapter 30 is the exact boundary", async () => {
  const allEntries = await readdir(root, { withFileTypes: true });
  const sources = await chapterSources();
  assert.deepEqual(sources.map(({ directory }) => chapterNumber(directory)), Array.from({ length: 20 }, (_, i) => i + 11));
  assert.equal(allEntries.some((entry) => entry.isDirectory() && /^chapter-(?:03[1-9]|0[4-9]\d|[1-9]\d{2,})-basic-sentences-/u.test(entry.name)), false);
  assert.equal(allEntries.some((entry) => entry.isDirectory() && /^chapter-(?:031-035|036-040|041-045|046-050)-grammar-/u.test(entry.name)), false);
  for (const { directory, markdown } of sources) {
    const chapter = chapterNumber(directory);
    const type = chapter % 2 === 1 ? "Dialogue" : "Narrative";
    assert.match(markdown, new RegExp(`^### ${type}$`, "mu"));
    assert.doesNotMatch(markdown, /^#{1,6}\s+(?:Content|Learner-facing|Complete Rereading)\s*$/imu);
    const units = primaryUnits(markdown, type, chapter);
    const min = chapter <= 25 ? 6 : 10;
    assert.equal(units.length >= min && units.length <= 30, true, `Chapter ${chapter}: ${units.length} primary units`);
    const vocabulary = /^### New Vocabulary\s*$([\s\S]*?)(?=^<!-- whacksmacker:developer-only:start -->)/mu.exec(markdown)?.[1] ?? "";
    assert.match(vocabulary, /^\| Form \| Meaning \| Part of speech \| Note \|$/mu);
    const count = vocabulary.split(/\r?\n/u).filter((line) => line.startsWith("|") && !/^\|(?: Form |---)/u.test(line)).length;
    const lexicalMaximum = chapter === 18 ? 11 : (chapter <= 25 ? 10 : 20);
    assert.equal(count >= 6 && count <= lexicalMaximum, true, `Chapter ${chapter}: ${count} vocabulary rows`);
    const principals = (markdown.match(/^- Principal:\s*VIE-GRAMMAR-/gmu) ?? []).length;
    assert.equal(principals, chapter <= 25 ? 1 : (principals >= 1 && principals <= 2 ? principals : -1));
  }
});
