# Level II - Vocabulary

An ABC-style vocabulary deck extracted from the paired Simplified and
Traditional example sentences in `Level II`.

- Cumulative selection rule: load the complete Level I vocabulary inventory
  first and exclude every Simplified headword already taught there.
- Level I exclusions: 685 distinct words encountered in Level II examples;
  all are recorded in `sources/level-1-exclusions.tsv`.
- Level II-only logical entries: 1,474.
- Cards: 4,422, comprising Meaning, Pinyin, and Characters prompts for every
  entry.
- Selection: every remaining distinct dictionary-recognized expression
  containing two or more Han characters, in its first order of appearance in
  the Level II examples.
- Pinyin: Mainland Hanyu Pinyin is checked against CC-CEDICT. Where Taiwan's
  Ministry of Education dictionary gives a different reading, the deck shows
  two lines: `陸：…` followed by `台：…`. CC-CEDICT's explicit Taiwan reading
  is used as a fallback when an entry is absent from the MOE dictionary.
- English: deliberately short supporting glosses, matching the Level I
  vocabulary style.
- Characters: both forms are shown, separated by ` / ` when they differ.
- Examples: every card retains the paired Simplified and Traditional sentence
  from Level II. Candidates whose direct Traditional form does not occur in
  the paired sentence are omitted rather than being given a mismatched example.
- Notes: omitted from the learner-facing deck.

`scripts/generate-chinese-level2-vocabulary-source.mjs` deterministically loads
the Level I inventory, extracts the Level II-only source inventory, and writes
the exclusion ledger. `scripts/generate-chinese-level2-vocabulary.mjs` rebuilds
`cards.tsv` from that inventory.

## Sources

- Example sentences: the reviewed Level II conversion deck, including its
  retained Tatoeba and Leipzig corpus provenance and project-authored examples.
- Hanyu Pinyin and lexical checking: [CC-CEDICT](https://cc-cedict.org/),
  licensed under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).
- Taiwan Hanyu Pinyin: Taiwan Ministry of Education,
  [《國語辭典簡編本》](https://dict.concised.moe.edu.tw/), using the Ministry's
  public dictionary data release.
