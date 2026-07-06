# Anki Parity Audit

Roadmap Point 11 verifies that the native WhackSmacker package, memorization, rendering, scheduling, and backup layers can cover the essential behavior that the legacy Anki-backed path currently provides.

This point is verification only. It does not remove Anki, disable AnkiConnect, migrate existing Anki data, or change the legacy command:

```sh
whacksmacker review <deck-name>
```

That command continues to route to the Anki-backed language review workflow until Roadmap Point 12.

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

The automated parity tests verify that:

- a legacy front/back card can be represented as a valid native `basic-card`;
- a simple cloze-like card can be represented by the native `cloze` renderer;
- native terminal rendering separates prompt/front from answer/back;
- native due listing can surface an equivalent item;
- native review outcome recording creates scheduler state outside installed package content;
- user-data backup captures installed-package registry and native review progress;
- legacy Anki card HTML rendering still sanitizes display content;
- `whacksmacker review <deck-name>` remains routed to the legacy Anki-backed command;
- native `review due` remains routed to the native review command.

The tests do not require a running Anki instance or network access.

## Explicit Non-Goals

Point 11 does not implement:

- Anki removal;
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
