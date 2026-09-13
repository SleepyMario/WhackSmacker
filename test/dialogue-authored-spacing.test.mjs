import assert from 'node:assert/strict';
import { test } from 'node:test';
import { renderLanguageTreeRightPane, renderTwoPaneLanguageTree } from '../dist/apps/cli/interactive-menu.js';

function render(node, text, spacing) {
  return renderTwoPaneLanguageTree(node, new Set(), 0, text, true, 0, 1600,
    'en-US', 'navigation', 240, 0, 'normal', true, false, false, false, true, spacing)
    .split('\n');
}

for (const n of ['001', '003', '005']) {
  test(`Vietnamese ${n}: authored speaker gaps obey Spaces in both directions`, async () => {
    const directory = new URL(`../dist/apps/cli/content/vietnamese/chapter-${n}/`, import.meta.url).pathname;
    const node = { id: `vietnamese:read:${n}`, label: `Chapter ${n}`, kind: 'message', authoredReadingDirectory: directory };
    const text = await renderLanguageTreeRightPane(node, { locale: 'en-US', translationsEnabled: true });
    const dialogue = text.split('### Dialogue\n')[1].split('\n### ')[0];
    const speakers = dialogue.split('\n').filter(line => /^\S[^:]*: .+/u.test(line));
    assert.ok(speakers.length >= 6);
    // Exercise repeated toggles against the complete chapter, not only a fragment.
    for (const spacing of ['separated', 'compact', 'separated', 'compact']) {
      const rows = render(node, text, spacing);
      const first = rows.findIndex(row => row.includes(speakers[0].split(': ')[1]));
      const second = rows.findIndex((row, i) => i > first && row.includes(speakers[1].split(': ')[1]));
      assert.ok(first >= 0 && second > first);
      assert.equal(second - first, spacing === 'compact' ? 1 : 2);
    }
  });
}

test('dialogue gaps normalize without removing introduction and section boundaries', () => {
  const node = { id: 'test', label: 'Test', kind: 'message' };
  for (const gap of ['\n', '\n\n', '\n\n\n']) {
    const text = `### Dialogue\n\nScene introduction.\n\nA: First turn.${gap}B: Second turn.\n\n### New Vocabulary\n`;
    for (const spacing of ['compact', 'separated']) {
      const rows = render(node, text, spacing);
      const locate = value => rows.findIndex(row => row.includes(value));
      assert.equal(locate('Second turn.') - locate('First turn.'), spacing === 'compact' ? 1 : 2);
      assert.equal(locate('First turn.') - locate('Scene introduction.'), 2);
      assert.equal(locate('New Vocabulary') - locate('Second turn.'), 2);
    }
  }
});
