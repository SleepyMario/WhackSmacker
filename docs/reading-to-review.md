# Reading-to-Review Integration

Roadmap Point 9 connects installed reading content to package-authored memorization items.

Content packages own reading files and memorization item definitions. WhackSmacker owns discovery, rendering, scheduling, progress, and review state.

## Source Links

Memorization items may include source metadata:

```json
{
  "source": {
    "path": "README.md"
  }
}
```

The source path is package-relative and must be safe. Items with source paths can be grouped by reading file. Items without source paths remain valid and reviewable.

If a source file is missing from the installed package, WhackSmacker still keeps the review item available and marks the source as missing instead of corrupting progress.

## Commands

List reading files with linked review items:

```sh
whacksmacker review sources [--package <package-id>] [--version <version>] [--data-dir <dir>]
```

List review items:

```sh
whacksmacker review items --package <package-id> [--version <version>] [--source <path>] [--data-dir <dir>]
```

List due native review items:

```sh
whacksmacker review due [--package <package-id>] [--version <version>] [--data-dir <dir>] [--limit <n>]
```

Render an item:

```sh
whacksmacker review show <package-id> <item-id> [--version <version>] [--data-dir <dir>] [--answer]
```

Record a rating:

```sh
whacksmacker review answer <package-id> <item-id> --rating <again|hard|good|easy> [--version <version>] [--data-dir <dir>] [--now <iso-timestamp>]
```

Run a source/deck review session:

```sh
whacksmacker review run --package <package-id> --source <path> [--version <version>] [--data-dir <dir>] [--now <iso-timestamp>]
```

In the interactive menu, expand an installed language curriculum and its Review section. When a Review-source row is focused, one Enter press starts that source in the output pane. The activation key is consumed by the menu, so the first answer remains hidden; the next Enter or Space reveals it. Keys 1 through 4 rate the revealed card, and `q` leaves Review without rating the current card.

After a source is completed, WhackSmacker checks the ordered review sources for the same package. If another source exists, it prompts:

```text
Do you want to continue with the next deck? (y/n)
```

Answering `y` starts the next source immediately. Answering `n` stops cleanly. If there is no next source, WhackSmacker reports that no next review deck is available.

Small review decks should remain stable package sources. Progressive review flow is handled by WhackSmacker, not by merging decks or migrating card IDs.

The removed legacy command shape `whacksmacker review <deck-name>` no longer routes. Use the native package review subcommands listed above.

## Web workflow

The authenticated Web Review surface discovers separately installed reading and Review packages but authorizes every request against the exact physical Review package ID and version selected for the user. Stable card progress continues to use the shared reading/Review identity supplied by the package layer. The browser never schedules cards or stores Review progress locally: the server uses the shared scheduler and local or PostgreSQL progress store.

Each card starts with its answer hidden. Enter or Space reveals it once; after reveal, keys 1–4 or the named buttons submit Again, Hard, Good, or Easy. The client sends the card's expected review count so a repeated or retried submission is rejected without appending another event.

The Web server snapshots the cards that are already due when a source session begins and applies an injectable Fisher–Yates shuffle. Schema-v2 inverse siblings are recognized from their canonical tested lexical, grammar, geographic, cast, and skill identities within the exact physical Review package/version/source boundary. A spacing pass keeps inverse directions non-adjacent whenever unrelated due cards make that possible. Eligibility, next-review times, card IDs, package boundaries, ordinary/specialized scope, and scheduler identities are unchanged; a grade removes exactly the accepted current card from the ephemeral session.

After reveal, the learner-facing card contains Answer, up to three unique structured Examples in package order, and the rating controls. Internal notes/explanations, cue descriptions, pedagogical fingerprints, and provenance locators are never projected as examples. Literal structured examples and literal schema-v2 evidence are de-duplicated, kept inert, and capped at three; no Examples heading is shown when no valid example exists.

## Progress Separation

Reading-to-review sync writes scheduler state only to the native review progress store. It does not mutate installed packages, package archives, source repositories, reading files, or memorization item files.

When `--data-dir` is used for content during development or tests, WhackSmacker stores native review progress beside that content directory in a separate `progress` directory, not inside installed package directories.

## Boundaries

This point did not implement:

- backup or migration behavior;
- Anki parity tests;
- Anki removal;
- fuzzy answer grading.
