import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import {
  generateContentPackage,
  generateLocalContentPackageCatalogue,
  installContentPackage
} from "../dist/packages/core/index.js";
import {
  getKoreanLanguageOverview,
  koreanPackageId,
  renderKoreanLanguage
} from "../dist/packages/language/index.js";

test("Korean language overview reports a clear native missing-package state", async () => {
  const root = await mkdtemp(join(tmpdir(), "wsm-korean-missing-"));
  try {
    const overview = await getKoreanLanguageOverview({ dataDir: join(root, "data") });
    const rendered = await renderKoreanLanguage({ dataDir: join(root, "data") });
    const renderedFileRequest = await renderKoreanLanguage({
      dataDir: join(root, "data"),
      file: "units/introduction-to-hangul/README.md"
    });

    assert.equal(overview.installed, false);
    assert.equal(overview.packageId, koreanPackageId);
    assert.match(rendered, /Korean content is not installed/);
    assert.match(rendered, /Generate content packages, generate a local catalogue, then install the Korean content package/);
    assert.match(renderedFileRequest, /Korean content is not installed/);
    assert.match(rendered, /whacksmacker content install com\.sleepymario\.language\.korean/);
    assert.doesNotMatch(rendered, /Anki|deck/u);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("installed Korean package exposes Introduction to Hangul entries through the language surface", async () => {
  const fixture = await createInstalledKoreanFixture();
  try {
    const overview = await getKoreanLanguageOverview({ dataDir: fixture.dataDir });
    const rendered = await renderKoreanLanguage({ dataDir: fixture.dataDir });

    assert.equal(overview.installed, true);
    assert.equal(overview.packageId, koreanPackageId);
    assert.equal(overview.packageVersion, "0.1.0");
    assert.ok(overview.introductionToHangulEntries.some((entry) => entry.path === "units/introduction-to-hangul/README.md"));
    assert.ok(overview.introductionToHangulEntries.some((entry) => entry.path === "units/introduction-to-hangul/chapter-01-vowels/README.md"));
    assert.match(rendered, /Introduction to Hangul/);
    assert.match(rendered, /units\/introduction-to-hangul\/README\.md/);
    assert.doesNotMatch(rendered, /Anki|deck/u);
  } finally {
    await fixture.cleanup();
  }
});

test("Korean language command opens Introduction to Hangul Markdown through the reading interface", async () => {
  const fixture = await createInstalledKoreanFixture();
  try {
    const rendered = await renderKoreanLanguage({
      dataDir: fixture.dataDir,
      file: "units/introduction-to-hangul/README.md"
    });

    assert.match(rendered, /Korean Curriculum/);
    assert.match(rendered, /com\.sleepymario\.language\.korean 0\.1\.0/);
    assert.match(rendered, /# Introduction to Hangul/);
  } finally {
    await fixture.cleanup();
  }
});

test("language korean CLI handles missing and installed package states", async () => {
  const fixture = await createInstalledKoreanFixture();
  const missingRoot = await mkdtemp(join(tmpdir(), "wsm-korean-cli-missing-"));
  try {
    const missing = await runCli(["language", "korean", "--data-dir", join(missingRoot, "data")]);
    const overview = await runCli(["language", "korean", "--data-dir", fixture.dataDir]);
    const readme = await runCli([
      "language",
      "korean",
      "--data-dir",
      fixture.dataDir,
      "--file",
      "units/introduction-to-hangul/README.md"
    ]);

    assert.equal(missing.exitCode, 0);
    assert.match(missing.stdout, /Korean content is not installed/);
    assert.equal(overview.exitCode, 0);
    assert.match(overview.stdout, /units\/introduction-to-hangul\/chapter-01-vowels\/README\.md/);
    assert.equal(readme.exitCode, 0);
    assert.match(readme.stdout, /# Introduction to Hangul/);
  } finally {
    await fixture.cleanup();
    await rm(missingRoot, { recursive: true, force: true });
  }
});

async function createInstalledKoreanFixture() {
  const root = await mkdtemp(join(tmpdir(), "wsm-korean-language-"));
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
    packageId: koreanPackageId,
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
  return { exitCode, stdout, stderr };
}
