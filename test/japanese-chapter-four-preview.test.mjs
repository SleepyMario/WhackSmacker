import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {test} from 'node:test';
import {renderLanguageTreeRightPane} from '../dist/apps/cli/interactive-menu.js';
const directory=new URL('../dist/apps/cli/content/japanese/chapter-004/',import.meta.url).pathname;
const node={id:'japanese:read:chapter-004',label:'Chapter IV — Ren’s Study Materials',kind:'message',authoredReadingDirectory:directory};
test('Chapter IV keeps narrative sentences separate across audience and support settings',async()=>{
 const source=await readFile(`${directory}/chapter.md`,'utf8');
 const narrative=source.split('### Narrative\n\n')[1].split('\n\n').slice(1)[0];
 const sentences=narrative.split('\n');
 assert.equal(sentences.length,9);
 for(const sentence of sentences) assert.equal((sentence.match(/。/gu)??[]).length,1);
 const translation=JSON.parse(await readFile(`${directory}/reading-translation.en.json`,'utf8'));
 assert.equal(translation.sentences.length,9);
 for(const displayMode of ['normal','expert','developer'])for(const translationsEnabled of [false,true])for(const breakdownEnabled of [false,true]){
  const text=await renderLanguageTreeRightPane(node,{locale:'en-US',displayMode,translationsEnabled,breakdownEnabled});
  assert.ok(text.includes(narrative),`${displayMode} changed the narrative line structure`);
  assert.equal(text.includes('Natural English Translation'),translationsEnabled);
  assert.equal(text.includes('Line-by-line Breakdown'),breakdownEnabled);
  assert.ok(text.includes('### Grammar'));
  assert.ok(!/### (?:Written Exercise|Simple Exercises|Model Answer|Answer Key)/u.test(text));
  if(translationsEnabled)for(const sentence of translation.sentences)assert.ok(text.includes(sentence));
 }
 const rows=source.split('### New Vocabulary')[1].split('### Grammar')[0].split('\n').filter(l=>l.startsWith('|')&&!l.startsWith('|---')&&!l.startsWith('| Form'));
 assert.equal(rows.length,6);
 assert.ok(source.includes('付箋 | ふせん | sticky note'));
});
