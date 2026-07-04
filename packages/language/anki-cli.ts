import {
  AnkiClient,
  AnkiConnectApiError,
  AnkiConnectConnectionError,
  AnkiConnectMalformedResponseError,
  assertValidDeckName
} from "./anki-client";

declare function require(name: "node:readline"): {
  createInterface(options: { input: unknown; crlfDelay: number }): {
    on(event: "line", listener: (line: string) => void): void;
    on(event: "close", listener: () => void): void;
    close(): void;
  };
};

declare const process: {
  stdin: unknown;
  stdout: {
    write(text: string): void;
  };
  env: Record<string, string | undefined>;
  exitCode?: number;
  exit(code?: number): never;
  on(event: "SIGINT", listener: () => void): void;
  off(event: "SIGINT", listener: () => void): void;
};

type ReadlineInterface = ReturnType<typeof readline.createInterface>;

const readline = require("node:readline");

const ratingLabels: Record<number, string> = {
  1: "Again",
  2: "Hard",
  3: "Good",
  4: "Easy"
};

class LineReader {
  private readonly reader: ReadlineInterface;
  private readonly lines: string[] = [];
  private readonly resolvers: Array<(value: string | null) => void> = [];
  private closed = false;

  constructor() {
    this.reader = readline.createInterface({
      input: process.stdin,
      crlfDelay: Infinity
    });

    this.reader.on("line", (line) => {
      this.lines.push(line);
      this.flush();
    });

    this.reader.on("close", () => {
      this.closed = true;
      this.flush();
    });
  }

  prompt(prompt: string): Promise<string | null> {
    process.stdout.write(prompt);

    if (this.lines.length > 0 || this.closed) {
      return Promise.resolve(this.lines.shift() ?? null);
    }

    return new Promise((resolve) => {
      this.resolvers.push(resolve);
    });
  }

  close(): void {
    this.reader.close();
  }

  interrupt(): void {
    this.closed = true;
    this.reader.close();
    this.flush();
  }

  private flush(): void {
    while (this.resolvers.length > 0 && (this.lines.length > 0 || this.closed)) {
      const resolve = this.resolvers.shift();
      if (resolve === undefined) {
        return;
      }

      resolve(this.lines.shift() ?? null);
    }
  }
}

function createClient(): AnkiClient {
  return new AnkiClient(process.env.ANKICONNECT_URL);
}

export function printLanguageCliError(error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);

  if (error instanceof AnkiConnectConnectionError) {
    console.error(`Unable to reach AnkiConnect: ${message}`);
    console.error("Anki must be running and AnkiConnect must be installed.");
  } else if (error instanceof AnkiConnectApiError) {
    console.error(`AnkiConnect API error: ${message}`);
  } else if (error instanceof AnkiConnectMalformedResponseError) {
    console.error(`Malformed AnkiConnect response: ${message}`);
  } else {
    console.error(`Unexpected error: ${message}`);
  }

  process.exitCode = 1;
}

export async function languageStatus(): Promise<void> {
  const client = createClient();

  try {
    const apiVersion = await client.version();
    console.log("AnkiConnect is available.");
    console.log(`API version: ${apiVersion}`);
  } catch (error) {
    printLanguageCliError(error);
  }
}

export async function languageDecks(): Promise<void> {
  const client = createClient();

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
    printLanguageCliError(error);
  }
}

export async function languageReview(deckName: string): Promise<void> {
  try {
    assertValidDeckName(deckName);
  } catch (error) {
    printLanguageCliError(error);
    return;
  }

  const client = createClient();
  const reader = new LineReader();
  let answeredCount = 0;
  let interrupted = false;

  const onSigint = (): void => {
    interrupted = true;
    process.stdout.write("\n");
    reader.interrupt();
    console.log("Review interrupted.");
    process.exit(130);
  };

  process.on("SIGINT", onSigint);

  try {
    const started = await client.guiDeckReview(deckName);
    if (!started) {
      console.error(`Unable to start review for deck: ${deckName}`);
      process.exitCode = 1;
      return;
    }

    let displayedDeck = false;

    while (true) {
      const card = await client.guiCurrentCard();
      if (card === null) {
        if (answeredCount === 0) {
          console.log("No cards are currently available for review in this deck.");
          return;
        }

        console.log("Review complete.");
        console.log(`Cards answered: ${answeredCount}`);
        return;
      }

      if (!displayedDeck) {
        console.log(`Deck: ${deckName}`);
        displayedDeck = true;
      } else {
        console.log("");
        console.log("---");
      }

      console.log("");
      console.log(`   ${card.question}`);

      while (true) {
        const revealInput = await reader.prompt("\nPress Enter to reveal, or q to quit: ");
        if (revealInput === null) {
          if (interrupted) {
            console.log("Review interrupted.");
            process.exitCode = 130;
          } else {
            console.error("Review cancelled.");
            process.exitCode = 1;
          }

          return;
        }

        const normalizedRevealInput = revealInput.trim();
        if (normalizedRevealInput.length === 0) {
          break;
        }

        if (normalizedRevealInput.toLowerCase() === "q") {
          console.log("");
          console.log("Review stopped.");
          console.log(`Cards answered: ${answeredCount}`);
          return;
        }

        console.log("Press Enter to reveal, or q to quit.");
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
        const ratingInput = await reader.prompt("Rating: ");
        if (ratingInput === null) {
          if (interrupted) {
            console.log("Review interrupted.");
            process.exitCode = 130;
          } else {
            console.error("Review cancelled.");
            process.exitCode = 1;
          }

          return;
        }

        const trimmedRatingInput = ratingInput.trim();
        if (trimmedRatingInput.toLowerCase() === "q") {
          console.log("");
          console.log("Review stopped.");
          console.log(`Cards answered: ${answeredCount}`);
          return;
        }

        const rating = Number(trimmedRatingInput);
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

        answeredCount += 1;
        const label = ratingLabels[rating] ?? String(rating);
        console.log(`Card answered: ${label}`);
        break;
      }
    }
  } catch (error) {
    if (error instanceof AnkiConnectApiError && error.message.toLowerCase().includes("review") && error.message.toLowerCase().includes("active")) {
      if (answeredCount === 0) {
        console.log("No cards are currently available for review in this deck.");
        return;
      }

      console.log("Review complete.");
      console.log(`Cards answered: ${answeredCount}`);
      return;
    }

    printLanguageCliError(error);
  } finally {
    process.off("SIGINT", onSigint);
    reader.close();
  }
}
