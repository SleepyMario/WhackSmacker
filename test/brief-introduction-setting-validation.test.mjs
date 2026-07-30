import assert from "node:assert/strict";
import { test } from "node:test";

import {
  assertCanonicalSectionAndGrammarRules,
  assertGrammarOnlyBriefIntroduction,
  assertPackageReadingSupportAudienceSections
} from "../dist/packages/core/index.js";

const authoredSpatialSetting = "Locative [[grammar:에]] marks the spatial setting, nominative [[grammar:이/가]] marks the existential theme, and [[grammar:있어요]] forms the polite predicate.";

test("shared Brief Introduction validation accepts authored grammatical spatial-setting prose", () => {
  assert.doesNotThrow(() => assertCanonicalSectionAndGrammarRules({
    markdown: chapterFixture("Use `place + 에 + N + 이/가 있어요` to say that something is present at a location."),
    readingSupport: supportFixture(authoredSpatialSetting),
    source: "units/korean-core/chapter-002-a-room-at-home/chapter.md"
  }));
});

test("shared Brief Introduction validation accepts grammatical temporal-setting metalanguage", () => {
  assert.doesNotThrow(() => assertGrammarOnlyBriefIntroduction(
    "The tense encodes a temporal setting frame for the clause.",
    "temporal-setting-fixture"
  ));
});

test("narrative setting prose cannot escape by naming a grammar word", () => {
  assert.throws(() => assertGrammarOnlyBriefIntroduction(
    "This chapter uses a classroom setting to teach the noun.",
    "setting-with-grammar-word-fixture"
  ), /scene, profile, or plot setup/u);
});

test("narrative setting, scene, and plot setup remain rejected", () => {
  for (const value of [
    "The setting is a school library.",
    "This chapter uses a classroom setting.",
    "Minji and Junho meet in a local setting. The noun marks the topic.",
    "The scene takes place at a market. The noun marks the topic.",
    "The plot follows Minji during the morning. The verb marks tense."
  ]) {
    assert.throws(() => assertGrammarOnlyBriefIntroduction(value, "narrative-setup-fixture"));
  }
});

test("profile, residence, biography, preparation, and joining setup remain rejected", () => {
  for (const value of [
    "Minji is a 24-year-old student. The noun marks the topic.",
    "Junho lives in Seoul. The verb marks tense.",
    "This biography introduces Minji. The noun marks the topic.",
    "Minji prepares the classroom. The particle marks the object.",
    "Preparation for the library program begins. The clause uses a particle.",
    "Junho joins the reading program. The noun marks the topic."
  ]) {
    assert.throws(() => assertGrammarOnlyBriefIntroduction(value, "profile-setup-fixture"), /scene, profile, or plot setup/u);
  }
});

test("participant and primary-setup separation remain enforced", () => {
  const participants = {
    primaryReadingParticipants: [{ participantId: "CAST-001", kind: "dialogue-speaker", label: "김민지" }],
    introductionParticipants: [{ participantId: "CAST-001", label: "김민지" }]
  };
  assert.throws(() => assertCanonicalSectionAndGrammarRules({
    markdown: chapterFixture("김민지 uses `N + 은/는` to mark the topic."),
    chapterParticipants: participants,
    source: "participant-setting-fixture/chapter.md"
  }), /names chapter participant/u);
  assert.throws(() => assertCanonicalSectionAndGrammarRules({
    markdown: chapterFixture("A small room at home has been arranged as a quiet study space before the reading program. The noun marks the topic."),
    source: "copied-setup-fixture/chapter.md"
  }), /primary-reading setup cannot be projected/u);
});

test("package-generation support validation rejects scene-oriented Brief Introduction fixtures", () => {
  assert.throws(() => assertPackageReadingSupportAudienceSections({
    audienceSections: [{
      sourceHeading: "Brief Introduction",
      normal: "This chapter uses a classroom setting to teach the noun.",
      expert: "The scene takes place at a market. The noun marks the topic."
    }]
  }, "scene-oriented-package-support.json", true), /scene, profile, or plot setup/u);
});

function chapterFixture(introduction) {
  return `---
chapter: 2
---

# Chapter 2 -- A Quiet Study Room

## Brief Introduction

${introduction}

### Narrative

A small room at home has been arranged as a quiet study space before the reading program.

작은 방에 책상이 있어요.

### New Vocabulary

| Form | Meaning | Part of speech | Note |
|---|---|---|---|
| 방에 | room | noun | location particle attached |

### Grammar

Use \`place + 에 + N + 이/가 있어요\` for an existential clause.

### Simple Exercises

1. Read the narrative.
2. Find the location.
3. Find the existential theme.
4. Write one sentence.
`;
}

function supportFixture(expert) {
  return {
    audienceSections: [{
      sourceHeading: "Brief Introduction",
      normal: "Use [[grammar:place + 에 + N + 이/가 있어요]] to say that something is present at a location.",
      expert
    }]
  };
}
