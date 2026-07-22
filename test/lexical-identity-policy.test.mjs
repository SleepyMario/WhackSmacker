import assert from "node:assert/strict";
import { test } from "node:test";
import { assertCanonicalLexicalRecord, assertCanonicalVocabularyReviewMapping, assertLearnerFacingLexicalDisplay, assertLearnerFacingVocabularyRecord, auditLexicalInventory, canonicalVocabularyTableHeaders, formatLearnerFacingVocabularyRow } from "../dist/packages/core/index.js";

const dutch = { language: "Dutch", nounCategorySystem: { citationFormDefiniteArticles: ["de", "het"] } };
const base = (overrides = {}) => ({ lexicalType: "noun", learnerFacingForm: "de kop", lexicalEntryId: "nl.noun.kop", senseId: "nl.noun.kop.mug", surfaceForm: "kop", lemma: "kop", citationForm: "de kop", partOfSpeech: "noun", meaning: "mug or cup", introductionStatus: "new-entry", firstIntroductionChapter: 3, encounteredForms: ["kop"], relatedSenseIds: [], definiteArticle: "de", ...overrides });
const verb = (surfaceForm, citationForm, language = "Dutch", overrides = {}) => ({ lexicalType: "verb", learnerFacingForm: `${surfaceForm} — infinitive: ${citationForm}`, lexicalEntryId: `${language}.verb.${citationForm}`, senseId: `${language}.verb.${citationForm}.main`, surfaceForm, lemma: citationForm, citationForm, partOfSpeech: "verb", meaning: "test meaning", introductionStatus: "new-entry", firstIntroductionChapter: 4, encounteredForms: [surfaceForm], morphologyStatus: "supporting-form", regularityStatus: language === "Chinese" ? "not-applicable" : "regular", ...overrides });

test("same Dutch written lemma supports distinct stable noun senses without merging", () => {
  const mug = base();
  const animalHead = base({ lexicalEntryId: "nl.noun.kop", senseId: "nl.noun.kop.animal-head", meaning: "head of an animal", introductionStatus: "new-sense", firstIntroductionChapter: 18, relatedSenseIds: [mug.senseId] });
  const audit = auditLexicalInventory([mug, animalHead]);
  assert.equal(mug.lemma, animalHead.lemma);
  assert.notEqual(mug.senseId, animalHead.senseId);
  assert.equal(audit.newVocabularyCount, 2);
  assert.doesNotThrow(() => assertLearnerFacingVocabularyRecord(mug, dutch));
  assert.throws(() => auditLexicalInventory([mug, { ...animalHead, senseId: mug.senseId }]), /shared by unrelated lexical senses/u);
});

test("encountered inflected forms link to one language-appropriate citation-form entry", () => {
  for (const record of [verb("ik kop", "koppen"), verb("klopt", "kloppen"), verb("does", "do", "English"), verb("해", "하다", "Korean"), verb("します", "する", "Japanese")]) {
    assert.doesNotThrow(() => assertCanonicalLexicalRecord(record));
    assert.equal(auditLexicalInventory([record]).newVocabularyCount, 1);
  }
  assert.throws(() => assertCanonicalLexicalRecord({ ...verb("klopt", "kloppen"), citationForm: "" }), /citationForm/u);
});

test("first-introduced applicable verbs require regularity and may preserve a language-specific class", () => {
  assert.doesNotThrow(() => assertCanonicalLexicalRecord(verb("werkt", "werken", "Dutch", { regularityStatus: "regular", verbClass: "weak verb" })));
  assert.doesNotThrow(() => assertCanonicalLexicalRecord(verb("ging", "gaan", "Dutch", { regularityStatus: "irregular", verbClass: "strong suppletive past" })));
  assert.throws(() => assertCanonicalLexicalRecord({ ...verb("werkt", "werken"), regularityStatus: undefined }), /requires canonical regularityStatus/u);
  assert.throws(() => assertCanonicalLexicalRecord(verb("werkt", "werken", "Dutch", { regularityStatus: "undetermined" })), /pending legacy migration/u);
  assert.doesNotThrow(() => assertCanonicalLexicalRecord(verb("werkt", "werken", "Dutch", { regularityStatus: "undetermined", regularityMigrationStatus: "pending-legacy-migration" })));
});

test("later encounters, review, and reintroduction inherit established verb regularity", () => {
  const introduced = verb("ging", "gaan", "Dutch", { regularityStatus: "irregular", verbClass: "strong verb" });
  for (const introductionStatus of ["reuse", "review", "reintroduced"]) {
    const later = { ...introduced, surfaceForm: "gaat", encounteredForms: ["gaat"], introductionStatus, attestationChapters: [12] };
    assert.doesNotThrow(() => auditLexicalInventory([introduced, later]));
    assert.equal(auditLexicalInventory([introduced, later]).newVocabularyCount, 1);
  }
  assert.throws(() => auditLexicalInventory([introduced, { ...introduced, surfaceForm: "gaat", encounteredForms: ["gaat"], introductionStatus: "reuse", regularityStatus: "regular" }]), /must inherit the established irregular/u);
  const corrected = auditLexicalInventory([introduced, { ...introduced, introductionStatus: "reuse", regularityStatus: "regular", regularityCorrectionAudit: "Human review corrected the historical classification." }]);
  assert.match(corrected.warnings[0], /correction audited/u);
});

test("ordinary Chinese verbs use not-applicable rather than forced regularity", () => {
  assert.doesNotThrow(() => assertCanonicalLexicalRecord(verb("喝", "喝", "Chinese")));
  assert.equal(verb("喝", "喝", "Chinese").regularityStatus, "not-applicable");
});

const display = (overrides = {}) => ({ surfaceForm: "drinkt", canonicalForm: "drinken", formRelationship: "inflection", canonicalLexicalId: "nl.verb.drinken", canonicalSenseId: "nl.verb.drinken.drink", contextualMeaning: "to drink", partOfSpeech: "verb", note: "third-person singular present", morphology: { person: "third", number: "singular", tense: "present" }, reviewEligible: true, ...overrides });

test("canonical vocabulary display renders one four-column surface-to-citation row", () => {
  assert.deepEqual(canonicalVocabularyTableHeaders, ["Form", "Meaning", "Part of speech", "Note"]);
  assert.equal(formatLearnerFacingVocabularyRow(display()), "| drinkt ← drinken | to drink | verb | third-person singular present |");
  assert.equal(formatLearnerFacingVocabularyRow(display({ surfaceForm: "drinken", canonicalForm: "drinken", formRelationship: "identical", note: "" })), "| drinken | to drink | verb |  |");
  assert.throws(() => assertLearnerFacingLexicalDisplay(display({ surfaceForm: "drinken", canonicalForm: "drinken" })), /must not be repeated/u);
  assert.throws(() => assertLearnerFacingLexicalDisplay(display({ canonicalForm: undefined, canonicalParadigm: undefined })), /exactly one/u);
});

test("expanded forms, paradigms, morphology, and lexicalized exceptions are semantic", () => {
  assert.doesNotThrow(() => assertLearnerFacingLexicalDisplay(display({ surfaceForm: "au", expandedForm: "à + le", canonicalForm: "à + le", formRelationship: "contraction", partOfSpeech: "contraction", note: "masculine singular" })));
  assert.throws(() => assertLearnerFacingLexicalDisplay(display({ surfaceForm: "au", canonicalForm: "à + le", formRelationship: "contraction" })), /requires expandedForm/u);
  assert.doesNotThrow(() => assertLearnerFacingLexicalDisplay(display({ surfaceForm: "ta", canonicalForm: undefined, canonicalParadigm: ["ton", "ta", "tes"], formRelationship: "possession", partOfSpeech: "possessive determiner", morphology: { gender: "feminine", number: "singular" } })));
  assert.throws(() => assertLearnerFacingLexicalDisplay(display({ surfaceForm: "pommes", canonicalForm: "la pomme", formRelationship: "number", morphology: {} })), /plural morphology/u);
  assert.throws(() => assertLearnerFacingLexicalDisplay(display({ surfaceForm: "bekende", canonicalForm: "de bekende", formRelationship: "lexicalized" })), /requires a justification/u);
});

test("multiple surface rows share one Review sense and grammar remains absent", () => {
  const rows = [display({ surfaceForm: "ben", canonicalForm: "zijn" }), display({ surfaceForm: "is", canonicalForm: "zijn" })];
  assert.doesNotThrow(() => assertCanonicalVocabularyReviewMapping(rows, ["nl.verb.drinken.drink"], []));
  assert.throws(() => assertCanonicalVocabularyReviewMapping(rows, ["nl.verb.drinken.drink"], ["nl.grammar.present"]), /no grammar identities/u);
  assert.throws(() => assertCanonicalVocabularyReviewMapping(rows, [], []), /missing its canonical Review sense/u);
});

test("ordinary conjugation is reuse while a distinct part of speech may be new", () => {
  const introduced = verb("klopt", "kloppen");
  const later = { ...introduced, surfaceForm: "klopte", encounteredForms: ["klopte"], introductionStatus: "reuse", attestationChapters: [12] };
  const noun = base({ lexicalEntryId: "nl.noun.kop", senseId: "nl.noun.kop.mug", introductionStatus: "new-part-of-speech" });
  const audit = auditLexicalInventory([introduced, later, noun]);
  assert.equal(audit.newVocabularyCount, 2);
  assert.deepEqual(audit.reviewSenseIds, [introduced.senseId]);
  assert.throws(() => auditLexicalInventory([introduced, { ...later, senseId: `${introduced.senseId}.past`, introductionStatus: "new-sense" }]), /ordinary forms.*separate sense IDs/u);
});

test("review and reintroduction retain first chapter and never count as new", () => {
  const introduced = base();
  const review = { ...introduced, introductionStatus: "review", attestationChapters: [15] };
  const audit = auditLexicalInventory([introduced, review]);
  assert.equal(audit.newVocabularyCount, 1);
  assert.equal(review.firstIntroductionChapter, 3);
  assert.throws(() => auditLexicalInventory([introduced, { ...review, firstIntroductionChapter: 15 }]), /retain first-introduction/u);
});

test("idiom is a complete entry and untaught internal diminutive remains unanalyzed", () => {
  const idiom = { lexicalType: "multiword-expression", learnerFacingForm: "een kopje kleiner maken — to defeat or kill", lexicalEntryId: "nl.idiom.een-kopje-kleiner-maken", senseId: "nl.idiom.een-kopje-kleiner-maken.main", surfaceForm: "een kopje kleiner maken", lemma: "een kopje kleiner maken", citationForm: "een kopje kleiner maken", partOfSpeech: "idiom", meaning: "to defeat or kill", introductionStatus: "new-multiword-expression", firstIntroductionChapter: 20, encounteredForms: ["een kopje kleiner maken"], relatedSenseIds: [], multiwordExpression: true, componentLexicalEntryIds: ["nl.noun.kop", "nl.adj.klein", "nl.verb.maken"], morphologyStatus: "fixed-or-unanalyzed", introducesProductiveMorphology: false };
  assert.doesNotThrow(() => assertCanonicalLexicalRecord(idiom));
  assert.notEqual(idiom.lexicalEntryId, "nl.noun.kopje");
  assert.throws(() => assertCanonicalLexicalRecord({ ...idiom, introducesProductiveMorphology: true }), /cannot introduce.*productive grammar/u);
  assert.throws(() => assertCanonicalLexicalRecord({ ...idiom, citationForm: "kopje" }), /complete multiword/u);
});

test("classifier metadata remains compatible with canonical sense identity", () => {
  const classifier = { lexicalType: "measure-expression", lexicalForm: "本", learnerFacingForm: "本 — MW: bound books", pronunciation: "běn", grammaticalType: "MW", semanticScope: "bound books and volumes", usageStatus: "restricted", lexicalEntryId: "zh.classifier.ben", senseId: "zh.classifier.ben.bound-volumes", surfaceForm: "本", lemma: "本", citationForm: "本", partOfSpeech: "classifier", meaning: "classifier for bound books and volumes", introductionStatus: "new-entry", firstIntroductionChapter: 7, encounteredForms: ["本"] };
  assert.doesNotThrow(() => assertLearnerFacingVocabularyRecord(classifier, { language: "Chinese", grammaticalMeasureExpressions: true }));
});
