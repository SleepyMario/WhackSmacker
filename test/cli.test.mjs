import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, readdir, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";

async function runCli(args, { input = "", env = {} } = {}) {
  const child = spawn(process.execPath, ["dist/main.js", ...args], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      ...env
    },
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

  if (input.length > 0) {
    child.stdin.end(input);
  }

  const exitCode = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`CLI timed out: ${args.join(" ")}`));
    }, 5000);

    child.on("error", reject);
    child.on("close", (code) => {
      clearTimeout(timeout);
      resolve(code);
    });
  });

  return { exitCode, stdout, stderr };
}

async function runInstalledName(executableName, args, options) {
  const directory = await mkdtemp(join(tmpdir(), "whacksmacker-bin-test-"));
  const executablePath = join(directory, executableName);

  try {
    await symlink(resolve("dist/main.js"), executablePath);
    return await runExecutable(executablePath, args, options);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

async function runExecutable(executablePath, args, { env = {} } = {}) {
  const child = spawn(executablePath, args, {
    cwd: process.cwd(),
    env: {
      ...process.env,
      ...env
    },
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
      reject(new Error(`CLI timed out: ${executablePath} ${args.join(" ")}`));
    }, 5000);

    child.on("error", reject);
    child.on("close", (code) => {
      clearTimeout(timeout);
      resolve(code);
    });
  });

  return { exitCode, stdout, stderr };
}

test("help prints native WhackSmacker usage", async () => {
  const result = await runCli(["--help"]);

  assert.equal(result.exitCode, 0);
  assert.match(result.stdout, /^WhackSmacker/);
  assert.match(result.stdout, /A modular terminal application/);
  assert.match(result.stdout, /whacksmacker language korean \[--file <path>\]/);
  assert.match(result.stdout, /whacksmacker language terms \[<group>\] \[--file <path>\]/);
  assert.match(result.stdout, /whacksmacker language terminology \[--search <text>\]/);
  assert.match(result.stdout, /whacksmacker review sources/);
  assert.match(result.stdout, /whacksmacker review due/);
  assert.match(result.stdout, /whacksmacker review show <package-id> <item-id>/);
  assert.match(result.stdout, /whacksmacker review answer <package-id> <item-id>/);
  assert.match(result.stdout, /whacksmacker review run --package <package-id> --source <path>/);
  assert.match(result.stdout, /whacksmacker module list/);
  assert.match(result.stdout, /whacksmacker module info <module-id>/);
  assert.match(result.stdout, /whacksmacker module build <module-id>/);
  assert.match(result.stdout, /whacksmacker chess \[e2e4 \.\.\.\] \[--legal <square>\]/);
  assert.match(result.stdout, /whacksmacker geography continents/);
  assert.match(result.stdout, /whacksmacker mathematics beginner-volume-one/);
  assert.match(result.stdout, /Languages\s+Installed language content packages/);
  assert.match(result.stdout, /Games\s+Chess native module/);
  assert.match(result.stdout, /Content\s+Downloadable content package management/);
  assert.doesNotMatch(result.stdout, /Anki|AnkiConnect|deck-name|Decks|language review/u);
  assert.equal(result.stderr, "");
});

test("help aliases and executable aliases produce equivalent substantive help", async () => {
  const results = [
    await runInstalledName("whacksmacker", ["--help"]),
    await runInstalledName("whacksmacker", ["-h"]),
    await runInstalledName("wsm", ["--help"]),
    await runInstalledName("wsm", ["-h"])
  ];

  for (const result of results) {
    assert.equal(result.exitCode, 0);
    assert.equal(result.stderr, "");
    assert.match(result.stdout, /Language commands:/);
    assert.match(result.stdout, /Native review commands:/);
  }

  assert.deepEqual(results.map((result) => result.stdout), [
    results[0].stdout,
    results[0].stdout,
    results[0].stdout,
    results[0].stdout
  ]);
});

test("help output has no ANSI escapes when NO_COLOR is set or output is non-TTY", async () => {
  const noColor = await runInstalledName("wsm", ["--help"], { env: { NO_COLOR: "1" } });
  const nonTty = await runCli(["--help"]);

  assert.doesNotMatch(noColor.stdout, /\x1b\[[0-9;]*m/);
  assert.doesNotMatch(nonTty.stdout, /\x1b\[[0-9;]*m/);
});

test("version aliases print package version", async () => {
  const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
  const results = [
    await runInstalledName("whacksmacker", ["--version"]),
    await runInstalledName("wsm", ["-v"])
  ];

  for (const result of results) {
    assert.equal(result.exitCode, 0);
    assert.equal(result.stdout, `${packageJson.version}\n`);
    assert.equal(result.stderr, "");
  }
});

test("unknown commands and removed Anki review shape fail clearly", async () => {
  const unknown = await runCli(["unknown"]);
  const legacyReview = await runCli(["review", "Default"]);
  const legacyDecks = await runCli(["decks"]);

  assert.equal(unknown.exitCode, 1);
  assert.match(unknown.stderr, /Unknown command: unknown/);
  assert.match(unknown.stderr, /--help/);
  assert.equal(legacyReview.exitCode, 1);
  assert.match(legacyReview.stderr, /Unknown command: review Default/);
  assert.match(legacyReview.stderr, /--help/);
  assert.equal(legacyDecks.exitCode, 1);
  assert.match(legacyDecks.stderr, /Unknown command: decks/);
});

test("geography continents runs without external services", async () => {
  const result = await runCli(["geography", "continents"], { input: "q\n" });

  assert.equal(result.exitCode, 0);
  assert.match(result.stdout, /Geography — Continents/);
  assert.match(result.stdout, /Question 1 of 6/);
  assert.match(result.stdout, /Cards reviewed: 0/);
  assert.equal(result.stderr, "");
});

test("module commands expose first-class built-in module metadata", async () => {
  const list = await runCli(["module", "list"]);
  const info = await runCli(["module", "info", "com.sleepymario.game.chess"]);
  const build = await runCli(["module", "build", "com.sleepymario.geography"]);

  assert.equal(list.exitCode, 0);
  assert.match(list.stdout, /com\.sleepymario\.game\.chess 0\.1\.0 Games native-module Chess/);
  assert.match(list.stdout, /com\.sleepymario\.geography 0\.1\.0 Geography built-in-module Continents/);
  assert.match(list.stdout, /com\.sleepymario\.mathematics 0\.1\.0 Mathematics built-in-module Beginner Mathematics/);
  assert.equal(list.stderr, "");

  assert.equal(info.exitCode, 0);
  assert.match(info.stdout, /Module ID: com\.sleepymario\.game\.chess/);
  assert.match(info.stdout, /Source kind: native-module/);
  assert.match(info.stdout, /Actions:/);
  assert.equal(info.stderr, "");

  assert.equal(build.exitCode, 0);
  assert.match(build.stdout, /Module ID: com\.sleepymario\.geography/);
  assert.match(build.stdout, /A downloadable module artifact builder is not implemented/);
  assert.equal(build.stderr, "");
});

test("language terminology renders the bundled glossary", async () => {
  const result = await runCli(["language", "terminology", "--search", "semivowel"]);

  assert.equal(result.exitCode, 0);
  assert.match(result.stdout, /Linguistic Terminology/);
  assert.match(result.stdout, /Technical glossary used across WhackSmacker language curricula/);
  assert.match(result.stdout, /## Semivowel/);
  assert.match(result.stdout, /ID: phonology\.semivowel/);
  assert.match(result.stdout, /Related terms:/);
  assert.equal(result.stderr, "");
});

test("language terminology searches Korean script and stable IDs", async () => {
  const batchim = await runCli(["language", "terminology", "--search", "받침"]);
  const id = await runCli(["language", "terminology", "--id", "korean.initial-ieung"]);

  assert.equal(batchim.exitCode, 0);
  assert.match(batchim.stdout, /## 받침/);
  assert.match(batchim.stdout, /ID: korean\.batchim/);
  assert.equal(id.exitCode, 0);
  assert.match(id.stdout, /## Initial ㅇ/);
  assert.match(id.stdout, /ID: korean\.initial-ieung/);
});

test("mathematics one-two-three generates a workbook without database or network dependencies", async () => {
  const directory = await mkdtemp(join(tmpdir(), "whacksmacker-math-cli-test-"));
  const outputPath = join(directory, "one-two-three-workbook.pdf");

  try {
    const result = await runCli(["mathematics", "one-two-three", "--output", outputPath, "--seed", "184726"]);

    assert.equal(result.exitCode, 0);
    assert.match(result.stdout, /Workbook created/);
    assert.match(result.stdout, /Curriculum ID: MATH-FOUNDATION-001/);
    assert.match(result.stdout, /Unit: One, Two, Three/);
    assert.match(result.stdout, /Unit introduction pages: 1/);
    assert.match(result.stdout, /Exercise pages: 50/);
    assert.match(result.stdout, /Exercises: 200/);
    assert.match(result.stdout, /Seed: 184726/);
    assert.match(result.stdout, new RegExp(escapeRegExp(`File: ${outputPath}`)));
    assert.equal(result.stderr, "");

    const file = await readFile(outputPath);
    assert.ok(file.length > 100_000);
    assert.deepEqual((await readdir(directory)).filter((name) => /\.db$/u.test(name)), []);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("mathematics unit commands generate Units 002 through 004", async () => {
  const cases = [
    ["four-and-five", "MATH-FOUNDATION-002", "Four and Five", 30, 120],
    ["one-to-five", "MATH-FOUNDATION-003", "One to Five", 50, 200],
    ["six-to-nine", "MATH-FOUNDATION-004", "Six, Seven, Eight, Nine", 60, 240]
  ];

  for (const [command, curriculumId, title, pages, exercises] of cases) {
    const directory = await mkdtemp(join(tmpdir(), `whacksmacker-${command}-cli-test-`));
    const outputPath = join(directory, `${command}.pdf`);

    try {
      const result = await runCli(["mathematics", command, "--output", outputPath, "--seed", "184726"]);

      assert.equal(result.exitCode, 0);
      assert.match(result.stdout, /Workbook created/);
      assert.match(result.stdout, new RegExp(`Curriculum ID: ${curriculumId}`));
      assert.match(result.stdout, new RegExp(`Unit: ${escapeRegExp(title)}`));
      assert.match(result.stdout, /Unit introduction pages: 1/);
      assert.match(result.stdout, new RegExp(`Exercise pages: ${pages}`));
      assert.match(result.stdout, new RegExp(`Exercises: ${exercises}`));
      assert.match(result.stdout, /Seed: 184726/);
      assert.match(result.stdout, new RegExp(escapeRegExp(`File: ${outputPath}`)));
      assert.equal(result.stderr, "");

      const file = await readFile(outputPath);
      assert.ok(file.length > 100_000);
      assert.deepEqual((await readdir(directory)).filter((name) => /\.db$/u.test(name)), []);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  }
});

test("wsm mathematics one-two-three supports the same arguments", async () => {
  const directory = await mkdtemp(join(tmpdir(), "wsm-math-cli-test-"));
  const outputPath = join(directory, "workbook.pdf");

  try {
    const result = await runInstalledName("wsm", ["mathematics", "one-two-three", "--output", outputPath, "--seed", "184726"]);

    assert.equal(result.exitCode, 0);
    assert.match(result.stdout, /Workbook created/);
    assert.match(result.stdout, /Seed: 184726/);
    assert.match(result.stdout, new RegExp(escapeRegExp(`File: ${outputPath}`)));
    assert.equal(result.stderr, "");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("mathematics beginner-volume-one generates the complete workbook", async () => {
  const directory = await mkdtemp(join(tmpdir(), "whacksmacker-math-volume-cli-test-"));
  const outputPath = join(directory, "beginner-volume-one.pdf");

  try {
    const result = await runCli(["mathematics", "beginner-volume-one", "--output", outputPath, "--seed", "184726"]);

    assert.equal(result.exitCode, 0);
    assert.match(result.stdout, /Workbook created/);
    assert.match(result.stdout, /Overall introduction pages: 1/);
    assert.match(result.stdout, /Unit introduction pages: 4/);
    assert.match(result.stdout, /Exercise pages: 190/);
    assert.match(result.stdout, /Exercises: 760/);
    assert.match(result.stdout, /Total PDF pages: 195/);
    assert.match(result.stdout, /Unit 1 One, Two, Three: 50 exercise pages, 200 exercises/);
    assert.match(result.stdout, /Unit 2 Four and Five: 30 exercise pages, 120 exercises/);
    assert.match(result.stdout, /Unit 3 One to Five: 50 exercise pages, 200 exercises/);
    assert.match(result.stdout, /Unit 4 Six, Seven, Eight, Nine: 60 exercise pages, 240 exercises/);
    assert.match(result.stdout, /Seed: 184726/);
    assert.match(result.stdout, new RegExp(escapeRegExp(`File: ${outputPath}`)));
    assert.equal(result.stderr, "");

    const file = await readFile(outputPath);
    assert.ok(file.length > 250_000);
    assert.deepEqual((await readdir(directory)).filter((name) => /\.db$/u.test(name)), []);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("wsm mathematics beginner-volume-one supports the same arguments", async () => {
  const directory = await mkdtemp(join(tmpdir(), "wsm-math-volume-cli-test-"));
  const outputPath = join(directory, "volume.pdf");

  try {
    const result = await runInstalledName("wsm", ["mathematics", "beginner-volume-one", "--output", outputPath, "--seed", "184726"]);

    assert.equal(result.exitCode, 0);
    assert.match(result.stdout, /Workbook created/);
    assert.match(result.stdout, /Exercise pages: 190/);
    assert.match(result.stdout, /Seed: 184726/);
    assert.match(result.stdout, new RegExp(escapeRegExp(`File: ${outputPath}`)));
    assert.equal(result.stderr, "");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("mathematics one-two-three does not silently overwrite an existing destination", async () => {
  const directory = await mkdtemp(join(tmpdir(), "whacksmacker-math-overwrite-test-"));
  const outputPath = join(directory, "workbook.pdf");

  try {
    const first = await runCli(["mathematics", "one-two-three", "--output", outputPath, "--seed", "1"]);
    const second = await runCli(["mathematics", "one-two-three", "--output", outputPath, "--seed", "1"]);

    assert.equal(first.exitCode, 0);
    assert.equal(second.exitCode, 1);
    assert.match(second.stderr, /Output file already exists/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("mathematics beginner-volume-one does not silently overwrite an existing destination", async () => {
  const directory = await mkdtemp(join(tmpdir(), "whacksmacker-math-volume-overwrite-test-"));
  const outputPath = join(directory, "workbook.pdf");

  try {
    const first = await runCli(["mathematics", "beginner-volume-one", "--output", outputPath, "--seed", "1"]);
    const second = await runCli(["mathematics", "beginner-volume-one", "--output", outputPath, "--seed", "1"]);

    assert.equal(first.exitCode, 0);
    assert.equal(second.exitCode, 1);
    assert.match(second.stderr, /Output file already exists/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
