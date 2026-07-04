import assert from "node:assert/strict";
import { createServer } from "node:http";
import { test } from "node:test";

import {
  AnkiClient,
  AnkiConnectApiError,
  AnkiConnectConnectionError,
  AnkiConnectMalformedResponseError
} from "../dist/anki-client.js";

async function withMockAnki(handler, run) {
  const requests = [];
  const server = createServer(async (request, response) => {
    let body = "";
    request.setEncoding("utf8");
    for await (const chunk of request) {
      body += chunk;
    }

    const payload = body.length === 0 ? null : JSON.parse(body);
    requests.push(payload);
    await handler(payload, response);
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));

  try {
    const address = server.address();
    assert.equal(typeof address, "object");
    await run(new AnkiClient(`http://127.0.0.1:${address.port}`), requests);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error === undefined ? resolve() : reject(error)));
    });
  }
}

function sendJson(response, payload, statusCode = 200) {
  response.writeHead(statusCode, { "content-type": "application/json" });
  response.end(JSON.stringify(payload));
}

test("version sends a valid AnkiConnect request and returns the API version", async () => {
  await withMockAnki(
    (_request, response) => sendJson(response, { result: 6, error: null }),
    async (client, requests) => {
      assert.equal(await client.version(), 6);
      assert.deepEqual(requests, [{ action: "version", version: 6, params: {} }]);
    }
  );
});

test("deckNames returns available deck names", async () => {
  await withMockAnki(
    (_request, response) => sendJson(response, { result: ["Default", "Languages::Japanese"], error: null }),
    async (client) => {
      assert.deepEqual(await client.deckNames(), ["Default", "Languages::Japanese"]);
    }
  );
});

test("api errors are distinct from connection errors", async () => {
  await withMockAnki(
    (_request, response) => sendJson(response, { result: null, error: "deck was not found" }),
    async (client) => {
      await assert.rejects(() => client.deckNames(), AnkiConnectApiError);
    }
  );
});

test("http failures are connection errors", async () => {
  await withMockAnki(
    (_request, response) => sendJson(response, { result: null, error: null }, 500),
    async (client) => {
      await assert.rejects(() => client.version(), AnkiConnectConnectionError);
    }
  );
});

test("unreachable endpoints are connection errors", async () => {
  const client = new AnkiClient("http://127.0.0.1:1");

  await assert.rejects(() => client.version(), AnkiConnectConnectionError);
});

test("malformed response shape is rejected", async () => {
  await withMockAnki(
    (_request, response) => sendJson(response, { ok: true }),
    async (client) => {
      await assert.rejects(() => client.version(), AnkiConnectMalformedResponseError);
    }
  );
});

test("malformed deck names are rejected", async () => {
  await withMockAnki(
    (_request, response) => sendJson(response, { result: ["Default", ""], error: null }),
    async (client) => {
      await assert.rejects(() => client.deckNames(), AnkiConnectMalformedResponseError);
    }
  );
});

test("guiCurrentCard validates review card payloads", async () => {
  const card = {
    cardId: 123,
    deckName: "Default",
    question: "Front",
    answer: "Back",
    buttons: [1, 2, 3],
    nextReviews: ["1m", "6m", "10m"]
  };

  await withMockAnki(
    (_request, response) => sendJson(response, { result: card, error: null }),
    async (client) => {
      assert.deepEqual(await client.guiCurrentCard(), card);
    }
  );
});

test("invalid answer choices are rejected before calling AnkiConnect", async () => {
  await withMockAnki(
    (_request, response) => sendJson(response, { result: true, error: null }),
    async (client, requests) => {
      await assert.rejects(() => client.guiAnswerCard(0), AnkiConnectMalformedResponseError);
      assert.deepEqual(requests, []);
    }
  );
});
