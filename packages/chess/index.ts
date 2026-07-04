import type { DomainModule } from "../core";

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
  register() {
    // No user-facing commands are exposed until chess workflows exist.
  }
};
