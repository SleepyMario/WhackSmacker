import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();
const deckRoot = join(root, "review-content", "chinese-simplified-traditional", "tmp7-vocabulary");
const sourcePath = join(deckRoot, "sources", "vocabulary.tsv");
const outputPath = join(deckRoot, "cards.tsv");

const [header, ...body] = (await readFile(sourcePath, "utf8")).trimEnd().split("\n").map((line) => line.split("\t"));
const expectedHeader = ["order", "sentence_no", "simplified", "traditional", "pinyin", "meaning", "simplified_sentence", "traditional_sentence"];
if (JSON.stringify(header) !== JSON.stringify(expectedHeader)) throw new Error(`Unexpected vocabulary header in ${sourcePath}`);

const cardHeader = ["card_id", "deck", "kind", "source_chapter", "prompt_language", "answer_language", "prompt", "accepted_answers", "distractors", "explanation", "lexical_ids", "grammar_ids", "geographic_ids", "provenance_path", "provenance_locator", "provenance_evidence", "examples", "tags"];
const cards = [cardHeader];
const seenSimplified = new Set();

if (body.length !== 78) throw new Error(`Expected 78 logical entries, found ${body.length}`);

for (const row of body) {
  if (row.length !== expectedHeader.length) throw new Error(`Expected ${expectedHeader.length} fields, found ${row.length}: ${row.join(" | ")}`);
  const [order, sentenceNo, simplified, traditional, pinyin, meaning, simplifiedSentence, traditionalSentence] = row;
  if (Number.parseInt(order, 10) !== seenSimplified.size + 1) throw new Error(`Vocabulary order is not contiguous at ${order}`);
  if ([...simplified].length < 2 || [...traditional].length < 2) throw new Error(`Vocabulary entries must contain at least two characters: ${simplified} / ${traditional}`);
  if (!simplifiedSentence.includes(simplified) || !traditionalSentence.includes(traditional)) throw new Error(`Source sentence does not contain ${simplified} / ${traditional}`);
  if (seenSimplified.has(simplified)) throw new Error(`Duplicate vocabulary entry: ${simplified}`);
  seenSimplified.add(simplified);
  const characters = simplified === traditional ? simplified : `${simplified} / ${traditional}`;
  const id = String(Number.parseInt(order, 10)).padStart(4, "0");
  const lexicalId = `zh.tmp7-vocabulary.${id}`;
  const common = {
    deck: "tmp7 - Vocabulary",
    kind: "vocabulary",
    sourceUnit: `tmp7 sentence ${String(Number.parseInt(sentenceNo, 10)).padStart(2, "0")}`,
    distractors: [],
    explanation: "",
    lexicalIds: [lexicalId],
    grammarIds: [],
    geographicIds: [],
    provenancePath: "sources/vocabulary.tsv",
    provenanceLocator: `sentence ${sentenceNo}; entry ${order}`,
    provenanceEvidence: `${simplified} / ${traditional} was extracted from tmp7 example sentence ${sentenceNo}.`,
    examples: [simplifiedSentence, traditionalSentence],
    tags: ["chinese", "vocabulary", "tmp7", "abc", "simplified", "traditional"]
  };
  const directions = [
    { suffix: "a-meaning", promptLanguage: "en", answerLanguage: "zh-Hans", prompt: meaning, answer: `Pinyin: ${pinyin}\nCharacters: ${characters}` },
    { suffix: "b-pinyin", promptLanguage: "zh-Latn-pinyin", answerLanguage: "zh-Hans", prompt: `Pinyin: ${pinyin}`, answer: `Meaning: ${meaning}\nCharacters: ${characters}` },
    { suffix: "c-characters", promptLanguage: "zh-Hans", answerLanguage: "en", prompt: `Characters: ${characters}`, answer: `Meaning: ${meaning}\nPinyin: ${pinyin}` }
  ];
  for (const direction of directions) {
    cards.push([
      `zh-tmp7-vocabulary/${id}/${direction.suffix}`, common.deck, common.kind, common.sourceUnit,
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
