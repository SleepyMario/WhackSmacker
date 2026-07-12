import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
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
  listAvailableContentPackages,
  listInstalledContentPackages,
  loadInstalledPackageRegistry,
  maxPackageUncompressedSizeBytes,
  removeContentPackage,
  updateContentPackage,
  validateContentPackageManifest,
  validateInstalledPackageRegistry
} from "../dist/packages/core/index.js";

test("available packages can be listed from a valid catalogue", async () => {
  const fixture = await createPackageFixture();
  try {
    const available = await listAvailableContentPackages(fixture.cataloguePath);

    assert.deepEqual(
      available.map((entry) => entry.packageId),
      ["com.sleepymario.language.korean", "com.sleepymario.language.linguistic-terminology"]
    );
  } finally {
    await fixture.cleanup();
  }
});

test("installed registry defaults to empty when missing", async () => {
  const dataDir = await mkdtemp(join(tmpdir(), "wsm-content-data-"));
  try {
    const registry = await loadInstalledPackageRegistry(dataDir);

    assert.equal(registry.registryFormatVersion, 1);
    assert.deepEqual(registry.packages, []);
  } finally {
    await rm(dataDir, { recursive: true, force: true });
  }
});

test("malformed registry fails clearly", async () => {
  const dataDir = await mkdtemp(join(tmpdir(), "wsm-content-data-"));
  try {
    await writeJson(join(dataDir, "registry.json"), { registryFormatVersion: 99, packages: [] });

    await assert.rejects(() => loadInstalledPackageRegistry(dataDir), /Invalid installed package registry/);
  } finally {
    await rm(dataDir, { recursive: true, force: true });
  }
});

test("installing from a file package succeeds and updates the registry", async () => {
  const fixture = await createPackageFixture();
  try {
    const result = await installContentPackage({
      cataloguePath: fixture.cataloguePath,
      dataDir: fixture.dataDir,
      packageId: "com.sleepymario.language.korean",
      installedAt: "2026-07-06T00:00:00Z"
    });
    const registry = await loadInstalledPackageRegistry(fixture.dataDir);
    const manifestPath = join(result.installPath, "manifest.json");
    const contentPath = join(result.installPath, "content", "content.json");
    const manifest = JSON.parse(await readFile(manifestPath, "utf8"));

    assert.equal(result.installed, true);
    assert.equal(registry.packages.length, 1);
    assert.equal(registry.packages[0].packageId, "com.sleepymario.language.korean");
    assert.equal(registry.packages[0].installPath, "packages/com.sleepymario.language.korean/0.1.0");
    assert.equal((await stat(manifestPath)).size > 0, true);
    assert.equal((await stat(contentPath)).size > 0, true);
    assert.deepEqual(validateContentPackageManifest(manifest).errors, []);
    assert.deepEqual(validateInstalledPackageRegistry(registry).errors, []);
  } finally {
    await fixture.cleanup();
  }
});

test("install rejects archive checksum mismatch", async () => {
  const fixture = await createPackageFixture();
  try {
    const catalogue = await readJson(fixture.cataloguePath);
    catalogue.packages[0].package.sha256 = "0".repeat(64);
    const path = await writeCatalogue(fixture, catalogue);

    await assert.rejects(
      () => installContentPackage({ cataloguePath: path, dataDir: fixture.dataDir, packageId: catalogue.packages[0].packageId }),
      /SHA-256 mismatch/
    );
  } finally {
    await fixture.cleanup();
  }
});

test("install rejects archive size mismatch", async () => {
  const fixture = await createPackageFixture();
  try {
    const catalogue = await readJson(fixture.cataloguePath);
    catalogue.packages[0].package.size += 1;
    const path = await writeCatalogue(fixture, catalogue);

    await assert.rejects(
      () => installContentPackage({ cataloguePath: path, dataDir: fixture.dataDir, packageId: catalogue.packages[0].packageId }),
      /size mismatch/
    );
  } finally {
    await fixture.cleanup();
  }
});

test("install rejects package ID mismatch between catalogue and manifest", async () => {
  const fixture = await createPackageFixture();
  try {
    const catalogue = await readJson(fixture.cataloguePath);
    catalogue.packages[0].packageId = "com.sleepymario.language.korean-renamed";
    const path = await writeCatalogue(fixture, catalogue);

    await assert.rejects(
      () => installContentPackage({ cataloguePath: path, dataDir: fixture.dataDir, packageId: catalogue.packages[0].packageId }),
      /manifest packageId does not match catalogue entry/
    );
  } finally {
    await fixture.cleanup();
  }
});

test("install rejects package version mismatch between catalogue and manifest", async () => {
  const fixture = await createPackageFixture();
  try {
    const catalogue = await readJson(fixture.cataloguePath);
    catalogue.packages[0].packageVersion = "0.2.0";
    const path = await writeCatalogue(fixture, catalogue);

    await assert.rejects(
      () => installContentPackage({ cataloguePath: path, dataDir: fixture.dataDir, packageId: catalogue.packages[0].packageId }),
      /manifest packageVersion does not match catalogue entry/
    );
  } finally {
    await fixture.cleanup();
  }
});

test("install rejects unsafe archive paths", async () => {
  const fixture = await createPackageFixture();
  try {
    const archive = createStoreZip([{ path: "../evil.txt", data: Buffer.from("bad", "utf8") }]);
    const archivePath = join(fixture.root, "unsafe.wspkg");
    await writeFile(archivePath, archive);
    const cataloguePath = await writeSinglePackageCatalogue(fixture, archivePath, "com.sleepymario.language.unsafe");

    await assert.rejects(
      () => installContentPackage({ cataloguePath, dataDir: fixture.dataDir, packageId: "com.sleepymario.language.unsafe" }),
      /Unsafe package archive path/
    );
  } finally {
    await fixture.cleanup();
  }
});

test("install accepts an explicit content directory entry", async () => {
  const fixture = await createPackageFixture();
  try {
    const archivePath = await createCustomPackage(fixture, {
      packageId: "com.sleepymario.language.explicit-directory",
      packageVersion: "0.1.0",
      entryPointPath: "content/content.json",
      filePath: "content/content.json",
      directoryEntries: ["content/"]
    });
    const cataloguePath = await writeSinglePackageCatalogue(fixture, archivePath, "com.sleepymario.language.explicit-directory");

    const result = await installContentPackage({
      cataloguePath,
      dataDir: fixture.dataDir,
      packageId: "com.sleepymario.language.explicit-directory"
    });

    assert.equal((await stat(join(result.installPath, "content", "content.json"))).size > 0, true);
  } finally {
    await fixture.cleanup();
  }
});

test("install accepts nested explicit directory entries", async () => {
  const fixture = await createPackageFixture();
  try {
    const archivePath = await createCustomPackage(fixture, {
      packageId: "com.sleepymario.language.nested-directories",
      packageVersion: "0.1.0",
      entryPointPath: "review-decks/chapter-001-005/content.json",
      filePath: "review-decks/chapter-001-005/content.json",
      directoryEntries: ["review-decks/", "review-decks/chapter-001-005/"]
    });
    const cataloguePath = await writeSinglePackageCatalogue(fixture, archivePath, "com.sleepymario.language.nested-directories");

    const result = await installContentPackage({
      cataloguePath,
      dataDir: fixture.dataDir,
      packageId: "com.sleepymario.language.nested-directories"
    });

    assert.equal((await stat(join(result.installPath, "review-decks", "chapter-001-005", "content.json"))).size > 0, true);
  } finally {
    await fixture.cleanup();
  }
});

for (const unsafeDirectoryPath of ["../evil/", "/absolute/"]) {
  test(`install rejects unsafe explicit directory path ${unsafeDirectoryPath}`, async () => {
    const fixture = await createPackageFixture();
    try {
      const archive = createStoreZip([{ path: unsafeDirectoryPath, data: Buffer.alloc(0) }]);
      const archivePath = join(fixture.root, "unsafe-directory.wspkg");
      await writeFile(archivePath, archive);
      const cataloguePath = await writeSinglePackageCatalogue(fixture, archivePath, "com.sleepymario.language.unsafe-directory");

      await assert.rejects(
        () => installContentPackage({ cataloguePath, dataDir: fixture.dataDir, packageId: "com.sleepymario.language.unsafe-directory" }),
        /Unsafe package archive path/
      );
    } finally {
      await fixture.cleanup();
    }
  });
}

test("install rejects an explicit directory entry with data", async () => {
  const fixture = await createPackageFixture();
  try {
    const archive = createStoreZip([{ path: "content/", data: Buffer.from("not empty", "utf8") }]);
    const archivePath = join(fixture.root, "directory-with-data.wspkg");
    await writeFile(archivePath, archive);
    const cataloguePath = await writeSinglePackageCatalogue(fixture, archivePath, "com.sleepymario.language.directory-with-data");

    await assert.rejects(
      () => installContentPackage({ cataloguePath, dataDir: fixture.dataDir, packageId: "com.sleepymario.language.directory-with-data" }),
      /directory entry contains data/
    );
  } finally {
    await fixture.cleanup();
  }
});

for (const [description, manifestCompressionMethod, contentCompressionMethod] of [
  ["a deflated manifest", 8, 0],
  ["deflated content", 0, 8],
  ["mixed stored and deflated files", 8, 0],
  ["explicit directories with deflated files", 8, 8]
]) {
  test(`install accepts ${description}`, async () => {
    const fixture = await createPackageFixture();
    try {
      const packageId = `com.sleepymario.language.deflate-${manifestCompressionMethod}-${contentCompressionMethod}-${description.length}`;
      const archivePath = await createCustomPackage(fixture, {
        packageId,
        packageVersion: "0.1.0",
        entryPointPath: "content/content.json",
        filePath: "content/content.json",
        manifestCompressionMethod,
        contentCompressionMethod,
        directoryEntries: description.startsWith("explicit") ? ["content/"] : []
      });
      const cataloguePath = await writeSinglePackageCatalogue(fixture, archivePath, packageId);

      const result = await installContentPackage({ cataloguePath, dataDir: fixture.dataDir, packageId });

      assert.equal((await stat(join(result.installPath, "manifest.json"))).size > 0, true);
      assert.equal((await stat(join(result.installPath, "content", "content.json"))).size > 0, true);
    } finally {
      await fixture.cleanup();
    }
  });
}

test("deflated content is validated using its inflated size and SHA-256", async () => {
  const fixture = await createPackageFixture();
  try {
    const packageId = "com.sleepymario.language.deflate-integrity";
    const archivePath = await createCustomPackage(fixture, {
      packageId,
      packageVersion: "0.1.0",
      entryPointPath: "content/content.json",
      filePath: "content/content.json",
      contentCompressionMethod: 8,
      fileSha256: "0".repeat(64)
    });
    const cataloguePath = await writeSinglePackageCatalogue(fixture, archivePath, packageId);

    await assert.rejects(
      () => installContentPackage({ cataloguePath, dataDir: fixture.dataDir, packageId }),
      /Declared file SHA-256 mismatch/
    );
  } finally {
    await fixture.cleanup();
  }
});

for (const [description, entry, expectedError] of [
  ["malformed deflate data", { path: "manifest.json", data: Buffer.alloc(0), compressionMethod: 8, compressedData: Buffer.from([0xff]) }, /Invalid deflate data/],
  ["a declared inflated-size mismatch", { path: "manifest.json", data: Buffer.from("{}"), compressionMethod: 8, declaredUncompressedSize: 3 }, /Inflated package archive entry size mismatch/],
  ["an unsupported compression method", { path: "manifest.json", data: Buffer.from("{}"), compressionMethod: 12 }, /Unsupported package archive compression method/],
  ["an excessive cumulative uncompressed size", { path: "manifest.json", data: Buffer.alloc(0), compressionMethod: 8, declaredUncompressedSize: maxPackageUncompressedSizeBytes + 1 }, /exceeds uncompressed size limit/]
]) {
  test(`install rejects ${description}`, async () => {
    const fixture = await createPackageFixture();
    try {
      const archive = createStoreZip([entry]);
      const archivePath = join(fixture.root, "invalid-compression.wspkg");
      await writeFile(archivePath, archive);
      const packageId = "com.sleepymario.language.invalid-compression";
      const cataloguePath = await writeSinglePackageCatalogue(fixture, archivePath, packageId);

      await assert.rejects(() => installContentPackage({ cataloguePath, dataDir: fixture.dataDir, packageId }), expectedError);
    } finally {
      await fixture.cleanup();
    }
  });
}

test("install rejects manifest with unsafe entry-point paths", async () => {
  const fixture = await createPackageFixture();
  try {
    const archivePath = await createCustomPackage(fixture, {
      packageId: "com.sleepymario.language.badmanifest",
      packageVersion: "0.1.0",
      entryPointPath: "../content.json",
      filePath: "content/content.json"
    });
    const cataloguePath = await writeSinglePackageCatalogue(fixture, archivePath, "com.sleepymario.language.badmanifest");

    await assert.rejects(
      () => installContentPackage({ cataloguePath, dataDir: fixture.dataDir, packageId: "com.sleepymario.language.badmanifest" }),
      /Invalid content package manifest/
    );
  } finally {
    await fixture.cleanup();
  }
});

test("installing the same package twice is clearly idempotent", async () => {
  const fixture = await createPackageFixture();
  try {
    const first = await installContentPackage({
      cataloguePath: fixture.cataloguePath,
      dataDir: fixture.dataDir,
      packageId: "com.sleepymario.language.korean"
    });
    const second = await installContentPackage({
      cataloguePath: fixture.cataloguePath,
      dataDir: fixture.dataDir,
      packageId: "com.sleepymario.language.korean"
    });

    assert.equal(first.installed, true);
    assert.equal(second.installed, false);
    assert.equal((await listInstalledContentPackages(fixture.dataDir)).length, 1);
  } finally {
    await fixture.cleanup();
  }
});

test("reinstalling the same package does not delete review progress", async () => {
  const fixture = await createPackageFixture();
  try {
    await installContentPackage({
      cataloguePath: fixture.cataloguePath,
      dataDir: fixture.dataDir,
      packageId: "com.sleepymario.language.korean"
    });
    const progressPath = join(fixture.dataDir, "..", "progress", "review-progress.json");
    const progress = {
      reviewProgressFormatVersion: 1,
      updatedAt: "2026-07-06T00:00:00Z",
      items: [
        {
          packageId: "com.sleepymario.language.korean",
          packageVersion: "0.1.0",
          sourcePath: "review-decks/chapter-001-005/cards.tsv",
          itemId: "chapter-001/card-001",
          firstSeenAt: "2026-07-06T00:00:00Z",
          lastReviewedAt: "2026-07-06T00:00:00Z",
          nextReviewAt: "2026-07-08T00:00:00Z",
          reviewCount: 1,
          lapseCount: 0,
          intervalDays: 2,
          easeFactor: 2.5,
          status: "review"
        }
      ],
      events: []
    };
    await writeJson(progressPath, progress);

    const second = await installContentPackage({
      cataloguePath: fixture.cataloguePath,
      dataDir: fixture.dataDir,
      packageId: "com.sleepymario.language.korean"
    });

    assert.equal(second.installed, false);
    assert.deepEqual(await readJson(progressPath), progress);
  } finally {
    await fixture.cleanup();
  }
});

test("force reinstall replaces an older snapshot of the same package version", async () => {
  const fixture = await createPackageFixture();
  try {
    const packageId = "com.sleepymario.language.same-version-refresh";
    const archivePath = await createCustomPackage(fixture, {
      packageId,
      packageVersion: "0.1.0",
      entryPointPath: "content/content.json",
      filePath: "content/content.json",
      contentValue: "old snapshot"
    });
    let cataloguePath = await writeSinglePackageCatalogue(fixture, archivePath, packageId);
    await installContentPackage({ cataloguePath, dataDir: fixture.dataDir, packageId });

    await createCustomPackage(fixture, {
      packageId,
      packageVersion: "0.1.0",
      entryPointPath: "content/content.json",
      filePath: "content/content.json",
      contentValue: "new snapshot with chapter 11"
    });
    cataloguePath = await writeSinglePackageCatalogue(fixture, archivePath, packageId);
    const result = await installContentPackage({ cataloguePath, dataDir: fixture.dataDir, packageId, force: true });

    assert.equal(result.installed, true);
    assert.match(await readFile(join(result.installPath, "content", "content.json"), "utf8"), /new snapshot with chapter 11/u);
  } finally {
    await fixture.cleanup();
  }
});

test("installed packages can be listed", async () => {
  const fixture = await createPackageFixture();
  try {
    await installContentPackage({ cataloguePath: fixture.cataloguePath, dataDir: fixture.dataDir, packageId: "com.sleepymario.language.korean" });

    const installed = await listInstalledContentPackages(fixture.dataDir);

    assert.deepEqual(installed.map((record) => record.packageId), ["com.sleepymario.language.korean"]);
  } finally {
    await fixture.cleanup();
  }
});

test("update detection reports no update when versions match", async () => {
  const fixture = await createPackageFixture();
  try {
    await installContentPackage({ cataloguePath: fixture.cataloguePath, dataDir: fixture.dataDir, packageId: "com.sleepymario.language.korean" });

    assert.deepEqual(await detectContentPackageUpdates(fixture.cataloguePath, fixture.dataDir), []);
  } finally {
    await fixture.cleanup();
  }
});

test("update detection reports and installs a newer SemVer version", async () => {
  const fixture = await createPackageFixture();
  try {
    await installContentPackage({ cataloguePath: fixture.cataloguePath, dataDir: fixture.dataDir, packageId: "com.sleepymario.language.korean" });
    const newerArchive = await createCustomPackage(fixture, {
      packageId: "com.sleepymario.language.korean",
      packageVersion: "0.2.0",
      entryPointPath: "content/content.json",
      filePath: "content/content.json"
    });
    const catalogue = await readJson(fixture.cataloguePath);
    catalogue.packages.push(await packageEntryFromArchive(newerArchive, "com.sleepymario.language.korean", "0.2.0"));
    const newerCatalogue = await writeCatalogue(fixture, catalogue);

    const updates = await detectContentPackageUpdates(newerCatalogue, fixture.dataDir);
    const updateResult = await updateContentPackage({
      cataloguePath: newerCatalogue,
      dataDir: fixture.dataDir,
      packageId: "com.sleepymario.language.korean"
    });

    assert.equal(updates[0].availableVersion, "0.2.0");
    assert.equal(updateResult.record.packageVersion, "0.2.0");
    assert.deepEqual(
      (await listInstalledContentPackages(fixture.dataDir)).map((record) => record.packageVersion),
      ["0.1.0", "0.2.0"]
    );
  } finally {
    await fixture.cleanup();
  }
});

test("removing an installed package removes package files and registry entry", async () => {
  const fixture = await createPackageFixture();
  try {
    const installed = await installContentPackage({ cataloguePath: fixture.cataloguePath, dataDir: fixture.dataDir, packageId: "com.sleepymario.language.korean" });
    await removeContentPackage({ dataDir: fixture.dataDir, packageId: "com.sleepymario.language.korean", packageVersion: "0.1.0" });

    await assert.rejects(() => stat(installed.installPath), /ENOENT/);
    assert.deepEqual(await listInstalledContentPackages(fixture.dataDir), []);
  } finally {
    await fixture.cleanup();
  }
});

test("removing one version leaves another version and does not touch progress", async () => {
  const fixture = await createPackageFixture();
  try {
    await installContentPackage({ cataloguePath: fixture.cataloguePath, dataDir: fixture.dataDir, packageId: "com.sleepymario.language.korean" });
    const newerArchive = await createCustomPackage(fixture, {
      packageId: "com.sleepymario.language.korean",
      packageVersion: "0.2.0",
      entryPointPath: "content/content.json",
      filePath: "content/content.json"
    });
    const catalogue = await readJson(fixture.cataloguePath);
    catalogue.packages.push(await packageEntryFromArchive(newerArchive, "com.sleepymario.language.korean", "0.2.0"));
    const newerCatalogue = await writeCatalogue(fixture, catalogue);
    await installContentPackage({
      cataloguePath: newerCatalogue,
      dataDir: fixture.dataDir,
      packageId: "com.sleepymario.language.korean",
      packageVersion: "0.2.0"
    });
    const progressPath = join(fixture.dataDir, "..", "progress", "progress.json");
    await writeJson(progressPath, { untouched: true });

    await removeContentPackage({ dataDir: fixture.dataDir, packageId: "com.sleepymario.language.korean", packageVersion: "0.1.0" });

    assert.deepEqual((await listInstalledContentPackages(fixture.dataDir)).map((record) => record.packageVersion), ["0.2.0"]);
    assert.deepEqual(await readJson(progressPath), { untouched: true });
  } finally {
    await fixture.cleanup();
  }
});

test("package files are not modified after install", async () => {
  const fixture = await createPackageFixture();
  try {
    const result = await installContentPackage({
      cataloguePath: fixture.cataloguePath,
      dataDir: fixture.dataDir,
      packageId: "com.sleepymario.language.korean"
    });
    const before = await fileSha256(join(result.installPath, "content", "content.json"));
    const after = await fileSha256(join(result.installPath, "content", "content.json"));

    assert.equal(before, after);
  } finally {
    await fixture.cleanup();
  }
});

test("content package CLI supports available install installed updates and remove", async () => {
  const fixture = await createPackageFixture();
  try {
    const available = await runCli(["content", "available", "--catalogue", fixture.cataloguePath]);
    const install = await runCli([
      "content",
      "install",
      "com.sleepymario.language.korean",
      "--catalogue",
      fixture.cataloguePath,
      "--data-dir",
      fixture.dataDir
    ]);
    const installed = await runCli(["content", "installed", "--data-dir", fixture.dataDir]);
    const updates = await runCli(["content", "updates", "--catalogue", fixture.cataloguePath, "--data-dir", fixture.dataDir]);
    const remove = await runCli([
      "content",
      "remove",
      "com.sleepymario.language.korean",
      "--version",
      "0.1.0",
      "--data-dir",
      fixture.dataDir
    ]);

    assert.match(available.stdout, /Available packages:/);
    assert.match(install.stdout, /Package installed/);
    assert.match(installed.stdout, /Installed packages:/);
    assert.match(updates.stdout, /No package updates available/);
    assert.match(remove.stdout, /Package removed/);
  } finally {
    await fixture.cleanup();
  }
});

async function createPackageFixture() {
  const root = await mkdtemp(join(tmpdir(), "wsm-content-manager-"));
  const packageDirectory = join(root, "packages");
  const catalogueDirectory = join(root, "catalogue");
  const dataDir = join(root, "data", "content");
  await generateContentPackage({
    targetId: "linguistic-terminology",
    outputDirectory: packageDirectory,
    generatedAt: "2026-07-06T00:00:00Z"
  });
  await generateContentPackage({
    targetId: "korean-curriculum",
    outputDirectory: packageDirectory,
    generatedAt: "2026-07-06T00:00:00Z"
  });
  const cataloguePath = join(catalogueDirectory, "catalogue.json");
  await generateLocalContentPackageCatalogue({
    packagesDirectory: packageDirectory,
    outputPath: cataloguePath,
    generatedAt: "2026-07-06T00:00:00Z"
  });

  return {
    root,
    packageDirectory,
    cataloguePath,
    dataDir,
    cleanup: () => rm(root, { recursive: true, force: true })
  };
}

async function createCustomPackage(fixture, options) {
  const content = Buffer.from(JSON.stringify({ packageId: options.packageId, packageVersion: options.packageVersion, value: options.contentValue }), "utf8");
  const manifest = {
    packageFormatVersion: 1,
    packageId: options.packageId,
    packageVersion: options.packageVersion,
    displayName: "Custom Package",
    description: "Custom package.",
    contentType: "language-curriculum",
    contentSchemaVersion: "1.0.0",
    minimumWhackSmackerVersion: "0.1.0",
    source: {
      repository: "https://example.invalid/source",
      commit: "0000000000000000000000000000000000000000"
    },
    generatedAt: "2026-07-06T00:00:00Z",
    generator: { name: "test", version: "0.1.0" },
    entryPoints: [{ id: "primary", mediaType: "application/json", path: options.entryPointPath, role: "primary" }],
    dependencies: [],
    files: [{ path: options.filePath, mediaType: "application/json", size: content.length, sha256: options.fileSha256 ?? sha256(content) }]
  };
  const archive = createStoreZip([
    ...(options.directoryEntries ?? []).map((path) => ({ path, data: Buffer.alloc(0) })),
    { path: "manifest.json", data: Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, "utf8"), compressionMethod: options.manifestCompressionMethod },
    { path: options.filePath, data: content, compressionMethod: options.contentCompressionMethod }
  ]);
  const archivePath = join(fixture.root, `${options.packageId}-${options.packageVersion}.wspkg`);
  await writeFile(archivePath, archive);
  return archivePath;
}

async function writeSinglePackageCatalogue(fixture, archivePath, packageId) {
  const cataloguePath = join(fixture.root, `${packageId}.catalogue.json`);
  await writeJson(cataloguePath, {
    catalogueFormatVersion: 1,
    catalogueId: "com.sleepymario.local",
    displayName: "Local Catalogue",
    description: "Local catalogue.",
    generatedAt: "2026-07-06T00:00:00Z",
    packages: [await packageEntryFromArchive(archivePath, packageId, "0.1.0")]
  });
  return cataloguePath;
}

async function packageEntryFromArchive(archivePath, packageId, packageVersion) {
  const archive = await readFile(archivePath);
  return {
    packageId,
    packageVersion,
    displayName: "Custom Package",
    description: "Custom package.",
    contentType: "language-curriculum",
    contentSchemaVersion: "1.0.0",
    minimumWhackSmackerVersion: "0.1.0",
    source: {
      repository: "https://example.invalid/source",
      commit: "0000000000000000000000000000000000000000"
    },
    package: {
      url: new URL(archivePath, "file://").href,
      mediaType: "application/vnd.whacksmacker.package+zip",
      size: archive.length,
      sha256: sha256(archive)
    },
    dependencies: []
  };
}

async function writeCatalogue(fixture, catalogue) {
  const path = join(fixture.root, `catalogue-${Math.random().toString(16).slice(2)}.json`);
  await writeJson(path, catalogue);
  return path;
}

function createStoreZip(entries) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  for (const entry of [...entries].sort((left, right) => left.path.localeCompare(right.path))) {
    const name = Buffer.from(entry.path, "utf8");
    const compressionMethod = entry.compressionMethod ?? 0;
    const compressedData = entry.compressedData ?? (compressionMethod === 8 ? deflateRawSync(entry.data) : entry.data);
    const declaredUncompressedSize = entry.declaredUncompressedSize ?? entry.data.length;
    const entryCrc32 = entry.crc32 ?? crc32(entry.data);
    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0x0800, 6);
    localHeader.writeUInt16LE(compressionMethod, 8);
    localHeader.writeUInt16LE(0, 10);
    localHeader.writeUInt16LE(33, 12);
    localHeader.writeUInt32LE(entryCrc32, 14);
    localHeader.writeUInt32LE(compressedData.length, 18);
    localHeader.writeUInt32LE(declaredUncompressedSize, 22);
    localHeader.writeUInt16LE(name.length, 26);
    localHeader.writeUInt16LE(0, 28);
    localParts.push(localHeader, name, compressedData);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0x0800, 8);
    centralHeader.writeUInt16LE(compressionMethod, 10);
    centralHeader.writeUInt16LE(0, 12);
    centralHeader.writeUInt16LE(33, 14);
    centralHeader.writeUInt32LE(entryCrc32, 16);
    centralHeader.writeUInt32LE(compressedData.length, 20);
    centralHeader.writeUInt32LE(declaredUncompressedSize, 24);
    centralHeader.writeUInt16LE(name.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);
    centralParts.push(centralHeader, name);
    offset += localHeader.length + name.length + compressedData.length;
  }
  const centralDirectory = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);
  return Buffer.concat([...localParts, centralDirectory, end]);
}

function crc32(data) {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
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

async function writeJson(path, value) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function fileSha256(path) {
  return sha256(await readFile(path));
}

function sha256(data) {
  return createHash("sha256").update(data).digest("hex");
}
