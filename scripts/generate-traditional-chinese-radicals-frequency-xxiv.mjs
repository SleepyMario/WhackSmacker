#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const deckRoot = join(root, "review-content/chinese-traditional/radicals-frequency-xxiv");
const sourcePath = join(deckRoot, "sources/characters.tsv");
const outputPath = join(deckRoot, "cards.tsv");
const header = [
  "card_id", "deck", "kind", "source_chapter", "prompt_language", "answer_language", "prompt",
  "accepted_answers", "distractors", "explanation", "lexical_ids", "grammar_ids", "geographic_ids",
  "provenance_path", "provenance_locator", "provenance_evidence", "examples", "tags"
];
const lines = (await readFile(sourcePath, "utf8")).trimEnd().split("\n");
const sourceHeader = lines.shift()?.split("\t") ?? [];
const expectedSourceHeader = [
  "rank", "corpus_frequency_rank", "character", "frequency", "percentage", "moe_common_character_number",
  "unihan_krsunicode", "radical_number", "radical", "selection_note"
];
if (sourceHeader.join("\t") !== expectedSourceHeader.join("\t")) throw new Error("Unsupported Traditional Chinese frequency-radical source header.");
const quote = (value) => /[\t\n"]/u.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
const rows = lines.map((line, index) => {
  const [rank, corpusFrequencyRank, character, frequency, percentage, officialNumber, unihan, radicalNumber, radical, selectionNote] = line.split("\t");
  const expectedRank = String(index + 4601);
  if (rank !== expectedRank || [...character].length !== 1 || [...radical].length !== 1) throw new Error(`Invalid Traditional Chinese frequency-radical row ${expectedRank}.`);
  if (!/^\d+$/u.test(frequency) || !/^\d+(?:\.\d+)?$/u.test(percentage) || (corpusFrequencyRank && !/^\d+$/u.test(corpusFrequencyRank)) || !/^\d+$/u.test(officialNumber) || !/^\d+$/u.test(radicalNumber) || !unihan || !selectionNote) throw new Error(`Incomplete Traditional Chinese frequency-radical row ${expectedRank}.`);
  const paddedRank = rank.padStart(4, "0");
  const orderIdentity = corpusFrequencyRank ? `zh-Hant.frequency.${corpusFrequencyRank.padStart(4, "0")}` : `zh-Hant.common.${officialNumber.padStart(4, "0")}`;
  const orderEvidence = corpusFrequencyRank ? `corpus frequency rank ${corpusFrequencyRank}; ${frequency} appearances (${percentage}%)` : "absent from frequency corpus; appended in Ministry common-character-list order";
  return [
    `zh-traditional-radicals-frequency-xxiv/${paddedRank}/character-to-radical`, "XXIV", "vocabulary", rank, "zh-Hant", "zh-Hant", character, JSON.stringify([radical]), "[]", "",
    JSON.stringify([orderIdentity, `zh.radical.kangxi.${radicalNumber.padStart(3, "0")}`]), "[]", "[]", "sources/characters.tsv",
    `frequency-order position ${rank}; ${corpusFrequencyRank ? `corpus frequency rank ${corpusFrequencyRank}; ` : ""}Ministry common-character number ${officialNumber}`,
    `${character}: frequency-order position ${rank}; ${orderEvidence}; Unihan kRSUnicode ${unihan}; Kangxi radical ${radicalNumber} ${radical}; ${selectionNote}.`,
    "[]", JSON.stringify(["chinese", "traditional", "radicals", "frequency", "character-to-radical", "one-way", "part-24"])
  ].map(quote).join("\t");
});
if (rows.length !== 208) throw new Error(`Expected 208 frequency-radical cards, found ${rows.length}.`);
await writeFile(outputPath, `${header.join("\t")}\n${rows.join("\n")}\n`, "utf8");
console.log(`Wrote ${rows.length} one-way Traditional Chinese character-to-radical cards to ${outputPath}`);
