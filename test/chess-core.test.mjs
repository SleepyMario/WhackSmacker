import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

import { createChessGame, standardStartingFen } from "../dist/packages/chess-core/index.js";

test("chess core exposes the standard starting position", () => {
  const game = createChessGame();

  assert.equal(game.fen(), standardStartingFen);
  assert.equal(game.pieces().length, 32);
  assert.equal(game.activeSide(), "white");
});

test("legal moves update the position and active side", () => {
  const game = createChessGame();
  const result = game.move({ from: "e2", to: "e4" });

  assert.equal(result.ok, true);
  assert.equal(result.activeSide, "black");
  assert.equal(game.pieceAt("e4")?.type, "p");
  assert.equal(game.pieceAt("e2"), null);
});

test("illegal moves fail and preserve position", () => {
  const game = createChessGame();
  const before = game.fen();
  const result = game.move({ from: "e2", to: "e5" });

  assert.equal(result.ok, false);
  assert.equal(game.fen(), before);
  assert.equal(result.fen, before);
});

test("moving an opponent piece fails", () => {
  const game = createChessGame();
  const before = game.fen();
  const result = game.move({ from: "e7", to: "e5" });

  assert.equal(result.ok, false);
  assert.match(result.error, /active side/);
  assert.equal(game.fen(), before);
});

test("reset restores the standard position and White to move", () => {
  const game = createChessGame();

  assert.equal(game.move({ from: "e2", to: "e4" }).ok, true);
  game.reset();

  assert.equal(game.fen(), standardStartingFen);
  assert.equal(game.activeSide(), "white");
  assert.equal(game.pieces().length, 32);
});

test("legalMovesFrom returns destinations from chess.js rules", () => {
  const game = createChessGame();

  assert.deepEqual([...game.legalMovesFrom("e2")].sort(), ["e3", "e4"]);
});

test("chess core has no Electron or React dependency", async () => {
  const source = await readFile(new URL("../packages/chess-core/index.ts", import.meta.url), "utf8");

  assert.doesNotMatch(source, /electron|react|react-dom|browser|window|document/u);
});
