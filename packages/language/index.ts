import type { DomainModule } from "../core";
import { languageTerminology } from "./linguistic-terminology";

export * from "./linguistic-terminology";

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
  providerFeatures: [],
  register(context) {
    context.cli.register({
      path: ["language", "terminology"],
      summary: "Browse the bundled linguistic terminology glossary",
      run: async (args) => {
        await languageTerminology(args);
      }
    });
  }
};
