import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";
const root=join(process.cwd(),"..","dutch-curriculum","units","dutch-core");
function entries(md){return [...md.matchAll(/^- Principal:\s*(DUT-GRAMMAR-\d{3}[A-Z]?)\s*\|/gmu)].map(m=>m[1]);}
function patterns(md){return [...md.matchAll(/^####\s+(.+)$/gmu)].map(m=>m[1]).filter(x=>!/^Chapter /u.test(x));}
for(let start=26;start<=70;start+=5){
 test(`Dutch grammar summaries ${start}-${start+4} mirror chapter inventories`,async()=>{
   const ids=[]; const pats=[]; const dirs=await readdir(root);
   for(let n=start;n<=start+4;n++){
     const d=dirs.find(x=>x.startsWith(`chapter-${String(n).padStart(3,"0")}-`)&&!x.includes("grammar"));
     const md=await readFile(join(root,d,"chapter.md"),"utf8"); ids.push(...entries(md)); pats.push(...patterns(md).slice(0,entries(md).length));
   }
   const slug=`${String(start).padStart(3,"0")}-${String(start+4).padStart(3,"0")}`;
   for(const level of ["easy","hard"]){
     const md=await readFile(join(root,`chapter-${slug}-grammar-${level}`,"chapter.md"),"utf8");
     assert.deepEqual([...md.matchAll(/^- (DUT-GRAMMAR-\d{3}[A-Z]?) --/gmu)].map(m=>m[1]),ids);
     assert.deepEqual([...md.matchAll(/^- `([^`]+)`$/gmu)].map(m=>m[1]),pats);
   }
 });
}

test("Dutch Chapter 69B direct request and Chapter 70B reported question retain non-overlapping matrix identities", async () => {
  const chapter69 = await readFile(join(root, "chapter-069-a-formal-information-request", "chapter.md"), "utf8");
  const chapter70 = await readFile(join(root, "chapter-070-reporting-the-meeting", "chapter.md"), "utf8");
  assert.match(chapter69, /DUT-GRAMMAR-069B \| Direct information request: V1 matrix question addressed to u plus an embedded polar of-clause\./u);
  assert.match(chapter70, /DUT-GRAMMAR-070B \| Reported questions: declarative matrix clause with an overt reporter plus an embedded polar of-clause; not a direct request to the addressee\./u);
  assert.match(chapter69, /Kunt u mij zeggen of de aanvraag geldig is\?/u);
  assert.match(chapter70, /Pieter vraagt of het geluid de dag ervoor is gecontroleerd\./u);

  for (const level of ["easy", "hard"]) {
    const summary = await readFile(join(root, `chapter-066-070-grammar-${level}`, "chapter.md"), "utf8");
    assert.match(summary, /direct formal Kunt u mij zeggen of \+ embedded polar clause\?/u);
    assert.match(summary, /reporter \+ vraagt of \+ embedded polar clause/u);
    assert.match(summary, /direct (?:question|formal information request)|directly requests information/u);
    assert.match(summary, /report|reports another person's question/u);
  }
});
