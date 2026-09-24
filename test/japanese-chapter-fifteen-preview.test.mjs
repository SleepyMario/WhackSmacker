import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

import { renderLanguageTreeRightPane, renderTwoPaneLanguageTree } from '../dist/apps/cli/interactive-menu.js';

const directory = new URL('../dist/apps/cli/content/japanese/chapter-015/', import.meta.url).pathname;

test('Japanese XV: complete Yokohama riverside invitation dialogue and approved presentation', async () => {
  const support = JSON.parse(await readFile(`${directory}/reading-support.json`, 'utf8'));
  const translation = JSON.parse(await readFile(`${directory}/reading-translation.en.json`, 'utf8'));
  const source = await readFile(`${directory}/chapter.md`, 'utf8');
  const dialogue = source.split('### Dialogue\n')[1].split('\n### ')[0].trim().split('\n').filter((line) => /^[^\n:]+:\s+.+。$/u.test(line));

  assert.equal(dialogue.length, 16);
  assert.equal(translation.turns.length, 16);
  assert.ok(dialogue.every((line) => /。$/u.test(line)));
  assert.ok(dialogue.filter((line) => /ませんか。$/u.test(line)).length >= 5);
  assert.ok(dialogue.filter((line) => /ましょう。$/u.test(line)).length >= 6);
  assert.ok(source.includes('Pattern: [[grammar:verb stem + ませんか]]'));
  assert.equal((source.match(/^\| (?!Form \|)[^|-].* \|$/gmu) ?? []).length, 8);
  assert.ok((await readFile(`${directory}/media/scene.png`)).length > 1_000_000);
  assert.equal(support.canonicalGrammarIds[0], 'JPN-GRAMMAR-022');

  const node = {
    id: 'japanese:read:chapter-015',
    label: 'Chapter XV — Shall We Walk by the River?',
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
    for (const line of dialogue) assert.ok(text.includes(line), `${displayMode} lost: ${line}`);
    assert.ok(text.includes('Natural English Translation'));
    assert.ok(text.includes('Line-by-line Breakdown'));
    assert.ok(!text.includes('Exercises'));
    assert.equal(text.includes('pragmatically an invitation'), displayMode === 'expert');
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

test('Japanese reading menu closes the block with Chapter XV and Grammar XI - XV', async () => {
  const menu = await readFile(new URL('../apps/cli/interactive-menu.ts', import.meta.url), 'utf8');
  const fourteen = menu.indexOf('Chapter XIV — Kōji’s Train Journey');
  const fifteen = menu.indexOf('Chapter XV — Shall We Walk by the River?');
  const grammar = menu.indexOf('Grammar XI - XV');
  assert.ok(fourteen >= 0);
  assert.ok(fifteen > fourteen);
  assert.ok(grammar > fifteen);
});
