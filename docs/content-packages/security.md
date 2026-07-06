# Content Package Security

`.wspkg` files are untrusted input.

Roadmap Point 1 documents security rules but does not implement a downloader, installer, extractor, catalogue, reader, or sanitizer.

## Future Installer Rejections

A future installer must reject:

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
