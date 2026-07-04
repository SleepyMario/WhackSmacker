import { getContinentDefinitions, renderContinentMap } from "./continent-renderer";

declare const process: {
  stdin: ReviewStdin;
  stdout: {
    isTTY?: boolean;
    columns?: number;
    write(text: string): void;
  };
  env: Record<string, string | undefined>;
  exitCode?: number;
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

export interface ContinentReviewCard {
  readonly id: string;
  readonly answer: string;
}

export interface ContinentReviewSummary {
  readonly reviewed: number;
  readonly again: number;
  readonly hard: number;
  readonly good: number;
  readonly easy: number;
}

interface MutableContinentReviewSummary {
  reviewed: number;
  again: number;
  hard: number;
  good: number;
  easy: number;
}

export interface ContinentReviewOptions {
  readonly width?: number;
  readonly height?: number;
  readonly colorsEnabled?: boolean;
}

type RevealAction = "reveal" | "quit" | "interrupt";

const ratingLabels: Record<number, keyof Omit<ContinentReviewSummary, "reviewed">> = {
  1: "again",
  2: "hard",
  3: "good",
  4: "easy"
};

const ratingDisplayLabels: Record<number, string> = {
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
  red: "\x1b[31m"
};

export function getContinentReviewCards(): readonly ContinentReviewCard[] {
  return getContinentDefinitions().map((continent) => ({
    id: continent.id,
    answer: continent.name
  }));
}

export async function runContinentReview(options: ContinentReviewOptions = {}): Promise<ContinentReviewSummary> {
  const input = new ReviewInput();
  const colorsEnabled = options.colorsEnabled ?? shouldUseColors();
  const width = options.width ?? Math.min(Math.max((process.stdout.columns ?? 80) - 2, 24), 80);
  const height = options.height ?? 20;
  const summary: MutableContinentReviewSummary = { reviewed: 0, again: 0, hard: 0, good: 0, easy: 0 };
  let interrupted = false;

  const onSigint = (): void => {
    interrupted = true;
    input.interrupt();
  };

  process.on("SIGINT", onSigint);

  try {
    const cards = getContinentReviewCards();
    for (let index = 0; index < cards.length; index += 1) {
      const card = cards[index] as ContinentReviewCard;
      writeQuestion(card, index + 1, cards.length, { width, height, colorsEnabled });
      const reveal = await input.readRevealAction("\nPress Enter or Space to reveal the answer.\nPress q to stop.");

      if (reveal === "interrupt") {
        console.log("\nReview interrupted.");
        process.exitCode = 130;
        break;
      }

      if (reveal === "quit" || reveal === null) {
        console.log("\nReview stopped.");
        break;
      }

      writeAnswer(card, { width, height, colorsEnabled });

      while (true) {
        const ratingInput = await input.promptLine(colorText("Choose a rating: ", ansi.blue, colorsEnabled));
        if (ratingInput === null) {
          console.log("\nReview stopped.");
          return printSummary(summary);
        }

        const trimmed = ratingInput.trim();
        if (trimmed === "q") {
          console.log("Review stopped.");
          return printSummary(summary);
        }

        const rating = Number(trimmed);
        if (!Number.isInteger(rating) || ratingLabels[rating] === undefined) {
          console.log("Invalid rating. Choose one of: 1, 2, 3, 4");
          continue;
        }

        summary.reviewed += 1;
        summary[ratingLabels[rating]] += 1;
        break;
      }
    }

    if (interrupted) {
      process.exitCode = 130;
    }

    return printSummary(summary);
  } finally {
    process.off("SIGINT", onSigint);
    input.close();
  }
}

function writeQuestion(card: ContinentReviewCard, current: number, total: number, options: Required<ContinentReviewOptions>): void {
  const map = renderContinentMap({ highlight: card.answer, width: options.width, height: options.height, colorsEnabled: options.colorsEnabled });

  console.log(`Geography — Continents\n\nQuestion ${current} of ${total}\n`);
  console.log(map.text);
  console.log("\nWhich continent is highlighted?");
}

function writeAnswer(card: ContinentReviewCard, options: Required<ContinentReviewOptions>): void {
  const map = renderContinentMap({ highlight: card.answer, width: options.width, height: options.height, colorsEnabled: options.colorsEnabled });

  console.log(`\n\nAnswer\n\n${card.answer}\n`);
  console.log(map.text);
  console.log("");
  for (const rating of [1, 2, 3, 4]) {
    console.log(colorRatingLine(rating, `${rating} ${ratingDisplayLabels[rating]}`));
  }
  console.log("");
}

function printSummary(summary: ContinentReviewSummary): ContinentReviewSummary {
  console.log("");
  console.log(`Cards reviewed: ${summary.reviewed}`);
  console.log(`Again count: ${summary.again}`);
  console.log(`Hard count: ${summary.hard}`);
  console.log(`Good count: ${summary.good}`);
  console.log(`Easy count: ${summary.easy}`);

  return summary;
}

function colorRatingLine(rating: number, line: string): string {
  if (rating === 1) {
    return colorText(line, ansi.brightBlack, shouldUseColors());
  }

  if (rating === 2) {
    return colorText(line, ansi.red, shouldUseColors());
  }

  if (rating === 3) {
    return colorText(line, ansi.blue, shouldUseColors());
  }

  return colorText(line, ansi.green, shouldUseColors());
}

function colorText(text: string, color: string, colorsEnabled: boolean): string {
  return colorsEnabled ? `${color}${text}${ansi.reset}` : text;
}

function shouldUseColors(): boolean {
  return process.stdout.isTTY === true && process.env.NO_COLOR === undefined;
}

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
          pending.resolve(null);
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
        pending.resolve("interrupt");
        continue;
      }

      return;
    }
  }

  private readLine(): string | undefined {
    const newlineIndex = this.buffer.indexOf("\n");
    if (newlineIndex === -1) {
      return undefined;
    }

    const line = this.buffer.slice(0, newlineIndex).replace(/\r$/u, "");
    this.buffer = this.buffer.slice(newlineIndex + 1);
    return line;
  }

  private readRevealActionFromBuffer(): RevealAction | undefined {
    if (this.buffer.length === 0) {
      return undefined;
    }

    const character = this.buffer[0];
    this.buffer = this.buffer.slice(1);

    if (character === "\u0003") {
      return "interrupt";
    }

    if (character === "q") {
      return "quit";
    }

    if (character === "\r" || character === "\n" || character === " ") {
      return "reveal";
    }

    return undefined;
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
      readonly resolve: (line: string | null) => void;
    }
  | {
      readonly kind: "reveal";
      readonly resolve: (action: RevealAction | null) => void;
    };
