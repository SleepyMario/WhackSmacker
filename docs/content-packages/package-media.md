# Package-relative images in memorization cards

WhackSmacker memorization cards may combine ordinary text with package-contained raster images. This is a general package-media capability. It does not add a subject-specific schema or TSV column.

## Source contract

TSV v2 keeps its existing 18 columns. Put ordinary Markdown image syntax in the existing `prompt` field or in a string inside `accepted_answers`:

```markdown
![Animal illustration](media/animal-0001-dog-illustration.webp)

dog

The dog is running in the garden.
```

The destination is relative to the package root, not to the TSV file. `media/` is the only approved image root. Raw HTML is not a media contract: `<img src=x onerror=alert(1)>` remains inert text.

For a line-oriented TSV, `\n` escapes may represent the Markdown line breaks. Quoted TSV fields may also contain literal newlines. A minimal v2 row is:

```tsv
card_id	deck	kind	source_chapter	prompt_language	answer_language	prompt	accepted_answers	distractors	explanation	lexical_ids	grammar_ids	geographic_ids	provenance_path	provenance_locator	provenance_evidence	examples	tags
animals/dog/en-to-nl	Chapter 1-5	vocabulary	1	en	nl	![Animal illustration](media/dog-illustration.webp)\n\ndog\n\nThe dog is running in the garden.	["![Wildlife image of a dog](media/dog-wildlife.webp)\n\nde hond\n\nDe hond rent in de tuin."]	[]	A dog vocabulary card.	["nl.animal.dog"]	[]	[]	units/animals/chapter-001/chapter.md	Vocabulary > dog	dog	["The dog is running in the garden."]	["animals"]
```

Alt text is required, trimmed, non-empty, and free of control characters. Prompt-side alt text should be generic and must not reveal the answer, for example `Animal illustration`. Answer-side alt text may be descriptive because the answer is already visible.

## Supported files and package records

Version 1 supports only:

| Extension | Manifest `mediaType` |
|---|---|
| `.webp` | `image/webp` |
| `.png` | `image/png` |
| `.jpg`, `.jpeg` | `image/jpeg` |

The generator includes only images referenced by generated memorization Markdown. It reads them as binary bytes, sorts asset paths deterministically, stores those exact bytes in the `.wspkg`, and adds the existing manifest file record:

```json
{
  "path": "media/dog-illustration.webp",
  "mediaType": "image/webp",
  "size": 12345,
  "sha256": "<lowercase SHA-256>"
}
```

Manifest format v1 is unchanged and packages without media gain no fields or requirements. Image paths and checksums are not added to memorization item IDs. Image destinations are normalized to a path-independent marker when v2 pedagogical fingerprints are calculated, so replacing an image file or package-relative image path alone does not reset learner progress.

## Validation and safety

Every rendered image reference must exactly match one manifest file record and one archive/installed file. Installation verifies archive uniqueness, declared byte size, and SHA-256. Installed-item reads verify the image again, so deleted or modified installed bytes fail rather than producing a broken card.

The following are rejected:

- HTTP, HTTPS, protocol-relative, `data:`, `file:`, `javascript:`, `blob:`, or any other URL scheme;
- absolute paths and Windows drive paths;
- `..`, `.`, empty path segments, backslashes, and encoded path forms;
- query strings, fragments, NULs, and unsupported or case-mismatched extensions;
- missing alt text, missing assets, duplicate/ambiguous paths, MIME mismatches, size mismatches, and checksum mismatches;
- SVG, GIF, video, audio, and undeclared or unreferenced `media/` files.

Content strings never become filesystem paths or browser `src` values. The private web API resolves an installed package ID, exact version, and validated media record to a same-origin `/api/package-media` URL. The browser renderer matches the Markdown destination to that server-produced record before creating an `img`; it constructs text and attributes through DOM APIs and does not enable raw HTML passthrough. Images use their Markdown alt text and safe responsive sizing.

The ordinary noninteractive exercise formatter retains the safe `[Image: <alt text>]` text projection. Interactive CLI Review resolves the current side through this same installed package-media boundary and, when a supported backend is ready, renders real artwork inside the existing centre pane. Unsupported sessions show one concise unavailable notice; they do not use Chafa, ASCII, or Unicode picture approximations. Interactive rendering never prints Markdown destinations, checksums, or installation paths. See [Terminal artwork in interactive Review](../terminal-artwork.md).

## Backward compatibility

Text-only TSV v2 input still generates `text/plain` prompt and answer blocks with the same text, stable card IDs, and pedagogical fingerprints. Existing manifests remain valid, no migration is required, and no media metadata is mandatory. Raw-HTML safety behavior is unchanged.
