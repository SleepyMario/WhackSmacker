import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";

import exerciseRenderer from "../dist/packages/core/exercise-renderer.js";

const { formatRenderedExercise, renderMemorizationExercise } = exerciseRenderer;

const identity = {
  packageId: "com.sleepymario.language.memory",
  packageVersion: "0.1.0",
  itemId: "hangul/vowels/a"
};

test("basic-card renders prompt and answer separately", () => {
  const rendered = renderMemorizationExercise({ ...identity, item: item("basic-card") });

  assert.equal(rendered.kind, "basic-card");
  assert.deepEqual(rendered.promptLines, ["What does 아 represent?"]);
  assert.deepEqual(rendered.answerLines, ["A Korean vowel-only syllable using ㅏ."]);
  assert.equal(rendered.itemIdentity.packageId, identity.packageId);
  assert.equal(rendered.itemIdentity.packageVersion, identity.packageVersion);
  assert.equal(rendered.itemIdentity.itemId, identity.itemId);
});

test("vocabulary renders hints notes tags source language and difficulty", () => {
  const rendered = renderMemorizationExercise({
    ...identity,
    item: {
      ...item("vocabulary"),
      hints: ["Look at the vowel."],
      notes: "This is package-authored explanation.",
      tags: ["hangul", "vowel"],
      source: {
        path: "units/introduction-to-hangul/chapter-01-vowels/unit-01-simple-vowels.md",
        title: "Simple vowels"
      },
      language: {
        target: "ko",
        base: "en",
        script: "Hangul"
      },
      difficulty: {
        level: 1,
        label: "foundation"
      }
    }
  });

  assert.equal(rendered.title, "Simple vowels");
  assert.deepEqual(rendered.hintLines, ["Look at the vowel."]);
  assert.deepEqual(rendered.noteLines, ["This is package-authored explanation."]);
  assert.match(rendered.metadataLines.join("\n"), /Tags: hangul, vowel/);
  assert.match(rendered.metadataLines.join("\n"), /Source: units\/introduction-to-hangul/);
  assert.match(rendered.metadataLines.join("\n"), /Language: target=ko, base=en, script=Hangul/);
  assert.match(rendered.metadataLines.join("\n"), /Difficulty: level=1, label=foundation/);
});

test("sentence renders deterministically", () => {
  const rendered = renderMemorizationExercise({
    ...identity,
    item: item("sentence", "안녕하세요.", "A polite Korean greeting.")
  });

  assert.deepEqual(rendered.promptLines, ["안녕하세요."]);
  assert.deepEqual(rendered.answerLines, ["A polite Korean greeting."]);
  assert.deepEqual(rendered.warnings, []);
});

test("concept renders without optional fields", () => {
  const rendered = renderMemorizationExercise({
    ...identity,
    item: {
      schemaVersion: 1,
      id: identity.itemId,
      kind: "concept",
      prompt: { text: "What is a syllable block?" },
      answer: { text: "A written Hangul block combining jamo into one syllable." }
    }
  });

  assert.deepEqual(rendered.hintLines, []);
  assert.deepEqual(rendered.noteLines, []);
  assert.deepEqual(rendered.promptLines, ["What is a syllable block?"]);
});

test("cloze masks simple cloze markers and includes extracted answer", () => {
  const rendered = renderMemorizationExercise({
    ...identity,
    item: item("cloze", "The silent initial placeholder is {{c1::ㅇ}}.", "Initial ㅇ has no sound in modern Korean syllable onset.")
  });

  assert.deepEqual(rendered.promptLines, ["The silent initial placeholder is [...]."]);
  assert.deepEqual(rendered.answerLines, ["Cloze: ㅇ", "Initial ㅇ has no sound in modern Korean syllable onset."]);
  assert.deepEqual(rendered.warnings, []);
});

test("cloze without marker falls back to stored prompt and answer with a warning", () => {
  const rendered = renderMemorizationExercise({
    ...identity,
    item: item("cloze", "Initial ㅇ is silent.", "Initial ㅇ has no sound in onset position.")
  });

  assert.deepEqual(rendered.promptLines, ["Initial ㅇ is silent."]);
  assert.match(rendered.warnings.join("\n"), /no simple/);
});

test("formatted output can render prompt only or answer only", () => {
  const rendered = renderMemorizationExercise({ ...identity, item: item("basic-card") });

  const prompt = formatRenderedExercise(rendered, "prompt");
  const answer = formatRenderedExercise(rendered, "answer");

  assert.match(prompt, /Prompt/);
  assert.doesNotMatch(prompt, /Answer\n/);
  assert.match(answer, /Answer/);
  assert.doesNotMatch(answer, /Prompt\n/);
});

test("invalid item kinds are rejected before rendering", () => {
  assert.throws(() => renderMemorizationExercise({ ...identity, item: item("scheduler-card") }), /Invalid memorization item/);
});

test("render identity must match the item id", () => {
  assert.throws(
    () => renderMemorizationExercise({ ...identity, item: item("basic-card", "front", "back", "different/id") }),
    /does not match render identity/
  );
});

test("renderer does not touch progress files or mutate package content", async () => {
  const root = await mkdtemp(join(tmpdir(), "wsm-renderer-"));
  const packagePath = join(root, "content", "packages", "com.sleepymario.language.memory", "0.1.0", "content", "memorization", "items.json");
  const progressPath = join(root, "progress", "review-progress.json");
  const packageContent = JSON.stringify({ schemaVersion: 1, items: [item("basic-card")] }, null, 2);
  try {
    await writeFileEnsured(packagePath, `${packageContent}\n`);
    renderMemorizationExercise({ ...identity, item: item("basic-card") });

    assert.equal(await readFile(packagePath, "utf8"), `${packageContent}\n`);
    await assert.rejects(() => readFile(progressPath, "utf8"), /ENOENT/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

function item(kind, prompt = "What does 아 represent?", answer = "A Korean vowel-only syllable using ㅏ.", id = identity.itemId) {
  return {
    schemaVersion: 1,
    id,
    kind,
    prompt: {
      text: prompt,
      plainText: prompt,
      language: "ko",
      mediaType: "text/plain"
    },
    answer: {
      text: answer,
      mediaType: "text/plain"
    }
  };
}

async function writeFileEnsured(path, data) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, data);
}
