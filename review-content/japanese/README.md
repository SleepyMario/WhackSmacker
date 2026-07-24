# Japanese Core Reviews

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
