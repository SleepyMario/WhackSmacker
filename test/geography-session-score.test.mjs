import assert from "node:assert/strict";
import { test } from "node:test";

import { formatGeographySessionScore, normalizePrefectureAnswer } from "../dist/packages/geography/continents-easy.js";

test("Wandering the World reports a completed session as a percentage and raw totals", () => {
  assert.equal(formatGeographySessionScore(8, 2, 10), "You scored 80%.\n8 correct, 2 incorrect.");
  assert.equal(formatGeographySessionScore(2, 1, 3), "You scored 67%.\n2 correct, 1 incorrect.");
});

test("Vietnamese provincial names accept answers without diacritics", () => {
  assert.equal(normalizePrefectureAnswer("Đắk Lắk"), normalizePrefectureAnswer("dak lak"));
  assert.equal(normalizePrefectureAnswer("Hồ Chí Minh"), normalizePrefectureAnswer("Ho Chi Minh City"));
});

test("Wandering the World labels an incomplete session and excludes unanswered questions from the percentage", () => {
  assert.equal(
    formatGeographySessionScore(8, 2, 14),
    "You scored 80%.\n8 correct, 2 incorrect, 4 unanswered.\nSession ended early."
  );
  assert.equal(
    formatGeographySessionScore(0, 0, 14),
    "Session ended before any questions were answered.\n0 correct, 0 incorrect, 14 unanswered."
  );
});
