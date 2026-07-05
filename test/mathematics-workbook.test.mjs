import assert from "node:assert/strict";
import { test } from "node:test";

import {
  beginnerVolumeOneUnits,
  createDocumentPageLayout,
  generateBeginnerVolumeOneWorkbook,
  generateCountingUnitWorkbook,
  generateOneTwoThreeWorkbook,
  inspectObjectRenderPlan,
  objectFamilies,
  oneToFiveUnitDefinition,
  oneTwoThreeAnswerChoices,
  oneTwoThreeUnitDefinition,
  renderWorkbookToPdfBuffer,
  sixToNineUnitDefinition,
  workbookContent
} from "../dist/packages/mathematics/index.js";

const expectedUnitMetadata = [
  ["one-two-three", "MATH-FOUNDATION-001", "units/001-one-two-three.md", "mathematics one-two-three"],
  ["four-and-five", "MATH-FOUNDATION-002", "units/002-four-and-five.md", "mathematics four-and-five"],
  ["one-to-five", "MATH-FOUNDATION-003", "units/003-one-to-five.md", "mathematics one-to-five"],
  ["six-to-nine", "MATH-FOUNDATION-004", "units/004-six-to-nine.md", "mathematics six-to-nine"]
];

test("complete beginner volume contains the overall introduction and all unit introductions in order", () => {
  const workbook = generateBeginnerVolumeOneWorkbook({ seed: 184726 });
  const exercisePages = workbook.pages.filter((page) => page.kind === "exercise");
  const unitIntroductionPages = workbook.pages.filter((page) => page.kind === "unit-introduction");
  const exercises = exercisePages.flatMap((page) => page.exercises);

  assert.equal(workbook.title, "Beginner Mathematics Volume 1");
  assert.equal(workbook.pageCount, 195);
  assert.equal(workbook.introductionPageCount, 1);
  assert.equal(workbook.unitIntroductionPageCount, 4);
  assert.equal(workbook.exercisePageCount, 190);
  assert.equal(workbook.exerciseCount, 760);
  assert.equal(workbook.pages[0].kind, "introduction");
  assert.equal(workbook.pages[0].title, "Introduction");
  assert.equal(workbook.pages[0].text, workbookContent.introductionText);
  assert.deepEqual(workbook.units.map((unit) => unit.definition.id), ["one-two-three", "four-and-five", "one-to-five", "six-to-nine"]);
  assert.deepEqual(beginnerVolumeOneUnits.map((unit) => unit.title), ["One, Two, Three", "Four and Five", "One to Five", "Six, Seven, Eight, Nine"]);
  assert.deepEqual(unitIntroductionPages.map((page) => page.description), ["", "", "", ""]);
  assert.equal(exercisePages.length, 190);
  assert.equal(exercises.length, 760);

  for (const page of exercisePages) {
    assert.equal(page.exercises.length, 4);
  }
});

test("every mathematics unit has description and curriculum linkage metadata", () => {
  for (const [id, curriculumId, curriculumDocument] of expectedUnitMetadata) {
    const unit = beginnerVolumeOneUnits.find((candidate) => candidate.id === id);
    assert.ok(unit);
    assert.equal(unit.description, "");
    assert.equal(unit.curriculumId, curriculumId);
    assert.equal(unit.curriculumRepository, "math-curriculum");
    assert.equal(unit.curriculumDocument, curriculumDocument);
  }
});

test("standalone unit workbooks include exactly one empty introduction page", () => {
  for (const definition of beginnerVolumeOneUnits) {
    const workbook = generateCountingUnitWorkbook(definition, { seed: 184726 });

    assert.equal(workbook.pages[0].kind, "unit-introduction");
    assert.equal(workbook.pages[0].description, "");
    assert.equal(workbook.unitIntroductionPageCount, 1);
    assert.equal(workbook.exercisePageCount, definition.exercisePageCount);
    assert.equal(workbook.exerciseCount, definition.exercisePageCount * 4);
    assert.equal(workbook.pages.filter((page) => page.kind === "unit-introduction").length, 1);
    assert.equal(workbook.pages.filter((page) => page.kind === "exercise").length, definition.exercisePageCount);
  }
});

test("Unit 001 workbook data follows the required exercise distribution", () => {
  const workbook = generateOneTwoThreeWorkbook({ seed: 184726 });
  const exercises = exercisePages(workbook).flatMap((page) => page.exercises);
  const counts = countBy(exercises.map((exercise) => exercise.quantity));

  assert.equal(workbook.title, "One, Two, Three");
  assert.equal(workbook.pageCount, 51);
  assert.equal(workbook.exercisePageCount, 50);
  assert.equal(workbook.exerciseCount, 200);
  assert.equal(exercises.length, 200);
  assert.equal(counts.get(1), 67);
  assert.equal(counts.get(2), 67);
  assert.equal(counts.get(3), 66);

  for (const exercise of exercises) {
    assert.ok([1, 2, 3].includes(exercise.quantity));
    assert.deepEqual(exercise.answerChoices, ["one", "two", "three"]);
    assert.deepEqual(exercise.answerChoices, [...oneTwoThreeAnswerChoices]);
    assert.equal(exercise.correctAnswer, { 1: "one", 2: "two", 3: "three" }[exercise.quantity]);
  }
});

test("Unit 002 and Unit 003 retain their page, answer, and distribution rules", () => {
  const workbook = generateBeginnerVolumeOneWorkbook({ seed: 184726 });
  const fourAndFive = workbook.units.find((candidate) => candidate.definition.id === "four-and-five");
  const oneToFive = workbook.units.find((candidate) => candidate.definition.id === "one-to-five");
  assert.ok(fourAndFive);
  assert.ok(oneToFive);

  const fourAndFiveCounts = countBy(fourAndFive.exercisePages.flatMap((page) => page.exercises).map((exercise) => exercise.quantity));
  assert.equal(fourAndFive.exercisePages.length, 30);
  assert.equal(fourAndFive.exerciseCount, 120);
  assert.equal(fourAndFiveCounts.get(4), 60);
  assert.equal(fourAndFiveCounts.get(5), 60);
  for (const page of fourAndFive.exercisePages) {
    assert.deepEqual(new Set(page.exercises.map((exercise) => exercise.quantity)), new Set([4, 5]));
    for (const exercise of page.exercises) {
      assert.deepEqual(exercise.answerChoices, ["four", "five"]);
    }
  }

  const oneToFiveCounts = countBy(oneToFive.exercisePages.flatMap((page) => page.exercises).map((exercise) => exercise.quantity));
  assert.equal(oneToFive.exercisePages.length, 50);
  assert.equal(oneToFive.exerciseCount, 200);
  for (const quantity of [1, 2, 3, 4, 5]) {
    assert.equal(oneToFiveCounts.get(quantity), 40);
  }
  for (const page of oneToFive.exercisePages) {
    assert.ok(new Set(page.exercises.map((exercise) => exercise.quantity)).size >= 3);
    for (const exercise of page.exercises) {
      assert.deepEqual(exercise.answerChoices, ["one", "two", "three", "four", "five"]);
    }
  }
});

test("Unit 004 follows the six through nine specification exactly", () => {
  const workbook = generateCountingUnitWorkbook(sixToNineUnitDefinition, { seed: 184726 });
  const pages = exercisePages(workbook);
  const exercises = pages.flatMap((page) => page.exercises);
  const counts = countBy(exercises.map((exercise) => exercise.quantity));

  assert.equal(workbook.title, "Six, Seven, Eight, Nine");
  assert.equal(workbook.pageCount, 61);
  assert.equal(workbook.exercisePageCount, 60);
  assert.equal(workbook.exerciseCount, 240);
  assert.equal(pages.length, 60);
  assert.equal(exercises.length, 240);
  for (const quantity of [6, 7, 8, 9]) {
    assert.equal(counts.get(quantity), 60);
  }

  for (const page of pages) {
    assert.equal(page.exercises.length, 4);
    assert.deepEqual(new Set(page.exercises.map((exercise) => exercise.quantity)), new Set([6, 7, 8, 9]));
    for (const exercise of page.exercises) {
      assert.ok([6, 7, 8, 9].includes(exercise.quantity));
      assert.deepEqual(exercise.answerChoices, ["six", "seven", "eight", "nine"]);
      assert.equal(exercise.correctAnswer, { 6: "six", 7: "seven", 8: "eight", 9: "nine" }[exercise.quantity]);
    }
  }
});

test("Unit 004 exercise positions are seed-shuffled", () => {
  const first = generateCountingUnitWorkbook(sixToNineUnitDefinition, { seed: 184726 });
  const second = generateCountingUnitWorkbook(sixToNineUnitDefinition, { seed: 184727 });

  assert.notDeepEqual(
    exercisePages(first).map((page) => page.exercises.map((exercise) => exercise.quantity)),
    exercisePages(second).map((page) => page.exercises.map((exercise) => exercise.quantity))
  );
});

test("all answer markers are rendered as fillable circles inside panel bounds", () => {
  const workbook = generateBeginnerVolumeOneWorkbook({ seed: 184726 });
  const expectedChoices = new Map([
    ["one-two-three", 3],
    ["four-and-five", 2],
    ["one-to-five", 5],
    ["six-to-nine", 4]
  ]);

  for (const page of workbook.pages.filter((candidate) => candidate.kind === "exercise")) {
    const layout = createDocumentPageLayout(page);
    for (const exerciseLayout of layout.exercises) {
      const expectedChoiceCount = expectedChoices.get(exerciseLayout.exercise.unitId);
      assert.equal(exerciseLayout.exercise.answerChoices.length, expectedChoiceCount);
      const lineHeight = exerciseLayout.choicesBounds.height / exerciseLayout.exercise.answerChoices.length;
      for (let index = 0; index < exerciseLayout.exercise.answerChoices.length; index += 1) {
        const baseline = exerciseLayout.choicesBounds.y + lineHeight * index + lineHeight * 0.68;
        const circle = { x: exerciseLayout.choicesBounds.x + 12, y: baseline - 7, radius: 7 };
        assert.ok(circle.x - circle.radius >= exerciseLayout.bounds.x);
        assert.ok(circle.y - circle.radius >= exerciseLayout.bounds.y);
        assert.ok(circle.x + circle.radius <= exerciseLayout.bounds.x + exerciseLayout.bounds.width);
        assert.ok(circle.y + circle.radius <= exerciseLayout.bounds.y + exerciseLayout.bounds.height);
      }
    }
  }

  const pdfText = new TextDecoder().decode(renderWorkbookToPdfBuffer(generateCountingUnitWorkbook(oneTwoThreeUnitDefinition, { seed: 184726 })));
  assert.doesNotMatch(pdfText, /•|●|○/u);
  assert.match(pdfText, /1 1 1 rg\n0\.141 0\.231 0\.325 RG\n1\.8 w/);
});

test("seeded generation is deterministic and seed-sensitive", () => {
  const first = generateBeginnerVolumeOneWorkbook({ seed: 184726 });
  const second = generateBeginnerVolumeOneWorkbook({ seed: 184726 });
  const different = generateBeginnerVolumeOneWorkbook({ seed: 184727 });

  assert.deepEqual(first, second);
  assert.notDeepEqual(
    first.pages.filter((page) => page.kind === "exercise").map((page) => page.exercises.map((exercise) => [exercise.quantity, exercise.objectFamily, exercise.variation])),
    different.pages.filter((page) => page.kind === "exercise").map((page) => page.exercises.map((exercise) => [exercise.quantity, exercise.objectFamily, exercise.variation]))
  );
});

test("no answer choices use bullets or numerals and quantities stay within unit ranges", () => {
  const workbook = generateBeginnerVolumeOneWorkbook({ seed: 184726 });

  for (const unit of workbook.units) {
    const allowed = new Set(unit.definition.quantities);
    for (const exercise of unit.exercisePages.flatMap((page) => page.exercises)) {
      assert.ok(allowed.has(exercise.quantity));
      assert.ok(!exercise.answerChoices.some((choice) => /[0-9•●○]/u.test(choice)));
    }
  }
});

test("object catalogue is varied, unique, local, and supports quantities one through nine", () => {
  const ids = objectFamilies.map((family) => family.id);

  assert.ok(objectFamilies.length >= 20);
  assert.equal(new Set(ids).size, ids.length);

  for (const family of objectFamilies) {
    for (const quantity of [1, 2, 3, 4, 5, 6, 7, 8, 9]) {
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

test("mathematics generation has no curriculum repository runtime access marker", () => {
  const serialized = JSON.stringify(generateCountingUnitWorkbook(oneToFiveUnitDefinition, { seed: 184726 }));

  assert.doesNotMatch(serialized, /\/home\/ashwin\/Projects\/math-curriculum/u);
});

function exercisePages(workbook) {
  return workbook.pages.filter((page) => page.kind === "exercise");
}

function countBy(values) {
  const counts = new Map();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return counts;
}
