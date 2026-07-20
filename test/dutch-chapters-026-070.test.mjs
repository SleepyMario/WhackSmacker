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

test("Dutch Chapters 65-70 keep the advanced sequence diverse and context-driven", async () => {
  const sequence = (await sources()).filter(({ chapter }) => chapter >= 65 && chapter <= 70);
  const expectedTitles = new Map([
    [65, "Preparing a Health Information Day"],
    [66, "Restoring an Old Bicycle"],
    [67, "Joining the Neighborhood Garden"],
    [68, "A Café That Keeps Changing"],
    [69, "A Formal Information Request"],
    [70, "Sharing a Short Film"]
  ]);
  for (const { chapter, markdown } of sequence) {
    assert.match(markdown, new RegExp(`^# Chapter ${chapter} -- ${expectedTitles.get(chapter)}$`, "mu"));
  }

  const byChapter = new Map(sequence.map(({ chapter, markdown }) => [chapter, markdown]));
  assert.match(byChapter.get(66), /oude fiets[\s\S]+ketting[\s\S]+rem[\s\S]+rijdt Yasmin lachend naar huis/u);
  assert.match(byChapter.get(67), /volkstuin[\s\S]+kas[\s\S]+composthoop[\s\S]+planten we zaterdag samen jouw kruiden/u);
  assert.match(byChapter.get(70), /première[\s\S]+korte film[\s\S]+uploadt Pieter[\s\S]+tweede film/u);

  for (const chapter of [66, 67, 70]) {
    assert.doesNotMatch(byChapter.get(chapter), /\b(?:begroting|commissie|gemeentehuis|notulen|subsidie|vergadering|voorzitter)\b/iu);
  }
  assert.match(byChapter.get(69), /\bKunt u mij zeggen\b/u);
  assert.match(byChapter.get(70), /another person's question instead of directly asking the listener/u);
});
