import { listInstalledContentPackages, type InstalledPackageRecord } from "./content-package-manager";
import { listReadableContentEntries } from "./content-package-reader";
import { isSafeContentPackagePath } from "./content-package-spec";
import { localized } from "./localized-content";
import { medicalArtworkAllowed } from "./medical-presentation";
import {
  renderMemorizationExercise,
  type RenderedExercise,
  type TopicReviewSidePresentation
} from "./exercise-renderer";
import { projectReviewTextForMode } from "./curriculum-display";
import {
  listInstalledMemorizationItemFiles,
  readInstalledMemorizationItems,
  readInstalledPackageImageAsset,
  type MemorizationItem
} from "./memorization-item";
import { parseMemorizationMarkdownImages } from "./package-media";
import { compareDeckFrameworkVersions } from "./deck-framework";
import {
  defaultReviewProgressDirectoryForContentDataDirectory,
  listDueReviewItems,
  recordStoredReviewOutcome,
  reviewProgressStorePath,
  saveReviewProgressStore,
  loadReviewProgressStore,
  removeReviewProgressForPackage,
  type RecordStoredReviewOutcomeResult
} from "./review-progress-store";
import {
  createInitialReviewState,
  reviewIdentityKey,
  type ReviewItemState,
  type ReviewProgressStore,
  type ReviewRating
} from "./review-scheduler";

export interface ReadingReviewOptions {
  readonly dataDir?: string;
  readonly progressDir?: string;
  readonly packageId?: string;
  readonly packageVersion?: string;
  readonly sourceLocale?: string;
}

export interface ListReadingReviewItemsOptions extends ReadingReviewOptions {
  readonly sourcePath?: string;
}

export interface NextReadingReviewSourceOptions extends ReadingReviewOptions {
  readonly packageId: string;
  readonly sourcePath: string;
}

export interface SyncReadingReviewOptions extends ReadingReviewOptions {
  readonly now: string;
  readonly reviewItems?: readonly ReadingReviewItem[];
}

export interface ListIntegratedDueReviewOptions extends ReadingReviewOptions {
  readonly now: string;
  readonly limit?: number;
}

export interface RenderReadingReviewItemOptions extends ReadingReviewOptions {
  readonly packageId: string;
  readonly sourcePath?: string;
  readonly itemId: string;
  readonly answer?: boolean;
}

export interface RecordReadingReviewAnswerOptions extends ReadingReviewOptions {
  readonly packageId: string;
  readonly sourcePath?: string;
  readonly itemId: string;
  readonly rating: ReviewRating;
  readonly reviewedAt: string;
}

export interface RemoveReadingReviewProgressOptions extends ReadingReviewOptions {
  readonly packageId: string;
  readonly removedAt: string;
}

export interface RemoveReadingReviewProgressResult {
  readonly removedItemCount: number;
  readonly removedEventCount: number;
  readonly progressPath: string;
}

export interface OrderReviewItemsForSessionOptions {
  readonly shuffle?: boolean;
  readonly random?: () => number;
}

export interface ReadingReviewSource {
  readonly packageId: string;
  readonly packageVersion: string;
  readonly sourcePath: string;
  readonly title?: string;
  readonly sourceExists: boolean;
  readonly itemCount: number;
}

export interface ReadingReviewItem {
  readonly packageId: string;
  /** Physical package containing the item and any media; scheduler identity remains packageId. */
  readonly contentPackageId?: string;
  readonly packageVersion: string;
  readonly item: MemorizationItem;
  readonly sourcePath?: string;
  readonly sourceExists?: boolean;
}

export interface SyncReadingReviewResult {
  readonly created: readonly ReviewItemState[];
  readonly materiallyChanged: readonly ReviewItemState[];
  readonly unchanged: readonly ReviewItemState[];
  readonly retired: readonly ReviewItemState[];
  readonly progressPath: string;
  readonly store: ReviewProgressStore;
}

export interface RenderReadingReviewItemResult {
  readonly rendered: RenderedExercise;
  readonly text: string;
}

export interface ResolvedReadingReviewArtwork {
  readonly altText: string;
  readonly assetPath: string;
  readonly assetData: Uint8Array;
  readonly mediaType: "image/webp" | "image/png" | "image/jpeg";
}

export async function listReadingReviewSources(options: ReadingReviewOptions = {}): Promise<readonly ReadingReviewSource[]> {
  const items = await listReadingReviewItems(options);
  return readingReviewSourcesFromItems(items, options.sourceLocale);
}

export function readingReviewSourcesFromItems(items: readonly ReadingReviewItem[], sourceLocale = "en-US"): readonly ReadingReviewSource[] {
  const groups = new Map<string, ReadingReviewSource>();
  for (const item of items) {
    if (item.sourcePath === undefined) {
      continue;
    }
    const key = `${item.packageId}@${item.packageVersion}#${item.sourcePath}`;
    const existing = groups.get(key);
    groups.set(key, {
      packageId: item.packageId,
      packageVersion: item.packageVersion,
      sourcePath: item.sourcePath,
      ...(item.item.source?.title === undefined ? {} : { title: localized(item.item.source.title, sourceLocale) }),
      sourceExists: item.sourceExists === true,
      itemCount: (existing?.itemCount ?? 0) + 1
    });
  }
  return [...groups.values()].sort(compareSources);
}

export async function findNextReadingReviewSource(options: NextReadingReviewSourceOptions): Promise<ReadingReviewSource | undefined> {
  const sources = (await listReadingReviewSources({
    dataDir: options.dataDir,
    packageId: options.packageId,
    packageVersion: options.packageVersion,
    sourceLocale: options.sourceLocale
  })).filter((source) => source.packageId === options.packageId);
  const currentIndex = sources.findIndex(
    (source) =>
      source.sourcePath === options.sourcePath &&
      (options.packageVersion === undefined || source.packageVersion === options.packageVersion)
  );

  return currentIndex < 0 ? undefined : sources[currentIndex + 1];
}

export async function listReadingReviewItems(options: ListReadingReviewItemsOptions = {}): Promise<readonly ReadingReviewItem[]> {
  if (options.sourcePath !== undefined && !isSafeContentPackagePath(options.sourcePath)) {
    throw new Error(`Review source path must be package-relative and safe: ${options.sourcePath}`);
  }

  const packages = await selectInstalledPackages(options);
  const results: ReadingReviewItem[] = [];
  for (const contentPackage of packages) {
    // Core review packages deliberately preserve the legacy reading-package
    // identity namespace so existing scheduler state remains valid after the
    // content is rehomed. relatedPackageIds is informational, not a dependency.
    const identityPackageId = contentPackage.capabilities?.includes("core-review")
      ? (contentPackage.relatedPackageIds?.[0] ?? contentPackage.packageId)
      : contentPackage.packageId;
    const readablePaths = await safeReadablePathSet(contentPackage, options.dataDir);
    for (const file of await listInstalledMemorizationItemFiles(contentPackage.packageId, options.dataDir, contentPackage.packageVersion)) {
      // Package installation and the item collection contract already validate
      // every declared reference. Review resolves and re-verifies the current
      // side's bytes lazily so answer media is not touched before reveal.
      const collection = await readInstalledMemorizationItems(contentPackage.packageId, file.path, options.dataDir, contentPackage.packageVersion, options.sourceLocale, false);
      for (const item of collection.items) {
        const sourcePath = item.source?.path;
        if (options.sourcePath !== undefined && sourcePath !== options.sourcePath) {
          continue;
        }
        results.push({
          packageId: identityPackageId,
          ...(contentPackage.packageId === identityPackageId ? {} : { contentPackageId: contentPackage.packageId }),
          packageVersion: contentPackage.packageVersion,
          item,
          sourcePath,
          sourceExists: sourcePath === undefined ? undefined : readablePaths.has(sourcePath)
        });
      }
    }
  }
  return results.sort(compareItems);
}

export async function resolveReadingReviewArtwork(
  reviewItem: ReadingReviewItem,
  side: "prompt" | "answer",
  options: { readonly dataDir?: string; readonly sourceLocale?: string } = {}
): Promise<ResolvedReadingReviewArtwork | undefined> {
  if (!medicalArtworkAllowed(reviewItem.item, side)) return undefined;
  const block = reviewItem.item[side];
  if (block.mediaType !== "text/markdown") return undefined;
  const markdown = localized(block.text, options.sourceLocale ?? "en-US");
  const references = parseMemorizationMarkdownImages(markdown);
  const reference = references[0];
  if (reference === undefined) return undefined;
  const physicalPackageId = reviewItem.contentPackageId ?? reviewItem.packageId;
  const asset = await readInstalledPackageImageAsset(
    physicalPackageId,
    reviewItem.packageVersion,
    reference.path,
    options.dataDir
  );
  return {
    altText: reference.alt,
    assetPath: asset.assetPath,
    assetData: asset.data,
    mediaType: asset.mediaType
  };
}

export async function syncReadingReviewItems(options: SyncReadingReviewOptions): Promise<SyncReadingReviewResult> {
  const progressDir = resolveIntegrationProgressDir(options.dataDir, options.progressDir);
  const originalStore = await loadReviewProgressStore(progressDir);
  const created: ReviewItemState[] = [];
  const materiallyChanged: ReviewItemState[] = [];
  const unchanged: ReviewItemState[] = [];
  const retired: ReviewItemState[] = [];
  let metadataUpdated = false;
  const reviewItems = options.reviewItems ?? await listReadingReviewItems(options);
  const statesByKey = new Map(originalStore.items.map((state) => [reviewIdentityKey(state), state]));
  const currentV2Keys = new Set<string>();
  const v2PackageIds = new Set<string>();
  for (const reviewItem of reviewItems) {
    const pedagogicalFingerprint = reviewItem.item.schemaVersion === 2 ? reviewItem.item.pedagogicalFingerprint : undefined;
    const state = createInitialReviewState(
      {
        packageId: reviewItem.packageId,
        packageVersion: reviewItem.packageVersion,
        ...(reviewItem.sourcePath === undefined ? {} : { sourcePath: reviewItem.sourcePath }),
        itemId: reviewItem.item.id,
        ...(pedagogicalFingerprint === undefined ? {} : { pedagogicalFingerprint })
      },
      options.now
    );
    const key = reviewIdentityKey(state);
    if (pedagogicalFingerprint !== undefined) {
      currentV2Keys.add(key);
      v2PackageIds.add(reviewItem.packageId);
    }
    const existing = statesByKey.get(key);
    if (existing === undefined || existing.retiredAt !== undefined) {
      created.push(state);
      statesByKey.set(key, state);
      continue;
    }
    if (pedagogicalFingerprint === undefined) continue;
    if (existing.pedagogicalFingerprint !== pedagogicalFingerprint) {
      materiallyChanged.push(state);
      statesByKey.set(key, state);
      continue;
    }
    const preserved = {
      ...existing,
      packageVersion: reviewItem.packageVersion,
      ...(reviewItem.sourcePath === undefined ? {} : { sourcePath: reviewItem.sourcePath })
    };
    metadataUpdated ||= existing.packageVersion !== reviewItem.packageVersion || existing.sourcePath !== reviewItem.sourcePath;
    unchanged.push(preserved);
    statesByKey.set(key, preserved);
  }
  for (const existing of originalStore.items) {
    if (existing.pedagogicalFingerprint === undefined || !v2PackageIds.has(existing.packageId) || currentV2Keys.has(reviewIdentityKey(existing)) || existing.retiredAt !== undefined) continue;
    const retiredState = { ...existing, status: "suspended" as const, retiredAt: options.now };
    retired.push(retiredState);
    statesByKey.set(reviewIdentityKey(retiredState), retiredState);
  }
  const changed = created.length + materiallyChanged.length + retired.length > 0 || metadataUpdated;
  const store: ReviewProgressStore = changed ? {
    ...originalStore,
    updatedAt: options.now,
    items: [...statesByKey.values()].sort(compareIntegratedReviewStates)
  } : originalStore;
  const progressPath = changed ? await saveReviewProgressStore(store, progressDir) : reviewProgressStorePath(progressDir);
  return { created, materiallyChanged, unchanged, retired, progressPath, store };
}

function compareIntegratedReviewStates(left: ReviewItemState, right: ReviewItemState): number {
  const dueOrder = left.nextReviewAt.localeCompare(right.nextReviewAt);
  return dueOrder === 0 ? reviewIdentityKey(left).localeCompare(reviewIdentityKey(right)) : dueOrder;
}

export async function listIntegratedDueReviewItems(options: ListIntegratedDueReviewOptions): Promise<readonly ReviewItemState[]> {
  await syncReadingReviewItems(options);
  const progressDir = resolveIntegrationProgressDir(options.dataDir, options.progressDir);
  const due = await listDueReviewItems({ progressDir, now: options.now, packageId: options.packageId, limit: options.limit });
  return options.packageVersion === undefined ? due : due.filter((item) => item.packageVersion === options.packageVersion);
}

export async function renderReadingReviewItem(options: RenderReadingReviewItemOptions): Promise<RenderReadingReviewItemResult> {
  const reviewItem = await findReadingReviewItem(options);
  const rendered = renderMemorizationExercise({
    packageId: reviewItem.packageId,
    packageVersion: reviewItem.packageVersion,
    itemId: reviewItem.item.id,
    item: reviewItem.item,
    sourceLocale: options.sourceLocale
  });
  return {
    rendered,
    text: formatLearnerReviewExercise(rendered, options.answer === true)
  };
}

function formatLearnerReviewExercise(exercise: RenderedExercise, answerVisible: boolean): string {
  const promptLines = exercise.topicReview === undefined
    ? exercise.promptLines.map((line) => projectReviewTextForMode(line, "normal"))
    : topicReviewSideLines(exercise.topicReview.prompt, false);
  const lines = [exercise.title, "", "Phrase:", ...promptLines.map((line) => `  ${line}`)];
  if (answerVisible) {
    const answerLines = exercise.topicReview === undefined
      ? exercise.answerLines.map((line) => projectReviewTextForMode(line, "normal"))
      : topicReviewSideLines(exercise.topicReview.answer, false);
    lines.push("", "Answer:", ...answerLines.map((line) => `  ${line}`));
    if (exercise.topicReview === undefined && exercise.exampleLines.length > 0) {
      lines.push("", "Examples:", ...exercise.exampleLines.map((line) => `  - ${line}`));
    }
  }
  return `${lines.join("\n").trimEnd()}\n`;
}

export function topicReviewSideLines(side: TopicReviewSidePresentation, artworkRendered: boolean): readonly string[] {
  return [
    ...(artworkRendered ? [] : [`[Image: ${side.media.altText}]`]),
    `• ${side.headword}`,
    `• ${side.exampleSentence}`
  ];
}

export async function recordReadingReviewAnswer(options: RecordReadingReviewAnswerOptions): Promise<RecordStoredReviewOutcomeResult> {
  const reviewItem = await findReadingReviewItem(options);
  const progressDir = resolveIntegrationProgressDir(options.dataDir, options.progressDir);
  return recordStoredReviewOutcome({
    progressDir,
    packageId: reviewItem.packageId,
    packageVersion: reviewItem.packageVersion,
    ...(reviewItem.sourcePath === undefined ? {} : { sourcePath: reviewItem.sourcePath }),
    itemId: reviewItem.item.id,
    ...(reviewItem.item.schemaVersion === 2 ? { pedagogicalFingerprint: reviewItem.item.pedagogicalFingerprint } : {}),
    rating: options.rating,
    reviewedAt: options.reviewedAt
  });
}

export async function removeReadingReviewProgressForPackage(
  options: RemoveReadingReviewProgressOptions
): Promise<RemoveReadingReviewProgressResult> {
  const progressDir = resolveIntegrationProgressDir(options.dataDir, options.progressDir);
  return removeReviewProgressForPackage({
    progressDir,
    packageId: options.packageId,
    packageVersion: options.packageVersion,
    removedAt: options.removedAt
  });
}

export function orderReviewItemsForSession<T>(items: readonly T[], options: OrderReviewItemsForSessionOptions = {}): readonly T[] {
  if (options.shuffle === false) {
    return [...items];
  }
  return shuffleReviewItemsForSession(items, options.random ?? Math.random);
}

export function shuffleReviewItemsForSession<T>(items: readonly T[], random: () => number = Math.random): readonly T[] {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

function resolveIntegrationProgressDir(dataDir?: string, progressDir?: string): string | undefined {
  return progressDir ?? (dataDir === undefined ? undefined : defaultReviewProgressDirectoryForContentDataDirectory(dataDir));
}

async function findReadingReviewItem(options: RenderReadingReviewItemOptions | RecordReadingReviewAnswerOptions): Promise<ReadingReviewItem> {
  const matches = (await listReadingReviewItems(options)).filter(
    (item) =>
      item.packageId === options.packageId &&
      item.item.id === options.itemId &&
      (options.sourcePath === undefined || item.sourcePath === options.sourcePath)
  );
  if (matches.length === 0) {
    throw new Error(`Review item not found: ${options.packageId} ${options.itemId}`);
  }
  return matches[0];
}

async function selectInstalledPackages(options: ReadingReviewOptions): Promise<readonly InstalledPackageRecord[]> {
  const matches = (await listInstalledContentPackages(options.dataDir))
    .filter((record) => record.capabilities?.includes("core-review") || record.capabilities?.includes("topic-review") || record.capabilities?.includes("specialized-review") || (record.capabilities === undefined && record.contentType === "language-curriculum"))
    .filter((record) => options.packageId === undefined || record.packageId === options.packageId || record.relatedPackageIds?.includes(options.packageId))
    .filter((record) => options.packageVersion === undefined || record.packageVersion === options.packageVersion || record.relatedPackageIds?.includes(options.packageId ?? "") === true)
    .sort((left, right) => {
      const packageOrder = left.packageId.localeCompare(right.packageId);
      return packageOrder === 0 ? compareDeckFrameworkVersions(left, right) : packageOrder;
    });
  const newest = new Map<string, InstalledPackageRecord>();
  for (const record of matches) {
    const previous = newest.get(record.packageId);
    if (previous === undefined || compareDeckFrameworkVersions(record, previous) > 0) newest.set(record.packageId, record);
  }
  return [...newest.values()];
}

async function safeReadablePathSet(contentPackage: InstalledPackageRecord, dataDir?: string): Promise<ReadonlySet<string>> {
  try {
    return new Set((await listReadableContentEntries(contentPackage.packageId, dataDir, contentPackage.packageVersion)).map((entry) => entry.path));
  } catch {
    return new Set();
  }
}

function compareSources(left: ReadingReviewSource, right: ReadingReviewSource): number {
  const packageOrder = left.packageId.localeCompare(right.packageId);
  if (packageOrder !== 0) {
    return packageOrder;
  }
  const versionOrder = left.packageVersion.localeCompare(right.packageVersion);
  return versionOrder === 0 ? left.sourcePath.localeCompare(right.sourcePath) : versionOrder;
}

function compareItems(left: ReadingReviewItem, right: ReadingReviewItem): number {
  const packageOrder = left.packageId.localeCompare(right.packageId);
  if (packageOrder !== 0) {
    return packageOrder;
  }
  const versionOrder = left.packageVersion.localeCompare(right.packageVersion);
  return versionOrder === 0 ? left.item.id.localeCompare(right.item.id) : versionOrder;
}
