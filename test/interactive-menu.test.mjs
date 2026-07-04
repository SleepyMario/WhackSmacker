import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

import { resolveCliCommand } from "../dist/apps/cli/main.js";
import {
  getLanguageMenuItems,
  getMainMenuItems,
  runInteractiveMenu,
  whackSmackerLogo
} from "../dist/apps/cli/interactive-menu.js";
import { InMemoryCliCommandRegistry } from "../dist/packages/core/index.js";

class FakeTerminal {
  constructor(keys, { interactive = true } = {}) {
    this.keys = [...keys];
    this.isInteractive = interactive;
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
    ["language", "status"],
    ["language", "decks"],
    ["language", "review"]
  ]) {
    registry.register({
      path,
      summary: path.join(" "),
      run: async (args) => {
        calls.push({ path: path.join(" "), args: [...args] });
        console.log(`${path.join(" ")} output`);
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

  assert.equal(resolveCliCommand(registry, ["status"])?.path.join(" "), "language status");
  assert.equal(resolveCliCommand(registry, ["language", "status"])?.path.join(" "), "language status");
});

test("main menu exposes all registered domain modules", () => {
  assert.deepEqual(
    getMainMenuItems().map((item) => item.label),
    ["Language", "Chess", "Geography", "Mathematics"]
  );
});

test("language menu exposes status, decks, review, and back", () => {
  assert.deepEqual(
    getLanguageMenuItems().map((item) => item.label),
    ["Status", "Decks", "Review", "Back"]
  );
});

test("placeholder modules expose no unfinished commands in the menu", () => {
  const placeholderItems = getMainMenuItems().filter((item) => item.kind === "placeholder");

  assert.deepEqual(
    placeholderItems.map((item) => item.label),
    ["Chess", "Geography", "Mathematics"]
  );
});

test("menu selection routes to the selected language command", async () => {
  const calls = [];
  const terminal = new FakeTerminal([
    key("return"),
    key("return"),
    key("return"),
    key("escape"),
    key("escape")
  ]);

  await runInteractiveMenu(createStubRegistry(calls), terminal);

  assert.deepEqual(calls, [{ path: "language status", args: [] }]);
  assert.match(terminal.output, /This Thing Will Whack Some Smack Into Your Brains/);
  assert.match(terminal.output, /Status\n\nlanguage status output\n\nPress Escape or Enter to return\./);
  assert.equal(terminal.restoreCount, 2);
});

test("language deck menu renders output from the registered deck command", async () => {
  const calls = [];
  const terminal = new FakeTerminal([
    key("return"),
    key("down"),
    key("return"),
    key("return"),
    key("escape"),
    key("escape")
  ]);

  await runInteractiveMenu(createStubRegistry(calls), terminal);

  assert.deepEqual(calls, [{ path: "language decks", args: [] }]);
  assert.match(terminal.output, /Decks\n\nlanguage decks output\n\nPress Escape or Enter to return\./);
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

test("ASCII logo is fixed and includes the WhackSmacker subtitle", () => {
  assert.match(whackSmackerLogo, /This Thing Will Whack Some Smack Into Your Brains/);
  assert.match(whackSmackerLogo, /\x1b\[[0-9;]+m/);
  assert.match(stripAnsi(whackSmackerLogo), /######  ##  ##/);
});

function stripAnsi(text) {
  return text.replace(/\x1b\[[0-9;]*m/g, "");
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
