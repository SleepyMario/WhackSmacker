export interface InclusiveRange {
  readonly min: number;
  readonly max: number;
}

export interface LanguageCurriculumPacingRule {
  readonly label: string;
  readonly chapterStart: number;
  readonly chapterEnd: number;
  readonly grammarPoints: InclusiveRange;
  readonly readContentLines: InclusiveRange;
  readonly newVocabularyItems: InclusiveRange;
}

export interface LanguageCurriculumPolicy {
  readonly pacingRules: readonly LanguageCurriculumPacingRule[];
  readonly decisionBoundaryChapter: number;
  readonly chapterFormatRules: readonly string[];
  readonly vocabularyContinuityRules: readonly string[];
  readonly strictExampleRules: readonly string[];
  readonly surfaceFormRules: readonly string[];
}

export const grammarEasyMenuLabel = "Grammar - Easy";
export const grammarHardMenuLabel = "Grammar - Hard";

export const languageCurriculumPolicy: LanguageCurriculumPolicy = {
  pacingRules: [
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
  ],
  decisionBoundaryChapter: 51,
  chapterFormatRules: [
    "Odd-numbered chapters are dialogues.",
    "Even-numbered chapters are narratives.",
    "The odd/even dialogue/narrative rule applies across all languages and all chapter ranges.",
    "Chapter 26 onward remains topic-centered: odd chapters are topic-centered dialogues; even chapters are topic-centered narratives.",
    "Generation, package tests, and audits must check the chapter format rule before accepting chapters."
  ],
  vocabularyContinuityRules: [
    "Only Chapter 1 may establish the initial base vocabulary.",
    "Later chapters must build cumulatively on previous chapters.",
    "Chapter 6, Chapter 11, Chapter 16, and later five-chapter block starts must not reset vocabulary.",
    "New vocabulary after Chapter 1 must be deliberate and supported by read content or clear curriculum progression.",
    "Country and place vocabulary must be worked into read content before becoming normal core review content."
  ],
  strictExampleRules: [
    "Normal core review entries require one to three literal read-content examples.",
    "Examples must not be invented.",
    "Examples must not come from vocabulary lists.",
    "Examples must not come from grammar explanations.",
    "Examples must not come from metadata, notes, generated fields, or internal strings."
  ],
  surfaceFormRules: [
    "Conjugated, inflected, particle-attached, plural, declined, tone-changed, sandhi, phonological, and normal language-specific surface forms may match.",
    "The source read-content sentence must be preserved exactly and must not be rewritten to a base form."
  ]
};

export function pacingRuleForChapter(chapter: number): LanguageCurriculumPacingRule | "decision-boundary" {
  assertPositiveIntegerChapter(chapter);
  if (chapter === languageCurriculumPolicy.decisionBoundaryChapter) {
    return "decision-boundary";
  }
  const matches = languageCurriculumPolicy.pacingRules
    .filter((rule) => chapter >= rule.chapterStart && chapter <= rule.chapterEnd)
    .sort((left, right) => right.chapterStart - left.chapterStart);
  if (matches.length === 0) {
    throw new Error(`No language curriculum pacing rule exists for chapter ${chapter}.`);
  }
  return matches[0];
}

export function assertLanguageCurriculumPacing(values: {
  readonly chapter: number;
  readonly grammarPointCount: number;
  readonly readContentLineCount: number;
  readonly newVocabularyItemCount: number;
}): void {
  const rule = pacingRuleForChapter(values.chapter);
  if (rule === "decision-boundary") {
    throw new Error("Chapter 51 is a language curriculum pacing decision boundary; do not generate a new pacing band automatically.");
  }
  assertInRange(values.grammarPointCount, rule.grammarPoints, `Chapter ${values.chapter} grammar point count`);
  assertInRange(values.readContentLineCount, rule.readContentLines, `Chapter ${values.chapter} read-content line count`);
  assertInRange(values.newVocabularyItemCount, rule.newVocabularyItems, `Chapter ${values.chapter} new vocabulary item count`);
}

function assertPositiveIntegerChapter(chapter: number): void {
  if (!Number.isInteger(chapter) || chapter < 1) {
    throw new Error(`Chapter must be a positive integer: ${chapter}`);
  }
}

function assertInRange(value: number, range: InclusiveRange, label: string): void {
  if (!Number.isInteger(value) || value < range.min || value > range.max) {
    throw new Error(`${label} must be ${range.min}-${range.max}; got ${value}.`);
  }
}
