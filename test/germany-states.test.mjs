import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { test } from "node:test";

const root = new URL("../dist/packages/geography/data/germany-states/", import.meta.url);

test("Germany map contains all sixteen states and generated artwork", async () => {
  const states = JSON.parse(await readFile(new URL("states.json", root), "utf8"));
  assert.equal(states.length, 16);
  for (const name of ["Berlin", "Bremen", "Hamburg", "Saarland", "Bayern", "Baden-Württemberg"]) {
    assert.ok(states.some((item) => item.answer === name));
  }
  for (const state of states) {
    const stem = state.id.replace(/-highlight$/, "");
    await access(new URL(`split/${stem}-question.png`, root));
    await access(new URL(`split/${stem}-answer.png`, root));
  }
  await access(new URL("germany-states-numbered.png", root));
  await access(new URL("germany-states-named.png", root));
});
