import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { test } from "node:test";

import { getContinentReviewCards } from "../dist/packages/geography/continent-review.js";

async function runReview(input, env = {}) {
  const script = "const { runContinentReview } = require('./dist/packages/geography/continent-review.js'); runContinentReview({ width: 48, height: 14 }).catch((error) => { console.error(error.message); process.exitCode = 1; });";
  const child = spawn(process.execPath, ["-e", script], {
    cwd: process.cwd(),
    env: { ...process.env, ...env },
    stdio: ["pipe", "pipe", "pipe"]
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
  child.stdin.end(input);

  const exitCode = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("geography review timed out"));
    }, 5000);

    child.on("error", reject);
    child.on("close", (code) => {
      clearTimeout(timeout);
      resolve(code);
    });
  });

  return { exitCode, stdout, stderr };
}

test("continent review cards include all six continents exactly once", () => {
  assert.deepEqual(
    getContinentReviewCards().map((card) => card.answer),
    ["Africa", "The Americas", "Asia", "Europe", "Oceania", "Antarctica"]
  );
});

test("question hides answer name before reveal and answer shows it after Enter", async () => {
  const result = await runReview("\n1\nq\n");
  const [question, answer] = result.stdout.split("Answer");

  assert.equal(result.exitCode, 0);
  assert.match(question, /Geography — Continents/);
  assert.match(question, /Question 1 of 6/);
  assert.match(question, /Which continent is highlighted/);
  assert.doesNotMatch(question, /Africa/);
  assert.match(answer, /Africa/);
});

test("Space reveals the answer", async () => {
  const result = await runReview(" 2\nq\n");

  assert.equal(result.exitCode, 0);
  assert.match(result.stdout, /Answer\n\nAfrica/);
  assert.match(result.stdout, /Hard count: 1/);
});

test("q quits before reveal without reviewing a card", async () => {
  const result = await runReview("q\n");

  assert.equal(result.exitCode, 0);
  assert.match(result.stdout, /Review stopped/);
  assert.match(result.stdout, /Cards reviewed: 0/);
});

test("q quits during rating selection without counting the card", async () => {
  const result = await runReview("\nq\n");

  assert.equal(result.exitCode, 0);
  assert.match(result.stdout, /Answer\n\nAfrica/);
  assert.match(result.stdout, /Cards reviewed: 0/);
});

test("all four ratings work and completion summary counts them", async () => {
  const result = await runReview("\n1\n\n2\n\n3\n\n4\n\n4\n\n3\n");

  assert.equal(result.exitCode, 0);
  assert.match(result.stdout, /Cards reviewed: 6/);
  assert.match(result.stdout, /Again count: 1/);
  assert.match(result.stdout, /Hard count: 1/);
  assert.match(result.stdout, /Good count: 2/);
  assert.match(result.stdout, /Easy count: 2/);
});

test("invalid ratings are rejected", async () => {
  const result = await runReview("\n9\n1\nq\n");

  assert.equal(result.exitCode, 0);
  assert.match(result.stdout, /Invalid rating\. Choose one of: 1, 2, 3, 4/);
  assert.match(result.stdout, /Again count: 1/);
});

test("review output omits ANSI escapes for NO_COLOR and pipe output", async () => {
  const noColor = await runReview("q\n", { NO_COLOR: "1" });
  const piped = await runReview("q\n");

  assert.doesNotMatch(noColor.stdout, /\x1b\[[0-9;]*m/);
  assert.doesNotMatch(piped.stdout, /\x1b\[[0-9;]*m/);
});
