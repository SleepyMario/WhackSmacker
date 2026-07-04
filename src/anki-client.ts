export interface AnkiConnectResponse<T> {
  result: T;
  error: string | null;
}

export interface CurrentCard {
  cardId: number;
  deckName: string;
  question: string;
  answer: string;
  buttons: number[];
  nextReviews: string[];
}

export class AnkiConnectConnectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AnkiConnectConnectionError";
  }
}

export class AnkiConnectApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AnkiConnectApiError";
  }
}

export class AnkiConnectMalformedResponseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AnkiConnectMalformedResponseError";
  }
}

export class AnkiClient {
  constructor(private readonly endpoint = "http://127.0.0.1:8765") {}

  async invoke<T>(action: string, params: Record<string, unknown> = {}): Promise<T> {
    let response: Response;

    try {
      response = await fetch(this.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          action,
          version: 6,
          params
        })
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new AnkiConnectConnectionError(message);
    }

    if (!response.ok) {
      throw new AnkiConnectConnectionError(`AnkiConnect returned HTTP ${response.status}.`);
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new AnkiConnectMalformedResponseError(`AnkiConnect returned invalid JSON: ${message}`);
    }

    if (!isAnkiConnectResponse(payload)) {
      throw new AnkiConnectMalformedResponseError("AnkiConnect returned an unexpected response shape.");
    }

    if (payload.error !== null) {
      throw new AnkiConnectApiError(payload.error);
    }

    return payload.result as T;
  }

  async version(): Promise<number> {
    const version = await this.invoke<unknown>("version");
    if (!Number.isInteger(version)) {
      throw new AnkiConnectMalformedResponseError("AnkiConnect version response was not an integer.");
    }

    return version as number;
  }

  async deckNames(): Promise<string[]> {
    const deckNames = await this.invoke<unknown>("deckNames");
    if (!Array.isArray(deckNames) || !deckNames.every((deckName) => isValidDeckName(deckName))) {
      throw new AnkiConnectMalformedResponseError("AnkiConnect deckNames response was not a list of deck names.");
    }

    return deckNames;
  }

  guiDeckReview(name: string): Promise<boolean> {
    assertValidDeckName(name);
    return this.invoke<boolean>("guiDeckReview", { name });
  }

  async guiCurrentCard(): Promise<CurrentCard | null> {
    const card = await this.invoke<unknown>("guiCurrentCard");
    if (card === null) {
      return null;
    }

    if (!isCurrentCard(card)) {
      throw new AnkiConnectMalformedResponseError("AnkiConnect guiCurrentCard response was not a valid card.");
    }

    return card;
  }

  async guiShowAnswer(): Promise<boolean> {
    const shown = await this.invoke<unknown>("guiShowAnswer");
    if (typeof shown !== "boolean") {
      throw new AnkiConnectMalformedResponseError("AnkiConnect guiShowAnswer response was not a boolean.");
    }

    return shown;
  }

  async guiAnswerCard(ease: number): Promise<boolean> {
    if (!Number.isInteger(ease) || ease <= 0) {
      throw new AnkiConnectMalformedResponseError("Answer choice must be a positive integer.");
    }

    const answered = await this.invoke<unknown>("guiAnswerCard", { ease });
    if (typeof answered !== "boolean") {
      throw new AnkiConnectMalformedResponseError("AnkiConnect guiAnswerCard response was not a boolean.");
    }

    return answered;
  }
}

export function assertValidDeckName(deckName: string): void {
  if (!isValidDeckName(deckName)) {
    throw new AnkiConnectMalformedResponseError("Deck name must be a non-empty string without control characters.");
  }
}

export function isValidDeckName(deckName: unknown): deckName is string {
  return typeof deckName === "string" && deckName.trim().length > 0 && !/[\u0000-\u001f\u007f]/u.test(deckName);
}

function isAnkiConnectResponse(payload: unknown): payload is AnkiConnectResponse<unknown> {
  return (
    typeof payload === "object" &&
    payload !== null &&
    "result" in payload &&
    "error" in payload &&
    (((payload as AnkiConnectResponse<unknown>).error === null) ||
      typeof (payload as AnkiConnectResponse<unknown>).error === "string")
  );
}

function isCurrentCard(card: unknown): card is CurrentCard {
  const candidate = card as CurrentCard;

  return (
    typeof card === "object" &&
    card !== null &&
    Number.isInteger(candidate.cardId) &&
    isValidDeckName(candidate.deckName) &&
    typeof candidate.question === "string" &&
    typeof candidate.answer === "string" &&
    Array.isArray(candidate.buttons) &&
    candidate.buttons.every((button) => Number.isInteger(button) && button > 0) &&
    Array.isArray(candidate.nextReviews) &&
    candidate.nextReviews.every((nextReview) => typeof nextReview === "string")
  );
}
