import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import React from "react";
import { createRoot } from "react-dom/client";
import { act } from "react";
import { test } from "node:test";

import { ChessApp } from "../dist/apps/chess-desktop/src/ChessApp.js";

async function renderApp() {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
    url: "http://127.0.0.1/"
  });
  const previousWindow = global.window;
  const previousDocument = global.document;
  const previousHTMLElement = global.HTMLElement;
  const previousEvent = global.Event;

  global.window = dom.window;
  global.document = dom.window.document;
  global.HTMLElement = dom.window.HTMLElement;
  global.Event = dom.window.Event;

  const rootElement = dom.window.document.getElementById("root");
  const root = createRoot(rootElement);
  await act(async () => {
    root.render(React.createElement(ChessApp));
  });

  return {
    document: dom.window.document,
    async click(testId) {
      const element = dom.window.document.querySelector(`[data-testid="${testId}"]`);
      assert.ok(element, `missing element: ${testId}`);
      await act(async () => {
        element.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
      });
    },
    async cleanup() {
      await act(async () => {
        root.unmount();
      });
      dom.window.close();
      global.window = previousWindow;
      global.document = previousDocument;
      global.HTMLElement = previousHTMLElement;
      global.Event = previousEvent;
    }
  };
}

test("desktop board renders 64 squares and starting pieces", async () => {
  const app = await renderApp();
  try {
    assert.equal(app.document.querySelectorAll(".square").length, 64);
    assert.equal(app.document.querySelectorAll("[data-testid^='piece-']").length, 32);
    assert.equal(app.document.querySelector('[data-testid="piece-e2"]')?.textContent, "♙");
    assert.equal(app.document.querySelector('[data-testid="piece-e7"]')?.textContent, "♟");
    assert.equal(app.document.querySelector('[data-testid="turn-status"]')?.textContent, "White to move");
  } finally {
    await app.cleanup();
  }
});

test("legal click move updates displayed position and turn", async () => {
  const app = await renderApp();
  try {
    await app.click("square-e2");
    await app.click("square-e4");

    assert.equal(app.document.querySelector('[data-testid="piece-e2"]'), null);
    assert.equal(app.document.querySelector('[data-testid="piece-e4"]')?.textContent, "♙");
    assert.equal(app.document.querySelector('[data-testid="turn-status"]')?.textContent, "Black to move");
  } finally {
    await app.cleanup();
  }
});

test("illegal click move leaves position unchanged and shows error", async () => {
  const app = await renderApp();
  try {
    await app.click("square-e2");
    await app.click("square-e5");

    assert.equal(app.document.querySelector('[data-testid="piece-e2"]')?.textContent, "♙");
    assert.equal(app.document.querySelector('[data-testid="piece-e5"]'), null);
    assert.equal(app.document.querySelector('[data-testid="turn-status"]')?.textContent, "White to move");
    assert.match(app.document.querySelector('[data-testid="move-message"]')?.textContent ?? "", /Illegal move/);
  } finally {
    await app.cleanup();
  }
});

test("reset restores starting board and clears selection", async () => {
  const app = await renderApp();
  try {
    await app.click("square-e2");
    await app.click("square-e4");
    await app.click("square-e7");
    await app.click("square-e5");
    assert.equal(app.document.querySelector('[data-testid="turn-status"]')?.textContent, "White to move");

    const resetButton = [...app.document.querySelectorAll("button")].find((button) => button.textContent === "Reset");
    assert.ok(resetButton);
    await act(async () => {
      resetButton.dispatchEvent(new app.document.defaultView.MouseEvent("click", { bubbles: true }));
    });

    assert.equal(app.document.querySelector('[data-testid="piece-e2"]')?.textContent, "♙");
    assert.equal(app.document.querySelector('[data-testid="piece-e7"]')?.textContent, "♟");
    assert.equal(app.document.querySelector('[data-testid="turn-status"]')?.textContent, "White to move");
    assert.equal(app.document.querySelectorAll(".selected").length, 0);
    assert.equal(app.document.querySelector('[data-testid="move-message"]')?.textContent, "");
  } finally {
    await app.cleanup();
  }
});
