# Content Package Security

`.wspkg` files are untrusted input.

Roadmap Point 4 implements package fetching and safe local extraction. Reader rendering keeps raw HTML inert. Memorization-card images use a separate, narrow Markdown-to-declared-package-asset contract.

## Installer Rejections

The installer rejects:

- absolute paths;
- `..` traversal;
- backslash-based traversal;
- symlinks;
- hard links;
- device files;
- executable hooks;
- duplicate normalized paths;
- files not declared in the manifest when they affect runtime content;
- unsupported package-format versions;
- invalid checksums;
- oversized packages beyond configured limits;
- excessive file counts;
- malformed UTF-8 where text is required.

## Runtime Rendering

Packages may contain static HTML or Markdown as data.

WhackSmacker must sanitize rendered content and must not execute embedded scripts.

Files in `assets/` are static media only. WhackSmacker must never execute package assets. Memorization-card images are limited to declared `.webp`, `.png`, `.jpg`, and `.jpeg` files under package-root `media/`; remote URLs, active schemes, encoded paths, and raw HTML images are rejected or remain inert.

See [Package-relative images in memorization cards](package-media.md) for the exact path, checksum, browser-resolution, and CLI-placeholder rules.
