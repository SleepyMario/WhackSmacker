import assert from "node:assert/strict";
import { test } from "node:test";

import {
  canonicalFullNameForEastAsianPolicy,
  eastAsianFullNamePresentationPolicyName,
  eastAsianNamePolicyContext,
  isEastAsianFullNamePolicyEnabled,
  reconcileChapterParticipants,
  stripAnsiForDisplay,
  unicodeTerminalDisplayWidth
} from "../dist/packages/core/index.js";

const activeIds = Array.from({ length: 30 }, (_, index) => `CAST-${String(index + 1).padStart(3, "0")}`);

const people = {
  japanese: [
    { id: "CAST-001", displayName: "佐藤あき" },
    { id: "CAST-002", displayName: "中村ゆき" }
  ],
  korean: [
    { id: "CAST-001", displayName: "김민지" },
    { id: "CAST-002", displayName: "이준호" }
  ],
  chinese: [
    {
      id: "CAST-001",
      displayName: "林雅雯",
      traditionalDisplayName: "林雅雯",
      simplifiedDisplayName: "林雅雯"
    },
    {
      id: "CAST-002",
      displayName: "陳志明",
      traditionalDisplayName: "陳志明",
      simplifiedDisplayName: "陈志明"
    }
  ]
};

function dialogueFixture({ language, labels, roleLabel, chineseScriptVariant }) {
  const canonicalCast = people[language];
  const canonicalCastIds = labels.map((_, index) => canonicalCast[index].id);
  const role = roleLabel === undefined ? [] : [{ localId: "ROLE-CLERK", roleLabel }];
  const primaryReadingParticipants = [
    ...labels.map((label, index) => ({ participantId: canonicalCast[index].id, kind: "dialogue-speaker", label })),
    ...role.map(item => ({ participantId: item.localId, kind: "dialogue-speaker", label: item.roleLabel }))
  ];
  const introductionParticipants = primaryReadingParticipants.map(({ participantId, label }) => ({ participantId, label }));
  const intro = `${introductionParticipants.map(item => item.label).join(" and ")} meet to ask for directions.`;
  const lines = primaryReadingParticipants.map((item, index) => `${item.label}: ${index === 0 ? "あきさん、こんにちは。" : "A natural utterance with no forced repeated full name."}`);
  return {
    document: {
      schemaVersion: 1,
      chapter: 1,
      canonicalCastIds,
      unnamedFunctionalParticipants: role,
      primaryReadingParticipants,
      introductionParticipants
    },
    options: {
      sourceFile: `/fixture/${language}/chapter-001/chapter-participants.json`,
      chapterMarkdown: `# Chapter 1\n\n## Dialogue\n\n${intro}\n\n${lines.join("\n")}\n\n## New Vocabulary\n`,
      canonicalCast,
      activeCastProgression: activeIds,
      curriculumIdentity: `com.sleepymario.language.${language}`,
      ...(chineseScriptVariant === undefined ? {} : { chineseScriptVariant })
    }
  };
}

test("the separately named East Asian policy is enabled only for Chinese, Japanese, and Korean", () => {
  assert.equal(eastAsianFullNamePresentationPolicyName, "east-asian-full-name-presentation-policy");
  for (const identity of ["chinese-curriculum", "com.sleepymario.language.japanese", "korean-curriculum"]) {
    assert.equal(isEastAsianFullNamePolicyEnabled(identity), true);
  }
  for (const identity of ["dutch-curriculum", "vietnamese-curriculum", "com.sleepymario.language.french"]) {
    assert.equal(isEastAsianFullNamePolicyEnabled(identity), false);
  }
});

test("Traditional and Simplified Chinese canonical names select by script while retaining one CAST identity", () => {
  const person = people.chinese[1];
  const traditional = eastAsianNamePolicyContext("chinese-curriculum", "traditional");
  const simplified = eastAsianNamePolicyContext("chinese-curriculum", "simplified");
  assert.equal(canonicalFullNameForEastAsianPolicy(person, traditional), "陳志明");
  assert.equal(canonicalFullNameForEastAsianPolicy(person, simplified), "陈志明");
  assert.equal(canonicalFullNameForEastAsianPolicy(person, eastAsianNamePolicyContext("com.sleepymario.language.chinese-traditional")), "陳志明");
  assert.equal(canonicalFullNameForEastAsianPolicy(person, eastAsianNamePolicyContext("com.sleepymario.language.chinese-simplified")), "陈志明");
  assert.equal(person.id, "CAST-002");
  assert.throws(
    () => canonicalFullNameForEastAsianPolicy(person, eastAsianNamePolicyContext("chinese-curriculum")),
    /must distinguish traditional or simplified script/u
  );
});

test("Japanese and Korean canonical Dialogue speakers require exact native full names", () => {
  for (const [language, validLabels, invalidLabel] of [
    ["japanese", ["佐藤あき", "中村ゆき"], "あき"],
    ["korean", ["김민지", "이준호"], "민지"]
  ]) {
    const valid = dialogueFixture({ language, labels: validLabels });
    assert.doesNotThrow(() => reconcileChapterParticipants(valid.document, valid.options));
    const short = structuredClone(valid);
    short.document.primaryReadingParticipants[0].label = invalidLabel;
    short.options.chapterMarkdown = short.options.chapterMarkdown.replace(`${validLabels[0]}:`, `${invalidLabel}:`);
    assert.throws(
      () => reconcileChapterParticipants(short.document, short.options),
      new RegExp(`CAST-001[\\s\\S]*structural Dialogue label[\\s\\S]*expected exact canonical full name`, "u")
    );
  }
  assert.throws(
    () => canonicalFullNameForEastAsianPolicy({ id: "CAST-001", displayName: "Aki Sato" }, eastAsianNamePolicyContext("japanese-curriculum")),
    /full-name script mismatch for japanese/u
  );
  assert.throws(
    () => canonicalFullNameForEastAsianPolicy({ id: "CAST-001", displayName: "Kim Minji" }, eastAsianNamePolicyContext("korean-curriculum")),
    /full-name script mismatch for korean/u
  );
});

test("Chinese accepts only the script-appropriate canonical full label and introduction projection", () => {
  const traditional = dialogueFixture({ language: "chinese", labels: ["林雅雯", "陳志明"], chineseScriptVariant: "traditional" });
  const simplified = dialogueFixture({ language: "chinese", labels: ["林雅雯", "陈志明"], chineseScriptVariant: "simplified" });
  assert.doesNotThrow(() => reconcileChapterParticipants(traditional.document, traditional.options));
  assert.doesNotThrow(() => reconcileChapterParticipants(simplified.document, simplified.options));

  const wrongScript = structuredClone(simplified);
  wrongScript.document.primaryReadingParticipants[1].label = "陳志明";
  wrongScript.document.introductionParticipants[1].label = "陳志明";
  wrongScript.options.chapterMarkdown = wrongScript.options.chapterMarkdown.replaceAll("陈志明", "陳志明");
  assert.throws(() => reconcileChapterParticipants(wrongScript.document, wrongScript.options), /expected exact canonical full name "陈志明"/u);

  const short = structuredClone(traditional);
  short.document.primaryReadingParticipants[1].label = "志明";
  short.options.chapterMarkdown = short.options.chapterMarkdown.replace("陳志明:", "志明:");
  assert.throws(() => reconcileChapterParticipants(short.document, short.options), /expected exact canonical full name "陳志明"/u);
});

test("introductions require every actual canonical full name and reject absent cast people", () => {
  const missing = dialogueFixture({ language: "japanese", labels: ["佐藤あき", "中村ゆき"] });
  missing.options.chapterMarkdown = missing.options.chapterMarkdown.replace("佐藤あき and 中村ゆき meet", "あき and 中村ゆき meet");
  assert.throws(() => reconcileChapterParticipants(missing.document, missing.options), /introduction participant CAST-001.*absent/u);

  const absent = dialogueFixture({ language: "korean", labels: ["김민지"] });
  absent.options.chapterMarkdown = absent.options.chapterMarkdown.replace("김민지 meet", "김민지 and 이준호 meet");
  assert.throws(() => reconcileChapterParticipants(absent.document, absent.options), /names absent canonical participant CAST-002/u);
});

test("generic labels are rejected while unnamed functional roles retain exact natural labels", () => {
  const roleCases = [
    ["japanese", ["佐藤あき"], "店員"],
    ["korean", ["김민지"], "점원"],
    ["chinese", ["林雅雯"], "店員", "traditional"]
  ];
  for (const [language, labels, roleLabel, chineseScriptVariant] of roleCases) {
    const fixture = dialogueFixture({ language, labels, roleLabel, chineseScriptVariant });
    assert.doesNotThrow(() => reconcileChapterParticipants(fixture.document, fixture.options));
    assert.equal(fixture.document.canonicalCastIds.length, 1);
    assert.equal(fixture.document.unnamedFunctionalParticipants[0].localId, "ROLE-CLERK");
  }

  const generic = dialogueFixture({ language: "korean", labels: ["김민지"] });
  generic.document.primaryReadingParticipants[0].label = "A";
  generic.document.introductionParticipants[0].label = "A";
  generic.options.chapterMarkdown = generic.options.chapterMarkdown.replaceAll("김민지", "A");
  assert.throws(() => reconcileChapterParticipants(generic.document, generic.options), /generic A\/B\/C/u);
});

test("natural short references inside utterances are not rewritten or rejected", () => {
  const japanese = dialogueFixture({ language: "japanese", labels: ["佐藤あき", "中村ゆき"] });
  japanese.options.chapterMarkdown = japanese.options.chapterMarkdown.replace(
    "A natural utterance with no forced repeated full name.",
    "あきさん、今日は学校ですか。"
  );
  assert.doesNotThrow(() => reconcileChapterParticipants(japanese.document, japanese.options));
});

test("Unicode display width ignores ANSI and combining marks and counts East Asian glyphs as wide", () => {
  assert.equal(unicodeTerminalDisplayWidth("佐藤あき"), 8);
  assert.equal(unicodeTerminalDisplayWidth("김민지"), 6);
  assert.equal(unicodeTerminalDisplayWidth("店員"), 4);
  assert.equal(unicodeTerminalDisplayWidth("A\u0301nh"), 3);
  assert.equal(unicodeTerminalDisplayWidth("\x1b[38;5;141m陳志明:\x1b[0m"), 7);
  assert.equal(stripAnsiForDisplay("\x1b[31m김민지:\x1b[0m 안녕하세요"), "김민지: 안녕하세요");
});
