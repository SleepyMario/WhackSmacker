import { Chess, type Color, type Square } from "chess.js";

export interface ChessMove {
  readonly from: Square;
  readonly to: Square;
  readonly promotion?: "q" | "r" | "b" | "n";
}

export interface ChessMoveResult {
  readonly ok: boolean;
  readonly fen: string;
  readonly activeSide: "white" | "black";
  readonly error?: string;
}

export interface ChessPiece {
  readonly square: Square;
  readonly type: "p" | "n" | "b" | "r" | "q" | "k";
  readonly color: "white" | "black";
}

export const standardStartingFen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

export class ChessGame {
  private readonly chess = new Chess();

  fen(): string {
    return this.chess.fen();
  }

  activeSide(): "white" | "black" {
    return colorName(this.chess.turn());
  }

  pieces(): readonly ChessPiece[] {
    const pieces: ChessPiece[] = [];

    for (const square of allSquares()) {
      const piece = this.chess.get(square);
      if (piece !== undefined) {
        pieces.push({
          square,
          type: piece.type,
          color: colorName(piece.color)
        });
      }
    }

    return pieces;
  }

  pieceAt(square: Square): ChessPiece | null {
    const piece = this.chess.get(square);
    if (piece === undefined) {
      return null;
    }

    return {
      square,
      type: piece.type,
      color: colorName(piece.color)
    };
  }

  legalMovesFrom(square: Square): readonly Square[] {
    return this.chess.moves({ square, verbose: true }).map((move) => move.to as Square);
  }

  move(move: ChessMove): ChessMoveResult {
    const before = this.fen();
    const piece = this.chess.get(move.from);
    if (piece === undefined) {
      return this.failure("No piece on the source square.");
    }

    if (piece.color !== this.chess.turn()) {
      return this.failure("Only the active side can move.");
    }

    const applied = this.tryMove(move);

    if (applied === null) {
      this.chess.load(before);
      return this.failure("Illegal move.");
    }

    return {
      ok: true,
      fen: this.fen(),
      activeSide: this.activeSide()
    };
  }

  reset(): void {
    this.chess.reset();
  }

  private failure(error: string): ChessMoveResult {
    return {
      ok: false,
      fen: this.fen(),
      activeSide: this.activeSide(),
      error
    };
  }

  private tryMove(move: ChessMove): unknown {
    try {
      return this.chess.move({
        from: move.from,
        to: move.to,
        promotion: move.promotion ?? "q"
      });
    } catch {
      return null;
    }
  }
}

export function createChessGame(): ChessGame {
  return new ChessGame();
}

function colorName(color: Color): "white" | "black" {
  return color === "w" ? "white" : "black";
}

function allSquares(): Square[] {
  const squares: Square[] = [];
  for (const rank of [8, 7, 6, 5, 4, 3, 2, 1]) {
    for (const file of ["a", "b", "c", "d", "e", "f", "g", "h"]) {
      squares.push(`${file}${rank}` as Square);
    }
  }

  return squares;
}
