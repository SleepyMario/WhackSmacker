import type { DomainModule } from "../core";
import { languageDecks, languageReview, languageStatus } from "./anki-cli";

export * from "./anki-client";

export interface LanguageDeck {
  readonly name: string;
}

export interface LanguageCard {
  readonly id: string;
  readonly prompt: string;
  readonly answer: string;
}

export interface SchedulingProvider {
  readonly id: string;
  readonly displayName: string;
}

export const languageModule: DomainModule = {
  id: "language",
  displayName: "Language",
  providerFeatures: ["anki"],
  register(context) {
    context.cli.register({
      path: ["language", "status"],
      summary: "Check whether the Anki provider is reachable",
      run: async (args) => {
        if (args.length !== 0) {
          throw new Error("Usage: whacksmacker language status");
        }

        await languageStatus();
      }
    });

    context.cli.register({
      path: ["language", "decks"],
      summary: "List Anki-backed language decks",
      run: async (args) => {
        if (args.length !== 0) {
          throw new Error("Usage: whacksmacker language decks");
        }

        await languageDecks();
      }
    });

    context.cli.register({
      path: ["language", "review"],
      summary: "Review an Anki-backed language deck",
      run: async (args) => {
        if (args.length === 0) {
          throw new Error("Usage: whacksmacker language review <deck-name>");
        }

        await languageReview(args.join(" "));
      }
    });
  }
};
