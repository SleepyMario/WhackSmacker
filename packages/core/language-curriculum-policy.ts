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

export interface LanguageCurriculumChapterSizeRule {
  readonly chapterStart: number;
  readonly chapterEnd: number;
  readonly newVocabularyItems: InclusiveRange;
  readonly learnerFacingReadContentLines: InclusiveRange;
}

export interface LanguageCurriculumChapterSource {
  readonly chapter: number;
  readonly markdown: string;
}

export type LanguageCurriculumChapterFormat = "dialogue" | "narrative" | "missing";
export type NarrativeScope = "concrete-real-life" | "broader";
export type BroaderTopicDomain = "social" | "cultural" | "ethical" | "institutional" | "environmental" | "conceptual";

export interface LanguageCurriculumChapter5170ValidationResult {
  readonly chapter: number;
  readonly newVocabularyItemCount: number;
  readonly learnerFacingReadContentLineCount: number;
  readonly format: LanguageCurriculumChapterFormat;
}

export interface LanguageCurriculumChapter71140ValidationResult {
  readonly chapter: number;
  readonly newPrincipalGrammarPointCount: number;
  readonly newVocabularyItemCount: number;
  readonly learnerFacingReadContentLineCount: number;
  readonly format: LanguageCurriculumChapterFormat;
  readonly narrativeScope?: NarrativeScope;
}

export type BroaderTopicContentType = "narrative" | "dialogue";
export type BroaderTopicUseKind = "meaningful-reuse" | "incidental-mention";

export interface BroaderTopicLaterUse {
  readonly chapter: number;
  readonly contentType: BroaderTopicContentType;
  readonly kind: BroaderTopicUseKind;
  readonly description: string;
}

export interface BroaderTopicRecord {
  readonly id: string;
  readonly canonicalName: string;
  readonly primaryDomain: BroaderTopicDomain;
  readonly additionalDomains?: readonly BroaderTopicDomain[];
  readonly firstIntroductionChapter: number;
  readonly firstContentType: BroaderTopicContentType;
  readonly description: string;
  readonly laterUses: readonly BroaderTopicLaterUse[];
  readonly meaningfulNarrativeReuseOccurred: boolean;
  readonly meaningfulDialogueReuseOccurred: boolean;
}

export interface LargeNumberCoverageRule {
  readonly chapterStart: number;
  readonly chapterEnd: number;
  readonly min: number;
  readonly max: number;
}

export interface LanguageCurriculumPolicy {
  readonly pacingRules: readonly LanguageCurriculumPacingRule[];
  readonly decisionBoundaryChapter: number;
  readonly chapterFormatRules: readonly string[];
  readonly numberContinuationRules: readonly string[];
  readonly chapterSizeRules: readonly LanguageCurriculumChapterSizeRule[];
  readonly expandedGrammarAndDiscourseRules: readonly string[];
  readonly broaderTopicDomains: readonly BroaderTopicDomain[];
  readonly grammarSummaryAfterChapters: readonly number[];
  readonly largeNumberCoverageRules: readonly LargeNumberCoverageRule[];
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
    },
    {
      label: "Chapters 71-140",
      chapterStart: 71,
      chapterEnd: 140,
      grammarPoints: { min: 1, max: 1 },
      readContentLines: { min: 20, max: 40 },
      newVocabularyItems: { min: 10, max: 30 }
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
  numberContinuationRules: [
    "Numbers may be used freely in every chapter; Chapters 51-70 have no upper or lower numeric restriction.",
    "Across Chapters 51-55 and 56-60, learner-facing dialogue or narrative content must cumulatively introduce and use at least one number from 100 through 999 in each five-chapter block.",
    "Across Chapters 61-65 and 66-70, learner-facing dialogue or narrative content must cumulatively introduce and use at least one number from 1000 through 9999 in each five-chapter block.",
    "A qualifying number may appear in any one chapter of its five-chapter block and is not required in every chapter.",
    "Metadata, validation fixtures, grammar explanations, generated notes, vocabulary bookkeeping, and review material do not satisfy number-continuation coverage.",
    "These are minimum coverage rules only; numbers of any value remain permitted throughout Chapters 51-70.",
    "Handle language-specific number formation, classifiers, counters, agreement, case marking, irregular forms, and parallel number systems naturally where relevant."
  ],
  chapterSizeRules: [
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
  ],
  expandedGrammarAndDiscourseRules: [
    "Chapters 71-140 form one seventy-chapter Expanded Grammar and Broader Discourse stage.",
    "Each chapter introduces exactly one genuinely new principal grammar point; supporting forms and previously introduced grammar do not increase that count.",
    "The stage continues tense, aspect, mood, modality, time reference, and event structure; emphasizes clause structure and combining; and expands interrogatives and negation scope.",
    "Coverage includes completion, duration, frequency, habituality, iteration, progressive, perfective/imperfective, perfect/resultative, inception, continuation, termination, modal meanings, hypothetical meanings, and counterfactual meanings where relevant.",
    "Clause coverage includes coordination, subordination, complement, relative, adverbial, temporal, purpose, reason, result, concessive, conditional, and embedded clauses, clause chaining, participial, converbal, serial-verb, and language-specific linking mechanisms.",
    "Grammar realization and terminology remain language-adaptive rather than being forced into English categories.",
    "Odd chapters are practical, situational named-speaker dialogues; even chapters remain primarily prose narratives.",
    "The thirty-five narratives split 18/17 or 17/18 between concrete-real-life and broader topics, with no run of more than three broader narratives.",
    "Broader topics are social, cultural, ethical, institutional, environmental, or conceptual subjects that remain accessible and grounded at the learner's level."
  ],
  broaderTopicDomains: ["social", "cultural", "ethical", "institutional", "environmental", "conceptual"],
  grammarSummaryAfterChapters: [75, 80, 85, 90, 95, 100, 105, 110, 115, 120, 125, 130, 135, 140],
  largeNumberCoverageRules: [
    { chapterStart: 71, chapterEnd: 80, min: 9_999, max: 10_000 },
    { chapterStart: 81, chapterEnd: 90, min: 99_999, max: 100_000 },
    { chapterStart: 91, chapterEnd: 100, min: 9_999_999, max: 10_000_000 },
    { chapterStart: 101, chapterEnd: 110, min: 99_999_999, max: 100_000_000 },
    { chapterStart: 110, chapterEnd: 120, min: 999_999_999, max: 1_000_000_000 }
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

export function assertLanguageCurriculumChapter5170Requirements(
  chapters: readonly LanguageCurriculumChapterSource[]
): readonly LanguageCurriculumChapter5170ValidationResult[] {
  const chapterSources = [...chapters]
    .filter((chapter) => Number.isInteger(chapter.chapter) && chapter.chapter >= 1)
    .sort((left, right) => left.chapter - right.chapter);
  const previouslyIntroducedVocabulary = new Set<string>();
  const results: LanguageCurriculumChapter5170ValidationResult[] = [];

  for (const source of chapterSources) {
    const vocabularyEntries = declaredLearnerFacingVocabulary(source.markdown);
    const newVocabulary = new Set<string>();
    for (const entry of vocabularyEntries) {
      const key = vocabularyKey(entry);
      if (key !== "" && !previouslyIntroducedVocabulary.has(key)) {
        newVocabulary.add(key);
      }
    }

    if (source.chapter >= 51 && source.chapter <= 70) {
      const rule = languageCurriculumPolicy.chapterSizeRules[0];
      const readContent = learnerFacingReadContent(source.markdown);
      const expectedFormat = source.chapter % 2 === 1 ? "dialogue" : "narrative";
      const result: LanguageCurriculumChapter5170ValidationResult = {
        chapter: source.chapter,
        newVocabularyItemCount: newVocabulary.size,
        learnerFacingReadContentLineCount: readContent.lines.length,
        format: readContent.format
      };
      assertInRange(result.newVocabularyItemCount, rule.newVocabularyItems, `Chapter ${source.chapter} new learner-facing vocabulary item count`);
      assertInRange(result.learnerFacingReadContentLineCount, rule.learnerFacingReadContentLines, `Chapter ${source.chapter} learner-facing dialogue or narrative line count`);
      if (result.format !== expectedFormat) {
        throw new Error(`Chapter ${source.chapter} must use learner-facing ${expectedFormat} content; detected ${result.format}.`);
      }
      results.push(result);
    }

    for (const entry of vocabularyEntries) {
      const key = vocabularyKey(entry);
      if (key !== "") previouslyIntroducedVocabulary.add(key);
    }
  }

  return results;
}

export function assertLanguageCurriculumChapter71140Requirements(
  chapters: readonly LanguageCurriculumChapterSource[],
  broaderTopics: readonly BroaderTopicRecord[] = []
): readonly LanguageCurriculumChapter71140ValidationResult[] {
  const chapterSources = [...chapters]
    .filter((source) => Number.isInteger(source.chapter) && source.chapter >= 1)
    .sort((left, right) => left.chapter - right.chapter);
  const previouslyIntroducedVocabulary = new Set<string>();
  const previouslyIntroducedGrammar = new Set<string>();
  const results: LanguageCurriculumChapter71140ValidationResult[] = [];
  const topicById = validatedBroaderTopicInventory(broaderTopics);

  for (const source of chapterSources) {
    const vocabularyEntries = declaredLearnerFacingVocabulary(source.markdown);
    const newVocabulary = new Set(vocabularyEntries.map(vocabularyKey).filter((key) => key !== "" && !previouslyIntroducedVocabulary.has(key)));
    const grammarEntries = declaredGrammarEntries(source.markdown);
    const newPrincipalGrammar = new Set(grammarEntries
      .filter((entry) => entry.kind === "principal")
      .map((entry) => entry.key)
      .filter((key) => key !== "" && !previouslyIntroducedGrammar.has(key)));

    if (source.chapter >= 71 && source.chapter <= 140) {
      const rule = languageCurriculumPolicy.chapterSizeRules.find((candidate) => candidate.chapterStart === 71 && candidate.chapterEnd === 140);
      if (rule === undefined) throw new Error("Missing Chapters 71-140 chapter-size policy.");
      const readContent = learnerFacingReadContent(source.markdown);
      const expectedFormat = source.chapter % 2 === 1 ? "dialogue" : "narrative";
      assertInRange(newPrincipalGrammar.size, { min: 1, max: 1 }, `Chapter ${source.chapter} new principal grammar point count`);
      assertInRange(newVocabulary.size, rule.newVocabularyItems, `Chapter ${source.chapter} new learner-facing vocabulary item count`);
      assertInRange(readContent.lines.length, rule.learnerFacingReadContentLines, `Chapter ${source.chapter} learner-facing dialogue or narrative line count`);
      if (readContent.format !== expectedFormat) throw new Error(`Chapter ${source.chapter} must use learner-facing ${expectedFormat} content; detected ${readContent.format}.`);

      let narrativeScope: NarrativeScope | undefined;
      if (expectedFormat === "dialogue") {
        assertPracticalDialogue(source.chapter, source.markdown, readContent.lines);
      } else {
        narrativeScope = assertAccessibleNarrative(source.chapter, source.markdown, readContent.lines);
        if (narrativeScope === "broader") assertBroaderNarrativeTopic(source.chapter, source.markdown, topicById);
      }
      results.push({
        chapter: source.chapter,
        newPrincipalGrammarPointCount: newPrincipalGrammar.size,
        newVocabularyItemCount: newVocabulary.size,
        learnerFacingReadContentLineCount: readContent.lines.length,
        format: readContent.format,
        ...(narrativeScope === undefined ? {} : { narrativeScope })
      });
    }

    for (const entry of vocabularyEntries) previouslyIntroducedVocabulary.add(vocabularyKey(entry));
    for (const entry of grammarEntries) {
      if (entry.kind === "principal" || entry.kind === "reused" || entry.kind === "legacy") previouslyIntroducedGrammar.add(entry.key);
    }
  }

  const stageNarratives = results.filter((result) => result.format === "narrative");
  if (stageNarratives.length === 35) assertNarrativeDistribution(stageNarratives);
  return results;
}

type DeclaredGrammarEntry = { readonly kind: "principal" | "supporting" | "reused" | "legacy"; readonly key: string };

function declaredGrammarEntries(markdown: string): readonly DeclaredGrammarEntry[] {
  const entries: DeclaredGrammarEntry[] = [];
  let inGrammarSection = false;
  for (const rawLine of markdown.replace(/\r\n?/gu, "\n").split("\n")) {
    const line = rawLine.trim();
    if (/^#{2,4}\s+(?:.*\/\s+)?New Grammar(?:\s*\/\s*Pattern)?\s*$/iu.test(line)) {
      inGrammarSection = true;
      continue;
    }
    if (/^#{2,4}\s+/u.test(line)) {
      inGrammarSection = false;
      continue;
    }
    if (!inGrammarSection) continue;
    const match = line.match(/^[-*]\s+(Principal|Supporting|Reused)\s*:\s*([^|]+?)(?:\s*\|.*)?$/iu);
    if (match !== null) {
      entries.push({ kind: match[1].toLocaleLowerCase() as DeclaredGrammarEntry["kind"], key: grammarKey(match[2]) });
      continue;
    }
    const legacy = line.match(/^`([^`]+?)(?:\s+--\s+[^`]*)?`$/u);
    if (legacy !== null) entries.push({ kind: "legacy", key: grammarKey(legacy[1]) });
  }
  return entries;
}

function grammarKey(value: string): string {
  return value.normalize("NFKC").replace(/\s+/gu, " ").trim().toLocaleLowerCase();
}

function frontmatterValue(markdown: string, key: string): string | undefined {
  const normalized = markdown.replace(/\r\n?/gu, "\n");
  const frontmatter = normalized.match(/^---\n([\s\S]*?)\n---(?:\n|$)/u)?.[1];
  if (frontmatter === undefined) return undefined;
  const match = frontmatter.match(new RegExp(`^${key}:[ \\t]*(.*?)[ \\t]*$`, "imu"));
  if (match?.[1]?.trim() === "") return undefined;
  return match?.[1]?.trim().replace(/^['"]|['"]$/gu, "");
}

function assertPracticalDialogue(chapter: number, markdown: string, lines: readonly string[]): void {
  const situation = frontmatterValue(markdown, "communicative_situation");
  if (situation === undefined || situation.length < 3) throw new Error(`Chapter ${chapter} dialogue requires a concrete real-life communicative_situation.`);
  const speakerLabels = lines.flatMap((line) => {
    const match = line.match(/^([^:]{1,40}):\s*\S/u);
    return match === null ? [] : [match[1].trim()];
  });
  if (speakerLabels.length < 2 || new Set(speakerLabels).size < 2) throw new Error(`Chapter ${chapter} dialogue must use at least two named speakers in spoken interaction.`);
  if (speakerLabels.some((label) => /^[ABC]$/iu.test(label))) throw new Error(`Chapter ${chapter} dialogue must not use generic A/B/C speaker labels.`);
  if (speakerLabels.length < Math.ceil(lines.length / 2)) throw new Error(`Chapter ${chapter} dialogue must remain recognizably conversational rather than prose or a grammar drill.`);
}

function assertAccessibleNarrative(chapter: number, markdown: string, lines: readonly string[]): NarrativeScope {
  const dialogueLines = lines.filter((line) => /^([^:]{1,40}):\s*\S/u.test(line)).length;
  if (dialogueLines > Math.floor(lines.length / 4)) throw new Error(`Chapter ${chapter} narrative must remain primarily prose.`);
  const scope = frontmatterValue(markdown, "narrative_scope");
  if (scope !== "concrete-real-life" && scope !== "broader") throw new Error(`Chapter ${chapter} narrative_scope must be concrete-real-life or broader.`);
  if (frontmatterValue(markdown, "learner_accessible") !== "true") throw new Error(`Chapter ${chapter} narrative must declare learner_accessible: true.`);
  if (scope === "broader") {
    const domain = frontmatterValue(markdown, "broader_topic_domain");
    if (!languageCurriculumPolicy.broaderTopicDomains.includes(domain as BroaderTopicDomain)) {
      throw new Error(`Chapter ${chapter} broader narrative must use a canonical social, cultural, ethical, institutional, environmental, or conceptual domain.`);
    }
  }
  return scope;
}

function assertNarrativeDistribution(narratives: readonly LanguageCurriculumChapter71140ValidationResult[]): void {
  const concreteCount = narratives.filter((result) => result.narrativeScope === "concrete-real-life").length;
  const broaderCount = narratives.filter((result) => result.narrativeScope === "broader").length;
  if (Math.abs(concreteCount - broaderCount) > 1 || concreteCount + broaderCount !== 35) throw new Error(`Chapters 71-140 narratives must split 18/17 or 17/18; got ${concreteCount}/${broaderCount}.`);
  let broaderRun = 0;
  for (const narrative of narratives) {
    broaderRun = narrative.narrativeScope === "broader" ? broaderRun + 1 : 0;
    if (broaderRun > 3) throw new Error("Chapters 71-140 broader narratives are pathologically clustered; no more than three may occur consecutively.");
  }
}

function validatedBroaderTopicInventory(records: readonly BroaderTopicRecord[]): ReadonlyMap<string, BroaderTopicRecord> {
  const byId = new Map<string, BroaderTopicRecord>();
  for (const record of records) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(record.id)) throw new Error(`Broader topic ID must be a stable lowercase slug: ${record.id}.`);
    if (byId.has(record.id)) throw new Error(`Duplicate canonical broader topic ID: ${record.id}.`);
    if (record.canonicalName.trim() === "") throw new Error(`Broader topic ${record.id} requires a canonical name.`);
    if (!languageCurriculumPolicy.broaderTopicDomains.includes(record.primaryDomain)) throw new Error(`Broader topic ${record.id} has an unsupported primary domain.`);
    for (const domain of record.additionalDomains ?? []) {
      if (!languageCurriculumPolicy.broaderTopicDomains.includes(domain)) throw new Error(`Broader topic ${record.id} has an unsupported additional domain.`);
      if (domain === record.primaryDomain) throw new Error(`Broader topic ${record.id} repeats its primary domain as an additional domain.`);
    }
    if (!Number.isInteger(record.firstIntroductionChapter) || record.firstIntroductionChapter < 71 || record.firstIntroductionChapter > 140) throw new Error(`Broader topic ${record.id} first-introduction chapter must be within 71-140.`);
    if (record.firstContentType !== "narrative") throw new Error(`Broader topic ${record.id} must first be introduced as a broader narrative.`);
    if (record.description.trim() === "") throw new Error(`Broader topic ${record.id} requires a learner-level description.`);
    for (const use of record.laterUses) {
      if (!Number.isInteger(use.chapter) || use.chapter <= record.firstIntroductionChapter) throw new Error(`Broader topic ${record.id} later uses must follow its first introduction.`);
      if (use.contentType !== "narrative" && use.contentType !== "dialogue") throw new Error(`Broader topic ${record.id} has an unsupported later-use content type.`);
      if (use.kind !== "meaningful-reuse" && use.kind !== "incidental-mention") throw new Error(`Broader topic ${record.id} has an unsupported later-use kind.`);
      if (use.description.trim() === "") throw new Error(`Broader topic ${record.id} later uses require descriptions.`);
    }
    const meaningfulNarrative = record.laterUses.some((use) => use.kind === "meaningful-reuse" && use.contentType === "narrative");
    const meaningfulDialogue = record.laterUses.some((use) => use.kind === "meaningful-reuse" && use.contentType === "dialogue");
    if (record.meaningfulNarrativeReuseOccurred !== meaningfulNarrative) throw new Error(`Broader topic ${record.id} meaningfulNarrativeReuseOccurred does not match its meaningful later uses.`);
    if (record.meaningfulDialogueReuseOccurred !== meaningfulDialogue) throw new Error(`Broader topic ${record.id} meaningfulDialogueReuseOccurred does not match its meaningful later uses.`);
    byId.set(record.id, record);
  }
  return byId;
}

function assertBroaderNarrativeTopic(chapter: number, markdown: string, topicById: ReadonlyMap<string, BroaderTopicRecord>): void {
  const topicId = frontmatterValue(markdown, "broader_topic_id");
  if (topicId === undefined) throw new Error(`Chapter ${chapter} broader narrative requires a stable broader_topic_id.`);
  const topic = topicById.get(topicId);
  if (topic === undefined) throw new Error(`Chapter ${chapter} broader_topic_id ${topicId} is missing from units/broader-topic-inventory.json.`);
  const domain = frontmatterValue(markdown, "broader_topic_domain");
  if (domain !== topic.primaryDomain && !(topic.additionalDomains ?? []).includes(domain as BroaderTopicDomain)) throw new Error(`Chapter ${chapter} broader topic domain does not match canonical topic ${topicId}.`);
  if (chapter === topic.firstIntroductionChapter) return;
  const meaningfulReuse = topic.laterUses.some((use) => use.chapter === chapter && use.contentType === "narrative" && use.kind === "meaningful-reuse");
  if (!meaningfulReuse) throw new Error(`Chapter ${chapter} broader topic ${topicId} must be its first introduction or a meaningful narrative reuse; incidental mention does not qualify.`);
}

export function assertLanguageCurriculumStage71140Coverage(
  chapters: readonly LanguageCurriculumChapterSource[],
  options: { readonly requireCompleteStage?: boolean } = {}
): void {
  const stage = chapters.filter((source) => source.chapter >= 71 && source.chapter <= 140);
  if (options.requireCompleteStage === true) {
    const present = new Set(stage.map((source) => source.chapter));
    const missing = Array.from({ length: 70 }, (_, index) => index + 71).filter((chapter) => !present.has(chapter));
    if (missing.length > 0) throw new Error(`Complete Chapters 71-140 validation requires all seventy chapters; missing ${missing.join(", ")}.`);
  }
  const readContentByChapter = new Map(stage.map((source) => [source.chapter, learnerFacingReadContent(source.markdown).lines]));
  const timeDateChapters = new Set<number>();
  const yearIntroductionOrReview = new Set<number>();
  const yearReuse = new Set<number>();
  const largeNumberUses: Array<{ chapter: number; value: number }> = [];

  for (const source of stage) {
    const lines = readContentByChapter.get(source.chapter) ?? [];
    const evidence = frontmatterValue(source.markdown, "time_date_evidence");
    if (evidence !== undefined) {
      assertLiteralLearnerFacingEvidence(source.chapter, "time/date", evidence, lines);
      timeDateChapters.add(source.chapter);
    }
    const yearUse = frontmatterValue(source.markdown, "year_use");
    const yearEvidence = frontmatterValue(source.markdown, "year_evidence");
    if (yearUse !== undefined || yearEvidence !== undefined) {
      if (yearUse !== "introduction" && yearUse !== "review" && yearUse !== "reuse") throw new Error(`Chapter ${source.chapter} year_use must be introduction, review, or reuse.`);
      if (yearEvidence === undefined) throw new Error(`Chapter ${source.chapter} year use requires year_evidence.`);
      assertLiteralLearnerFacingEvidence(source.chapter, "year", yearEvidence, lines);
      (yearUse === "reuse" ? yearReuse : yearIntroductionOrReview).add(source.chapter);
    }
    for (const use of parseLargeNumberEvidence(source.chapter, source.markdown)) {
      assertLiteralLearnerFacingEvidence(source.chapter, "large-number", use.surface, lines);
      largeNumberUses.push({ chapter: source.chapter, value: use.value });
    }
  }

  if (timeDateChapters.size < 5) throw new Error(`Chapters 71-140 require time/date evidence in at least five distinct chapters; got ${timeDateChapters.size}.`);
  if (yearIntroductionOrReview.size < 1) throw new Error("Chapters 71-140 require at least one learner-facing introduction or explicit review of year.");
  if (yearReuse.size < 2) throw new Error(`Chapters 71-140 require meaningful learner-facing reuse of year in at least two additional chapters; got ${yearReuse.size}.`);
  const allYearChapters = [...yearIntroductionOrReview, ...yearReuse];
  if (new Set(allYearChapters.map((chapter) => Math.floor((chapter - 71) / 5))).size < 2) throw new Error("Qualifying year uses must not all be concentrated in one five-chapter block.");

  for (const rule of languageCurriculumPolicy.largeNumberCoverageRules) {
    const qualifies = largeNumberUses.some((use) => use.chapter >= rule.chapterStart && use.chapter <= rule.chapterEnd && use.value >= rule.min && use.value <= rule.max);
    if (!qualifies) throw new Error(`Chapters ${rule.chapterStart}-${rule.chapterEnd} require learner-facing large-number evidence from ${rule.min} through ${rule.max}.`);
  }
}

function assertLiteralLearnerFacingEvidence(chapter: number, kind: string, evidence: string, lines: readonly string[]): void {
  if (!lines.some((line) => line.includes(evidence))) throw new Error(`Chapter ${chapter} ${kind} evidence must occur literally in learner-facing dialogue or narrative content.`);
}

function parseLargeNumberEvidence(chapter: number, markdown: string): readonly { value: number; surface: string }[] {
  const declaration = frontmatterValue(markdown, "large_number_evidence");
  if (declaration === undefined) return [];
  return declaration.split(";").map((part) => {
    const match = part.trim().match(/^(\d+)\s*\|\s*(.+)$/u);
    if (match === null) throw new Error(`Chapter ${chapter} large_number_evidence must use canonical-value | literal surface form.`);
    const value = Number(match[1]);
    if (!Number.isSafeInteger(value) || value < 0) throw new Error(`Chapter ${chapter} large-number canonical value must be a nonnegative safe integer.`);
    return { value, surface: match[2].trim() };
  });
}

function declaredLearnerFacingVocabulary(markdown: string): readonly string[] {
  const entries: string[] = [];
  let inVocabularySection = false;
  for (const rawLine of markdown.replace(/\r\n?/gu, "\n").split("\n")) {
    const line = rawLine.trim();
    if (/^#{2,4}\s+(?:.*\/\s+)?New Vocabulary\s*$/iu.test(line)) {
      inVocabularySection = true;
      continue;
    }
    if (/^#{2,4}\s+/u.test(line)) {
      inVocabularySection = false;
      continue;
    }
    if (!inVocabularySection || line === "" || /^<!--|-->$/u.test(line)) continue;
    const entry = vocabularyEntryFromLine(line);
    if (entry !== undefined) entries.push(entry);
  }
  return entries;
}

function vocabularyEntryFromLine(line: string): string | undefined {
  if (/^\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?$/u.test(line)) return undefined;
  if (line.startsWith("|")) {
    const cells = line.split("|").map((cell) => cell.trim()).filter(Boolean);
    if (cells.length === 0 || /^(?:word|vocabulary|term|target language)$/iu.test(cells[0])) return undefined;
    return cells[0];
  }
  const bullet = line.match(/^[-*]\s+(.+)$/u);
  return bullet?.[1]?.trim();
}

function vocabularyKey(entry: string): string {
  return entry.normalize("NFKC").replace(/\s+/gu, " ").trim().toLocaleLowerCase();
}

function learnerFacingReadContent(markdown: string): { readonly format: "dialogue" | "narrative" | "missing"; readonly lines: readonly string[] } {
  const lines: string[] = [];
  let format: "dialogue" | "narrative" | "missing" = "missing";
  let inReadContent = false;
  for (const rawLine of markdown.replace(/\r\n?/gu, "\n").split("\n")) {
    const line = rawLine.trim();
    if (/^#{2,4}\s+(?:對話(?:\s*\/\s*Learner-facing Dialogue)?|Learner-facing Dialogue|Model Dialogue|Model Mini Dialogue)\b/iu.test(line)) {
      format = "dialogue";
      inReadContent = true;
      continue;
    }
    if (/^#{2,4}\s+(?:閱讀短文(?:\s*\/\s*Learner-facing Controlled Reading)?|Learner-facing Controlled Reading|Controlled Reading|Model Mini Text)\b/iu.test(line)) {
      format = "narrative";
      inReadContent = true;
      continue;
    }
    if (/^#{2,4}\s+/u.test(line)) {
      inReadContent = false;
      continue;
    }
    if (!inReadContent || line === "" || /^[-*_]{3,}$/u.test(line) || /^([^:]{1,40}):\s*$/u.test(line)) continue;
    lines.push(line);
  }
  return { format, lines };
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
