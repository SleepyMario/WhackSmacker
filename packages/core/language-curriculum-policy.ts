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

export interface CumulativeCurriculumChapterState {
  readonly chapter: number;
  readonly inheritedChapterNumbers: readonly number[];
}

export function assertCanonicalCumulativeContinuity(states: readonly CumulativeCurriculumChapterState[]): void {
  const ordered = [...states].sort((left, right) => left.chapter - right.chapter);
  for (let index = 0; index < ordered.length; index += 1) {
    const state = ordered[index];
    assertPositiveIntegerChapter(state.chapter);
    if (state.chapter !== index + 1) throw new Error(`Canonical cumulative continuity must be an unbroken sequence from Chapter 1; found Chapter ${state.chapter} at position ${index + 1}.`);
    const expected = Array.from({ length: state.chapter - 1 }, (_, priorIndex) => priorIndex + 1);
    if (state.inheritedChapterNumbers.length !== expected.length || state.inheritedChapterNumbers.some((chapter, priorIndex) => chapter !== expected[priorIndex])) {
      throw new Error(`Chapter ${state.chapter} must inherit the complete curriculum state from Chapters 1-${state.chapter - 1}; the immediate predecessor alone is insufficient.`);
    }
  }
}

export type LanguageCurriculumChapterFormat = "dialogue" | "narrative" | "missing";
export type NarrativeScope = "concrete-real-life" | "broader";
export type BroaderTopicDomain = "social" | "cultural" | "ethical" | "institutional" | "environmental" | "conceptual";

export interface LanguageCurriculumChapter5170ValidationResult {
  readonly chapter: number;
  readonly newPrincipalGrammarPointCount: number;
  readonly newVocabularyItemCount: number;
  readonly learnerFacingReadContentLineCount: number;
  readonly format: LanguageCurriculumChapterFormat;
}

export interface LanguageCurriculumChapter3150ValidationResult {
  readonly chapter: number;
  readonly newPrincipalGrammarPointCount: number;
  readonly connectorPrincipalGrammarPointCount: number;
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

export const canonicalCastSize = 30;
export const activeCastBlockSize = 20;
export const activeCastExpansionSize = 3;

export type ActiveCastMigrationStatus = "compliant" | "pending-legacy-migration";

export interface ActiveCastMetadata {
  readonly schemaVersion: 1;
  readonly progression: readonly string[];
}

export interface ActiveCastChapterRecord {
  readonly chapter: number;
  readonly migrationStatus: ActiveCastMigrationStatus;
  readonly authorship: "legacy" | "new";
  readonly participatingPersonIds?: readonly string[];
  readonly dialogueSpeakerIds?: readonly string[];
  readonly narrativePersonIds?: readonly string[];
  /** Canonical IDs with a substantive learner-facing dialogue or narrative appearance. */
  readonly meaningfulPersonIds?: readonly string[];
  readonly reviewPersonIds?: readonly string[];
  readonly reviewSourceChapters?: readonly number[];
  readonly recurringRelationship?: string;
  readonly incidentalPeople?: readonly IncidentalRoleCharacter[];
}

export interface IncidentalRoleCharacter {
  readonly nameOrRole: string;
  readonly function: string;
  readonly canonicalPersonId?: never;
  readonly lightlyDescribed: true;
  readonly biography?: never;
  readonly relationshipPersonIds?: never;
  readonly recurringStoryline?: never;
  readonly detailedPersonalityTraits?: never;
}

export interface ActiveCastAppearanceBlock {
  readonly chapterStart: number;
  readonly chapterEnd: number;
  readonly appearancesByPersonId: Readonly<Record<string, number>>;
  readonly coverageStatus: "complete" | "pending";
  readonly requiredNewPersonIds: readonly string[];
  readonly missingNewPersonIds: readonly string[];
  readonly activationPeople: readonly ActivationPersonAppearanceReport[];
  readonly oldCastAppearanceCount: number;
  readonly newCastAppearanceCount: number;
  readonly totalCanonicalAppearanceCount: number;
  readonly requiredMinimumOldCastCount: number;
  readonly oldCastPercentage: number | null;
  readonly distributionOnTrack: boolean | "not-applicable";
  readonly distributionStatus: "pending" | "passed" | "failed" | "not-applicable";
}

export interface ActivationPersonAppearanceReport {
  readonly canonicalId: string;
  readonly activationChapter: number;
  readonly activationBlock: string;
  readonly qualifyingChapterNumbers: readonly number[];
  readonly distinctQualifyingChapterCount: number;
  readonly requiredCount: 5;
  readonly remainingCount: number;
  readonly status: "pending" | "passed" | "failed";
}

export interface ActiveCastAuditResult {
  readonly status: "compliant" | "pending-legacy-migration";
  readonly appearancesByChapter: Readonly<Record<number, Readonly<Record<string, number>>>>;
  readonly blocks: readonly ActiveCastAppearanceBlock[];
  readonly cumulativeAppearances: Readonly<Record<string, number>>;
  readonly warnings: readonly string[];
  readonly pendingChapters: readonly number[];
  readonly pendingCoverageBlocks: readonly string[];
}

export type GrammaticalGender = "M" | "F" | "N" | string;
export type LexicalIntroductionStatus = "new-entry" | "new-sense" | "new-part-of-speech" | "new-multiword-expression" | "review" | "reintroduced" | "previously-introduced" | "reuse";
export type LexicalMorphologyStatus = "productive-and-known" | "supporting-form" | "fixed-or-unanalyzed" | "not-yet-taught";
export interface LexicalIdentityMetadata {
  readonly lexicalEntryId: string;
  readonly senseId: string;
  readonly surfaceForm: string;
  readonly lemma: string;
  readonly citationForm: string;
  readonly partOfSpeech: string;
  readonly meaning: string;
  readonly introductionStatus: LexicalIntroductionStatus;
  readonly firstIntroductionChapter: number;
  readonly encounteredForms?: readonly string[];
  readonly relatedSenseIds?: readonly string[];
  readonly morphologyStatus?: LexicalMorphologyStatus;
  readonly attestationChapters?: readonly number[];
}
export interface NounVocabularyRecord extends Partial<LexicalIdentityMetadata> {
  readonly lexicalType: "noun";
  readonly lemma: string;
  readonly learnerFacingForm: string;
  readonly definiteArticle?: string;
  readonly grammaticalCategory?: GrammaticalGender;
  readonly explicitCategoryMarkerRequired?: boolean;
  readonly exceptionalStatus?: string;
  readonly pluralOnly?: boolean;
}
export type MeasureExpressionType = "MW" | "classifier" | "counter";
export type MeasureUsageStatus = "general" | "productive" | "restricted" | "formal" | "colloquial" | "context-dependent";
export interface MeasureExpressionVocabularyRecord extends Partial<LexicalIdentityMetadata> {
  readonly lexicalType: "measure-expression";
  readonly lexicalForm: string;
  readonly learnerFacingForm: string;
  readonly pronunciation?: string;
  readonly grammaticalType: MeasureExpressionType;
  readonly semanticScope: string;
  readonly representativeNounClasses?: readonly string[];
  readonly restrictions?: string;
  readonly usageStatus?: MeasureUsageStatus;
}
export interface SimpleVocabularyRecord {
  readonly lexicalType?: "simple" | "proper-name" | "verb" | "adjective" | "phrase" | "transparent-measure-noun";
  readonly learnerFacingForm: string;
}
export interface VerbVocabularyRecord extends LexicalIdentityMetadata {
  readonly lexicalType: "verb";
  readonly learnerFacingForm: string;
  readonly encounteredForms: readonly string[];
  readonly regularityStatus: VerbRegularityStatus;
  readonly verbClass?: string;
  readonly regularityMigrationStatus?: "pending-legacy-migration";
  readonly regularityCorrectionAudit?: string;
}
export type VerbRegularityStatus = "regular" | "irregular" | "not-applicable" | "undetermined";
export interface MultiwordExpressionVocabularyRecord extends LexicalIdentityMetadata {
  readonly lexicalType: "multiword-expression";
  readonly learnerFacingForm: string;
  readonly multiwordExpression: true;
  readonly componentLexicalEntryIds?: readonly string[];
  readonly morphologyStatus: LexicalMorphologyStatus;
  readonly introducesProductiveMorphology?: boolean;
}
export type CanonicalLexicalRecord = (NounVocabularyRecord | MeasureExpressionVocabularyRecord) & LexicalIdentityMetadata | VerbVocabularyRecord | MultiwordExpressionVocabularyRecord;
export type LearnerFacingVocabularyRecord = NounVocabularyRecord | MeasureExpressionVocabularyRecord | VerbVocabularyRecord | MultiwordExpressionVocabularyRecord | SimpleVocabularyRecord;
export type LearnerFacingLexicalLabel = "Noun" | "Verb" | "Infinitive" | "Adjective" | "Adverb" | "Preposition" | "Conjunction" | "Pronoun" | "Numeral" | "Phrase" | "Sequence word" | "Classifier" | "Counter" | "Measure word";
export interface LearnerFacingLexicalDisplayRecord {
  readonly lexicalType: "noun" | "verb" | "adjective" | "adverb" | "preposition" | "conjunction" | "pronoun" | "numeral" | "phrase" | "sequence-word" | "classifier" | "counter" | "measure-word";
  readonly notesLabel: string;
  readonly surfaceForm: string;
  readonly citationForm: string;
  readonly infinitiveFormLine?: string;
  readonly infinitiveTranslation?: string;
  readonly infinitiveNotesLabel?: string;
  readonly infinitiveApplicable?: boolean;
  readonly infinitiveMappingUseful?: boolean;
}
export interface LexicalInventoryAuditResult {
  readonly newVocabularyCount: number;
  readonly newSenseIds: readonly string[];
  readonly reviewSenseIds: readonly string[];
  readonly warnings: readonly string[];
}
export interface LanguageLexicalPolicy {
  readonly language: string;
  readonly nounCategorySystem?: {
    readonly citationFormDefiniteArticles: readonly string[];
    readonly ambiguityForms?: readonly string[];
    readonly categoryMarkerLabels?: readonly string[];
  };
  readonly grammaticalMeasureExpressions?: boolean;
}

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

export interface CanonicalGrammarPatternRecord {
  readonly grammarId: string;
  readonly learnerFacingPattern?: string;
  readonly learnerFacingExplanation?: string;
  readonly developerDescription?: string;
  readonly components?: readonly string[];
  readonly indivisibleExpression?: boolean;
  readonly patternSource?: "learner-facing-pattern" | "developer-description";
}

export function formatGrammarPatternComponents(components: readonly string[]): string {
  if (components.length === 0 || components.some((component) => component.trim().length === 0)) {
    throw new Error("Grammar pattern components must be nonempty.");
  }
  return components.map((component) => component.trim()).join(" + ");
}

export function assertCanonicalGrammarPatternRecord(record: CanonicalGrammarPatternRecord): void {
  const pattern = record.learnerFacingPattern?.trim();
  if (pattern === undefined || pattern.length === 0) throw new Error(`${record.grammarId}: learner-facing grammar pattern is required.`);
  if (record.patternSource === "developer-description") throw new Error(`${record.grammarId}: Normal grammar pattern cannot fall back to developer description.`);
  if (record.developerDescription !== undefined && normalizeGrammarPattern(pattern) === normalizeGrammarPattern(record.developerDescription)) {
    throw new Error(`${record.grammarId}: learner-facing pattern must not be populated from the developer description.`);
  }
  if ((record.components?.length ?? 0) > 0) {
    if (record.indivisibleExpression) throw new Error(`${record.grammarId}: an indivisible expression must not also declare compositional components.`);
    const expected = formatGrammarPatternComponents(record.components ?? []);
    if (pattern !== expected) throw new Error(`${record.grammarId}: compositional learner-facing pattern must be ${expected}.`);
  }
}

export function assertGrammarSummaryPatternAgreement(
  easy: readonly CanonicalGrammarPatternRecord[],
  hard: readonly CanonicalGrammarPatternRecord[]
): void {
  for (const record of [...easy, ...hard]) assertCanonicalGrammarPatternRecord(record);
  const hardById = new Map(hard.map((record) => [record.grammarId, record.learnerFacingPattern?.trim()]));
  if (easy.length !== hard.length) throw new Error("Grammar Easy and Hard must contain the same grammar inventory.");
  for (const record of easy) {
    if (!hardById.has(record.grammarId)) throw new Error(`Grammar Hard is missing ${record.grammarId}.`);
    if (hardById.get(record.grammarId) !== record.learnerFacingPattern?.trim()) throw new Error(`${record.grammarId}: Grammar Easy and Hard patterns disagree.`);
  }
}

function normalizeGrammarPattern(value: string): string {
  return value.normalize("NFKC").replace(/\s+/gu, " ").trim().toLocaleLowerCase();
}

export interface LanguageCurriculumPolicy {
  readonly cumulativeContinuityRules: readonly string[];
  readonly activeCastRules: readonly string[];
  readonly lexicalFoundationRules: readonly string[];
  readonly normalViewVoiceRules: readonly string[];
  readonly grammarEasyRules: readonly string[];
  readonly grammarPatternDisplayRules: readonly string[];
  readonly pacingRules: readonly LanguageCurriculumPacingRule[];
  readonly chapterFormatRules: readonly string[];
  readonly numberContinuationRules: readonly string[];
  readonly chapterSizeRules: readonly LanguageCurriculumChapterSizeRule[];
  readonly unifiedGrammar3150Rules: readonly string[];
  readonly intensiveGrammar5170Rules: readonly string[];
  readonly expandedGrammarAndDiscourseRules: readonly string[];
  readonly broaderTopicDomains: readonly BroaderTopicDomain[];
  readonly grammarSummaryAfterChapters: readonly number[];
  readonly largeNumberCoverageRules: readonly LargeNumberCoverageRule[];
  readonly vocabularyContinuityRules: readonly string[];
  readonly reviewDeckRules: readonly string[];
  readonly strictExampleRules: readonly string[];
  readonly surfaceFormRules: readonly string[];
}

export const grammarEasyMenuLabel = "Grammar - Easy";
export const grammarHardMenuLabel = "Grammar - Hard";

export const languageCurriculumPolicy: LanguageCurriculumPolicy = {
  cumulativeContinuityRules: [
    "Every chapter through Chapter 140 inherits the complete curriculum state from Chapter 1 through the immediately preceding chapter.",
    "Five-chapter blocks, reviews, summaries, units, packages, and installation boundaries never reset cumulative curriculum identity or history."
  ],
  activeCastRules: [
    "Canonical-cast metadata declares one explicit versioned progression containing exactly thirty unique canonical person IDs.",
    "The active pool is the first min(30, 5 + 3 * floor((chapter - 1) / 20)) progression IDs.",
    "Previously active people remain active; Chapter 201 onward retains the same thirty people.",
    "Dialogue, narrative, metadata, and review cast IDs must be active; only meaningful learner-facing dialogue or narrative appearances satisfy block coverage.",
    "In each person's first activation block, that person appears meaningfully in at least five distinct ordinary chapters; duplicate lines in one chapter count once.",
    "In every completed activation block after Chapters 1-20, old cast supplies at least ceil(total meaningful canonical person-chapter appearances / 3).",
    "Chapter 201 onward permits lightly described functional incidental people without canonical IDs, but never a hidden second detailed cast.",
    "Builders prefer least-used suitable active people and audit severe imbalance without requiring exact equality.",
    "Only legacy-authorship records may remain pending legacy migration; newly authored violations are blocking."
  ],
  lexicalFoundationRules: [
    "Chapter 1 introduces citation-form definite articles and noun categories where the language has them, without inventing gender for languages that do not.",
    "This mandatory lexical-system guidance may coexist with the principal grammar point and does not automatically add a principal grammar ID.",
    "Applicable isolated learner-facing nouns use article-bearing citation forms and explicit category markers where elision or syncretism hides the category.",
    "Grammatical measure words, classifiers, and counters state concise semantic scope; transparent ordinary measure nouns remain simple vocabulary.",
    "Lexical identity uses stable entry and sense IDs, so identical surface forms may carry genuinely distinct senses or parts of speech without being merged.",
    "An encountered inflected verb form and its language-appropriate citation form are one lexical introduction; ordinary later inflections are reuse.",
    "Lexicalized multiword expressions have their own complete entry and sense; internal untaught morphology remains fixed or unanalyzed rather than implicitly productive.",
    "Review and reintroduction retain the original first-introduction chapter and do not count toward new-vocabulary quotas.",
    "Learner-facing vocabulary Notes use concise labels only and never expose internal lexical identity, citation, history, or morphology fields.",
    "Normal vocabulary Notes use accessible broad categories; Expert may use only concise grammatical subclasses supported by current authored or structured data, and Developer may retain raw fields.",
    "Unsupported Expert vocabulary subclasses are not invented, internal metadata stays hidden, and review decks are never rewritten merely to refine read-content Notes.",
    "Normal reading vocabulary lists hide the raw structured Usage field; necessary distinctions are rewritten as clear learner-facing prose.",
    "Where infinitives apply, a differing encountered verb form stays primary and is followed by a bare-infinitive row with a natural English infinitive and exactly Infinitive in Notes, in the same uninterrupted lexical entry.",
    "The infinitive row shares lexical and sense identity with the encountered row; languages without an applicable infinitive do not invent one, and full structured metadata remains internal.",
    "First-introduced verbs store canonical regularityStatus and optional language-specific verbClass; later forms and reviews inherit them.",
    "Use regular/irregular only where meaningful, not-applicable for systems such as ordinary Chinese, and undetermined only for pending legacy migration.",
    "Verb regularity/class survives package and memorization metadata but does not appear in learner-facing Notes."
  ],
  normalViewVoiceRules: [
    "Normal-view instructional prose uses direct address, neutral reference to the language/construction/example, or an ordinary imperative.",
    "Normal view does not label the reader as the learner, learners, the student, students, the user, or another detached third-person role.",
    "Genuine people in dialogue, narrative, and quoted examples are not reader labels and remain unchanged.",
    "Developer view may retain complete original authoring, validator, and technical wording in structurally classified developer-only content."
  ],
  grammarEasyRules: [
    "Grammar Easy addresses the learner directly using language understandable at roughly US grade levels 4-8.",
    "Grammar Easy uses short, concrete explanations and examples, avoids detached reader labels such as the learner, learners, the student, students, or the user, and remains technically accurate.",
    "Grammar Easy and Grammar Hard use the same canonical grammar ID and exact learner-facing pattern for every shared point."
  ],
  grammarPatternDisplayRules: [
    "Every visible top-level grammar section in Normal, Expert, and Developer is named exactly Grammar; Developer distinguishes both variants only with internal Normal and Expert labels.",
    "Grammar ID, learner-facing pattern, learner-facing explanation, and developer description remain separate structured fields.",
    "Chapter and Easy/Hard inventories display the learner-facing pattern and never fall back to a developer description.",
    "Easy and Hard use the same canonical learner-facing pattern for each shared grammar ID.",
    "Declared compositional components render with exactly one space on both sides of +; fixed indivisible expressions remain whole."
  ],
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
      label: "Chapters 26-30",
      chapterStart: 26,
      chapterEnd: 30,
      grammarPoints: { min: 1, max: 2 },
      readContentLines: { min: 10, max: 30 },
      newVocabularyItems: { min: 6, max: 20 }
    },
    {
      label: "Chapters 31-50",
      chapterStart: 31,
      chapterEnd: 50,
      grammarPoints: { min: 2, max: 2 },
      readContentLines: { min: 10, max: 30 },
      newVocabularyItems: { min: 6, max: 20 }
    },
    {
      label: "Chapters 51-70",
      chapterStart: 51,
      chapterEnd: 70,
      grammarPoints: { min: 2, max: 2 },
      readContentLines: { min: 15, max: 30 },
      newVocabularyItems: { min: 10, max: 30 }
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
  unifiedGrammar3150Rules: [
    "Every Chapter 31-50 introduces exactly two genuinely new principal grammar IDs.",
    "Exactly one principal point is a connector, conjunction, linking form, sequencing construction, or comparable discourse-linking point.",
    "Exactly one principal point belongs to a different broad grammatical domain; two connector-domain points fail.",
    "Reused grammar satisfies neither point and supporting variants or morphology do not increase the count.",
    "Each chapter retains 6-20 genuinely new vocabulary items, 10-30 learner-facing lines, topic-centered content, and odd dialogue / even narrative."
  ],
  intensiveGrammar5170Rules: [
    "Every Chapter 51-70 introduces exactly two genuinely new principal grammar points; zero, one, or three or more fail.",
    "The main domains are language-appropriate tense, time reference, aspect, event structure, mood, and modality.",
    "Both points are pedagogically compatible and subordinate to coherent topic-centered content.",
    "Supporting morphology, agreement, pronunciation, spelling, and required inflectional variants do not count separately.",
    "Previously introduced or reused grammar satisfies neither required new point.",
    "Do not force English-style tense categories onto languages organized differently or pair two extreme distinctions from one narrow subsystem unless the language requires it.",
    "Chapters 31-70 form the steepest grammar-acquisition section; Chapter 71 transitions to exactly one new principal point with deeper integration."
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
  reviewDeckRules: [
    "One normal vocabulary review deck follows every completed consecutive five-chapter block.",
    "The deck contains exactly one card for every vocabulary item or lexical sense first introduced in that block; there is no fixed card count.",
    "Reused vocabulary retains its original first-introduction chapter and is not added again as new in a later block.",
    "Every normal card prompts in the target language and answers in the source language, with no reverse duplicate.",
    "Normal vocabulary decks contain no grammar, comprehension, cloze, multiple-choice, production, or distractor-based questions.",
    "Normal learner-facing five-chapter review decks hide the raw structured Notes field while retaining it for authoring, validation, provenance, migrations, and debugging."
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

export function pacingRuleForChapter(chapter: number): LanguageCurriculumPacingRule {
  assertPositiveIntegerChapter(chapter);
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
  assertInRange(values.grammarPointCount, rule.grammarPoints, `Chapter ${values.chapter} grammar point count`);
  assertInRange(values.readContentLineCount, rule.readContentLines, `Chapter ${values.chapter} read-content line count`);
  assertInRange(values.newVocabularyItemCount, rule.newVocabularyItems, `Chapter ${values.chapter} new vocabulary item count`);
}

export function assertLanguageCurriculumChapter3150Requirements(
  chapters: readonly LanguageCurriculumChapterSource[]
): readonly LanguageCurriculumChapter3150ValidationResult[] {
  const chapterSources = [...chapters]
    .filter((chapter) => Number.isInteger(chapter.chapter) && chapter.chapter >= 1)
    .sort((left, right) => left.chapter - right.chapter);
  const previouslyIntroducedVocabulary = new Set<string>();
  const previouslyIntroducedGrammar = new Set<string>();
  const results: LanguageCurriculumChapter3150ValidationResult[] = [];

  for (const source of chapterSources) {
    const vocabularyEntries = declaredLearnerFacingVocabulary(source.markdown);
    const newVocabulary = new Set(vocabularyEntries.map(vocabularyKey).filter((key) => key !== "" && !previouslyIntroducedVocabulary.has(key)));
    const grammarEntries = declaredGrammarEntries(source.markdown);
    const newPrincipalGrammar = grammarEntries.filter((entry) => entry.kind === "principal" && entry.key !== "" && !previouslyIntroducedGrammar.has(entry.key));

    if (source.chapter >= 31 && source.chapter <= 50) {
      const readContent = learnerFacingReadContent(source.markdown);
      const expectedFormat = source.chapter % 2 === 1 ? "dialogue" : "narrative";
      const connectorCount = newPrincipalGrammar.filter(isConnectorGrammarEntry).length;
      assertInRange(newPrincipalGrammar.length, { min: 2, max: 2 }, `Chapter ${source.chapter} new principal grammar point count`);
      assertInRange(connectorCount, { min: 1, max: 1 }, `Chapter ${source.chapter} connector-domain principal grammar point count`);
      assertInRange(newVocabulary.size, { min: 6, max: 20 }, `Chapter ${source.chapter} new learner-facing vocabulary item count`);
      assertInRange(readContent.lines.length, { min: 10, max: 30 }, `Chapter ${source.chapter} learner-facing dialogue or narrative line count`);
      if (readContent.format !== expectedFormat) throw new Error(`Chapter ${source.chapter} must use learner-facing ${expectedFormat} content; detected ${readContent.format}.`);
      results.push({
        chapter: source.chapter,
        newPrincipalGrammarPointCount: newPrincipalGrammar.length,
        connectorPrincipalGrammarPointCount: connectorCount,
        newVocabularyItemCount: newVocabulary.size,
        learnerFacingReadContentLineCount: readContent.lines.length,
        format: readContent.format
      });
    }

    for (const entry of vocabularyEntries) previouslyIntroducedVocabulary.add(vocabularyKey(entry));
    for (const entry of grammarEntries) {
      if (entry.kind === "principal" || entry.kind === "reused" || entry.kind === "legacy") previouslyIntroducedGrammar.add(entry.key);
    }
  }
  return results;
}

export function assertLanguageCurriculumChapter5170Requirements(
  chapters: readonly LanguageCurriculumChapterSource[]
): readonly LanguageCurriculumChapter5170ValidationResult[] {
  const chapterSources = [...chapters]
    .filter((chapter) => Number.isInteger(chapter.chapter) && chapter.chapter >= 1)
    .sort((left, right) => left.chapter - right.chapter);
  const previouslyIntroducedVocabulary = new Set<string>();
  const previouslyIntroducedGrammar = new Set<string>();
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
    const grammarEntries = declaredGrammarEntries(source.markdown);
    const newPrincipalGrammar = new Set(grammarEntries
      .filter((entry) => entry.kind === "principal")
      .map((entry) => entry.key)
      .filter((key) => key !== "" && !previouslyIntroducedGrammar.has(key)));

    if (source.chapter >= 51 && source.chapter <= 70) {
      const rule = languageCurriculumPolicy.chapterSizeRules[0];
      const readContent = learnerFacingReadContent(source.markdown);
      const expectedFormat = source.chapter % 2 === 1 ? "dialogue" : "narrative";
      const result: LanguageCurriculumChapter5170ValidationResult = {
        chapter: source.chapter,
        newPrincipalGrammarPointCount: newPrincipalGrammar.size,
        newVocabularyItemCount: newVocabulary.size,
        learnerFacingReadContentLineCount: readContent.lines.length,
        format: readContent.format
      };
      assertInRange(result.newPrincipalGrammarPointCount, { min: 2, max: 2 }, `Chapter ${source.chapter} new principal grammar point count`);
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
    for (const entry of grammarEntries) {
      if (entry.kind === "principal" || entry.kind === "reused" || entry.kind === "legacy") previouslyIntroducedGrammar.add(entry.key);
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

type DeclaredGrammarEntry = { readonly kind: "principal" | "supporting" | "reused" | "legacy"; readonly key: string; readonly description: string };

function declaredGrammarEntries(markdown: string): readonly DeclaredGrammarEntry[] {
  const entries: DeclaredGrammarEntry[] = [];
  let inGrammarSection = false;
  for (const rawLine of markdown.replace(/\r\n?/gu, "\n").split("\n")) {
    const line = rawLine.trim();
    if (/^#{2,4}\s+(?:.*\/\s+)?New Grammar(?:\s*\/\s*Pattern)?\s*$/iu.test(line)) {
      inGrammarSection = true;
      continue;
    }
    if (/^#{2,3}\s+/u.test(line)) {
      inGrammarSection = false;
      continue;
    }
    if (!inGrammarSection) continue;
    const match = line.match(/^[-*]\s+(Principal|Supporting|Reused)\s*:\s*([^|]+?)(?:\s*\|\s*(.*))?$/iu);
    if (match !== null) {
      entries.push({ kind: match[1].toLocaleLowerCase() as DeclaredGrammarEntry["kind"], key: grammarKey(match[2]), description: match[3]?.trim() ?? "" });
      continue;
    }
    const legacy = line.match(/^`([^`]+?)(?:\s+--\s+[^`]*)?`$/u);
    if (legacy !== null) entries.push({ kind: "legacy", key: grammarKey(legacy[1]), description: "" });
  }
  return entries;
}

function isConnectorGrammarEntry(entry: DeclaredGrammarEntry): boolean {
  return /^(?:connector|conjunction|linking form|sequencing construction|discourse[- ]linking(?: point| form)?)\s*:/iu.test(entry.description);
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
  const normalized = markdown.replace(/\r\n?/gu, "\n");
  const heading = /^#{2,4}\s+(Dialogue|Narrative|對話(?:\s*\/\s*Learner-facing Dialogue)?|Learner-facing Dialogue|Model Dialogue|Model Mini Dialogue|閱讀短文(?:\s*\/\s*Learner-facing Controlled Reading)?|Learner-facing Controlled Reading|Controlled Reading|Model Mini Text)\s*$/gimu;
  const match = heading.exec(normalized);
  if (match === null) return { format: "missing", lines: [] };
  const label = match[1];
  const format: "dialogue" | "narrative" = /Dialogue|對話/iu.test(label) ? "dialogue" : "narrative";
  const start = match.index + match[0].length;
  const rest = normalized.slice(start);
  const nextHeading = rest.search(/^#{2,4}\s+/mu);
  const section = (nextHeading < 0 ? rest : rest.slice(0, nextHeading)).trim();
  const blocks = section.split(/\n\s*\n/u).filter(Boolean);
  const hasCanonicalContextIntroduction = /^(?:Dialogue|Narrative)$/iu.test(label);
  const body = hasCanonicalContextIntroduction && blocks.length > 1 ? blocks.slice(1) : blocks;
  if (format === "dialogue") {
    return { format, lines: body.join("\n").split("\n").map((line) => line.trim()).filter((line) => line !== "" && !/^[-*_]{3,}$/u.test(line) && !/^([^:]{1,40}):\s*$/u.test(line)) };
  }
  const segmenter = new Intl.Segmenter("nl", { granularity: "sentence" });
  return { format, lines: body.flatMap((paragraph) => [...segmenter.segment(paragraph)].map(({ segment }) => segment.trim()).filter(Boolean)) };
}

export function activeCastSizeForChapter(chapter: number): number {
  assertPositiveIntegerChapter(chapter);
  return Math.min(canonicalCastSize, 5 + activeCastExpansionSize * Math.floor((chapter - 1) / activeCastBlockSize));
}

export function assertActiveCastProgression(canonicalPersonIds: readonly string[], progression: readonly string[]): void {
  if (canonicalPersonIds.length !== canonicalCastSize || new Set(canonicalPersonIds).size !== canonicalCastSize) {
    throw new Error(`Canonical cast must contain exactly ${canonicalCastSize} unique person IDs.`);
  }
  if (progression.length !== canonicalCastSize) {
    throw new Error(`Active-cast progression must contain exactly ${canonicalCastSize} IDs; got ${progression.length}.`);
  }
  const canonical = new Set(canonicalPersonIds);
  const seen = new Set<string>();
  const unknown: string[] = [];
  for (const id of progression) {
    if (seen.has(id)) throw new Error(`Active-cast progression contains duplicate person ID ${id}.`);
    seen.add(id);
    if (!canonical.has(id)) unknown.push(id);
  }
  const omitted = canonicalPersonIds.filter((id) => !seen.has(id));
  if (unknown.length > 0 || omitted.length > 0) {
    throw new Error(`Active-cast progression${unknown.length > 0 ? ` references unknown canonical person ID ${unknown[0]}` : ""}${unknown.length > 0 && omitted.length > 0 ? " and" : ""}${omitted.length > 0 ? ` omits canonical person ID ${omitted[0]}` : ""}.`);
  }
}

export function activePersonIdsForChapter(chapter: number, progression: readonly string[]): readonly string[] {
  if (progression.length !== canonicalCastSize || new Set(progression).size !== canonicalCastSize) {
    throw new Error(`Active-cast progression must contain exactly ${canonicalCastSize} unique IDs before calculating an active pool.`);
  }
  return progression.slice(0, activeCastSizeForChapter(chapter));
}

export function leastUsedSuitableActivePersonIds(values: {
  readonly chapter: number;
  readonly progression: readonly string[];
  readonly cumulativeAppearances: Readonly<Record<string, number>>;
  readonly suitablePersonIds?: readonly string[];
  readonly count: number;
}): readonly string[] {
  if (!Number.isInteger(values.count) || values.count < 1) throw new Error("Active-cast selection count must be a positive integer.");
  const active = activePersonIdsForChapter(values.chapter, values.progression);
  const suitable = new Set(values.suitablePersonIds ?? active);
  const candidates = active.filter((id) => suitable.has(id));
  if (candidates.length < values.count) throw new Error(`Only ${candidates.length} suitable active people are available; ${values.count} requested.`);
  const order = new Map(values.progression.map((id, index) => [id, index]));
  return candidates.sort((left, right) =>
    (values.cumulativeAppearances[left] ?? 0) - (values.cumulativeAppearances[right] ?? 0)
      || (order.get(left) ?? 0) - (order.get(right) ?? 0)
  ).slice(0, values.count);
}

export function auditActiveCast(values: {
  readonly canonicalPersonIds: readonly string[];
  readonly progression: readonly string[];
  readonly chapters: readonly ActiveCastChapterRecord[];
}): ActiveCastAuditResult {
  assertActiveCastProgression(values.canonicalPersonIds, values.progression);
  const canonical = new Set(values.canonicalPersonIds);
  const appearancesByChapter: Record<number, Record<string, number>> = {};
  const cumulativeAppearances: Record<string, number> = Object.fromEntries(values.canonicalPersonIds.map((id) => [id, 0]));
  const pendingChapters: number[] = [];
  const pendingCoverageBlocks: string[] = [];
  const chapterIds = new Map<number, Set<string>>();
  const suppliedChapters = new Set(values.chapters.map((record) => record.chapter));

  for (const record of [...values.chapters].sort((left, right) => left.chapter - right.chapter)) {
    assertPositiveIntegerChapter(record.chapter);
    if (record.migrationStatus === "pending-legacy-migration" && record.authorship !== "legacy") {
      throw new Error(`Chapter ${record.chapter}: newly authored content cannot be marked pending legacy migration.`);
    }
    const active = new Set(activePersonIdsForChapter(record.chapter, values.progression));
    const declared = [
      ...(record.participatingPersonIds ?? []),
      ...(record.dialogueSpeakerIds ?? []),
      ...(record.narrativePersonIds ?? []),
      ...(record.meaningfulPersonIds ?? []),
      ...(record.reviewPersonIds ?? [])
    ];
    for (const id of declared) if (!canonical.has(id)) throw new Error(`Chapter ${record.chapter}: unknown canonical person ID ${id}.`);
    const used = new Set(declared);
    const inactive = [...used].filter((id) => !active.has(id));
    if (inactive.length > 0) {
      if (record.migrationStatus === "pending-legacy-migration" && record.authorship === "legacy") pendingChapters.push(record.chapter);
      else throw new Error(`Chapter ${record.chapter}: inactive canonical person ${inactive[0]} appears before activation.`);
    }
    if (record.reviewPersonIds?.length) {
      const sources = record.reviewSourceChapters ?? [];
      if (sources.length === 0) throw new Error(`Chapter ${record.chapter}: review cast requires reviewSourceChapters.`);
      const sourcePeople = new Set(sources.flatMap((chapter) => [...(chapterIds.get(chapter) ?? [])]));
      for (const id of record.reviewPersonIds) {
        if (!sourcePeople.has(id)) throw new Error(`Chapter ${record.chapter}: review person ${id} was not active in a declared source chapter.`);
      }
    }
    for (const person of record.incidentalPeople ?? []) assertIncidentalRoleCharacter(record.chapter, person);
    const counts: Record<string, number> = {};
    for (const id of new Set(record.meaningfulPersonIds ?? [])) {
      counts[id] = 1;
      cumulativeAppearances[id] += 1;
    }
    appearancesByChapter[record.chapter] = counts;
    chapterIds.set(record.chapter, used);
  }

  const blocks: ActiveCastAppearanceBlock[] = [];
  const warnings: string[] = [];
  const lastChapter = Math.max(0, ...values.chapters.map((chapter) => chapter.chapter));
  for (let chapterStart = 1; chapterStart <= lastChapter; chapterStart += activeCastBlockSize) {
    const chapterEnd = chapterStart + activeCastBlockSize - 1;
    const coverageStatus = Array.from({ length: activeCastBlockSize }, (_, index) => chapterStart + index)
      .every((chapter) => suppliedChapters.has(chapter)) ? "complete" : "pending";
    const appearancesByPersonId: Record<string, number> = {};
    for (let chapter = chapterStart; chapter <= chapterEnd; chapter += 1) {
      for (const [id, count] of Object.entries(appearancesByChapter[chapter] ?? {})) appearancesByPersonId[id] = (appearancesByPersonId[id] ?? 0) + count;
    }
    const report = activeCastBlockReport({ chapterStart, progression: values.progression, appearancesByChapter, suppliedChapters });
    const requiredNewPersonIds = report.activationPeople.map((person) => person.canonicalId);
    const missingNewPersonIds = report.activationPeople.filter((person) => person.remainingCount > 0).map((person) => person.canonicalId);
    if (coverageStatus === "pending") pendingCoverageBlocks.push(`${chapterStart}-${chapterEnd}`);
    else {
      const failedPerson = report.activationPeople.find((person) => person.status === "failed");
      if (failedPerson !== undefined) throw new Error(`Chapters ${chapterStart}-${chapterEnd}: newly activated person ${failedPerson.canonicalId} has ${failedPerson.distinctQualifyingChapterCount} distinct meaningful chapter appearances; 5 required.`);
      if (report.distributionStatus === "failed") throw new Error(`Chapters ${chapterStart}-${chapterEnd}: old cast has ${report.oldCastAppearanceCount} of ${report.totalCanonicalAppearanceCount} distinct person-chapter appearances; at least ${report.requiredMinimumOldCastCount} required.`);
    }
    if (coverageStatus === "pending" && report.distributionOnTrack === false) warnings.push(`Chapters ${chapterStart}-${chapterEnd}: pending old-cast distribution is below one third and may be difficult to recover without prompt older-cast use.`);
    blocks.push({ chapterStart, chapterEnd, appearancesByPersonId, coverageStatus, requiredNewPersonIds, missingNewPersonIds, ...report });
    const counts = activePersonIdsForChapter(chapterStart, values.progression).map((id) => appearancesByPersonId[id] ?? 0);
    const total = counts.reduce((sum, count) => sum + count, 0);
    const min = Math.min(...counts);
    const max = Math.max(...counts);
    if (total >= counts.length * 2 && max >= Math.max(6, min * 3)) {
      warnings.push(`Chapters ${chapterStart}-${chapterEnd}: severe active-cast appearance imbalance (minimum ${min}, maximum ${max}).`);
    }
  }
  const appearedCounts = Object.values(cumulativeAppearances).filter((count) => count > 0);
  if (lastChapter >= 100 && appearedCounts.length > 1 && Math.max(...appearedCounts) >= Math.max(20, Math.min(...appearedCounts) * 8)) {
    warnings.push(`Chapters 1-${lastChapter}: strong long-term canonical-cast appearance imbalance.`);
  }
  return {
    status: pendingChapters.length > 0 ? "pending-legacy-migration" : "compliant",
    appearancesByChapter,
    blocks,
    cumulativeAppearances,
    warnings,
    pendingChapters,
    pendingCoverageBlocks
  };
}

export function activeCastBlockReport(values: {
  readonly chapterStart: number;
  readonly progression: readonly string[];
  readonly appearancesByChapter: Readonly<Record<number, Readonly<Record<string, number>>>>;
  readonly suppliedChapters: ReadonlySet<number>;
}): Omit<ActiveCastAppearanceBlock, "chapterStart" | "chapterEnd" | "appearancesByPersonId" | "coverageStatus" | "requiredNewPersonIds" | "missingNewPersonIds"> {
  const chapterStart = values.chapterStart;
  if (chapterStart < 1 || (chapterStart - 1) % activeCastBlockSize !== 0) throw new Error(`Activation block must start at Chapter 1 or a later twenty-chapter boundary: ${chapterStart}.`);
  const chapterEnd = chapterStart + activeCastBlockSize - 1;
  const complete = Array.from({ length: activeCastBlockSize }, (_, index) => chapterStart + index).every((chapter) => values.suppliedChapters.has(chapter));
  if (chapterStart > 200) return { activationPeople: [], oldCastAppearanceCount: 0, newCastAppearanceCount: 0, totalCanonicalAppearanceCount: 0, requiredMinimumOldCastCount: 0, oldCastPercentage: null, distributionOnTrack: "not-applicable", distributionStatus: "not-applicable" };
  const current = activePersonIdsForChapter(chapterStart, values.progression);
  const previousCount = chapterStart === 1 ? 0 : activeCastSizeForChapter(chapterStart - 1);
  const oldIds = new Set(current.slice(0, previousCount));
  const newIds = new Set(current.slice(previousCount));
  const qualifyingChapters = (id: string) => Array.from({ length: activeCastBlockSize }, (_, index) => chapterStart + index)
    .filter((chapter) => (values.appearancesByChapter[chapter]?.[id] ?? 0) > 0);
  const activationPeople: ActivationPersonAppearanceReport[] = [...newIds].map((canonicalId) => {
    const chapters = qualifyingChapters(canonicalId);
    const remainingCount = Math.max(0, 5 - chapters.length);
    return { canonicalId, activationChapter: chapterStart, activationBlock: `${chapterStart}-${chapterEnd}`, qualifyingChapterNumbers: chapters, distinctQualifyingChapterCount: chapters.length, requiredCount: 5, remainingCount, status: complete ? (remainingCount === 0 ? "passed" : "failed") : "pending" };
  });
  let oldCastAppearanceCount = 0;
  let newCastAppearanceCount = 0;
  for (let chapter = chapterStart; chapter <= chapterEnd; chapter += 1) {
    for (const id of Object.keys(values.appearancesByChapter[chapter] ?? {})) {
      if (oldIds.has(id)) oldCastAppearanceCount += 1;
      else if (newIds.has(id)) newCastAppearanceCount += 1;
    }
  }
  const totalCanonicalAppearanceCount = oldCastAppearanceCount + newCastAppearanceCount;
  const requiredMinimumOldCastCount = chapterStart === 1 ? 0 : Math.ceil(totalCanonicalAppearanceCount / 3);
  const oldCastPercentage = totalCanonicalAppearanceCount === 0 ? 0 : oldCastAppearanceCount / totalCanonicalAppearanceCount;
  if (chapterStart === 1) return { activationPeople, oldCastAppearanceCount, newCastAppearanceCount, totalCanonicalAppearanceCount, requiredMinimumOldCastCount, oldCastPercentage: null, distributionOnTrack: "not-applicable", distributionStatus: "not-applicable" };
  const ratioPasses = oldCastAppearanceCount >= requiredMinimumOldCastCount;
  return { activationPeople, oldCastAppearanceCount, newCastAppearanceCount, totalCanonicalAppearanceCount, requiredMinimumOldCastCount, oldCastPercentage, distributionOnTrack: ratioPasses, distributionStatus: complete ? (ratioPasses ? "passed" : "failed") : "pending" };
}

export function assertIncidentalRoleCharacter(chapter: number, person: IncidentalRoleCharacter): void {
  assertPositiveIntegerChapter(chapter);
  if (chapter < 201) throw new Error(`Chapter ${chapter}: unrestricted incidental fictional people are permitted only from Chapter 201 onward.`);
  const unsafe = person as unknown as Record<string, unknown>;
  if (typeof unsafe.canonicalPersonId === "string") throw new Error(`Chapter ${chapter}: incidental person ${person.nameOrRole} must not receive a canonical ID.`);
  for (const field of ["biography", "relationshipPersonIds", "recurringStoryline", "detailedPersonalityTraits"] as const) {
    const value = unsafe[field];
    if (value !== undefined && value !== "" && (!Array.isArray(value) || value.length > 0)) {
      throw new Error(`Chapter ${chapter}: incidental person ${person.nameOrRole} has canonical-style ${field} metadata.`);
    }
  }
  if (person.lightlyDescribed !== true || person.nameOrRole.trim() === "" || person.function.trim() === "") {
    throw new Error(`Chapter ${chapter}: incidental people must remain lightly described and functional.`);
  }
}

export function assertChapterOneLexicalFoundation(values: {
  readonly policy: LanguageLexicalPolicy;
  readonly chapter: number;
  readonly introducedDefiniteArticles?: readonly string[];
  readonly explainsNounCategories?: boolean;
  readonly explainsLearningNounsWithArticle?: boolean;
  readonly explainsAmbiguityMarkers?: boolean;
  readonly principalGrammarPointIds: readonly string[];
}): void {
  if (values.chapter !== 1 || values.policy.nounCategorySystem === undefined) return;
  const system = values.policy.nounCategorySystem;
  const introduced = new Set(values.introducedDefiniteArticles ?? []);
  for (const article of system.citationFormDefiniteArticles) if (!introduced.has(article)) throw new Error(`Chapter 1 ${values.policy.language}: missing required definite article ${article}.`);
  if (!values.explainsNounCategories || !values.explainsLearningNounsWithArticle) throw new Error(`Chapter 1 ${values.policy.language}: noun categories and learning nouns with their article must be explained.`);
  if ((system.ambiguityForms?.length ?? 0) > 0 && !values.explainsAmbiguityMarkers) throw new Error(`Chapter 1 ${values.policy.language}: ambiguity-marker guidance is required.`);
  if (values.principalGrammarPointIds.length !== 1) throw new Error(`Chapter 1 ${values.policy.language}: lexical foundation must not change the principal grammar point count.`);
}

export function assertLearnerFacingVocabularyRecord(record: LearnerFacingVocabularyRecord, policy: LanguageLexicalPolicy): void {
  if (record.lexicalType === "noun" && policy.nounCategorySystem !== undefined) {
    if (!record.definiteArticle || !policy.nounCategorySystem.citationFormDefiniteArticles.includes(record.definiteArticle)) throw new Error(`${policy.language} noun ${record.lemma}: missing required citation-form definite article.`);
    if (!record.learnerFacingForm.startsWith(`${record.definiteArticle} `) && !record.learnerFacingForm.startsWith(record.definiteArticle)) throw new Error(`${policy.language} noun ${record.lemma}: learner-facing form must include its definite article.`);
    if (record.explicitCategoryMarkerRequired && (!record.grammaticalCategory || !record.learnerFacingForm.endsWith(`(${record.grammaticalCategory})`))) throw new Error(`${policy.language} noun ${record.lemma}: missing required ambiguity marker.`);
  }
  if (record.lexicalType === "measure-expression") {
    if (!policy.grammaticalMeasureExpressions) throw new Error(`${record.lexicalForm}: transparent or non-grammatical measure expressions must remain simple vocabulary.`);
    if (record.semanticScope.trim() === "") throw new Error(`${record.lexicalForm}: grammatical ${record.grammaticalType} requires semantic scope.`);
    if (record.grammaticalType === "MW" && /(?:^|\s)M(?:\s|:|$)/u.test(record.learnerFacingForm)) throw new Error(`${record.lexicalForm}: use MW for measure word; M is reserved for masculine gender.`);
  }
  if (hasCanonicalLexicalIdentity(record)) assertCanonicalLexicalRecord(record);
}

export function assertLearnerFacingLexicalDisplay(record: LearnerFacingLexicalDisplayRecord): void {
  const expectedLabels: Readonly<Record<LearnerFacingLexicalDisplayRecord["lexicalType"], LearnerFacingLexicalLabel>> = {
    noun: "Noun", verb: "Verb", adjective: "Adjective", adverb: "Adverb", preposition: "Preposition", conjunction: "Conjunction", pronoun: "Pronoun", numeral: "Numeral", phrase: "Phrase",
    "sequence-word": "Sequence word", classifier: "Classifier", counter: "Counter", "measure-word": "Measure word"
  };
  if (record.notesLabel !== expectedLabels[record.lexicalType]) throw new Error(`Learner-facing Notes for ${record.surfaceForm} must be exactly ${expectedLabels[record.lexicalType]}.`);
  if (/(?:lemma|lexical|sense\s*id|surface[- ]form|citation[- ]form|first[- ]introduction|attestation|morphology)/iu.test(record.notesLabel)) throw new Error(`Learner-facing Notes for ${record.surfaceForm} expose internal lexical metadata.`);
  const needsInfinitive = record.lexicalType === "verb" && record.infinitiveApplicable !== false && record.surfaceForm !== record.citationForm && record.infinitiveMappingUseful !== false;
  if (needsInfinitive && record.infinitiveFormLine !== record.citationForm) throw new Error(`${record.surfaceForm}: differing encountered verb form must show bare infinitive ${record.citationForm}.`);
  if (needsInfinitive && (record.infinitiveTranslation === undefined || record.infinitiveTranslation.trim() === "")) throw new Error(`${record.surfaceForm}: infinitive row requires a natural English infinitive translation.`);
  if (needsInfinitive && record.infinitiveNotesLabel !== "Infinitive") throw new Error(`${record.surfaceForm}: infinitive row Notes must be exactly Infinitive.`);
  if (!needsInfinitive && (record.infinitiveFormLine !== undefined || record.infinitiveTranslation !== undefined || record.infinitiveNotesLabel !== undefined)) throw new Error(`${record.surfaceForm}: omit the infinitive row when no useful or applicable mapping is required.`);
}

export function assertCanonicalLexicalRecord(record: CanonicalLexicalRecord): void {
  for (const [field, value] of Object.entries({ lexicalEntryId: record.lexicalEntryId, senseId: record.senseId, surfaceForm: record.surfaceForm, lemma: record.lemma, citationForm: record.citationForm, partOfSpeech: record.partOfSpeech, meaning: record.meaning })) {
    if (typeof value !== "string" || value.trim() === "") throw new Error(`Canonical lexical record requires non-empty ${field}.`);
  }
  assertPositiveIntegerChapter(record.firstIntroductionChapter);
  if (record.lexicalType === "verb") {
    if (record.encounteredForms.length === 0 || !record.encounteredForms.includes(record.surfaceForm)) throw new Error(`${record.lexicalEntryId}: verb encounteredForms must include the introduced surface form.`);
    if (record.surfaceForm !== record.citationForm && record.citationForm.trim() === "") throw new Error(`${record.lexicalEntryId}: inflected verb requires an infinitive or other applicable citation form.`);
    if (!["regular", "irregular", "not-applicable", "undetermined"].includes(record.regularityStatus)) throw new Error(`${record.lexicalEntryId}: verb requires canonical regularityStatus.`);
    if (record.regularityStatus === "undetermined" && record.regularityMigrationStatus !== "pending-legacy-migration") throw new Error(`${record.lexicalEntryId}: undetermined verb regularity is permitted only for pending legacy migration.`);
    if (record.verbClass !== undefined && record.verbClass.trim() === "") throw new Error(`${record.lexicalEntryId}: verbClass must be non-empty when supplied.`);
    if (record.regularityCorrectionAudit !== undefined && record.regularityCorrectionAudit.trim() === "") throw new Error(`${record.lexicalEntryId}: regularity correction audit must be non-empty when supplied.`);
  }
  if (record.lexicalType === "multiword-expression") {
    if (!record.multiwordExpression || !/\s/u.test(record.citationForm)) throw new Error(`${record.lexicalEntryId}: idiom or fixed expression must be stored under its complete multiword citation form.`);
    if (record.componentLexicalEntryIds?.includes(record.lexicalEntryId)) throw new Error(`${record.lexicalEntryId}: a multiword expression cannot be represented only as one of its component entries.`);
    if (record.introducesProductiveMorphology === true && (record.morphologyStatus === "fixed-or-unanalyzed" || record.morphologyStatus === "not-yet-taught")) throw new Error(`${record.lexicalEntryId}: fixed expression internal morphology cannot introduce an untaught productive grammar rule.`);
  }
  if (["review", "reintroduced", "previously-introduced", "reuse"].includes(record.introductionStatus) && record.attestationChapters?.includes(record.firstIntroductionChapter) === false && (record.attestationChapters?.length ?? 0) > 0) {
    // The original chapter remains authoritative even when later attestations omit it.
  }
}

export function auditLexicalInventory(records: readonly CanonicalLexicalRecord[]): LexicalInventoryAuditResult {
  const senseDefinitions = new Map<string, { entryId: string; meaning: string; firstChapter: number }>();
  const identityByEntryAndMeaning = new Map<string, string>();
  const newlyCounted = new Set<string>();
  const newSenseIds: string[] = [];
  const reviewSenseIds: string[] = [];
  const warnings: string[] = [];
  const verbClassificationBySense = new Map<string, { regularityStatus: VerbRegularityStatus; verbClass?: string }>();
  for (const record of records) {
    assertCanonicalLexicalRecord(record);
    const existing = senseDefinitions.get(record.senseId);
    if (existing !== undefined && (existing.entryId !== record.lexicalEntryId || normalizeLexicalMeaning(existing.meaning) !== normalizeLexicalMeaning(record.meaning))) throw new Error(`Sense ID ${record.senseId} is shared by unrelated lexical senses.`);
    if (existing !== undefined && existing.firstChapter !== record.firstIntroductionChapter) throw new Error(`Sense ${record.senseId} must retain first-introduction Chapter ${existing.firstChapter}.`);
    senseDefinitions.set(record.senseId, { entryId: record.lexicalEntryId, meaning: record.meaning, firstChapter: record.firstIntroductionChapter });
    const entryMeaningKey = `${record.lexicalEntryId}\u0000${record.partOfSpeech}\u0000${normalizeLexicalMeaning(record.meaning)}`;
    const existingSenseForEntryMeaning = identityByEntryAndMeaning.get(entryMeaningKey);
    if (existingSenseForEntryMeaning !== undefined && existingSenseForEntryMeaning !== record.senseId) throw new Error(`${record.lexicalEntryId}: ordinary forms of one lexical meaning cannot be counted under separate sense IDs ${existingSenseForEntryMeaning} and ${record.senseId}.`);
    identityByEntryAndMeaning.set(entryMeaningKey, record.senseId);
    if (record.lexicalType === "verb") {
      const established = verbClassificationBySense.get(record.senseId);
      if (established !== undefined && (established.regularityStatus !== record.regularityStatus || established.verbClass !== record.verbClass)) {
        if (!record.regularityCorrectionAudit) throw new Error(`${record.senseId}: verb regularity/class must inherit the established ${established.regularityStatus}${established.verbClass ? ` (${established.verbClass})` : ""}.`);
        warnings.push(`${record.senseId}: verb regularity/class correction audited: ${record.regularityCorrectionAudit}`);
      } else if (established === undefined) verbClassificationBySense.set(record.senseId, { regularityStatus: record.regularityStatus, ...(record.verbClass === undefined ? {} : { verbClass: record.verbClass }) });
    }
    const isNew = ["new-entry", "new-sense", "new-part-of-speech", "new-multiword-expression"].includes(record.introductionStatus);
    if (isNew) {
      if (newlyCounted.has(record.senseId)) throw new Error(`Sense ${record.senseId} is counted as newly introduced more than once.`);
      newlyCounted.add(record.senseId);
      newSenseIds.push(record.senseId);
    } else reviewSenseIds.push(record.senseId);
    if (record.introductionStatus === "new-sense" && record.relatedSenseIds?.length === 0) warnings.push(`${record.senseId}: new sense has no relationship recorded to the existing same-form sense.`);
    if (record.lexicalType === "multiword-expression" && (record.componentLexicalEntryIds?.length ?? 0) === 0) warnings.push(`${record.senseId}: multiword expression has no component links; human review should confirm lexicalization.`);
  }
  return { newVocabularyCount: newSenseIds.length, newSenseIds, reviewSenseIds, warnings };
}

function hasCanonicalLexicalIdentity(record: LearnerFacingVocabularyRecord): record is CanonicalLexicalRecord {
  return "lexicalEntryId" in record || "senseId" in record;
}

function normalizeLexicalMeaning(value: string): string {
  return value.normalize("NFKC").replace(/\s+/gu, " ").trim().toLocaleLowerCase();
}

export function buildLearnerFacingVocabularyIndex(records: readonly LearnerFacingVocabularyRecord[], policy: LanguageLexicalPolicy): readonly LearnerFacingVocabularyRecord[] {
  for (const record of records) assertLearnerFacingVocabularyRecord(record, policy);
  return records.map((record) => ({ ...record, ...(record.lexicalType === "measure-expression" && record.representativeNounClasses ? { representativeNounClasses: [...record.representativeNounClasses] } : {}) }));
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
