import assert from "node:assert/strict";
import { access } from "node:fs/promises";
import { test } from "node:test";

import {
  koreaProvinceCapitalsPackageId,
  koreaProvinceCapitalsMapEasyPackageId,
  koreaProvinceCapitalsMapHardPackageId,
  loadKoreaProvinceCapitals,
  makeKoreaProvinceCapitalCards,
  makeKoreaProvinceCapitalMapCards
} from "../dist/packages/geography/korea-province-capitals.js";

const artworkRoot = new URL("../dist/packages/geography/data/korea-province-capitals/maps/", import.meta.url);

test("Korea province capitals cover the combined 28-area inventory in both directions", async () => {
  const rows = await loadKoreaProvinceCapitals();
  const cards = makeKoreaProvinceCapitalCards(rows);

  assert.equal(koreaProvinceCapitalsPackageId, "com.sleepymario.geography.korea-province-capitals");
  assert.equal(rows.length, 28);
  assert.equal(new Set(rows.map((row) => row.id)).size, 28);
  assert.equal(rows.filter((row) => row.sourceGroup === "PRK").length, 11);
  assert.equal(rows.filter((row) => row.sourceGroup === "KOR").length, 17);
  assert.equal(cards.length, 56);
  assert.equal(new Set(cards.map((card) => card.id)).size, 56);
  assert.ok(cards.some((card) => card.prompt === "What is the capital of Gyeonggi?" && card.answer === "Suwon"));
  assert.ok(cards.some((card) => card.prompt === "Which province has Haeju as its capital?" && card.answer === "South Hwanghae"));
});

test("Korea province-capital maps contain one complete visual pair per area", async () => {
  const rows = await loadKoreaProvinceCapitals();
  const cards = makeKoreaProvinceCapitalMapCards(rows);

  assert.equal(koreaProvinceCapitalsMapEasyPackageId, "com.sleepymario.geography.korea-province-capitals-map-easy");
  assert.equal(koreaProvinceCapitalsMapHardPackageId, "com.sleepymario.geography.korea-province-capitals-map-hard");
  assert.equal(cards.length, 28);
  assert.equal(new Set(cards.map((card) => card.id)).size, 28);
  for (const row of rows) {
    await access(new URL(`${row.id}-question.png`, artworkRoot));
    await access(new URL(`${row.id}-answer.png`, artworkRoot));
  }
  assert.deepEqual(cards.find((card) => card.artworkId === "gangwon"), {
    id: "gangwon-capital-map",
    artworkId: "gangwon",
    prompt: "Which province capital or administrative seat is highlighted in Gangwon?",
    answer: "Chuncheon",
    explanation: "Chuncheon (춘천) is the highlighted administrative seat of Gangwon (강원특별자치도).",
    answerPool: rows.map((row) => row.capitalEnglish)
  });
});
