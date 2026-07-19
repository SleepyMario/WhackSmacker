import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { buildModuleTree } from "../dist/apps/cli/interactive-menu.js";
import { classifyReviewDeckMenuStatus } from "../dist/packages/core/index.js";
import { sourceLocaleLabel, translate } from "../dist/src/i18n/index.js";
import {
  loadSourceLanguageSettings,
  saveSourceLanguage,
  sourceLanguageSettingsPath
} from "../dist/src/settings/source-language.js";

test("translation lookup supports en-US and zh-Hant-TW", () => {
  assert.equal(translate("en-US", "menu.readContent"), "Read content");
  assert.equal(translate("zh-Hant-TW", "menu.readContent"), "閱讀內容");
  assert.equal(sourceLocaleLabel("en-US", "zh-Hant-TW"), "英文");
  assert.equal(sourceLocaleLabel("zh-Hant-TW", "zh-Hant-TW"), "中文（臺灣）");
});

test("zh-Hant-TW falls back to en-US and unknown keys do not throw", () => {
  assert.equal(translate("zh-Hant-TW", "app.name"), "WhackSmacker");
  assert.equal(translate("zh-Hant-TW", "missing.translation.key"), "missing.translation.key");
});

test("translation interpolation renders review card counts", () => {
  assert.equal(translate("en-US", "review.cardsDue", { count: 3 }), "There are 3 cards to review.");
  assert.equal(translate("zh-Hant-TW", "review.cardsDue", { count: 3 }), "目前有 3 張牌卡需要複習。");
});

test("source-language setting defaults to English and persists changes", async () => {
  const settingsDir = await mkdtemp(join(tmpdir(), "wsm-i18n-settings-"));
  try {
    assert.equal((await loadSourceLanguageSettings(settingsDir)).sourceLanguage, "en-US");
    await saveSourceLanguage("zh-Hant-TW", settingsDir);
    assert.equal((await loadSourceLanguageSettings(settingsDir)).sourceLanguage, "zh-Hant-TW");
    assert.deepEqual(JSON.parse(await readFile(sourceLanguageSettingsPath(settingsDir), "utf8")), {
      settingsFormatVersion: 1,
      sourceLanguage: "zh-Hant-TW"
    });
    await saveSourceLanguage("en-US", settingsDir);
    assert.equal((await loadSourceLanguageSettings(settingsDir)).sourceLanguage, "en-US");
  } finally {
    await rm(settingsDir, { recursive: true, force: true });
  }
});

test("module tree displays English roots without the former settings path", async () => {
  const tree = await buildModuleTree({ locale: "en-US" });
  assert.deepEqual(tree.children.map((node) => node.label), ["Installed modules", "Modules available"]);
  assert.equal(tree.children.some((node) => node.id === "settings"), false);
});

test("module tree displays Traditional Chinese Taiwan roots without the former settings path", async () => {
  const tree = await buildModuleTree({ locale: "zh-Hant-TW" });
  assert.deepEqual(tree.children.map((node) => node.label), ["已安裝模組", "可安裝模組"]);
  assert.equal(tree.children.some((node) => node.id === "settings"), false);
});

test("review deck status text localizes without changing the central semantic status", () => {
  const now = "2026-07-10T00:00:00Z";
  const due = {
    packageId: "example.package",
    packageVersion: "1.0.0",
    itemId: "card-1",
    firstSeenAt: "2026-07-01T00:00:00Z",
    lastReviewedAt: "2026-07-01T00:00:00Z",
    nextReviewAt: "2026-07-09T00:00:00Z",
    reviewCount: 1,
    lapseCount: 0,
    intervalDays: 1,
    easeFactor: 2.5,
    status: "review"
  };
  const classification = classifyReviewDeckMenuStatus({
    deckId: "example.package#review",
    cardIdentities: [{ packageId: due.packageId, packageVersion: due.packageVersion, itemId: due.itemId }],
    savedProgress: [due],
    now
  });
  assert.deepEqual(classification, { status: "has_cards_to_review", dueCardCount: 1 });
  assert.equal(translate("en-US", "review.cardsDue", { count: classification.dueCardCount }), "There are 1 cards to review.");
  assert.equal(translate("zh-Hant-TW", "review.cardsDue", { count: classification.dueCardCount }), "目前有 1 張牌卡需要複習。");
  assert.equal(translate("zh-Hant-TW", "review.notStarted"), "尚未開始。");
});
