# Native Review Scheduler

Roadmap Point 7 adds WhackSmacker-owned review progress and scheduling state for memorization items defined by installed content packages.

Content packages own item definitions. WhackSmacker owns user progress, review events, and scheduling state.

## Storage

Review progress is stored outside installed package directories.

Default Linux paths:

```text
$XDG_DATA_HOME/whacksmacker/progress
~/.local/share/whacksmacker/progress
```

The progress file is:

```text
review-progress.json
```

Installed package content remains under the content data directory and is not modified by review scheduling.

## Schema

The progress schema is:

```text
schemas/review-progress-v1.schema.json
```

The store contains:

- `reviewProgressFormatVersion`
- `updatedAt`
- `items`
- `events`

Each item state is keyed by:

- `packageId`
- `packageVersion`
- `itemId`

This preserves package-owned content identity while keeping user state separate.

## Ratings

The v1 scheduler supports:

- `again`
- `hard`
- `good`
- `easy`

The algorithm is intentionally simple and deterministic. It is not an Anki clone.

New items are due immediately when first synchronized from installed memorization items. Recording a review outcome updates:

- `lastReviewedAt`
- `nextReviewAt`
- `reviewCount`
- `lapseCount`
- `intervalDays`
- `easeFactor`
- `status`

## Boundaries

This point does not implement:

- interactive native review sessions;
- answer grading;
- card rendering;
- cloze rendering;
- exercise renderers;
- reading-to-review integration;
- Anki migration;
- Anki removal.

Roadmap Point 8 can add renderers on top of this scheduler. Roadmap Point 11 can compare native scheduling behavior with Anki.
