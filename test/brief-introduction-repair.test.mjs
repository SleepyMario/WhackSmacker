import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { cp, mkdir, mkdtemp, readFile, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";

import {
  assertCanonicalSectionAndGrammarRules,
  assertGrammarOnlyBriefIntroduction
} from "../dist/packages/core/language-curriculum-policy.js";

const execFileAsync = promisify(execFile);
const workspace = join(process.cwd(), "..");
const correctionSpecPath = join(process.cwd(), "test", "fixtures", "brief-introduction-repair-corrections.json");
const generatorLanguages = ["arabic", "french", "german", "hindi", "japanese", "korean", "russian", "spanish", "thai", "zulu"];
const generatedOverrides = new Set(["arabic:3", "german:3", "hindi:5"]);

test("the retained 37-finding repair keeps all 33 active source and audience introductions concise, grammar-only, and identity-bound", async () => {
  const spec = JSON.parse(await readFile(correctionSpecPath, "utf8"));
  assert.equal(spec.finding_count, 37);
  assert.equal(spec.records.length, 33);

  for (const record of spec.records) {
    const chapterPath = join(workspace, record.repository, record.chapter_path);
    const supportPath = join(process.cwd(), record.support_path);
    const markdown = await readFile(chapterPath, "utf8");
    const support = JSON.parse(await readFile(supportPath, "utf8"));
    const sourceIntroduction = section(markdown, "Brief Introduction");
    const primaryReading = section(markdown, record.primary_reading_type);
    const primarySetup = firstParagraph(primaryReading);
    const projection = support.audienceSections.find((item) => item.sourceHeading === "Brief Introduction");
    const label = `${record.language} Chapter ${record.chapter}`;

    assert.equal(sourceIntroduction, record.source_brief_introduction, `${label} source introduction`);
    assert.equal(primaryReading.startsWith(record.primary_reading_opening_must_remain), true, `${label} primary opening remains directly under ${record.primary_reading_type}`);
    assert.equal(primarySetup, record.primary_reading_opening_must_remain, `${label} setup is the first primary-reading paragraph`);
    assert.equal(sourceIntroduction.includes(primarySetup), false, `${label} source introduction excludes primary setup`);
    for (const grammarId of record.grammar_ids) {
      assert.equal(markdown.includes(grammarId), true, `${label} source declares ${grammarId}`);
    }

    assert.ok(projection, `${label} has Brief Introduction support`);
    assert.equal(projection.normal, record.normal_brief_introduction, `${label} Normal projection`);
    assert.equal(projection.expert, record.expert_brief_introduction, `${label} Expert projection`);
    assert.ok(record.grammar_ids.length > 0 && record.grammar_patterns.length > 0, `${label} correction record binds both exact projections to source grammar identity`);

    validateGrammarOnly(`${label} source`, sourceIntroduction);
    for (const audience of ["normal", "expert"]) {
      validateGrammarOnly(`${label} ${audience}`, projection[audience]);
      assert.match(projection[audience], /\[\[grammar:[^\]\n]+\]\]/u, `${label} ${audience} names its grammar form`);
      assert.equal(projection[audience].includes(primarySetup), false, `${label} ${audience} excludes primary setup`);
    }
  }
});

test("the follower generator reproduces the three supplied overrides and keeps every generated introduction concise", async () => {
  const spec = JSON.parse(await readFile(correctionSpecPath, "utf8"));
  const isolatedRoot = await mkdtemp(join(tmpdir(), "wsm-brief38-generator-"));
  const isolatedWhackSmacker = join(isolatedRoot, "whacksmacker");
  const isolatedSupport = join(isolatedWhackSmacker, "curriculum-support");

  try {
    await mkdir(isolatedWhackSmacker, { recursive: true });
    await cp(join(process.cwd(), "curriculum-support"), isolatedSupport, { recursive: true });
    for (const language of generatorLanguages) {
      await symlink(join(workspace, `${language}-curriculum`), join(isolatedRoot, `${language}-curriculum`), "dir");
    }

    const result = await execFileAsync(process.execPath, [join(process.cwd(), "scripts", "build-follower-reading-support.mjs")], {
      cwd: isolatedWhackSmacker,
      encoding: "utf8"
    });
    assert.match(result.stdout, /Built 50 follower reading-support sidecars\./u);

    const generatedFiles = generatorLanguages.flatMap((language) =>
      Array.from({ length: 5 }, (_, index) =>
        join(isolatedSupport, language, `chapter-${String(index + 1).padStart(3, "0")}`, "reading-support.json")
      )
    );
    assert.equal(generatedFiles.length, 50);
    for (const path of generatedFiles) {
      const support = JSON.parse(await readFile(path, "utf8"));
      const introduction = support.audienceSections.find((item) => item.sourceHeading === "Brief Introduction");
      const grammar = support.audienceSections.find((item) => item.sourceHeading === "Grammar");
      assert.ok(introduction, `${path} generated Brief Introduction`);
      assert.ok(grammar, `${path} generated Grammar`);
      for (const audience of ["normal", "expert"]) {
        validateGrammarOnly(`${path} ${audience}`, introduction[audience]);
        assert.notEqual(introduction[audience], grammar[audience], `${path} ${audience} does not copy the full grammar explanation`);
        assert.ok(introduction[audience].length < grammar[audience].length, `${path} ${audience} remains shorter than the full grammar explanation`);
      }
    }

    for (const record of spec.records.filter((item) => generatedOverrides.has(`${item.language.toLowerCase()}:${item.chapter}`))) {
      const path = join(isolatedSupport, record.language.toLowerCase(), `chapter-${String(record.chapter).padStart(3, "0")}`, "reading-support.json");
      const support = JSON.parse(await readFile(path, "utf8"));
      const introduction = support.audienceSections.find((item) => item.sourceHeading === "Brief Introduction");
      assert.equal(introduction.normal, record.normal_brief_introduction, `${record.language} Chapter ${record.chapter} generated Normal`);
      assert.equal(introduction.expert, record.expert_brief_introduction, `${record.language} Chapter ${record.chapter} generated Expert`);
    }
  } finally {
    await rm(isolatedRoot, { recursive: true, force: true });
  }
});

test("the production changed-content gate honors Narrative sentence-unit and paragraph-unit alignment models", () => {
  const markdown = `# Chapter

## Brief Introduction

Use \`N + verb\` to form a simple clause.

### Narrative

Alex prepares the room before the lesson.

De les begint.
Alex leest.

### New Grammar / Pattern

Pattern: \`N + verb\`
`;
  assert.doesNotThrow(() => assertCanonicalSectionAndGrammarRules({
    markdown,
    source: "narrative-setup-fixture/chapter.md",
    readingTranslation: {
      sentences: ["The lesson begins.", "Alex reads."]
    }
  }));
  assert.throws(() => assertCanonicalSectionAndGrammarRules({
    markdown,
    source: "narrative-setup-fixture/chapter.md",
    readingTranslation: {
      sentences: ["Alex prepares the room before the lesson.", "The lesson begins.", "Alex reads."]
    }
  }), /Narrative source\/translation sentence count mismatch 2\/3/u);
  assert.doesNotThrow(() => assertCanonicalSectionAndGrammarRules({
    markdown,
    source: "narrative-paragraph-fixture/chapter.md",
    readingTranslation: {
      paragraphs: ["Alex prepares the room before the lesson.", "The lesson begins.", "Alex reads."]
    }
  }));
  assert.throws(() => assertCanonicalSectionAndGrammarRules({
    markdown,
    source: "narrative-paragraph-fixture/chapter.md",
    readingTranslation: {
      paragraphs: ["The lesson begins.", "Alex reads."]
    }
  }), /Narrative source\/translation sentence count mismatch 3\/2/u);
});


test("shared chapter validation keeps Brief Introduction participant-free in every language", () => {
  const valid = `---
chapter: 11
---

# Chapter 11 -- Test

## Brief Introduction

Use \`N + particle\` to mark the sentence topic.

### Dialogue

Alex Example and Bea Example meet in a classroom.

Alex Example: A learner-facing line.
Bea Example: Another learner-facing line.

### New Vocabulary

| Form | Meaning | Part of speech | Note |
|---|---|---|---|
| example | example | noun | Noun |

### Grammar

Use \`N + particle\` in the taught pattern.

### Simple Exercises

1. Read the complete dialogue.
2. Find the chapter pattern.
3. Match the vocabulary.
4. Write one new sentence.
`;
  const chapterParticipants = {
    primaryReadingParticipants: [
      { participantId: "CAST-001", kind: "dialogue-speaker", label: "Alex Example" },
      { participantId: "CAST-002", kind: "dialogue-speaker", label: "Bea Example" }
    ],
    introductionParticipants: [
      { participantId: "CAST-001", label: "Alex Example" },
      { participantId: "CAST-002", label: "Bea Example" }
    ]
  };

  assert.doesNotThrow(() => assertCanonicalSectionAndGrammarRules({
    markdown: valid,
    source: "participant-free-fixture/chapter.md",
    chapterParticipants
  }));
  assert.throws(() => assertCanonicalSectionAndGrammarRules({
    markdown: valid.replace("Use `N + particle`", "Alex Example uses `N + particle`"),
    source: "participant-name-fixture/chapter.md",
    chapterParticipants
  }), /names chapter participant.*Alex Example/u);
  assert.throws(() => assertCanonicalSectionAndGrammarRules({
    markdown: valid.replace("Use `N + particle`", "김민지 (Minji) uses `N + particle`"),
    source: "bilingual-name-gloss-fixture/chapter.md",
    chapterParticipants: {
      primaryReadingParticipants: [{ participantId: "CAST-001", kind: "dialogue-speaker", label: "김민지" }],
      introductionParticipants: [{ participantId: "CAST-001", label: "김민지" }]
    }
  }), /bilingual parenthetical person-name gloss/u);
  assert.doesNotThrow(() => assertCanonicalSectionAndGrammarRules({
    markdown: valid.replace("Use `N + particle`", "Use [[grammar:Alex Example + particle]] as the grammar pattern"),
    source: "grammar-markup-name-fixture/chapter.md",
    chapterParticipants
  }));
});

test("shared Chapters 1-25 validation requires the canonical four-item Simple Exercises section", () => {
  const valid = `---
chapter: 12
---

# Chapter 12 -- Test

## Brief Introduction

Use \`N + verb\` to form a simple clause.

### Narrative

A short scene setup.

문장이 있어요.

### New Vocabulary

| Form | Meaning | Part of speech | Note |
|---|---|---|---|
| 문장 | sentence | noun | Noun |

### Grammar

Use \`N + verb\` in a simple clause.

### Simple Exercises

1. Read the complete narrative.
2. Find the chapter pattern.
3. Match the vocabulary.
4. Write one new sentence.
`;
  assert.doesNotThrow(() => assertCanonicalSectionAndGrammarRules({ markdown: valid, source: "exercise-fixture/chapter.md" }));
  assert.throws(
    () => assertCanonicalSectionAndGrammarRules({
      markdown: valid.replace(/\n### Simple Exercises[\s\S]*$/u, "\n"),
      source: "missing-exercises-fixture/chapter.md"
    }),
    /require an exact .*Simple Exercises section/u
  );
  assert.throws(
    () => assertCanonicalSectionAndGrammarRules({
      markdown: valid.replace("4. Write one new sentence.\n", ""),
      source: "short-exercises-fixture/chapter.md"
    }),
    /exactly four consecutively numbered items/u
  );
});

test("grammar punctuation inside inline semantic markup does not create false sentence boundaries", async () => {
  const source = "units/korean-core/chapter-015-planning-tomorrow/chapter.md";
  const markdown = await readFile(join(workspace, "korean-curriculum", source), "utf8");
  const readingSupport = JSON.parse(await readFile(join(process.cwd(), "curriculum-support", "korean", "chapter-015", "reading-support.json"), "utf8"));
  assert.doesNotThrow(() => assertCanonicalSectionAndGrammarRules({ markdown, readingSupport, source }));
});

function section(markdown, heading) {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  return new RegExp(`^#{1,6}\\s+${escaped}\\s*$\\n([\\s\\S]*?)(?=^#{1,6}\\s+)`, "mu").exec(markdown)?.[1]?.trim() ?? "";
}

function firstParagraph(value) {
  return value.split(/\n\s*\n/u).find((part) => part.trim() !== "")?.trim() ?? "";
}

function validateGrammarOnly(label, value) {
  assert.doesNotThrow(() => assertGrammarOnlyBriefIntroduction(value, label));
}
