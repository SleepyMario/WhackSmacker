# Radicals IV

This General deck contains positions 601–800 in the Traditional Chinese
character sequence obtained by filtering the Taiwan Ministry of Education
frequency table to the Ministry's official 4,808-character
`常用國字標準字體表`.

Every entry is one-way:

- Phrase: one Traditional Chinese character;
- Answer: that character's canonical Kangxi radical.

There are no radical-to-character cards, English meanings, pronunciation
answers, Notes, or example sentences. The deck contains exactly 200 cards,
from `綠` through `搖`.

## Sources and ordering

- Character order and frequency data: Taiwan Ministry of Education,
  `本字彙表與《常用國字標準字體表》比對表`, table 18:
  <https://language.moe.gov.tw/001/Upload/files/SITE_CONTENT/M0001/PRIMARY/shrest2-18.htm>
- Radical assignments: Unicode Unihan `kRSUnicode`, Unicode 17.0.0,
  `Unihan_IRGSources.txt`.
- Canonical radical glyphs: this repository's reviewed 214-radical Kangxi
  inventory at `../radicals/sources/radicals.tsv`.

The Ministry table is ordered by corpus frequency but contains only characters
shared with the official common-character list. One non-common character occurs
before the final entry in this batch. Consequently, deck position 800 (`搖`)
has raw corpus frequency rank 801. `sources/characters.tsv` preserves both the
continuous deck position and the original corpus rank instead of silently
renumbering the source data.

`睡` has two Unihan residual-stroke counts but the same radical, `目`. `竟` has
two radical possibilities; this deck uses its conventional Traditional
dictionary assignment `立`.

`scripts/generate-traditional-chinese-radicals-frequency-iv.mjs`
deterministically generates `cards.tsv` from that source file.
