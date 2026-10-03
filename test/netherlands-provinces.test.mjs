import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { test } from "node:test";

const root = new URL("../dist/packages/geography/data/netherlands-provinces/", import.meta.url);

test("Netherlands map contains all twelve provinces and generated artwork", async () => {
  const provinces = JSON.parse(await readFile(new URL("provinces.json", root), "utf8"));
  assert.equal(provinces.length, 12);
  assert.ok(provinces.some((item) => item.answer === "Fryslân"));
  assert.ok(provinces.some((item) => item.answer === "Noord-Holland"));
  assert.ok(provinces.some((item) => item.answer === "Limburg"));
  for (const province of provinces) {
    const stem = province.id.replace(/-highlight$/, "");
    await access(new URL(`split/${stem}-question.png`, root));
    await access(new URL(`split/${stem}-answer.png`, root));
  }
  await access(new URL("netherlands-provinces-numbered.png", root));
  await access(new URL("netherlands-provinces-named.png", root));
});
