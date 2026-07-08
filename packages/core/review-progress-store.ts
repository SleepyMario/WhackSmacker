import { listInstalledContentPackages, resolveContentDataDirectory, type InstalledPackageRecord } from "./content-package-manager";
import { readInstalledMemorizationItems, listInstalledMemorizationItemFiles } from "./memorization-item";
import {
  assertValidReviewProgressStore,
  createInitialReviewState,
  emptyReviewProgressStore,
  isReviewRating,
  listDueReviewStates,
  recordReviewOutcome,
  reviewIdentityKey,
  reviewProgressFormatVersion,
  upsertReviewItemState,
  type ReviewItemIdentity,
  type ReviewItemState,
  type ReviewProgressStore,
  type ReviewRating,
  type ReviewEvent
} from "./review-scheduler";

type BufferValue = {
  toString(encoding: "utf8"): string;
};

declare function require(name: "node:fs/promises"): {
  mkdir(path: string, options: { recursive: boolean }): Promise<void>;
  readFile(path: string): Promise<BufferValue>;
  writeFile(path: string, data: string): Promise<void>;
};
declare function require(name: "node:path"): {
  dirname(path: string): string;
  join(...paths: string[]): string;
  relative(from: string, to: string): string;
  resolve(...paths: string[]): string;
};
declare const process: {
  env: Record<string, string | undefined>;
};

const { mkdir, readFile, writeFile } = require("node:fs/promises");
const { dirname, join, relative, resolve } = require("node:path");

export interface SyncReviewProgressOptions {
  readonly contentDataDir?: string;
  readonly progressDir?: string;
  readonly now: string;
}

export interface ListDueReviewItemsOptions {
  readonly progressDir?: string;
  readonly now: string;
  readonly packageId?: string;
  readonly limit?: number;
}

export interface RecordStoredReviewOutcomeOptions extends ReviewItemIdentity {
  readonly progressDir?: string;
  readonly reviewedAt: string;
  readonly rating: ReviewRating;
}

export interface RecordStoredReviewOutcomeResult {
  readonly state: ReviewItemState;
  readonly event: ReviewEvent;
  readonly progressPath: string;
}

export interface RemoveReviewProgressForPackageOptions {
  readonly progressDir?: string;
  readonly packageId: string;
  readonly packageVersion?: string;
  readonly removedAt: string;
}

export interface RemoveReviewProgressForPackageResult {
  readonly removedItemCount: number;
  readonly removedEventCount: number;
  readonly progressPath: string;
}

export interface SyncReviewProgressResult {
  readonly created: readonly ReviewItemState[];
  readonly store: ReviewProgressStore;
  readonly progressPath: string;
}

export function resolveReviewProgressDirectory(progressDir?: string, env = process.env): string {
  if (progressDir !== undefined && progressDir.trim().length > 0) {
    return resolve(progressDir);
  }

  const xdgDataHome = env.XDG_DATA_HOME;
  if (xdgDataHome !== undefined && xdgDataHome.trim().length > 0) {
    return join(xdgDataHome, "whacksmacker", "progress");
  }

  const home = env.HOME;
  if (home === undefined || home.trim().length === 0) {
    throw new Error("Cannot resolve review progress directory without HOME or XDG_DATA_HOME. Use an explicit progress directory.");
  }
  return join(home, ".local", "share", "whacksmacker", "progress");
}

export function reviewProgressStorePath(progressDir?: string): string {
  return join(resolveReviewProgressDirectory(progressDir), "review-progress.json");
}

export async function loadReviewProgressStore(progressDir?: string): Promise<ReviewProgressStore> {
  const path = reviewProgressStorePath(progressDir);
  try {
    const store = JSON.parse((await readFile(path)).toString("utf8")) as unknown;
    assertValidReviewProgressStore(store);
    return store;
  } catch (error) {
    if (isMissingFileError(error)) {
      return emptyReviewProgressStore("1970-01-01T00:00:00Z");
    }
    throw error;
  }
}

export async function saveReviewProgressStore(store: ReviewProgressStore, progressDir?: string): Promise<string> {
  assertValidReviewProgressStore(store);
  const directory = resolveReviewProgressDirectory(progressDir);
  const path = join(directory, "review-progress.json");
  ensureInside(directory, path);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(store, null, 2)}\n`);
  return path;
}

export async function syncReviewProgressFromInstalledMemorizationItems(options: SyncReviewProgressOptions): Promise<SyncReviewProgressResult> {
  const installed = await listInstalledContentPackages(options.contentDataDir);
  const existing = await loadReviewProgressStore(options.progressDir);
  let store = existing;
  const created: ReviewItemState[] = [];

  for (const contentPackage of installed) {
    for (const file of await listInstalledMemorizationItemFiles(contentPackage.packageId, options.contentDataDir, contentPackage.packageVersion)) {
      const collection = await readInstalledMemorizationItems(contentPackage.packageId, file.path, options.contentDataDir, contentPackage.packageVersion);
      for (const item of collection.items) {
        const identity = toIdentity(contentPackage, item.id, item.source?.path);
        if (store.items.some((state) => reviewIdentityKey(state) === reviewIdentityKey(identity))) {
          continue;
        }
        const state = createInitialReviewState(identity, options.now);
        created.push(state);
        store = upsertReviewItemState(store, state, options.now);
      }
    }
  }

  const progressPath = created.length === 0 ? reviewProgressStorePath(options.progressDir) : await saveReviewProgressStore(store, options.progressDir);
  return { created, store, progressPath };
}

export async function listDueReviewItems(options: ListDueReviewItemsOptions): Promise<readonly ReviewItemState[]> {
  const store = await loadReviewProgressStore(options.progressDir);
  return listDueReviewStates(store.items, options.now, { packageId: options.packageId, limit: options.limit });
}

export async function recordStoredReviewOutcome(options: RecordStoredReviewOutcomeOptions): Promise<RecordStoredReviewOutcomeResult> {
  if (!isReviewRating(options.rating)) {
    throw new Error(`Invalid review rating: ${String(options.rating)}`);
  }
  const store = await loadReviewProgressStore(options.progressDir);
  const identity: ReviewItemIdentity = {
    packageId: options.packageId,
    packageVersion: options.packageVersion,
    ...(options.sourcePath === undefined ? {} : { sourcePath: options.sourcePath }),
    itemId: options.itemId
  };
  const current = store.items.find((state) => reviewIdentityKey(state) === reviewIdentityKey(identity)) ?? createInitialReviewState(identity, options.reviewedAt);
  const outcome = recordReviewOutcome(current, options.rating, options.reviewedAt);
  const updated = upsertReviewItemState(store, outcome.state, options.reviewedAt, outcome.event);
  const progressPath = await saveReviewProgressStore(updated, options.progressDir);
  return { ...outcome, progressPath };
}

export async function removeReviewProgressForPackage(
  options: RemoveReviewProgressForPackageOptions
): Promise<RemoveReviewProgressForPackageResult> {
  const store = await loadReviewProgressStore(options.progressDir);
  const keepItem = (state: ReviewItemState): boolean => !matchesPackage(state, options.packageId, options.packageVersion);
  const keepEvent = (event: ReviewEvent): boolean => !matchesPackage(event, options.packageId, options.packageVersion);
  const items = store.items.filter(keepItem);
  const events = store.events.filter(keepEvent);
  const removedItemCount = store.items.length - items.length;
  const removedEventCount = store.events.length - events.length;
  const progressPath = await saveReviewProgressStore({
    reviewProgressFormatVersion,
    updatedAt: options.removedAt,
    items,
    events
  }, options.progressDir);
  return { removedItemCount, removedEventCount, progressPath };
}

function toIdentity(contentPackage: InstalledPackageRecord, itemId: string, sourcePath?: string): ReviewItemIdentity {
  return {
    packageId: contentPackage.packageId,
    packageVersion: contentPackage.packageVersion,
    ...(sourcePath === undefined ? {} : { sourcePath }),
    itemId
  };
}

function matchesPackage(
  identity: Pick<ReviewItemIdentity, "packageId" | "packageVersion">,
  packageId: string,
  packageVersion?: string
): boolean {
  return identity.packageId === packageId && (packageVersion === undefined || identity.packageVersion === packageVersion);
}

function ensureInside(root: string, path: string): void {
  const relativePath = relative(root, path);
  if (relativePath === "" || relativePath.startsWith("..") || relativePath.includes("\\")) {
    if (path !== root) {
      throw new Error(`Review progress path escapes progress directory: ${path}`);
    }
  }
}

function isMissingFileError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}

export function defaultReviewProgressDirectoryForContentDataDirectory(contentDataDir: string): string {
  return join(dirname(resolveContentDataDirectory(contentDataDir)), "progress");
}

export { reviewProgressFormatVersion };
