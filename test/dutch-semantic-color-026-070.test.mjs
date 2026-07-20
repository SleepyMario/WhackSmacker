import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import {
  generateContentPackage,
  generateLocalContentPackageCatalogue,
  installContentPackage
} from "../dist/packages/core/index.js";
import {
  buildLanguageTree,
  renderLanguageTreeRightPane,
  renderTwoPaneLanguageTree
} from "../dist/apps/cli/interactive-menu.js";

const curriculumSupportRoot = join(process.cwd(), "curriculum-support", "dutch");
const representativeTargets = new Map([
  [26, "hij/zij + heeft + noun"],
  [30, "zijn/haar + noun"],
  [35, "clause + terwijl + clause"],
  [40, "clause + daarom + V2 clause"],
  [45, "ook al + subordinate clause"],
  [50, "eerst ... daarna ... ten slotte ..."],
  [55, "Zullen we + infinitive?"],
  [60, "net + perfect"],
  [65, "laten + object + infinitive"],
  [70, "zeggen dat + subordinate declarative clause"]
]);
const blue = (text) => `\x1b[34m${text}\x1b[0m`;

test("Dutch Chapters 1-70 retain the canonical semantic grammar-role contract", async () => {
  for (let chapter = 1; chapter <= 70; chapter += 1) {
    const number = String(chapter).padStart(3, "0");
    const support = JSON.parse(await readFile(join(curriculumSupportRoot, `chapter-${number}`, "reading-support.json"), "utf8"));
    assert.equal(support.semanticRoleSyntaxVersion, 1, `Chapter ${chapter} uses semantic role syntax version 1`);
    const audienceText = support.audienceSections
      .flatMap((section) => [section.normal, section.expert])
      .join("\n");
    assert.match(audienceText, /\[\[grammar:[^\]\n]+\]\]/u, `Chapter ${chapter} has an authored grammar role`);
    assert.equal((audienceText.match(/\[\[grammar:/gu) ?? []).length, (audienceText.match(/\]\]/gu) ?? []).length, `Chapter ${chapter} roles are balanced`);

    if (chapter >= 26) {
      for (const sectionName of ["Brief Introduction", "New Grammar / Pattern", "Dutch Usage Notes"]) {
        const section = support.audienceSections.find((entry) => entry.sourceHeading === sectionName);
        assert.ok(section, `Chapter ${chapter} has ${sectionName}`);
        assert.match(section.normal, /\[\[grammar:[^\]\n]+\]\]/u, `Chapter ${chapter} ${sectionName} Normal has semantic grammar markup`);
        assert.match(section.expert, /\[\[grammar:[^\]\n]+\]\]/u, `Chapter ${chapter} ${sectionName} Expert has semantic grammar markup`);
      }
    }
  }
});

test("representative Dutch Chapters 26-70 render grammar roles blue without coloring prose", async () => {
  const fixture = await createInstalledDutchFixture();
  try {
    const tree = await buildLanguageTree(fixture.dataDir, "developer");
    const readContent = tree.children
      .find((node) => node.label === "Dutch")
      ?.children.find((node) => node.label === "Read content");
    assert.ok(readContent);

    for (const [chapterNumber, target] of representativeTargets) {
      const chapter = readContent.children.find((node) =>
        node.filePath?.includes(`chapter-${String(chapterNumber).padStart(3, "0")}-`)
        && node.filePath.endsWith("/chapter.md")
        && !node.filePath.includes("grammar")
      );
      assert.ok(chapter, `Chapter ${chapterNumber} exists`);

      for (const mode of ["normal", "expert", "developer"]) {
        const markdown = await renderLanguageTreeRightPane(chapter, { dataDir: fixture.dataDir, displayMode: mode });
        const rendered = renderTwoPaneLanguageTree(tree, new Set(), 0, markdown, true, 0, 400, "en-US", "navigation", 280, 0, mode);
        assert.ok(rendered.includes(blue(target)), `Chapter ${chapterNumber} ${mode} renders ${target} blue`);
        assert.doesNotMatch(rendered, /\x1b\[34m(?:This chapter|Use |Learn |The |Dutch |Plural |Finite )/u, `Chapter ${chapterNumber} ${mode} leaves explanatory prose neutral`);
        assert.doesNotMatch(stripAnsi(rendered), /\[\[(?:grammar|emphasis):|`/u, `Chapter ${chapterNumber} ${mode} leaks no authoring markup`);

        const noColor = renderTwoPaneLanguageTree(tree, new Set(), 0, markdown, false, 0, 400, "en-US", "navigation", 280, 0, mode);
        assert.doesNotMatch(noColor, /\x1b\[/u, `Chapter ${chapterNumber} ${mode} remains valid without color`);
        assert.match(noColor, new RegExp(escapeRegExp(target), "u"), `Chapter ${chapterNumber} ${mode} keeps semantic text without color`);
        assert.doesNotMatch(noColor, /\[\[(?:grammar|emphasis):|`/u, `Chapter ${chapterNumber} ${mode} hides authoring markup without color`);
      }
    }

    const chapter26 = readContent.children.find((node) => node.filePath?.includes("chapter-026-") && !node.filePath.includes("grammar"));
    const withToggles = await renderLanguageTreeRightPane(chapter26, {
      dataDir: fixture.dataDir,
      displayMode: "normal",
      translationsEnabled: true,
      breakdownEnabled: true
    });
    const toggledRender = renderTwoPaneLanguageTree(tree, new Set(), 0, withToggles, true, 0, 400, "en-US", "navigation", 280);
    assert.ok(toggledRender.includes(blue("hij/zij + heeft + noun")));
    assert.match(stripAnsi(toggledRender), /Natural English Translation/u);
    assert.match(stripAnsi(toggledRender), /Line-by-line Breakdown/u);
  } finally {
    await fixture.cleanup();
  }
});

test("Dutch Grammar Easy and Hard summaries use the same blue grammar emphasis", async () => {
  const fixture = await createInstalledDutchFixture();
  try {
    const tree = await buildLanguageTree(fixture.dataDir, "developer");
    const readContent = tree.children
      .find((node) => node.label === "Dutch")
      ?.children.find((node) => node.label === "Read content");
    assert.ok(readContent);

    const summary = readContent.children.find((node) => node.filePath?.includes("chapter-026-030-grammar-easy/chapter.md"));
    assert.ok(summary, "Grammar summary node exists");
    for (const mode of ["normal", "expert", "developer"]) {
      const markdown = await renderLanguageTreeRightPane(summary, { dataDir: fixture.dataDir, displayMode: mode });
      const rendered = renderTwoPaneLanguageTree(tree, new Set(), 0, markdown, true, 0, 240, "en-US", "navigation", 280, 0, mode);
      assert.ok(rendered.includes(blue("hij/zij + heeft + noun")), `Grammar ${mode} pattern is blue`);
      assert.ok(rendered.includes(blue("heeft")), `Grammar ${mode} discussed form is blue`);
      assert.doesNotMatch(rendered, /\x1b\[34mUse \x1b/u, `Grammar ${mode} prose is neutral`);
    }
  } finally {
    await fixture.cleanup();
  }
});

async function createInstalledDutchFixture() {
  const root = await mkdtemp(join(tmpdir(), "wsm-dutch-semantic-026-070-"));
  const packageDirectory = join(root, "packages");
  const cataloguePath = join(root, "catalogue.json");
  const dataDir = join(root, "data");
  await generateContentPackage({ targetId: "dutch-curriculum", outputDirectory: packageDirectory, generatedAt: "2026-07-19T00:00:00Z" });
  await generateLocalContentPackageCatalogue({ packagesDirectory: packageDirectory, outputPath: cataloguePath, generatedAt: "2026-07-19T00:00:00Z" });
  await installContentPackage({ cataloguePath, dataDir, packageId: "com.sleepymario.language.dutch", installedAt: "2026-07-19T00:00:00Z" });
  return { dataDir, cleanup: () => rm(root, { recursive: true, force: true }) };
}

function stripAnsi(text) {
  return text.replace(/\x1b\[[0-9;]*m/gu, "");
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}
