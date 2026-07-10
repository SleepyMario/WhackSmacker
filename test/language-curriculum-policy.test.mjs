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
      label: "Chapters 1-25",
      chapterStart: 1,
      chapterEnd: 25,
      grammarPoints: { min: 1, max: 1 },
      readContentLines: { min: 6, max: 20 },
      newVocabularyItems: { min: 6, max: 10 }
    },
    {
      label: "Chapters 26-50",
      chapterStart: 26,
      chapterEnd: 50,
      grammarPoints: { min: 1, max: 2 },
      readContentLines: { min: 10, max: 30 },
      newVocabularyItems: { min: 6, max: 20 }
    }
  ]);
  assert.equal(languageCurriculumPolicy.decisionBoundaryChapter, 51);
});

test("language curriculum pacing validates early and advanced chapters", () => {
  assert.equal(pacingRuleForChapter(1).label, "Chapters 1-25");
  assert.equal(pacingRuleForChapter(25).label, "Chapters 1-25");
  assert.equal(pacingRuleForChapter(26).label, "Chapters 26-50");
  assert.equal(pacingRuleForChapter(50).label, "Chapters 26-50");
  assert.equal(pacingRuleForChapter(51), "decision-boundary");

  assert.doesNotThrow(() => assertLanguageCurriculumPacing({
    chapter: 1,
    grammarPointCount: 1,
    readContentLineCount: 6,
    newVocabularyItemCount: 6
  }));
  assert.doesNotThrow(() => assertLanguageCurriculumPacing({
    chapter: 26,
    grammarPointCount: 2,
    readContentLineCount: 30,
    newVocabularyItemCount: 20
  }));
  assert.throws(() => assertLanguageCurriculumPacing({
    chapter: 6,
    grammarPointCount: 2,
    readContentLineCount: 6,
    newVocabularyItemCount: 6
  }), /grammar point count must be 1-1/u);
  assert.throws(() => assertLanguageCurriculumPacing({
    chapter: 26,
    grammarPointCount: 2,
    readContentLineCount: 9,
    newVocabularyItemCount: 10
  }), /read-content line count must be 10-30/u);
  assert.throws(() => assertLanguageCurriculumPacing({
    chapter: 51,
    grammarPointCount: 2,
    readContentLineCount: 10,
    newVocabularyItemCount: 10
  }), /decision boundary/u);
});

test("language curriculum policy records continuity and strict example rules", () => {
  assert.ok(languageCurriculumPolicy.chapterFormatRules.some((rule) => /Odd-numbered chapters are dialogues/u.test(rule)));
  assert.ok(languageCurriculumPolicy.chapterFormatRules.some((rule) => /Even-numbered chapters are narratives/u.test(rule)));
  assert.ok(languageCurriculumPolicy.vocabularyContinuityRules.some((rule) => /Chapter 6, Chapter 11, Chapter 16/u.test(rule)));
  assert.ok(languageCurriculumPolicy.vocabularyContinuityRules.some((rule) => /Country and place vocabulary/u.test(rule)));
  assert.ok(languageCurriculumPolicy.strictExampleRules.some((rule) => /one to three literal read-content examples/u.test(rule)));
  assert.ok(languageCurriculumPolicy.strictExampleRules.some((rule) => /vocabulary lists/u.test(rule)));
  assert.ok(languageCurriculumPolicy.surfaceFormRules.some((rule) => /Conjugated, inflected/u.test(rule)));
  assert.ok(languageCurriculumPolicy.surfaceFormRules.some((rule) => /preserved exactly/u.test(rule)));
  assert.equal(grammarEasyMenuLabel, "Grammar - Easy");
  assert.equal(grammarHardMenuLabel, "Grammar - Hard");
});
