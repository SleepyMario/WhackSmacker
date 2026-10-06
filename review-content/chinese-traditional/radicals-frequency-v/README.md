# Radicals V

This General deck contains positions 801–1000 in the Traditional Chinese
character sequence obtained by filtering the Taiwan Ministry of Education
frequency table to the Ministry's official 4,808-character
`常用國字標準字體表`.

Every entry is one-way:

- Phrase: one Traditional Chinese character;
- Answer: that character's canonical Kangxi radical.

There are no radical-to-character cards, English meanings, pronunciation
answers, Notes, or example sentences. The deck contains exactly 200 cards,
from `貓` through `箱`.

## Sources and ordering

- Character order and frequency data: Taiwan Ministry of Education,
  `本字彙表與《常用國字標準字體表》比對表`, table 18:
  <https://language.moe.gov.tw/001/Upload/files/SITE_CONTENT/M0001/PRIMARY/shrest2-18.htm>
- Radical assignments: Unicode Unihan `kRSUnicode`, Unicode 17.0.0,
  `Unihan_IRGSources.txt`.
- Canonical radical glyphs: this repository's reviewed 214-radical Kangxi
  inventory at `../radicals/sources/radicals.tsv`.

The Ministry table is ordered by corpus frequency but contains only characters
shared with the official common-character list. The source data preserves both
the continuous deck position and the original corpus rank. This batch covers
deck positions 801–1000 and corpus ranks 802–1001.

`初` and `章` have multiple Unihan radical possibilities. This deck uses their
conventional Traditional dictionary assignments `刀` and `立`, respectively.

`scripts/generate-traditional-chinese-radicals-frequency-v.mjs`
deterministically generates `cards.tsv` from that source file.
