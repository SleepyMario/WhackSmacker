import type { DomainModule } from "../core";

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
  register() {
    // Anki CLI commands are wired in a later restructuring chunk.
  }
};
