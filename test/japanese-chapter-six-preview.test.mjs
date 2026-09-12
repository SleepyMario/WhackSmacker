import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { renderLanguageTreeRightPane } from '../dist/apps/cli/interactive-menu.js';

const directory = new URL('../dist/apps/cli/content/japanese/chapter-006/', import.meta.url).pathname;
const node = { id: 'japanese:read:chapter-006', label: 'Chapter VI — Meeting Misaki', kind: 'message', authoredReadingDirectory: directory };

test('Chapter VI preserves its fifteen turns and independent support controls', async () => {
  const original = await readFile(`${directory}/chapter.md`, 'utf8');
  const turns = original.split('\n').filter(line => /^(佐藤あき|高橋蓮|伊藤美咲):/u.test(line));
  assert.equal(turns.length, 15);
  for (const displayMode of ['normal', 'expert']) {
    for (const translationsEnabled of [false, true]) {
      for (const breakdownEnabled of [false, true]) {
        const text = await renderLanguageTreeRightPane(node, { displayMode, translationsEnabled, breakdownEnabled, locale: 'en-US' });
        for (const turn of turns) assert.ok(text.includes(turn), `${displayMode}: lost ${turn}`);
        assert.equal(text.includes('Natural English Translation'), translationsEnabled);
        assert.equal(text.includes('Line-by-line Breakdown'), breakdownEnabled);
        assert.ok(text.includes('出身はどこですか。'));
        assert.ok(text.includes('勉強会はいつですか。'));
        assert.ok(!text.includes('### Written Exercise'));
      }
    }
  }
});
