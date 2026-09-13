// Synthetic package data for application tests; never installed as curriculum.
import { mkdir, writeFile, copyFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { canonicalCastFixture, chapterParticipantFixture, dialogueChapterFixture } from './canonical-cast.mjs';
import { contentPackageGeneratorTargets, generateContentPackage } from '../../dist/packages/core/index.js';
export async function generateReadingFixture(options) {
  const target = contentPackageGeneratorTargets.find(t => t.id === options.targetId);
  if (!target || target.contentType !== 'language-curriculum') throw new Error('Expected reading fixture target');
  const root = await mkdtemp(join(tmpdir(), 'wsm-package-source-fixture-'));
  const slug = target.id.replace(/-curriculum$/, '');
  const source = join(root, target.id);
  try {
    for (const entry of target.include) {
      const path = join(source, entry);
      if (entry.includes('.')) {
        await mkdir(join(path, '..'), {recursive:true});
        await writeFile(path, entry.endsWith('.json') ? '{}' : `# ${target.displayName} test fixture\n`);
      } else await mkdir(path, {recursive:true});
    }
    for (const file of ['LICENSE-CONTENT', 'NOTICE']) await copyFile(new URL(`../../${file}`, import.meta.url), join(source, file));
    await writeFile(join(source, 'name-pools/canonical-cast.json'), JSON.stringify(canonicalCastFixture()));
    const chapter = join(source, `units/${slug}-core/chapter-001-basic-sentences-1`);
    await mkdir(chapter, {recursive:true});
    await writeFile(join(chapter, 'chapter.md'), dialogueChapterFixture(1, 'Chapter 1', 'Fixture text.'));
    await writeFile(join(chapter, 'chapter-participants.json'), JSON.stringify(chapterParticipantFixture(1)));
    await writeFile(join(source, 'vocabulary-forms.json'), JSON.stringify({canonicalTable:{headers:['Form','Meaning','Part of speech','Note'],arrow:'←'},displayRows:[],occurrences:[],review:{canonicalSenseIds:[],grammarIds:[]}}));
    execFileSync('git', ['init','-q',root]);
    execFileSync('git', ['-C',root,'-c','user.name=Fixture','-c','user.email=fixture@example.invalid','-c','commit.gpgsign=false','commit','--allow-empty','-qm','Synthetic package fixture']);
    return await generateContentPackage({...options, sourceRoot:root});
  } finally { await rm(root,{recursive:true,force:true}); }
}
