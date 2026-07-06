# Mathematics Artifact Policy

WhackSmacker currently generates mathematics workbook PDFs on demand.

This document records the artifact policy before any pregenerated mathematics workbooks are added.

## Current State

The implemented mathematics commands are:

- `whacksmacker mathematics one-two-three`
- `whacksmacker mathematics four-and-five`
- `whacksmacker mathematics one-to-five`
- `whacksmacker mathematics six-to-nine`
- `whacksmacker mathematics beginner-volume-one`

Each command renders a PDF when run. The default output paths are root-relative PDF filenames such as `./one-two-three-workbook.pdf` and `./beginner-mathematics-volume-one.pdf`.

No pregenerated mathematics PDFs are committed today. The repository contains generator code, workbook models, tests, and curriculum-link metadata, not built workbook artifacts.

## Local Artifact Location

For local development, generated mathematics artifacts should be written outside tracked source paths.

Recommended local staging directory:

```text
math-artifacts/
```

Examples:

```sh
whacksmacker mathematics one-two-three --output math-artifacts/one-two-three-workbook.pdf --seed 184726
whacksmacker mathematics beginner-volume-one --output math-artifacts/beginner-mathematics-volume-one.pdf --seed 184726
```

Temporary validation output should continue to use temporary directories in tests.

## Commit Policy

Do not commit generated mathematics PDFs by default.

The following are source material and may be committed:

- TypeScript generator code;
- workbook models and renderer logic;
- tests;
- documentation;
- small hand-authored metadata files;
- future package manifests or catalogues when intentionally designed.

The following should not be committed unless a future task explicitly changes this policy:

- generated `.pdf` workbooks;
- ad hoc local render output;
- visual-inspection scratch files;
- generated package archives containing mathematics artifacts;
- generated catalogues for local mathematics package experiments.

The `.gitignore` file blocks the current default workbook filenames and the local `math-artifacts/` staging directory.

## Naming and Versioning

Local generated files should use stable, descriptive names:

```text
<unit-slug>-workbook.pdf
beginner-mathematics-volume-one.pdf
```

When pregenerated artifacts become first-class deliverables, their names should include enough versioning metadata to identify the content release and generator input. A future package-oriented naming convention should prefer package identity and semantic versioning, for example:

```text
com.sleepymario.mathematics.curriculum-0.1.0.wspkg
```

Inside a future package, workbook entry names should remain stable and human-readable, for example:

```text
content/workbooks/beginner-mathematics-volume-one.pdf
content/workbooks/one-two-three-workbook.pdf
```

Renaming a displayed title must not silently change any future stable content identifier.

## Future Package Strategy

Mathematics should eventually become a first-class content package instead of only an on-demand generator.

The likely future flow is:

```text
canonical math-curriculum repository
        ↓
WhackSmacker mathematics renderer/generator
        ↓
deterministic mathematics package build
        ↓
versioned .wspkg package
        ↓
installed read-only package content
```

The package should be self-contained. End users should not need `/home/ashwin/Projects/math-curriculum` at runtime.

Possible future package ID:

```text
com.sleepymario.mathematics.curriculum
```

The package may contain generated PDFs, machine-readable workbook metadata, or both. The exact mathematics content schema has not been designed yet.

## Curriculum Integration

The standalone `math-curriculum` repository remains the canonical curriculum-design source.

WhackSmacker mathematics units already record stable curriculum IDs and source document paths for traceability. Future pregeneration should preserve that link in any generated package metadata.

The future mathematics module should distinguish:

- curriculum source identity;
- generated artifact identity;
- package version;
- user progress or completion state.

User progress must remain outside installed package directories.

## Open Decisions

Before pregenerated mathematics artifacts are added, decide:

- whether PDFs are built manually, by a package-generation command, or by release automation;
- whether visual-validation outputs are kept only locally or attached to releases;
- which seed or seed policy is canonical for pregenerated workbooks;
- whether every unit gets a PDF artifact or only complete volumes do;
- how generated PDFs map to future content IDs;
- whether mathematics packages include reviewable memorization items or only printable workbooks;
- how package updates preserve user progress when workbook content changes.

