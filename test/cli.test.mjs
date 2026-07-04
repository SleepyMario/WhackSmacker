import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
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
      const result = await runCli(["review", "Default"], { endpoint, input: "\n9\n3\n" });

      assert.equal(result.exitCode, 0);
      assert.match(result.stdout, /Deck: Default/);
      assert.match(result.stdout, /Front/);
      assert.match(result.stdout, /Back/);
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
      assert.match(result.stdout, /Cards answered: 1/);
      assert.deepEqual(
        requests.map((request) => request.action),
        ["guiDeckReview", "guiCurrentCard", "guiShowAnswer", "guiAnswerCard", "guiCurrentCard"]
      );
      assert.deepEqual(requests[3].params, { ease: 3 });
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
        waitForStdout: "Press Enter to reveal",
        signal: "SIGINT"
      });

      assert.equal(result.exitCode, 130);
      assert.match(result.stdout, /Review interrupted/);
    }
  );
});
