import assert from "node:assert/strict";
import { test } from "node:test";

import {
  defaultCurriculumDisplayMode,
  developerOnlyEndMarker,
  developerOnlyStartMarker,
  normalViewVoiceViolations,
  projectCurriculumMarkdown
} from "../dist/packages/core/index.js";

const source = `---
chapter: 1
grammar_id: G-001
---

# Lesson

Learner guidance stays.

${developerOnlyStartMarker}
Original developer instruction stays in source.
${developerOnlyEndMarker}

The infinitive row gives the base verb form.
`;

test("Normal is the default curriculum projection", () => {
  assert.equal(defaultCurriculumDisplayMode, "normal");
  assert.equal(projectCurriculumMarkdown(source), projectCurriculumMarkdown(source, "normal"));
  assert.doesNotMatch(projectCurriculumMarkdown(source), /grammar_id|developer instruction/u);
  assert.match(projectCurriculumMarkdown(source), /Learner guidance stays|infinitive row gives/u);
});

test("Developer projection preserves complete wording and removes only classification markers", () => {
  const developer = projectCurriculumMarkdown(source, "developer");
  assert.match(developer, /grammar_id: G-001/u);
  assert.match(developer, /Original developer instruction stays in source\./u);
  assert.doesNotMatch(developer, /whacksmacker:developer-only/u);
});

test("projection uses structural markers rather than phrase matching", () => {
  const learnerSentence = "It does not introduce every possible answer, so choose carefully.";
  assert.match(projectCurriculumMarkdown(`# Lesson\n\n${learnerSentence}`), new RegExp(learnerSentence.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});

test("Normal-view voice flags detached reader labels in instructional prose", () => {
  const violations = normalViewVoiceViolations("# Lesson\n\nThe learner should notice the verb.\n\nStudents should compare the examples.");
  assert.deepEqual(violations.map((item) => item.label.toLowerCase()), ["the learner", "students"]);
});

test("Normal-view voice permits direct and neutral prose", () => {
  assert.deepEqual(normalViewVoiceViolations("# Lesson\n\nNotice that the verb comes second.\n\nThis construction describes a daily action."), []);
});

test("voice validation does not alter real people in read content or quoted examples", () => {
  const text = [
    "# Lesson",
    "",
    "### Learner-facing Dialogue",
    "Teacher: The students are ready.",
    "Student: The learner in the story has a book.",
    "",
    "### Usage Notes",
    "Compare the quoted label `the learner` with direct address."
  ].join("\n");
  assert.deepEqual(normalViewVoiceViolations(text), []);
});

test("developer-only detached wording is preserved without leaking into Normal voice", () => {
  const text = `# Lesson\n\nThis construction describes a daily action.\n\n${developerOnlyStartMarker}\nThe learner uses this pattern to describe a daily action.\n${developerOnlyEndMarker}`;
  assert.deepEqual(normalViewVoiceViolations(text), []);
  assert.match(projectCurriculumMarkdown(text, "developer"), /The learner uses this pattern/u);
});
