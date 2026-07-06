import type { DomainModule } from "../core";
import { languageKorean } from "./korean";
import { languageTerminology, languageTerms } from "./linguistic-terminology";

export * from "./korean";
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
      path: ["language", "korean"],
      summary: "Browse installed Korean curriculum content",
      run: async (args) => {
        await languageKorean(args);
      }
    });
    context.cli.register({
      path: ["language", "terminology"],
      summary: "Browse the bundled linguistic terminology glossary",
      run: async (args) => {
        await languageTerminology(args);
      }
    });
    context.cli.register({
      path: ["language", "terms"],
      summary: "Browse installed Linguistic Terminology package content",
      run: async (args) => {
        await languageTerms(args);
      }
    });
  }
};
