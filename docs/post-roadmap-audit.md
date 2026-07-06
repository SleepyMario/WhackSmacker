# Post-Roadmap Baseline Audit

Date: 2026-07-06

This audit records the native-only WhackSmacker baseline after the 12-point downloadable-content roadmap and Anki removal. It intentionally does not fix the reported follow-up issues.

## Current Commands

Top-level CLI help currently exposes these native command groups:

- `backup create`
- `backup inspect`
- `backup migrate`
- `backup restore`
- `content available`
- `content files`
- `content install`
- `content installed`
- `content read`
- `content remove`
- `content update`
- `content updates`
- `language terminology`
- `geography continents`
- `mathematics beginner-volume-one`
- `mathematics four-and-five`
- `mathematics one-to-five`
- `mathematics one-two-three`
- `mathematics six-to-nine`
- `review answer`
- `review due`
- `review items`
- `review show`
- `review sources`

`node dist/main.js --help` works. Subcommand help forms such as `content --help`, `review --help`, and `backup --help` currently return `Unknown command`; the CLI registry lists full command paths from the top-level help instead.

## Language Surface

The interactive Language menu currently contains:

- `Linguistic Terminology`
- `Back`

There is no Language menu entry for Korean, no `language korean` command, and no dedicated language-progress command. The only language command registered by `packages/language/index.ts` is `language terminology`.

## Korean Hangul Foundation

The canonical Korean curriculum repository contains the Hangul Foundation at:

`/home/ashwin/Projects/languages/korean-curriculum/units/hangul-foundation`

That source currently has seven chapter directories and 42 unit specification files. The WhackSmacker package generator target `korean-curriculum` snapshots the curriculum Markdown into a package with `content/content.json` using the `whacksmacker-source-markdown-snapshot-v1` shape.

In a `/tmp` validation flow, the generated Korean package installed successfully and the reading interface could list and open Hangul Foundation Markdown entries, including:

- `units/hangul-foundation/README.md`
- `units/hangul-foundation/chapter-01-vowels/README.md`
- chapter unit files under `units/hangul-foundation/**/unit-*.md`

However, this content is only visible through package/content commands after generating a `.wspkg`, generating a catalogue, and installing the package. It is not surfaced from the Language menu. It also does not appear as native review progress because the generated Korean package contains source Markdown snapshots, not `content/memorization/**/*.json` review-item files.

The likely reason Korean language progress appears missing is therefore not that the Hangul Foundation source is absent. It is that no native Language/Korean surface links to the installed Korean package, and no generated memorization items currently create review state for that content.

## Linguistic Terminology

Linguistic terminology has two current paths:

- a bundled static snapshot in `packages/language/linguistic-terminology-snapshot.ts`;
- a package-generator target that can snapshot the canonical `linguistic-terminology` repository into a `.wspkg`.

The direct command `language terminology` renders a static text view with optional filtering arguments such as `--search`, `--category`, and `--id`.

The interactive Language menu captures the full static output of `language terminology` and passes it to `showMessage()` in `apps/cli/interactive-menu.ts`. That screen only handles Enter, Escape, `q`, and Ctrl-C. It does not implement scrolling, pagination, search input, or selection inside the terminology list.

That explains why Linguistic Terms can appear frozen in the menu: long output is drawn as a single message, but only exit keys are active.

## Chess

Chess code still exists:

- `packages/chess-core/index.ts` wraps `chess.js` and provides board state, legal moves, move application, and reset behavior.
- `apps/chess-desktop/src/ChessApp.tsx` contains a desktop chessboard UI.
- chess tests still cover the core and desktop behavior.

The CLI-facing chess module in `packages/chess/index.ts` intentionally registers no user-facing commands. The interactive main menu still shows Chess as a placeholder screen. The current unlinked state is therefore that chess engine and desktop-board code exists, but no CLI/menu route opens or connects the chessboard content.

## Mathematics

Mathematics generation lives under:

- `packages/mathematics/index.ts`
- `packages/mathematics/one-two-three/`

The current model is on-demand PDF generation through CLI/menu commands. The module defines default PDF filenames and renders the requested workbook when the user runs the command. There are no committed pregenerated workbook PDFs and no content-package target for mathematics artifacts.

Making mathematics pregenerated/precompiled would require a separate decision about artifact ownership and lifecycle, including output location, generation seed policy, rebuild command, package inclusion, overwrite behavior, and whether generated PDFs are committed, built, or installed as package content.

## Package Flow Baseline

The current package flow works as follows:

1. `generate-content-package` creates `.wspkg` archives from supported source repositories.
2. `content:catalogue` creates a local catalogue for those archives.
3. `content install` installs selected packages into a data directory.
4. `content read` and `content files` expose readable installed package files.
5. `review sources/items/due/show/answer` operate on package-authored memorization items when present.

In the validation flow, generated Korean and Linguistic Terminology packages were discoverable in a local catalogue. The Korean package installed and readable Hangul Foundation files were visible. Review commands for Korean returned no sources, items, or due reviews because the installed package had no memorization item files.

## Recommended Next Task For Issue 1

Start by adding a native Korean visibility path, without creating review behavior yet:

Add a Language/Korean command or menu route that discovers an installed `com.sleepymario.language.korean` package, lists the Hangul Foundation chapters from readable package entries, and opens `units/hangul-foundation/README.md` or chapter README files through the existing reading interface.

This should make the existing Hangul Foundation visible in the language surface while keeping review progress separate. A later task can decide whether to generate memorization items from the Korean curriculum and how those items should initialize native review progress.

