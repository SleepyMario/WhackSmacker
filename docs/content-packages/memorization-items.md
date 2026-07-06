# Memorization Items

Roadmap Point 6 defines the package-authored memorization item schema.

This is schema and validation work only. It does not create review queues, due dates, spaced repetition, answer checking, exercise rendering, reading-to-review integration, or Anki migration.

## File Layout

Packages may place memorization item files under:

```text
content/memorization/*.json
content/memorization/**/*.json
```

Files may use:

```text
application/vnd.whacksmacker.memorization-items+json
```

or ordinary:

```text
application/json
```

## Item Shape

Every item has:

```json
{
  "schemaVersion": 1,
  "id": "hangul/vowels/a",
  "kind": "vocabulary",
  "prompt": {
    "text": "아",
    "language": "ko",
    "mediaType": "text/plain"
  },
  "answer": {
    "text": "Korean vowel-only syllable using ㅏ",
    "mediaType": "text/plain"
  }
}
```

Allowed item kinds are:

- `basic-card`
- `cloze`
- `vocabulary`
- `sentence`
- `concept`

Optional fields include:

- `hints`
- `notes`
- `tags`
- `source`
- `language`
- `difficulty`
- `createdAt`
- `updatedAt`

## Collections

A file may contain one item or a collection:

```json
{
  "schemaVersion": 1,
  "items": []
}
```

Item IDs must be unique within a collection.

## Boundaries

Memorization items are package-owned learning content.

They must not contain:

- user progress;
- review history;
- due dates;
- scheduling intervals;
- ease factors;
- user settings;
- Anki-specific note IDs or deck ownership.

User progress and scheduling state belong to later roadmap points and remain outside installed package directories.

## References

`source.path` must be a safe package-relative path. Absolute paths, parent-directory traversal, backslashes, and external filesystem references are not allowed.

The schema is:

```text
schemas/memorization-item-v1.schema.json
```
