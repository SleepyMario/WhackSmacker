import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { renderLanguageTreeRightPane, renderTwoPaneLanguageTree } from '../dist/apps/cli/interactive-menu.js';
import { generateContentPackage } from '../dist/packages/core/content-package-generator.js';
for (const [number,count] of [['003',10],['004',9],['005',10],['006',13],['007',14],['008',11]]) {
 test(`Vietnamese ${number}: complete reading, regional guide and independent support views`, async()=>{
  const dir=new URL(`../dist/apps/cli/content/vietnamese/chapter-${number}/`,import.meta.url).pathname;
  const src=await readFile(join(dir,'chapter.md'),'utf8');
  const kind=Number(number)%2===0?'Narrative':'Dialogue';
  const primary=src.split(`### ${kind}\n`)[1].split('\n### ')[0].trim().split('\n\n').slice(1).join('\n\n');
  const lines=primary.split('\n').filter(Boolean); assert.equal(lines.length,count);
  assert.ok([...new Intl.Segmenter('vi',{granularity:'sentence'}).segment(primary)].length>=6);
  const node={id:`vietnamese:read:${number}`,label:`Chapter ${number}`,kind:'message',packageId:'com.sleepymario.language.vietnamese',authoredReadingDirectory:dir,previewArtworkPath:join(dir,'media/scene.png')};
  assert.ok((await readFile(node.previewArtworkPath)).length>1000);
  for(const displayMode of ['normal','expert']) for(const translationsEnabled of [false,true]) for(const breakdownEnabled of [false,true]) for(const charactersEnabled of [false,true]) {
   const text=await renderLanguageTreeRightPane(node,{displayMode,translationsEnabled,breakdownEnabled,charactersEnabled,locale:'en-US'});
   for(const line of lines)assert.ok(text.includes(line),`missing ${line}`);
   assert.ok(text.includes('Regional Guide'));
   assert.equal(text.includes('Natural English Translation'),translationsEnabled);
   assert.equal(text.includes('Line-by-line Breakdown'),breakdownEnabled);
   assert.equal(text.includes('Sino-Vietnamese Vocabulary'),charactersEnabled);
   const coloured=renderTwoPaneLanguageTree(node,new Set(),0,text,true,0,1600,'en-US','navigation',240,0,displayMode);
   assert.ok(coloured.includes('\x1b[34m'));
   if(breakdownEnabled){assert.ok(coloured.includes('\x1b[36m'));assert.ok(coloured.includes('\x1b[33m'));}
  }
  if(kind==='Dialogue'){
   const support=JSON.parse(await readFile(join(dir,'reading-support.json'),'utf8'));
   for(const label of ['English']) for(const name of (number==='007'?['Maria','Gia Bảo']:['Maria','Minh Anh']))assert.ok(support.breakdown.normal.includes(`${label}: ${name}:`));
  }
 });
}
test('Vietnamese Grammar I-V covers the same five IDs and fifteen examples in both views',async()=>{
 const root=new URL('../../vietnamese-curriculum/units/vietnamese-core/',import.meta.url).pathname;
 const easy=JSON.parse(await readFile(join(root,'chapter-001-005-grammar-easy/coverage.json'),'utf8'));
 const hard=JSON.parse(await readFile(join(root,'chapter-001-005-grammar-hard/coverage.json'),'utf8'));
 assert.deepEqual(easy,hard);assert.equal(easy.grammarIds.length,5);assert.equal(easy.examples.length,15);
 const base=new URL('../dist/apps/cli/content/vietnamese/',import.meta.url).pathname;
 const node={id:'vi:grammar',label:'Grammar I - V',kind:'message',authoredGrammarPaths:[join(base,'grammar-001-005-easy.md'),join(base,'grammar-001-005-hard.md')]};
 const n=await renderLanguageTreeRightPane(node,{displayMode:'normal',locale:'en-US'}),e=await renderLanguageTreeRightPane(node,{displayMode:'expert',locale:'en-US'});
 assert.notEqual(n,e);for(const x of easy.examples){assert.ok(n.includes(x.example));assert.ok(e.includes(x.example));}
});
test('Vietnamese block review has exactly paired lexical cards and exact bounded source examples',async()=>{
 const tsv=await readFile(new URL('../review-content/vietnamese/review-decks/chapter-001-005/cards.tsv',import.meta.url),'utf8');
 const [header,...rows]=tsv.trim().split('\n').map(x=>x.split('\t').map(v=>v.startsWith('"')&&v.endsWith('"')?v.slice(1,-1).replaceAll('""','"'):v));const cards=rows.map(r=>Object.fromEntries(header.map((h,i)=>[h,r[i]])));
 assert.equal(cards.length,72);assert.equal(new Set(cards.map(c=>c.card_id)).size,72);
 for(const c of cards){assert.deepEqual(JSON.parse(c.grammar_ids),[]);const ex=JSON.parse(c.examples);assert.ok(ex.length>=1&&ex.length<=3);assert.ok(Number(c.source_chapter)<=5);}
 const audit=JSON.parse(await readFile(new URL('../../vietnamese-curriculum/block-001-005-lexical-audit.json',import.meta.url),'utf8'));
 for(const entry of audit.entries.filter(e=>e.reviewEligible)){
  const pair=cards.filter(c=>JSON.parse(c.lexical_ids).includes(entry.senseId));assert.equal(pair.length,2);
  for(const c of pair)for(const ex of JSON.parse(c.examples))assert.ok(entry.evidence.some(e=>e.sentence===ex));
 }
});
test('portable Vietnamese reading package contains all eight scenes and the new cast portrait',async()=>{
 const output=await mkdtemp(join(tmpdir(),'vi-scenes-'));
 try{const result=await generateContentPackage({targetId:'vietnamese-curriculum',outputDirectory:output,generatedAt:'2026-09-12T12:00:00Z'});
  assert.equal(result.manifest.files.filter(f=>/chapter-00[1-8]-[^/]+\/media\/scene\.png$/.test(f.path)).length,8);
  assert.ok(result.manifest.files.some(f=>f.path.endsWith("introductions/media/gia-bao.png")));
 }finally{await rm(output,{recursive:true,force:true});}
});

test('Vietnamese examples have adjacent original-English rows with no redundant reading',async()=>{
 const root=new URL('../../vietnamese-curriculum/units/vietnamese-core/',import.meta.url).pathname;
 const {readdir}=await import('node:fs/promises');
 for(const name of await readdir(root)){
  if(!/^chapter-00[1-8]-/.test(name)||name.includes('grammar'))continue;
  const support=JSON.parse(await readFile(join(root,name,'reading-support.json'),'utf8'));
  for(const mode of ['normal','expert']){
   const text='### Line-by-line Breakdown\n\n'+support.breakdown[mode];
   assert.ok(!text.includes('Reading:'));
   for(const spacing of ['compact','separated']){
    const node={id:'vi-pairs',label:'Vietnamese',kind:'message'};
    const rendered=renderTwoPaneLanguageTree(node,new Set(),0,text,true,0,500,'en-US','navigation',240,0,mode,false,true,false,false,true,spacing);
    const lines=rendered.split('\n');
    const first=lines.findIndex(l=>l.includes('\x1b[38;5;213m 1. '));
    assert.ok(first>=0);assert.ok(lines[first+1].includes('\x1b[33m    '));
    assert.ok(!rendered.includes('Reading:'));assert.ok(!rendered.includes('Transliteration:'));
   }
  }
 }
 for(const variant of ['easy','hard']){
  const text=await readFile(join(root,`chapter-001-005-grammar-${variant}`,'chapter.md'),'utf8');
  assert.ok(!text.includes('Reading:'));
  assert.equal((text.match(/\*\*\nEnglish:/g)||[]).length,15);
  const node={id:'vi-grammar-pairs',label:'Grammar I - V',kind:'message'};
  const rendered=renderTwoPaneLanguageTree(node,new Set(),0,text,true,0,1600,'en-US','navigation',240,0,'normal');
  const lines=rendered.split('\n');
  for(let i=0;i<lines.length;i++)if(/\x1b\[38;5;213m\s*\d+\./.test(lines[i]))assert.ok(lines[i+1].includes('\x1b[33m'));
 }
});
