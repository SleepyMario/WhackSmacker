import type { CliCommand, InMemoryCliCommandRegistry } from "../../packages/core";
import {
  displayLabelForModulePackage,
  formatFirstClassModuleInfo,
  getBuiltInFirstClassModules,
  installedPackageToFirstClassModuleDescriptor,
  installContentPackage,
  isLanguageLikeModulePackage,
  listAvailableContentPackages,
  listReadableContentEntries,
  listInstalledReadablePackages,
  listReadingReviewSources,
  readInstalledContentEntry,
  renderReadingContent,
  sortFirstClassModules,
  type ContentPackageCatalogueEntry,
  type FirstClassModuleDescriptor,
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
  | "installed-root"
  | "available-root"
  | "category"
  | "module"
  | "available-module"
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
  readonly moduleId?: string;
  readonly moduleVersion?: string;
  readonly sourceKind?: string;
  readonly availableStatus?: "installed" | "available" | "update-available";
  readonly cataloguePath?: string;
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
  dim: "\x1b[2m",
  inverse: "\x1b[7m",
  cyan: "\x1b[36m",
  blue: "\x1b[34m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  gray: "\x1b[90m"
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
      label: displayLabelForModulePackage(contentPackage.displayName),
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
  readonly cataloguePath?: string;
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
  let tree = await buildModuleTree(options);
  let expandedIds = new Set<string>(["whacksmacker", "installed-modules", "available-modules"]);
  let selection = Math.min(1, flattenVisibleLanguageTree(tree, expandedIds).length - 1);
  let selectedReviewStartId: string | null = null;
  let rightPaneText = await renderLanguageTreeRightPane(flattenVisibleLanguageTree(tree, expandedIds)[selection]?.node ?? tree, options);
  let rightPaneOffset = 0;

  while (true) {
    const visible = flattenVisibleLanguageTree(tree, expandedIds);
    selection = Math.min(selection, visible.length - 1);
    renderLanguageTreeMenu(terminal, tree, expandedIds, selection, rightPaneText, rightPaneOffset);
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
        rightPaneOffset = 0;
        continue;
      }
      const parent = selected === undefined ? null : findParentLanguageTreeNode(tree, selected.node.id);
      if (parent !== null) {
        expandedIds = withoutExpandedId(expandedIds, parent.id);
        const nextVisible = flattenVisibleLanguageTree(tree, expandedIds);
        selection = Math.max(0, nextVisible.findIndex((entry) => entry.node.id === parent.id));
        rightPaneText = await renderLanguageTreeRightPane(parent, options);
        rightPaneOffset = 0;
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
      rightPaneOffset = 0;
      continue;
    }

    if (isDown(key)) {
      selection = wrapSelection(selection + 1, visible.length);
      selectedReviewStartId = null;
      rightPaneText = await renderLanguageTreeRightPane(flattenVisibleLanguageTree(tree, expandedIds)[selection]?.node ?? tree, options);
      rightPaneOffset = 0;
      continue;
    }

    if (isPageUp(key)) {
      rightPaneOffset = Math.max(0, rightPaneOffset - rightPanePageSize);
      continue;
    }

    if (isPageDown(key)) {
      rightPaneOffset = rightPaneOffset + rightPanePageSize;
      continue;
    }

    if (isHome(key)) {
      rightPaneOffset = 0;
      continue;
    }

    if (isEnd(key)) {
      rightPaneOffset = Number.MAX_SAFE_INTEGER;
      continue;
    }

    if (isSpace(key)) {
      const selected = visible[selection];
      if (selected === undefined) {
        continue;
      }
      const result = await installAvailableModuleFromTreeNode(selected.node, options);
      tree = await buildModuleTree(options);
      expandedIds = keepExistingExpandedIds(tree, expandedIds);
      const nextVisible = flattenVisibleLanguageTree(tree, expandedIds);
      selection = Math.max(0, nextVisible.findIndex((entry) => entry.node.id === selected.node.id));
      if (selection === -1) {
        selection = Math.min(1, nextVisible.length - 1);
      }
      rightPaneText = result;
      rightPaneOffset = 0;
      selectedReviewStartId = null;
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
        tree = await buildModuleTree(options);
        expandedIds = keepExistingExpandedIds(tree, expandedIds);
        rightPaneText = await renderLanguageTreeRightPane(selected.node, options);
        rightPaneOffset = 0;
        if (quit) {
          return true;
        }
      } else {
        selectedReviewStartId = selected.node.id;
        rightPaneText = renderReviewDeckPreview(selected.node, true);
        rightPaneOffset = 0;
      }
      continue;
    }
    selectedReviewStartId = null;
    if (selected.node.kind === "command") {
      const quit = await runModuleTreeCommandAction(registry, terminal, selected.node);
      rightPaneText = await renderLanguageTreeRightPane(selected.node, options);
      rightPaneOffset = 0;
      if (quit) {
        return true;
      }
      continue;
    }
    if (selected.expandable) {
      expandedIds = selected.expanded ? withoutExpandedId(expandedIds, selected.node.id) : withExpandedId(expandedIds, selected.node.id);
      rightPaneText = await renderLanguageTreeRightPane(selected.node, options);
      rightPaneOffset = 0;
      continue;
    }
    rightPaneText = await renderLanguageTreeRightPane(selected.node, options);
    rightPaneOffset = 0;
  }
}

function normalizeTreeOptions(options: InteractiveMenuOptions | string | undefined): InteractiveMenuOptions {
  if (typeof options === "string") {
    return { dataDir: options };
  }
  return options ?? {};
}

export async function buildModuleTree(options: InteractiveMenuOptions | string | undefined = {}): Promise<LanguageTreeNode> {
  const resolvedOptions = normalizeTreeOptions(options);
  const descriptors = await listFirstClassModuleDescriptors(resolvedOptions.dataDir);
  const availableDescriptors = await listAvailableModuleDescriptors(resolvedOptions.cataloguePath, resolvedOptions.dataDir);
  return {
    id: "whacksmacker",
    label: "WhackSmacker",
    kind: "root",
    children: [
      await buildInstalledModulesTree(descriptors, resolvedOptions.dataDir),
      buildAvailableModulesTree(availableDescriptors, resolvedOptions.cataloguePath)
    ]
  };
}

async function installAvailableModuleFromTreeNode(node: LanguageTreeNode, options: InteractiveMenuOptions): Promise<string> {
  if (node.kind !== "available-module") {
    return "Space installs modules from the Modules available section.\n\nSelect an available content-package module and press Space.";
  }
  if (node.sourceKind !== "content-package" || node.packageId === undefined) {
    return `${node.packageLabel ?? node.label}\n\nThis module is built in or native. No package install is required.`;
  }
  const cataloguePath = node.cataloguePath ?? options.cataloguePath;
  if (cataloguePath === undefined) {
    return "No catalogue path was supplied.\n\nLaunch with --catalogue <catalogue.json> to install available modules.";
  }
  if (node.availableStatus === "installed") {
    return [
      `${node.packageLabel ?? node.label}`,
      "",
      "Already installed.",
      "",
      "The same package version is already installed. Space does not reinstall it, so installed package data and user progress are not disturbed.",
      "Use the noninteractive content install command with --force if a safe replacement is needed."
    ].join("\n");
  }

  try {
    const result = await installContentPackage({
      cataloguePath,
      dataDir: options.dataDir,
      packageId: node.packageId,
      packageVersion: node.packageVersion
    });
    return [
      result.installed ? "Module installed." : "Module already installed.",
      "",
      `Package: ${result.record.packageId}`,
      `Version: ${result.record.packageVersion}`,
      `Display name: ${result.record.displayName}`,
      `Path: ${result.installPath}`,
      "",
      "The installed modules tree has been refreshed. User progress remains outside installed package directories."
    ].join("\n");
  } catch (error) {
    return `Install failed.\n\n${error instanceof Error ? error.message : String(error)}`;
  }
}

export async function buildLanguageTree(dataDir?: string): Promise<LanguageTreeNode> {
  const descriptors = (await listFirstClassModuleDescriptors(dataDir)).filter((descriptor) => descriptor.category === "Languages");
  return buildLanguageTreeFromDescriptors(descriptors, dataDir);
}

export async function listFirstClassModuleDescriptors(dataDir?: string): Promise<readonly FirstClassModuleDescriptor[]> {
  const installedPackages = await listInstalledReadablePackages(dataDir);
  const installedDescriptors: FirstClassModuleDescriptor[] = [];

  for (const contentPackage of installedPackages) {
    if (!isLanguageLikePackage(contentPackage.packageId)) {
      continue;
    }
    const [entries, reviewSources] = await Promise.all([
      listReadableContentEntries(contentPackage.packageId, dataDir, contentPackage.packageVersion),
      listReadingReviewSources({
        dataDir,
        packageId: contentPackage.packageId,
        packageVersion: contentPackage.packageVersion
      })
    ]);
    const descriptor = installedPackageToFirstClassModuleDescriptor(contentPackage, {
      readableContentCount: entries.filter((entry) => isUserFacingReadableContentPath(entry.path)).length,
      reviewSourceCount: reviewSources.length
    });
    if (descriptor !== null) {
      installedDescriptors.push(descriptor);
    }
  }

  return sortFirstClassModules([...installedDescriptors, ...getBuiltInFirstClassModules()]);
}

export async function listAvailableModuleDescriptors(
  cataloguePath?: string,
  dataDir?: string
): Promise<readonly FirstClassModuleDescriptor[]> {
  const installedRecords = await listInstalledReadablePackages(dataDir);
  const installedByPackageId = new Map(installedRecords.map((record) => [record.packageId, record]));
  const descriptors: FirstClassModuleDescriptor[] = [];

  if (cataloguePath !== undefined) {
    for (const entry of await listAvailableContentPackages(cataloguePath)) {
      if (!entry.packageId.startsWith("com.sleepymario.") || !isLanguageLikePackage(entry.packageId)) {
        continue;
      }
      descriptors.push(catalogueEntryToModuleDescriptor(entry, installedByPackageId.get(entry.packageId)));
    }
  }

  for (const descriptor of getBuiltInFirstClassModules()) {
    descriptors.push({ ...descriptor, availableStatus: "installed" });
  }

  return sortFirstClassModules(descriptors);
}

function catalogueEntryToModuleDescriptor(
  entry: ContentPackageCatalogueEntry,
  installed: InstalledReadablePackage | undefined
): FirstClassModuleDescriptor {
  const status = installed === undefined
    ? "available"
    : installed.packageVersion === entry.packageVersion
      ? "installed"
      : "update-available";
  return {
    moduleId: entry.packageId,
    displayName: displayLabelForModulePackage(entry.displayName),
    category: "Languages",
    version: entry.packageVersion,
    sourceKind: "content-package",
    packageId: entry.packageId,
    packageVersion: entry.packageVersion,
    description: entry.description,
    availableStatus: status
  };
}

function availableStatusForDescriptor(descriptor: FirstClassModuleDescriptor): "installed" | "available" | "update-available" {
  return descriptor.availableStatus ?? (descriptor.sourceKind === "content-package" ? "available" : "installed");
}

function renderAvailableModuleInfo(
  descriptor: FirstClassModuleDescriptor,
  status: "installed" | "available" | "update-available",
  cataloguePath: string
): string {
  const installHint = descriptor.sourceKind === "content-package"
    ? status === "installed"
      ? "Already installed. Space will not reinstall the same package version."
      : "Press Space to install this module from the selected catalogue."
    : "Built-in/native module. No package install is required.";
  return [
    `${descriptor.displayName} [${status}]`,
    "",
    `Module ID: ${descriptor.moduleId}`,
    `Category: ${descriptor.category}`,
    `Version: ${descriptor.version}`,
    `Source kind: ${descriptor.sourceKind}`,
    descriptor.packageId === undefined ? "" : `Package: ${descriptor.packageId}`,
    descriptor.packageVersion === undefined ? "" : `Package version: ${descriptor.packageVersion}`,
    `Catalogue: ${cataloguePath}`,
    "",
    descriptor.description,
    "",
    installHint,
    "Enter shows this information only; it does not install."
  ].filter((line) => line.length > 0).join("\n");
}

async function buildInstalledModulesTree(
  descriptors: readonly FirstClassModuleDescriptor[],
  dataDir?: string
): Promise<LanguageTreeNode> {
  return {
    id: "installed-modules",
    label: "Installed modules",
    kind: "installed-root",
    previewText: "Installed modules\n\nInstalled modules are usable/openable. Content packages are read-only; user progress stays outside package directories.",
    children: [
      await buildLanguageTreeFromDescriptors(descriptors.filter((descriptor) => descriptor.category === "Languages"), dataDir),
      buildModuleCategoryTree("Games", descriptors),
      buildModuleCategoryTree("Geography", descriptors),
      buildModuleCategoryTree("Mathematics", descriptors)
    ]
  };
}

function buildAvailableModulesTree(
  descriptors: readonly FirstClassModuleDescriptor[],
  cataloguePath?: string
): LanguageTreeNode {
  return {
    id: "available-modules",
    label: "Modules available",
    kind: "available-root",
    previewText: cataloguePath === undefined
      ? [
        "Modules available",
        "",
        "No catalogue path was supplied.",
        "",
        "Launch with:",
        "whacksmacker --data-dir <dir> --catalogue <catalogue.json>",
        "",
        "Enter shows module information. Space installs selected available content packages."
      ].join("\n")
      : [
        "Modules available",
        "",
        `Catalogue: ${cataloguePath}`,
        "",
        "Enter opens module information. Space installs selected available content packages.",
        "Selecting a module does not auto-install it."
      ].join("\n"),
    children: cataloguePath === undefined ? [{
      id: "available-modules:none",
      label: "No catalogue selected",
      kind: "message",
      previewText: "No catalogue path was supplied.\n\nLaunch with --catalogue <catalogue.json> to list installable modules."
    }] : [
      buildAvailableCategoryTree("Languages", descriptors, cataloguePath),
      buildAvailableCategoryTree("Games", descriptors, cataloguePath),
      buildAvailableCategoryTree("Geography", descriptors, cataloguePath),
      buildAvailableCategoryTree("Mathematics", descriptors, cataloguePath)
    ]
  };
}

function buildAvailableCategoryTree(
  category: FirstClassModuleDescriptor["category"],
  descriptors: readonly FirstClassModuleDescriptor[],
  cataloguePath: string
): LanguageTreeNode {
  const children = descriptors
    .filter((descriptor) => descriptor.category === category)
    .map((descriptor) => buildAvailableModuleTreeNode(descriptor, cataloguePath));

  return {
    id: `available:${category.toLowerCase()}`,
    label: category,
    kind: "category",
    previewText: `${category}\n\nAvailable first-party modules from the selected catalogue or built-in registry.`,
    children: children.length > 0 ? children : [{
      id: `available:${category.toLowerCase()}:none`,
      label: `No available ${category} modules`,
      kind: "message",
      previewText: `No available ${category} modules were found in the selected catalogue.`
    }]
  };
}

function buildAvailableModuleTreeNode(descriptor: FirstClassModuleDescriptor, cataloguePath: string): LanguageTreeNode {
  const status = availableStatusForDescriptor(descriptor);
  const label = `${descriptor.displayName} [${status}]`;
  return {
    id: `available:${descriptor.moduleId}`,
    label,
    kind: "available-module",
    moduleId: descriptor.moduleId,
    moduleVersion: descriptor.version,
    sourceKind: descriptor.sourceKind,
    packageId: descriptor.packageId,
    packageVersion: descriptor.packageVersion,
    packageLabel: descriptor.displayName,
    availableStatus: status,
    cataloguePath,
    previewText: renderAvailableModuleInfo(descriptor, status, cataloguePath)
  };
}

async function buildLanguageTreeFromDescriptors(
  descriptors: readonly FirstClassModuleDescriptor[],
  dataDir?: string
): Promise<LanguageTreeNode> {
  const packageNodes: LanguageTreeNode[] = [];

  for (const descriptor of descriptors) {
    if (descriptor.packageId === undefined) {
      continue;
    }
    const languagePackage = moduleDescriptorToMenuItem(descriptor);
    const entries = await listReadableContentEntries(descriptor.packageId, dataDir, descriptor.packageVersion);
    const labeledEntries = await labelReadableContentEntries(languagePackage, entries, { dataDir });
    const reviewSources = reviewSourcesToMenuItems(await listReadingReviewSources({
      dataDir,
      packageId: descriptor.packageId,
      packageVersion: descriptor.packageVersion
    }));

    const packageBase = descriptor.packageId;
    const contentChildren = labeledEntries.map((item) => ({
      id: `${packageBase}:content:${item.filePath ?? item.label}`,
      label: item.label,
      kind: "content" as const,
      moduleId: descriptor.moduleId,
      moduleVersion: descriptor.version,
      sourceKind: descriptor.sourceKind,
      packageId: descriptor.packageId,
      packageVersion: descriptor.packageVersion,
      packageLabel: descriptor.displayName,
      filePath: item.filePath
    }));
    const reviewChildren = reviewSources.map((item) => ({
      id: `${packageBase}:review:${item.sourcePath ?? item.label}`,
      label: item.label,
      kind: "review-source" as const,
      moduleId: descriptor.moduleId,
      moduleVersion: descriptor.version,
      sourceKind: descriptor.sourceKind,
      packageId: item.packageId,
      packageVersion: item.packageVersion,
      packageLabel: descriptor.displayName,
      sourcePath: item.sourcePath,
      itemCount: item.itemCount
    }));

    packageNodes.push({
      id: packageBase,
      label: descriptor.displayName,
      kind: "package",
      moduleId: descriptor.moduleId,
      moduleVersion: descriptor.version,
      sourceKind: descriptor.sourceKind,
      packageId: descriptor.packageId,
      packageVersion: descriptor.packageVersion,
      packageLabel: descriptor.displayName,
      previewText: formatFirstClassModuleInfo(descriptor),
      children: [
        {
          id: `${packageBase}:read`,
          label: "Read content",
          kind: "read-section",
          moduleId: descriptor.moduleId,
          moduleVersion: descriptor.version,
          sourceKind: descriptor.sourceKind,
          packageId: descriptor.packageId,
          packageVersion: descriptor.packageVersion,
          packageLabel: descriptor.displayName,
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
          moduleId: descriptor.moduleId,
          moduleVersion: descriptor.version,
          sourceKind: descriptor.sourceKind,
          packageId: descriptor.packageId,
          packageVersion: descriptor.packageVersion,
          packageLabel: descriptor.displayName,
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
          moduleId: descriptor.moduleId,
          moduleVersion: descriptor.version,
          sourceKind: descriptor.sourceKind,
          packageId: descriptor.packageId,
          packageVersion: descriptor.packageVersion,
          packageLabel: descriptor.displayName,
          previewText: formatFirstClassModuleInfo(descriptor)
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

function moduleDescriptorToMenuItem(descriptor: FirstClassModuleDescriptor): MenuItem {
  return {
    label: descriptor.displayName,
    kind: "installed-language",
    moduleId: "language",
    packageId: descriptor.packageId,
    packageVersion: descriptor.packageVersion
  };
}

function buildModuleCategoryTree(category: FirstClassModuleDescriptor["category"], descriptors: readonly FirstClassModuleDescriptor[]): LanguageTreeNode {
  const children = descriptors
    .filter((descriptor) => descriptor.category === category)
    .map((descriptor) => buildBuiltInModuleTreeNode(descriptor));

  return {
    id: category.toLowerCase(),
    label: category,
    kind: "category",
    previewText: `${category}\n\nFirst-class WhackSmacker modules in this category.`,
    children: children.length > 0 ? children : [{
      id: `${category.toLowerCase()}:none`,
      label: `No ${category} modules`,
      kind: "message",
      previewText: `No ${category} modules are available yet.`
    }]
  };
}

function buildBuiltInModuleTreeNode(descriptor: FirstClassModuleDescriptor): LanguageTreeNode {
  return {
    id: descriptor.moduleId,
    label: descriptor.displayName,
    kind: "module",
    moduleId: descriptor.moduleId,
    moduleVersion: descriptor.version,
    sourceKind: descriptor.sourceKind,
    previewText: formatFirstClassModuleInfo(descriptor),
    children: (descriptor.actions ?? []).map((action) => ({
      id: `${descriptor.moduleId}:${action.id}`,
      label: action.label,
      kind: action.kind,
      moduleId: descriptor.moduleId,
      moduleVersion: descriptor.version,
      sourceKind: descriptor.sourceKind,
      commandPath: action.commandPath,
      commandArgs: action.commandArgs,
      launchTitle: action.launchTitle,
      previewText: action.previewText
    }))
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
  if (node.kind === "package-info") {
    return node.previewText ?? [
      node.packageLabel ?? node.label,
      "",
      `Package: ${node.packageId ?? "unknown"}`,
      `Version: ${node.packageVersion ?? "latest installed"}`,
      "",
      "Installed package content is read-only.",
      "User progress and settings stay outside package directories."
    ].join("\n");
  }
  if (node.kind === "package") {
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
    return `Read content\n\nSelect a content item to preview it here. Markdown-like source is styled for terminal reading.`;
  }
  if (node.kind === "review-section") {
    return `Review decks\n\nSelect a review deck to see details, then press Enter again to start review.`;
  }
  if (node.kind === "message") {
    return node.previewText ?? node.label;
  }
  if (node.kind === "available-module") {
    return node.previewText ?? `${node.label}\n\nPress Space to install if this module is available. Enter does not install.`;
  }
  if (node.kind === "installed-root" || node.kind === "available-root" || node.kind === "category" || node.kind === "module" || node.kind === "command") {
    return node.previewText ?? `${node.label}\n\nSelect or expand items in the tree.`;
  }
  return [
    "WhackSmacker",
    "",
    "Installed modules and available first-party modules appear in separate tree sections.",
    "",
    "Expand installed modules to read content, review decks, inspect package info, or launch built-in module commands.",
    "Expand Modules available to inspect catalogue entries. Press Space to install an available content package.",
    "",
    "Controls:",
    "Up/Down move",
    "Enter opens or expands",
    "Space installs available modules",
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
  return isLanguageLikeModulePackage(packageId);
}

function displayLabelForLanguagePackage(displayName: string): string {
  return displayLabelForModulePackage(displayName);
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
  rightPaneText: string,
  rightPaneOffset: number
): void {
  terminal.write(`\x1b[2J\x1b[H${renderTwoPaneLanguageTree(root, expandedIds, selection, rightPaneText, terminal.colorsEnabled, rightPaneOffset)}`);
}

const rightPanePageSize = 24;

export function renderTwoPaneLanguageTree(
  root: LanguageTreeNode,
  expandedIds: ReadonlySet<string>,
  selection: number,
  rightPaneText: string,
  colorsEnabled: boolean,
  rightPaneOffset = 0
): string {
  const visible = flattenVisibleLanguageTree(root, expandedIds);
  const leftWidth = 34;
  const rightWidth = 76;
  const bodyHeight = 28;
  const leftLines = visible.map((entry, index) => renderTreeLine(entry, index === selection, leftWidth, colorsEnabled));
  const rightLines = formatPaneText(rightPaneText, rightWidth, colorsEnabled);
  const maxOffset = Math.max(0, rightLines.length - bodyHeight);
  const offset = Math.min(Math.max(0, rightPaneOffset), maxOffset);
  const visibleRightLines = rightLines.slice(offset, offset + bodyHeight);
  const lines: string[] = [];
  const horizontal = colorizeUi(`+${"-".repeat(leftWidth + 2)}+${"-".repeat(rightWidth + 2)}+`, colorsEnabled);
  const separator = colorizeUi("|", colorsEnabled);
  lines.push(horizontal);
  lines.push(`${separator} ${padRight(stylePaneTitle("WhackSmacker", colorsEnabled), leftWidth)} ${separator} ${padRight(stylePaneTitle("Output", colorsEnabled), rightWidth)} ${separator}`);
  lines.push(`${separator} ${" ".repeat(leftWidth)} ${separator} ${" ".repeat(rightWidth)} ${separator}`);

  for (let index = 0; index < bodyHeight; index += 1) {
    const left = leftLines[index] ?? "";
    const right = visibleRightLines[index] ?? "";
    lines.push(`${separator} ${padRight(left, leftWidth)} ${separator} ${padRight(right, rightWidth)} ${separator}`);
  }

  const scroll = rightLines.length > bodyHeight ? `  Output ${offset + 1}-${Math.min(offset + bodyHeight, rightLines.length)}/${rightLines.length}` : "";
  const footer = `Up/Down move  Enter open/start  Space install available  PgUp/PgDn scroll  Home/End jump  Escape collapse/back  q quit${scroll}`;
  lines.push(horizontal);
  lines.push(colorsEnabled ? `${ansi.green}${footer}${ansi.reset}` : footer);
  return lines.join("\n");
}

function renderTreeLine(entry: VisibleLanguageTreeNode, selected: boolean, width: number, colorsEnabled: boolean): string {
  const marker = selected ? "> " : "  ";
  const expansion = entry.expandable ? (entry.expanded ? "v " : "> ") : "  ";
  const indent = "  ".repeat(entry.depth);
  const plain = truncateText(`${marker}${indent}${expansion}${entry.node.label}`, width);
  if (!colorsEnabled) {
    return plain;
  }
  if (selected) {
    return `${ansi.inverse}${ansi.bold}${plain}${ansi.reset}`;
  }
  if (entry.node.kind === "available-module") {
    if (entry.node.availableStatus === "installed") {
      return `${ansi.green}${plain}${ansi.reset}`;
    }
    if (entry.node.availableStatus === "update-available") {
      return `${ansi.yellow}${plain}${ansi.reset}`;
    }
    return `${ansi.gray}${plain}${ansi.reset}`;
  }
  if (entry.node.kind === "package" || entry.node.kind === "module") {
    return `${ansi.green}${plain}${ansi.reset}`;
  }
  if (entry.node.kind === "category" || entry.node.kind === "installed-root" || entry.node.kind === "available-root" || entry.node.kind === "root") {
    return `${ansi.bold}${ansi.cyan}${plain}${ansi.reset}`;
  }
  if (entry.node.kind === "message") {
    return `${ansi.dim}${plain}${ansi.reset}`;
  }
  if (entry.node.kind === "review-source") {
    return `${ansi.yellow}${plain}${ansi.reset}`;
  }
  return plain;
}

function formatPaneText(text: string, width: number, colorsEnabled: boolean): readonly string[] {
  const lines: string[] = [];
  let inCodeBlock = false;
  for (const rawLine of text.replace(/\t/gu, "  ").split("\n")) {
    if (/^\s*```/u.test(rawLine)) {
      inCodeBlock = !inCodeBlock;
      lines.push(stylePaneLine("code", width, colorsEnabled));
      continue;
    }
    if (rawLine.length === 0) {
      lines.push("");
      continue;
    }
    const prepared = preparePaneLine(rawLine, inCodeBlock, width, colorsEnabled);
    let remaining = prepared.text;
    const wrapped: string[] = [];
    while (remaining.length > width) {
      const breakAt = Math.max(1, remaining.lastIndexOf(" ", width));
      wrapped.push(remaining.slice(0, breakAt));
      remaining = remaining.slice(breakAt).trimStart();
    }
    wrapped.push(remaining);
    lines.push(...wrapped.map((line) => prepared.style(line)));
  }
  return lines;
}

function preparePaneLine(rawLine: string, inCodeBlock: boolean, width: number, colorsEnabled: boolean): { text: string; style(line: string): string } {
  if (inCodeBlock) {
    return {
      text: `  ${rawLine.trimEnd()}`,
      style: (line) => colorsEnabled ? `${ansi.dim}${line}${ansi.reset}` : line
    };
  }
  const heading = rawLine.match(/^(#{1,6})\s+(.+)$/u);
  if (heading !== null) {
    return {
      text: heading[2]?.trim() ?? rawLine,
      style: (line) => colorsEnabled ? `${ansi.bold}${ansi.cyan}${line}${ansi.reset}` : line
    };
  }
  if (/^\s*(-{3,}|\*{3,})\s*$/u.test(rawLine)) {
    return {
      text: "-".repeat(width),
      style: (line) => colorsEnabled ? `${ansi.gray}${line}${ansi.reset}` : line
    };
  }
  const bullet = rawLine.match(/^(\s*)[-*]\s+(.+)$/u);
  if (bullet !== null) {
    return {
      text: `${bullet[1] ?? ""}• ${stripInlineMarkdown(bullet[2] ?? "", colorsEnabled)}`,
      style: (line) => colorsEnabled ? `${ansi.yellow}${line}${ansi.reset}` : line
    };
  }
  return {
    text: stripInlineMarkdown(rawLine, colorsEnabled),
    style: (line) => line
  };
}

function stripInlineMarkdown(text: string, colorsEnabled: boolean): string {
  let result = text.replace(/\*\*([^*]+)\*\*/gu, colorsEnabled ? `${ansi.bold}$1${ansi.reset}` : "$1");
  result = result.replace(/`([^`]+)`/gu, colorsEnabled ? `${ansi.blue}$1${ansi.reset}` : "$1");
  result = result.replace(/\*([^*]+)\*/gu, "$1");
  return result;
}

function stylePaneLine(text: string, width: number, colorsEnabled: boolean): string {
  const line = truncateText(text, width);
  return colorsEnabled ? `${ansi.dim}${line}${ansi.reset}` : line;
}

function stylePaneTitle(text: string, colorsEnabled: boolean): string {
  return colorsEnabled ? `${ansi.bold}${ansi.cyan}${text}${ansi.reset}` : text;
}

function colorizeUi(text: string, colorsEnabled: boolean): string {
  return colorsEnabled ? `${ansi.dim}${ansi.cyan}${text}${ansi.reset}` : text;
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

function isPageUp(key: KeyPress): boolean {
  return key.name === "pageup";
}

function isPageDown(key: KeyPress): boolean {
  return key.name === "pagedown";
}

function isHome(key: KeyPress): boolean {
  return key.name === "home";
}

function isEnd(key: KeyPress): boolean {
  return key.name === "end";
}

function isEnter(key: KeyPress): boolean {
  return key.name === "return" || key.name === "enter";
}

function isSpace(key: KeyPress): boolean {
  return key.name === "space" || key.sequence === " ";
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
