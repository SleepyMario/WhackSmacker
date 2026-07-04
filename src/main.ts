#!/usr/bin/env node

import { AnkiClient } from "./anki-client";

declare const process: {
  argv: string[];
  exitCode?: number;
};

const usage = `Usage:
whacksmacker status
whacksmacker decks
whacksmacker review <deck-name>`;

function printConnectionError(error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Unable to reach AnkiConnect: ${message}`);
  console.error("Anki must be running and AnkiConnect must be installed.");
  process.exitCode = 1;
}

async function status(): Promise<void> {
  const client = new AnkiClient();

  try {
    const apiVersion = await client.version();
    console.log("AnkiConnect is available.");
    console.log(`API version: ${apiVersion}`);
  } catch (error) {
    printConnectionError(error);
  }
}

async function decks(): Promise<void> {
  const client = new AnkiClient();

  try {
    const deckNames = await client.deckNames();
    const sortedDeckNames = [...deckNames].sort((left, right) => left.localeCompare(right));

    if (sortedDeckNames.length === 0) {
      console.log("No Anki decks found.");
      return;
    }

    for (const deckName of sortedDeckNames) {
      console.log(deckName);
    }
  } catch (error) {
    printConnectionError(error);
  }
}

async function review(deckName: string): Promise<void> {
  const client = new AnkiClient();

  try {
    const started = await client.guiDeckReview(deckName);
    if (!started) {
      console.error(`Unable to start review for deck: ${deckName}`);
      process.exitCode = 1;
      return;
    }

    const card = await client.guiCurrentCard();
    if (card === null) {
      console.log("No cards are currently available for review in this deck.");
      return;
    }

    console.log(`Deck: ${deckName}`);
    console.log("");
    console.log(`   ${card.question}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.toLowerCase().includes("review") && message.toLowerCase().includes("active")) {
      console.log("No cards are currently available for review in this deck.");
      return;
    }

    printConnectionError(error);
  }
}

async function main(): Promise<void> {
  const command = process.argv[2];

  switch (command) {
    case "status":
      await status();
      return;
    case "decks":
      await decks();
      return;
    case "review": {
      const deckName = process.argv.slice(3).join(" ");
      if (deckName.length === 0) {
        console.error(usage);
        process.exitCode = 1;
        return;
      }

      await review(deckName);
      return;
    }
    default:
      console.error(usage);
      process.exitCode = 1;
  }
}

void main();
