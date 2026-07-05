import assert from "node:assert/strict";
import { test } from "node:test";

import {
  beginnerVolumeOneUnits,
  generateBeginnerVolumeOneWorkbook,
  generateOneTwoThreeWorkbook,
  inspectObjectRenderPlan,
  objectFamilies,
  workbookContent,
  oneTwoThreeAnswerChoices
} from "../dist/packages/mathematics/index.js";

test("complete beginner volume contains introduction and all units in order", () => {
  const workbook = generateBeginnerVolumeOneWorkbook({ seed: 184726 });
  const exercisePages = workbook.pages.filter((page) => page.kind === "exercise");
  const exercises = exercisePages.flatMap((page) => page.exercises);

  assert.equal(workbook.title, "Beginner Mathematics Volume 1");
  assert.equal(workbook.pageCount, 134);
  assert.equal(workbook.introductionPageCount, 1);
  assert.equal(workbook.unitTitlePageCount, 3);
  assert.equal(workbook.exercisePageCount, 130);
  assert.equal(workbook.exerciseCount, 520);
  assert.equal(workbook.pages[0].kind, "introduction");
  assert.equal(workbook.pages[0].title, "Introduction");
  assert.equal(workbook.pages[0].text, workbookContent.introductionText);
  assert.deepEqual(workbook.units.map((unit) => unit.definition.title), ["One, Two, Three", "Four and Five", "One to Five"]);
  assert.deepEqual(beginnerVolumeOneUnits.map((unit) => unit.title), ["One, Two, Three", "Four and Five", "One to Five"]);
  assert.equal(exercisePages.length, 130);
  assert.equal(exercises.length, 520);

  for (const page of exercisePages) {
    assert.equal(page.exercises.length, 4);
  }
});

test("One, Two, Three workbook data follows the required exercise distribution", () => {
  const workbook = generateOneTwoThreeWorkbook({ seed: 184726 });
  const exercises = workbook.pages.flatMap((page) => page.exercises);
  const counts = countBy(exercises.map((exercise) => exercise.quantity));

  assert.equal(workbook.title, "One, Two, Three");
  assert.equal(workbook.pageCount, 50);
  assert.equal(workbook.exerciseCount, 200);
  assert.equal(workbook.pages.length, 50);
  assert.equal(exercises.length, 200);
  assert.equal(counts.get(1), 67);
  assert.equal(counts.get(2), 67);
  assert.equal(counts.get(3), 66);

  for (const exercise of exercises) {
    assert.ok([1, 2, 3].includes(exercise.quantity));
    assert.equal(typeof exercise.objectFamily, "string");
    assert.ok(exercise.objectFamily.length > 0);
    assert.deepEqual(exercise.answerChoices, ["one", "two", "three"]);
    assert.deepEqual(exercise.answerChoices, [...oneTwoThreeAnswerChoices]);
    assert.ok(!exercise.answerChoices.some((choice) => /[0-9]/u.test(choice)));
    assert.equal(exercise.correctAnswer, { 1: "one", 2: "two", 3: "three" }[exercise.quantity]);
  }
});

test("One, Two, Three pages contain four exercises and at least two quantities", () => {
  const workbook = generateOneTwoThreeWorkbook({ seed: 184726 });

  for (const page of workbook.pages) {
    assert.equal(page.exercises.length, 4);
    assert.ok(new Set(page.exercises.map((exercise) => exercise.quantity)).size >= 2);
    assert.equal(new Set(page.exercises.map((exercise) => exercise.objectFamily)).size, 4);
  }
});

test("Four and Five unit follows the required distribution and page constraints", () => {
  const workbook = generateBeginnerVolumeOneWorkbook({ seed: 184726 });
  const unit = workbook.units.find((candidate) => candidate.definition.id === "four-five");
  assert.ok(unit);
  const exercises = unit.exercisePages.flatMap((page) => page.exercises);
  const counts = countBy(exercises.map((exercise) => exercise.quantity));

  assert.equal(unit.definition.title, "Four and Five");
  assert.equal(unit.exercisePages.length, 30);
  assert.equal(unit.exerciseCount, 120);
  assert.equal(counts.get(4), 60);
  assert.equal(counts.get(5), 60);

  for (const page of unit.exercisePages) {
    assert.equal(page.exercises.length, 4);
    assert.deepEqual(new Set(page.exercises.map((exercise) => exercise.quantity)), new Set([4, 5]));
    for (const exercise of page.exercises) {
      assert.ok([4, 5].includes(exercise.quantity));
      assert.deepEqual(exercise.answerChoices, ["four", "five"]);
      assert.equal(exercise.correctAnswer, { 4: "four", 5: "five" }[exercise.quantity]);
    }
  }
});

test("One to Five unit follows the required distribution and page constraints", () => {
  const workbook = generateBeginnerVolumeOneWorkbook({ seed: 184726 });
  const unit = workbook.units.find((candidate) => candidate.definition.id === "one-to-five");
  assert.ok(unit);
  const exercises = unit.exercisePages.flatMap((page) => page.exercises);
  const counts = countBy(exercises.map((exercise) => exercise.quantity));

  assert.equal(unit.definition.title, "One to Five");
  assert.equal(unit.exercisePages.length, 50);
  assert.equal(unit.exerciseCount, 200);
  for (const quantity of [1, 2, 3, 4, 5]) {
    assert.equal(counts.get(quantity), 40);
  }

  for (const page of unit.exercisePages) {
    assert.equal(page.exercises.length, 4);
    assert.ok(new Set(page.exercises.map((exercise) => exercise.quantity)).size >= 3);
    for (const exercise of page.exercises) {
      assert.ok([1, 2, 3, 4, 5].includes(exercise.quantity));
      assert.deepEqual(exercise.answerChoices, ["one", "two", "three", "four", "five"]);
      assert.equal(exercise.correctAnswer, { 1: "one", 2: "two", 3: "three", 4: "four", 5: "five" }[exercise.quantity]);
    }
  }
});

test("One, Two, Three seeded generation is deterministic and seed-sensitive", () => {
  const first = generateOneTwoThreeWorkbook({ seed: 184726 });
  const second = generateOneTwoThreeWorkbook({ seed: 184726 });
  const different = generateOneTwoThreeWorkbook({ seed: 184727 });

  assert.deepEqual(first, second);
  assert.notDeepEqual(
    first.pages.map((page) => page.exercises.map((exercise) => [exercise.quantity, exercise.objectFamily])),
    different.pages.map((page) => page.exercises.map((exercise) => [exercise.quantity, exercise.objectFamily]))
  );
});

test("complete volume seeded generation is deterministic and seed-sensitive", () => {
  const first = generateBeginnerVolumeOneWorkbook({ seed: 184726 });
  const second = generateBeginnerVolumeOneWorkbook({ seed: 184726 });
  const different = generateBeginnerVolumeOneWorkbook({ seed: 184727 });

  assert.deepEqual(first, second);
  assert.notDeepEqual(
    first.pages.filter((page) => page.kind === "exercise").map((page) => page.exercises.map((exercise) => [exercise.quantity, exercise.objectFamily])),
    different.pages.filter((page) => page.kind === "exercise").map((page) => page.exercises.map((exercise) => [exercise.quantity, exercise.objectFamily]))
  );
});

test("no answer choices use numerals and quantities stay within unit ranges", () => {
  const workbook = generateBeginnerVolumeOneWorkbook({ seed: 184726 });

  for (const unit of workbook.units) {
    const allowed = new Set(unit.definition.quantities);
    for (const exercise of unit.exercisePages.flatMap((page) => page.exercises)) {
      assert.ok(allowed.has(exercise.quantity));
      assert.ok(!exercise.answerChoices.some((choice) => /[0-9]/u.test(choice)));
    }
  }
});

test("object catalogue is varied, unique, local, and supports quantities one through five", () => {
  const ids = objectFamilies.map((family) => family.id);

  assert.ok(objectFamilies.length >= 20);
  assert.equal(new Set(ids).size, ids.length);

  for (const family of objectFamilies) {
    for (const quantity of [1, 2, 3, 4, 5]) {
      const plan = inspectObjectRenderPlan(family.id, quantity, { x: 10, y: 20, width: 300, height: 180 });

      assert.equal(plan.familyId, family.id);
      assert.equal(plan.quantity, quantity);
      assert.equal(plan.objectBounds.length, quantity);
      assert.deepEqual(plan.remoteAssetReferences, []);

      for (const bounds of plan.objectBounds) {
        assert.ok(bounds.x >= plan.bounds.x);
        assert.ok(bounds.y >= plan.bounds.y);
        assert.ok(bounds.x + bounds.width <= plan.bounds.x + plan.bounds.width);
        assert.ok(bounds.y + bounds.height <= plan.bounds.y + plan.bounds.height);
      }
    }
  }
});

function countBy(values) {
  const counts = new Map();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return counts;
}
