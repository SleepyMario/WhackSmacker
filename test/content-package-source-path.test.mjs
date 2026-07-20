import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

import {
  contentPackageSourceRootEnvironmentVariable,
  generateContentPackage,
  resolveContentPackageSourcePath
} from "../dist/packages/core/index.js";

test("content package source resolution honors explicit roots without checkout assumptions",()=>{
  const repositoryRoot=join(tmpdir(),"worktrees","whacksmacker-feature"),sourceRoot=join(tmpdir(),"grouped sources","課程");
  const resolution=resolveContentPackageSourcePath("../example-curriculum",{repositoryRoot,sourceRoot:`${sourceRoot}/`,env:{[contentPackageSourceRootEnvironmentVariable]:join(tmpdir(),"ignored environment root")}});
  assert.equal(resolution.resolvedPath,join(sourceRoot,"example-curriculum"));
  assert.match(resolution.sourceRootSelection,/explicit sourceRoot option/);
});

test("content package source resolution preserves legacy working-directory-relative behavior",()=>{
  const repositoryRoot=join(tmpdir(),"legacy-checkout","whacksmacker");
  const resolution=resolveContentPackageSourcePath("../dutch-curriculum",{repositoryRoot,env:{}});
  assert.equal(resolution.resolvedPath,resolve(repositoryRoot,"../dutch-curriculum"));
  assert.match(resolution.sourceRootSelection,/legacy process working directory/);
});

test("absolute package source paths take precedence over every source-root override",()=>{
  const absolute=join(tmpdir(),"absolute curriculum");
  const resolution=resolveContentPackageSourcePath(absolute,{repositoryRoot:"/ignored",sourceRoot:"also-ignored",env:{[contentPackageSourceRootEnvironmentVariable]:"ignored-too"}});
  assert.equal(resolution.resolvedPath,resolve(absolute));
  assert.equal(resolution.sourceRootSelection,"absolute sourcePath");
});

test("environment source roots are isolated to the supplied environment",()=>{
  const repositoryRoot=join(tmpdir(),"checkout"),environmentRoot=join(tmpdir(),"environment-root");
  const overridden=resolveContentPackageSourcePath("../linguistic-terminology",{repositoryRoot,env:{[contentPackageSourceRootEnvironmentVariable]:environmentRoot}});
  const legacy=resolveContentPackageSourcePath("../linguistic-terminology",{repositoryRoot,env:{}});
  assert.equal(overridden.resolvedPath,join(environmentRoot,"linguistic-terminology"));
  assert.equal(legacy.resolvedPath,resolve(repositoryRoot,"../linguistic-terminology"));
});

test("an empty explicit or environment source root fails clearly",()=>{
  assert.throws(()=>resolveContentPackageSourcePath("../example-curriculum",{sourceRoot:"  ",env:{}}),/explicit sourceRoot option.*must not be empty.*example-curriculum/iu);
  assert.throws(()=>resolveContentPackageSourcePath("../example-curriculum",{env:{[contentPackageSourceRootEnvironmentVariable]:""}}),/environment variable.*must not be empty.*example-curriculum/iu);
});

test("missing repositories report configured resolved and selected-root details",async()=>{
  const root=await mkdtemp(join(tmpdir(),"wsm-missing-source-")),output=join(root,"output");
  try{
    await assert.rejects(()=>generateContentPackage({targetId:"linguistic-terminology",outputDirectory:output,generatedAt:"2026-07-06T00:00:00Z",sourceRoot:root,env:{}}),error=>{
      assert.match(error.message,/Configured source path: "\.\.\/linguistic-terminology"/u);
      assert.match(error.message,new RegExp(`Resolved source path: "${escapeRegExp(join(root,"linguistic-terminology"))}"`,"u"));
      assert.match(error.message,/explicit sourceRoot option/);
      return true;
    });
  }finally{await rm(root,{recursive:true,force:true})}
});

test("missing expected files retain source-resolution context",async()=>{
  const root=await mkdtemp(join(tmpdir(),"wsm-incomplete-source-")),source=join(root,"linguistic-terminology"),output=join(root,"output");
  try{
    await mkdir(source,{recursive:true});
    await assert.rejects(()=>generateContentPackage({targetId:"linguistic-terminology",outputDirectory:output,generatedAt:"2026-07-06T00:00:00Z",sourceRoot:root,env:{}}),error=>{
      assert.match(error.message,/README\.md/u);
      assert.match(error.message,/Configured source path: "\.\.\/linguistic-terminology"/u);
      assert.match(error.message,new RegExp(escapeRegExp(source),"u"));
      return true;
    });
  }finally{await rm(root,{recursive:true,force:true})}
});

test("tracked generator implementation contains no user-home source default",async()=>{
  const source=await readFile("packages/core/content-package-generator.ts","utf8");
  assert.doesNotMatch(source,/\/home\/ashwin/u);
});

function escapeRegExp(value){return value.replace(/[.*+?^${}()|[\]\\]/gu,"\\$&")}
