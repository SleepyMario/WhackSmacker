import { generateReadingFixture } from './fixtures/package-source.mjs';
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { chmod, mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { spawn } from "node:child_process";
import { test } from "node:test";
import { deflateRawSync } from "node:zlib";

import {
  detectContentPackageUpdates,
  generateContentPackage,
  generateLocalContentPackageCatalogue,
  installContentPackage,
  listInstalledMemorizationItemFiles,
  listAvailableContentPackages,
  listInstalledContentPackages,
  loadInstalledPackageRegistry,
  maxPackageUncompressedSizeBytes,
  migrateInstalledPackageRegistryVersionAxes,
  removeContentPackage,
  readInstalledContentEntry,
  readInstalledMemorizationItems,
  readInstalledPackageImageAsset,
  pedagogicalContentForMemorizationItem,
  pedagogicalFingerprint,
  updateContentPackage,
  validateContentPackageManifest,
  validateInstalledPackageRegistry
} from "../dist/packages/core/index.js";

const animalsPackageId = "com.sleepymario.language.dutch.general.animals.preview-001-100";

test("installed Japanese Review rejects a stale reading that disagrees with the canonical reading package", async () => {
  const root = await mkdtemp(join(tmpdir(), "wsm-japanese-contextual-installed-"));
  const packageDirectory = join(root, "packages");
  const cataloguePath = join(root, "catalogue", "catalogue.json");
  const dataDir = join(root, "data", "content");
  try {
    await generateContentPackage({ targetId: "japanese-curriculum", outputDirectory: packageDirectory, generatedAt: "2026-07-24T00:00:00Z" });
    await generateContentPackage({ targetId: "japanese-core-reviews", outputDirectory: packageDirectory, generatedAt: "2026-07-24T00:00:00Z" });
    await generateLocalContentPackageCatalogue({ packagesDirectory: packageDirectory, outputPath: cataloguePath, generatedAt: "2026-07-24T00:00:00Z" });
    await installContentPackage({ cataloguePath, dataDir, packageId: "com.sleepymario.language.japanese" });
    const review = await installContentPackage({ cataloguePath, dataDir, packageId: "com.sleepymario.language.japanese.reviews" });
    const [file] = await listInstalledMemorizationItemFiles("com.sleepymario.language.japanese.reviews", dataDir);
    assert.ok(file);
    await assert.doesNotReject(() => readInstalledMemorizationItems(file.packageId, file.path, dataDir, file.packageVersion));

    const installedPath = join(review.installPath, file.path);
    const document = JSON.parse(await readFile(installedPath, "utf8"));
    for (const item of document.items.filter((candidate) => candidate.testedLexicalIds?.includes("ja.pronoun.nan.what"))) {
      if (item.prompt.language === "ja-Kana") item.prompt.text = "なに";
      item.acceptedAnswers = item.acceptedAnswers.map((answer) => answer.replace("なん", "なに"));
      item.pedagogicalFingerprint = pedagogicalFingerprint(pedagogicalContentForMemorizationItem(item));
    }
    await chmod(installedPath, 0o600);
    await writeFile(installedPath, `${JSON.stringify(document, null, 2)}\n`);
    await assert.rejects(
      () => readInstalledMemorizationItems(file.packageId, file.path, dataDir, file.packageVersion),
      /disagrees with canonical contextual identity|complete lexical reading/u
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
