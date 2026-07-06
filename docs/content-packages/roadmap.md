# Downloadable Content Roadmap

This roadmap describes the migration from provider-backed review toward WhackSmacker-owned learning and package management.

## Point 1 -- Package Specification

Status: implemented

Defines the `.wspkg` package container, manifest schema, package identity, versioning, provenance, integrity metadata, entry points, dependency records, immutability rules, security restrictions, deterministic-generation requirements, and the boundary between package content and user progress.

## Point 2 -- Package Generator

Status: implemented

Generates deterministic `.wspkg` archives from the canonical `linguistic-terminology` and `korean-curriculum` repositories.

Supported targets:

- `linguistic-terminology` -> `com.sleepymario.language.linguistic-terminology`
- `korean-curriculum` -> `com.sleepymario.language.korean`

## Point 3 -- Local Package Catalogue

Status: implemented

Defines and validates a local package catalogue that lists available `.wspkg` archives, including package identity, source provenance, archive URLs, archive size, and archive SHA-256 checksums.

The local catalogue is not an installed-package registry and does not contain user progress.

## Point 4 -- Download, Install, Update and Remove

Status: implemented

Adds package acquisition from `file://` and `https://` catalogue URLs, archive size and SHA-256 verification, safe manifest inspection, safe extraction, immutable local installation, installed-package registry management, update detection, update installation, and package removal.

This point does not add a reading interface or user-progress storage.

## Point 5 -- Reading Interface

Status: implemented

Adds passive browsing and rendering of readable text content from installed packages.

This point does not add memorization items, scheduling, exercise rendering, reading-to-review integration, or user-progress writes.

## Point 6 -- Memorization-Item Schema

Status: implemented

Defines and validates package-authored memorization item data, including stable item IDs, item kinds, prompt/answer content, optional hints, notes, tags, source references, language metadata, and difficulty metadata.

This point does not add review queues, scheduling, answer checking, exercise rendering, or Anki migration.

## Point 7 -- Native Review Scheduler

Status: implemented

Adds WhackSmacker-owned review progress and scheduler state for package-authored memorization items. Progress is stored separately from installed package directories and is keyed by package ID, package version, and item ID.

This point does not add exercise renderers, interactive native review sessions, answer grading, reading-to-review integration, Anki migration, or Anki removal.

## Point 8 -- Exercise Renderers

Status: implemented

Adds deterministic terminal-safe rendering for memorization item kinds: `basic-card`, `cloze`, `vocabulary`, `sentence`, and `concept`.

This point does not add reading-to-review integration, a full interactive native review session, answer grading, web UI, Anki migration, or Anki removal.

## Point 9 -- Reading-to-Review Integration

Status: implemented

Connects installed reading content to package-authored memorization items. WhackSmacker can list review sources, list items by source, sync items into native review progress, render prompts and answers, list due items, and record review ratings from the terminal.

This point does not add backups or migration, Anki parity tests, Anki removal, web UI, fuzzy answer grading, or a full interactive native review session.

## Point 10 -- Backups and Migration

Status: not started

Will define backup and migration behavior for user-owned data.

## Point 11 -- Anki Parity Test

Status: not started

Will verify replacement behavior against current Anki-backed workflows.

## Point 12 -- Remove Anki

Status: not started

Will remove the Anki dependency after native behavior reaches parity.
