#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const deckRoot = join(root, "review-content/chinese-traditional/radicals");
const sourcePath = join(deckRoot, "sources/radicals.tsv");
const outputPath = join(deckRoot, "cards.tsv");
const header = [
  "card_id", "deck", "kind", "source_chapter", "prompt_language", "answer_language", "prompt",
  "accepted_answers", "distractors", "explanation", "lexical_ids", "grammar_ids", "geographic_ids",
  "provenance_path", "provenance_locator", "provenance_evidence", "examples", "tags"
];

const lines = (await readFile(sourcePath, "utf8")).trimEnd().split("\n");
const sourceHeader = lines.shift()?.split("\t") ?? [];
if (sourceHeader.join("\t") !== "number\tradical\tenglish\thanyu_pinyin\tstrokes\talternative_forms") {
  throw new Error("Unsupported radical source header.");
}

const quote = (value) => /[\t\n"]/u.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
const rows = lines.map((line, index) => {
  const [number, radical, english, pinyin, strokes, alternativeForms = ""] = line.split("\t");
  const expected = String(index + 1);
  if (number !== expected || !radical || !english || !pinyin || !strokes) {
    throw new Error(`Invalid Kangxi radical source row ${expected}.`);
  }
  const identity = `zh.radical.kangxi.${number.padStart(3, "0")}`;
  const answer = `English: ${english}\nHanyu Pinyin: ${pinyin}`;
  const notes = [
    ...(alternativeForms ? [`Alternative forms: ${alternativeForms}`] : []),
    `Strokes: ${strokes}`
  ].join("\n");
  return [
    `zh-traditional-radicals/${number.padStart(3, "0")}/a-radical`,
    "Radicals",
    "vocabulary",
    number,
    "zh-Hant",
    "en",
    radical,
    JSON.stringify([answer]),
    "[]",
    notes,
    JSON.stringify([identity]),
    "[]",
    "[]",
    "sources/radicals.tsv",
    `Kangxi radical ${number}`,
    `${radical}: ${english}; Hanyu Pinyin ${pinyin};${alternativeForms ? ` alternative forms ${alternativeForms};` : ""} ${strokes} stroke${strokes === "1" ? "" : "s"}.`,
    "[]",
    JSON.stringify(["chinese", "traditional", "radicals", "kangxi", "abc"])
  ].map(quote).join("\t");
});

if (rows.length !== 214) throw new Error(`Expected 214 radicals, found ${rows.length}.`);
await writeFile(outputPath, `${header.join("\t")}\n${rows.join("\n")}\n`, "utf8");
