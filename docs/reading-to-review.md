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

The removed legacy command shape `whacksmacker review <deck-name>` no longer routes. Use the native package review subcommands listed above.

## Progress Separation

Reading-to-review sync writes scheduler state only to the native review progress store. It does not mutate installed packages, package archives, source repositories, reading files, or memorization item files.

When `--data-dir` is used for content during development or tests, WhackSmacker stores native review progress beside that content directory in a separate `progress` directory, not inside installed package directories.

## Boundaries

This point did not implement:

- backup or migration behavior;
- Anki parity tests;
- Anki removal;
- web UI;
- fuzzy answer grading;
- complex interactive terminal review sessions.
