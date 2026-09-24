import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { renderLanguageTreeRightPane, renderTwoPaneLanguageTree } from '../dist/apps/cli/interactive-menu.js';

const directory = new URL('../dist/apps/cli/content/japanese/chapter-013/', import.meta.url).pathname;

test('Japanese XIII: complete station-direction dialogue and approved presentation', async () => {
  const support = JSON.parse(await readFile(`${directory}/reading-support.json`, 'utf8'));
  const translation = JSON.parse(await readFile(`${directory}/reading-translation.en.json`, 'utf8'));
  const source = await readFile(`${directory}/chapter.md`, 'utf8');
  const dialogue = source.split('### Dialogue\n')[1].split('\n### ')[0].trim().split('\n').filter(Boolean).slice(1);

  assert.equal(dialogue.length, 12);
  assert.equal(translation.turns.length, 12);
  assert.deepEqual(new Set(translation.turns.map(turn => turn.speaker)), new Set(['佐藤あき', '山田浩司']));
  assert.ok(dialogue.every(line => /^(?:佐藤あき|山田浩司): /.test(line)));
  assert.ok(dialogue.filter(line => /(?:駅|あちら|右|左)へ行き/u.test(line)).length >= 4);
  assert.ok(source.includes('Pattern: [[grammar:place + へ + movement verb]]'));
  assert.equal((source.match(/^\| (?!Form \|)[^|-].* \|$/gmu) ?? []).length, 10);
  assert.ok((await readFile(`${directory}/media/scene.png`)).length > 1_000_000);

  for (const speaker of ['佐藤あき', '山田浩司']) {
    assert.ok(support.breakdown.normal.includes(`**${speaker}:`));
    assert.ok(support.breakdown.normal.includes(`Reading: ${speaker}:`));
    assert.ok(support.breakdown.normal.includes(`English: ${speaker}:`));
  }

  const node = {
    id: 'japanese:read:chapter-013',
    label: 'Chapter XIII — Which Way to the Station?',
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
    assert.equal(text.includes('orientation or goal'), displayMode === 'expert');
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

test('Japanese reading menu includes Chapter XIII after Chapter XII', async () => {
  const menu = await readFile(new URL('../apps/cli/interactive-menu.ts', import.meta.url), 'utf8');
  const twelve = menu.indexOf('Chapter XII — Borrowing a Book');
  const thirteen = menu.indexOf('Chapter XIII — Which Way to the Station?');
  assert.ok(twelve >= 0);
  assert.ok(thirteen > twelve);
});
