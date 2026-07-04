import {
  AnkiClient,
  AnkiConnectApiError,
  AnkiConnectConnectionError,
  AnkiConnectMalformedResponseError,
  assertValidDeckName
} from "./anki-client";
import { renderAnkiCardHtml } from "./card-renderer";

declare const process: {
  stdin: ReviewStdin;
  stdout: {
    write(text: string): void;
  };
  env: Record<string, string | undefined>;
  exitCode?: number;
  exit(code?: number): never;
  on(event: "SIGINT", listener: () => void): void;
  off(event: "SIGINT", listener: () => void): void;
};

interface ReviewStdin {
  isTTY?: boolean;
  on(event: "data", listener: (chunk: unknown) => void): void;
  on(event: "end" | "close", listener: () => void): void;
  off(event: "data", listener: (chunk: unknown) => void): void;
  off(event: "end" | "close", listener: () => void): void;
  pause(): void;
  resume(): void;
  setEncoding?(encoding: "utf8"): void;
  setRawMode?(enabled: boolean): void;
}

const ratingLabels: Record<number, string> = {
  1: "Again",
  2: "Hard",
  3: "Good",
  4: "Easy"
};

const ansi = {
  reset: "\x1b[0m",
  blue: "\x1b[34m",
  brightBlack: "\x1b[90m",
  green: "\x1b[32m",
  orange: "\x1b[38;5;208m",
  red: "\x1b[31m"
};

type RevealAction = "reveal" | "quit" | "interrupt";

class ReviewInput {
  private buffer = "";
  private readonly resolvers: Array<PendingRead> = [];
  private closed = false;
  private rawModeEnabled = false;

  private readonly onData = (chunk: unknown): void => {
    this.buffer += String(chunk);
    this.flush();
  };

  private readonly onClose = (): void => {
    this.closed = true;
    this.flush();
  };

  constructor() {
    process.stdin.setEncoding?.("utf8");
    process.stdin.on("data", this.onData);
    process.stdin.on("end", this.onClose);
    process.stdin.on("close", this.onClose);
    process.stdin.resume();
  }

  promptLine(prompt: string): Promise<string | null> {
    process.stdout.write(prompt);

    return new Promise((resolve) => {
      this.resolvers.push({ kind: "line", resolve });
      this.flush();
    });
  }

  readRevealAction(prompt: string): Promise<RevealAction | null> {
    process.stdout.write(prompt);
    this.enableRawMode();

    return new Promise((resolve) => {
      this.resolvers.push({
        kind: "reveal",
        resolve: (action) => {
          this.disableRawMode();
          resolve(action);
        }
      });
      this.flush();
    });
  }

  interrupt(): void {
    this.closed = true;
    this.flush();
  }

  close(): void {
    this.disableRawMode();
    process.stdin.off("data", this.onData);
    process.stdin.off("end", this.onClose);
    process.stdin.off("close", this.onClose);
    process.stdin.pause();
  }

  private flush(): void {
    while (this.resolvers.length > 0) {
      const pending = this.resolvers[0];
      if (pending === undefined) {
        return;
      }

      if (pending.kind === "line") {
        const line = this.readLine();
        if (line !== undefined) {
          this.resolvers.shift();
          pending.resolve(line);
          continue;
        }

        if (this.closed) {
          this.resolvers.shift();
          pending.resolve(this.buffer.length === 0 ? null : this.takeRemainingBuffer());
          continue;
        }

        return;
      }

      const action = this.readRevealActionFromBuffer();
      if (action !== undefined) {
        this.resolvers.shift();
        pending.resolve(action);
        continue;
      }

      if (this.closed) {
        this.resolvers.shift();
        pending.resolve(null);
        continue;
      }

      return;
    }
  }

  private readLine(): string | undefined {
    const newlineIndex = this.buffer.search(/\r?\n/u);
    if (newlineIndex === -1) {
      return undefined;
    }

    const line = this.buffer.slice(0, newlineIndex);
    const newlineLength = this.buffer[newlineIndex] === "\r" && this.buffer[newlineIndex + 1] === "\n" ? 2 : 1;
    this.buffer = this.buffer.slice(newlineIndex + newlineLength);
    return line;
  }

  private readRevealActionFromBuffer(): RevealAction | undefined {
    while (this.buffer.length > 0) {
      const char = this.buffer[0];
      this.buffer = this.buffer.slice(1);

      if (char === "\u0003") {
        return "interrupt";
      }

      if (char === "\r" || char === "\n") {
        if (char === "\r" && this.buffer.startsWith("\n")) {
          this.buffer = this.buffer.slice(1);
        }
        return "reveal";
      }

      if (char === " ") {
        return "reveal";
      }

      if (char.toLowerCase() === "q") {
        return "quit";
      }

      process.stdout.write("\nPress Enter or Space to reveal the answer. Press q to stop.");
    }

    return undefined;
  }

  private takeRemainingBuffer(): string {
    const remaining = this.buffer;
    this.buffer = "";
    return remaining;
  }

  private enableRawMode(): void {
    if (process.stdin.isTTY === true && this.rawModeEnabled === false) {
      process.stdin.setRawMode?.(true);
      this.rawModeEnabled = true;
    }
  }

  private disableRawMode(): void {
    if (this.rawModeEnabled) {
      process.stdin.setRawMode?.(false);
      this.rawModeEnabled = false;
    }
  }
}

type PendingRead =
  | {
      readonly kind: "line";
      readonly resolve: (value: string | null) => void;
    }
  | {
      readonly kind: "reveal";
      readonly resolve: (value: RevealAction | null) => void;
    };

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
  const input = new ReviewInput();
  let answeredCount = 0;
  let interrupted = false;

  const onSigint = (): void => {
    interrupted = true;
    process.stdout.write("\n");
    input.interrupt();
    input.close();
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
      console.log("Question");
      console.log("");
      console.log(renderCardSection(card.question));

      while (true) {
        const revealAction = await input.readRevealAction("\nPress Enter or Space to reveal the answer. Press q to stop.");
        process.stdout.write("\n");

        if (revealAction === null) {
          if (interrupted) {
            console.log("Review interrupted.");
            process.exitCode = 130;
          } else {
            console.error("Review cancelled.");
            process.exitCode = 1;
          }

          return;
        }

        if (revealAction === "interrupt") {
          console.log("Review interrupted.");
          process.exitCode = 130;
          return;
        }

        if (revealAction === "reveal") {
          break;
        }

        if (revealAction === "quit") {
          console.log("");
          console.log("Review stopped.");
          console.log(`Cards answered: ${answeredCount}`);
          return;
        }
      }

      const revealed = await client.guiShowAnswer();
      if (!revealed) {
        console.error("Unable to reveal the current card.");
        process.exitCode = 1;
        return;
      }

      console.log("");
      console.log("Answer");
      console.log("");
      console.log(renderCardSection(card.answer));
      console.log("");

      const validButtons = new Set(card.buttons);
      for (const [index, button] of card.buttons.entries()) {
        const label = ratingLabels[button] ?? String(button);
        const nextReview = card.nextReviews[index];
        const reviewText = nextReview === undefined ? "" : ` — ${nextReview}`;
        console.log(colorRatingLine(button, `${button} ${label}${reviewText}`));
      }
      console.log("");

      while (true) {
        const ratingInput = await input.promptLine(colorText("Choose a rating: ", ansi.blue));
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
    input.close();
  }
}

function renderCardSection(html: string): string {
  const rendered = renderAnkiCardHtml(html);
  return rendered.length > 0 ? rendered : "[empty]";
}

function colorRatingLine(button: number, line: string): string {
  if (button === 1) {
    return colorText(line, ansi.brightBlack);
  }

  if (button === 2) {
    return colorText(line, ansi.red);
  }

  if (button === 3) {
    return colorText(line, ansi.orange);
  }

  if (button === 4) {
    return colorText(line, ansi.green);
  }

  return colorText(line, ansi.blue);
}

function colorText(text: string, color: string): string {
  return `${color}${text}${ansi.reset}`;
}
