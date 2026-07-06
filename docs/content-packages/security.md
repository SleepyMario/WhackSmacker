# Content Package Security

`.wspkg` files are untrusted input.

Roadmap Point 4 implements package fetching and safe local extraction. It still does not implement a reader or sanitizer.

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

Files in `assets/` are static media only. WhackSmacker must never execute package assets.

Rendered-content sanitization remains a later roadmap point.
