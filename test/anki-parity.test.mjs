import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";

import parityAudit from "../dist/packages/core/anki-parity-audit.js";
import exerciseRenderer from "../dist/packages/core/exercise-renderer.js";
import reviewScheduler from "../dist/packages/core/review-scheduler.js";
import userDataBackup from "../dist/packages/core/user-data-backup.js";
import cardRenderer from "../dist/packages/language/card-renderer.js";
import { createCommandRegistry, resolveCliCommand } from "../dist/apps/cli/main.js";

const {
  createNativeMemorizationItemFromAnkiCard,
  runAnkiParityAudit
} = parityAudit;
const { formatRenderedExercise, renderMemorizationExercise } = exerciseRenderer;
const { createInitialReviewState, listDueReviewStates } = reviewScheduler;
const { createUserDataBackup } = userDataBackup;
const { renderAnkiCardHtml } = cardRenderer;

const packageId = "com.sleepymario.language.korean";
const packageVersion = "0.1.0";
const now = "2026-07-06T00:00:00Z";

test("legacy basic Anki card maps to a valid native memorization item identity", () => {
  const item = createNativeMemorizationItemFromAnkiCard(legacyBasicCard());

  assert.equal(item.schemaVersion, 1);
  assert.equal(item.id, "legacy-anki/languages-korean/12345");
  assert.equal(item.kind, "basic-card");
  assert.equal(item.prompt.text, "What does 아 represent?");
  assert.equal(item.answer.text, "A Korean vowel-only syllable using ㅏ.");
  assert.deepEqual(item.tags, ["hangul", "vowel-practice"]);
  assert.match(item.notes, /Legacy Anki deck: Languages::Korean/);
});

test("native renderer preserves legacy front and back separation", () => {
  const item = createNativeMemorizationItemFromAnkiCard(legacyBasicCard());
  const rendered = renderMemorizationExercise({ packageId, packageVersion, itemId: item.id, item });

  assert.deepEqual(rendered.promptLines, ["What does 아 represent?"]);
  assert.deepEqual(rendered.answerLines, ["A Korean vowel-only syllable using ㅏ."]);

  const prompt = formatRenderedExercise(rendered, "prompt");
  const answer = formatRenderedExercise(rendered, "answer");
  assert.match(prompt, /Prompt/);
  assert.doesNotMatch(prompt, /\nAnswer\n/);
  assert.match(answer, /Answer/);
  assert.doesNotMatch(answer, /\nPrompt\n/);
});

test("legacy cloze-like card maps to native cloze renderer behavior", () => {
  const item = createNativeMemorizationItemFromAnkiCard({
    cardId: 23456,
    deckName: "Languages::Korean",
    question: "The silent initial placeholder is {{c1::ㅇ}}.",
    answer: "Initial ㅇ has no sound in syllable onset.",
    cloze: true
  });
  const rendered = renderMemorizationExercise({ packageId, packageVersion, itemId: item.id, item });

  assert.equal(item.kind, "cloze");
  assert.deepEqual(rendered.promptLines, ["The silent initial placeholder is [...]."]);
  assert.deepEqual(rendered.answerLines, ["Cloze: ㅇ", "Initial ㅇ has no sound in syllable onset."]);
});

test("legacy card rendering still sanitizes Anki HTML", () => {
  const front = renderAnkiCardHtml("<style>.card { color: red; }</style><p>Front</p><script>alert('bad')</script>");
  const back = renderAnkiCardHtml("<p>Back<br>Answer</p>");

  assert.equal(front, "Front");
  assert.equal(back, "Back\nAnswer");
});

test("parity audit verifies native item renderer and scheduler coverage", () => {
  const result = runAnkiParityAudit(legacyBasicCard(), { packageId, packageVersion, reviewedAt: now });

  assert.equal(result.valid, true, result.checks.map((check) => `${check.name}: ${check.status}`).join("\n"));
  assert.equal(result.nativeItem.id, "legacy-anki/languages-korean/12345");
  assert.equal(result.rendered.itemIdentity.packageId, packageId);
  assert.equal(result.initialState.nextReviewAt, now);
  assert.equal(result.reviewedState.reviewCount, 1);
  assert.equal(result.reviewedState.status, "review");
});

test("native due listing surfaces an equivalent legacy card item", () => {
  const item = createNativeMemorizationItemFromAnkiCard(legacyBasicCard());
  const state = createInitialReviewState({ packageId, packageVersion, itemId: item.id }, now);

  const due = listDueReviewStates([state], now);

  assert.deepEqual(due.map((reviewItem) => reviewItem.itemId), ["legacy-anki/languages-korean/12345"]);
});

test("native backup captures parity registry and scheduler progress state", async () => {
  const fixture = await createParityUserStateFixture();
  try {
    const backup = await createUserDataBackup({ dataDir: fixture.contentDir, progressDir: fixture.progressDir, createdAt: now, whackSmackerVersion: "0.0.1-test" });

    assert.deepEqual(backup.includedSections, ["installedPackageRegistry", "reviewProgress"]);
    assert.equal(backup.restoreHints.installedPackages[0].packageId, packageId);
    assert.equal(backup.sections.reviewProgress.data.items[0].packageId, packageId);
    assert.equal(backup.sections.reviewProgress.data.items[0].packageVersion, packageVersion);
    assert.equal(backup.sections.reviewProgress.data.items[0].itemId, "legacy-anki/languages-korean/12345");
    assert.doesNotMatch(JSON.stringify(backup), /packages\/com\.sleepymario\.language\.korean\/0\.1\.0\/content/);
  } finally {
    await fixture.cleanup();
  }
});

test("legacy review command remains routed to the Anki-backed language command", () => {
  const registry = createCommandRegistry();
  const legacyReview = resolveCliCommand(registry, ["review", "Languages::Korean"]);
  const nativeDue = resolveCliCommand(registry, ["review", "due"]);

  assert.equal(legacyReview?.path.join(" "), "language review");
  assert.deepEqual(legacyReview?.args, ["Languages::Korean"]);
  assert.equal(nativeDue?.path.join(" "), "review due");
});

function legacyBasicCard() {
  return {
    cardId: 12345,
    deckName: "Languages::Korean",
    question: "What does 아 represent?",
    answer: "A Korean vowel-only syllable using ㅏ.",
    tags: ["Hangul", "vowel practice"]
  };
}

async function createParityUserStateFixture() {
  const root = await mkdtemp(join(tmpdir(), "wsm-anki-parity-"));
  const contentDir = join(root, "content");
  const progressDir = join(root, "progress");
  const item = createNativeMemorizationItemFromAnkiCard(legacyBasicCard());
  const registry = {
    registryFormatVersion: 1,
    updatedAt: now,
    packages: [
      {
        packageId,
        packageVersion,
        displayName: "Korean Curriculum",
        contentType: "language-curriculum",
        contentSchemaVersion: "1.0.0",
        minimumWhackSmackerVersion: "0.1.0",
        source: {
          repository: "https://github.com/SleepyMario/korean-curriculum",
          commit: "0000000000000000000000000000000000000000"
        },
        installedAt: now,
        installPath: `packages/${packageId}/${packageVersion}`,
        manifestSha256: "0".repeat(64),
        archiveSha256: "1".repeat(64),
        archiveSize: 1,
        catalogueId: "com.sleepymario.local"
      }
    ]
  };
  const progress = {
    reviewProgressFormatVersion: 1,
    updatedAt: now,
    items: [createInitialReviewState({ packageId, packageVersion, itemId: item.id }, now)],
    events: []
  };
  await writeJson(join(contentDir, "registry.json"), registry);
  await writeJson(join(progressDir, "review-progress.json"), progress);
  return {
    root,
    contentDir,
    progressDir,
    cleanup: () => rm(root, { recursive: true, force: true })
  };
}

async function writeJson(path, value) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
}
