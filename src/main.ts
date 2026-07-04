#!/usr/bin/env node

import { languageDecks, languageReview, languageStatus } from "../packages/language/anki-cli";

declare const process: {
  argv: string[];
  exitCode?: number;
};

const usage = `Usage:
whacksmacker status
whacksmacker decks
whacksmacker review <deck-name>`;

async function main(): Promise<void> {
  const command = process.argv[2];

  switch (command) {
    case "status":
      if (process.argv.length !== 3) {
        console.error(usage);
        process.exitCode = 1;
        return;
      }

      await languageStatus();
      return;
    case "decks":
      if (process.argv.length !== 3) {
        console.error(usage);
        process.exitCode = 1;
        return;
      }

      await languageDecks();
      return;
    case "review": {
      const deckName = process.argv.slice(3).join(" ");
      if (process.argv.length < 4) {
        console.error(usage);
        process.exitCode = 1;
        return;
      }

      await languageReview(deckName);
      return;
    }
    default:
      console.error(usage);
      process.exitCode = 1;
  }
}

void main();
