# Exercise Renderers

Roadmap Point 8 adds terminal-safe renderers for package-authored memorization items.

Content packages own item definitions. WhackSmacker owns rendering, scheduling, user progress, and review state.

## Supported Item Kinds

The renderer supports the memorization item kinds from `schemas/memorization-item-v1.schema.json`:

- `basic-card`
- `cloze`
- `vocabulary`
- `sentence`
- `concept`

All rendering is deterministic and plain text. Prompt/front output and answer/back output are kept separate so a later review interface can reveal them at different times.

## Output Shape

The core renderer returns:

- item identity: `packageId`, `packageVersion`, `itemId`;
- item kind;
- title;
- prompt lines;
- answer lines;
- hint lines;
- note lines;
- metadata lines;
- warnings.

Hints, notes, tags, source, language, and difficulty metadata are rendered when present. Missing optional fields do not prevent rendering.

## Cloze Behavior

Cloze rendering is intentionally simple.

When the prompt contains a simple marker such as:

```text
{{c1::answer}}
```

the prompt shows:

```text
[...]
```

and the extracted cloze answer is included with the answer lines.

If a cloze item does not contain a simple marker, WhackSmacker renders the stored prompt and answer blocks directly and includes a warning. Complex cloze parsing, nested clozes, answer checking, and grading are not part of this roadmap point.

## Boundaries

This point does not implement:

- reading-to-review integration;
- full interactive native review sessions;
- answer grading;
- fuzzy matching;
- web UI;
- Anki migration;
- Anki removal.

The renderer does not write progress, mutate installed packages, or create review items from reading content.
