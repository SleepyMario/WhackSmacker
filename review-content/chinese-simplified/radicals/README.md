# Radicals

This General Deck follows mainland China's GF 0011-2009 `汉字部首表` and
contains one card for each of its 201 principal indexing components.

Each entry uses the same deck-specific ABC presentation as the Traditional
Chinese deck:

- A: the principal radical, shown alone as the phrase;
- B: a concise English meaning, revealed under `English`;
- C: Hanyu Pinyin with tone marks, revealed under `Hanyu Pinyin`;
- Notes: attached forms when applicable, followed by the displayed form's
  stroke count as the lowest line.

There are no English-to-radical or Pinyin-to-radical cards. The sole A-side
annotation is `斗 (simplified form of 鬥)` for principal radical 190, which
distinguishes it from principal radical 96 `斗` (dipper).

The principal inventory, order, attached-form associations, and stroke groups
follow GF 0011-2009. The standard does not print the complete family of fold
stroke forms beside `乛`; the source records the common searchable forms
`㇆`, `⺄`, `乚`, and `乙` rather than inventing an exhaustive list.
`scripts/generate-simplified-chinese-radicals.mjs` deterministically generates
`cards.tsv` from `sources/radicals.tsv`.
