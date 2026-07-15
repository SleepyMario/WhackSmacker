declare function require(name: "node:crypto"): {
  createHash(algorithm: "sha256"): {
    update(data: string, encoding: "utf8"): { digest(encoding: "hex"): string };
  };
};

const { createHash } = require("node:crypto");

export interface PedagogicalContent {
  readonly prompt: unknown;
  readonly acceptedAnswers: readonly unknown[];
  readonly testedMeaning: unknown;
  readonly direction: string;
  readonly cardType: string;
  readonly requiredCanonicalIds: readonly string[];
  readonly distractors: readonly unknown[];
  readonly expectedInterpretation: unknown;
}

/** Faithful runtime implementation of the curriculum-builder fingerprint contract. */
export function pedagogicalFingerprint(content: PedagogicalContent): string {
  const canonical = JSON.stringify(normalizePedagogicalValue(content));
  return createHash("sha256").update(canonical, "utf8").digest("hex");
}

export function normalizePedagogicalValue(value: unknown): unknown {
  if (typeof value === "string") return value.normalize("NFC").trim().replace(/\s+/gu, " ");
  if (Array.isArray(value)) {
    return value
      .map(normalizePedagogicalValue)
      .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
  }
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.keys(value).sort().map((key) => [key, normalizePedagogicalValue(value[key])])
    );
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
