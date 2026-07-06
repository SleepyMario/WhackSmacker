# Backups and Migration

Roadmap Point 10 adds backup, restore, and migration support for WhackSmacker-owned user data.

Content packages are reinstallable content. User progress, installed-package registry data, and settings are user-owned state.

## Backup Contents

Backups include user-owned state only:

- installed package registry: `content/registry.json`;
- native review progress: `progress/review-progress.json`;
- settings: `settings/settings.json`, when present.

Backups do not include:

- installed package directories;
- `.wspkg` archives;
- download caches;
- generated catalogues;
- source curriculum repositories.

The backup includes restore hints for installed packages so the user can see which package IDs and versions may need to be reinstalled.

## Format

The v1 schema is:

```text
schemas/user-data-backup-v1.schema.json
```

Each included section stores:

- fixed section path;
- SHA-256 digest of the section data;
- JSON data.

The backup format is deterministic when `createdAt` is supplied.

## Commands

Create a backup:

```sh
whacksmacker backup create --output backup.json [--data-dir <dir>]
```

Inspect a backup:

```sh
whacksmacker backup inspect backup.json
```

Restore a backup:

```sh
whacksmacker backup restore backup.json [--data-dir <dir>] [--force]
```

Migrate a backup to the current format:

```sh
whacksmacker backup migrate backup.json --output new-backup.json
```

## Restore Rules

Restore validates the backup before writing anything.

Without `--force`, restore refuses to overwrite existing user-state files.

With `--force`, restore replaces only the expected user-state files:

- `registry.json`;
- `review-progress.json`;
- `settings.json`.

Restore does not write into installed package directories or caches.

## Migration

The current backup format version is `1`.

The migration helper currently validates v1 backups and rewrites them in the current deterministic format. Future backup formats can be added without changing package content or review item identity.

Progress identity remains keyed by:

- `packageId`;
- `packageVersion`;
- `itemId`.
