import { generateReadingFixture } from './fixtures/package-source.mjs';
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { chmod, cp, mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
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
    const reading = await installContentPackage({ cataloguePath, dataDir, packageId: "com.sleepymario.language.japanese" });
    const review = await installContentPackage({ cataloguePath, dataDir, packageId: "com.sleepymario.language.japanese.reviews" });
    const registryPath = join(dataDir, "registry.json");
    const registry = JSON.parse(await readFile(registryPath, "utf8"));
    const currentReading = registry.packages.find((record) => record.packageId === "com.sleepymario.language.japanese");
    assert.ok(currentReading);
    const staleReading = {
      ...currentReading,
      artifactRevision: Math.max(1, currentReading.artifactRevision - 1),
      installPath: `${currentReading.installPath}-stale`,
      archiveSha256: "1".repeat(64),
      manifestSha256: "2".repeat(64)
    };
    await cp(reading.installPath, join(dataDir, staleReading.installPath), { recursive: true });
    const staleContentPath = join(dataDir, staleReading.installPath, "content", "content.json");
    const staleSnapshot = JSON.parse(await readFile(staleContentPath, "utf8"));
    const staleContextualSource = staleSnapshot.files.find((candidate) => candidate.path === "japanese-contextual-readings.json");
    assert.equal(typeof staleContextualSource?.text, "string");
    const staleContextualReadings = JSON.parse(staleContextualSource.text);
    const hajimemashite = staleContextualReadings.entries.find((entry) => entry.lexicalEntryId === "ja.greeting.hajimemashite");
    assert.ok(hajimemashite);
    hajimemashite.senseId = "ja.greeting.hajimemashite.nice-to-meet-you";
    staleContextualSource.text = `${JSON.stringify(staleContextualReadings, null, 2)}\n`;
    await chmod(staleContentPath, 0o600);
    await writeFile(staleContentPath, `${JSON.stringify(staleSnapshot, null, 2)}\n`);
    registry.packages = [staleReading, ...registry.packages];
    await writeFile(registryPath, `${JSON.stringify(registry, null, 2)}\n`);
    const files = await listInstalledMemorizationItemFiles("com.sleepymario.language.japanese.reviews", dataDir);
    const file = files.find((candidate) => candidate.path.endsWith("chapter-011-015.json"));
    assert.ok(file);
    await assert.doesNotReject(() => readInstalledMemorizationItems(file.packageId, file.path, dataDir, file.packageVersion));

    const installedPath = join(review.installPath, file.path);
    const document = JSON.parse(await readFile(installedPath, "utf8"));
    for (const item of document.items.filter((candidate) => candidate.testedLexicalIds?.includes("ja.interrogative-pronoun.nani.01"))) {
      if (item.prompt.language === "ja-Kana") item.prompt.text = "なん";
      item.acceptedAnswers = item.acceptedAnswers.map((answer) => answer.replace("なに", "なん"));
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
