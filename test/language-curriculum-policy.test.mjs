import assert from "node:assert/strict";
import { test } from "node:test";

import {
  assertLanguageCurriculumChapter5170Requirements,
  assertLanguageCurriculumChapter71140Requirements,
  assertLanguageCurriculumStage71140Coverage,
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
    },
    {
      label: "Chapters 71-140",
      chapterStart: 71,
      chapterEnd: 140,
      grammarPoints: { min: 1, max: 1 },
      readContentLines: { min: 20, max: 40 },
      newVocabularyItems: { min: 10, max: 30 }
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
  assert.equal(pacingRuleForChapter(71).label, "Chapters 71-140");
  assert.equal(pacingRuleForChapter(130).label, "Chapters 71-140");
  assert.equal(pacingRuleForChapter(131).label, "Chapters 71-140");
  assert.equal(pacingRuleForChapter(140).label, "Chapters 71-140");

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
  assert.ok(languageCurriculumPolicy.numberContinuationRules.some((rule) => /51-55.*56-60.*100 through 999/u.test(rule)));
  assert.ok(languageCurriculumPolicy.numberContinuationRules.some((rule) => /61-65.*66-70.*1000 through 9999/u.test(rule)));
  assert.ok(languageCurriculumPolicy.numberContinuationRules.some((rule) => /any one chapter.*not required in every chapter/u.test(rule)));
  assert.ok(languageCurriculumPolicy.numberContinuationRules.some((rule) => /Metadata.*review material.*do not satisfy/u.test(rule)));
  assert.ok(languageCurriculumPolicy.numberContinuationRules.some((rule) => /numbers of any value remain permitted/u.test(rule)));
  assert.deepEqual(languageCurriculumPolicy.chapterSizeRules, [
    {
      chapterStart: 51,
      chapterEnd: 70,
      newVocabularyItems: { min: 10, max: 30 },
      learnerFacingReadContentLines: { min: 15, max: 30 }
    },
    {
      chapterStart: 71,
      chapterEnd: 140,
      newVocabularyItems: { min: 10, max: 30 },
      learnerFacingReadContentLines: { min: 20, max: 40 }
    }
  ]);
  assert.deepEqual(languageCurriculumPolicy.grammarSummaryAfterChapters, [75, 80, 85, 90, 95, 100, 105, 110, 115, 120, 125, 130, 135, 140]);
  assert.ok(languageCurriculumPolicy.vocabularyContinuityRules.some((rule) => /Chapter 6, Chapter 11, Chapter 16/u.test(rule)));
  assert.ok(languageCurriculumPolicy.vocabularyContinuityRules.some((rule) => /Country and place vocabulary/u.test(rule)));
  assert.ok(languageCurriculumPolicy.strictExampleRules.some((rule) => /one to three literal read-content examples/u.test(rule)));
  assert.ok(languageCurriculumPolicy.strictExampleRules.some((rule) => /vocabulary lists/u.test(rule)));
  assert.ok(languageCurriculumPolicy.surfaceFormRules.some((rule) => /Conjugated, inflected/u.test(rule)));
  assert.ok(languageCurriculumPolicy.surfaceFormRules.some((rule) => /preserved exactly/u.test(rule)));
  assert.equal(grammarEasyMenuLabel, "Grammar - Easy");
  assert.equal(grammarHardMenuLabel, "Grammar - Hard");
});

test("Chapters 51-70 accept 10 and 30 new learner-facing vocabulary items", () => {
  assert.doesNotThrow(() => assertLanguageCurriculumChapter5170Requirements([
    chapter5170Markdown({ chapter: 51, vocabulary: vocabularyItems(10), lineCount: 15 }),
    chapter5170Markdown({ chapter: 52, vocabulary: vocabularyItems(30, "second"), lineCount: 15 })
  ]));
});

test("Chapters 51-70 reject fewer than 10 or more than 30 new vocabulary items", () => {
  assert.throws(() => assertLanguageCurriculumChapter5170Requirements([
    chapter5170Markdown({ chapter: 51, vocabulary: vocabularyItems(9), lineCount: 15 })
  ]), /new learner-facing vocabulary item count must be 10-30; got 9/u);
  assert.throws(() => assertLanguageCurriculumChapter5170Requirements([
    chapter5170Markdown({ chapter: 51, vocabulary: vocabularyItems(31), lineCount: 15 })
  ]), /new learner-facing vocabulary item count must be 10-30; got 31/u);
});

test("duplicate and previously introduced vocabulary does not count as new in Chapters 51-70", () => {
  assert.throws(() => assertLanguageCurriculumChapter5170Requirements([
    chapter5170Markdown({ chapter: 51, vocabulary: [...vocabularyItems(9), "term-1"], lineCount: 15 })
  ]), /got 9/u);
  assert.throws(() => assertLanguageCurriculumChapter5170Requirements([
    chapter5170Markdown({ chapter: 50, vocabulary: ["earlier-term"], lineCount: 1 }),
    chapter5170Markdown({ chapter: 51, vocabulary: ["earlier-term", ...vocabularyItems(9)], lineCount: 15 })
  ]), /got 9/u);
});

test("metadata grammar reviews and developer content do not count as Chapters 51-70 vocabulary", () => {
  const source = chapter5170Markdown({ chapter: 51, vocabulary: vocabularyItems(9), lineCount: 15 });
  const chapter = {
    ...source,
    markdown: source.markdown
      .replace("chapter: 51", "chapter: 51\nmetadata_vocabulary: term-10")
      .replace("### New Grammar", "### New Grammar\n- term-10\n\n### Developer Notes\n- term-10\n\n### Review\n- term-10")
  };
  assert.throws(() => assertLanguageCurriculumChapter5170Requirements([chapter]), /got 9/u);
});

test("Chapters 51-70 accept 15 and 30 learner-facing content lines", () => {
  assert.doesNotThrow(() => assertLanguageCurriculumChapter5170Requirements([
    chapter5170Markdown({ chapter: 51, vocabulary: vocabularyItems(10), lineCount: 15 }),
    chapter5170Markdown({ chapter: 52, vocabulary: vocabularyItems(10, "second"), lineCount: 30 })
  ]));
});

test("Chapters 51-70 reject fewer than 15 or more than 30 learner-facing content lines", () => {
  assert.throws(() => assertLanguageCurriculumChapter5170Requirements([
    chapter5170Markdown({ chapter: 51, vocabulary: vocabularyItems(10), lineCount: 14 })
  ]), /learner-facing dialogue or narrative line count must be 15-30; got 14/u);
  assert.throws(() => assertLanguageCurriculumChapter5170Requirements([
    chapter5170Markdown({ chapter: 51, vocabulary: vocabularyItems(10), lineCount: 31 })
  ]), /learner-facing dialogue or narrative line count must be 15-30; got 31/u);
});

test("non-read-content material does not inflate Chapters 51-70 line counts", () => {
  const source = chapter5170Markdown({ chapter: 51, vocabulary: vocabularyItems(10), lineCount: 14 });
  const chapter = {
    ...source,
    markdown: source.markdown
      .replace("### New Vocabulary", "Speaker Only:\n\n---\n\n### New Vocabulary")
      .replace("### New Grammar", "### New Grammar\nGrammar explanation.\n\n### Review\nReview exercise.\n\n### Developer Notes\nGenerated summary.")
  };
  assert.throws(() => assertLanguageCurriculumChapter5170Requirements([chapter]), /line count must be 15-30; got 14/u);
});

test("Chapters 51-70 retain odd dialogue and even narrative formats", () => {
  assert.doesNotThrow(() => assertLanguageCurriculumChapter5170Requirements([
    chapter5170Markdown({ chapter: 51, vocabulary: vocabularyItems(10), lineCount: 15 }),
    chapter5170Markdown({ chapter: 52, vocabulary: vocabularyItems(10, "second"), lineCount: 15 })
  ]));
  assert.throws(() => assertLanguageCurriculumChapter5170Requirements([
    chapter5170Markdown({ chapter: 51, vocabulary: vocabularyItems(10), lineCount: 15, format: "narrative" })
  ]), /must use learner-facing dialogue/u);
  assert.throws(() => assertLanguageCurriculumChapter5170Requirements([
    chapter5170Markdown({ chapter: 52, vocabulary: vocabularyItems(10), lineCount: 15, format: "dialogue" })
  ]), /must use learner-facing narrative/u);
});

function chapter5170Markdown({ chapter, vocabulary, lineCount, format = chapter % 2 === 1 ? "dialogue" : "narrative" }) {
  const heading = format === "dialogue" ? "Learner-facing Dialogue" : "Learner-facing Controlled Reading";
  const lines = Array.from({ length: lineCount }, (_, index) => format === "dialogue"
    ? `Speaker: dialogue line ${index + 1}.`
    : `Narrative line ${index + 1}.`);
  return {
    chapter,
    markdown: `---\nchapter: ${chapter}\n---\n\n### ${heading}\n${lines.join("\n")}\n\n### New Vocabulary\n${vocabulary.map((item) => `- ${item}`).join("\n")}\n\n### New Grammar\nGrammar explanation.`
  };
}

function vocabularyItems(count, prefix = "term") {
  return Array.from({ length: count }, (_, index) => `${prefix}-${index + 1}`);
}

test("number continuation is cumulative by five-chapter block and uses only learner-facing content", () => {
  const chapters = new Map([
    [51, chapterWithNarrative("The shop has 12 baskets.")],
    [52, chapterWithNarrative("A train leaves at 8.")],
    [53, chapterWithNarrative("The hall seats 240 people.")],
    [54, chapterWithNarrative("The guide has 4 maps.")],
    [55, chapterWithNarrative("She buys 20 tickets.")],
    [56, chapterWithDialogue("Mina: I need 700 labels.\nJo: I can bring them.")],
    [57, chapterWithNarrative("There are 3 boxes by the door.")],
    [58, chapterWithNarrative("The room has 40 chairs.")],
    [59, chapterWithNarrative("We meet at 6.")],
    [60, chapterWithNarrative("He writes 9 notes.")],
    [61, chapterWithNarrative("The library received 1,200 books.")],
    [62, chapterWithNarrative("The desk has 2 lamps.")],
    [63, chapterWithNarrative("They wait 10 minutes.")],
    [64, chapterWithNarrative("I bring 3 folders.")],
    [65, chapterWithNarrative("We need 7 keys.")],
    [66, chapterWithNarrative("The stadium holds 5000 guests.")],
    [67, chapterWithNarrative("Two buses arrive.")],
    [68, chapterWithNarrative("The cafe opens at 9.")],
    [69, chapterWithNarrative("She has 12 coins.")],
    [70, chapterWithNarrative("We read 25 pages.")]
  ]);

  assert.deepEqual(numberContinuationFailures(chapters), []);
});

test("number continuation does not require a qualifying number in every chapter", () => {
  const chapters = new Map([
    [51, chapterWithNarrative("The address is 321 River Road.")],
    [56, chapterWithNarrative("The address is 654 River Road.")],
    [61, chapterWithNarrative("The address is 1234 River Road.")],
    [66, chapterWithNarrative("The address is 5678 River Road.")]
  ]);

  assert.deepEqual(numberContinuationFailures(chapters), []);
});

test("number continuation rejects qualifying values outside learner-facing dialogue or narrative", () => {
  const chapters = new Map([
    [51, "---\nchapter: 51\nroom: 321\n---\n\n### New Grammar\nUse 321 as an example.\n\n### Review\n321\n"],
    [56, chapterWithNarrative("The address is 654 River Road.")],
    [61, chapterWithNarrative("The address is 1234 River Road.")],
    [66, chapterWithNarrative("The address is 5678 River Road.")]
  ]);

  assert.deepEqual(numberContinuationFailures(chapters), ["Chapters 51-55 need a learner-facing number from 100 through 999."]);
});

test("number continuation permits every numeric value throughout Chapters 51-70", () => {
  const chapters = new Map([
    [51, chapterWithNarrative("The shop has 12 baskets and 321 tags.")],
    [56, chapterWithNarrative("The shop has 10000 boxes and 654 tags.")],
    [61, chapterWithNarrative("The shop has 99 baskets and 1234 tags.")],
    [66, chapterWithNarrative("The shop has 100000 boxes and 5678 tags.")]
  ]);

  assert.deepEqual(numberContinuationFailures(chapters), []);
});

function chapterWithNarrative(content) {
  return `---\nchapter: 51\n---\n\n### Learner-facing Controlled Reading\n${content}\n\n### New Grammar\nExplanation.`;
}

function chapterWithDialogue(content) {
  return `---\nchapter: 51\n---\n\n### Learner-facing Dialogue\n${content}\n\n### New Vocabulary\nVocabulary.`;
}

function numberContinuationFailures(chapters) {
  const requirements = [
    { start: 51, end: 55, min: 100, max: 999 },
    { start: 56, end: 60, min: 100, max: 999 },
    { start: 61, end: 65, min: 1000, max: 9999 },
    { start: 66, end: 70, min: 1000, max: 9999 }
  ];
  const failures = [];

  for (const requirement of requirements) {
    const qualifies = [...chapters.entries()]
      .filter(([chapter]) => chapter >= requirement.start && chapter <= requirement.end)
      .flatMap(([, markdown]) => learnerFacingLines(markdown))
      .flatMap((line) => [...line.matchAll(/(?<!\d)\d+(?:,\d{3})*(?!\d)/gu)])
      .map(([value]) => Number(value.replace(/,/gu, "")))
      .some((value) => value >= requirement.min && value <= requirement.max);
    if (!qualifies) {
      failures.push(`Chapters ${requirement.start}-${requirement.end} need a learner-facing number from ${requirement.min} through ${requirement.max}.`);
    }
  }
  return failures;
}

function learnerFacingLines(markdown) {
  const lines = [];
  let inLearnerFacingContent = false;
  for (const rawLine of markdown.split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (/^#{2,4}\s+Learner-facing (?:Dialogue|Controlled Reading)\s*$/iu.test(line)) {
      inLearnerFacingContent = true;
      continue;
    }
    if (/^#{2,4}\s+/u.test(line)) {
      inLearnerFacingContent = false;
      continue;
    }
    if (inLearnerFacingContent && line !== "") lines.push(line);
  }
  return lines;
}

test("Chapters 71-140 include Chapters 131-140 under unchanged per-chapter limits", () => {
  for (const chapter of [71, 130, 131, 139, 140]) assert.doesNotThrow(() => validate71140(chapter71140Markdown({ chapter })));
});

test("Chapters 71-140 require exactly one genuinely new principal grammar point", () => {
  assert.throws(() => validate71140(chapter71140Markdown({ chapter: 71, grammar: [] })), /got 0/u);
  assert.throws(() => validate71140(chapter71140Markdown({ chapter: 71, grammar: ["Principal: G-71", "Principal: G-72"] })), /got 2/u);
  assert.doesNotThrow(() => validate71140(chapter71140Markdown({ chapter: 71, grammar: ["Principal: G-71", "Supporting: G-71-A", "Reused: OLD"] })));
});

test("reused and legacy grammar IDs cannot be relabelled as new", () => {
  assert.throws(() => assertLanguageCurriculumChapter71140Requirements([
    { chapter: 70, markdown: "### New Grammar / Pattern\n\n`LEGACY-GRAMMAR -- earlier construction`" },
    chapter71140Markdown({ chapter: 71, grammar: ["Principal: LEGACY-GRAMMAR | relabelled"] })
  ]), /got 0/u);
});

test("Chapters 71-140 enforce vocabulary boundaries and cumulative uniqueness", () => {
  assert.doesNotThrow(() => validate71140(chapter71140Markdown({ chapter: 71, vocabulary: vocabularyItems(10) })));
  assert.doesNotThrow(() => validate71140(chapter71140Markdown({ chapter: 140, vocabulary: vocabularyItems(30) })));
  assert.throws(() => validate71140(chapter71140Markdown({ chapter: 71, vocabulary: vocabularyItems(9) })), /got 9/u);
  assert.throws(() => validate71140(chapter71140Markdown({ chapter: 71, vocabulary: vocabularyItems(31) })), /got 31/u);
  assert.throws(() => validate71140(chapter71140Markdown({ chapter: 71, vocabulary: [...vocabularyItems(9), "term-1"] })), /got 9/u);
  assert.throws(() => assertLanguageCurriculumChapter71140Requirements([
    chapter71140Markdown({ chapter: 70, vocabulary: ["old-term"] }),
    chapter71140Markdown({ chapter: 71, vocabulary: ["old-term", ...vocabularyItems(9)] })
  ]), /got 9/u);
});

test("non-learner-facing vocabulary and structural lines do not inflate counts", () => {
  const source = chapter71140Markdown({ chapter: 71, vocabulary: vocabularyItems(9), lineCount: 19 });
  const inflated = { ...source, markdown: source.markdown
    .replace("chapter: 71", "chapter: 71\nmetadata_term: term-10")
    .replace("### New Vocabulary", "Bare Speaker:\n\n---\n\n### New Vocabulary")
    .replace("### New Grammar", "### Grammar Notes\n- term-10\n\n### Review\nterm-10\n\n### Developer Notes\nSummary.\n\n### New Grammar") };
  assert.throws(() => validate71140(inflated), /vocabulary item count must be 10-30; got 9/u);
});

test("Chapters 71-140 enforce learner-facing line boundaries", () => {
  assert.doesNotThrow(() => validate71140(chapter71140Markdown({ chapter: 71, lineCount: 20 })));
  assert.doesNotThrow(() => validate71140(chapter71140Markdown({ chapter: 140, lineCount: 40 })));
  assert.throws(() => validate71140(chapter71140Markdown({ chapter: 71, lineCount: 19 })), /got 19/u);
  assert.throws(() => validate71140(chapter71140Markdown({ chapter: 140, lineCount: 41 })), /got 41/u);
});

test("odd dialogues are named and situational while even narratives remain prose", () => {
  assert.doesNotThrow(() => validate71140(chapter71140Markdown({ chapter: 139 })));
  assert.doesNotThrow(() => validate71140(chapter71140Markdown({ chapter: 140 })));
  assert.throws(() => validate71140(chapter71140Markdown({ chapter: 139, format: "narrative" })), /must use learner-facing dialogue/u);
  assert.throws(() => validate71140(chapter71140Markdown({ chapter: 140, format: "dialogue" })), /must use learner-facing narrative/u);
  assert.throws(() => validate71140(chapter71140Markdown({ chapter: 139, speakers: ["A", "B"] })), /generic A\/B\/C/u);
  assert.throws(() => validate71140(chapter71140Markdown({ chapter: 139, situation: "" })), /concrete real-life/u);
  assert.throws(() => validate71140(chapter71140Markdown({ chapter: 140, narrativeDialogueLines: 6 })), /primarily prose/u);
});

test("all 35 narratives accept either mathematically balanced split", () => {
  assert.doesNotThrow(() => validateStageNarratives((index) => index % 2 === 0 ? "concrete-real-life" : "broader"));
  assert.doesNotThrow(() => validateStageNarratives((index) => index % 2 === 0 ? "broader" : "concrete-real-life"));
  assert.throws(() => validateStageNarratives((index) => index % 2 === 0 || index === 1 ? "concrete-real-life" : "broader"), /split 18\/17 or 17\/18/u);
  const unclassified = chapter71140Markdown({ chapter: 72 }).markdown.replace("narrative_scope: concrete-real-life", "narrative_scope: unclassified");
  assert.throws(() => validate71140({ chapter: 72, markdown: unclassified }), /narrative_scope must be/u);
});

test("broader narrative domains accessibility and anti-clustering remain enforced", () => {
  const topic = topicRecord("community-life", 72, { primaryDomain: "social" });
  assert.throws(() => validate71140(chapter71140Markdown({ chapter: 72, narrativeScope: "broader", broaderDomain: "academic", topicId: "community-life" }), [topic]), /canonical social/u);
  assert.throws(() => validate71140(chapter71140Markdown({ chapter: 72, narrativeScope: "broader", accessible: false, topicId: "community-life" }), [topic]), /learner_accessible/u);
  const scopes = ["broader", "broader", "broader", "broader", ...Array.from({ length: 14 }, () => "broader"), ...Array.from({ length: 17 }, () => "concrete-real-life")];
  assert.throws(() => validateStageNarratives((index) => scopes[index]), /pathologically clustered/u);
});

test("broader-topic inventory requires stable separate canonical records", () => {
  const broader = chapter71140Markdown({ chapter: 72, narrativeScope: "broader", topicId: "education-access" });
  assert.throws(() => validate71140(broader), /missing from units\/broader-topic-inventory.json/u);
  assert.doesNotThrow(() => validate71140(broader, [topicRecord("education-access", 72, { additionalDomains: ["institutional"] })]));
  assert.throws(() => validate71140(broader, [topicRecord("education-access", 72), topicRecord("education-access", 74)]), /Duplicate canonical/u);
  assert.doesNotThrow(() => validate71140(chapter71140Markdown({ chapter: 72, narrativeScope: "concrete-real-life" })));
});

test("variant topic phrasings share identity and meaningful reuse excludes incidental mentions", () => {
  const topic = topicRecord("technology-and-privacy", 72, {
    canonicalName: "Technology and personal privacy",
    laterUses: [
      { chapter: 74, contentType: "narrative", kind: "meaningful-reuse", description: "Privacy in modern technology" },
      { chapter: 75, contentType: "dialogue", kind: "incidental-mention", description: "Passing reference" },
      { chapter: 77, contentType: "dialogue", kind: "meaningful-reuse", description: "Conversation about privacy choices" }
    ],
    meaningfulNarrativeReuseOccurred: true,
    meaningfulDialogueReuseOccurred: true
  });
  assert.doesNotThrow(() => assertLanguageCurriculumChapter71140Requirements([
    chapter71140Markdown({ chapter: 72, narrativeScope: "broader", topicId: topic.id }),
    chapter71140Markdown({ chapter: 74, narrativeScope: "broader", topicId: topic.id })
  ], [topic]));
  const incidentalOnly = topicRecord("workplace-culture", 72, {
    laterUses: [{ chapter: 74, contentType: "narrative", kind: "incidental-mention", description: "Passing reference" }]
  });
  assert.throws(() => validate71140(chapter71140Markdown({ chapter: 74, narrativeScope: "broader", topicId: incidentalOnly.id }), [incidentalOnly]), /incidental mention does not qualify/u);
});

test("time/date coverage requires five distinct learner-facing chapters", () => {
  assert.doesNotThrow(() => assertLanguageCurriculumStage71140Coverage(coverageFixture()));
  assert.throws(() => assertLanguageCurriculumStage71140Coverage(coverageFixture({ timeChapters: [71, 81, 91, 101] })), /at least five distinct chapters; got 4/u);
  assert.doesNotThrow(() => assertLanguageCurriculumStage71140Coverage(coverageFixture({ timeChapters: [71, 72, 81, 91, 101, 110] })));
  const metadataOnly = coverageFixture().map((source) => source.chapter === 71 ? { ...source, markdown: source.markdown.replace("time-71", "not-present") } : source);
  assert.throws(() => assertLanguageCurriculumStage71140Coverage(metadataOnly), /must occur literally/u);
});

test("year requires introduction or review plus two distributed learner-facing reuses", () => {
  assert.doesNotThrow(() => assertLanguageCurriculumStage71140Coverage(coverageFixture()));
  assert.throws(() => assertLanguageCurriculumStage71140Coverage(coverageFixture({ yearUses: [[71, "introduction"], [81, "reuse"]] })), /at least two additional chapters; got 1/u);
  assert.throws(() => assertLanguageCurriculumStage71140Coverage(coverageFixture({ yearUses: [[71, "reuse"], [81, "reuse"], [91, "reuse"]] })), /introduction or explicit review/u);
  assert.doesNotThrow(() => assertLanguageCurriculumStage71140Coverage(coverageFixture({ yearUses: [[71, "review"], [81, "reuse"], [91, "reuse"]] })));
  const metadataOnly = coverageFixture().map((source) => source.chapter === 71 ? { ...source, markdown: source.markdown.replace("year-form-71", "absent-year-form") } : source);
  assert.throws(() => assertLanguageCurriculumStage71140Coverage(metadataOnly), /year evidence must occur literally/u);
});

test("all five large-number blocks accept inclusive endpoints and Chapter 110 overlap", () => {
  assert.doesNotThrow(() => assertLanguageCurriculumStage71140Coverage(coverageFixture()));
  assert.doesNotThrow(() => assertLanguageCurriculumStage71140Coverage(coverageFixture({ numbers: [10_000, 100_000, 10_000_000, 100_000_000, 1_000_000_000] })));
  assert.throws(() => assertLanguageCurriculumStage71140Coverage(coverageFixture({ numbers: [9_998, 99_999, 9_999_999, 99_999_999, 999_999_999] })), /Chapters 71-80/u);
  const overlap = coverageFixture({ numberChapters: [71, 81, 91, 110, 110] });
  assert.doesNotThrow(() => assertLanguageCurriculumStage71140Coverage(overlap));
  const metadataOnly = coverageFixture().map((source) => source.chapter === 81 ? { ...source, markdown: source.markdown.replace("number-99999", "number-not-present") } : source);
  assert.throws(() => assertLanguageCurriculumStage71140Coverage(metadataOnly), /large-number evidence must occur literally/u);
  const arbitrary = coverageFixture().map((source) => source.chapter === 71 ? { ...source, markdown: source.markdown.replaceAll("time-71", "time-71 and arbitrary number 42424242") } : source);
  assert.doesNotThrow(() => assertLanguageCurriculumStage71140Coverage(arbitrary));
  assert.equal(languageCurriculumPolicy.largeNumberCoverageRules.some((rule) => rule.chapterStart > 120), false);
});

test("broader-topic inventory schema is Draft 2020-12 and stage-scoped", async () => {
  const { readFile } = await import("node:fs/promises");
  const schema = JSON.parse(await readFile(new URL("../schemas/broader-topic-inventory-v1.schema.json", import.meta.url), "utf8"));
  assert.equal(schema.$schema, "https://json-schema.org/draft/2020-12/schema");
  assert.equal(schema.items.properties.firstIntroductionChapter.maximum, 140);
  assert.deepEqual(schema.items.properties.laterUses.items.properties.kind.enum, ["meaningful-reuse", "incidental-mention"]);
});

function validate71140(chapter, topics = []) {
  return assertLanguageCurriculumChapter71140Requirements([chapter], topics);
}

function chapter71140Markdown({
  chapter,
  vocabulary = vocabularyItems(10, `chapter-${chapter}-term`),
  lineCount = chapter >= 71 ? 20 : 1,
  format = chapter % 2 === 1 ? "dialogue" : "narrative",
  grammar = [`Principal: G-${chapter} | language-adaptive construction`],
  speakers = ["Mina", "Jo"],
  situation = "planning a public-service appointment",
  narrativeScope = "concrete-real-life",
  broaderDomain = "social",
  topicId = `topic-${chapter}`,
  accessible = true,
  narrativeDialogueLines = 0
}) {
  const heading = format === "dialogue" ? "Learner-facing Dialogue" : "Learner-facing Controlled Reading";
  const lines = Array.from({ length: lineCount }, (_, index) => {
    if (format === "dialogue") return `${speakers[index % speakers.length]}: spoken line ${index + 1}.`;
    if (index < narrativeDialogueLines) return `Mina: quoted exchange ${index + 1}.`;
    return `Narrative prose line ${index + 1}.`;
  });
  const metadata = format === "dialogue"
    ? `communicative_situation: ${situation}`
    : `narrative_scope: ${narrativeScope}\nlearner_accessible: ${accessible}${narrativeScope === "broader" ? `\nbroader_topic_domain: ${broaderDomain}\nbroader_topic_id: ${topicId}` : ""}`;
  return {
    chapter,
    markdown: `---\nchapter: ${chapter}\n${metadata}\n---\n\n### ${heading}\n${lines.join("\n")}\n\n### New Vocabulary\n${vocabulary.map((item) => `- ${item}`).join("\n")}\n\n### New Grammar\n${grammar.map((item) => `- ${item}`).join("\n")}`
  };
}

function validateStageNarratives(scopeForIndex) {
  const chapters = Array.from({ length: 35 }, (_, index) => chapter71140Markdown({
    chapter: 72 + index * 2,
    format: "narrative",
    narrativeScope: scopeForIndex(index),
    broaderDomain: ["social", "cultural", "ethical", "institutional", "environmental", "conceptual"][index % 6]
  }));
  const domains = ["social", "cultural", "ethical", "institutional", "environmental", "conceptual"];
  const topics = chapters.flatMap((chapter, index) => scopeForIndex(index) === "broader"
    ? [topicRecord(`topic-${chapter.chapter}`, chapter.chapter, { primaryDomain: domains[index % domains.length] })]
    : []);
  return assertLanguageCurriculumChapter71140Requirements(chapters, topics);
}

function topicRecord(id, firstIntroductionChapter, overrides = {}) {
  return {
    id,
    canonicalName: overrides.canonicalName ?? id.replaceAll("-", " "),
    primaryDomain: overrides.primaryDomain ?? "social",
    additionalDomains: overrides.additionalDomains ?? [],
    firstIntroductionChapter,
    firstContentType: "narrative",
    description: "A learner-level description grounded in understandable examples.",
    laterUses: overrides.laterUses ?? [],
    meaningfulNarrativeReuseOccurred: overrides.meaningfulNarrativeReuseOccurred ?? false,
    meaningfulDialogueReuseOccurred: overrides.meaningfulDialogueReuseOccurred ?? false
  };
}

function coverageFixture({
  timeChapters = [71, 81, 91, 101, 110],
  yearUses = [[71, "introduction"], [81, "reuse"], [91, "reuse"]],
  numbers = [9_999, 99_999, 9_999_999, 99_999_999, 999_999_999],
  numberChapters = [71, 81, 91, 101, 110]
} = {}) {
  const chapters = new Set([...timeChapters, ...yearUses.map(([chapter]) => chapter), ...numberChapters]);
  return [...chapters].map((chapter) => {
    const time = timeChapters.includes(chapter) ? `time-${chapter}` : undefined;
    const year = yearUses.find(([candidate]) => candidate === chapter);
    const numberEntries = numberChapters.flatMap((candidate, index) => candidate === chapter ? [[numbers[index], `number-${numbers[index]}`]] : []);
    const metadata = [
      time === undefined ? undefined : `time_date_evidence: ${time}`,
      year === undefined ? undefined : `year_use: ${year[1]}\nyear_evidence: year-form-${chapter}`,
      numberEntries.length === 0 ? undefined : `large_number_evidence: ${numberEntries.map(([value, surface]) => `${value} | ${surface}`).join("; ")}`
    ].filter(Boolean).join("\n");
    const content = [time, year === undefined ? undefined : `year-form-${chapter}`, ...numberEntries.map(([, surface]) => surface)].filter(Boolean).join(" ");
    return { chapter, markdown: `---\nchapter: ${chapter}\n${metadata}\n---\n\n### Learner-facing ${chapter % 2 === 1 ? "Dialogue" : "Controlled Reading"}\n${content}` };
  });
}
