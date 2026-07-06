import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { spawn } from "node:child_process";
import { test } from "node:test";

import {
  createInitialReviewState,
  createUserDataBackup,
  inspectUserDataBackup,
  migrateUserDataBackupFile,
  restoreUserDataBackup,
  userDataBackupFormatVersion,
  validateUserDataBackup,
  writeUserDataBackup
} from "../dist/packages/core/index.js";

const now = "2026-07-06T00:00:00Z";
const packageId = "com.sleepymario.language.memory";
const packageVersion = "0.1.0";

const schemaUrl = new URL("../schemas/user-data-backup-v1.schema.json", import.meta.url);

test("user data backup JSON Schema parses as Draft 2020-12", async () => {
  const schema = JSON.parse(await readFile(schemaUrl, "utf8"));

  assert.equal(schema.$schema, "https://json-schema.org/draft/2020-12/schema");
  assert.equal(schema.properties.backupFormatVersion.const, userDataBackupFormatVersion);
});

test("backup contains registry progress and settings sections when present", async () => {
  const fixture = await createUserStateFixture();
  try {
    const backup = await createUserDataBackup({ dataDir: fixture.contentDir, createdAt: now, whackSmackerVersion: "0.0.1-test" });

    assert.deepEqual(backup.includedSections, ["installedPackageRegistry", "reviewProgress", "settings"]);
    assert.equal(backup.sections.installedPackageRegistry.path, "content/registry.json");
    assert.equal(backup.sections.reviewProgress.path, "progress/review-progress.json");
    assert.equal(backup.sections.settings.path, "settings/settings.json");
    assert.equal(backup.restoreHints.installedPackages[0].packageId, packageId);
    assert.equal(validateUserDataBackup(backup).valid, true);
  } finally {
    await fixture.cleanup();
  }
});

test("backup omits package directories and caches by default", async () => {
  const fixture = await createUserStateFixture();
  try {
    await writeFileEnsured(join(fixture.contentDir, "packages", packageId, packageVersion, "content", "content.json"), "{}\n");
    await writeFileEnsured(join(fixture.contentDir, "cache", "downloads", "archive.wspkg"), "not backed up");
    const backup = await createUserDataBackup({ dataDir: fixture.contentDir, createdAt: now });
    const text = JSON.stringify(backup);

    assert.doesNotMatch(text, /archive\.wspkg/);
    assert.doesNotMatch(text, /content\/content\.json/);
  } finally {
    await fixture.cleanup();
  }
});

test("backup has deterministic structure when createdAt is injected", async () => {
  const fixture = await createUserStateFixture();
  try {
    const first = await createUserDataBackup({ dataDir: fixture.contentDir, createdAt: now, whackSmackerVersion: "0.0.1-test" });
    const second = await createUserDataBackup({ dataDir: fixture.contentDir, createdAt: now, whackSmackerVersion: "0.0.1-test" });

    assert.deepEqual(first, second);
  } finally {
    await fixture.cleanup();
  }
});

test("inspect validates backup metadata without restoring", async () => {
  const fixture = await createUserStateFixture();
  const backupPath = join(fixture.root, "backup.json");
  try {
    await writeUserDataBackup({ dataDir: fixture.contentDir, outputPath: backupPath, createdAt: now, whackSmackerVersion: "0.0.1-test" });
    const inspection = await inspectUserDataBackup(backupPath);

    assert.equal(inspection.valid, true);
    assert.deepEqual(inspection.includedSections, ["installedPackageRegistry", "reviewProgress", "settings"]);
    await assert.rejects(() => stat(join(fixture.root, "restore", "registry.json")), /ENOENT/);
  } finally {
    await fixture.cleanup();
  }
});

test("restore writes user data into requested data directories", async () => {
  const fixture = await createUserStateFixture();
  const backupPath = join(fixture.root, "backup.json");
  const restoreContentDir = join(fixture.root, "restore", "content");
  const restoreProgressDir = join(fixture.root, "restore", "progress");
  const restoreSettingsDir = join(fixture.root, "restore", "settings");
  try {
    await writeUserDataBackup({ dataDir: fixture.contentDir, outputPath: backupPath, createdAt: now });
    const result = await restoreUserDataBackup({
      backupPath,
      dataDir: restoreContentDir,
      progressDir: restoreProgressDir,
      settingsDir: restoreSettingsDir
    });

    assert.deepEqual(result.restored, ["installedPackageRegistry", "reviewProgress", "settings"]);
    assert.equal(JSON.parse(await readFile(join(restoreContentDir, "registry.json"), "utf8")).packages[0].packageId, packageId);
    assert.equal(JSON.parse(await readFile(join(restoreProgressDir, "review-progress.json"), "utf8")).items[0].itemId, "hangul/vowels/a");
    assert.equal(JSON.parse(await readFile(join(restoreSettingsDir, "settings.json"), "utf8")).theme, "dark");
  } finally {
    await fixture.cleanup();
  }
});

test("restore refuses overwrite without force and force replaces only user-state files", async () => {
  const fixture = await createUserStateFixture();
  const backupPath = join(fixture.root, "backup.json");
  const restoreContentDir = join(fixture.root, "restore", "content");
  const restoreProgressDir = join(fixture.root, "restore", "progress");
  const packageContent = join(restoreContentDir, "packages", packageId, packageVersion, "content", "content.json");
  try {
    await writeUserDataBackup({ dataDir: fixture.contentDir, outputPath: backupPath, createdAt: now });
    await restoreUserDataBackup({ backupPath, dataDir: restoreContentDir, progressDir: restoreProgressDir });
    await writeFileEnsured(packageContent, "installed package content");

    await assert.rejects(() => restoreUserDataBackup({ backupPath, dataDir: restoreContentDir, progressDir: restoreProgressDir }), /Refusing to overwrite/);
    await restoreUserDataBackup({ backupPath, dataDir: restoreContentDir, progressDir: restoreProgressDir, force: true });

    assert.equal(await readFile(packageContent, "utf8"), "installed package content");
  } finally {
    await fixture.cleanup();
  }
});

test("invalid backup schema and unsafe section paths are rejected", async () => {
  const fixture = await createUserStateFixture();
  try {
    const backup = await createUserDataBackup({ dataDir: fixture.contentDir, createdAt: now });
    const invalid = { ...backup, backupFormatVersion: 99 };
    const unsafe = {
      ...backup,
      sections: {
        ...backup.sections,
        installedPackageRegistry: { ...backup.sections.installedPackageRegistry, path: "../registry.json" }
      }
    };

    assert.equal(validateUserDataBackup(invalid).valid, false);
    assert.equal(validateUserDataBackup(unsafe).valid, false);
  } finally {
    await fixture.cleanup();
  }
});

test("migration helpers preserve user progress identity", async () => {
  const fixture = await createUserStateFixture();
  const backupPath = join(fixture.root, "backup.json");
  const migratedPath = join(fixture.root, "backup-migrated.json");
  try {
    await writeUserDataBackup({ dataDir: fixture.contentDir, outputPath: backupPath, createdAt: now });
    await migrateUserDataBackupFile(backupPath, migratedPath);
    const migrated = JSON.parse(await readFile(migratedPath, "utf8"));

    assert.equal(migrated.sections.reviewProgress.data.items[0].packageId, packageId);
    assert.equal(migrated.sections.reviewProgress.data.items[0].packageVersion, packageVersion);
    assert.equal(migrated.sections.reviewProgress.data.items[0].itemId, "hangul/vowels/a");
  } finally {
    await fixture.cleanup();
  }
});

test("backup CLI creates inspects restores and migrates backups", async () => {
  const fixture = await createUserStateFixture();
  const backupPath = join(fixture.root, "cli-backup.json");
  const migratedPath = join(fixture.root, "cli-backup-migrated.json");
  const restoreContentDir = join(fixture.root, "cli-restore", "content");
  try {
    const created = await runCli(["backup", "create", "--output", backupPath, "--data-dir", fixture.contentDir, "--now", now]);
    const inspected = await runCli(["backup", "inspect", backupPath]);
    const restored = await runCli(["backup", "restore", backupPath, "--data-dir", restoreContentDir]);
    const migrated = await runCli(["backup", "migrate", backupPath, "--output", migratedPath]);

    assert.match(created.stdout, /Backup created/);
    assert.match(inspected.stdout, /Backup valid/);
    assert.match(restored.stdout, /Backup restored/);
    assert.match(migrated.stdout, /Backup migrated/);
    assert.equal(JSON.parse(await readFile(join(restoreContentDir, "registry.json"), "utf8")).packages[0].packageId, packageId);
  } finally {
    await fixture.cleanup();
  }
});

async function createUserStateFixture() {
  const root = await mkdtemp(join(tmpdir(), "wsm-user-backup-"));
  const contentDir = join(root, "content");
  const progressDir = join(root, "progress");
  const settingsDir = join(root, "settings");
  const registry = {
    registryFormatVersion: 1,
    updatedAt: now,
    packages: [
      {
        packageId,
        packageVersion,
        displayName: "Memory Package",
        contentType: "language-curriculum",
        contentSchemaVersion: "1.0.0",
        minimumWhackSmackerVersion: "0.1.0",
        source: {
          repository: "https://example.invalid/memory",
          commit: "0000000000000000000000000000000000000000"
        },
        installedAt: now,
        installPath: `packages/${packageId}/${packageVersion}`,
        manifestSha256: "0".repeat(64),
        archiveSha256: "1".repeat(64),
        archiveSize: 1,
        catalogueId: "com.sleepymario.local"
      }
    ]
  };
  const progress = {
    reviewProgressFormatVersion: 1,
    updatedAt: now,
    items: [createInitialReviewState({ packageId, packageVersion, itemId: "hangul/vowels/a" }, now)],
    events: []
  };
  const settings = {
    theme: "dark",
    fontSize: 14
  };

  await writeJson(join(contentDir, "registry.json"), registry);
  await writeJson(join(progressDir, "review-progress.json"), progress);
  await writeJson(join(settingsDir, "settings.json"), settings);

  return {
    root,
    contentDir,
    progressDir,
    settingsDir,
    cleanup: () => rm(root, { recursive: true, force: true })
  };
}

async function writeJson(path, value) {
  await writeFileEnsured(path, `${JSON.stringify(value, null, 2)}\n`);
}

async function writeFileEnsured(path, data) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, data);
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
