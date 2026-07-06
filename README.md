# WhackSmacker

WhackSmacker is a modular learning and utility application. The current command-line application uses native downloadable content packages, native memorization items, native review progress, and terminal review commands.

Milestone: `v0.001`

Package version: `0.0.1`

Future Git tag after manual validation: `v0.0.1`

## Prerequisites

- Node.js 18 or newer.

## Install

For local development:

```sh
npm install
npm run build
npm link
```

After linking, the executable is:

```sh
whacksmacker
wsm
```

For a no-publish package smoke test:

```sh
npm pack
npm install -g ./whacksmacker-0.0.1.tgz
whacksmacker --help
npm uninstall -g whacksmacker
```

Do not publish this milestone to npm.

## Usage

Open the interactive module menu:

```sh
whacksmacker
wsm
```

Print command usage:

```sh
whacksmacker help
whacksmacker --help
wsm help
```

Installed Korean curriculum content and language terminology are available through domain-prefixed commands:

```sh
whacksmacker language korean [--file <path>] [--version <version>] [--data-dir <dir>]
whacksmacker language terms [<group>] [--file <path>] [--version <version>] [--data-dir <dir>]
whacksmacker language terminology [--search <text>] [--category <name>] [--id <stable-id>]
```

The Korean command discovers the installed `com.sleepymario.language.korean` content package and lists Hangul Foundation readable entries. If the package is not installed, it prints a native package-install message instead of using any Anki-backed state.

The `language terms` command discovers the installed `com.sleepymario.language.linguistic-terminology` content package and lists readable glossary source files. Use `language terminology` for the bundled searchable snapshot.

The interactive Language menu groups this content under `Linguistic Terms`, with `General` first and language-specific groups below it.

The linguistic terminology command displays a bundled snapshot from the standalone `linguistic-terminology` repository. The canonical glossary remains separate, and packaged WhackSmacker does not need the sibling repository or a network connection at runtime.

Native review uses installed content packages:

```sh
whacksmacker review sources --data-dir ~/.local/share/whacksmacker/content
whacksmacker review items --package com.sleepymario.language.korean
whacksmacker review due --package com.sleepymario.language.korean
whacksmacker review show com.sleepymario.language.korean <item-id> --answer
whacksmacker review answer com.sleepymario.language.korean <item-id> --rating good
```

The old Anki-backed `whacksmacker review <deck-name>` shape has been removed. Reviewable content now comes from installed packages, and review progress is stored separately from package content.

## Architecture

WhackSmacker is structured as an umbrella application with application surfaces in `apps/` and reusable packages in `packages/`.

```text
apps/
  cli/
  desktop/
packages/
  core/
  language/
  chess/
  geography/
  mathematics/
  storage/
```

Only `apps/cli` exists today. `apps/desktop` is a planned application surface and is not implemented in v0.001.

Domain modules and provider integrations are separate concepts:

- `language` is the domain for installed language curriculum content and linguistic terminology.
- `chess` is the domain for future board, move, FEN, PGN, engine, tablebase, and opening interfaces.
- `stockfish`, `syzygy`, and `lichess` are future chess provider features.
- `geography` is the domain for future datasets, locations, maps, and quiz interfaces.
- `mathematics` is the domain for future topics, exercises, proofs, and quiz interfaces.

Feature names follow a Gentoo USE-style model:

- Domain features: `language`, `chess`, `geography`, `mathematics`
- Provider and integration features: `lichess`, `stockfish`, `syzygy`
- Application surfaces: `cli`, `desktop`

Dependency boundaries:

- Apps may depend on packages.
- Domain packages may depend on `packages/core` and `packages/storage` contracts.
- `packages/core` contains only shared contracts and must not depend on domain packages.
- Domain packages must not depend directly on one another.
- Provider integrations live behind their owning domain package, not in the application shell.

Current package responsibilities:

- `packages/core`: module registration contracts, feature configuration types, profile/application-data paths, logging interfaces, CLI command registration contracts, and shared UI contracts.
- `packages/language`: bundled linguistic terminology and language CLI commands.
- `packages/chess`: placeholder chess interfaces and clean module registration; no user commands yet.
- `packages/geography`: placeholder geography interfaces and clean module registration; no user commands yet.
- `packages/mathematics`: placeholder mathematics interfaces and clean module registration; no user commands yet.
- `packages/storage`: shared storage/path abstractions only; no domain schemas.

Potential future local data layout:

```text
~/.local/share/whacksmacker/
  profile.sqlite
  language.sqlite
  chess.sqlite
  geography.sqlite
  mathematics.sqlite
```

The shared profile database may eventually contain enabled modules, general application settings, and profile metadata. Each domain database remains independently owned and migrated by its domain module.

## Development

Build:

```sh
npm run build
```

Run tests:

```sh
npm test
```

Run the built CLI directly:

```sh
node dist/main.js --help
```

Generate development `.wspkg` archives for the currently supported content-package targets:

```sh
npm run generate-content-package -- --target linguistic-terminology --target korean-curriculum --output-dir packages-output
```

This only creates package archives. It does not install, catalogue, download, or render package content.

Generate a local package catalogue from existing `.wspkg` archives:

```sh
npm run content:catalogue -- --packages-dir packages-output --output packages-output/catalogue.json
```

This only lists available package archives. It does not download, install, extract, or read package content.

Manage content packages from a catalogue:

```sh
whacksmacker content available --catalogue packages-output/catalogue.json
whacksmacker content install com.sleepymario.language.korean --catalogue packages-output/catalogue.json
whacksmacker content installed
whacksmacker content updates --catalogue packages-output/catalogue.json
whacksmacker content remove com.sleepymario.language.korean --version 0.1.0
```

Installed package content remains separate from user progress and settings.

Read installed package content:

```sh
whacksmacker content read
whacksmacker content files com.sleepymario.language.korean
whacksmacker content read com.sleepymario.language.korean --file units/hangul-foundation/README.md
whacksmacker language korean
whacksmacker language korean --file units/hangul-foundation/README.md
whacksmacker language terms
whacksmacker language terms general
whacksmacker language terms korean
whacksmacker language terms --file INDEX.md
```

Content packages may also declare reviewable memorization items using the v1 schema in `schemas/memorization-item-v1.schema.json`. WhackSmacker stores native review progress separately using `schemas/review-progress-v1.schema.json`; installed package content remains read-only.

Terminal exercise renderers can display memorization items as separated prompt and answer text. They do not grade answers or create a full native review session yet.

Connect installed reading content to native review items:

```sh
whacksmacker review sources --data-dir ~/.local/share/whacksmacker/content
whacksmacker review items --package com.sleepymario.language.korean
whacksmacker review due --package com.sleepymario.language.korean
whacksmacker review show com.sleepymario.language.korean <item-id> --answer
whacksmacker review answer com.sleepymario.language.korean <item-id> --rating good
```

Back up user-owned state without copying installed package content:

```sh
whacksmacker backup create --output whacksmacker-backup.json
whacksmacker backup inspect whacksmacker-backup.json
whacksmacker backup restore whacksmacker-backup.json --data-dir ~/.local/share/whacksmacker/content
```

Roadmap Point 12 removed the old Anki-backed review path. Native review is the only active review workflow.
