import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { test } from "node:test";

import {
  parseChessArgs,
  renderChessCommand
} from "../dist/packages/chess/index.js";

test("chess command renders the starting board", () => {
  const rendered = renderChessCommand();

  assert.match(rendered, /^Chess/u);
  assert.match(rendered, /8 r n b q k b n r/u);
  assert.match(rendered, /1 R N B Q K B N R/u);
  assert.match(rendered, /Active side: White/u);
  assert.match(rendered, /whacksmacker chess e2e4 e7e5/u);
});

test("chess command lists legal moves from a square", () => {
  const rendered = renderChessCommand(parseChessArgs(["--legal", "e2"]));

  assert.match(rendered, /Legal moves from e2: e3 e4/u);
});

test("chess command applies UCI-style move input", () => {
  const rendered = renderChessCommand(parseChessArgs(["e2e4"]));

  assert.match(rendered, /e2e4: ok/u);
  assert.match(rendered, /4 \. \. \. \. P \. \. \./u);
  assert.match(rendered, /Active side: Black/u);
});

test("chess command rejects invalid move and square input", () => {
  assert.throws(() => parseChessArgs(["e2"]), /Invalid UCI move/);
  assert.throws(() => parseChessArgs(["--legal", "z9"]), /Invalid chess square/);
});

test("chess CLI runs without desktop UI or external services", async () => {
  const result = await runCli(["chess", "e2e4", "--legal", "e7"]);

  assert.equal(result.exitCode, 0);
  assert.equal(result.stderr, "");
  assert.match(result.stdout, /e2e4: ok/u);
  assert.match(result.stdout, /Legal moves from e7: e6 e5/u);
});

async function runCli(args) {
  const child = spawn(process.execPath, ["dist/main.js", ...args], { cwd: process.cwd(), stdio: ["ignore", "pipe", "pipe"] });
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
    child.on("error", reject);
    child.on("close", resolve);
  });
  return { exitCode, stdout, stderr };
}

