# Terminal artwork in interactive Review

WhackSmacker's interactive CLI can place validated package artwork in the existing centre (`Output`) pane during native Review. Review owns card state, package identity, prompt-versus-answer selection, pane geometry, backend selection, and cleanup. A terminal-artwork controller owns only displaying and removing the already trusted raster asset.

## Supported scope

The deliberately narrow backend set is:

| Setting | Rendering mechanism | Automatic detection |
|---|---|---|
| `Auto` | Selects one supported backend conservatively | Yes |
| `Wayland overlay` | One managed Überzug++ Wayland helper per Review session | Local `WAYLAND_DISPLAY` plus `ueberzugpp` |
| `X11 overlay` | One managed Überzug++ X11 helper per Review session | Local `DISPLAY` plus `ueberzugpp` |
| `Kitty` | Kitty graphics protocol written to the active TTY | Explicit Kitty indicators only |
| `Sixel` | `img2sixel`, or ImageMagick with writable SIXEL format | Only with an explicit Sixel indicator and cell-pixel geometry |
| `iTerm2` | iTerm2-style OSC 1337 inline images | Explicit iTerm2 indicators only |
| `Disabled` | Concise text-only unavailable state | Never renders artwork |

Automatic order is Kitty, iTerm2, local Wayland overlay, local X11 overlay, explicitly enabled Sixel, then disabled. `TERM` substring matching alone never claims protocol support. A persistent manual override always wins. An unavailable explicit override names its missing requirement and leaves Review usable.

Configure and inspect it with the existing CLI executable:

```sh
wsm artwork backend auto
wsm artwork backend wayland-overlay
wsm artwork backend x11-overlay
wsm artwork backend kitty
wsm artwork backend sixel
wsm artwork backend iterm2
wsm artwork backend disabled
wsm artwork diagnostics
```

The same setting appears as `Artwork: <value>` in the interactive Toggles pane. Its stored values are the lowercase command values above. The default is `auto`.

Sixel helpers require real terminal cell pixel dimensions so WSM can calculate the requested pixel box without hardcoded font metrics. Set both `WSM_TERMINAL_CELL_WIDTH_PX` and `WSM_TERMINAL_CELL_HEIGHT_PX` only when the terminal's actual cell geometry is known. Automatic Sixel selection additionally requires `WSM_SIXEL_SUPPORTED=1`; this explicit opt-in avoids guessing from an ambiguous `TERM` value.

## Explicitly unsupported

There is no Chafa backend and no Unicode or ASCII picture approximation. WSM does not support terminal artwork through tmux passthrough, SSH, a raw Linux console, a headless process, remote image URLs, Windows terminal graphics, or universal emulator guessing. This work does not change browser Review. It does not register an animal package.

When no supported backend is ready, an image-bearing card shows one concise message:

```text
Artwork rendering is unavailable for this terminal.
```

Text-only cards retain their established Review rendering.

## Package-media security boundary

The terminal controller cannot consume a Markdown destination directly. Review first selects the exact installed Review item and its physical content-package identity. The shared package-media resolver then:

1. selects the exact installed package ID and version;
2. parses only the current card side's validated `text/markdown` block;
3. accepts only package-root `media/` WebP, PNG, or JPEG paths;
4. finds the exact unique manifest file record and matching MIME type;
5. requires a canonical regular installed file, rejects a symlink and a canonical path outside the package root;
6. rechecks declared size and SHA-256; and
7. returns trusted bytes and a canonical local path to the controller.

HTTP, HTTPS, `data:`, `file:`, `blob:`, other URL schemes, absolute paths, traversal, and undeclared files cannot reach a backend. Helper processes receive argument arrays with `shell: false`; image paths are never interpolated into a shell command. Learner output and diagnostics never print the installed path, installation root, checksum, raw command, or terminal control data.

The item inventory validates all manifest references, but Review opens the current side's installed asset lazily. Prompt rendering resolves only prompt media. Answer media is resolved after reveal, when it replaces the prompt artwork.

## Centre-pane and card lifecycle

The artwork rectangle is derived from the current terminal width and height, the existing three-pane layout, and the fixed bottom controls. Review inserts an explicit reserved region after its header and before `Phrase:`. The rectangle leaves the pane border intact, keeps one internal cell of layout gap, and is wholly contained inside that region. Prompt and answer therefore use exactly the same geometry; reveal replaces the current placement without putting artwork below or over card text. A minimum size gate turns a narrow or short pane into the unavailable message instead of drawing over borders or controls.

Every backend receives `fit: contain`. Kitty and iTerm2 request the rectangle in character cells with aspect preservation. Sixel converts that cell rectangle through measured cell pixels. Überzug++ receives its documented cell coordinates and maximum cell width/height and owns compositor scaling; WSM does not apply a second Wayland scale factor.

Before display, existing local ImageMagick support may prepare a conservative session-local PNG when all four contiguous candidate edge bands are pale, near-neutral, very low-variance matte and at least one band is materially large. Any missing band, non-uniform or naturally coloured edge, small accepted matte, analysis failure, or conversion failure falls back to the original validated asset. The cache key is the validated source bytes; derived files are removed with controller shutdown. Installed/package artwork is never rewritten. This display step does not repair blur, already-cropped subjects, placeholders, or other source defects. Sixel containment resizes within the measured bounds without adding a transparent extent.

The lifecycle uses stable identifier `wsm-centre-pane-artwork`:

- prompt: display the trusted prompt image;
- reveal: clear or replace it with the trusted answer image;
- rating/next card: clear the old placement before the next prompt;
- text-only card: clear any previous image and use legacy text rendering;
- leave Review, return to menus, normal exit, SIGINT, or SIGTERM: attempt clear and shutdown;
- backend error: mark that backend failed for the current Review session, clear stale artwork, show a concise notice, and continue Review without changing scheduling or grading.

A failed backend is not respawned for every card. Starting a new Review session permits a fresh attempt.

Terminal resize is delivered as a Review input event. WSM clears the old placement, debounces the burst, recomputes pane and artwork geometry from the stabilized dimensions, and redraws the current card side once. Card order, current index, reveal state, progress, and grading remain unchanged. No resize listener survives the active key wait or Review shutdown.

## Backend details

Überzug++ uses the locally verified upstream stdin interface:

```text
ueberzugpp layer --output wayland
ueberzugpp layer --output x11
```

WSM spawns exactly one helper for an active Review session with an argument array and `shell: false`. It waits for the child `spawn` event and writable stdin before sending the retained first command, then keeps stdin open and serializes each `add` or `remove` object as newline-delimited JSON. Writes are ordered and respect stream backpressure. Early exit, spawn failure, and `EPIPE` make the backend failed for that Review session instead of triggering a helper per card.

Shutdown writes the stable placement's `remove` command when the stream is still usable, ends stdin, and waits for the helper. It sends `SIGTERM` only after a bounded EOF timeout and escalates to `SIGKILL` only after another bounded timeout. All child, stdin, and stderr listeners are removed afterward. Stderr is captured privately; diagnostics expose only a bounded sanitized final startup summary and never raw JSON or media paths.

On Gentoo the overlay dependency is `media-gfx/ueberzugpp`; Wayland use requires the package's `wayland` USE flag (`media-gfx/ueberzugpp[wayland]`). WSM reports the dependency but never installs it.

Kitty transmits PNG data in bounded base64 chunks, uses stable image and placement IDs, requests the centre-pane cell rectangle, suppresses protocol replies, and deletes its placement and image data on transitions. Validated JPEG/WebP input uses ImageMagick conversion to an in-memory PNG when ImageMagick is available; the source still crosses the package-media boundary first.

iTerm2 emits inline OSC 1337 data with cell `width`, cell `height`, `inline=1`, and `preserveAspectRatio=1`, surrounded by cursor save/restore. The prior rectangle is erased before replacement. This adapter is unit-tested but remains experimental here because no local iTerm2-compatible terminal was available for an integration smoke test.

Sixel is delegated to an existing encoder; WSM contains no Sixel encoder. Helper output is placed at the rectangle origin with cursor save/restore, and the previous rectangle is erased on transition. ImageMagick is considered an encoder only when `magick -list format` reports writable SIXEL support.

## Diagnostics

`wsm artwork diagnostics` reports terminal name indicators, Wayland/X11/neither, configured and selected backend, helper availability, operational readiness, the current centre-pane rectangle when the command is invoked in an active in-process Review diagnostic context, and a concise unavailable reason. Overlay diagnostics additionally report stdin transport, process state (`spawning`, `ready`, `failed`, or `stopped`), stdin writability, early exit, and the last command type without its contents. A standalone invocation normally reports a stopped process, `not active` for the rectangle, and does not call the backend ready merely because the executable exists.

For Alacritty plus sway plus Wayland with Überzug++ installed and built for Wayland, the expected high-level result is:

```text
Terminal indicators: TERM=alacritty
Graphical session: Wayland
Configured backend: Auto
Selected backend: Wayland overlay
ueberzugpp: available
Image-capable backend ready: no
Overlay transport: stdin
Overlay process state: stopped
Overlay stdin writable: no
Overlay helper exited early: no
Overlay last command: none
```

This standalone result confirms selection and prerequisites, not a live child. During active Review the operational fields become `ready`, `yes`, and the most recent `add` or `remove` after the helper has actually spawned.

Without the helper, Auto safely selects Disabled and reports `ueberzugpp: unavailable`.

## Disposable Alacritty + sway + Wayland smoke test

These commands create an isolated installed-package registry, settings file, and Review progress beneath one new temporary directory. They do not use the production launcher, production catalogue, production registry, or normal learner progress.

```sh
cd /home/ashwin/Projects/whacksmacker-modules/whacksmacker
npm run build

WSM_ARTWORK_SMOKE_ROOT="$(mktemp -d /tmp/whacksmacker-artwork-smoke.XXXXXX)"
WSM_ARTWORK_SMOKE_DATA="$WSM_ARTWORK_SMOKE_ROOT/content"
node scripts/create-terminal-artwork-smoke-fixture.mjs --output "$WSM_ARTWORK_SMOKE_DATA"

command -v ueberzugpp
node dist/main.js --data-dir "$WSM_ARTWORK_SMOKE_DATA" artwork backend auto
node dist/main.js --data-dir "$WSM_ARTWORK_SMOKE_DATA" artwork diagnostics
node dist/main.js --data-dir "$WSM_ARTWORK_SMOKE_DATA"
```

In the first interactive run:

1. Open `Installed modules` → `Languages` → `Terminal Artwork Smoke Language` → `Reading Decks` → `Artwork Smoke Deck`.
2. Press Enter once. Confirm the prompt-side illustration appears inside the Output pane and borders, text, and controls remain readable.
3. Press Enter or Space to reveal. Confirm the answer-side image replaces the prompt image.
4. Rate the card to navigate to the next, text-only card. Confirm the previous placement disappears and ordinary text rendering remains.
5. If ordering put the text card first, rate it and perform the prompt/reveal check on the image card next.
6. Resize the Alacritty window. Confirm the current card and reveal state remain, then the image redraws once inside the recomputed pane.
7. Press Escape to leave Review, then `q` to exit. Confirm no overlay remains.

Run a separate explicit-Wayland pass against a fresh isolated progress directory by creating a second fixture root:

```sh
WSM_ARTWORK_WAYLAND_ROOT="$(mktemp -d /tmp/whacksmacker-artwork-wayland.XXXXXX)"
WSM_ARTWORK_WAYLAND_DATA="$WSM_ARTWORK_WAYLAND_ROOT/content"
node scripts/create-terminal-artwork-smoke-fixture.mjs --output "$WSM_ARTWORK_WAYLAND_DATA"
node dist/main.js --data-dir "$WSM_ARTWORK_WAYLAND_DATA" artwork backend wayland-overlay
node dist/main.js --data-dir "$WSM_ARTWORK_WAYLAND_DATA" artwork diagnostics
node dist/main.js --data-dir "$WSM_ARTWORK_WAYLAND_DATA"
```

Repeat prompt, reveal, next-card, resize, and exit checks. Diagnostics should name `Wayland overlay`; if unavailable, it should name the missing `ueberzugpp` requirement and Review should remain text-only. After inspection, remove only the two printed temporary roots. No support claim is made for terminals not covered by focused protocol tests or an explicitly reported smoke test.
