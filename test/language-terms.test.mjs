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
  getLinguisticTermsOverview,
  linguisticTerminologyPackageId,
  renderLinguisticTerms
} from "../dist/packages/language/index.js";

test("Linguistic Terms overview reports a clear native missing-package state", async () => {
  const root = await mkdtemp(join(tmpdir(), "wsm-terms-missing-"));
  try {
    const overview = await getLinguisticTermsOverview({ dataDir: join(root, "data") });
    const rendered = await renderLinguisticTerms({ dataDir: join(root, "data") });
    const renderedFileRequest = await renderLinguisticTerms({
      dataDir: join(root, "data"),
      file: "INDEX.md"
    });

    assert.equal(overview.installed, false);
    assert.equal(overview.packageId, linguisticTerminologyPackageId);
    assert.match(rendered, /Linguistic Terminology content is not installed/);
    assert.match(renderedFileRequest, /Linguistic Terminology content is not installed/);
    assert.match(rendered, /whacksmacker content install com\.sleepymario\.language\.linguistic-terminology/);
    assert.doesNotMatch(rendered, /Anki|deck/u);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("installed Linguistic Terminology package exposes readable glossary entries", async () => {
  const fixture = await createInstalledTermsFixture();
  try {
    const overview = await getLinguisticTermsOverview({ dataDir: fixture.dataDir });
    const rendered = await renderLinguisticTerms({ dataDir: fixture.dataDir });

    assert.equal(overview.installed, true);
    assert.equal(overview.packageId, linguisticTerminologyPackageId);
    assert.equal(overview.packageVersion, "0.1.0");
    assert.ok(overview.readableEntries.some((entry) => entry.path === "INDEX.md"));
    assert.ok(overview.readableEntries.some((entry) => entry.path === "terms/korean.md"));
    assert.match(rendered, /Readable terminology entries/);
    assert.match(rendered, /INDEX\.md/);
    assert.match(rendered, /terms\/korean\.md/);
    assert.doesNotMatch(rendered, /Anki|deck/u);
  } finally {
    await fixture.cleanup();
  }
});

test("Linguistic Terms command opens installed Markdown through the reading interface", async () => {
  const fixture = await createInstalledTermsFixture();
  try {
    const rendered = await renderLinguisticTerms({
      dataDir: fixture.dataDir,
      file: "INDEX.md"
    });

    assert.match(rendered, /Linguistic Terminology/);
    assert.match(rendered, /com\.sleepymario\.language\.linguistic-terminology 0\.1\.0/);
    assert.match(rendered, /# Index/);
  } finally {
    await fixture.cleanup();
  }
});

test("language terms CLI handles missing and installed package states", async () => {
  const fixture = await createInstalledTermsFixture();
  const missingRoot = await mkdtemp(join(tmpdir(), "wsm-terms-cli-missing-"));
  try {
    const missing = await runCli(["language", "terms", "--data-dir", join(missingRoot, "data")]);
    const overview = await runCli(["language", "terms", "--data-dir", fixture.dataDir]);
    const index = await runCli([
      "language",
      "terms",
      "--data-dir",
      fixture.dataDir,
      "--file",
      "INDEX.md"
    ]);

    assert.equal(missing.exitCode, 0);
    assert.match(missing.stdout, /Linguistic Terminology content is not installed/);
    assert.equal(overview.exitCode, 0);
    assert.match(overview.stdout, /terms\/korean\.md/);
    assert.equal(index.exitCode, 0);
    assert.match(index.stdout, /# Index/);
  } finally {
    await fixture.cleanup();
    await rm(missingRoot, { recursive: true, force: true });
  }
});

async function createInstalledTermsFixture() {
  const root = await mkdtemp(join(tmpdir(), "wsm-terms-language-"));
  const packageDirectory = join(root, "packages");
  const cataloguePath = join(root, "catalogue", "catalogue.json");
  const dataDir = join(root, "data", "content");
  await generateContentPackage({
    targetId: "linguistic-terminology",
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
    packageId: linguisticTerminologyPackageId,
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

