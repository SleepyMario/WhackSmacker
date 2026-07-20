import assert from "node:assert/strict";
import { test } from "node:test";

import {
  defaultCurriculumDisplayMode,
  combineDeveloperGrammarMarkdown,
  developerOnlyEndMarker,
  developerOnlyStartMarker,
  normalViewVoiceViolations,
  projectCurriculumMarkdown,
  projectReviewTextForMode
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

test("Developer projection preserves source wording while hiding grammar identity from Read Content", () => {
  const developer = projectCurriculumMarkdown(source, "developer");
  assert.doesNotMatch(developer, /grammar_id|G-001/u);
  assert.match(source, /grammar_id: G-001/u);
  assert.match(developer, /Original developer instruction stays in source\./u);
  assert.doesNotMatch(developer, /whacksmacker:developer-only/u);
});

test("all Read Content modes project grammar IDs to human-readable grammar titles", () => {
  const easy = [
    "---", "title: \"Grammar - Easy\"", "grammar_inventory:",
    "  - {grammarId: VIE-GRAMMAR-001, learnerFacingPattern: \"tôi + là + N\"}", "---", "",
    "# Grammar - Easy", "", "## Grammar Points", "", "- `VIE-GRAMMAR-001` — `tôi + là + N`", "",
    "### VIE-GRAMMAR-001", "", "Use `tôi + là + N` to say who you are."
  ].join("\n");
  const hard = easy.replaceAll("Easy", "Hard").replace("Use `tôi + là + N` to say who you are.", "The pattern is an invariant copular identity clause.");
  for (const [mode, input, role] of [["normal", easy, "grammar-easy"], ["expert", hard, "grammar-hard"]]) {
    const projected = projectCurriculumMarkdown(input, mode, { contentRole: role });
    assert.doesNotMatch(projected, /VIE-GRAMMAR-|grammarId/u);
    assert.match(projected, /^### tôi \+ là \+ N$/mu);
    assert.match(projected, /`tôi \+ là \+ N`/u);
  }
  const developer = combineDeveloperGrammarMarkdown(easy, hard);
  assert.doesNotMatch(developer, /VIE-GRAMMAR-|grammarId/u);
  assert.match(developer, /^### tôi \+ là \+ N$/mu);
  assert.match(developer, /Use `tôi \+ là \+ N`[\s\S]*invariant copular identity clause/u);
  assert.match(easy, /VIE-GRAMMAR-001/u);

  const legacyOtherLanguage = projectCurriculumMarkdown("# Grammar\n\n- `KOR-GRAMMAR-031A` -- `V-아서/어서`", "developer");
  assert.doesNotMatch(legacyOtherLanguage, /KOR-GRAMMAR-/u);
  assert.match(legacyOtherLanguage, /`V-아서\/어서`/u);
});

test("Normal Expert and Developer map grammar variants to the canonical visible headings", () => {
  const easy = "---\ngrammar_id: G-001\n---\n\n# Grammar - Easy\n\nUse this simple pattern.";
  const hard = "---\ngrammar_id: G-001\n---\n\n# Grammar - Hard\n\nThis is a nominal predication.";
  assert.match(projectCurriculumMarkdown(easy, "normal", { contentRole: "grammar-easy" }), /^# Grammar$/mu);
  assert.equal(projectCurriculumMarkdown(hard, "normal", { contentRole: "grammar-hard" }), "");
  assert.match(projectCurriculumMarkdown(hard, "expert", { contentRole: "grammar-hard" }), /^# Grammar$/mu);
  assert.equal(projectCurriculumMarkdown(easy, "expert", { contentRole: "grammar-easy" }), "");
  const developer = combineDeveloperGrammarMarkdown(easy, hard);
  assert.equal((developer.match(/^# Grammar$/gmu) ?? []).length, 1);
  assert.match(developer, /^## Normal$/mu);
  assert.match(developer, /^## Expert$/mu);
  assert.match(developer, /Use this simple pattern\.[\s\S]*This is a nominal predication\./u);
  assert.doesNotMatch(developer, /Grammar Easy|Grammar Hard|Grammar: Normal|Grammar: Expert/u);
  for (const legacyHeading of ["Grammar Easy", "Grammar Hard", "Grammar: Normal", "Grammar: Expert", "Grammar Point", "Grammar Points", "Grammar Section"]) {
    const projected = projectCurriculumMarkdown(`## ${legacyHeading}\n\nKeep this grammar content.`, "developer");
    assert.match(projected, /^## Grammar$/mu);
    assert.doesNotMatch(projected, new RegExp(`^## ${legacyHeading.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")}$`, "mu"));
    assert.match(projected, /Keep this grammar content\./u);
  }
  const nested = projectCurriculumMarkdown("# Grammar\n\n## Grammar Points\n\nKeep the points.", "normal");
  assert.equal((nested.match(/^#{1,6} Grammar$/gmu) ?? []).length, 1);
  assert.doesNotMatch(nested, /Grammar Points/u);
});

test("all views remove Complete Rereading and translation visibility controls its complete section", () => {
  const text = [
    "# Chapter", "", "### Learner-facing Dialogue", "", "Maria: Xin chào.", "",
    "### Natural English Translation", "", "Maria: Hello.", "",
    "### Complete Rereading", "", "Reread duplicated dialogue.", "",
    "## Exercises", "", "Keep this exercise."
  ].join("\n");
  for (const mode of ["normal", "expert", "developer"]) {
    const off = projectCurriculumMarkdown(text, mode, { translationsEnabled: false });
    const on = projectCurriculumMarkdown(text, mode, { translationsEnabled: true });
    assert.match(off, /Maria: Xin chào\./u);
    assert.doesNotMatch(off, /Natural English Translation|Maria: Hello\./u);
    assert.match(on, /Natural English Translation[\s\S]*Maria: Hello\./u);
    assert.doesNotMatch(on, /Complete Rereading|Reread duplicated dialogue/u);
    assert.match(on, /Keep this exercise/u);
  }
});

test("all views remove only the structural Content wrapper and retain meaningful reading headings", () => {
  const dialogue = [
    "---", "content_id: chapter-content-003", "---", "", "# Chapter", "", "## Content", "",
    "### Learner-facing Dialogue", "", "Maria: Hallo.", "",
    "### Natural English Translation", "", "Maria: Hello.", "",
    "### Notes", "", "This content remains useful in ordinary prose."
  ].join("\n");
  const narrative = ["# Chapter", "", "## Content", "", "### Learner-facing Narrative", "", "Daan leest een boek."].join("\n");
  for (const mode of ["normal", "expert", "developer"]) {
    const dialogueOutput = projectCurriculumMarkdown(dialogue, mode, { translationsEnabled: true });
    const narrativeOutput = projectCurriculumMarkdown(narrative, mode);
    assert.doesNotMatch(dialogueOutput, /^#{1,6}\s+Content\s*$/imu);
    assert.doesNotMatch(narrativeOutput, /^#{1,6}\s+Content\s*$/imu);
    assert.match(dialogueOutput, /^### Dialogue$/mu);
    assert.match(narrativeOutput, /^### Narrative$/mu);
    assert.doesNotMatch(dialogueOutput, /Learner-facing Dialogue/u);
    assert.doesNotMatch(narrativeOutput, /Learner-facing Narrative/u);
    assert.match(dialogueOutput, /Natural English Translation[\s\S]*Maria: Hello\./u);
    assert.match(dialogueOutput, /This content remains useful in ordinary prose\./u);
    if (mode === "developer") assert.match(dialogueOutput, /content_id: chapter-content-003/u);
  }
});

test("Normal reading vocabulary tables hide raw Usage while Developer preserves it", () => {
  const vocabulary = [
    "### New Vocabulary",
    "",
    "| Vietnamese | English | Notes | Usage |",
    "|---|---|---|---|",
    "| em | I; you | Pronoun | compressed editorial metadata |"
  ].join("\n");
  const normal = projectCurriculumMarkdown(vocabulary, "normal");
  const developer = projectCurriculumMarkdown(vocabulary, "developer");
  const expert = projectCurriculumMarkdown(vocabulary, "expert");
  assert.match(normal, /\| Vietnamese \| English \| Notes \|/u);
  assert.doesNotMatch(normal, /\bUsage\b|compressed editorial metadata/u);
  assert.match(developer, /\| Vietnamese \| English \| Notes \| Usage \|/u);
  assert.match(developer, /compressed editorial metadata/u);
  assert.doesNotMatch(expert, /\bUsage\b|compressed editorial metadata/u);
});

test("Characters tables hide internal identity in every view and use learner-facing Usage", () => {
  const characters = [
    "### Sino-Vietnamese Vocabulary", "",
    "| Vietnamese | Characters | English | Canonical Identity | Evidence |",
    "|---|---|---|---|---|",
    "| sách | 冊 | book | `vi.noun.sach.book` | `Đây là sách.` |", "",
    "Canonical ID: vi.noun.sach.book", "Lexical identity: vi.noun.sach", "Sense identity: vi.noun.sach.book",
    "vocabulary_metadata: [{entryId: vi.noun.sach, senseId: vi.noun.sach.book}]"
  ].join("\n");
  for (const mode of ["normal", "expert", "developer"]) {
    const output = projectCurriculumMarkdown(characters, mode);
    assert.doesNotMatch(output, /Canonical Identity|Canonical ID|Lexical identity|Sense identity|canonicalIdentity|vi\.noun\.sach/u);
    assert.match(output, /sách[\s\S]*冊[\s\S]*book[\s\S]*Đây là sách\./u);
    if (mode === "developer") assert.match(output, /\| Word \| Characters \| Meaning \| Evidence \|/u);
    else assert.match(output, /\| Word \| Characters \| Meaning \| Usage \|/u);
  }
});

test("every projected Markdown heading has exactly one clean blank line on both sides", () => {
  const projected = projectCurriculumMarkdown([
    "# Chapter", "", "", "### Narrative", "Narrative content.", "", "", "#### Support", "", "- item", "", "### Grammar"
  ].join("\n"));
  const lines = projected.split("\n");
  const headingIndexes = lines.flatMap((line, index) => /^#{1,6}\s+\S/u.test(line) ? [index] : []);
  assert.ok(headingIndexes.length > 0);
  for (const index of headingIndexes) {
    assert.equal(lines[index - 1], "", `heading at ${index} has one clean blank above`);
    assert.equal(lines[index + 1], "", `heading at ${index} has one clean blank below`);
    assert.notEqual(lines[index - 2], "", `heading at ${index} has no doubled blank above`);
    assert.notEqual(lines[index + 2], "", `heading at ${index} has no doubled blank below`);
  }
  assert.equal(lines[0], "");
  assert.equal(lines.at(-1), "");
  assert.match(projected, /Narrative content\./u);
  assert.match(projected, /- item/u);
});

test("heading spacing remains exact when optional reading sections are projected away", () => {
  const source = [
    "### Narrative", "", "Context.", "", "Dit is de tekst.", "", "",
    "### Natural English Translation", "This is the text.", "",
    "### Sino-Vietnamese Vocabulary", "", "| Word | Characters | Meaning | Usage |", "|---|---|---|---|", "| sách | 冊 | book | Dit is de tekst. |", "",
    "### Grammar", "Grammar text.", "", "### Line-by-line Breakdown", "", "- explanation", "", "### Exercises"
  ].join("\n");
  for (const translationsEnabled of [false, true]) {
    const output = projectCurriculumMarkdown(source, "normal", { translationsEnabled });
    const lines = output.split("\n");
    for (const [index, line] of lines.entries()) {
      if (!/^#{1,6}\s+\S/u.test(line)) continue;
      assert.equal(lines[index - 1], "");
      assert.equal(lines[index + 1], "");
      assert.notEqual(lines[index - 2], "");
      assert.notEqual(lines[index + 2], "");
    }
  }
});

test("Normal and Expert vocabulary notes use audience-appropriate supported classifications", () => {
  const vocabulary = [
    "### New Vocabulary", "",
    "| Vietnamese | English | Notes | Usage |",
    "|---|---|---|---|",
    "| tôi | I | Pronoun | Neutral first-person singular here. |",
    "| là | am; is; are | Verb (copula) | Identity use only. |",
    "| có | there is | Verb | Existential-presentational use only. |",
    "| sách | book | Noun | No supported subclass. |",
    "| đất nước | country | Noun | Complete compound; common noun. |"
  ].join("\n");
  const normal = projectCurriculumMarkdown(vocabulary, "normal");
  const expert = projectCurriculumMarkdown(vocabulary, "expert");
  const developer = projectCurriculumMarkdown(vocabulary, "developer");
  assert.match(normal, /\| tôi \| I \| Pronoun \|/u);
  assert.match(normal, /\| là \| am; is; are \| Verb \|/u);
  assert.doesNotMatch(normal, /Personal pronoun|Copular verb|Existential verb/u);
  assert.match(expert, /Personal pronoun \(first person singular\)/u);
  assert.match(expert, /Copular verb/u);
  assert.match(expert, /Existential verb/u);
  assert.match(expert, /\| sách \| book \| Noun \|/u);
  assert.match(expert, /Common noun/u);
  assert.doesNotMatch(expert, /Usage|No supported subclass|schema|lexicalEntryId|provenance/u);
  assert.match(developer, /Verb \(copula\)|Existential-presentational use only|No supported subclass/u);
});

test("Normal review removes only terminal technical qualifications", () => {
  assert.equal(projectReviewTextForMode("this/here in the taught frame", "normal"), "this; here");
  assert.equal(projectReviewTextForMode("there; in the attested frame.", "normal"), "there");
  assert.equal(projectReviewTextForMode("meaning in the licensed construction", "normal"), "meaning");
  assert.equal(projectReviewTextForMode("this/here in the taught frame", "expert"), "this/here in the taught frame");
  assert.equal(projectReviewTextForMode("this/here in the taught frame", "developer"), "this/here in the taught frame");
  assert.equal(projectReviewTextForMode("ordinary content", "normal"), "ordinary content");
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
