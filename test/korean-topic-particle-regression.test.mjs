import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";

const curriculum = join(process.cwd(), "..", "korean-curriculum", "units", "korean-core");
const chapterPath = join(curriculum, "chapter-001-a-polite-first-meeting", "chapter.md");
const easyPath = join(curriculum, "chapter-001-005-grammar-easy", "chapter.md");
const hardPath = join(curriculum, "chapter-001-005-grammar-hard", "chapter.md");
const ledgerPath = join(curriculum, "cumulative-ledger.md");
const reviewPath = join(process.cwd(), "review-content", "korean", "review-decks", "chapter-001-005", "cards.tsv");

test("Korean Chapter 1 teaches topic allomorphy and discourse-supported omission", async () => {
  const chapter = await readFile(chapterPath, "utf8");
  assert.match(chapter, /Use `N은\/는` to set a topic in polite Korean/u);
  assert.match(chapter, /`은` follows a consonant-final noun or nominal expression/u);
  assert.match(chapter, /`는` follows a vowel-final one/u);
  assert.match(chapter, /In `저는`, `저` means “I; me” in polite or humble speech and `는` marks it as the topic/u);
  assert.match(chapter, /omit an explicit subject/u);
  assert.match(chapter, /저는 학생이에요\./u);
  assert.doesNotMatch(chapter, /Natural English: “As for me/u);
});

test("Korean post-Chapter-5 Normal and Expert share one accurate topic identity", async () => {
  const easy = await readFile(easyPath, "utf8");
  const hard = await readFile(hardPath, "utf8");
  for (const text of [easy, hard]) {
    assert.equal((text.match(/KOR-GRAMMAR-001/gu) ?? []).length, 1);
    assert.match(text, /KOR-GRAMMAR-001 -- N은\/는 — topic marking/u);
  }
  assert.match(easy, /In `저는`, `저` means “I; me” in polite or humble speech/u);
  assert.match(easy, /omit an explicit subject/u);
  assert.match(easy, /Example: `안녕하세요\. 저는 김민지예요\.`/u);
  assert.match(hard, /`은\/는` establishes a discourse topic/u);
  assert.match(hard, /topic–comment structure/u);
  assert.match(hard, /allomorph selected by the preceding phonological coda/u);
  assert.match(hard, /zero anaphora/u);
  assert.doesNotMatch(hard, /obligatory English translation/iu);
});

test("Korean lexical Review uses 저 and excludes topic-particle grammar", async () => {
  const ledger = await readFile(ledgerPath, "utf8");
  const lines = (await readFile(reviewPath, "utf8")).trimEnd().split("\n").slice(1);
  const rows = lines.map((line) => line.split("\t"));
  const targetHeadwords = rows.filter((row) => row[4] === "ko").map((row) => row[6]);
  const senseIds = rows.flatMap((row) => parseJsonTsvField(row[10]));
  assert.match(ledger, /ko\.pronoun\.jeo\.i-me-polite-humble \| 저 \| I; me, polite\/humble/u);
  assert.equal(targetHeadwords.includes("저"), true);
  assert.equal(targetHeadwords.includes("저는"), false);
  for (const forbidden of ["은", "는", "은/는", "저는"]) assert.equal(targetHeadwords.includes(forbidden), false);
  for (const forbidden of ["ko.particle.eun", "ko.particle.neun", "ko.grammar.eun-neun", "ko.pronoun.jeoneun", "ko.pronoun.jeoneun.as-for-me"]) {
    assert.equal(senseIds.includes(forbidden), false);
  }
  assert.equal(rows.some((row) => parseJsonTsvField(row[16]).some((example) => example.includes("저는"))), true);
});

function parseJsonTsvField(value) {
  return JSON.parse(value.startsWith('"') && value.endsWith('"')
    ? value.slice(1, -1).replaceAll('""', '"')
    : value);
}
