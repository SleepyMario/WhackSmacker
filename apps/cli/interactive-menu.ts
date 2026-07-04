import type { CliCommand, InMemoryCliCommandRegistry } from "../../packages/core";

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
  write(text: string): void;
  readKey(): Promise<KeyPress>;
  enter(): void;
  restore(): void;
}

export interface MenuItem {
  readonly label: string;
  readonly kind: "language" | "placeholder" | "back";
  readonly moduleId?: string;
}

export const whackSmackerLogo = String.raw`
__        ___    ____ _  ______  __  __    _    ____ _  _______ ____
\ \      / / \  / ___| |/ / ___||  \/  |  / \  / ___| |/ / ____|  _ \
 \ \ /\ / / _ \| |   | ' /\___ \| |\/| | / _ \| |   | ' /|  _| | |_) |
  \ V  V / ___ \ |___| . \ ___) | |  | |/ ___ \ |___| . \| |___|  _ <
   \_/\_/_/   \_\____|_|\_\____/|_|  |_/_/   \_\____|_|\_\_____|_| \_\

     This Thing Will Whack Some Smack Into Your Brains
`;

const mainMenuItems: readonly MenuItem[] = [
  { label: "Language", kind: "language", moduleId: "language" },
  { label: "Chess", kind: "placeholder", moduleId: "chess" },
  { label: "Geography", kind: "placeholder", moduleId: "geography" },
  { label: "Mathematics", kind: "placeholder", moduleId: "mathematics" }
];

const languageMenuItems: readonly MenuItem[] = [
  { label: "Status", kind: "language", moduleId: "language" },
  { label: "Decks", kind: "language", moduleId: "language" },
  { label: "Review", kind: "language", moduleId: "language" },
  { label: "Back", kind: "back" }
];

export function getMainMenuItems(): readonly MenuItem[] {
  return mainMenuItems;
}

export function getLanguageMenuItems(): readonly MenuItem[] {
  return languageMenuItems;
}

export function createNodeTerminal(): Terminal {
  const readline = require("node:readline");
  let rawModeWasEnabled = false;
  let active = false;

  return {
    get isInteractive() {
      return process.stdin.isTTY === true && process.stdout.isTTY === true;
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
      renderMenu(terminal, whackSmackerLogo, mainMenuItems, selection);
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

async function runLanguageMenu(registry: InMemoryCliCommandRegistry, terminal: Terminal): Promise<boolean> {
  let selection = 0;

  while (true) {
    renderMenu(terminal, `${whackSmackerLogo}\nLanguage\n`, languageMenuItems, selection);
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

    const quit = await runLanguageAction(registry, terminal, item.label);
    if (quit) {
      return true;
    }
  }
}

async function runLanguageAction(registry: InMemoryCliCommandRegistry, terminal: Terminal, label: string): Promise<boolean> {
  const commandPath = label === "Status" ? ["language", "status"] : label === "Decks" ? ["language", "decks"] : ["language", "review"];
  const command = registry.find(commandPath);

  if (command === null) {
    return showMessage(terminal, `Command is not registered: ${commandPath.join(" ")}`);
  }

  terminal.restore();

  try {
    if (label === "Review") {
      const deckName = await promptLine("Deck name: ");
      if (deckName.trim().length === 0) {
        console.error("Deck name is required.");
      } else {
        await command.run([deckName]);
      }
    } else {
      await command.run([]);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
  } finally {
    terminal.enter();
  }

  return showMessage(terminal, "Press Escape or Enter to return.");
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

async function showMessage(terminal: Terminal, message: string): Promise<boolean> {
  while (true) {
    terminal.write(`\x1b[2J\x1b[H${message}`);
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

function renderMenu(terminal: Terminal, heading: string, items: readonly MenuItem[], selection: number): void {
  const renderedItems = items
    .map((item, index) => `${index === selection ? "> " : "  "}${item.label}`)
    .join("\n");

  terminal.write(`\x1b[2J\x1b[H${heading}\n${renderedItems}\n\nUse ↑/↓, Enter, Escape, or q.`);
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
