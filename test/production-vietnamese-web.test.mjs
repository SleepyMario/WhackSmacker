import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { access, chmod, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { JSDOM } from "jsdom";

import {
  getInstalledLanguageCurriculum,
  InstalledCurriculumUnavailableError,
  installContentPackage,
  listReadingReviewItems,
  orderReadingReviewItemsForSession,
  readInstalledLanguageCurriculumChapter
} from "../dist/packages/core/index.js";
import { buildLanguageTree, renderLanguageTreeRightPane } from "../dist/apps/cli/interactive-menu.js";
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

    const toggleCases = [
      { translations: false, characters: false, breakdown: false },
      { translations: true, characters: false, breakdown: false },
      { translations: false, characters: true, breakdown: false },
      { translations: false, characters: false, breakdown: true },
      { translations: true, characters: true, breakdown: false },
      { translations: true, characters: false, breakdown: true },
      { translations: false, characters: true, breakdown: true },
      { translations: true, characters: true, breakdown: true }
    ];
    for (const mode of ["normal", "expert", "developer"]) {
      const tree = await buildLanguageTree(dataDir, mode);
      for (const chapterNumber of [1, 10, 11, 30]) {
        const chapter = ordinary.find(candidate => candidate.number === chapterNumber);
        const node = findNode(tree, candidate => candidate.kind === "content" && candidate.filePath === chapter.path);
        assert.ok(node, `CLI node for Chapter ${chapterNumber} ${mode}`);
        for (const toggles of toggleCases) {
          const cli = await renderLanguageTreeRightPane(node, {
            dataDir,
            locale: "en-US",
            displayMode: mode,
            translationsEnabled: toggles.translations,
            charactersEnabled: toggles.characters,
            breakdownEnabled: toggles.breakdown,
            notesEnabled: true
          });
          const params = new URLSearchParams({ packageId: readingId, version, chapter: chapter.id, mode });
          for (const [name, value] of Object.entries(toggles)) params.set(name, String(value));
          const response = await fetch(`${base}/api/curriculum/chapter?${params}`);
          assert.equal(response.status, 200, `chapter ${chapterNumber} ${mode} ${JSON.stringify(toggles)}`);
          const body = await response.json();
          assert.equal(body.text, cli, `Web/CLI parity for Chapter ${chapterNumber} ${mode} ${JSON.stringify(toggles)}`);
          assertCompleteProjection(body.text, { chapterNumber, mode, toggles });
        }
      }
    }

    const browserChapter = ordinary.find(candidate => candidate.number === 11);
    const browserParams = new URLSearchParams({ packageId: readingId, version, chapter: browserChapter.id, mode: "normal" });
    const browserBody = await jsonFetch(`${base}/api/curriculum/chapter?${browserParams}`);
    const html = await readFile("apps/web/public/index.html", "utf8");
    const appScript = await readFile("apps/web/public/app.js", "utf8");
    const route = `/app?package=${readingId}&version=${version}&locale=en&chapter=${encodeURIComponent(browserChapter.id)}`;
    const dom = new JSDOM(html, { url: `http://127.0.0.1${route}`, runScripts: "outside-only" });
    dom.window.fetch = async path => {
      if (path === "/api/state") return Response.json({ locale: "en", theme: "dark", user: { username: "production-package-test" } });
      if (path === "/api/curricula") return Response.json({ requestedSourceLocale: "en", curricula: [curriculum], unavailable: [] });
      if (String(path).startsWith("/api/curriculum/chapter?")) return Response.json(browserBody);
      throw new Error(`Unexpected production browser request ${path}`);
    };
    dom.window.eval(appScript);
    await waitFor(() => /Dialogue/u.test(dom.window.document.querySelector("#chapter-content")?.textContent ?? ""));
    const rendered = dom.window.document.querySelector("#chapter-content");
    assert.match(rendered.textContent, /New Vocabulary[\s\S]*Grammar[\s\S]*Simple Exercises/u);
    assert.equal(rendered.querySelector("script,style,iframe,object,embed"), null);
    assert.equal(rendered.querySelectorAll("h1,h2,h3,h4").length >= 6, true);
    assert.doesNotMatch(rendered.textContent, /Exercise Metadata|Original Vocabulary Source Notes|^Ledger$/imu);

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

function findNode(node, predicate) {
  if (predicate(node)) return node;
  for (const child of node.children ?? []) {
    const found = findNode(child, predicate);
    if (found) return found;
  }
}

function assertCompleteProjection(text, { chapterNumber, mode, toggles }) {
  const context = `Chapter ${chapterNumber} ${mode} ${JSON.stringify(toggles)}`;
  assert.match(text, /^# Chapter/imu, `${context}: title`);
  assert.match(text, /^### (?:Dialogue|Narrative)$/mu, `${context}: primary reading`);
  assert.match(text, /^### New Vocabulary$/mu, `${context}: vocabulary`);
  assert.match(text, /^### Grammar$/mu, `${context}: grammar`);
  assert.match(text, /^#{2,3} (?:Simple )?Exercises$/mu, `${context}: exercises`);
  assert.equal((text.match(/^### (?:Dialogue|Narrative)$/gmu) ?? []).length, 1, `${context}: one primary reading`);
  assert.equal((text.match(/^### New Vocabulary$/gmu) ?? []).length, 1, `${context}: one vocabulary section`);
  assert.equal((text.match(/^#{2,3} (?:Simple )?Exercises$/gmu) ?? []).length, 1, `${context}: one exercise section`);
  assert.equal(Buffer.from(text, "utf8").toString("utf8"), text, `${context}: UTF-8 round trip`);
  assert.match(text, /[À-ỹ]/u, `${context}: Vietnamese Unicode retained`);
  assert.ok(new Set(text.match(/^#{1,6}\s+.+$/gmu) ?? []).size >= 6, `${context}: section diversity exceeds support-only regression`);
  if (!toggles.characters) assert.doesNotMatch(text, /Sino-Vietnamese Vocabulary|Character Notes/u, `${context}: Characters off`);
  if (toggles.characters && chapterNumber === 1) assert.match(text, /Sino-Vietnamese Vocabulary/u, `${context}: packaged Characters support is additive`);
  if (mode === "normal" || mode === "expert") {
    assert.doesNotMatch(text, /Exercise Metadata|Original Vocabulary Source Notes|^## Ledger$|whacksmacker:developer-only|^---$|\b(?:answer_token_audit|answer_structure_audit|sourcePath|schemaVersion|validatorShape|pedagogicalFingerprint)\s*:/imu, `${context}: no machine metadata`);
  } else {
    assert.match(text, /^### (?:Brief Introduction: Normal|Brief Introduction)$/mu, `${context}: Developer retains learner setup`);
    if ([1, 11, 30].includes(chapterNumber)) assert.match(text, /Exercise Metadata/u, `${context}: Developer metadata retained`);
  }
  assert.equal(/Natural English Translation/u.test(text), toggles.translations, `${context}: Translation is additive`);
  assert.equal(/Line-by-line Breakdown/u.test(text), toggles.breakdown, `${context}: Breakdown is additive`);
}

async function assertReason(dataDir, reason) {
  await assert.rejects(
    getInstalledLanguageCurriculum(readingId, version, "en", dataDir),
    error => error instanceof InstalledCurriculumUnavailableError && error.reason === reason
  );
}

async function waitFor(predicate) {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    if (predicate()) return;
    await new Promise(resolve => setTimeout(resolve, 5));
  }
  assert.fail("Timed out rendering the production Vietnamese chapter in the browser DOM");
}
