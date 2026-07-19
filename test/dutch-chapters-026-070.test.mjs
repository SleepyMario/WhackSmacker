import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";
import { assertLanguageCurriculumChapter3150Requirements, assertLanguageCurriculumChapter5170Requirements } from "../dist/packages/core/language-curriculum-policy.js";

const root = join(process.cwd(), "..", "dutch-curriculum", "units", "dutch-core");

async function sources() {
  const entries = await readdir(root, { withFileTypes: true });
  const chapters = [];
  for (const entry of entries) {
    const match = /^chapter-(\d{3})-(?!\d{3}-grammar)(.+)$/u.exec(entry.name);
    if (!entry.isDirectory() || match === null || entry.name.includes("grammar")) continue;
    const chapter = Number(match[1]);
    chapters.push({ chapter, markdown: await readFile(join(root, entry.name, "chapter.md"), "utf8") });
  }
  return chapters.sort((a,b) => a.chapter-b.chapter);
}

test("Dutch Chapters 26-70 form one complete alternating sequence with valid sidecars", async () => {
  const all = await sources();
  const stage = all.filter(({chapter}) => chapter >= 26 && chapter <= 70);
  assert.deepEqual(stage.map(({chapter}) => chapter), Array.from({length:45},(_,i)=>i+26));
  for (const {chapter,markdown} of stage) {
    assert.match(markdown, /^## Brief Introduction$/mu);
    assert.match(markdown, chapter % 2 ? /^### Dialogue$/mu : /^### Narrative$/mu);
    assert.doesNotMatch(markdown, /^#{1,6}\s+(?:Content|Complete Rereading)\s*$/imu);
    const directory = (await readdir(root)).find((name) => name.startsWith(`chapter-${String(chapter).padStart(3,"0")}-`) && !name.includes("grammar"));
    const translation = JSON.parse(await readFile(join(root,directory,"reading-translation.en.json"),"utf8"));
    assert.equal(translation.context, undefined);
    assert.equal(translation.introduction, undefined);
    assert.equal(translation.preface, undefined);
  }
  const r3150 = assertLanguageCurriculumChapter3150Requirements(all);
  assert.deepEqual(r3150.map((r) => r.chapter), Array.from({length:20},(_,i)=>i+31));
  const r5170 = assertLanguageCurriculumChapter5170Requirements(all);
  assert.deepEqual(r5170.map((r) => r.chapter), Array.from({length:20},(_,i)=>i+51));
});
