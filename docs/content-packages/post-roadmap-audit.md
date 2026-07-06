# Post-Roadmap Content System Audit

Date: 2026-07-06

This audit records the implemented state of the WhackSmacker content-package and native-review work after the 12-point roadmap. It is based on the current codebase, current tests, and the recent Git history.

The first end-to-end installed-content validation is recorded in [Installed Content Package E2E Audit](installed-content-e2e.md).

The current module workspace root is:

```text
/home/ashwin/Projects/whacksmacker-modules
```

Do not assume old source paths under:

```text
/home/ashwin/Projects/languages
```

The current content-package generator targets use sibling repositories of the WhackSmacker repository under the module workspace, such as `../linguistic-terminology` and `../korean-curriculum` when run from `/home/ashwin/Projects/whacksmacker-modules/whacksmacker`.

## Roadmap Commits

The implemented roadmap sequence in Git history is:

| Commit | Roadmap point |
|---|---|
| `3d9a9df` | Define downloadable content package specification |
| `658b16e` | Implement downloadable content package generator |
| `a796147` | Add local content package catalogue |
| `7613d06` | Add content package install management |
| `4d717c6` | Add installed content reading interface |
| `7178481` | Add memorization item schema |
| `aa1d538` | Add native review scheduler |
| `7941d2a` | Add terminal exercise renderers |
| `f1e435c` | Add reading to review integration |
| `2cead58` | Add user data backup and migration support |
| `4745332` | Add Anki parity coverage |
| `8e618eb` | Remove legacy Anki review path |

## Implemented State

### 1. Content-Package System

WhackSmacker now has a package format for `.wspkg` archives, a manifest schema, package identity and SemVer version validation, source and generator provenance, dependency records, content entry points, declared file metadata, file integrity checks, package immutability expectations, and safety rules for package-relative paths.

The package system separates the application, installed content, and user progress. Installed package content is treated as immutable, while review progress, settings, and backup data remain outside package directories.

### 2. Package Generation

The generator can build deterministic `.wspkg` archives for the initial targets:

- `linguistic-terminology` -> `com.sleepymario.language.linguistic-terminology`
- `korean-curriculum` -> `com.sleepymario.language.korean`

Generation snapshots selected Markdown and repository files into `content/content.json` using the `whacksmacker-source-markdown-snapshot-v1` shape, records source commit and dirty-state metadata, records the WhackSmacker generator commit, validates the generated manifest, and writes a deterministic archive.

This is still a development package generator, not a full release pipeline. It does not generate subject-specific review items for every curriculum source, and it does not install or publish packages.

### 3. Local Catalogues

Local catalogues are implemented as JSON records that describe available package archives. They include catalogue identity, package identity and versions, display metadata, source metadata, archive URL, archive size, and archive SHA-256 checksum.

The catalogue tooling can generate a catalogue from existing `.wspkg` files and validate catalogue structure. Catalogues are not installed-package registries, caches, package manifests, or user-progress stores.

### 4. Install, Update, and Remove

Package management can list available packages from a catalogue, install packages from `file://` and `https://` archive URLs, verify archive size and SHA-256 checksums, inspect and validate manifests before extraction, reject unsafe archive paths, install files into immutable package-version directories, maintain an installed-package registry, detect newer SemVer versions, install updates, list installed packages, and remove installed package versions.

Installation is local and terminal-driven. Dependency resolution is still minimal; dependency records exist, but there is no complete dependency solver or remote package service.

### 5. Reading Interface

The reading interface discovers installed readable packages through the installed-package registry, lists readable entries, reads Markdown, plain text, and JSON entries, renders terminal text output, and supports snapshot packages produced by the current generator.

Reading is intentionally passive. It does not write reading progress into installed packages, and it is currently a terminal-oriented interface rather than a rich reader UI.

### 6. Memorization Schema

The memorization item schema supports package-authored review data for item collections and item kinds including `basic-card`, `cloze`, `vocabulary`, `sentence`, and `concept`. It validates stable item IDs, prompts, answers, hints, notes, tags, source paths, language metadata, difficulty metadata, and identity between rendered output and item IDs.

The schema explicitly keeps scheduler progress and provider-specific fields out of package-authored content. It defines reviewable data, not a full answer-grading or authoring system.

### 7. Native Scheduler

The native scheduler and progress store create WhackSmacker-owned review state for installed memorization items. Progress is keyed by package ID, package version, and item ID, stored outside installed content, and validated by a review-progress schema.

The scheduler supports deterministic initialization, due filtering, rating updates, next-review timestamps, stored review outcomes, and progress persistence. It is intentionally simple and deterministic; it is not an exact Anki scheduler clone.

### 8. Exercise Renderers

Terminal exercise renderers exist for `basic-card`, `cloze`, `vocabulary`, `sentence`, and `concept` items. They can render prompt-only, answer-only, and full formatted terminal output while preserving item identity and avoiding package or progress mutation.

This remains terminal-safe rendering. There is no web exercise UI, fuzzy answer checking, or rich interaction layer in this roadmap state.

### 9. Reading-to-Review Integration

Reading-to-review integration can discover memorization item files in installed packages, group items by source reading path, list review sources, list items by source, sync discovered items into native scheduler progress, list due items, render prompts and answers, and record review ratings through terminal commands.

Current generated Korean and Linguistic Terminology packages are source Markdown snapshots. They are readable after installation, but they do not automatically provide review progress unless package-authored memorization item files are present.

### 10. Backup and Migration

Backup support can create, inspect, restore, and migrate WhackSmacker-owned user data. Backups cover registry data, review progress, optional settings, deterministic section checksums, and restore hints.

Backups intentionally omit package directories and caches by default. Restore protects existing user-state files unless force is requested, and migration helpers preserve native progress identity.

### 11. Anki Parity Coverage

Anki parity coverage means the native package system was tested against the essential behavior WhackSmacker previously relied on from Anki: stable front/back-like memorization data, simple cloze-style cards, terminal rendering, native progress state, due listing, review outcomes, and backup coverage.

It does not mean exact Anki scheduler parity, automatic migration from Anki decks, package generation from Anki exports, or a requirement for a running Anki instance.

### 12. Removed Legacy Anki Paths

The old AnkiConnect-backed review path was removed. The repository no longer contains the old Anki language CLI, Anki client, card renderer, compatibility source shim, or Anki client/card renderer tests that existed before `8e618eb`.

The old deck-review command shape no longer resolves. `whacksmacker review` now routes to native package review subcommands such as `sources`, `items`, `due`, `show`, and `answer`.

## Current Rough Edges

- The package generator currently covers the initial Linguistic Terminology and Korean Curriculum source snapshots only.
- Generated source snapshot packages are readable but do not automatically produce memorization item files.
- Installed Korean and installed Linguistic Terminology browsing paths have been manually validated in the local end-to-end package flow, but they remain terminal-oriented and should still be covered by future release checklist runs.
- The native review flow is terminal-oriented and command-oriented.
- Answer grading is not implemented beyond explicit review ratings.
- Dependency metadata exists, but full dependency resolution is not implemented.
- Some docs still describe point-local historical limitations and should be reviewed so readers understand what is historical versus current.
- Bundled snapshots may still exist for compatibility or offline display and should only be removed when installed-package replacements are proven safe.
- There is no release checklist dedicated to the post-Anki native system.
- The module workspace does not currently have a lightweight index repository; that may or may not be worth adding later.

## Next Cleanup Phase

- Repeat the installed Korean package flow during release checks.
- Repeat the installed Linguistic Terminology package flow during release checks.
- Remove or deprecate stale bundled snapshots only when installed-package replacements are safe for normal use.
- Clean up old docs that imply Anki is still primary or that package work is still pending.
- Ensure all content generators and documentation use `/home/ashwin/Projects/whacksmacker-modules` and no longer assume `/home/ashwin/Projects/languages`.
- Create a release checklist for the post-Anki native system.
- Decide whether the module workspace needs a lightweight index repo later.
