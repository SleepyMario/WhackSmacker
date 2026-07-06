import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { spawn } from "node:child_process";
import { test } from "node:test";

import {
  detectContentPackageUpdates,
  generateContentPackage,
  generateLocalContentPackageCatalogue,
  installContentPackage,
  listAvailableContentPackages,
  listInstalledContentPackages,
  loadInstalledPackageRegistry,
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
  const content = Buffer.from(JSON.stringify({ packageId: options.packageId, packageVersion: options.packageVersion }), "utf8");
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
    files: [{ path: options.filePath, mediaType: "application/json", size: content.length, sha256: sha256(content) }]
  };
  const archive = createStoreZip([
    { path: "manifest.json", data: Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, "utf8") },
    { path: options.filePath, data: content }
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
    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0x0800, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt16LE(0, 10);
    localHeader.writeUInt16LE(33, 12);
    localHeader.writeUInt32LE(0, 14);
    localHeader.writeUInt32LE(entry.data.length, 18);
    localHeader.writeUInt32LE(entry.data.length, 22);
    localHeader.writeUInt16LE(name.length, 26);
    localHeader.writeUInt16LE(0, 28);
    localParts.push(localHeader, name, entry.data);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0x0800, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt16LE(0, 12);
    centralHeader.writeUInt16LE(33, 14);
    centralHeader.writeUInt32LE(0, 16);
    centralHeader.writeUInt32LE(entry.data.length, 20);
    centralHeader.writeUInt32LE(entry.data.length, 24);
    centralHeader.writeUInt16LE(name.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);
    centralParts.push(centralHeader, name);
    offset += localHeader.length + name.length + entry.data.length;
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
