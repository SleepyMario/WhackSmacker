import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';
const script=new URL('./prepare-launcher-catalogue.mjs',import.meta.url);
test('retained decks survive feed updates, published entries win, corruption fails loudly',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'wsm-retained-'));
 try {
 const archive=path.join(dir,'deck.wspkg');fs.writeFileSync(archive,'verified');
 const entry={packageId:'test.chinese.radicals',package:{url:pathToFileURL(archive).href,size:8,sha256:createHash('sha256').update('verified').digest('hex')}};
 const input=path.join(dir,'feed.json'), retained=path.join(dir,'retained.json'),output=path.join(dir,'out.json');
 fs.writeFileSync(retained,JSON.stringify({packages:[entry]}));
 const run=()=>spawnSync(process.execPath,[script.pathname,input,output,retained],{encoding:'utf8'});
 fs.writeFileSync(input,JSON.stringify({packages:[]}));assert.equal(run().status,0);assert.deepEqual(JSON.parse(fs.readFileSync(output)).packages,[entry]);
 const newer={...entry,artifactRevision:99};fs.writeFileSync(input,JSON.stringify({packages:[newer]}));assert.equal(run().status,0);assert.deepEqual(JSON.parse(fs.readFileSync(output)).packages,[newer]);
 fs.writeFileSync(input,JSON.stringify({packages:[]}));fs.writeFileSync(archive,'corrupt!');const bad=run();assert.notEqual(bad.status,0);assert.match(bad.stderr,/integrity verification/);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
