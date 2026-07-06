import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

import { resolveCliCommand } from "../dist/apps/cli/main.js";
import {
  getBeginnerMathematicsMenuItems,
  getGeographyMenuItems,
  getLanguageMenuItems,
  getMainMenuItems,
  getMathematicsMenuItems,
  getOneTwoThreeMenuItems,
  renderWhackSmackerHeader,
  runInteractiveMenu,
  shouldUseTerminalColors,
  whackSmackerBanner,
  whackSmackerSubtitle
} from "../dist/apps/cli/interactive-menu.js";
import { InMemoryCliCommandRegistry } from "../dist/packages/core/index.js";

class FakeTerminal {
  constructor(keys, { interactive = true } = {}) {
    this.keys = [...keys];
    this.isInteractive = interactive;
    this.colorsEnabled = interactive;
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

function createStubRegistry(calls) {
  const registry = new InMemoryCliCommandRegistry();

  for (const path of [
    ["language", "terminology"],
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
        calls.push({ path: path.join(" "), args: [...args] });
        if (path[0] === "language") {
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
  assert.equal(resolveCliCommand(registry, ["language", "terminology"])?.path.join(" "), "language terminology");
});

test("main menu exposes all registered domain modules", () => {
  assert.deepEqual(
    getMainMenuItems().map((item) => item.label),
    ["Language", "Chess", "Geography", "Mathematics"]
  );
});

test("language menu exposes terminology and back", () => {
  assert.deepEqual(
    getLanguageMenuItems().map((item) => item.label),
    ["Linguistic Terminology", "Back"]
  );
});

test("only chess remains a placeholder in the menu", () => {
  const placeholderItems = getMainMenuItems().filter((item) => item.kind === "placeholder");

  assert.deepEqual(
    placeholderItems.map((item) => item.label),
    ["Chess"]
  );
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

test("menu selection routes to linguistic terminology", async () => {
  const calls = [];
  const terminal = new FakeTerminal([
    key("return"),
    key("return"),
    key("return"),
    key("escape"),
    key("escape")
  ]);

  await runInteractiveMenu(createStubRegistry(calls), terminal);

  assert.deepEqual(calls, [{ path: "language terminology", args: [] }]);
  assert.match(terminal.output, /WhackSmacker Will Whack That Smack Into Your Brains/);
  assert.match(terminal.output, /Linguistic Terminology\n\nlanguage terminology output\n\nPress Escape or Enter to return\./);
  assert.equal(terminal.restoreCount, 2);
});

test("language menu routes linguistic terminology to the registered command", async () => {
  const calls = [];
  const terminal = new FakeTerminal([
    key("return"),
    key("return"),
    key("return"),
    key("escape"),
    key("escape")
  ]);

  await runInteractiveMenu(createStubRegistry(calls), terminal);

  assert.deepEqual(calls, [{ path: "language terminology", args: [] }]);
  assert.match(terminal.output, /Linguistic Terminology\n\nlanguage terminology output\n\nPress Escape or Enter to return\./);
});

test("placeholder module screen returns without running a command", async () => {
  const calls = [];
  const terminal = new FakeTerminal([
    key("down"),
    key("return"),
    key("return"),
    key("escape")
  ]);

  await runInteractiveMenu(createStubRegistry(calls), terminal);

  assert.deepEqual(calls, []);
  assert.match(terminal.output, /Chess/);
  assert.match(terminal.output, /This module is not implemented yet/);
});

test("geography menu routes continents to the registered command", async () => {
  const calls = [];
  const terminal = new FakeTerminal([
    key("down"),
    key("down"),
    key("return"),
    key("return"),
    key("return"),
    key("escape"),
    key("escape")
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

test("main menu separates the subtitle from module choices with one blank line", async () => {
  const terminal = new FakeTerminal([key("q", { sequence: "q" })]);

  await runInteractiveMenu(createStubRegistry([]), terminal);

  assert.match(stripAnsi(terminal.output), /WhackSmacker Will Whack That Smack Into Your Brains\n\n> Language/);
});

function stripAnsi(text) {
  return text.replace(/\x1b\[[0-9;]*m/g, "");
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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
