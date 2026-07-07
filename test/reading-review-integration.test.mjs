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
    await assert.rejects(() => stat(join(fixture.packageRoot, "review-progress.json")), /ENOENT/);
  } finally {
    await fixture.cleanup();
  }
});

test("due review listing includes integrated items", async () => {
  const fixture = await createReadingReviewFixture();
  try {
    const due = await listIntegratedDueReviewItems({ dataDir: fixture.dataDir, now, packageId: "com.sleepymario.language.memory", limit: 2 });

    assert.deepEqual(due.map((item) => item.itemId), ["hangul/concept/no-source", "hangul/vowels/a"]);
  } finally {
    await fixture.cleanup();
  }
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
    assert.match(result.text, /Prompt/);
    assert.match(result.text, /Answer/);
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
    assert.equal(result.state.itemId, "hangul/vowels/a");
    assert.equal(result.state.nextReviewAt, "2026-07-08T00:00:00Z");
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

    assert.match(result.stdout, /Prompt\n\s+one/);
    assert.match(result.stdout, /Press Enter to show answer, or q to stop:/);
    assert.match(result.stdout, /Review stopped\./);
    assert.doesNotMatch(result.stdout, /Answer\n\s+1/);
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

    const answerIndex = result.stdout.indexOf("Answer\n  1");
    const ratingIndex = result.stdout.indexOf("Choose a rating");
    assert.match(result.stdout, /Prompt\n\s+one/);
    assert.match(result.stdout, /Press Enter to show answer, or q to stop:/);
    assert.notEqual(answerIndex, -1);
    assert.notEqual(ratingIndex, -1);
    assert.equal(answerIndex < ratingIndex, true);
    assert.match(result.stdout, /Review stopped\./);
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

    assert.match(result.stdout, /Answer\n\s+1/);
    assert.match(result.stdout, /Choose a rating \(1 again \/ 2 hard \/ 3 good \/ 4 easy, or q to stop\):/);
    assert.match(result.stdout, /Completed review deck: Chapter 1-5/);
    assert.match(result.stdout, /Review stopped\./);
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
      memoryItem("deck-001/card-001", "one", "1", sourcePaths[0], "Chapter 1-5"),
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

function sha256(data) {
  return createHash("sha256").update(data).digest("hex");
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
