import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getInstalledLanguageCurriculum, readInstalledLanguageCurriculumChapter } from "../dist/packages/core/content-package-reader.js";

test("curriculum view exposes only numerically ordered learner chapters and exact versions", async()=>{
  const fixture=await curriculumFixture();
  try{
    const view=await getInstalledLanguageCurriculum(fixture.packageId,"1.0.0","en",fixture.dataDir);
    assert.equal(view.packageVersion,"1.0.0");
    assert.equal(view.overlayStatus,"active");
    assert.equal(view.effectiveSourceLocale,"en");
    assert.deepEqual(view.chapters.map(x=>x.number),[9,10,11,1]);
    assert.deepEqual(view.chapters.map(x=>x.title),["Chapter Nine","Chapter Ten","Chapter Eleven","Introduction"]);
    assert.ok(view.chapters.every(x=>x.packageVersion==="1.0.0"));
    assert.equal(view.chapters.some(x=>/json|summary|tsv/iu.test(x.path)),false);
    await assert.rejects(()=>getInstalledLanguageCurriculum(fixture.packageId,"9.9.9","en",fixture.dataDir),/not found/iu);
  }finally{await fixture.cleanup()}
});

test("overlay compatibility is explicit and chapter reads use the resolved exact-version overlay",async()=>{
  const fixture=await curriculumFixture();
  try{
    const english=await readInstalledLanguageCurriculumChapter({dataDir:fixture.dataDir,packageId:fixture.packageId,packageVersion:"1.0.0",chapterId:"units/core/chapter-010-ten/chapter.md",requestedSourceLocale:"en"});
    assert.match(english.text,/English overlay ten/);
    assert.equal(english.curriculum.overlayStatus,"active");
    const missingEnglishChapter=await readInstalledLanguageCurriculumChapter({dataDir:fixture.dataDir,packageId:fixture.packageId,packageVersion:"1.0.0",chapterId:"units/core/chapter-009-nine/chapter.md",requestedSourceLocale:"en"});
    assert.equal(missingEnglishChapter.curriculum.overlayStatus,"missing");
    assert.equal(missingEnglishChapter.curriculum.effectiveSourceLocale,undefined);
    assert.match(missingEnglishChapter.text,/Base nine/);
    const chinese=await getInstalledLanguageCurriculum(fixture.packageId,"1.0.0","zh-TW",fixture.dataDir);
    assert.equal(chinese.overlayStatus,"fallback");
    assert.equal(chinese.effectiveSourceLocale,"en");
    assert.equal(chinese.chapters.find(x=>x.id==="units/core/chapter-009-nine/chapter.md")?.title,"第九章");
    const newer=await getInstalledLanguageCurriculum(fixture.packageId,"2.0.0","en",fixture.dataDir);
    assert.equal(newer.overlayStatus,"incompatible");
    await writeFile(join(fixture.dataDir,"packages","com.example.language.test.source.en","1.0.0","content","content.json"),"{broken");
    await assert.rejects(()=>getInstalledLanguageCurriculum(fixture.packageId,"1.0.0","en",fixture.dataDir),/overlay content is corrupt/iu);
  }finally{await fixture.cleanup()}
});

async function curriculumFixture(){
  const root=await mkdtemp(join(tmpdir(),"wsm-web-reader-")),dataDir=join(root,"content"),packageId="com.example.language.test",records=[];
  for(const version of ["1.0.0","2.0.0"]){
    const files=[
      file("units/core/chapter-009-nine/chapter.md",{en:"# Chapter Nine\n\nBase nine.","zh-TW":"# 第九章\n\n第九章內容。"}),
      file("units/core/chapter-010-ten/chapter.md","# Chapter Ten\n\nBase ten."),
      file("units/core/chapter-011-eleven/chapter.md","# Chapter Eleven\n\nBase eleven."),
      file("units/introduction/chapter-01-start/README.md","# Introduction\n\nStart here."),
      file("units/core/chapter-012-summary/summary.md","# Summary"),file("metadata.json","{}","application/json"),file("review/cards.tsv","x","text/tab-separated-values")
    ];
    records.push(await writePackage(dataDir,{packageId,version,contentType:"language-curriculum",displayName:"Test Curriculum",localization:{role:"base-curriculum",schemaVersion:"1.0.0",targetLanguage:"nl",defaultSourceLocale:"en",defaultSourcePackageId:"com.example.language.test.source.en"},files}));
  }
  records.push(await writePackage(dataDir,{packageId:"com.example.language.test.source.en",version:"1.0.0",contentType:"curriculum-source-language-pack",displayName:"English",localization:{role:"source-language-pack",schemaVersion:"1.0.0",basePackageId:packageId,sourceLocale:"en",targetLanguage:"nl",compatibleBaseVersion:">=1.0.0 <2.0.0"},files:[file("units/core/chapter-010-ten/chapter.md","# Chapter Ten\n\nEnglish overlay ten.")]}));
  records.push(await writePackage(dataDir,{packageId:"com.example.language.test.source.zh",version:"1.0.0",contentType:"curriculum-source-language-pack",displayName:"Chinese",localization:{role:"source-language-pack",schemaVersion:"1.0.0",basePackageId:packageId,sourceLocale:"zh-TW",targetLanguage:"nl",compatibleBaseVersion:">=3.0.0 <4.0.0"},files:[file("units/core/chapter-010-ten/chapter.md","不應使用")]}));
  await mkdir(dataDir,{recursive:true});await writeFile(join(dataDir,"registry.json"),JSON.stringify({registryFormatVersion:1,updatedAt:"2026-07-12T00:00:00Z",packages:records}));
  return{root,dataDir,packageId,cleanup:()=>rm(root,{recursive:true,force:true})};
}
function file(path,text,mediaType="text/markdown"){return{path,mediaType,text}}
async function writePackage(dataDir,options){const installPath=`packages/${options.packageId}/${options.version}`,root=join(dataDir,installPath),snapshot={contentSchema:"whacksmacker-source-markdown-snapshot-v1",defaultContentLocale:"en",localizedPaths:options.files.map(x=>x.path),files:options.files};await mkdir(join(root,"content"),{recursive:true});await writeFile(join(root,"content","content.json"),JSON.stringify(snapshot));const manifest={packageFormatVersion:1,packageId:options.packageId,packageVersion:options.version,displayName:options.displayName,description:"Fixture",contentType:options.contentType,contentSchemaVersion:"1.0.0",minimumWhackSmackerVersion:"0.0.1",source:{repository:"https://example.invalid/repo",commit:"0000000000000000000000000000000000000000"},generatedAt:"2026-07-12T00:00:00Z",generator:{name:"test",version:"1.0.0"},entryPoints:[{id:"primary",mediaType:"application/json",path:"content/content.json",role:"primary"}],files:[{path:"content/content.json",mediaType:"application/json",size:1,sha256:"0".repeat(64)}],localization:options.localization};await writeFile(join(root,"manifest.json"),JSON.stringify(manifest));return{packageId:options.packageId,packageVersion:options.version,displayName:options.displayName,contentType:options.contentType,contentSchemaVersion:"1.0.0",minimumWhackSmackerVersion:"0.0.1",source:manifest.source,installedAt:"2026-07-12T00:00:00Z",installPath,manifestSha256:"0".repeat(64),archiveSha256:"1".repeat(64),archiveSize:1,catalogueId:"test"}}
