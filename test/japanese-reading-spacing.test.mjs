import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {test} from 'node:test';
import {renderLanguageTreeRightPane,renderTwoPaneLanguageTree} from '../dist/apps/cli/interactive-menu.js';
const root={id:'root',label:'Reading',kind:'message'};
const strip=s=>s.replace(/\x1b\[[0-9;]*m/gu,'');
for(const chapter of ['001','002','003','004','005'])test(`Chapter ${chapter} Spaces controls gaps between reading units and translation units`,async()=>{
 const directory=new URL(`../dist/apps/cli/content/japanese/chapter-${chapter}/`,import.meta.url).pathname;
 const source=await readFile(`${directory}/chapter.md`,'utf8');
 const heading=['001','003','005'].includes(chapter)?'Dialogue':'Narrative';
 const body=source.split(`### ${heading}\n\n`)[1].split('\n\n')[1];
 const originals=body.split('\n').map(line=>['001','003','005'].includes(chapter)?line.split(': ')[1]:line);
 const translation=JSON.parse(await readFile(`${directory}/reading-translation.en.json`,'utf8'));
 const english=translation.sentences??translation.turns.map(turn=>turn.text);
 for(const mode of ['normal','expert','developer']){
  const text=await renderLanguageTreeRightPane({...root,id:`ch${chapter}`,authoredReadingDirectory:directory},{locale:'en-US',displayMode:mode,translationsEnabled:true});
  for(const spacing of ['compact','separated']){
   const render=color=>renderTwoPaneLanguageTree(root,new Set(),0,text,color,0,500,'en-US','navigation',400,0,mode,true,false,false,false,true,spacing);
   const output=render(false);assert.equal(strip(render(true)),output);
   const rows=output.split('\n');
   for(const units of [originals,english]){
    let cursor=-1;const positions=[];
    for(const unit of units){cursor=rows.findIndex((line,i)=>i>cursor&&line.includes(unit));assert.ok(cursor>=0,unit);positions.push(cursor);}
    for(let i=1;i<positions.length;i++)assert.equal(positions[i]-positions[i-1],spacing==='separated'?2:1);
   }
  }
 }
});
