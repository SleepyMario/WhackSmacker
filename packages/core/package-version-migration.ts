import type { DeckFrameworkVersionIdentity } from "./deck-framework";

export const animalsPreviewPackageId = "com.sleepymario.language.dutch.general.animals.preview-001-100";

export interface LegacyPackageVersionMigration {
  readonly packageId: string;
  readonly legacyPackageVersion: string;
  readonly deckVersion: string;
  readonly artifactRevision: number;
}

export const animalsLegacyVersionMigrations: readonly LegacyPackageVersionMigration[] = Object.freeze([
  Object.freeze({ packageId: animalsPreviewPackageId, legacyPackageVersion: "0.0.0", deckVersion: "0.0.1", artifactRevision: 1 }),
  Object.freeze({ packageId: animalsPreviewPackageId, legacyPackageVersion: "0.0.1", deckVersion: "0.0.1", artifactRevision: 2 }),
  Object.freeze({ packageId: animalsPreviewPackageId, legacyPackageVersion: "0.0.2", deckVersion: "0.0.1", artifactRevision: 3 })
]);

export function legacyPackageVersionMigration(
  packageId: string,
  packageVersion: string,
  plan: readonly LegacyPackageVersionMigration[] = animalsLegacyVersionMigrations
): DeckFrameworkVersionIdentity | undefined {
  const matches = plan.filter((entry) => entry.packageId === packageId && entry.legacyPackageVersion === packageVersion);
  if (matches.length > 1) throw new Error(`Ambiguous legacy package migration for ${packageId} ${packageVersion}.`);
  const match = matches[0];
  return match === undefined ? undefined : { deckVersion: match.deckVersion, artifactRevision: match.artifactRevision };
}

export function assertValidLegacyPackageVersionMigrationPlan(plan: readonly LegacyPackageVersionMigration[]): void {
  const legacyKeys = new Set<string>();
  const immutableKeys = new Set<string>();
  for (const entry of plan) {
    if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/u.test(entry.legacyPackageVersion)
      || !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/u.test(entry.deckVersion)
      || !Number.isSafeInteger(entry.artifactRevision) || entry.artifactRevision < 1) {
      throw new Error("Legacy package migration entries require semantic versions and a positive artifact revision.");
    }
    const legacyKey = `${entry.packageId}@${entry.legacyPackageVersion}`;
    const immutableKey = `${entry.packageId}@${entry.deckVersion}#${entry.artifactRevision}`;
    if (legacyKeys.has(legacyKey)) throw new Error(`Duplicate legacy package migration: ${legacyKey}`);
    if (immutableKeys.has(immutableKey)) throw new Error(`Duplicate migrated immutable identity: ${immutableKey}`);
    legacyKeys.add(legacyKey);
    immutableKeys.add(immutableKey);
  }
}

assertValidLegacyPackageVersionMigrationPlan(animalsLegacyVersionMigrations);
