# Japanese Core Reviews

## Current status — September 24, 2026

Three current blocks: Chapter I - V has 34 identities / 102 A/B/C cards;
Chapter VI - X has 37 identities / 111 A/B/C cards; Chapter XI - XV has
46 identities / 138 A/B/C cards. Every card uses 1–3 literal chapter examples.
The third block includes the reading-aware A/B/C form of all vocabulary first
introduced in Chapters XI–XV. Source authoring and local package installation
remain distinct from Git publication. This overrides older status below.

<!-- curriculum-reset-status:2026-09-11 -->
## Current source status — September 11, 2026

The restart now has **five newly authored chapters**. Chapters I–IV are
accepted for now. Chapter V — At the Café is ready for user review: a twelve-turn
dialogue with eight new lexical senses and independent spatial これ/それ/あれ.
Exercises remain separate and deferred. The first five-chapter vocabulary deck is authored and locally available as
Decks → Reading → Chapter I - V: 34 identities, 102 A/B/C cards with 1–3 exact
chapter examples per card. The Grammar entry is now authored and bundled: Easy in Normal, Hard in Expert,
with five shared grammar identities and fifteen shared examples; awaiting user review.
Historical chapter deletions remain intentional, and current changes remain uncommitted.

The previous lessons and decks are preserved in the [September 4 recovery archive](/home/ashwin/Projects/whacksmacker-modules/whacksmacker-tarballs/artifacts/curricula/pre-final-backups/2026-09-04/2026-09-04-wsm-pre-final-curricula-lessons-and-review-decks-v1.tar.gz).
Cast profiles, research, inventory targets, and retained metadata were not cleared.
Old chapter occurrences, readings, appearance counts, taught-state claims, and
completion claims in those files must be reconciled against newly authored
chapters before reuse; their presence does not mean the removed content exists.

Installed packages, generated feeds, learner progress, specialized content, and
the separate Vietnamese lesson worktree are outside this source reset. This
status is not a statement that those installations were removed or rebuilt.

Japanese Chapters 1–5, their exact block Review deck, and paired grammar
summaries are the authorized next authoring scope. All five chapters are authored. The block Review deck is available locally;
the Grammar entry is authored and awaiting user review (Easy in Normal, Hard in Expert).

The records below describe the earlier curriculum or its retained conventions.
Their chapter lists, counts, completion statements, and next-chapter plans are
**historical**, not current source status. Follow the current canonical
[language curriculum rules](/home/ashwin/Projects/whacksmacker-modules/language-learning-curriculum-builder/language-curriculum-rules.md)
where older conventions conflict.

<!-- /curriculum-reset-status -->

## Historical record and retained conventions

This is the sole editable authoritative Japanese Review source. The Review
content uses the Whacksmacker Curriculum Content License; application code and
technical tooling remain GPL. The Japanese reading repository owns canonical
lexical/occurrence reading identities but does not own a competing Review deck.

Decks remain fixed 18-field schema-v2 TSV files with JSON arrays in the
structured answer field. Across each A/B/C card group, the logical vocabulary
entry has two values when its Japanese expression contains no kanji and three
when it contains kanji. The required third value is the complete lexical
hiragana reading of the whole expression. Kana-only entries omit the redundant
Reading component; they do not store an empty placeholder.

Readings follow `japanese-contextual-reading-identity-policy`. Every
kanji-containing entry and every literal example must resolve through exact
provenance to the same explicit contextual reading identity. A different
actually taught reading of an identical written form has a separate stable
identity and A/B/C group; possible dictionary readings are not curriculum
evidence. If identical written forms make C ambiguous, its supported prompt is
`Japanese: <written form>; Context: <exact literal occurrence>`.
