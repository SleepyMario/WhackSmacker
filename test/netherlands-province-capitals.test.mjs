import assert from "node:assert/strict";
import { access } from "node:fs/promises";
import { test } from "node:test";
import {
  netherlandsProvinceCapitalsPackageId,
  netherlandsProvinceCapitalsMapEasyPackageId,
  loadNetherlandsProvinceCapitals,
  makeNetherlandsProvinceCapitalCards,
  makeNetherlandsProvinceCapitalMapCards
} from "../dist/packages/geography/netherlands-province-capitals.js";

test("Netherlands province-capital decks cover all twelve provinces", async () => {
  const rows = await loadNetherlandsProvinceCapitals();
  assert.equal(rows.length, 12);
  assert.equal(makeNetherlandsProvinceCapitalCards(rows).length, 24);
  assert.equal(makeNetherlandsProvinceCapitalMapCards(rows).length, 12);
  assert.equal(netherlandsProvinceCapitalsPackageId, "com.sleepymario.geography.netherlands-province-capitals");
  assert.equal(netherlandsProvinceCapitalsMapEasyPackageId, "com.sleepymario.geography.netherlands-province-capitals-map-easy");
  assert.ok(rows.some(row => row.provinceDutch === "Zuid-Holland" && row.capitalDutch === "Den Haag"));
  assert.ok(rows.some(row => row.provinceDutch === "Noord-Brabant" && row.capitalDutch === "'s-Hertogenbosch"));
  assert.ok(rows.some(row => row.provinceDutch === "Fryslân" && row.capitalDutch === "Leeuwarden"));
  for (const row of rows) {
    await access(new URL(`../dist/packages/geography/data/netherlands-province-capitals/maps/${row.id}-question.png`, import.meta.url));
    await access(new URL(`../dist/packages/geography/data/netherlands-province-capitals/maps/${row.id}-answer.png`, import.meta.url));
  }
});
