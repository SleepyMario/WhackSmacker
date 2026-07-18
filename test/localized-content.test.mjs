import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { buildModuleTree } from "../dist/apps/cli/interactive-menu.js";
import {
  listInstalledReadablePackages,
  localized,
  readInstalledContentEntry,
  renderReadingContent,
  renderReadingReviewItem,
  validateContentPackageCatalogue,
  validateContentPackageManifest,
  validateMemorizationItem
} from "../dist/packages/core/index.js";

test("localized content values use deterministic selected English and first-available fallback", () => {
  assert.equal(localized("English-only text", "en-US"), "English-only text");
  assert.equal(localized("English-only text", "zh-Hant-TW"), "English-only text");
  assert.equal(localized({ "en-US": "English", "zh-Hant-TW": "繁體中文" }, "en-US"), "English");
  assert.equal(localized({ "en-US": "English", "zh-Hant-TW": "繁體中文" }, "zh-Hant-TW"), "繁體中文");
  assert.equal(localized({ "en-US": "English" }, "zh-Hant-TW"), "English");
  assert.equal(localized({ "ko-KR": "한국어", "fr-FR": "français" }, "zh-Hant-TW"), "français");
  assert.equal(localized(undefined, "zh-Hant-TW"), "");
});

test("package manifest and catalogue validators accept localized metadata and old strings", () => {
  const manifest = localizedManifest();
  assert.deepEqual(validateContentPackageManifest(manifest).errors, []);
  assert.deepEqual(validateContentPackageManifest({ ...manifest, displayName: "Localized Fixture" }).errors, []);
  const entry = {
    packageId: manifest.packageId,
    packageVersion: manifest.packageVersion,
    displayName: manifest.displayName,
    description: manifest.description,
    contentType: manifest.contentType,
    contentSchemaVersion: manifest.contentSchemaVersion,
    minimumWhackSmackerVersion: manifest.minimumWhackSmackerVersion,
    source: manifest.source,
    package: {
      url: "file:///tmp/localized-fixture.wspkg",
      mediaType: "application/vnd.whacksmacker.package+zip",
      size: 1,
      sha256: "0".repeat(64)
    }
  };
  assert.deepEqual(validateContentPackageCatalogue({
    catalogueFormatVersion: 1,
    catalogueId: "com.sleepymario.test",
    displayName: "Test catalogue",
    description: "Test catalogue.",
    generatedAt: "2026-07-10T00:00:00Z",
    packages: [entry]
  }).errors, []);
});

test("installed localized package resolves metadata reading content and review fields by source locale", async () => {
  const fixture = await createLocalizedFixture();
  try {
    const englishPackage = (await listInstalledReadablePackages(fixture.dataDir, "en-US"))[0];
    const chinesePackage = (await listInstalledReadablePackages(fixture.dataDir, "zh-Hant-TW"))[0];
    assert.equal(englishPackage.displayName, "Dutch Mini Course");
    assert.equal(englishPackage.description, "A small bilingual fixture.");
    assert.equal(chinesePackage.displayName, "荷蘭語迷你課程");
    assert.equal(chinesePackage.description, "小型雙語測試內容。 ".trim());

    const english = await readInstalledContentEntry({
      dataDir: fixture.dataDir,
      packageId: fixture.packageId,
      path: "lesson.md",
      locale: "en-US"
    });
    const chinese = await readInstalledContentEntry({
      dataDir: fixture.dataDir,
      packageId: fixture.packageId,
      path: "lesson.md",
      locale: "zh-Hant-TW"
    });
    const fallback = await readInstalledContentEntry({
      dataDir: fixture.dataDir,
      packageId: fixture.packageId,
      path: "english-only.md",
      locale: "zh-Hant-TW"
    });
    assert.match(renderReadingContent(english), /# Greetings\n\nRead the Dutch sentence\./u);
    assert.match(renderReadingContent(chinese), /荷蘭語迷你課程/u);
    assert.match(renderReadingContent(chinese), /# 問候\n\n閱讀荷蘭語句子。/u);
    assert.equal(fallback.text, "# English only\n\nFallback lesson.\n");

    const englishReview = await renderReadingReviewItem({
      dataDir: fixture.dataDir,
      packageId: fixture.packageId,
      itemId: "lesson/card-1",
      sourceLocale: "en-US",
      answer: true
    });
    const chineseReview = await renderReadingReviewItem({
      dataDir: fixture.dataDir,
      packageId: fixture.packageId,
      itemId: "lesson/card-1",
      sourceLocale: "zh-Hant-TW",
      answer: true
    });
    assert.deepEqual(englishReview.rendered.promptLines, ["hello"]);
    assert.deepEqual(chineseReview.rendered.promptLines, ["你好"]);
    assert.deepEqual(chineseReview.rendered.answerLines, ["hallo"]);
    assert.deepEqual(chineseReview.rendered.hintLines, ["常見的問候語"]);
    assert.deepEqual(chineseReview.rendered.noteLines, ["來源語言註解"]);
    assert.deepEqual(chineseReview.rendered.exampleLines, ["Sanne zegt: hallo."]);
    assert.match(chineseReview.text, /Examples:\n  - Sanne zegt: hallo\./u);
    assert.doesNotMatch(chineseReview.text, /莎anne|範例翻譯/u);

    const chineseTree = await buildModuleTree({ dataDir: fixture.dataDir, locale: "zh-Hant-TW" });
    const installed = chineseTree.children.find((node) => node.id === "installed-modules");
    const languages = installed.children.find((node) => node.id === "languages");
    const localizedPackage = languages.children.find((node) => node.id === fixture.packageId);
    const readSection = localizedPackage.children.find((node) => node.kind === "read-section");
    const reviewSection = localizedPackage.children.find((node) => node.kind === "review-section");
    assert.equal(localizedPackage.label, "荷蘭語迷你課程");
    assert.equal(localizedPackage.previewText.includes("小型雙語測試內容。"), true);
    assert.ok(readSection.children.some((node) => node.label === "問候"));
    assert.ok(reviewSection.children.some((node) => node.label === "問候"));
  } finally {
    await fixture.cleanup();
  }
});

test("localized memorization fields validate while examples remain literal strings", () => {
  const item = localizedReviewItem();
  assert.deepEqual(validateMemorizationItem(item).errors, []);
  assert.match(validateMemorizationItem({ ...item, examples: [{ "en-US": "Not literal" }] }).errors.join("\n"), /examples\[0\] must be a non-empty string/u);
});

function localizedManifest() {
  return {
    packageFormatVersion: 1,
    packageId: "com.sleepymario.language.localized-fixture",
    packageVersion: "0.1.0",
    displayName: { "en-US": "Dutch Mini Course", "zh-Hant-TW": "荷蘭語迷你課程" },
    description: { "en-US": "A small bilingual fixture.", "zh-Hant-TW": "小型雙語測試內容。" },
    contentType: "language-curriculum",
    contentSchemaVersion: "1.0.0",
    minimumWhackSmackerVersion: "0.0.1",
    source: { repository: "https://example.invalid/localized", commit: "a".repeat(40) },
    generatedAt: "2026-07-10T00:00:00Z",
    generator: { name: "localized-test", version: "0.0.1" },
    entryPoints: [{ id: "primary", mediaType: "application/json", path: "content/content.json", role: "primary" }],
    files: [
      fileRecord("content/content.json", "application/json"),
      fileRecord("content/memorization/cards.json", "application/vnd.whacksmacker.memorization-items+json")
    ]
  };
}

function fileRecord(path, mediaType) {
  return { path, mediaType, size: 1, sha256: "0".repeat(64) };
}

function localizedReviewItem() {
  return {
    schemaVersion: 1,
    id: "lesson/card-1",
    kind: "vocabulary",
    prompt: { text: { "en-US": "hello", "zh-Hant-TW": "你好" }, language: "en" },
    answer: { text: "hallo", language: "nl" },
    hints: [{ "en-US": "A common greeting", "zh-Hant-TW": "常見的問候語" }],
    notes: { "en-US": "Source-language note", "zh-Hant-TW": "來源語言註解" },
    examples: ["Sanne zegt: hallo."],
    source: { path: "lesson.md", title: { "en-US": "Greetings", "zh-Hant-TW": "問候" } }
  };
}

async function createLocalizedFixture() {
  const dataDir = await mkdtemp(join(tmpdir(), "wsm-localized-content-"));
  const manifest = localizedManifest();
  const installPath = `packages/${manifest.packageId}/${manifest.packageVersion}`;
  const root = join(dataDir, installPath);
  const snapshot = {
    contentSchema: "whacksmacker-source-markdown-snapshot-v1",
    files: [
      {
        path: "lesson.md",
        mediaType: "text/markdown",
        text: {
          "en-US": "# Greetings\n\nRead the Dutch sentence.\n",
          "zh-Hant-TW": "# 問候\n\n閱讀荷蘭語句子。\n"
        }
      },
      { path: "english-only.md", mediaType: "text/markdown", text: "# English only\n\nFallback lesson.\n" }
    ]
  };
  const registry = {
    registryFormatVersion: 1,
    updatedAt: "2026-07-10T00:00:00Z",
    packages: [{
      packageId: manifest.packageId,
      packageVersion: manifest.packageVersion,
      displayName: "Dutch Mini Course",
      contentType: manifest.contentType,
      contentSchemaVersion: manifest.contentSchemaVersion,
      minimumWhackSmackerVersion: manifest.minimumWhackSmackerVersion,
      source: manifest.source,
      installedAt: "2026-07-10T00:00:00Z",
      installPath,
      manifestSha256: "0".repeat(64),
      archiveSha256: "0".repeat(64),
      archiveSize: 1,
      catalogueId: "com.sleepymario.test"
    }]
  };
  await mkdir(join(root, "content", "memorization"), { recursive: true });
  await writeJson(join(dataDir, "registry.json"), registry);
  await writeJson(join(root, "manifest.json"), manifest);
  await writeJson(join(root, "content", "content.json"), snapshot);
  await writeJson(join(root, "content", "memorization", "cards.json"), {
    schemaVersion: 1,
    items: [localizedReviewItem()]
  });
  return {
    dataDir,
    packageId: manifest.packageId,
    cleanup: () => rm(dataDir, { recursive: true, force: true })
  };
}

async function writeJson(path, value) {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
