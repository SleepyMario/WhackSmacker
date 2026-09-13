import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp,mkdir,writeFile,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import {join} from 'node:path';
import {selectCoreReviewTargets} from '../scripts/core-review-targets.mjs';

test('core feed allows no authored content and discovers newly authored languages',async()=>{
 const root=await mkdtemp(join(tmpdir(),'wsm-feed-selection-'));
 const targets=[{id:'dutch-core-reviews',sourcePath:'dutch'},{id:'japanese-core-reviews',sourcePath:'japanese'},{id:'custom-preview',sourcePath:'custom'}];
 try{
  await mkdir(join(root,'dutch'));await writeFile(join(root,'dutch/README.md'),'Cast-only reset state');
  assert.deepEqual(await selectCoreReviewTargets(targets,root),[]);
  await mkdir(join(root,'japanese/review-decks/chapter-001-005'),{recursive:true});
  // Even malformed authored content must reach validation, never be omitted.
  await writeFile(join(root,'japanese/review-decks/chapter-001-005/cards.tsv'),'invalid fixture');
  await mkdir(join(root,'custom'));await writeFile(join(root,'custom/cards.tsv'),'fixture');
  assert.deepEqual(await selectCoreReviewTargets(targets,root),['japanese-core-reviews']);
 }finally{await rm(root,{recursive:true,force:true});}
});
test('filesystem errors other than absent content fail feed selection',async()=>{
 const root=await mkdtemp(join(tmpdir(),'wsm-feed-error-'));
 try{await writeFile(join(root,'not-directory'),'x');await assert.rejects(()=>selectCoreReviewTargets([{id:'dutch-core-reviews',sourcePath:'not-directory'}],root),{code:'ENOTDIR'});}
 finally{await rm(root,{recursive:true,force:true});}
});

test('Vietnamese evidence discovers tracked units without requiring an empty historical Foundation directory', async()=>{
 const {contentPackageGeneratorTargets}=await import('../dist/packages/core/index.js');
 const target=contentPackageGeneratorTargets.find(t=>t.id==='vietnamese-curriculum');
 assert.ok(target.readingContentInclude.includes('units'));
 assert.ok(!target.readingContentInclude.includes('units/vietnamese-foundation'));
});
