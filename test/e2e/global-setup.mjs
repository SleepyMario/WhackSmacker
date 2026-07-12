import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { startWebServer } from "../../dist/apps/web/server.js";
import { assertDatabaseReady, createDatabasePool, createUser, databaseConfig, migrateDatabase, selectPackage, updateUserSettings } from "../../dist/packages/storage/postgres.js";

const run = promisify(execFile);
const alpha = "com.example.playwright.alpha";
const beta = "com.example.playwright.beta";
const password = "Browser-test-password-47!";

export default async function globalSetup() {
  const suffix = `${process.pid}-${randomUUID().slice(0, 8)}`;
  const container = `wsm-playwright-${suffix}`;
  const database = `wsm_e2e_${randomUUID().replaceAll("-", "").slice(0, 12)}`;
  const databaseUser = `wsm_${randomUUID().replaceAll("-", "").slice(0, 12)}`;
  const databasePassword = randomUUID() + randomUUID();
  let pool;
  let server;
  let fixtureRoot;
  let containerStarted = false;
  const cleanup = async () => {
    if (server) await new Promise(resolve => server.close(resolve));
    if (pool) await pool.end().catch(() => undefined);
    if (containerStarted) await run("docker", ["stop", "--time", "2", container]).catch(() => undefined);
    if (fixtureRoot) await rm(fixtureRoot, { recursive: true, force: true });
  };
  try {
    await run("docker", ["run", "--rm", "--name", container, "-e", `POSTGRES_DB=${database}`, "-e", `POSTGRES_USER=${databaseUser}`, "-e", `POSTGRES_PASSWORD=${databasePassword}`, "-p", "127.0.0.1::5432", "-d", "postgres:17-bookworm"]);
    containerStarted = true;
    const { stdout } = await run("docker", ["port", container, "5432/tcp"]);
    const port = stdout.trim().match(/:(\d+)$/u)?.[1];
    if (!port) throw new Error(`Could not determine the disposable PostgreSQL port: ${stdout.trim()}`);
    const databaseUrl = `postgresql://${encodeURIComponent(databaseUser)}:${encodeURIComponent(databasePassword)}@127.0.0.1:${port}/${encodeURIComponent(database)}`;
    pool = createDatabasePool(databaseConfig({ DATABASE_URL: databaseUrl }));
    await assertDatabaseReady(pool, 10);
    await migrateDatabase(pool);

    const userA = await createUser(pool, "browser-reader-a", password);
    const userB = await createUser(pool, "browser-reader-b", password);
    await selectPackage(pool, userA.id, alpha, "1.0.0");
    await selectPackage(pool, userA.id, beta, "2.0.0");
    await selectPackage(pool, userB.id, alpha, "1.0.0");
    await updateUserSettings(pool, userA.id, "en");
    await updateUserSettings(pool, userB.id, "en");

    fixtureRoot = await mkdtemp(join(tmpdir(), "wsm-playwright-fixtures-"));
    const dataDir = join(fixtureRoot, "content");
    await createPackages(dataDir);
    server = await startWebServer({ host: "127.0.0.1", port: 0, databaseUrl, dataDir, secureCookies: false, sessionTtl: 3600 });
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("The isolated web server did not expose a TCP address.");
    Object.assign(process.env, {
      WSM_E2E_BASE_URL: `http://127.0.0.1:${address.port}`,
      WSM_E2E_DATABASE_URL: databaseUrl,
      WSM_E2E_USER_A: "browser-reader-a",
      WSM_E2E_USER_B: "browser-reader-b",
      WSM_E2E_PASSWORD: password,
      WSM_E2E_USER_A_ID: userA.id,
      WSM_E2E_USER_B_ID: userB.id,
      WSM_E2E_ALPHA_PACKAGE: alpha,
      WSM_E2E_BETA_PACKAGE: beta
    });
    return cleanup;
  } catch (error) {
    await cleanup();
    throw error;
  }
}

async function createPackages(dataDir) {
  const records = [];
  records.push(await writePackage(dataDir, {
    packageId: alpha, version: "1.0.0", displayName: "Portable Browser Curriculum", contentType: "language-curriculum",
    localization: { role: "base-curriculum", schemaVersion: "1.0.0", targetLanguage: "nl", defaultSourceLocale: "en", defaultSourcePackageId: `${alpha}.source.en` },
    files: [
      file("units/core/chapter-009-nine/chapter.md", "# Chapter 9 — Foundations\n\nBase English chapter nine."),
      file("units/core/chapter-010-ten/chapter.md", "# Chapter 10 — Safe reading\n\nBase chapter ten."),
      file("units/core/chapter-011-eleven/chapter.md", "# Chapter 11 — Een zeer lange meertalige titel 第十一章 한국어 제목\n\nBase chapter eleven."),
      file("units/core/chapter-012-summary/summary.md", "# Summary\n\nNot a chapter."),
      file("teacher-notes/README.md", "# Teacher notes"),
      file("metadata.json", "{}", "application/json"),
      file("review/cards.tsv", "prompt\tanswer", "text/tab-separated-values")
    ]
  }));
  records.push(await writePackage(dataDir, {
    packageId: beta, version: "2.0.0", displayName: "Second Browser Curriculum", contentType: "language-curriculum",
    localization: { role: "base-curriculum", schemaVersion: "1.0.0", targetLanguage: "ko", defaultSourceLocale: "en", defaultSourcePackageId: `${beta}.source.en` },
    files: [file("units/core/chapter-001-start/chapter.md", "# Second curriculum chapter\n\nNo stale content belongs here.")]
  }));
  records.push(await writePackage(dataDir, {
    packageId: `${alpha}.source.en`, version: "1.0.0", displayName: "English source", contentType: "curriculum-source-language-pack",
    localization: { role: "source-language-pack", schemaVersion: "1.0.0", basePackageId: alpha, sourceLocale: "en", targetLanguage: "nl", compatibleBaseVersion: ">=1.0.0 <2.0.0" },
    files: [
      file("units/core/chapter-009-nine/chapter.md", "# Chapter 9 — Foundations\n\nEnglish source paragraph."),
      file("units/core/chapter-010-ten/chapter.md", "# Chapter 10 — Safe reading\n\n<img src=x onerror=alert(1)> stays text. [unsafe](JaVaScRiPt%3Aalert(1))\n\n| Term | Meaning |\n| --- | --- |\n| safe | rendered |"),
      file("units/core/chapter-011-eleven/chapter.md", "# Chapter 11 — Een zeer lange meertalige titel 第十一章 한국어 제목\n\nEnglish fallback paragraph.")
    ]
  }));
  records.push(await writePackage(dataDir, {
    packageId: `${alpha}.source.zh`, version: "1.0.0", displayName: "Traditional Chinese source", contentType: "curriculum-source-language-pack",
    localization: { role: "source-language-pack", schemaVersion: "1.0.0", basePackageId: alpha, sourceLocale: "zh-TW", targetLanguage: "nl", compatibleBaseVersion: ">=1.0.0 <2.0.0" },
    files: [
      file("units/core/chapter-009-nine/chapter.md", "# 第九章 — 基礎\n\n繁體中文第九章。"),
      file("units/core/chapter-010-ten/chapter.md", "# 第十章 — 安全閱讀\n\n繁體中文第十章。")
    ]
  }));
  await mkdir(dataDir, { recursive: true });
  await writeFile(join(dataDir, "registry.json"), JSON.stringify({ registryFormatVersion: 1, updatedAt: "2026-07-12T00:00:00Z", packages: records }));
}

function file(path, text, mediaType = "text/markdown") { return { path, mediaType, text }; }

async function writePackage(dataDir, options) {
  const installPath = `packages/${options.packageId}/${options.version}`;
  const root = join(dataDir, installPath);
  const snapshot = { contentSchema: "whacksmacker-source-markdown-snapshot-v1", defaultContentLocale: "en", localizedPaths: options.files.map(item => item.path), files: options.files };
  await mkdir(join(root, "content"), { recursive: true });
  await writeFile(join(root, "content", "content.json"), JSON.stringify(snapshot));
  const source = { repository: "https://example.invalid/playwright-fixture", commit: "0".repeat(40) };
  const manifest = { packageFormatVersion: 1, packageId: options.packageId, packageVersion: options.version, displayName: options.displayName, description: "Playwright fixture", contentType: options.contentType, contentSchemaVersion: "1.0.0", minimumWhackSmackerVersion: "0.0.1", source, generatedAt: "2026-07-12T00:00:00Z", generator: { name: "playwright-test", version: "1.0.0" }, entryPoints: [{ id: "primary", mediaType: "application/json", path: "content/content.json", role: "primary" }], files: [{ path: "content/content.json", mediaType: "application/json", size: 1, sha256: "0".repeat(64) }], localization: options.localization };
  await writeFile(join(root, "manifest.json"), JSON.stringify(manifest));
  return { packageId: options.packageId, packageVersion: options.version, displayName: options.displayName, contentType: options.contentType, contentSchemaVersion: "1.0.0", minimumWhackSmackerVersion: "0.0.1", source, installedAt: "2026-07-12T00:00:00Z", installPath, manifestSha256: "0".repeat(64), archiveSha256: "1".repeat(64), archiveSize: 1, catalogueId: "playwright-test" };
}
