# Radicals

This General Deck contains the 214 Kangxi radicals in canonical radical and
stroke-count order.

Each logical entry produces one card using this deck-specific ABC presentation:

- A: the Traditional Chinese radical, shown alone as the phrase;
- B: a concise English meaning, revealed under `English`;
- C: Hanyu Pinyin with tone marks, revealed under `Hanyu Pinyin`;
- Notes: bullet points listing established positional or component forms when
  applicable, followed by the radical's stroke count as the lowest line.

There are no English-to-radical or Pinyin-to-radical cards. The deck therefore
contains exactly 214 cards. Component variants are recorded in Notes rather
than added to A because A is the canonical Kangxi indexing radical being
learned.

The ordered radical inventory and stroke counts follow the canonical 214
Kangxi radical table. Variant forms follow the Unicode CJK Radicals Supplement
and common Traditional Chinese positional forms. English labels and Hanyu Pinyin were checked against
complete 214-radical reference tables, including Hanziway's radical table and
the Hong Kong Legislative Council education paper's Kangxi radical table.
`scripts/generate-traditional-chinese-radicals.mjs` deterministically generates
`cards.tsv` from `sources/radicals.tsv`.
