import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";

const root = join(process.cwd(), "..", "vietnamese-curriculum", "units", "vietnamese-core");

async function chapterSources() {
  const entries = await readdir(root, { withFileTypes: true });
  return Promise.all(entries
    .filter((entry) => entry.isDirectory() && /^chapter-(?:0(?:1[1-9]|[2-4]\d)|050)-basic-sentences-/u.test(entry.name))
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

test("Vietnamese Core Chapters 11-50 form one cumulative alternating sequence", async () => {
  const sources = await chapterSources();
  assert.deepEqual(sources.map(({ directory }) => chapterNumber(directory)), Array.from({ length: 40 }, (_, i) => i + 11));
  for (const { directory, markdown } of sources) {
    const chapter = chapterNumber(directory);
    const type = chapter % 2 === 1 ? "Dialogue" : "Narrative";
    assert.match(markdown, new RegExp(`^### ${type}$`, "mu"));
    assert.doesNotMatch(markdown, /^#{1,6}\s+(?:Content|Learner-facing|Complete Rereading)\s*$/imu);
    const units = primaryUnits(markdown, type, chapter);
    const min = chapter <= 25 ? 6 : 10;
    assert.equal(units.length >= min && units.length <= 30, true, `Chapter ${chapter}: ${units.length} primary units`);
    const vocabulary = /^### New Vocabulary\s*$([\s\S]*?)(?=^<!-- whacksmacker:developer-only:start -->)/mu.exec(markdown)?.[1] ?? "";
    const count = (vocabulary.match(/^\|\s*[^|]+\s*\|\s*[^|]+\s*\|\s*[^|]+\s*\|$/gmu) ?? []).length - 2;
    assert.equal(count >= 6 && count <= (chapter <= 25 ? 10 : 20), true, `Chapter ${chapter}: ${count} vocabulary rows`);
    const principals = (markdown.match(/^- Principal:\s*VIE-GRAMMAR-/gmu) ?? []).length;
    assert.equal(principals, chapter <= 25 ? 1 : (chapter <= 30 ? (principals >= 1 && principals <= 2 ? principals : -1) : 2));
    if (chapter >= 31) assert.equal((markdown.match(/\| connector:/giu) ?? []).length, 1, `Chapter ${chapter} connector count`);
  }
});
