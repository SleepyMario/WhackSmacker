import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFile} from 'node:fs/promises';
import {renderLanguageTreeRightPane,centrePaneReviewArtworkRectangle,EmbeddedReviewArtworkManager} from '../dist/apps/cli/interactive-menu.js';
const directory=new URL('../dist/apps/cli/content/japanese/chapter-002/',import.meta.url).pathname;
const node={id:'chapter-002',label:'Chapter II — Aki’s Introduction',kind:'message',authoredReadingDirectory:directory,previewArtworkPath:directory+'media/scene.png'};
const marker='[[WHACKSMACKER_REVIEW_ARTWORK_REGION]]';
test('Chapter II scene stays directly after the title across reading controls',async()=>{
 const data=await readFile(node.previewArtworkPath);assert.equal(data.subarray(1,4).toString(),'PNG');
 for(const displayMode of ['normal','expert','developer'])for(const translationsEnabled of [false,true])for(const breakdownEnabled of [false,true]){
  const text=await renderLanguageTreeRightPane(node,{locale:'en-US',displayMode,translationsEnabled,breakdownEnabled});
  assert.match(text,/# Chapter II — Aki’s Introduction\n\n\[\[WHACKSMACKER_REVIEW_ARTWORK_REGION\]\]\n\n#{2,3} Brief Introduction/u);
  assert.equal(text.split(marker).length,2);
  assert.ok(!text.includes('(media/scene.png)'));
  assert.ok(text.includes('私は佐藤あきです。'));
  assert.equal(text.includes('Natural English Translation'),translationsEnabled);
  assert.equal(text.includes('Line-by-line Breakdown'),breakdownEnabled);
  if(displayMode!=='developer')assert.ok(centrePaneReviewArtworkRectangle({column:40,row:4,widthColumns:110,heightRows:36},text,false));
 }
});
test('Chapter II scene uses preview lifecycle and clears on scroll or chapter change',async()=>{
 const calls=[];
 const controller={capabilities:{ready:true,backend:'wayland-overlay'},start:async()=>{},clear:async()=>{},show:async request=>{calls.push(['show',request]);},hide:async()=>calls.push(['hide']),shutdown:async()=>calls.push(['shutdown'])};
 const manager=new EmbeddedReviewArtworkManager({colorsEnabled:false,width:180,height:45,write(){}},{terminalArtworkBackend:'wayland-overlay',terminalArtworkControllerFactory:async()=>controller});
 const text=await renderLanguageTreeRightPane(node,{locale:'en-US'});
 assert.equal((await manager.syncPreview(node,text)).rendered,true);
 assert.equal((await manager.syncPreview(node,text,2)).rendered,false);
 assert.equal((await manager.syncPreview(node,text)).rendered,true);
 assert.equal((await manager.syncPreview({id:'chapter-002',label:'Chapter III',kind:'message'},'Chapter III')).rendered,false);
 assert.equal(calls.filter(c=>c[0]==='show').length,2);
});
