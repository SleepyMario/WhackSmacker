import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();
const deckRoot = join(root, "review-content", "chinese-simplified-traditional", "level-1");
const sourcePath = join(deckRoot, "sources", "mappings.tsv");
const outputPath = join(deckRoot, "cards.tsv");

const expectedHeader = [
  "official_no", "level", "simplified", "mapping_code", "traditional", "inherited",
  "simplified_example", "traditional_example", "example_source", "original_example_source",
  "simplified_sentence", "traditional_sentence", "field_usage", "context_kind"
];
const [header, ...body] = (await readFile(sourcePath, "utf8"))
  .trimEnd()
  .split("\n")
  .map((line) => line.split("\t"));
if (JSON.stringify(header) !== JSON.stringify(expectedHeader)) {
  throw new Error(`Unexpected Level I mapping header in ${sourcePath}`);
}
if (body.length !== 1255) throw new Error(`Expected 1255 mappings, found ${body.length}`);

const cardHeader = [
  "card_id", "deck", "kind", "source_chapter", "prompt_language", "answer_language",
  "prompt", "accepted_answers", "distractors", "explanation", "lexical_ids", "grammar_ids",
  "geographic_ids", "provenance_path", "provenance_locator", "provenance_evidence", "examples", "tags"
];
const cards = [cardHeader];
const seenMappingCodes = new Set();

for (const row of body) {
  if (row.length !== expectedHeader.length) {
    throw new Error(`Expected ${expectedHeader.length} fields, found ${row.length}: ${row.join(" | ")}`);
  }
  const [
    officialNo, level, simplified, mappingCode, traditional, inherited,
    simplifiedWord, traditionalWord, exampleSource, originalExampleSource,
    simplifiedSentence, traditionalSentence, fieldUsage, contextKind
  ] = row;
  if (level !== "1") throw new Error(`Expected Level I mapping, found level ${level} at ${mappingCode}`);
  const mappingMatch = /^(\d+)_(\d+)$/u.exec(mappingCode);
  if (!mappingMatch || mappingMatch[1] !== officialNo) throw new Error(`Invalid mapping code ${mappingCode}`);
  if (seenMappingCodes.has(mappingCode)) throw new Error(`Duplicate mapping code ${mappingCode}`);
  seenMappingCodes.add(mappingCode);
  if (![simplified, traditional, simplifiedWord, traditionalWord, simplifiedSentence, traditionalSentence].every(Boolean)) {
    throw new Error(`Incomplete mapping ${mappingCode}`);
  }
  if ([...simplifiedWord].length < 2 || [...traditionalWord].length < 2) {
    throw new Error(`Context words must contain at least two characters at ${mappingCode}`);
  }
  if (!simplifiedWord.includes(simplified) || !traditionalWord.includes(traditional)) {
    throw new Error(`Context words do not contain their mapped characters at ${mappingCode}`);
  }
  if (!simplifiedSentence.includes(simplifiedWord) || !traditionalSentence.includes(traditionalWord)) {
    throw new Error(`Example sentences do not contain their context words at ${mappingCode}`);
  }
  if (/(例句中使用了|此处使用|這裡使用)/u.test(`${simplifiedSentence}\n${traditionalSentence}`)) {
    throw new Error(`Placeholder example sentence remains at ${mappingCode}`);
  }

  const officialId = officialNo.padStart(4, "0");
  const mapId = mappingMatch[2].padStart(2, "0");
  const lexicalIds = [`zh-tghz2013.${officialId}`, `zh-tghz2013.${officialId}.map-${mapId}`];
  const examples = [...new Set([simplifiedSentence, traditionalSentence])];
  const commonTags = [
    "chinese", "simplified-traditional", "tghz2013", "level-1", "bidirectional", "one-context-sentence"
  ];
  const provenanceEvidence = `${simplifiedSentence} ⇄ ${traditionalSentence}`;
  const sourceDetails = [
    `context ${exampleSource}`,
    `source ${originalExampleSource}`,
    inherited === "true" ? "inherited mapping" : "official mapping",
    contextKind,
    fieldUsage
  ].filter(Boolean).join("; ");
  const directions = [
    {
      suffix: "hans-to-hant", promptLanguage: "zh-Hans", answerLanguage: "zh-Hant",
      prompt: `${simplified}（${simplifiedWord}）`, answer: `${traditional}（${traditionalWord}）`
    },
    {
      suffix: "hant-to-hans", promptLanguage: "zh-Hant", answerLanguage: "zh-Hans",
      prompt: `${traditional}（${traditionalWord}）`, answer: `${simplified}（${simplifiedWord}）`
    }
  ];

  for (const direction of directions) {
    cards.push([
      `zh-tghz2013-level-1/${officialId}-map-${mapId}/${direction.suffix}`,
      "通用规范汉字表 第1级", "vocabulary", officialNo,
      direction.promptLanguage, direction.answerLanguage, direction.prompt,
      JSON.stringify([direction.answer]), JSON.stringify([]), "", JSON.stringify(lexicalIds),
      JSON.stringify([]), JSON.stringify([]), "sources/mappings.tsv",
      `规范字编号 ${officialId}；对应码 ${mappingCode}`,
      `${provenanceEvidence} (${sourceDetails})`, JSON.stringify(examples),
      JSON.stringify([...commonTags, direction.suffix])
    ]);
  }
}

function encodeField(value) {
  const text = String(value).replaceAll("\n", "\\n");
  return /[\t\r\n"]/u.test(text) || text.startsWith("[")
    ? `"${text.replaceAll('"', '""')}"`
    : text;
}

await writeFile(outputPath, `${cards.map((row) => row.map(encodeField).join("\t")).join("\n")}\n`, "utf8");
console.log(`Wrote ${cards.length - 1} cards for ${body.length} Level I mappings to ${outputPath}`);
