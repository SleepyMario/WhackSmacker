# Level I - Vocabulary

An ABC-style vocabulary deck extracted from the paired Simplified and
Traditional example sentences in `Level I`.

- Selection: every distinct dictionary-recognized expression containing two or
  more Han characters, in its first order of appearance in the Level I examples.
- Logical entries: 2,815.
- Cards: 8,445, comprising Meaning, Pinyin, and Characters prompts for every
  entry.
- Pinyin: Mainland Hanyu Pinyin is checked against CC-CEDICT. Where Taiwan's
  Ministry of Education dictionary gives a different reading, the deck shows
  two lines: `陸：…` followed by `台：…`. CC-CEDICT's explicit Taiwan reading is
  used as a fallback when an entry is absent from the MOE dictionary.
- English: deliberately short supporting glosses, in the style of
  `tmp7 - Vocabulary`.
- Characters: both forms are shown, separated by ` / ` when they differ.
- Examples: every card retains the paired Simplified and Traditional sentence
  from Level I; when both forms are identical, the learner-facing card shows
  the sentence once. Tatoeba sentence IDs and original text are retained in
  `sources/vocabulary.tsv` where available; remaining examples are marked as
  project-authored or previously reviewed.
- Notes: omitted from the learner-facing deck.

`scripts/generate-chinese-level1-vocabulary-source.mjs` deterministically
extracts the source inventory. `scripts/generate-chinese-level1-vocabulary.mjs`
rebuilds `cards.tsv` from that inventory.

## Sources

- Example sentences: [Tatoeba Mandarin Chinese sentence export](https://downloads.tatoeba.org/exports/per_language/cmn/), licensed under [CC BY 2.0 FR](https://creativecommons.org/licenses/by/2.0/fr/), where a suitable sentence was available.
- Hanyu Pinyin and lexical checking: [CC-CEDICT](https://cc-cedict.org/), licensed under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).
- Taiwan Hanyu Pinyin: Taiwan Ministry of Education, [《國語辭典簡編本》](https://dict.concised.moe.edu.tw/), using the Ministry's public dictionary data release. The Concise Dictionary is used because it is intended for present-day learners; CC-CEDICT's explicit `Taiwan pr.` field supplies a fallback only when the headword is absent there.
