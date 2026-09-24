import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { renderLanguageTreeRightPane, renderTwoPaneLanguageTree } from '../dist/apps/cli/interactive-menu.js';
import { generateContentPackage } from '../dist/packages/core/content-package-generator.js';
for (const [number,count] of [['003',10],['004',9],['005',10],['006',13],['007',14],['008',11],['009',15],['010',10],['011',14],['012',13],['013',14],['014',15],['015',16]]) {
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
   const dialogueNames=number==='007'?['Maria','Gia Bảo']:number==='009'?['Minh Anh','Gia Bảo','Seller']:number==='011'?['Minh Anh','Quốc Huy','Thu Hà']:number==='013'?['Quốc Huy','Gia Bảo','Minh Anh']:number==='015'?['Thu Hà','Quốc Huy','Minh Anh']:['Maria','Minh Anh'];
   for(const name of dialogueNames)assert.ok(support.breakdown.normal.includes(`English: ${name}:`));
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
test('Vietnamese Grammar VI-X covers the same five IDs and fourteen exact examples in both views',async()=>{
 const root=new URL('../../vietnamese-curriculum/units/vietnamese-core/',import.meta.url).pathname;
 const easy=JSON.parse(await readFile(join(root,'chapter-006-010-grammar-easy/coverage.json'),'utf8'));
 const hard=JSON.parse(await readFile(join(root,'chapter-006-010-grammar-hard/coverage.json'),'utf8'));
 assert.deepEqual(easy,hard);assert.equal(easy.grammarIds.length,5);assert.equal(easy.examples.length,14);
 const base=new URL('../dist/apps/cli/content/vietnamese/',import.meta.url).pathname;
 const node={id:'vi:grammar-006-010',label:'Grammar VI - X',kind:'message',authoredGrammarPaths:[join(base,'grammar-006-010-easy.md'),join(base,'grammar-006-010-hard.md')]};
 const normal=await renderLanguageTreeRightPane(node,{displayMode:'normal',locale:'en-US'}),expert=await renderLanguageTreeRightPane(node,{displayMode:'expert',locale:'en-US'});
 assert.notEqual(normal,expert);
 for(const item of easy.examples){assert.ok(normal.includes(item.example));assert.ok(expert.includes(item.example));}
});
test('Vietnamese Grammar XI-XV covers the same five IDs and fifteen exact examples in both views',async()=>{
 const root=new URL('../../vietnamese-curriculum/units/vietnamese-core/',import.meta.url).pathname;
 const easy=JSON.parse(await readFile(join(root,'chapter-011-015-grammar-easy/coverage.json'),'utf8'));
 const hard=JSON.parse(await readFile(join(root,'chapter-011-015-grammar-hard/coverage.json'),'utf8'));
 assert.deepEqual(easy,hard);assert.equal(easy.grammarIds.length,5);assert.equal(easy.examples.length,15);
 const base=new URL('../dist/apps/cli/content/vietnamese/',import.meta.url).pathname;
 const node={id:'vi:grammar-011-015',label:'Grammar XI - XV',kind:'message',authoredGrammarPaths:[join(base,'grammar-011-015-easy.md'),join(base,'grammar-011-015-hard.md')]};
 const normal=await renderLanguageTreeRightPane(node,{displayMode:'normal',locale:'en-US'}),expert=await renderLanguageTreeRightPane(node,{displayMode:'expert',locale:'en-US'});
 assert.notEqual(normal,expert);
 for(const item of easy.examples){assert.ok(normal.includes(item.example));assert.ok(expert.includes(item.example));}
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
test('Vietnamese VI-X review has 27 exact paired lexical senses and no post-block material',async()=>{
 const sourceRoot=new URL('../../vietnamese-curriculum/',import.meta.url).pathname;
 const forms=JSON.parse(await readFile(join(sourceRoot,'vocabulary-forms.json'),'utf8'));
 const occurrences=new Map(forms.occurrences.map(item=>[item.id,item]));
 const eligible=forms.displayRows.filter(item=>item.chapter>=6&&item.chapter<=10&&item.reviewEligible);
 const tsv=await readFile(new URL('../review-content/vietnamese/review-decks/chapter-006-010/cards.tsv',import.meta.url),'utf8');
 const [header,...rows]=tsv.trim().split('\n').map(x=>x.split('\t').map(v=>v.startsWith('"')&&v.endsWith('"')?v.slice(1,-1).replaceAll('""','"'):v));
 const cards=rows.map(row=>Object.fromEntries(header.map((name,index)=>[name,row[index]])));
 assert.equal(eligible.length,27);assert.equal(cards.length,54);assert.equal(new Set(cards.map(card=>card.card_id)).size,54);
 for(const entry of eligible){
  const pair=cards.filter(card=>JSON.parse(card.lexical_ids).includes(entry.canonicalSenseId));
  assert.equal(pair.length,2);assert.deepEqual(new Set(pair.map(card=>card.tags.includes('target-to-source')?'target-to-source':'source-to-target')),new Set(['target-to-source','source-to-target']));
  for(const card of pair){
   assert.ok(Number(card.source_chapter)>=6&&Number(card.source_chapter)<=10);
   assert.equal(card.provenance_evidence,occurrences.get(entry.occurrenceId).sentenceOrExample);
   const examples=JSON.parse(card.examples);assert.ok(examples.length>=1&&examples.length<=3);
   const chapter=await readFile(join(sourceRoot,entry.sourcePath),'utf8');for(const example of examples)assert.ok(chapter.includes(example));
  }
 }
});
test('Vietnamese XI-XV review has 71 exact paired lexical senses and no post-block material',async()=>{
 const sourceRoot=new URL('../../vietnamese-curriculum/',import.meta.url).pathname;
 const forms=JSON.parse(await readFile(join(sourceRoot,'vocabulary-forms.json'),'utf8'));
 const occurrences=new Map(forms.occurrences.map(item=>[item.id,item]));
 const eligible=forms.displayRows.filter(item=>item.chapter>=11&&item.chapter<=15&&item.reviewEligible);
 const tsv=await readFile(new URL('../review-content/vietnamese/review-decks/chapter-011-015/cards.tsv',import.meta.url),'utf8');
 const [header,...rows]=tsv.trim().split('\n').map(x=>x.split('\t').map(v=>v.startsWith('"')&&v.endsWith('"')?v.slice(1,-1).replaceAll('""','"'):v));
 const cards=rows.map(row=>Object.fromEntries(header.map((name,index)=>[name,row[index]])));
 assert.equal(eligible.length,71);assert.equal(cards.length,142);assert.equal(new Set(cards.map(card=>card.card_id)).size,142);
 for(const entry of eligible){
  const pair=cards.filter(card=>JSON.parse(card.lexical_ids).includes(entry.canonicalSenseId));
  assert.equal(pair.length,2);assert.deepEqual(new Set(pair.map(card=>card.tags.includes('target-to-source')?'target-to-source':'source-to-target')),new Set(['target-to-source','source-to-target']));
  for(const card of pair){
   assert.ok(Number(card.source_chapter)>=11&&Number(card.source_chapter)<=15);
   assert.equal(card.provenance_evidence,occurrences.get(entry.occurrenceId).sentenceOrExample);
   const examples=JSON.parse(card.examples);assert.ok(examples.length>=1&&examples.length<=3);
   const chapter=await readFile(join(sourceRoot,entry.sourcePath),'utf8');for(const example of examples)assert.ok(chapter.includes(example));
  }
 }
});
test('portable Vietnamese reading package contains all fifteen scenes and both later cast portraits',async()=>{
 const output=await mkdtemp(join(tmpdir(),'vi-scenes-'));
 try{const result=await generateContentPackage({targetId:'vietnamese-curriculum',outputDirectory:output,generatedAt:'2026-09-12T12:00:00Z'});
  assert.equal(result.manifest.files.filter(f=>/chapter-(?:00[1-9]|01[0-5])-[^/]+\/media\/scene\.png$/.test(f.path)).length,15);
  assert.ok(result.manifest.files.some(f=>f.path.endsWith("introductions/media/gia-bao.png")));
  assert.ok(result.manifest.files.some(f=>f.path.endsWith("introductions/media/quoc-huy.png")));
 }finally{await rm(output,{recursive:true,force:true});}
});

test('Vietnamese examples have adjacent original-English rows with no redundant reading',async()=>{
 const root=new URL('../../vietnamese-curriculum/units/vietnamese-core/',import.meta.url).pathname;
 const {readdir}=await import('node:fs/promises');
 for(const name of await readdir(root)){
  if(!/^chapter-(?:00[1-9]|01[0-5])-/.test(name)||name.includes('grammar'))continue;
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
 for(const [block,count] of [['001-005',15],['006-010',14],['011-015',15]])for(const variant of ['easy','hard']){
   const text=await readFile(join(root,`chapter-${block}-grammar-${variant}`,'chapter.md'),'utf8');
   assert.ok(!text.includes('Reading:'));
   assert.equal((text.match(/\*\*\nEnglish:/g)||[]).length,count);
   const node={id:`vi-grammar-pairs-${block}`,label:`Grammar ${block}`,kind:'message'};
   const rendered=renderTwoPaneLanguageTree(node,new Set(),0,text,true,0,1600,'en-US','navigation',240,0,'normal');
   const lines=rendered.split('\n');
   for(let i=0;i<lines.length;i++)if(/\x1b\[38;5;213m\s*\d+\./.test(lines[i]))assert.ok(lines[i+1].includes('\x1b[33m'));
  }
});

test('VII prose colon does not become the dialogue speaker alignment column', async () => {
 const dir=new URL('../dist/apps/cli/content/vietnamese/chapter-007/',import.meta.url).pathname;
 const node={id:'vi-seven-layout',label:'Chapter VII',kind:'message',authoredReadingDirectory:dir};
 for(const mode of ['normal','expert']) for(const spacing of ['compact','separated']) {
  const text=await renderLanguageTreeRightPane(node,{displayMode:mode,translationsEnabled:true,locale:'en-US'});
  for(const width of [100,160,240]) {
   const rendered=renderTwoPaneLanguageTree(node,new Set(),0,text,true,0,1600,'en-US','navigation',width,0,mode,false,true,false,false,true,spacing);
   const plain=rendered.replace(/\x1b\[[0-9;]*m/g,'');
   assert.match(plain,/Maria\s{0,4}: Sách của em ở đâu\?/u);
   assert.match(plain,/Gia Bảo: Sách của em ở đây\./u);
   assert.ok(rendered.includes('\x1b[38;5;141mMaria'), 'real speaker retains speaker colour');
   assert.ok(!rendered.includes('\x1b[38;5;141mMaria Garcia visits'), 'setup remains ordinary prose');
  }
 }
});
