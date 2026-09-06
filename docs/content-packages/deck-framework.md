# Canonical deck framework

WhackSmacker uses one deck and entry model. `deckFamily`, topic metadata,
media policy, output cardinality, interaction behavior, and presentation are
orthogonal declarations; none is inferred from a language, title, ID, range,
vocabulary value, or filename.

## Durable artifacts and ownership

The cross-repository archive, provenance, immutability, task-bundle, and
completion rules are canonical in
`/home/ashwin/Projects/whacksmacker-modules/whacksmacker-tarballs/ARCHIVE_POLICY.md`.
Generated sources, audits, working/final media, packages, reports, and Codex
handoffs are authoritative only after they are archived, indexed,
checksum-verified, committed, and pushed there. Temporary paths and Downloads
are execution space, never authoritative inputs or handoffs.

Codex owns schemas, deterministic assembly, validation, packaging, tests, and
technical documentation. Language content, artwork generation/selection and
approval, and General/Specialized boundary decisions remain human/assistant
work; Codex must not invent, translate, redraw, regenerate, correct, or approve
them.

## Version axes and immutable artifacts

- `deckVersion` is the semantic curriculum/content release. Current shipped
  decks use `0.0.1` unless an authored release explicitly says otherwise.
- `artifactRevision` is a positive monotonic rebuild number within package ID
  plus deck version. Framework, menu, renderer, schema, archive, media
  attachment, and checksum-only rebuilds increment this axis, not the deck
  version.
- `contentSchemaVersion` identifies the content model.
- `packageFormatVersion` identifies the manifest/archive transport.
- `minimumWhackSmackerVersion` identifies runtime compatibility.

Immutable identity is package ID plus deck version plus artifact revision.
Installing the same identity and archive bytes is idempotent; different bytes
for the same identity are rejected. Active selection compares semantic deck
version, then artifact revision. Learner menus omit artifact revision, while
package diagnostics show both axes.

Legacy manifests and registry records remain readable: `packageVersion`
projects to `deckVersion` and a missing revision projects to 1. More complex
history is never guessed at runtime. A bounded Animals migration maps legacy
`0.0.0`, `0.0.1`, and `0.0.2` to deck `0.0.1`, revisions 1, 2, and 3.

## Universal entries and outputs

Each entry has a stable entry ID, input, ordered non-empty `outputs[]`, an
interaction profile, language and provenance metadata, and zero or more media
bindings. Every output has a stable entry-local ID and content. Ordinary
one-answer cards use one array member; A/B/C cards use the same structure with
three. Existing item/card IDs and pedagogical fingerprints remain the learner
progress identity; migration only projects the answer into the generic array.

Interaction metadata declares whether outputs reveal together or
sequentially, whether one or all satisfy an answer, shared or output-specific
grading, combined/per-output/precomposed reverse cards, independent labels,
and none/shared/output-specific output media. Contradictory profiles are
rejected. Current Chinese and Japanese behavior is preserved as explicit
precomposed metadata; Korean and Vietnamese can later use the same schema
without framework code changes.

## Media

`mediaPolicy` is `none`, `optional`, or `required`.

- `none` skips lookup and creates no placeholders.
- `optional` attaches approved assets when present and permits text-only
  entries when absent.
- `required` requires all declared roles to resolve to approved,
  non-placeholder regular files for production readiness.

Bindings use stable entry ID plus `input`, `shared-output`, or an output ID,
plus a declared media role. This supports one prompt image and one shared
answer image, or one prompt image and separate A/B/C images. Package-relative
paths, raster MIME type, dimensions, size, SHA-256, approval, role, and
deterministic order are validated. The builder does not call providers,
synthesize placeholders, or infer roles from content.

The Review renderer consumes the same content blocks for text-only, media,
one-output, and multi-output entries. Topic decks retain direct topic-leaf
launch, contained dynamic artwork, prompt-to-answer artwork replacement,
accessible alt fallback, Phrase/Answer presentation, and no intermediate
Review-deck child.

## Family, topic, readiness, and ownership

`deckFamily` is explicitly `general`, `specialized`, or `custom`. Topic objects retain
stable `id`, `displayName`, and `deckDisplayName`; grouping is never parsed
from display text. Topics are family-local, so the same topic ID can appear
under both families without changing lexical IDs, entry IDs, media identities,
or progress.

The builder reports language-content, output-structure, interaction-metadata,
optional-media, required-media, and package-metadata readiness independently.
Language text, outputs, examples, IDs, artwork, approvals, and family-boundary
decisions are human-owned. Codex and build tooling own only the technical
schema, validation, migration, deterministic package generation, and runtime
integration.
