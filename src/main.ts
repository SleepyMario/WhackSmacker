#!/usr/bin/env node

import { AnkiClient } from "./anki-client";

declare const process: {
  argv: string[];
  stdin: {
    setEncoding(encoding: string): void;
    on(event: "data", listener: (chunk: string) => void): void;
    on(event: "end", listener: () => void): void;
    resume(): void;
    pause(): void;
  };
  stdout: {
    write(text: string): void;
  };
  exitCode?: number;
};

const usage = `Usage:
whacksmacker status
whacksmacker decks
whacksmacker review <deck-name>`;

const ratingLabels: Record<number, string> = {
  1: "Again",
  2: "Hard",
  3: "Good",
  4: "Easy"
};

const queuedInputLines: string[] = [];
const pendingInputResolvers: Array<(value: string | null) => void> = [];
let inputBuffer = "";
let inputEnded = false;
let inputStarted = false;

function startInput(): void {
  if (inputStarted) {
    return;
  }

  inputStarted = true;
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (chunk) => {
    inputBuffer += chunk;
    const parts = inputBuffer.split(/\r?\n/);
    inputBuffer = parts.pop() ?? "";
    queuedInputLines.push(...parts);
    flushInputResolvers();
  });
  process.stdin.on("end", () => {
    inputEnded = true;
    if (inputBuffer.length > 0) {
      queuedInputLines.push(inputBuffer);
      inputBuffer = "";
    }
    flushInputResolvers();
  });
  process.stdin.resume();
}

function flushInputResolvers(): void {
  while (pendingInputResolvers.length > 0 && (queuedInputLines.length > 0 || inputEnded)) {
    const resolve = pendingInputResolvers.shift();
    if (resolve === undefined) {
      return;
    }
    resolve(queuedInputLines.shift() ?? null);
  }
}

function promptLine(prompt: string): Promise<string | null> {
  startInput();
  process.stdout.write(prompt);
  if (queuedInputLines.length > 0 || inputEnded) {
    return Promise.resolve(queuedInputLines.shift() ?? null);
  }
  return new Promise((resolve) => {
    pendingInputResolvers.push(resolve);
  });
}

function stopInput(): void {
  if (inputStarted) {
    process.stdin.pause();
  }
}

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

    const revealInput = await promptLine("\nPress Enter to reveal the answer...");
    if (revealInput === null) {
      console.error("Review cancelled.");
      process.exitCode = 1;
      return;
    }

    const revealed = await client.guiShowAnswer();
    if (!revealed) {
      console.error("Unable to reveal the current card.");
      process.exitCode = 1;
      return;
    }

    console.log("");
    console.log(`   ${card.answer}`);
    console.log("");

    const validButtons = new Set(card.buttons);
    for (const [index, button] of card.buttons.entries()) {
      const label = ratingLabels[button] ?? String(button);
      const nextReview = card.nextReviews[index];
      const reviewText = nextReview === undefined ? "" : ` (${nextReview})`;
      console.log(`[${button}] ${label}${reviewText}`);
    }
    console.log("");

    while (true) {
      const ratingInput = await promptLine("Rating: ");
      if (ratingInput === null) {
        console.error("Review cancelled.");
        process.exitCode = 1;
        return;
      }

      const rating = Number(ratingInput.trim());
      if (!Number.isInteger(rating) || !validButtons.has(rating)) {
        console.log(`Invalid rating. Choose one of: ${card.buttons.join(", ")}`);
        continue;
      }

      const answered = await client.guiAnswerCard(rating);
      if (!answered) {
        console.error("Anki did not accept the answer.");
        process.exitCode = 1;
        return;
      }

      const label = ratingLabels[rating] ?? String(rating);
      console.log(`Card answered: ${label}`);
      return;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.toLowerCase().includes("review") && message.toLowerCase().includes("active")) {
      console.log("No cards are currently available for review in this deck.");
      return;
    }

    printConnectionError(error);
  } finally {
    stopInput();
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
