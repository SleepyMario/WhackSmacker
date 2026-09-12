#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const deckRoot = join(root, "review-content/chinese-simplified/radicals");
const sourcePath = join(deckRoot, "sources/radicals.tsv");
const outputPath = join(deckRoot, "cards.tsv");
const header = [
  "card_id", "deck", "kind", "source_chapter", "prompt_language", "answer_language", "prompt",
  "accepted_answers", "distractors", "explanation", "lexical_ids", "grammar_ids", "geographic_ids",
  "provenance_path", "provenance_locator", "provenance_evidence", "examples", "tags"
];

const lines = (await readFile(sourcePath, "utf8")).trimEnd().split("\n");
const sourceHeader = lines.shift()?.split("\t") ?? [];
if (sourceHeader.join("\t") !== "number\tprincipal_radical\tprompt\tenglish\thanyu_pinyin\tstrokes\tattached_forms") {
  throw new Error("Unsupported Simplified Chinese radical source header.");
}

const quote = (value) => /[\t\n"]/u.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
const rows = lines.map((line, index) => {
  const [number, principalRadical, prompt, english, pinyin, strokes, attachedForms = ""] = line.split("\t");
  const expected = String(index + 1);
  if (number !== expected || !principalRadical || !prompt || !english || !pinyin || !strokes) {
    throw new Error(`Invalid GF 0011-2009 radical source row ${expected}.`);
  }
  const identity = `zh.radical.gf0011.${number.padStart(3, "0")}`;
  const answer = `English: ${english}\nHanyu Pinyin: ${pinyin}`;
  const notes = [
    ...(attachedForms ? [`Alternative forms: ${attachedForms}`] : []),
    `Strokes: ${strokes}`
  ].join("\n");
  return [
    `zh-simplified-radicals/${number.padStart(3, "0")}/a-radical`,
    "Radicals",
    "vocabulary",
    number,
    "zh-Hans",
    "en",
    prompt,
    JSON.stringify([answer]),
    "[]",
    notes,
    JSON.stringify([identity]),
    "[]",
    "[]",
    "sources/radicals.tsv",
    `GF 0011-2009 principal radical ${number}`,
    `${principalRadical}: ${english}; Hanyu Pinyin ${pinyin};${attachedForms ? ` attached forms ${attachedForms};` : ""} ${strokes} stroke${strokes === "1" ? "" : "s"}.`,
    "[]",
    JSON.stringify(["chinese", "simplified", "radicals", "gf-0011-2009", "abc"])
  ].map(quote).join("\t");
});

if (rows.length !== 201) throw new Error(`Expected 201 principal radicals, found ${rows.length}.`);
await writeFile(outputPath, `${header.join("\t")}\n${rows.join("\n")}\n`, "utf8");
