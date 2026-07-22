import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { buildLanguageTree, renderLanguageTreeRightPane } from "../dist/apps/cli/interactive-menu.js";
import {
  generateContentPackage,
  generateLocalContentPackageCatalogue,
  defaultReviewProgressDirectoryForContentDataDirectory,
  installContentPackage,
  listReadingReviewItems,
  loadReviewProgressStore,
  removeReadingReviewProgressForPackage,
  syncReadingReviewItems
} from "../dist/packages/core/index.js";

const sourceRoot = join(process.cwd(), "..", "language-curriculum-specialized", "specialized-content", "medical");
const exactHeader = [
  "card_id", "deck", "kind", "source_chapter", "prompt_language", "answer_language", "prompt", "accepted_answers",
  "distractors", "explanation", "lexical_ids", "grammar_ids", "geographic_ids", "provenance_path", "provenance_locator",
  "provenance_evidence", "examples", "tags"
];
const packages = [
  {
    source: "dutch-english",
    target: "dutch-specialized-medical-1",
    packageId: "com.sleepymario.language.dutch.specialized.medical-1",
    directions: ["en-to-nl", "nl-to-en"]
  },
  {
    source: "english-chinese-traditional",
    target: "chinese-traditional-specialized-medical-1",
    packageId: "com.sleepymario.language.chinese-traditional.specialized.medical-1",
    directions: ["en-to-zh-Hant", "zh-Hant-to-en"]
  }
];

test("supplied specialized medical TSVs preserve the exact v2 contract and paired identities", async () => {
  for (const definition of packages) {
    const rows = parseTsv(await readFile(join(sourceRoot, definition.source, "cards.tsv"), "utf8"));
    assert.deepEqual(rows[0], exactHeader);
    const body = rows.slice(1);
    assert.equal(body.length, 712);
    assert.equal(body.every((row) => row.length === 18), true);
    assert.equal(body.every((row) => row.every((field) => field === field.normalize("NFC"))), true);
    assert.equal(new Set(body.map((row) => row[0])).size, body.length);
    for (const row of body) {
      for (const index of [7, 8, 10, 11, 12, 16, 17]) assert.ok(Array.isArray(JSON.parse(row[index])));
      assert.equal(row[2], "vocabulary");
      assert.equal(row[16], "[]");
    }
    const directionsByConcept = new Map();
    for (const row of body) {
      const [concept, direction] = splitCardId(row[0]);
      directionsByConcept.set(concept, new Set([...(directionsByConcept.get(concept) ?? []), direction]));
    }
    assert.equal(directionsByConcept.size, 356);
    assert.equal([...directionsByConcept.values()].every((directions) =>
      directions.size === 2 && directions.has("target-to-source") && directions.has("source-to-target")), true);
  }
});

test("specialized packages load beneath Dutch and empty Traditional Chinese without entering ordinary Review", async () => {
  const root = await mkdtemp(join(tmpdir(), "wsm-specialized-medical-"));
  const packageDirectory = join(root, "packages");
  const cataloguePath = join(root, "catalogue.json");
  const dataDir = join(root, "data");
  try {
    for (const targetId of ["dutch-curriculum", ...packages.map((definition) => definition.target)]) {
      await generateContentPackage({ targetId, outputDirectory: packageDirectory, generatedAt: "2026-07-22T00:00:00Z" });
    }
    await generateLocalContentPackageCatalogue({ packagesDirectory: packageDirectory, outputPath: cataloguePath, generatedAt: "2026-07-22T00:00:00Z" });
    for (const packageId of ["com.sleepymario.language.dutch", ...packages.map((definition) => definition.packageId)]) {
      await installContentPackage({ cataloguePath, dataDir, packageId, installedAt: "2026-07-22T00:00:00Z" });
    }

    for (const definition of packages) {
      const sourceRows = parseTsv(await readFile(join(sourceRoot, definition.source, "cards.tsv"), "utf8")).slice(1);
      const sourceById = new Map(sourceRows.map((row) => [row[0], row]));
      const items = await listReadingReviewItems({ dataDir, packageId: definition.packageId, packageVersion: "0.1.0" });
      assert.equal(items.length, 712);
      assert.equal(new Set(items.map((entry) => entry.item.cardId)).size, 712);
      assert.deepEqual([...new Set(items.map((entry) => entry.item.reviewDirection))].sort(), definition.directions);
      assert.equal(items.every((entry) => entry.packageId === definition.packageId), true);
      assert.equal(items.every((entry) => entry.item.deck.title === "Medical I" && entry.item.deck.scope === "specialized"), true);
      assert.equal(items.every((entry) => entry.item.source.title === "Medical I"), true);
      for (const entry of items) {
        const row = sourceById.get(entry.item.cardId);
        assert.ok(row, entry.item.cardId);
        assert.deepEqual(entry.item.acceptedAnswers, JSON.parse(row[7]));
        assert.deepEqual(entry.item.testedLexicalIds, JSON.parse(row[10]));
        assert.deepEqual(entry.item.provenance, { path: row[13], locator: row[14], evidence: row[15] });
        assert.deepEqual(entry.item.tags, JSON.parse(row[17]));
      }
    }

    const tree = await buildLanguageTree(dataDir);
    const dutch = child(tree, "Dutch");
    assert.deepEqual(dutch.children.map((node) => node.label), ["Read content", "Review decks", "Specialized", "Package info", "Uninstall"]);
    const dutchSpecialized = child(dutch, "Specialized");
    const dutchMedical = child(dutchSpecialized, "Medical I");
    assert.equal(dutchMedical.kind, "review-source");
    assert.equal(dutchMedical.packageId, packages[0].packageId);
    assert.equal(dutchMedical.itemCount, 712);

    const chinese = child(tree, "Chinese (Traditional)");
    assert.deepEqual(chinese.children.map((node) => node.label), ["Read content", "Review decks", "Specialized", "Package info", "Uninstall"]);
    const emptyReading = child(child(chinese, "Read content"), "No ordinary curriculum");
    const emptyReview = child(child(chinese, "Review decks"), "No ordinary review decks");
    assert.match(await renderLanguageTreeRightPane(emptyReading, { dataDir }), /No ordinary curriculum is available/u);
    assert.match(await renderLanguageTreeRightPane(emptyReview, { dataDir }), /No ordinary curriculum is available/u);
    const chineseMedical = child(child(chinese, "Specialized"), "Medical I");
    assert.equal(chineseMedical.kind, "review-source");
    assert.equal(chineseMedical.packageId, packages[1].packageId);
    assert.equal(chineseMedical.itemCount, 712);

    const allLabels = allNodes(tree).map((node) => node.label);
    assert.equal(allLabels.filter((label) => label === "Specialized").length, 2);
    assert.equal(allLabels.filter((label) => label === "Medical I").length, 2);
    assert.equal(allLabels.some((label) => /醫學|醫療|醫學詞彙/u.test(label)), false);
    assert.equal(allLabels.includes("English"), false);
    assert.equal(child(dutch, "Review decks").children.some((node) => node.label === "Medical I"), false);

    await syncReadingReviewItems({ dataDir, packageId: packages[0].packageId, now: "2026-07-22T00:00:00Z" });
    const progressDir = defaultReviewProgressDirectoryForContentDataDirectory(dataDir);
    const before = await loadReviewProgressStore(progressDir);
    assert.equal(before.items.length, 712);
    assert.equal(before.items.every((item) => item.packageId === packages[0].packageId), true);
    const ordinaryRemoval = await removeReadingReviewProgressForPackage({ dataDir, packageId: "com.sleepymario.language.dutch", removedAt: "2026-07-22T00:01:00Z" });
    assert.equal(ordinaryRemoval.removedItemCount, 0);
    const after = await loadReviewProgressStore(progressDir);
    assert.equal(after.items.length, 712);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

function parseTsv(text) {
  return text.trimEnd().split(/\r?\n/u).map((line) => line.split("\t"));
}

function splitCardId(cardId) {
  const slash = cardId.lastIndexOf("/");
  return [cardId.slice(0, slash), cardId.slice(slash + 1)];
}

function child(node, label) {
  const found = node.children?.find((candidate) => candidate.label === label);
  assert.ok(found, `${node.label} contains ${label}`);
  return found;
}

function allNodes(node) {
  return [node, ...(node.children ?? []).flatMap(allNodes)];
}
