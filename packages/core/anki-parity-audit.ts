import {
  formatRenderedExercise,
  renderMemorizationExercise,
  type RenderedExercise
} from "./exercise-renderer";
import {
  memorizationItemSchemaVersion,
  validateMemorizationItem,
  type MemorizationItem
} from "./memorization-item";
import {
  createInitialReviewState,
  recordReviewOutcome,
  type ReviewItemState
} from "./review-scheduler";

export interface LegacyAnkiCardSnapshot {
  readonly cardId: number;
  readonly deckName: string;
  readonly question: string;
  readonly answer: string;
  readonly tags?: readonly string[];
  readonly cloze?: boolean;
}

export interface NativeAnkiParityOptions {
  readonly packageId: string;
  readonly packageVersion: string;
  readonly reviewedAt: string;
}

export interface AnkiParityCheck {
  readonly name: string;
  readonly status: "pass" | "fail";
  readonly detail?: string;
}

export interface AnkiParityAuditResult {
  readonly valid: boolean;
  readonly checks: readonly AnkiParityCheck[];
  readonly nativeItem: MemorizationItem;
  readonly rendered: RenderedExercise;
  readonly promptText: string;
  readonly answerText: string;
  readonly initialState: ReviewItemState;
  readonly reviewedState: ReviewItemState;
}

export function createNativeMemorizationItemFromAnkiCard(
  card: LegacyAnkiCardSnapshot
): MemorizationItem {
  assertValidLegacyCard(card);
  const itemKind = isClozeCard(card) ? "cloze" : "basic-card";
  const tags = normalizeTags(card.tags ?? []);
  return {
    schemaVersion: memorizationItemSchemaVersion,
    id: `legacy-anki/${slug(card.deckName)}/${card.cardId}`,
    kind: itemKind,
    prompt: {
      text: card.question,
      mediaType: "text/plain"
    },
    answer: {
      text: card.answer,
      mediaType: "text/plain"
    },
    ...(tags.length > 0 ? { tags } : {}),
    notes: `Legacy Anki deck: ${card.deckName}`
  };
}

export function runAnkiParityAudit(
  card: LegacyAnkiCardSnapshot,
  options: NativeAnkiParityOptions
): AnkiParityAuditResult {
  const nativeItem = createNativeMemorizationItemFromAnkiCard(card);
  const itemValidation = validateMemorizationItem(nativeItem);
  const rendered = renderMemorizationExercise({
    packageId: options.packageId,
    packageVersion: options.packageVersion,
    itemId: nativeItem.id,
    item: nativeItem
  });
  const promptText = formatRenderedExercise(rendered, "prompt");
  const answerText = formatRenderedExercise(rendered, "answer");
  const initialState = createInitialReviewState(
    {
      packageId: options.packageId,
      packageVersion: options.packageVersion,
      itemId: nativeItem.id
    },
    options.reviewedAt
  );
  const reviewedState = recordReviewOutcome(initialState, "good", options.reviewedAt).state;
  const checks: AnkiParityCheck[] = [
    {
      name: "native memorization item validates",
      status: itemValidation.valid ? "pass" : "fail",
      detail: itemValidation.errors.join("\n") || undefined
    },
    {
      name: "legacy front maps to native prompt",
      status: rendered.promptLines.join("\n").includes(card.question.replace(/\{\{c\d*::([^}:]+)(?:::[^}]+)?\}\}/gu, "[...]")) ? "pass" : "fail"
    },
    {
      name: "legacy back maps to native answer",
      status: rendered.answerLines.join("\n").includes(card.answer) ? "pass" : "fail"
    },
    {
      name: "native prompt and answer are separated",
      status: promptText.includes("Prompt") && !promptText.includes("\nAnswer\n") && answerText.includes("Answer") && !answerText.includes("\nPrompt\n") ? "pass" : "fail"
    },
    {
      name: "native scheduler records review state",
      status: reviewedState.reviewCount === 1 && reviewedState.lastReviewedAt === options.reviewedAt ? "pass" : "fail"
    }
  ];
  return {
    valid: checks.every((check) => check.status === "pass"),
    checks,
    nativeItem,
    rendered,
    promptText,
    answerText,
    initialState,
    reviewedState
  };
}

function assertValidLegacyCard(card: LegacyAnkiCardSnapshot): void {
  if (!Number.isSafeInteger(card.cardId) || card.cardId < 1) {
    throw new Error("Legacy Anki card ID must be a positive integer.");
  }
  for (const [field, value] of [
    ["deckName", card.deckName],
    ["question", card.question],
    ["answer", card.answer]
  ] as const) {
    if (value.trim().length === 0) {
      throw new Error(`Legacy Anki ${field} must be non-empty.`);
    }
  }
}

function isClozeCard(card: LegacyAnkiCardSnapshot): boolean {
  return card.cloze === true || /\{\{c\d*::[^}]+\}\}/u.test(card.question);
}

function slug(value: string): string {
  const text = value.toLowerCase().replace(/[^a-z0-9]+/gu, "-").replace(/^-+|-+$/gu, "");
  return text.length === 0 ? "deck" : text;
}

function normalizeTags(tags: readonly string[]): readonly string[] {
  const normalized = tags
    .map((tag) => tag.toLowerCase().replace(/[^a-z0-9._-]+/gu, "-").replace(/^-+|-+$/gu, ""))
    .filter((tag) => tag.length > 0);
  return [...new Set(normalized)].sort((left, right) => left.localeCompare(right));
}
