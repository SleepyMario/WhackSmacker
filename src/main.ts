#!/usr/bin/env node

import { AnkiClient } from "./anki-client";

declare const process: {
  argv: string[];
  exitCode?: number;
};

const usage = `Usage:
whacksmacker status
whacksmacker decks`;

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

async function main(): Promise<void> {
  const command = process.argv[2];

  switch (command) {
    case "status":
      await status();
      return;
    case "decks":
      await decks();
      return;
    default:
      console.error(usage);
      process.exitCode = 1;
  }
}

void main();
