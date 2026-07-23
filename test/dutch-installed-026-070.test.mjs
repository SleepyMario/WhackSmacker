import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import {
  buildLanguageTree,
  renderLanguageTreeRightPane
} from "../dist/apps/cli/interactive-menu.js";
import {
  generateContentPackage,
  generateLocalContentPackageCatalogue,
  installContentPackage,
  listReadingReviewSources,
  readInstalledContentEntry
} from "../dist/packages/core/index.js";

const expectedReviewLabels = Array.from({ length: 16 }, (_, index) => {
  const start = index * 5 + 1;
  return `Chapter ${start}-${start + 4}`;
});

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

function sectionBody(markdown, title) {
  const lines = markdown.replace(/\r\n?/gu, "\n").split("\n");
  const start = lines.findIndex((line) => new RegExp(`^(#{1,6})\\s+${escapeRegExp(title)}\\s*$`, "u").test(line));
  if (start < 0) return "";
  const level = /^(#{1,6})\s/u.exec(lines[start])?.[1].length ?? 1;
  const endOffset = lines.slice(start + 1).findIndex((line) => {
    const heading = /^(#{1,6})\s/u.exec(line);
    return heading !== null && heading[1].length <= level;
  });
  const end = endOffset < 0 ? lines.length : start + 1 + endOffset;
  return lines.slice(start + 1, end).join("\n").trim();
}

function chapterNumber(node) {
  return Number(/chapter-(\d{3})-/u.exec(node.filePath ?? "")?.[1] ?? 0);
}

async function createInstalledDutchFixture() {
  const root = await mkdtemp(join(tmpdir(), "wsm-dutch-026-070-"));
  const packageDirectory = join(root, "packages");
  const cataloguePath = join(root, "catalogue", "catalogue.json");
  const dataDir = join(root, "data", "content");
  for (const targetId of ["dutch-curriculum", "dutch-core-reviews"]) {
    await generateContentPackage({
      targetId,
      outputDirectory: packageDirectory,
      generatedAt: "2026-07-18T00:00:00Z"
    });
  }
  await generateLocalContentPackageCatalogue({
    packagesDirectory: packageDirectory,
    outputPath: cataloguePath,
    generatedAt: "2026-07-18T00:00:00Z"
  });
  for (const packageId of ["com.sleepymario.language.dutch", "com.sleepymario.language.dutch.reviews"]) {
    await installContentPackage({
      cataloguePath,
      dataDir,
      packageId,
      installedAt: "2026-07-18T00:00:00Z"
    });
  }
  return { dataDir, cleanup: () => rm(root, { recursive: true, force: true }) };
}

test("installed Dutch Chapters 26-80 expose all views and independent translation and breakdown toggles", async () => {
  const fixture = await createInstalledDutchFixture();
  try {
    const tree = await buildLanguageTree(fixture.dataDir, "developer");
    const dutch = tree.children.find((node) => node.label === "Dutch");
    assert.ok(dutch);
    const readContent = dutch.children.find((node) => node.label === "Read content");
    const reviewDecks = dutch.children.find((node) => node.label === "Review decks");
    assert.ok(readContent);
    assert.ok(reviewDecks);

    const chapters = readContent.children
      .filter((node) => {
        const chapter = chapterNumber(node);
        return chapter >= 26 && chapter <= 80 && (node.filePath ?? "").endsWith("/chapter.md") && !/grammar/u.test(node.filePath ?? "");
      })
      .sort((a, b) => chapterNumber(a) - chapterNumber(b));
    assert.deepEqual(chapters.map(chapterNumber), Array.from({ length: 55 }, (_, index) => index + 26));
    assert.equal(readContent.children.some((node) => chapterNumber(node) === 81), false);
    assert.deepEqual(reviewDecks.children.map((node) => node.label), expectedReviewLabels);

    const sources = await listReadingReviewSources({
      dataDir: fixture.dataDir,
      packageId: "com.sleepymario.language.dutch"
    });
    assert.deepEqual(sources.map((source) => source.title), expectedReviewLabels);

    for (const chapter of chapters) {
      const number = chapterNumber(chapter);
      const type = number % 2 === 0 ? "Narrative" : "Dialogue";
      const normal = await renderLanguageTreeRightPane(chapter, { dataDir: fixture.dataDir, displayMode: "normal" });
      const expert = await renderLanguageTreeRightPane(chapter, { dataDir: fixture.dataDir, displayMode: "expert" });
      const developer = await renderLanguageTreeRightPane(chapter, { dataDir: fixture.dataDir, displayMode: "developer" });
      const translated = await renderLanguageTreeRightPane(chapter, {
        dataDir: fixture.dataDir,
        displayMode: "normal",
        translationsEnabled: true
      });
      const breakdown = await renderLanguageTreeRightPane(chapter, {
        dataDir: fixture.dataDir,
        displayMode: "normal",
        breakdownEnabled: true
      });
      const both = await renderLanguageTreeRightPane(chapter, {
        dataDir: fixture.dataDir,
        displayMode: "expert",
        translationsEnabled: true,
        breakdownEnabled: true
      });

      assert.notEqual(normal, expert, `Chapter ${number} Normal and Expert differ`);
      assert.match(normal, new RegExp(`^${[76, 78, 80].includes(number) ? "##" : "###"} ${type}$`, "mu"));
      assert.doesNotMatch(normal, /Natural English Translation|Line-by-line Breakdown/u);
      assert.doesNotMatch(normal, /DUT-GRAMMAR-\d+/u);
      assert.doesNotMatch(expert, /DUT-GRAMMAR-\d+/u);
      assert.doesNotMatch(developer, /DUT-GRAMMAR-\d+/u);
      assert.equal((developer.match(/^### Grammar$/gmu) ?? []).length, 1);
      assert.match(developer, /^#### Normal$/mu);
      assert.match(developer, /^#### Expert$/mu);
      assert.match(translated, /^### Natural English Translation$/mu);
      assert.doesNotMatch(translated, /^### Line-by-line Breakdown$/mu);
      assert.match(breakdown, /^### Line-by-line Breakdown$/mu);
      assert.doesNotMatch(breakdown, /^### Natural English Translation$/mu);
      assert.match(both, /^### Natural English Translation$/mu);
      assert.match(both, /^### Line-by-line Breakdown$/mu);

      const brief = sectionBody(normal, "Brief Introduction");
      const directNarrative = [76, 78, 80].includes(number);
      if (directNarrative) assert.equal(brief, "", `Chapter ${number} omits setup projection`);
      else if (number <= 75) assert.match(brief, /^This chapter (?:teaches|introduces)/u);
      else assert.ok(brief.length > 0, `Chapter ${number} has learner-directed introductory support`);
      const readingBlocks = sectionBody(normal, type).split(/\n\s*\n/u).filter(Boolean);
      assert.ok(readingBlocks.length >= (directNarrative ? 1 : 2), `Chapter ${number} has expected narrative blocks`);
      const sceneIntroduction = readingBlocks[0].trim();
      assert.doesNotMatch(sceneIntroduction, /^This chapter (?:teaches|introduces)/u);
      if (!directNarrative) assert.doesNotMatch(brief, new RegExp(escapeRegExp(sceneIntroduction), "u"));
      const naturalTranslation = sectionBody(translated, "Natural English Translation");
      assert.doesNotMatch(naturalTranslation, new RegExp(escapeRegExp(sceneIntroduction), "u"));
      assert.doesNotMatch(naturalTranslation, /^(?:This chapter|In this chapter|The following (?:dialogue|narrative)|Context:|Setting:)/iu);

      const translationEntry = await readInstalledContentEntry({
        dataDir: fixture.dataDir,
        packageId: "com.sleepymario.language.dutch",
        path: chapter.translationPath
      });
      const translation = JSON.parse(translationEntry.text);
      assert.equal(translation.context, undefined);
      assert.equal(translation.introduction, undefined);
      assert.equal(translation.preface, undefined);
      const firstTranslatedText = translation.readingType === "dialogue"
        ? translation.turns[0].text
        : translation.paragraphs[0];
      assert.ok(naturalTranslation.includes(firstTranslatedText), `Chapter ${number} begins with authored translation content`);
    }
  } finally {
    await fixture.cleanup();
  }
});
