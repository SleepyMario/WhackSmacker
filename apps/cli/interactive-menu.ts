import type { CliCommand, InMemoryCliCommandRegistry } from "../../packages/core";
import {
  displayLabelForModulePackage,
  formatFirstClassModuleInfo,
  getBuiltInFirstClassModules,
  installedPackageToFirstClassModuleDescriptor,
  installContentPackage,
  isLanguageLikeModulePackage,
  listAvailableContentPackages,
  listIntegratedDueReviewItems,
  listReadableContentEntries,
  listInstalledReadablePackages,
  listReadingReviewItems,
  listReadingReviewSources,
  grammarEasyMenuLabel,
  grammarHardMenuLabel,
  orderReviewItemsForSession,
  readInstalledContentEntry,
  recordReadingReviewAnswer,
  removeContentPackage,
  removeReadingReviewProgressForPackage,
  renderReadingReviewItem,
  renderReadingContent,
  sortFirstClassModules,
  syncReadingReviewItems,
  type ContentPackageCatalogueEntry,
  type FirstClassModuleDescriptor,
  type ReadableContentEntry,
  type RenderedExercise,
  type ReadingReviewItem,
  type ReviewItemState,
  type ReviewRating,
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
  | "uninstall"
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

interface EmbeddedReviewSession {
  readonly nodeId: string;
  readonly node: LanguageTreeNode;
  readonly items: readonly ReviewItemState[];
  readonly index: number;
  readonly side: "prompt" | "answer" | "complete";
  readonly promptRendered?: RenderedExercise;
  readonly answerRendered?: RenderedExercise;
  readonly message?: string;
}

interface PendingUninstallSession {
  readonly nodeId: string;
  readonly node: LanguageTreeNode;
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
  let embeddedReview: EmbeddedReviewSession | null = null;
  let pendingUninstall: PendingUninstallSession | null = null;
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
      if (pendingUninstall !== null) {
        rightPaneText = renderUninstallCancelled(pendingUninstall.node);
        pendingUninstall = null;
        rightPaneOffset = 0;
        continue;
      }
      if (embeddedReview !== null) {
        const selected = visible[selection];
        embeddedReview = null;
        selectedReviewStartId = selected?.node.kind === "review-source" ? selected.node.id : null;
        rightPaneText = selected?.node.kind === "review-source"
          ? renderReviewDeckPreview(selected.node, true)
          : await renderLanguageTreeRightPane(selected?.node ?? tree, options);
        rightPaneOffset = 0;
        continue;
      }
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
      if (pendingUninstall !== null) {
        rightPaneText = renderUninstallCancelled(pendingUninstall.node);
        pendingUninstall = null;
        rightPaneOffset = 0;
        continue;
      }
      if (embeddedReview !== null) {
        rightPaneText = renderEmbeddedReviewStopped(embeddedReview.node);
        embeddedReview = null;
        selectedReviewStartId = null;
        rightPaneOffset = 0;
        continue;
      }
      return true;
    }

    if (isUp(key)) {
      embeddedReview = null;
      pendingUninstall = null;
      selection = wrapSelection(selection - 1, visible.length);
      selectedReviewStartId = null;
      rightPaneText = await renderLanguageTreeRightPane(flattenVisibleLanguageTree(tree, expandedIds)[selection]?.node ?? tree, options);
      rightPaneOffset = 0;
      continue;
    }

    if (isDown(key)) {
      embeddedReview = null;
      pendingUninstall = null;
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

    if (pendingUninstall !== null) {
      if (isDeleteSavedData(key)) {
        const result = await uninstallInstalledModuleFromTreeNode(pendingUninstall.node, options, { deleteSavedData: true });
        tree = await buildModuleTree(options);
        expandedIds = keepExistingExpandedIds(tree, expandedIds);
        selection = selectionAfterRemovedNode(tree, expandedIds, pendingUninstall.node.id);
        rightPaneText = result;
        rightPaneOffset = 0;
        pendingUninstall = null;
        selectedReviewStartId = null;
        embeddedReview = null;
        continue;
      }
      if (isKeepSavedData(key) || isEnter(key)) {
        const result = await uninstallInstalledModuleFromTreeNode(pendingUninstall.node, options, { deleteSavedData: false });
        tree = await buildModuleTree(options);
        expandedIds = keepExistingExpandedIds(tree, expandedIds);
        selection = selectionAfterRemovedNode(tree, expandedIds, pendingUninstall.node.id);
        rightPaneText = result;
        rightPaneOffset = 0;
        pendingUninstall = null;
        selectedReviewStartId = null;
        embeddedReview = null;
        continue;
      }
      rightPaneText = renderUninstallConfirmation(pendingUninstall.node, terminal.colorsEnabled, "Choose K to keep saved data, D to delete saved data too, Enter for the safe default, or Esc to cancel.");
      rightPaneOffset = 0;
      continue;
    }

    if (embeddedReview !== null) {
      const selected = visible[selection];
      if (selected?.node.kind === "review-source" && embeddedReview.nodeId === selected.node.id) {
        embeddedReview = await advanceEmbeddedReviewSession(embeddedReview, key, options);
        rightPaneText = renderEmbeddedReviewSession(embeddedReview, terminal.colorsEnabled);
        rightPaneOffset = 0;
        selectedReviewStartId = selected.node.id;
        continue;
      }
    }

    if (isUninstall(key)) {
      const selected = visible[selection];
      const uninstallNode = selected === undefined ? null : uninstallTargetNode(selected.node);
      if (uninstallNode === null) {
        rightPaneText = "Uninstall is available only for installed content-package modules.";
        rightPaneOffset = 0;
        continue;
      }
      pendingUninstall = { nodeId: uninstallNode.id, node: uninstallNode };
      embeddedReview = null;
      selectedReviewStartId = null;
      rightPaneText = renderUninstallConfirmation(uninstallNode, terminal.colorsEnabled);
      rightPaneOffset = 0;
      continue;
    }

    if (isSpace(key)) {
      const selected = visible[selection];
      if (selected === undefined) {
        continue;
      }
      if (selected.node.kind === "review-source") {
        if (embeddedReview === null || embeddedReview.nodeId !== selected.node.id || embeddedReview.side === "complete") {
          embeddedReview = await startEmbeddedReviewSession(selected.node, options);
        } else {
          embeddedReview = await advanceEmbeddedReviewSession(embeddedReview, key, options);
        }
        selectedReviewStartId = selected.node.id;
        rightPaneText = renderEmbeddedReviewSession(embeddedReview, terminal.colorsEnabled);
        rightPaneOffset = 0;
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
      embeddedReview = null;
      pendingUninstall = null;
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
      if (embeddedReview !== null && embeddedReview.nodeId === selected.node.id) {
        embeddedReview = await advanceEmbeddedReviewSession(embeddedReview, key, options);
        rightPaneText = renderEmbeddedReviewSession(embeddedReview, terminal.colorsEnabled);
        rightPaneOffset = 0;
      } else if (selectedReviewStartId === selected.node.id) {
        embeddedReview = await startEmbeddedReviewSession(selected.node, options);
        rightPaneText = renderEmbeddedReviewSession(embeddedReview, terminal.colorsEnabled);
        rightPaneOffset = 0;
      } else {
        selectedReviewStartId = selected.node.id;
        rightPaneText = renderReviewDeckPreview(selected.node, true);
        rightPaneOffset = 0;
      }
      continue;
    }
    selectedReviewStartId = null;
    embeddedReview = null;
    pendingUninstall = null;
    if (selected.node.kind === "uninstall") {
      pendingUninstall = { nodeId: selected.node.id, node: selected.node };
      rightPaneText = renderUninstallConfirmation(selected.node, terminal.colorsEnabled);
      rightPaneOffset = 0;
      continue;
    }
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

async function uninstallInstalledModuleFromTreeNode(
  node: LanguageTreeNode,
  options: InteractiveMenuOptions,
  behavior: { readonly deleteSavedData: boolean }
): Promise<string> {
  if (!isInstalledContentPackageNode(node)) {
    return "Uninstall is available only for installed content-package modules.";
  }
  try {
    const removedAt = currentReviewTimestamp();
    const result = await removeContentPackage({
      dataDir: options.dataDir,
      packageId: node.packageId,
      ...(node.packageVersion === undefined ? {} : { packageVersion: node.packageVersion })
    });
    let savedDataResult = "";
    if (behavior.deleteSavedData) {
      const progress = await removeReadingReviewProgressForPackage({
        dataDir: options.dataDir,
        packageId: node.packageId,
        ...(node.packageVersion === undefined ? {} : { packageVersion: node.packageVersion }),
        removedAt
      });
      savedDataResult = [
        "",
        "Saved review progress deleted for this package only.",
        `Removed review states: ${progress.removedItemCount}`,
        `Removed review events: ${progress.removedEventCount}`,
        `Progress store: ${progress.progressPath}`
      ].join("\n");
    } else {
      savedDataResult = [
        "",
        "Saved user data was kept.",
        "Review progress remains outside installed package content and can be reused if this package is installed again."
      ].join("\n");
    }
    return [
      "Module uninstalled.",
      "",
      `Package: ${node.packageId}`,
      `Version: ${node.packageVersion ?? "all installed versions"}`,
      `Removed package records: ${result.removed.length}`,
      "",
      "Installed package content and registry entries were removed.",
      "Package feeds and catalogues were not changed.",
      savedDataResult
    ].join("\n");
  } catch (error) {
    return `Uninstall failed.\n\n${error instanceof Error ? error.message : String(error)}`;
  }
}

function isInstalledContentPackageNode(node: LanguageTreeNode): node is LanguageTreeNode & { readonly packageId: string } {
  return (node.kind === "package" || node.kind === "package-info" || node.kind === "uninstall") &&
    node.sourceKind === "content-package" &&
    node.packageId !== undefined;
}

function uninstallTargetNode(node: LanguageTreeNode): LanguageTreeNode | null {
  return isInstalledContentPackageNode(node) ? node : null;
}

function selectionAfterRemovedNode(root: LanguageTreeNode, expandedIds: ReadonlySet<string>, removedNodeId: string): number {
  const visible = flattenVisibleLanguageTree(root, expandedIds);
  const exact = visible.findIndex((entry) => entry.node.id === removedNodeId);
  if (exact >= 0) {
    return exact;
  }
  const installedRoot = visible.findIndex((entry) => entry.node.id === "installed-modules");
  return Math.max(0, installedRoot);
}

function renderUninstallPreview(label: string): string {
  return [
    `Uninstall ${label}`,
    "",
    "Uninstall removes the installed read-only package content and package registry entry.",
    "Saved user data and review progress are kept by default.",
    "",
    "Press Enter or U to choose uninstall behavior."
  ].join("\n");
}

function renderUninstallConfirmation(node: LanguageTreeNode, colorsEnabled: boolean, message?: string): string {
  const title = `Uninstall ${node.packageLabel ?? node.label}`;
  const destructive = colorsEnabled ? `${ansi.bold}${ansi.red}D${ansi.reset}` : "D";
  const keep = colorsEnabled ? `${ansi.bold}${ansi.green}K${ansi.reset}` : "K";
  const safeDefault = colorsEnabled ? `${ansi.bold}${ansi.green}Enter${ansi.reset}` : "Enter";
  const warning = colorsEnabled ? `${ansi.bold}${ansi.yellow}This cannot be undone from inside WhackSmacker.${ansi.reset}` : "This cannot be undone from inside WhackSmacker.";
  return [
    title,
    "",
    `Package: ${node.packageId ?? "unknown"}`,
    `Version: ${node.packageVersion ?? "latest installed"}`,
    "",
    "Choose uninstall behavior:",
    "",
    `${safeDefault} or ${keep}: uninstall package only, keep saved data/progress. (safe default)`,
    `${destructive}: uninstall package and delete saved review progress for this package only.`,
    "Esc: cancel.",
    "",
    warning,
    message === undefined ? "" : `\n${message}`
  ].filter((line) => line.length > 0).join("\n");
}

function renderUninstallCancelled(node: LanguageTreeNode): string {
  return [
    `Uninstall cancelled: ${node.packageLabel ?? node.label}`,
    "",
    "Installed package content and saved user data were not changed."
  ].join("\n");
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
        },
        {
          id: `${packageBase}:uninstall`,
          label: "Uninstall",
          kind: "uninstall",
          moduleId: descriptor.moduleId,
          moduleVersion: descriptor.version,
          sourceKind: descriptor.sourceKind,
          packageId: descriptor.packageId,
          packageVersion: descriptor.packageVersion,
          packageLabel: descriptor.displayName,
          previewText: renderUninstallPreview(descriptor.displayName)
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
  if (node.kind === "uninstall") {
    return node.previewText ?? renderUninstallPreview(node.packageLabel ?? node.label);
  }
  if (node.kind === "package") {
    return [
      node.packageLabel ?? node.label,
      "",
      `Package: ${node.packageId ?? "unknown"}`,
      `Version: ${node.packageVersion ?? "latest installed"}`,
      "",
      "Installed package content is read-only.",
      "User progress and settings stay outside package directories.",
      "",
      "Press U to uninstall this package."
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
    armed ? "Press Enter or Space to start review in this pane." : "Press Enter once to select this deck, then press Enter or Space to start review here."
  ].filter((line) => line.length > 0).join("\n");
}

async function startEmbeddedReviewSession(node: LanguageTreeNode, options: InteractiveMenuOptions): Promise<EmbeddedReviewSession> {
  if (node.packageId === undefined || node.sourcePath === undefined) {
    return {
      nodeId: node.id,
      node,
      items: [],
      index: 0,
      side: "complete",
      message: "Review source is missing package metadata."
    };
  }

  const now = currentReviewTimestamp();
  await syncReadingReviewItems({
    dataDir: options.dataDir,
    packageId: node.packageId,
    packageVersion: node.packageVersion,
    now
  });

  const sourceItems = await listReadingReviewItems({
    dataDir: options.dataDir,
    packageId: node.packageId,
    packageVersion: node.packageVersion,
    sourcePath: node.sourcePath
  });
  const sourceItemIds = new Set(sourceItems.filter(isEmbeddedReviewItemUsable).map((item) => item.item.id));
  const due = (await listIntegratedDueReviewItems({
    dataDir: options.dataDir,
    packageId: node.packageId,
    packageVersion: node.packageVersion,
    now
  })).filter((item) => sourceItemIds.has(item.itemId) && (item.sourcePath === undefined || item.sourcePath === node.sourcePath));
  const items = orderReviewItemsForSession(due) as readonly ReviewItemState[];

  if (items.length === 0) {
    return {
      nodeId: node.id,
      node,
      items,
      index: 0,
      side: "complete",
      message: `No due review items found for deck: ${node.label}`
    };
  }

  return renderEmbeddedReviewPrompt({
    nodeId: node.id,
    node,
    items,
    index: 0,
    side: "prompt"
  }, options);
}

async function advanceEmbeddedReviewSession(
  session: EmbeddedReviewSession,
  key: KeyPress,
  options: InteractiveMenuOptions
): Promise<EmbeddedReviewSession> {
  if (session.side === "complete") {
    return session;
  }
  if (session.side === "prompt") {
    if (isEnter(key) || isSpace(key)) {
      return renderEmbeddedReviewAnswer(session, options);
    }
    return { ...session, message: "Press Enter or Space to reveal the answer. Press Esc to leave review." };
  }

  const rating = reviewRatingForKey(key);
  if (rating === null) {
    return {
      ...session,
      message: "Choose 1 again, 2 hard, 3 good, or 4 easy. Esc leaves review."
    };
  }

  const current = session.items[session.index];
  if (current === undefined) {
    return { ...session, side: "complete", message: `Completed review deck: ${session.node.label}` };
  }

  await recordReadingReviewAnswer({
    dataDir: options.dataDir,
    packageId: current.packageId,
    packageVersion: current.packageVersion,
    ...(current.sourcePath === undefined ? {} : { sourcePath: current.sourcePath }),
    itemId: current.itemId,
    rating,
    reviewedAt: currentReviewTimestamp()
  });

  const nextIndex = session.index + 1;
  if (nextIndex >= session.items.length) {
    return {
      ...session,
      index: nextIndex,
      side: "complete",
      promptRendered: undefined,
      answerRendered: undefined,
      message: `Completed review deck: ${session.node.label}`
    };
  }

  return renderEmbeddedReviewPrompt({
    ...session,
    index: nextIndex,
    side: "prompt",
    promptRendered: undefined,
    answerRendered: undefined,
    message: undefined
  }, options);
}

async function renderEmbeddedReviewPrompt(session: EmbeddedReviewSession, options: InteractiveMenuOptions): Promise<EmbeddedReviewSession> {
  const current = session.items[session.index];
  if (current === undefined) {
    return { ...session, side: "complete", message: `Completed review deck: ${session.node.label}` };
  }
  const prompt = await renderReadingReviewItem({
    dataDir: options.dataDir,
    packageId: current.packageId,
    packageVersion: current.packageVersion,
    ...(current.sourcePath === undefined ? {} : { sourcePath: current.sourcePath }),
    itemId: current.itemId
  });
  return { ...session, side: "prompt", promptRendered: prompt.rendered, answerRendered: undefined, message: undefined };
}

async function renderEmbeddedReviewAnswer(session: EmbeddedReviewSession, options: InteractiveMenuOptions): Promise<EmbeddedReviewSession> {
  const current = session.items[session.index];
  if (current === undefined) {
    return { ...session, side: "complete", message: `Completed review deck: ${session.node.label}` };
  }
  const answer = await renderReadingReviewItem({
    dataDir: options.dataDir,
    packageId: current.packageId,
    packageVersion: current.packageVersion,
    ...(current.sourcePath === undefined ? {} : { sourcePath: current.sourcePath }),
    itemId: current.itemId,
    answer: true
  });
  return { ...session, side: "answer", answerRendered: answer.rendered, message: undefined };
}

function renderEmbeddedReviewSession(session: EmbeddedReviewSession, colorsEnabled: boolean): string {
  const packageLabel = session.node.packageLabel ?? session.node.packageId ?? "Installed package";
  const header = [
    `Review: ${packageLabel} / ${session.node.label}`,
    `Card: ${Math.min(session.index + 1, Math.max(session.items.length, 1))}/${session.items.length}`,
    formatLeaveReviewControl(colorsEnabled),
    ""
  ];
  if (session.side === "complete") {
    return [
      ...header,
      session.message ?? `Completed review deck: ${session.node.label}`,
      "",
      "Press Escape to return to the deck preview."
    ].join("\n");
  }
  if (session.promptRendered === undefined) {
    return [...header, "Loading review card..."].join("\n");
  }
  const cards = session.side === "prompt"
    ? [formatEmbeddedReviewExercise(session.promptRendered, "prompt", colorsEnabled, session.node.packageId)]
    : [session.answerRendered === undefined ? "Loading answer..." : formatEmbeddedReviewReveal(session.promptRendered, session.answerRendered, colorsEnabled, session.node.packageId)];
  const controls = session.side === "prompt" ? formatPromptControls(colorsEnabled) : formatRatingControls(colorsEnabled);
  return [
    ...header,
    cards.join("\n\n"),
    session.message === undefined ? "" : `\n${session.message}`,
    reviewBottomBarMarker,
    controls
  ].filter((line) => line.length > 0).join("\n");
}

export function isEmbeddedReviewItemUsable(item: ReadingReviewItem): boolean {
  if (isChineseMandarinPackage(item.packageId)) {
    const view = chineseReviewViewFromBlocks({
      promptLines: normalizeReviewTextLines(item.item.prompt.plainText ?? item.item.prompt.text),
      answerLines: normalizeReviewTextLines(item.item.answer.plainText ?? item.item.answer.text),
      promptLanguage: item.item.prompt.language,
      answerLanguage: item.item.answer.language
    });
    if (!isStructuredChineseReviewView(view)) {
      return true;
    }
    return view.promptSide !== "pronunciation" || isCompoundChinesePronunciation(view.fields);
  }
  if (isJapanesePackage(item.packageId)) {
    const view = japaneseReviewViewFromBlocks({
      promptLines: normalizeReviewTextLines(item.item.prompt.plainText ?? item.item.prompt.text),
      answerLines: normalizeReviewTextLines(item.item.answer.plainText ?? item.item.answer.text),
      promptLanguage: item.item.prompt.language,
      answerLanguage: item.item.answer.language
    });
    if (!isStructuredJapaneseReviewView(view)) {
      return true;
    }
    return view.promptSide !== "reading" || isMultiMoraJapaneseReading(view.fields.reading);
  }
  return true;
}

function isChineseMandarinPackage(packageId?: string): boolean {
  return packageId?.startsWith("com.sleepymario.language.chinese.mandarin.") === true;
}

function isJapanesePackage(packageId?: string): boolean {
  return packageId === "com.sleepymario.language.japanese";
}

export function formatEmbeddedReviewExercise(exercise: RenderedExercise, side: "prompt" | "answer", colorsEnabled: boolean, packageId?: string): string {
  const languageLines = formatLanguageSpecificEmbeddedExerciseLines(exercise, side, packageId);
  const lines = formatEmbeddedReviewBody({
    promptLines: languageLines ?? (side === "prompt" ? exercise.promptLines : exercise.answerLines),
    answerLines: [],
    colorsEnabled,
    placeholder: "Answer hidden until reveal."
  });
  if (side === "prompt" && exercise.hintLines.length > 0) {
    lines.push("", "Hints", ...prefixReviewCardLines(exercise.hintLines));
  }
  if (side === "answer") {
    appendEmbeddedReviewSupplement(lines, embeddedReviewSupplementFromExercise(exercise));
  }
  return lines.join("\n");
}

export function formatEmbeddedReviewReveal(prompt: RenderedExercise, answer: RenderedExercise, colorsEnabled: boolean, packageId?: string): string {
  const languageReveal = formatLanguageSpecificEmbeddedRevealLines(prompt, packageId);
  const lines = formatEmbeddedReviewBody({
    promptLines: languageReveal?.promptLines ?? prompt.promptLines,
    answerLines: languageReveal?.answerLines ?? answer.answerLines,
    colorsEnabled
  });
  appendEmbeddedReviewSupplement(lines, embeddedReviewSupplementFromExercise(answer));
  return lines.join("\n");
}

function formatEmbeddedReviewBody(options: {
  readonly promptLines: readonly string[];
  readonly answerLines: readonly string[];
  readonly colorsEnabled: boolean;
  readonly placeholder?: string;
}): string[] {
  const width = 64;
  const border = "-".repeat(width);
  return [
    reviewCardColor(border, "prompt", options.colorsEnabled),
    reviewCardColor(centerText("Review Prompt", width), "prompt", options.colorsEnabled),
    ...prefixReviewCardLines(options.promptLines),
    "",
    reviewCardColor(centerText("Review Answer", width), "answer", options.colorsEnabled),
    ...prefixReviewCardLines(options.answerLines.length > 0 ? options.answerLines : [options.placeholder ?? ""])
  ];
}

interface EmbeddedReviewSupplement {
  readonly notes: readonly string[];
  readonly examples: readonly string[];
}

function embeddedReviewSupplementFromExercise(exercise: RenderedExercise): EmbeddedReviewSupplement {
  const fromNotes = embeddedReviewSupplementFromNotes(exercise.noteLines);
  return {
    notes: fromNotes.notes,
    examples: [...fromNotes.examples, ...exercise.exampleLines].filter((example, index, all) => all.indexOf(example) === index).slice(0, 3)
  };
}

function embeddedReviewSupplementFromNotes(lines: readonly string[]): EmbeddedReviewSupplement {
  const notes: string[] = [];
  const examples: string[] = [];

  for (const rawLine of lines) {
    for (const candidate of splitEmbeddedReviewNoteLine(rawLine)) {
      const line = stripDeckPrefix(candidate).trim();
      if (line.length === 0 || isInternalEmbeddedReviewNote(line)) {
        continue;
      }
      const example = embeddedReviewExampleSentence(line);
      if (example !== undefined) {
        if (examples.length < 3) {
          examples.push(example);
        }
        continue;
      }
      if (isLearnerFacingEmbeddedReviewNote(line) && notes.length < 3) {
        notes.push(normalizeEmbeddedReviewNote(line));
      }
    }
  }

  return { notes, examples };
}

function appendEmbeddedReviewSupplement(lines: string[], supplement: EmbeddedReviewSupplement): void {
  if (supplement.notes.length > 0) {
    lines.push("", "Notes", ...prefixReviewCardLines(supplement.notes.map((note) => `- ${note}`)));
  }
  if (supplement.examples.length > 0) {
    lines.push("", "Example", ...prefixReviewCardLines(supplement.examples.slice(0, 3).map((example) => `- ${example}`)));
  }
}

function splitEmbeddedReviewNoteLine(line: string): readonly string[] {
  return line
    .replace(/\r\n?/gu, "\n")
    .split(/\n|;/u)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

function stripDeckPrefix(line: string): string {
  return line.replace(/^Deck:\s*[^.]+\.?\s*/u, "");
}

function embeddedReviewExampleSentence(line: string): string | undefined {
  const match = line.match(/^(?:Example(?: Sentence)?|Source Sentence):\s*(.+)$/iu);
  const value = match?.[1]?.trim();
  return value === undefined || value.length === 0 ? undefined : value;
}

function isInternalEmbeddedReviewNote(line: string): boolean {
  const lower = line.toLowerCase();
  return lower.includes("not a grammar-pattern card")
    || lower.includes("not a grammar pattern card")
    || lower.includes("simple review entry")
    || lower.includes("simple predicate entry")
    || lower.includes("template entry")
    || lower.includes("implementation note")
    || lower.includes("authoring note")
    || lower.startsWith("source:")
    || lower.startsWith("item id:")
    || lower.startsWith("raw item id:")
    || lower.startsWith("package id:")
    || lower.startsWith("review-decks/");
}

function isLearnerFacingEmbeddedReviewNote(line: string): boolean {
  const normalized = normalizeEmbeddedReviewNote(line);
  if (normalized.length === 0 || normalized.length > 80) {
    return false;
  }
  if ((normalized.match(/[.!?]/gu) ?? []).length > 1) {
    return false;
  }
  const lower = normalized.toLowerCase();
  return lower.length > 0;
}

function normalizeEmbeddedReviewNote(line: string): string {
  return line.replace(/^[*-]\s*/u, "").replace(/\s+/gu, " ").trim();
}

function formatLanguageSpecificEmbeddedExerciseLines(exercise: RenderedExercise, side: "prompt" | "answer", packageId?: string): readonly string[] | undefined {
  if (isChineseMandarinPackage(packageId)) {
    return formatChineseEmbeddedExerciseLines(exercise, side);
  }
  if (isJapanesePackage(packageId)) {
    return formatJapaneseEmbeddedExerciseLines(exercise, side);
  }
  return undefined;
}

function formatLanguageSpecificEmbeddedRevealLines(exercise: RenderedExercise, packageId?: string): { readonly promptLines: readonly string[]; readonly answerLines: readonly string[] } | undefined {
  if (isChineseMandarinPackage(packageId)) {
    return formatChineseEmbeddedRevealLines(exercise);
  }
  if (isJapanesePackage(packageId)) {
    return formatJapaneseEmbeddedRevealLines(exercise);
  }
  return undefined;
}

type JapaneseReviewSide = "meaning" | "reading" | "japanese" | "unknown";

interface JapaneseReviewFields {
  readonly meaning?: string;
  readonly reading?: string;
  readonly japanese?: string;
}

interface JapaneseReviewView {
  readonly promptSide: JapaneseReviewSide;
  readonly fields: JapaneseReviewFields;
}

function formatJapaneseEmbeddedExerciseLines(exercise: RenderedExercise, side: "prompt" | "answer"): readonly string[] | undefined {
  const view = japaneseReviewViewFromRenderedExercise(exercise);
  if (!hasAnyJapaneseReviewField(view.fields)) {
    return undefined;
  }
  if (side === "prompt") {
    return japanesePromptLinesForView(view);
  }
  return japaneseAnswerLinesForView(view, exercise.answerLines);
}

function formatJapaneseEmbeddedRevealLines(exercise: RenderedExercise): { readonly promptLines: readonly string[]; readonly answerLines: readonly string[] } | undefined {
  const view = japaneseReviewViewFromRenderedExercise(exercise);
  if (!hasAnyJapaneseReviewField(view.fields)) {
    return undefined;
  }
  return {
    promptLines: japanesePromptLinesForView(view),
    answerLines: japaneseAnswerLinesForView(view, exercise.answerLines)
  };
}

function japaneseReviewViewFromRenderedExercise(exercise: RenderedExercise): JapaneseReviewView {
  return japaneseReviewViewFromBlocks({
    promptLines: exercise.promptLines,
    answerLines: exercise.answerLines,
    promptLanguage: exercise.promptLanguage,
    answerLanguage: exercise.answerLanguage
  });
}

function japaneseReviewViewFromBlocks(options: {
  readonly promptLines: readonly string[];
  readonly answerLines: readonly string[];
  readonly promptLanguage?: string;
  readonly answerLanguage?: string;
}): JapaneseReviewView {
  const promptStructured = structuredJapaneseReviewFields(options.promptLines);
  const answerStructured = structuredJapaneseReviewFields(options.answerLines);
  const promptSide = japaneseSideForLines(options.promptLines, options.promptLanguage, promptStructured);
  const answerSide = japaneseSideForLines(options.answerLines, options.answerLanguage, answerStructured);
  const inferredPrompt = inferJapaneseFieldsForSide(options.promptLines, promptSide);
  const inferredAnswer = inferJapaneseFieldsForSide(options.answerLines, answerSide);
  return {
    promptSide,
    fields: mergeJapaneseReviewFields(promptStructured, answerStructured, inferredPrompt, inferredAnswer)
  };
}

function structuredJapaneseReviewFields(lines: readonly string[]): JapaneseReviewFields {
  const fields: { meaning?: string; reading?: string; japanese?: string } = {};
  for (const line of lines) {
    const match = line.match(/^(Meaning|Reading|Japanese):\s*(.+)$/iu);
    if (match === null) {
      continue;
    }
    const key = match[1]?.toLowerCase();
    const value = match[2]?.trim();
    if (value === undefined || value.length === 0) {
      continue;
    }
    if (key === "meaning") {
      fields.meaning = value;
    } else if (key === "reading") {
      fields.reading = value;
    } else if (key === "japanese") {
      fields.japanese = value;
    }
  }
  return fields;
}

function japaneseSideForLines(lines: readonly string[], language: string | undefined, structured: JapaneseReviewFields): JapaneseReviewSide {
  if (structured.meaning !== undefined && structured.reading === undefined && structured.japanese === undefined) {
    return "meaning";
  }
  if (structured.reading !== undefined && structured.meaning === undefined && structured.japanese === undefined) {
    return "reading";
  }
  if (structured.japanese !== undefined && structured.meaning === undefined && structured.reading === undefined) {
    return "japanese";
  }
  if (language === "en") {
    return "meaning";
  }
  const text = lines.join("");
  if (language === "ja-Kana" || (containsKanaCharacter(text) && !containsHanCharacter(text))) {
    return "reading";
  }
  if (language === "ja" || containsJapaneseCharacter(text)) {
    return "japanese";
  }
  return "unknown";
}

function inferJapaneseFieldsForSide(lines: readonly string[], side: JapaneseReviewSide): JapaneseReviewFields {
  const text = lines.join("\n").trim();
  if (text.length === 0) {
    return {};
  }
  if (side === "meaning") {
    return { meaning: text };
  }
  if (side === "reading") {
    return { reading: text };
  }
  if (side === "japanese") {
    return { japanese: text };
  }
  return {};
}

function mergeJapaneseReviewFields(...fields: readonly JapaneseReviewFields[]): JapaneseReviewFields {
  const merged: { meaning?: string; reading?: string; japanese?: string } = {};
  for (const field of fields) {
    merged.meaning ??= field.meaning;
    merged.reading ??= field.reading;
    merged.japanese ??= field.japanese;
  }
  return merged;
}

function japanesePromptLinesForView(view: JapaneseReviewView): readonly string[] {
  if (view.promptSide === "meaning" && view.fields.meaning !== undefined) {
    return [view.fields.meaning];
  }
  if (view.promptSide === "reading" && view.fields.reading !== undefined) {
    return [view.fields.reading];
  }
  if (view.promptSide === "japanese" && view.fields.japanese !== undefined) {
    return [view.fields.japanese];
  }
  return [];
}

function japaneseAnswerLinesForView(view: JapaneseReviewView, fallbackAnswerLines: readonly string[]): readonly string[] {
  const lines: string[] = [];
  if (view.promptSide === "meaning") {
    pushJapaneseReviewLine(lines, "Reading", view.fields.reading);
    pushJapaneseReviewLine(lines, "Japanese", view.fields.japanese);
  } else if (view.promptSide === "japanese") {
    pushJapaneseReviewLine(lines, "Meaning", view.fields.meaning);
    pushJapaneseReviewLine(lines, "Reading", view.fields.reading);
  } else if (view.promptSide === "reading") {
    pushJapaneseReviewLine(lines, "Meaning", view.fields.meaning);
    pushJapaneseReviewLine(lines, "Japanese", view.fields.japanese);
  }
  const prompt = japanesePromptLinesForView(view);
  const promptValues = new Set(prompt);
  const visibleLines = lines.filter((line) => !promptValues.has(line.replace(/^[^:]+:\s*/u, "")));
  return visibleLines.length === 0 ? fallbackAnswerLines : visibleLines;
}

function pushJapaneseReviewLine(lines: string[], label: string, value: string | undefined): void {
  if (value !== undefined && value.length > 0) {
    lines.push(`${label}: ${value}`);
  }
}

function isStructuredJapaneseReviewView(view: JapaneseReviewView): boolean {
  return view.fields.meaning !== undefined && view.fields.reading !== undefined && view.fields.japanese !== undefined;
}

function hasAnyJapaneseReviewField(fields: JapaneseReviewFields): boolean {
  return fields.meaning !== undefined || fields.reading !== undefined || fields.japanese !== undefined;
}

function isMultiMoraJapaneseReading(reading: string | undefined): boolean {
  return reading !== undefined && countJapaneseMoraLikeUnits(reading) >= 2;
}

function countJapaneseMoraLikeUnits(value: string): number {
  const normalized = value.replace(/[\s、。・･\-.!?！？ー]/gu, "");
  let count = 0;
  for (const character of normalized) {
    if (!containsKanaCharacter(character)) {
      continue;
    }
    if (/^[ゃゅょャュョぁぃぅぇぉァィゥェォゎヮ]$/u.test(character)) {
      continue;
    }
    count += 1;
  }
  return count;
}

function containsJapaneseCharacter(value: string): boolean {
  return containsHanCharacter(value) || containsKanaCharacter(value);
}

function containsKanaCharacter(value: string): boolean {
  return /[\u3040-\u309f\u30a0-\u30ff]/u.test(value);
}

/*
 * Chinese embedded review model.
 */

type ChineseReviewSide = "meaning" | "pronunciation" | "characters" | "unknown";

interface ChineseReviewFields {
  readonly meaning?: string;
  readonly pinyin?: string;
  readonly zhuyin?: string;
  readonly characters?: string;
}

interface ChineseReviewView {
  readonly promptSide: ChineseReviewSide;
  readonly fields: ChineseReviewFields;
}

function formatChineseEmbeddedExerciseLines(exercise: RenderedExercise, side: "prompt" | "answer"): readonly string[] | undefined {
  const view = chineseReviewViewFromRenderedExercise(exercise);
  if (!hasAnyChineseReviewField(view.fields)) {
    return undefined;
  }
  if (side === "prompt") {
    return chinesePromptLinesForView(view);
  }
  return chineseAnswerLinesForView(view, exercise.answerLines);
}

function formatChineseEmbeddedRevealLines(exercise: RenderedExercise): { readonly promptLines: readonly string[]; readonly answerLines: readonly string[] } | undefined {
  const view = chineseReviewViewFromRenderedExercise(exercise);
  if (!hasAnyChineseReviewField(view.fields)) {
    return undefined;
  }
  return {
    promptLines: chinesePromptLinesForView(view),
    answerLines: chineseAnswerLinesForView(view, exercise.answerLines)
  };
}

function chineseReviewViewFromRenderedExercise(exercise: RenderedExercise): ChineseReviewView {
  return chineseReviewViewFromBlocks({
    promptLines: exercise.promptLines,
    answerLines: exercise.answerLines,
    promptLanguage: exercise.promptLanguage,
    answerLanguage: exercise.answerLanguage
  });
}

function chineseReviewViewFromBlocks(options: {
  readonly promptLines: readonly string[];
  readonly answerLines: readonly string[];
  readonly promptLanguage?: string;
  readonly answerLanguage?: string;
}): ChineseReviewView {
  const promptStructured = structuredChineseReviewFields(options.promptLines);
  const answerStructured = structuredChineseReviewFields(options.answerLines);
  const promptSide = chineseSideForLines(options.promptLines, options.promptLanguage, promptStructured);
  const answerSide = chineseSideForLines(options.answerLines, options.answerLanguage, answerStructured);
  const inferredPrompt = inferChineseFieldsForSide(options.promptLines, promptSide);
  const inferredAnswer = inferChineseFieldsForSide(options.answerLines, answerSide);
  return {
    promptSide,
    fields: mergeChineseReviewFields(promptStructured, answerStructured, inferredPrompt, inferredAnswer)
  };
}

function structuredChineseReviewFields(lines: readonly string[]): ChineseReviewFields {
  const fields: { meaning?: string; pinyin?: string; zhuyin?: string; characters?: string } = {};
  for (const line of lines) {
    const match = line.match(/^(Meaning|Pinyin|Zhuyin|Characters):\s*(.+)$/iu);
    if (match === null) {
      continue;
    }
    const key = match[1]?.toLowerCase();
    const value = match[2]?.trim();
    if (value === undefined || value.length === 0) {
      continue;
    }
    if (key === "meaning") {
      fields.meaning = value;
    } else if (key === "pinyin") {
      fields.pinyin = value;
    } else if (key === "zhuyin") {
      fields.zhuyin = value;
    } else if (key === "characters") {
      fields.characters = value;
    }
  }
  return fields;
}

function chineseSideForLines(lines: readonly string[], language: string | undefined, structured: ChineseReviewFields): ChineseReviewSide {
  if (structured.meaning !== undefined && structured.pinyin === undefined && structured.zhuyin === undefined && structured.characters === undefined) {
    return "meaning";
  }
  if ((structured.pinyin !== undefined || structured.zhuyin !== undefined) && structured.meaning === undefined && structured.characters === undefined) {
    return "pronunciation";
  }
  if (structured.characters !== undefined && structured.meaning === undefined && structured.pinyin === undefined && structured.zhuyin === undefined) {
    return "characters";
  }
  if (language === "en") {
    return "meaning";
  }
  if (language === "zh-Latn-pinyin" || language === "zh-Bopo") {
    return "pronunciation";
  }
  if (language?.startsWith("zh-") === true || lines.some(containsHanCharacter)) {
    return "characters";
  }
  return "unknown";
}

function inferChineseFieldsForSide(lines: readonly string[], side: ChineseReviewSide): ChineseReviewFields {
  const text = lines.join("\n").trim();
  if (text.length === 0) {
    return {};
  }
  if (side === "meaning") {
    return { meaning: text };
  }
  if (side === "characters") {
    return { characters: text };
  }
  if (side === "pronunciation") {
    const structured = structuredChineseReviewFields(lines);
    if (structured.pinyin !== undefined || structured.zhuyin !== undefined) {
      return structured;
    }
    return containsZhuyinCharacter(text) ? { zhuyin: text } : { pinyin: text };
  }
  return {};
}

function mergeChineseReviewFields(...fields: readonly ChineseReviewFields[]): ChineseReviewFields {
  const merged: { meaning?: string; pinyin?: string; zhuyin?: string; characters?: string } = {};
  for (const field of fields) {
    merged.meaning ??= field.meaning;
    merged.pinyin ??= field.pinyin;
    merged.zhuyin ??= field.zhuyin;
    merged.characters ??= field.characters;
  }
  return merged;
}

function chinesePromptLinesForView(view: ChineseReviewView): readonly string[] {
  if (view.promptSide === "meaning" && view.fields.meaning !== undefined) {
    return [view.fields.meaning];
  }
  if (view.promptSide === "characters" && view.fields.characters !== undefined) {
    return [view.fields.characters];
  }
  if (view.promptSide === "pronunciation") {
    return [view.fields.pinyin, view.fields.zhuyin].filter((line): line is string => line !== undefined);
  }
  return [];
}

function chineseAnswerLinesForView(view: ChineseReviewView, fallbackAnswerLines: readonly string[]): readonly string[] {
  const lines: string[] = [];
  if (view.promptSide === "meaning") {
    pushChineseReviewLine(lines, "Pinyin", view.fields.pinyin);
    pushChineseReviewLine(lines, "Zhuyin", view.fields.zhuyin);
    pushChineseReviewLine(lines, "Characters", view.fields.characters);
  } else if (view.promptSide === "characters") {
    pushChineseReviewLine(lines, "Meaning", view.fields.meaning);
    pushChineseReviewLine(lines, "Pinyin", view.fields.pinyin);
    pushChineseReviewLine(lines, "Zhuyin", view.fields.zhuyin);
  } else if (view.promptSide === "pronunciation" && view.fields.meaning !== undefined && view.fields.characters !== undefined) {
    pushChineseReviewLine(lines, "Meaning", view.fields.meaning);
    pushChineseReviewLine(lines, "Characters", view.fields.characters);
  } else if (view.promptSide === "pronunciation") {
    pushChineseReviewLine(lines, "Pinyin", view.fields.pinyin);
    pushChineseReviewLine(lines, "Zhuyin", view.fields.zhuyin);
  }
  const prompt = chinesePromptLinesForView(view);
  const promptValues = new Set(prompt);
  const visibleLines = lines.filter((line) => !promptValues.has(line.replace(/^[^:]+:\s*/u, "")));
  return visibleLines.length === 0 ? fallbackAnswerLines : visibleLines;
}

function pushChineseReviewLine(lines: string[], label: string, value: string | undefined): void {
  if (value !== undefined && value.length > 0) {
    lines.push(`${label}: ${value}`);
  }
}

function isStructuredChineseReviewView(view: ChineseReviewView): boolean {
  return view.fields.meaning !== undefined && view.fields.characters !== undefined && (view.fields.pinyin !== undefined || view.fields.zhuyin !== undefined);
}

function hasAnyChineseReviewField(fields: ChineseReviewFields): boolean {
  return fields.meaning !== undefined || fields.pinyin !== undefined || fields.zhuyin !== undefined || fields.characters !== undefined;
}

function isCompoundChinesePronunciation(fields: ChineseReviewFields): boolean {
  const pinyinSyllables = fields.pinyin === undefined ? 0 : countPinyinSyllableTokens(fields.pinyin);
  const zhuyinSyllables = fields.zhuyin === undefined ? 0 : countZhuyinSyllableTokens(fields.zhuyin);
  const hanCharacters = fields.characters === undefined ? 0 : countHanCharacters(fields.characters);
  return pinyinSyllables >= 2 || zhuyinSyllables >= 2 || (hanCharacters >= 2 && pinyinSyllables >= 2);
}

function countPinyinSyllableTokens(value: string): number {
  return value
    .split(/[\s·・-]+/u)
    .map((token) => token.trim())
    .filter((token) => /[A-Za-zāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜüÜ]/u.test(token)).length;
}

function countZhuyinSyllableTokens(value: string): number {
  return value
    .split(/\s+/u)
    .map((token) => token.trim())
    .filter((token) => /[\u3100-\u312f\u31a0-\u31bf]/u.test(token)).length;
}

function countHanCharacters(value: string): number {
  return [...value].filter(containsHanCharacter).length;
}

function containsHanCharacter(value: string): boolean {
  return /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/u.test(value);
}

function containsZhuyinCharacter(value: string): boolean {
  return /[\u3100-\u312f\u31a0-\u31bf]/u.test(value);
}

function normalizeReviewTextLines(text: string): readonly string[] {
  const lines = text
    .replace(/\r\n?/gu, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t\f\v]+/gu, " ").trim())
    .filter((line) => line.length > 0);
  return lines.length === 0 ? [""] : lines;
}

function formatPromptControls(colorsEnabled: boolean): string {
  const reveal = colorsEnabled ? `${ansi.bold}${ansi.cyan}Enter/Space Reveal Answer${ansi.reset}` : "Enter/Space Reveal Answer";
  return reveal;
}

function formatRatingControls(colorsEnabled: boolean): string {
  if (!colorsEnabled) {
    return [
      "1 Again",
      "2 Hard",
      "3 Good",
      "4 Easy"
    ].join("   ");
  }
  return [
    `${ansi.red}1 Again${ansi.reset}`,
    `${ansi.yellow}2 Hard${ansi.reset}`,
    `${ansi.green}3 Good${ansi.reset}`,
    `${ansi.cyan}4 Easy${ansi.reset}`
  ].join("   ");
}

function formatLeaveReviewControl(colorsEnabled: boolean): string {
  return colorsEnabled ? `${ansi.cyan}Esc Leave Review${ansi.reset}` : "Esc Leave Review";
}

function prefixReviewCardLines(lines: readonly string[]): readonly string[] {
  return lines.map((line) => `  ${line}`);
}

function reviewCardColor(text: string, side: "prompt" | "answer", colorsEnabled: boolean): string {
  if (!colorsEnabled) {
    return text;
  }
  const color = side === "prompt" ? `${ansi.bold}${ansi.cyan}` : `${ansi.bold}${ansi.green}`;
  return `${color}${text}${ansi.reset}`;
}

function centerText(text: string, width: number): string {
  const normalized = text.length > width ? `${text.slice(0, Math.max(0, width - 3))}...` : text;
  const padding = Math.max(0, width - normalized.length);
  const left = Math.floor(padding / 2);
  const right = padding - left;
  return `${" ".repeat(left)}${normalized}${" ".repeat(right)}`;
}

function reviewRatingForKey(key: KeyPress): ReviewRating | null {
  const value = key.sequence ?? key.name ?? "";
  if (value === "1" || value === "a") {
    return "again";
  }
  if (value === "2" || value === "h") {
    return "hard";
  }
  if (value === "3" || value === "g") {
    return "good";
  }
  if (value === "4" || value === "e") {
    return "easy";
  }
  return null;
}

function currentReviewTimestamp(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/u, "Z");
}

function renderEmbeddedReviewStopped(node: LanguageTreeNode): string {
  return [
    `Review stopped: ${node.label}`,
    "",
    "Progress for cards already rated has been saved.",
    "Select the deck and press Enter or Space to continue later."
  ].join("\n");
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
  const rankDifference = readableContentRank(leftPath) - readableContentRank(rightPath);
  if (rankDifference !== 0) {
    return rankDifference;
  }
  const leftChapterOrder = readableContentChapterOrder(leftPath);
  const rightChapterOrder = readableContentChapterOrder(rightPath);
  if (leftChapterOrder !== undefined && rightChapterOrder !== undefined && leftChapterOrder !== rightChapterOrder) {
    return leftChapterOrder - rightChapterOrder;
  }
  return compareMenuLabels(leftPath, rightPath);
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

function readableContentChapterOrder(path: string): number | undefined {
  const grammarSummaryMatch = path.match(/\/chapter-0*(\d+)-0*(\d+)-grammar-(easy|hard)\/chapter\.md$/u);
  if (grammarSummaryMatch !== null) {
    const blockEnd = Number.parseInt(grammarSummaryMatch[2], 10);
    const summaryOffset = grammarSummaryMatch[3] === "easy" ? 0.45 : 0.46;
    return blockEnd + summaryOffset;
  }
  const match = path.match(/\/chapter-0*(\d+)[^/]*\/chapter\.md$/u);
  if (match === null) {
    return undefined;
  }
  return Number.parseInt(match[1], 10);
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
  if (/\/chapter-0*\d+-0*\d+-grammar-easy\/chapter\.md$/u.test(fallbackPath)) {
    return grammarEasyMenuLabel;
  }
  if (/\/chapter-0*\d+-0*\d+-grammar-hard\/chapter\.md$/u.test(fallbackPath)) {
    return grammarHardMenuLabel;
  }
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
const reviewBottomBarMarker = "[[WHACKSMACKER_REVIEW_BOTTOM_BAR]]";

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
  const rightPane = splitFixedBottomBar(rightPaneText);
  const bottomBarLines = rightPane.bottomBar === undefined ? [] : formatPaneText(rightPane.bottomBar, rightWidth, colorsEnabled);
  const scrollableHeight = Math.max(1, bodyHeight - bottomBarLines.length);
  const rightLines = formatPaneText(rightPane.body, rightWidth, colorsEnabled);
  const maxOffset = Math.max(0, rightLines.length - scrollableHeight);
  const offset = Math.min(Math.max(0, rightPaneOffset), maxOffset);
  const visibleRightLines = [
    ...rightLines.slice(offset, offset + scrollableHeight),
    ...Array.from({ length: Math.max(0, scrollableHeight - rightLines.slice(offset, offset + scrollableHeight).length) }, () => ""),
    ...bottomBarLines
  ];
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

  const scroll = rightLines.length > scrollableHeight ? `  Output ${offset + 1}-${Math.min(offset + scrollableHeight, rightLines.length)}/${rightLines.length}` : "";
  const footer = `Up/Down move  Enter open/start  Space install available  U uninstall  PgUp/PgDn scroll  Home/End jump  Escape collapse/back  q quit${scroll}`;
  lines.push(horizontal);
  lines.push(colorsEnabled ? `${ansi.green}${footer}${ansi.reset}` : footer);
  return lines.join("\n");
}

function splitFixedBottomBar(text: string): { readonly body: string; readonly bottomBar?: string } {
  const markerIndex = text.lastIndexOf(`\n${reviewBottomBarMarker}\n`);
  if (markerIndex < 0) {
    return { body: text };
  }
  return {
    body: text.slice(0, markerIndex),
    bottomBar: text.slice(markerIndex + reviewBottomBarMarker.length + 2)
  };
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
    return `${ansi.cyan}${plain}${ansi.reset}`;
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
  if (entry.node.kind === "uninstall") {
    return `${ansi.red}${plain}${ansi.reset}`;
  }
  return plain;
}

function formatPaneText(text: string, width: number, colorsEnabled: boolean): readonly string[] {
  const lines: string[] = [];
  let inCodeBlock = false;
  const rawLines = text.replace(/\t/gu, "  ").split("\n");
  for (let index = 0; index < rawLines.length; index += 1) {
    const rawLine = rawLines[index] ?? "";
    if (/^\s*```/u.test(rawLine)) {
      inCodeBlock = !inCodeBlock;
      lines.push(stylePaneLine("code", width, colorsEnabled));
      continue;
    }
    if (!inCodeBlock && isMarkdownTableLine(rawLine)) {
      const tableLines = [rawLine];
      while (index + 1 < rawLines.length && isMarkdownTableLine(rawLines[index + 1] ?? "")) {
        index += 1;
        tableLines.push(rawLines[index] ?? "");
      }
      lines.push(...formatMarkdownTable(tableLines, width, colorsEnabled));
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

function isMarkdownTableLine(line: string): boolean {
  const trimmed = line.trim();
  return trimmed.startsWith("|") && trimmed.endsWith("|") && trimmed.slice(1, -1).includes("|");
}

function formatMarkdownTable(rawLines: readonly string[], width: number, colorsEnabled: boolean): readonly string[] {
  const rows = rawLines.map((line) => line.trim().slice(1, -1).split("|").map((cell) => stripInlineMarkdown(cell.trim(), colorsEnabled)));
  const columnCount = Math.max(...rows.map((row) => row.length));
  const widths = Array.from({ length: columnCount }, (_, column) => Math.max(
    3,
    ...rows
      .filter((row) => !isMarkdownTableSeparatorRow(row))
      .map((row) => strippedLength(row[column] ?? ""))
  ));
  return rows.map((row) => {
    if (isMarkdownTableSeparatorRow(row)) {
      return truncateText(`| ${widths.map((cellWidth) => "-".repeat(cellWidth)).join(" | ")} |`, width);
    }
    const line = `| ${widths.map((cellWidth, column) => padRightDisplay(row[column] ?? "", cellWidth)).join(" | ")} |`;
    return truncateText(line, width);
  });
}

function isMarkdownTableSeparatorRow(row: readonly string[]): boolean {
  return row.every((cell) => /^:?-{3,}:?$/u.test(cell.trim()));
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
  return padRightDisplay(truncated, width);
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
  return displayWidth(text.replace(/\x1b\[[0-9;]*m/gu, ""));
}

function padRightDisplay(text: string, width: number): string {
  return `${text}${" ".repeat(Math.max(0, width - strippedLength(text)))}`;
}

function displayWidth(text: string): number {
  let width = 0;
  for (const character of [...text]) {
    width += isWideCharacter(character) ? 2 : 1;
  }
  return width;
}

function isWideCharacter(character: string): boolean {
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

function isUninstall(key: KeyPress): boolean {
  return key.name === "u" || key.sequence === "u" || key.sequence === "U";
}

function isKeepSavedData(key: KeyPress): boolean {
  return key.name === "k" || key.sequence === "k" || key.sequence === "K";
}

function isDeleteSavedData(key: KeyPress): boolean {
  return key.name === "d" || key.sequence === "d" || key.sequence === "D";
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
