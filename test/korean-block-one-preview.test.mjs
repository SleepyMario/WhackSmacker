import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { renderLanguageTreeRightPane, renderTwoPaneLanguageTree } from '../dist/apps/cli/interactive-menu.js';
import { generateContentPackage } from '../dist/packages/core/content-package-generator.js';

for (const [number, count] of [['003', 12], ['004', 9], ['005', 10]]) {
  test(`Korean ${number}: complete reading, independent translation/breakdown/Hanja and artwork`, async () => {
    const directory = new URL(`../dist/apps/cli/content/korean/chapter-${number}/`, import.meta.url).pathname;
    const source = await readFile(`${directory}/chapter.md`, 'utf8');
    const mode = number === '004' ? 'Narrative' : 'Dialogue';
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
        assert.ok(coloured.includes('\x1b[36m'));
        assert.ok(coloured.includes('\x1b[33m'));
        if (mode === 'Dialogue') {
          const support = JSON.parse(await readFile(`${directory}/reading-support.json`, 'utf8'));
          for (const speaker of ['김민지', '박서연']) for (const label of ['Reading', 'English']) assert.ok(support.breakdown.normal.includes(`${label}: ${speaker}:`));
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

test('portable Korean reading package retains every chapter scene with its source checksum', async () => {
  const outputDirectory = await mkdtemp(join(tmpdir(), 'korean-scene-package-'));
  try {
    const result = await generateContentPackage({ targetId: 'korean-curriculum', outputDirectory, generatedAt: '2026-09-12T12:00:00Z' });
    const scenes = result.manifest.files.filter(file => /\/media\/scene\.png$/u.test(file.path));
    assert.equal(scenes.length, 5);
    for (const scene of scenes) {
      const bytes = await readFile(new URL(`../../korean-curriculum/${scene.path}`, import.meta.url));
      assert.equal(scene.sha256, createHash('sha256').update(bytes).digest('hex'));
      assert.equal(scene.size, bytes.length);
    }
  } finally { await rm(outputDirectory, { recursive: true, force: true }); }
});
