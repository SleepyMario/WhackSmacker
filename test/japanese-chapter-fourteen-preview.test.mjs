import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { renderLanguageTreeRightPane, renderTwoPaneLanguageTree } from '../dist/apps/cli/interactive-menu.js';

const directory = new URL('../dist/apps/cli/content/japanese/chapter-014/', import.meta.url).pathname;

test('Japanese XIV: complete Yokohama train narrative and approved presentation', async () => {
  const support = JSON.parse(await readFile(`${directory}/reading-support.json`, 'utf8'));
  const translation = JSON.parse(await readFile(`${directory}/reading-translation.en.json`, 'utf8'));
  const source = await readFile(`${directory}/chapter.md`, 'utf8');
  const narrative = source.split('### Narrative\n')[1].split('\n### ')[0].trim().split('\n').filter((line) => /。$/u.test(line));

  assert.equal(narrative.length, 12);
  assert.equal(translation.sentences.length, 12);
  assert.ok(narrative.every((line) => /。$/u.test(line)));
  assert.ok(narrative.filter((line) => /(?:七時|駅|電車|横浜|公園|家)に/u.test(line)).length >= 6);
  assert.ok(source.includes('Pattern: [[grammar:N + に + predicate]]'));
  assert.equal((source.match(/^\| (?!Form \|)[^|-].* \|$/gmu) ?? []).length, 12);
  assert.ok((await readFile(`${directory}/media/scene.png`)).length > 1_000_000);
  assert.equal(support.canonicalGrammarIds[0], 'JPN-GRAMMAR-012');

  const node = {
    id: 'japanese:read:chapter-014',
    label: 'Chapter XIV — Kōji’s Train Journey',
    kind: 'message',
    authoredReadingDirectory: directory,
    previewArtworkPath: `${directory}/media/scene.png`
  };
  for (const displayMode of ['normal', 'expert']) {
    const text = await renderLanguageTreeRightPane(node, {
      displayMode,
      translationsEnabled: true,
      breakdownEnabled: true,
      locale: 'en-US'
    });
    for (const line of narrative) assert.ok(text.includes(line), `${displayMode} lost: ${line}`);
    assert.ok(text.includes('Natural English Translation'));
    assert.ok(text.includes('Line-by-line Breakdown'));
    assert.ok(!text.includes('Exercises'));
    assert.equal(text.includes('predicate-selected goal'), displayMode === 'expert');
    const coloured = renderTwoPaneLanguageTree(node, new Set(), 0, text, true, 0, 1600, 'en-US', 'navigation', 240, 0, displayMode);
    const plain = renderTwoPaneLanguageTree(node, new Set(), 0, text, false, 0, 1600, 'en-US', 'navigation', 240, 0, displayMode);
    assert.equal(coloured.replace(/\x1b\[[0-9;]*m/gu, ''), plain);
    assert.ok(!plain.includes('Reading:'));
    assert.ok(!plain.includes('English:'));
    assert.ok(coloured.includes('\x1b[34m'));
    assert.ok(coloured.includes('\x1b[36m'));
    assert.ok(coloured.includes('\x1b[33m'));
  }
});

test('Japanese reading menu includes Chapter XIV after Chapter XIII', async () => {
  const menu = await readFile(new URL('../apps/cli/interactive-menu.ts', import.meta.url), 'utf8');
  const thirteen = menu.indexOf('Chapter XIII — Which Way to the Station?');
  const fourteen = menu.indexOf('Chapter XIV — Kōji’s Train Journey');
  assert.ok(thirteen >= 0);
  assert.ok(fourteen > thirteen);
});
