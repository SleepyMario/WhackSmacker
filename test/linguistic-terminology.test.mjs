import assert from "node:assert/strict";
import { test } from "node:test";

import {
  filterLinguisticTermsByCategory,
  findLinguisticTermById,
  getLinguisticTerminologyCategories,
  getLinguisticTerminologySnapshot,
  renderLinguisticTerminology,
  resolveRelatedLinguisticTerm,
  searchLinguisticTerms
} from "../dist/packages/language/index.js";

test("synchronized linguistic terminology data loads with unique stable IDs", () => {
  const snapshot = getLinguisticTerminologySnapshot();
  const ids = snapshot.terms.map((term) => term.id);

  assert.equal(snapshot.sourceRepository, "linguistic-terminology");
  assert.equal(snapshot.sourceCommit, "d2612e2dcef8204b43d1927a7cb6e3911cb8cc6e");
  assert.equal(snapshot.terms.length, 89);
  assert.equal(new Set(ids).size, ids.length);
});

test("linguistic terminology categories are available for navigation", () => {
  assert.deepEqual(getLinguisticTerminologyCategories(), [
    "Core linguistics",
    "Korean terminology",
    "Language learning",
    "Morphology and syntax",
    "Phonetics and phonology",
    "Semantics and pragmatics",
    "Writing systems"
  ]);
});

test("linguistic terminology search finds headings, aliases, Korean script, and stable IDs", () => {
  assert.ok(searchLinguisticTerms("semivowel").some((term) => term.id === "phonology.semivowel"));
  assert.ok(searchLinguisticTerms("contextual sound variant").some((term) => term.id === "phonology.allophone"));
  assert.ok(searchLinguisticTerms("받침").some((term) => term.id === "korean.batchim"));
  assert.deepEqual(searchLinguisticTerms("korean.initial-ieung").map((term) => term.id), ["korean.initial-ieung"]);
});

test("linguistic terminology category filtering and empty search states are deterministic", () => {
  const koreanTerms = filterLinguisticTermsByCategory("Korean terminology");

  assert.equal(koreanTerms.length, 20);
  assert.ok(koreanTerms.every((term) => term.category === "Korean terminology"));
  assert.deepEqual(searchLinguisticTerms("not-a-real-linguistic-term"), []);
});

test("linguistic terminology related links resolve to target terms", () => {
  const semivowel = findLinguisticTermById("phonology.semivowel");
  assert.ok(semivowel);

  const glideLink = semivowel.relatedTerms.find((term) => term.label === "glide");
  assert.ok(glideLink);

  const target = resolveRelatedLinguisticTerm(semivowel, glideLink);
  assert.equal(target?.id, "phonology.glide");
});

test("linguistic terminology renderer exposes title, category navigation, index, terms, and empty state", () => {
  const overview = renderLinguisticTerminology();
  const category = renderLinguisticTerminology({ category: "Korean terminology" });
  const empty = renderLinguisticTerminology({ query: "not-a-real-linguistic-term" });

  assert.match(overview, /^Linguistic Terminology/u);
  assert.match(overview, /Categories:\n- Core linguistics/u);
  assert.match(overview, /Alphabetical Index:/u);
  assert.match(category, /Category: Korean terminology \(20 terms\)/u);
  assert.match(category, /## 받침/u);
  assert.match(empty, /No terminology entries matched/u);
});
