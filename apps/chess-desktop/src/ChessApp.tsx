import { useMemo, useState, type ReactElement } from "react";
import { createChessGame, type ChessGame, type ChessPiece } from "../../../packages/chess-core";

const files = ["a", "b", "c", "d", "e", "f", "g", "h"] as const;
const ranks = [8, 7, 6, 5, 4, 3, 2, 1] as const;

type Square = `${(typeof files)[number]}${(typeof ranks)[number]}`;

const pieceGlyphs: Record<ChessPiece["color"], Record<ChessPiece["type"], string>> = {
  white: {
    k: "♔",
    q: "♕",
    r: "♖",
    b: "♗",
    n: "♘",
    p: "♙"
  },
  black: {
    k: "♚",
    q: "♛",
    r: "♜",
    b: "♝",
    n: "♞",
    p: "♟"
  }
};

export function ChessApp(): ReactElement {
  const game = useMemo(() => createChessGame(), []);
  const [fen, setFen] = useState(game.fen());
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [message, setMessage] = useState("");
  const pieces = game.pieces();
  const legalDestinations = selectedSquare === null ? [] : game.legalMovesFrom(selectedSquare);

  function refresh(): void {
    setFen(game.fen());
  }

  function handleSquareClick(square: Square): void {
    const piece = game.pieceAt(square);

    if (selectedSquare === null) {
      if (piece !== null && piece.color === game.activeSide()) {
        setSelectedSquare(square);
        setMessage("");
      }
      return;
    }

    if (piece !== null && piece.color === game.activeSide()) {
      setSelectedSquare(square);
      setMessage("");
      return;
    }

    const result = game.move({ from: selectedSquare, to: square });
    if (result.ok) {
      setSelectedSquare(null);
      setMessage("");
      refresh();
      return;
    }

    setSelectedSquare(null);
    setMessage(result.error ?? "Illegal move.");
    refresh();
  }

  function reset(): void {
    game.reset();
    setSelectedSquare(null);
    setMessage("");
    refresh();
  }

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <h1>WhackSmacker Chess</h1>
          <p data-testid="turn-status">{game.activeSide() === "white" ? "White" : "Black"} to move</p>
        </div>
        <button type="button" onClick={reset}>
          Reset
        </button>
      </header>

      <section className="board-wrap" aria-label="Chessboard">
        <div className="board" data-testid="chessboard" data-fen={fen}>
          {ranks.map((rank) =>
            files.map((file) => {
              const square = `${file}${rank}` as Square;
              const piece = pieces.find((candidate) => candidate.square === square);
              const isLight = (files.indexOf(file) + ranks.indexOf(rank)) % 2 === 0;
              const isSelected = selectedSquare === square;
              const isLegalDestination = legalDestinations.includes(square);

              return (
                <button
                  aria-label={square}
                  className={[
                    "square",
                    isLight ? "light" : "dark",
                    isSelected ? "selected" : "",
                    isLegalDestination ? "legal-destination" : ""
                  ].join(" ")}
                  data-testid={`square-${square}`}
                  key={square}
                  onClick={() => handleSquareClick(square)}
                  type="button"
                >
                  <span className="rank-label">{file === "a" ? rank : ""}</span>
                  <span className="piece" data-testid={piece === undefined ? undefined : `piece-${square}`}>
                    {piece === undefined ? "" : pieceGlyphs[piece.color][piece.type]}
                  </span>
                  <span className="file-label">{rank === 1 ? file : ""}</span>
                </button>
              );
            })
          )}
        </div>
      </section>

      <p className="move-message" data-testid="move-message" aria-live="polite">
        {message}
      </p>
    </main>
  );
}
