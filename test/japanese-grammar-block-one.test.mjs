import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import {renderLanguageTreeRightPane,renderTwoPaneLanguageTree} from '../dist/apps/cli/interactive-menu.js';
const node={id:'grammar-001-005',label:'Grammar',kind:'message',authoredGrammarPaths:['easy','hard'].map(v=>new URL(`../dist/apps/cli/content/japanese/grammar-001-005-${v}.md`,import.meta.url).pathname)};
test('Grammar selects exactly Easy in Normal and Hard in Expert, with identical examples and coverage',async()=>{
 const coverage=await Promise.all(['easy','hard'].map(async v=>JSON.parse(await readFile(new URL(`../../japanese-curriculum/units/japanese-core/chapter-001-005-grammar-${v}/coverage.json`,import.meta.url),'utf8'))));
 assert.deepEqual(coverage[0].grammarIds,coverage[1].grammarIds);assert.equal(coverage[0].grammarIds.length,5);assert.deepEqual(coverage[0].examples,coverage[1].examples);assert.equal(coverage[0].examples.length,15);
 for(const mode of ['normal','expert'])for(const translationsEnabled of [false,true])for(const breakdownEnabled of [false,true]){
  const text=await renderLanguageTreeRightPane(node,{locale:'en-US',displayMode:mode,translationsEnabled,breakdownEnabled});
  assert.equal((text.match(/^# Grammar$/gm)??[]).length,1);
  assert.equal((text.match(/^### /gm)??[]).length,5);
  assert.equal(text.includes('Put [[grammar:です]] after a name'),mode==='normal');
  assert.equal(text.includes('The polite copula'),mode==='expert');
  assert.ok(!/JPN-GRAMMAR-|grammar_ids|Grammar - Easy|Grammar - Hard/.test(text));
  for(const ex of coverage[0].examples)assert.ok(text.includes(ex.example));
  const plain=renderTwoPaneLanguageTree(node,new Set(),0,text,false,0,500,'en-US','navigation',220,0,mode);
  assert.ok(!plain.includes('[[grammar:'));assert.ok(plain.includes('Reading:'));assert.ok(plain.includes('English:'));
 }
});

test('Both grammar versions colour Japanese explanations and each example role, including wrapped and plain output',async()=>{
 const strip=text=>text.replace(/\x1b\[[0-9;]*m/gu,'');
 for(const mode of ['normal','expert']){
  const text=await renderLanguageTreeRightPane(node,{locale:'en-US',displayMode:mode});
  for(const width of [110,220,400]){
   const render=color=>renderTwoPaneLanguageTree(node,new Set(),0,text,color,0,1000,'en-US','navigation',width,0,mode);
   const coloured=render(true),plain=render(false);
   assert.equal(strip(coloured),plain);
   assert.ok(coloured.includes('\x1b[34m大学生です。\x1b[0m'),'Japanese within prose is grammar blue');
   assert.ok(coloured.includes('\x1b[38;5;213m'),'example originals are pink');
   assert.ok(coloured.includes('\x1b[36m    Reading:'),'readings are cyan');
   assert.ok(coloured.includes('\x1b[33m    English:'),'translations are yellow');
   assert.ok(!plain.includes('[[grammar:'));
  }
 }
});
