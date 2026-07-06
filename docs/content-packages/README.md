# Downloadable Content Packages

Roadmap Points 1 through 9 define the WhackSmacker downloadable content package specification, development package generator, local package catalogue, local package management, passive installed-content reading, the package-authored memorization item schema, native review scheduling state, terminal exercise rendering, and reading-to-review integration.

It does not implement reading-to-review integration or Anki replacement.

## Fundamental Rule

WhackSmacker owns the learning engine, package management, user settings, and user progress. Downloadable content packages own learning content.

The application, downloaded package content, and user progress/settings remain separate.

## Defined Now

- package container format;
- package filename convention;
- required archive layout;
- manifest fields;
- package identity and versioning;
- source and generator provenance;
- compatibility fields;
- dependencies;
- file integrity metadata;
- content entry points;
- asset handling;
- package immutability;
- stable content identifier rules;
- update compatibility expectations;
- security restrictions;
- deterministic-generation requirements;
- separation between package content and user progress;
- local package catalogue format;
- local catalogue generation from existing `.wspkg` archives;
- local package fetch, install, update, remove, and registry management;
- passive reading of installed package text content;
- memorization item schema and validation helpers;
- native review progress storage and deterministic scheduling helpers;
- terminal-safe memorization item exercise rendering;
- reading-source to review-item discovery and terminal review commands.

## Generator Targets

Roadmap Point 2 supports these deterministic generator targets:

| Target | Package ID | Source repository |
|---|---|---|
| `linguistic-terminology` | `com.sleepymario.language.linguistic-terminology` | `/home/ashwin/Projects/languages/linguistic-terminology` |
| `korean-curriculum` | `com.sleepymario.language.korean` | `/home/ashwin/Projects/languages/korean-curriculum` |

Run:

```sh
npm run generate-content-package -- --target linguistic-terminology --target korean-curriculum --output-dir packages-output
```

The generator emits `.wspkg` archives only. It does not install packages.

## Local Catalogue

Roadmap Point 3 supports local catalogue generation from existing package archives:

```sh
npm run content:catalogue -- \
  --packages-dir packages-output \
  --output packages-output/catalogue.json
```

Development flow:

```text
Point 2:
source repositories -> .wspkg files

Point 3:
.wspkg files -> local catalogue JSON
```

The catalogue describes available package archives. It is not:

- a package manifest;
- an installed-package registry;
- a user-progress database;
- a download cache;
- a canonical curriculum or terminology repository.

Point 4 uses catalogues for local package fetch, install, update, and remove behavior. It still does not render or read installed content.

Point 5 reads installed package text content without writing user progress.

Point 6 defines package-authored reviewable item data.

Point 7 stores WhackSmacker-owned review progress outside installed package directories and calculates deterministic next-review times.

Point 8 renders memorization items into separated prompt and answer text for terminal review surfaces.

Point 9 connects installed reading content to reviewable memorization items and native review progress.

## Not Defined Yet

- subject-specific content schemas;
- answer grading behavior.

## Files

- [Roadmap](roadmap.md)
- [Architecture](architecture.md)
- [Package Format v1](package-format-v1.md)
- [Security](security.md)
- [Package Management](package-management.md)
- [Reading Interface](reading-interface.md)
- [Memorization Items](memorization-items.md)
- [Native Review Scheduler](../review-scheduler.md)
- [Exercise Renderers](../exercise-renderers.md)
- [Reading to Review](../reading-to-review.md)
- [Memorization Item Schema](../../schemas/memorization-item-v1.schema.json)
- [Review Progress Schema](../../schemas/review-progress-v1.schema.json)
- [Manifest Schema](../../schemas/content-package-manifest-v1.schema.json)
- [Catalogue Schema](../../schemas/content-package-catalogue-v1.schema.json)
- [Korean example manifest](examples/korean-manifest.example.json)
- [Linguistic Terminology example manifest](examples/linguistic-terminology-manifest.example.json)
- [Local catalogue example](examples/local-catalogue.example.json)
