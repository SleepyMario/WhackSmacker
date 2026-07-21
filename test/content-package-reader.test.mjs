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

    assert.deepEqual(packages.map((item) => item.packageId), ["com.sleepymario.language.dutch"]);
  } finally {
    await fixture.cleanup();
  }
});

test("readable entries are listed from the installed source snapshot", async () => {
  const fixture = await createInstalledReadingFixture();
  try {
    const entries = await listReadableContentEntries("com.sleepymario.language.dutch", fixture.dataDir);

    assert.equal(entries.some((entry) => entry.path === "README.md"), false);
    assert.ok(entries.some((entry) => entry.path === "units/dutch-core/chapter-001-basic-sentences-1/chapter.md"));
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
      packageId: "com.sleepymario.language.dutch",
      path: "units/dutch-core/chapter-001-basic-sentences-1/chapter.md"
    });
    const rendered = renderReadingContent(result);

    assert.equal(result.entry.mediaType, "text/markdown");
    assert.match(result.text, /Chapter 1/u);
    assert.match(rendered, /Dutch/u);
    assert.match(rendered, /units\/dutch-core\/chapter-001-basic-sentences-1\/chapter\.md/u);
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
          packageId: "com.sleepymario.language.dutch",
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
      packageId: "com.sleepymario.language.dutch",
      path: "units/dutch-core/chapter-001-basic-sentences-1/chapter.md"
    });

    await assert.rejects(() => stat(join(fixture.dataDir, "packages", "com.sleepymario.language.dutch", "0.1.0", "progress.json")), /ENOENT/);
    await assert.rejects(() => stat(join(fixture.dataDir, "progress.json")), /ENOENT/);
  } finally {
    await fixture.cleanup();
  }
});

test("content read CLI lists packages files and renders selected content", async () => {
  const fixture = await createInstalledReadingFixture();
  try {
    const packages = await runCli(["content", "read", "--data-dir", fixture.dataDir]);
    const files = await runCli(["content", "files", "com.sleepymario.language.dutch", "--data-dir", fixture.dataDir]);
    const rendered = await runCli([
      "content",
      "read",
      "com.sleepymario.language.dutch",
      "--file",
      "units/dutch-core/chapter-001-basic-sentences-1/chapter.md",
      "--data-dir",
      fixture.dataDir
    ]);

    assert.match(packages.stdout, /Readable content packages:/);
    assert.match(files.stdout, /units\/dutch-core\/chapter-001-basic-sentences-1\/chapter\.md/u);
    assert.match(rendered.stdout, /Chapter 1/u);
  } finally {
    await fixture.cleanup();
  }
});

test("rendered reading content hides useless Status table columns", () => {
  const rendered = renderReadingContent({
    package: {
      packageId: "com.sleepymario.language.synthetic",
      packageVersion: "0.1.0",
      displayName: "Synthetic Curriculum",
      installPath: "packages/com.sleepymario.language.synthetic/0.1.0",
      installedAt: "2026-07-09T00:00:00Z",
      source: { type: "file", path: "/tmp/korean.wspkg" }
    },
    entry: {
      path: "units/korean-core/chapter-001-a-polite-first-meeting/chapter.md",
      mediaType: "text/markdown",
      title: "Chapter 1",
      source: "snapshot"
    },
    text: [
      "# Chapter 1",
      "",
      "| Korean Word | Hanja Form | Status | Note |",
      "|---|---|---|---|",
      "| 학생 | 學生 | reference-only | Useful common word. |"
    ].join("\n")
  });

  assert.match(rendered, /\| Korean Word \| Hanja Form \| Note \|/u);
  assert.match(rendered, /\| 학생 \| 學生 \| Useful common word\. \|/u);
  assert.doesNotMatch(rendered, /Status|reference-only/u);
});

test("rendered reading content normalizes noun-only vocabulary notes", () => {
  const rendered = renderReadingContent({
    package: {
      packageId: "com.sleepymario.language.synthetic",
      packageVersion: "0.1.0",
      displayName: "Synthetic Curriculum",
      installPath: "packages/com.sleepymario.language.synthetic/0.1.0",
      installedAt: "2026-07-09T00:00:00Z",
      source: { type: "file", path: "/tmp/korean.wspkg" }
    },
    entry: {
      path: "units/korean-core/chapter-001-a-polite-first-meeting/chapter.md",
      mediaType: "text/markdown",
      title: "Chapter 1",
      source: "snapshot"
    },
    text: [
      "# Chapter 1",
      "",
      "| Korean | Meaning | Notes |",
      "|---|---|---|",
      "| 학생 | student | Can fill the N slot. |",
      "| 저 | I, me | Used inside `저는`. |",
      "| 한국 | Korea | New noun; not self-ID here. |"
    ].join("\n")
  });

  assert.match(rendered, /\| 학생 \| student \| Noun \|/u);
  assert.match(rendered, /\| 한국 \| Korea \| Noun \|/u);
  assert.match(rendered, /\| 저 \| I, me \| Used inside `저는`\. \|/u);
  assert.doesNotMatch(rendered, /Can fill the N slot|New noun; not self-ID here/u);
});

test("reading projections hide developer blocks by default and preserve uninterrupted infinitive rows", () => {
  const result = {
    package: {
      packageId: "com.sleepymario.language.dutch",
      packageVersion: "0.1.0",
      displayName: "Dutch Curriculum"
    },
    entry: {
      path: "units/dutch-core/chapter-001-basic-sentences-1/chapter.md",
      mediaType: "text/markdown",
      title: "Chapter 1",
      source: "snapshot"
    },
    text: [
      "# Chapter 1",
      "",
      "The infinitive row gives the base verb form.",
      "",
      "<!-- whacksmacker:developer-only:start -->",
      "It does not introduce `je`, `jij`, or `u` yet.",
      "<!-- whacksmacker:developer-only:end -->",
      "",
      "| Dutch | Meaning | Notes |",
      "|---|---|---|",
      "| ben | am | Verb |",
      "| zijn | to be | Infinitive |",
      "| de student | student | Noun |",
      "| de docent | teacher | Noun |"
    ].join("\n")
  };

  const normal = renderReadingContent(result);
  const developer = renderReadingContent(result, "developer");

  assert.doesNotMatch(normal, /does not introduce/u);
  assert.match(normal, /infinitive row gives the base verb form/u);
  const expectedVocabulary = [
    "| Dutch | Meaning | Notes |",
    "| --- | --- | --- |",
    "| ben | am | Verb |",
    "| zijn | to be | Infinitive |",
    "|  |  |  |",
    "| de student | student | Noun |",
    "|  |  |  |",
    "| de docent | teacher | Noun |"
  ].join("\n");
  assert.match(normal, new RegExp(expectedVocabulary.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "u"));
  assert.doesNotMatch(normal, /<br\s*\/?/iu);
  assert.match(developer, /It does not introduce `je`, `jij`, or `u` yet\./u);
  assert.match(developer, new RegExp(expectedVocabulary.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "u"));
  assert.equal(result.text.split("\n").filter((line) => line.startsWith("|") && !line.startsWith("|---")).length, 5);
});

async function createInstalledReadingFixture() {
  const root = await mkdtemp(join(tmpdir(), "wsm-content-reader-"));
  const packageDirectory = join(root, "packages");
  const cataloguePath = join(root, "catalogue", "catalogue.json");
  const dataDir = join(root, "data", "content");
  await generateContentPackage({
    targetId: "dutch-curriculum",
    outputDirectory: packageDirectory,
    generatedAt: "2026-07-06T00:00:00Z"
  });
  await generateContentPackage({
    targetId: "dutch-core-reviews",
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
    packageId: "com.sleepymario.language.dutch",
    installedAt: "2026-07-06T00:00:00Z"
  });
  await installContentPackage({
    cataloguePath,
    dataDir,
    packageId: "com.sleepymario.language.dutch.reviews",
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
