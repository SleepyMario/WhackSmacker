# Content Package Architecture

WhackSmacker owns the learning engine, package management, user settings, and user progress. Downloadable content packages own learning content.

These remain separate:

- WhackSmacker application;
- downloaded content packages;
- user progress and settings.

Downloaded content must never contain the authoritative copy of user progress.

User progress must never be written back into an installed content package.

Canonical curriculum and content repositories remain separate from both WhackSmacker and generated packages.

## Flow

```text
canonical source repository
        ↓
deterministic package generator
        ↓
versioned .wspkg archive
        ↓
local package catalogue
        ↓
future WhackSmacker package manager
        ↓
read-only installed content

user progress and settings remain separate
```

## Boundaries

The package format defines how generated content is transported and verified.

The content schema defines the subject-specific data inside `content/`. Those schemas are later roadmap points.

The catalogue format describes available package archives and their archive-level size and SHA-256 checksum. It is not a package manifest, installed-package registry, download cache, source repository, or user-progress database.

The progress schema will describe user state and learning history. It is not defined here.

## Immutability

An installed package version is read-only. WhackSmacker never modifies package content.

Updates install a new immutable package version. Rollback means returning to a previous installed version.

Generated packages are disposable and reproducible. User annotations, settings, and progress are stored separately from package content.

## Stable Content Identifiers

Every piece of content that may carry user progress must have a stable identifier inside its source repository and generated package.

Examples include:

- curriculum units;
- terminology entries;
- reading sections;
- exercises;
- memorization items;
- mathematical lessons;
- geography entries;
- chess positions.

Package updates should preserve stable content IDs whenever the logical item remains the same. Renaming a title must not automatically change its stable ID.

Future user progress will be keyed by at least:

```text
packageId
contentId
```

It may also include:

```text
contentSchemaVersion
exerciseVariantId
```
