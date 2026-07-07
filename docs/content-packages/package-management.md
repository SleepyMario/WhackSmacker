# Content Package Management

Roadmap Point 4 adds local management for `.wspkg` archives described by a content package catalogue.

It does not add a reader, memorization schema, scheduler, progress database, or Anki migration.

Installed packages are now the documented primary runtime path for WhackSmacker curriculum and terminology content. Source repositories remain canonical, `.wspkg` files are generated artifacts, installed package directories are read-only local content, and user progress/settings remain outside package directories.

## Storage Layout

By default on Linux, WhackSmacker stores content package data in:

```text
$XDG_DATA_HOME/whacksmacker/content
```

If `XDG_DATA_HOME` is not set, it falls back to:

```text
~/.local/share/whacksmacker/content
```

Development and tests may override this with:

```text
--data-dir <path>
```

The content data directory uses this layout:

```text
<content-data-dir>/
├── registry.json
├── cache/
│   └── downloads/
└── packages/
    └── <package-id>/
        └── <package-version>/
            ├── manifest.json
            ├── content/
            ├── assets/
            └── docs/
```

Installed package files are treated as read-only content. User progress and settings are not stored in `packages/`.

## Catalogue Versus Registry

A catalogue describes packages that are available to fetch or install.

The installed-package registry records package versions already installed on the local machine.

Neither file stores user progress, review history, scheduler state, settings, completion state, or memorization state.

## Install Flow

Installation loads a catalogue, fetches a package archive, verifies archive size and SHA-256, validates the manifest, checks manifest identity against the catalogue, verifies declared file checksums, extracts into staging, atomically moves staging into `packages/<package-id>/<package-version>/`, and updates `registry.json`.

The exact package ID and version are not reinstalled by default. Use `--force` to replace an existing installed version.

## Update Flow

Update detection compares installed package versions with package versions available in a catalogue.

`content update <package-id>` installs the newest available SemVer version for that package. Older installed versions are preserved.

Migration metadata and user-progress migration are later roadmap work.

## Remove Flow

Removal deletes the selected installed package version and removes its registry entry.

When multiple versions are installed, removal requires `--version <version>` or `--all`.

Removing a package does not delete user progress. Full progress storage is a later roadmap point, but package management deliberately avoids storing progress in package directories.

## Commands

```sh
whacksmacker content available --catalogue <catalogue.json>
whacksmacker content install <package-id> --catalogue <catalogue.json> [--version <version>] [--data-dir <dir>] [--force]
whacksmacker content installed [--data-dir <dir>]
whacksmacker content updates --catalogue <catalogue.json> [--data-dir <dir>]
whacksmacker content update <package-id> --catalogue <catalogue.json> [--data-dir <dir>]
whacksmacker content remove <package-id> --version <version> [--data-dir <dir>]
```

## Development Flow

```text
source repositories -> .wspkg files -> local catalogue JSON -> local installed packages
```

Reading installed content begins in Roadmap Point 5 and remains passive. Reading progress is not recorded in package directories.

Local development example:

```sh
npm run generate-content-package -- \
  --target linguistic-terminology \
  --target korean-curriculum \
  --target chinese-curriculum \
  --target vietnamese-curriculum \
  --output-dir /tmp/whacksmacker-packages \
  --generated-at 2026-07-06T00:00:00Z

npm run content:catalogue -- \
  --packages-dir /tmp/whacksmacker-packages \
  --output /tmp/whacksmacker-catalogue/catalogue.json

whacksmacker content available --catalogue /tmp/whacksmacker-catalogue/catalogue.json
whacksmacker content install com.sleepymario.language.korean --catalogue /tmp/whacksmacker-catalogue/catalogue.json
whacksmacker content install com.sleepymario.language.chinese --catalogue /tmp/whacksmacker-catalogue/catalogue.json
whacksmacker content install com.sleepymario.language.vietnamese --catalogue /tmp/whacksmacker-catalogue/catalogue.json
whacksmacker content install com.sleepymario.language.linguistic-terminology --catalogue /tmp/whacksmacker-catalogue/catalogue.json
whacksmacker content installed
whacksmacker language korean --file units/introduction-to-hangul/README.md
whacksmacker content read com.sleepymario.language.korean --file units/korean-core/chapter-015-basic-life-sentences-15/chapter.md
whacksmacker content read com.sleepymario.language.korean --file review-decks/chapter-001-005/cards.tsv
whacksmacker content read com.sleepymario.language.korean --file review-decks/chapter-006-010/cards.tsv
whacksmacker content read com.sleepymario.language.korean --file review-decks/chapter-011-015/cards.tsv
whacksmacker content read com.sleepymario.language.chinese --file review-decks/pinyin-zhuyin/cards.tsv
whacksmacker content read com.sleepymario.language.chinese --file review-decks/pinyin-zhuyin-with-tones/cards.tsv
whacksmacker content read com.sleepymario.language.vietnamese --file units/vietnamese-core/chapter-005-basic-sentences-5/chapter.md
whacksmacker content read com.sleepymario.language.vietnamese --file review-decks/chapter-001-005/cards.tsv
whacksmacker review sources --package com.sleepymario.language.korean
whacksmacker review items --package com.sleepymario.language.korean --source review-decks/chapter-001-005/cards.tsv
whacksmacker review items --package com.sleepymario.language.korean --source review-decks/chapter-006-010/cards.tsv
whacksmacker review items --package com.sleepymario.language.korean --source review-decks/chapter-011-015/cards.tsv
whacksmacker review sources --package com.sleepymario.language.chinese
whacksmacker review items --package com.sleepymario.language.chinese --source review-decks/pinyin-zhuyin/cards.tsv
whacksmacker review items --package com.sleepymario.language.chinese --source review-decks/pinyin-zhuyin-with-tones/cards.tsv
whacksmacker review sources --package com.sleepymario.language.vietnamese
whacksmacker review items --package com.sleepymario.language.vietnamese --source review-decks/chapter-001-005/cards.tsv
whacksmacker language terms --file terms/phonetics-and-phonology.md
```

The installed Korean package exposes the Chapter 1-5, Chapter 6-10, and Chapter 11-15 review decks. The installed Chinese - Mandarin package exposes the Pinyin-Zhuyin and Pinyin-Zhuyin with Tones conversion decks. The installed Vietnamese package exposes the Chapter 1-5 review deck. Korean and Vietnamese packages do not generate full grammar-pattern cards into vocabulary/function-word review decks.
