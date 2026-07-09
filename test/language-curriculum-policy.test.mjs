import assert from "node:assert/strict";
import { test } from "node:test";

import {
  assertLanguageCurriculumPacing,
  grammarEasyMenuLabel,
  grammarHardMenuLabel,
  languageCurriculumPolicy,
  pacingRuleForChapter
} from "../dist/packages/core/index.js";

test("language curriculum policy hardcodes chapter pacing bands", () => {
  assert.deepEqual(languageCurriculumPolicy.pacingRules.map((rule) => ({
    label: rule.label,
    chapterStart: rule.chapterStart,
    chapterEnd: rule.chapterEnd,
    grammarPoints: rule.grammarPoints,
    readContentLines: rule.readContentLines,
    newVocabularyItems: rule.newVocabularyItems
  })), [
    {
      label: "Chapters 1-100",
      chapterStart: 1,
      chapterEnd: 100,
      grammarPoints: { min: 1, max: 1 },
      readContentLines: { min: 6, max: 20 },
      newVocabularyItems: { min: 6, max: 10 }
    },
    {
      label: "Chapters 100-200",
      chapterStart: 100,
      chapterEnd: 199,
      grammarPoints: { min: 2, max: 2 },
      readContentLines: { min: 10, max: 30 },
      newVocabularyItems: { min: 10, max: 15 }
    }
  ]);
  assert.equal(languageCurriculumPolicy.decisionBoundaryChapter, 200);
});

test("language curriculum pacing validates early and advanced chapters", () => {
  assert.equal(pacingRuleForChapter(1).label, "Chapters 1-100");
  assert.equal(pacingRuleForChapter(99).label, "Chapters 1-100");
  assert.equal(pacingRuleForChapter(100).label, "Chapters 100-200");
  assert.equal(pacingRuleForChapter(199).label, "Chapters 100-200");
  assert.equal(pacingRuleForChapter(200), "decision-boundary");

  assert.doesNotThrow(() => assertLanguageCurriculumPacing({
    chapter: 1,
    grammarPointCount: 1,
    readContentLineCount: 6,
    newVocabularyItemCount: 6
  }));
  assert.doesNotThrow(() => assertLanguageCurriculumPacing({
    chapter: 100,
    grammarPointCount: 2,
    readContentLineCount: 30,
    newVocabularyItemCount: 15
  }));
  assert.throws(() => assertLanguageCurriculumPacing({
    chapter: 6,
    grammarPointCount: 2,
    readContentLineCount: 6,
    newVocabularyItemCount: 6
  }), /grammar point count must be 1-1/u);
  assert.throws(() => assertLanguageCurriculumPacing({
    chapter: 101,
    grammarPointCount: 2,
    readContentLineCount: 9,
    newVocabularyItemCount: 10
  }), /read-content line count must be 10-30/u);
  assert.throws(() => assertLanguageCurriculumPacing({
    chapter: 200,
    grammarPointCount: 2,
    readContentLineCount: 10,
    newVocabularyItemCount: 10
  }), /decision boundary/u);
});

test("language curriculum policy records continuity and strict example rules", () => {
  assert.ok(languageCurriculumPolicy.vocabularyContinuityRules.some((rule) => /Chapter 6, Chapter 11, Chapter 16/u.test(rule)));
  assert.ok(languageCurriculumPolicy.vocabularyContinuityRules.some((rule) => /Country and place vocabulary/u.test(rule)));
  assert.ok(languageCurriculumPolicy.strictExampleRules.some((rule) => /one to three literal read-content examples/u.test(rule)));
  assert.ok(languageCurriculumPolicy.strictExampleRules.some((rule) => /vocabulary lists/u.test(rule)));
  assert.ok(languageCurriculumPolicy.surfaceFormRules.some((rule) => /Conjugated, inflected/u.test(rule)));
  assert.ok(languageCurriculumPolicy.surfaceFormRules.some((rule) => /preserved exactly/u.test(rule)));
  assert.equal(grammarEasyMenuLabel, "Grammar - Easy");
  assert.equal(grammarHardMenuLabel, "Grammar - Hard");
});
