import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();
const deckRoot = join(root, "review-content", "chinese-simplified-traditional", "level-2-vocabulary");
const sourcePath = join(deckRoot, "sources", "vocabulary.tsv");
const outputPath = join(deckRoot, "cards.tsv");

const [header, ...body] = (await readFile(sourcePath, "utf8"))
  .replace(/\r?\n$/u, "")
  .split("\n")
  .map((line) => line.replace(/\r$/u, "").split("\t"));
const expectedHeader = ["order", "source_mapping", "simplified", "traditional", "pinyin", "taiwan_pinyin", "meaning", "simplified_sentence", "traditional_sentence", "example_source", "example_source_id", "source_sentence", "pinyin_source", "taiwan_pinyin_source"];
if (JSON.stringify(header) !== JSON.stringify(expectedHeader)) throw new Error(`Unexpected vocabulary header in ${sourcePath}`);

const cardHeader = ["card_id", "deck", "kind", "source_chapter", "prompt_language", "answer_language", "prompt", "accepted_answers", "distractors", "explanation", "lexical_ids", "grammar_ids", "geographic_ids", "provenance_path", "provenance_locator", "provenance_evidence", "examples", "tags"];
const cards = [cardHeader];
const seenSimplified = new Set();

if (body.length !== 1474) throw new Error(`Expected 1474 Level II-only logical entries, found ${body.length}`);

for (const row of body) {
  if (row.length !== expectedHeader.length) throw new Error(`Expected ${expectedHeader.length} fields, found ${row.length}: ${row.join(" | ")}`);
  const [order, mappingCode, simplified, traditional, pinyin, taiwanPinyin, meaning, simplifiedSentence, traditionalSentence, exampleSource, exampleSourceId, sourceSentence, pinyinSource, taiwanPinyinSource] = row;
  if (Number.parseInt(order, 10) !== seenSimplified.size + 1) throw new Error(`Vocabulary order is not contiguous at ${order}`);
  if ([...simplified].length < 2 || [...traditional].length < 2) throw new Error(`Vocabulary entries must contain at least two characters: ${simplified} / ${traditional}`);
  if (!simplifiedSentence.includes(simplified) || !traditionalSentence.includes(traditional)) throw new Error(`Example does not contain ${simplified} / ${traditional}`);
  if (!/^[\p{Script=Latin}\p{M}\s'üÜ:]+$/u.test(pinyin) || !/[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]/u.test(pinyin)) throw new Error(`Invalid tone-marked Hanyu Pinyin for ${simplified}: ${pinyin}`);
  if (taiwanPinyin !== "" && (!/^[\p{Script=Latin}\p{M}\s'üÜ:]+$/u.test(taiwanPinyin) || taiwanPinyinSource === "")) throw new Error(`Invalid Taiwan Hanyu Pinyin for ${traditional}: ${taiwanPinyin}`);
  if (meaning.trim() === "") throw new Error(`Missing English gloss for ${simplified}`);
  if (seenSimplified.has(simplified)) throw new Error(`Duplicate vocabulary entry: ${simplified}`);
  if (pinyinSource !== "CC-CEDICT") throw new Error(`Unexpected Pinyin source for ${simplified}: ${pinyinSource}`);
  if (exampleSource === "tatoeba" && (exampleSourceId === "" || sourceSentence === "")) throw new Error(`Incomplete Tatoeba provenance for ${simplified}`);
  seenSimplified.add(simplified);

  const characters = simplified === traditional ? simplified : `${simplified} / ${traditional}`;
  const compactPinyin = (value) => value.replace(/\s+/gu, "");
  const pinyinDisplay = taiwanPinyin === "" ? pinyin : `陸：${compactPinyin(pinyin)}\n台：${compactPinyin(taiwanPinyin)}`;
  const id = String(Number.parseInt(order, 10)).padStart(4, "0");
  const lexicalId = `zh.level-2-vocabulary.${id}`;
  const sourceDescription = exampleSource === "tatoeba"
    ? `Tatoeba Mandarin sentence ${exampleSourceId}`
    : exampleSource === "authored" ? "project-authored Level II example" : "reviewed Level II example";
  const common = {
    deck: "Level II - Vocabulary",
    kind: "vocabulary",
    sourceUnit: `Level II mapping ${mappingCode}`,
    distractors: [],
    explanation: "",
    lexicalIds: [lexicalId],
    grammarIds: [],
    geographicIds: [],
    provenancePath: "sources/vocabulary.tsv",
    provenanceLocator: `mapping ${mappingCode}; entry ${order}`,
    provenanceEvidence: `${simplified} / ${traditional}: Mainland Hanyu Pinyin checked against CC-CEDICT${taiwanPinyin === "" ? "" : `; Taiwan Hanyu Pinyin checked against ${taiwanPinyinSource}`}; paired example from ${sourceDescription}.`,
    examples: [...new Set([simplifiedSentence, traditionalSentence])],
    tags: ["chinese", "vocabulary", "level-2", "abc", "simplified", "traditional"]
  };
  const directions = [
    { suffix: "a-meaning", promptLanguage: "en", answerLanguage: "zh-Hans", prompt: meaning, answer: `Pinyin: ${pinyinDisplay}\nCharacters: ${characters}` },
    { suffix: "b-pinyin", promptLanguage: "zh-Latn-pinyin", answerLanguage: "zh-Hans", prompt: `Pinyin: ${pinyinDisplay}`, answer: `Meaning: ${meaning}\nCharacters: ${characters}` },
    { suffix: "c-characters", promptLanguage: "zh-Hans", answerLanguage: "en", prompt: `Characters: ${characters}`, answer: `Meaning: ${meaning}\nPinyin: ${pinyinDisplay}` }
  ];
  for (const direction of directions) {
    cards.push([
      `zh-level-2-vocabulary/${id}/${direction.suffix}`, common.deck, common.kind, common.sourceUnit,
      direction.promptLanguage, direction.answerLanguage, direction.prompt, JSON.stringify([direction.answer]),
      JSON.stringify(common.distractors), common.explanation, JSON.stringify(common.lexicalIds),
      JSON.stringify(common.grammarIds), JSON.stringify(common.geographicIds), common.provenancePath,
      common.provenanceLocator, common.provenanceEvidence, JSON.stringify(common.examples), JSON.stringify(common.tags)
    ]);
  }
}

function encodeField(value) {
  const text = String(value).replaceAll("\n", "\\n");
  return /[\t\r\n"]/u.test(text) || text.startsWith("[") ? `"${text.replaceAll('"', '""')}"` : text;
}

await writeFile(outputPath, `${cards.map((row) => row.map(encodeField).join("\t")).join("\n")}\n`, "utf8");
console.log(`Wrote ${cards.length - 1} cards for ${body.length} logical entries to ${outputPath}`);
