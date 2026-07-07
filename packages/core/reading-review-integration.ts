import { listInstalledContentPackages, type InstalledPackageRecord } from "./content-package-manager";
import { listReadableContentEntries } from "./content-package-reader";
import { isSafeContentPackagePath } from "./content-package-spec";
import { formatRenderedExercise, renderMemorizationExercise, type RenderedExercise } from "./exercise-renderer";
import { listInstalledMemorizationItemFiles, readInstalledMemorizationItems, type MemorizationItem } from "./memorization-item";
import {
  defaultReviewProgressDirectoryForContentDataDirectory,
  listDueReviewItems,
  recordStoredReviewOutcome,
  reviewProgressStorePath,
  saveReviewProgressStore,
  loadReviewProgressStore,
  type RecordStoredReviewOutcomeResult
} from "./review-progress-store";
import {
  createInitialReviewState,
  reviewIdentityKey,
  upsertReviewItemState,
  type ReviewItemState,
  type ReviewRating
} from "./review-scheduler";

export interface ReadingReviewOptions {
  readonly dataDir?: string;
  readonly progressDir?: string;
  readonly packageId?: string;
  readonly packageVersion?: string;
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
}

export interface ListIntegratedDueReviewOptions extends ReadingReviewOptions {
  readonly now: string;
  readonly limit?: number;
}

export interface RenderReadingReviewItemOptions extends ReadingReviewOptions {
  readonly packageId: string;
  readonly itemId: string;
  readonly answer?: boolean;
}

export interface RecordReadingReviewAnswerOptions extends ReadingReviewOptions {
  readonly packageId: string;
  readonly itemId: string;
  readonly rating: ReviewRating;
  readonly reviewedAt: string;
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
  readonly packageVersion: string;
  readonly item: MemorizationItem;
  readonly sourcePath?: string;
  readonly sourceExists?: boolean;
}

export interface SyncReadingReviewResult {
  readonly created: readonly ReviewItemState[];
  readonly progressPath: string;
}

export interface RenderReadingReviewItemResult {
  readonly rendered: RenderedExercise;
  readonly text: string;
}

export async function listReadingReviewSources(options: ReadingReviewOptions = {}): Promise<readonly ReadingReviewSource[]> {
  const items = await listReadingReviewItems(options);
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
      ...(item.item.source?.title === undefined ? {} : { title: item.item.source.title }),
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
    packageVersion: options.packageVersion
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
    const readablePaths = await safeReadablePathSet(contentPackage, options.dataDir);
    for (const file of await listInstalledMemorizationItemFiles(contentPackage.packageId, options.dataDir, contentPackage.packageVersion)) {
      const collection = await readInstalledMemorizationItems(contentPackage.packageId, file.path, options.dataDir, contentPackage.packageVersion);
      for (const item of collection.items) {
        const sourcePath = item.source?.path;
        if (options.sourcePath !== undefined && sourcePath !== options.sourcePath) {
          continue;
        }
        results.push({
          packageId: contentPackage.packageId,
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

export async function syncReadingReviewItems(options: SyncReadingReviewOptions): Promise<SyncReadingReviewResult> {
  const progressDir = resolveIntegrationProgressDir(options.dataDir, options.progressDir);
  let store = await loadReviewProgressStore(progressDir);
  const created: ReviewItemState[] = [];
  for (const reviewItem of await listReadingReviewItems(options)) {
    const state = createInitialReviewState(
      {
        packageId: reviewItem.packageId,
        packageVersion: reviewItem.packageVersion,
        itemId: reviewItem.item.id
      },
      options.now
    );
    if (store.items.some((existing) => reviewIdentityKey(existing) === reviewIdentityKey(state))) {
      continue;
    }
    created.push(state);
    store = upsertReviewItemState(store, state, options.now);
  }
  const progressPath = created.length === 0 ? reviewProgressStorePath(progressDir) : await saveReviewProgressStore(store, progressDir);
  return { created, progressPath };
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
    item: reviewItem.item
  });
  return {
    rendered,
    text: formatRenderedExercise(rendered, options.answer === true ? "full" : "prompt")
  };
}

export async function recordReadingReviewAnswer(options: RecordReadingReviewAnswerOptions): Promise<RecordStoredReviewOutcomeResult> {
  const reviewItem = await findReadingReviewItem(options);
  const progressDir = resolveIntegrationProgressDir(options.dataDir, options.progressDir);
  return recordStoredReviewOutcome({
    progressDir,
    packageId: reviewItem.packageId,
    packageVersion: reviewItem.packageVersion,
    itemId: reviewItem.item.id,
    rating: options.rating,
    reviewedAt: options.reviewedAt
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
  const matches = (await listReadingReviewItems(options)).filter((item) => item.packageId === options.packageId && item.item.id === options.itemId);
  if (matches.length === 0) {
    throw new Error(`Review item not found: ${options.packageId} ${options.itemId}`);
  }
  return matches[0];
}

async function selectInstalledPackages(options: ReadingReviewOptions): Promise<readonly InstalledPackageRecord[]> {
  return (await listInstalledContentPackages(options.dataDir))
    .filter((record) => options.packageId === undefined || record.packageId === options.packageId)
    .filter((record) => options.packageVersion === undefined || record.packageVersion === options.packageVersion)
    .sort((left, right) => {
      const packageOrder = left.packageId.localeCompare(right.packageId);
      return packageOrder === 0 ? left.packageVersion.localeCompare(right.packageVersion) : packageOrder;
    });
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
