import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, readdir, rm, symlink } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";

async function withMockAnki(responses, run) {
  const requests = [];
  const server = createServer(async (request, response) => {
    let body = "";
    request.setEncoding("utf8");
    for await (const chunk of request) {
      body += chunk;
    }

    requests.push(JSON.parse(body));
    const next = responses.shift();
    assert.ok(next, `unexpected request: ${body}`);
    response.writeHead(next.statusCode ?? 200, { "content-type": next.contentType ?? "application/json" });
    response.end(typeof next.body === "string" ? next.body : JSON.stringify(next.body));
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));

  try {
    const address = server.address();
    assert.equal(typeof address, "object");
    await run(`http://127.0.0.1:${address.port}`, requests);
    assert.deepEqual(responses, []);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error === undefined ? resolve() : reject(error)));
    });
  }
}

async function runCli(args, { endpoint, input = "", waitForStdout, signal } = {}) {
  const child = spawn(process.execPath, ["dist/main.js", ...args], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      ANKICONNECT_URL: endpoint ?? "http://127.0.0.1:1"
    },
    stdio: ["pipe", "pipe", "pipe"]
  });

  let stdout = "";
  let stderr = "";
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => {
    stdout += chunk;
    if (waitForStdout !== undefined && stdout.includes(waitForStdout) && signal !== undefined) {
      setTimeout(() => child.kill(signal), 20);
    }
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

async function runExecutable(executablePath, args, { endpoint, env = {} } = {}) {
  const child = spawn(executablePath, args, {
    cwd: process.cwd(),
    env: {
      ...process.env,
      ...env,
      ANKICONNECT_URL: endpoint ?? "http://127.0.0.1:1"
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

test("status reports reachable AnkiConnect", async () => {
  await withMockAnki([{ body: { result: 6, error: null } }], async (endpoint, requests) => {
    const result = await runCli(["status"], { endpoint });

    assert.equal(result.exitCode, 0);
    assert.match(result.stdout, /AnkiConnect is available/);
    assert.match(result.stdout, /API version: 6/);
    assert.equal(result.stderr, "");
    assert.equal(requests[0].action, "version");
  });
});

test("language status reports reachable AnkiConnect", async () => {
  await withMockAnki([{ body: { result: 6, error: null } }], async (endpoint, requests) => {
    const result = await runCli(["language", "status"], { endpoint });

    assert.equal(result.exitCode, 0);
    assert.match(result.stdout, /AnkiConnect is available/);
    assert.match(result.stdout, /API version: 6/);
    assert.equal(result.stderr, "");
    assert.equal(requests[0].action, "version");
  });
});

test("help prints concise WhackSmacker usage", async () => {
  const result = await runCli(["--help"]);

  assert.equal(result.exitCode, 0);
  assert.match(result.stdout, /^WhackSmacker/);
  assert.match(result.stdout, /A modular terminal application/);
  assert.match(result.stdout, /wsm$/m);
  assert.match(result.stdout, /whacksmacker$/m);
  assert.match(result.stdout, /wsm <command>/);
  assert.match(result.stdout, /whacksmacker <command>/);
  assert.match(result.stdout, /whacksmacker status/);
  assert.match(result.stdout, /whacksmacker decks/);
  assert.match(result.stdout, /whacksmacker review <deck-name>/);
  assert.match(result.stdout, /whacksmacker language review <deck-name>/);
  assert.match(result.stdout, /whacksmacker language terminology \[--search <text>\]/);
  assert.match(result.stdout, /wsm language review <deck-name>/);
  assert.match(result.stdout, /wsm language terminology \[--search <text>\]/);
  assert.match(result.stdout, /whacksmacker geography continents/);
  assert.match(result.stdout, /wsm geography continents/);
  assert.match(result.stdout, /Six-continent terminal map review/);
  assert.match(result.stdout, /whacksmacker mathematics beginner-volume-one/);
  assert.match(result.stdout, /wsm mathematics beginner-volume-one/);
  assert.match(result.stdout, /whacksmacker mathematics one-two-three/);
  assert.match(result.stdout, /wsm mathematics one-two-three/);
  assert.match(result.stdout, /whacksmacker mathematics four-and-five/);
  assert.match(result.stdout, /wsm mathematics four-and-five/);
  assert.match(result.stdout, /whacksmacker mathematics one-to-five/);
  assert.match(result.stdout, /wsm mathematics one-to-five/);
  assert.match(result.stdout, /whacksmacker mathematics six-to-nine/);
  assert.match(result.stdout, /wsm mathematics six-to-nine/);
  assert.match(result.stdout, /Generate the complete beginner mathematics Volume 1 workbook/);
  assert.match(result.stdout, /Generate the standalone Unit 1 introductory counting workbook/);
  assert.match(result.stdout, /Generate the standalone Unit 4 six through nine workbook/);
  assert.match(result.stdout, /--output/);
  assert.match(result.stdout, /--seed/);
  assert.match(result.stdout, /Default output filename: \.\/beginner-mathematics-volume-one\.pdf/);
  assert.match(result.stdout, /Default output filename: \.\/one-two-three-workbook\.pdf/);
  assert.match(result.stdout, /190 exercise pages, and 760 exercises/);
  assert.match(result.stdout, /The workbook contains 200 exercises/);
  assert.match(result.stdout, /No database or network connection is used/);
  assert.match(result.stdout, /Language\s+AnkiConnect review and linguistic terminology/);
  assert.match(result.stdout, /Chess\s+Placeholder/);
  assert.match(result.stdout, /Geography\s+Continents review available/);
  assert.match(result.stdout, /Mathematics\s+Beginner mathematics workbook generators/);
  assert.match(result.stdout, /Up\/Down arrows\s+Move selection/);
  assert.match(result.stdout, /Ctrl-C\s+Exit/);
  assert.match(result.stdout, /Enter or Space\s+Reveal the answer/);
  assert.match(result.stdout, /1\s+Again/);
  assert.match(result.stdout, /4\s+Easy/);
  assert.match(result.stdout, /Anki must be running/);
  assert.match(result.stdout, /http:\/\/127\.0\.0\.1:8765/);
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
    assert.match(result.stdout, /Legacy language commands:/);
    assert.match(result.stdout, /Domain-prefixed language commands:/);
  }

  assert.deepEqual(results.map((result) => result.stdout), [
    results[0].stdout,
    results[0].stdout,
    results[0].stdout,
    results[0].stdout
  ]);
});

test("help does not contact AnkiConnect and works without an interactive terminal", async () => {
  await withMockAnki([], async (endpoint, requests) => {
    const result = await runCli(["--help"], { endpoint });

    assert.equal(result.exitCode, 0);
    assert.equal(result.stderr, "");
    assert.deepEqual(requests, []);
  });
});

test("help output has no ANSI escapes when NO_COLOR is set or output is non-TTY", async () => {
  const noColor = await runInstalledName("wsm", ["--help"], { env: { NO_COLOR: "1" } });
  const nonTty = await runCli(["--help"]);

  assert.doesNotMatch(noColor.stdout, /\x1b\[[0-9;]*m/);
  assert.doesNotMatch(nonTty.stdout, /\x1b\[[0-9;]*m/);
});

test("version aliases print package version without contacting AnkiConnect", async () => {
  const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));

  await withMockAnki([], async (endpoint, requests) => {
    const results = [
      await runInstalledName("whacksmacker", ["--version"], { endpoint }),
      await runInstalledName("wsm", ["-v"], { endpoint })
    ];

    for (const result of results) {
      assert.equal(result.exitCode, 0);
      assert.equal(result.stdout, `${packageJson.version}\n`);
      assert.equal(result.stderr, "");
    }

    assert.deepEqual(requests, []);
  });
});

test("unknown commands print usage as a failure", async () => {
  const result = await runCli(["unknown"]);

  assert.equal(result.exitCode, 1);
  assert.equal(result.stdout, "");
  assert.match(result.stderr, /Unknown command: unknown/);
  assert.match(result.stderr, /--help/);
});

test("geography continents runs without contacting AnkiConnect", async () => {
  await withMockAnki([], async (endpoint, requests) => {
    const result = await runCli(["geography", "continents"], { endpoint, input: "q\n" });

    assert.equal(result.exitCode, 0);
    assert.match(result.stdout, /Geography — Continents/);
    assert.match(result.stdout, /Question 1 of 6/);
    assert.match(result.stdout, /Cards reviewed: 0/);
    assert.equal(result.stderr, "");
    assert.deepEqual(requests, []);
  });
});

test("language terminology renders the bundled glossary without contacting AnkiConnect", async () => {
  await withMockAnki([], async (endpoint, requests) => {
    const result = await runCli(["language", "terminology", "--search", "semivowel"], { endpoint });

    assert.equal(result.exitCode, 0);
    assert.match(result.stdout, /Linguistic Terminology/);
    assert.match(result.stdout, /Technical glossary used across WhackSmacker language curricula/);
    assert.match(result.stdout, /## Semivowel/);
    assert.match(result.stdout, /ID: phonology\.semivowel/);
    assert.match(result.stdout, /Related terms:/);
    assert.equal(result.stderr, "");
    assert.deepEqual(requests, []);
  });
});

test("language terminology searches Korean script and stable IDs", async () => {
  await withMockAnki([], async (endpoint, requests) => {
    const batchim = await runCli(["language", "terminology", "--search", "받침"], { endpoint });
    const id = await runCli(["language", "terminology", "--id", "korean.initial-ieung"], { endpoint });

    assert.equal(batchim.exitCode, 0);
    assert.match(batchim.stdout, /## 받침/);
    assert.match(batchim.stdout, /ID: korean\.batchim/);
    assert.equal(id.exitCode, 0);
    assert.match(id.stdout, /## Initial ㅇ/);
    assert.match(id.stdout, /ID: korean\.initial-ieung/);
    assert.deepEqual(requests, []);
  });
});

test("mathematics one-two-three generates a workbook without contacting AnkiConnect", async () => {
  const directory = await mkdtemp(join(tmpdir(), "whacksmacker-math-cli-test-"));
  const outputPath = join(directory, "one-two-three-workbook.pdf");

  try {
    await withMockAnki([], async (endpoint, requests) => {
      const result = await runCli(["mathematics", "one-two-three", "--output", outputPath, "--seed", "184726"], { endpoint });

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
      assert.deepEqual(requests, []);

      const file = await readFile(outputPath);
      assert.ok(file.length > 100_000);
      assert.deepEqual((await readdir(directory)).filter((name) => /\.db$/u.test(name)), []);
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("mathematics unit commands generate Units 002 through 004 without contacting AnkiConnect", async () => {
  const cases = [
    ["four-and-five", "MATH-FOUNDATION-002", "Four and Five", 30, 120],
    ["one-to-five", "MATH-FOUNDATION-003", "One to Five", 50, 200],
    ["six-to-nine", "MATH-FOUNDATION-004", "Six, Seven, Eight, Nine", 60, 240]
  ];

  for (const [command, curriculumId, title, pages, exercises] of cases) {
    const directory = await mkdtemp(join(tmpdir(), `whacksmacker-${command}-cli-test-`));
    const outputPath = join(directory, `${command}.pdf`);

    try {
      await withMockAnki([], async (endpoint, requests) => {
        const result = await runCli(["mathematics", command, "--output", outputPath, "--seed", "184726"], { endpoint });

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
        assert.deepEqual(requests, []);

        const file = await readFile(outputPath);
        assert.ok(file.length > 100_000);
        assert.deepEqual((await readdir(directory)).filter((name) => /\.db$/u.test(name)), []);
      });
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

test("mathematics beginner-volume-one generates the complete workbook without contacting AnkiConnect", async () => {
  const directory = await mkdtemp(join(tmpdir(), "whacksmacker-math-volume-cli-test-"));
  const outputPath = join(directory, "beginner-volume-one.pdf");

  try {
    await withMockAnki([], async (endpoint, requests) => {
      const result = await runCli(["mathematics", "beginner-volume-one", "--output", outputPath, "--seed", "184726"], { endpoint });

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
      assert.deepEqual(requests, []);

      const file = await readFile(outputPath);
      assert.ok(file.length > 250_000);
      assert.deepEqual((await readdir(directory)).filter((name) => /\.db$/u.test(name)), []);
    });
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

test("decks lists sorted deck names", async () => {
  await withMockAnki(
    [{ body: { result: ["Languages::Japanese", "Default"], error: null } }],
    async (endpoint) => {
      const result = await runCli(["decks"], { endpoint });

      assert.equal(result.exitCode, 0);
      assert.equal(result.stdout, "Default\nLanguages::Japanese\n");
      assert.equal(result.stderr, "");
    }
  );
});

test("language decks lists sorted deck names", async () => {
  await withMockAnki(
    [{ body: { result: ["Languages::Japanese", "Default"], error: null } }],
    async (endpoint) => {
      const result = await runCli(["language", "decks"], { endpoint });

      assert.equal(result.exitCode, 0);
      assert.equal(result.stdout, "Default\nLanguages::Japanese\n");
      assert.equal(result.stderr, "");
    }
  );
});

test("connection failures are reported separately from API errors", async () => {
  const result = await runCli(["status"]);

  assert.equal(result.exitCode, 1);
  assert.match(result.stderr, /Unable to reach AnkiConnect/);
  assert.match(result.stderr, /Anki must be running/);
});

test("api errors are reported as AnkiConnect API errors", async () => {
  await withMockAnki([{ body: { result: null, error: "deck was not found" } }], async (endpoint) => {
    const result = await runCli(["decks"], { endpoint });

    assert.equal(result.exitCode, 1);
    assert.match(result.stderr, /AnkiConnect API error: deck was not found/);
    assert.doesNotMatch(result.stderr, /Unable to reach/);
  });
});

test("malformed responses exit nonzero with a clear message", async () => {
  await withMockAnki([{ body: { ok: true } }], async (endpoint) => {
    const result = await runCli(["status"], { endpoint });

    assert.equal(result.exitCode, 1);
    assert.match(result.stderr, /Malformed AnkiConnect response/);
  });
});

test("review handles an empty queue", async () => {
  await withMockAnki(
    [
      { body: { result: true, error: null } },
      { body: { result: null, error: null } }
    ],
    async (endpoint) => {
      const result = await runCli(["review", "Default"], { endpoint });

      assert.equal(result.exitCode, 0);
      assert.match(result.stdout, /No cards are currently available/);
      assert.equal(result.stderr, "");
    }
  );
});

test("review progresses through a card and completes", async () => {
  const card = {
    cardId: 1,
    deckName: "Default",
    question: "<style>.card { font-family: PMingLiU; }</style><p>Front</p>",
    answer: "<div>Back</div>",
    buttons: [1, 3],
    nextReviews: ["1m", "10m"]
  };

  await withMockAnki(
    [
      { body: { result: true, error: null } },
      { body: { result: card, error: null } },
      { body: { result: true, error: null } },
      { body: { result: true, error: null } },
      { body: { result: null, error: null } }
    ],
    async (endpoint, requests) => {
      const result = await runCli(["review", "Default"], { endpoint, input: "\n9\n3\n" });

      assert.equal(result.exitCode, 0);
      assert.match(result.stdout, /Deck: Default/);
      assert.match(result.stdout, /Question\n\nFront/);
      assert.match(result.stdout, /Answer\n\nBack/);
      assert.match(result.stdout, /Front/);
      assert.match(result.stdout, /Back/);
      assert.match(result.stdout, /1 Again — 1m/);
      assert.match(result.stdout, /3 Good — 10m/);
      assert.match(result.stdout, /\x1b\[90m1 Again — 1m\x1b\[0m/);
      assert.match(result.stdout, /\x1b\[34m3 Good — 10m\x1b\[0m/);
      assert.match(result.stdout, /\x1b\[34mChoose a rating: \x1b\[0m/);
      assert.doesNotMatch(result.stdout, /2 Hard/);
      assert.doesNotMatch(result.stdout, /4 Easy/);
      assert.doesNotMatch(result.stdout, /font-family|PMingLiU|<style>|<\/div>/u);
      assert.match(result.stdout, /Invalid rating\. Choose one of: 1, 3/);
      assert.match(result.stdout, /Cards answered: 1/);
      assert.deepEqual(
        requests.map((request) => request.action),
        ["guiDeckReview", "guiCurrentCard", "guiShowAnswer", "guiAnswerCard", "guiCurrentCard"]
      );
      assert.deepEqual(requests[3].params, { ease: 3 });
    }
  );
});

test("review reveals the answer with Space", async () => {
  const card = {
    cardId: 1,
    deckName: "Default",
    question: "<p>日本語</p>",
    answer: "<p>Japanese language</p>",
    buttons: [3],
    nextReviews: ["10m"]
  };

  await withMockAnki(
    [
      { body: { result: true, error: null } },
      { body: { result: card, error: null } },
      { body: { result: true, error: null } },
      { body: { result: true, error: null } },
      { body: { result: null, error: null } }
    ],
    async (endpoint, requests) => {
      const result = await runCli(["review", "Default"], { endpoint, input: " 3\n" });

      assert.equal(result.exitCode, 0);
      assert.match(result.stdout, /Question\n\n日本語/);
      assert.match(result.stdout, /Press Enter or Space to reveal the answer/);
      assert.match(result.stdout, /Answer\n\nJapanese language/);
      assert.deepEqual(requests[3].params, { ease: 3 });
    }
  );
});

test("language review progresses through a card and completes", async () => {
  const card = {
    cardId: 1,
    deckName: "Default",
    question: "Front",
    answer: "Back",
    buttons: [1, 3],
    nextReviews: ["1m", "10m"]
  };

  await withMockAnki(
    [
      { body: { result: true, error: null } },
      { body: { result: card, error: null } },
      { body: { result: true, error: null } },
      { body: { result: true, error: null } },
      { body: { result: null, error: null } }
    ],
    async (endpoint, requests) => {
      const result = await runCli(["language", "review", "Default"], { endpoint, input: "\n3\n" });

      assert.equal(result.exitCode, 0);
      assert.match(result.stdout, /Deck: Default/);
      assert.match(result.stdout, /Question\n\nFront/);
      assert.match(result.stdout, /Answer\n\nBack/);
      assert.match(result.stdout, /Cards answered: 1/);
      assert.deepEqual(
        requests.map((request) => request.action),
        ["guiDeckReview", "guiCurrentCard", "guiShowAnswer", "guiAnswerCard", "guiCurrentCard"]
      );
      assert.deepEqual(requests[3].params, { ease: 3 });
    }
  );
});

test("review renders reverse cards exactly as Anki supplies them", async () => {
  const card = {
    cardId: 2,
    deckName: "Default",
    question: "<p>Japanese language</p>",
    answer: "<p>日本語</p>",
    buttons: [1, 2, 3, 4],
    nextReviews: ["1m", "6m", "10m", "4d"]
  };

  await withMockAnki(
    [
      { body: { result: true, error: null } },
      { body: { result: card, error: null } },
      { body: { result: true, error: null } },
      { body: { result: true, error: null } },
      { body: { result: null, error: null } }
    ],
    async (endpoint) => {
      const result = await runCli(["review", "Default"], { endpoint, input: "\n4\n" });

      assert.equal(result.exitCode, 0);
      assert.match(result.stdout, /Question\n\nJapanese language/);
      assert.match(result.stdout, /Answer\n\n日本語/);
      assert.match(result.stdout, /4 Easy — 4d/);
      assert.match(result.stdout, /\x1b\[31m2 Hard — 6m\x1b\[0m/);
      assert.match(result.stdout, /\x1b\[32m4 Easy — 4d\x1b\[0m/);
    }
  );
});

test("review quits without answering when requested before reveal", async () => {
  const card = {
    cardId: 1,
    deckName: "Default",
    question: "Front",
    answer: "Back",
    buttons: [1, 2, 3, 4],
    nextReviews: ["1m", "5m", "10m", "4d"]
  };

  await withMockAnki(
    [
      { body: { result: true, error: null } },
      { body: { result: card, error: null } }
    ],
    async (endpoint, requests) => {
      const result = await runCli(["review", "Default"], { endpoint, input: "q\n" });

      assert.equal(result.exitCode, 0);
      assert.match(result.stdout, /Review stopped/);
      assert.match(result.stdout, /Cards answered: 0/);
      assert.deepEqual(
        requests.map((request) => request.action),
        ["guiDeckReview", "guiCurrentCard"]
      );
    }
  );
});

test("review quits without answering at the rating stage", async () => {
  const card = {
    cardId: 1,
    deckName: "Default",
    question: "Front",
    answer: "Back",
    buttons: [1, 2, 3, 4],
    nextReviews: ["1m", "5m", "10m", "4d"]
  };

  await withMockAnki(
    [
      { body: { result: true, error: null } },
      { body: { result: card, error: null } },
      { body: { result: true, error: null } }
    ],
    async (endpoint, requests) => {
      const result = await runCli(["review", "Default"], { endpoint, input: "\nq\n" });

      assert.equal(result.exitCode, 0);
      assert.match(result.stdout, /Answer\n\nBack/);
      assert.match(result.stdout, /Review stopped/);
      assert.match(result.stdout, /Cards answered: 0/);
      assert.deepEqual(
        requests.map((request) => request.action),
        ["guiDeckReview", "guiCurrentCard", "guiShowAnswer"]
      );
    }
  );
});

test("review reports inactive or unavailable decks", async () => {
  await withMockAnki([{ body: { result: false, error: null } }], async (endpoint) => {
    const result = await runCli(["review", "Missing"], { endpoint });

    assert.equal(result.exitCode, 1);
    assert.match(result.stderr, /Unable to start review for deck: Missing/);
  });
});

test("invalid deck names are rejected before contacting AnkiConnect", async () => {
  const result = await runCli(["review", "\n"]);

  assert.equal(result.exitCode, 1);
  assert.match(result.stderr, /Deck name must be a non-empty string/);
});

test("SIGINT interrupts review with exit code 130", async () => {
  const card = {
    cardId: 1,
    deckName: "Default",
    question: "Front",
    answer: "Back",
    buttons: [1, 2, 3, 4],
    nextReviews: ["1m", "5m", "10m", "4d"]
  };

  await withMockAnki(
    [
      { body: { result: true, error: null } },
      { body: { result: card, error: null } }
    ],
    async (endpoint) => {
      const result = await runCli(["review", "Default"], {
        endpoint,
        waitForStdout: "Press Enter or Space to reveal",
        signal: "SIGINT"
      });

      assert.equal(result.exitCode, 130);
      assert.match(result.stdout, /Review interrupted/);
    }
  );
});

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
