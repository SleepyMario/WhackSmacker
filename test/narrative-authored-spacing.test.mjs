import assert from 'node:assert/strict';
import { test } from 'node:test';
import { renderLanguageTreeRightPane, renderTwoPaneLanguageTree } from '../dist/apps/cli/interactive-menu.js';

for (const number of ['002', '004']) {
  test(`Vietnamese ${number}: narrative and translation obey Spaces without losing boundaries`, async () => {
    const directory = new URL(`../dist/apps/cli/content/vietnamese/chapter-${number}/`, import.meta.url).pathname;
    const node = { id: `vietnamese:read:${number}`, label: `Chapter ${number}`, kind: 'message', authoredReadingDirectory: directory };
    for (const mode of ['normal', 'expert']) {
      const text = await renderLanguageTreeRightPane(node, { locale: 'en-US', displayMode: mode, translationsEnabled: true });
      const narrative = text.split('### Narrative\n')[1].split('\n### ')[0].trim().split(/\n\s*\n/u);
      const translation = text.split(/### (?:Natural English Translation|English translation)\n/u)[1].split('\n### ')[0].trim().split(/\n+/u);
      assert.ok(narrative.length >= 7);
      for (const spacing of ['separated', 'compact', 'separated', 'compact']) {
        const rows = renderTwoPaneLanguageTree(node, new Set(), 0, text, true, 0, 1600,
          'en-US', 'navigation', 320, 0, mode, true, false, false, false, true, spacing)
          .replace(/\x1b\[[0-9;]*m/gu, '').split('\n');
        for (const units of [narrative.slice(1), translation]) {
          let previous = -1;
          for (const unit of units) {
            const index = rows.findIndex((row, i) => i > previous && row.includes(unit.trim()));
            assert.ok(index >= 0, `Missing ${unit}`);
            if (previous >= 0) assert.equal(index - previous, spacing === 'compact' ? 1 : 2);
            previous = index;
          }
        }
        const first = rows.findIndex(row => row.includes(narrative[1]));
        assert.ok(/^[ |]*$/u.test(rows[first - 1]), 'Keep the introduction boundary');
        const last = rows.findIndex(row => row.includes(narrative.at(-1)));
        assert.ok(/^[ |]*$/u.test(rows[last + 1]), 'Keep the next section boundary');
      }
    }
  });
}
