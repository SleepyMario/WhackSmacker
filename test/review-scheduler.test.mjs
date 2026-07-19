import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";

import {
  createInitialReviewState,
  listDueReviewItems,
  listDueReviewStates,
  loadReviewProgressStore,
  recordReviewOutcome,
  recordStoredReviewOutcome,
  removeReviewProgressForPackage,
  resolveReviewProgressDirectory,
  reviewProgressFormatVersion,
  reviewProgressStorePath,
  saveReviewProgressStore,
  syncReviewProgressFromInstalledMemorizationItems,
  validateReviewProgressStore
} from "../dist/packages/core/index.js";

const schemaUrl = new URL("../schemas/review-progress-v2.schema.json", import.meta.url);
const now = "2026-07-06T00:00:00Z";

test("review progress JSON Schema parses as Draft 2020-12", async () => {
  const schema = JSON.parse(await readFile(schemaUrl, "utf8"));

  assert.equal(schema.$schema, "https://json-schema.org/draft/2020-12/schema");
  assert.equal(schema.properties.reviewProgressFormatVersion.const, reviewProgressFormatVersion);
});

test("scheduler initializes deterministic state for new items", () => {
  const state = createInitialReviewState(identity(), now);

  assert.equal(state.packageId, "com.sleepymario.language.memory");
  assert.equal(state.packageVersion, "0.1.0");
  assert.equal(state.itemId, "hangul/vowels/a");
  assert.equal(state.firstSeenAt, now);
  assert.equal(state.nextReviewAt, now);
  assert.equal(state.reviewCount, 0);
  assert.equal(state.lapseCount, 0);
  assert.equal(state.intervalDays, 0);
  assert.equal(state.easeFactor, 2.5);
  assert.equal(state.status, "new");
});

test("scheduler identity can include review source path", () => {
  const state = createInitialReviewState(identity("hangul/vowels/a", "review-decks/chapter-001-005/cards.tsv"), now);
  const result = recordReviewOutcome(state, "good", now);

  assert.equal(state.sourcePath, "review-decks/chapter-001-005/cards.tsv");
  assert.equal(result.event.sourcePath, "review-decks/chapter-001-005/cards.tsv");
});

test("due-item filtering is deterministic", () => {
  const due = createInitialReviewState(identity("hangul/vowels/a"), now);
  const future = { ...createInitialReviewState(identity("hangul/vowels/eo"), now), nextReviewAt: "2026-07-07T00:00:00Z" };
  const suspended = { ...createInitialReviewState(identity("hangul/vowels/i"), now), status: "suspended" };

  const result = listDueReviewStates([future, suspended, due], now);

  assert.deepEqual(result.map((state) => state.itemId), ["hangul/vowels/a"]);
});

test("review ratings update nextReviewAt as expected", () => {
  const state = createInitialReviewState(identity(), now);

  assert.equal(recordReviewOutcome(state, "again", now).state.nextReviewAt, "2026-07-06T00:10:00Z");
  assert.equal(recordReviewOutcome(state, "hard", now).state.nextReviewAt, "2026-07-07T00:00:00Z");
  assert.equal(recordReviewOutcome(state, "good", now).state.nextReviewAt, "2026-07-08T00:00:00Z");
  assert.equal(recordReviewOutcome(state, "easy", now).state.nextReviewAt, "2026-07-10T00:00:00Z");
});

test("sync creates progress outside installed package directories", async () => {
  const fixture = await createInstalledMemoryFixture();
  try {
    const result = await syncReviewProgressFromInstalledMemorizationItems({
      contentDataDir: fixture.contentDataDir,
      progressDir: fixture.progressDir,
      now
    });

    assert.equal(result.created.length, 2);
    assert.equal(result.store.items.length, 2);
    assert.equal(result.progressPath, join(fixture.progressDir, "review-progress.json"));
    assert.ok(!result.progressPath.startsWith(fixture.packageRoot));

    const store = await loadReviewProgressStore(fixture.progressDir);
    assert.deepEqual(store.items.map((item) => `${item.packageId}@${item.packageVersion}#${item.itemId}`), [
      "com.sleepymario.language.memory@0.1.0#hangul/vowels/a",
      "com.sleepymario.language.memory@0.1.0#hangul/vowels/eo"
    ]);
  } finally {
    await fixture.cleanup();
  }
});

test("stored review outcome preserves package id version and item id", async () => {
  const root = await mkdtemp(join(tmpdir(), "wsm-review-outcome-"));
  const progressDir = join(root, "progress");
  try {
    await saveReviewProgressStore(
      {
        reviewProgressFormatVersion,
        updatedAt: now,
        items: [createInitialReviewState(identity(), now)],
        events: []
      },
      progressDir
    );

    const result = await recordStoredReviewOutcome({ ...identity(), progressDir, rating: "good", reviewedAt: now });

    assert.equal(result.state.packageId, "com.sleepymario.language.memory");
    assert.equal(result.state.packageVersion, "0.1.0");
    assert.equal(result.state.itemId, "hangul/vowels/a");
    assert.equal(result.event.rating, "good");
    assert.equal(result.progressPath, join(progressDir, "review-progress.json"));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("package review progress removal deletes only matching package state and events", async () => {
  const root = await mkdtemp(join(tmpdir(), "wsm-review-remove-package-"));
  const progressDir = join(root, "progress");
  const kept = createInitialReviewState({
    packageId: "com.sleepymario.language.kept",
    packageVersion: "0.1.0",
    itemId: "deck/card"
  }, now);
  const removed = createInitialReviewState(identity(), now);
  const removedEvent = recordReviewOutcome(removed, "good", now).event;
  const keptEvent = recordReviewOutcome(kept, "good", now).event;
  try {
    await saveReviewProgressStore({
      reviewProgressFormatVersion,
      updatedAt: now,
      items: [removed, kept],
      events: [removedEvent, keptEvent]
    }, progressDir);

    const result = await removeReviewProgressForPackage({
      progressDir,
      packageId: "com.sleepymario.language.memory",
      packageVersion: "0.1.0",
      removedAt: "2026-07-07T00:00:00Z"
    });
    const store = await loadReviewProgressStore(progressDir);

    assert.equal(result.removedItemCount, 1);
    assert.equal(result.removedEventCount, 1);
    assert.deepEqual(store.items.map((item) => item.packageId), ["com.sleepymario.language.kept"]);
    assert.deepEqual(store.events.map((event) => event.packageId), ["com.sleepymario.language.kept"]);
    assert.equal(store.updatedAt, "2026-07-07T00:00:00Z");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("missing installed packages do not corrupt existing progress", async () => {
  const root = await mkdtemp(join(tmpdir(), "wsm-review-missing-"));
  const contentDataDir = join(root, "content");
  const progressDir = join(root, "progress");
  const original = {
    reviewProgressFormatVersion,
    updatedAt: now,
    items: [createInitialReviewState(identity(), now)],
    events: []
  };
  try {
    await saveReviewProgressStore(original, progressDir);
    const result = await syncReviewProgressFromInstalledMemorizationItems({ contentDataDir, progressDir, now: "2026-07-07T00:00:00Z" });

    assert.equal(result.created.length, 0);
    assert.deepEqual(await loadReviewProgressStore(progressDir), original);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("invalid ratings are rejected", () => {
  assert.throws(() => recordReviewOutcome(createInitialReviewState(identity(), now), "soon", now), /Invalid review rating/);
});

test("unsafe item ids are rejected before progress storage", () => {
  assert.throws(() => createInitialReviewState(identity("../outside"), now), /itemId must be stable/);
});

test("review progress store validation rejects malformed data", () => {
  const result = validateReviewProgressStore({
    reviewProgressFormatVersion,
    updatedAt: now,
    items: [createInitialReviewState(identity(), now), createInitialReviewState(identity(), now)],
    events: []
  });

  assert.equal(result.valid, false);
  assert.match(result.errors.join("\n"), /Duplicate review item state/);
});

test("progress directory defaults to the XDG progress location and remains separate from content", () => {
  const resolved = resolveReviewProgressDirectory(undefined, { XDG_DATA_HOME: "/tmp/wsm-xdg", HOME: "/home/tester" });

  assert.equal(resolved, "/tmp/wsm-xdg/whacksmacker/progress");
  assert.equal(reviewProgressStorePath(resolved), "/tmp/wsm-xdg/whacksmacker/progress/review-progress.json");
});

test("stored due listing reads the progress store", async () => {
  const root = await mkdtemp(join(tmpdir(), "wsm-review-due-"));
  const progressDir = join(root, "progress");
  try {
    await saveReviewProgressStore(
      {
        reviewProgressFormatVersion,
        updatedAt: now,
        items: [
          createInitialReviewState(identity("hangul/vowels/a"), now),
          { ...createInitialReviewState(identity("hangul/vowels/eo"), now), nextReviewAt: "2026-07-08T00:00:00Z" }
        ],
        events: []
      },
      progressDir
    );

    const due = await listDueReviewItems({ progressDir, now: "2026-07-07T00:00:00Z", limit: 1 });

    assert.deepEqual(due.map((item) => item.itemId), ["hangul/vowels/a"]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

function identity(itemId = "hangul/vowels/a", sourcePath) {
  return {
    packageId: "com.sleepymario.language.memory",
    packageVersion: "0.1.0",
    ...(sourcePath === undefined ? {} : { sourcePath }),
    itemId
  };
}

async function createInstalledMemoryFixture() {
  const root = await mkdtemp(join(tmpdir(), "wsm-review-installed-"));
  const contentDataDir = join(root, "content");
  const progressDir = join(root, "progress");
  const installPath = "packages/com.sleepymario.language.memory/0.1.0";
  const packageRoot = join(contentDataDir, installPath);
  const itemPath = "content/memorization/hangul/items.json";
  const items = {
    schemaVersion: 1,
    items: [memoryItem("hangul/vowels/a"), memoryItem("hangul/vowels/eo")]
  };
  const itemBuffer = Buffer.from(`${JSON.stringify(items, null, 2)}\n`, "utf8");
  const manifest = {
    packageFormatVersion: 1,
    packageId: "com.sleepymario.language.memory",
    packageVersion: "0.1.0",
    displayName: "Memory Package",
    description: "Package with memorization items.",
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
    entryPoints: [{ id: "primary", mediaType: "application/json", path: itemPath, role: "primary" }],
    dependencies: [],
    files: [
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

  await writeJson(join(contentDataDir, "registry.json"), registry);
  await writeJson(join(packageRoot, "manifest.json"), manifest);
  await writeFileEnsured(join(packageRoot, itemPath), itemBuffer);

  return {
    contentDataDir,
    progressDir,
    packageRoot,
    cleanup: () => rm(root, { recursive: true, force: true })
  };
}

function memoryItem(id) {
  return {
    schemaVersion: 1,
    id,
    kind: "vocabulary",
    prompt: {
      text: "아",
      mediaType: "text/plain"
    },
    answer: {
      text: "Korean vowel-only syllable.",
      mediaType: "text/plain"
    }
  };
}

async function writeJson(path, value) {
  await writeFileEnsured(path, Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8"));
}

async function writeFileEnsured(path, data) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, data);
}

function sha256(data) {
  return createHash("sha256").update(data).digest("hex");
}
