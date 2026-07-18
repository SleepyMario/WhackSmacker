import {
  isReviewDue,
  reviewIdentityKey,
  type ReviewItemIdentity,
  type ReviewItemState
} from "./review-scheduler";

export const reviewDeckMenuStatuses = [
  "not_started",
  "no_cards_to_review",
  "has_cards_to_review",
  "finished"
] as const;

export type ReviewDeckMenuStatus = (typeof reviewDeckMenuStatuses)[number];

export interface ReviewDeckMenuStatusClassification {
  readonly status: ReviewDeckMenuStatus;
  readonly dueCardCount: number;
}

export interface ReviewDeckMenuStatusInput {
  readonly deckId: string;
  readonly cardIdentities: readonly ReviewItemIdentity[];
  readonly savedProgress: readonly ReviewItemState[];
  readonly now: string;
}

/**
 * Projects authoritative saved review state into the one global semantic menu
 * status. It intentionally contains no terminal styling and stores nothing.
 */
export function classifyReviewDeckMenuStatus(input: ReviewDeckMenuStatusInput): ReviewDeckMenuStatusClassification {
  if (input.deckId.trim() === "") throw new Error("Review deck identity is required for menu-status classification.");

  const cardKeys = new Set(input.cardIdentities.map(reviewIdentityKey));
  const deckStates = input.savedProgress.filter((state) => cardKeys.has(reviewIdentityKey(state)));
  const stateKeys = new Set(deckStates.map(reviewIdentityKey));
  const missingNewCount = input.cardIdentities.filter((identity) => !stateKeys.has(reviewIdentityKey(identity))).length;
  const hasReviewProgress = deckStates.some(hasGenuineReviewActivity);
  const dueCardCount = deckStates.filter((state) => isReviewDue(state, input.now)).length + missingNewCount;

  if (isReviewDeckFinished(input.cardIdentities, deckStates)) {
    return { status: "finished", dueCardCount: 0 };
  }
  if (hasReviewProgress && dueCardCount > 0) {
    return { status: "has_cards_to_review", dueCardCount };
  }
  if (hasReviewProgress) {
    return { status: "no_cards_to_review", dueCardCount: 0 };
  }
  return { status: "not_started", dueCardCount: 0 };
}

export function hasGenuineReviewActivity(state: ReviewItemState): boolean {
  return state.reviewCount > 0 || state.lastReviewedAt !== undefined || state.status !== "new";
}

/** Existing canonical completion semantics: every current deck card is suspended. */
export function isReviewDeckFinished(
  cardIdentities: readonly ReviewItemIdentity[],
  deckStates: readonly ReviewItemState[]
): boolean {
  if (cardIdentities.length === 0 || deckStates.length !== cardIdentities.length) return false;
  const cardKeys = new Set(cardIdentities.map(reviewIdentityKey));
  return deckStates.every((state) => cardKeys.has(reviewIdentityKey(state)) && state.status === "suspended");
}
