import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";

import { createCommandRegistry, resolveCliCommand } from "../dist/apps/cli/main.js";
import {
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
  installedLanguagePackagesToMenuItems,
  languageMenuHeading,
  listAvailableModuleDescriptors,
  renderTwoPaneLanguageTree,
  renderWhackSmackerHeader,
  reviewSourcesToMenuItems,
  runInteractiveMenu,
  shouldUseTerminalColors,
  whackSmackerBanner,
  whackSmackerSubtitle
} from "../dist/apps/cli/interactive-menu.js";
import {
  generateContentPackage,
  generateLocalContentPackageCatalogue,
  getBuiltInFirstClassModules,
  installContentPackage,
  InMemoryCliCommandRegistry,
  installedPackageToFirstClassModuleDescriptor,
  listInstalledContentPackages,
  listReadingReviewItems,
  listReadingReviewSources,
  loadReviewProgressStore,
  recordReadingReviewAnswer
} from "../dist/packages/core/index.js";

class FakeTerminal {
  constructor(keys, { interactive = true, colorsEnabled = interactive } = {}) {
    this.keys = [...keys];
    this.isInteractive = interactive;
    this.colorsEnabled = colorsEnabled;
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

test("interactive menu opens the module two-pane tree", async () => {
  const fixture = await createInstalledDutchFixture();
  const terminal = new FakeTerminal([
    key("q", { sequence: "q" })
  ]);

  try {
    await runInteractiveMenu(createStubRegistry([]), terminal, { dataDir: fixture.dataDir });

    assert.match(terminal.output, /\+------------------------------------\+------------------------------------------------------------------------------\+/);
    assert.match(terminal.output, /WhackSmacker/);
    assert.match(terminal.output, /Installed modules/);
    assert.match(terminal.output, /Modules available/);
    assert.match(terminal.output, /Languages/);
    assert.match(terminal.output, /Games/);
    assert.match(terminal.output, /Geography/);
    assert.match(terminal.output, /Mathematics/);
    assert.doesNotMatch(terminal.output, /mouse/i);
    assert.match(terminal.output, /Space install available/);
  } finally {
    await fixture.cleanup();
  }
});

test("module tree lists top-level categories and installed language packages", async () => {
  const fixture = await createInstalledLanguageFixture(
    ["korean-curriculum", "chinese-mandarin-traditional-curriculum", "chinese-mandarin-simplified-curriculum", "japanese-curriculum", "vietnamese-curriculum", "dutch-curriculum", "german-curriculum", "french-curriculum", "spanish-curriculum"],
    [
      "com.sleepymario.language.korean",
      "com.sleepymario.language.chinese.mandarin.simplified",
      "com.sleepymario.language.chinese.mandarin.traditional",
      "com.sleepymario.language.japanese",
      "com.sleepymario.language.vietnamese",
      "com.sleepymario.language.dutch",
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
    assert.deepEqual(languages.children.map((node) => node.label), ["Chinese - Mandarin (Simplified)", "Chinese - Mandarin (Traditional)", "Dutch", "French", "German", "Japanese", "Korean", "Spanish", "Vietnamese"]);
    assert.deepEqual(languages.children.map((node) => node.moduleId), [
      "com.sleepymario.language.chinese.mandarin.simplified",
      "com.sleepymario.language.chinese.mandarin.traditional",
      "com.sleepymario.language.dutch",
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
    assert.match(terminal.output, /Space install available/);
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
    ["korean-curriculum", "chinese-mandarin-traditional-curriculum", "chinese-mandarin-simplified-curriculum", "japanese-curriculum", "vietnamese-curriculum", "dutch-curriculum", "german-curriculum", "french-curriculum", "spanish-curriculum"],
    [
      "com.sleepymario.language.korean",
      "com.sleepymario.language.chinese.mandarin.simplified",
      "com.sleepymario.language.chinese.mandarin.traditional",
      "com.sleepymario.language.japanese",
      "com.sleepymario.language.vietnamese",
      "com.sleepymario.language.dutch",
      "com.sleepymario.language.german",
      "com.sleepymario.language.french",
      "com.sleepymario.language.spanish"
    ]
  );
  try {
    const tree = await buildLanguageTree(fixture.dataDir);

    assert.equal(tree.label, "Languages");
    assert.deepEqual(tree.children.map((node) => node.label), ["Chinese - Mandarin (Simplified)", "Chinese - Mandarin (Traditional)", "Dutch", "French", "German", "Japanese", "Korean", "Spanish", "Vietnamese"]);
    for (const languagePackage of tree.children) {
      assert.deepEqual(languagePackage.children.map((node) => node.label), ["Read content", "Review decks", "Package info", "Uninstall"]);
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

    assert.ok(readContent.children.some((node) => node.label === "Chapter 1 -- Basic Sentences I: Greeting and Identity"));
    assert.ok(readContent.children.some((node) => node.label === "Chapter 5 -- Basic Sentences V: There Is N"));
    assert.deepEqual(reviewDecks.children.map((node) => node.label), ["Chapter 1-5"]);
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

    assert.ok(readContent.children.some((node) => node.label === "Chapter 1 -- Basic Sentences I: Greeting and Identity"));
    assert.ok(readContent.children.some((node) => node.label === "Chapter 5 -- Basic Sentences V: How Are You?"));
    assert.deepEqual(reviewDecks.children.map((node) => node.label), ["Chapter 1-5"]);
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

    assert.ok(frenchReadContent.children.some((node) => node.label === "Chapter 1 -- Basic Sentences I: Greeting and Identity"));
    assert.ok(frenchReadContent.children.some((node) => node.label === "Chapter 5 -- Basic Sentences V: How Are You?"));
    assert.deepEqual(frenchReviewDecks.children.map((node) => node.label), ["Chapter 1-5"]);
    assert.ok(spanishReadContent.children.some((node) => node.label === "Chapter 1 -- Basic Sentences I: Greeting and Identity"));
    assert.ok(spanishReadContent.children.some((node) => node.label === "Chapter 5 -- Basic Sentences V: How Are You?"));
    assert.deepEqual(spanishReviewDecks.children.map((node) => node.label), ["Chapter 1-5"]);
  } finally {
    await fixture.cleanup();
  }
});

test("language tree exposes Japanese writing placeholders and no review deck", async () => {
  const fixture = await createInstalledLanguageFixture(["japanese-curriculum"], ["com.sleepymario.language.japanese"]);
  try {
    const tree = await buildLanguageTree(fixture.dataDir);
    const japanese = tree.children.find((node) => node.label === "Japanese");
    const readContent = japanese.children.find((node) => node.label === "Read content");
    const reviewDecks = japanese.children.find((node) => node.label === "Review decks");

    assert.ok(readContent.children.some((node) => node.label === "Hiragana"));
    assert.ok(readContent.children.some((node) => node.label === "Katakana"));
    assert.ok(readContent.children.some((node) => node.label === "An Introduction to Kanji"));
    assert.ok(readContent.children.some((node) => node.label === "Chapter 1 -- Basic Sentences I: Greeting and Identity"));
    assert.ok(readContent.children.some((node) => node.label === "Chapter 5 -- Basic Sentences V: How Are You?"));
    assert.deepEqual(reviewDecks.children.map((node) => node.label), ["No review decks"]);
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

    assert.deepEqual(koreanReview.children.map((node) => node.label), ["Chapter 1-5", "Chapter 6-10", "Chapter 11-15"]);
    assert.deepEqual(chineseReview.children.map((node) => node.label), ["Pinyin-Zhuyin", "Pinyin-Zhuyin with Tones"]);
    assert.equal(koreanReview.children.some((node) => node.label.includes("com.sleepymario")), false);
    assert.equal(chineseReview.children.some((node) => node.label.includes("cards.tsv")), false);
  } finally {
    await fixture.cleanup();
  }
});

test("language tree exposes Mandarin variant readable content without Core review decks", async () => {
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
    assert.ok(traditionalReadContent.children.some((node) => node.label === "Chapter 1 -- Basic Sentences I: Greeting and Identity"));
    assert.ok(traditionalReadContent.children.some((node) => node.label === "Chapter 5 -- Basic Sentences V: How Are You?"));
    assert.deepEqual(traditionalReviewDecks.children.map((node) => node.label), ["Pinyin-Zhuyin", "Pinyin-Zhuyin with Tones"]);
    assert.equal(traditionalReviewDecks.children.some((node) => node.label === "Chapter 1-5"), false);
    assert.ok(simplifiedReadContent.children.some((node) => node.label === "Introduction to Hanyu Pinyin"));
    assert.ok(simplifiedReadContent.children.some((node) => node.label === "Chapter 1 -- Basic Sentences I: Greeting and Identity"));
    assert.ok(simplifiedReadContent.children.some((node) => node.label === "Chapter 5 -- Basic Sentences V: How Are You?"));
    assert.deepEqual(simplifiedReviewDecks.children.map((node) => node.label), ["No review decks"]);
  } finally {
    await fixture.cleanup();
  }
});

test("module tree includes available modules from a catalogue with install status", async () => {
  const fixture = await createInstalledLanguageFixture(
    ["korean-curriculum", "chinese-mandarin-traditional-curriculum", "chinese-mandarin-simplified-curriculum", "japanese-curriculum", "vietnamese-curriculum", "dutch-curriculum", "german-curriculum", "french-curriculum", "spanish-curriculum"],
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
      "French:available",
      "German:available",
      "Japanese:available",
      "Korean:installed",
      "Spanish:available",
      "Vietnamese:available"
    ]);
    assert.deepEqual(availableLanguages.children.map((node) => node.label), [
      "Chinese - Mandarin (Simplified) [available]",
      "Chinese - Mandarin (Traditional) [available]",
      "Dutch [available]",
      "French [available]",
      "German [available]",
      "Japanese [available]",
      "Korean [installed]",
      "Spanish [available]",
      "Vietnamese [available]"
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
    assert.match(output, />     > Read content/);
    assert.match(output, /Preview text/);
    assert.match(output, /Space install available/);
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
  assert.match(output, /Example Language/);
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

test("Dutch review sources submenu uses clean selectable deck labels", async () => {
  const fixture = await createInstalledDutchFixture();
  try {
    const sources = await listReadingReviewSources({
      dataDir: fixture.dataDir,
      packageId: "com.sleepymario.language.dutch"
    });
    const items = reviewSourcesToMenuItems(sources);

    assert.deepEqual(items.map((item) => item.label), ["Chapter 1-5"]);
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

    assert.deepEqual(korean.map((item) => item.label), ["Chapter 1-5", "Chapter 6-10", "Chapter 11-15"]);
    assert.deepEqual(chinese.map((item) => item.label), ["Pinyin-Zhuyin", "Pinyin-Zhuyin with Tones"]);
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
    assert.match(stripAnsi(terminal.output), /1 Again/);
    assert.match(stripAnsi(terminal.output), /2 Hard/);
    assert.match(stripAnsi(terminal.output), /3 Good/);
    assert.match(stripAnsi(terminal.output), /4 Easy/);
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
  const fixture = await createInstalledLanguageFixture(["korean-curriculum", "chinese-mandarin-traditional-curriculum", "chinese-mandarin-simplified-curriculum", "japanese-curriculum", "vietnamese-curriculum", "dutch-curriculum", "german-curriculum", "french-curriculum", "spanish-curriculum"], []);
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
    assert.ok(availableLanguages.children.some((node) => node.label === "Chinese - Mandarin (Traditional) [installed]"));
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
    assert.equal((await listInstalledContentPackages(fixture.dataDir)).length, 1);
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
    assert.deepEqual(await listInstalledContentPackages(fixture.dataDir), []);
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
    assert.deepEqual(await listInstalledContentPackages(fixture.dataDir), []);
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
    assert.match(terminal.output, /Chapter 1 -- Basic Sentences I: Greeting and Identity/);
    assert.doesNotMatch(terminal.output, /# Chapter 1 -- Basic Sentences I: Greeting and Identity/);
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
  assert.match(stripAnsi(terminal.output), />   v Installed modules/);
  assert.match(stripAnsi(terminal.output), /Modules available/);
  assert.match(stripAnsi(terminal.output), /Games/);
  assert.match(stripAnsi(terminal.output), /Geography/);
  assert.match(stripAnsi(terminal.output), /Mathematics/);
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

async function createInstalledDutchFixture() {
  return createInstalledLanguageFixture(["dutch-curriculum"], ["com.sleepymario.language.dutch"]);
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

async function createInstalledLanguageFixture(targetIds, packageIds) {
  const root = await mkdtemp(join(tmpdir(), "wsm-menu-dutch-"));
  const packageDirectory = join(root, "packages");
  const cataloguePath = join(root, "catalogue", "catalogue.json");
  const dataDir = join(root, "data", "content");
  for (const targetId of targetIds) {
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
