# Downloadable Content Packages

Roadmap Point 1 defines the WhackSmacker downloadable content package specification.

It does not implement package generation, catalogues, download, installation, updates, removal, reading, memorization items, scheduling, or Anki replacement.

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

## Not Defined Yet

- package catalogue format;
- subject-specific content schemas;
- progress schema;
- reader behavior;
- memorization item schema;
- native scheduler behavior;
- package generation;
- package download or installation.

## Files

- [Roadmap](roadmap.md)
- [Architecture](architecture.md)
- [Package Format v1](package-format-v1.md)
- [Security](security.md)
- [Manifest Schema](../../schemas/content-package-manifest-v1.schema.json)
- [Korean example manifest](examples/korean-manifest.example.json)
- [Linguistic Terminology example manifest](examples/linguistic-terminology-manifest.example.json)
