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
