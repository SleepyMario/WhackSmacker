import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
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
    languagePackageId: "com.sleepymario.language.dutch",
    directions: ["en-to-nl", "nl-to-en"]
  },
  {
    source: "english-chinese-traditional",
    target: "chinese-traditional-specialized-medical-1",
    packageId: "com.sleepymario.language.chinese-traditional.specialized.medical-1",
    languagePackageId: "com.sleepymario.language.chinese-traditional",
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
    const installedByPackageId = new Map();
    for (const packageId of ["com.sleepymario.language.dutch", ...packages.map((definition) => definition.packageId)]) {
      installedByPackageId.set(packageId, await installContentPackage({ cataloguePath, dataDir, packageId, installedAt: "2026-07-22T00:00:00Z" }));
    }

    const itemIdentitiesBeforeMenu = new Map();
    for (const definition of packages) {
      const installed = installedByPackageId.get(definition.packageId);
      assert.ok(installed);
      const manifest = JSON.parse(await readFile(join(installed.installPath, "manifest.json"), "utf8"));
      assert.deepEqual(manifest.license, {
        spdx: null,
        name: "Whacksmacker Curriculum Content License",
        path: "LICENSE-CONTENT"
      });
      assert.equal(manifest.deckFamily, "specialized");
      assert.deepEqual(manifest.relatedPackageIds, [definition.languagePackageId]);
      assert.deepEqual(
        await readFile(join(installed.installPath, "LICENSE-CONTENT")),
        await readFile(join(sourceRoot, "..", "..", "LICENSE-CONTENT"))
      );
      assert.deepEqual(
        await readFile(join(installed.installPath, "NOTICE")),
        await readFile(join(sourceRoot, "..", "..", "NOTICE"))
      );
      const sourceRows = parseTsv(await readFile(join(sourceRoot, definition.source, "cards.tsv"), "utf8")).slice(1);
      const sourceById = new Map(sourceRows.map((row) => [row[0], row]));
      const items = await listReadingReviewItems({ dataDir, packageId: definition.packageId, packageVersion: "0.1.0" });
      assert.equal(items.length, 712);
      assert.equal(new Set(items.map((entry) => entry.item.cardId)).size, 712);
      assert.deepEqual([...new Set(items.map((entry) => entry.item.reviewDirection))].sort(), definition.directions);
      assert.equal(items.every((entry) => entry.packageId === definition.packageId), true);
      assert.equal(items.every((entry) => entry.packageVersion === "0.1.0"), true);
      assert.equal(items.every((entry) => entry.item.deck.title === "Medical I" && entry.item.deck.scope === "specialized"), true);
      assert.equal(items.every((entry) => entry.item.source.title === "Medical I"), true);
      itemIdentitiesBeforeMenu.set(definition.packageId, items.map(itemIdentity));
      for (const entry of items) {
        const row = sourceById.get(entry.item.cardId);
        assert.ok(row, entry.item.cardId);
        assert.deepEqual(entry.item.acceptedAnswers, JSON.parse(row[7]));
        assert.deepEqual(entry.item.testedLexicalIds, JSON.parse(row[10]));
        assert.deepEqual(entry.item.provenance, { path: row[13], locator: row[14], evidence: row[15] });
        assert.deepEqual(entry.item.tags, JSON.parse(row[17]));
      }
    }

    await removeInstalledFamilyMetadata(dataDir, packages.map((definition) => definition.packageId));

    const tree = await buildLanguageTree(dataDir);
    const dutch = child(tree, "Dutch");
    assert.deepEqual(dutch.children.map((node) => node.label), ["Read content", "Reading Decks", "General Decks", "Specialized Decks", "Package info", "Uninstall"]);
    const dutchSpecialized = child(dutch, "Specialized Decks");
    assert.deepEqual(dutchSpecialized.children.map((node) => node.label), ["Medical I"]);
    const dutchMedicalPackage = child(dutchSpecialized, "Medical I");
    const dutchMedical = child(dutchMedicalPackage, "Review deck");
    assert.equal(dutchMedicalPackage.kind, "package");
    assert.equal(dutchMedicalPackage.packageVersion, "0.1.0");
    assert.equal(dutchMedical.kind, "review-source");
    assert.equal(dutchMedical.packageId, packages[0].packageId);
    assert.equal(dutchMedical.itemCount, 712);
    assert.deepEqual(child(dutch, "General Decks").children.map((node) => node.label), ["No General decks available"]);

    const chinese = child(tree, "Chinese (Traditional)");
    assert.deepEqual(chinese.children.map((node) => node.label), ["Read content", "Reading Decks", "General Decks", "Specialized Decks", "Package info", "Uninstall"]);
    const emptyReading = child(child(chinese, "Read content"), "No ordinary curriculum");
    const emptyReview = child(child(chinese, "Reading Decks"), "No ordinary review decks");
    assert.match(await renderLanguageTreeRightPane(emptyReading, { dataDir }), /No ordinary curriculum is available/u);
    assert.match(await renderLanguageTreeRightPane(emptyReview, { dataDir }), /No ordinary curriculum is available/u);
    const chineseSpecialized = child(chinese, "Specialized Decks");
    assert.deepEqual(chineseSpecialized.children.map((node) => node.label), ["Medical I"]);
    const chineseMedicalPackage = child(chineseSpecialized, "Medical I");
    const chineseMedical = child(chineseMedicalPackage, "Review deck");
    assert.equal(chineseMedicalPackage.kind, "package");
    assert.equal(chineseMedicalPackage.packageVersion, "0.1.0");
    assert.equal(chineseMedical.kind, "review-source");
    assert.equal(chineseMedical.packageId, packages[1].packageId);
    assert.equal(chineseMedical.itemCount, 712);
    assert.deepEqual(child(chinese, "General Decks").children.map((node) => node.label), ["No General decks available"]);

    const allLabels = allNodes(tree).map((node) => node.label);
    assert.equal(allLabels.filter((label) => label === "Specialized").length, 0);
    assert.equal(allLabels.filter((label) => label === "Specialized Decks").length, 2);
    assert.equal(allLabels.filter((label) => label === "Medical I").length, 2);
    assert.equal(allLabels.includes("Dutch Specialized Medical I"), false);
    assert.equal(allLabels.includes("Chinese (Traditional) Specialized Medical I"), false);
    assert.equal(allLabels.filter((label) => label === "Reading Decks").length, 2);
    assert.equal(allLabels.includes("Review decks"), false);
    assert.equal(allLabels.some((label) => /醫學|醫療|醫學詞彙/u.test(label)), false);
    assert.equal(allLabels.includes("English"), false);
    assert.equal(child(dutch, "Reading Decks").children.some((node) => node.label === "Medical I"), false);
    assert.equal(dutch.children.some((node) => node.label === "Specialized"), false);
    assert.equal(chinese.children.some((node) => node.label === "Specialized"), false);
    assert.equal(allNodes(child(dutch, "General Decks")).some((node) => node.packageId === packages[0].packageId), false);
    assert.equal(allNodes(child(chinese, "General Decks")).some((node) => node.packageId === packages[1].packageId), false);
    assert.equal(allNodes(child(dutch, "Reading Decks")).some((node) => node.packageId === packages[0].packageId), false);
    assert.equal(allNodes(child(chinese, "Reading Decks")).some((node) => node.packageId === packages[1].packageId), false);
    assert.equal(allNodes(dutch).some((node) => node.packageId === packages[1].packageId), false);
    assert.equal(allNodes(chinese).some((node) => node.packageId === packages[0].packageId), false);
    assert.deepEqual(
      allNodes(tree)
        .filter((node) => node.kind === "package" && packages.some((definition) => definition.packageId === node.packageId))
        .map((node) => node.packageId)
        .sort(),
      packages.map((definition) => definition.packageId).sort()
    );
    for (const definition of packages) {
      const itemsAfterMenu = await listReadingReviewItems({ dataDir, packageId: definition.packageId, packageVersion: "0.1.0" });
      assert.deepEqual(itemsAfterMenu.map(itemIdentity), itemIdentitiesBeforeMenu.get(definition.packageId));
    }

    await syncReadingReviewItems({ dataDir, packageId: packages[0].packageId, now: "2026-07-22T00:00:00Z" });
    const progressDir = defaultReviewProgressDirectoryForContentDataDirectory(dataDir);
    const before = await loadReviewProgressStore(progressDir);
    assert.equal(before.items.length, 712);
    assert.equal(before.items.every((item) => item.packageId === packages[0].packageId), true);
    const beforeProgressKeys = before.items.map(progressKey).sort();
    const ordinaryRemoval = await removeReadingReviewProgressForPackage({ dataDir, packageId: "com.sleepymario.language.dutch", removedAt: "2026-07-22T00:01:00Z" });
    assert.equal(ordinaryRemoval.removedItemCount, 0);
    const after = await loadReviewProgressStore(progressDir);
    assert.equal(after.items.length, 712);
    assert.deepEqual(after.items.map(progressKey).sort(), beforeProgressKeys);
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

function progressKey(item) {
  return `${item.packageId}\0${item.packageVersion}\0${item.sourcePath ?? ""}\0${item.itemId}`;
}

function itemIdentity(entry) {
  return `${entry.packageId}\0${entry.packageVersion}\0${entry.sourcePath ?? ""}\0${entry.item.id}`;
}

async function removeInstalledFamilyMetadata(dataDir, packageIds) {
  const registryPath = join(dataDir, "registry.json");
  const registry = JSON.parse(await readFile(registryPath, "utf8"));
  registry.packages = registry.packages.map((record) => {
    if (!packageIds.includes(record.packageId)) return record;
    const { deckFamily: _deckFamily, relatedPackageIds: _relatedPackageIds, ...legacyRecord } = record;
    return legacyRecord;
  });
  await writeFile(registryPath, `${JSON.stringify(registry, null, 2)}\n`);
}
