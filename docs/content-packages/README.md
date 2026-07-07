# Downloadable Content Packages

Roadmap Points 1 through 12 define the WhackSmacker downloadable content package specification, development package generator, local package catalogue, local package management, passive installed-content reading, the package-authored memorization item schema, native review scheduling state, terminal exercise rendering, reading-to-review integration, user-data backups, Anki parity audit coverage, and removal of the old Anki-backed review path.

Native package-based review is now the only active review workflow.

Installed content packages are the documented primary path for WhackSmacker curriculum and terminology content. Canonical source repositories remain the source of truth, generated `.wspkg` files are installable artifacts, installed packages are local read-only content, and user progress/settings remain separate.

## Fundamental Rule

WhackSmacker owns the learning engine, package management, user settings, and user progress. Downloadable content packages own learning content.

The application, downloaded package content, and user progress/settings remain separate.

## Defined Now

- package container format;
- package filename convention;
- required archive layout;
- manifest fields;
- package identity and versioning;
- source and generator provenance;
- compatibility fields;
- dependencies;
- file integrity metadata;
- content entry points;
- asset handling;
- package immutability;
- stable content identifier rules;
- update compatibility expectations;
- security restrictions;
- deterministic-generation requirements;
- separation between package content and user progress;
- local package catalogue format;
- local catalogue generation from existing `.wspkg` archives;
- local package fetch, install, update, remove, and registry management;
- passive reading of installed package text content;
- memorization item schema and validation helpers;
- native review progress storage and deterministic scheduling helpers;
- terminal-safe memorization item exercise rendering;
- reading-source to review-item discovery and terminal review commands;
- backup, restore, inspect, and migration support for user-owned state;
- Anki parity audit history for native memorization, rendering, scheduling, due-listing, and backup behavior;
- native-only review routing with the old Anki deck command removed.

## Generator Targets

Roadmap Point 2 supports these deterministic generator targets:

| Target | Package ID | Source repository |
|---|---|---|
| `linguistic-terminology` | `com.sleepymario.language.linguistic-terminology` | `/home/ashwin/Projects/whacksmacker-modules/linguistic-terminology` |
| `korean-curriculum` | `com.sleepymario.language.korean` | `/home/ashwin/Projects/whacksmacker-modules/korean-curriculum` |
| `chinese-curriculum` | `com.sleepymario.language.chinese` | `/home/ashwin/Projects/whacksmacker-modules/chinese-curriculum` |
| `vietnamese-curriculum` | `com.sleepymario.language.vietnamese` | `/home/ashwin/Projects/whacksmacker-modules/vietnamese-curriculum` |

Do not assume the old source paths under `/home/ashwin/Projects/languages`.

For local development, generate packages into a temporary output directory:

```sh
npm run generate-content-package -- \
  --target linguistic-terminology \
  --target korean-curriculum \
  --target chinese-curriculum \
  --target vietnamese-curriculum \
  --output-dir /tmp/whacksmacker-packages \
  --generated-at 2026-07-06T00:00:00Z
```

The generator emits `.wspkg` archives only. It does not install packages.

## Local Catalogue

Roadmap Point 3 supports local catalogue generation from existing package archives:

```sh
npm run content:catalogue -- \
  --packages-dir /tmp/whacksmacker-packages \
  --output /tmp/whacksmacker-catalogue/catalogue.json
```

Then install and read content through the WhackSmacker CLI:

```sh
whacksmacker content available --catalogue /tmp/whacksmacker-catalogue/catalogue.json
whacksmacker content install com.sleepymario.language.korean --catalogue /tmp/whacksmacker-catalogue/catalogue.json
whacksmacker content install com.sleepymario.language.chinese --catalogue /tmp/whacksmacker-catalogue/catalogue.json
whacksmacker content install com.sleepymario.language.vietnamese --catalogue /tmp/whacksmacker-catalogue/catalogue.json
whacksmacker content install com.sleepymario.language.linguistic-terminology --catalogue /tmp/whacksmacker-catalogue/catalogue.json
whacksmacker content installed
whacksmacker language korean
whacksmacker language korean --file units/introduction-to-hangul/README.md
whacksmacker language terms
whacksmacker language terms --file terms/phonetics-and-phonology.md
```

Development flow:

```text
Point 2:
source repositories -> .wspkg files

Point 3:
.wspkg files -> local catalogue JSON
```

The catalogue describes available package archives. It is not:

- a package manifest;
- an installed-package registry;
- a user-progress database;
- a download cache;
- a canonical curriculum or terminology repository.

Bundled/static content that remains in the repository is a temporary fallback, compatibility layer, historical bridge, or emergency offline path. It is not canonical and should not be treated as the primary content flow.

Point 4 uses catalogues for local package fetch, install, update, and remove behavior. It still does not render or read installed content.

Point 5 reads installed package text content without writing user progress.

Point 6 defines package-authored reviewable item data.

Point 7 stores WhackSmacker-owned review progress outside installed package directories and calculates deterministic next-review times.

Point 8 renders memorization items into separated prompt and answer text for terminal review surfaces.

Point 9 connects installed reading content to reviewable memorization items and native review progress.

Point 10 backs up and restores user-owned state without including installed package content or caches.

Point 11 verified that legacy Anki front/back and simple cloze-like cards could be represented by native memorization items, rendered as terminal exercises, scheduled by native review state, surfaced as due items, and protected by user-data backups.

Point 12 removes the old Anki-backed review path. `whacksmacker review` now refers only to native package review subcommands.

## Not Defined Yet

- subject-specific content schemas;
- answer grading behavior.

## Files

- [Roadmap](roadmap.md)
- [Post-Roadmap Audit](post-roadmap-audit.md)
- [Remaining Bundled Content Audit](remaining-bundled-content-audit.md)
- [Architecture](architecture.md)
- [Package Format v1](package-format-v1.md)
- [Security](security.md)
- [Package Management](package-management.md)
- [Reading Interface](reading-interface.md)
- [Memorization Items](memorization-items.md)
- [Native Review Scheduler](../review-scheduler.md)
- [Exercise Renderers](../exercise-renderers.md)
- [Reading to Review](../reading-to-review.md)
- [Backups and Migration](../backups-and-migration.md)
- [Anki Parity](../anki-parity.md)
- [Memorization Item Schema](../../schemas/memorization-item-v1.schema.json)
- [Review Progress Schema](../../schemas/review-progress-v1.schema.json)
- [User Data Backup Schema](../../schemas/user-data-backup-v1.schema.json)
- [Manifest Schema](../../schemas/content-package-manifest-v1.schema.json)
- [Catalogue Schema](../../schemas/content-package-catalogue-v1.schema.json)
- [Korean example manifest](examples/korean-manifest.example.json)
- [Linguistic Terminology example manifest](examples/linguistic-terminology-manifest.example.json)
- [Local catalogue example](examples/local-catalogue.example.json)
