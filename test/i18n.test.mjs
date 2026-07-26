import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { buildModuleTree } from "../dist/apps/cli/interactive-menu.js";
import { classifyReviewDeckMenuStatus } from "../dist/packages/core/index.js";
import { sourceLocaleLabel, translate } from "../dist/src/i18n/index.js";
import {
  loadSourceLanguageSettings,
  saveNewVocabularyDisplayPreferences,
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

test("source language and New Vocabulary display preferences default and persist independently", async () => {
  const settingsDir = await mkdtemp(join(tmpdir(), "wsm-i18n-settings-"));
  try {
    assert.deepEqual(await loadSourceLanguageSettings(settingsDir), {
      settingsFormatVersion: 2,
      sourceLanguage: "en-US",
      newVocabulary: { notesVisible: true, entrySpacing: "separated" }
    });
    await saveSourceLanguage("zh-Hant-TW", settingsDir);
    await saveNewVocabularyDisplayPreferences({ notesVisible: false, entrySpacing: "compact" }, settingsDir);
    assert.deepEqual(await loadSourceLanguageSettings(settingsDir), {
      settingsFormatVersion: 2,
      sourceLanguage: "zh-Hant-TW",
      newVocabulary: { notesVisible: false, entrySpacing: "compact" }
    });
    await saveSourceLanguage("en-US", settingsDir);
    assert.deepEqual(JSON.parse(await readFile(sourceLanguageSettingsPath(settingsDir), "utf8")), {
      settingsFormatVersion: 2,
      sourceLanguage: "en-US",
      newVocabulary: { notesVisible: false, entrySpacing: "compact" }
    });
    await saveNewVocabularyDisplayPreferences({ notesVisible: true, entrySpacing: "separated" }, settingsDir);
    assert.deepEqual(await loadSourceLanguageSettings(settingsDir), {
      settingsFormatVersion: 2,
      sourceLanguage: "en-US",
      newVocabulary: { notesVisible: true, entrySpacing: "separated" }
    });
  } finally {
    await rm(settingsDir, { recursive: true, force: true });
  }
});

test("missing, older, malformed, and obsolete settings fall back without resetting valid independent values", async () => {
  const settingsDir = await mkdtemp(join(tmpdir(), "wsm-display-settings-recovery-"));
  try {
    const path = sourceLanguageSettingsPath(settingsDir);
    await writeFile(path, "{broken", "utf8");
    assert.deepEqual((await loadSourceLanguageSettings(settingsDir)).newVocabulary, {
      notesVisible: true,
      entrySpacing: "separated"
    });

    await writeFile(path, `${JSON.stringify({
      settingsFormatVersion: 1,
      sourceLanguage: "zh-Hant-TW",
      notesEnabled: false
    })}\n`, "utf8");
    assert.deepEqual(await loadSourceLanguageSettings(settingsDir), {
      settingsFormatVersion: 2,
      sourceLanguage: "zh-Hant-TW",
      newVocabulary: { notesVisible: false, entrySpacing: "separated" }
    });
    await saveNewVocabularyDisplayPreferences({ notesVisible: false, entrySpacing: "compact" }, settingsDir);
    assert.equal((await loadSourceLanguageSettings(settingsDir)).sourceLanguage, "zh-Hant-TW");

    await writeFile(path, `${JSON.stringify({
      settingsFormatVersion: 99,
      sourceLanguage: "en-US",
      newVocabulary: { notesVisible: "Off", entrySpacing: "wide" }
    })}\n`, "utf8");
    assert.deepEqual(await loadSourceLanguageSettings(settingsDir), {
      settingsFormatVersion: 2,
      sourceLanguage: "en-US",
      newVocabulary: { notesVisible: true, entrySpacing: "separated" }
    });
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
