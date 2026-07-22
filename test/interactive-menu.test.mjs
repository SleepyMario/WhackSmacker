import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";

import { createCommandRegistry, resolveCliCommand } from "../dist/apps/cli/main.js";
import {
  applyLanguageSpecificReadableContentMenuPolicy,
  buildLanguageTree,
  buildLanguageMenuItems,
  buildModuleTree,
  flattenVisibleLanguageTree,
  getDynamicLanguageMenuItems,
  getBeginnerMathematicsMenuItems,
  getGeographyMenuItems,
  getInstalledLanguagePackageActionItems,
  getLanguageMenuItems,
  getLinguisticTermsMenuItems,
  getMainMenuItems,
  getMathematicsMenuItems,
  getOneTwoThreeMenuItems,
  formatEmbeddedReviewReveal,
  isEmbeddedReviewItemUsable,
  installedLanguagePackagesToMenuItems,
  languageMenuHeading,
  listAvailableModuleDescriptors,
  menuStyles,
  renderTwoPaneLanguageTree,
  renderLanguageTreeRightPane,
  renderSourceLanguageToggle,
  renderWhackSmackerHeader,
  readableContentEntriesToMenuItems,
  reviewDeckStatusStyle,
  reviewSourcesToMenuItems,
  runInteractiveMenu,
  shouldShowTogglesPane,
  shouldUseTerminalColors,
  whackSmackerBanner,
  whackSmackerSubtitle
} from "../dist/apps/cli/interactive-menu.js";
import {
  generateContentPackage,
  generateLocalContentPackageCatalogue,
  classifyReviewDeckMenuStatus,
  createInitialReviewState,
  getBuiltInFirstClassModules,
  installContentPackage,
  InMemoryCliCommandRegistry,
  installedPackageToFirstClassModuleDescriptor,
  listInstalledContentPackages,
  listAvailableContentPackages,
  listReadingReviewItems,
  listReadingReviewSources,
  loadReviewProgressStore,
  readInstalledContentEntry,
  recordReadingReviewAnswer,
  syncReadingReviewItems
} from "../dist/packages/core/index.js";
import { loadSourceLanguageSettings } from "../dist/src/settings/source-language.js";

class FakeTerminal {
  constructor(keys, { interactive = true, colorsEnabled = interactive, width } = {}) {
    this.keys = [...keys];
    this.isInteractive = interactive;
    this.colorsEnabled = colorsEnabled;
    this.width = width;
    this.output = "";
    this.enterCount = 0;
    this.restoreCount = 0;
  }

  write(text) {
    this.output += text;
  }

  async readKey() {
    const key = this.keys.shift();
    assert.ok(key, "fake terminal ran out of keys");
    return key;
  }

  enter() {
    this.enterCount += 1;
  }

  restore() {
    this.restoreCount += 1;
  }
}

function key(name, extra = {}) {
  return { name, ...extra };
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
  return lines.slice(start + 1, end).join("\n");
}

function createStubRegistry(calls, options = {}) {
  const registry = new InMemoryCliCommandRegistry();

  for (const path of [
    ["language", "terms"],
    ["language", "terminology"],
    ["review", "run"],
    ["chess"],
    ["geography", "continents"],
    ["mathematics", "beginner-volume-one"],
    ["mathematics", "one-two-three"],
    ["mathematics", "four-and-five"],
    ["mathematics", "one-to-five"],
    ["mathematics", "six-to-nine"]
  ]) {
    registry.register({
      path,
      summary: path.join(" "),
      run: async (args) => {
        if (path.join(" ") === "review run" && options.reviewRun !== undefined) {
          await options.reviewRun(args);
          return;
        }
        calls.push({ path: path.join(" "), args: [...args] });
        if (path[0] === "language" || path[0] === "chess") {
          console.log(`${path.join(" ")} output`);
        }
      }
    });
  }

  return registry;
}

test("package exposes whacksmacker and wsm as the same executable entry point", async () => {
  const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));

  assert.deepEqual(packageJson.bin, {
    whacksmacker: "dist/main.js",
    wsm: "dist/main.js"
  });
});

test("no arguments select interactive mode and fail clearly when not interactive", async () => {
  const originalExitCode = process.exitCode;
  const result = await runNode(["dist/main.js"]);

  process.exitCode = originalExitCode;

  assert.equal(result.exitCode, 1);
});

test("arguments continue to select normal CLI routing", () => {
  const registry = createStubRegistry([]);

  assert.equal(resolveCliCommand(registry, ["status"]), null);
  assert.equal(resolveCliCommand(registry, ["language", "status"]), null);
  assert.equal(resolveCliCommand(registry, ["language", "korean"]), null);
  assert.equal(resolveCliCommand(registry, ["language", "terms"])?.path.join(" "), "language terms");
  assert.equal(resolveCliCommand(registry, ["language", "terminology"])?.path.join(" "), "language terminology");
});

test("main menu exposes all registered domain modules", () => {
  assert.deepEqual(
    getMainMenuItems().map((item) => item.label),
    ["Language", "Chess", "Geography", "Mathematics"]
  );
});

test("language menu exposes Linguistic Terms and back", () => {
  assert.deepEqual(
    getLanguageMenuItems().map((item) => item.label),
    ["Linguistic Terms", "Back"]
  );
});

test("installed language package discovery is generic and normalizes curriculum labels", () => {
  const items = installedLanguagePackagesToMenuItems([
    packageRecord("com.sleepymario.language.example", "Example Curriculum"),
    packageRecord("com.sleepymario.language.vietnamese", "Vietnamese Curriculum"),
    packageRecord("com.sleepymario.language.dutch", "Dutch"),
    packageRecord("com.sleepymario.language.linguistic-terminology", "Linguistic Terminology"),
    packageRecord("com.sleepymario.mathematics.curriculum", "Mathematics")
  ]);

  assert.deepEqual(items.map((item) => item.label), ["Dutch", "Example", "Linguistic Terminology", "Vietnamese"]);
  assert.deepEqual(items.map((item) => item.packageId), [
    "com.sleepymario.language.dutch",
    "com.sleepymario.language.example",
    "com.sleepymario.language.linguistic-terminology",
    "com.sleepymario.language.vietnamese"
  ]);
});

test("Vietnamese menu policy pins Foundation chapters independently of package input order", () => {
  const item = (filePath, label, curriculumChapterNumber) => ({
    label,
    kind: "readable-content",
    filePath,
    ...(curriculumChapterNumber === undefined ? {} : { curriculumChapterType: "foundation", curriculumChapterNumber })
  });
  const shuffled = [
    item("units/vietnamese-core/chapter-040-basic-sentences-40/chapter.md", "Chapter 40 -- Later"),
    item("units/vietnamese-foundation/chapter-004-final-consonants/chapter.md", "Foundation Chapter 4 -- Final Consonants", 4),
    item("units/vietnamese-core/chapter-001-basic-sentences-1/chapter.md", "Chapter 1 -- Greetings"),
    item("units/vietnamese-foundation/chapter-002-tones/chapter.md", "Foundation Chapter 2 -- Tones", 2),
    item("units/vietnamese-foundation/chapter-005-audio-dependent-drills/chapter.md", "Foundation Chapter 5 -- Drills", 5),
    item("units/vietnamese-foundation/chapter-001-alphabet/chapter.md", "Foundation Chapter 1 -- Alphabet", 1),
    item("units/vietnamese-core/chapter-002-basic-sentences-2/chapter.md", "Chapter 2 -- Introductions"),
    item("units/vietnamese-foundation/chapter-003-vowels/chapter.md", "Foundation Chapter 3 -- Vowels", 3)
  ];

  const ordered = applyLanguageSpecificReadableContentMenuPolicy("com.sleepymario.language.vietnamese", shuffled);

  assert.deepEqual(ordered.slice(0, 5).map(({ label }) => label), [
    "Foundation Chapter -- 1",
    "Foundation Chapter -- 2",
    "Foundation Chapter -- 3",
    "Foundation Chapter -- 4",
    "Foundation Chapter -- 5"
  ]);
  assert.equal(ordered[5]?.label, "Chapter 1 -- Greetings");
  assert.equal(ordered.at(-1)?.label, "Chapter 40 -- Later");
  assert.deepEqual(
    applyLanguageSpecificReadableContentMenuPolicy("com.sleepymario.language.vietnamese", [...shuffled].reverse()).map(({ filePath }) => filePath),
    ordered.map(({ filePath }) => filePath)
  );

  const dutch = applyLanguageSpecificReadableContentMenuPolicy("com.sleepymario.language.dutch", shuffled);
  assert.equal(dutch.some(({ label }) => label === "Foundation Chapter 1 -- Alphabet"), true);
  assert.equal(dutch[0]?.label, "Chapter 1 -- Greetings");
});

test("new language package IDs appear without hard-coded menu entries", () => {
  const items = installedLanguagePackagesToMenuItems([
    packageRecord("com.sleepymario.language.example", "Example Language")
  ]);

  assert.deepEqual(items.map((item) => item.label), ["Example Language"]);
  assert.deepEqual(buildLanguageMenuItems(items).map((item) => item.label), ["Example Language", "Linguistic Terms", "Back"]);
});

test("language menu heading explains missing installed packages", () => {
  assert.match(languageMenuHeading(false, 0), /No installed language packages found/);
  assert.match(languageMenuHeading(false, 0), /whacksmacker content install/);
});

test("installed package action menu exposes read review info and back", () => {
  assert.deepEqual(
    getInstalledLanguagePackageActionItems().map((item) => item.label),
    ["Read content", "Review sources", "Package info", "Back"]
  );
});

test("Linguistic Terms menu exposes General before language groups", () => {
  assert.deepEqual(
    getLinguisticTermsMenuItems().map((item) => item.label),
    ["General", "Korean", "Back"]
  );
});

test("no main menu items remain placeholders", () => {
  const placeholderItems = getMainMenuItems().filter((item) => item.kind === "placeholder");

  assert.deepEqual(placeholderItems, []);
});

test("geography menu exposes continents and back", () => {
  assert.deepEqual(
    getGeographyMenuItems().map((item) => item.label),
    ["Continents", "Back"]
  );
});

test("mathematics menu exposes Beginner Mathematics and back", () => {
  assert.deepEqual(
    getMathematicsMenuItems().map((item) => item.label),
    ["Beginner Mathematics", "Back"]
  );
});

test("Beginner Mathematics submenu exposes complete volume, Unit 1, and back", () => {
  assert.deepEqual(
    getBeginnerMathematicsMenuItems().map((item) => item.label),
    [
      "Generate complete Volume 1",
      "Generate Unit 1 - One, Two, Three",
      "Generate Unit 2 - Four and Five",
      "Generate Unit 3 - One to Five",
      "Generate Unit 4 - Six, Seven, Eight, Nine",
      "Back"
    ]
  );
});

test("One, Two, Three submenu exposes workbook generation and back", () => {
  assert.deepEqual(
    getOneTwoThreeMenuItems().map((item) => item.label),
    ["Generate workbook", "Back"]
  );
});

test("interactive menu opens the module three-pane tree", async () => {
  const fixture = await createInstalledDutchFixture();
  const terminal = new FakeTerminal([
    key("q", { sequence: "q" })
  ]);

  try {
    await runInteractiveMenu(createStubRegistry([]), terminal, { dataDir: fixture.dataDir });

    assert.match(stripAnsi(terminal.output), /\+-+\+-+\+-+\+/u);
    assert.match(terminal.output, /WhackSmacker/);
    assert.match(terminal.output, /Installed modules/);
    assert.match(terminal.output, /Modules available/);
    assert.match(terminal.output, /Languages/);
    assert.match(terminal.output, /Games/);
    assert.match(terminal.output, /Geography/);
    assert.match(terminal.output, /Mathematics/);
    assert.doesNotMatch(terminal.output, /mouse/i);
    assert.match(terminal.output, /Space activate\/install/);
  } finally {
    await fixture.cleanup();
  }
});

test("module tree lists top-level categories and installed language packages", async () => {
  const fixture = await createInstalledLanguageFixture(
    ["vietnamese-curriculum", "dutch-curriculum"],
    [
      "com.sleepymario.language.vietnamese",
      "com.sleepymario.language.dutch"
    ]
  );
  try {
    const tree = await buildModuleTree(fixture.dataDir);
    const installed = tree.children.find((node) => node.label === "Installed modules");
    const languages = installed.children.find((node) => node.label === "Languages");

    assert.equal(tree.label, "WhackSmacker");
    assert.deepEqual(tree.children.map((node) => node.label), ["Installed modules", "Modules available"]);
    assert.deepEqual(installed.children.map((node) => node.label), ["Languages", "Games", "Geography", "Mathematics"]);
    assert.deepEqual(languages.children.map((node) => node.label), ["Dutch", "Vietnamese"]);
    assert.deepEqual(languages.children.map((node) => node.moduleId), [
      "com.sleepymario.language.dutch",
      "com.sleepymario.language.vietnamese"
    ]);
  } finally {
    await fixture.cleanup();
  }
});

test("first-class module descriptors include built-ins and installed language packages", () => {
  const builtIns = getBuiltInFirstClassModules();
  const installed = installedPackageToFirstClassModuleDescriptor(packageRecord("com.sleepymario.language.example", "Example Curriculum"));

  assert.deepEqual(builtIns.map((descriptor) => descriptor.moduleId), [
    "com.sleepymario.game.chess",
    "com.sleepymario.geography",
    "com.sleepymario.mathematics"
  ]);
  assert.equal(installed.moduleId, "com.sleepymario.language.example");
  assert.equal(installed.displayName, "Example");
  assert.equal(installed.category, "Languages");
  assert.equal(installed.sourceKind, "content-package");
});

test("module tree exposes Games Chess Geography and Mathematics entries", async () => {
  const tree = await buildModuleTree();
  const installed = tree.children.find((node) => node.label === "Installed modules");
  const games = installed.children.find((node) => node.label === "Games");
  const geography = installed.children.find((node) => node.label === "Geography");
  const mathematics = installed.children.find((node) => node.label === "Mathematics");
  const chess = games.children.find((node) => node.label === "Chess");
  const continents = geography.children.find((node) => node.label === "Continents");
  const beginnerMath = mathematics.children.find((node) => node.label === "Beginner Mathematics");

  assert.deepEqual(games.children.map((node) => node.label), ["Chess"]);
  assert.equal(chess.moduleId, "com.sleepymario.game.chess");
  assert.deepEqual(chess.children.map((node) => node.label), ["Play / Board", "Legal moves", "Module info"]);
  assert.deepEqual(geography.children.map((node) => node.label), ["Continents"]);
  assert.equal(continents.moduleId, "com.sleepymario.geography");
  assert.deepEqual(continents.children.map((node) => node.label), ["Continents"]);
  assert.deepEqual(mathematics.children.map((node) => node.label), ["Beginner Mathematics"]);
  assert.equal(beginnerMath.moduleId, "com.sleepymario.mathematics");
  assert.match(chess.previewText, /whacksmacker chess/);
  assert.match(continents.children[0].previewText, /whacksmacker geography continents/);
  assert.match(beginnerMath.previewText, /workbook generators/);
});

test("language category can expand installed package nodes in the module tree", async () => {
  const fixture = await createInstalledDutchFixture();
  const terminal = new FakeTerminal([
    key("down"),
    key("return"),
    key("q", { sequence: "q" })
  ]);

  try {
    await runInteractiveMenu(createStubRegistry([]), terminal, { dataDir: fixture.dataDir });

    assert.match(terminal.output, /Languages/);
    assert.match(terminal.output, /Dutch/);
    assert.match(terminal.output, /Space activate\/install/);
  } finally {
    await fixture.cleanup();
  }
});

test("language menu discovers installed packages from the selected data dir", async () => {
  const fixture = await createInstalledDutchFixture();
  try {
    const items = await getDynamicLanguageMenuItems(fixture.dataDir);

    assert.deepEqual(items.map((item) => item.label), ["Dutch", "Linguistic Terms", "Back"]);
  } finally {
    await fixture.cleanup();
  }
});

test("language tree lists installed packages and package sections", async () => {
  const fixture = await createInstalledLanguageFixture(
    ["vietnamese-curriculum", "dutch-curriculum"],
    [
      "com.sleepymario.language.vietnamese",
      "com.sleepymario.language.dutch"
    ]
  );
  try {
    const tree = await buildLanguageTree(fixture.dataDir);
    const treesByMode = new Map([["normal", tree]]);

    assert.equal(tree.label, "Languages");
    assert.deepEqual(tree.children.map((node) => node.label), ["Dutch", "Vietnamese"]);
    for (const languagePackage of tree.children) {
      assert.deepEqual(languagePackage.children.map((node) => node.label), ["Read content", "Review decks", "Package info", "Uninstall"]);
    }
    for (const mode of ["expert", "developer"]) treesByMode.set(mode, await buildLanguageTree(fixture.dataDir, mode));
    for (const [mode, modeTree] of treesByMode) {
      assert.deepEqual(
        navigationTreeShape(modeTree),
        navigationTreeShape(tree),
        `${mode} preserves every navigation label, kind, and child position`
      );
      const navigationLabels = allTreeNodes(modeTree).map((node) => node.label);
      assert.equal(navigationLabels.includes("Language Notes"), false, `${mode} has no Language Notes navigation node`);
      assert.equal(navigationLabels.some((label) => /^(?:Characters|Sino-Vietnamese Vocabulary|Sino-Korean Vocabulary)$/u.test(label)), false);
      for (const languagePackage of modeTree.children) {
        assert.deepEqual(languagePackage.children.map((node) => [node.label, node.kind]), [
          ["Read content", "read-section"],
          ["Review decks", "review-section"],
          ["Package info", "package-info"],
          ["Uninstall", "uninstall"]
        ]);
        const readContent = languagePackage.children.find((node) => node.label === "Read content");
        const grammarNode = readContent.children.find((node) => node.label === "Grammar");
        assert.ok(grammarNode, `${languagePackage.label} exposes Grammar in ${mode}`);
        const markdown = await renderLanguageTreeRightPane(grammarNode, { dataDir: fixture.dataDir, displayMode: mode });
        assert.equal((markdown.match(/^# Grammar$/gmu) ?? []).length, 1, `${languagePackage.label} has one Grammar heading in ${mode}`);
        assert.doesNotMatch(markdown, /^#{1,6} Grammar(?: Easy| Hard|: Normal|: Expert| Points?| Section)$/mu);
      }
    }
  } finally {
    await fixture.cleanup();
  }
});

test("installed curricula share the global purple-dialogue and pink-reading semantics", async () => {
  const fixture = await createInstalledLanguageFixture(
    ["vietnamese-curriculum", "dutch-curriculum"],
    [
      "com.sleepymario.language.vietnamese", "com.sleepymario.language.dutch"
    ]
  );
  try {
    const tree = await buildLanguageTree(fixture.dataDir);
    const expectedLanguages = ["Vietnamese", "Dutch"];
    const purple = "\x1b[38;5;141m";
    const pink = "\x1b[38;5;213m";
    const reset = "\x1b[0m";

    for (const languageLabel of expectedLanguages) {
      const language = tree.children.find((node) => node.label === languageLabel);
      assert.ok(language, `${languageLabel} package is installed`);
      const readContent = language.children.find((node) => node.label === "Read content");
      assert.ok(readContent, `${languageLabel} has readable content`);
      let dialogue;
      let narrative;
      for (const chapter of readContent.children) {
        if (dialogue !== undefined && narrative !== undefined) break;
        if (chapter.kind !== "content") continue;
        const markdown = await renderLanguageTreeRightPane(chapter, { dataDir: fixture.dataDir, displayMode: "normal" });
        assert.doesNotMatch(markdown, /^#{1,6}\s+Content\s*$/imu, `${languageLabel} omits the structural Content heading`);
        dialogue ??= firstLearnerDialogueTurn(markdown);
        narrative ??= firstLearnerNarrativeLine(markdown);
      }
      assert.ok(dialogue, `${languageLabel} has a learner-facing dialogue turn`);
      assert.ok(narrative, `${languageLabel} has learner-facing narrative prose`);

      const dialogueOutput = renderTwoPaneLanguageTree(tree, new Set(), 0, dialogue.markdown, true, 0, 200, "en-US", "navigation", 180);
      const narrativeOutput = renderTwoPaneLanguageTree(tree, new Set(), 0, narrative.markdown, true, 0, 200, "en-US", "navigation", 180);
      assert.ok(dialogueOutput.includes(`${purple}${dialogue.label}${reset}${dialogue.separator}${pink}`), `${languageLabel} speaker boundary is purple-to-pink`);
      assert.ok(narrativeOutput.includes(`${pink}${narrative.prefix}`), `${languageLabel} narrative begins pink`);
    }
  } finally {
    await fixture.cleanup();
  }
});

test("language tree exposes Dutch content and review deck labels", async () => {
  const fixture = await createInstalledDutchFixture();
  try {
    const tree = await buildLanguageTree(fixture.dataDir);
    const dutch = tree.children.find((node) => node.label === "Dutch");
    const readContent = dutch.children.find((node) => node.label === "Read content");
    const reviewDecks = dutch.children.find((node) => node.label === "Review decks");

    assert.ok(readContent.children.some((node) => node.label === "Chapter 1 -- Greetings and Identity"));
    assert.ok(readContent.children.some((node) => node.label === "Chapter 5 -- There Is / There Are I"));
    assert.ok(readContent.children.some((node) => node.label === "Chapter 10 -- Living Here"));
    assert.ok(readContent.children.some((node) => node.label === "Chapter 15 -- Asking Where Someone Lives"));
    assert.ok(readContent.children.some((node) => node.label === "Chapter 20 -- An Appointment in Town"));
    assert.ok(readContent.children.some((node) => node.label === "Chapter 25 -- Going to the Museum"));
    assert.ok(readContent.children.some((node) => node.label === "Grammar"));
    assert.equal(readContent.children.some((node) => node.label === "Grammar - Hard"), false);
    const chapter5Index = readContent.children.findIndex((node) => node.label === "Chapter 5 -- There Is / There Are I");
    const inlineReview = readContent.children[chapter5Index + 1];
    const chapter6Index = readContent.children.findIndex((node) => node.label === "Chapter 6 -- Having Things");
    assert.equal(inlineReview?.label, "Review -- Chapters 1–5");
    assert.equal(inlineReview?.kind, "review-source");
    assert.equal(inlineReview?.packageId, "com.sleepymario.language.dutch");
    assert.equal(inlineReview?.sourcePath, "review-decks/chapter-001-005/cards.tsv");
    assert.equal(chapter5Index < chapter6Index && chapter5Index + 1 < chapter6Index, true);
    assert.equal(readContent.children.some((node) => /^Ch (?:1|5) -- Review/u.test(node.label)), false);
    assert.deepEqual(reviewDecks.children.map((node) => node.label), ["Chapter 1-5", "Chapter 6-10", "Chapter 11-15", "Chapter 16-20", "Chapter 21-25", "Chapter 26-30", "Chapter 31-35", "Chapter 36-40", "Chapter 41-45", "Chapter 46-50", "Chapter 51-55", "Chapter 56-60", "Chapter 61-65", "Chapter 66-70", "Chapter 71-75"]);
  } finally {
    await fixture.cleanup();
  }
});

test("Dutch Chapter 1 Normal and Developer projections preserve one complete source", async () => {
  const fixture = await createInstalledDutchFixture();
  try {
    const tree = await buildLanguageTree(fixture.dataDir);
    const dutch = tree.children.find((node) => node.label === "Dutch");
    const readContent = dutch.children.find((node) => node.label === "Read content");
    const chapter = readContent.children.find((node) => node.label === "Chapter 1 -- Greetings and Identity");
    const chapter2 = readContent.children.find((node) => node.filePath === "units/dutch-core/chapter-002-basic-sentences-2/chapter.md");
    const normal = await renderLanguageTreeRightPane(chapter, { dataDir: fixture.dataDir, displayMode: "normal" });
    const developer = await renderLanguageTreeRightPane(chapter, { dataDir: fixture.dataDir, displayMode: "developer" });
    const translatedNormal = await renderLanguageTreeRightPane(chapter, { dataDir: fixture.dataDir, displayMode: "normal", translationsEnabled: true });
    const translatedDeveloper = await renderLanguageTreeRightPane(chapter, { dataDir: fixture.dataDir, displayMode: "developer", translationsEnabled: true });
    const chineseSourceOff = await renderLanguageTreeRightPane(chapter, { dataDir: fixture.dataDir, locale: "zh-Hant-TW", displayMode: "normal", translationsEnabled: false });
    const chineseSourceOn = await renderLanguageTreeRightPane(chapter, { dataDir: fixture.dataDir, locale: "zh-Hant-TW", displayMode: "normal", translationsEnabled: true });
    const turnedOffAgain = await renderLanguageTreeRightPane(chapter, { dataDir: fixture.dataDir, displayMode: "normal", translationsEnabled: false });

    assert.equal(chapter.translationPath, "units/dutch-core/chapter-001-basic-sentences-1/reading-translation.en.json");
    assert.equal(chapter2.translationPath, "units/dutch-core/chapter-002-basic-sentences-2/reading-translation.en.json");
    assert.doesNotMatch(normal, /English translation|I'm Alex Chen|I'm a teacher/u);
    assert.doesNotMatch(developer, /English translation|I'm Alex Chen|I'm a teacher/u);
    assert.equal(turnedOffAgain, normal);
    assert.match(translatedNormal, /### Natural English Translation/u);
    assert.match(translatedDeveloper, /### Natural English Translation/u);
    assert.doesNotMatch(chineseSourceOff, /English translation|I'm Alex Chen|I'm a teacher/u);
    assert.match(chineseSourceOff, /Alex\s+: Hallo\./u);
    assert.match(chineseSourceOn, /### Natural English Translation|I'm Alex Chen|I'm a teacher/u);
    assert.match(chineseSourceOn, /Alex\s+: Hallo\./u);
    const originalStart = translatedNormal.indexOf("Alex   : Hallo.");
    const originalEnd = translatedNormal.indexOf("Marieke: Ik ben docent.");
    const translationHeading = translatedNormal.indexOf("### Natural English Translation");
    const translationStart = translatedNormal.indexOf("Alex   : Hello.");
    const translationEnd = translatedNormal.indexOf("Marieke: I'm a teacher.");
    const vocabularyHeading = translatedNormal.indexOf("### New Vocabulary");
    assert.ok(originalStart >= 0);
    assert.ok(originalStart < originalEnd);
    assert.ok(originalEnd < translationHeading);
    assert.ok(translationHeading < translationStart);
    assert.ok(translationStart < translationEnd);
    assert.ok(translationEnd < vocabularyHeading);
    assert.doesNotMatch(translatedNormal.slice(originalStart, originalEnd), /English translation|I'm |Hello\./u);
    assert.deepEqual(
      translatedNormal.slice(translationStart, translationEnd + "Marieke: I'm a teacher.".length).split("\n"),
      [
        "Alex   : Hello.",
        "Sophie : Hello.",
        "Alex   : I'm Alex Chen.",
        "Sophie : I'm Sophie de Vries.",
        "Alex   : I'm a student.",
        "Sophie : I'm a student.",
        "Alex   : Hi, friend.",
        "Marieke: I'm Marieke Smit.",
        "Marieke: I'm a teacher."
      ]
    );
    assert.deepEqual(
      chineseSourceOn.slice(chineseSourceOn.indexOf("### Natural English Translation"), chineseSourceOn.indexOf("### New Vocabulary")),
      translatedNormal.slice(translatedNormal.indexOf("### Natural English Translation"), translatedNormal.indexOf("### New Vocabulary"))
    );

    const styledChapterToggleOff = renderTwoPaneLanguageTree(chapter, new Set(), 0, normal, true, 0, 36, "en-US", "toggles", 150, 2, "normal", false);
    const styledChapterToggleOn = renderTwoPaneLanguageTree(chapter, new Set(), 0, translatedNormal, true, 0, 36, "en-US", "toggles", 150, 2, "normal", true);
    const chapterToggleOff = stripAnsi(styledChapterToggleOff);
    const chapterToggleOn = stripAnsi(styledChapterToggleOn);
    const chineseToggleOff = stripAnsi(renderTwoPaneLanguageTree(chapter, new Set(), 0, chineseSourceOff, true, 0, 36, "zh-Hant-TW", "toggles", 150, 2, "normal", false));
    const chineseToggleOn = stripAnsi(renderTwoPaneLanguageTree(chapter, new Set(), 0, chineseSourceOn, true, 0, 36, "zh-Hant-TW", "toggles", 150, 2, "normal", true));
    const chapter2TranslatedMarkdown = await renderLanguageTreeRightPane(chapter2, { dataDir: fixture.dataDir, translationsEnabled: true });
    const chapter2Translated = stripAnsi(renderTwoPaneLanguageTree(chapter2, new Set(), 0, chapter2TranslatedMarkdown, true, 0, 36, "en-US", "toggles", 150, 2, "normal", true));
    assert.match(chapterToggleOff, /> Translation: Off/u);
    assert.match(chapterToggleOn, /> Translation: On/u);
    assert.match(chapterToggleOff, /Source: English/u);
    assert.match(chapterToggleOff, /Alex\s+: Hallo\./u);
    assert.doesNotMatch(chapterToggleOff, /I'm Alex Chen|I'm a teacher/u);
    assert.match(chapterToggleOn, /Source: English/u);
    assert.match(chapterToggleOn, /Alex\s+: Hallo\./u);
    assert.match(chapterToggleOn, /Natural English Translation/u);
    assert.match(chapterToggleOn, /Alex\s+: Hello\./u);
    assert.match(styledChapterToggleOff, /\x1b\[38;5;141mAlex   :\x1b\[0m \x1b\[38;5;213mHallo\.\x1b\[0m/u);
    assert.match(styledChapterToggleOn, /\x1b\[38;5;141mAlex   :\x1b\[0m \x1b\[38;5;213mHallo\.\x1b\[0m/u);
    assert.match(styledChapterToggleOn, /\x1b\[38;5;141mAlex   :\x1b\[0m \x1b\[38;5;213mHello\.\x1b\[0m/u);
    assert.match(chineseToggleOff, /Source: 中文（臺灣）/u);
    assert.match(chineseToggleOff, /Translation: Off/u);
    assert.match(chineseToggleOff, /Alex\s+: Hallo\./u);
    assert.doesNotMatch(chineseToggleOff, /I'm Alex Chen|I'm a teacher/u);
    assert.match(chineseToggleOn, /Source: 中文（臺灣）/u);
    assert.match(chineseToggleOn, /Translation: On/u);
    assert.match(chineseToggleOn, /Alex\s+: Hallo\./u);
    assert.match(chineseToggleOn, /Natural English Translation/u);
    assert.match(chineseToggleOn, /Alex\s+: Hello\./u);
    assert.match(chapter2Translated, /> Translation: On/u);
    assert.match(chapter2TranslatedMarkdown, /### Natural English Translation[\s\S]*I am Daan de Vries\./u);
    assert.doesNotMatch(sectionBody(chapter2TranslatedMarkdown, "Natural English Translation"), /This chapter teaches|Daan and Sophie are brother and sister/u);
    assert.doesNotMatch(chapter2Translated, /I'm Alex Chen/u);

    assert.doesNotMatch(normal, /It does not introduce `je`, `jij`, or `u` yet\./u);
    assert.doesNotMatch(normal, /Do not turn this into a full verb-conjugation chapter yet\./u);
    assert.doesNotMatch(normal, /grammar_id:|DUT-GRAMMAR-001|See `ledger\.md`/u);
    assert.match(normal, /ben ← zijn.*encountered form.*infinitive citation form/u);
    assert.doesNotMatch(normal, /row marked `Infinitive`|\[\[grammar:Infinitive\]\]/u);
    assert.match(developer, /It does not introduce `je`, `jij`, or `u` yet\./u);
    assert.equal((developer.match(/^### Grammar$/gmu) ?? []).length, 1);
    assert.match(developer, /^#### Normal$/mu);
    assert.match(developer, /^#### Expert$/mu);
    assert.doesNotMatch(developer, /Grammar: Normal|Grammar: Expert/u);
    assert.doesNotMatch(developer, /grammar_id:|DUT-GRAMMAR-001/u);
    assert.match(developer, /See `ledger\.md`/u);

    const renderedNormal = renderTwoPaneLanguageTree(tree, new Set(), 0, normal, false, 0, 80, "en-US", "navigation", 180);
    const renderedDeveloper = renderTwoPaneLanguageTree(tree, new Set(), 0, developer, false, 0, 80, "en-US", "navigation", 180, 1, "developer");
    const outputLines = renderedNormal.split("\n").map(rightPaneCell);
    const forms = ["Hallo ← hallo", "Dag ← dag", "Ik ← ik", "ben ← zijn", "student ← de student", "docent ← de docent", "de vriend"];
    const entryIndexes = forms.map((form) => outputLines.findIndex((line) => new RegExp(`^\\| ${escapeRegExp(form)}\\s+\\|`, "u").test(line)));
    assert.equal(entryIndexes.every((index) => index >= 0), true);
    assert.deepEqual([...entryIndexes].sort((left, right) => left - right), entryIndexes);
    assert.match(outputLines[entryIndexes[3]], /ben ← zijn\s+\| am\s+\| verb\s+\| encountered verb form/u);
    assert.equal(outputLines.some((line) => /^\| zijn\s+\| to be\s+\| Infinitive/u.test(line)), false);
    const vocabularyRows = (rendered) => {
      const lines = rendered.split("\n").map(rightPaneCell);
      const start = lines.findIndex((line) => /^\| Form\s+\| Meaning\s+\| Part of speech\s+\| Note\s+\|$/u.test(line));
      const end = lines.findIndex((line) => /^\| de vriend\s+\|/u.test(line));
      return lines.slice(start, end + 1);
    };
    assert.deepEqual(vocabularyRows(renderedDeveloper), vocabularyRows(renderedNormal));
    assert.doesNotMatch(renderedNormal, /<br\s*\/?\s*>/iu);
  } finally {
    await fixture.cleanup();
  }
});

test("Vietnamese Chapter 1 uses the public output-pane translation path in every view", async () => {
  const fixture = await createInstalledLanguageFixture(["vietnamese-curriculum"], ["com.sleepymario.language.vietnamese"]);
  try {
    for (const displayMode of ["normal", "expert", "developer"]) {
      const tree = await buildLanguageTree(fixture.dataDir, displayMode);
      const vietnamese = tree.children.find((node) => node.label === "Vietnamese");
      const readContent = vietnamese.children.find((node) => node.label === "Read content");
      const chapter = readContent.children.find((node) => node.filePath === "units/vietnamese-core/chapter-001-basic-sentences-1/chapter.md");
      const off = await renderLanguageTreeRightPane(chapter, { dataDir: fixture.dataDir, displayMode, translationsEnabled: false });
      const on = await renderLanguageTreeRightPane(chapter, { dataDir: fixture.dataDir, displayMode, translationsEnabled: true });
      assert.match(off, /Maria\s+: Xin chào\./u);
      assert.doesNotMatch(off, /Natural English Translation|Maria\s+: Hello\./u);
      assert.match(on, /### Natural English Translation[\s\S]*Maria\s+: Hello\./u);
      assert.doesNotMatch(on, /Complete Rereading|Reread the nine-line/u);
      if (displayMode === "developer") assert.match(on, /^id: vie-core-001$/mu);
      else assert.doesNotMatch(on, /vie-core-001|grammar_easy_reference|ledger_before/u);

      const dialogueHeading = "### Dialogue";
      const readingExcerpt = on.slice(on.indexOf(dialogueHeading), on.indexOf("### New Vocabulary"));
      const visible = renderTwoPaneLanguageTree(tree, new Set(), 0, readingExcerpt, true, 0, 80, "zh-Hant-TW", "navigation", 170, 0, displayMode, true);
      assert.match(visible, /Source: 中文（臺灣）/u);
      assert.match(visible, /Translation: On/u);
      assert.match(visible, /\x1b\[38;5;141mMaria\s+:\x1b\[0m \x1b\[38;5;213mXin chào\.\x1b\[0m/u);
      assert.match(visible, /\x1b\[38;5;141mMaria\s+:\x1b\[0m \x1b\[38;5;213mHello\.\x1b\[0m/u);
    }
  } finally {
    await fixture.cleanup();
  }
});

test("Dutch Chapters 2–5 expose distinct views, independent support, and staged reading structure", async () => {
  const fixture = await createInstalledDutchFixture();
  try {
    const tree = await buildLanguageTree(fixture.dataDir, "developer");
    const dutch = tree.children.find((node) => node.label === "Dutch");
    const readContent = dutch.children.find((node) => node.label === "Read content");
    const expectedType = new Map([[2, "Narrative"], [3, "Dialogue"], [4, "Narrative"], [5, "Dialogue"]]);
    for (const chapterNumber of [2, 3, 4, 5]) {
      const chapter = readContent.children.find((node) => node.filePath?.includes(`chapter-${String(chapterNumber).padStart(3, "0")}-`));
      assert.ok(chapter);
      const normal = await renderLanguageTreeRightPane(chapter, { dataDir: fixture.dataDir, displayMode: "normal" });
      const expert = await renderLanguageTreeRightPane(chapter, { dataDir: fixture.dataDir, displayMode: "expert" });
      const developer = await renderLanguageTreeRightPane(chapter, { dataDir: fixture.dataDir, displayMode: "developer" });
      const translated = await renderLanguageTreeRightPane(chapter, { dataDir: fixture.dataDir, displayMode: "normal", translationsEnabled: true });
      const breakdown = await renderLanguageTreeRightPane(chapter, { dataDir: fixture.dataDir, displayMode: "normal", breakdownEnabled: true });
      const both = await renderLanguageTreeRightPane(chapter, { dataDir: fixture.dataDir, displayMode: "expert", translationsEnabled: true, breakdownEnabled: true });

      assert.notEqual(normal, expert, `Chapter ${chapterNumber} Normal and Expert differ`);
      assert.match(normal, new RegExp(`### ${expectedType.get(chapterNumber)}`, "u"));
      assert.doesNotMatch(normal, /^#{1,6}\s+(?:Content|Learner-facing Dialogue|Learner-facing Narrative|Complete Rereading)\s*$/imu);
      assert.doesNotMatch(expert, /^#{1,6}\s+(?:Content|Complete Rereading)\s*$/imu);
      assert.match(normal, /### Grammar/u);
      assert.doesNotMatch(normal, /Grammar: Expert|Expert context/u);
      assert.match(expert, /### Grammar/u);
      assert.match(expert, /Expert context|copular|interrogative|existential/u);
      assert.equal((developer.match(/^### Grammar$/gmu) ?? []).length, 1);
      assert.match(developer, /^#### Normal$/mu);
      assert.match(developer, /^#### Expert$/mu);
      assert.doesNotMatch(developer, /Grammar: Normal|Grammar: Expert/u);
      assert.doesNotMatch(developer, /^#{1,6}\s+(?:Content|Complete Rereading)\s*$/imu);
      assert.doesNotMatch(normal, /Natural English Translation|Line-by-line Breakdown/u);
      assert.match(translated, /### Natural English Translation/u);
      assert.doesNotMatch(translated, /Line-by-line Breakdown/u);
      assert.match(breakdown, /### Line-by-line Breakdown/u);
      assert.doesNotMatch(breakdown, /Natural English Translation/u);
      assert.match(both, /### Natural English Translation[\s\S]*### Line-by-line Breakdown/u);
      const grammarOnly = sectionBody(both, "Grammar");
      assert.doesNotMatch(grammarOnly, /Natural English Translation|Line-by-line Breakdown/u);
      const briefIntroduction = sectionBody(normal, "Brief Introduction");
      assert.match(briefIntroduction.trimStart(), /^This chapter (?:teaches|introduces)/u);
      const readingBlocks = sectionBody(normal, expectedType.get(chapterNumber)).split(/\n\s*\n/u).filter(Boolean);
      assert.ok(readingBlocks.length >= 2, `Chapter ${chapterNumber} has a separate scene introduction and reading body`);
      const sceneIntroduction = readingBlocks[0];
      assert.doesNotMatch(sceneIntroduction, /^This chapter (?:teaches|introduces)/u);
      assert.doesNotMatch(sectionBody(translated, "Natural English Translation"), new RegExp(escapeRegExp(sceneIntroduction), "u"));

      const targets = new Map([
        [2, { normal: "Mijn naam is N", expert: "Mijn naam is N", developer: "Mijn naam is N" }],
        [3, { normal: "Dit is N", expert: "Dit is N", developer: "Dit is N" }],
        [4, { normal: "Is dit N?", expert: "is", developer: "Is dit N?" }],
        [5, { normal: "Er is N", expert: "er", developer: "Er is N" }]
      ]).get(chapterNumber);
      for (const [mode, markdown] of [["normal", normal], ["expert", expert], ["developer", developer]]) {
        const target = targets[mode];
        const grammarMarkdown = `### Grammar\n\n${sectionBody(markdown, "Grammar")}`;
        const colored = renderTwoPaneLanguageTree(tree, new Set(), 0, grammarMarkdown, true, 0, 80, "en-US", "navigation", 220, 0, mode);
        const blueTarget = `\x1b[34m${target}\x1b[0m`;
        assert.ok(colored.includes(blueTarget), `Chapter ${chapterNumber} ${mode} has one semantic blue grammar span`);
        assert.doesNotMatch(colored, new RegExp(`\\x1b\\[1m${escapeRegExp(target)}\\x1b\\[0m`, "u"));
        assert.doesNotMatch(blueTarget, /\x1b\[0m[^\x1b]+\x1b\[34m/u);
      }
    }

    const semanticFixture = renderTwoPaneLanguageTree(tree, new Set(), 0, "### Grammar\n\n**Important explanation** uses `Dit is N`.", true, 0, 20, "en-US", "navigation", 140);
    assert.match(semanticFixture, /\x1b\[1mImportant explanation\x1b\[0m uses \x1b\[34mDit is N\x1b\[0m\./u);
    assert.doesNotMatch(semanticFixture, /\x1b\[34mImportant explanation/u);

    const chapter2 = readContent.children.find((node) => node.filePath?.includes("chapter-002-"));
    const chapter4 = readContent.children.find((node) => node.filePath?.includes("chapter-004-"));
    for (const chapter of [chapter2, chapter4]) {
      const translated = await renderLanguageTreeRightPane(chapter, { dataDir: fixture.dataDir, displayMode: "normal", translationsEnabled: true });
      const rendered = stripAnsi(renderTwoPaneLanguageTree(chapter, new Set(), 0, translated, true, 0, 50, "en-US", "navigation", 180));
      const cells = rendered.split("\n").map(rightPaneCell).filter(Boolean);
      assert.equal(cells.some((line) => /Hallo\. Ik ben Daan|Dit is een boek\. Is dit een boek/u.test(line)), false);
      assert.equal(cells.some((line) => /Hello\. I am Daan|This is a book\. Is this a book/u.test(line)), false);
    }
  } finally {
    await fixture.cleanup();
  }
});

test("Dutch Chapters 6–10 expose complete audience support, translations, breakdowns, and the 6–10 review block", async () => {
  const fixture = await createInstalledDutchFixture();
  try {
    const tree = await buildLanguageTree(fixture.dataDir, "developer");
    const dutch = tree.children.find((node) => node.label === "Dutch");
    const readContent = dutch.children.find((node) => node.label === "Read content");
    const expectedType = new Map([[6, "Narrative"], [7, "Dialogue"], [8, "Narrative"], [9, "Dialogue"], [10, "Narrative"]]);
    for (const chapterNumber of [6, 7, 8, 9, 10]) {
      const chapter = readContent.children.find((node) => node.filePath?.includes("chapter-" + String(chapterNumber).padStart(3, "0") + "-"));
      assert.ok(chapter);
      assert.match(chapter.translationPath ?? "", /reading-translation\.en\.json$/u);
      assert.match(chapter.readingSupportPath ?? "", /reading-support\.json$/u);
      const normal = await renderLanguageTreeRightPane(chapter, { dataDir: fixture.dataDir, displayMode: "normal" });
      const expert = await renderLanguageTreeRightPane(chapter, { dataDir: fixture.dataDir, displayMode: "expert" });
      const developer = await renderLanguageTreeRightPane(chapter, { dataDir: fixture.dataDir, displayMode: "developer" });
      const translated = await renderLanguageTreeRightPane(chapter, { dataDir: fixture.dataDir, displayMode: "normal", translationsEnabled: true });
      const breakdown = await renderLanguageTreeRightPane(chapter, { dataDir: fixture.dataDir, displayMode: "normal", breakdownEnabled: true });
      const both = await renderLanguageTreeRightPane(chapter, { dataDir: fixture.dataDir, displayMode: "expert", translationsEnabled: true, breakdownEnabled: true });

      assert.notEqual(normal, expert, "Chapter " + chapterNumber + " Normal and Expert differ");
      assert.match(normal, new RegExp("### " + expectedType.get(chapterNumber), "u"));
      assert.doesNotMatch(normal, /^#{1,6}\s+(?:Content|Learner-facing Dialogue|Learner-facing Controlled Reading|Complete Rereading)\s*$/imu);
      assert.doesNotMatch(normal, /Canonical Identity|DUT-GRAMMAR-\d+|Original Vocabulary Source Notes|Raw Usage/u);
      assert.doesNotMatch(expert, /Canonical Identity|DUT-GRAMMAR-\d+|Original Vocabulary Source Notes/u);
      assert.doesNotMatch(developer, /Canonical Identity|DUT-GRAMMAR-\d+/u);
      assert.match(normal, /### Grammar/u);
      assert.match(expert, /### Grammar/u);
      assert.equal((developer.match(/^### Grammar$/gmu) ?? []).length, 1);
      assert.match(developer, /^#### Normal$/mu);
      assert.match(developer, /^#### Expert$/mu);
      assert.doesNotMatch(normal, /Natural English Translation|Line-by-line Breakdown/u);
      assert.match(translated, /### Natural English Translation/u);
      assert.match(breakdown, /### Line-by-line Breakdown/u);
      assert.match(both, /### Natural English Translation[\s\S]*### Line-by-line Breakdown/u);
      assert.doesNotMatch(sectionBody(both, "Grammar"), /Natural English Translation|Line-by-line Breakdown/u);
      const briefIntroduction = sectionBody(normal, "Brief Introduction");
      assert.match(briefIntroduction.trimStart(), /^This chapter (?:teaches|introduces)/u);
      const readingBlocks = sectionBody(normal, expectedType.get(chapterNumber)).split(/\n\s*\n/u).filter(Boolean);
      assert.ok(readingBlocks.length >= 2, `Chapter ${chapterNumber} has a separate scene introduction and reading body`);
      const sceneIntroduction = readingBlocks[0];
      assert.doesNotMatch(sceneIntroduction, /^This chapter (?:teaches|introduces)/u);
      assert.doesNotMatch(sectionBody(translated, "Natural English Translation"), new RegExp(escapeRegExp(sceneIntroduction), "u"));

      const grammarMarkdown = "### Grammar\n\n" + sectionBody(normal, "Grammar");
      const colored = renderTwoPaneLanguageTree(tree, new Set(), 0, grammarMarkdown, true, 0, 80, "en-US", "navigation", 220);
      const expectedTarget = new Map([[6, "Ik heb N"], [7, "Heb je N?"], [8, "Ik wil N"], [9, "Ik ga naar N"], [10, "Ik woon in N"]]).get(chapterNumber);
      assert.ok(colored.includes("\x1b[34m" + expectedTarget + "\x1b[0m"));
      assert.doesNotMatch(colored, new RegExp("\\x1b\\[1m" + escapeRegExp(expectedTarget) + "\\x1b\\[0m", "u"));

      if (expectedType.get(chapterNumber) === "Narrative") {
        const narrativeBlocks = sectionBody(normal, "Narrative").split(/\n\s*\n/u).filter(Boolean);
        const targetLines = narrativeBlocks.slice(1).join("\n").split("\n").filter((line) => line.trim().length > 0);
        const translatedLines = sectionBody(translated, "Natural English Translation").split("\n").filter((line) => line.trim().length > 0);
        assert.equal(targetLines.every((line) => sentenceCountForTest(line) === 1), true);
        assert.equal(translatedLines.length, targetLines.length);
        assert.equal(translatedLines.every((line) => sentenceCountForTest(line) === 1), true);
      }
    }

    const chapter10Index = readContent.children.findIndex((node) => node.filePath?.includes("chapter-010-basic-sentences-10/chapter.md"));
    const review610 = readContent.children[chapter10Index + 1];
    const chapter11Index = readContent.children.findIndex((node) => node.filePath?.includes("chapter-011-"));
    assert.equal(review610?.label, "Review -- Chapters 6–10");
    assert.equal(review610?.kind, "review-source");
    assert.equal(review610?.sourcePath, "review-decks/chapter-006-010/cards.tsv");
    assert.equal(review610?.itemCount, 84);
    assert.equal(chapter10Index < chapter11Index && chapter10Index + 1 < chapter11Index, true);
    assert.equal(readContent.children.some((node) => /Review -- Chapters 5[–-]10/u.test(node.label)), false);
  } finally {
    await fixture.cleanup();
  }
});

test("Chapter 1 audience support, Breakdown, and Vietnamese Characters change visible output independently", async () => {
  const fixture = await createInstalledLanguageFixture(["vietnamese-curriculum", "dutch-curriculum"], ["com.sleepymario.language.vietnamese", "com.sleepymario.language.dutch"]);
  try {
    const tree = await buildLanguageTree(fixture.dataDir);
    const chapterFor = (language, path) => tree.children.find((node) => node.label === language).children
      .find((node) => node.label === "Read content").children.find((node) => node.filePath === path);
    const vi = chapterFor("Vietnamese", "units/vietnamese-core/chapter-001-basic-sentences-1/chapter.md");
    const nl = chapterFor("Dutch", "units/dutch-core/chapter-001-basic-sentences-1/chapter.md");
    assert.match(vi.readingSupportPath, /reading-support\.json$/u);
    assert.match(nl.readingSupportPath, /reading-support\.json$/u);

    const viNormal = await renderLanguageTreeRightPane(vi, { dataDir: fixture.dataDir, displayMode: "normal" });
    const viExpert = await renderLanguageTreeRightPane(vi, { dataDir: fixture.dataDir, displayMode: "expert" });
    const viBreakdown = await renderLanguageTreeRightPane(vi, { dataDir: fixture.dataDir, displayMode: "normal", breakdownEnabled: true });
    const viCharacters = await renderLanguageTreeRightPane(vi, { dataDir: fixture.dataDir, displayMode: "normal", charactersEnabled: true });
    const viDeveloper = await renderLanguageTreeRightPane(vi, { dataDir: fixture.dataDir, displayMode: "developer", breakdownEnabled: true, charactersEnabled: true });
    assert.notEqual(viNormal, viExpert);
    assert.match(viNormal, /### Dialogue/u);
    assert.doesNotMatch(viNormal, /Learner-facing Dialogue|Line-by-line Breakdown|Sino-Vietnamese/u);
    assert.match(viNormal, /one way to say who you are/u);
    assert.doesNotMatch(viNormal, /socially deictic|later chapters expand/u);
    assert.match(viExpert, /socially deictic|analytic and lacks subject agreement/u);
    assert.match(viBreakdown, /### Line-by-line Breakdown[\s\S]*complete greeting/u);
    assert.doesNotMatch(viBreakdown, /Sino-Vietnamese/u);
    assert.match(viCharacters, /### Sino-Vietnamese Vocabulary[\s\S]*sinh viên \| 生員/u);
    assert.doesNotMatch(viCharacters, /Line-by-line Breakdown/u);
    assert.match(viDeveloper, /Brief Introduction: Normal[\s\S]*Brief Introduction: Expert/u);
    assert.match(viDeveloper, /Line-by-line Breakdown: Normal[\s\S]*Line-by-line Breakdown: Expert/u);

    const nlNormal = await renderLanguageTreeRightPane(nl, { dataDir: fixture.dataDir, displayMode: "normal" });
    const nlExpert = await renderLanguageTreeRightPane(nl, { dataDir: fixture.dataDir, displayMode: "expert" });
    const nlBreakdown = await renderLanguageTreeRightPane(nl, { dataDir: fixture.dataDir, displayMode: "normal", breakdownEnabled: true });
    assert.notEqual(nlNormal, nlExpert);
    assert.match(nlNormal, /such as \[\[grammar:de student\]\] and \[\[grammar:de docent\]\]/u);
    assert.doesNotMatch(nlNormal, /suppletive|article syncretism|later chapters/u);
    assert.match(nlExpert, /suppletive present form|article syncretism|Expert context/u);
    assert.match(nlBreakdown, /### Line-by-line Breakdown[\s\S]*friendly greeting/u);
    assert.match(nlBreakdown, /- \[\[grammar:Ik ben Alex Chen\.\]\] uses the same pattern with a name\./u);
    assert.match(nlBreakdown, /- \[\[grammar:Ik ben Sophie de Vries\.\]\] uses the same pattern with a name\./u);
    assert.match(nlBreakdown, /- \[\[grammar:Ik ben Marieke Smit\.\]\] uses the same pattern with a name\./u);
    assert.doesNotMatch(nlBreakdown, /\[\[grammar:Ik ben (?:Alex Chen|Sophie de Vries)\.\]\] use the same pattern/u);
    assert.match(viBreakdown, /- `Tôi là Maria Garcia\.` uses the same pattern with a name\./u);
    assert.match(viBreakdown, /- `Tôi là Nguyễn Minh Anh\.` uses the same pattern with a name\./u);
    assert.match(viBreakdown, /- `Tôi là Trần Thu Hà\.` uses the same pattern with a name\./u);
    assert.doesNotMatch(viBreakdown, /`Tôi là (?:Maria Garcia|Nguyễn Minh Anh)\.` use the same pattern/u);

    const usageNotes = `### Dutch Usage Notes\n\n${sectionBody(nlNormal, "Dutch Usage Notes")}`;
    const colored = renderTwoPaneLanguageTree(tree, new Set(), 0, usageNotes, true, 0, 40, "en-US", "navigation", 130);
    const completeBluePhrase = "\x1b[34mde student\x1b[0m";
    assert.ok(colored.includes(completeBluePhrase));
    assert.doesNotMatch(colored, /\x1b\[34mde\x1b\[0m\s+student/u);
    assert.doesNotMatch(colored, /\x1b\[34mde\x1b\[0m|\x1b\[0mstudent/u);
    const normalWidthPhraseLine = colored.split("\n").map(stripAnsi).find((line) => line.includes("de student"));
    assert.match(normalWidthPhraseLine, /such as de student/u);

    const narrow = renderTwoPaneLanguageTree(tree, new Set(), 0, usageNotes, true, 0, 40, "en-US", "navigation", 60);
    assert.ok(narrow.includes(completeBluePhrase));
    const narrowPhraseLine = narrow.split("\n").map(stripAnsi).find((line) => line.includes("de student"));
    assert.match(narrowPhraseLine, /such as de student/u);
    assert.doesNotMatch(narrowPhraseLine, /^student\b/u);

    for (const breakdown of [nlBreakdown, viBreakdown]) {
      const breakdownExcerpt = breakdown.slice(breakdown.indexOf("### Line-by-line Breakdown"));
      const visibleBreakdown = renderTwoPaneLanguageTree(tree, new Set(), 0, breakdownExcerpt, true, 0, 40, "en-US", "navigation", 100);
      assert.match(visibleBreakdown, /\x1b\[34m(?:Ik ben|Tôi là)[^\x1b]+\.\x1b\[0m uses the same/u);
      const explanatoryLines = visibleBreakdown.split("\n")
        .map(rightPaneCell)
        .filter((line) => /uses the same|pattern with a name/u.test(stripAnsi(line)));
      assert.ok(explanatoryLines.length > 0);
      for (const line of explanatoryLines) {
        const explanation = line.includes("uses") ? line.slice(line.indexOf("uses")) : line;
        assert.doesNotMatch(explanation, /\x1b\[(?:33|38;5;208)m/u);
      }
    }
    const togglePane = stripAnsi(renderTwoPaneLanguageTree(tree, new Set(), 0, viNormal, false, 0, 20, "en-US", "toggles", 170, 4, "normal", false, false, false, true));
    assert.match(togglePane, /Translation: Off/u);
    assert.match(togglePane, /Characters: Off/u);
    assert.match(togglePane, /> Breakdown: Off/u);
  } finally {
    await fixture.cleanup();
  }
});

test("Vietnamese Chapters 1–50 project beginner Language Notes without flattening Expert or Developer notes", async () => {
  const fixture = await createInstalledLanguageFixture(["vietnamese-curriculum"], ["com.sleepymario.language.vietnamese"]);
  const sourceHeadings = new Map([
    [1, ["Vietnamese Orthography and Word Boundaries", "Register Note"]],
    [2, ["Vietnamese Word Boundaries and Register"]],
    [3, ["Vietnamese Orthography and Usage"]],
    [4, ["Register and Word Boundaries"]],
    [5, ["Vietnamese Orthography and Word Boundaries"]],
    [6, ["Vietnamese Orthography and Word Boundaries"]],
    [8, ["Vietnamese Orthography and Word Boundaries"]],
    [9, ["Vietnamese Orthography and Word Boundaries"]],
    ...Array.from({ length: 40 }, (_, index) => [index + 11, ["Vietnamese Usage Notes"]])
  ]);
  const prohibitedNormalPhrases = [
    "Vietnamese Usage Notes",
    "Vietnamese Orthography and Word Boundaries",
    "Vietnamese Word Boundaries and Register",
    "Vietnamese Orthography and Usage",
    "Register Note",
    "Register and Word Boundaries",
    "taught frame",
    "orthographic word boundaries",
    "discourse-level contrast",
    "pragmatic interpretation",
    "deictic reference",
    "interlocutor hierarchy",
    "morphosyntactic distribution"
  ];
  const assertHeadingSpacing = (markdown, chapter, mode) => {
    const lines = markdown.split("\n");
    for (const [index, line] of lines.entries()) {
      if (!/^#{1,6}\s+\S/u.test(line)) continue;
      assert.equal(lines[index - 1], "", `Chapter ${chapter} ${mode} heading has one blank line above`);
      assert.equal(lines[index + 1], "", `Chapter ${chapter} ${mode} heading has one blank line below`);
      assert.notEqual(lines[index - 2], "", `Chapter ${chapter} ${mode} heading has no doubled blank above`);
      assert.notEqual(lines[index + 2], "", `Chapter ${chapter} ${mode} heading has no doubled blank below`);
    }
  };

  try {
    const tree = await buildLanguageTree(fixture.dataDir, "developer");
    const vietnamese = tree.children.find((node) => node.label === "Vietnamese");
    const readContent = vietnamese.children.find((node) => node.label === "Read content");
    const chapters = readContent.children.filter((node) => /\/chapter-\d{3}-basic-sentences-\d+\/chapter\.md$/u.test(node.filePath ?? ""));
    assert.equal(chapters.length, 50);
    assert.ok(chapters.some((node) => node.filePath.includes("chapter-050-basic-sentences-50")));
    assert.equal(chapters.some((node) => node.filePath.includes("chapter-051-")), false);

    for (let chapterNumber = 1; chapterNumber <= 50; chapterNumber += 1) {
      const padded = String(chapterNumber).padStart(3, "0");
      const chapter = chapters.find((node) => node.filePath.includes(`/chapter-${padded}-`));
      assert.ok(chapter, `Chapter ${chapterNumber} is projected`);
      const normal = await renderLanguageTreeRightPane(chapter, { dataDir: fixture.dataDir, displayMode: "normal" });
      const expert = await renderLanguageTreeRightPane(chapter, { dataDir: fixture.dataDir, displayMode: "expert" });
      const developer = await renderLanguageTreeRightPane(chapter, { dataDir: fixture.dataDir, displayMode: "developer" });
      const support = JSON.parse((await readInstalledContentEntry({
        dataDir: fixture.dataDir,
        packageId: chapter.packageId,
        packageVersion: chapter.packageVersion,
        path: chapter.readingSupportPath,
        locale: "en-US"
      })).text);
      const withCharacters = await renderLanguageTreeRightPane(chapter, {
        dataDir: fixture.dataDir,
        displayMode: "normal",
        charactersEnabled: support.characters !== undefined
      });

      for (const phrase of prohibitedNormalPhrases) assert.doesNotMatch(normal, new RegExp(escapeRegExp(phrase), "iu"), `Chapter ${chapterNumber} Normal hides ${phrase}`);
      const expectedHeadings = sourceHeadings.get(chapterNumber) ?? [];
      assert.equal((normal.match(/^### Language Notes$/gmu) ?? []).length, expectedHeadings.length === 0 ? 0 : 1);
      for (const heading of expectedHeadings) {
        assert.match(expert, new RegExp(`^### ${escapeRegExp(heading)}$`, "mu"));
        assert.match(developer, new RegExp(`^### ${escapeRegExp(heading)}: Normal$`, "mu"));
        assert.match(developer, new RegExp(`^### ${escapeRegExp(heading)}: Expert$`, "mu"));
      }
      assert.match(normal, /^### (?:Dialogue|Narrative)$/mu);
      assert.match(normal, /^### New Vocabulary$/mu);
      assert.match(normal, /^### (?:New )?Grammar(?: \/ Pattern)?$/mu);
      assert.equal(/^### Sino-Vietnamese Vocabulary$/mu.test(withCharacters), support.characters !== undefined);
      assertHeadingSpacing(normal, chapterNumber, "Normal");
      assertHeadingSpacing(expert, chapterNumber, "Expert");
      assertHeadingSpacing(developer, chapterNumber, "Developer");
    }

    const chapter1 = chapters.find((node) => node.filePath.includes("chapter-001-"));
    const chapter26 = chapters.find((node) => node.filePath.includes("chapter-026-"));
    const chapter40 = chapters.find((node) => node.filePath.includes("chapter-040-"));
    assert.match(await renderLanguageTreeRightPane(chapter1, { dataDir: fixture.dataDir, displayMode: "expert" }), /diacritic|relative age/u);
    assert.match(await renderLanguageTreeRightPane(chapter26, { dataDir: fixture.dataDir, displayMode: "expert" }), /time reference also depends on context/u);
    assert.match(await renderLanguageTreeRightPane(chapter40, { dataDir: fixture.dataDir, displayMode: "expert" }), /beneficially affected subject|grammar IDs remain distinct/u);
  } finally {
    await fixture.cleanup();
  }
});

test("Vietnamese Characters views use reader-safe tables while retaining packaged identity", async () => {
  const fixture = await createInstalledLanguageFixture(
    ["vietnamese-curriculum"],
    ["com.sleepymario.language.vietnamese"]
  );
  try {
    const tree = await buildLanguageTree(fixture.dataDir);
    const language = (label) => tree.children.find((node) => node.label === label).children.find((node) => node.label === "Read content");
    const vietnamese = language("Vietnamese");
    const expected = new Map([
      [2, ["nhân viên văn phòng", "人員文房"]],
      [3, ["sách", "冊", "bút", "筆", "bàn", "盤"]],
      [5, ["phòng học", "房學", "điện thoại", "電話", "trà", "茶"]],
      [8, ["cam", "柑"]],
      [40, ["miễn phí", "免費", "hướng dẫn", "向引"]],
      [41, ["không", "空", "số lượng", "數量"]],
      [50, ["xác nhận", "確認", "bảng tổng kết", "榜總結"]]
    ]);
    for (const [chapter, values] of expected) {
      const node = vietnamese.children.find((candidate) => candidate.filePath?.includes(`units/vietnamese-core/chapter-${String(chapter).padStart(3, "0")}-`));
      assert.ok(node?.readingSupportPath, `Chapter ${chapter} support is installed`);
      const support = JSON.parse((await readInstalledContentEntry({
        dataDir: fixture.dataDir,
        packageId: node.packageId,
        packageVersion: node.packageVersion,
        path: node.readingSupportPath,
        locale: "en-US"
      })).text);
      assert.ok(support.characters, `Chapter ${chapter} character support is installed`);
      const off = await renderLanguageTreeRightPane(node, { dataDir: fixture.dataDir, displayMode: "normal", charactersEnabled: false });
      assert.doesNotMatch(off, /Sino-Vietnamese Vocabulary/u);
      for (const mode of ["normal", "expert", "developer"]) {
        const output = await renderLanguageTreeRightPane(node, { dataDir: fixture.dataDir, displayMode: mode, charactersEnabled: true });
        assert.match(output, /### Sino-Vietnamese Vocabulary/u);
        assert.doesNotMatch(output, /Canonical Identity|Canonical ID|Lexical identity|Sense identity|canonicalIdentity|lexicalEntryId|senseId/u);
        for (const value of values) assert.match(output, new RegExp(value, "u"));
        if (mode !== "developer") {
          assert.match(output, /\| Word \| Characters \| Meaning \| Usage \|/u);
          assert.doesNotMatch(output, /\bEvidence\b/u);
        }
      }
      for (const entry of support.characters.entries) {
        assert.match(entry.lexicalEntryId, /^vi\./u);
        assert.match(entry.senseId, /^vi\./u);
        assert.equal(typeof entry.provenance.locator, "string");
      }
    }
    for (const chapter of [4, 14, 15, 27, 45]) {
      const node = vietnamese.children.find((candidate) => candidate.filePath?.includes(`units/vietnamese-core/chapter-${String(chapter).padStart(3, "0")}-`));
      assert.ok(node?.readingSupportPath, `Chapter ${chapter} support is installed`);
      for (const mode of ["normal", "expert", "developer"]) {
        const output = await renderLanguageTreeRightPane(node, { dataDir: fixture.dataDir, displayMode: mode, charactersEnabled: true });
        assert.doesNotMatch(output, /Sino-Vietnamese Vocabulary/u);
      }
    }

  } finally {
    await fixture.cleanup();
  }
});

test("target narrative introductions use base color while translations begin directly with pink body text", () => {
  const tree = { id: "whacksmacker", label: "WhackSmacker", kind: "root", children: [] };
  const markdown = [
    "# Chapter 2 -- Narrative fixture", "",
    "### Narrative", "", "Context for this narrative wraps", "across a source line.", "",
    "Dit is de eerste zin.", "Dit is de tweede zin.", "",
    "### Natural English Translation", "",
    "This is the first sentence.", "This is the second sentence."
  ].join("\n");
  const colored = renderTwoPaneLanguageTree(tree, new Set(), 0, markdown, true, 0, 80, "en-US", "navigation", 150);
  assert.match(colored, /Context for this narrative wraps across a source line\./u);
  assert.doesNotMatch(colored, /\x1b\[38;5;213mContext for/u);
  assert.match(colored, /\x1b\[38;5;213mDit is de eerste zin\.\x1b\[0m/u);
  assert.doesNotMatch(colored, /Context for the English narrative/u);
  assert.match(colored, /\x1b\[38;5;213mThis is the first sentence\.\x1b\[0m/u);
});

test("ordinary source hard wraps reflow at pane width without changing dialogue turns", () => {
  const tree = { id: "whacksmacker", label: "WhackSmacker", kind: "root", children: [] };
  const markdown = [
    "### Learner-facing Narrative", "",
    "Maria walks", "beside the canal and meets Marieke before class.", "",
    "### Learner-facing Dialogue", "",
    "Nguyễn Minh: Đây là một lời thoại dài cần xuống dòng theo chiều rộng của ô nội dung."
  ].join("\n");
  const output = stripAnsi(renderTwoPaneLanguageTree(tree, new Set(), 0, markdown, false, 0, 20, "en-US", "navigation", 100));
  assert.match(output, /Maria walks beside the canal/u);
  assert.equal((output.match(/Nguyễn Minh:/gu) ?? []).length, 1);
  assert.match(output, /lời thoại dài/u);
});

test("Chapter 20 narratives preserve sentence lines while Chapter 21 narratives use paragraphs", () => {
  const tree = { id: "whacksmacker", label: "WhackSmacker", kind: "root", children: [] };
  const renderCells = (markdown) => stripAnsi(renderTwoPaneLanguageTree(tree, new Set(), 0, markdown, false, 0, 20, "en-US", "navigation", 180))
    .split("\n").map(rightPaneCell).filter((line) => line.length > 0);
  const early = renderCells([
    "# Chapter 20 -- Early Narrative", "", "### Narrative", "",
    "Dit is een boek.", "Is dit een boek?", "", "### Natural English Translation", "",
    "This is a book.", "Is this a book?"
  ].join("\n"));
  assert.ok(early.includes("Dit is een boek."));
  assert.ok(early.includes("Is dit een boek?"));
  assert.ok(early.includes("This is a book."));
  assert.ok(early.includes("Is this a book?"));
  assert.equal(early.some((line) => line.includes("Dit is een boek. Is dit een boek?")), false);

  const later = renderCells([
    "# Chapter 21 -- Later Narrative", "", "### Narrative", "",
    "Dit is een boek.", "Is dit een boek?"
  ].join("\n"));
  assert.ok(later.includes("Dit is een boek. Is dit een boek?"));
});

test("Dutch Chapter 12 uses neutral audience-authored Normal and Developer wording", async () => {
  const fixture = await createInstalledDutchFixture();
  try {
    const tree = await buildLanguageTree(fixture.dataDir, "developer");
    const dutch = tree.children.find((node) => node.label === "Dutch");
    const readContent = dutch.children.find((node) => node.label === "Read content");
    const chapter = readContent.children.find((node) => node.label === "Chapter 12 -- A Simple Daily Routine");
    const normal = await renderLanguageTreeRightPane(chapter, { dataDir: fixture.dataDir, displayMode: "normal" });
    const developer = await renderLanguageTreeRightPane(chapter, { dataDir: fixture.dataDir, displayMode: "developer" });

    assert.doesNotMatch(normal, /the learner/iu);
    assert.match(normal, /The name \[\[grammar:Sophie\]\] comes before the action/u);
    assert.match(developer, /The name \[\[grammar:Sophie\]\] comes before the action/u);
    assert.match(developer, /The pattern \[\[grammar:Sophie \+ V stem-t\]\] keeps an overt third-person singular subject/u);
    assert.doesNotMatch(developer, /the learner/iu);
  } finally {
    await fixture.cleanup();
  }
});

test("Dutch Chapters 11-15 summaries render canonical patterns instead of developer descriptions", async () => {
  const fixture = await createInstalledDutchFixture();
  try {
    const tree = await buildLanguageTree(fixture.dataDir, "developer");
    const dutch = tree.children.find((node) => node.label === "Dutch");
    const readContent = dutch.children.find((node) => node.label === "Read content");
    const easyNode = readContent.children.find((node) => node.filePath === "units/dutch-core/chapter-011-015-grammar-easy/chapter.md");
    const chapter14Node = readContent.children.find((node) => node.filePath === "units/dutch-core/chapter-014-two-places-in-a-day/chapter.md");
    const easyNormal = await renderLanguageTreeRightPane(easyNode, { dataDir: fixture.dataDir, displayMode: "normal" });
    const hardNormal = await renderLanguageTreeRightPane(easyNode, { dataDir: fixture.dataDir, displayMode: "normal" });
    const hardExpert = await renderLanguageTreeRightPane(easyNode, { dataDir: fixture.dataDir, displayMode: "expert" });
    const easyDeveloper = await renderLanguageTreeRightPane(easyNode, { dataDir: fixture.dataDir, displayMode: "developer" });
    const hardDeveloper = easyDeveloper;
    const chapter14Normal = await renderLanguageTreeRightPane(chapter14Node, { dataDir: fixture.dataDir, displayMode: "normal" });
    const chapter14Developer = await renderLanguageTreeRightPane(chapter14Node, { dataDir: fixture.dataDir, displayMode: "developer" });
    const patterns = ["Hoe gaat het met je? / Het gaat goed.", "Sophie + V stem-t", "Ik + wil + graag + N", "clause + en + clause", "Waar woon je?"];

    for (const pattern of patterns) {
      assert.match(easyNormal, new RegExp(escapeRegExp(pattern), "u"));
      assert.match(hardExpert, new RegExp(escapeRegExp(pattern), "u"));
    }
    assert.doesNotMatch(easyNormal, /controlled third-person present actions with a named subject|DUT-GRAMMAR-/u);
    assert.equal(hardNormal, easyNormal);
    assert.doesNotMatch(hardExpert, /controlled third-person present actions with a named subject|DUT-GRAMMAR-/u);
    assert.doesNotMatch(easyDeveloper, /DUT-GRAMMAR-/u);
    assert.match(easyDeveloper, /Sophie \+ V stem-t/u);
    assert.match(hardDeveloper, /controlled third-person present actions with a named subject/u);
    assert.match(chapter14Normal, /#### idea \+ en \+ idea[\s\S]*Use \[\[grammar:en\]\] to join two complete ideas/u);
    assert.doesNotMatch(chapter14Normal, /DUT-GRAMMAR-014/u);
    assert.doesNotMatch(chapter14Developer, /DUT-GRAMMAR-/u);
    assert.match(chapter14Developer, /clause \+ en \+ clause/u);

    const renderedEasy = renderTwoPaneLanguageTree(tree, new Set(), 0, easyNormal, false, 0, 100, "en-US", "navigation", 180);
    const renderedHard = renderTwoPaneLanguageTree(tree, new Set(), 0, hardExpert, false, 0, 100, "en-US", "navigation", 180);
    assert.match(renderedEasy, /Sophie \+ V stem-t/u);
    assert.match(renderedHard, /clause \+ en \+ clause/u);
    assert.doesNotMatch(`${renderedEasy}\n${renderedHard}`, /controlled third-person present actions with a named subject/u);
  } finally {
    await fixture.cleanup();
  }
});

test("Dutch Chapters 16-20 summaries share canonical patterns and hide IDs in Normal", async () => {
  const fixture = await createInstalledDutchFixture();
  try {
    const tree = await buildLanguageTree(fixture.dataDir, "developer");
    const dutch = tree.children.find((node) => node.label === "Dutch");
    const readContent = dutch.children.find((node) => node.label === "Read content");
    const easyNode = readContent.children.find((node) => node.filePath === "units/dutch-core/chapter-016-020-grammar-easy/chapter.md");
    const chapter19Node = readContent.children.find((node) => node.filePath === "units/dutch-core/chapter-019-asking-for-help/chapter.md");
    const easyNormal = await renderLanguageTreeRightPane(easyNode, { dataDir: fixture.dataDir, displayMode: "normal" });
    const hardNormal = await renderLanguageTreeRightPane(easyNode, { dataDir: fixture.dataDir, displayMode: "normal" });
    const hardExpert = await renderLanguageTreeRightPane(easyNode, { dataDir: fixture.dataDir, displayMode: "expert" });
    const easyDeveloper = await renderLanguageTreeRightPane(easyNode, { dataDir: fixture.dataDir, displayMode: "developer" });
    const chapter19Normal = await renderLanguageTreeRightPane(chapter19Node, { dataDir: fixture.dataDir, displayMode: "normal" });
    const chapter19Developer = await renderLanguageTreeRightPane(chapter19Node, { dataDir: fixture.dataDir, displayMode: "developer" });
    const patterns = ["Ik + V stem", "Wat doe je?", "subject + verb + niet", "Kun je + infinitive?", "time + verb + subject + ..."];
    for (const pattern of patterns) {
      assert.match(easyNormal, new RegExp(escapeRegExp(pattern), "u"));
      assert.match(hardExpert, new RegExp(escapeRegExp(pattern), "u"));
    }
    assert.equal(hardNormal, easyNormal);
    assert.doesNotMatch(`${easyNormal}\n${hardExpert}\n${chapter19Normal}`, /DUT-GRAMMAR-/u);
    assert.doesNotMatch(easyDeveloper, /DUT-GRAMMAR-/u);
    assert.doesNotMatch(chapter19Developer, /DUT-GRAMMAR-/u);
    assert.match(chapter19Developer, /Kun je \+ infinitive\?/u);
    assert.match(chapter19Normal, /Kun ← kunnen[\s\S]*can[\s\S]*verb[\s\S]*encountered verb form[\s\S]*natuurlijk/u);
  } finally {
    await fixture.cleanup();
  }
});

test("Normal deck preview is unchanged while Developer adds package metadata", async () => {
  const fixture = await createInstalledDutchFixture();
  try {
    const tree = await buildLanguageTree(fixture.dataDir);
    const dutch = tree.children.find((node) => node.label === "Dutch");
    const decks = dutch.children.find((node) => node.label === "Review decks");
    const deck = decks.children[0];
    const before = (await listReadingReviewItems({ dataDir: fixture.dataDir, packageId: deck.packageId, packageVersion: deck.packageVersion, sourcePath: deck.sourcePath })).map((item) => [item.item.id, item.item.prompt.text, item.item.answer.text]);
    const normal = await renderLanguageTreeRightPane(deck, { dataDir: fixture.dataDir, displayMode: "normal" });
    const developer = await renderLanguageTreeRightPane(deck, { dataDir: fixture.dataDir, displayMode: "developer" });
    const after = (await listReadingReviewItems({ dataDir: fixture.dataDir, packageId: deck.packageId, packageVersion: deck.packageVersion, sourcePath: deck.sourcePath })).map((item) => [item.item.id, item.item.prompt.text, item.item.answer.text]);
    assert.deepEqual(after, before);
    assert.doesNotMatch(normal, /Developer metadata|Package ID:|Source path:/u);
    assert.equal(developer.startsWith(normal), true);
    assert.match(developer, /Developer metadata[\s\S]*Package ID:[\s\S]*Source path:/u);
  } finally {
    await fixture.cleanup();
  }
});

test("Vietnamese read content starts with five canonical Foundation labels before canonical Chapter 1", async () => {
  const fixture = await createInstalledLanguageFixture(["vietnamese-curriculum"], ["com.sleepymario.language.vietnamese"]);
  try {
    const tree = await buildLanguageTree(fixture.dataDir);
    const vietnamese = tree.children.find((node) => node.label === "Vietnamese");
    const readContent = vietnamese.children.find((node) => node.label === "Read content");

    assert.deepEqual(readContent.children.slice(0, 5).map((node) => node.label), [
      "Foundation Chapter -- 1",
      "Foundation Chapter -- 2",
      "Foundation Chapter -- 3",
      "Foundation Chapter -- 4",
      "Foundation Chapter -- 5"
    ]);
    assert.deepEqual(readContent.children.slice(0, 5).map((node) => node.filePath), [
      "units/vietnamese-foundation/chapter-001-alphabet-and-orthography/chapter.md",
      "units/vietnamese-foundation/chapter-002-tones/chapter.md",
      "units/vietnamese-foundation/chapter-003-vowels-and-diphthongs/chapter.md",
      "units/vietnamese-foundation/chapter-004-final-consonants-and-pronunciation-contrasts/chapter.md",
      "units/vietnamese-foundation/chapter-005-audio-dependent-drills/chapter.md"
    ]);
    assert.equal(readContent.children[5]?.filePath, "units/vietnamese-core/chapter-001-basic-sentences-1/chapter.md");
    assert.equal(readContent.children.some((node) => node.filePath === "units/vietnamese-core/chapter-010-basic-sentences-10/chapter.md"), true);
    assert.equal(readContent.children.some((node) => node.filePath === "units/vietnamese-core/chapter-050-basic-sentences-50/chapter.md"), true);
    assert.equal(readContent.children.some((node) => /units\/vietnamese-core\/chapter-(?:0*(?:5[1-9]|[6-9]\d)|[1-9]\d{3,})/u.test(node.filePath ?? "")), false);
    const grammarNodes = readContent.children.filter((node) => /grammar-(?:easy|hard)\/chapter\.md$/u.test(node.filePath ?? ""));
    assert.deepEqual(grammarNodes.map((node) => node.label), Array(10).fill("Grammar"));
    assert.deepEqual(grammarNodes.map((node) => node.filePath), [
      "units/vietnamese-core/chapter-001-005-grammar-easy/chapter.md",
      "units/vietnamese-core/chapter-006-010-grammar-easy/chapter.md",
      "units/vietnamese-core/chapter-011-015-grammar-easy/chapter.md",
      "units/vietnamese-core/chapter-016-020-grammar-easy/chapter.md",
      "units/vietnamese-core/chapter-021-025-grammar-easy/chapter.md",
      "units/vietnamese-core/chapter-026-030-grammar-easy/chapter.md",
      "units/vietnamese-core/chapter-031-035-grammar-easy/chapter.md",
      "units/vietnamese-core/chapter-036-040-grammar-easy/chapter.md",
      "units/vietnamese-core/chapter-041-045-grammar-easy/chapter.md",
      "units/vietnamese-core/chapter-046-050-grammar-easy/chapter.md"
    ]);
    assert.equal(readContent.children.some((node) => /^Ch (?:1|6) -- Grammar$/u.test(node.label)), false);
    assert.match(readContent.children.find((node) => node.filePath?.includes("chapter-001-basic-sentences-1"))?.label ?? "", /^Chapter 1\b/u);

    for (const [mode, expectedRole, expectedText] of [
      ["normal", "grammar-easy", "Use `tôi + là + N`"],
      ["expert", "grammar-hard", "restricted first-person nominal identity clause"],
      ["developer", "grammar-easy", "## Normal"]
    ]) {
      const modeTree = await buildLanguageTree(fixture.dataDir, mode);
      const modeReadContent = modeTree.children.find((node) => node.label === "Vietnamese").children.find((node) => node.label === "Read content");
      const modeGrammar = modeReadContent.children.find((node) => node.filePath?.includes(`chapter-001-005-${expectedRole}`));
      assert.equal(modeGrammar?.label, "Grammar");
      const output = await renderLanguageTreeRightPane(modeGrammar, { dataDir: fixture.dataDir, displayMode: mode });
      assert.doesNotMatch(output, /VIE-GRAMMAR-|grammarId|grammar_id/u);
      assert.match(output, new RegExp(escapeRegExp(expectedText), "u"));
      assert.match(output, /^### tôi \+ là \+ N$/mu);
    }
    const rawGrammar = await readInstalledContentEntry({
      dataDir: fixture.dataDir,
      packageId: "com.sleepymario.language.vietnamese",
      packageVersion: vietnamese.packageVersion,
      path: "units/vietnamese-core/chapter-001-005-grammar-easy/chapter.md",
      locale: "en-US"
    });
    assert.match(rawGrammar.text, /grammarId: VIE-GRAMMAR-001/u);
    assert.match(rawGrammar.text, /### VIE-GRAMMAR-001/u);
  } finally {
    await fixture.cleanup();
  }
});

test("Vietnamese read content interleaves reviews after Core Chapters 5 and 10", async () => {
  const fixture = await createInstalledLanguageFixture(
    ["vietnamese-curriculum", "vietnamese-core-reviews"],
    ["com.sleepymario.language.vietnamese"]
  );
  try {
    const tree = await buildLanguageTree(fixture.dataDir);
    const vietnamese = tree.children.find((node) => node.label === "Vietnamese");
    const readContent = vietnamese.children.find((node) => node.label === "Read content");
    assert.ok(readContent);

    const firstReviews = readContent.children.filter((node) => node.label === "Review -- Chapters 1–5");
    const secondReviews = readContent.children.filter((node) => node.label === "Review -- Chapters 6–10");
    assert.equal(firstReviews.length, 1);
    assert.equal(secondReviews.length, 1);
    const [firstReview] = firstReviews;
    const [secondReview] = secondReviews;
    assert.equal(firstReview?.sourcePath, "review-decks/chapter-001-005/cards.tsv");
    assert.equal(secondReview?.sourcePath, "review-decks/chapter-006-010/cards.tsv");
    assert.equal(firstReview?.itemCount, 60);
    assert.equal(secondReview?.itemCount, 72);
    assert.match(firstReview?.id ?? "", /:inline:1-5$/u);
    assert.match(secondReview?.id ?? "", /:inline:6-10$/u);
    assert.notEqual(firstReview?.id, secondReview?.id);

    const labels = readContent.children.map((node) => node.label);
    const indexOfPath = (path) => readContent.children.findIndex((node) => node.filePath === path);
    const chapterIndices = Array.from({ length: 10 }, (_, index) => {
      const chapter = index + 1;
      return indexOfPath(`units/vietnamese-core/chapter-${String(chapter).padStart(3, "0")}-basic-sentences-${chapter}/chapter.md`);
    });
    const [chapter1, , , , chapter5, chapter6, , , , chapter10] = chapterIndices;
    const grammar15 = indexOfPath("units/vietnamese-core/chapter-001-005-grammar-easy/chapter.md");
    const grammar610 = indexOfPath("units/vietnamese-core/chapter-006-010-grammar-easy/chapter.md");
    const firstReviewIndex = readContent.children.indexOf(firstReview);
    const secondReviewIndex = readContent.children.indexOf(secondReview);

    assert.deepEqual(readContent.children.slice(0, chapter1).map((node) => node.label), [
      "Foundation Chapter -- 1",
      "Foundation Chapter -- 2",
      "Foundation Chapter -- 3",
      "Foundation Chapter -- 4",
      "Foundation Chapter -- 5"
    ]);
    assert.equal(readContent.children.slice(0, chapter1).some((node) => node.kind === "review-source"), false);
    assert.deepEqual(chapterIndices.slice(0, 5), Array.from({ length: 5 }, (_, index) => chapter1 + index));
    assert.deepEqual(chapterIndices.slice(5), Array.from({ length: 5 }, (_, index) => chapter6 + index));
    assert.deepEqual([chapter5 + 1, firstReviewIndex + 1, grammar15 + 1], [firstReviewIndex, grammar15, chapter6]);
    assert.deepEqual([chapter10 + 1, secondReviewIndex + 1], [secondReviewIndex, grammar610]);
    assert.equal(labels[firstReviewIndex], "Review -- Chapters 1–5");
    assert.equal(labels[secondReviewIndex], "Review -- Chapters 6–10");

    const reviewDecks = vietnamese.children.find((node) => node.label === "Review decks");
    assert.ok(reviewDecks);
    const first = reviewDecks.children.find((node) => node.label === "Chapter 1-5");
    const second = reviewDecks.children.find((node) => node.label === "Chapter 6-10");
    assert.equal(first?.sourcePath, "review-decks/chapter-001-005/cards.tsv");
    assert.equal(second?.sourcePath, "review-decks/chapter-006-010/cards.tsv");
    assert.equal(first?.itemCount, 60);
    assert.equal(second?.itemCount, 72);
  } finally {
    await fixture.cleanup();
  }
});

test("Dutch read tree includes the complete zero-padded Chapters 11-75 blocks", async () => {
  const fixture = await createInstalledDutchFixture();
  try {
    const tree = await buildLanguageTree(fixture.dataDir);
    const dutch = tree.children.find((node) => node.label === "Dutch");
    const readContent = dutch.children.find((node) => node.label === "Read content");
    const chapter11 = readContent.children.find((node) => node.filePath === "units/dutch-core/chapter-011-asking-how-someone-is/chapter.md");
    const chapter15 = readContent.children.find((node) => node.filePath === "units/dutch-core/chapter-015-asking-where-someone-lives/chapter.md");
    const chapter16 = readContent.children.find((node) => node.filePath === "units/dutch-core/chapter-016-working-at-the-library/chapter.md");
    const chapter20 = readContent.children.find((node) => node.filePath === "units/dutch-core/chapter-020-an-appointment-in-town/chapter.md");
    const chapter25 = readContent.children.find((node) => node.filePath === "units/dutch-core/chapter-025-going-to-the-museum/chapter.md");
    const chapter70 = readContent.children.find((node) => node.filePath === "units/dutch-core/chapter-070-reporting-the-meeting/chapter.md");
    const chapter75 = readContent.children.find((node) => node.filePath === "units/dutch-core/chapter-075-fixing-the-wifi-before-a-family-call/chapter.md");

    assert.equal(chapter11?.label, "Chapter 11 -- Asking How Someone Is");
    assert.equal(chapter15?.label, "Chapter 15 -- Asking Where Someone Lives");
    assert.equal(chapter16?.label, "Chapter 16 -- Working at the Library");
    assert.equal(chapter20?.label, "Chapter 20 -- An Appointment in Town");
    assert.equal(chapter25?.label, "Chapter 25 -- Going to the Museum");
    assert.equal(chapter70?.label, "Chapter 70 -- Sharing a Short Film");
    assert.equal(chapter75?.label, "Chapter 75 -- Fixing the Wi-Fi Before a Family Call");
    assert.equal(readContent.children.some((node) => /^units\/dutch-core\/chapter-071-/u.test(node.filePath ?? "")), true);
    assert.equal(readContent.children.some((node) => /^units\/dutch-core\/chapter-075-/u.test(node.filePath ?? "")), true);
    assert.equal(readContent.children.some((node) => /^units\/dutch-core\/chapter-076-/u.test(node.filePath ?? "")), false);
    assert.equal(readContent.children.some((node) => /chapter-011-015-grammar-(?:easy|hard)/u.test(node.filePath ?? "")), true);
    const reviewDecks = dutch.children.find((node) => node.label === "Review decks");
    assert.equal(reviewDecks.children.some((node) => node.label === "Chapter 11-15"), true);
    assert.equal(reviewDecks.children.some((node) => node.label === "Chapter 16-20"), true);
    assert.equal(reviewDecks.children.some((node) => node.label === "Chapter 21-25"), true);
    assert.equal(reviewDecks.children.some((node) => node.label === "Chapter 66-70"), true);
    assert.equal(reviewDecks.children.some((node) => node.label === "Chapter 71-75"), true);
    const chapter75Index = readContent.children.indexOf(chapter75);
    const inlineReviewIndex = readContent.children.findIndex((node) => node.label === "Review -- Chapters 71–75");
    const grammarIndex = readContent.children.findIndex((node) => /chapter-071-075-grammar-easy/u.test(node.filePath ?? ""));
    assert.ok(chapter75Index >= 0 && chapter75Index < inlineReviewIndex, "Review 71-75 follows Chapter 75");
    assert.ok(inlineReviewIndex < grammarIndex, "Review 71-75 precedes Grammar 71-75");
  } finally {
    await fixture.cleanup();
  }
});

test("module tree includes available modules from a catalogue with install status", async () => {
  const fixture = await createInstalledLanguageFixture(
    ["vietnamese-curriculum", "dutch-curriculum"],
    ["com.sleepymario.language.dutch"]
  );
  try {
    const descriptors = await listAvailableModuleDescriptors(fixture.cataloguePath, fixture.dataDir);
    const tree = await buildModuleTree({ dataDir: fixture.dataDir, cataloguePath: fixture.cataloguePath });
    const available = tree.children.find((node) => node.label === "Modules available");
    const availableLanguages = available.children.find((node) => node.label === "Languages");

    assert.deepEqual(descriptors.filter((descriptor) => descriptor.category === "Languages").map((descriptor) => `${descriptor.displayName}:${descriptor.availableStatus}`), [
      "Dutch:installed",
      "Vietnamese:available"
    ]);
    assert.deepEqual(availableLanguages.children.map((node) => node.label), [
      "Dutch [Installed]",
      "Vietnamese [Available]"
    ]);
  } finally {
    await fixture.cleanup();
  }
});

test("language tree flattening and renderer use deterministic keyboard state", async () => {
  const fixture = await createInstalledDutchFixture();
  try {
    const tree = await buildLanguageTree(fixture.dataDir);
    const expanded = new Set(["languages", "com.sleepymario.language.dutch"]);
    const visible = flattenVisibleLanguageTree(tree, expanded);
    const labels = visible.map((entry) => entry.node.label);
    const output = renderTwoPaneLanguageTree(tree, expanded, labels.indexOf("Read content"), "Preview text", false);

    assert.deepEqual(labels.slice(0, 5), ["Languages", "Dutch", "Read content", "Review decks", "Package info"]);
    assert.match(output, />\s+>\s+Read content/);
    assert.match(output, /Preview text/);
    assert.match(output, /Space activate\/install/);
  } finally {
    await fixture.cleanup();
  }
});

test("two-pane renderer styles tree state and markdown-like right pane content", () => {
  const tree = {
    id: "whacksmacker",
    label: "WhackSmacker",
    kind: "root",
    children: [{
      id: "available-modules",
      label: "Modules available",
      kind: "available-root",
      children: [{
        id: "available:example",
        label: "Example Language [available]",
        kind: "available-module",
        availableStatus: "available"
      }]
    }]
  };
  const expanded = new Set(["whacksmacker", "available-modules"]);
  const output = renderTwoPaneLanguageTree(tree, expanded, 2, [
    "# Heading",
    "",
    "- one item",
    "",
    "```",
    "raw code",
    "```",
    "",
    "---"
  ].join("\n"), true);

  assert.match(output, /\x1b\[[0-9;]*m/);
  assert.match(output, /Heading/);
  assert.match(output, /• one item/);
  assert.match(output, /raw code/);
  assert.doesNotMatch(output, /# Heading/);
  assert.doesNotMatch(output, /```/);
  assert.doesNotMatch(output, /^.*\|\s+code\s+\|.*$/mu);
  assert.doesNotMatch(output, /\x1b\[38;5;213mraw code\x1b\[0m/u);
  assert.match(output, /Example/u);
  assert.match(output, /Language/u);
  assert.doesNotMatch(output, /^\s*\.\.\.\s*$/mu);
});

test("right-pane source-language toggle shows only the current language in orange", () => {
  const english = renderSourceLanguageToggle("en-US", true);
  const chinese = renderSourceLanguageToggle("zh-Hant-TW", true);

  assert.equal(english, "\x1b[1m\x1b[38;5;208mEnglish\x1b[0m");
  assert.equal(chinese, "\x1b[1m\x1b[38;5;208m中文（臺灣）\x1b[0m");
  assert.equal(stripAnsi(english), "English");
  assert.equal(stripAnsi(chinese), "中文（臺灣）");
  assert.doesNotMatch(stripAnsi(`${english}${chinese}`), /Source language:|來源語言：/u);
});

test("three-pane renderer separates navigation output and toggles", () => {
  const tree = { id: "whacksmacker", label: "WhackSmacker", kind: "root" };
  const english = renderTwoPaneLanguageTree(tree, new Set(), 0, "Preview", true, 0, 28, "en-US", "navigation", 150);
  const chinese = renderTwoPaneLanguageTree(tree, new Set(), 0, "預覽", true, 0, 28, "zh-Hant-TW", "toggles", 150);
  const englishPlain = stripAnsi(english);
  const toggleRow = englishPlain.split("\n").find((line) => line.includes("English"));
  const cells = toggleRow.split("|");

  assert.match(englishPlain, /WhackSmacker/u);
  assert.match(englishPlain, /Output/u);
  assert.match(englishPlain, /Toggles/u);
  assert.equal(cells[2].includes("English"), false);
  assert.equal(cells[3].trim(), "Source: English");
  assert.match(english, /\x1b\[1m\x1b\[38;5;208mSource: English\x1b\[0m/u);
  assert.match(chinese, /\x1b\[7m\x1b\[1m> Source: 中文（臺灣）\x1b\[0m/u);
  assert.match(englishPlain, /Left\/Right focus/u);
  assert.match(englishPlain, /View mode: Normal/u);
  assert.match(englishPlain, /Translation: Off/u);
  assert.doesNotMatch(englishPlain, /● Normal|○ Developer/u);
});

test("Normal is the default and the view mode uses one toggle row", () => {
  const tree = { id: "whacksmacker", label: "WhackSmacker", kind: "root" };
  const normal = stripAnsi(renderTwoPaneLanguageTree(tree, new Set(), 0, "Preview", true, 0, 28, "en-US", "navigation", 150));
  const developer = stripAnsi(renderTwoPaneLanguageTree(tree, new Set(), 0, "Preview", true, 0, 28, "en-US", "toggles", 150, 1, "developer"));
  assert.match(normal, /View mode: Normal/u);
  assert.doesNotMatch(normal, /View mode: Developer/u);
  assert.match(developer, /> View mode: Developer/u);
  assert.equal((developer.match(/View mode:/gu) ?? []).length, 1);
});

test("focus selector jumps between navigation and the toggle row while skipping titles and Output", () => {
  const tree = { id: "whacksmacker", label: "WhackSmacker", kind: "root" };
  const navigation = renderTwoPaneLanguageTree(tree, new Set(), 0, "Preview", true, 0, 28, "en-US", "navigation", 150);
  const toggles = renderTwoPaneLanguageTree(tree, new Set(), 0, "Preview", true, 0, 28, "en-US", "toggles", 150);
  const selectedToggleRow = stripAnsi(toggles).split("\n").find((line) => line.includes("> Source: English"));

  assert.match(navigation, /\x1b\[7m\x1b\[1m>\s+WhackSmacker\x1b\[0m/u);
  assert.match(toggles, /\x1b\[7m\x1b\[1m> Source: English\x1b\[0m/u);
  assert.equal((toggles.match(/\x1b\[7m/gu) ?? []).length, 1);
  assert.equal(selectedToggleRow?.split("|")[3].trim(), "> Source: English");
  assert.doesNotMatch(toggles, /\x1b\[7m[^\n]*Toggles/u);
  assert.doesNotMatch(toggles, /\x1b\[7m[^\n]*Output/u);
});

test("narrow terminals collapse the Toggles pane without corrupting borders", () => {
  const tree = { id: "whacksmacker", label: "WhackSmacker", kind: "root" };
  const output = renderTwoPaneLanguageTree(tree, new Set(), 0, "Narrow output", false, 0, 10, "en-US", "navigation", 90);
  const lines = output.split("\n");

  assert.equal(shouldShowTogglesPane(90), false);
  assert.doesNotMatch(output, /Toggles/u);
  assert.match(output, /WhackSmacker/u);
  assert.match(output, /Output/u);
  assert.equal(lines[0].length, 90);
  assert.equal(lines.slice(0, 13).filter((line) => line.startsWith("|")).every((line) => line.length === 90), true);
  assert.ok(lines.at(-1).length <= 90);
});

test("two-pane renderer keeps the right border fixed while wrapping long wide content", () => {
  const tree = {
    id: "whacksmacker",
    label: "WhackSmacker",
    kind: "root",
    children: [{
      id: "very-long-menu-label",
      label: "This is an intentionally long menu item that must not push the content border away from the future options pane",
      kind: "message"
    }]
  };
  const output = renderTwoPaneLanguageTree(tree, new Set(["whacksmacker"]), 0, [
    "김민준은 안녕하세요라는 긴 문장을 반복해서 읽습니다 김민준은 안녕하세요라는 긴 문장을 반복해서 읽습니다 김민준은 안녕하세요라는 긴 문장을 반복해서 읽습니다.",
    "",
    "- This future menu/list item has a very long learner-facing label and should wrap inside the output pane instead of widening the layout."
  ].join("\n"), false);
  const paneLines = output
    .split("\n")
    .filter((line) => line.startsWith("| "));
  const rightBorderColumns = paneLines.map((line) => displayColumnOf(line, "|", 2));

  assert.ok(paneLines.length > 5);
  assert.equal(new Set(rightBorderColumns).size, 1);
  assert.ok(paneLines.some((line) => rightPaneCell(line).includes("반복해서 읽습니다")));
  assert.ok(paneLines.some((line) => rightPaneCell(line).includes("instead of widening")));
});

test("two-pane renderer displays chapter menu labels as Ch and scrolls selected items into view", () => {
  const tree = {
    id: "whacksmacker",
    label: "WhackSmacker",
    kind: "root",
    children: Array.from({ length: 18 }, (_, index) => ({
      id: `chapter-${index + 1}`,
      label: `Chapter ${index + 1}`,
      kind: "readable-content"
    }))
  };
  const expanded = new Set(["whacksmacker"]);
  const selectedChapter15Index = 15;
  const scrolledDownOutput = renderTwoPaneLanguageTree(tree, expanded, selectedChapter15Index, "Preview", false, 0, 8);
  const scrolledUpOutput = renderTwoPaneLanguageTree(tree, expanded, 2, "Preview", false, 0, 8);

  assert.match(scrolledDownOutput, />\s+Ch 15/u);
  assert.doesNotMatch(scrolledDownOutput, /Chapter 15/u);
  assert.doesNotMatch(scrolledDownOutput, /Ch 1\b/u);
  assert.match(scrolledUpOutput, />\s+Ch 2/u);
  assert.match(scrolledUpOutput, /Ch 1\b/u);
  assert.doesNotMatch(scrolledUpOutput, /Ch 15\b/u);
  assert.equal(new Set(scrolledDownOutput.split("\n").filter((line) => line.startsWith("| ")).map((line) => displayColumnOf(line, "|", 3))).size, 1);
});

test("two-pane renderer preserves read content chapter titles without ellipsis-only labels", () => {
  const tree = {
    id: "whacksmacker",
    label: "WhackSmacker",
    kind: "root",
    children: [{
      id: "read-content",
      label: "Read content",
      kind: "read-section",
      children: [{
        id: "chapter-1",
        label: "Chapter 1 -- A Polite First Meeting",
        kind: "content"
      }, {
        id: "chapter-15",
        label: "Chapter 15 -- Casual Absence I",
        kind: "content"
      }, {
        id: "grammar-easy",
        label: "Grammar - Easy",
        kind: "content"
      }, {
        id: "grammar-hard",
        label: "Grammar - Hard",
        kind: "content"
      }]
    }]
  };
  const expanded = new Set(["whacksmacker", "read-content"]);
  const output = renderTwoPaneLanguageTree(tree, expanded, 2, "Preview", false);

  assert.match(output, /Ch 1 -- A Polite/u);
  assert.match(output, /First Meeting/u);
  assert.match(output, /Ch 15 -- Casual Absence/u);
  assert.match(output, /Ch 15 -- Casual Absence I/u);
  assert.equal((output.match(/Grammar/gu) ?? []).length >= 2, true);
  assert.doesNotMatch(output, /Grammar -- (?:Easy|Hard)/u);
  assert.doesNotMatch(output, /Ch 1\s*--\s*\.\.\./u);
  assert.doesNotMatch(output, /\|\s*(?:\.\.\.|…)\s+\|/u);
});

test("two-pane renderer matches review deck color for chapter and grammar menu tokens", () => {
  const tree = {
    id: "whacksmacker",
    label: "WhackSmacker",
    kind: "root",
    children: [{
      id: "read-content",
      label: "Read content",
      kind: "read-section",
      children: [{
        id: "foundation-1",
        label: "Foundation Chapter -- 1",
        kind: "content",
        packageId: "com.sleepymario.language.vietnamese",
        filePath: "units/vietnamese-foundation/chapter-001-alphabet/chapter.md"
      }, {
        id: "hangul-1",
        label: "Chapter 1 -- Vowels",
        kind: "content",
        filePath: "units/introduction-to-hangul/chapter-01-vowels/README.md"
      }, {
        id: "chapter-1",
        label: "Chapter 1 -- A Polite First Meeting",
        kind: "content"
      }, {
        id: "grammar-easy",
        label: "Grammar - Easy",
        kind: "content"
      }]
    }]
  };
  const expanded = new Set(["whacksmacker", "read-content"]);
  const selectedFoundationOutput = renderTwoPaneLanguageTree(tree, expanded, 2, "Preview", true);
  const selectedHangulOutput = renderTwoPaneLanguageTree(tree, expanded, 3, "Preview", true);
  const selectedChapterOutput = renderTwoPaneLanguageTree(tree, expanded, 4, "Preview", true);
  const selectedGrammarOutput = renderTwoPaneLanguageTree(tree, expanded, 5, "Preview", true);
  const reviewDeckOutput = renderTwoPaneLanguageTree({
    id: "whacksmacker",
    label: "WhackSmacker",
    kind: "root",
    children: [{
      id: "review-decks",
      label: "Review decks",
      kind: "review-section",
      children: [{
        id: "review-source",
        label: "Chapter 1-5",
        kind: "review-source",
        reviewStatus: "has_cards_to_review"
      }]
    }]
  }, new Set(["whacksmacker", "review-decks"]), 0, "Preview", true);
  const output = `${selectedFoundationOutput}\n${selectedHangulOutput}\n${selectedChapterOutput}\n${selectedGrammarOutput}\n${reviewDeckOutput}`;
  const chapterTokenColor = "\x1b[33m";
  const reviewStatusColor = "\x1b[34m";
  const selectedStyle = "\x1b[7m\x1b[1m";
  const reset = "\x1b[0m";
  const stripped = stripAnsi(output);

  assert.match(reviewDeckOutput, new RegExp(`${escapeRegExp(reviewStatusColor)}[^\\x1b]*Ch 1-5${escapeRegExp(reset)}`, "u"));
  assert.doesNotMatch(reviewDeckOutput, /\x1b\[33m[^\x1b]*Ch 1-5/u);
  assert.match(output, new RegExp(`${escapeRegExp(chapterTokenColor)}Foundation${escapeRegExp(reset)} Chapter -- 1`, "u"));
  assert.doesNotMatch(output, new RegExp(`${escapeRegExp(chapterTokenColor)}Foundation Chapter`, "u"));
  assert.match(output, new RegExp(`${escapeRegExp(chapterTokenColor)}Han Gul 1${escapeRegExp(reset)} -- Vowels`, "u"));
  assert.match(output, new RegExp(`${escapeRegExp(chapterTokenColor)}Ch 1${escapeRegExp(reset)} -- A Polite`, "u"));
  assert.match(output, new RegExp(`${escapeRegExp(chapterTokenColor)}Grammar${escapeRegExp(reset)}`, "u"));
  assert.doesNotMatch(output, new RegExp(`${escapeRegExp(chapterTokenColor)}A Polite`, "u"));
  assert.doesNotMatch(output, new RegExp(`${escapeRegExp(chapterTokenColor)}Easy`, "u"));
  assert.match(output, new RegExp(`${escapeRegExp(selectedStyle)}[^\\x1b]*${escapeRegExp(chapterTokenColor)}Foundation${escapeRegExp(reset)}${escapeRegExp(selectedStyle)} Chapter -- 1`, "u"));
  assert.match(output, new RegExp(`${escapeRegExp(selectedStyle)}[^\\x1b]*${escapeRegExp(chapterTokenColor)}Han Gul 1`, "u"));
  assert.match(output, new RegExp(`${escapeRegExp(selectedStyle)}[^\\x1b]*${escapeRegExp(chapterTokenColor)}Ch 1`, "u"));
  assert.match(output, new RegExp(`${escapeRegExp(selectedStyle)}[^\\x1b]*${escapeRegExp(chapterTokenColor)}Grammar`, "u"));
  assert.match(stripped, /Foundation Chapter -- 1/u);
  assert.match(stripped, /Han Gul 1 -- Vowels/u);
  assert.match(stripped, /Ch 1 -- A Polite First/u);
  assert.match(stripped, /Grammar/u);
  assert.doesNotMatch(stripped, /Grammar -- Easy/u);
  assert.doesNotMatch(stripped, /Ch 1\s*--\s*\.\.\./u);
  assert.doesNotMatch(stripped, /\|\s*(?:\.\.\.|…)\s+\|/u);
});

test("Vietnamese numbered chapter labels use exact dynamic Ch N -- topic formatting", () => {
  const chapters = [
    { number: 1, label: "Chapter 1 — A Polite First Meeting" },
    { number: 10, label: "Chapter 10: Places" },
    { number: 123, label: "Chapter 123 - Future Topic" }
  ];
  const tree = {
    id: "whacksmacker", label: "WhackSmacker", kind: "root", children: [{
      id: "read-content", label: "Read content", kind: "read-section",
      children: chapters.map(({ number, label }) => ({
        id: `vi-${number}`, label, kind: "content",
        packageId: "com.sleepymario.language.vietnamese",
        filePath: `units/vietnamese-core/chapter-${String(number).padStart(3, "0")}-topic/chapter.md`
      }))
    }]
  };
  const output = renderTwoPaneLanguageTree(tree, new Set(["whacksmacker", "read-content"]), 2, "Preview", true, 0, 15, "en-US", "navigation", 160);
  const plain = stripAnsi(output);
  assert.match(plain, /Ch 1 -- A Polite First Meeting/u);
  assert.match(plain, /Ch 10 -- Places/u);
  assert.match(plain, /Ch 123 -- Future Topic/u);
  assert.doesNotMatch(plain, /Ch \d+(?:—|:|-\s(?!-))/u);
  for (const { number } of chapters) {
    assert.match(output, new RegExp(`${escapeRegExp("\x1b[33m")}Ch ${number}${escapeRegExp("\x1b[0m")}(?:\\x1b\\[[0-9;]*m)* --`, "u"));
  }
  assert.doesNotMatch(output, new RegExp(`${escapeRegExp("\x1b[33m")}[^\x1b]*(?:A Polite|Places|Future Topic)`, "u"));
});

test("review deck menu status distinguishes not started finished waiting and due decks", () => {
  const now = "2026-07-10T00:00:00Z";
  const identity = (itemId) => ({
    packageId: "com.sleepymario.language.test",
    packageVersion: "0.1.0",
    sourcePath: "review-decks/test/cards.tsv",
    itemId
  });
  const cardIdentities = [identity("card-1"), identity("card-2")];
  const initial1 = createInitialReviewState(identity("card-1"), now);
  const initial2 = createInitialReviewState(identity("card-2"), now);
  const due = {
    ...initial1,
    lastReviewedAt: "2026-07-09T00:00:00Z",
    reviewCount: 1,
    intervalDays: 1,
    status: "review"
  };
  const waiting = {
    ...createInitialReviewState(identity("card-1"), now),
    nextReviewAt: "2999-01-01T00:00:00Z",
    reviewCount: 1,
    intervalDays: 2,
    status: "review"
  };
  const suspended1 = {
    ...waiting,
    nextReviewAt: "2026-07-09T00:00:00Z",
    status: "suspended"
  };
  const suspended2 = {
    ...createInitialReviewState(identity("card-2"), now),
    nextReviewAt: "2999-01-01T00:00:00Z",
    reviewCount: 1,
    intervalDays: 2,
    status: "suspended"
  };

  assert.deepEqual(classifyReviewDeckMenuStatus({ deckId: "test", cardIdentities, savedProgress: [], now }), {
    status: "not_started",
    dueCardCount: 0
  });
  assert.deepEqual(classifyReviewDeckMenuStatus({ deckId: "test", cardIdentities, savedProgress: [initial1, initial2], now }), {
    status: "not_started",
    dueCardCount: 0
  });
  assert.deepEqual(classifyReviewDeckMenuStatus({ deckId: "test", cardIdentities, savedProgress: [suspended1, suspended2], now }), {
    status: "finished",
    dueCardCount: 0
  });
  assert.deepEqual(classifyReviewDeckMenuStatus({ deckId: "test", cardIdentities: [identity("card-1")], savedProgress: [waiting], now }), {
    status: "no_cards_to_review",
    dueCardCount: 0
  });
  assert.deepEqual(classifyReviewDeckMenuStatus({ deckId: "test", cardIdentities, savedProgress: [due], now }), {
    status: "has_cards_to_review",
    dueCardCount: 2
  });
  assert.deepEqual(classifyReviewDeckMenuStatus({ deckId: "test", cardIdentities: [], savedProgress: [], now }), {
    status: "not_started",
    dueCardCount: 0
  });
  assert.deepEqual(classifyReviewDeckMenuStatus({ deckId: "other", cardIdentities: [identity("other-card")], savedProgress: [due], now }), {
    status: "not_started",
    dueCardCount: 0
  }, "progress remains isolated by deck item identity");
});

test("two-pane renderer colors review deck rows by review status", () => {
  const tree = {
    id: "whacksmacker",
    label: "WhackSmacker",
    kind: "root",
    children: [{
      id: "review-decks",
      label: "Review decks",
      kind: "review-section",
      children: [{
        id: "not-started",
        label: "Not Started",
        kind: "review-source",
        reviewStatus: "not_started"
      }, {
        id: "finished",
        label: "Finished",
        kind: "review-source",
        reviewStatus: "finished"
      }, {
        id: "waiting",
        label: "Waiting",
        kind: "review-source",
        reviewStatus: "no_cards_to_review"
      }, {
        id: "due",
        label: "Due Now",
        kind: "review-source",
        reviewStatus: "has_cards_to_review"
      }]
    }]
  };
  const output = renderTwoPaneLanguageTree(tree, new Set(["whacksmacker", "review-decks"]), 5, "There are 17 cards to review.", true);
  const selectedStyle = "\x1b[7m\x1b[1m";

  assert.equal(reviewDeckStatusStyle("not_started"), "\x1b[35m");
  assert.equal(reviewDeckStatusStyle("no_cards_to_review"), menuStyles.defaultForeground);
  assert.equal(reviewDeckStatusStyle("has_cards_to_review"), "\x1b[34m");
  assert.equal(reviewDeckStatusStyle("finished"), "\x1b[32m");
  assert.match(output, /\x1b\[35m[^\x1b\n]*Not Started/u);
  assert.doesNotMatch(output, /\x1b\[36m[^\x1b\n]*Not Started/u);
  assert.match(output, /\x1b\[32m[^\x1b\n]*Finished/u);
  const waitingLine = output.split("\n").find((line) => stripAnsi(line).includes("Waiting"));
  assert.ok(waitingLine);
  assert.doesNotMatch(statusSequenceBeforeLabel(waitingLine, "Waiting"), /\x1b\[(?:3[2-5]|38;5;\d+)m/u, "waiting row uses the default foreground without inheriting another status color");
  assert.match(output, /\x1b\[34m[^\x1b\n]*Due Now/u);
  assert.doesNotMatch(output, /\x1b\[33m[^\x1b\n]*Due Now/u);
  assert.match(output, new RegExp(`${escapeRegExp(selectedStyle)}[^\\x1b]*${escapeRegExp("\x1b[34m")}Due Now`, "u"));
  assert.match(stripAnsi(output), /There are 17 cards to review\./u);
});

test("complete review labels use the global status palette across languages and NO_COLOR", () => {
  const states = [
    ["not_started", "\x1b[35m"],
    ["no_cards_to_review", ""],
    ["has_cards_to_review", "\x1b[34m"],
    ["finished", "\x1b[32m"]
  ];
  for (const [status, color] of states) {
    const tree = {
      id: "whacksmacker",
      label: "WhackSmacker",
      kind: "root",
      children: [{
        id: "review-decks",
        label: "Review decks",
        kind: "review-section",
        children: [{
          id: `review-${status}`,
          label: "Review -- Chapters 1–5",
          kind: "review-source",
          reviewStatus: status
        }]
      }]
    };
    const output = renderTwoPaneLanguageTree(tree, new Set(["whacksmacker", "review-decks"]), 0, "", true, 0, 80, "en-US", "navigation", 180);
    const line = output.split("\n").find((candidate) => stripAnsi(candidate).includes("Review -- Chapters 1–5"));
    assert.ok(line);
    if (color === "") {
      assert.doesNotMatch(statusSequenceBeforeLabel(line, "Review -- Chapters 1–5"), /\x1b\[(?:3[2-5]|38;5;\d+)m/u);
    } else {
      assert.match(line, new RegExp(`${escapeRegExp(color)}[^\\x1b\\n]*Review -- Chapters 1–5${escapeRegExp("\x1b[0m")}`, "u"));
    }
    assert.doesNotMatch(line, /\x1b\[33m/u, "yellow is never a review status color");
    const noColor = renderTwoPaneLanguageTree(tree, new Set(["whacksmacker", "review-decks"]), 0, "", false, 0, 80, "en-US", "navigation", 180);
    assert.doesNotMatch(noColor, /\x1b\[/u);
    assert.match(noColor, /Review -- Chapters 1–5/u);
  }

  const languages = ["Dutch", "Vietnamese", "Korean", "Chinese", "Japanese"];
  const tree = {
    id: "whacksmacker",
    label: "WhackSmacker",
    kind: "root",
    children: languages.map((language) => ({
      id: language.toLowerCase(),
      label: language,
      kind: "package",
      children: [{
        id: `${language.toLowerCase()}:review`,
        label: "Review -- Chapters 1–5",
        kind: "review-source",
        reviewStatus: "has_cards_to_review"
      }]
    }))
  };
  const expanded = new Set(["whacksmacker", ...languages.map((language) => language.toLowerCase())]);
  const output = renderTwoPaneLanguageTree(tree, expanded, 0, "", true, 0, 80, "en-US", "navigation", 220);
  assert.equal((output.match(/\x1b\[34m[^\x1b\n]*Review -- Chapters 1–5\x1b\[0m/gu) ?? []).length, languages.length);
  assert.doesNotMatch(output, /\x1b\[33m[^\x1b\n]*Review -- Chapters/u);
});

test("review deck tree status repaints after review progress changes", async () => {
  const fixture = await createInstalledDutchFixture();
  try {
    const now = new Date().toISOString().replace(/\.\d{3}Z$/u, "Z");
    await syncReadingReviewItems({
      dataDir: fixture.dataDir,
      packageId: "com.sleepymario.language.dutch",
      packageVersion: "0.1.0",
      now
    });
    const notStartedTree = await buildLanguageTree(fixture.dataDir);
    const notStartedDeck = dutchReviewDeckNode(notStartedTree, "Chapter 1-5");

    assert.equal(notStartedDeck.reviewStatus, "not_started");
    assert.equal(notStartedDeck.reviewStatusText, "Not started yet.");

    const sourceItems = await listReadingReviewItems({
      dataDir: fixture.dataDir,
      packageId: "com.sleepymario.language.dutch",
      packageVersion: "0.1.0",
      sourcePath: "review-decks/chapter-001-005/cards.tsv"
    });
    const [firstItem] = sourceItems;
    assert.ok(firstItem, "Dutch fixture has review items");
    await recordReadingReviewAnswer({
      dataDir: fixture.dataDir,
      packageId: firstItem.packageId,
      packageVersion: firstItem.packageVersion,
      sourcePath: firstItem.sourcePath,
      itemId: firstItem.item.id,
      rating: "good",
      reviewedAt: now
    });

    const partiallyReviewedTree = await buildLanguageTree(fixture.dataDir);
    const partiallyReviewedDeck = dutchReviewDeckNode(partiallyReviewedTree, "Chapter 1-5");

    assert.equal(partiallyReviewedDeck.reviewStatus, "has_cards_to_review");
    assert.equal(partiallyReviewedDeck.reviewStatusText, `There are ${partiallyReviewedDeck.dueCardCount} cards to review.`);
    assert.ok((partiallyReviewedDeck.dueCardCount ?? 0) > 0);
    const dueOutput = renderTwoPaneLanguageTree({
      id: "whacksmacker",
      label: "WhackSmacker",
      kind: "root",
      children: [{
        id: "review-decks",
        label: "Review decks",
        kind: "review-section",
        children: [partiallyReviewedDeck]
      }]
    }, new Set(["whacksmacker", "review-decks"]), 0, partiallyReviewedDeck.reviewStatusText, true);
    assert.match(dueOutput, /\x1b\[34m[^\x1b\n]*Ch 1-5/u);
    assert.doesNotMatch(dueOutput, /\x1b\[33m[^\x1b\n]*Ch 1-5/u);

    for (const item of sourceItems) {
      await recordReadingReviewAnswer({
        dataDir: fixture.dataDir,
        packageId: item.packageId,
        packageVersion: item.packageVersion,
        sourcePath: item.sourcePath,
        itemId: item.item.id,
        rating: "good",
        reviewedAt: now
      });
    }

    const refreshedTree = await buildLanguageTree(fixture.dataDir);
    const refreshedDeck = dutchReviewDeckNode(refreshedTree, "Chapter 1-5");
    const output = renderTwoPaneLanguageTree({
      id: "whacksmacker",
      label: "WhackSmacker",
      kind: "root",
      children: [{
        id: "review-decks",
        label: "Review decks",
        kind: "review-section",
        children: [refreshedDeck]
      }]
    }, new Set(["whacksmacker", "review-decks"]), 2, refreshedDeck.reviewStatusText, true);

    assert.equal(refreshedDeck.reviewStatus, "no_cards_to_review");
    assert.equal(refreshedDeck.reviewStatusText, "No new cards to review right now.");
    const refreshedLine = output.split("\n").find((line) => stripAnsi(line).includes("Ch 1-5"));
    assert.ok(refreshedLine);
    assert.doesNotMatch(statusSequenceBeforeLabel(refreshedLine, "Ch 1-5"), /\x1b\[(?:3[2-5]|38;5;\d+)m/u);
    assert.match(stripAnsi(output), /No new cards to review right now\./u);
  } finally {
    await fixture.cleanup();
  }
});

test("review deck right pane reports available card count", async () => {
  const text = await renderLanguageTreeRightPane({
    id: "review-source",
    label: "Chapter 6-10",
    kind: "review-source",
    packageLabel: "Dutch",
    packageId: "com.sleepymario.language.dutch",
    sourcePath: "review-decks/chapter-006-010/cards.tsv",
    itemCount: 40,
    reviewStatus: "has_cards_to_review",
    dueCardCount: 17,
    reviewStatusText: "There are 17 cards to review."
  }, {});

  assert.match(text, /Review deck: Chapter 6-10/u);
  assert.match(text, /Items: 40/u);
  assert.match(text, /There are 17 cards to review\./u);
});

test("review deck tree status handles missing progress files and exposes output-pane text", async () => {
  const fixture = await createInstalledDutchFixture();
  try {
    const tree = await buildLanguageTree(fixture.dataDir);
    const dutch = tree.children.find((node) => node.label === "Dutch");
    const reviewDecks = dutch.children.find((node) => node.label === "Review decks");
    const chapterDeck = reviewDecks.children.find((node) => node.label === "Chapter 1-5");

    assert.equal(chapterDeck.reviewStatus, "not_started");
    assert.equal(chapterDeck.dueCardCount, 0);
    assert.equal(chapterDeck.reviewStatusText, "Not started yet.");
  } finally {
    await rm(fixture.root, { recursive: true, force: true });
  }
});

test("learner-facing dialogue uses purple labels and pink utterances without affecting alignment", () => {
  const tree = { id: "whacksmacker", label: "WhackSmacker", kind: "root", children: [] };
  const output = renderTwoPaneLanguageTree(tree, new Set(["whacksmacker"]), 0, [
    "### Learner-facing Dialogue",
    "",
    "```text",
    "마리아  : 안녕하세요. 저는 마리아 가르시아입니다.",
    "김민준  : 안녕하세요. 저는 김민준입니다.",
    "```",
    "",
    "### Learner-facing Narrative",
    "",
    "마리아는 학생입니다. 제 이름은 ____입니다."
  ].join("\n"), true);
  const stripped = stripAnsi(output);
  const pink = "\x1b[38;5;213m";
  const purple = "\x1b[38;5;141m";
  const reset = "\x1b[0m";

  assert.match(output, new RegExp(`${escapeRegExp(purple)}마리아  :${escapeRegExp(reset)} ${escapeRegExp(pink)}안녕하세요\\. 저는 마리아 가르시아입니다\\.${escapeRegExp(reset)}`, "u"));
  assert.match(output, new RegExp(`${escapeRegExp(purple)}김민준  :${escapeRegExp(reset)} ${escapeRegExp(pink)}안녕하세요\\. 저는 김민준입니다\\.${escapeRegExp(reset)}`, "u"));
  assert.match(output, new RegExp(`${escapeRegExp(pink)}마리아는 학생입니다\\. 제 이름은 ____입니다\\.${escapeRegExp(reset)}`, "u"));
  assert.doesNotMatch(output, new RegExp(`${escapeRegExp(purple)}마리아  : 안녕하세요`, "u"));
  assert.doesNotMatch(output, new RegExp(`${escapeRegExp(purple)}마리아는`, "u"));
  assert.match(stripped, /마리아\s+: 안녕하세요/u);
  assert.match(stripped, /김민준\s+: 안녕하세요/u);
  assert.match(stripped, /제 이름은 ____입니다\./u);
  assert.doesNotMatch(stripped, /^.*\|\s+code\s+\|.*$/mu);

  const dialogueLines = stripped
    .split("\n")
    .map(rightPaneCell)
    .filter((line) => line.includes("안녕하세요"));
  const colonColumns = dialogueLines.map((line) => displayColumnOf(line, ":"));
  const sentenceColumns = dialogueLines.map((line) => displayColumnOf(line, "안"));

  assert.equal(dialogueLines.length, 2);
  assert.deepEqual(new Set(colonColumns).size, 1);
  assert.deepEqual(new Set(sentenceColumns).size, 1);
});

test("learner-facing dialogue wrapping keeps continuation utterances pink and Unicode labels aligned", () => {
  const tree = { id: "whacksmacker", label: "WhackSmacker", kind: "root", children: [] };
  const output = renderTwoPaneLanguageTree(tree, new Set(["whacksmacker"]), 0, [
    "### Learner-facing Dialogue",
    "",
    "Nguyễn Minh: Đây là một câu nói rất dài để buộc phần lời thoại xuống dòng tiếp theo trong ô nội dung.",
    "Ánh        : Chào bạn!",
    "張偉       : 你好！"
  ].join("\n"), true, 0, 12, "en-US", "navigation", 100);
  const pink = "\x1b[38;5;213m";
  const purple = "\x1b[38;5;141m";
  const reset = "\x1b[0m";
  const stripped = stripAnsi(output);

  assert.match(output, new RegExp(`${escapeRegExp(purple)}Nguyễn Minh:${escapeRegExp(reset)} ${escapeRegExp(pink)}Đây là`, "u"));
  assert.match(output, new RegExp(`${escapeRegExp(pink)}dài để buộc phần lời${escapeRegExp(reset)}`, "u"));
  assert.match(output, new RegExp(`${escapeRegExp(purple)}Ánh        :${escapeRegExp(reset)} ${escapeRegExp(pink)}Chào bạn!${escapeRegExp(reset)}`, "u"));
  assert.match(output, new RegExp(`${escapeRegExp(purple)}張偉       :${escapeRegExp(reset)} ${escapeRegExp(pink)}你好！${escapeRegExp(reset)}`, "u"));
  const aligned = stripped.split("\n").map(rightPaneCell).filter((line) => /Chào bạn|你好/u.test(line));
  assert.equal(aligned.length, 2);
  assert.deepEqual(new Set(aligned.map((line) => displayColumnOf(line, ":"))).size, 1);
});

test("Source and Translation state preserve shared reading colors", () => {
  const tree = { id: "whacksmacker", label: "WhackSmacker", kind: "root", children: [] };
  const text = [
    "### Learner-facing Dialogue", "", "Maria: Xin chào.", "",
    "### Natural English Translation", "", "Maria: Hello."
  ].join("\n");
  const semanticBoundary = "\x1b[38;5;141mMaria:\x1b[0m \x1b[38;5;213mXin chào.\x1b[0m";
  for (const [sourceLocale, translationEnabled] of [["en-US", false], ["en-US", true], ["zh-Hant-TW", false], ["zh-Hant-TW", true]]) {
    const output = renderTwoPaneLanguageTree(tree, new Set(), 0, text, true, 0, 20, sourceLocale, "toggles", 150, 2, "normal", translationEnabled);
    assert.ok(output.includes(semanticBoundary));
    assert.ok(output.includes("\x1b[38;5;141mMaria:\x1b[0m \x1b[38;5;213mHello.\x1b[0m"));
  }
});

test("NO_COLOR and non-TTY rendering preserve semantic reading text without ANSI", () => {
  const tree = { id: "whacksmacker", label: "WhackSmacker", kind: "root", children: [] };
  const text = [
    "### Learner-facing Dialogue", "", "Nguyễn Minh: Chào bạn!", "",
    "### Learner-facing Narrative", "", "Maria đi học."
  ].join("\n");
  for (const colorsEnabled of [shouldUseTerminalColors(true, { NO_COLOR: "1" }), shouldUseTerminalColors(false, {})]) {
    const output = renderTwoPaneLanguageTree(tree, new Set(), 0, text, colorsEnabled, 0, 20, "en-US", "navigation", 150);
    assert.doesNotMatch(output, /\x1b\[/u);
    assert.match(output, /Nguyễn Minh: Chào bạn!/u);
    assert.match(output, /Maria đi học\./u);
  }
});

test("two-pane renderer starts chapter content near the content pane border", () => {
  const tree = { id: "whacksmacker", label: "WhackSmacker", kind: "root", children: [] };
  const output = renderTwoPaneLanguageTree(tree, new Set(["whacksmacker"]), 0, [
    "# Chapter 1 -- A Polite First Meeting",
    "",
    "A polite first meeting introduces the topic particle 은/는.",
    "",
    "```text",
    "민지: 안녕하세요.",
    "준호: 안녕하세요.",
    "```"
  ].join("\n"), false);
  const frameLines = output.split("\n").filter((line) => line.startsWith("| "));
  const contentBorderColumns = frameLines.map((line) => displayColumnOf(line, "|", 2));
  const headingLine = frameLines.find((line) => line.includes("Ch 1 -- A Polite")) ?? "";
  const bodyLine = frameLines.find((line) => line.includes("A polite first meeting")) ?? "";
  const dialogueLine = frameLines.find((line) => line.includes("민지:")) ?? "";
  const headingStart = displayColumnOf(headingLine, "C");
  const bodyStart = displayColumnOf(bodyLine, "A");
  const dialogueStart = displayColumnOf(dialogueLine, "민");

  assert.deepEqual(new Set(contentBorderColumns).size, 1);
  assert.equal(headingStart, (contentBorderColumns[0] ?? 0) + 2);
  assert.equal(bodyStart, (contentBorderColumns[0] ?? 0) + 2);
  assert.equal(dialogueStart, (contentBorderColumns[0] ?? 0) + 2);
  assert.ok((contentBorderColumns[0] ?? 0) >= 33);
  assert.ok((contentBorderColumns[0] ?? 0) <= 75);
  assert.doesNotMatch(output, /Chapter 1 -- A Polite First Meeting/u);
  assert.doesNotMatch(output, /^.*\|\s+code\s+\|.*$/mu);
});

test("two-pane renderer supports right pane scroll offsets", () => {
  const tree = {
    id: "whacksmacker",
    label: "WhackSmacker",
    kind: "root"
  };
  const longText = Array.from({ length: 40 }, (_, index) => `- Line ${index + 1}`).join("\n");
  const output = renderTwoPaneLanguageTree(tree, new Set(["whacksmacker"]), 0, longText, false, 10);

  assert.match(output, /Line 11/);
  assert.doesNotMatch(output, /Line 1\s/);
  assert.match(output, /Output 11-38\/40/);
  assert.match(output, /PgUp\/PgDn scroll/);
});

test("two-pane renderer pins embedded review controls to the bottom bar", () => {
  const tree = {
    id: "whacksmacker",
    label: "WhackSmacker",
    kind: "root"
  };
  const longReview = [
    "Phrase:",
    "",
    "question",
    "",
    "Answer:",
    "",
    ...Array.from({ length: 35 }, (_, index) => `answer detail ${index + 1}`),
    "[[WHACKSMACKER_REVIEW_BOTTOM_BAR]]",
    "1 Again   2 Hard   3 Good   4 Easy"
  ].join("\n");
  const output = renderTwoPaneLanguageTree(tree, new Set(["whacksmacker"]), 0, longReview, false);
  const paneRows = output.split("\n").filter((line) => /^\|/u.test(line));
  const lastBodyRow = paneRows.at(-1) ?? "";

  assert.match(output, /1 Again\s+2 Hard\s+3 Good\s+4 Easy/);
  assert.match(lastBodyRow, /1 Again\s+2 Hard\s+3 Good\s+4 Easy/);
  assert.doesNotMatch(output, /\[\[WHACKSMACKER_REVIEW_BOTTOM_BAR\]\]/);
});

test("Dutch review sources submenu uses clean selectable deck labels", async () => {
  const fixture = await createInstalledDutchFixture();
  try {
    const sources = await listReadingReviewSources({
      dataDir: fixture.dataDir,
      packageId: "com.sleepymario.language.dutch"
    });
    const items = reviewSourcesToMenuItems(sources);

    assert.deepEqual(items.map((item) => item.label), ["Chapter 1-5", "Chapter 6-10", "Chapter 11-15", "Chapter 16-20", "Chapter 21-25", "Chapter 26-30", "Chapter 31-35", "Chapter 36-40", "Chapter 41-45", "Chapter 46-50", "Chapter 51-55", "Chapter 56-60", "Chapter 61-65", "Chapter 66-70", "Chapter 71-75"]);
    assert.equal(items.some((item) => item.label.includes("com.sleepymario.language.dutch")), false);
    assert.equal(items.some((item) => item.label.includes("cards.tsv")), false);
  } finally {
    await fixture.cleanup();
  }
});

test("selecting an installed review source runs review inside the right pane", async () => {
  const fixture = await createInstalledDutchFixture();
  const calls = [];
  const terminal = new FakeTerminal([
    key("down"),
    key("return"),
    key("down"),
    key("return"),
    key("down"),
    key("down"),
    key("return"),
    key("down"),
    key("return"),
    key("return"),
    key("return"),
    key("3", { sequence: "3" }),
    key("q", { sequence: "q" }),
    key("q", { sequence: "q" })
  ]);

  try {
    const registry = createStubRegistry(calls);
    await runInteractiveMenu(registry, terminal, { dataDir: fixture.dataDir });

    assert.deepEqual(calls, []);
    assert.equal(terminal.restoreCount, 1);
    assert.equal(terminal.enterCount, 1);
    assert.match(terminal.output, /Review decks/);
    assert.match(terminal.output, /Chapter 1-5/);
    assert.match(terminal.output, /Press Enter or Space to start review in this pane\./);
    assert.match(terminal.output, /Phrase:/);
    assert.match(terminal.output, /Answer:/);
    assert.match(terminal.output, /Phrase:[\s\S]+Answer:/);
    assert.doesNotMatch(stripAnsi(terminal.output), /^Prompt$/m);
    assert.doesNotMatch(stripAnsi(terminal.output), /^Answer$/m);
    assert.doesNotMatch(stripAnsi(terminal.output), /^Deck: Chapter 1-5$/m);
    assert.doesNotMatch(stripAnsi(terminal.output), /Notes\n\s+Deck:/);
    assert.match(stripAnsi(terminal.output), /1 Again\s+2 Hard\s+3 Good\s+4 Easy/);
    assert.match(stripAnsi(terminal.output), /Esc Leave Review/);
    assert.match(terminal.output, /\x1b\[31m1 Again\x1b\[0m/);
    assert.match(terminal.output, /\x1b\[33m2 Hard\x1b\[0m/);
    assert.match(terminal.output, /\x1b\[32m3 Good\x1b\[0m/);
    assert.match(terminal.output, /\x1b\[36m4 Easy\x1b\[0m/);
    assert.match(terminal.output, /Review stopped: Chapter 1-5/);
    assert.doesNotMatch(terminal.output, /Review: Dutch -- Chapter 1-5/);
    assert.doesNotMatch(terminal.output, /Press Enter to show answer, or q to stop:/);
    assert.doesNotMatch(terminal.output, /> com\.sleepymario\.language\.dutch 0\.1\.0 review-decks\/chapter-001-005\/cards\.tsv Chapter 1-5 \(80 items\)/);
    assert.doesNotMatch(terminal.output, /q\.Press Enter/);
  } finally {
    await fixture.cleanup();
  }
});

test("changing Source reprojects the active Dutch review card without resetting its order or side", async () => {
  const fixture = await createInstalledDutchFixture();
  const terminal = new FakeTerminal([
    key("down"),
    key("return"),
    key("down"),
    key("return"),
    key("down"),
    key("down"),
    key("return"),
    key("down"),
    key("return"),
    key("return"),
    key("return"),
    key("right"),
    key("return"),
    key("q", { sequence: "q" }),
    key("q", { sequence: "q" })
  ], { colorsEnabled: false, width: 150 });

  try {
    await runInteractiveMenu(createStubRegistry([]), terminal, { dataDir: fixture.dataDir });
    const screens = terminal.output.split("\x1b[2J\x1b[H").filter(Boolean).map(stripAnsi);
    const english = screens.find((screen) => screen.includes("Source: English") && screen.includes("Review: Dutch / Chapter 1-5") && screen.includes("1 Again"));
    const traditionalChinese = screens.find((screen) => screen.includes("Source: 中文（臺灣）") && screen.includes("Review: Dutch / Chapter 1-5") && screen.includes("Examples:"));
    assert.ok(english, "answer side is visible before Source changes");
    assert.ok(traditionalChinese, "the same answer-side session remains visible after Source changes");
    assert.match(english, /Card: 1\/60/u);
    assert.match(traditionalChinese, /Card: 1\/60/u);
    assert.match(traditionalChinese, /Phrase:/u);
    assert.match(traditionalChinese, /Answer:/u);
    assert.match(traditionalChinese, /Examples:/u);
    assert.doesNotMatch(traditionalChinese, /目前有 60 張牌卡需要複習|Press Enter or Space to start review/u);
  } finally {
    await fixture.cleanup();
  }
});

for (const [ratingKey, expectedRating] of [["1", "again"], ["2", "hard"], ["3", "good"], ["4", "easy"]]) {
  test(`embedded review accepts numeric rating ${ratingKey} as ${expectedRating}`, async () => {
    const fixture = await createInstalledDutchFixture();
    const terminal = new FakeTerminal(embeddedDutchReviewKeys(ratingKey));
    try {
      await runInteractiveMenu(createStubRegistry([]), terminal, { dataDir: fixture.dataDir });
      const progress = await loadDutchReviewProgress(fixture.dataDir);

      assert.equal(progress.events.some((event) => event.packageId === "com.sleepymario.language.dutch" && event.rating === expectedRating), true);
      assert.equal(progress.items.some((item) => item.packageId === "com.sleepymario.language.dutch" && item.reviewCount === 1), true);
    } finally {
      await fixture.cleanup();
    }
  });
}

test("embedded review controls render plainly when terminal colors are disabled", async () => {
  const fixture = await createInstalledDutchFixture();
  const terminal = new FakeTerminal(embeddedDutchReviewKeys("3"), { colorsEnabled: false });
  try {
    await runInteractiveMenu(createStubRegistry([]), terminal, { dataDir: fixture.dataDir });

    assert.doesNotMatch(terminal.output, /\x1b\[[0-9;]*m/);
    assert.match(terminal.output, /Phrase:[\s\S]+Answer:/);
    assert.doesNotMatch(terminal.output, /^Prompt$/m);
    assert.doesNotMatch(terminal.output, /^Answer$/m);
    assert.doesNotMatch(terminal.output, /^Deck: Chapter 1-5$/m);
    assert.doesNotMatch(terminal.output, /Notes\n\s+Deck:/);
    assert.match(terminal.output, /1 Again/);
    assert.match(terminal.output, /2 Hard/);
    assert.match(terminal.output, /3 Good/);
    assert.match(terminal.output, /4 Easy/);
    assert.match(terminal.output, /Esc Leave Review/);
  } finally {
    await fixture.cleanup();
  }
});

test("embedded review hides internal notes and renders compact learner notes and examples", () => {
  const exercise = reviewExercise({
    promptLanguage: "nl",
    answerLanguage: "en",
    promptLines: ["student"],
    answerLines: ["student"],
    noteLines: [
      "Deck: Chapter 1-5. Simple review entry, not a grammar-pattern card",
      "noun",
      "kinship noun",
      "Example: Ik ben student.",
      "Example Sentence: De student is hier.",
      "This long internal prose explains how the template generated this review entry and should not be shown to learners because it is not useful during study."
    ],
    exampleLines: [
      "Sophie is student.",
      "Extra example should be capped."
    ]
  });
  const output = formatEmbeddedReviewReveal(exercise, exercise, false, "com.sleepymario.language.dutch");

  assert.doesNotMatch(output, /Simple review entry/);
  assert.doesNotMatch(output, /not a grammar-pattern card/);
  assert.doesNotMatch(output, /template generated/);
  assert.match(output, /Notes\n  - noun\n  - kinship noun\n\nExamples:\n  - Ik ben student\.\n  - De student is hier\.\n  - Sophie is student\./);
  assert.doesNotMatch(output, /Extra example should be capped/);
  assert.doesNotMatch(output, /\x1b\[[0-9;]*m/);
});

test("normal five-chapter review reveal hides raw Notes but retains literal examples", () => {
  const exercise = reviewExercise({
    promptLanguage: "vi",
    answerLanguage: "en",
    promptLines: ["xin chào"],
    answerLines: ["hello; greetings"],
    noteLines: ["Internal provenance note."],
    exampleLines: ["Xin chào!"]
  });
  const output = formatEmbeddedReviewReveal(
    exercise,
    exercise,
    false,
    "com.sleepymario.language.vietnamese.reviews",
    "review-decks/chapter-001-005/cards.tsv"
  );
  assert.doesNotMatch(output, /Notes|Internal provenance note/u);
  assert.match(output, /Examples:\n  - Xin chào!/u);
});

test("Normal review removes a terminal taught-frame qualification without changing raw Expert or Developer data", () => {
  const exercise = reviewExercise({
    promptLanguage: "en",
    answerLanguage: "vi",
    promptLines: ["this; there in the taught frame"],
    answerLines: ["đây"],
    noteLines: [],
    exampleLines: ["Đây là sách."]
  });
  const normal = formatEmbeddedReviewReveal(exercise, exercise, false, "com.sleepymario.language.vietnamese.reviews", undefined, "normal");
  const expert = formatEmbeddedReviewReveal(exercise, exercise, false, "com.sleepymario.language.vietnamese.reviews", undefined, "expert");
  const developer = formatEmbeddedReviewReveal(exercise, exercise, false, "com.sleepymario.language.vietnamese.reviews", undefined, "developer");

  assert.match(normal, /Phrase:\s*\n  this; there/u);
  assert.doesNotMatch(normal, /in the taught frame/iu);
  assert.match(expert, /Phrase:\s*\n  this; there in the taught frame/u);
  assert.match(developer, /Phrase:\s*\n  this; there in the taught frame/u);
  for (const output of [normal, expert, developer]) {
    assert.match(output, /Answer:\s*\n  đây/u);
    assert.match(output, /Examples:\n  - Đây là sách\./u);
  }
});

test("two-pane renderer aligns Korean markdown table columns by display width", () => {
  const tree = { id: "whacksmacker", label: "WhackSmacker", kind: "root", children: [] };
  const output = renderTwoPaneLanguageTree(tree, new Set(["whacksmacker"]), 0, [
    "| Korean | Meaning | Notes |",
    "|---|---|---|",
    "| 안녕하세요 | hello | Fixed greeting expression. |",
    "| 저 | I, me | Used inside `저는`. |",
    "| 외국 | foreign country, abroad | New noun; not self-ID here. |"
  ].join("\n"), false);
  const tableLines = output
    .split("\n")
    .map(rightPaneCell)
    .filter((line) => line.startsWith("| "));
  const pipeColumns = tableLines.map(displayPipeColumns);

  assert.equal(tableLines.length, 7);
  assert.deepEqual(new Set(pipeColumns.map((columns) => JSON.stringify(columns))).size, 1);
  assert.match(tableLines[0], /^\| Korean\s+\| Meaning\s+\| Notes\s+\|$/u);
  assert.match(tableLines[2], /^\| 안녕하세요\s+\| hello\s+\| Fixed greeting expression\.\s+\|$/u);
  assert.match(tableLines[3], /^\|\s+\|\s+\|\s+\|$/u);
  assert.match(tableLines[5], /^\|\s+\|\s+\|\s+\|$/u);
  assert.match(tableLines[6], /^\| 외국\s+\| foreign country, abroad\s+\| Noun\s+\|$/u);
  assert.doesNotMatch(tableLines.join("\n"), /New noun; not self-ID here|Can fill the N slot/u);
});

test("two-pane renderer hides useless Status table columns and wraps remaining cells", () => {
  const tree = { id: "whacksmacker", label: "WhackSmacker", kind: "root", children: [] };
  const output = renderTwoPaneLanguageTree(tree, new Set(["whacksmacker"]), 0, [
    "| Korean Word | Hanja Form | Meaning in This Usage | Status | Note |",
    "|---|---|---|---|---|",
    "| 친구 | 親舊 | friend | reference-only | Modern meaning is friend; do not teach character-by-character analysis here because this note is intentionally long and should wrap inside the wider content pane without pushing the right border away. |",
    "| 선생님 | 先生님 | teacher | reference-only | 님 is Korean honorific material, not Hanja. |"
  ].join("\n"), false);
  const tableLines = output
    .split("\n")
    .map(rightPaneCell)
    .filter((line) => line.startsWith("| "));
  const pipeColumns = tableLines.map(displayPipeColumns);

  assert.ok(tableLines.length > 4);
  assert.deepEqual(new Set(pipeColumns.map((columns) => JSON.stringify(columns))).size, 1);
  assert.doesNotMatch(tableLines.join("\n"), /Status|reference-only/u);
  assert.match(tableLines[0], /^\| Korean Word\s+\| Hanja Form\s+\| Meaning in This Usage\s+\| Note\s+\|$/u);
  assert.ok(tableLines.length > 5);
  assert.match(tableLines.join("\n"), /do not[\s\S]*teach/u);
});

test("two-pane renderer preserves origin-based Korean dialogue name alignment by display width", () => {
  const tree = { id: "whacksmacker", label: "WhackSmacker", kind: "root", children: [] };
  const output = renderTwoPaneLanguageTree(tree, new Set(["whacksmacker"]), 0, [
    "### Learner-facing Dialogue",
    "",
    "```text",
    "마리아: 안녕하세요. 저는 마리아 가르시아입니다.",
    "김민준: 안녕하세요. 저는 김민준입니다.",
    "```"
  ].join("\n"), false);
  const dialogueLines = output
    .split("\n")
    .map(rightPaneCell)
    .filter((line) => line.includes("안녕하세요"));
  const contentLines = dialogueLines.map((line) => line.trimStart());
  const colonColumns = dialogueLines.map((line) => displayColumnOf(line, ":"));
  const sentenceColumns = dialogueLines.map((line) => displayColumnOf(line, "안"));

  assert.equal(dialogueLines.length, 2);
  assert.deepEqual(new Set(colonColumns).size, 1);
  assert.deepEqual(new Set(sentenceColumns).size, 1);
  assert.equal(dialogueLines[0]?.startsWith("마리아:"), true);
  assert.equal(dialogueLines[1]?.startsWith("김민준:"), true);
  assert.match(contentLines.join("\n"), /^마리아:/mu);
  assert.match(contentLines.join("\n"), /^김민준:/mu);
  assert.doesNotMatch(contentLines.join("\n"), /^A:|^B:/mu);
  assert.doesNotMatch(contentLines.join("\n"), /Maria/u);
  assert.doesNotMatch(contentLines.join("\n"), /^마리아 가르시아:/mu);
});

test("Chinese A prompt reveals pronunciation and characters", () => {
  const output = formatEmbeddedReviewReveal(chineseExercise({
    promptLanguage: "en",
    answerLanguage: "zh-Hant",
    promptLines: ["hello"],
    answerLines: ["Pinyin: nǐ hǎo", "Zhuyin: ㄋㄧˇ ㄏㄠˇ", "Characters: 你好"]
  }), chineseExercise({
    promptLanguage: "en",
    answerLanguage: "zh-Hant",
    promptLines: ["hello"],
    answerLines: ["Pinyin: nǐ hǎo", "Zhuyin: ㄋㄧˇ ㄏㄠˇ", "Characters: 你好"]
  }), false, "com.sleepymario.language.chinese.mandarin.traditional");

  assert.match(output, /Phrase:[\s\S]+hello/);
  assert.match(output, /Answer:[\s\S]+Pinyin: nǐ hǎo/);
  assert.match(output, /Zhuyin: ㄋㄧˇ ㄏㄠˇ/);
  assert.match(output, /Characters: 你好/);
  assert.doesNotMatch(output, /com\.sleepymario/);
  assert.doesNotMatch(output, /review-decks\//);
  assert.doesNotMatch(output, /^Prompt$/m);
  assert.doesNotMatch(output, /^Answer$/m);
});

test("Chinese C prompt reveals meaning and pronunciation", () => {
  const exercise = chineseExercise({
    promptLanguage: "zh-Hant",
    answerLanguage: "en",
    promptLines: ["你好"],
    answerLines: ["Meaning: hello", "Pinyin: nǐ hǎo", "Zhuyin: ㄋㄧˇ ㄏㄠˇ"]
  });
  const output = formatEmbeddedReviewReveal(exercise, exercise, false, "com.sleepymario.language.chinese.mandarin.traditional");

  assert.match(output, /Phrase:[\s\S]+你好/);
  assert.match(output, /Answer:[\s\S]+Meaning: hello/);
  assert.match(output, /Pinyin: nǐ hǎo/);
  assert.match(output, /Zhuyin: ㄋㄧˇ ㄏㄠˇ/);
});

test("Chinese compound B prompt reveals meaning and characters", () => {
  const exercise = chineseExercise({
    promptLanguage: "zh-Latn-pinyin",
    answerLanguage: "zh-Hant",
    promptLines: ["Pinyin: nǐ hǎo", "Zhuyin: ㄋㄧˇ ㄏㄠˇ"],
    answerLines: ["Meaning: hello", "Characters: 你好"]
  });
  const output = formatEmbeddedReviewReveal(exercise, exercise, false, "com.sleepymario.language.chinese.mandarin.simplified");

  assert.match(output, /Phrase:[\s\S]+nǐ hǎo[\s\S]+ㄋㄧˇ ㄏㄠˇ/);
  assert.match(output, /Answer:[\s\S]+Meaning: hello/);
  assert.match(output, /Characters: 你好/);
});

test("Chinese non-compound structured B prompt is not used in embedded review sessions", () => {
  const item = chineseReviewItem({
    promptLanguage: "zh-Latn-pinyin",
    answerLanguage: "zh-Hant",
    prompt: "Pinyin: mā\nZhuyin: ㄇㄚ",
    answer: "Meaning: mother\nCharacters: 媽"
  });

  assert.equal(isEmbeddedReviewItemUsable(item), false);
});

test("Japanese A prompt reveals reading and mixed written form", () => {
  const exercise = reviewExercise({
    promptLanguage: "en",
    answerLanguage: "ja",
    promptLines: ["together"],
    answerLines: ["Reading: いっしょに", "Japanese: 一緒に"]
  });
  const output = formatEmbeddedReviewReveal(exercise, exercise, false, "com.sleepymario.language.japanese");

  assert.match(output, /Phrase:[\s\S]+together/);
  assert.match(output, /Answer:[\s\S]+Reading: いっしょに/);
  assert.match(output, /Japanese: 一緒に/);
  assert.doesNotMatch(output, /com\.sleepymario/);
  assert.doesNotMatch(output, /review-decks\//);
  assert.doesNotMatch(output, /^Prompt$/m);
  assert.doesNotMatch(output, /^Answer$/m);
});

test("Japanese C prompt reveals meaning and kana-only reading", () => {
  const exercise = reviewExercise({
    promptLanguage: "ja",
    answerLanguage: "en",
    promptLines: ["一緒に"],
    answerLines: ["Meaning: together", "Reading: いっしょに"]
  });
  const output = formatEmbeddedReviewReveal(exercise, exercise, false, "com.sleepymario.language.japanese");

  assert.match(output, /Phrase:[\s\S]+一緒に/);
  assert.match(output, /Answer:[\s\S]+Meaning: together/);
  assert.match(output, /Reading: いっしょに/);
  assert.doesNotMatch(output, /Japanese: 一緒に/);
});

test("Japanese two-plus mora B prompt reveals meaning and written form", () => {
  const exercise = reviewExercise({
    promptLanguage: "ja-Kana",
    answerLanguage: "ja",
    promptLines: ["Reading: いっしょに"],
    answerLines: ["Meaning: together", "Japanese: 一緒に"]
  });
  const output = formatEmbeddedReviewReveal(exercise, exercise, false, "com.sleepymario.language.japanese");

  assert.match(output, /Phrase:[\s\S]+いっしょに/);
  assert.match(output, /Answer:[\s\S]+Meaning: together/);
  assert.match(output, /Japanese: 一緒に/);
});

test("Japanese short one-mora structured B prompt is not used in embedded review sessions", () => {
  const item = reviewItem({
    packageId: "com.sleepymario.language.japanese",
    promptLanguage: "ja-Kana",
    answerLanguage: "ja",
    prompt: "Reading: き",
    answer: "Meaning: tree\nJapanese: 木"
  });

  assert.equal(isEmbeddedReviewItemUsable(item), false);
});

test("non-Chinese embedded review rendering remains unchanged", () => {
  const exercise = reviewExercise({
    promptLanguage: "nl",
    answerLanguage: "en",
    promptLines: ["hallo"],
    answerLines: ["hello"]
  });
  const output = formatEmbeddedReviewReveal(exercise, exercise, false, "com.sleepymario.language.dutch");

  assert.match(output, /Phrase:[\s\S]+hallo/);
  assert.match(output, /Answer:[\s\S]+hello/);
  assert.doesNotMatch(output, /Pinyin:/);
  assert.doesNotMatch(output, /Characters:/);
});

test("review section can be expanded without starting review", async () => {
  const fixture = await createInstalledDutchFixture();
  const calls = [];
  const terminal = new FakeTerminal([
    key("down"),
    key("return"),
    key("down"),
    key("return"),
    key("down"),
    key("down"),
    key("return"),
    key("down"),
    key("q", { sequence: "q" })
  ]);

  try {
    await runInteractiveMenu(createStubRegistry(calls), terminal, { dataDir: fixture.dataDir });

    assert.deepEqual(calls, []);
    assert.match(terminal.output, /Review decks/);
    assert.match(terminal.output, /Chapter 1-5/);
  } finally {
    await fixture.cleanup();
  }
});

test("Enter on an available module does not install but Space installs and refreshes installed modules", async () => {
  const fixture = await createInstalledLanguageFixture(["vietnamese-curriculum", "dutch-curriculum"], []);
  try {
    const enterOnly = new FakeTerminal([
      key("down"),
      key("down"),
      key("down"),
      key("down"),
      key("down"),
      key("down"),
      key("return"),
      key("down"),
      key("down"),
      key("return"),
      key("q", { sequence: "q" })
    ]);
    await runInteractiveMenu(createStubRegistry([]), enterOnly, { dataDir: fixture.dataDir, cataloguePath: fixture.cataloguePath });
    let tree = await buildModuleTree({ dataDir: fixture.dataDir, cataloguePath: fixture.cataloguePath });
    let installedLanguages = tree.children.find((node) => node.label === "Installed modules").children.find((node) => node.label === "Languages");

    assert.equal(installedLanguages.children.some((node) => node.label === "Vietnamese"), false);
    assert.match(enterOnly.output, /Modules available/u);

    const install = new FakeTerminal([
      key("down"),
      key("down"),
      key("down"),
      key("down"),
      key("down"),
      key("down"),
      key("return"),
      key("down"),
      key("down"),
      key(" ", { name: "space", sequence: " " }),
      key("q", { sequence: "q" })
    ]);
    await runInteractiveMenu(createStubRegistry([]), install, { dataDir: fixture.dataDir, cataloguePath: fixture.cataloguePath });
    tree = await buildModuleTree({ dataDir: fixture.dataDir, cataloguePath: fixture.cataloguePath });
    installedLanguages = tree.children.find((node) => node.label === "Installed modules").children.find((node) => node.label === "Languages");
    const availableLanguages = tree.children.find((node) => node.label === "Modules available").children.find((node) => node.label === "Languages");

    assert.ok(installedLanguages.children.some((node) => node.label === "Vietnamese"));
    assert.ok(availableLanguages.children.some((node) => node.label === "Vietnamese [Installed]"));
    assert.match(install.output, /Module installed\./);

    const alreadyInstalled = new FakeTerminal([
      key("down"),
      key("down"),
      key("down"),
      key("down"),
      key("down"),
      key("down"),
      key("return"),
      key("down"),
      key("down"),
      key(" ", { name: "space", sequence: " " }),
      key("q", { sequence: "q" })
    ]);
    await runInteractiveMenu(createStubRegistry([]), alreadyInstalled, { dataDir: fixture.dataDir, cataloguePath: fixture.cataloguePath });
    assert.match(alreadyInstalled.output, /Already installed/);
  } finally {
    await fixture.cleanup();
  }
});

test("installed modules expose uninstall and cancel leaves package and progress untouched", async () => {
  const fixture = await createInstalledDutchFixture();
  try {
    await createDutchReviewProgress(fixture.dataDir);
    const terminal = new FakeTerminal([
      key("down"),
      key("return"),
      key("down"),
      key("u", { sequence: "u" }),
      key("escape"),
      key("q", { sequence: "q" })
    ]);

    await runInteractiveMenu(createStubRegistry([]), terminal, { dataDir: fixture.dataDir });

    assert.match(terminal.output, /Uninstall Dutch/);
    assert.match(terminal.output, /Esc: cancel/);
    assert.match(terminal.output, /Uninstall cancelled: Dutch/);
    assert.equal((await listInstalledContentPackages(fixture.dataDir)).length, 2);
    assert.equal((await loadDutchReviewProgress(fixture.dataDir)).items.some((item) => item.packageId === "com.sleepymario.language.dutch"), true);
  } finally {
    await fixture.cleanup();
  }
});

test("package-only uninstall removes installed module but keeps saved review progress", async () => {
  const fixture = await createInstalledDutchFixture();
  try {
    await createDutchReviewProgress(fixture.dataDir);
    const terminal = new FakeTerminal([
      key("down"),
      key("return"),
      key("down"),
      key("u", { sequence: "u" }),
      key("k", { sequence: "k" }),
      key("q", { sequence: "q" })
    ]);

    await runInteractiveMenu(createStubRegistry([]), terminal, { dataDir: fixture.dataDir });

    assert.match(terminal.output, /Module uninstalled\./);
    assert.match(terminal.output, /Saved user data was kept/);
    assert.deepEqual((await listInstalledContentPackages(fixture.dataDir)).map(item => item.packageId), ["com.sleepymario.language.dutch.reviews"]);
    assert.equal((await loadDutchReviewProgress(fixture.dataDir)).items.some((item) => item.packageId === "com.sleepymario.language.dutch"), true);
  } finally {
    await fixture.cleanup();
  }
});

test("destructive uninstall removes only selected package review progress", async () => {
  const fixture = await createInstalledDutchFixture();
  try {
    await createDutchReviewProgress(fixture.dataDir);
    const progressDir = join(dirname(fixture.dataDir), "progress");
    const before = await loadReviewProgressStore(progressDir);
    assert.equal(before.items.some((item) => item.packageId === "com.sleepymario.language.dutch"), true);
    const terminal = new FakeTerminal([
      key("down"),
      key("return"),
      key("down"),
      key("u", { sequence: "u" }),
      key("d", { sequence: "d" }),
      key("q", { sequence: "q" })
    ]);

    await runInteractiveMenu(createStubRegistry([]), terminal, { dataDir: fixture.dataDir });
    const after = await loadReviewProgressStore(progressDir);

    assert.match(terminal.output, /Saved review progress deleted for this package only/);
    assert.match(terminal.output, /Removed review states: 1/);
    assert.deepEqual((await listInstalledContentPackages(fixture.dataDir)).map(item => item.packageId), ["com.sleepymario.language.dutch.reviews"]);
    assert.equal(after.items.some((item) => item.packageId === "com.sleepymario.language.dutch"), false);
    assert.equal(after.events.some((event) => event.packageId === "com.sleepymario.language.dutch"), false);
  } finally {
    await fixture.cleanup();
  }
});

test("package without review sources can show a helpful message node", () => {
  const tree = {
    id: "languages",
    label: "Languages",
    kind: "root",
    children: [{
      id: "com.sleepymario.language.example",
      label: "Example Language",
      kind: "package",
      children: [{
        id: "com.sleepymario.language.example:review",
        label: "Review decks",
        kind: "review-section",
        children: [{
          id: "com.sleepymario.language.example:review:none",
          label: "No review decks",
          kind: "message",
          previewText: "No review decks are available for this package."
        }]
      }]
    }]
  };
  const expanded = new Set(["languages", "com.sleepymario.language.example", "com.sleepymario.language.example:review"]);
  const visible = flattenVisibleLanguageTree(tree, expanded);
  const output = renderTwoPaneLanguageTree(tree, expanded, visible.findIndex((entry) => entry.node.label === "No review decks"), "No review decks are available for this package.", false);

  assert.match(output, /No review decks/);
  assert.match(output, /No review decks are available for this package\./);
});

test("installed language package read content menu uses selectable content labels", async () => {
  const fixture = await createInstalledDutchFixture();
  const terminal = new FakeTerminal([
    key("down"),
    key("return"),
    key("down"),
    key("return"),
    key("down"),
    key("return"),
    key("down"),
    key("q", { sequence: "q" })
  ]);

  try {
    await runInteractiveMenu(createCommandRegistry(), terminal, { dataDir: fixture.dataDir });

    assert.match(terminal.output, /Read content/);
    assert.match(terminal.output, /Ch 1/u);
    assert.doesNotMatch(terminal.output, /Ch 1\s*--\s*\.\.\./u);
    assert.doesNotMatch(terminal.output, /# Chapter 1 -- Greetings and Identity/);
    assert.doesNotMatch(terminal.output, /> units\/dutch-core\/chapter-005-basic-sentences-5\/chapter\.md/);
  } finally {
    await fixture.cleanup();
  }
});

test("chess menu item routes to the registered command", async () => {
  const calls = [];
  const terminal = new FakeTerminal([
    key("down"),
    key("down"),
    key("return"),
    key("down"),
    key("return"),
    key("down"),
    key("return"),
    key("escape"),
    key("q", { sequence: "q" })
  ]);

  await runInteractiveMenu(createStubRegistry(calls), terminal);

  assert.deepEqual(calls, [{ path: "chess", args: [] }]);
  assert.match(terminal.output, /Chess/);
  assert.match(terminal.output, /chess output/);
  assert.match(terminal.output, /Use Up\/Down or PageUp\/PageDown to scroll/);
});

test("geography menu routes continents to the registered command", async () => {
  const calls = [];
  const terminal = new FakeTerminal([
    key("down"),
    key("down"),
    key("down"),
    key("return"),
    key("down"),
    key("return"),
    key("down"),
    key("return"),
    key("escape"),
    key("q", { sequence: "q" })
  ]);

  await runInteractiveMenu(createStubRegistry(calls), terminal);

  assert.deepEqual(calls, [{ path: "geography continents", args: [] }]);
  assert.match(terminal.output, /Geography/);
  assert.match(terminal.output, /Continents/);
});

test("quitting restores terminal state", async () => {
  const terminal = new FakeTerminal([key("q", { sequence: "q" })]);

  await runInteractiveMenu(createStubRegistry([]), terminal);

  assert.equal(terminal.enterCount, 1);
  assert.equal(terminal.restoreCount, 1);
});

test("Ctrl-C cleanup restores terminal state and sets exit code 130", async () => {
  const originalExitCode = process.exitCode;
  const terminal = new FakeTerminal([key("c", { ctrl: true })]);

  process.exitCode = undefined;
  await runInteractiveMenu(createStubRegistry([]), terminal);

  assert.equal(process.exitCode, 130);
  assert.equal(terminal.restoreCount, 1);

  process.exitCode = originalExitCode;
});

test("noninteractive menu execution does not hang", async () => {
  const originalExitCode = process.exitCode;
  const originalConsoleError = console.error;
  const errors = [];
  const terminal = new FakeTerminal([], { interactive: false });

  console.error = (message) => {
    errors.push(String(message));
  };

  process.exitCode = undefined;
  try {
    await runInteractiveMenu(createStubRegistry([]), terminal);

    assert.equal(process.exitCode, 1);
    assert.equal(terminal.enterCount, 0);
    assert.equal(terminal.restoreCount, 0);
    assert.match(errors.join("\n"), /Interactive menu requires an interactive terminal/);
  } finally {
    console.error = originalConsoleError;
    process.exitCode = originalExitCode;
  }
});

test("compact WSM header is fixed and includes the exact subtitle", () => {
  const header = renderWhackSmackerHeader(false);

  assert.match(header, /██╗    ██╗███████╗███╗   ███╗/);
  assert.match(header, new RegExp(escapeRegExp(whackSmackerBanner)));
  assert.match(header, new RegExp(escapeRegExp(whackSmackerSubtitle)));
  assert.doesNotMatch(header, /\x1b\[[0-9;]*m/);
});

test("compact WSM header uses ANSI colors in a color-capable terminal", () => {
  const header = renderWhackSmackerHeader(true);

  assert.match(header, /\x1b\[[0-9;]+m/);
  assert.match(stripAnsi(header), new RegExp(escapeRegExp(whackSmackerBanner)));
  assert.match(stripAnsi(header), new RegExp(escapeRegExp(whackSmackerSubtitle)));
});

test("compact WSM header omits ANSI colors when NO_COLOR is set", () => {
  const colorsEnabled = shouldUseTerminalColors(true, { NO_COLOR: "1" });
  const header = renderWhackSmackerHeader(colorsEnabled);

  assert.equal(colorsEnabled, false);
  assert.doesNotMatch(header, /\x1b\[[0-9;]*m/);
});

test("compact WSM header omits ANSI colors for non-TTY output", () => {
  const colorsEnabled = shouldUseTerminalColors(false, {});
  const header = renderWhackSmackerHeader(colorsEnabled);

  assert.equal(colorsEnabled, false);
  assert.doesNotMatch(header, /\x1b\[[0-9;]*m/);
});

test("interactive menu starts with the module tree", async () => {
  const terminal = new FakeTerminal([key("q", { sequence: "q" })]);

  await runInteractiveMenu(createStubRegistry([]), terminal);

  assert.match(stripAnsi(terminal.output), /WhackSmacker/);
  assert.match(stripAnsi(terminal.output), />\s+v Installed modules/);
  assert.match(stripAnsi(terminal.output), /Modules available/);
  assert.match(stripAnsi(terminal.output), /Games/);
  assert.match(stripAnsi(terminal.output), /Geography/);
  assert.match(stripAnsi(terminal.output), /Mathematics/);
  assert.doesNotMatch(stripAnsi(terminal.output), /^\|[^\n]*\bSettings\b/mu);
  assert.doesNotMatch(stripAnsi(terminal.output), /^\|[^\n]*\bSource language\b/mu);
});

test("module tree omits the former Settings source-language path in every locale", async () => {
  for (const locale of ["en-US", "zh-Hant-TW"]) {
    const tree = await buildModuleTree({ locale });
    const nodes = [];
    const visit = (node) => {
      nodes.push(node);
      for (const child of node.children ?? []) {
        visit(child);
      }
    };
    visit(tree);

    assert.deepEqual(tree.children.map((node) => node.id), ["installed-modules", "available-modules"]);
    assert.equal(nodes.some((node) => node.id === "settings" || node.id.startsWith("settings:")), false);
    assert.equal(nodes.some((node) => ["settings", "source-language", "source-locale"].includes(node.kind)), false);
    assert.equal(nodes.some((node) => node.label === "Settings" || node.label === "Source language" || node.label === "設定" || node.label === "來源語言"), false);
  }
});

test("former language shortcut no longer changes the persisted source language", async () => {
  const settingsDir = await mkdtemp(join(tmpdir(), "wsm-pane-language-"));
  try {
    const terminal = new FakeTerminal([
      key("l", { sequence: "l" }),
      key("q", { sequence: "q" })
    ], { colorsEnabled: true });

    await runInteractiveMenu(createStubRegistry([]), terminal, { settingsDir });

    assert.equal((await loadSourceLanguageSettings(settingsDir)).sourceLanguage, "en-US");
    assert.match(terminal.output, /\x1b\[1m\x1b\[38;5;208mSource: English\x1b\[0m/u);
    assert.doesNotMatch(stripAnsi(terminal.output), /中文（臺灣）|已安裝模組/u);
    assert.match(stripAnsi(terminal.output), /Installed modules/u);
  } finally {
    await rm(settingsDir, { recursive: true, force: true });
  }
});

test("left and right arrows focus Toggles while Enter and Space cycle its language", async () => {
  const settingsDir = await mkdtemp(join(tmpdir(), "wsm-pane-focus-"));
  try {
    const terminal = new FakeTerminal([
      key("right"),
      key("return"),
      key("left"),
      key("right"),
      key("space", { sequence: " " }),
      key("left"),
      key("q", { sequence: "q" })
    ], { colorsEnabled: true, width: 150 });

    await runInteractiveMenu(createStubRegistry([]), terminal, { settingsDir });

    const screens = terminal.output.split("\x1b[2J\x1b[H").filter((screen) => screen !== "");
    assert.equal((await loadSourceLanguageSettings(settingsDir)).sourceLanguage, "en-US");
    assert.ok(screens.length >= 7);
    assert.match(screens[1], /\x1b\[7m\x1b\[1m> Source: English\x1b\[0m/u);
    assert.equal((screens[1].match(/\x1b\[7m/gu) ?? []).length, 1);
    assert.match(screens[2], /\x1b\[7m\x1b\[1m> Source: 中文（臺灣）\x1b\[0m/u);
    assert.match(screens[3], /\x1b\[7m\x1b\[1m>[^\n]*已安裝模組/u);
    assert.match(screens[3], /\x1b\[1m\x1b\[38;5;208mSource: 中文（臺灣）\x1b\[0m/u);
    assert.match(screens[4], /\x1b\[7m\x1b\[1m> Source: 中文（臺灣）\x1b\[0m/u);
    assert.match(screens[5], /\x1b\[7m\x1b\[1m> Source: English\x1b\[0m/u);
    assert.match(screens[6], /\x1b\[7m\x1b\[1m>[^\n]*Installed modules/u);
    assert.match(screens[6], /\x1b\[1m\x1b\[38;5;208mSource: English\x1b\[0m/u);
    assert.ok(screens.every((screen) => stripAnsi(screen).includes("Translation: Off")));
    assert.doesNotMatch(terminal.output, /\x1b\[7m[^\n]*Toggles/u);
    assert.doesNotMatch(terminal.output, /\x1b\[7m[^\n]*Output/u);
    assert.match(stripAnsi(terminal.output), /已安裝模組/u);
    assert.match(stripAnsi(terminal.output), /Installed modules/u);
  } finally {
    await rm(settingsDir, { recursive: true, force: true });
  }
});

test("Enter cycles Normal to Expert to Developer while navigation preserves the selection", async () => {
  const settingsDir = await mkdtemp(join(tmpdir(), "wsm-display-mode-"));
  try {
    const terminal = new FakeTerminal([
      key("right"),
      key("down"),
      key("return"),
      key("left"),
      key("down"),
      key("right"),
      key("down"),
      key("return"),
      key("q", { sequence: "q" })
    ], { colorsEnabled: true, width: 150 });

    await runInteractiveMenu(createStubRegistry([]), terminal, { settingsDir });

    const screens = terminal.output.split("\x1b[2J\x1b[H").filter((screen) => screen !== "").map(stripAnsi);
    assert.match(screens[0], /View mode: Normal/u);
    assert.match(screens[2], /> View mode: Normal/u);
    assert.match(screens[3], /> View mode: Expert/u);
    assert.match(screens[4], /View mode: Expert/u);
    assert.match(screens[5], /View mode: Expert/u);
    assert.match(screens[6], /View mode: Expert/u);
    assert.match(screens[7], /> View mode: Expert/u);
    assert.match(screens[8], /> View mode: Developer/u);
  } finally {
    await rm(settingsDir, { recursive: true, force: true });
  }
});

test("source selection and translation visibility change independently", async () => {
  const settingsDir = await mkdtemp(join(tmpdir(), "wsm-independent-translation-toggle-"));
  try {
    const terminal = new FakeTerminal([
      key("right"),
      key("down"),
      key("down"),
      key("return"),
      key("up"),
      key("up"),
      key("return"),
      key("q", { sequence: "q" })
    ], { colorsEnabled: false, width: 150 });
    await runInteractiveMenu(createStubRegistry([]), terminal, { settingsDir });
    const screens = terminal.output.split("\x1b[2J\x1b[H").filter(Boolean).map(stripAnsi);
    assert.ok(screens.some((screen) => screen.includes("Source: English") && screen.includes("Translation: On")));
    assert.ok(screens.some((screen) => screen.includes("Source: 中文（臺灣）") && screen.includes("Translation: On")));
    assert.equal((await loadSourceLanguageSettings(settingsDir)).sourceLanguage, "zh-Hant-TW");
  } finally {
    await rm(settingsDir, { recursive: true, force: true });
  }
});

test("Traditional Chinese Source still shows natural English reading translation in the ordinary output pane", async () => {
  const fixture = await createInstalledDutchFixture();
  try {
    const terminal = new FakeTerminal([
      ...openDutchChapter1Keys(),
      key("right"),
      key("return"),
      key("t", { sequence: "t" }),
      key("pagedown"),
      key("q", { sequence: "q" })
    ], { colorsEnabled: false, width: 150 });
    await runInteractiveMenu(createStubRegistry([]), terminal, { dataDir: fixture.dataDir });
    const screens = terminal.output.split("\x1b[2J\x1b[H").filter(Boolean).map(stripAnsi);
    const visibleTranslation = screens.find((screen) =>
      screen.includes("Source: 中文（臺灣）")
      && screen.includes("Translation: On")
      && screen.includes("Natural English Translation")
      && /Alex\s+: Hello\./u.test(screen)
    );
    assert.ok(visibleTranslation, screens.at(-1));
    assert.match(visibleTranslation, /Marieke: Ik ben docent\./u);
    assert.doesNotMatch(visibleTranslation, /Chinese translation|中文翻譯/u);
  } finally {
    await fixture.cleanup();
  }
});

test("Dutch Chapter 1 right-pane translation item toggles with Enter and Space", async () => {
  const fixture = await createInstalledDutchFixture();
  try {
    const terminal = new FakeTerminal([
      ...openDutchChapter1Keys(),
      key("right"),
      key("down"),
      key("down"),
      key("return"),
      key("pagedown"),
      key("space", { sequence: " " }),
      key("left"),
      key("q", { sequence: "q" })
    ], { colorsEnabled: false, width: 150 });

    await runInteractiveMenu(createStubRegistry([]), terminal, { dataDir: fixture.dataDir });

    const screens = terminal.output.split("\x1b[2J\x1b[H").filter((screen) => screen !== "").map(stripAnsi);
    assert.ok(screens.some((screen) => screen.includes("> Translation: Off")));
    assert.ok(screens.some((screen) => screen.includes("> Translation: On")));
    const onScreen = screens.find((screen) => screen.includes("> Translation: On") && screen.includes("Natural English Translation"));
    assert.match(onScreen, /Natural English Translation/u);
    const finalScreen = screens.at(-1);
    assert.match(finalScreen, /Translation: Off/u);
    assert.doesNotMatch(finalScreen, /Natural English Translation|I'm Alex Chen|I'm a teacher/u);
  } finally {
    await fixture.cleanup();
  }
});

test("Dutch Chapter 1 t shortcut preserves translations across navigation and a new session resets Off", async () => {
  const fixture = await createInstalledDutchFixture();
  try {
    const firstSession = new FakeTerminal([
      ...openDutchChapter1Keys(),
      key("t", { sequence: "t" }),
      key("down"),
      key("up"),
      key("pagedown"),
      key("q", { sequence: "q" })
    ], { colorsEnabled: false, width: 150 });
    await runInteractiveMenu(createStubRegistry([]), firstSession, { dataDir: fixture.dataDir });
    const firstScreens = firstSession.output.split("\x1b[2J\x1b[H").filter((screen) => screen !== "").map(stripAnsi);
    const chapter2Screen = firstScreens.find((screen) => screen.includes("Translation: On") && />\s+Ch 2 -- Saying My Name/u.test(screen));
    const returnedChapter1Screen = firstScreens.at(-1);
    assert.match(chapter2Screen, /Translation: On/u);
    assert.match(chapter2Screen, /Natural English Translation[\s\S]*I am Daan de Vries\./u);
    assert.doesNotMatch(chapter2Screen, /I'm Alex Chen/u);
    assert.match(returnedChapter1Screen, /Translation: On/u);
    assert.match(returnedChapter1Screen, /Alex\s+: Hello\.|I'm Alex Chen/u);

    const secondSession = new FakeTerminal([
      ...openDutchChapter1Keys(),
      key("q", { sequence: "q" })
    ], { colorsEnabled: false, width: 150 });
    await runInteractiveMenu(createStubRegistry([]), secondSession, { dataDir: fixture.dataDir });
    const secondFinalScreen = secondSession.output.split("\x1b[2J\x1b[H").filter((screen) => screen !== "").map(stripAnsi).at(-1);
    assert.match(secondFinalScreen, /Translation: Off/u);
    assert.doesNotMatch(secondFinalScreen, /Natural English Translation|I'm Alex Chen|I'm a teacher/u);

    const unrelatedScreen = new FakeTerminal([
      key("t", { sequence: "t" }),
      key("q", { sequence: "q" })
    ], { colorsEnabled: false, width: 150 });
    await runInteractiveMenu(createStubRegistry([]), unrelatedScreen, { dataDir: fixture.dataDir });
    assert.match(unrelatedScreen.output, /Translation: On/u);
    assert.doesNotMatch(unrelatedScreen.output, /Natural English Translation/u);
  } finally {
    await fixture.cleanup();
  }
});

function stripAnsi(text) {
  return text.replace(/\x1b\[[0-9;]*m/g, "");
}

function statusSequenceBeforeLabel(line, label) {
  const labelIndex = line.indexOf(label);
  assert.notEqual(labelIndex, -1, `label appears in rendered line: ${label}`);
  const before = line.slice(0, labelIndex);
  const lastReset = before.lastIndexOf("\x1b[0m");
  return before.slice(lastReset < 0 ? 0 : lastReset + "\x1b[0m".length);
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function packageRecord(packageId, displayName) {
  return {
    packageId,
    packageVersion: "0.1.0",
    displayName,
    contentType: "language-curriculum"
  };
}

function readableEntry(path, mediaType = "text/markdown") {
  return {
    path,
    mediaType,
    title: path,
    source: "snapshot"
  };
}

function embeddedDutchReviewKeys(ratingKey) {
  return [
    key("down"),
    key("return"),
    key("down"),
    key("return"),
    key("down"),
    key("down"),
    key("return"),
    key("down"),
    key("return"),
    key("return"),
    key("return"),
    key(ratingKey, { sequence: ratingKey }),
    key("q", { sequence: "q" }),
    key("q", { sequence: "q" })
  ];
}

function openDutchChapter1Keys() {
  return [
    key("down"),
    key("return"),
    key("down"),
    key("return"),
    key("down"),
    key("return"),
    key("down")
  ];
}

function chineseExercise({
  promptLanguage,
  answerLanguage,
  promptLines,
  answerLines
}) {
  return reviewExercise({
    promptLanguage,
    answerLanguage,
    promptLines,
    answerLines
  });
}

function reviewExercise({
  promptLanguage,
  answerLanguage,
  promptLines,
  answerLines,
  noteLines = [],
  exampleLines = []
}) {
  return {
    itemIdentity: {
      packageId: "com.sleepymario.language.chinese.mandarin.traditional",
      packageVersion: "0.1.0",
      itemId: "review-decks/test/0001"
    },
    kind: "vocabulary",
    title: "Test deck",
    promptLanguage,
    answerLanguage,
    promptLines,
    answerLines,
    hintLines: [],
    noteLines,
    exampleLines,
    metadataLines: [],
    warnings: []
  };
}

function chineseReviewItem({
  promptLanguage,
  answerLanguage,
  prompt,
  answer
}) {
  return reviewItem({
    packageId: "com.sleepymario.language.chinese.mandarin.traditional",
    promptLanguage,
    answerLanguage,
    prompt,
    answer
  });
}

function reviewItem({
  packageId,
  promptLanguage,
  answerLanguage,
  prompt,
  answer
}) {
  return {
    packageId,
    packageVersion: "0.1.0",
    sourcePath: "review-decks/test/cards.tsv",
    sourceExists: true,
    item: {
      schemaVersion: 1,
      id: "review-decks/test/0001",
      kind: "vocabulary",
      prompt: {
        text: prompt,
        plainText: prompt,
        language: promptLanguage,
        mediaType: "text/plain"
      },
      answer: {
        text: answer,
        plainText: answer,
        language: answerLanguage,
        mediaType: "text/plain"
      },
      source: {
        path: "review-decks/test/cards.tsv",
        title: "Test deck"
      }
    }
  };
}

async function createInstalledDutchFixture() {
  return createInstalledLanguageFixture(["dutch-curriculum"], ["com.sleepymario.language.dutch"]);
}

function dutchReviewDeckNode(tree, label) {
  const dutch = tree.children.find((node) => node.label === "Dutch");
  assert.ok(dutch, "Dutch package appears in the language tree");
  const reviewDecks = dutch.children.find((node) => node.label === "Review decks");
  assert.ok(reviewDecks, "Dutch package has a review deck section");
  const deck = reviewDecks.children.find((node) => node.label === label);
  assert.ok(deck, `Dutch review deck exists: ${label}`);
  return deck;
}

async function createDutchReviewProgress(dataDir) {
  const items = await listReadingReviewItems({
    dataDir,
    packageId: "com.sleepymario.language.dutch",
    packageVersion: "0.1.0"
  });
  const item = items[0];
  assert.ok(item, "Dutch fixture has at least one review item");
  await recordReadingReviewAnswer({
    dataDir,
    packageId: item.packageId,
    packageVersion: item.packageVersion,
    sourcePath: item.sourcePath,
    itemId: item.item.id,
    rating: "good",
    reviewedAt: "2026-07-06T00:00:00Z"
  });
}

async function loadDutchReviewProgress(dataDir) {
  return loadReviewProgressStore(join(dirname(dataDir), "progress"));
}

function rightPaneCell(line) {
  const styledBorder = "\x1b[2m\x1b[36m|\x1b[0m";
  if (line.includes(styledBorder)) {
    return (line.split(styledBorder)[2] ?? "").replace(/^ /u, "").trimEnd();
  }
  const withoutToggles = line.replace(/ \| [^|]*\|$/u, " |");
  const match = withoutToggles.match(/^\| .+? \| (.*) \|$/u);
  return (match?.[1] ?? "").trimEnd();
}

function displayPipeColumns(line) {
  const columns = [];
  let column = 0;
  for (const character of [...line]) {
    if (character === "|") {
      columns.push(column);
    }
    column += /\p{Mark}/u.test(character) ? 0 : isWideCharacterForTest(character) ? 2 : 1;
  }
  return columns;
}

function displayColumnOf(line, expectedCharacter, occurrence = 1) {
  let column = 0;
  let seen = 0;
  for (const character of [...line]) {
    if (character === expectedCharacter) {
      seen += 1;
      if (seen === occurrence) {
        return column;
      }
    }
    column += /\p{Mark}/u.test(character) ? 0 : isWideCharacterForTest(character) ? 2 : 1;
  }
  return -1;
}

function sentenceCountForTest(line) {
  return [...new Intl.Segmenter(undefined, { granularity: "sentence" }).segment(line)]
    .filter((part) => part.segment.trim().length > 0).length;
}

function firstLearnerDialogueTurn(markdown) {
  let inDialogue = false;
  for (const line of markdown.split("\n")) {
    const heading = /^#{1,6}\s+(.+)$/u.exec(line);
    if (heading !== null) {
      inDialogue = /^(?:Dialogue|Learner-facing Dialogue|Model Dialogue|Model Mini Dialogue|Chapter \d+ Target Dialogue|對話(?:\s*\/\s*Learner-facing Dialogue)?)$/iu.test(heading[1] ?? "");
      continue;
    }
    if (!inDialogue || /^\s*```/u.test(line)) continue;
    const match = /^(\s*)(\S(?:.*?\S)?)(\s*)([:：])(\s*)(\S.*)$/u.exec(line);
    if (match === null) continue;
    return {
      markdown,
      label: `${match[2] ?? ""}${match[3] ?? ""}${match[4] ?? ":"}`,
      separator: match[5] ?? ""
    };
  }
  return undefined;
}

function firstLearnerNarrativeLine(markdown) {
  let inNarrative = false;
  const section = [];
  for (const line of markdown.split("\n")) {
    const heading = /^#{1,6}\s+(.+)$/u.exec(line);
    if (heading !== null) {
      if (inNarrative) break;
      inNarrative = /^(?:Narrative|Learner-facing (?:Controlled Reading|Narrative|Read Content)|Controlled Reading|Model Mini Text|閱讀短文(?:\s*\/\s*Learner-facing Controlled Reading)?)$/iu.test(heading[1] ?? "");
      continue;
    }
    if (inNarrative) section.push(line);
  }
  const blocks = section.join("\n").split(/\n\s*\n/gu)
    .map((block) => block.split("\n").filter((line) => line.trim().length > 0 && !/^\s*```/u.test(line)))
    .filter((block) => block.length > 0);
  const body = blocks.length > 1 ? blocks[1] : blocks[0];
  const line = body?.[0];
  return line === undefined ? undefined : { markdown, prefix: [...line].slice(0, 8).join("") };
}

function navigationTreeShape(node) {
  return {
    label: node.label,
    kind: node.kind,
    children: (node.children ?? []).map(navigationTreeShape)
  };
}

function allTreeNodes(root) {
  return [root, ...(root.children ?? []).flatMap(allTreeNodes)];
}

function isWideCharacterForTest(character) {
  const codePoint = character.codePointAt(0) ?? 0;
  return (codePoint >= 0x1100 && codePoint <= 0x11ff)
    || (codePoint >= 0x2e80 && codePoint <= 0xa4cf)
    || (codePoint >= 0xac00 && codePoint <= 0xd7a3)
    || (codePoint >= 0xf900 && codePoint <= 0xfaff)
    || (codePoint >= 0xfe10 && codePoint <= 0xfe19)
    || (codePoint >= 0xfe30 && codePoint <= 0xfe6f)
    || (codePoint >= 0xff00 && codePoint <= 0xff60)
    || (codePoint >= 0xffe0 && codePoint <= 0xffe6);
}

async function createInstalledLanguageFixture(targetIds, packageIds) {
  const root = await mkdtemp(join(tmpdir(), "wsm-menu-dutch-"));
  const packageDirectory = join(root, "packages");
  const cataloguePath = join(root, "catalogue", "catalogue.json");
  const dataDir = join(root, "data", "content");
  const reviewTargetByReadingTarget = new Map([
    ["vietnamese-curriculum", "vietnamese-core-reviews"],
    ["dutch-curriculum", "dutch-core-reviews"]
  ]);
  const allTargets = [...targetIds, ...targetIds.map(target => reviewTargetByReadingTarget.get(target)).filter(Boolean)];
  for (const targetId of allTargets) {
    await generateContentPackage({
      targetId,
      outputDirectory: packageDirectory,
      generatedAt: "2026-07-06T00:00:00Z"
    });
  }
  await generateLocalContentPackageCatalogue({
    packagesDirectory: packageDirectory,
    outputPath: cataloguePath,
    generatedAt: "2026-07-06T00:00:00Z"
  });
  for (const packageId of packageIds) {
    await installContentPackage({
      cataloguePath,
      dataDir,
      packageId,
      installedAt: "2026-07-06T00:00:00Z"
    });
  }
  for (const packageId of packageIds.map(id => `${id}.reviews`)) {
    if ((await listAvailableContentPackages(cataloguePath)).some(entry => entry.packageId === packageId)) {
      await installContentPackage({ cataloguePath, dataDir, packageId, installedAt: "2026-07-06T00:00:00Z" });
    }
  }

  return {
    root,
    cataloguePath,
    dataDir,
    cleanup: () => rm(root, { recursive: true, force: true })
  };
}

async function runNode(args) {
  const { spawn } = await import("node:child_process");
  const child = spawn(process.execPath, args, {
    cwd: process.cwd(),
    stdio: ["ignore", "pipe", "pipe"]
  });

  let stdout = "";
  let stderr = "";
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => {
    stdout += chunk;
  });
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
  });

  const exitCode = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`process timed out: ${args.join(" ")}`));
    }, 5000);

    child.on("error", reject);
    child.on("close", (code) => {
      clearTimeout(timeout);
      resolve(code);
    });
  });

  return { exitCode, stdout, stderr };
}
