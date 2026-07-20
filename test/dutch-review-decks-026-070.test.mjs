import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";
const header="card_id\tdeck\tkind\tsource_chapter\tprompt_language\tanswer_language\tprompt\taccepted_answers\tdistractors\texplanation\tlexical_ids\tgrammar_ids\tgeographic_ids\tprovenance_path\tprovenance_locator\tprovenance_evidence\texamples\ttags";
for(let start=26;start<=70;start+=5){
 test(`Dutch review ${start}-${start+4} is bidirectional and literal`,async()=>{
   const p=join("review-content","dutch","review-decks",`chapter-${String(start).padStart(3,"0")}-${String(start+4).padStart(3,"0")}`,"cards.tsv");
   const lines=(await readFile(p,"utf8")).trimEnd().split("\n"); assert.equal(lines[0],header); const rows=lines.slice(1).map(x=>x.split("\t"));
   assert.equal(rows.length%2,0); const ids=new Set();
   for(let i=0;i<rows.length;i+=2){
     const a=rows[i],b=rows[i+1]; assert.equal(a.length,18); assert.equal(b.length,18); assert.equal(a[4],"nl"); assert.equal(b[4],"en");
     assert.deepEqual(JSON.parse(a[10]),JSON.parse(b[10])); assert.deepEqual(JSON.parse(a[16]),JSON.parse(b[16])); assert.ok(JSON.parse(a[16]).length>=1);
     const aTags=JSON.parse(a[17]); const bTags=JSON.parse(b[17]);
     if(aTags.includes("number")){
       assert.match(b[6],/^\d+$/u); assert.equal(JSON.parse(a[7])[0],b[6]); assert.deepEqual(JSON.parse(b[7]),[a[6]]);
       assert.ok(aTags.includes("words-to-digits")); assert.ok(bTags.includes("digits-to-words"));
     }
     assert.equal(ids.has(a[0]),false); ids.add(a[0]); ids.add(b[0]);
   }
 });
}

test("restrictive alleen is introduced in Chapter 33 and excluded from later review blocks", async () => {
  const senseId = "nl.adverb.alleen.restrictive-only";
  const rowsFor = async (start, end) => {
    const path = join("review-content", "dutch", "review-decks", `chapter-${String(start).padStart(3,"0")}-${String(end).padStart(3,"0")}`, "cards.tsv");
    return (await readFile(path, "utf8")).trimEnd().split("\n").slice(1).map((line) => line.split("\t"));
  };
  const chapter3135 = (await rowsFor(31, 35)).filter((row) => JSON.parse(row[10]).includes(senseId));
  assert.equal(chapter3135.length, 2);
  assert.deepEqual(chapter3135.map((row) => `${row[4]}->${row[5]}`).sort(), ["en->nl", "nl->en"]);
  assert.deepEqual(chapter3135.map((row) => row[6]), ["alleen", "only"]);
  assert.deepEqual(JSON.parse(chapter3135[0][10]), ["nl.adverb.alleen", senseId]);
  assert.equal(chapter3135.every((row) => row[3] === "33" && row[15] === "Kiezen we ook fruit of alleen groente?"), true);

  for (const [start, end] of [[56, 60], [61, 65]]) {
    assert.equal((await rowsFor(start, end)).some((row) => JSON.parse(row[10]).includes(senseId)), false);
  }
});

test("meestal is introduced in Chapter 39 and excluded from every later review block", async () => {
  const senseId = "nl.adverb.meestal.usually";
  const rowsFor = async (start, end) => {
    const path = join("review-content", "dutch", "review-decks", `chapter-${String(start).padStart(3,"0")}-${String(end).padStart(3,"0")}`, "cards.tsv");
    return (await readFile(path, "utf8")).trimEnd().split("\n").slice(1).map((line) => line.split("\t"));
  };
  const chapter3640 = (await rowsFor(36, 40)).filter((row) => JSON.parse(row[10]).includes(senseId));
  assert.equal(chapter3640.length, 2);
  assert.deepEqual(chapter3640.map((row) => `${row[4]}->${row[5]}`).sort(), ["en->nl", "nl->en"]);
  assert.deepEqual(chapter3640.map((row) => row[6]), ["meestal", "usually"]);
  assert.deepEqual(JSON.parse(chapter3640[0][10]), ["nl.adverb.meestal", senseId]);
  assert.equal(chapter3640.every((row) => row[3] === "39" && row[15] === "Onze wedstrijd is meestal op zaterdag."), true);

  for (let start = 41; start <= 70; start += 5) {
    assert.equal((await rowsFor(start, start + 4)).some((row) => JSON.parse(row[10]).includes(senseId)), false);
  }
});

test("Dutch shared spellings keep interrogative, demonstrative, relative, and complementizer senses distinct", async () => {
  const rowsFor = async (start, end) => {
    const path = join("review-content", "dutch", "review-decks", `chapter-${String(start).padStart(3,"0")}-${String(end).padStart(3,"0")}`, "cards.tsv");
    return (await readFile(path, "utf8")).trimEnd().split("\n").slice(1).map((line) => line.split("\t"));
  };
  const allRows = [];
  for (let start = 1; start <= 70; start += 5) allRows.push(...await rowsFor(start, start + 4));
  const targetRows = allRows.filter((row) => row[4] === "nl");
  const identitiesFor = (form) => targetRows.filter((row) => row[6] === form).map((row) => JSON.parse(row[10])[1]).sort();

  assert.deepEqual(identitiesFor("waar"), ["nl.adverb.waar.location-question", "nl.pronoun.waar.relative-r-pronoun"]);
  assert.deepEqual(identitiesFor("of"), ["nl.conjunction.of.alternative", "nl.conjunction.of.embedded-polar-whether"]);
  assert.deepEqual(identitiesFor("dat"), ["nl.conjunction.dat.statement-complementizer", "nl.pronoun.dat.demonstrative", "nl.pronoun.dat.relative-het-word"]);
  assert.deepEqual(identitiesFor("die"), ["nl.pronoun.die.relative-de-word"]);

  const scopedSenseIds = [
    "nl.pronoun.die.relative-de-word",
    "nl.pronoun.dat.relative-het-word",
    "nl.pronoun.waar.relative-r-pronoun",
    "nl.conjunction.of.embedded-polar-whether",
    "nl.conjunction.dat.statement-complementizer"
  ];
  const scopedRows = allRows.filter((row) => scopedSenseIds.includes(JSON.parse(row[10])[1]));
  assert.equal(scopedRows.length, 10);
  assert.equal(scopedRows.every((row) => row[3] === "67" || row[3] === "69" || row[3] === "70"), true);
  assert.equal(scopedRows.every((row) => JSON.parse(row[11]).length === 0), true, "grammar-only frames stay out of lexical review identity");
  const grammarOnlyFrames = ["de-word + die + clause / het-word + dat + clause", "place noun + waar + preposition + clause", "Kunt u mij zeggen of + embedded polar clause?", "zeggen dat", "vragen of"];
  assert.equal(targetRows.some((row) => grammarOnlyFrames.includes(row[6])), false, "whole grammar frames receive no lexical cards");
  assert.equal(targetRows.some((row) => /(?:kunt-u-mij-zeggen|zeggen-dat|vragen-of|relative-clause-frame)/u.test(JSON.parse(row[10])[1])), false, "whole grammar frames receive no lexical sense IDs");
  for (const senseId of scopedSenseIds) {
    const pair = scopedRows.filter((row) => JSON.parse(row[10])[1] === senseId);
    assert.equal(pair.length, 2, senseId);
    assert.deepEqual(pair.map((row) => `${row[4]}->${row[5]}`).sort(), ["en->nl", "nl->en"]);
  }
});
