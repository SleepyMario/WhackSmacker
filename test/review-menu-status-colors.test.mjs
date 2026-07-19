import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";

import {
  menuStyles,
  renderTwoPaneLanguageTree,
  reviewDeckStatusStyle,
  shouldUseTerminalColors
} from "../dist/apps/cli/interactive-menu.js";
import {
  classifyReviewDeckMenuStatus,
  createInitialReviewState,
  emptyReviewProgressStore,
  recordReviewOutcome,
  reviewDeckMenuStatuses,
  validateContentPackageManifest,
  validateReviewProgressStore
} from "../dist/packages/core/index.js";

const now = "2026-07-17T00:00:00Z";
const identity = (deck, itemId) => ({
  packageId: `com.sleepymario.language.${deck.language}`,
  packageVersion: "0.1.0",
  sourcePath: `review-decks/${deck.block}/cards.tsv`,
  itemId
});
const deck = (language, block = "chapter-001-005") => ({ language, block, id: `${language}:${block}` });

function classify(deckIdentity, cardIdentities, savedProgress, at = now) {
  return classifyReviewDeckMenuStatus({
    deckId: deckIdentity.id,
    cardIdentities,
    savedProgress,
    now: at
  });
}

function renderRows(rows, colorsEnabled = true) {
  const tree = {
    id: "whacksmacker",
    label: "WhackSmacker",
    kind: "root",
    children: [{
      id: "review-decks",
      label: "Review decks",
      kind: "review-section",
      children: rows.map(({ id, label, status }) => ({ id, label, kind: "review-source", reviewStatus: status }))
    }]
  };
  return renderTwoPaneLanguageTree(tree, new Set(["whacksmacker", "review-decks"]), 0, "", colorsEnabled, 0, 80, "en-US", "navigation", 180);
}

function rowContaining(output, label) {
  const row = output.split("\n").find(line => stripAnsi(line).includes(label));
  assert.ok(row, `rendered row for ${label}`);
  return row;
}

function stripAnsi(value) {
  return value.replace(/\x1b\[[0-9;]*m/gu, "");
}

function statusSequenceBeforeLabel(row, label) {
  const labelIndex = row.indexOf(label);
  assert.notEqual(labelIndex, -1);
  const before = row.slice(0, labelIndex);
  const lastReset = before.lastIndexOf("\x1b[0m");
  return before.slice(lastReset < 0 ? 0 : lastReset + "\x1b[0m".length);
}

test("one canonical classifier provides the permanent four-state precedence", () => {
  assert.deepEqual(reviewDeckMenuStatuses, ["not_started", "no_cards_to_review", "has_cards_to_review", "finished"]);
  const target = deck("dutch");
  const cards = [identity(target, "card-1")];
  const initial = cards.map(card => createInitialReviewState(card, now));

  assert.deepEqual(classify(target, cards, initial), { status: "not_started", dueCardCount: 0 });

  const firstRating = recordReviewOutcome(initial[0], "good", now).state;
  assert.deepEqual(classify(target, cards, [firstRating]), { status: "no_cards_to_review", dueCardCount: 0 });

  const dueTime = firstRating.nextReviewAt;
  assert.deepEqual(classify(target, [cards[0]], [firstRating], dueTime), { status: "has_cards_to_review", dueCardCount: 1 });
  const secondRating = recordReviewOutcome(firstRating, "good", dueTime).state;
  assert.deepEqual(classify(target, [cards[0]], [secondRating], dueTime), { status: "no_cards_to_review", dueCardCount: 0 });

  const finished = initial.map(state => ({ ...state, reviewCount: 1, status: "suspended", nextReviewAt: "2000-01-01T00:00:00Z" }));
  assert.deepEqual(classify(target, cards, finished), { status: "finished", dueCardCount: 0 }, "finished overrides anomalously old due timestamps");
});

test("the one style helper maps exact status colours and complete rendered labels", () => {
  assert.equal(reviewDeckStatusStyle("not_started"), "\x1b[35m");
  assert.equal(reviewDeckStatusStyle("no_cards_to_review"), menuStyles.defaultForeground);
  assert.equal(menuStyles.defaultForeground, "");
  assert.equal(reviewDeckStatusStyle("has_cards_to_review"), "\x1b[34m");
  assert.equal(reviewDeckStatusStyle("finished"), "\x1b[32m");

  const rows = [
    { id: "not-started", label: "Review -- Chapters 1–5", status: "not_started" },
    { id: "nothing-due", label: "Review -- Chapters 6–10", status: "no_cards_to_review" },
    { id: "due", label: "Review -- Chapters 11–15", status: "has_cards_to_review" },
    { id: "finished", label: "Review -- Chapters 16–20", status: "finished" }
  ];
  const output = renderRows(rows);
  assert.match(rowContaining(output, rows[0].label), /\x1b\[35m[^\x1b\n]*Review -- Chapters 1–5\x1b\[0m/u);
  const defaultRow = rowContaining(output, rows[1].label);
  assert.doesNotMatch(statusSequenceBeforeLabel(defaultRow, rows[1].label), /\x1b\[(?:3[2-5]|38;5;\d+)m/u, "default row cannot inherit its magenta predecessor");
  assert.match(rowContaining(output, rows[2].label), /\x1b\[34m[^\x1b\n]*Review -- Chapters 11–15\x1b\[0m/u);
  assert.match(rowContaining(output, rows[3].label), /\x1b\[32m[^\x1b\n]*Review -- Chapters 16–20\x1b\[0m/u);
  for (const row of rows) assert.doesNotMatch(rowContaining(output, row.label), /\x1b\[33m/u);
});

test("multiple decks and representative languages share classification and remain isolated", () => {
  const languages = ["dutch", "vietnamese", "korean", "chinese", "japanese"];
  for (const language of languages) {
    const target = deck(language);
    const card = identity(target, "card-1");
    const due = { ...createInitialReviewState(card, now), reviewCount: 1, lastReviewedAt: "2026-07-16T00:00:00Z", status: "review" };
    assert.deepEqual(classify(target, [card], [due]), { status: "has_cards_to_review", dueCardCount: 1 });
  }

  const decks = [
    deck("dutch", "chapter-001-005"),
    deck("dutch", "chapter-006-010"),
    deck("dutch", "chapter-011-015"),
    deck("dutch", "chapter-016-020")
  ];
  const cards = decks.map(target => identity(target, "shared-looking-card"));
  const due = { ...createInitialReviewState(cards[1], now), reviewCount: 1, lastReviewedAt: "2026-07-16T00:00:00Z", status: "review" };
  const finished = { ...createInitialReviewState(cards[2], now), reviewCount: 1, status: "suspended" };
  const waiting = { ...createInitialReviewState(cards[3], now), reviewCount: 1, lastReviewedAt: now, nextReviewAt: "2999-01-01T00:00:00Z", status: "review" };
  const combinedProgress = [due, finished, waiting];
  assert.deepEqual(decks.map((target, index) => classify(target, [cards[index]], combinedProgress).status), [
    "not_started",
    "has_cards_to_review",
    "finished",
    "no_cards_to_review"
  ]);
});

test("NO_COLOR and non-TTY suppress ANSI without changing semantic status or labels", () => {
  const rows = reviewDeckMenuStatuses.map((status, index) => ({
    id: status,
    label: `Review -- Chapters ${index * 5 + 1}–${index * 5 + 5}`,
    status
  }));
  const output = renderRows(rows, false);
  assert.doesNotMatch(output, /\x1b\[/u);
  for (const row of rows) assert.match(output, new RegExp(row.label, "u"));
  assert.equal(shouldUseTerminalColors(true, { NO_COLOR: "1" }), false);
  assert.equal(shouldUseTerminalColors(false, {}), false);
});

test("architecture has one classifier, one style mapping, and no package-defined colour fields", async () => {
  const root = process.cwd();
  const coreFiles = (await readdir(join(root, "packages/core"))).filter(name => name.endsWith(".ts"));
  const coreSources = await Promise.all(coreFiles.map(name => readFile(join(root, "packages/core", name), "utf8")));
  assert.equal(coreSources.reduce((count, source) => count + (source.match(/export function classifyReviewDeckMenuStatus\b/gu)?.length ?? 0), 0), 1);

  const interactive = await readFile(join(root, "apps/cli/interactive-menu.ts"), "utf8");
  const web = await readFile(join(root, "apps/web/server.ts"), "utf8");
  assert.equal((interactive.match(/function reviewDeckStatusStyle\b/gu) ?? []).length, 1);
  assert.equal((interactive.match(/reviewDeckStatusStyle\(/gu) ?? []).length, 2, "one definition and one renderer consumer");
  const styleBody = interactive.slice(interactive.indexOf("export function reviewDeckStatusStyle"), interactive.indexOf("function hasReviewDeckColoredMenuToken"));
  assert.doesNotMatch(styleBody, /ansi\.yellow/u);
  assert.match(web, /classifyReviewDeckMenuStatus\(/u);
  assert.doesNotMatch(web, /reviewed\s*===\s*0\s*\?\s*["']not_started/u);

  const schemaFiles = (await readdir(join(root, "schemas"))).filter(name => name.endsWith(".json"));
  for (const name of schemaFiles) {
    const schema = await readFile(join(root, "schemas", name), "utf8");
    assert.doesNotMatch(schema, /(?:notStarted|nothingDue|cardsDue|finished)(?:Color|Colour)|status(?:Color|Colour)/iu, `${name} cannot delegate status colours to packages`);
  }
});

test("package and progress validators reject persisted review-menu colour hints", async () => {
  const manifestUrl = new URL("../docs/content-packages/examples/korean-manifest.example.json", import.meta.url);
  const manifest = JSON.parse(await readFile(manifestUrl, "utf8"));
  manifest.menuStatusPresentation = { hasCardsToReviewColor: "yellow" };
  const manifestResult = validateContentPackageManifest(manifest);
  assert.equal(manifestResult.valid, false);
  assert.match(manifestResult.errors.join("\n"), /menuStatusPresentation is forbidden/u);

  const progress = { ...emptyReviewProgressStore(now), reviewDeckMenuStatusColor: "blue" };
  const progressResult = validateReviewProgressStore(progress);
  assert.equal(progressResult.valid, false);
  assert.match(progressResult.errors.join("\n"), /reviewDeckMenuStatusColor is forbidden/u);
});
