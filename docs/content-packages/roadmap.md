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

Status: not started

Will define package content for memorization items.

## Point 7 -- Native Review Scheduler

Status: not started

Will add WhackSmacker-owned scheduling and review state.

## Point 8 -- Exercise Renderers

Status: not started

Will render exercises from installed packages.

## Point 9 -- Reading-to-Review Integration

Status: not started

Will connect reading progress to review and exercises.

## Point 10 -- Backups and Migration

Status: not started

Will define backup and migration behavior for user-owned data.

## Point 11 -- Anki Parity Test

Status: not started

Will verify replacement behavior against current Anki-backed workflows.

## Point 12 -- Remove Anki

Status: not started

Will remove the Anki dependency after native behavior reaches parity.
