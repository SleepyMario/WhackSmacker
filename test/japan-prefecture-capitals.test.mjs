import assert from "node:assert/strict";
import { test } from "node:test";

import {
  japanPrefectureCapitalsPackageId,
  loadJapanPrefectureCapitals,
  makeJapanPrefectureCapitalCards
} from "../dist/packages/geography/japan-prefecture-capitals.js";

test("Japanese prefecture capitals cover all 47 prefectures in both directions", async () => {
  const rows = await loadJapanPrefectureCapitals();
  const cards = makeJapanPrefectureCapitalCards(rows);

  assert.equal(japanPrefectureCapitalsPackageId, "com.sleepymario.geography.japan-prefecture-capitals");
  assert.equal(rows.length, 47);
  assert.equal(new Set(rows.map((row) => row.id)).size, 47);
  assert.equal(cards.length, 94);
  assert.equal(new Set(cards.map((card) => card.id)).size, 94);
  assert.equal(cards.filter((card) => card.id.endsWith("-prefecture-to-capital")).length, 47);
  assert.equal(cards.filter((card) => card.id.endsWith("-capital-to-prefecture")).length, 47);

  assert.deepEqual(rows.find((row) => row.id === "tokyo"), {
    id: "tokyo",
    prefectureEnglish: "Tokyo",
    prefectureJapanese: "東京都",
    prefectureReading: "とうきょうと",
    capitalEnglish: "Shinjuku",
    capitalJapanese: "新宿区",
    capitalReading: "しんじゅくく"
  });
  assert.ok(cards.some((card) => card.prompt === "What is the capital of Hokkaido?" && card.answer === "Sapporo"));
  assert.ok(cards.some((card) => card.prompt === "Which prefecture has Naha as its capital?" && card.answer === "Okinawa"));
});
