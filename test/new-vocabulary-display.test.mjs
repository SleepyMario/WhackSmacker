import assert from "node:assert/strict";
import { test } from "node:test";

import { renderReadingContent } from "../dist/packages/core/index.js";
import {
  japaneseThreeEntries,
  ordinaryThreeEntries,
  semanticContinuationEntry,
  wrappedMiddleEntry
} from "./fixtures/new-vocabulary-display.mjs";

function result(text) {
  return {
    package: {
      packageId: "com.sleepymario.language.fixture",
      packageVersion: "0.1.0",
      displayName: "Fixture",
      contentType: "reading-curriculum"
    },
    entry: {
      path: "units/fixture-core/chapter-001/chapter.md",
      mediaType: "text/markdown",
      title: "Fixture",
      source: "snapshot"
    },
    text
  };
}

function render(text, notesVisible, entrySpacing) {
  return renderReadingContent(result(text), "normal", { notesVisible, entrySpacing });
}

function sectionTableRows(output, heading) {
  const lines = output.split("\n");
  const start = lines.findIndex((line) => line === `### ${heading}`);
  assert.ok(start >= 0, `missing ${heading}`);
  const rows = [];
  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (/^###\s/u.test(line)) break;
    if (line.startsWith("| ")) rows.push(line);
  }
  return rows;
}

function isEmptyTableRow(line) {
  return /^\|(?:\s+\|)+$/u.test(line);
}

test("three one-line entries with Spaces Yes have exactly one empty line between logical entries", () => {
  assert.deepEqual(sectionTableRows(render(ordinaryThreeEntries, true, "separated"), "New Vocabulary"), [
    "| Form | Meaning | Part of speech | Note |",
    "| --- | --- | --- | --- |",
    "| alpha | first | noun | note one |",
    "|  |  |  |  |",
    "| beta | second | phrase | note two |",
    "|  |  |  |  |",
    "| gamma | third | verb | note three |"
  ]);
});

test("three one-line entries with Spaces No are consecutive", () => {
  assert.deepEqual(sectionTableRows(render(ordinaryThreeEntries, true, "compact"), "New Vocabulary"), [
    "| Form | Meaning | Part of speech | Note |",
    "| --- | --- | --- | --- |",
    "| alpha | first | noun | note one |",
    "| beta | second | phrase | note two |",
    "| gamma | third | verb | note three |"
  ]);
});

test("a wrapped middle entry remains uninterrupted in both spacing modes", () => {
  for (const entrySpacing of ["separated", "compact"]) {
    const data = sectionTableRows(render(wrappedMiddleEntry, true, entrySpacing), "New Vocabulary").slice(2);
    const first = data.findIndex((line) => line.includes("beta first"));
    const second = data.findIndex((line) => line.includes("beta second"));
    assert.equal(second, first + 1);
    assert.equal(data.slice(first, second + 1).some(isEmptyTableRow), false);
  }
});

test("a semantic continuation row remains attached to its primary row", () => {
  for (const entrySpacing of ["separated", "compact"]) {
    const data = sectionTableRows(render(semanticContinuationEntry, true, entrySpacing), "New Vocabulary").slice(2);
    const primary = data.findIndex((line) => line.includes("gaat"));
    const continuation = data.findIndex((line) => line.includes("→ gaan"));
    assert.equal(continuation, primary + 1);
    assert.equal(data.slice(primary, continuation + 1).some(isEmptyTableRow), false);
  }
});

test("Notes hidden reclaims only its column while Spaces Yes remains exact", () => {
  const rows = sectionTableRows(render(ordinaryThreeEntries, false, "separated"), "New Vocabulary");
  assert.deepEqual(rows, [
    "| Form | Meaning | Part of speech |",
    "| --- | --- | --- |",
    "| alpha | first | noun |",
    "|  |  |  |",
    "| beta | second | phrase |",
    "|  |  |  |",
    "| gamma | third | verb |"
  ]);
  assert.doesNotMatch(rows.join("\n"), /note one|note two|note three/u);
});

test("Japanese Reading and Notes remain intact with Spaces Yes", () => {
  const rows = sectionTableRows(render(japaneseThreeEntries, true, "separated"), "New Vocabulary");
  assert.match(rows[0], /^\| Form \| Reading \| Meaning \| Part of speech \| Note \|$/u);
  assert.match(rows.join("\n"), /\| 学生 \| がくせい \| student \| noun \| school context \|/u);
  assert.match(rows.join("\n"), /\| こんにちは \|  \| hello \| phrase \| kana-only form \|/u);
  assert.match(rows.join("\n"), /\| 食べます \| たべます \| eat \| verb \| polite contextual form \|/u);
  assert.equal(rows.filter(isEmptyTableRow).length, 2);
});

test("Japanese Reading remains intact with Notes hidden and Spaces No", () => {
  const rows = sectionTableRows(render(japaneseThreeEntries, false, "compact"), "New Vocabulary");
  assert.match(rows[0], /^\| Form \| Reading \| Meaning \| Part of speech \|$/u);
  assert.match(rows.join("\n"), /\| 学生 \| がくせい \| student \| noun \|/u);
  assert.match(rows.join("\n"), /\| こんにちは \|  \| hello \| phrase \|/u);
  assert.match(rows.join("\n"), /\| 食べます \| たべます \| eat \| verb \|/u);
  assert.equal(rows.some(isEmptyTableRow), false);
  assert.doesNotMatch(rows.join("\n"), /school context|kana-only form|polite contextual form/u);
});

test("no separator appears before the first or after the final logical entry", () => {
  const rows = sectionTableRows(render(wrappedMiddleEntry, true, "separated"), "New Vocabulary").slice(2);
  assert.equal(isEmptyTableRow(rows[0]), false);
  assert.equal(isEmptyTableRow(rows.at(-1)), false);
  for (let index = 1; index < rows.length; index += 1) {
    assert.equal(isEmptyTableRow(rows[index]) && isEmptyTableRow(rows[index - 1]), false);
  }
});

test("spacing changes only New Vocabulary and preserves unrelated section boundaries exactly", () => {
  const separated = render(ordinaryThreeEntries, true, "separated");
  const compact = render(ordinaryThreeEntries, true, "compact");
  const outsideVocabulary = (output) => output
    .replace(/### New Vocabulary\n\n[\s\S]*?(?=\n### Grammar)/u, "### New Vocabulary\n\n[TABLE]")
    .trimEnd();
  assert.equal(outsideVocabulary(separated), outsideVocabulary(compact));
  const otherRows = sectionTableRows(separated, "Other Table");
  assert.equal(otherRows.filter(isEmptyTableRow).length, 0);
  assert.deepEqual(otherRows.slice(2), [
    "| outside one | first | noun | unchanged |",
    "| outside two | second | noun | unchanged |"
  ]);
});
