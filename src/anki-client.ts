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

export class AnkiClient {
  constructor(private readonly endpoint = "http://127.0.0.1:8765") {}

  async invoke<T>(action: string, params: Record<string, unknown> = {}): Promise<T> {
    const response = await fetch(this.endpoint, {
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

    if (!response.ok) {
      throw new Error(`AnkiConnect returned HTTP ${response.status}.`);
    }

    const payload = (await response.json()) as AnkiConnectResponse<T>;
    if (payload.error !== null) {
      throw new Error(payload.error);
    }

    return payload.result;
  }

  version(): Promise<number> {
    return this.invoke<number>("version");
  }

  deckNames(): Promise<string[]> {
    return this.invoke<string[]>("deckNames");
  }

  guiDeckReview(name: string): Promise<boolean> {
    return this.invoke<boolean>("guiDeckReview", { name });
  }

  guiCurrentCard(): Promise<CurrentCard | null> {
    return this.invoke<CurrentCard | null>("guiCurrentCard");
  }
}
