import assert from "node:assert/strict";
import { test } from "node:test";

import { assertChapterOneLexicalFoundation, assertLearnerFacingVocabularyRecord, buildLearnerFacingVocabularyIndex } from "../dist/packages/core/index.js";

const policies = {
  Dutch: { language: "Dutch", nounCategorySystem: { citationFormDefiniteArticles: ["de", "het"] } },
  German: { language: "German", nounCategorySystem: { citationFormDefiniteArticles: ["der", "die", "das"] } },
  French: { language: "French", nounCategorySystem: { citationFormDefiniteArticles: ["le", "la", "l’"], ambiguityForms: ["l’"], categoryMarkerLabels: ["M", "F"] } },
  Spanish: { language: "Spanish", nounCategorySystem: { citationFormDefiniteArticles: ["el", "la", "los", "las"] } },
  English: { language: "English" }
};

test("Chapter 1 requires language-specific article/category foundations without adding a grammar point", () => {
  for (const policy of [policies.Dutch, policies.German, policies.Spanish]) assert.doesNotThrow(() => assertChapterOneLexicalFoundation({ policy, chapter: 1, introducedDefiniteArticles: policy.nounCategorySystem.citationFormDefiniteArticles, explainsNounCategories: true, explainsLearningNounsWithArticle: true, principalGrammarPointIds: ["GRAMMAR-001"] }));
  assert.throws(() => assertChapterOneLexicalFoundation({ policy: policies.Dutch, chapter: 1, introducedDefiniteArticles: ["de"], explainsNounCategories: true, explainsLearningNounsWithArticle: true, principalGrammarPointIds: ["GRAMMAR-001"] }), /missing required definite article het/u);
  assert.throws(() => assertChapterOneLexicalFoundation({ policy: policies.French, chapter: 1, introducedDefiniteArticles: ["le", "la", "l’"], explainsNounCategories: true, explainsLearningNounsWithArticle: true, principalGrammarPointIds: ["GRAMMAR-001"] }), /ambiguity-marker guidance/u);
  assert.doesNotThrow(() => assertChapterOneLexicalFoundation({ policy: policies.English, chapter: 1, principalGrammarPointIds: ["GRAMMAR-001"] }));
});
test("applicable nouns carry articles and hidden French gender carries M/F", () => {
  const nouns = [
    [{ lexicalType: "noun", lemma: "water", learnerFacingForm: "het water", definiteArticle: "het" }, policies.Dutch],
    [{ lexicalType: "noun", lemma: "Buch", learnerFacingForm: "das Buch", definiteArticle: "das", grammaticalCategory: "N" }, policies.German],
    [{ lexicalType: "noun", lemma: "femme", learnerFacingForm: "la femme", definiteArticle: "la", grammaticalCategory: "F" }, policies.French],
    [{ lexicalType: "noun", lemma: "eau", learnerFacingForm: "l’eau (F)", definiteArticle: "l’", grammaticalCategory: "F", explicitCategoryMarkerRequired: true }, policies.French]
  ];
  for (const [record, policy] of nouns) assert.doesNotThrow(() => assertLearnerFacingVocabularyRecord(record, policy));
  assert.throws(() => assertLearnerFacingVocabularyRecord({ lexicalType: "noun", lemma: "vrouw", learnerFacingForm: "vrouw" }, policies.Dutch), /missing required/u);
  assert.throws(() => assertLearnerFacingVocabularyRecord({ lexicalType: "noun", lemma: "homme", learnerFacingForm: "l’homme", definiteArticle: "l’", grammaticalCategory: "M", explicitCategoryMarkerRequired: true }, policies.French), /ambiguity marker/u);
  for (const lexicalType of ["proper-name", "verb", "adjective", "phrase"]) assert.doesNotThrow(() => assertLearnerFacingVocabularyRecord({ lexicalType, learnerFacingForm: "Sophie" }, policies.Dutch));
});
