# WhackSmacker

WhackSmacker is a modular learning and utility application. The current v0.001 surface is a Node.js command-line application for reviewing Anki cards from a terminal through the AnkiConnect add-on.

Milestone: `v0.001`

Package version: `0.0.1`

Future Git tag after manual validation: `v0.0.1`

## Prerequisites

- Node.js 18 or newer.
- Anki running on the same machine.
- The AnkiConnect add-on installed and enabled in Anki.
- AnkiConnect reachable at `http://127.0.0.1:8765`.

Install AnkiConnect from Anki with `Tools -> Add-ons -> Get Add-ons`, then use the add-on code published by AnkiConnect. Restart Anki after installing the add-on.

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
whacksmacker status
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

The v0.001 language commands are available through the new domain-prefixed shape:

```sh
whacksmacker language status
whacksmacker language decks
whacksmacker language review <deck-name>
whacksmacker language terminology [--search <text>] [--category <name>] [--id <stable-id>]
```

The original v0.001 commands remain supported as aliases:

```sh
whacksmacker status
whacksmacker decks
whacksmacker review <deck-name>
```

The linguistic terminology command displays a bundled snapshot from the standalone `linguistic-terminology` repository. The canonical glossary remains separate, and packaged WhackSmacker does not need the sibling repository or a network connection at runtime.

Check whether AnkiConnect is reachable and usable:

```sh
whacksmacker status
```

List available Anki decks:

```sh
whacksmacker decks
```

Start a terminal review session for a deck:

```sh
whacksmacker review Default
whacksmacker review Languages::Japanese
whacksmacker review "Deck With Spaces"
```

During review:

- Press Enter to reveal the answer.
- Enter one of the answer choices shown for the current card.
- Enter `q` before reveal or at the rating prompt to stop cleanly.
- Press Ctrl-C to interrupt the session.

The review command continues until the Anki review queue is empty or you quit.

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

- `language` is the domain for decks, cards, review sessions, scheduling interfaces, and language-learning providers.
- `anki` is the current language provider integration through AnkiConnect.
- `chess` is the domain for future board, move, FEN, PGN, engine, tablebase, and opening interfaces.
- `stockfish`, `syzygy`, and `lichess` are future chess provider features.
- `geography` is the domain for future datasets, locations, maps, and quiz interfaces.
- `mathematics` is the domain for future topics, exercises, proofs, and quiz interfaces.

Feature names follow a Gentoo USE-style model:

- Domain features: `language`, `chess`, `geography`, `mathematics`
- Provider and integration features: `anki`, `lichess`, `stockfish`, `syzygy`
- Application surfaces: `cli`, `desktop`

Dependency boundaries:

- Apps may depend on packages.
- Domain packages may depend on `packages/core` and `packages/storage` contracts.
- `packages/core` contains only shared contracts and must not depend on domain packages.
- Domain packages must not depend directly on one another.
- Provider integrations live behind their owning domain package, not in the application shell.

Current package responsibilities:

- `packages/core`: module registration contracts, feature configuration types, profile/application-data paths, logging interfaces, CLI command registration contracts, and shared UI contracts.
- `packages/language`: language decks/cards/review contracts, the current AnkiConnect adapter, bundled linguistic terminology, and CLI commands.
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

## Troubleshooting

If `whacksmacker status` prints `Unable to reach AnkiConnect`:

- Start Anki.
- Confirm the AnkiConnect add-on is installed and enabled.
- Restart Anki after installing or changing add-ons.
- Check that no firewall or local security tool is blocking `127.0.0.1:8765`.

If a command prints `AnkiConnect API error`, WhackSmacker reached AnkiConnect but AnkiConnect rejected the request. Common causes include a missing deck, an unavailable deck, or Anki not being in a state where the requested review action is valid.

If a command prints `Malformed AnkiConnect response`, AnkiConnect or another service on port `8765` returned a response WhackSmacker does not understand.

## Development

Build:

```sh
npm run build
```

Run tests with mocked AnkiConnect responses:

```sh
npm test
```

Run the built CLI directly:

```sh
node dist/main.js status
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
```

Content packages may also declare reviewable memorization items using the v1 schema in `schemas/memorization-item-v1.schema.json`. WhackSmacker stores native review progress separately using `schemas/review-progress-v1.schema.json`; installed package content remains read-only.

Terminal exercise renderers can display memorization items as separated prompt and answer text. They do not grade answers or create a full native review session yet.

Tests use local mock HTTP servers and do not require a running Anki instance.

## Real-Anki Validation Checklist

Before creating Git tag `v0.0.1`, validate against a real local Anki instance:

1. Start Anki with AnkiConnect enabled.
2. Run `whacksmacker status`; confirm it reports AnkiConnect available and shows an API version.
3. Run `whacksmacker decks`; confirm known deck names are listed.
4. Run `whacksmacker review <deck-name>` for a deck with due cards.
5. Reveal a card, answer with each available choice style that appears, and confirm Anki accepts the answer.
6. Let a short queue complete and confirm WhackSmacker reports the number of answered cards.
7. Run review on a deck with no due cards and confirm it reports an empty queue cleanly.
8. Start a review and enter `q`; confirm it stops without answering the current card.
9. Start a review and press Ctrl-C; confirm the terminal returns cleanly with exit code `130`.
10. Stop Anki and run `whacksmacker status`; confirm it reports a connection failure.

Only create tag `v0.0.1` after this checklist succeeds.
