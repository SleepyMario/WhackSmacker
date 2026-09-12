import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { renderLanguageTreeRightPane } from '../dist/apps/cli/interactive-menu.js';
const directory = new URL('../dist/apps/cli/content/japanese/chapter-001/', import.meta.url).pathname;
const node = { id: 'japanese:read:chapter-001', label: 'Chapter I — A First Meeting', kind: 'message', authoredReadingDirectory: directory };

test('Chapter I preserves its eight turns across audience modes and independent support toggles', async () => {
  const original = await readFile(`${directory}/chapter.md`, 'utf8');
  const turns = original.split('\n').filter(line => /^(高橋蓮|中村ゆき):/u.test(line));
  assert.equal(turns.length, 8);
  for (const displayMode of ['normal', 'expert', 'developer']) {
    for (const translationsEnabled of [false, true]) {
      for (const breakdownEnabled of [false, true]) {
        const text = await renderLanguageTreeRightPane(node, { displayMode, translationsEnabled, breakdownEnabled, locale: 'en-US' });
        for (const turn of turns) assert.ok(text.includes(turn), `${displayMode}: lost ${turn}`);
        assert.equal(text.includes('Natural English Translation'), translationsEnabled);
        assert.equal(text.includes('Line-by-line Breakdown'), breakdownEnabled);
        assert.ok(text.includes('大学生です。'));
        assert.ok(text.includes('教師です。'));
        assert.ok(text.includes('### Grammar'));
        assert.ok(!text.includes('### Written Exercise'));
        assert.ok(!text.includes('### Model Answer'));
        if (displayMode !== 'developer') assert.ok(!text.includes('JPN-GRAMMAR-001'));
      }
    }
  }
});

test('Chapter I has six lexical entries, full readings and no embedded exercises or answers', async () => {
  const text = await readFile(`${directory}/chapter.md`, 'utf8');
  const table = text.split('### New Vocabulary')[1].split('### Grammar')[0];
  const rows = table.split('\n').filter(line => line.startsWith('|') && !line.startsWith('|---') && !line.startsWith('| Form'));
  assert.equal(rows.length, 6);
  assert.ok(table.includes('大学生 | だいがくせい'));
  assert.ok(table.includes('教師 | きょうし'));
  assert.ok(table.includes('よろしくお願いします | よろしくおねがいします'));
  assert.ok(!table.includes('| です'));
  assert.ok(!/^### (?:Written Exercise|Simple Exercises|Model Answer|Answer Key)$/mu.test(text));
});
