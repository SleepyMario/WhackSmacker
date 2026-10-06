import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { test } from "node:test";
import {
  chinaProvinceCapitalsPackageId,
  chinaProvinceCapitalsMapEasyPackageId,
  loadChinaProvinceCapitals,
  makeChinaProvinceCapitalCards,
  makeChinaProvinceCapitalMapCards
} from "../dist/packages/geography/china-province-capitals.js";
import {
  chinaTaiwanProvinceCapitalsPackageId,
  loadChinaTaiwanProvinceCapitals,
  makeChinaTaiwanProvinceCapitalCards,
  makeChinaTaiwanProvinceCapitalMapCards
} from "../dist/packages/geography/china-taiwan-province-capitals.js";

test("China province-capital decks cover all 33 existing divisions", async () => {
  const rows = await loadChinaProvinceCapitals();
  assert.equal(rows.length, 33);
  assert.equal(makeChinaProvinceCapitalCards(rows).length, 66);
  assert.equal(makeChinaProvinceCapitalMapCards(rows).length, 33);
  assert.equal(chinaProvinceCapitalsPackageId, "com.sleepymario.geography.china-province-capitals");
  assert.equal(chinaProvinceCapitalsMapEasyPackageId, "com.sleepymario.geography.china-province-capitals-map-easy");
  assert.ok(rows.some(row => row.provinceEnglish === "Hubei Province" && row.capitalEnglish === "Wuhan"));
  assert.ok(rows.some(row => row.provinceEnglish === "Tibet Autonomous Region" && row.capitalEnglish === "Lhasa"));
  for (const row of rows) {
    const root = new URL(`../dist/packages/geography/data/china-province-capitals/maps/${row.id}-`, import.meta.url);
    await access(new URL(`${root.href}question.png`));
    await access(new URL(`${root.href}answer.png`));
  }
});

test("China Taiwan province-capital decks cover all 22 existing divisions", async () => {
  const rows = await loadChinaTaiwanProvinceCapitals();
  assert.equal(rows.length, 22);
  assert.equal(makeChinaTaiwanProvinceCapitalCards(rows).length, 44);
  assert.equal(makeChinaTaiwanProvinceCapitalMapCards(rows).length, 22);
  assert.equal(chinaTaiwanProvinceCapitalsPackageId, "com.sleepymario.geography.china-taiwan-province-capitals");
  assert.ok(rows.some(row => row.provinceEnglish === "New Taipei City" && row.capitalEnglish === "Banqiao"));
  assert.ok(rows.some(row => row.provinceEnglish === "Chiayi County" && row.capitalEnglish === "Taibao"));
  for (const row of rows) {
    const root = new URL(`../dist/packages/geography/data/china-taiwan-province-capitals/maps/${row.id}-`, import.meta.url);
    await access(new URL(`${root.href}question.png`));
    await access(new URL(`${root.href}answer.png`));
  }
});

test("capital metadata retains Chinese names and explicit whole-division choices", async () => {
  const china = JSON.parse(await readFile(new URL("../dist/packages/geography/data/china-province-capitals/capitals.json", import.meta.url), "utf8"));
  const taiwan = JSON.parse(await readFile(new URL("../dist/packages/geography/data/china-taiwan-province-capitals/capitals.json", import.meta.url), "utf8"));
  assert.ok(china.every(row => row.provinceChinese && row.capitalChinese));
  assert.equal(china.find(row => row.provinceEnglish === "Beijing Municipality").wholeProvince, true);
  assert.equal(china.find(row => row.provinceEnglish === "Tibet Autonomous Region").wholeProvince, false);
  assert.ok(taiwan.every(row => row.provinceChinese && row.capitalChinese));
});
