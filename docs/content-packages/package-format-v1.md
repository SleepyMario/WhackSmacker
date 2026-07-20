# WhackSmacker Package Format v1

WhackSmacker content packages use ZIP-compatible archives with this extension:

```text
.wspkg
```

`wspkg` means WhackSmacker Package.

Package filenames should follow:

```text
<package-id>-<package-version>.wspkg
```

Package IDs contain dots, and filenames may preserve those dots.

Example:

```text
com.sleepymario.language.dutch-0.1.0.wspkg
```

The archive is a data-only container. It must not contain executable scripts, native libraries, installers, hooks, or code that WhackSmacker executes.

Archive creation is implemented by Roadmap Point 2 for the configured package targets.

Archive extraction, installation, catalogue management, and content rendering are not implemented in Roadmap Point 2.

Roadmap Point 3 adds local catalogue generation from existing `.wspkg` archives. It still does not extract, install, download, or render package content.

## Version-1 Layout

```text
manifest.json
content/
assets/
docs/
```

Only `manifest.json` and at least one declared content entry point are required.

`content/` contains machine-readable learning content. Subject-specific content schemas are later roadmap points.

`assets/` optionally contains supporting static media such as images, audio, video, legally redistributable fonts, or other static media. WhackSmacker must never execute files from this directory.

`docs/` optionally contains human-readable package documentation, licensing notes, attribution, or source information. Package documentation is not required at runtime.

## Package Identity

Package IDs use globally namespaced reverse-domain syntax:

```text
<reverse-domain>.<category>.<name>
```

Examples:

```text
com.sleepymario.language.dutch
com.sleepymario.language.linguistic-terminology
com.sleepymario.mathematics.curriculum
com.sleepymario.geography.world
com.sleepymario.chess.foundations
```

Package IDs must:

- use lowercase ASCII letters, digits, dots, and hyphens;
- begin with a letter or digit;
- contain no spaces;
- remain stable across package versions;
- identify the logical content package, not a specific release.

Repository paths and GitHub URLs are not package IDs.

## Versioning

Package releases use Semantic Versioning:

```text
MAJOR.MINOR.PATCH
```

- `MAJOR` -- incompatible content or identifier changes;
- `MINOR` -- backward-compatible additions or significant content expansion;
- `PATCH` -- backward-compatible corrections.

The manifest separates these versions:

- `packageFormatVersion` -- version of the `.wspkg` container and manifest contract;
- `contentSchemaVersion` -- version of the subject-specific content representation;
- `packageVersion` -- version of this content release;
- `minimumWhackSmackerVersion` -- minimum compatible application version.

Roadmap Point 1 defines only:

```text
packageFormatVersion: 1
```

## Manifest

The manifest is `manifest.json`. Its canonical schema is:

```text
schemas/content-package-manifest-v1.schema.json
```

Required fields:

```text
packageFormatVersion
packageId
packageVersion
displayName
description
contentType
contentSchemaVersion
minimumWhackSmackerVersion
source
generatedAt
generator
entryPoints
files
```

Optional fields:

```text
languages
subjects
dependencies
license
homepage
authors
keywords
```

Known initial content types:

```text
language-curriculum
linguistic-terminology
mathematics-curriculum
geography-dataset
chess-content
demonstration
```

Future custom content types must use namespaced syntax, such as:

```text
com.example.custom-content
```

## Source Provenance

`source` contains:

```text
repository
commit
```

It may contain:

```text
path
dirty
```

`repository` identifies the canonical source repository. `commit` is the exact source commit used for generation. `path` may identify a subdirectory in a monorepo. `dirty: true` means the package was generated from a worktree containing uncommitted changes.

Released packages should normally reject or strongly discourage `dirty: true`.

The package is generated output. The source repository remains canonical.

## Generator Provenance

`generator` contains:

```text
name
version
```

It may contain:

```text
commit
```

This records which future builder produced the package. The builder is not implemented in Roadmap Point 1.

## Entry Points

Every package declares at least one entry point.

Each entry point contains:

```text
id
path
mediaType
role
```

Initial roles:

```text
primary
index
search-index
metadata
```

The `primary` entry point identifies the package's main machine-readable content.

Paths are relative archive paths. They must not begin with `/`, contain `..`, contain backslashes, point outside the package, or reference undeclared files.

Packages do not need to share a single content media type.

## Files and Checksums

Every runtime-relevant file is listed in `files`.

Each file record contains:

```text
path
mediaType
size
sha256
```

`size` is the uncompressed byte size. `sha256` is the lowercase hexadecimal SHA-256 digest.

Paths are relative and normalized. Every entry point must reference a declared file. Duplicate file paths are invalid. Undeclared runtime content is invalid. Directory entries do not need file records.

`manifest.json` itself does not need to appear in its own `files` list.

The downloadable archive checksum belongs to the future package catalogue, not inside the archive manifest.

## Dependencies

Dependency records support:

```json
{
  "packageId": "com.sleepymario.language.linguistic-terminology",
  "version": ">=0.1.0 <1.0.0",
  "optional": false
}
```

Dependency IDs use package ID syntax. Version ranges use a documented SemVer-compatible syntax. Dependencies may be required or optional.

Packages must not depend on themselves. Circular-dependency detection belongs to a later milestone. Dependency resolution is not implemented in Roadmap Point 1.

## Licensing

The manifest supports:

- SPDX identifier;
- human-readable license name;
- path to an included license file.

Private packages do not need an SPDX identifier. When a license path is declared, it must be a safe relative path and must appear in the file list.

## Compatibility and Updates

Patch releases should not remove or repurpose stable content IDs.

Minor releases may add content and make backward-compatible corrections. They should not silently reuse an existing ID for a different logical item.

Major releases may contain incompatible restructuring. Migration metadata may later be required.

The optional future manifest field `replaces` is reserved but not required or implemented here.

## Deterministic Generation Requirements

The future package generator must:

- produce identical logical content from identical source input;
- sort manifest arrays deterministically where order is not semantically meaningful;
- normalize archive paths;
- use UTF-8;
- avoid local absolute paths;
- avoid machine usernames and hostnames;
- avoid volatile timestamps inside generated content;
- use the declared `generatedAt` timestamp consistently;
- preserve Unicode correctly;
- record source and generator commits;
- calculate SHA-256 checksums after content generation;
- reject duplicate stable IDs.
