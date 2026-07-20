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

const blue = (text) => `\x1b[34m${text}\x1b[0m`;
const bold = (text) => `\x1b[1m${text}\x1b[0m`;
const chapterTargets = new Map([
  [2, { target: "Mijn naam is N", expertTarget: "Mijn naam is N", normal: "Mijn naam is ...", expert: "mijn" }],
  [3, { target: "Dit is N", expertTarget: "Dit is N", normal: "Dit is ...", expert: "dit" }],
  [4, { target: "Is dit N?", expertTarget: "is", normal: "Is dit ...?", expert: "geen" }],
  [5, { target: "Er is N", expertTarget: "er", normal: "Er is ...", expert: "er" }],
  [6, { target: "Ik heb N", expertTarget: "heb", normal: "Ik heb ...", expert: "hebben" }],
  [7, { target: "Heb je N?", expertTarget: "Heb je N?", normal: "Heb je ...?", expert: "je" }],
  [8, { target: "Ik wil N", expertTarget: "wil", normal: "Ik wil ...", expert: "willen" }],
  [9, { target: "Ik ga naar N", expertTarget: "ga", normal: "Ik ga naar ...", expert: "naar" }],
  [10, { target: "Ik woon in N", expertTarget: "woon", normal: "Ik woon in ...", expert: "wonen" }],
  [11, { target: "Hoe gaat het met je?", expertTarget: "Hoe gaat het met je?", normal: "Hoe gaat het met je?", expert: "Hoe gaat het met je?" }],
  [12, { target: "Sophie", expertTarget: "Sophie + V stem-t", normal: "Sophie", expert: "Sophie + V stem-t" }],
  [13, { target: "Ik wil graag N", expertTarget: "Ik wil graag N", normal: "Ik wil graag N", expert: "Ik wil graag N" }],
  [14, { target: "en", expertTarget: "clause + en + clause", normal: "en", expert: "clause + en + clause" }],
  [15, { target: "Waar woon je?", expertTarget: "Waar woon je?", normal: "Waar woon je?", expert: "Waar woon je?" }]
]);

test("installed Dutch Chapters 2–15 render every authored grammar role blue in all views", async () => {
  const fixture = await installedLanguages(["dutch-curriculum"], ["com.sleepymario.language.dutch"]);
  try {
    const tree = await buildLanguageTree(fixture.dataDir, "developer");
    const dutch = tree.children.find((node) => node.label === "Dutch");
    const readContent = dutch.children.find((node) => node.label === "Read content");
    const installedSnapshot = await readFile(join(fixture.dataDir, "packages", "com.sleepymario.language.dutch", "0.1.0", "content", "content.json"), "utf8");
    assert.match(installedSnapshot, /\[\[grammar:Mijn naam is \.\.\.\]\]/u, "package serialization retains semantic roles");

    for (const [chapterNumber, expected] of chapterTargets) {
      const chapter = readContent.children.find((node) => node.filePath?.includes(`chapter-${String(chapterNumber).padStart(3, "0")}-`) && !node.filePath?.includes("grammar"));
      assert.ok(chapter, `Chapter ${chapterNumber} exists`);
      for (const mode of ["normal", "expert", "developer"]) {
        const markdown = await renderLanguageTreeRightPane(chapter, { dataDir: fixture.dataDir, displayMode: mode });
        const rendered = renderTwoPaneLanguageTree(tree, new Set(), 0, markdown, true, 0, 400, "en-US", "navigation", 260, 0, mode);
        const plain = stripAnsi(rendered);
        const role = mode === "normal" ? expected.normal : expected.expert;
        const target = mode === "normal" ? expected.target : expected.expertTarget;
        assert.ok(rendered.includes(blue(target)), `Chapter ${chapterNumber} ${mode} target is blue`);
        assert.ok(rendered.includes(blue(role)), `Chapter ${chapterNumber} ${mode} annotation is blue`);
        assert.equal(rendered.includes(bold(target)), false, `Chapter ${chapterNumber} ${mode} target is not bold-only`);
        assert.equal(rendered.includes(bold(role)), false, `Chapter ${chapterNumber} ${mode} annotation is not bold-only`);
        assert.doesNotMatch(rendered, /\x1b\[34m(?:This chapter|Current chapter|Use |The chapter|Expert context|says that)[^\x1b]*\x1b\[0m/u);
        assert.doesNotMatch(plain, mode === "developer" ? /\[\[(?:grammar|emphasis):|\*\*/u : /\[\[(?:grammar|emphasis):|\*\*|`/u, `Chapter ${chapterNumber} ${mode} leaks no authoring marker`);
        assert.equal((blue(target).match(/\x1b\[0m/gu) ?? []).length, 1, "multiword target has one terminal reset");

        const noColor = renderTwoPaneLanguageTree(tree, new Set(), 0, markdown, false, 0, 400, "en-US", "navigation", 260, 0, mode);
        assert.doesNotMatch(noColor, /\x1b\[/u);
        assert.equal(noColor, stripAnsi(rendered), `Chapter ${chapterNumber} ${mode} NO_COLOR preserves layout`);
      }
    }

    const ordinary = renderTwoPaneLanguageTree(tree, new Set(), 0, "### Grammar\n\n**Important explanation** uses [[grammar:Dit is N]].", true, 0, 20, "en-US", "navigation", 180);
    assert.match(ordinary, /\x1b\[1mImportant explanation\x1b\[0m uses \x1b\[34mDit is N\x1b\[0m\./u);
    assert.doesNotMatch(ordinary, /\x1b\[34mImportant explanation/u);
  } finally {
    await fixture.cleanup();
  }
});

test("representative installed language grammars share the central blue role", async () => {
  const targets = ["vietnamese-curriculum", "dutch-curriculum"];
  const packageIds = ["com.sleepymario.language.vietnamese", "com.sleepymario.language.dutch"];
  const fixture = await installedLanguages(targets, packageIds);
  try {
    const tree = await buildLanguageTree(fixture.dataDir, "normal");
    for (const label of ["Vietnamese", "Dutch"]) {
      const language = tree.children.find((node) => node.label === label);
      const readContent = language.children.find((node) => node.label === "Read content");
      const grammar = readContent.children.find((node) => node.label === "Grammar");
      assert.ok(grammar, `${label} has Grammar`);
      const markdown = await renderLanguageTreeRightPane(grammar, { dataDir: fixture.dataDir, displayMode: "normal" });
      const rendered = renderTwoPaneLanguageTree(tree, new Set(), 0, markdown, true, 0, 80, "en-US", "navigation", 260);
      assert.match(rendered, /\x1b\[34m[^\x1b]+\x1b\[0m/u, `${label} has final blue ANSI output`);
    }
  } finally {
    await fixture.cleanup();
  }
});

async function installedLanguages(targetIds, packageIds) {
  const root = await mkdtemp(join(tmpdir(), "wsm-grammar-semantic-color-"));
  const packageDirectory = join(root, "packages");
  const cataloguePath = join(root, "catalogue.json");
  const dataDir = join(root, "data");
  for (const targetId of targetIds) await generateContentPackage({ targetId, outputDirectory: packageDirectory, generatedAt: "2026-07-17T00:00:00Z" });
  await generateLocalContentPackageCatalogue({ packagesDirectory: packageDirectory, outputPath: cataloguePath, generatedAt: "2026-07-17T00:00:00Z" });
  for (const packageId of packageIds) await installContentPackage({ cataloguePath, dataDir, packageId, installedAt: "2026-07-17T00:00:00Z" });
  return { dataDir, cleanup: () => rm(root, { recursive: true, force: true }) };
}

function stripAnsi(text) {
  return text.replace(/\x1b\[[0-9;]*m/gu, "");
}
