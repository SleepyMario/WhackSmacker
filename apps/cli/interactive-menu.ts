import type { CliCommand, InMemoryCliCommandRegistry } from "../../packages/core";
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
  readonly kind: "language" | "chess" | "geography" | "mathematics" | "placeholder" | "back";
  readonly moduleId?: string;
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
  { label: "Korean", kind: "language", moduleId: "language" },
  { label: "Linguistic Terms", kind: "language", moduleId: "language" },
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

export async function runInteractiveMenu(registry: InMemoryCliCommandRegistry, terminal = createNodeTerminal()): Promise<void> {
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
    let selection = 0;

    while (!interrupted) {
      renderMenu(terminal, renderWhackSmackerHeader(terminal.colorsEnabled), mainMenuItems, selection);
      const key = await terminal.readKey();

      if (isCtrlC(key)) {
        process.exitCode = 130;
        return;
      }

      if (isQuit(key) || isEscape(key)) {
        return;
      }

      if (isUp(key)) {
        selection = wrapSelection(selection - 1, mainMenuItems.length);
        continue;
      }

      if (isDown(key)) {
        selection = wrapSelection(selection + 1, mainMenuItems.length);
        continue;
      }

      if (isEnter(key)) {
        const item = mainMenuItems[selection];
        if (item.kind === "language") {
          const quit = await runLanguageMenu(registry, terminal);
          if (quit) {
            return;
          }
        } else if (item.kind === "geography") {
          const quit = await runGeographyMenu(registry, terminal);
          if (quit) {
            return;
          }
        } else if (item.kind === "chess") {
          const quit = await runChessAction(registry, terminal);
          if (quit) {
            return;
          }
        } else if (item.kind === "mathematics") {
          const quit = await runMathematicsMenu(registry, terminal);
          if (quit) {
            return;
          }
        } else {
          const quit = await runPlaceholderScreen(terminal, item.label);
          if (quit) {
            return;
          }
        }
      }
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

async function runLanguageMenu(registry: InMemoryCliCommandRegistry, terminal: Terminal): Promise<boolean> {
  let selection = 0;

  while (true) {
    renderMenu(terminal, `${renderWhackSmackerHeader(terminal.colorsEnabled)}\nLanguage\n`, languageMenuItems, selection);
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
      selection = wrapSelection(selection - 1, languageMenuItems.length);
      continue;
    }

    if (isDown(key)) {
      selection = wrapSelection(selection + 1, languageMenuItems.length);
      continue;
    }

    if (!isEnter(key)) {
      continue;
    }

    const item = languageMenuItems[selection];
    if (item.kind === "back") {
      return false;
    }

    const quit = item.label === "Linguistic Terms"
      ? await runLinguisticTermsMenu(registry, terminal)
      : await runLanguageAction(registry, terminal, item.label);
    if (quit) {
      return true;
    }
  }
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
