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
  renderTwoPaneLanguageTree,
  renderLanguageTreeRightPane,
  renderSourceLanguageToggle,
  renderWhackSmackerHeader,
  readableContentEntriesToMenuItems,
  reviewDeckMenuStatusFromStates,
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

function createStubRegistry(calls, options = {}) {
  const registry = new InMemoryCliCommandRegistry();

  for (const path of [
    ["language", "korean"],
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
  assert.equal(resolveCliCommand(registry, ["language", "korean"])?.path.join(" "), "language korean");
  assert.equal(resolveCliCommand(registry, ["language", "terms"])?.path.join(" "), "language terms");
  assert.equal(resolveCliCommand(registry, ["language", "terminology"])?.path.join(" "), "language terminology");
});

test("main menu exposes all registered domain modules", () => {
  assert.deepEqual(
    getMainMenuItems().map((item) => item.label),
    ["Language", "Chess", "Geography", "Mathematics"]
  );
});

test("language menu exposes Korean, Linguistic Terms, and back", () => {
  assert.deepEqual(
    getLanguageMenuItems().map((item) => item.label),
    ["Korean", "Linguistic Terms", "Back"]
  );
});

test("installed language package discovery is generic and normalizes curriculum labels", () => {
  const items = installedLanguagePackagesToMenuItems([
    packageRecord("com.sleepymario.language.korean", "Korean Curriculum"),
    packageRecord("com.sleepymario.language.chinese.mandarin.traditional", "Chinese - Mandarin (Traditional)"),
    packageRecord("com.sleepymario.language.chinese.mandarin.simplified", "Chinese - Mandarin (Simplified)"),
    packageRecord("com.sleepymario.language.japanese", "Japanese"),
    packageRecord("com.sleepymario.language.vietnamese", "Vietnamese Curriculum"),
    packageRecord("com.sleepymario.language.dutch", "Dutch"),
    packageRecord("com.sleepymario.language.german", "German"),
    packageRecord("com.sleepymario.language.french", "French"),
    packageRecord("com.sleepymario.language.spanish", "Spanish"),
    packageRecord("com.sleepymario.language.linguistic-terminology", "Linguistic Terminology"),
    packageRecord("com.sleepymario.mathematics.curriculum", "Mathematics")
  ]);

  assert.deepEqual(items.map((item) => item.label), ["Chinese - Mandarin (Simplified)", "Chinese - Mandarin (Traditional)", "Dutch", "French", "German", "Japanese", "Korean", "Linguistic Terminology", "Spanish", "Vietnamese"]);
  assert.deepEqual(items.map((item) => item.packageId), [
    "com.sleepymario.language.chinese.mandarin.simplified",
    "com.sleepymario.language.chinese.mandarin.traditional",
    "com.sleepymario.language.dutch",
    "com.sleepymario.language.french",
    "com.sleepymario.language.german",
    "com.sleepymario.language.japanese",
    "com.sleepymario.language.korean",
    "com.sleepymario.language.linguistic-terminology",
    "com.sleepymario.language.spanish",
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
    "Foundation Ch 1",
    "Foundation Ch 2",
    "Foundation Ch 3",
    "Foundation Ch 4",
    "Foundation Ch 5"
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
  assert.deepEqual(buildLanguageMenuItems(items).map((item) => item.label), ["Example Language", "Korean", "Linguistic Terms", "Back"]);
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
    ["korean-curriculum", "chinese-mandarin-traditional-curriculum", "chinese-mandarin-simplified-curriculum", "english-curriculum", "japanese-curriculum", "vietnamese-curriculum", "dutch-curriculum", "german-curriculum", "french-curriculum", "spanish-curriculum"],
    [
      "com.sleepymario.language.korean",
      "com.sleepymario.language.chinese.mandarin.simplified",
      "com.sleepymario.language.chinese.mandarin.traditional",
      "com.sleepymario.language.japanese",
      "com.sleepymario.language.vietnamese",
      "com.sleepymario.language.dutch",
      "com.sleepymario.language.english",
      "com.sleepymario.language.german",
      "com.sleepymario.language.french",
      "com.sleepymario.language.spanish"
    ]
  );
  try {
    const tree = await buildModuleTree(fixture.dataDir);
    const installed = tree.children.find((node) => node.label === "Installed modules");
    const languages = installed.children.find((node) => node.label === "Languages");

    assert.equal(tree.label, "WhackSmacker");
    assert.deepEqual(tree.children.map((node) => node.label), ["Installed modules", "Modules available"]);
    assert.deepEqual(installed.children.map((node) => node.label), ["Languages", "Games", "Geography", "Mathematics"]);
    assert.deepEqual(languages.children.map((node) => node.label), ["Chinese - Mandarin (Simplified)", "Chinese - Mandarin (Traditional)", "Dutch", "English", "French", "German", "Japanese", "Korean", "Spanish", "Vietnamese"]);
    assert.deepEqual(languages.children.map((node) => node.moduleId), [
      "com.sleepymario.language.chinese.mandarin.simplified",
      "com.sleepymario.language.chinese.mandarin.traditional",
      "com.sleepymario.language.dutch",
      "com.sleepymario.language.english",
      "com.sleepymario.language.french",
      "com.sleepymario.language.german",
      "com.sleepymario.language.japanese",
      "com.sleepymario.language.korean",
      "com.sleepymario.language.spanish",
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

    assert.deepEqual(items.map((item) => item.label), ["Dutch", "Korean", "Linguistic Terms", "Back"]);
  } finally {
    await fixture.cleanup();
  }
});

test("language tree lists installed packages and package sections", async () => {
  const fixture = await createInstalledLanguageFixture(
    ["korean-curriculum", "chinese-mandarin-traditional-curriculum", "chinese-mandarin-simplified-curriculum", "english-curriculum", "japanese-curriculum", "vietnamese-curriculum", "dutch-curriculum", "german-curriculum", "french-curriculum", "spanish-curriculum"],
    [
      "com.sleepymario.language.korean",
      "com.sleepymario.language.chinese.mandarin.simplified",
      "com.sleepymario.language.chinese.mandarin.traditional",
      "com.sleepymario.language.japanese",
      "com.sleepymario.language.vietnamese",
      "com.sleepymario.language.dutch",
      "com.sleepymario.language.english",
      "com.sleepymario.language.german",
      "com.sleepymario.language.french",
      "com.sleepymario.language.spanish"
    ]
  );
  try {
    const tree = await buildLanguageTree(fixture.dataDir);

    assert.equal(tree.label, "Languages");
    assert.deepEqual(tree.children.map((node) => node.label), ["Chinese - Mandarin (Simplified)", "Chinese - Mandarin (Traditional)", "Dutch", "English", "French", "German", "Japanese", "Korean", "Spanish", "Vietnamese"]);
    for (const languagePackage of tree.children) {
      assert.deepEqual(languagePackage.children.map((node) => node.label), ["Read content", "Review decks", "Package info", "Uninstall"]);
    }
    const english = tree.children.find((node) => node.label === "English");
    const englishReadContent = english.children.find((node) => node.label === "Read content");
    const englishReviewDecks = english.children.find((node) => node.label === "Review decks");
    assert.ok(englishReadContent.children.some((node) => node.label === "Chapter 1 -- First Introductions"));
    assert.ok(englishReadContent.children.some((node) => node.label === "Grammar - Easy"));
    assert.deepEqual(englishReviewDecks.children.map((node) => node.label), ["Chapter 1-5", "Chapter 6-10"]);
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
    assert.ok(readContent.children.some((node) => node.label === "Grammar - Easy"));
    assert.ok(readContent.children.some((node) => node.label === "Grammar - Hard"));
    assert.deepEqual(reviewDecks.children.map((node) => node.label), ["Chapter 1-5", "Chapter 6-10", "Chapter 11-15", "Chapter 16-20", "Chapter 21-25"]);
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
    const normal = await renderLanguageTreeRightPane(chapter, { dataDir: fixture.dataDir, displayMode: "normal" });
    const developer = await renderLanguageTreeRightPane(chapter, { dataDir: fixture.dataDir, displayMode: "developer" });

    assert.doesNotMatch(normal, /It does not introduce `je`, `jij`, or `u` yet\./u);
    assert.doesNotMatch(normal, /Do not turn this into a full verb-conjugation chapter yet\./u);
    assert.doesNotMatch(normal, /grammar_id:|DUT-GRAMMAR-001|See `ledger\.md`/u);
    assert.match(normal, /row marked `Infinitive` gives the base verb form\./u);
    assert.match(developer, /It does not introduce `je`, `jij`, or `u` yet\./u);
    assert.match(developer, /Do not turn this into a full verb-conjugation chapter yet\./u);
    assert.match(developer, /grammar_id: "DUT-GRAMMAR-001"|DUT-GRAMMAR-001/u);
    assert.match(developer, /See `ledger\.md`/u);

    const renderedNormal = renderTwoPaneLanguageTree(tree, new Set(), 0, normal, false, 0, 80, "en-US", "navigation", 180);
    const renderedDeveloper = renderTwoPaneLanguageTree(tree, new Set(), 0, developer, false, 0, 80, "en-US", "navigation", 180, 1, "developer");
    const outputLines = renderedNormal.split("\n").map(rightPaneCell);
    const entryIndexes = Object.fromEntries(["hallo", "dag", "ik", "ben", "zijn", "de student", "de docent", "de vriend"].map((entry) => [entry, outputLines.findIndex((line) => new RegExp(`^\\| ${escapeRegExp(entry)}\\s+\\|`, "u").test(line))]));
    assert.equal(entryIndexes.dag - entryIndexes.hallo, 2);
    assert.equal(entryIndexes.ik - entryIndexes.dag, 2);
    assert.equal(entryIndexes.ben - entryIndexes.ik, 2);
    assert.equal(entryIndexes.zijn - entryIndexes.ben, 1);
    assert.equal(entryIndexes["de student"] - entryIndexes.zijn, 2);
    assert.equal(entryIndexes["de docent"] - entryIndexes["de student"], 2);
    assert.equal(entryIndexes["de vriend"] - entryIndexes["de docent"], 2);
    assert.match(outputLines[entryIndexes.ben], /ben\s+\| am\s+\| Verb\s+\|$/u);
    assert.match(outputLines[entryIndexes.zijn], /zijn\s+\| to be\s+\| Infinitive\s+\|$/u);
    for (const index of [entryIndexes.hallo + 1, entryIndexes.dag + 1, entryIndexes.ik + 1, entryIndexes.zijn + 1, entryIndexes["de student"] + 1, entryIndexes["de docent"] + 1]) {
      assert.match(outputLines[index], /^\|\s+\|\s+\|\s+\|$/u);
    }
    const vocabularyRows = (rendered) => {
      const lines = rendered.split("\n").map(rightPaneCell);
      const start = lines.findIndex((line) => /^\| Dutch\s+\| English\s+\| Notes\s+\|$/u.test(line));
      const end = lines.findIndex((line) => /^\| de vriend\s+\|/u.test(line));
      return lines.slice(start, end + 1);
    };
    assert.deepEqual(vocabularyRows(renderedDeveloper), vocabularyRows(renderedNormal));
    assert.doesNotMatch(renderedNormal, /<br\s*\/?\s*>/iu);
  } finally {
    await fixture.cleanup();
  }
});

test("Dutch Chapter 12 uses neutral Normal-view voice and preserves original Developer wording", async () => {
  const fixture = await createInstalledDutchFixture();
  try {
    const tree = await buildLanguageTree(fixture.dataDir);
    const dutch = tree.children.find((node) => node.label === "Dutch");
    const readContent = dutch.children.find((node) => node.label === "Read content");
    const chapter = readContent.children.find((node) => node.label === "Chapter 12 -- A Simple Daily Routine");
    const normal = await renderLanguageTreeRightPane(chapter, { dataDir: fixture.dataDir, displayMode: "normal" });
    const developer = await renderLanguageTreeRightPane(chapter, { dataDir: fixture.dataDir, displayMode: "developer" });

    assert.doesNotMatch(normal, /the learner/iu);
    assert.match(normal, /In this pattern, a named third-person subject is followed by a controlled present-action form:/u);
    assert.match(developer, /The learner sees a named third-person subject followed by a controlled present-action form:/u);
    assert.match(developer, /In this pattern, a named third-person subject is followed by a controlled present-action form:/u);
  } finally {
    await fixture.cleanup();
  }
});

test("Dutch Chapters 11-15 summaries render canonical patterns instead of developer descriptions", async () => {
  const fixture = await createInstalledDutchFixture();
  try {
    const tree = await buildLanguageTree(fixture.dataDir);
    const dutch = tree.children.find((node) => node.label === "Dutch");
    const readContent = dutch.children.find((node) => node.label === "Read content");
    const easyNode = readContent.children.find((node) => node.filePath === "units/dutch-core/chapter-011-015-grammar-easy/chapter.md");
    const hardNode = readContent.children.find((node) => node.filePath === "units/dutch-core/chapter-011-015-grammar-hard/chapter.md");
    const chapter14Node = readContent.children.find((node) => node.filePath === "units/dutch-core/chapter-014-two-places-in-a-day/chapter.md");
    const easyNormal = await renderLanguageTreeRightPane(easyNode, { dataDir: fixture.dataDir, displayMode: "normal" });
    const hardNormal = await renderLanguageTreeRightPane(hardNode, { dataDir: fixture.dataDir, displayMode: "normal" });
    const easyDeveloper = await renderLanguageTreeRightPane(easyNode, { dataDir: fixture.dataDir, displayMode: "developer" });
    const hardDeveloper = await renderLanguageTreeRightPane(hardNode, { dataDir: fixture.dataDir, displayMode: "developer" });
    const chapter14Normal = await renderLanguageTreeRightPane(chapter14Node, { dataDir: fixture.dataDir, displayMode: "normal" });
    const chapter14Developer = await renderLanguageTreeRightPane(chapter14Node, { dataDir: fixture.dataDir, displayMode: "developer" });
    const patterns = ["Hoe gaat het met je? / Het gaat goed.", "Sophie + V stem-t", "Ik + wil + graag + N", "clause + en + clause", "Waar woon je?"];

    for (const pattern of patterns) {
      assert.match(easyNormal, new RegExp(escapeRegExp(pattern), "u"));
      assert.match(hardNormal, new RegExp(escapeRegExp(pattern), "u"));
    }
    assert.doesNotMatch(easyNormal, /controlled third-person present actions with a named subject|DUT-GRAMMAR-/u);
    assert.doesNotMatch(hardNormal, /controlled third-person present actions with a named subject|DUT-GRAMMAR-/u);
    assert.match(easyDeveloper, /DUT-GRAMMAR-012[\s\S]*Sophie \+ V stem-t/u);
    assert.match(hardDeveloper, /DUT-GRAMMAR-012[\s\S]*controlled third-person present actions with a named subject/u);
    assert.match(chapter14Normal, /Pattern: `clause \+ en \+ clause`[\s\S]*Meaning: clause \+ en \+ clause\./u);
    assert.doesNotMatch(chapter14Normal, /DUT-GRAMMAR-014/u);
    assert.match(chapter14Developer, /DUT-GRAMMAR-014 -- clause \+ en \+ clause/u);

    const renderedEasy = renderTwoPaneLanguageTree(tree, new Set(), 0, easyNormal, false, 0, 100, "en-US", "navigation", 180);
    const renderedHard = renderTwoPaneLanguageTree(tree, new Set(), 0, hardNormal, false, 0, 100, "en-US", "navigation", 180);
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
    const tree = await buildLanguageTree(fixture.dataDir);
    const dutch = tree.children.find((node) => node.label === "Dutch");
    const readContent = dutch.children.find((node) => node.label === "Read content");
    const easyNode = readContent.children.find((node) => node.filePath === "units/dutch-core/chapter-016-020-grammar-easy/chapter.md");
    const hardNode = readContent.children.find((node) => node.filePath === "units/dutch-core/chapter-016-020-grammar-hard/chapter.md");
    const chapter19Node = readContent.children.find((node) => node.filePath === "units/dutch-core/chapter-019-asking-for-help/chapter.md");
    const easyNormal = await renderLanguageTreeRightPane(easyNode, { dataDir: fixture.dataDir, displayMode: "normal" });
    const hardNormal = await renderLanguageTreeRightPane(hardNode, { dataDir: fixture.dataDir, displayMode: "normal" });
    const easyDeveloper = await renderLanguageTreeRightPane(easyNode, { dataDir: fixture.dataDir, displayMode: "developer" });
    const chapter19Normal = await renderLanguageTreeRightPane(chapter19Node, { dataDir: fixture.dataDir, displayMode: "normal" });
    const chapter19Developer = await renderLanguageTreeRightPane(chapter19Node, { dataDir: fixture.dataDir, displayMode: "developer" });
    const patterns = ["Ik + V stem", "Wat doe je?", "subject + verb + niet", "Kun je + infinitive?", "time + verb + subject + ..."];
    for (const pattern of patterns) {
      assert.match(easyNormal, new RegExp(escapeRegExp(pattern), "u"));
      assert.match(hardNormal, new RegExp(escapeRegExp(pattern), "u"));
    }
    assert.doesNotMatch(`${easyNormal}\n${hardNormal}\n${chapter19Normal}`, /DUT-GRAMMAR-/u);
    assert.match(easyDeveloper, /DUT-GRAMMAR-016[\s\S]*DUT-GRAMMAR-020/u);
    assert.match(chapter19Developer, /DUT-GRAMMAR-019 -- Kun je \+ infinitive\?/u);
    assert.match(chapter19Normal, /kun[\s\S]*kunnen[\s\S]*to be able to[\s\S]*Infinitive[\s\S]*natuurlijk/u);
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

test("language tree exposes German content and review deck labels", async () => {
  const fixture = await createInstalledLanguageFixture(["german-curriculum"], ["com.sleepymario.language.german"]);
  try {
    const tree = await buildLanguageTree(fixture.dataDir);
    const german = tree.children.find((node) => node.label === "German");
    const readContent = german.children.find((node) => node.label === "Read content");
    const reviewDecks = german.children.find((node) => node.label === "Review decks");

    assert.ok(readContent.children.some((node) => node.label === "Chapter 1 -- Greetings and Identity"));
    assert.ok(readContent.children.some((node) => node.label === "Chapter 5 -- First Wellbeing Questions"));
    assert.deepEqual(reviewDecks.children.map((node) => node.label), ["Chapter 1-5", "Chapter 6-10"]);
  } finally {
    await fixture.cleanup();
  }
});

test("language tree exposes French and Spanish content and review deck labels", async () => {
  const fixture = await createInstalledLanguageFixture(
    ["french-curriculum", "spanish-curriculum"],
    ["com.sleepymario.language.french", "com.sleepymario.language.spanish"]
  );
  try {
    const tree = await buildLanguageTree(fixture.dataDir);
    const french = tree.children.find((node) => node.label === "French");
    const spanish = tree.children.find((node) => node.label === "Spanish");
    const frenchReadContent = french.children.find((node) => node.label === "Read content");
    const frenchReviewDecks = french.children.find((node) => node.label === "Review decks");
    const spanishReadContent = spanish.children.find((node) => node.label === "Read content");
    const spanishReviewDecks = spanish.children.find((node) => node.label === "Review decks");

    assert.ok(frenchReadContent.children.some((node) => node.label === "Chapter 1 -- Greetings and Identity"));
    assert.ok(frenchReadContent.children.some((node) => node.label === "Chapter 5 -- First Wellbeing Questions"));
    assert.deepEqual(frenchReviewDecks.children.map((node) => node.label), ["Chapter 1-5", "Chapter 6-10"]);
    assert.ok(spanishReadContent.children.some((node) => node.label === "Chapter 1 -- Greetings and Identity"));
    assert.ok(spanishReadContent.children.some((node) => node.label === "Chapter 5 -- First Wellbeing Questions"));
    assert.deepEqual(spanishReviewDecks.children.map((node) => node.label), ["Chapter 1-5", "Chapter 6-10"]);
  } finally {
    await fixture.cleanup();
  }
});

test("language tree exposes Japanese writing placeholders and core review deck", async () => {
  const fixture = await createInstalledLanguageFixture(["japanese-curriculum"], ["com.sleepymario.language.japanese"]);
  try {
    const tree = await buildLanguageTree(fixture.dataDir);
    const japanese = tree.children.find((node) => node.label === "Japanese");
    const readContent = japanese.children.find((node) => node.label === "Read content");
    const reviewDecks = japanese.children.find((node) => node.label === "Review decks");

    assert.ok(readContent.children.some((node) => node.label === "Hiragana"));
    assert.ok(readContent.children.some((node) => node.label === "Katakana"));
    assert.ok(readContent.children.some((node) => node.label === "An Introduction to Kanji"));
    assert.ok(readContent.children.some((node) => node.label === "Chapter 1 -- Greetings and Identity"));
    assert.ok(readContent.children.some((node) => node.label === "Chapter 5 -- First Wellbeing Questions"));
    assert.ok(readContent.children.some((node) => node.label === "Chapter 20 -- A Day Trip to Kyoto"));
    assert.ok(readContent.children.filter((node) => node.label === "Grammar - Easy").length >= 4);
    assert.ok(readContent.children.filter((node) => node.label === "Grammar - Hard").length >= 4);
    assert.deepEqual(reviewDecks.children.map((node) => node.label), ["Chapter 1-5", "Chapter 6-10", "Chapter 11-15", "Chapter 16-20"]);
  } finally {
    await fixture.cleanup();
  }
});

test("language tree exposes Korean and Chinese review deck labels cleanly", async () => {
  const fixture = await createInstalledLanguageFixture(["korean-curriculum", "chinese-mandarin-traditional-curriculum", "chinese-mandarin-simplified-curriculum"], [
    "com.sleepymario.language.korean",
    "com.sleepymario.language.chinese.mandarin.traditional"
  ]);
  try {
    const tree = await buildLanguageTree(fixture.dataDir);
    const korean = tree.children.find((node) => node.label === "Korean");
    const chinese = tree.children.find((node) => node.label === "Chinese - Mandarin (Traditional)");
    const koreanReview = korean.children.find((node) => node.label === "Review decks");
    const chineseReview = chinese.children.find((node) => node.label === "Review decks");

    assert.deepEqual(koreanReview.children.map((node) => node.label), ["Chapter 1-5", "Chapter 6-10", "Chapter 11-15", "Chapter 16-20", "Chapter 21-25", "Chapter 26-30", "Chapter 31-35", "Chapter 36-40", "Chapter 41-45", "Chapter 46-50"]);
    assert.deepEqual(chineseReview.children.map((node) => node.label), ["Chapter 1-5", "Chapter 6-10", "Pinyin-Zhuyin", "Pinyin-Zhuyin with Tones"]);
    assert.equal(koreanReview.children.some((node) => node.label.includes("com.sleepymario")), false);
    assert.equal(chineseReview.children.some((node) => node.label.includes("cards.tsv")), false);
  } finally {
    await fixture.cleanup();
  }
});

test("Vietnamese read content starts with five abbreviated Foundation chapters before canonical Chapter 1", async () => {
  const fixture = await createInstalledLanguageFixture(["vietnamese-curriculum"], ["com.sleepymario.language.vietnamese"]);
  try {
    const tree = await buildLanguageTree(fixture.dataDir);
    const vietnamese = tree.children.find((node) => node.label === "Vietnamese");
    const readContent = vietnamese.children.find((node) => node.label === "Read content");

    assert.deepEqual(readContent.children.slice(0, 5).map((node) => node.label), [
      "Foundation Ch 1",
      "Foundation Ch 2",
      "Foundation Ch 3",
      "Foundation Ch 4",
      "Foundation Ch 5"
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
    assert.equal(readContent.children.some((node) => /units\/vietnamese-core\/chapter-(?:0*(?:1[1-9]|[2-9]\d)|\d{4,})/u.test(node.filePath ?? "")), false);
  } finally {
    await fixture.cleanup();
  }
});

test("Vietnamese menu exposes both authoritative Chapters 1-10 review decks", async () => {
  const fixture = await createInstalledLanguageFixture(
    ["vietnamese-curriculum", "vietnamese-core-reviews"],
    ["com.sleepymario.language.vietnamese"]
  );
  try {
    const tree = await buildLanguageTree(fixture.dataDir);
    const vietnamese = tree.children.find((node) => node.label === "Vietnamese");
    const reviewDecks = vietnamese.children.find((node) => node.label === "Review decks");
    assert.ok(reviewDecks);
    assert.equal(reviewDecks.children.some((node) => node.label === "Chapter 1-5"), true, reviewDecks.children.map((node) => node.label).join(", "));
    const first = reviewDecks.children.find((node) => node.label === "Chapter 1-5");
    const second = reviewDecks.children.find((node) => node.label === "Chapter 6-10");
    assert.equal(first?.sourcePath, "review-decks/chapter-001-005/cards.tsv");
    assert.equal(second?.sourcePath, "review-decks/chapter-006-010/cards.tsv");
    assert.equal(first?.itemCount, 20);
    assert.equal(second?.itemCount, 20);
  } finally {
    await fixture.cleanup();
  }
});

test("Korean read content tree starts with fixed Hangul chapter entries and keeps review deck read entries", async () => {
  const fixture = await createInstalledLanguageFixture(["korean-curriculum"], ["com.sleepymario.language.korean"]);
  try {
    const tree = await buildLanguageTree(fixture.dataDir);
    const korean = tree.children.find((node) => node.label === "Korean");
    const readContent = korean.children.find((node) => node.label === "Read content");

    assert.deepEqual(readContent.children.slice(0, 7).map((node) => node.filePath), [
      "units/introduction-to-hangul/chapter-01-vowels/README.md",
      "units/introduction-to-hangul/chapter-02-basic-consonants/README.md",
      "units/introduction-to-hangul/chapter-03-aspirated-and-tense/README.md",
      "units/introduction-to-hangul/chapter-04-basic-batchim/README.md",
      "units/introduction-to-hangul/chapter-05-carry-over/README.md",
      "units/introduction-to-hangul/chapter-06-sound-changes/README.md",
      "units/introduction-to-hangul/chapter-07-compound-batchim/README.md"
    ]);
    assert.equal(readContent.children[7]?.filePath, "units/korean-core/chapter-001-basic-life-sentences-1/chapter.md");
    const expanded = new Set(["languages", "com.sleepymario.language.korean", "com.sleepymario.language.korean:read"]);
    const visible = flattenVisibleLanguageTree(tree, expanded);
    const output = renderTwoPaneLanguageTree(tree, expanded, visible.findIndex((entry) => entry.node.id === readContent.children[0]?.id), "Preview", false);

    assert.match(output, /Han Gul 1 -- Vowels/u);
    assert.match(output, /Han Gul 2 -- Basic/u);
    assert.match(output, /Han Gul 7 -- Compound[\s\S]+받침/u);
    assert.match(output, /Ch 1 -- Names and/u);
    assert.doesNotMatch(output, /Ch 1 -- Vowels/u);
    assert.equal(readContent.children.some((node) => node.filePath?.startsWith("review-decks/")), false);
  } finally {
    await fixture.cleanup();
  }
});

test("language tree exposes Korean Grammar Easy and Hard summaries after each completed five-chapter block", async () => {
  const fixture = await createInstalledLanguageFixture(["korean-curriculum"], ["com.sleepymario.language.korean"]);
  try {
    const tree = await buildLanguageTree(fixture.dataDir);
    const korean = tree.children.find((node) => node.label === "Korean");
    const readContent = korean.children.find((node) => node.label === "Read content");
    const labels = readContent.children.map((node) => node.label);
    const expanded = new Set(["languages", "com.sleepymario.language.korean", "com.sleepymario.language.korean:read"]);
    const visible = flattenVisibleLanguageTree(tree, expanded);

    for (const blockEnd of [5, 10, 15, 20, 25, 30, 35, 40]) {
      const chapterIndex = labels.findIndex((label) => label.startsWith(`Chapter ${blockEnd} -- `));
      const paddedStart = String(blockEnd - 4).padStart(3, "0");
      const paddedEnd = String(blockEnd).padStart(3, "0");
      const coreChapterIndex = readContent.children.findIndex((node) =>
        node.filePath === `units/korean-core/chapter-${paddedEnd}-basic-life-sentences-${blockEnd}/chapter.md` ||
        node.filePath === `units/korean-core/chapter-${paddedEnd}-basic-sentences-${blockEnd}/chapter.md`
      );
      const easyIndex = readContent.children.findIndex((node, index) => index > coreChapterIndex && node.label === "Grammar - Easy");
      const hardIndex = readContent.children.findIndex((node, index) => index > easyIndex && node.label === "Grammar - Hard");
      const easyNode = readContent.children[easyIndex];
      const hardNode = readContent.children[hardIndex];

      assert.notEqual(chapterIndex, -1);
      assert.notEqual(coreChapterIndex, -1);
      assert.equal(easyIndex, coreChapterIndex + 1);
      assert.equal(hardIndex, easyIndex + 1);
      assert.equal(easyNode.kind, "content");
      assert.equal(hardNode.kind, "content");
      assert.equal(easyNode.filePath, `units/korean-core/chapter-${paddedStart}-${paddedEnd}-grammar-easy/chapter.md`);
      assert.equal(hardNode.filePath, `units/korean-core/chapter-${paddedStart}-${paddedEnd}-grammar-hard/chapter.md`);

      const easyContent = await readInstalledContentEntry({
        dataDir: fixture.dataDir,
        packageId: "com.sleepymario.language.korean",
        path: easyNode.filePath
      });
      const hardContent = await readInstalledContentEntry({
        dataDir: fixture.dataDir,
        packageId: "com.sleepymario.language.korean",
        path: hardNode.filePath
      });
      const easyOutput = renderTwoPaneLanguageTree(
        tree,
        expanded,
        visible.findIndex((entry) => entry.node.id === easyNode.id),
        easyContent.text,
        false
      );
      const hardOutput = renderTwoPaneLanguageTree(tree, expanded, visible.findIndex((entry) => entry.node.id === hardNode.id), hardContent.text, false);

      assert.match(easyOutput, /Grammar - Easy/);
      assert.match(hardOutput, /Grammar - Hard/);
      assert.match(easyOutput, /\|\s*>\s+Grammar -- Easy\s+\|/u);
      assert.match(hardOutput, /\|\s*>\s+Grammar -- Hard\s+\|/u);
      assert.doesNotMatch(easyOutput, /\|\s*>\s+(?:\.\.\.|…)\s+\|/u);
      assert.doesNotMatch(hardOutput, /\|\s*>\s+(?:\.\.\.|…)\s+\|/u);
      assert.match(easyContent.text, /Plain Summary/);
      assert.match(hardContent.text, /Technical Summary/);
    }

    assert.equal(labels.includes("Grammar Summary"), false);
    assert.equal(labels.includes("Grammar Summarize"), false);
    assert.equal(labels.includes("Chapter: 1-5 grammar"), false);
  } finally {
    await fixture.cleanup();
  }
});

test("Dutch read tree includes the complete zero-padded Chapters 11-25 blocks", async () => {
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

    assert.equal(chapter11?.label, "Chapter 11 -- Asking How Someone Is");
    assert.equal(chapter15?.label, "Chapter 15 -- Asking Where Someone Lives");
    assert.equal(chapter16?.label, "Chapter 16 -- Working at the Library");
    assert.equal(chapter20?.label, "Chapter 20 -- An Appointment in Town");
    assert.equal(chapter25?.label, "Chapter 25 -- Going to the Museum");
    assert.equal(readContent.children.some((node) => /^units\/dutch-core\/chapter-026-/u.test(node.filePath ?? "")), false);
    assert.equal(readContent.children.some((node) => /chapter-011-015-grammar-(?:easy|hard)/u.test(node.filePath ?? "")), true);
    const reviewDecks = dutch.children.find((node) => node.label === "Review decks");
    assert.equal(reviewDecks.children.some((node) => node.label === "Chapter 11-15"), true);
    assert.equal(reviewDecks.children.some((node) => node.label === "Chapter 16-20"), true);
    assert.equal(reviewDecks.children.some((node) => node.label === "Chapter 21-25"), true);
  } finally {
    await fixture.cleanup();
  }
});

test("language tree exposes Mandarin variant readable content with script-specific Core review decks", async () => {
  const fixture = await createInstalledLanguageFixture(
    ["chinese-mandarin-traditional-curriculum", "chinese-mandarin-simplified-curriculum"],
    [
      "com.sleepymario.language.chinese.mandarin.traditional",
      "com.sleepymario.language.chinese.mandarin.simplified"
    ]
  );
  try {
    const tree = await buildLanguageTree(fixture.dataDir);
    const traditional = tree.children.find((node) => node.label === "Chinese - Mandarin (Traditional)");
    const simplified = tree.children.find((node) => node.label === "Chinese - Mandarin (Simplified)");
    const traditionalReadContent = traditional.children.find((node) => node.label === "Read content");
    const traditionalReviewDecks = traditional.children.find((node) => node.label === "Review decks");
    const simplifiedReadContent = simplified.children.find((node) => node.label === "Read content");
    const simplifiedReviewDecks = simplified.children.find((node) => node.label === "Review decks");

    assert.ok(traditionalReadContent.children.some((node) => node.label === "Introduction to Hanyu Pinyin"));
    assert.ok(traditionalReadContent.children.some((node) => node.label === "Chapter 1 -- Greetings and Identity"));
    assert.ok(traditionalReadContent.children.some((node) => node.label === "Chapter 5 -- First Wellbeing Questions"));
    assert.ok(traditionalReadContent.children.some((node) => node.label === "Grammar - Easy"));
    assert.ok(traditionalReadContent.children.some((node) => node.label === "Grammar - Hard"));
    assert.deepEqual(traditionalReviewDecks.children.map((node) => node.label), ["Chapter 1-5", "Chapter 6-10", "Pinyin-Zhuyin", "Pinyin-Zhuyin with Tones"]);
    assert.ok(simplifiedReadContent.children.some((node) => node.label === "Introduction to Hanyu Pinyin"));
    assert.ok(simplifiedReadContent.children.some((node) => node.label === "Chapter 1 -- Greetings and Identity"));
    assert.ok(simplifiedReadContent.children.some((node) => node.label === "Chapter 5 -- First Wellbeing Questions"));
    assert.ok(simplifiedReadContent.children.some((node) => node.label === "Grammar - Easy"));
    assert.ok(simplifiedReadContent.children.some((node) => node.label === "Grammar - Hard"));
    assert.deepEqual(simplifiedReviewDecks.children.map((node) => node.label), ["Chapter 1-5", "Chapter 6-10"]);
  } finally {
    await fixture.cleanup();
  }
});

test("module tree includes available modules from a catalogue with install status", async () => {
  const fixture = await createInstalledLanguageFixture(
    ["korean-curriculum", "chinese-mandarin-traditional-curriculum", "chinese-mandarin-simplified-curriculum", "english-curriculum", "japanese-curriculum", "vietnamese-curriculum", "dutch-curriculum", "german-curriculum", "french-curriculum", "spanish-curriculum"],
    ["com.sleepymario.language.korean"]
  );
  try {
    const descriptors = await listAvailableModuleDescriptors(fixture.cataloguePath, fixture.dataDir);
    const tree = await buildModuleTree({ dataDir: fixture.dataDir, cataloguePath: fixture.cataloguePath });
    const available = tree.children.find((node) => node.label === "Modules available");
    const availableLanguages = available.children.find((node) => node.label === "Languages");

    assert.deepEqual(descriptors.filter((descriptor) => descriptor.category === "Languages").map((descriptor) => `${descriptor.displayName}:${descriptor.availableStatus}`), [
      "Chinese - Mandarin (Simplified):available",
      "Chinese - Mandarin (Traditional):available",
      "Dutch:available",
      "English:available",
      "French:available",
      "German:available",
      "Japanese:available",
      "Korean:installed",
      "Spanish:available",
      "Vietnamese:available"
    ]);
    assert.deepEqual(availableLanguages.children.map((node) => node.label), [
      "Chinese - Mandarin (Simplified) [Available]",
      "Chinese - Mandarin (Traditional) [Available]",
      "Dutch [Available]",
      "English [Available]",
      "French [Available]",
      "German [Available]",
      "Japanese [Available]",
      "Korean [Installed]",
      "Spanish [Available]",
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
  assert.match(output, /\x1b\[38;5;213mraw code\x1b\[0m/u);
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
  assert.equal(cells[3].trim(), "English");
  assert.match(english, /\x1b\[1m\x1b\[38;5;208mEnglish\x1b\[0m/u);
  assert.match(chinese, /\x1b\[7m\x1b\[1m> 中文（臺灣）\x1b\[0m/u);
  assert.match(englishPlain, /Left\/Right focus/u);
  assert.match(englishPlain, /View mode: Normal/u);
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
  const selectedToggleRow = stripAnsi(toggles).split("\n").find((line) => line.includes("> English"));

  assert.match(navigation, /\x1b\[7m\x1b\[1m>\s+WhackSmacker\x1b\[0m/u);
  assert.match(toggles, /\x1b\[7m\x1b\[1m> English\x1b\[0m/u);
  assert.equal((toggles.match(/\x1b\[7m/gu) ?? []).length, 1);
  assert.equal(selectedToggleRow?.split("|")[3].trim(), "> English");
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
        label: "Chapter 1 -- Names and First Greetings",
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

  assert.match(output, /Ch 1 -- Names/u);
  assert.match(output, /and First/u);
  assert.match(output, /Greetings/u);
  assert.match(output, /Ch 15 -- Casual Absence/u);
  assert.match(output, /Ch 15 -- Casual Absence I/u);
  assert.match(output, /Grammar -- Easy/u);
  assert.match(output, /Grammar -- Hard/u);
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
        label: "Foundation Ch 1",
        kind: "content",
        filePath: "units/vietnamese-foundation/chapter-001-alphabet/chapter.md"
      }, {
        id: "hangul-1",
        label: "Chapter 1 -- Vowels",
        kind: "content",
        filePath: "units/introduction-to-hangul/chapter-01-vowels/README.md"
      }, {
        id: "chapter-1",
        label: "Chapter 1 -- Names and First Greetings",
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
  const reviewDeckColor = "\x1b[33m";
  const selectedStyle = "\x1b[7m\x1b[1m";
  const reset = "\x1b[0m";
  const stripped = stripAnsi(output);

  assert.match(reviewDeckOutput, new RegExp(`${escapeRegExp(reviewDeckColor)}[^\\x1b]*Ch 1-5${escapeRegExp(reset)}`, "u"));
  assert.match(output, new RegExp(`${escapeRegExp(reviewDeckColor)}Foundation Ch 1${escapeRegExp(reset)}`, "u"));
  assert.match(output, new RegExp(`${escapeRegExp(reviewDeckColor)}Han Gul 1${escapeRegExp(reset)} -- Vowels`, "u"));
  assert.match(output, new RegExp(`${escapeRegExp(reviewDeckColor)}Ch 1${escapeRegExp(reset)} -- Names`, "u"));
  assert.match(output, new RegExp(`${escapeRegExp(reviewDeckColor)}Grammar${escapeRegExp(reset)} -- Easy`, "u"));
  assert.doesNotMatch(output, new RegExp(`${escapeRegExp(reviewDeckColor)}Names`, "u"));
  assert.doesNotMatch(output, new RegExp(`${escapeRegExp(reviewDeckColor)}Easy`, "u"));
  assert.match(output, new RegExp(`${escapeRegExp(selectedStyle)}[^\\x1b]*${escapeRegExp(reviewDeckColor)}Foundation Ch 1`, "u"));
  assert.match(output, new RegExp(`${escapeRegExp(selectedStyle)}[^\\x1b]*${escapeRegExp(reviewDeckColor)}Han Gul 1`, "u"));
  assert.match(output, new RegExp(`${escapeRegExp(selectedStyle)}[^\\x1b]*${escapeRegExp(reviewDeckColor)}Ch 1`, "u"));
  assert.match(output, new RegExp(`${escapeRegExp(selectedStyle)}[^\\x1b]*${escapeRegExp(reviewDeckColor)}Grammar`, "u"));
  assert.match(stripped, /Foundation Ch 1/u);
  assert.match(stripped, /Han Gul 1 -- Vowels/u);
  assert.match(stripped, /Ch 1 -- Names and First/u);
  assert.match(stripped, /Grammar -- Easy/u);
  assert.doesNotMatch(stripped, /Ch 1\s*--\s*\.\.\./u);
  assert.doesNotMatch(stripped, /\|\s*(?:\.\.\.|…)\s+\|/u);
});

test("review deck menu status distinguishes not started finished waiting and due decks", () => {
  const now = "2026-07-10T00:00:00Z";
  const identity = (itemId) => ({
    packageId: "com.sleepymario.language.test",
    packageVersion: "0.1.0",
    sourcePath: "review-decks/test/cards.tsv",
    itemId
  });
  const sourceIds = new Set(["card-1", "card-2"]);
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
    status: "suspended"
  };
  const suspended2 = {
    ...createInitialReviewState(identity("card-2"), now),
    nextReviewAt: "2999-01-01T00:00:00Z",
    reviewCount: 1,
    intervalDays: 2,
    status: "suspended"
  };

  assert.deepEqual(reviewDeckMenuStatusFromStates(sourceIds, [], now), {
    kind: "not_started",
    dueCardCount: 0,
    text: "Not started yet."
  });
  assert.deepEqual(reviewDeckMenuStatusFromStates(sourceIds, [initial1, initial2], now), {
    kind: "not_started",
    dueCardCount: 0,
    text: "Not started yet."
  });
  assert.deepEqual(reviewDeckMenuStatusFromStates(sourceIds, [suspended1, suspended2], now), {
    kind: "finished",
    dueCardCount: 0,
    text: "Finished."
  });
  assert.deepEqual(reviewDeckMenuStatusFromStates(new Set(["card-1"]), [waiting], now), {
    kind: "no_cards_to_review",
    dueCardCount: 0,
    text: "No new cards to review right now."
  });
  assert.deepEqual(reviewDeckMenuStatusFromStates(sourceIds, [due], now), {
    kind: "has_cards_to_review",
    dueCardCount: 2,
    text: "There are 2 cards to review."
  });
  assert.deepEqual(reviewDeckMenuStatusFromStates(new Set(), [], now), {
    kind: "not_started",
    dueCardCount: 0,
    text: "Not started yet."
  });
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

  assert.match(output, /\x1b\[35m[^\x1b\n]*Not Started/u);
  assert.doesNotMatch(output, /\x1b\[36m[^\x1b\n]*Not Started/u);
  assert.match(output, /\x1b\[32m[^\x1b\n]*Finished/u);
  assert.match(output, /\x1b\[34m[^\x1b\n]*Waiting/u);
  assert.match(output, /\x1b\[33m[^\x1b\n]*Due Now/u);
  assert.match(output, new RegExp(`${escapeRegExp(selectedStyle)}${escapeRegExp("\x1b[33m")}[^\\x1b]*Due Now`, "u"));
  assert.match(stripAnsi(output), /There are 17 cards to review\./u);
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
    assert.match(output, /\x1b\[34m[^\x1b\n]*Ch 1-5/u);
    assert.doesNotMatch(output, /\x1b\[33m[^\x1b\n]*Ch 1-5/u);
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

test("Korean read content menu pins seven Hangul chapter entries before numbered core chapters", () => {
  const items = readableContentEntriesToMenuItems([
    readableEntry("units/korean-core/chapter-001-basic-life-sentences-1/chapter.md"),
    readableEntry("review-decks/chapter-001-005/README.md"),
    readableEntry("units/introduction-to-hangul/chapter-07-compound-batchim/README.md"),
    readableEntry("units/introduction-to-hangul/chapter-01-vowels/README.md"),
    readableEntry("units/introduction-to-hangul/chapter-03-aspirated-and-tense/README.md"),
    readableEntry("units/korean-core/chapter-002-basic-life-sentences-2/chapter.md"),
    readableEntry("units/introduction-to-hangul/chapter-02-basic-consonants/README.md"),
    readableEntry("review-decks/chapter-006-010/README.md"),
    readableEntry("units/introduction-to-hangul/chapter-06-sound-changes/README.md"),
    readableEntry("units/introduction-to-hangul/chapter-04-basic-batchim/README.md"),
    readableEntry("units/introduction-to-hangul/chapter-05-carry-over/README.md")
  ]);

  assert.deepEqual(items.slice(0, 7).map((item) => item.filePath), [
    "units/introduction-to-hangul/chapter-01-vowels/README.md",
    "units/introduction-to-hangul/chapter-02-basic-consonants/README.md",
    "units/introduction-to-hangul/chapter-03-aspirated-and-tense/README.md",
    "units/introduction-to-hangul/chapter-04-basic-batchim/README.md",
    "units/introduction-to-hangul/chapter-05-carry-over/README.md",
    "units/introduction-to-hangul/chapter-06-sound-changes/README.md",
    "units/introduction-to-hangul/chapter-07-compound-batchim/README.md"
  ]);
  assert.equal(items[7]?.filePath, "units/korean-core/chapter-001-basic-life-sentences-1/chapter.md");
  assert.equal(items.some((item) => item.filePath === "review-decks/chapter-001-005/README.md"), true);
  assert.equal(items.some((item) => item.filePath === "review-decks/chapter-006-010/README.md"), true);
});

test("two-pane renderer styles Korean read-content blocks pink without affecting alignment", () => {
  const tree = { id: "whacksmacker", label: "WhackSmacker", kind: "root", children: [] };
  const output = renderTwoPaneLanguageTree(tree, new Set(["whacksmacker"]), 0, [
    "```text",
    "마리아: 안녕하세요. 저는 마리아 가르시아입니다.",
    "김민준: 안녕하세요. 저는 김민준입니다.",
    "```",
    "",
    "```text",
    "제 이름은 ____입니다.",
    "```"
  ].join("\n"), true);
  const stripped = stripAnsi(output);
  const pink = "\x1b[38;5;213m";

  assert.match(output, new RegExp(`${escapeRegExp(pink)}마리아:`, "u"));
  assert.match(output, new RegExp(`${escapeRegExp(pink)}김민준:`, "u"));
  assert.match(output, new RegExp(`${escapeRegExp(pink)}제 이름은 ____입니다\\.`, "u"));
  assert.match(stripped, /마리아: 안녕하세요/u);
  assert.match(stripped, /김민준: 안녕하세요/u);
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

test("two-pane renderer starts chapter content near the content pane border", () => {
  const tree = { id: "whacksmacker", label: "WhackSmacker", kind: "root", children: [] };
  const output = renderTwoPaneLanguageTree(tree, new Set(["whacksmacker"]), 0, [
    "# Chapter 1 -- Names and First Greetings",
    "",
    "This chapter teaches a first formal Korean self-introduction.",
    "",
    "```text",
    "마리아: 안녕하세요. 저는 마리아 가르시아입니다.",
    "김민준: 안녕하세요. 저는 김민준입니다.",
    "```"
  ].join("\n"), false);
  const frameLines = output.split("\n").filter((line) => line.startsWith("| "));
  const contentBorderColumns = frameLines.map((line) => displayColumnOf(line, "|", 2));
  const headingLine = frameLines.find((line) => line.includes("Ch 1 -- Names and First Greetings")) ?? "";
  const bodyLine = frameLines.find((line) => line.includes("This chapter teaches")) ?? "";
  const dialogueLine = frameLines.find((line) => line.includes("마리아:")) ?? "";
  const headingStart = displayColumnOf(headingLine, "C");
  const bodyStart = displayColumnOf(bodyLine, "T");
  const dialogueStart = displayColumnOf(dialogueLine, "마");

  assert.deepEqual(new Set(contentBorderColumns).size, 1);
  assert.equal(headingStart, (contentBorderColumns[0] ?? 0) + 2);
  assert.equal(bodyStart, (contentBorderColumns[0] ?? 0) + 2);
  assert.equal(dialogueStart, (contentBorderColumns[0] ?? 0) + 2);
  assert.ok((contentBorderColumns[0] ?? 0) >= 33);
  assert.ok((contentBorderColumns[0] ?? 0) <= 75);
  assert.doesNotMatch(output, /Chapter 1 -- Names and First Greetings/u);
  assert.doesNotMatch(output, /^.*\|\s+code\s+\|.*$/mu);
});

test("two-pane renderer supports right pane scroll offsets", () => {
  const tree = {
    id: "whacksmacker",
    label: "WhackSmacker",
    kind: "root"
  };
  const longText = Array.from({ length: 40 }, (_, index) => `Line ${index + 1}`).join("\n");
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
    "Review Prompt",
    "",
    "question",
    "",
    "Review Answer",
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

    assert.deepEqual(items.map((item) => item.label), ["Chapter 1-5", "Chapter 6-10", "Chapter 11-15", "Chapter 16-20", "Chapter 21-25"]);
    assert.equal(items.some((item) => item.label.includes("com.sleepymario.language.dutch")), false);
    assert.equal(items.some((item) => item.label.includes("cards.tsv")), false);
  } finally {
    await fixture.cleanup();
  }
});

test("Korean and Chinese review source menus use clean deck names", async () => {
  const fixture = await createInstalledLanguageFixture(["korean-curriculum", "chinese-mandarin-traditional-curriculum", "chinese-mandarin-simplified-curriculum"], [
    "com.sleepymario.language.korean",
    "com.sleepymario.language.chinese.mandarin.traditional"
  ]);
  try {
    const korean = reviewSourcesToMenuItems(await listReadingReviewSources({
      dataDir: fixture.dataDir,
      packageId: "com.sleepymario.language.korean"
    }));
    const chinese = reviewSourcesToMenuItems(await listReadingReviewSources({
      dataDir: fixture.dataDir,
      packageId: "com.sleepymario.language.chinese.mandarin.traditional"
    }));

    assert.deepEqual(korean.map((item) => item.label), ["Chapter 1-5", "Chapter 6-10", "Chapter 11-15", "Chapter 16-20", "Chapter 21-25", "Chapter 26-30", "Chapter 31-35", "Chapter 36-40", "Chapter 41-45", "Chapter 46-50"]);
    assert.deepEqual(chinese.map((item) => item.label), ["Chapter 1-5", "Chapter 6-10", "Pinyin-Zhuyin", "Pinyin-Zhuyin with Tones"]);
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
    assert.match(terminal.output, /Review Prompt/);
    assert.match(terminal.output, /Review Answer/);
    assert.match(terminal.output, /Review Prompt[\s\S]+Review Answer/);
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
    assert.match(terminal.output, /Review Prompt[\s\S]+Review Answer/);
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
  assert.match(output, /Notes\n  - noun\n  - kinship noun\n\nExample\n  - Ik ben student\.\n  - De student is hier\.\n  - Sophie is student\./);
  assert.doesNotMatch(output, /Extra example should be capped/);
  assert.doesNotMatch(output, /\x1b\[[0-9;]*m/);
});

test("Korean embedded review reveal shows strict read-content examples", () => {
  const exercise = reviewExercise({
    promptLanguage: "ko",
    answerLanguage: "en",
    promptLines: ["학생"],
    answerLines: ["student"],
    noteLines: ["Deck: Chapter 1-5. Noun."],
    exampleLines: ["저는 학생입니다.", "마리아: 학생입니까?", "김민준: 네, 학생입니다."]
  });
  const output = formatEmbeddedReviewReveal(exercise, exercise, false, "com.sleepymario.language.korean");

  assert.match(output, /Example\n  - 저는 학생입니다\.\n  - 마리아: 학생입니까\?\n  - 김민준: 네, 학생입니다\./u);
  assert.doesNotMatch(output, /missing-source-example/);
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

  assert.match(output, /Review Prompt[\s\S]+hello/);
  assert.match(output, /Review Answer[\s\S]+Pinyin: nǐ hǎo/);
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

  assert.match(output, /Review Prompt[\s\S]+你好/);
  assert.match(output, /Review Answer[\s\S]+Meaning: hello/);
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

  assert.match(output, /Review Prompt[\s\S]+nǐ hǎo[\s\S]+ㄋㄧˇ ㄏㄠˇ/);
  assert.match(output, /Review Answer[\s\S]+Meaning: hello/);
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

  assert.match(output, /Review Prompt[\s\S]+together/);
  assert.match(output, /Review Answer[\s\S]+Reading: いっしょに/);
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

  assert.match(output, /Review Prompt[\s\S]+一緒に/);
  assert.match(output, /Review Answer[\s\S]+Meaning: together/);
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

  assert.match(output, /Review Prompt[\s\S]+いっしょに/);
  assert.match(output, /Review Answer[\s\S]+Meaning: together/);
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

  assert.match(output, /Review Prompt[\s\S]+hallo/);
  assert.match(output, /Review Answer[\s\S]+hello/);
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
  const fixture = await createInstalledLanguageFixture(["korean-curriculum", "chinese-mandarin-traditional-curriculum", "chinese-mandarin-simplified-curriculum", "english-curriculum", "japanese-curriculum", "vietnamese-curriculum", "dutch-curriculum", "german-curriculum", "french-curriculum", "spanish-curriculum"], []);
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

    assert.equal(installedLanguages.children.some((node) => node.label === "Chinese - Mandarin (Traditional)"), false);
    assert.match(enterOnly.output, /Enter shows this information only; it does not install/);

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

    assert.ok(installedLanguages.children.some((node) => node.label === "Chinese - Mandarin (Traditional)"));
    assert.ok(availableLanguages.children.some((node) => node.label === "Chinese - Mandarin (Traditional) [Installed]"));
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
    assert.match(terminal.output, /\x1b\[1m\x1b\[38;5;208mEnglish\x1b\[0m/u);
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
    assert.match(screens[1], /\x1b\[7m\x1b\[1m> English\x1b\[0m/u);
    assert.equal((screens[1].match(/\x1b\[7m/gu) ?? []).length, 1);
    assert.match(screens[2], /\x1b\[7m\x1b\[1m> 中文（臺灣）\x1b\[0m/u);
    assert.match(screens[3], /\x1b\[7m\x1b\[1m>[^\n]*已安裝模組/u);
    assert.match(screens[3], /\x1b\[1m\x1b\[38;5;208m中文（臺灣）\x1b\[0m/u);
    assert.match(screens[4], /\x1b\[7m\x1b\[1m> 中文（臺灣）\x1b\[0m/u);
    assert.match(screens[5], /\x1b\[7m\x1b\[1m> English\x1b\[0m/u);
    assert.match(screens[6], /\x1b\[7m\x1b\[1m>[^\n]*Installed modules/u);
    assert.match(screens[6], /\x1b\[1m\x1b\[38;5;208mEnglish\x1b\[0m/u);
    assert.doesNotMatch(terminal.output, /\x1b\[7m[^\n]*Toggles/u);
    assert.doesNotMatch(terminal.output, /\x1b\[7m[^\n]*Output/u);
    assert.match(stripAnsi(terminal.output), /已安裝模組/u);
    assert.match(stripAnsi(terminal.output), /Installed modules/u);
  } finally {
    await rm(settingsDir, { recursive: true, force: true });
  }
});

test("Enter toggles Normal to Developer and back while navigation preserves the selection", async () => {
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
    assert.match(screens[3], /> View mode: Developer/u);
    assert.match(screens[4], /View mode: Developer/u);
    assert.match(screens[5], /View mode: Developer/u);
    assert.match(screens[6], /View mode: Developer/u);
    assert.match(screens[7], /> View mode: Developer/u);
    assert.match(screens[8], /> View mode: Normal/u);
  } finally {
    await rm(settingsDir, { recursive: true, force: true });
  }
});

function stripAnsi(text) {
  return text.replace(/\x1b\[[0-9;]*m/g, "");
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
    column += isWideCharacterForTest(character) ? 2 : 1;
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
    column += isWideCharacterForTest(character) ? 2 : 1;
  }
  return -1;
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
    ["korean-curriculum", "korean-core-reviews"], ["chinese-mandarin-traditional-curriculum", "chinese-traditional-core-reviews"],
    ["chinese-mandarin-simplified-curriculum", "chinese-simplified-core-reviews"], ["english-curriculum", "english-core-reviews"],
    ["japanese-curriculum", "japanese-core-reviews"], ["vietnamese-curriculum", "vietnamese-core-reviews"],
    ["dutch-curriculum", "dutch-core-reviews"], ["german-curriculum", "german-core-reviews"],
    ["french-curriculum", "french-core-reviews"], ["spanish-curriculum", "spanish-core-reviews"]
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
