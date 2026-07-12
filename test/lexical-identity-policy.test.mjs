import assert from "node:assert/strict";
import { test } from "node:test";
import { assertCanonicalLexicalRecord, assertLearnerFacingVocabularyRecord, auditLexicalInventory } from "../dist/packages/core/index.js";

const dutch = { language: "Dutch", nounCategorySystem: { citationFormDefiniteArticles: ["de", "het"] } };
const base = (overrides = {}) => ({ lexicalType: "noun", learnerFacingForm: "de kop", lexicalEntryId: "nl.noun.kop", senseId: "nl.noun.kop.mug", surfaceForm: "kop", lemma: "kop", citationForm: "de kop", partOfSpeech: "noun", meaning: "mug or cup", introductionStatus: "new-entry", firstIntroductionChapter: 3, encounteredForms: ["kop"], relatedSenseIds: [], definiteArticle: "de", ...overrides });
const verb = (surfaceForm, citationForm, language = "Dutch") => ({ lexicalType: "verb", learnerFacingForm: `${surfaceForm} — dictionary form: ${citationForm}`, lexicalEntryId: `${language}.verb.${citationForm}`, senseId: `${language}.verb.${citationForm}.main`, surfaceForm, lemma: citationForm, citationForm, partOfSpeech: "verb", meaning: "test meaning", introductionStatus: "new-entry", firstIntroductionChapter: 4, encounteredForms: [surfaceForm], morphologyStatus: "supporting-form" });

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
