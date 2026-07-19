import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { generateContentPackage, generateLocalContentPackageCatalogue, installContentPackage } from "../dist/packages/core/index.js";
import { buildLanguageTree, renderLanguageTreeRightPane, renderTwoPaneLanguageTree } from "../dist/apps/cli/interactive-menu.js";

const expected = new Map([[16, "Narrative"], [17, "Dialogue"], [18, "Narrative"], [19, "Dialogue"], [20, "Narrative"]]);

const directories = new Map([
  [16, "chapter-016-working-at-the-library"],
  [17, "chapter-017-making-a-plan"],
  [18, "chapter-018-a-quiet-evening"],
  [19, "chapter-019-asking-for-help"],
  [20, "chapter-020-an-appointment-in-town"]
]);

const narrativeLineCounts = new Map([[16, 8], [18, 10], [20, 10]]);
const dialogueTurnCounts = new Map([[17, 9], [19, 9]]);

test("installed Dutch Chapters 16–20 provide authored modes, translation, breakdown, structure, and semantic output", async () => {
  const fixture = await installedDutch();
  try {
    const tree = await buildLanguageTree(fixture.dataDir, "developer");
    const dutch = tree.children.find((node) => node.label === "Dutch");
    const read = dutch.children.find((node) => node.label === "Read content");
    for (const [number, readingType] of expected) {
      const padded = String(number).padStart(3, "0");
      const chapter = read.children.find((node) => node.filePath?.includes(`chapter-${padded}-`) && !node.filePath.includes("grammar"));
      assert.ok(chapter, `Chapter ${number} is installed`);
      assert.ok(chapter.translationPath, `Chapter ${number} has an authored translation`);
      assert.ok(chapter.readingSupportPath, `Chapter ${number} has authored reading support`);
      const variants = [];
      for (const mode of ["normal", "expert", "developer"]) {
        const plain = await renderLanguageTreeRightPane(chapter, { dataDir: fixture.dataDir, displayMode: mode });
        const translated = await renderLanguageTreeRightPane(chapter, { dataDir: fixture.dataDir, displayMode: mode, translationsEnabled: true });
        const brokenDown = await renderLanguageTreeRightPane(chapter, { dataDir: fixture.dataDir, displayMode: mode, breakdownEnabled: true });
        const both = await renderLanguageTreeRightPane(chapter, { dataDir: fixture.dataDir, displayMode: mode, translationsEnabled: true, breakdownEnabled: true });
        variants.push(plain);
        assert.match(plain, new RegExp(`^### ${readingType}$`, "mu"));
        assert.doesNotMatch(plain, /^(?:#{1,6}\s+)?(?:Content|Complete Rereading|Canonical Identity)\s*$/imu);
        assert.doesNotMatch(plain, /DUT-GRAMMAR-/u);
        assert.doesNotMatch(plain, /^### Natural English Translation$/mu);
        assert.doesNotMatch(plain, /^### Line-by-line Breakdown/mu);
        assert.match(translated, /^### Natural English Translation$/mu);
        assert.doesNotMatch(sectionBody(translated, "Natural English Translation"), /Translation unavailable for this chapter\./u);
        assert.match(brokenDown, /^### Line-by-line Breakdown/mu);
        assert.doesNotMatch(brokenDown, /Breakdown unavailable for this chapter\./u);
        assert.match(both, /^### Natural English Translation$/mu);
        assert.match(both, /^### Line-by-line Breakdown/mu);
        assertHeadingSpacing(both);

        if (mode === "developer") {
          assert.match(sectionBody(plain, "Brief Introduction: Normal"), /^This chapter (?:teaches|introduces)/u);
          assert.match(sectionBody(plain, "Brief Introduction: Expert"), /^This chapter (?:teaches|introduces)/u);
        } else {
          assert.match(sectionBody(plain, "Brief Introduction"), /^This chapter (?:teaches|introduces)/u);
        }
        const readingBlocks = sectionBody(plain, readingType).split(/\n\s*\n/u).filter(Boolean);
        assert.ok(readingBlocks.length >= 2, `Chapter ${number} has a separate scene introduction and reading body`);
        const sceneIntroduction = readingBlocks[0];
        assert.doesNotMatch(sceneIntroduction, /^This chapter (?:teaches|introduces)/u);
        const translationBody = sectionBody(translated, "Natural English Translation");
        assert.doesNotMatch(translationBody, new RegExp(escapeRegExp(sceneIntroduction), "u"));
        assert.doesNotMatch(translationBody, /This chapter (?:teaches|introduces)/u);

        const ansi = renderTwoPaneLanguageTree(tree, new Set(), 0, both, true, 0, 500, "en-US", "navigation", 280, 0, mode, true, true);
        assert.match(ansi, /\x1b\[34m[^\x1b]+\x1b\[0m/u, `Chapter ${number} ${mode} has grammar/breakdown blue`);
        assert.match(ansi, /\x1b\[38;5;213m[^\x1b]+\x1b\[0m/u, `Chapter ${number} ${mode} has primary pink`);
        if (readingType === "Dialogue") assert.match(ansi, /\x1b\[38;5;141m[^:\n]+:\x1b\[0m/u, `Chapter ${number} ${mode} has purple speaker label`);
        const noColor = renderTwoPaneLanguageTree(tree, new Set(), 0, both, false, 0, 500, "en-US", "navigation", 280, 0, mode, true, true);
        assert.doesNotMatch(noColor, /\x1b\[/u);
        assert.equal(noColor, stripAnsi(ansi));
      }
      assert.notEqual(variants[0], variants[1], `Chapter ${number} Normal and Expert differ`);
    }
  } finally {
    await fixture.cleanup();
  }
});

test("Dutch Chapters 16–20 translations contain only translated reading content", async () => {
  for (const [number, directory] of directories) {
    const root = join(process.cwd(), "..", "dutch-curriculum", "units", "dutch-core", directory);
    const markdown = await readFile(join(root, "chapter.md"), "utf8");
    const translation = JSON.parse(await readFile(join(root, "reading-translation.en.json"), "utf8"));
    for (const key of ["introduction", "context", "setting", "participants", "sceneIntroduction"]) {
      assert.equal(Object.hasOwn(translation, key), false, `Chapter ${number} has no ${key} preface`);
    }

    const sourceHeading = translation.sourceSection;
    const blocks = sectionBody(markdown, sourceHeading).split(/\n\s*\n/u).filter(Boolean);
    assert.ok(blocks.length >= 2, `Chapter ${number} source has scene introduction plus reading body`);
    const sceneIntroduction = blocks[0];
    assert.equal(JSON.stringify(translation).includes(sceneIntroduction), false, `Chapter ${number} translation omits scene introduction`);

    if (translation.readingType === "narrative") {
      const body = blocks.slice(1).join("\n").split(/\r?\n/u).filter((line) => line.trim().length > 0);
      assert.equal(body.length, narrativeLineCounts.get(number));
      assert.equal(body.every((line) => /[.!?]$/u.test(line)), true);
      assert.equal(translation.paragraphs.length, body.length, `Chapter ${number} translation line count`);
      assert.equal(translation.paragraphs.every((line) => /[.!?]$/u.test(line)), true);
    } else {
      const sourceTurns = blocks.slice(1).join("\n").split(/\r?\n/u).filter((line) => /^\s*[^:\n]+:\s*\S/u.test(line));
      assert.equal(sourceTurns.length, dialogueTurnCounts.get(number));
      assert.equal(translation.turns.length, sourceTurns.length, `Chapter ${number} translation turn count`);
      assert.deepEqual(translation.turns.map((turn) => turn.speaker), sourceTurns.map((line) => /^\s*([^:\n]+?)\s*:/u.exec(line)?.[1].trim()));
    }
  }
});

function assertHeadingSpacing(markdown) {
  const lines = markdown.split("\n");
  for (const [index, line] of lines.entries()) {
    if (!/^#{1,6}\s+/u.test(line)) continue;
    assert.equal(lines[index - 1] ?? "", "", `heading has one blank line above: ${line}`);
    assert.equal(lines[index + 1] ?? "", "", `heading has one blank line below: ${line}`);
    assert.notEqual(lines[index - 2] ?? "not-blank", "", `heading has no doubled blank above: ${line}`);
    assert.notEqual(lines[index + 2] ?? "not-blank", "", `heading has no doubled blank below: ${line}`);
  }
}

function sectionBody(markdown, heading) {
  const lines = markdown.split(/\r?\n/u);
  const start = lines.indexOf(`### ${heading}`);
  const end = lines.findIndex((line, index) => index > start && /^###\s/u.test(line));
  return lines.slice(start + 1, end < 0 ? lines.length : end).join("\n").trim();
}

function escapeRegExp(value) { return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"); }

async function installedDutch() {
  const root = await mkdtemp(join(tmpdir(), "wsm-dutch-016-020-"));
  const packages = join(root, "packages");
  const catalogue = join(root, "catalogue.json");
  const dataDir = join(root, "data");
  await generateContentPackage({ targetId: "dutch-curriculum", outputDirectory: packages, generatedAt: "2026-07-18T00:00:00Z" });
  await generateLocalContentPackageCatalogue({ packagesDirectory: packages, outputPath: catalogue, generatedAt: "2026-07-18T00:00:00Z" });
  await installContentPackage({ cataloguePath: catalogue, dataDir, packageId: "com.sleepymario.language.dutch", installedAt: "2026-07-18T00:00:00Z" });
  return { dataDir, cleanup: () => rm(root, { recursive: true, force: true }) };
}

function stripAnsi(text) { return text.replace(/\x1b\[[0-9;]*m/gu, ""); }
