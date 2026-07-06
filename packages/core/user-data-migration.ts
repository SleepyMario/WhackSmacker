export const userDataBackupFormatVersion = 1;

export interface UserDataBackupMigrationResult {
  readonly migrated: boolean;
  readonly backup: unknown;
}

export function migrateUserDataBackupToLatest(backup: unknown): UserDataBackupMigrationResult {
  if (typeof backup !== "object" || backup === null || Array.isArray(backup)) {
    throw new Error("Backup must be a JSON object before migration.");
  }
  if (!("backupFormatVersion" in backup)) {
    throw new Error("Backup is missing backupFormatVersion.");
  }
  if (backup.backupFormatVersion === userDataBackupFormatVersion) {
    return { migrated: false, backup };
  }
  throw new Error(`Unsupported backupFormatVersion: ${String(backup.backupFormatVersion)}`);
}

export function assertLatestUserDataBackupVersion(backup: unknown): void {
  const result = migrateUserDataBackupToLatest(backup);
  if (result.migrated) {
    throw new Error("Unexpected migration result for latest backup format.");
  }
}
