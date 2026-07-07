import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { test } from "node:test";

import {
  generateContentPackage,
  generateLocalContentPackageCatalogue,
  installContentPackage,
  listInstalledContentPackages,
  listInstalledMemorizationItemFiles,
  listInstalledReadablePackages,
  listReadableContentEntries,
  listReadingReviewItems,
  listReadingReviewSources,
  readInstalledContentEntry,
  readInstalledMemorizationItems,
  renderReadingContent
} from "../dist/packages/core/index.js";

test("installed readable packages are discovered from the registry", async () => {
  const fixture = await createInstalledReadingFixture();
  try {
    const packages = await listInstalledReadablePackages(fixture.dataDir);

    assert.deepEqual(packages.map((item) => item.packageId), ["com.sleepymario.language.korean"]);
  } finally {
    await fixture.cleanup();
  }
});

test("readable entries are listed from the installed source snapshot", async () => {
  const fixture = await createInstalledReadingFixture();
  try {
    const entries = await listReadableContentEntries("com.sleepymario.language.korean", fixture.dataDir);

    assert.ok(entries.some((entry) => entry.path === "README.md"));
    assert.ok(entries.some((entry) => entry.path === "units/hangul-foundation/README.md"));
    assert.equal(entries.every((entry) => entry.source === "snapshot"), true);
  } finally {
    await fixture.cleanup();
  }
});

test("installed content entry can be read and rendered", async () => {
  const fixture = await createInstalledReadingFixture();
  try {
    const result = await readInstalledContentEntry({
      dataDir: fixture.dataDir,
      packageId: "com.sleepymario.language.korean",
      path: "units/hangul-foundation/README.md"
    });
    const rendered = renderReadingContent(result);

    assert.equal(result.entry.mediaType, "text/markdown");
    assert.match(result.text, /Hangul Foundation/);
    assert.match(rendered, /Korean Curriculum/);
    assert.match(rendered, /units\/hangul-foundation\/README\.md/);
  } finally {
    await fixture.cleanup();
  }
});

test("reader rejects unsafe requested paths", async () => {
  const fixture = await createInstalledReadingFixture();
  try {
    await assert.rejects(
      () =>
        readInstalledContentEntry({
          dataDir: fixture.dataDir,
          packageId: "com.sleepymario.language.korean",
          path: "../registry.json"
        }),
      /path must be package-relative and safe/
    );
  } finally {
    await fixture.cleanup();
  }
});

test("reading installed content does not write progress into package directories", async () => {
  const fixture = await createInstalledReadingFixture();
  try {
    await readInstalledContentEntry({
      dataDir: fixture.dataDir,
      packageId: "com.sleepymario.language.korean",
      path: "README.md"
    });

    await assert.rejects(() => stat(join(fixture.dataDir, "packages", "com.sleepymario.language.korean", "0.1.0", "progress.json")), /ENOENT/);
    await assert.rejects(() => stat(join(fixture.dataDir, "progress.json")), /ENOENT/);
  } finally {
    await fixture.cleanup();
  }
});

test("content read CLI lists packages files and renders selected content", async () => {
  const fixture = await createInstalledReadingFixture();
  try {
    const packages = await runCli(["content", "read", "--data-dir", fixture.dataDir]);
    const files = await runCli(["content", "files", "com.sleepymario.language.korean", "--data-dir", fixture.dataDir]);
    const rendered = await runCli([
      "content",
      "read",
      "com.sleepymario.language.korean",
      "--file",
      "units/hangul-foundation/README.md",
      "--data-dir",
      fixture.dataDir
    ]);

    assert.match(packages.stdout, /Readable content packages:/);
    assert.match(files.stdout, /units\/hangul-foundation\/README\.md/);
    assert.match(rendered.stdout, /Hangul Foundation/);
  } finally {
    await fixture.cleanup();
  }
});

test("installed Korean package exposes Chapter 20 and Chapter 1-20 vocabulary review deck", async () => {
  const fixture = await createInstalledReadingFixture();
  try {
    const installed = await listInstalledContentPackages(fixture.dataDir);
    const entries = await listReadableContentEntries("com.sleepymario.language.korean", fixture.dataDir);
    const chapter20 = await readInstalledContentEntry({
      dataDir: fixture.dataDir,
      packageId: "com.sleepymario.language.korean",
      path: "units/korean-core/chapter-020-basic-life-sentences-13/chapter.md"
    });
    const deckSource = await readInstalledContentEntry({
      dataDir: fixture.dataDir,
      packageId: "com.sleepymario.language.korean",
      path: "review-decks/chapter-001-020/cards.tsv"
    });
    const itemFiles = await listInstalledMemorizationItemFiles("com.sleepymario.language.korean", fixture.dataDir);
    const collection = await readInstalledMemorizationItems(
      "com.sleepymario.language.korean",
      "content/memorization/review-decks/chapter-001-020.json",
      fixture.dataDir
    );
    const sources = await listReadingReviewSources({
      dataDir: fixture.dataDir,
      packageId: "com.sleepymario.language.korean"
    });
    const items = await listReadingReviewItems({
      dataDir: fixture.dataDir,
      packageId: "com.sleepymario.language.korean",
      sourcePath: "review-decks/chapter-001-020/cards.tsv"
    });

    assert.deepEqual(installed.map((record) => record.packageId), ["com.sleepymario.language.korean"]);
    assert.ok(entries.some((entry) => entry.path === "units/korean-core/chapter-020-basic-life-sentences-13/chapter.md"));
    assert.ok(entries.some((entry) => entry.path === "review-decks/chapter-001-020/cards.tsv"));
    assert.match(chapter20.text, /Chapter 20 -- Basic Life Sentences XIII/);
    assert.match(deckSource.text, /^Chapter 1-20\tKorean -> English\t안녕하세요\t/m);
    assert.deepEqual(itemFiles.map((file) => file.path), ["content/memorization/review-decks/chapter-001-020.json"]);
    assert.equal(collection.items.length, 214);

    assert.equal(sources.some((source) => source.sourcePath === "review-decks/chapter-001-020/cards.tsv" && source.title === "Chapter 1-20"), true);
    assert.equal(items.length, 214);
    assert.ok(items.some((item) => item.item.prompt.text === "안녕하세요" && item.item.answer.text === "hello"));
    assert.ok(items.some((item) => item.item.prompt.text === "hello" && item.item.answer.text === "안녕하세요"));
    assert.ok(items.some((item) => item.item.prompt.text === "은/는" && item.item.answer.text === "topic particle"));
    assert.ok(items.some((item) => item.item.prompt.text === "subject/existence marker" && item.item.answer.text === "이/가"));

    const forbiddenPatterns = [
      "저는 N입니다",
      "제 이름은 N입니다",
      "N입니까?",
      "N이에요/예요",
      "N이에요/예요?",
      "N이야/야",
      "N이야/야?",
      "N이다",
      "N인가?",
      "N이/가 있습니다",
      "N이/가 없습니다",
      "N이/가 있어요",
      "N이/가 없어요"
    ];
    assert.equal(
      items.some((item) => forbiddenPatterns.includes(item.item.prompt.text) || forbiddenPatterns.includes(item.item.answer.text)),
      false
    );
  } finally {
    await fixture.cleanup();
  }
});

async function createInstalledReadingFixture() {
  const root = await mkdtemp(join(tmpdir(), "wsm-content-reader-"));
  const packageDirectory = join(root, "packages");
  const cataloguePath = join(root, "catalogue", "catalogue.json");
  const dataDir = join(root, "data", "content");
  await generateContentPackage({
    targetId: "korean-curriculum",
    outputDirectory: packageDirectory,
    generatedAt: "2026-07-06T00:00:00Z"
  });
  await generateLocalContentPackageCatalogue({
    packagesDirectory: packageDirectory,
    outputPath: cataloguePath,
    generatedAt: "2026-07-06T00:00:00Z"
  });
  await installContentPackage({
    cataloguePath,
    dataDir,
    packageId: "com.sleepymario.language.korean",
    installedAt: "2026-07-06T00:00:00Z"
  });

  return {
    root,
    dataDir,
    cleanup: () => rm(root, { recursive: true, force: true })
  };
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
