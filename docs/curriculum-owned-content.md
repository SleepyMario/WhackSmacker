# Content source ownership

As of the subsequent October 23 repository split, General source ownership is `../whacksmacker-decks-general/`; Specialized remains `../language-curriculum-specialized/`. Japanese Core reviews remain in the Japanese curriculum. Private book/course decks remain in `whacksmacker-decks-private`. General archives have unchanged bytes and updated catalogue locations. See the main README and `packages/core/general-deck-sources.ts`.

## Earlier October 23 integration record (superseded ownership paths)


Current Japanese review blocks and Japanese/Korean/Vietnamese General topography sources belong to their curriculum repositories. Japanese map decks live in `japanese-curriculum/review-content/japanese/`; vocabulary lives in each curriculum's `general/`. Japanese review blocks are in `japanese-curriculum/review-content/japanese/review-decks/`.

Retained immutable packages live in their owning repository's `artifacts/packages/` subdirectories. Private 初級日本語習作 sources and packages remain in `whacksmacker-decks-private`. The shared package catalogue points to these retained archives.

The menu and installers use the normal configured content directory (`WHACKSMACKER_DATA_DIR`, default `~/.local/share/whacksmacker`). They do not read `.local-content`. Japanese review blocks are discovered from installed current metadata, preserving their package/card/source identities.

The October 23 migration copied all installed revisions without overwriting existing files. The separate local progress store had 285 disjoint item identities and 186 events; these were appended unchanged to the main store's 31,580 items and 6,497 events. No scheduling or progress reset occurred. The result is 31,865 items and 6,683 events. Wandering the World progress is untouched.

Original source trees and `.local-content` remain inactive rollback copies after the automatic approval review rejected deleting them. Do not author new content there. A full migration backup and byte-preservation evidence are in the task workspace under `work/wsm-recovery-audit/curriculum-integration/`.

Preserved package revisions must not be regenerated in place. For changed source, use a new artifact revision and a separate generation destination before updating a catalogue. Historical package provenance remains unchanged.
