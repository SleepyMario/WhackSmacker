# Radicals III

This General deck contains Traditional Chinese frequency ranks 401–600 in the
Taiwan Ministry of Education frequency ordering, restricted to characters in
the Ministry's official 4,808-character `常用國字標準字體表`.

Every entry is one-way:

- Phrase: one Traditional Chinese character;
- Answer: that character's canonical Kangxi radical.

There are no radical-to-character cards, English meanings, pronunciation
answers, Notes, or example sentences. The deck therefore contains exactly 200
cards, covering frequency ranks 401–600 (`留` through `婆`).

## Sources

- Character order and frequency data: Taiwan Ministry of Education,
  `本字彙表與《常用國字標準字體表》比對表`, table 18:
  <https://language.moe.gov.tw/001/Upload/files/SITE_CONTENT/M0001/PRIMARY/shrest2-18.htm>
- Radical assignments: Unicode Unihan `kRSUnicode`, Unicode 17.0.0,
  `Unihan_IRGSources.txt`.
- Canonical radical glyphs: this repository's reviewed 214-radical Kangxi
  inventory at `../radicals/sources/radicals.tsv`.

`sources/characters.tsv` preserves each selected frequency row, the Ministry
common-character number, the raw Unihan radical/stroke value, the chosen
radical number and glyph, and the selection note. In this batch, `視` has two
Unihan radical possibilities; the deck uses its conventional Traditional
dictionary assignment `見`.

`scripts/generate-traditional-chinese-radicals-frequency-iii.mjs`
deterministically generates `cards.tsv` from that source file.
