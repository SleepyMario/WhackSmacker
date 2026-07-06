import type { DomainModule } from "../core";
import { createChessGame, type ChessGame, type ChessMove, type ChessPiece } from "../chess-core";

export interface ChessEngineProvider {
  readonly id: string;
  readonly displayName: string;
}

export interface ChessTablebaseProvider {
  readonly id: string;
  readonly displayName: string;
}

export interface ChessOpeningProvider {
  readonly id: string;
  readonly displayName: string;
}

export const chessModule: DomainModule = {
  id: "chess",
  displayName: "Chess",
  providerFeatures: ["lichess", "stockfish", "syzygy"],
  register(context) {
    context.cli.register({
      path: ["chess"],
      summary: "Show a terminal chessboard and apply simple UCI moves",
      run: async (args) => {
        await runChessCommand(args);
      }
    });
  }
};

export interface ChessCommandOptions {
  readonly moves: readonly ChessMove[];
  readonly legalSquare?: string;
}

export async function runChessCommand(args: readonly string[]): Promise<void> {
  console.log(renderChessCommand(parseChessArgs(args)));
}

export function renderChessCommand(options: ChessCommandOptions = { moves: [] }): string {
  const game = createChessGame();
  const lines = ["Chess", ""];

  for (const move of options.moves) {
    const result = game.move(move);
    lines.push(`${formatMove(move)}: ${result.ok ? "ok" : result.error ?? "illegal"}`);
  }

  if (options.moves.length > 0) {
    lines.push("");
  }

  lines.push(renderBoard(game), "", `Active side: ${capitalize(game.activeSide())}`, `FEN: ${game.fen()}`);

  if (options.legalSquare !== undefined) {
    lines.push("", renderLegalMoves(game, options.legalSquare));
  }

  lines.push(
    "",
    "Commands:",
    "  whacksmacker chess",
    "  whacksmacker chess e2e4 e7e5",
    "  whacksmacker chess --legal e2",
    "",
    "Move input uses UCI-style coordinate moves. This terminal command is a minimal chess-core view, not the desktop board UI."
  );

  return lines.join("\n");
}

export function parseChessArgs(args: readonly string[]): ChessCommandOptions {
  const moves: ChessMove[] = [];
  let legalSquare: string | undefined;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--legal") {
      const value = args[index + 1];
      if (value === undefined || value.startsWith("--")) {
        throw new Error("--legal requires a square such as e2.");
      }
      if (!isSquare(value)) {
        throw new Error(`Invalid chess square: ${value}`);
      }
      legalSquare = value;
      index += 1;
      continue;
    }

    if (arg === "--help" || arg === "-h") {
      throw new Error("Usage: whacksmacker chess [e2e4 ...] [--legal <square>]");
    }

    moves.push(parseUciMove(arg));
  }

  return { moves, legalSquare };
}

export function renderBoard(game: ChessGame): string {
  const lines = [];
  for (const rank of [8, 7, 6, 5, 4, 3, 2, 1]) {
    const cells = [];
    for (const file of ["a", "b", "c", "d", "e", "f", "g", "h"]) {
      cells.push(pieceLetter(game.pieceAt(`${file}${rank}` as never)));
    }
    lines.push(`${rank} ${cells.join(" ")}`);
  }
  lines.push("  a b c d e f g h");
  return lines.join("\n");
}

function parseUciMove(value: string): ChessMove {
  const match = /^([a-h][1-8])([a-h][1-8])([qrbn])?$/u.exec(value);
  if (match === null) {
    throw new Error(`Invalid UCI move: ${value}`);
  }
  return {
    from: match[1] as never,
    to: match[2] as never,
    promotion: match[3] as ChessMove["promotion"] | undefined
  };
}

function isSquare(value: string): boolean {
  return /^[a-h][1-8]$/u.test(value);
}

function renderLegalMoves(game: ChessGame, square: string): string {
  const moves = game.legalMovesFrom(square as never);
  return `Legal moves from ${square}: ${moves.length === 0 ? "none" : moves.join(" ")}`;
}

function formatMove(move: ChessMove): string {
  return `${move.from}${move.to}${move.promotion ?? ""}`;
}

function pieceLetter(piece: ChessPiece | null): string {
  if (piece === null) {
    return ".";
  }

  return piece.color === "white" ? piece.type.toUpperCase() : piece.type;
}

function capitalize(value: string): string {
  return `${value.slice(0, 1).toUpperCase()}${value.slice(1)}`;
}
