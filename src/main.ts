#!/usr/bin/env node

import { AnkiClient } from "./anki-client";

declare const process: {
  argv: string[];
  exitCode?: number;
};

const usage = "Usage: whacksmacker status";

async function status(): Promise<void> {
  const client = new AnkiClient();

  try {
    const apiVersion = await client.version();
    console.log("AnkiConnect is available.");
    console.log(`API version: ${apiVersion}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Unable to reach AnkiConnect: ${message}`);
    console.error("Anki must be running and AnkiConnect must be installed.");
    process.exitCode = 1;
  }
}

async function main(): Promise<void> {
  const command = process.argv[2];

  if (command !== "status") {
    console.error(usage);
    process.exitCode = 1;
    return;
  }

  await status();
}

void main();
