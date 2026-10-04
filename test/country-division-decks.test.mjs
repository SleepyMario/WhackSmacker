import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { test } from "node:test";
import { countryDivisionDecks } from "../dist/packages/geography/continents-easy.js";

const countries = [
  ["united-kingdom-divisions", 4], ["belgium-regions", 3], ["belgium-provinces", 11], ["france-divisions", 13],
  ["spain-divisions", 19], ["italy-regions", 20],
  ["china-divisions", 33], ["china-roc-divisions", 22], ["india-divisions", 36],
  ["australia-divisions", 8],
  ["canada-divisions", 13],
  ["ussr-former-divisions", 15],
  ["united-states-divisions", 50],
  ["yugoslavia-former-divisions", 6]
];

test("new country decks contain their intended divisions and complete artwork", async () => {
  for (const [directory, count] of countries) {
    const root = new URL(`../dist/packages/geography/data/${directory}/`, import.meta.url);
    const divisions = JSON.parse(await readFile(new URL("divisions.json", root), "utf8"));
    assert.equal(divisions.length, count, directory);
    assert.equal(new Set(divisions.map(item => item.id)).size, count, `${directory} identities`);
    await access(new URL("divisions-numbered.png", root));
    await access(new URL("divisions-named.png", root));
    await access(new URL("split/reference.png", root));
    await access(new URL("PROVENANCE.md", root));
    for (const division of divisions) {
      const stem = division.id.replace(/-highlight$/u, "");
      await access(new URL(`split/${stem}-question.png`, root));
      await access(new URL(`split/${stem}-answer.png`, root));
    }
  }
});

test("China and China Taiwan remain distinct learner sets", async () => {
  const china = JSON.parse(await readFile(new URL("../dist/packages/geography/data/china-divisions/divisions.json", import.meta.url), "utf8"));
  const taiwan = JSON.parse(await readFile(new URL("../dist/packages/geography/data/china-roc-divisions/divisions.json", import.meta.url), "utf8"));
  assert.equal(china.some(item => item.answer === "Taiwan Province"), false);
  assert.equal(taiwan.length, 22);
  assert.ok(taiwan.some(item => item.answer === "Taipei City"));
});

test("Yugoslavia Former uses the six constituent republics", async () => {
  const divisions = JSON.parse(await readFile(new URL("../dist/packages/geography/data/yugoslavia-former-divisions/divisions.json", import.meta.url), "utf8"));
  assert.deepEqual(new Set(divisions.map(item => item.answer)), new Set([
    "Slovenia", "Croatia", "Bosnia and Herzegovina", "Serbia", "Montenegro", "Macedonia"
  ]));
});

test("only genuinely horizontal country maps use the top-down study layout", () => {
  const topDown = countryDivisionDecks
    .filter(deck => deck.mapLayout === "top-down")
    .map(deck => deck.dataset);
  assert.deepEqual(topDown, ["belgium", "china", "canada", "ussr-former", "united-states"]);
});
