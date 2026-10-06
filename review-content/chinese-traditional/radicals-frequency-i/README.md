# Radicals I

This General deck contains the first 200 Traditional Chinese characters in the
Taiwan Ministry of Education frequency ordering, restricted to characters in
the Ministry's official 4,808-character `常用國字標準字體表`.

Every entry is one-way:

- Phrase: one Traditional Chinese character;
- Answer: that character's canonical Kangxi radical.

There are no radical-to-character cards, English meanings, pronunciation
answers, Notes, or example sentences. The deck therefore contains exactly 200
cards, covering frequency ranks 1–200 (`的` through `由`).

## Sources

- Character order and frequency data: Taiwan Ministry of Education,
  `本字彙表與《常用國字標準字體表》比對表`, table 18. The archived source
  states that its rows follow frequency order and identifies the official
  common-character number for each character:
  <https://language.moe.gov.tw/001/Upload/files/SITE_CONTENT/M0001/PRIMARY/shrest2-18.htm>
- Radical assignments: Unicode Unihan `kRSUnicode`, Unicode 17.0.0,
  `Unihan_IRGSources.txt`.
- Canonical radical glyphs: this repository's reviewed 214-radical Kangxi
  inventory at `../radicals/sources/radicals.tsv`.

`sources/characters.tsv` preserves each selected frequency row, the Ministry
common-character number, the raw Unihan radical/stroke value, the chosen
radical number and glyph, and the selection note. Of these 200 characters,
`最` and `真` have multiple Unihan radical possibilities; this deck uses the
conventional Traditional dictionary assignments `曰` and `目`, respectively.

`scripts/generate-traditional-chinese-radicals-frequency-i.mjs`
deterministically generates `cards.tsv` from that source file.
