import assert from "node:assert/strict";
import { test } from "node:test";

import {
  generateOneTwoThreeWorkbook,
  inspectObjectRenderPlan,
  objectFamilies,
  oneTwoThreeAnswerChoices
} from "../dist/packages/mathematics/index.js";

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

test("object catalogue is varied, unique, local, and supports quantities one through three", () => {
  const ids = objectFamilies.map((family) => family.id);

  assert.ok(objectFamilies.length >= 20);
  assert.equal(new Set(ids).size, ids.length);

  for (const family of objectFamilies) {
    for (const quantity of [1, 2, 3]) {
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
