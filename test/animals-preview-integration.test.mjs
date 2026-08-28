import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, resolve, sep } from "node:path";
import { gzipSync } from "node:zlib";
import { test } from "node:test";

import { buildLanguageTree, EmbeddedReviewArtworkManager, renderEmbeddedReviewSession } from "../dist/apps/cli/interactive-menu.js";
import { prepareTerminalArtworkDisplayAsset } from "../dist/apps/cli/terminal-artwork.js";
import {
  generateContentPackage,
  generateLocalContentPackageCatalogue,
  installContentPackage,
  listInstalledContentPackages,
  listReadingReviewItems,
  parseMemorizationMarkdownImages,
  renderReadingReviewItem,
  resolveReadingReviewArtwork
} from "../dist/packages/core/index.js";
import {
  animalsPreviewInputs,
  inspectSafeTarGzip,
  validateAndExtractAnimalsPreviewInputs
} from "../scripts/validate-animals-preview-inputs.mjs";

const targetId = "dutch-general-animals-preview-001-100";
const packageId = "com.sleepymario.language.dutch.general.animals.preview-001-100";
const packageVersion = "0.0.2";
const deckVersion = "0.0.1";
const artifactRevision = 3;
const fixedGeneratedAt = "2026-08-05T00:00:00Z";
const expectedHeader = [
  "card_id", "deck", "kind", "source_chapter", "prompt_language", "answer_language", "prompt",
  "accepted_answers", "distractors", "explanation", "lexical_ids", "grammar_ids", "geographic_ids",
  "provenance_path", "provenance_locator", "provenance_evidence", "examples", "tags"
];
const requiredArrayFields = ["accepted_answers", "distractors", "lexical_ids", "grammar_ids", "geographic_ids", "examples", "tags"];
const inputsAvailable = animalsPreviewInputs.every((input) => existsSync(input.archivePath));
const inputOptions = inputsAvailable ? {} : { skip: "provided animal preview archives are not present on this machine" };

test("animal preview archive inspector rejects traversal, links, devices, and normalized duplicates", () => {
  for (const [name, entries, pattern] of [
    ["absolute", [{ path: "/absolute.txt", type: "0", data: Buffer.from("x") }], /absolute or malformed/u],
    ["traversal", [{ path: "safe/../escape.txt", type: "0", data: Buffer.from("x") }], /parent traversal/u],
    ["symlink", [{ path: "link", type: "2", data: Buffer.alloc(0) }], /symbolic link/u],
    ["hardlink", [{ path: "link", type: "1", data: Buffer.alloc(0) }], /hard link/u],
    ["device", [{ path: "device", type: "3", data: Buffer.alloc(0) }], /character device/u],
    ["duplicate", [{ path: "same", type: "0", data: Buffer.from("1") }, { path: "./same", type: "0", data: Buffer.from("2") }], /duplicate normalized/u]
  ]) {
    assert.throws(() => inspectSafeTarGzip(testTarGzip(entries), name), pattern);
  }
});

test("provided animal archives verify, extract safely, and preserve exact WSM source structure", inputOptions, async () => {
  const root = await mkdtemp(join(tmpdir(), "wsm-animals-preview-source-"));
  try {
    const extracted = join(root, "extracted");
    const summary = await validateAndExtractAnimalsPreviewInputs({ outputDirectory: extracted });
    assert.deepEqual(summary.inputs.map((input) => input.sha256), animalsPreviewInputs.map((input) => input.sha256));

    const unifiedRoot = join(extracted, "animals-001-100-unified-language-agnostic-v1.0.0");
    const wsmRoot = join(extracted, "wsm-animals-en-nl-001-100-draft-v1.0.0");
    const sourceBytes = await readFile(join(wsmRoot, "cards.tsv"));
    assert.equal(sourceBytes.toString("utf8").split("\n").length - 1, 201);
    const [header, ...rows] = parseTsv(sourceBytes.toString("utf8"));
    assert.deepEqual(header, expectedHeader);
    assert.equal(rows.length, 200);
    assert.equal(new Set(rows.map((row) => row[0])).size, 200);
    assert.deepEqual(new Set(rows.map((row) => row[3])), new Set(["animals-001-100"]));

    const directions = new Map();
    const references = new Set();
    for (const [index, row] of rows.entries()) {
      assert.equal(row.length, 18, `row ${index + 2} has 18 columns`);
      directions.set(`${row[4]}->${row[5]}`, (directions.get(`${row[4]}->${row[5]}`) ?? 0) + 1);
      const arrays = new Map(requiredArrayFields.map((field) => {
        const fieldIndex = expectedHeader.indexOf(field);
        const value = JSON.parse(row[fieldIndex]);
        assert.ok(Array.isArray(value) && value.every((entry) => typeof entry === "string"), `${field} row ${index + 2}`);
        return [field, value];
      }));
      const promptMedia = parseMemorizationMarkdownImages(row[6]);
      const answerMedia = arrays.get("accepted_answers").flatMap((answer) => parseMemorizationMarkdownImages(answer));
      assert.equal(promptMedia.length, 1);
      assert.match(promptMedia[0].path, /^media\/animal-\d{4}-illustration\.webp$/u);
      assert.ok(answerMedia.length >= 1);
      for (const media of answerMedia) assert.match(media.path, /^media\/animal-\d{4}-wildlife\.webp$/u);
      for (const media of [...promptMedia, ...answerMedia]) {
        assert.ok(existsSync(join(wsmRoot, media.path)), `referenced media exists: ${media.path}`);
        references.add(media.path);
      }
    }
    assert.deepEqual(Object.fromEntries(directions), { "en->nl": 100, "nl->en": 100 });
    assert.equal(references.size, 200);
    assert.deepEqual(
      (await readdir(join(wsmRoot, "media"))).map((name) => `media/${name}`).sort(),
      [...references].sort(),
      "the supplied WSM source has no missing or unreferenced media"
    );

    for (const mediaPath of [...references].sort()) {
      assert.equal(await sha256File(join(wsmRoot, mediaPath)), await sha256File(join(unifiedRoot, mediaPath)));
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("provided animal preview generates deterministically, installs in isolation, appears only in Dutch General, and drives validated lazy artwork", inputOptions, async () => {
  const root = await mkdtemp(join(tmpdir(), "wsm-animals-preview-integration-"));
  try {
    const extracted = join(root, "extracted");
    const packagesA = join(root, "packages-a");
    const packagesB = join(root, "packages-b");
    const dataDir = join(root, "isolated-data");
    await validateAndExtractAnimalsPreviewInputs({ outputDirectory: extracted });
    const wsmRoot = join(extracted, "wsm-animals-en-nl-001-100-draft-v1.0.0");
    const sourceText = (await readFile(join(wsmRoot, "cards.tsv"))).toString("utf8");
    const sourceRows = parseTsv(sourceText).slice(1);
    const sourceCardIds = sourceRows.map((row) => row[0]);

    const first = await generateContentPackage({ targetId, outputDirectory: packagesA, generatedAt: fixedGeneratedAt, sourceRoot: extracted });
    const second = await generateContentPackage({ targetId, outputDirectory: packagesB, generatedAt: fixedGeneratedAt, sourceRoot: extracted });
    assert.equal(first.packageId, packageId);
    assert.equal(first.packageVersion, packageVersion);
    assert.equal(first.manifest.packageId, packageId);
    assert.equal(first.manifest.packageVersion, packageVersion);
    assert.equal(first.manifest.deckVersion, deckVersion);
    assert.equal(first.manifest.artifactRevision, artifactRevision);
    assert.equal(first.manifest.mediaPolicy, "required");
    assert.equal(first.manifest.displayName, "1–100");
    assert.equal(first.manifest.contentType, "topic-review");
    assert.deepEqual(first.manifest.capabilities, ["topic-review"]);
    assert.equal(first.manifest.deckFamily, "general");
    assert.deepEqual(first.manifest.topic, { id: "animals", displayName: "Animals", deckDisplayName: "1–100" });
    assert.deepEqual(first.manifest.relatedPackageIds, ["com.sleepymario.language.dutch"]);
    assert.deepEqual(first.manifest.languages, ["en", "nl"]);
    assert.deepEqual(await readFile(first.filePath), await readFile(second.filePath));
    assert.equal(first.archiveSha256, second.archiveSha256);

    const archive = await readStoredZip(first.filePath);
    const manifest = JSON.parse(archive.get("manifest.json").toString("utf8"));
    const snapshot = JSON.parse(archive.get("content/content.json").toString("utf8"));
    const collection = JSON.parse(archive.get("content/memorization/animals-preview-001-100.json").toString("utf8"));
    assert.equal(snapshot.files.find((file) => file.path === "cards.tsv").text, sourceText);
    assert.equal(
      snapshot.files.find((file) => file.path === "README.md").text,
      (await readFile(join(wsmRoot, "README.md"))).toString("utf8")
    );
    assert.equal(collection.schemaVersion, 2);
    assert.equal(collection.items.length, 200);
    assert.deepEqual(collection.items.map((item) => item.cardId), sourceCardIds);
    assert.ok(collection.items.every((item) => item.id === item.cardId && item.deck.scope === "topic"));
    assert.ok(collection.items.every((item) => item.sourceChapters.length === 0 && item.sourceUnits[0] === "animals-001-100"));
    assert.ok(collection.items.every((item) => item.deck.id === `${packageId}/animals-preview-001-100`));
    assert.ok(collection.items.every((item) => item.deck.title === "1–100" && item.source.title === "1–100"));
    for (const [entry, expected] of [
      ["0089", { en: "crane", enSentence: "The crane walks through the marsh.", nl: "de kraanvogel", nlSentence: "De kraanvogel loopt door het moeras." }],
      ["0092", { en: "frigatebird", enSentence: "The frigatebird rides the warm air above the sea.", nl: "de fregatvogel", nlSentence: "De fregatvogel zweeft op de warme lucht boven zee." }]
    ]) {
      const cards = collection.items.filter((item) => item.cardId.includes(`/animals.${entry}/`));
      assert.equal(cards.length, 2, `entry ${entry} retains both directions`);
      const rendered = cards.map((item) => renderReadingReviewItemFromGenerated(item));
      assert.ok(rendered.some((text) => text.includes(expected.en) && text.includes(expected.enSentence)));
      assert.ok(rendered.some((text) => text.includes(expected.nl) && text.includes(expected.nlSentence)));
    }
    const razorbillSource = sourceRows.find((row) => row[0] === "animals.draft.001-100/animals.0096/en-to-nl");
    const razorbill = collection.items.find((item) => item.cardId === razorbillSource?.[0]);
    assert.ok(razorbillSource && razorbill);
    assert.deepEqual(razorbill.acceptedAnswers, JSON.parse(razorbillSource[7]), "stored accepted answers remain the exact parsed source field");
    assert.deepEqual(razorbill.examples, JSON.parse(razorbillSource[16]), "stored examples remain unchanged");
    assert.equal(razorbill.answer.text, "![Wildlife image](media/animal-0096-wildlife.webp)\n\nde alk\n\nDe alk zwemt dicht bij de rotsachtige kust.");

    const mediaRecords = manifest.files.filter((file) => file.path.startsWith("media/"));
    assert.equal(mediaRecords.length, 200);
    assert.deepEqual(mediaRecords.map((record) => record.path), [...mediaRecords.map((record) => record.path)].sort());
    for (const record of mediaRecords) {
      const source = await readFile(join(wsmRoot, record.path));
      assert.equal(record.mediaType, "image/webp");
      assert.equal(record.size, source.length);
      assert.equal(record.sha256, sha256(source));
      assert.deepEqual(archive.get(record.path), source);
    }
    assert.equal([...archive.keys()].filter((path) => path.startsWith("media/")).length, 200);

    const displayOptions = async (name) => {
      const assetPath = join(wsmRoot, "media", name);
      return {
        identifier: "fixture", assetPath, assetData: await readFile(assetPath), mediaType: "image/webp",
        altText: "fixture", rectangle: { column: 1, row: 1, widthColumns: 40, heightRows: 12 }, fit: "contain"
      };
    };
    const rhinocerosPath = join(wsmRoot, "media", "animal-0034-illustration.webp");
    const rhinocerosHash = await sha256File(rhinocerosPath);
    const trimmed = await prepareTerminalArtworkDisplayAsset(await displayOptions("animal-0034-illustration.webp"), "/usr/bin/magick", join(root, "rhinoceros-display.png"));
    assert.notEqual(trimmed.assetPath, rhinocerosPath, "real affected rhinoceros matte is safely prepared as a derived display file");
    assert.equal(trimmed.mediaType, "image/png");
    assert.equal(await sha256File(rhinocerosPath), rhinocerosHash, "display preparation leaves source bytes unchanged");
    for (const name of ["animal-0003-illustration.webp", "animal-0064-illustration.webp", "animal-0089-illustration.webp", "animal-0059-wildlife.webp"]) {
      const options = await displayOptions(name);
      const unchanged = await prepareTerminalArtworkDisplayAsset(options, "/usr/bin/magick", join(root, `${name}.png`));
      assert.equal(unchanged.assetPath, options.assetPath, `${name} remains unchanged when matte confidence/size is insufficient`);
    }

    await generateContentPackage({ targetId: "dutch-curriculum", outputDirectory: packagesA, generatedAt: fixedGeneratedAt });
    const cataloguePath = join(root, "catalogue.json");
    const catalogue = await generateLocalContentPackageCatalogue({ packagesDirectory: packagesA, outputPath: cataloguePath, generatedAt: fixedGeneratedAt });
    const previewEntry = catalogue.catalogue.packages.find((entry) => entry.packageId === packageId);
    assert.equal(previewEntry.deckFamily, "general");
    assert.deepEqual(previewEntry.topic, first.manifest.topic);
    assert.deepEqual(previewEntry.relatedPackageIds, ["com.sleepymario.language.dutch"]);
    assert.deepEqual(previewEntry.languages, ["en", "nl"]);

    await installContentPackage({ cataloguePath, dataDir, packageId: "com.sleepymario.language.dutch", installedAt: fixedGeneratedAt });
    await installContentPackage({ cataloguePath, dataDir, packageId, installedAt: fixedGeneratedAt });
    const installed = await listInstalledContentPackages(dataDir);
    assert.deepEqual(installed.map((record) => record.packageId), ["com.sleepymario.language.dutch", packageId]);
    assert.equal(installed.find((record) => record.packageId === packageId).deckFamily, "general");
    assert.deepEqual(installed.find((record) => record.packageId === packageId).topic, first.manifest.topic);

    const tree = await buildLanguageTree(dataDir);
    const dutch = tree.children.find((node) => node.packageId === "com.sleepymario.language.dutch");
    assert.ok(dutch);
    const general = dutch.children.find((node) => node.label === "General Decks");
    const specialized = dutch.children.find((node) => node.label === "Specialized Decks");
    const reading = dutch.children.find((node) => node.label === "Reading Decks");
    assert.deepEqual(general.children.map((node) => [node.label, node.kind]), [["Animals", "category"]]);
    const animals = general.children[0];
    assert.deepEqual(animals.children.map((node) => [node.label, node.kind, node.packageId]), [["1–100", "review-source", packageId]]);
    const leaf = animals.children[0];
    assert.equal(leaf.packageLabel, "Animals");
    assert.doesNotMatch(JSON.stringify(general), /Review deck|Animals I|Animals 001–100|Technical Preview/u);
    assert.equal(hasPackage(specialized, packageId), false);
    assert.equal(hasPackage(reading, packageId), false);
    assert.equal(tree.children.some((node) => node.packageId === packageId), false);
    for (const language of tree.children.filter((node) => node !== dutch)) assert.equal(hasPackage(language, packageId), false);

    const reviewItems = await listReadingReviewItems({ dataDir, packageId, packageVersion });
    assert.equal(reviewItems.length, 200);
    assert.deepEqual(reviewItems.map((item) => item.item.cardId), sourceCardIds);
    const englishCardIds = sourceRows.filter((row) => row[4] === "en").map((row) => row[0]);
    const firstCard = reviewItems.find((item) => item.item.cardId === englishCardIds[0]);
    const nextCard = reviewItems.find((item) => item.item.cardId === englishCardIds[1]);
    assert.ok(firstCard && nextCard);
    const learnerText = (await renderReadingReviewItem({
      dataDir,
      packageId,
      packageVersion,
      itemId: razorbill.cardId,
      answer: true
    })).text;
    assert.match(learnerText, /^1–100\n/u);
    assert.doesNotMatch(learnerText, /Technical Preview|Examples:|\\n|!\[/u);

    const calls = [];
    const controller = fakeController(calls);
    const terminal = { isInteractive: true, colorsEnabled: false, width: 160, height: 40, write() {}, async readKey() {}, enter() {}, restore() {} };
    const manager = new EmbeddedReviewArtworkManager(terminal, { terminalArtworkBackend: "wayland-overlay", terminalArtworkControllerFactory: async () => controller });
    const promptArtwork = await resolveReadingReviewArtwork(firstCard, "prompt", { dataDir });
    assert.match(basename(promptArtwork.assetPath), /^animal-0001-illustration\.webp$/u);
    assert.equal(promptArtwork.mediaType, "image/webp");
    assert.equal(Buffer.from(promptArtwork.assetData).subarray(0, 4).toString("ascii"), "RIFF");
    assert.equal(calls.some((call) => call[0] === "show"), false, "controller is untouched before validated prompt resolution is synchronized");
    const pane = "Review\nCard\n[[WHACKSMACKER_REVIEW_ARTWORK_REGION]]\nPhrase\n[[WHACKSMACKER_REVIEW_BOTTOM_BAR]]\nEnter/Space Reveal Answer";
    assert.deepEqual(await manager.sync(reviewSession(firstCard, "prompt", promptArtwork), pane), { rendered: true });
    assert.deepEqual(calls.filter((call) => call[0] === "show").map((call) => call[1].assetPath), [promptArtwork.assetPath]);

    const answerArtwork = await resolveReadingReviewArtwork(firstCard, "answer", { dataDir });
    assert.match(basename(answerArtwork.assetPath), /^animal-0001-wildlife\.webp$/u);
    assert.deepEqual(await manager.sync(reviewSession(firstCard, "answer", answerArtwork), pane), { rendered: true });
    const nextArtwork = await resolveReadingReviewArtwork(nextCard, "prompt", { dataDir });
    assert.deepEqual(await manager.sync(reviewSession(nextCard, "prompt", nextArtwork), pane), { rendered: true });
    const shownPaths = calls.filter((call) => call[0] === "show").map((call) => call[1].assetPath);
    assert.deepEqual(shownPaths, [promptArtwork.assetPath, answerArtwork.assetPath, nextArtwork.assetPath]);
    assert.ok(shownPaths.every((path) => path.startsWith(`${resolve(dataDir, "packages", packageId, `deck-${deckVersion}`, `revision-${artifactRevision}`)}${sep}`)));
    assert.ok(calls.filter((call) => call[0] === "clear").length >= 3, "reveal and navigation clear prior artwork");
    await manager.shutdown();
    assert.equal(calls.at(-1)[0], "shutdown");

    const header = renderEmbeddedReviewSession({
      ...reviewSession(firstCard, "prompt", promptArtwork),
      node: leaf,
      promptRendered: (await renderReadingReviewItem({ dataDir, packageId, packageVersion, itemId: firstCard.item.id })).rendered
    }, false);
    assert.match(header, /^Review: Animals \/ 1–100$/mu);

    const showsBeforeCorruption = calls.filter((call) => call[0] === "show").length;
    await assert.rejects(() => writeFile(promptArtwork.assetPath, Buffer.from("corrupt disposable installed copy")), /EACCES|permission denied/u);
    assert.equal(calls.filter((call) => call[0] === "show").length, showsBeforeCorruption);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

function hasPackage(node, searchedPackageId) {
  if (!node) return false;
  if (node.packageId === searchedPackageId) return true;
  return (node.children ?? []).some((child) => hasPackage(child, searchedPackageId));
}

function reviewSession(reviewItem, side, artwork) {
  return {
    nodeId: "animals-preview-review",
    node: { id: "animals-preview-review", label: "1–100", kind: "review-source", packageLabel: "Animals" },
    items: [{ packageId: reviewItem.packageId, packageVersion: reviewItem.packageVersion, itemId: reviewItem.item.id, firstSeenAt: fixedGeneratedAt, nextReviewAt: fixedGeneratedAt, reviewCount: 0, intervalDays: 0, easeFactor: 2.5, lapses: 0, suspended: false }],
    index: 0,
    side,
    artwork,
    promptRendered: {},
    ...(side === "answer" ? { answerRendered: {} } : {})
  };
}

function renderReadingReviewItemFromGenerated(item) {
  const sideText = (block) => String(block.text).replace(/^!\[[^\]]*\]\([^)]*\)\s*/u, "").trim();
  return `${sideText(item.prompt)}\n${sideText(item.answer)}`;
}

function fakeController(calls) {
  const capabilities = { configuredBackend: "wayland-overlay", selectedBackend: "wayland-overlay", ready: true, failed: false, helpers: { ueberzugpp: true }, terminalIndicators: [], graphicalSession: "Wayland" };
  return {
    selectedBackend: "wayland-overlay",
    capabilities,
    async start() { calls.push(["start"]); },
    async show(options) { calls.push(["show", options]); },
    async clear(identifier) { calls.push(["clear", identifier]); },
    async resize() { calls.push(["resize"]); },
    async shutdown() { calls.push(["shutdown"]); }
  };
}

function parseTsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  const normalized = text.replace(/\r\n?/gu, "\n");
  for (let index = 0; index < normalized.length; index += 1) {
    const character = normalized[index];
    if (quoted) {
      if (character === '"' && normalized[index + 1] === '"') { field += '"'; index += 1; }
      else if (character === '"') quoted = false;
      else field += character;
    } else if (character === '"' && field.length === 0) quoted = true;
    else if (character === "\t") { row.push(field); field = ""; }
    else if (character === "\n") { row.push(field); if (row.some((value) => value.length > 0)) rows.push(row); row = []; field = ""; }
    else field += character;
  }
  assert.equal(quoted, false);
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  return rows;
}

async function readStoredZip(filePath) {
  const buffer = await readFile(filePath);
  const entries = new Map();
  let offset = 0;
  while (offset + 30 <= buffer.length && buffer.readUInt32LE(offset) === 0x04034b50) {
    assert.equal(buffer.readUInt16LE(offset + 8), 0);
    const size = buffer.readUInt32LE(offset + 18);
    const nameLength = buffer.readUInt16LE(offset + 26);
    const extraLength = buffer.readUInt16LE(offset + 28);
    const nameStart = offset + 30;
    const dataStart = nameStart + nameLength + extraLength;
    const name = buffer.subarray(nameStart, nameStart + nameLength).toString("utf8");
    entries.set(name, buffer.subarray(dataStart, dataStart + size));
    offset = dataStart + size;
  }
  return entries;
}

function testTarGzip(entries) {
  const blocks = [];
  for (const entry of entries) {
    const data = entry.data ?? Buffer.alloc(0);
    const header = Buffer.alloc(512);
    header.write(entry.path, 0, 100, "utf8");
    writeTarOctal(header, 0o644, 100, 8);
    writeTarOctal(header, 0, 108, 8);
    writeTarOctal(header, 0, 116, 8);
    writeTarOctal(header, entry.type === "5" ? 0 : data.length, 124, 12);
    writeTarOctal(header, 0, 136, 12);
    header.fill(32, 148, 156);
    header[156] = (entry.type ?? "0").charCodeAt(0);
    header.write("ustar\0", 257, 6, "ascii");
    header.write("00", 263, 2, "ascii");
    let checksum = 0;
    for (const byte of header) checksum += byte;
    const checksumText = checksum.toString(8).padStart(6, "0");
    header.write(checksumText, 148, 6, "ascii");
    header[154] = 0;
    header[155] = 32;
    blocks.push(header, data, Buffer.alloc((512 - (data.length % 512)) % 512));
  }
  blocks.push(Buffer.alloc(1024));
  return gzipSync(Buffer.concat(blocks));
}

function writeTarOctal(buffer, value, offset, length) {
  const text = value.toString(8).padStart(length - 1, "0");
  buffer.write(text, offset, length - 1, "ascii");
  buffer[offset + length - 1] = 0;
}

async function sha256File(path) {
  return sha256(await readFile(path));
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}
