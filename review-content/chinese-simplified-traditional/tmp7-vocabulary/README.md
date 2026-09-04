# tmp7 - Vocabulary

An ABC-style Chinese vocabulary deck extracted from the natural example
sentences in `tmp7`.

- Selection: every distinct lexical entry of two or more Han characters in the
  twenty example sentences; one-character words and accidental overlapping
  substrings are excluded.
- Logical entries: 78.
- Cards: 234, comprising Meaning, Pinyin, and Characters prompts for every
  entry.
- Characters: both the Simplified and Traditional forms are shown, separated
  by ` / ` when they differ.
- Examples: every card retains the paired Simplified and Traditional sentence
  from which its vocabulary entry was extracted.
- Notes: omitted from the learner-facing deck.

`sources/vocabulary.tsv` is the compact authored inventory.
`scripts/generate-chinese-tmp7-vocabulary.mjs` deterministically rebuilds
`cards.tsv` from that inventory.
