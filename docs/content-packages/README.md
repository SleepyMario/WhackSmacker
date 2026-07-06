# Downloadable Content Packages

Roadmap Points 1 and 2 define the WhackSmacker downloadable content package specification and development package generator.

It does not implement catalogues, download, installation, updates, removal, reading, memorization items, scheduling, or Anki replacement.

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
- separation between package content and user progress.

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

The generator emits `.wspkg` archives only. It does not install packages or create a package catalogue.

## Not Defined Yet

- package catalogue format;
- subject-specific content schemas;
- progress schema;
- reader behavior;
- memorization item schema;
- native scheduler behavior;
- package download or installation.

## Files

- [Roadmap](roadmap.md)
- [Architecture](architecture.md)
- [Package Format v1](package-format-v1.md)
- [Security](security.md)
- [Manifest Schema](../../schemas/content-package-manifest-v1.schema.json)
- [Korean example manifest](examples/korean-manifest.example.json)
- [Linguistic Terminology example manifest](examples/linguistic-terminology-manifest.example.json)
