import type { CliCommand, InMemoryCliCommandRegistry } from "../../packages/core";
import {
  listReadableContentEntries,
  listInstalledReadablePackages,
  listReadingReviewSources,
  readInstalledContentEntry,
  renderReadingContent,
  type ReadableContentEntry,
  type ReadingReviewSource,
  type InstalledReadablePackage
} from "../../packages/core";
import {
  defaultBeginnerVolumeOneOutputPath,
  defaultFourAndFiveOutputPath,
  defaultOneToFiveOutputPath,
  defaultOneTwoThreeOutputPath,
  defaultSixToNineOutputPath
} from "../../packages/mathematics";

declare function require(name: "node:fs/promises"): {
  stat(path: string): Promise<unknown>;
};

declare function require(name: "node:readline"): {
  emitKeypressEvents(input: NodeInput): void;
  createInterface(options: { input: NodeInput; output: NodeOutput }): {
    question(prompt: string, callback: (answer: string) => void): void;
    close(): void;
  };
};

declare const process: {
  stdin: NodeInput;
  stdout: NodeOutput;
  env: Record<string, string | undefined>;
  exitCode?: number;
  on(event: "SIGINT", listener: () => void): void;
  off(event: "SIGINT", listener: () => void): void;
};

interface NodeInput {
  isTTY?: boolean;
  setRawMode?(enabled: boolean): void;
  resume(): void;
  pause(): void;
  on(event: "keypress", listener: (text: string, key: KeyPress) => void): void;
  off(event: "keypress", listener: (text: string, key: KeyPress) => void): void;
}

interface NodeOutput {
  isTTY?: boolean;
  write(text: string): void;
}

export interface KeyPress {
  readonly name?: string;
  readonly ctrl?: boolean;
  readonly sequence?: string;
}

export interface Terminal {
  readonly isInteractive: boolean;
  readonly colorsEnabled: boolean;
  write(text: string): void;
  readKey(): Promise<KeyPress>;
  enter(): void;
  restore(): void;
}

export interface MenuItem {
  readonly label: string;
  readonly kind: "language" | "installed-language" | "language-fallback" | "language-package-action" | "review-source" | "readable-content" | "chess" | "geography" | "mathematics" | "placeholder" | "back";
  readonly moduleId?: string;
  readonly packageId?: string;
  readonly packageVersion?: string;
  readonly action?: "read-content" | "review-sources" | "package-info";
  readonly sourcePath?: string;
  readonly filePath?: string;
  readonly itemCount?: number;
}

export type LanguageTreeNodeKind =
  | "root"
  | "category"
  | "module"
  | "command"
  | "package"
  | "read-section"
  | "review-section"
  | "package-info"
  | "content"
  | "review-source"
  | "message";

export interface LanguageTreeNode {
  readonly id: string;
  readonly label: string;
  readonly kind: LanguageTreeNodeKind;
  readonly children?: readonly LanguageTreeNode[];
  readonly packageId?: string;
  readonly packageVersion?: string;
  readonly packageLabel?: string;
  readonly filePath?: string;
  readonly sourcePath?: string;
  readonly itemCount?: number;
  readonly previewText?: string;
  readonly commandPath?: readonly string[];
  readonly commandArgs?: readonly string[];
  readonly launchTitle?: string;
}

export interface VisibleLanguageTreeNode {
  readonly node: LanguageTreeNode;
  readonly depth: number;
  readonly expandable: boolean;
  readonly expanded: boolean;
}

const ansi = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  cyan: "\x1b[36m",
  green: "\x1b[32m"
};

export const whackSmackerBanner = `██╗    ██╗███████╗███╗   ███╗
██║    ██║██╔════╝████╗ ████║
██║ █╗ ██║███████╗██╔████╔██║
██║███╗██║╚════██║██║╚██╔╝██║
╚███╔███╔╝███████║██║ ╚═╝ ██║
 ╚══╝╚══╝ ╚══════╝╚═╝     ╚═╝`;

export const whackSmackerSubtitle = "WhackSmacker Will Whack That Smack Into Your Brains";

export function renderWhackSmackerHeader(colorsEnabled: boolean): string {
  const banner = colorsEnabled ? colorizeWsmBanner(whackSmackerBanner) : whackSmackerBanner;
  const subtitle = colorsEnabled ? `${ansi.bold}${ansi.green}${whackSmackerSubtitle}${ansi.reset}` : whackSmackerSubtitle;

  return `${banner}\n${subtitle}\n`;
}

export function shouldUseTerminalColors(outputIsTty: boolean, env: Record<string, string | undefined>): boolean {
  return outputIsTty && env.NO_COLOR === undefined;
}

const mainMenuItems: readonly MenuItem[] = [
  { label: "Language", kind: "language", moduleId: "language" },
  { label: "Chess", kind: "chess", moduleId: "chess" },
  { label: "Geography", kind: "geography", moduleId: "geography" },
  { label: "Mathematics", kind: "mathematics", moduleId: "mathematics" }
];

const languageMenuItems: readonly MenuItem[] = [
  { label: "Korean", kind: "language-fallback", moduleId: "language", packageId: "com.sleepymario.language.korean" },
  { label: "Linguistic Terms", kind: "language-fallback", moduleId: "language", packageId: "com.sleepymario.language.linguistic-terminology" },
  { label: "Back", kind: "back" }
];

const installedLanguagePackageActions: readonly MenuItem[] = [
  { label: "Read content", kind: "language-package-action", action: "read-content" },
  { label: "Review sources", kind: "language-package-action", action: "review-sources" },
  { label: "Package info", kind: "language-package-action", action: "package-info" },
  { label: "Back", kind: "back" }
];

const linguisticTermsMenuItems: readonly MenuItem[] = [
  { label: "General", kind: "language", moduleId: "language" },
  { label: "Korean", kind: "language", moduleId: "language" },
  { label: "Back", kind: "back" }
];

const geographyMenuItems: readonly MenuItem[] = [
  { label: "Continents", kind: "geography", moduleId: "geography" },
  { label: "Back", kind: "back" }
];

const mathematicsMenuItems: readonly MenuItem[] = [
  { label: "Beginner Mathematics", kind: "mathematics", moduleId: "mathematics" },
  { label: "Back", kind: "back" }
];

const oneTwoThreeMenuItems: readonly MenuItem[] = [
  { label: "Generate workbook", kind: "mathematics", moduleId: "mathematics" },
  { label: "Back", kind: "back" }
];

const beginnerMathematicsMenuItems: readonly MenuItem[] = [
  { label: "Generate complete Volume 1", kind: "mathematics", moduleId: "mathematics" },
  { label: "Generate Unit 1 - One, Two, Three", kind: "mathematics", moduleId: "mathematics" },
  { label: "Generate Unit 2 - Four and Five", kind: "mathematics", moduleId: "mathematics" },
  { label: "Generate Unit 3 - One to Five", kind: "mathematics", moduleId: "mathematics" },
  { label: "Generate Unit 4 - Six, Seven, Eight, Nine", kind: "mathematics", moduleId: "mathematics" },
  { label: "Back", kind: "back" }
];

export function getMainMenuItems(): readonly MenuItem[] {
  return mainMenuItems;
}

export function getLanguageMenuItems(): readonly MenuItem[] {
  return languageMenuItems;
}

export function getInstalledLanguagePackageActionItems(): readonly MenuItem[] {
  return installedLanguagePackageActions;
}

export async function getDynamicLanguageMenuItems(dataDir?: string): Promise<readonly MenuItem[]> {
  const installed = await discoverInstalledLanguagePackageMenuItems(dataDir);
  return buildLanguageMenuItems(installed);
}

export async function discoverInstalledLanguagePackageMenuItems(dataDir?: string): Promise<readonly MenuItem[]> {
  const packages = await listInstalledReadablePackages(dataDir);
  return installedLanguagePackagesToMenuItems(packages);
}

export function installedLanguagePackagesToMenuItems(packages: readonly InstalledReadablePackage[]): readonly MenuItem[] {
  return packages
    .filter((contentPackage) => isLanguageLikePackage(contentPackage.packageId))
    .map((contentPackage) => ({
      label: displayLabelForLanguagePackage(contentPackage.displayName),
      kind: "installed-language" as const,
      moduleId: "language",
      packageId: contentPackage.packageId,
      packageVersion: contentPackage.packageVersion
    }))
    .sort((left, right) => left.label.localeCompare(right.label));
}

export function buildLanguageMenuItems(installed: readonly MenuItem[]): readonly MenuItem[] {
  const installedPackageIds = new Set(installed.map((item) => item.packageId).filter((packageId): packageId is string => packageId !== undefined));
  const fallbackItems = languageMenuItems.filter(
    (item) => item.kind === "language-fallback" && (item.packageId === undefined || !installedPackageIds.has(item.packageId))
  );
  return [...installed, ...fallbackItems, { label: "Back", kind: "back" }];
}

export function languageMenuHeading(colorsEnabled: boolean, installedCount: number): string {
  const base = `${renderWhackSmackerHeader(colorsEnabled)}\nLanguage\n`;
  if (installedCount > 0) {
    return `${base}Installed Language Packages\n`;
  }
  return `${base}No installed language packages found.\nGenerate content packages, create a local catalogue, then install language packages with whacksmacker content install.\nLegacy/fallback entries are shown below.\n`;
}

export function reviewSourcesToMenuItems(sources: readonly ReadingReviewSource[]): readonly MenuItem[] {
  return sources.map((source) => ({
    label: source.title ?? cleanContentPathLabel(source.sourcePath),
    kind: "review-source" as const,
    packageId: source.packageId,
    packageVersion: source.packageVersion,
    sourcePath: source.sourcePath,
    itemCount: source.itemCount
  })).sort((left, right) => compareMenuLabels(left.label, right.label));
}

export function readableContentEntriesToMenuItems(entries: readonly ReadableContentEntry[]): readonly MenuItem[] {
  return entries
    .filter((entry) => entry.mediaType === "text/markdown" || entry.mediaType === "text/tab-separated-values" || entry.mediaType === "text/plain")
    .filter((entry) => isUserFacingReadableContentPath(entry.path))
    .map((entry) => ({
      label: cleanContentPathLabel(entry.path),
      kind: "readable-content" as const,
      filePath: entry.path
    }))
    .sort((left, right) => compareReadableContentLabels(left.filePath ?? left.label, right.filePath ?? right.label));
}

export function getLinguisticTermsMenuItems(): readonly MenuItem[] {
  return linguisticTermsMenuItems;
}

export function getGeographyMenuItems(): readonly MenuItem[] {
  return geographyMenuItems;
}

export function getMathematicsMenuItems(): readonly MenuItem[] {
  return mathematicsMenuItems;
}

export function getOneTwoThreeMenuItems(): readonly MenuItem[] {
  return oneTwoThreeMenuItems;
}

export function getBeginnerMathematicsMenuItems(): readonly MenuItem[] {
  return beginnerMathematicsMenuItems;
}

export function createNodeTerminal(): Terminal {
  const readline = require("node:readline");
  let rawModeWasEnabled = false;
  let active = false;

  return {
    get isInteractive() {
      return process.stdin.isTTY === true && process.stdout.isTTY === true;
    },
    get colorsEnabled() {
      return shouldUseTerminalColors(process.stdout.isTTY === true, process.env);
    },
    write(text) {
      process.stdout.write(text);
    },
    readKey() {
      readline.emitKeypressEvents(process.stdin);
      process.stdin.resume();

      return new Promise((resolve) => {
        const onKey = (_text: string, key: KeyPress): void => {
          process.stdin.off("keypress", onKey);
          resolve(key);
        };

        process.stdin.on("keypress", onKey);
      });
    },
    enter() {
      active = true;
      rawModeWasEnabled = false;
      process.stdin.setRawMode?.(true);
      process.stdin.resume();
      process.stdout.write("\x1b[?25l");
    },
    restore() {
      if (!active) {
        return;
      }

      process.stdout.write("\x1b[?25h");
      process.stdin.setRawMode?.(rawModeWasEnabled);
      process.stdin.pause();
      active = false;
    }
  };
}

export interface InteractiveMenuOptions {
  readonly dataDir?: string;
}

export async function runInteractiveMenu(registry: InMemoryCliCommandRegistry, terminal = createNodeTerminal(), options: InteractiveMenuOptions = {}): Promise<void> {
  if (!terminal.isInteractive) {
    console.error("Interactive menu requires an interactive terminal. Run a command directly instead.");
    process.exitCode = 1;
    return;
  }

  let interrupted = false;
  const onSigint = (): void => {
    interrupted = true;
  };

  process.on("SIGINT", onSigint);
  terminal.enter();

  try {
    const quit = await runModuleTreeMenu(registry, terminal, options);
    if (quit) {
      return;
    }
  } finally {
    process.off("SIGINT", onSigint);
    terminal.restore();
    if (interrupted) {
      process.exitCode = 130;
    }
  }
}

async function runChessAction(registry: InMemoryCliCommandRegistry, terminal: Terminal): Promise<boolean> {
  const commandPath = ["chess"];
  const command = registry.find(commandPath);

  if (command === null) {
    return showMessage(terminal, `Command is not registered: ${commandPath.join(" ")}`);
  }

  const output = await runCapturedLanguageCommand(terminal, command, []);
  return showPagedMessage(terminal, output);
}

async function runMathematicsMenu(registry: InMemoryCliCommandRegistry, terminal: Terminal): Promise<boolean> {
  let selection = 0;

  while (true) {
    renderMenu(terminal, `${renderWhackSmackerHeader(terminal.colorsEnabled)}\nMathematics\n`, mathematicsMenuItems, selection);
    const key = await terminal.readKey();

    if (isCtrlC(key)) {
      process.exitCode = 130;
      return true;
    }

    if (isEscape(key)) {
      return false;
    }

    if (isQuit(key)) {
      return true;
    }

    if (isUp(key)) {
      selection = wrapSelection(selection - 1, mathematicsMenuItems.length);
      continue;
    }

    if (isDown(key)) {
      selection = wrapSelection(selection + 1, mathematicsMenuItems.length);
      continue;
    }

    if (!isEnter(key)) {
      continue;
    }

    const item = mathematicsMenuItems[selection];
    if (item.kind === "back") {
      return false;
    }

    const quit = await runBeginnerMathematicsMenu(registry, terminal);
    if (quit) {
      return true;
    }
  }
}

async function runBeginnerMathematicsMenu(registry: InMemoryCliCommandRegistry, terminal: Terminal): Promise<boolean> {
  let selection = 0;

  while (true) {
    renderMenu(terminal, `${renderWhackSmackerHeader(terminal.colorsEnabled)}\nBeginner Mathematics\n`, beginnerMathematicsMenuItems, selection);
    const key = await terminal.readKey();

    if (isCtrlC(key)) {
      process.exitCode = 130;
      return true;
    }

    if (isEscape(key)) {
      return false;
    }

    if (isQuit(key)) {
      return true;
    }

    if (isUp(key)) {
      selection = wrapSelection(selection - 1, beginnerMathematicsMenuItems.length);
      continue;
    }

    if (isDown(key)) {
      selection = wrapSelection(selection + 1, beginnerMathematicsMenuItems.length);
      continue;
    }

    if (!isEnter(key)) {
      continue;
    }

    const item = beginnerMathematicsMenuItems[selection];
    if (item.kind === "back") {
      return false;
    }

    const mathActions = [
      { commandPath: ["mathematics", "beginner-volume-one"], defaultOutputPath: defaultBeginnerVolumeOneOutputPath },
      { commandPath: ["mathematics", "one-two-three"], defaultOutputPath: defaultOneTwoThreeOutputPath },
      { commandPath: ["mathematics", "four-and-five"], defaultOutputPath: defaultFourAndFiveOutputPath },
      { commandPath: ["mathematics", "one-to-five"], defaultOutputPath: defaultOneToFiveOutputPath },
      { commandPath: ["mathematics", "six-to-nine"], defaultOutputPath: defaultSixToNineOutputPath }
    ] as const;
    const quit = await runWorkbookAction(registry, terminal, mathActions[selection]);
    if (quit) {
      return true;
    }
  }
}

async function runOneTwoThreeMenu(registry: InMemoryCliCommandRegistry, terminal: Terminal): Promise<boolean> {
  let selection = 0;

  while (true) {
    renderMenu(terminal, `${renderWhackSmackerHeader(terminal.colorsEnabled)}\nOne, Two, Three\n`, oneTwoThreeMenuItems, selection);
    const key = await terminal.readKey();

    if (isCtrlC(key)) {
      process.exitCode = 130;
      return true;
    }

    if (isEscape(key)) {
      return false;
    }

    if (isQuit(key)) {
      return true;
    }

    if (isUp(key)) {
      selection = wrapSelection(selection - 1, oneTwoThreeMenuItems.length);
      continue;
    }

    if (isDown(key)) {
      selection = wrapSelection(selection + 1, oneTwoThreeMenuItems.length);
      continue;
    }

    if (!isEnter(key)) {
      continue;
    }

    const item = oneTwoThreeMenuItems[selection];
    if (item.kind === "back") {
      return false;
    }

    const quit = await runWorkbookAction(registry, terminal, {
      commandPath: ["mathematics", "one-two-three"],
      defaultOutputPath: defaultOneTwoThreeOutputPath
    });
    if (quit) {
      return true;
    }
  }
}

async function runWorkbookAction(
  registry: InMemoryCliCommandRegistry,
  terminal: Terminal,
  options: { commandPath: readonly string[]; defaultOutputPath: string }
): Promise<boolean> {
  const commandPath = options.commandPath;
  const command = registry.find(commandPath);

  if (command === null) {
    return showMessage(terminal, `Command is not registered: ${commandPath.join(" ")}`);
  }

  terminal.restore();
  try {
    const answer = await promptLine(`Output path [${options.defaultOutputPath}]: `);
    const outputPath = answer.trim().length > 0 ? answer.trim() : options.defaultOutputPath;
    const overwrite = await shouldOverwrite(outputPath);
    if (overwrite === null) {
      console.error("Choose another path or confirm overwrite.");
    } else {
      const args = overwrite ? ["--output", outputPath, "--overwrite"] : ["--output", outputPath];
      await command.run(args);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
  } finally {
    terminal.enter();
  }

  return showMessage(terminal, "Press Escape or Enter to return.", { clear: false });
}

async function shouldOverwrite(outputPath: string): Promise<boolean | null> {
  const fs = require("node:fs/promises");

  try {
    await fs.stat(outputPath);
  } catch {
    return false;
  }

  const answer = await promptLine("File exists. Overwrite? [y/N]: ");
  return answer.trim().toLowerCase() === "y" || answer.trim().toLowerCase() === "yes" ? true : null;
}

async function runGeographyMenu(registry: InMemoryCliCommandRegistry, terminal: Terminal): Promise<boolean> {
  let selection = 0;

  while (true) {
    renderMenu(terminal, `${renderWhackSmackerHeader(terminal.colorsEnabled)}\nGeography\n`, geographyMenuItems, selection);
    const key = await terminal.readKey();

    if (isCtrlC(key)) {
      process.exitCode = 130;
      return true;
    }

    if (isEscape(key)) {
      return false;
    }

    if (isQuit(key)) {
      return true;
    }

    if (isUp(key)) {
      selection = wrapSelection(selection - 1, geographyMenuItems.length);
      continue;
    }

    if (isDown(key)) {
      selection = wrapSelection(selection + 1, geographyMenuItems.length);
      continue;
    }

    if (!isEnter(key)) {
      continue;
    }

    const item = geographyMenuItems[selection];
    if (item.kind === "back") {
      return false;
    }

    const quit = await runGeographyAction(registry, terminal);
    if (quit) {
      return true;
    }
  }
}

async function runGeographyAction(registry: InMemoryCliCommandRegistry, terminal: Terminal): Promise<boolean> {
  const commandPath = ["geography", "continents"];
  const command = registry.find(commandPath);

  if (command === null) {
    return showMessage(terminal, `Command is not registered: ${commandPath.join(" ")}`);
  }

  terminal.restore();
  try {
    await command.run([]);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
  } finally {
    terminal.enter();
  }

  return showMessage(terminal, "Press Escape or Enter to return.", { clear: false });
}

async function runModuleTreeMenu(registry: InMemoryCliCommandRegistry, terminal: Terminal, options: InteractiveMenuOptions): Promise<boolean> {
  let tree = await buildModuleTree(options.dataDir);
  let expandedIds = new Set<string>(["whacksmacker"]);
  let selection = Math.min(1, flattenVisibleLanguageTree(tree, expandedIds).length - 1);
  let selectedReviewStartId: string | null = null;
  let rightPaneText = await renderLanguageTreeRightPane(flattenVisibleLanguageTree(tree, expandedIds)[selection]?.node ?? tree, options);

  while (true) {
    const visible = flattenVisibleLanguageTree(tree, expandedIds);
    selection = Math.min(selection, visible.length - 1);
    renderLanguageTreeMenu(terminal, tree, expandedIds, selection, rightPaneText);
    const key = await terminal.readKey();

    if (isCtrlC(key)) {
      process.exitCode = 130;
      return true;
    }

    if (isEscape(key)) {
      const selected = visible[selection];
      if (selected?.expandable === true && selected.expanded) {
        expandedIds = withoutExpandedId(expandedIds, selected.node.id);
        rightPaneText = await renderLanguageTreeRightPane(selected.node, options);
        continue;
      }
      const parent = selected === undefined ? null : findParentLanguageTreeNode(tree, selected.node.id);
      if (parent !== null) {
        expandedIds = withoutExpandedId(expandedIds, parent.id);
        const nextVisible = flattenVisibleLanguageTree(tree, expandedIds);
        selection = Math.max(0, nextVisible.findIndex((entry) => entry.node.id === parent.id));
        rightPaneText = await renderLanguageTreeRightPane(parent, options);
        continue;
      }
      return false;
    }

    if (isQuit(key)) {
      return true;
    }

    if (isUp(key)) {
      selection = wrapSelection(selection - 1, visible.length);
      selectedReviewStartId = null;
      rightPaneText = await renderLanguageTreeRightPane(flattenVisibleLanguageTree(tree, expandedIds)[selection]?.node ?? tree, options);
      continue;
    }

    if (isDown(key)) {
      selection = wrapSelection(selection + 1, visible.length);
      selectedReviewStartId = null;
      rightPaneText = await renderLanguageTreeRightPane(flattenVisibleLanguageTree(tree, expandedIds)[selection]?.node ?? tree, options);
      continue;
    }

    if (!isEnter(key)) {
      continue;
    }

    const selected = visible[selection];
    if (selected === undefined) {
      continue;
    }
    if (selected.node.kind === "review-source") {
      if (selectedReviewStartId === selected.node.id) {
        const quit = await runLanguageTreeReviewSourceAction(registry, terminal, selected.node, options);
        selectedReviewStartId = null;
        tree = await buildModuleTree(options.dataDir);
        expandedIds = keepExistingExpandedIds(tree, expandedIds);
        rightPaneText = await renderLanguageTreeRightPane(selected.node, options);
        if (quit) {
          return true;
        }
      } else {
        selectedReviewStartId = selected.node.id;
        rightPaneText = renderReviewDeckPreview(selected.node, true);
      }
      continue;
    }
    selectedReviewStartId = null;
    if (selected.node.kind === "command") {
      const quit = await runModuleTreeCommandAction(registry, terminal, selected.node);
      rightPaneText = await renderLanguageTreeRightPane(selected.node, options);
      if (quit) {
        return true;
      }
      continue;
    }
    if (selected.expandable) {
      expandedIds = selected.expanded ? withoutExpandedId(expandedIds, selected.node.id) : withExpandedId(expandedIds, selected.node.id);
      rightPaneText = await renderLanguageTreeRightPane(selected.node, options);
      continue;
    }
    rightPaneText = await renderLanguageTreeRightPane(selected.node, options);
  }
}

export async function buildModuleTree(dataDir?: string): Promise<LanguageTreeNode> {
  const languages = await buildLanguageTree(dataDir);
  return {
    id: "whacksmacker",
    label: "WhackSmacker",
    kind: "root",
    children: [
      languages,
      buildGamesTree(),
      buildGeographyTree(),
      buildMathematicsTree()
    ]
  };
}

export async function buildLanguageTree(dataDir?: string): Promise<LanguageTreeNode> {
  const installedPackages = await discoverInstalledLanguagePackageMenuItems(dataDir);
  const packageNodes: LanguageTreeNode[] = [];

  for (const languagePackage of installedPackages) {
    if (languagePackage.packageId === undefined) {
      continue;
    }
    const entries = await listReadableContentEntries(languagePackage.packageId, dataDir, languagePackage.packageVersion);
    const labeledEntries = await labelReadableContentEntries(languagePackage, entries, { dataDir });
    const reviewSources = reviewSourcesToMenuItems(await listReadingReviewSources({
      dataDir,
      packageId: languagePackage.packageId,
      packageVersion: languagePackage.packageVersion
    }));

    const packageBase = languagePackage.packageId;
    const contentChildren = labeledEntries.map((item) => ({
      id: `${packageBase}:content:${item.filePath ?? item.label}`,
      label: item.label,
      kind: "content" as const,
      packageId: languagePackage.packageId,
      packageVersion: languagePackage.packageVersion,
      packageLabel: languagePackage.label,
      filePath: item.filePath
    }));
    const reviewChildren = reviewSources.map((item) => ({
      id: `${packageBase}:review:${item.sourcePath ?? item.label}`,
      label: item.label,
      kind: "review-source" as const,
      packageId: item.packageId,
      packageVersion: item.packageVersion,
      packageLabel: languagePackage.label,
      sourcePath: item.sourcePath,
      itemCount: item.itemCount
    }));

    packageNodes.push({
      id: packageBase,
      label: languagePackage.label,
      kind: "package",
      packageId: languagePackage.packageId,
      packageVersion: languagePackage.packageVersion,
      packageLabel: languagePackage.label,
      children: [
        {
          id: `${packageBase}:read`,
          label: "Read content",
          kind: "read-section",
          packageId: languagePackage.packageId,
          packageVersion: languagePackage.packageVersion,
          packageLabel: languagePackage.label,
          children: contentChildren.length > 0 ? contentChildren : [{
            id: `${packageBase}:read:none`,
            label: "No readable content",
            kind: "message",
            previewText: "No readable content is available for this package."
          }]
        },
        {
          id: `${packageBase}:review`,
          label: "Review decks",
          kind: "review-section",
          packageId: languagePackage.packageId,
          packageVersion: languagePackage.packageVersion,
          packageLabel: languagePackage.label,
          children: reviewChildren.length > 0 ? reviewChildren : [{
            id: `${packageBase}:review:none`,
            label: "No review decks",
            kind: "message",
            previewText: "No review decks are available for this package."
          }]
        },
        {
          id: `${packageBase}:info`,
          label: "Package info",
          kind: "package-info",
          packageId: languagePackage.packageId,
          packageVersion: languagePackage.packageVersion,
          packageLabel: languagePackage.label
        }
      ]
    });
  }

  return {
    id: "languages",
    label: "Languages",
    kind: "category",
    children: packageNodes.length > 0 ? packageNodes : [{
      id: "languages:none",
      label: "No installed language packages",
      kind: "message",
      previewText: [
        "No installed language packages were found.",
        "",
        "Generate content packages, create a local catalogue, then install language packages with whacksmacker content install.",
        "Installed packages appear here automatically after installation."
      ].join("\n")
    }]
  };
}

function buildGamesTree(): LanguageTreeNode {
  return {
    id: "games",
    label: "Games",
    kind: "category",
    previewText: "Games\n\nBuilt-in game modules live here.",
    children: [{
      id: "games:chess",
      label: "Chess",
      kind: "module",
      previewText: [
        "Chess",
        "",
        "Terminal chessboard module.",
        "",
        "Available commands:",
        "whacksmacker chess",
        "whacksmacker chess e2e4 e7e5",
        "whacksmacker chess --legal e2"
      ].join("\n"),
      children: [
        {
          id: "games:chess:board",
          label: "Play / Board",
          kind: "command",
          commandPath: ["chess"],
          commandArgs: [],
          launchTitle: "Chess",
          previewText: "Play / Board\n\nPress Enter to launch the existing terminal chessboard flow.\n\nEquivalent command:\nwhacksmacker chess"
        },
        {
          id: "games:chess:legal",
          label: "Legal moves",
          kind: "message",
          previewText: "Legal moves\n\nUse the command form for now:\nwhacksmacker chess --legal e2\n\nThis tree node is guidance only until a square prompt exists."
        },
        {
          id: "games:chess:info",
          label: "Module info",
          kind: "message",
          previewText: "Chess\n\nBuilt-in terminal chess module.\nUser state is not stored in installed content packages."
        }
      ]
    }]
  };
}

function buildGeographyTree(): LanguageTreeNode {
  return {
    id: "geography",
    label: "Geography",
    kind: "category",
    previewText: "Geography\n\nBuilt-in geography review modules live here.",
    children: [{
      id: "geography:continents",
      label: "Continents",
      kind: "command",
      commandPath: ["geography", "continents"],
      commandArgs: [],
      launchTitle: "Geography -- Continents",
      previewText: "Continents\n\nPress Enter to launch the existing six-continent terminal map review.\n\nEquivalent command:\nwhacksmacker geography continents"
    }]
  };
}

function buildMathematicsTree(): LanguageTreeNode {
  return {
    id: "mathematics",
    label: "Mathematics",
    kind: "category",
    previewText: "Mathematics\n\nBuilt-in mathematics workbook generators live here.",
    children: [{
      id: "mathematics:beginner",
      label: "Beginner Mathematics",
      kind: "module",
      previewText: [
        "Beginner Mathematics",
        "",
        "On-demand workbook generators. These are not installed content packages yet.",
        "",
        "Select a generator to run it, or use the command line directly."
      ].join("\n"),
      children: [
        {
          id: "mathematics:beginner:volume-one",
          label: "Generate complete Volume 1",
          kind: "message",
          previewText: `Generate complete Volume 1\n\nUse the command form for now:\nwhacksmacker mathematics beginner-volume-one --output ${defaultBeginnerVolumeOneOutputPath}\n\nThe tree keeps this as guidance to avoid opening an output-path prompt inside the pane.`
        },
        {
          id: "mathematics:beginner:unit-1",
          label: "Generate Unit 1 - One, Two, Three",
          kind: "message",
          previewText: `Generate Unit 1 - One, Two, Three\n\nUse the command form for now:\nwhacksmacker mathematics one-two-three --output ${defaultOneTwoThreeOutputPath}`
        },
        {
          id: "mathematics:beginner:unit-2",
          label: "Generate Unit 2 - Four and Five",
          kind: "message",
          previewText: `Generate Unit 2 - Four and Five\n\nUse the command form for now:\nwhacksmacker mathematics four-and-five --output ${defaultFourAndFiveOutputPath}`
        },
        {
          id: "mathematics:beginner:unit-3",
          label: "Generate Unit 3 - One to Five",
          kind: "message",
          previewText: `Generate Unit 3 - One to Five\n\nUse the command form for now:\nwhacksmacker mathematics one-to-five --output ${defaultOneToFiveOutputPath}`
        },
        {
          id: "mathematics:beginner:unit-4",
          label: "Generate Unit 4 - Six, Seven, Eight, Nine",
          kind: "message",
          previewText: `Generate Unit 4 - Six, Seven, Eight, Nine\n\nUse the command form for now:\nwhacksmacker mathematics six-to-nine --output ${defaultSixToNineOutputPath}`
        }
      ]
    }]
  };
}

export function flattenVisibleLanguageTree(root: LanguageTreeNode, expandedIds: ReadonlySet<string>): readonly VisibleLanguageTreeNode[] {
  const visible: VisibleLanguageTreeNode[] = [];
  const walk = (node: LanguageTreeNode, depth: number): void => {
    const expandable = (node.children?.length ?? 0) > 0;
    const expanded = expandable && expandedIds.has(node.id);
    visible.push({ node, depth, expandable, expanded });
    if (!expanded) {
      return;
    }
    for (const child of node.children ?? []) {
      walk(child, depth + 1);
    }
  };
  walk(root, 0);
  return visible;
}

async function renderLanguageTreeRightPane(node: LanguageTreeNode, options: InteractiveMenuOptions): Promise<string> {
  if (node.kind === "content") {
    if (node.packageId === undefined || node.filePath === undefined) {
      return "Readable content item is missing package metadata.";
    }
    const result = await readInstalledContentEntry({
      dataDir: options.dataDir,
      packageId: node.packageId,
      packageVersion: node.packageVersion,
      path: node.filePath
    });
    return result.text;
  }
  if (node.kind === "package-info" || node.kind === "package") {
    return [
      node.packageLabel ?? node.label,
      "",
      `Package: ${node.packageId ?? "unknown"}`,
      `Version: ${node.packageVersion ?? "latest installed"}`,
      "",
      "Installed package content is read-only.",
      "User progress and settings stay outside package directories."
    ].join("\n");
  }
  if (node.kind === "review-source") {
    return renderReviewDeckPreview(node, false);
  }
  if (node.kind === "read-section") {
    return `Read content\n\nSelect a content item to preview it here. Markdown is shown as plain text for now.`;
  }
  if (node.kind === "review-section") {
    return `Review decks\n\nSelect a review deck to see details, then press Enter again to start review.`;
  }
  if (node.kind === "message") {
    return node.previewText ?? node.label;
  }
  if (node.kind === "category" || node.kind === "module" || node.kind === "command") {
    return node.previewText ?? `${node.label}\n\nSelect or expand items in the tree.`;
  }
  return [
    "WhackSmacker",
    "",
    "Installed content packages and built-in modules appear in the tree on the left.",
    "",
    "Expand categories to read content, review decks, inspect package info, or launch built-in module commands.",
    "",
    "Controls:",
    "Up/Down move",
    "Enter opens or expands",
    "Escape collapses or backs out",
    "q quits"
  ].join("\n");
}

async function runModuleTreeCommandAction(
  registry: InMemoryCliCommandRegistry,
  terminal: Terminal,
  node: LanguageTreeNode
): Promise<boolean> {
  if (node.commandPath === undefined) {
    return showMessage(terminal, node.previewText ?? "This item does not have a launch action yet.");
  }
  const command = registry.find(node.commandPath);
  if (command === null) {
    return showMessage(terminal, `Command is not registered: ${node.commandPath.join(" ")}`);
  }

  const output = await runCapturedLanguageCommand(terminal, command, node.commandArgs ?? []);
  return showPagedMessage(terminal, renderLanguageActionResult(node.launchTitle ?? node.label, output));
}

function renderReviewDeckPreview(node: LanguageTreeNode, armed: boolean): string {
  return [
    `Review deck: ${node.label}`,
    `Package: ${node.packageLabel ?? node.packageId ?? "unknown"}`,
    node.itemCount === undefined ? "" : `Items: ${node.itemCount}`,
    "",
    armed ? "Press Enter to start review." : "Press Enter once to select this deck, then press Enter again to start review."
  ].filter((line) => line.length > 0).join("\n");
}

async function runLanguageTreeReviewSourceAction(
  registry: InMemoryCliCommandRegistry,
  terminal: Terminal,
  node: LanguageTreeNode,
  options: InteractiveMenuOptions
): Promise<boolean> {
  return runReviewSourceAction(registry, terminal, {
    label: node.packageLabel ?? node.packageId ?? "Installed package",
    kind: "installed-language",
    packageId: node.packageId,
    packageVersion: node.packageVersion
  }, {
    label: node.label,
    kind: "review-source",
    packageId: node.packageId,
    packageVersion: node.packageVersion,
    sourcePath: node.sourcePath,
    itemCount: node.itemCount
  }, options);
}

async function runInstalledLanguagePackageMenu(
  registry: InMemoryCliCommandRegistry,
  terminal: Terminal,
  languagePackage: MenuItem,
  options: InteractiveMenuOptions
): Promise<boolean> {
  let selection = 0;

  while (true) {
    renderMenu(terminal, `${renderWhackSmackerHeader(terminal.colorsEnabled)}\nLanguage\n${languagePackage.label}\n`, installedLanguagePackageActions, selection);
    const key = await terminal.readKey();

    if (isCtrlC(key)) {
      process.exitCode = 130;
      return true;
    }

    if (isEscape(key)) {
      return false;
    }

    if (isQuit(key)) {
      return true;
    }

    if (isUp(key)) {
      selection = wrapSelection(selection - 1, installedLanguagePackageActions.length);
      continue;
    }

    if (isDown(key)) {
      selection = wrapSelection(selection + 1, installedLanguagePackageActions.length);
      continue;
    }

    if (!isEnter(key)) {
      continue;
    }

    const item = installedLanguagePackageActions[selection];
    if (item.kind === "back") {
      return false;
    }

    const quit = await runInstalledLanguagePackageAction(registry, terminal, languagePackage, item, options);
    if (quit) {
      return true;
    }
  }
}

async function runInstalledLanguagePackageAction(
  registry: InMemoryCliCommandRegistry,
  terminal: Terminal,
  languagePackage: MenuItem,
  action: MenuItem,
  options: InteractiveMenuOptions
): Promise<boolean> {
  if (languagePackage.packageId === undefined) {
    return showMessage(terminal, "Installed language package is missing a package ID.");
  }

  if (action.action === "package-info") {
    return showPagedMessage(terminal, renderLanguageActionResult(languagePackage.label, [
      `Package: ${languagePackage.packageId}`,
      `Version: ${languagePackage.packageVersion ?? "latest installed"}`,
      "",
      "Installed package content is read-only. User progress and settings stay outside package directories."
    ].join("\n")));
  }

  if (action.action === "review-sources") {
    return runReviewSourcesMenu(registry, terminal, languagePackage, options);
  }

  return runReadableContentMenu(registry, terminal, languagePackage, options);
}

async function runReviewSourcesMenu(
  registry: InMemoryCliCommandRegistry,
  terminal: Terminal,
  languagePackage: MenuItem,
  options: InteractiveMenuOptions
): Promise<boolean> {
  if (languagePackage.packageId === undefined) {
    return showMessage(terminal, "Installed language package is missing a package ID.");
  }
  const sources = await listReadingReviewSources({
    dataDir: options.dataDir,
    packageId: languagePackage.packageId,
    packageVersion: languagePackage.packageVersion
  });
  const items = [...reviewSourcesToMenuItems(sources), { label: "Back", kind: "back" as const }];
  if (sources.length === 0) {
    return showMessage(terminal, "No review decks are available for this package.");
  }

  let selection = 0;
  while (true) {
    renderMenu(terminal, `${renderWhackSmackerHeader(terminal.colorsEnabled)}\nLanguage\n${languagePackage.label}\nReview sources\n`, items, selection);
    const key = await terminal.readKey();

    if (isCtrlC(key)) {
      process.exitCode = 130;
      return true;
    }
    if (isEscape(key)) {
      return false;
    }
    if (isQuit(key)) {
      return true;
    }
    if (isUp(key)) {
      selection = wrapSelection(selection - 1, items.length);
      continue;
    }
    if (isDown(key)) {
      selection = wrapSelection(selection + 1, items.length);
      continue;
    }
    if (!isEnter(key)) {
      continue;
    }

    const item = items[selection];
    if (item.kind === "back") {
      return false;
    }
    const quit = await runReviewSourceAction(registry, terminal, languagePackage, item, options);
    if (quit) {
      return true;
    }
  }
}

async function runReviewSourceAction(
  registry: InMemoryCliCommandRegistry,
  terminal: Terminal,
  languagePackage: MenuItem,
  source: MenuItem,
  options: InteractiveMenuOptions
): Promise<boolean> {
  if (source.packageId === undefined || source.sourcePath === undefined) {
    return showMessage(terminal, "Review source is missing package metadata.");
  }
  const commandPath = ["review", "run"];
  const command = registry.find(commandPath);
  if (command === null) {
    return showMessage(terminal, `Command is not registered: ${commandPath.join(" ")}`);
  }

  terminal.restore();
  terminal.write(`\x1b[2J\x1b[HReview: ${languagePackage.label} -- ${source.label}\n\n`);
  try {
    await command.run([
      "--package",
      source.packageId,
      "--source",
      source.sourcePath,
      ...packageActionArgs(source, options)
    ]);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
  } finally {
    terminal.enter();
  }

  return showMessage(terminal, "Review session ended. Press Escape or Enter to return.", { clear: false });
}

async function runReadableContentMenu(
  _registry: InMemoryCliCommandRegistry,
  terminal: Terminal,
  languagePackage: MenuItem,
  options: InteractiveMenuOptions
): Promise<boolean> {
  if (languagePackage.packageId === undefined) {
    return showMessage(terminal, "Installed language package is missing a package ID.");
  }
  const entries = await listReadableContentEntries(languagePackage.packageId, options.dataDir, languagePackage.packageVersion);
  const labeledEntries = await labelReadableContentEntries(languagePackage, entries, options);
  const items = [...labeledEntries, { label: "Back", kind: "back" as const }];
  if (labeledEntries.length === 0) {
    return showMessage(terminal, "No readable content is available for this package.");
  }

  let selection = 0;
  while (true) {
    renderMenu(terminal, `${renderWhackSmackerHeader(terminal.colorsEnabled)}\nLanguage\n${languagePackage.label}\nRead content\n`, items, selection);
    const key = await terminal.readKey();

    if (isCtrlC(key)) {
      process.exitCode = 130;
      return true;
    }
    if (isEscape(key)) {
      return false;
    }
    if (isQuit(key)) {
      return true;
    }
    if (isUp(key)) {
      selection = wrapSelection(selection - 1, items.length);
      continue;
    }
    if (isDown(key)) {
      selection = wrapSelection(selection + 1, items.length);
      continue;
    }
    if (!isEnter(key)) {
      continue;
    }

    const item = items[selection];
    if (item.kind === "back") {
      return false;
    }
    const quit = await runReadableContentAction(terminal, languagePackage, item, options);
    if (quit) {
      return true;
    }
  }
}

async function runReadableContentAction(
  terminal: Terminal,
  languagePackage: MenuItem,
  item: MenuItem,
  options: InteractiveMenuOptions
): Promise<boolean> {
  if (languagePackage.packageId === undefined || item.filePath === undefined) {
    return showMessage(terminal, "Readable content item is missing package metadata.");
  }
  const result = await readInstalledContentEntry({
    dataDir: options.dataDir,
    packageId: languagePackage.packageId,
    packageVersion: languagePackage.packageVersion,
    path: item.filePath
  });
  return showPagedMessage(terminal, renderReadingContent(result));
}

async function runLinguisticTermsMenu(registry: InMemoryCliCommandRegistry, terminal: Terminal): Promise<boolean> {
  let selection = 0;

  while (true) {
    renderMenu(terminal, `${renderWhackSmackerHeader(terminal.colorsEnabled)}\nLanguage\nLinguistic Terms\n`, linguisticTermsMenuItems, selection);
    const key = await terminal.readKey();

    if (isCtrlC(key)) {
      process.exitCode = 130;
      return true;
    }

    if (isEscape(key)) {
      return false;
    }

    if (isQuit(key)) {
      return true;
    }

    if (isUp(key)) {
      selection = wrapSelection(selection - 1, linguisticTermsMenuItems.length);
      continue;
    }

    if (isDown(key)) {
      selection = wrapSelection(selection + 1, linguisticTermsMenuItems.length);
      continue;
    }

    if (!isEnter(key)) {
      continue;
    }

    const item = linguisticTermsMenuItems[selection];
    if (item.kind === "back") {
      return false;
    }

    const quit = await runLinguisticTermsAction(registry, terminal, item.label);
    if (quit) {
      return true;
    }
  }
}

async function runLanguageAction(registry: InMemoryCliCommandRegistry, terminal: Terminal, label: string): Promise<boolean> {
  const commandPath = ["language", "korean"];
  const command = registry.find(commandPath);

  if (command === null) {
    return showMessage(terminal, `Command is not registered: ${commandPath.join(" ")}`);
  }

  const output = await runCapturedLanguageCommand(terminal, command, []);
  return showPagedMessage(terminal, renderLanguageActionResult(label, output));
}

async function runLinguisticTermsAction(registry: InMemoryCliCommandRegistry, terminal: Terminal, label: string): Promise<boolean> {
  const commandPath = ["language", "terms"];
  const command = registry.find(commandPath);

  if (command === null) {
    return showMessage(terminal, `Command is not registered: ${commandPath.join(" ")}`);
  }

  const output = await runCapturedLanguageCommand(terminal, command, [label.toLocaleLowerCase()]);
  return showPagedMessage(terminal, renderLanguageActionResult(label, output));
}

async function runCapturedLanguageCommand(terminal: Terminal, command: CliCommand, args: readonly string[]): Promise<string> {
  terminal.restore();

  try {
    return await captureConsoleOutput(async () => {
      await command.run(args);
    });
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  } finally {
    terminal.enter();
  }
}

async function captureConsoleOutput(run: () => Promise<void>): Promise<string> {
  const originalLog = console.log;
  const originalError = console.error;
  const lines: string[] = [];

  console.log = (...args: unknown[]): void => {
    lines.push(formatConsoleLine(args));
  };
  console.error = (...args: unknown[]): void => {
    lines.push(formatConsoleLine(args));
  };

  try {
    await run();
  } finally {
    console.log = originalLog;
    console.error = originalError;
  }

  return lines.join("\n").trimEnd();
}

function formatConsoleLine(args: readonly unknown[]): string {
  return args.map((arg) => (typeof arg === "string" ? arg : String(arg))).join(" ");
}

function renderLanguageActionResult(label: string, output: string): string {
  const body = output.trim().length > 0 ? output : "No output.";

  return `${label}\n\n${body}\n\nPress Escape or Enter to return.`;
}

function packageActionArgs(languagePackage: MenuItem, options: InteractiveMenuOptions): readonly string[] {
  const args: string[] = [];
  if (languagePackage.packageVersion !== undefined) {
    args.push("--version", languagePackage.packageVersion);
  }
  if (options.dataDir !== undefined) {
    args.push("--data-dir", options.dataDir);
  }
  return args;
}

async function labelReadableContentEntries(
  languagePackage: MenuItem,
  entries: readonly ReadableContentEntry[],
  options: InteractiveMenuOptions
): Promise<readonly MenuItem[]> {
  const baseItems = readableContentEntriesToMenuItems(entries);
  if (languagePackage.packageId === undefined) {
    return baseItems;
  }
  const labeled: MenuItem[] = [];
  for (const item of baseItems) {
    if (item.filePath === undefined || !item.filePath.endsWith(".md")) {
      labeled.push(item);
      continue;
    }
    try {
      const content = await readInstalledContentEntry({
        dataDir: options.dataDir,
        packageId: languagePackage.packageId,
        packageVersion: languagePackage.packageVersion,
        path: item.filePath
      });
      labeled.push({ ...item, label: markdownContentLabel(content.text, item.filePath) });
    } catch {
      labeled.push(item);
    }
  }
  return labeled;
}

function isLanguageLikePackage(packageId: string): boolean {
  return packageId.startsWith("com.sleepymario.language.");
}

function displayLabelForLanguagePackage(displayName: string): string {
  return displayName.endsWith(" Curriculum") ? displayName.slice(0, -" Curriculum".length) : displayName;
}

function compareMenuLabels(left: string, right: string): number {
  return left.localeCompare(right, undefined, { numeric: true });
}

function compareReadableContentLabels(leftPath: string, rightPath: string): number {
  return readableContentRank(leftPath) - readableContentRank(rightPath) || compareMenuLabels(leftPath, rightPath);
}

function readableContentRank(path: string): number {
  if (/\/chapter\.md$/u.test(path)) {
    return 0;
  }
  if (/\/README\.md$/u.test(path)) {
    return 1;
  }
  return 2;
}

function isUserFacingReadableContentPath(path: string): boolean {
  if (/\/ledger\.md$/u.test(path)) {
    return false;
  }
  if (/^review-decks\/.+\/cards\.tsv$/u.test(path)) {
    return false;
  }
  return true;
}

function cleanContentPathLabel(path: string): string {
  const basename = path.split("/").at(-1) ?? path;
  return basename
    .replace(/\.(md|tsv|txt|json)$/u, "")
    .replace(/[-_]+/gu, " ")
    .replace(/\b\w/gu, (letter) => letter.toUpperCase());
}

function markdownContentLabel(text: string, fallbackPath: string): string {
  const heading = text.match(/^#\s+(.+)$/mu)?.[1]?.trim();
  return heading === undefined || heading.length === 0 ? cleanContentPathLabel(fallbackPath) : heading;
}

async function runPlaceholderScreen(terminal: Terminal, moduleName: string): Promise<boolean> {
  while (true) {
    terminal.write(`\x1b[2J\x1b[H${moduleName}\n\nThis module is not implemented yet.\n\nPress Escape or Enter to return.`);
    const key = await terminal.readKey();

    if (isCtrlC(key)) {
      process.exitCode = 130;
      return true;
    }

    if (isEscape(key) || isEnter(key)) {
      return false;
    }

    if (isQuit(key)) {
      return true;
    }
  }
}

async function showMessage(terminal: Terminal, message: string, options: { clear: boolean } = { clear: true }): Promise<boolean> {
  while (true) {
    terminal.write(`${options.clear ? "\x1b[2J\x1b[H" : "\n\n"}${message}`);
    const key = await terminal.readKey();

    if (isCtrlC(key)) {
      process.exitCode = 130;
      return true;
    }

    if (isEscape(key) || isEnter(key)) {
      return false;
    }

    if (isQuit(key)) {
      return true;
    }
  }
}

async function showPagedMessage(terminal: Terminal, message: string): Promise<boolean> {
  const pageSize = 22;
  const lines = message.split("\n");
  let offset = 0;

  while (true) {
    const end = Math.min(offset + pageSize, lines.length);
    const page = lines.slice(offset, end).join("\n");
    const status = `\n\nLines ${offset + 1}-${end} of ${lines.length}. Use Up/Down or PageUp/PageDown to scroll. Enter/Escape returns. q quits.`;
    terminal.write(`\x1b[2J\x1b[H${page}${status}`);
    const key = await terminal.readKey();

    if (isCtrlC(key)) {
      process.exitCode = 130;
      return true;
    }

    if (isEscape(key) || isEnter(key)) {
      return false;
    }

    if (isQuit(key)) {
      return true;
    }

    if (isUp(key)) {
      offset = Math.max(0, offset - 1);
      continue;
    }

    if (isDown(key)) {
      offset = Math.min(Math.max(0, lines.length - pageSize), offset + 1);
      continue;
    }

    if (key.name === "pageup") {
      offset = Math.max(0, offset - pageSize);
      continue;
    }

    if (key.name === "pagedown" || key.name === "space") {
      offset = Math.min(Math.max(0, lines.length - pageSize), offset + pageSize);
    }
  }
}

function renderMenu(terminal: Terminal, heading: string, items: readonly MenuItem[], selection: number): void {
  const renderedItems = items
    .map((item, index) => `${index === selection ? "> " : "  "}${item.label}`)
    .join("\n");

  terminal.write(`\x1b[2J\x1b[H${heading}\n${renderedItems}\n\nUse ↑/↓, Enter, Escape, or q.`);
}

function renderLanguageTreeMenu(
  terminal: Terminal,
  root: LanguageTreeNode,
  expandedIds: ReadonlySet<string>,
  selection: number,
  rightPaneText: string
): void {
  terminal.write(`\x1b[2J\x1b[H${renderTwoPaneLanguageTree(root, expandedIds, selection, rightPaneText, terminal.colorsEnabled)}`);
}

export function renderTwoPaneLanguageTree(
  root: LanguageTreeNode,
  expandedIds: ReadonlySet<string>,
  selection: number,
  rightPaneText: string,
  colorsEnabled: boolean
): string {
  const visible = flattenVisibleLanguageTree(root, expandedIds);
  const leftWidth = 34;
  const rightWidth = 76;
  const bodyHeight = 28;
  const leftLines = visible.map((entry, index) => renderTreeLine(entry, index === selection, leftWidth));
  const rightLines = wrapPaneText(rightPaneText, rightWidth);
  const lines: string[] = [];
  lines.push(`+${"-".repeat(leftWidth + 2)}+${"-".repeat(rightWidth + 2)}+`);
  lines.push(`| ${padRight("WhackSmacker", leftWidth)} | ${padRight("Output", rightWidth)} |`);
  lines.push(`| ${" ".repeat(leftWidth)} | ${" ".repeat(rightWidth)} |`);

  for (let index = 0; index < bodyHeight; index += 1) {
    const left = leftLines[index] ?? "";
    const right = rightLines[index] ?? "";
    lines.push(`| ${padRight(left, leftWidth)} | ${padRight(right, rightWidth)} |`);
  }

  const footer = "Up/Down move  Enter open/start  Escape collapse/back  q quit";
  lines.push(`+${"-".repeat(leftWidth + 2)}+${"-".repeat(rightWidth + 2)}+`);
  lines.push(colorsEnabled ? `${ansi.green}${footer}${ansi.reset}` : footer);
  return lines.join("\n");
}

function renderTreeLine(entry: VisibleLanguageTreeNode, selected: boolean, width: number): string {
  const marker = selected ? "> " : "  ";
  const expansion = entry.expandable ? (entry.expanded ? "v " : "> ") : "  ";
  const indent = "  ".repeat(entry.depth);
  return truncateText(`${marker}${indent}${expansion}${entry.node.label}`, width);
}

function wrapPaneText(text: string, width: number): readonly string[] {
  const lines: string[] = [];
  for (const rawLine of text.replace(/\t/gu, "  ").split("\n")) {
    if (rawLine.length === 0) {
      lines.push("");
      continue;
    }
    let remaining = rawLine;
    while (remaining.length > width) {
      const breakAt = Math.max(1, remaining.lastIndexOf(" ", width));
      lines.push(remaining.slice(0, breakAt));
      remaining = remaining.slice(breakAt).trimStart();
    }
    lines.push(remaining);
  }
  return lines;
}

function padRight(text: string, width: number): string {
  const truncated = truncateText(text, width);
  return `${truncated}${" ".repeat(Math.max(0, width - strippedLength(truncated)))}`;
}

function truncateText(text: string, width: number): string {
  if (strippedLength(text) <= width) {
    return text;
  }
  if (width <= 3) {
    return text.slice(0, width);
  }
  return `${text.slice(0, width - 3)}...`;
}

function strippedLength(text: string): number {
  return text.replace(/\x1b\[[0-9;]*m/gu, "").length;
}

function withExpandedId(expandedIds: ReadonlySet<string>, id: string): Set<string> {
  const next = new Set(expandedIds);
  next.add(id);
  return next;
}

function withoutExpandedId(expandedIds: ReadonlySet<string>, id: string): Set<string> {
  const next = new Set(expandedIds);
  next.delete(id);
  return next;
}

function keepExistingExpandedIds(root: LanguageTreeNode, expandedIds: ReadonlySet<string>): Set<string> {
  const existingIds = new Set<string>();
  const walk = (node: LanguageTreeNode): void => {
    existingIds.add(node.id);
    for (const child of node.children ?? []) {
      walk(child);
    }
  };
  walk(root);
  return new Set([...expandedIds].filter((id) => existingIds.has(id)));
}

function findParentLanguageTreeNode(root: LanguageTreeNode, childId: string): LanguageTreeNode | null {
  for (const child of root.children ?? []) {
    if (child.id === childId) {
      return root;
    }
    const found = findParentLanguageTreeNode(child, childId);
    if (found !== null) {
      return found;
    }
  }
  return null;
}

function colorizeWsmBanner(banner: string): string {
  return banner
    .split("\n")
    .map((line) => `${ansi.bold}${ansi.cyan}${line}${ansi.reset}`)
    .join("\n");
}

function wrapSelection(selection: number, count: number): number {
  return ((selection % count) + count) % count;
}

function isUp(key: KeyPress): boolean {
  return key.name === "up";
}

function isDown(key: KeyPress): boolean {
  return key.name === "down";
}

function isEnter(key: KeyPress): boolean {
  return key.name === "return" || key.name === "enter";
}

function isEscape(key: KeyPress): boolean {
  return key.name === "escape";
}

function isQuit(key: KeyPress): boolean {
  return key.name === "q" || key.sequence === "q";
}

function isCtrlC(key: KeyPress): boolean {
  return key.ctrl === true && key.name === "c";
}

async function promptLine(prompt: string): Promise<string> {
  const readline = require("node:readline");

  return new Promise((resolve) => {
    const reader = readline.createInterface({ input: process.stdin, output: process.stdout });
    reader.question(prompt, (answer) => {
      reader.close();
      resolve(answer);
    });
  });
}
