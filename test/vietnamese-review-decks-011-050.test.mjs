import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";
const appRoot = process.cwd();
const curriculumRoot = join(appRoot, "..", "vietnamese-curriculum");
const header = "card_id\tdeck\tkind\tsource_chapter\tprompt_language\tanswer_language\tprompt\taccepted_answers\tdistractors\texplanation\tlexical_ids\tgrammar_ids\tgeographic_ids\tprovenance_path\tprovenance_locator\tprovenance_evidence\texamples\ttags";
function parse(text) { const lines = text.trimEnd().split(/\r?\n/u); assert.equal(lines[0], header); return lines.slice(1).map((line) => { const fields=line.split("\t"); assert.equal(fields.length,18); return Object.fromEntries(header.split("\t").map((key,i)=>[key,fields[i]])); }); }
for (let start = 11; start <= 46; start += 5) {
  const end = start + 4;
  test(`Vietnamese review ${start}-${end} exactly pairs every newly introduced sense`, async () => {
    const path = join(appRoot, "review-content", "vietnamese", "review-decks", `chapter-${String(start).padStart(3,"0")}-${String(end).padStart(3,"0")}`, "cards.tsv");
    const rows = parse(await readFile(path,"utf8"));
    assert.equal(rows.length % 2, 0);
    assert.equal(new Set(rows.map((r)=>r.card_id)).size, rows.length);
    const senses = new Map();
    for (const row of rows) {
      assert.equal(Number(row.source_chapter) >= start && Number(row.source_chapter) <= end, true);
      assert.deepEqual(JSON.parse(row.distractors), []);
      assert.deepEqual(JSON.parse(row.grammar_ids), []);
      const examples=JSON.parse(row.examples); assert.equal(examples.length>=1 && examples.length<=3,true);
      const chapter=await readFile(join(curriculumRoot,row.provenance_path),"utf8");
      for (const example of examples) assert.equal(chapter.includes(example),true,`${row.card_id}: ${example}`);
      const ids=JSON.parse(row.lexical_ids); const sense=ids[1];
      if (!senses.has(sense)) senses.set(sense,[]); senses.get(sense).push(row);
    }
    for (const pair of senses.values()) assert.deepEqual(pair.map((r)=>`${r.prompt_language}->${r.answer_language}`).sort(),["en->vi","vi->en"]);
    assert.equal(rows.length, senses.size*2);
  });
}
