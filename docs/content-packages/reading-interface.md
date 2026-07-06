# Reading Interface

Roadmap Point 5 adds passive reading for installed content packages.

The reader discovers installed packages through the Point 4 installed-package registry and reads files from installed package directories.

It does not store reading progress, schedule reviews, render exercises, or connect reading to review.

## Commands

List readable installed packages:

```sh
whacksmacker content read [--data-dir <dir>]
```

List readable files inside a package:

```sh
whacksmacker content files <package-id> [--version <version>] [--data-dir <dir>]
```

Read one file:

```sh
whacksmacker content read <package-id> --file <path> [--version <version>] [--data-dir <dir>]
```

## Readable Content

For the current source-Markdown snapshot packages, WhackSmacker lists and renders the Markdown source files captured inside `content/content.json`.

For future package shapes, readable package files are limited to declared text-like files such as Markdown, plain text, and JSON.

The reader validates requested paths as safe package-relative paths and never executes package content.

## Progress Separation

Reading is passive in this milestone.

The reader does not write progress, annotations, scheduling state, completion state, or user settings into installed package directories.
