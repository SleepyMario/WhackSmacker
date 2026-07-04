import assert from "node:assert/strict";
import { test } from "node:test";

import {
  findContinentAt,
  getContinentDefinitions,
  renderContinentMap
} from "../dist/packages/geography/continent-renderer.js";

function stripAnsi(text) {
  return text.replace(/\x1b\[[0-9;]*m/g, "");
}

test("continent data defines exactly six review continents", () => {
  const continents = getContinentDefinitions();

  assert.deepEqual(
    continents.map((continent) => continent.name),
    ["Africa", "The Americas", "Asia", "Europe", "Oceania", "Antarctica"]
  );
  assert.equal(new Set(continents.map((continent) => continent.id)).size, 6);
  assert.ok(continents.some((continent) => continent.name === "Antarctica"));
});

test("The Americas explicitly groups North America and South America", () => {
  const americas = getContinentDefinitions().find((continent) => continent.name === "The Americas");

  assert.ok(americas);
  assert.deepEqual(americas.sourceContinents, ["North America", "South America"]);
});

test("every continent has nonempty polygon geometry", () => {
  for (const continent of getContinentDefinitions()) {
    assert.ok(continent.polygons.length > 0, continent.name);
    assert.ok(continent.polygons.every((polygon) => polygon.length >= 4), continent.name);
  }
});

test("renderer is data-driven from geographic coordinate containment", () => {
  assert.equal(findContinentAt([20, 0])?.name, "Africa");
  assert.equal(findContinentAt([-60, -15])?.name, "The Americas");
  assert.equal(findContinentAt([120, 35])?.name, "Asia");
  assert.equal(findContinentAt([15, 52])?.name, "Europe");
  assert.equal(findContinentAt([135, -25])?.name, "Oceania");
  assert.equal(findContinentAt([0, -75])?.name, "Antarctica");
});

test("renderer highlights exactly one selected continent", () => {
  const rendered = renderContinentMap({ highlight: "Antarctica", width: 72, height: 20, colorsEnabled: true });

  assert.ok(rendered.highlightedCells > 0);
  assert.match(rendered.text, /\x1b\[96m/);
  assert.equal((rendered.text.match(/\x1b\[96m/g) ?? []).length, rendered.highlightedCells);
});

test("renderer keeps Antarctica visible and all six continents appear", () => {
  const rendered = renderContinentMap({ highlight: "Africa", width: 72, height: 20 });

  assert.deepEqual(rendered.visibleContinents, ["Africa", "The Americas", "Asia", "Europe", "Oceania", "Antarctica"]);
});

test("renderer output fits configured dimensions", () => {
  const rendered = renderContinentMap({ highlight: "Asia", width: 60, height: 18 });
  const lines = stripAnsi(rendered.text).split("\n");

  assert.equal(lines.length, 18);
  assert.ok(lines.every((line) => line.length <= 60));
});

test("renderer omits ANSI when colors are disabled", () => {
  const rendered = renderContinentMap({ highlight: "Europe", width: 60, height: 18, colorsEnabled: false });

  assert.doesNotMatch(rendered.text, /\x1b\[[0-9;]*m/);
});

test("renderer uses compact fallback for narrow terminals", () => {
  const rendered = renderContinentMap({ highlight: "Oceania", width: 20, height: 12 });

  assert.equal(rendered.width, 24);
  assert.equal(rendered.usedCompactFallback, true);
  assert.doesNotMatch(stripAnsi(rendered.text), /undefined|NaN/);
});

test("renderer is deterministic for fixed data and dimensions", () => {
  const first = renderContinentMap({ highlight: "The Americas", width: 72, height: 20, colorsEnabled: false });
  const second = renderContinentMap({ highlight: "The Americas", width: 72, height: 20, colorsEnabled: false });

  assert.equal(first.text, second.text);
});
