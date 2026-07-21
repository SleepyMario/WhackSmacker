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

test("Korean Chapter 1 teaches topic allomorphy and structural versus natural translation", async () => {
  const chapter = await readFile(chapterPath, "utf8");
  assert.match(chapter, /topic particle `은\/는`/u);
  assert.match(chapter, /`은` follows a consonant-final noun or nominal expression/u);
  assert.match(chapter, /`는` follows a vowel-final noun or nominal expression/u);
  assert.match(chapter, /`저는`[^\n]*`저 \+ 는`/u);
  assert.match(chapter, /`저` is the polite or humble first-person pronoun/u);
  assert.match(chapter, /`는` marks `저` as the topic/u);
  assert.match(chapter, /structural gloss[^\n]*“as for me\.?”/iu);
  assert.match(chapter, /Structural explanation: “As for me, I am a student\.”/u);
  assert.match(chapter, /Natural English: “I am a student\.”/u);
  assert.match(chapter, /ordinary natural English normally translates `저는` simply as “I\.?”/u);
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
  assert.match(easy, /`저 \+ 는`/u);
  assert.match(easy, /structural gloss “as for me”/iu);
  assert.match(easy, /Ordinary natural English normally uses “I” instead/u);
  assert.match(easy, /Structural: “As for me, I am a student\.”/u);
  assert.match(easy, /Natural: “I am a student\.”/u);
  assert.match(easy, /should not be translated word-for-word in every sentence/u);
  assert.match(hard, /`topic marker`/u);
  assert.match(hard, /`topic–comment structure`/u);
  assert.match(hard, /allomorphy[^\n]*consonant-final[^\n]*vowel-final/u);
  assert.doesNotMatch(hard, /obligatory English translation/iu);
});

test("Korean lexical Review uses 저 and excludes topic-particle grammar", async () => {
  const ledger = await readFile(ledgerPath, "utf8");
  const lines = (await readFile(reviewPath, "utf8")).trimEnd().split("\n").slice(1);
  const rows = lines.map((line) => line.split("\t"));
  const targetHeadwords = rows.filter((row) => row[4] === "ko").map((row) => row[6]);
  const senseIds = rows.flatMap((row) => JSON.parse(row[10]));
  assert.match(ledger, /ko\.pronoun\.jeo\.i-me-polite-humble \| 저 \| I; me, polite\/humble/u);
  assert.equal(targetHeadwords.includes("저"), true);
  assert.equal(targetHeadwords.includes("저는"), false);
  for (const forbidden of ["은", "는", "은/는", "저는"]) assert.equal(targetHeadwords.includes(forbidden), false);
  for (const forbidden of ["ko.particle.eun", "ko.particle.neun", "ko.grammar.eun-neun", "ko.pronoun.jeoneun", "ko.pronoun.jeoneun.as-for-me"]) {
    assert.equal(senseIds.includes(forbidden), false);
  }
  assert.equal(rows.some((row) => JSON.parse(row[16]).some((example) => example.includes("저는"))), true);
});
