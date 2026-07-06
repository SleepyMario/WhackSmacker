# Anki Parity Audit

Roadmap Point 11 verified that the native WhackSmacker package, memorization, rendering, scheduling, and backup layers could cover the essential behavior that the legacy Anki-backed path provided.

Roadmap Point 12 has now removed the old Anki-backed command:

```sh
whacksmacker review <deck-name>
```

The `review` namespace now belongs to native package review commands only.

## Parity Criteria

The audit checks these mappings:

| Legacy Anki concept | Native WhackSmacker concept |
|---|---|
| Deck name | Package identity and optional source metadata |
| Card ID | Stable package-relative memorization item ID |
| Front/question | Memorization item prompt |
| Back/answer | Memorization item answer |
| Cloze-style content | Native `cloze` item rendering where simple cloze markers are present |
| Tags | Memorization item tags |
| Review buttons | Native ratings: `again`, `hard`, `good`, `easy` |
| Review state | Native review progress store |
| Deck/card backup concern | User-data backup containing registry and review progress |

The audit also confirms that native rendering keeps prompt and answer output separate, and that native scheduler state is keyed by:

```text
packageId
packageVersion
itemId
```

## What Is Tested

The Point 11 automated parity tests verified that:

- a legacy front/back card can be represented as a valid native `basic-card`;
- a simple cloze-like card can be represented by the native `cloze` renderer;
- native terminal rendering separates prompt/front from answer/back;
- native due listing can surface an equivalent item;
- native review outcome recording creates scheduler state outside installed package content;
- user-data backup captures installed-package registry and native review progress;
- legacy Anki card HTML rendering sanitized display content before removal;
- `whacksmacker review <deck-name>` could remain separate from native `review due` before removal;
- native `review due` remains routed to the native review command.

Those tests did not require a running Anki instance or network access. After Point 12, active tests assert that the old command shape no longer routes.

## Explicit Non-Goals

This historical audit did not implement:

- automatic Anki deck migration;
- package generation from Anki exports;
- answer grading or fuzzy matching;
- a web review interface;
- scheduler parity with Anki's exact algorithm.

The native scheduler is intentionally simple until later parity and migration work requires a more exact comparison.

## Data Separation

Native progress remains WhackSmacker-owned user state.

Content packages remain package-owned, read-only content.

Backups include user-owned registry and review progress data, not installed package directories, package archives, caches, or external curriculum repositories.
