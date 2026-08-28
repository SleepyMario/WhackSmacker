import { compareDeckFrameworkVersions } from "./deck-framework";

export const knownDeckFamilies = ["general", "specialized"] as const;

export type DeckFamily = (typeof knownDeckFamilies)[number];

export interface DeckFamilyPackageRecord {
  readonly packageId: string;
  readonly packageVersion: string;
  readonly deckVersion?: string;
  readonly artifactRevision?: number;
  readonly displayName: string;
  readonly contentType?: string;
  readonly deckFamily?: DeckFamily;
  readonly topic?: import("./content-package-spec").ContentPackageTopicMetadata;
  readonly relatedPackageIds?: readonly string[];
}

export interface DeckFamilyPackageMetadata {
  readonly packageId: string;
  readonly packageVersion: string;
  readonly deckVersion?: string;
  readonly artifactRevision?: number;
  readonly contentType?: string;
  readonly deckFamily?: DeckFamily;
  readonly relatedPackageIds?: readonly string[];
}

export interface DeckFamilyReviewSourceDisplay {
  readonly authoritativeTitle?: string;
  readonly fallbackLabel: string;
}

export interface DeckFamilyPackageMenuPresentation {
  readonly packageLabel: string;
  readonly sourceLabels: readonly string[];
}

export function isDeckFamily(value: unknown): value is DeckFamily {
  return typeof value === "string" && knownDeckFamilies.includes(value as DeckFamily);
}

export function reconcileInstalledDeckFamilyMetadata<T extends DeckFamilyPackageRecord>(
  installedPackages: readonly T[],
  currentPackageMetadata: readonly DeckFamilyPackageMetadata[]
): readonly T[] {
  return installedPackages.map((installed) => {
    if (installed.deckFamily !== undefined) return installed;

    const matches = currentPackageMetadata.filter((metadata) =>
      metadata.packageId === installed.packageId
        && metadata.packageVersion === installed.packageVersion
        && isDeckFamily(metadata.deckFamily)
        && hasExactLanguageAssociations(metadata.relatedPackageIds)
        && (metadata.contentType === undefined || metadata.contentType === installed.contentType)
    );
    if (matches.length !== 1) return installed;

    const [metadata] = matches;
    return {
      ...installed,
      deckFamily: metadata.deckFamily,
      relatedPackageIds: metadata.relatedPackageIds
    };
  });
}

export function packagesForLanguageAndDeckFamily<T extends DeckFamilyPackageRecord>(
  packages: readonly T[],
  languagePackageId: string,
  deckFamily: DeckFamily
): readonly T[] {
  const newestByPackageId = new Map<string, T>();

  for (const candidate of packages) {
    if (candidate.deckFamily !== deckFamily || candidate.relatedPackageIds?.includes(languagePackageId) !== true) {
      continue;
    }
    const current = newestByPackageId.get(candidate.packageId);
    if (current === undefined || compareDeckFrameworkVersions(candidate, current) > 0) {
      newestByPackageId.set(candidate.packageId, candidate);
    }
  }

  return [...newestByPackageId.values()].sort((left, right) =>
    left.displayName.localeCompare(right.displayName)
      || left.packageId.localeCompare(right.packageId)
      || compareDeckFrameworkVersions(right, left)
  );
}

export function deckFamilyPackageMenuPresentation(
  packageDisplayName: string,
  reviewSources: readonly DeckFamilyReviewSourceDisplay[],
  singleSourceActionLabel: string
): DeckFamilyPackageMenuPresentation {
  const soleSource = reviewSources.length === 1 ? reviewSources[0] : undefined;
  if (soleSource?.authoritativeTitle !== undefined && soleSource.authoritativeTitle.length > 0) {
    return {
      packageLabel: soleSource.authoritativeTitle,
      sourceLabels: [singleSourceActionLabel]
    };
  }

  return {
    packageLabel: packageDisplayName,
    sourceLabels: reviewSources.map((source) => source.authoritativeTitle ?? source.fallbackLabel)
  };
}

function hasExactLanguageAssociations(value: readonly string[] | undefined): value is readonly string[] {
  return value !== undefined
    && value.length > 0
    && value.every((packageId) => packageId.trim().length > 0)
    && new Set(value).size === value.length;
}
