import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { access, chmod, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import {
  getInstalledLanguageCurriculum,
  InstalledCurriculumUnavailableError,
  installContentPackage,
  listReadingReviewItems,
  orderReadingReviewItemsForSession,
  readInstalledLanguageCurriculumChapter
} from "../dist/packages/core/index.js";
import { startWebServer } from "../dist/apps/web/server.js";

const feedRoot = process.env.WSM_PRODUCTION_PACKAGE_FEED ?? "/home/ashwin/Projects/whacksmacker-modules/whacksmacker-packages";
const cataloguePath = join(feedRoot, "catalogue.json");
const readingId = "com.sleepymario.language.vietnamese";
const reviewId = `${readingId}.reviews`;
const version = "0.1.0";
const expectedHashes = {
  [readingId]: "bbb6946f85523ae014b05ef5212f6c867672368888014663100cbf18d07e4b6c",
  [reviewId]: "e37669ce76f22bad3d1ae08d2b95ba15f0ae0e7a8ef9e482a7edd72d41002297"
};

test("current production Vietnamese reading and Review packages work in a fresh Web data directory", async (t) => {
  try { await access(cataloguePath); } catch { return t.skip(`production package feed is unavailable at ${feedRoot}`); }
  const root = await mkdtemp(join(tmpdir(), "wsm-production-vietnamese-web-"));
  const dataDir = join(root, "data");
  let server;
  try {
    const catalogue = JSON.parse(await readFile(cataloguePath, "utf8"));
    for (const packageId of [readingId, reviewId]) {
      const entry = catalogue.packages.find(candidate => candidate.packageId === packageId && candidate.packageVersion === version);
      assert.ok(entry, `${packageId}@${version} must remain in the active production catalogue`);
      assert.equal(entry.package.sha256, expectedHashes[packageId]);
      assert.equal(await sha256File(new URL(entry.package.url)), expectedHashes[packageId]);
      const installed = await installContentPackage({ cataloguePath, packageId, packageVersion: version, dataDir });
      assert.equal(installed.record.packageId, packageId);
      assert.equal(installed.record.packageVersion, version);
      assert.equal(installed.record.archiveSha256, expectedHashes[packageId]);
    }

    const curriculum = await getInstalledLanguageCurriculum(readingId, version, "en", dataDir);
    assert.equal(curriculum.targetLanguage, "vi");
    assert.equal(curriculum.overlayStatus, "missing");
    const ordinary = curriculum.chapters.filter(chapter => /vietnamese-core\/chapter-\d{3}-basic-sentences-\d+\/chapter\.md$/u.test(chapter.path));
    assert.deepEqual(ordinary.map(chapter => chapter.number), Array.from({ length: 30 }, (_, index) => index + 1));

    for (const chapterNumber of [1, 10, 11, 30]) {
      const chapter = ordinary.find(candidate => candidate.number === chapterNumber);
      assert.ok(chapter);
      const raw = await readInstalledLanguageCurriculumChapter({
        dataDir,
        packageId: readingId,
        packageVersion: version,
        chapterId: chapter.id,
        requestedSourceLocale: "en"
      });
      assert.ok(raw.text.length > 500);
    }

    const reviewItems = await listReadingReviewItems({ dataDir, packageId: reviewId, packageVersion: version, sourceLocale: "en" });
    assert.equal(reviewItems.length, 462);
    assert.equal(new Set(reviewItems.map(item => item.sourcePath)).size, 6);
    const toiCards = reviewItems.filter(item => item.item.schemaVersion === 2 && item.item.testedLexicalIds.includes("vi.pronoun.toi"));
    assert.equal(toiCards.length, 2);
    assert.deepEqual(new Set(toiCards.map(item => item.item.reviewDirection)), new Set(["vi-to-en", "en-to-vi"]));
    assert.deepEqual(new Set(toiCards.map(item => `${item.item.prompt.text}\0${item.item.answer.text}`)), new Set(["tôi\0I", "I\0tôi"]));
    const orderedA = orderReadingReviewItemsForSession(reviewItems, { random: sequenceRandom([0.01, 0.21, 0.41, 0.61, 0.81]) });
    const orderedB = orderReadingReviewItemsForSession(reviewItems, { random: sequenceRandom([0.99, 0.79, 0.59, 0.39, 0.19]) });
    assert.notDeepEqual(orderedA.map(item => item.item.id), orderedB.map(item => item.item.id));
    assert.equal(new Set(orderedA.map(item => `${item.reviewPackageId}\0${item.packageVersion}\0${item.sourcePath}\0${item.item.id}`)).size, reviewItems.length);
    const toiPositions = orderedA.flatMap((item, index) => toiCards.some(card => card.item.id === item.item.id) ? [index] : []);
    assert.equal(toiPositions.length, 2);
    assert.ok(Math.abs(toiPositions[0] - toiPositions[1]) > 1);

    server = await startWebServer({ host: "127.0.0.1", port: 0, dataDir, reviewRandom: sequenceRandom([0.15, 0.35, 0.55, 0.75, 0.95]) });
    const address = server.address();
    assert.ok(address && typeof address === "object");
    const base = `http://127.0.0.1:${address.port}`;
    const discovery = await jsonFetch(`${base}/api/curricula`);
    assert.equal(discovery.curricula.some(item => item.packageId === readingId && item.packageVersion === version), true);
    assert.deepEqual(discovery.unavailable, []);

    for (const chapterNumber of [1, 10, 11, 30]) {
      const chapter = ordinary.find(candidate => candidate.number === chapterNumber);
      for (const mode of ["normal", "expert", "developer"]) {
        const params = new URLSearchParams({ packageId: readingId, version, chapter: chapter.id, mode, translations: "true", breakdown: "true" });
        const response = await fetch(`${base}/api/curriculum/chapter?${params}`);
        assert.equal(response.status, 200, `chapter ${chapterNumber} ${mode}`);
        const body = await response.json();
        assert.ok(body.text.length > 500);
        assert.match(body.text, /Natural English Translation/u);
        assert.match(body.text, /Line-by-line Breakdown/u);
      }
    }

    const reviewDiscovery = await jsonFetch(`${base}/api/review`);
    const reviewPackage = reviewDiscovery.packages.find(item => item.packageId === reviewId && item.packageVersion === version);
    assert.ok(reviewPackage);
    assert.equal(reviewPackage.sources.length, 6);
    assert.equal(reviewPackage.sources.reduce((total, source) => total + source.itemCount, 0), 462);
    for (const card of toiCards) {
      const reveal = await jsonFetch(`${base}/api/review/reveal`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ packageId: reviewId, packageVersion: version, sourcePath: card.sourcePath, itemId: card.item.id })
      });
      assert.deepEqual(reveal.answerLines, [card.item.answer.text]);
      assert.deepEqual(reveal.exampleLines, ["Tôi là sinh viên.", "Tôi là Maria Garcia.", "Tôi là Nguyễn Minh Anh."]);
      assert.equal(new Set(reveal.exampleLines).size, reveal.exampleLines.length);
      assert.equal(reveal.exampleLines.length, 3);
      assert.doesNotMatch(JSON.stringify(reveal), /prompts recall|This card prompts|This item tests|\.tsv/iu);
    }
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    await rm(root, { recursive: true, force: true });
  }
});

test("installed curriculum diagnostics distinguish incompatible legacy, corrupt, and unreadable current packages", async (t) => {
  try { await access(cataloguePath); } catch { return t.skip(`production package feed is unavailable at ${feedRoot}`); }
  const root = await mkdtemp(join(tmpdir(), "wsm-production-vietnamese-diagnostics-"));
  const dataDir = join(root, "data");
  try {
    const installed = await installContentPackage({ cataloguePath, packageId: readingId, packageVersion: version, dataDir });
    const packageRoot = join(dataDir, installed.record.installPath);
    const manifestPath = join(packageRoot, "manifest.json");
    const snapshotPath = join(packageRoot, "content", "content.json");
    const originalManifest = await readFile(manifestPath);
    const originalSnapshot = await readFile(snapshotPath);
    await chmod(manifestPath, 0o644);
    await chmod(snapshotPath, 0o644);

    const manifest = JSON.parse(originalManifest);
    delete manifest.capabilities;
    await writeFile(manifestPath, `${JSON.stringify(manifest)}\n`);
    await assertReason(dataDir, "incompatible-legacy");

    await writeFile(manifestPath, originalManifest);
    await writeFile(snapshotPath, "{not-json\n");
    await assertReason(dataDir, "corrupt");

    const snapshot = JSON.parse(originalSnapshot);
    snapshot.files = snapshot.files.filter(file => file.path !== "name-pools/canonical-cast.json");
    await writeFile(snapshotPath, `${JSON.stringify(snapshot)}\n`);
    await assertReason(dataDir, "unreadable-current");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

async function jsonFetch(url, options) {
  const response = await fetch(url, options);
  if (response.status !== 200) assert.fail(`${response.status}: ${await response.text()}`);
  return response.json();
}

async function sha256File(url) {
  return createHash("sha256").update(await readFile(url)).digest("hex");
}

function sequenceRandom(values) {
  let index = 0;
  return () => values[index++ % values.length];
}

async function assertReason(dataDir, reason) {
  await assert.rejects(
    getInstalledLanguageCurriculum(readingId, version, "en", dataDir),
    error => error instanceof InstalledCurriculumUnavailableError && error.reason === reason
  );
}
