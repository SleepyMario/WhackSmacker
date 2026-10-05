import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { test } from "node:test";

const root = new URL("../dist/packages/geography/data/korea-provinces/", import.meta.url);

test("Korea map combines northern and southern first-level divisions", async () => {
  const divisions = JSON.parse(await readFile(new URL("provinces.json", root), "utf8"));
  assert.equal(divisions.length, 28);
  assert.equal(divisions.filter((item) => item.area === "north").length, 11);
  assert.equal(divisions.filter((item) => item.area === "south").length, 17);
  assert.ok(divisions.some((item) => item.answer === "Pyongyang"));
  assert.ok(divisions.some((item) => item.answer === "Seoul"));
  assert.ok(divisions.some((item) => item.answer === "Jeju"));
  for (const division of divisions) {
    const stem = division.id.replace(/-highlight$/, "");
    await access(new URL(`split/${stem}-question.png`, root));
    await access(new URL(`split/${stem}-answer.png`, root));
  }
  await access(new URL("korea-provinces-numbered.png", root));
  await access(new URL("korea-provinces-named.png", root));
});

test("Korea regional decks contain only northern or southern divisions and complete artwork", async () => {
  const expected = [
    ["north", 11, "north"],
    ["south", 17, "south"]
  ];
  for (const [slug, count, area] of expected) {
    const regionRoot = new URL(`regions/${slug}/`, root);
    const divisions = JSON.parse(await readFile(new URL("provinces.json", regionRoot), "utf8"));
    assert.equal(divisions.length, count);
    assert.equal(divisions.every((division) => division.area === area), true);
    assert.equal(new Set(divisions.map((division) => division.id)).size, count);
    await access(new URL("provinces-numbered.png", regionRoot));
    await access(new URL("provinces-named.png", regionRoot));
    await access(new URL("split/reference.png", regionRoot));
    for (const division of divisions) {
      const stem = division.id.replace(/-highlight$/, "");
      await access(new URL(`split/${stem}-question.png`, regionRoot));
      await access(new URL(`split/${stem}-answer.png`, regionRoot));
    }
  }
});

test("Lingoland Korean reuses every validated Korea map with Korean artwork", async () => {
  const koreanRoot = new URL("language-korean/", root);
  const divisions = JSON.parse(await readFile(new URL("provinces.json", root), "utf8"));
  await access(new URL("korea-provinces-numbered.png", koreanRoot));
  await access(new URL("korea-provinces-named.png", koreanRoot));
  await access(new URL("split/reference.png", koreanRoot));
  for (const division of divisions) {
    const stem = division.id.replace(/-highlight$/, "");
    await access(new URL(`split/${stem}-question.png`, koreanRoot));
    await access(new URL(`split/${stem}-answer.png`, koreanRoot));
  }

  for (const [slug, count] of [["north", 11], ["south", 17]]) {
    const regionRoot = new URL(`regions/${slug}/`, koreanRoot);
    const regionDivisions = JSON.parse(await readFile(new URL(`../regions/${slug}/provinces.json`, koreanRoot), "utf8"));
    assert.equal(regionDivisions.length, count);
    await access(new URL("provinces-numbered.png", regionRoot));
    await access(new URL("provinces-named.png", regionRoot));
    await access(new URL("split/reference.png", regionRoot));
    for (const division of regionDivisions) {
      const stem = division.id.replace(/-highlight$/, "");
      await access(new URL(`split/${stem}-question.png`, regionRoot));
      await access(new URL(`split/${stem}-answer.png`, regionRoot));
    }
  }
});
