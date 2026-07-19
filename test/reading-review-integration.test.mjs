import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { spawn } from "node:child_process";
import { test } from "node:test";

import {
  findNextReadingReviewSource,
  listIntegratedDueReviewItems,
  listReadingReviewItems,
  listReadingReviewSources,
  loadReviewProgressStore,
  orderReviewItemsForSession,
  pedagogicalContentForMemorizationItem,
  pedagogicalFingerprint,
  recordReadingReviewAnswer,
  renderReadingReviewItem,
  syncReadingReviewItems
} from "../dist/packages/core/index.js";

const now = "2026-07-06T00:00:00Z";

test("items are grouped by source reading path", async () => {
  const fixture = await createReadingReviewFixture();
  try {
    const sources = await listReadingReviewSources({ dataDir: fixture.dataDir });

    assert.deepEqual(sources, [
      {
        packageId: "com.sleepymario.language.memory",
        packageVersion: "0.1.0",
        sourcePath: "missing.md",
        sourceExists: false,
        itemCount: 1
      },
      {
        packageId: "com.sleepymario.language.memory",
        packageVersion: "0.1.0",
        sourcePath: "README.md",
        sourceExists: true,
        itemCount: 2
      }
    ]);
  } finally {
    await fixture.cleanup();
  }
});

test("items can be listed by source and source paths are validated", async () => {
  const fixture = await createReadingReviewFixture();
  try {
    const items = await listReadingReviewItems({
      dataDir: fixture.dataDir,
      packageId: "com.sleepymario.language.memory",
      sourcePath: "README.md"
    });

    assert.deepEqual(items.map((item) => item.item.id), ["hangul/vowels/a", "hangul/vowels/eo"]);
    await assert.rejects(() => listReadingReviewItems({ dataDir: fixture.dataDir, sourcePath: "../outside.md" }), /source path must be package-relative/);
  } finally {
    await fixture.cleanup();
  }
});

test("items without source paths remain reviewable", async () => {
  const fixture = await createReadingReviewFixture();
  try {
    const items = await listReadingReviewItems({ dataDir: fixture.dataDir, packageId: "com.sleepymario.language.memory" });

    assert.ok(items.some((item) => item.item.id === "hangul/concept/no-source" && item.sourcePath === undefined));
  } finally {
    await fixture.cleanup();
  }
});

test("sync creates scheduler state for discovered items outside package directories", async () => {
  const fixture = await createReadingReviewFixture();
  try {
    const result = await syncReadingReviewItems({ dataDir: fixture.dataDir, now });
    const store = await loadReviewProgressStore(fixture.progressDir);

    assert.equal(result.created.length, 4);
    assert.equal(store.items.length, 4);
    assert.ok(!result.progressPath.startsWith(fixture.packageRoot));
    assert.equal(store.items.find((item) => item.itemId === "hangul/vowels/a")?.sourcePath, "README.md");
    assert.equal(store.items.find((item) => item.itemId === "hangul/concept/no-source")?.sourcePath, undefined);
    await assert.rejects(() => stat(join(fixture.packageRoot, "review-progress.json")), /ENOENT/);
  } finally {
    await fixture.cleanup();
  }
});

test("due review listing includes integrated items", async () => {
  const fixture = await createReadingReviewFixture();
  try {
    const due = await listIntegratedDueReviewItems({ dataDir: fixture.dataDir, now, packageId: "com.sleepymario.language.memory", limit: 2 });

    assert.deepEqual(due.map((item) => item.itemId), ["hangul/concept/no-source", "hangul/vowels/missing-source"]);
  } finally {
    await fixture.cleanup();
  }
});

test("review session ordering shuffles without dropping or duplicating items", () => {
  const items = ["one", "two", "three", "four"];
  const shuffled = orderReviewItemsForSession(items, {
    random: sequenceRandom([0.99, 0.01, 0.5])
  });

  assert.notDeepEqual(shuffled, items);
  assert.deepEqual([...shuffled].sort(), [...items].sort());
  assert.equal(new Set(shuffled).size, items.length);
  assert.deepEqual(orderReviewItemsForSession(items, { shuffle: false }), items);
});

test("renderer output works for integrated items and preserves identity", async () => {
  const fixture = await createReadingReviewFixture();
  try {
    const result = await renderReadingReviewItem({
      dataDir: fixture.dataDir,
      packageId: "com.sleepymario.language.memory",
      itemId: "hangul/vowels/a",
      answer: true
    });

    assert.equal(result.rendered.itemIdentity.packageId, "com.sleepymario.language.memory");
    assert.equal(result.rendered.itemIdentity.packageVersion, "0.1.0");
    assert.equal(result.rendered.itemIdentity.itemId, "hangul/vowels/a");
    assert.match(result.text, /Phrase:/);
    assert.match(result.text, /Answer:/);
    assert.doesNotMatch(result.text, /Review Prompt|Review Answer|Notes|Metadata/u);
  } finally {
    await fixture.cleanup();
  }
});

test("answer rating updates scheduler state", async () => {
  const fixture = await createReadingReviewFixture();
  try {
    await syncReadingReviewItems({ dataDir: fixture.dataDir, now });
    const result = await recordReadingReviewAnswer({
      dataDir: fixture.dataDir,
      packageId: "com.sleepymario.language.memory",
      itemId: "hangul/vowels/a",
      rating: "good",
      reviewedAt: now
    });

    assert.equal(result.state.packageId, "com.sleepymario.language.memory");
    assert.equal(result.state.packageVersion, "0.1.0");
    assert.equal(result.state.sourcePath, "README.md");
    assert.equal(result.state.itemId, "hangul/vowels/a");
    assert.equal(result.state.lastReviewedAt, now);
    assert.equal(result.state.reviewCount, 1);
    assert.equal(result.state.nextReviewAt, "2026-07-08T00:00:00Z");
    assert.equal(result.event.sourcePath, "README.md");
    assert.equal((await loadReviewProgressStore(fixture.progressDir)).events[0].rating, "good");
  } finally {
    await fixture.cleanup();
  }
});

test("missing source file does not corrupt progress", async () => {
  const fixture = await createReadingReviewFixture();
  try {
    const result = await syncReadingReviewItems({ dataDir: fixture.dataDir, now });

    assert.ok(result.created.some((item) => item.itemId === "hangul/vowels/missing-source"));
    assert.equal((await loadReviewProgressStore(fixture.progressDir)).items.length, 4);
  } finally {
    await fixture.cleanup();
  }
});

test("v2 sync preserves unchanged state, resets changed cards, retires removals, and never transfers state", async () => {
  const fixture = await createReadingReviewFixture();
  try {
    const first = v2MemoryItem("review/card-a", "Original prompt", "Answer A");
    const second = v2MemoryItem("review/card-b", "Second prompt", "Answer B");
    await writeV2Items(fixture, [first, second]);
    const initial = await syncReadingReviewItems({ dataDir: fixture.dataDir, now });
    assert.equal(initial.created.length, 2);

    await recordReadingReviewAnswer({ dataDir: fixture.dataDir, packageId: "com.sleepymario.language.memory", itemId: first.id, rating: "easy", reviewedAt: now });
    const reviewed = (await loadReviewProgressStore(fixture.progressDir)).items.find((state) => state.itemId === first.id);
    assert.equal(reviewed.reviewCount, 1);
    assert.equal(reviewed.status, "review");

    await writeV2Items(fixture, [{ ...first, tags: ["metadata-only"], provenance: { ...first.provenance, locator: "Corrected locator" } }, second]);
    const metadata = await syncReadingReviewItems({ dataDir: fixture.dataDir, now: "2026-07-07T00:00:00Z" });
    assert.equal(metadata.unchanged.length, 2);
    assert.equal((await loadReviewProgressStore(fixture.progressDir)).items.find((state) => state.itemId === first.id).reviewCount, 1);

    const revisedDraft = { ...first, prompt: { ...first.prompt, text: "Materially changed prompt", plainText: "Materially changed prompt" } };
    const revised = { ...revisedDraft, pedagogicalFingerprint: pedagogicalFingerprint(pedagogicalContentForMemorizationItem(revisedDraft)) };
    const replacement = v2MemoryItem("review/card-c", "Replacement prompt", "Answer C");
    await writeV2Items(fixture, [revised, replacement]);
    const changed = await syncReadingReviewItems({ dataDir: fixture.dataDir, now: "2026-07-08T00:00:00Z" });
    assert.deepEqual(changed.materiallyChanged.map((state) => state.itemId), [first.id]);
    assert.deepEqual(changed.created.map((state) => state.itemId), [replacement.id]);
    assert.deepEqual(changed.retired.map((state) => state.itemId), [second.id]);

    const states = (await loadReviewProgressStore(fixture.progressDir)).items;
    const reset = states.find((state) => state.itemId === first.id);
    const retired = states.find((state) => state.itemId === second.id);
    const fresh = states.find((state) => state.itemId === replacement.id);
    assert.equal(reset.reviewCount, 0);
    assert.equal(reset.status, "new");
    assert.equal(retired.status, "suspended");
    assert.equal(retired.retiredAt, "2026-07-08T00:00:00Z");
    assert.equal(fresh.reviewCount, 0);
    assert.equal(fresh.status, "new");
    assert.equal((await listIntegratedDueReviewItems({ dataDir: fixture.dataDir, now: "2026-07-08T00:00:00Z" })).some((state) => state.itemId === second.id), false);
  } finally {
    await fixture.cleanup();
  }
});

test("review integration CLI supports sources items due show and answer", async () => {
  const fixture = await createReadingReviewFixture();
  try {
    const sources = await runCli(["review", "sources", "--data-dir", fixture.dataDir]);
    const items = await runCli(["review", "items", "--package", "com.sleepymario.language.memory", "--source", "README.md", "--data-dir", fixture.dataDir]);
    const due = await runCli(["review", "due", "--package", "com.sleepymario.language.memory", "--data-dir", fixture.dataDir, "--now", now, "--limit", "1"]);
    const show = await runCli(["review", "show", "com.sleepymario.language.memory", "hangul/vowels/a", "--data-dir", fixture.dataDir, "--answer"]);
    const answer = await runCli([
      "review",
      "answer",
      "com.sleepymario.language.memory",
      "hangul/vowels/a",
      "--rating",
      "good",
      "--data-dir",
      fixture.dataDir,
      "--now",
      now
    ]);

    assert.match(sources.stdout, /README\.md/);
    assert.match(items.stdout, /hangul\/vowels\/a/);
    assert.match(due.stdout, /Due review items:/);
    assert.match(show.stdout, /Answer/);
    assert.match(answer.stdout, /Next review: 2026-07-08T00:00:00Z/);
  } finally {
    await fixture.cleanup();
  }
});

test("next review deck detection follows ordered sources in the same package", async () => {
  const fixture = await createContinuationReviewFixture();
  try {
    const first = await findNextReadingReviewSource({
      dataDir: fixture.dataDir,
      packageId: "com.sleepymario.language.sequence",
      sourcePath: "review-decks/chapter-001-005/cards.tsv"
    });
    const second = await findNextReadingReviewSource({
      dataDir: fixture.dataDir,
      packageId: "com.sleepymario.language.sequence",
      sourcePath: "review-decks/chapter-006-010/cards.tsv"
    });
    const third = await findNextReadingReviewSource({
      dataDir: fixture.dataDir,
      packageId: "com.sleepymario.language.sequence",
      sourcePath: "review-decks/chapter-011-015/cards.tsv"
    });

    assert.equal(first?.title, "Chapter 6-10");
    assert.equal(first?.sourcePath, "review-decks/chapter-006-010/cards.tsv");
    assert.equal(second?.title, "Chapter 11-15");
    assert.equal(second?.sourcePath, "review-decks/chapter-011-015/cards.tsv");
    assert.equal(third, undefined);
  } finally {
    await fixture.cleanup();
  }
});

test("review run uses shuffled order by default and keeps all cards available", async () => {
  const fixture = await createShuffleReviewFixture();
  try {
    const sourceOrder = ["one", "two", "three", "four"];
    const observedFirstPrompts = new Set();
    for (let index = 0; index < 12; index += 1) {
      const result = await runCli(
        [
          "review",
          "run",
          "--package",
          "com.sleepymario.language.shuffle",
          "--source",
          "review-decks/chapter-001-005/cards.tsv",
          "--data-dir",
          fixture.dataDir,
          "--now",
          now
        ],
        "q\n"
      );
      observedFirstPrompts.add(firstPromptValue(result.stdout));
    }

    const allItems = await listReadingReviewItems({
      dataDir: fixture.dataDir,
      packageId: "com.sleepymario.language.shuffle",
      sourcePath: "review-decks/chapter-001-005/cards.tsv"
    });
    assert.equal(allItems.length, 4);
    assert.equal(new Set(allItems.map((item) => item.item.id)).size, 4);
    assert.deepEqual(allItems.map((item) => item.item.prompt.text).sort(), [...sourceOrder].sort());
    assert.equal(observedFirstPrompts.size > 1 || !observedFirstPrompts.has("one"), true);
  } finally {
    await fixture.cleanup();
  }
});

test("review run can preserve source order with no-shuffle", async () => {
  const fixture = await createShuffleReviewFixture();
  try {
    const result = await runCli(
      [
        "review",
        "run",
        "--package",
        "com.sleepymario.language.shuffle",
        "--source",
        "review-decks/chapter-001-005/cards.tsv",
        "--data-dir",
        fixture.dataDir,
        "--now",
        now,
        "--no-shuffle"
      ],
      "q\n"
    );

    assert.equal(firstPromptValue(result.stdout), "one");
  } finally {
    await fixture.cleanup();
  }
});

test("review run prompts after a completed deck and continues when the user answers yes", async () => {
  const fixture = await createContinuationReviewFixture();
  try {
    const result = await runCli(
      [
        "review",
        "run",
        "--package",
        "com.sleepymario.language.sequence",
        "--source",
        "review-decks/chapter-001-005/cards.tsv",
        "--data-dir",
        fixture.dataDir,
        "--now",
        now
      ],
      "\ngood\ny\n\ngood\nn\n"
    );

    assert.match(result.stdout, /Completed review deck: Chapter 1-5/);
    assert.match(result.stdout, /Do you want to continue with the next deck\? \(y\/n\)/);
    assert.match(result.stdout, /Starting next review deck: Chapter 6-10/);
    assert.match(result.stdout, /Completed review deck: Chapter 6-10/);
    assert.match(result.stdout, /Review stopped\./);
    assert.doesNotMatch(result.stdout, /Starting next review deck: Chapter 11-15/);
  } finally {
    await fixture.cleanup();
  }
});

test("review run shows the front side before reveal prompt and q stops there", async () => {
  const fixture = await createContinuationReviewFixture();
  try {
    const result = await runCli(
      [
        "review",
        "run",
        "--package",
        "com.sleepymario.language.sequence",
        "--source",
        "review-decks/chapter-001-005/cards.tsv",
        "--data-dir",
        fixture.dataDir,
        "--now",
        now
      ],
      "q\n"
    );

    assert.match(result.stdout, /Phrase:\n\s+one/);
    assert.match(result.stdout, /Phrase:/);
    assert.match(result.stdout, /Press Enter to show answer, or q to stop:/);
    assert.match(result.stdout, /Review stopped\./);
    assert.doesNotMatch(result.stdout, /com\.sleepymario\.language\.sequence/);
    assert.doesNotMatch(result.stdout, /review-decks\/chapter-001-005\/cards\.tsv/);
    assert.doesNotMatch(result.stdout, /Item:/);
    assert.doesNotMatch(result.stdout, /Answer:\n\s+1/);
    assert.doesNotMatch(result.stdout, /Choose a rating/);
    assert.doesNotMatch(result.stdout, /q\.Press Enter/);
  } finally {
    await fixture.cleanup();
  }
});

test("review run shows answer before rating prompt and q stops at rating", async () => {
  const fixture = await createContinuationReviewFixture();
  try {
    const result = await runCli(
      [
        "review",
        "run",
        "--package",
        "com.sleepymario.language.sequence",
        "--source",
        "review-decks/chapter-001-005/cards.tsv",
        "--data-dir",
        fixture.dataDir,
        "--now",
        now
      ],
      "\nq\n"
    );

    const answerIndex = result.stdout.indexOf("Answer:\n  1");
    const ratingIndex = result.stdout.indexOf("Choose a rating");
    assert.match(result.stdout, /Phrase:\n\s+one/);
    assert.match(result.stdout, /Phrase:/);
    assert.match(result.stdout, /Answer:/);
    assert.match(result.stdout, /Press Enter to show answer, or q to stop:/);
    assert.notEqual(answerIndex, -1);
    assert.notEqual(ratingIndex, -1);
    assert.equal(answerIndex < ratingIndex, true);
    assert.match(result.stdout, /Review stopped\./);
    assert.doesNotMatch(result.stdout, /com\.sleepymario\.language\.sequence/);
    assert.doesNotMatch(result.stdout, /review-decks\/chapter-001-005\/cards\.tsv/);
    assert.doesNotMatch(result.stdout, /Item:/);
    assert.doesNotMatch(result.stdout, /Metadata/);
    assert.doesNotMatch(result.stdout, /Notes|Internal authoring note/u);
    assert.doesNotMatch(result.stdout, /Completed review deck: Chapter 1-5/);
    assert.doesNotMatch(result.stdout, /q\.Press Enter/);
  } finally {
    await fixture.cleanup();
  }
});

test("review run accepts numeric ratings without breaking continuation", async () => {
  const fixture = await createContinuationReviewFixture();
  try {
    const result = await runCli(
      [
        "review",
        "run",
        "--package",
        "com.sleepymario.language.sequence",
        "--source",
        "review-decks/chapter-001-005/cards.tsv",
        "--data-dir",
        fixture.dataDir,
        "--now",
        now
      ],
      "\n3\nn\n"
    );

    assert.match(result.stdout, /Answer:\n\s+1/);
    assert.match(result.stdout, /Choose a rating \(1 again \/ 2 hard \/ 3 good \/ 4 easy, or q to stop\):/);
    assert.match(result.stdout, /Completed review deck: Chapter 1-5/);
    assert.match(result.stdout, /Review stopped\./);
  } finally {
    await fixture.cleanup();
  }
});

test("review run quit before rating creates no fake rating", async () => {
  const fixture = await createContinuationReviewFixture();
  try {
    await runCli(
      [
        "review",
        "run",
        "--package",
        "com.sleepymario.language.sequence",
        "--source",
        "review-decks/chapter-001-005/cards.tsv",
        "--data-dir",
        fixture.dataDir,
        "--now",
        now,
        "--no-shuffle"
      ],
      "q\n"
    );
    const store = await loadReviewProgressStore(join(fixture.root, "progress"));
    const state = store.items.find((item) => item.itemId === "deck-001/card-001");

    assert.equal(state?.sourcePath, "review-decks/chapter-001-005/cards.tsv");
    assert.equal(state?.reviewCount, 0);
    assert.equal(state?.lastReviewedAt, undefined);
    assert.deepEqual(store.events, []);
  } finally {
    await fixture.cleanup();
  }
});

test("review run saves rated cards, preserves package files, and reloads state on the next session", async () => {
  const fixture = await createShuffleReviewFixture();
  const itemFilePath = join(fixture.packageRoot, "content", "memorization", "items.json");
  try {
    const beforeHash = await fileSha256(itemFilePath);
    await runCli(
      [
        "review",
        "run",
        "--package",
        "com.sleepymario.language.shuffle",
        "--source",
        "review-decks/chapter-001-005/cards.tsv",
        "--data-dir",
        fixture.dataDir,
        "--now",
        now,
        "--no-shuffle"
      ],
      "\n3\nq\n"
    );
    const afterHash = await fileSha256(itemFilePath);
    const store = await loadReviewProgressStore(join(fixture.root, "progress"));
    const reviewed = store.items.find((item) => item.itemId === "shuffle/card-001");

    assert.equal(afterHash, beforeHash);
    assert.equal(reviewed?.sourcePath, "review-decks/chapter-001-005/cards.tsv");
    assert.equal(reviewed?.reviewCount, 1);
    assert.equal(reviewed?.lastReviewedAt, now);
    assert.equal(reviewed?.nextReviewAt, "2026-07-08T00:00:00Z");
    assert.equal(store.events.length, 1);
    assert.equal(store.events[0].rating, "good");
    assert.equal(store.events[0].sourcePath, "review-decks/chapter-001-005/cards.tsv");

    const nextRun = await runCli(
      [
        "review",
        "run",
        "--package",
        "com.sleepymario.language.shuffle",
        "--source",
        "review-decks/chapter-001-005/cards.tsv",
        "--data-dir",
        fixture.dataDir,
        "--now",
        now,
        "--no-shuffle"
      ],
      "q\n"
    );

    assert.equal(firstPromptValue(nextRun.stdout), "two");
  } finally {
    await fixture.cleanup();
  }
});

test("review run stops cleanly when the user declines continuation", async () => {
  const fixture = await createContinuationReviewFixture();
  try {
    const result = await runCli(
      [
        "review",
        "run",
        "--package",
        "com.sleepymario.language.sequence",
        "--source",
        "review-decks/chapter-001-005/cards.tsv",
        "--data-dir",
        fixture.dataDir,
        "--now",
        now
      ],
      "\ngood\nn\n"
    );

    assert.match(result.stdout, /Completed review deck: Chapter 1-5/);
    assert.match(result.stdout, /Do you want to continue with the next deck\? \(y\/n\)/);
    assert.match(result.stdout, /Review stopped\./);
    assert.doesNotMatch(result.stdout, /Starting next review deck: Chapter 6-10/);
  } finally {
    await fixture.cleanup();
  }
});

test("review run reports no next deck without prompting after the final source", async () => {
  const fixture = await createContinuationReviewFixture();
  try {
    const result = await runCli(
      [
        "review",
        "run",
        "--package",
        "com.sleepymario.language.sequence",
        "--source",
        "review-decks/chapter-011-015/cards.tsv",
        "--data-dir",
        fixture.dataDir,
        "--now",
        now
      ],
      "\ngood\n"
    );

    assert.match(result.stdout, /Completed review deck: Chapter 11-15/);
    assert.match(result.stdout, /No next review deck is available\./);
    assert.doesNotMatch(result.stdout, /Do you want to continue with the next deck/);
  } finally {
    await fixture.cleanup();
  }
});

async function createReadingReviewFixture() {
  const root = await mkdtemp(join(tmpdir(), "wsm-reading-review-"));
  const dataDir = join(root, "content");
  const progressDir = join(root, "progress");
  const installPath = "packages/com.sleepymario.language.memory/0.1.0";
  const packageRoot = join(dataDir, installPath);
  const snapshotPath = "content/content.json";
  const itemPath = "content/memorization/items.json";
  const snapshot = {
    contentSchema: "whacksmacker-source-markdown-snapshot-v1",
    files: [{ path: "README.md", mediaType: "text/markdown", text: "# Reading\n\n아 and 어." }]
  };
  const items = {
    schemaVersion: 1,
    items: [
      memoryItem("hangul/concept/no-source", "What is Hangul?", "The Korean writing system."),
      memoryItem("hangul/vowels/a", "What does 아 show?", "The vowel ㅏ.", "README.md"),
      memoryItem("hangul/vowels/eo", "What does 어 show?", "The vowel ㅓ.", "README.md"),
      memoryItem("hangul/vowels/missing-source", "What does 이 show?", "The vowel ㅣ.", "missing.md")
    ]
  };
  const snapshotBuffer = Buffer.from(`${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
  const itemBuffer = Buffer.from(`${JSON.stringify(items, null, 2)}\n`, "utf8");
  const manifest = {
    packageFormatVersion: 1,
    packageId: "com.sleepymario.language.memory",
    packageVersion: "0.1.0",
    displayName: "Memory Package",
    description: "Package with reading and memorization items.",
    contentType: "language-curriculum",
    contentSchemaVersion: "1.0.0",
    minimumWhackSmackerVersion: "0.1.0",
    source: {
      repository: "https://example.invalid/memory",
      commit: "0000000000000000000000000000000000000000"
    },
    generatedAt: now,
    generator: {
      name: "test",
      version: "0.1.0"
    },
    entryPoints: [{ id: "primary", mediaType: "application/json", path: snapshotPath, role: "primary" }],
    files: [
      { path: snapshotPath, mediaType: "application/json", size: snapshotBuffer.length, sha256: sha256(snapshotBuffer) },
      {
        path: itemPath,
        mediaType: "application/vnd.whacksmacker.memorization-items+json",
        size: itemBuffer.length,
        sha256: sha256(itemBuffer)
      }
    ]
  };
  const registry = {
    registryFormatVersion: 1,
    updatedAt: now,
    packages: [
      {
        packageId: "com.sleepymario.language.memory",
        packageVersion: "0.1.0",
        displayName: "Memory Package",
        contentType: "language-curriculum",
        contentSchemaVersion: "1.0.0",
        minimumWhackSmackerVersion: "0.1.0",
        source: manifest.source,
        installedAt: now,
        installPath,
        manifestSha256: "0".repeat(64),
        archiveSha256: "1".repeat(64),
        archiveSize: 1,
        catalogueId: "com.sleepymario.local"
      }
    ]
  };

  await writeJson(join(dataDir, "registry.json"), registry);
  await writeJson(join(packageRoot, "manifest.json"), manifest);
  await writeFileEnsured(join(packageRoot, snapshotPath), snapshotBuffer);
  await writeFileEnsured(join(packageRoot, itemPath), itemBuffer);

  return {
    root,
    dataDir,
    progressDir,
    packageRoot,
    cleanup: () => rm(root, { recursive: true, force: true })
  };
}

async function writeV2Items(fixture, items) {
  const itemPath = "content/memorization/items.json";
  const buffer = Buffer.from(`${JSON.stringify({ schemaVersion: 2, items }, null, 2)}\n`, "utf8");
  const manifestPath = join(fixture.packageRoot, "manifest.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  manifest.contentSchemaVersion = "2.0.0";
  manifest.files = manifest.files.map((file) => file.path === itemPath ? { ...file, size: buffer.length, sha256: sha256(buffer) } : file);
  await writeFileEnsured(join(fixture.packageRoot, itemPath), buffer);
  await writeJson(manifestPath, manifest);
}

function v2MemoryItem(id, prompt, answer) {
  const draft = {
    ...memoryItem(id, prompt, answer, "README.md", "Chapter 1-5"),
    schemaVersion: 2,
    cardId: id,
    pedagogicalFingerprint: "0".repeat(64),
    deck: { id: "test-review-001-005", title: "Chapter 1-5", chapterStart: 1, chapterEnd: 5 },
    sourceChapters: [1], reviewDirection: "en-to-en", acceptedAnswers: [answer], distractors: ["Wrong"],
    explanation: "Expected interpretation.", testedMeaning: answer,
    testedLexicalIds: [], testedGrammarIds: [], testedGeographicIds: [], testedCastIds: [], testedSkillIds: [],
    provenance: { path: "README.md", locator: "Reading", evidence: "아 and 어." }
  };
  return { ...draft, pedagogicalFingerprint: pedagogicalFingerprint(pedagogicalContentForMemorizationItem(draft)) };
}

async function createContinuationReviewFixture() {
  const root = await mkdtemp(join(tmpdir(), "wsm-review-continuation-"));
  const dataDir = join(root, "content");
  const packageId = "com.sleepymario.language.sequence";
  const installPath = `packages/${packageId}/0.1.0`;
  const packageRoot = join(dataDir, installPath);
  const snapshotPath = "content/content.json";
  const itemPath = "content/memorization/items.json";
  const sourcePaths = [
    "review-decks/chapter-001-005/cards.tsv",
    "review-decks/chapter-006-010/cards.tsv",
    "review-decks/chapter-011-015/cards.tsv"
  ];
  const snapshot = {
    contentSchema: "whacksmacker-source-markdown-snapshot-v1",
    files: sourcePaths.map((path) => ({ path, mediaType: "text/tab-separated-values", text: "deck\tdirection\tfront\tback\n" }))
  };
  const items = {
    schemaVersion: 1,
    items: [
      { ...memoryItem("deck-001/card-001", "one", "1", sourcePaths[0], "Chapter 1-5"), notes: "Internal authoring note." },
      memoryItem("deck-006/card-001", "six", "6", sourcePaths[1], "Chapter 6-10"),
      memoryItem("deck-011/card-001", "eleven", "11", sourcePaths[2], "Chapter 11-15")
    ]
  };
  const snapshotBuffer = Buffer.from(`${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
  const itemBuffer = Buffer.from(`${JSON.stringify(items, null, 2)}\n`, "utf8");
  const manifest = {
    packageFormatVersion: 1,
    packageId,
    packageVersion: "0.1.0",
    displayName: "Sequence Package",
    description: "Package with ordered review sources.",
    contentType: "language-curriculum",
    contentSchemaVersion: "1.0.0",
    minimumWhackSmackerVersion: "0.1.0",
    source: {
      repository: "https://example.invalid/sequence",
      commit: "0000000000000000000000000000000000000000"
    },
    generatedAt: now,
    generator: {
      name: "test",
      version: "0.1.0"
    },
    entryPoints: [{ id: "primary", mediaType: "application/json", path: snapshotPath, role: "primary" }],
    files: [
      { path: snapshotPath, mediaType: "application/json", size: snapshotBuffer.length, sha256: sha256(snapshotBuffer) },
      {
        path: itemPath,
        mediaType: "application/vnd.whacksmacker.memorization-items+json",
        size: itemBuffer.length,
        sha256: sha256(itemBuffer)
      }
    ]
  };
  const registry = {
    registryFormatVersion: 1,
    updatedAt: now,
    packages: [
      {
        packageId,
        packageVersion: "0.1.0",
        displayName: "Sequence Package",
        contentType: "language-curriculum",
        contentSchemaVersion: "1.0.0",
        minimumWhackSmackerVersion: "0.1.0",
        source: manifest.source,
        installedAt: now,
        installPath,
        manifestSha256: "0".repeat(64),
        archiveSha256: "1".repeat(64),
        archiveSize: 1,
        catalogueId: "com.sleepymario.local"
      }
    ]
  };

  await writeJson(join(dataDir, "registry.json"), registry);
  await writeJson(join(packageRoot, "manifest.json"), manifest);
  await writeFileEnsured(join(packageRoot, snapshotPath), snapshotBuffer);
  await writeFileEnsured(join(packageRoot, itemPath), itemBuffer);

  return {
    root,
    dataDir,
    packageRoot,
    cleanup: () => rm(root, { recursive: true, force: true })
  };
}

async function createShuffleReviewFixture() {
  const root = await mkdtemp(join(tmpdir(), "wsm-review-shuffle-"));
  const dataDir = join(root, "content");
  const packageId = "com.sleepymario.language.shuffle";
  const installPath = `packages/${packageId}/0.1.0`;
  const packageRoot = join(dataDir, installPath);
  const snapshotPath = "content/content.json";
  const itemPath = "content/memorization/items.json";
  const sourcePath = "review-decks/chapter-001-005/cards.tsv";
  const snapshot = {
    contentSchema: "whacksmacker-source-markdown-snapshot-v1",
    files: [{ path: sourcePath, mediaType: "text/tab-separated-values", text: "deck\tdirection\tfront\tback\n" }]
  };
  const items = {
    schemaVersion: 1,
    items: [
      memoryItem("shuffle/card-001", "one", "1", sourcePath, "Chapter 1-5"),
      memoryItem("shuffle/card-002", "two", "2", sourcePath, "Chapter 1-5"),
      memoryItem("shuffle/card-003", "three", "3", sourcePath, "Chapter 1-5"),
      memoryItem("shuffle/card-004", "four", "4", sourcePath, "Chapter 1-5")
    ]
  };
  const snapshotBuffer = Buffer.from(`${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
  const itemBuffer = Buffer.from(`${JSON.stringify(items, null, 2)}\n`, "utf8");
  const manifest = {
    packageFormatVersion: 1,
    packageId,
    packageVersion: "0.1.0",
    displayName: "Shuffle Package",
    description: "Package with a multi-card review source.",
    contentType: "language-curriculum",
    contentSchemaVersion: "1.0.0",
    minimumWhackSmackerVersion: "0.1.0",
    source: {
      repository: "https://example.invalid/shuffle",
      commit: "0000000000000000000000000000000000000000"
    },
    generatedAt: now,
    generator: {
      name: "test",
      version: "0.1.0"
    },
    entryPoints: [{ id: "primary", mediaType: "application/json", path: snapshotPath, role: "primary" }],
    files: [
      { path: snapshotPath, mediaType: "application/json", size: snapshotBuffer.length, sha256: sha256(snapshotBuffer) },
      {
        path: itemPath,
        mediaType: "application/vnd.whacksmacker.memorization-items+json",
        size: itemBuffer.length,
        sha256: sha256(itemBuffer)
      }
    ]
  };
  const registry = {
    registryFormatVersion: 1,
    updatedAt: now,
    packages: [
      {
        packageId,
        packageVersion: "0.1.0",
        displayName: "Shuffle Package",
        contentType: "language-curriculum",
        contentSchemaVersion: "1.0.0",
        minimumWhackSmackerVersion: "0.1.0",
        source: manifest.source,
        installedAt: now,
        installPath,
        manifestSha256: "0".repeat(64),
        archiveSha256: "1".repeat(64),
        archiveSize: 1,
        catalogueId: "com.sleepymario.local"
      }
    ]
  };

  await writeJson(join(dataDir, "registry.json"), registry);
  await writeJson(join(packageRoot, "manifest.json"), manifest);
  await writeFileEnsured(join(packageRoot, snapshotPath), snapshotBuffer);
  await writeFileEnsured(join(packageRoot, itemPath), itemBuffer);

  return {
    root,
    dataDir,
    packageRoot,
    cleanup: () => rm(root, { recursive: true, force: true })
  };
}

function memoryItem(id, prompt, answer, sourcePath, sourceTitle) {
  return {
    schemaVersion: 1,
    id,
    kind: "basic-card",
    prompt: { text: prompt, mediaType: "text/plain" },
    answer: { text: answer, mediaType: "text/plain" },
    ...(sourcePath === undefined ? {} : { source: { path: sourcePath, ...(sourceTitle === undefined ? {} : { title: sourceTitle }) } })
  };
}

async function writeJson(path, value) {
  await writeFileEnsured(path, Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8"));
}

async function writeFileEnsured(path, data) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, data);
}

async function fileSha256(path) {
  return sha256(await readFile(path));
}

function sha256(data) {
  return createHash("sha256").update(data).digest("hex");
}

function firstPromptValue(stdout) {
  return stdout.match(/Phrase:\n\s+(.+)/)?.[1]?.trim();
}

function sequenceRandom(values) {
  let index = 0;
  return () => values[index++ % values.length];
}

async function runCli(args, input = "") {
  const child = spawn(process.execPath, ["dist/main.js", ...args], { cwd: process.cwd(), stdio: ["pipe", "pipe", "pipe"] });
  let stdout = "";
  let stderr = "";
  child.stdin.end(input);
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => {
    stdout += chunk;
  });
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
  });
  const exitCode = await new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("close", resolve);
  });
  assert.equal(exitCode, 0, stderr);
  return { stdout, stderr };
}
