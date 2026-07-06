# Downloadable Content Packages

Roadmap Points 1 through 4 define the WhackSmacker downloadable content package specification, development package generator, local package catalogue, and local package management.

It does not implement reading, memorization items, scheduling, or Anki replacement.

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
- local package fetch, install, update, remove, and registry management.

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

## Not Defined Yet

- subject-specific content schemas;
- progress schema;
- reader behavior;
- memorization item schema;
- native scheduler behavior;
- package content reading.

## Files

- [Roadmap](roadmap.md)
- [Architecture](architecture.md)
- [Package Format v1](package-format-v1.md)
- [Security](security.md)
- [Package Management](package-management.md)
- [Manifest Schema](../../schemas/content-package-manifest-v1.schema.json)
- [Catalogue Schema](../../schemas/content-package-catalogue-v1.schema.json)
- [Korean example manifest](examples/korean-manifest.example.json)
- [Linguistic Terminology example manifest](examples/linguistic-terminology-manifest.example.json)
- [Local catalogue example](examples/local-catalogue.example.json)
