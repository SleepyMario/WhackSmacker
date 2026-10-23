import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

test('Docker initialization installs same-version new revisions exactly once and preserves existing state', async()=>{
 const root=await mkdtemp(join(tmpdir(),'wsm-entrypoint-'));
 try {
  await mkdir(join(root,'dist/packages/core'),{recursive:true});
  const entry={packageId:'fixture.core',packageVersion:'0.1.0',deckVersion:'0.1.0',artifactRevision:2};
  await writeFile(join(root,'catalogue.json'),JSON.stringify({packages:[entry,entry]}));
  await writeFile(join(root,'installed.json'),JSON.stringify([{...entry,artifactRevision:1}]));
  await writeFile(join(root,'progress.json'),'preserved learner state');
  await writeFile(join(root,'dist/packages/core/content-package-manager.js'),`
const fs=require('node:fs');const root=${JSON.stringify(root)};
exports.listInstalledContentPackages=async()=>JSON.parse(fs.readFileSync(root+'/installed.json'));
exports.installContentPackage=async(options)=>{
 const installed=JSON.parse(fs.readFileSync(root+'/installed.json'));
 installed.push(options);fs.writeFileSync(root+'/installed.json',JSON.stringify(installed));
 fs.appendFileSync(root+'/calls.jsonl',JSON.stringify(options)+'\\n');
};`);
  await writeFile(join(root,'dist/packages/core/deck-framework.js'),`module.exports=require(${JSON.stringify(resolve('dist/packages/core/deck-framework.js'))});`);
  await writeFile(join(root,'dist/main.js'),'process.exit(0);');
  const script=(await readFile('scripts/docker-entrypoint.mjs','utf8')).replaceAll('/app/',root+'/');
  await writeFile(join(root,'entrypoint.mjs'),script);
  const env={...process.env,WHACKSMACKER_DATA_DIR:root,WHACKSMACKER_CORE_CATALOGUE:join(root,'catalogue.json')};
  execFileSync(process.execPath,[join(root,'entrypoint.mjs'),'--help'],{env});
  execFileSync(process.execPath,[join(root,'entrypoint.mjs'),'--help'],{env});
  const calls=(await readFile(join(root,'calls.jsonl'),'utf8')).trim().split('\n').map(JSON.parse);
  assert.equal(calls.length,1);
  assert.equal(calls[0].artifactRevision,2);
  assert.equal(calls[0].deckVersion,'0.1.0');
  assert.equal((JSON.parse(await readFile(join(root,'installed.json')))).length,2);
  assert.equal(await readFile(join(root,'progress.json'),'utf8'),'preserved learner state');
 } finally {await rm(root,{recursive:true,force:true});}
});
