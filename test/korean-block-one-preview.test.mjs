import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { renderLanguageTreeRightPane, renderTwoPaneLanguageTree } from '../dist/apps/cli/interactive-menu.js';
import { generateContentPackage } from '../dist/packages/core/content-package-generator.js';

for (const [number, count] of [['003', 12], ['004', 9], ['005', 10], ['006', 10], ['007', 12], ['008', 12], ['009', 14], ['010', 12]]) {
  test(`Korean ${number}: complete reading, independent translation/breakdown/Hanja and artwork`, async () => {
    const directory = new URL(`../dist/apps/cli/content/korean/chapter-${number}/`, import.meta.url).pathname;
    const source = await readFile(`${directory}/chapter.md`, 'utf8');
    const mode = Number(number) % 2 === 0 ? 'Narrative' : 'Dialogue';
    const primary = source.split(`### ${mode}\n`)[1].split('\n### ')[0].trim().split('\n\n').slice(1).join('\n\n');
    const lines = primary.split('\n').filter(Boolean);
    assert.equal(lines.length, count);
    const sentences = [...new Intl.Segmenter('ko', { granularity: 'sentence' }).segment(primary)];
    assert.ok(sentences.length >= 6);
    const node = { id: `korean:read:${number}`, label: `Chapter ${number}`, kind: 'message', packageId: 'com.sleepymario.language.korean', authoredReadingDirectory: directory, previewArtworkPath: `${directory}/media/scene.png` };
    assert.ok((await readFile(node.previewArtworkPath)).length > 1000);
    for (const displayMode of ['normal', 'expert']) for (const translationsEnabled of [false, true]) for (const breakdownEnabled of [false, true]) for (const charactersEnabled of [false, true]) {
      const text = await renderLanguageTreeRightPane(node, { displayMode, translationsEnabled, breakdownEnabled, charactersEnabled, locale: 'en-US' });
      for (const line of lines) assert.ok(text.includes(line), `Missing primary line ${line}`);
      assert.equal(text.includes('Natural English Translation'), translationsEnabled);
      assert.equal(text.includes('Line-by-line Breakdown'), breakdownEnabled);
      assert.equal(text.includes('Sino-Korean Vocabulary'), charactersEnabled);
      if (charactersEnabled) assert.ok(text.indexOf('Sino-Korean Vocabulary') > text.indexOf('New Vocabulary'));
      const render = color => renderTwoPaneLanguageTree(node, new Set(), 0, text, color, 0, 1600, 'en-US', 'navigation', 240, 0, displayMode);
      const coloured = render(true), plain = render(false);
      // Styled phrases wrap as units; plain output may wrap within them.
      // Compare all visible content independently of frame and wrap spacing.
      const visible = value => value.replace(/\x1b\[[0-9;]*m/gu, '').replace(/[|+\-\s]/gu, '');
      assert.equal(visible(coloured), visible(plain));
      assert.ok(!plain.includes('[[grammar:'));
      assert.ok(coloured.includes('\x1b[34m'));
      if (breakdownEnabled) {
        assert.ok(coloured.includes('\x1b[38;5;213m'));
        assert.ok(coloured.includes('\x1b[33m'));
        if (mode === 'Dialogue') {
          const support = JSON.parse(await readFile(`${directory}/reading-support.json`, 'utf8'));
          for (const speaker of (['007','009'].includes(number) ? ['최도윤', '박서연'] : ['김민지', '박서연'])) for (const label of ['English']) assert.ok(support.breakdown.normal.includes(`${label}: ${speaker}:`));
        }
      }
    }
  });
}

test('Korean Grammar I-V selects one version with the same five patterns and fifteen examples', async () => {
  const versions = ['easy', 'hard'];
  const coverage = await Promise.all(versions.map(async v => JSON.parse(await readFile(new URL(`../../korean-curriculum/units/korean-core/chapter-001-005-grammar-${v}/coverage.json`, import.meta.url), 'utf8'))));
  assert.deepEqual(coverage[0].grammarIds, coverage[1].grammarIds);
  assert.deepEqual(coverage[0].examples, coverage[1].examples);
  assert.equal(coverage[0].grammarIds.length, 5);
  assert.equal(coverage[0].examples.length, 15);
  const node = { id: 'korean:grammar:001-005', label: 'Grammar I - V', kind: 'message', authoredGrammarPaths: versions.map(v => new URL(`../dist/apps/cli/content/korean/grammar-001-005-${v}.md`, import.meta.url).pathname) };
  for (const displayMode of ['normal', 'expert']) {
    const text = await renderLanguageTreeRightPane(node, { displayMode, locale: 'en-US' });
    assert.equal((text.match(/^### /gm) ?? []).length, 5);
    assert.equal(text.includes('The dictionary form is'), true);
    assert.equal(text.includes('Recoverable discourse arguments'), displayMode === 'expert');
    for (const e of coverage[0].examples) assert.ok(text.includes(e.example));
    assert.ok(!/KOR-GRAMMAR-|CAST-/.test(text));
  }
});

test('Korean Chapter I-V Review distinguishes dictionary and taught inflected predicate forms', async () => {
  const path = new URL('../review-content/korean/review-decks/chapter-001-005/cards.tsv', import.meta.url);
  const lines = (await readFile(path, 'utf8')).trimEnd().split('\n');
  const rows = lines.slice(1).map(line => line.split('\t'));
  const answers = value => JSON.parse(value.startsWith('"') && value.endsWith('"')
    ? value.slice(1, -1).replaceAll('""', '"')
    : value);
  const lookup = (promptLanguage, prompt) => rows.find(row => row[4] === promptLanguage && row[6] === prompt);
  const expected = [
    ['ko', '반갑다', ['to be glad; to be pleased']],
    ['en', 'to be glad; to be pleased', ['반갑다']],
    ['ko', '반갑습니다', ['pleased to meet you (deferential)']],
    ['en', 'pleased to meet you (deferential)', ['반갑습니다']],
    ['ko', '감사하다', ['to thank']],
    ['en', 'to thank', ['감사하다']],
    ['ko', '감사합니다', ['thank you (deferential)']],
    ['en', 'thank you (deferential)', ['감사합니다']]
  ];
  assert.equal(rows.length, 72);
  for (const [language, prompt, accepted] of expected) {
    const row = lookup(language, prompt);
    assert.ok(row, `missing ${prompt}`);
    assert.deepEqual(answers(row[7]), accepted);
  }
});

test('Korean Chapter VI-X Review distinguishes dictionary and taught polite predicate forms', async () => {
  const path = new URL('../review-content/korean/review-decks/chapter-006-010/cards.tsv', import.meta.url);
  const lines = (await readFile(path, 'utf8')).trimEnd().split('\n');
  const rows = lines.slice(1).map(line => line.split('\t'));
  const answers = value => JSON.parse(value.startsWith('"') && value.endsWith('"')
    ? value.slice(1, -1).replaceAll('""', '"')
    : value);
  const lookup = (promptLanguage, prompt) => rows.find(row => row[4] === promptLanguage && row[6] === prompt);
  const forms = [
    ['좋아하다', 'to like', '좋아해요', 'like (polite)'],
    ['좋다', 'to be good', '좋아요', 'good; sounds good (polite)'],
    ['만들다', 'to make', '만들어요', 'make (polite)'],
    ['먹다', 'to eat', '먹어요', 'eat (polite)'],
    ['있다', 'to be present; to be available', '있어요', 'be present; be available (polite)'],
    ['없다', 'to be absent; to be unavailable', '없어요', 'be absent; be unavailable (polite)'],
    ['쉬다', 'to rest; to take a break', '쉬어요', 'rest; take a break (polite)'],
    ['마시다', 'to drink', '마셔요', 'drink (polite)'],
    ['읽다', 'to read', '읽어요', 'read (polite)'],
    ['보다', 'to look at; to see', '봐요', 'look at; see (polite)'],
    ['이야기하다', 'to talk; to converse', '이야기해요', 'talk; converse (polite)']
  ];
  assert.equal(rows.length, 98);
  for (const [dictionary, infinitive, inflected, politeMeaning] of forms) {
    for (const [language, prompt, accepted] of [
      ['ko', dictionary, [infinitive]],
      ['en', infinitive, [dictionary]],
      ['ko', inflected, [politeMeaning]],
      ['en', politeMeaning, [inflected]]
    ]) {
      const row = lookup(language, prompt);
      assert.ok(row, `missing ${prompt}`);
      assert.deepEqual(answers(row[7]), accepted);
    }
  }
});

test('portable Korean reading package retains every chapter scene with its source checksum', async () => {
  const outputDirectory = await mkdtemp(join(tmpdir(), 'korean-scene-package-'));
  try {
    const result = await generateContentPackage({ targetId: 'korean-curriculum', outputDirectory, generatedAt: '2026-09-12T12:00:00Z' });
    const scenes = result.manifest.files.filter(file => /\/media\/scene\.png$/u.test(file.path));
    assert.equal(scenes.length, 10);
    for (const scene of scenes) {
      const bytes = await readFile(new URL(`../../korean-curriculum/${scene.path}`, import.meta.url));
      assert.equal(scene.sha256, createHash('sha256').update(bytes).digest('hex'));
      assert.equal(scene.size, bytes.length);
    }
  } finally { await rm(outputDirectory, { recursive: true, force: true }); }
});

test('reading discovery selects the newest retained revision once without changing the registry', async () => {
  const { generateLocalContentPackageCatalogue } = await import('../dist/packages/core/index.js');
  const { installContentPackage } = await import('../dist/packages/core/content-package-manager.js');
  const { listInstalledReadablePackages } = await import('../dist/packages/core/content-package-reader.js');
  const { cp, writeFile, chmod } = await import('node:fs/promises');
  const root = await mkdtemp(join(tmpdir(), 'korean-revisions-'));
  try {
    const packages = join(root, 'packages'), dataDir = join(root, 'data'), cataloguePath = join(root, 'catalogue.json');
    await generateContentPackage({ targetId: 'korean-curriculum', outputDirectory: packages, generatedAt: '2026-09-12T00:00:00Z' });
    await generateLocalContentPackageCatalogue({ packagesDirectory: packages, outputPath: cataloguePath, generatedAt: '2026-09-12T00:00:00Z' });
    await installContentPackage({ cataloguePath, dataDir, packageId: 'com.sleepymario.language.korean', installedAt: '2026-09-12T00:00:00Z' });
    const path = join(dataDir, 'registry.json');
    const registry = JSON.parse(await readFile(path, 'utf8'));
    const record = registry.packages[0];
    const newer = { ...record, artifactRevision: record.artifactRevision + 1, installPath: record.installPath + '-newer' };
    await cp(join(dataDir, record.installPath), join(dataDir, newer.installPath), { recursive: true });
    const manifestPath = join(dataDir, newer.installPath, 'manifest.json');
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
    manifest.displayName = 'Current Korean Curriculum';
    manifest.artifactRevision = newer.artifactRevision;
    await chmod(manifestPath, 0o600);
    await writeFile(manifestPath, JSON.stringify(manifest));
    registry.packages.push(newer);
    const before = JSON.stringify(registry);
    await writeFile(path, before);
    const found = await listInstalledReadablePackages(dataDir);
    assert.equal(found.length, 1);
    assert.equal(found[0].displayName, 'Current Korean Curriculum');
    assert.equal(await readFile(path, 'utf8'), before);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('all Korean breakdowns use aligned coloured original/translation pairs without visible labels', async () => {
  for (const number of ['001','002','003','004','005','006','007','008','009','010']) {
    const directory=new URL(`../dist/apps/cli/content/korean/chapter-${number}/`,import.meta.url).pathname;
    const support=JSON.parse(await readFile(join(directory,'reading-support.json'),'utf8'));
    for(const mode of ['normal','expert']) {
      assert.ok(!support.breakdown[mode].includes('Reading:'));
      const node={id:'ko-pairs',label:'Korean',kind:'message'};
      // Plain numbered originals must work too; bold is presentation, not identity.
      const text='### Line-by-line Breakdown\n\n'+support.breakdown[mode].replaceAll('**','');
      for(const spacing of ['compact','separated']) {
        const rendered=renderTwoPaneLanguageTree(node,new Set(),0,text,true,0,250,'en-US','navigation',180,0,mode,false,true,false,false,true,spacing);
        assert.ok(!rendered.includes('Reading:'));assert.ok(!rendered.includes('English:'));
        assert.ok(rendered.includes('\x1b[38;5;213m 1. '));
        assert.ok(rendered.includes('\x1b[33m    '));
        const lines=rendered.split('\n');const original=lines.findIndex(l=>l.includes('\x1b[38;5;213m 1. '));
        if(spacing==='compact')assert.ok(lines[original+1].includes('\x1b[33m    '));
      }
    }
  }
});

test('Korean Grammar VI-X selects the intended explanation depth and preserves paired example colours', async () => {
  const versions=['easy','hard'];
  const coverage=await Promise.all(versions.map(async v=>JSON.parse(await readFile(new URL(`../../korean-curriculum/units/korean-core/chapter-006-010-grammar-${v}/coverage.json`,import.meta.url),'utf8'))));
  assert.deepEqual(coverage[0],coverage[1]);assert.equal(coverage[0].examples.length,15);
  assert.deepEqual(coverage[0].grammarIds,['006','007','010','011','012'].map(n=>'KOR-GRAMMAR-'+n));
  const node={id:'korean:grammar:006-010',label:'Grammar VI - X',kind:'message',authoredGrammarPaths:versions.map(v=>new URL(`../dist/apps/cli/content/korean/grammar-006-010-${v}.md`,import.meta.url).pathname)};
  for(const displayMode of ['normal','expert']) {
    const text=await renderLanguageTreeRightPane(node,{displayMode,locale:'en-US'});
    assert.equal((text.match(/^### /gm)||[]).length,5);
    assert.equal(text.includes('source/starting-point use'),displayMode==='expert');
    assert.ok(!/KOR-GRAMMAR-|CAST-|Reading:/.test(text));
    for(const e of coverage[0].examples) assert.ok(text.includes(e.example));
    const output=renderTwoPaneLanguageTree(node,new Set(),0,text,true,0,1600,'en-US','navigation',240,0,displayMode);
    assert.ok(output.includes('\x1b[34m'));
    assert.ok(output.includes('\x1b[38;5;213m'));
    assert.ok(output.includes('\x1b[33m'));
  }
});
