# Radicals XVIII

This General deck contains positions 3401–3600 in the Traditional Chinese
character sequence built from the Taiwan Ministry of Education's official
4,808-character `常用國字標準字體表`.

Every entry is one-way:

- Phrase: one Traditional Chinese character;
- Answer: that character's canonical Kangxi radical.

There are no radical-to-character cards, English meanings, pronunciation
answers, Notes, or example sentences. The deck contains exactly 200 cards,
from `蠕` through `嚏`.

## Sources and ordering

- Frequency-ranked characters: Taiwan Ministry of Education,
  `本字彙表與《常用國字標準字體表》比對表`, table 18:
  <https://language.moe.gov.tw/001/Upload/files/SITE_CONTENT/M0001/PRIMARY/shrest2-18.htm>
- Official 4,808-character inventory and appendix order: Taiwan Ministry of
  Education `常用國字標準字體表`.
- Radical assignments: Unicode Unihan `kRSUnicode`, Unicode 17.0.0,
  `Unihan_IRGSources.txt`, reviewed against Taiwan Ministry dictionary indexing
  where an entry has multiple analyses.
- Canonical radical glyphs: this repository's reviewed 214-radical Kangxi
  inventory at `../radicals/sources/radicals.tsv`.

The first 4,343 deck positions are the Ministry common characters present in
the frequency corpus, in corpus-frequency order. The remaining 465 official
common characters were absent from that corpus and are appended in Ministry
common-character-list order. This batch covers deck positions 3401–3600 and corpus ranks 3496–3757.

## Reviewed multiple radical analyses

- `乓`: Unihan `4.5 3.5`; reviewed deck radical `丿`.
- `矗`: Unihan `109.19 24.22`; reviewed deck radical `目`.

`scripts/generate-traditional-chinese-radicals-frequency-xviii.mjs`
deterministically generates `cards.tsv` from that source file.
