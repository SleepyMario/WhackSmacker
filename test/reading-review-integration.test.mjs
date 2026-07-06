import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { spawn } from "node:child_process";
import { test } from "node:test";

import {
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

function memoryItem(id, prompt, answer, sourcePath) {
  return {
    schemaVersion: 1,
    id,
    kind: "basic-card",
    prompt: { text: prompt, mediaType: "text/plain" },
    answer: { text: answer, mediaType: "text/plain" },
    ...(sourcePath === undefined ? {} : { source: { path: sourcePath } })
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

async function runCli(args) {
  const child = spawn(process.execPath, ["dist/main.js", ...args], { cwd: process.cwd(), stdio: ["ignore", "pipe", "pipe"] });
  let stdout = "";
  let stderr = "";
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
