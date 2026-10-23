import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';

test('retired daily publishers fail without invoking Docker', () => {
  for (const name of ['daily','vm-daily']) {
    const result=spawnSync('bash',[`scripts/operations/whacksmacker-docker-${name}.sh`],{encoding:'utf8'});
    assert.equal(result.status,2);
    assert.match(result.stderr,/retired/);
  }
});
test('release rejects floating and malformed versions before any build', () => {
  for (const tag of ['latest','alpha','nightly','../oops']) {
    const result=spawnSync('bash',['scripts/operations/whacksmacker-docker-release.sh',tag],{encoding:'utf8'});
    assert.notEqual(result.status,0);
    assert.match(result.stderr,/explicit semantic version/);
  }
});
test('release validates before advancing latest and defaults to local build',async()=>{
 const s=await readFile('scripts/operations/whacksmacker-docker-release.sh','utf8');
 assert.match(s,/mode=\$\{2:---build-only\}/);
 assert.ok(s.indexOf('smoke_image "$image" local')<s.indexOf('docker tag "$image"'));
 assert.ok(s.indexOf('smoke_image "$image" remote')<s.indexOf('docker push "$REPOSITORY:latest"'));
 assert.match(s,/registry_status.*404/);
 assert.match(s,/latest digest mismatch/);
 assert.match(s,/docker buildx imagetools inspect/);
 assert.match(s,/npm run test:docker/);
});
test('Docker context excludes checkout history and learner state',async()=>{
 const dockerfile=await readFile('Dockerfile','utf8');
 const ignore=await readFile('Dockerfile.dockerignore','utf8');
 const prepare=await readFile('scripts/prepare-docker-context.sh','utf8');
 assert.match(dockerfile,/COPY core-feed\/ \/core-feed\//);
 assert.doesNotMatch(dockerfile,/COPY .*curriculum/);
 for(const pattern of ['**/.git','**/.local-content','**/registry.json','**/*progress*.json']) assert.ok(ignore.includes(pattern));
 assert.match(prepare,/git -C "\$APP" archive HEAD/);
 assert.match(prepare,/file:\/\/\/core-feed\/packages\//);
});
