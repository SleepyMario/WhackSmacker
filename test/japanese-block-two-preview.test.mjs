import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { renderLanguageTreeRightPane, renderTwoPaneLanguageTree } from '../dist/apps/cli/interactive-menu.js';

for (const [n, count] of [['008', 10], ['009', 12], ['010', 8]]) {
  test(`Japanese ${n}: preserves complete reading, independent toggles, artwork and colours`, async () => {
    const directory = new URL(`../dist/apps/cli/content/japanese/chapter-${n}/`, import.meta.url).pathname;
    const support = JSON.parse(await readFile(`${directory}/reading-support.json`, 'utf8'));
    const source = await readFile(`${directory}/chapter.md`, 'utf8');
    const type = n === '009' ? 'Dialogue' : 'Narrative';
    const lines = source.split(`### ${type}\n`)[1].split('\n### ')[0].trim().split('\n').filter(Boolean).slice(1);
    assert.equal(lines.length, count);
    const sentences = lines.flatMap(line => [...new Intl.Segmenter('ja', { granularity: 'sentence' }).segment(line.replace(/^[^:]+: /, ''))]);
    assert.ok(sentences.length >= 6);
    assert.ok(lines.some(line => line.includes('伊藤美咲')));
    const node = { id: `japanese:read:chapter-${n}`, label: `Chapter ${n}`, kind: 'message', authoredReadingDirectory: directory, previewArtworkPath: `${directory}/media/scene.png` };
    assert.ok((await readFile(node.previewArtworkPath)).length > 1000);
    for (const displayMode of ['normal', 'expert']) for (const translationsEnabled of [false, true]) for (const breakdownEnabled of [false, true]) {
      const text = await renderLanguageTreeRightPane(node, { displayMode, translationsEnabled, breakdownEnabled, locale: 'en-US' });
      for (const line of lines) assert.ok(text.includes(line), `${displayMode} lost: ${line}`);
      assert.equal(text.includes('Natural English Translation'), translationsEnabled);
      assert.equal(text.includes('Line-by-line Breakdown'), breakdownEnabled);
      assert.ok(!text.includes('Exercises'));
      const render = color => renderTwoPaneLanguageTree(node, new Set(), 0, text, color, 0, 1600, 'en-US', 'navigation', 240, 0, displayMode);
      const coloured = render(true), plain = render(false);
      assert.equal(coloured.replace(/\x1b\[[0-9;]*m/gu, ''), plain);
      assert.ok(!plain.includes('[[grammar:'));
      assert.ok(coloured.includes('\x1b[34m'));
      if (breakdownEnabled) {
        assert.ok(coloured.includes('\x1b[36m'));
        assert.ok(coloured.includes('\x1b[33m'));
        if (n === '009') for (const speaker of ['高橋蓮', '伊藤美咲']) assert.ok(support.breakdown.normal.includes(`Reading: ${speaker}:`));
      }
    }
  });
}

test('Grammar VI-X has paired scope and examples; view selects one authored version', async () => {
  const coverage = await Promise.all(['easy', 'hard'].map(async v => JSON.parse(await readFile(new URL(`../../japanese-curriculum/units/japanese-core/chapter-006-010-grammar-${v}/coverage.json`, import.meta.url), 'utf8'))));
  assert.deepEqual(coverage[0].grammarIds, coverage[1].grammarIds);
  assert.deepEqual(coverage[0].examples, coverage[1].examples);
  assert.equal(coverage[0].grammarIds.length, 5);
  assert.equal(coverage[0].examples.length, 15);
  const node = { id: 'grammar-006-010', label: 'Grammar VI - X', kind: 'message', authoredGrammarPaths: ['easy', 'hard'].map(v => new URL(`../dist/apps/cli/content/japanese/grammar-006-010-${v}.md`, import.meta.url).pathname) };
  for (const displayMode of ['normal', 'expert']) {
    const text = await renderLanguageTreeRightPane(node, { displayMode, locale: 'en-US' });
    assert.equal((text.match(/^### /gm) ?? []).length, 5);
    assert.equal(text.includes('Put a question word where the answer belongs.'), displayMode === 'normal');
    assert.equal(text.includes('Content interrogatives remain'), displayMode === 'expert');
    for (const { example } of coverage[0].examples) assert.ok(text.includes(example));
    assert.ok(!/JPN-GRAMMAR-|CAST-/.test(text));
  }
});
