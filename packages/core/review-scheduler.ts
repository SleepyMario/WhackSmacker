import { isContentPackageId, isSafeContentPackagePath, isSemver } from "./content-package-spec";

export const reviewProgressFormatVersion = 1;
export const reviewRatings = ["again", "hard", "good", "easy"] as const;
export const reviewStatuses = ["new", "learning", "review", "suspended"] as const;

export type ReviewRating = (typeof reviewRatings)[number];
export type ReviewStatus = (typeof reviewStatuses)[number];

export interface ReviewItemIdentity {
  readonly packageId: string;
  readonly packageVersion: string;
  readonly sourcePath?: string;
  readonly itemId: string;
}

export interface ReviewItemState extends ReviewItemIdentity {
  readonly firstSeenAt: string;
  readonly lastReviewedAt?: string;
  readonly nextReviewAt: string;
  readonly reviewCount: number;
  readonly lapseCount: number;
  readonly intervalDays: number;
  readonly easeFactor: number;
  readonly status: ReviewStatus;
}

export interface ReviewStateSummary {
  readonly nextReviewAt: string;
  readonly reviewCount: number;
  readonly lapseCount: number;
  readonly intervalDays: number;
  readonly easeFactor: number;
  readonly status: ReviewStatus;
}

export interface ReviewEvent extends ReviewItemIdentity {
  readonly reviewedAt: string;
  readonly rating: ReviewRating;
  readonly previousState: ReviewStateSummary;
  readonly nextState: ReviewStateSummary;
}

export interface ReviewProgressStore {
  readonly reviewProgressFormatVersion: 1;
  readonly updatedAt: string;
  readonly items: readonly ReviewItemState[];
  readonly events: readonly ReviewEvent[];
}

export interface ReviewProgressValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
}

export interface RecordReviewOutcomeResult {
  readonly state: ReviewItemState;
  readonly event: ReviewEvent;
}

export function createInitialReviewState(identity: ReviewItemIdentity, now: string): ReviewItemState {
  assertValidReviewIdentity(identity);
  assertValidTimestamp(now, "now");
  return {
    ...identity,
    firstSeenAt: now,
    nextReviewAt: now,
    reviewCount: 0,
    lapseCount: 0,
    intervalDays: 0,
    easeFactor: 2.5,
    status: "new"
  };
}

export function isReviewDue(state: ReviewItemState, now: string): boolean {
  assertValidTimestamp(now, "now");
  return state.status !== "suspended" && Date.parse(state.nextReviewAt) <= Date.parse(now);
}

export function listDueReviewStates(
  states: readonly ReviewItemState[],
  now: string,
  options: { readonly packageId?: string; readonly limit?: number } = {}
): readonly ReviewItemState[] {
  assertValidTimestamp(now, "now");
  if (options.limit !== undefined && (!Number.isSafeInteger(options.limit) || options.limit < 1)) {
    throw new Error("Review due limit must be a positive integer.");
  }
  return states
    .filter((state) => (options.packageId === undefined || state.packageId === options.packageId) && isReviewDue(state, now))
    .sort(compareReviewStates)
    .slice(0, options.limit);
}

export function recordReviewOutcome(state: ReviewItemState, rating: ReviewRating, reviewedAt: string): RecordReviewOutcomeResult {
  assertValidReviewItemState(state, "state");
  if (!isReviewRating(rating)) {
    throw new Error(`Invalid review rating: ${String(rating)}`);
  }
  assertValidTimestamp(reviewedAt, "reviewedAt");

  const next = scheduleNextState(state, rating, reviewedAt);
  return {
    state: next,
    event: {
      packageId: state.packageId,
      packageVersion: state.packageVersion,
      ...(state.sourcePath === undefined ? {} : { sourcePath: state.sourcePath }),
      itemId: state.itemId,
      reviewedAt,
      rating,
      previousState: summarizeState(state),
      nextState: summarizeState(next)
    }
  };
}

export function validateReviewProgressStore(store: unknown): ReviewProgressValidationResult {
  const errors: string[] = [];
  if (!isRecord(store)) {
    return { valid: false, errors: ["Review progress store must be a JSON object."] };
  }
  if (store.reviewProgressFormatVersion !== reviewProgressFormatVersion) {
    errors.push(`Unsupported reviewProgressFormatVersion: ${String(store.reviewProgressFormatVersion)}`);
  }
  validateTimestamp(store.updatedAt, "updatedAt", errors);
  validateStates(store.items, errors);
  validateEvents(store.events, errors);
  return { valid: errors.length === 0, errors };
}

export function assertValidReviewProgressStore(store: unknown): asserts store is ReviewProgressStore {
  const result = validateReviewProgressStore(store);
  if (!result.valid) {
    throw new Error(`Invalid review progress store:\n${result.errors.join("\n")}`);
  }
}

export function emptyReviewProgressStore(updatedAt: string): ReviewProgressStore {
  assertValidTimestamp(updatedAt, "updatedAt");
  return { reviewProgressFormatVersion, updatedAt, items: [], events: [] };
}

export function upsertReviewItemState(
  store: ReviewProgressStore,
  state: ReviewItemState,
  updatedAt: string,
  event?: ReviewEvent
): ReviewProgressStore {
  assertValidReviewProgressStore(store);
  assertValidReviewItemState(state, "state");
  assertValidTimestamp(updatedAt, "updatedAt");
  if (event !== undefined) {
    assertValidReviewEvent(event, "event");
  }

  const key = reviewIdentityKey(state);
  const items = store.items.filter((candidate) => reviewIdentityKey(candidate) !== key);
  items.push(state);
  items.sort(compareReviewStates);
  const events = event === undefined ? [...store.events] : [...store.events, event].sort(compareReviewEvents);
  return { reviewProgressFormatVersion, updatedAt, items, events };
}

export function reviewIdentityKey(identity: ReviewItemIdentity): string {
  return `${identity.packageId}@${identity.packageVersion}#${identity.sourcePath ?? ""}#${identity.itemId}`;
}

export function isReviewRating(value: unknown): value is ReviewRating {
  return typeof value === "string" && reviewRatings.includes(value as ReviewRating);
}

export function isSafeReviewItemId(value: string): boolean {
  return /^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))(?!.*\\)(?!.*\/\/)[a-z0-9](?:[a-z0-9._/-]*[a-z0-9])?$/u.test(value);
}

function scheduleNextState(state: ReviewItemState, rating: ReviewRating, reviewedAt: string): ReviewItemState {
  const easeFactor = nextEaseFactor(state.easeFactor, rating);
  const intervalDays = nextIntervalDays(state, rating, easeFactor);
  return {
    ...state,
    lastReviewedAt: reviewedAt,
    nextReviewAt: addDays(reviewedAt, intervalDays),
    reviewCount: state.reviewCount + 1,
    lapseCount: rating === "again" ? state.lapseCount + 1 : state.lapseCount,
    intervalDays,
    easeFactor,
    status: rating === "again" ? "learning" : "review"
  };
}

function nextEaseFactor(current: number, rating: ReviewRating): number {
  const delta = rating === "again" ? -0.2 : rating === "hard" ? -0.15 : rating === "easy" ? 0.15 : 0;
  return round(Math.max(1.3, current + delta), 2);
}

function nextIntervalDays(state: ReviewItemState, rating: ReviewRating, easeFactor: number): number {
  if (rating === "again") {
    return 10 / 1440;
  }
  if (rating === "hard") {
    return state.intervalDays <= 0 ? 1 : Math.max(1, Math.ceil(state.intervalDays * 1.2));
  }
  if (rating === "easy") {
    return state.intervalDays <= 0 ? 4 : Math.max(4, Math.ceil(state.intervalDays * (easeFactor + 1)));
  }
  return state.intervalDays <= 0 ? 2 : Math.max(2, Math.ceil(state.intervalDays * easeFactor));
}

function summarizeState(state: ReviewItemState): ReviewStateSummary {
  return {
    nextReviewAt: state.nextReviewAt,
    reviewCount: state.reviewCount,
    lapseCount: state.lapseCount,
    intervalDays: state.intervalDays,
    easeFactor: state.easeFactor,
    status: state.status
  };
}

function compareReviewStates(left: ReviewItemState, right: ReviewItemState): number {
  const dueOrder = left.nextReviewAt.localeCompare(right.nextReviewAt);
  return dueOrder === 0 ? reviewIdentityKey(left).localeCompare(reviewIdentityKey(right)) : dueOrder;
}

function compareReviewEvents(left: ReviewEvent, right: ReviewEvent): number {
  const timeOrder = left.reviewedAt.localeCompare(right.reviewedAt);
  return timeOrder === 0 ? reviewIdentityKey(left).localeCompare(reviewIdentityKey(right)) : timeOrder;
}

function validateStates(value: unknown, errors: string[]): void {
  const keys = new Set<string>();
  if (!Array.isArray(value)) {
    errors.push("items must be an array.");
    return;
  }
  for (const [index, state] of value.entries()) {
    const field = `items[${index}]`;
    validateReviewItemState(state, field, errors);
    if (isRecord(state)) {
      const key = reviewIdentityKey({
        packageId: readString(state.packageId),
        packageVersion: readString(state.packageVersion),
        sourcePath: state.sourcePath === undefined ? undefined : readString(state.sourcePath),
        itemId: readString(state.itemId)
      });
      if (keys.has(key)) {
        errors.push(`Duplicate review item state: ${key}`);
      }
      keys.add(key);
    }
  }
}

function validateEvents(value: unknown, errors: string[]): void {
  if (!Array.isArray(value)) {
    errors.push("events must be an array.");
    return;
  }
  for (const [index, event] of value.entries()) {
    validateReviewEvent(event, `events[${index}]`, errors);
  }
}

function assertValidReviewIdentity(identity: ReviewItemIdentity): void {
  const errors: string[] = [];
  validateIdentity(identity, "identity", errors);
  if (errors.length > 0) {
    throw new Error(errors.join("\n"));
  }
}

function assertValidReviewItemState(state: unknown, field: string): void {
  const errors: string[] = [];
  validateReviewItemState(state, field, errors);
  if (errors.length > 0) {
    throw new Error(errors.join("\n"));
  }
}

function assertValidReviewEvent(event: unknown, field: string): void {
  const errors: string[] = [];
  validateReviewEvent(event, field, errors);
  if (errors.length > 0) {
    throw new Error(errors.join("\n"));
  }
}

function validateReviewItemState(value: unknown, field: string, errors: string[]): void {
  if (!isRecord(value)) {
    errors.push(`${field} must be an object.`);
    return;
  }
  validateIdentity(value, field, errors);
  validateTimestamp(value.firstSeenAt, `${field}.firstSeenAt`, errors);
  if (value.lastReviewedAt !== undefined) {
    validateTimestamp(value.lastReviewedAt, `${field}.lastReviewedAt`, errors);
  }
  validateTimestamp(value.nextReviewAt, `${field}.nextReviewAt`, errors);
  validateNonNegativeInteger(value.reviewCount, `${field}.reviewCount`, errors);
  validateNonNegativeInteger(value.lapseCount, `${field}.lapseCount`, errors);
  validateNonNegativeNumber(value.intervalDays, `${field}.intervalDays`, errors);
  validateNonNegativeNumber(value.easeFactor, `${field}.easeFactor`, errors);
  if (!reviewStatuses.includes(readString(value.status) as ReviewStatus)) {
    errors.push(`${field}.status must be one of: ${reviewStatuses.join(", ")}.`);
  }
}

function validateReviewEvent(value: unknown, field: string, errors: string[]): void {
  if (!isRecord(value)) {
    errors.push(`${field} must be an object.`);
    return;
  }
  validateIdentity(value, field, errors);
  validateTimestamp(value.reviewedAt, `${field}.reviewedAt`, errors);
  if (!isReviewRating(value.rating)) {
    errors.push(`${field}.rating must be one of: ${reviewRatings.join(", ")}.`);
  }
  validateStateSummary(value.previousState, `${field}.previousState`, errors);
  validateStateSummary(value.nextState, `${field}.nextState`, errors);
}

function validateStateSummary(value: unknown, field: string, errors: string[]): void {
  if (!isRecord(value)) {
    errors.push(`${field} must be an object.`);
    return;
  }
  validateTimestamp(value.nextReviewAt, `${field}.nextReviewAt`, errors);
  validateNonNegativeInteger(value.reviewCount, `${field}.reviewCount`, errors);
  validateNonNegativeInteger(value.lapseCount, `${field}.lapseCount`, errors);
  validateNonNegativeNumber(value.intervalDays, `${field}.intervalDays`, errors);
  validateNonNegativeNumber(value.easeFactor, `${field}.easeFactor`, errors);
  if (!reviewStatuses.includes(readString(value.status) as ReviewStatus)) {
    errors.push(`${field}.status must be one of: ${reviewStatuses.join(", ")}.`);
  }
}

function validateIdentity(value: Record<string, unknown> | ReviewItemIdentity, field: string, errors: string[]): void {
  if (!isContentPackageId(readString(value.packageId))) {
    errors.push(`${field}.packageId must use package ID syntax.`);
  }
  if (!isSemver(readString(value.packageVersion))) {
    errors.push(`${field}.packageVersion must use MAJOR.MINOR.PATCH Semantic Versioning.`);
  }
  if (value.sourcePath !== undefined && !isSafeContentPackagePath(readString(value.sourcePath))) {
    errors.push(`${field}.sourcePath must be package-relative and safe.`);
  }
  if (!isSafeReviewItemId(readString(value.itemId))) {
    errors.push(`${field}.itemId must be stable, package-relative, and safe.`);
  }
}

function validateTimestamp(value: unknown, field: string, errors: string[]): void {
  const text = readString(value);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/u.test(text) || Number.isNaN(Date.parse(text))) {
    errors.push(`${field} must be an ISO 8601 UTC timestamp.`);
  }
}

function assertValidTimestamp(value: string, field: string): void {
  const errors: string[] = [];
  validateTimestamp(value, field, errors);
  if (errors.length > 0) {
    throw new Error(errors.join("\n"));
  }
}

function validateNonNegativeInteger(value: unknown, field: string, errors: string[]): void {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    errors.push(`${field} must be a non-negative integer.`);
  }
}

function validateNonNegativeNumber(value: unknown, field: string, errors: string[]): void {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    errors.push(`${field} must be a non-negative number.`);
  }
}

function addDays(timestamp: string, days: number): string {
  return new Date(Date.parse(timestamp) + Math.round(days * 86400000)).toISOString().replace(/\.\d{3}Z$/u, "Z");
}

function round(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function readString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
