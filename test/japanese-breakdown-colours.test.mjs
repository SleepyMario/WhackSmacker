import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { renderTwoPaneLanguageTree, renderLanguageTreeRightPane } from '../dist/apps/cli/interactive-menu.js';
const strip=text=>text.replace(/\x1b\[[0-9;]*m/gu,'');
const root={id:'test-root',label:'Reading',kind:'message'};
for(const chapter of ['001','002','003','004','005','006'])test(`Chapter ${chapter} breakdown colours and aligned labels survive wrapping and no-colour output`,async()=>{
 const directory=new URL(`../dist/apps/cli/content/japanese/chapter-${chapter}/`,import.meta.url).pathname;
 const support=JSON.parse(await readFile(`${directory}/reading-support.json`,'utf8'));
 for(const mode of ['normal','expert','developer']){
  const node={...root,id:`chapter-${chapter}`,authoredReadingDirectory:directory};
  const projected=await renderLanguageTreeRightPane(node,{displayMode:mode,breakdownEnabled:true,locale:'en-US'});
  const text=projected.slice(projected.indexOf('### Line-by-line Breakdown'));
  assert.equal((support.breakdown.normal.match(/English: /gu)??[]).length,chapter==='006'?15:['003','005'].includes(chapter)?12:chapter==='004'?9:8);
  for(const width of [110,180,280]){
   const render=color=>renderTwoPaneLanguageTree(root,new Set(),0,text,color,0,500,'en-US','navigation',width);
   const coloured=render(true), plain=render(false);
   assert.equal(strip(coloured),plain);
   assert.ok(coloured.includes('\x1b[38;5;213m'),'original uses pink');
   assert.ok(coloured.includes('\x1b[36m    '),'reading uses cyan');
   assert.ok(coloured.includes('\x1b[33m    '),'translation uses yellow');
   const rows=plain.split('\n');
   const original=rows.find(line=>line.includes('1. '));
   const readingValue=/Reading: (.+)/u.exec(support.breakdown.normal)[1].slice(0,8);
   const englishValue=/English: (.+)/u.exec(support.breakdown.normal)[1].slice(0,8);
   const start=rows.indexOf(original);
   const reading=rows.find((line,i)=>i>start&&line.includes(readingValue));
   const english=rows.find((line,i)=>i>rows.indexOf(reading)&&line.includes(englishValue));
   assert.ok(!plain.includes('Reading:'));
   assert.ok(!plain.includes('English:'));
   assert.ok(original && reading && english);
   assert.equal(original.indexOf('1. ')+3,reading.indexOf(readingValue));
   assert.equal(reading.indexOf(readingValue),english.indexOf(englishValue));
  }
 }
});

for (const chapter of ['001','002','003','004','005','006']) test(`Chapter ${chapter} Spaces No compacts triples but keeps numbered entries apart`, async()=>{
 const directory=new URL(`../dist/apps/cli/content/japanese/chapter-${chapter}/`,import.meta.url).pathname;
 const support=JSON.parse(await readFile(`${directory}/reading-support.json`,'utf8'));
 const text='### Line-by-line Breakdown\n\n'+support.breakdown.normal;
 const render=(spacing,color=false)=>renderTwoPaneLanguageTree(root,new Set(),0,text,color,0,500,'en-US','navigation',400,0,'normal',false,true,false,false,true,spacing);
 const compact=render('compact');
 assert.equal(strip(render('compact',true)),compact);
 for(const spacing of ['compact','separated']){
  const rows=render(spacing).split('\n');
  for(let entry=1;entry<=(chapter==='006'?15:['003','005'].includes(chapter)?12:chapter==='004'?9:8);entry++){
   const start=rows.findIndex(line=>line.includes(`${entry}. `));
   assert.ok(start>=0);
   const readings=[...support.breakdown.normal.matchAll(/Reading: (.+)/gu)];
   const translations=[...support.breakdown.normal.matchAll(/English: (.+)/gu)];
   const reading=rows.findIndex((line,i)=>i>start&&line.includes(readings[entry-1][1]));
   const english=rows.findIndex((line,i)=>i>reading&&line.includes(translations[entry-1][1]));
   const gap=spacing==='compact'?1:2;
   assert.equal(reading-start,gap);
   assert.equal(english-reading,gap);
   if(entry<(chapter==='006'?15:['003','005'].includes(chapter)?12:chapter==='004'?9:8)){
    const next=rows.findIndex(line=>line.includes(`${entry+1}. `));
    assert.ok(next>english+1,'retain separation before the next entry');
    assert.equal(rows[english+1].split('|')[2].trim(),'','retain blank output row after the English line');
   }
  }
 }
});
