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
