import assert from "node:assert/strict";
import { test } from "node:test";

import {
  EmbeddedReviewArtworkManager,
  formatEmbeddedReviewExercise,
  formatEmbeddedReviewReveal,
  renderEmbeddedReviewSession,
  renderTwoPaneLanguageTree
} from "../dist/apps/cli/interactive-menu.js";
import {
  pedagogicalContentForMemorizationItem,
  pedagogicalFingerprint,
  renderMemorizationExercise
} from "../dist/packages/core/index.js";

const english = {
  language: "en",
  media: "animal-0096-illustration.webp",
  alt: "Animal illustration",
  headword: "razorbill",
  sentence: "The razorbill swims close to the rocky shore."
};
const dutch = {
  language: "nl",
  media: "animal-0096-wildlife.webp",
  alt: "Wildlife image",
  headword: "de alk",
  sentence: "De alk zwemt dicht bij de rotsachtige kust."
};

test("English to Dutch topic Review renders exactly two language bullets per side without redundant markup", () => {
  const item = topicItem("en-to-nl", english, dutch);
  const exercise = renderTopic(item);
  const hidden = formatEmbeddedReviewExercise(exercise, "prompt", false);
  const revealed = formatEmbeddedReviewReveal(exercise, exercise, false);

  assert.deepEqual(sectionBullets(hidden, "Phrase:", "Answer:"), [
    `• ${english.headword}`,
    `• ${english.sentence}`
  ]);
  assert.match(hidden, /Answer:\s+Answer hidden until reveal\./u);
  assert.doesNotMatch(hidden, new RegExp(escapeRegExp(dutch.headword), "u"));
  assert.doesNotMatch(hidden, new RegExp(escapeRegExp(dutch.sentence), "u"));
  assert.deepEqual(sectionBullets(revealed, "Phrase:", "Answer:"), [
    `• ${english.headword}`,
    `• ${english.sentence}`
  ]);
  assert.deepEqual(sectionBullets(revealed, "Answer:"), [
    `• ${dutch.headword}`,
    `• ${dutch.sentence}`
  ]);
  assert.doesNotMatch(answerSection(revealed), new RegExp(escapeRegExp(english.sentence), "u"));
  assert.doesNotMatch(phraseSection(revealed), new RegExp(escapeRegExp(dutch.sentence), "u"));
  assert.doesNotMatch(revealed, /Examples:|\\n|!\[[^\]]*\]\([^)]*\)/u);
  assert.deepEqual(item.examples, [english.sentence, dutch.sentence]);
});

test("Dutch to English topic Review keeps each language on its own two-bullet side", () => {
  const exercise = renderTopic(topicItem("nl-to-en", dutch, english));
  const revealed = formatEmbeddedReviewReveal(exercise, exercise, false);

  assert.deepEqual(sectionBullets(revealed, "Phrase:", "Answer:"), [
    `• ${dutch.headword}`,
    `• ${dutch.sentence}`
  ]);
  assert.deepEqual(sectionBullets(revealed, "Answer:"), [
    `• ${english.headword}`,
    `• ${english.sentence}`
  ]);
  assert.doesNotMatch(revealed, /Examples:|\\n|!\[[^\]]*\]\([^)]*\)/u);
});

test("topic Review bullets reuse Reading learner yellow and wrap beneath bullet text", () => {
  const exercise = renderTopic(topicItem("en-to-nl", english, dutch));
  const rightPane = renderEmbeddedReviewSession({ ...reviewSession(undefined), promptRendered: exercise }, true);
  const output = renderTwoPaneLanguageTree(
    { id: "root", label: "Root", kind: "root" },
    new Set(),
    0,
    rightPane,
    true,
    0,
    28,
    "en-US",
    "navigation",
    100
  );
  const lines = output.split("\n");
  const headwordLine = lines.find((line) => line.includes("• razorbill"));
  const sentenceLine = lines.find((line) => line.includes("• The razorbill"));
  const continuationLine = lines.find((line) => line.includes("rocky shore."));
  assert.ok(headwordLine && sentenceLine && continuationLine);
  for (const line of [headwordLine, sentenceLine, continuationLine]) assert.match(line, /\x1b\[33m.*\x1b\[0m/u);
  assert.match(headwordLine, /\x1b\[33m\s+• razorbill\x1b\[0m/u, "bullet marker and text share one semantic yellow span");
  const strippedSentence = stripAnsi(sentenceLine);
  const strippedContinuation = stripAnsi(continuationLine);
  assert.equal(strippedContinuation.indexOf("rocky"), strippedSentence.indexOf("The"), "continuation aligns beneath bullet text");
  assert.doesNotMatch(lines.find((line) => line.includes("Phrase:")) ?? "", /\x1b\[33m/u);
  assert.doesNotMatch(lines.find((line) => line.includes("Answer hidden")) ?? "", /\x1b\[33m/u);
});

test("topic Review alt text follows per-side successful artwork state", () => {
  const exercise = renderTopic(topicItem("en-to-nl", english, dutch));
  const promptFallback = formatEmbeddedReviewExercise(exercise, "prompt", false);
  const promptRendered = formatEmbeddedReviewExercise(exercise, "prompt", false, undefined, undefined, "normal", true);
  const answerFailed = formatEmbeddedReviewReveal(exercise, exercise, false, undefined, undefined, "normal", true, false);
  const answerRendered = formatEmbeddedReviewReveal(exercise, exercise, false, undefined, undefined, "normal", true, true);

  assert.match(promptFallback, /\[Image: Animal illustration\]/u);
  assert.doesNotMatch(promptRendered, /\[Image:/u);
  assert.doesNotMatch(answerFailed, /\[Image: Animal illustration\]/u, "successful prompt artwork remains represented graphically");
  assert.match(answerFailed, /\[Image: Wildlife image\]/u, "failed current-side artwork retains its accessible fallback");
  assert.doesNotMatch(answerRendered, /\[Image:/u);
});

test("one-sided topic artwork uses the ordinary vocabulary presentation", () => {
  const original = topicItem("en-to-vi", english, dutch);
  const draft = {
    ...original,
    id: "vi-handnotes.animals.0001/source-to-vi",
    cardId: "vi-handnotes.animals.0001/source-to-vi",
    reviewDirection: "en-to-vi",
    prompt: {
      text: "![Children's-book animal illustration](media/0001-dog.png)\n\ndog",
      plainText: "[Image: Children's-book animal illustration]\n\ndog",
      language: "en",
      mediaType: "text/markdown"
    },
    answer: {
      text: "chó",
      plainText: "chó",
      language: "vi",
      mediaType: "text/plain"
    },
    acceptedAnswers: ["chó"],
    examples: undefined,
    testedMeaning: "chó",
    pedagogicalFingerprint: "0".repeat(64)
  };
  const item = { ...draft, pedagogicalFingerprint: pedagogicalFingerprint(pedagogicalContentForMemorizationItem(draft)) };
  const exercise = renderMemorizationExercise({
    packageId: "local.user.decks.vietnamese-animals",
    packageVersion: "0.1.0",
    itemId: item.id,
    item
  });

  assert.equal(exercise.topicReview, undefined);
  assert.deepEqual(exercise.promptLines, ["[Image: Children's-book animal illustration]", "dog"]);
  assert.deepEqual(exercise.answerLines, ["chó"]);

  const hidden = formatEmbeddedReviewExercise(exercise, "prompt", false, undefined, undefined, "normal", true);
  const revealed = formatEmbeddedReviewReveal(exercise, exercise, false, undefined, undefined, "normal", true, false);
  assert.match(hidden, /Phrase:\s+dog/u);
  assert.doesNotMatch(hidden, /\[Image:/u);
  assert.match(revealed, /Phrase:\s+dog[\s\S]+Answer:\s+chó/u);
});

test("topic Review session header uses the explicit topic and deck labels", () => {
  const exercise = renderTopic(topicItem("en-to-nl", english, dutch));
  const output = renderEmbeddedReviewSession({
    ...reviewSession(undefined),
    node: { id: "topic-review", label: "1–100", kind: "review-source", packageLabel: "Animals" },
    promptRendered: exercise
  }, false);

  assert.match(output, /^Review: Animals \/ 1–100$/mu);
  assert.doesNotMatch(output, /Review deck|Animals 001–100|Technical Preview/u);
  assert.doesNotMatch(output, new RegExp(escapeRegExp(dutch.headword), "u"));
});

test("artwork manager reports actual show success instead of inferring it from the configured backend", async () => {
  const terminal = { isInteractive: true, colorsEnabled: false, width: 160, height: 40, write() {}, async readKey() {}, enter() {}, restore() {} };
  const pane = "Review\nCard\n[[WHACKSMACKER_REVIEW_ARTWORK_REGION]]\nPhrase\n[[WHACKSMACKER_REVIEW_BOTTOM_BAR]]\nEnter/Space Reveal Answer";
  const artwork = { altText: "Animal illustration", assetPath: "/trusted/prompt.webp", assetData: Buffer.from([1]), mediaType: "image/webp" };

  const success = new EmbeddedReviewArtworkManager(terminal, managerOptions(controller({ ready: true })));
  assert.deepEqual(await success.sync(reviewSession(artwork), pane), { rendered: true });
  await success.shutdown();

  const disabled = new EmbeddedReviewArtworkManager(terminal, managerOptions(controller({ ready: false, reason: "Terminal artwork is disabled." })));
  assert.deepEqual(await disabled.sync(reviewSession(artwork), pane), { rendered: false, notice: "Terminal artwork is disabled." });
  await disabled.shutdown();

  const failed = new EmbeddedReviewArtworkManager(terminal, managerOptions(controller({ ready: true, showFails: true })));
  assert.deepEqual(await failed.sync(reviewSession(artwork), pane), { rendered: false, notice: "Artwork rendering is unavailable for this terminal." });
  await failed.shutdown();

  const resolutionFailed = new EmbeddedReviewArtworkManager(terminal, managerOptions(controller({ ready: true })));
  assert.deepEqual(await resolutionFailed.sync({ ...reviewSession(undefined), artworkResolutionFailed: true }, pane), {
    rendered: false,
    notice: "Artwork rendering is unavailable for this terminal."
  });
  await resolutionFailed.shutdown();
});

test("artwork manager can re-place artwork after the fallback-free terminal frame is redrawn", async () => {
  const calls = [];
  const terminal = { isInteractive: true, colorsEnabled: false, width: 160, height: 40, write() {}, async readKey() {}, enter() {}, restore() {} };
  const pane = "Review\nCard\n[[WHACKSMACKER_REVIEW_ARTWORK_REGION]]\nPhrase\n[[WHACKSMACKER_REVIEW_BOTTOM_BAR]]\nEnter/Space Reveal Answer";
  const manager = new EmbeddedReviewArtworkManager(terminal, managerOptions(controller({ ready: true, calls })));
  const session = reviewSession({ altText: "Animal illustration", assetPath: "/trusted/prompt.png", assetData: Buffer.from([1]), mediaType: "image/png" });

  assert.deepEqual(await manager.sync(session, pane), { rendered: true });
  assert.deepEqual(await manager.redraw(session, pane), { rendered: true });
  assert.equal(calls.filter((entry) => entry[0] === "show").length, 2);
  await manager.shutdown();
});

test("medical artwork fallback is removed without losing adjacent terms on either side", () => {
  const medical = ordinaryExercise(["[Image: Skull and jaw muscles] cranium"], ["Chinese: 頭蓋骨", "Artwork: [Image: Skull and jaw muscles]"], []);
  const before = formatEmbeddedReviewExercise(medical, "prompt", false, undefined, undefined, undefined, true);
  const after = formatEmbeddedReviewReveal(medical, medical, false, undefined, undefined, undefined, true, true);
  assert.match(before, /cranium/u);
  assert.match(after, /cranium/u);
  assert.match(after, /頭蓋骨/u);
  assert.doesNotMatch(before + after, /\[Image:|Artwork:/u);
  const fallback = formatEmbeddedReviewExercise(medical, "prompt", false);
  assert.match(fallback, /\[Image: Skull and jaw muscles\]/u);
});

test("ordinary Reading and Medical embedded Review formatting remains unchanged", () => {
  const ordinary = ordinaryExercise(["hallo"], ["hello"], ["Sophie zegt hallo."]);
  const medical = ordinaryExercise(["abduction"], ["de abductie"], []);

  assert.match(formatEmbeddedReviewReveal(ordinary, ordinary, false), /Phrase:\s+hallo[\s\S]+Answer:\s+hello[\s\S]+Examples:\s+- Sophie zegt hallo\./u);
  assert.match(formatEmbeddedReviewReveal(medical, medical, false), /Phrase:\s+abduction[\s\S]+Answer:\s+de abductie/u);
  assert.doesNotMatch(formatEmbeddedReviewReveal(medical, medical, false), /Examples:/u);
});

function topicItem(direction, prompt, answer) {
  const answerMarkdown = markdown(answer);
  const item = {
    schemaVersion: 2,
    id: `animals.draft.001-100/animals.0096/${direction}`,
    cardId: `animals.draft.001-100/animals.0096/${direction}`,
    pedagogicalFingerprint: "0".repeat(64),
    kind: "vocabulary",
    deck: { id: "com.sleepymario.language.dutch.general.animals.preview-001-100/animals-preview-001-100", title: "Animals 001–100", chapterStart: 1, chapterEnd: 100, scope: "topic" },
    sourceChapters: [],
    sourceUnits: ["animals-001-100"],
    reviewDirection: direction,
    prompt: block(prompt),
    answer: block(answer),
    acceptedAnswers: [answerMarkdown, answer.headword],
    distractors: [],
    explanation: "source-v1",
    testedMeaning: answer.headword,
    testedLexicalIds: ["animals.0096"],
    testedGrammarIds: [],
    testedGeographicIds: [],
    testedCastIds: [],
    testedSkillIds: [],
    provenance: { path: "curriculum/entries.tsv", locator: "animals.0096", evidence: "source-v1" },
    examples: [prompt.sentence, answer.sentence],
    source: { path: "cards.tsv", title: "Animals 001–100" },
    language: { target: "nl", base: "en", script: "Latin" }
  };
  return { ...item, pedagogicalFingerprint: pedagogicalFingerprint(pedagogicalContentForMemorizationItem(item)) };
}

function block(side) {
  return {
    text: markdown(side),
    plainText: `[Image: ${side.alt}]\n\n${side.headword}\n\n${side.sentence}`,
    language: side.language,
    mediaType: "text/markdown"
  };
}

function markdown(side) {
  return `![${side.alt}](media/${side.media})\n\n${side.headword}\n\n${side.sentence}`;
}

function renderTopic(item) {
  return renderMemorizationExercise({ packageId: "com.sleepymario.language.dutch.general.animals.preview-001-100", packageVersion: "0.0.2", itemId: item.id, item });
}

function sectionBullets(output, heading, nextHeading) {
  const start = output.indexOf(heading) + heading.length;
  const end = nextHeading === undefined ? output.length : output.indexOf(nextHeading, start);
  return output.slice(start, end < 0 ? output.length : end).split("\n").map((line) => line.trim()).filter((line) => line.startsWith("• "));
}

function phraseSection(output) {
  return output.slice(output.indexOf("Phrase:"), output.indexOf("Answer:"));
}

function answerSection(output) {
  return output.slice(output.indexOf("Answer:"));
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

function stripAnsi(value) {
  return value.replace(/\x1b\[[0-9;]*m/gu, "");
}

function reviewSession(artwork) {
  return {
    nodeId: "topic-review",
    node: { id: "topic-review", label: "1–100", kind: "review-source", packageLabel: "Animals" },
    items: [{ packageId: "com.example", packageVersion: "1.0.0", itemId: "card-1", firstSeenAt: "2026-08-05T00:00:00Z", nextReviewAt: "2026-08-05T00:00:00Z", reviewCount: 0, intervalDays: 0, easeFactor: 2.5, lapses: 0, suspended: false }],
    index: 0,
    side: "prompt",
    artwork,
    promptRendered: {}
  };
}

function managerOptions(fakeController) {
  return { terminalArtworkBackend: "wayland-overlay", terminalArtworkControllerFactory: async () => fakeController };
}

function controller({ ready, reason, showFails = false, calls = [] }) {
  return {
    selectedBackend: ready ? "wayland-overlay" : "disabled",
    capabilities: { configuredBackend: "wayland-overlay", selectedBackend: ready ? "wayland-overlay" : "disabled", ready, failed: false, reason, helpers: {}, terminalIndicators: [], graphicalSession: "Wayland" },
    async start() { calls.push(["start"]); },
    async show(options) { calls.push(["show", options]); if (showFails) throw new Error("render failed"); },
    async clear() { calls.push(["clear"]); },
    async resize() { calls.push(["resize"]); },
    async shutdown() { calls.push(["shutdown"]); }
  };
}

function ordinaryExercise(promptLines, answerLines, exampleLines) {
  return {
    itemIdentity: { packageId: "com.example", packageVersion: "1.0.0", itemId: "ordinary" },
    kind: "vocabulary",
    title: "Fixture",
    promptLines,
    answerLines,
    hintLines: [],
    noteLines: [],
    exampleLines,
    metadataLines: [],
    warnings: []
  };
}
