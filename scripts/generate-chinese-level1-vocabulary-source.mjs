import { readFile, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";

const root = process.cwd();
const cedictPath = resolve(process.argv[2] ?? "/tmp/cedict.txt");
const moePath = resolve(process.argv[3] ?? "/tmp/moe-concised.json");
const mappingsPath = join(root, "review-content", "chinese-simplified-traditional", "level-1", "sources", "mappings.tsv");
const provenancePath = join(root, "review-content", "chinese-simplified-traditional", "level-1", "sources", "example-provenance.tsv");
const outputPath = join(root, "review-content", "chinese-simplified-traditional", "level-1-vocabulary", "sources", "vocabulary.tsv");
const hanOnly = /^\p{Script=Han}+$/u;

function parseTsv(text) {
  const lines = text.trimEnd().split("\n");
  const header = lines.shift().split("\t");
  return { header, rows: lines.map((line) => line.replace(/\r$/u, "").split("\t")), at: Object.fromEntries(header.map((name, index) => [name, index])) };
}

const dictionary = new Map();
for (const rawLine of (await readFile(cedictPath, "utf8")).split("\n")) {
  const line = rawLine.replace(/\r$/u, "");
  const match = /^([^#\s]+)\s+([^\s]+)\s+\[([^\]]+)\]\s+\/(.*)\/$/u.exec(line);
  if (!match) continue;
  const [, traditional, simplified, pinyin, definitionText] = match;
  if (!dictionary.has(simplified)) dictionary.set(simplified, []);
  dictionary.get(simplified).push({ traditional, pinyin, definitions: definitionText.split("/").filter(Boolean) });
}

const moeReadingsByTitle = new Map();
for (const entry of JSON.parse(await readFile(moePath, "utf8"))) {
  const readings = entry.pinyin === undefined
    ? (entry.heteronyms ?? []).map((item) => item.pinyin).filter(Boolean)
    : [entry.pinyin].filter(Boolean);
  if (readings.length === 0) continue;
  const existing = moeReadingsByTitle.get(entry.title) ?? [];
  moeReadingsByTitle.set(entry.title, [...new Set([...existing, ...readings])]);
}

const mappings = parseTsv(await readFile(mappingsPath, "utf8"));
const provenance = parseTsv(await readFile(provenancePath, "utf8"));
const provenanceByMapping = new Map(provenance.rows.map((row) => [row[provenance.at.mapping_code], {
  sourceType: row[provenance.at.source_type],
  sourceId: row[provenance.at.source_id],
  sourceSentence: row[provenance.at.source_sentence],
}]));
const segmenter = new Intl.Segmenter("zh-Hans", { granularity: "word" });
const inventory = new Map();

// CC-CEDICT deliberately lists every reading and sense. These entries need the
// reading and short gloss that match the particular Level I source sentence.
const vocabularyOverrides = new Map(Object.entries({
  "下面": { pinyin: "xia4 mian4", meaning: "below" },
  "不是": { pinyin: "bu4 shi4", meaning: "not" },
  "了解": { pinyin: "liao3 jie3", meaning: "to understand" },
  "分子": { pinyin: "fen4 zi3", meaning: "member of a group" },
  "家伙": { pinyin: "jia1 huo5", meaning: "guy" },
  "尽快": { pinyin: "jin3 kuai4", meaning: "as soon as possible" },
  "尽量": { pinyin: "jin3 liang4", meaning: "as much as possible" },
  "十一": { pinyin: "shi2 yi1", meaning: "eleven" },
  "友好": { pinyin: "you3 hao3", meaning: "friendly" },
  "友谊": { pinyin: "you3 yi4", meaning: "friendship" },
  "反复": { pinyin: "fan3 fu4", meaning: "repeatedly" },
  "名家": { pinyin: "ming2 jia1", meaning: "renowned expert" },
  "告诉": { pinyin: "gao4 su5", meaning: "to tell" },
  "恶心": { pinyin: "e3 xin1", meaning: "nausea" },
  "地方": { pinyin: "di4 fang5", meaning: "aspect; part" },
  "城区": { pinyin: "cheng2 qu1", meaning: "urban area" },
  "多少": { pinyin: "duo1 shao5", meaning: "how much; how many" },
  "大学": { pinyin: "da4 xue2", meaning: "university" },
  "大陆": { pinyin: "da4 lu4", meaning: "continent" },
  "奔驰": { pinyin: "ben1 chi2", meaning: "to gallop" },
  "妻子": { pinyin: "qi1 zi5", meaning: "wife" },
  "将军": { pinyin: "jiang1 jun1", meaning: "general" },
  "山水": { pinyin: "shan1 shui3", meaning: "landscape" },
  "得了": { pinyin: "de2 le5", meaning: "contracted; got" },
  "故事": { pinyin: "gu4 shi5", meaning: "story" },
  "教授": { pinyin: "jiao4 shou4", meaning: "professor" },
  "明朝": { pinyin: "Ming2 chao2", meaning: "Ming dynasty" },
  "春秋": { pinyin: "Chun1 qiu1", meaning: "Spring and Autumn period" },
  "东海": { pinyin: "Dong1 Hai3", meaning: "East China Sea" },
  "东西": { pinyin: "dong1 xi5", meaning: "thing" },
  "机制": { pinyin: "ji1 zhi4", meaning: "mechanism" },
  "淡水": { pinyin: "dan4 shui3", meaning: "freshwater" },
  "温和": { pinyin: "wen1 he2", meaning: "mild" },
  "温泉": { pinyin: "wen1 quan2", meaning: "hot spring" },
  "为人": { pinyin: "wei2 ren2", meaning: "personal character" },
  "狮子": { pinyin: "shi1 zi5", meaning: "lion" },
  "生意": { pinyin: "sheng1 yi5", meaning: "business" },
  "当时": { pinyin: "dang1 shi2", meaning: "at that time" },
  "精神": { pinyin: "jing1 shen2", meaning: "mental; psychological" },
  "累累": { pinyin: "lei3 lei3", meaning: "deeply; heavily" },
  "结果": { pinyin: "jie2 guo3", meaning: "result" },
  "美德": { pinyin: "mei3 de2", meaning: "virtue" },
  "老板": { pinyin: "lao3 ban3", meaning: "boss" },
  "台风": { pinyin: "tai2 feng1", meaning: "typhoon" },
  "苹果": { pinyin: "ping2 guo3", meaning: "apple" },
  "西北": { pinyin: "xi1 bei3", meaning: "northwest" },
  "说法": { pinyin: "shuo1 fa5", meaning: "statement; explanation" },
  "买卖": { pinyin: "mai3 mai5", meaning: "business; trade" },
  "资源": { pinyin: "zi1 yuan2", meaning: "resource" },
  "转动": { pinyin: "zhuan3 dong4", meaning: "to turn" },
  "过去": { pinyin: "guo4 qu4", meaning: "in the past" },
  "雨水": { pinyin: "yu3 shui3", meaning: "rainwater" },
  "青山": { pinyin: "qing1 shan1", meaning: "green hills" },
  "凤凰": { pinyin: "feng4 huang2", meaning: "phoenix" },
  "物质": { pinyin: "wu4 zhi4", meaning: "matter; substance" },
  "三峡": { pinyin: "san1 xia2", meaning: "Three Gorges" },
  "沙特阿拉伯": { traditional: "沙烏地阿拉伯", pinyin: "Sha1 te4 A1 la1 bo2", meaning: "Saudi Arabia" },
  "出访": { pinyin: "chu1 fang3", meaning: "official visit" },
  "云南": { pinyin: "Yun2 nan2", meaning: "Yunnan" },
  "人尽皆知": { pinyin: "ren2 jin4 jie1 zhi1", meaning: "known to everyone" },
  "武汉": { pinyin: "Wu3 han4", meaning: "Wuhan" },
  "咸宁": { pinyin: "Xian2 ning2", meaning: "Xianning" },
  "西安": { pinyin: "Xi1 an1", meaning: "Xi'an" },
  "扬州": { pinyin: "Yang2 zhou1", meaning: "Yangzhou" },
  "新疆": { pinyin: "Xin1 jiang1", meaning: "Xinjiang" },
  "孙中山": { pinyin: "Sun1 Zhong1 shan1", meaning: "Sun Yat-sen" },
  "广东": { pinyin: "Guang3 dong1", meaning: "Guangdong" },
  "襄阳": { pinyin: "Xiang1 yang2", meaning: "Xiangyang" },
  "帐号": { pinyin: "zhang4 hao4", meaning: "account" },
  "芜湖": { pinyin: "Wu2 hu2", meaning: "Wuhu" },
  "青岛": { pinyin: "Qing1 dao3", meaning: "Qingdao" },
  "沧州": { pinyin: "Cang1 zhou1", meaning: "Cangzhou" },
  "沈阳": { pinyin: "Shen3 yang2", meaning: "Shenyang" },
  "辽宁": { pinyin: "Liao2 ning2", meaning: "Liaoning" },
  "翻墙": { pinyin: "fan1 qiang2", meaning: "to bypass internet blocks" },
  "郑州": { pinyin: "Zheng4 zhou1", meaning: "Zhengzhou" },
  "湖南": { pinyin: "Hu2 nan2", meaning: "Hunan" },
  "韶山": { pinyin: "Shao2 shan1", meaning: "Shaoshan" },
  "山西": { pinyin: "Shan1 xi1", meaning: "Shanxi" },
  "陕西": { pinyin: "Shaan3 xi1", meaning: "Shaanxi" },
  "贰心": { pinyin: "er4 xin1", meaning: "disloyalty" },
  "大厦": { pinyin: "da4 sha4", meaning: "large building" },
  "姜太公": { pinyin: "Jiang1 Tai4 gong1", meaning: "Jiang Taigong" },
  "日圆": { pinyin: "ri4 yuan2", meaning: "Japanese yen" },
  "劲儿": { pinyin: "jin4 r5", meaning: "energy" },
  "广州": { pinyin: "Guang3 zhou1", meaning: "Guangzhou" },
  "磨擦": { pinyin: "mo2 ca1", meaning: "to rub; friction" },
  "无锡": { pinyin: "Wu2 xi1", meaning: "Wuxi" },
  "江苏": { pinyin: "Jiang1 su1", meaning: "Jiangsu" },
  "新颖": { pinyin: "xin1 ying3", meaning: "novel; original" },
  "哈尔滨": { pinyin: "Ha1 er3 bin1", meaning: "Harbin" },
  "如日中天": { pinyin: "ru2 ri4 zhong1 tian1", meaning: "at the height of success" },
  "赣州": { pinyin: "Gan4 zhou1", meaning: "Ganzhou" },
}));

// Where the MOE dictionary records several readings, these select the one
// matching the meaning used by the Level I sentence.
const taiwanPinyinOverrides = new Map(Object.entries({
  "不是": "bù shi",
  "地方": "dì fāng",
  "那里": "nà lǐ",
  "看起来": "kàn qǐ lái",
}));

function usableEntry(word, traditionalSentence) {
  const entries = dictionary.get(word) ?? [];
  const ranked = entries
    .map((entry) => ({
      ...entry,
      score: (traditionalSentence.includes(entry.traditional) ? 100 : 0)
        + (entry.definitions.some((value) => !/^(?:variant of|old variant of|see )/iu.test(value)) ? 20 : 0)
        - (entry.definitions.some((value) => /^surname /iu.test(value)) ? 4 : 0)
        - (/^[A-Z]/u.test(entry.pinyin) ? 1 : 0),
    }))
    .sort((left, right) => right.score - left.score);
  const form = ranked[0];
  const lexical = ranked.find((entry) => entry.definitions.some((value) => !/^(?:variant of|old variant of|see )/iu.test(value))) ?? form;
  return form && lexical ? { ...lexical, traditional: form.traditional } : undefined;
}

function dictionarySplit(text) {
  const chars = [...text];
  const best = Array(chars.length + 1).fill(undefined);
  best[chars.length] = { score: 0, words: [] };
  for (let start = chars.length - 1; start >= 0; start--) {
    let candidate = { score: -1, words: [] };
    for (let end = start + 1; end <= Math.min(chars.length, start + 8); end++) {
      const word = chars.slice(start, end).join("");
      const tail = best[end];
      if (!tail) continue;
      const known = dictionary.has(word);
      const length = end - start;
      const score = tail.score + (known ? length * length * 4 : length === 1 ? 0 : -1000);
      if (score > candidate.score) candidate = { score, words: [...(known && length >= 2 ? [word] : []), ...tail.words] };
    }
    best[start] = candidate;
  }
  return best[0]?.words ?? [];
}

function traditionalFormInExample(simplifiedSentence, traditionalSentence, word, dictionaryForm) {
  if (traditionalSentence.includes(dictionaryForm)) return dictionaryForm;
  const simplifiedCharacters = [...simplifiedSentence];
  const traditionalCharacters = [...traditionalSentence];
  const wordCharacters = [...word];
  if (simplifiedCharacters.length !== traditionalCharacters.length) return dictionaryForm;
  for (let start = 0; start <= simplifiedCharacters.length - wordCharacters.length; start += 1) {
    if (simplifiedCharacters.slice(start, start + wordCharacters.length).join("") === word) {
      return traditionalCharacters.slice(start, start + wordCharacters.length).join("");
    }
  }
  return dictionaryForm;
}

function shortGloss(definitions) {
  const cleaned = definitions
    .filter((value) => !/^(?:CL:|classifier for|variant of|old variant of|see |Taiwan pr\.|also pr\.)/iu.test(value))
    .flatMap((value) => value.split(/\s*;\s*/u))
    .map((original) => ({
      original,
      text: original
        .replace(/\([^)]*\)/gu, "")
        .replace(/[\p{Script=Han}]+(?:\|[\p{Script=Han}]+)?\[[^\]]+\]/gu, "")
        .replace(/\s+/gu, " ")
        .trim(),
    }))
    .filter(({ original, text }) => text !== "" && !/^(?:used |abbr\.|lit\.|fig\.)/iu.test(text) && !/original meaning/iu.test(original));
  let chosen = (cleaned.find(({ text }) => text.length <= 36) ?? cleaned[0])?.text ?? "meaning to be reviewed";
  chosen = chosen.replace(/,.*$/u, "").trim();
  const namedKind = /^(.*?\b(?:Mountain Range|Province|River|City|Dynasty|municipality|Agency|University|Lake|Sea|Period))\b/iu.exec(chosen);
  if (chosen.length > 48 && namedKind) chosen = namedKind[1];
  if (chosen.length > 48) chosen = `${chosen.slice(0, 45).replace(/\s+\S*$/u, "")}…`;
  return chosen;
}

function normalizedPinyin(value) {
  return value.normalize("NFC").toLocaleLowerCase("en").replace(/[\s'’·.\-]/gu, "");
}

function taiwanPinyinFor(word, traditional, mainlandPinyin, cedictEntry) {
  const override = taiwanPinyinOverrides.get(word);
  if (override !== undefined) return { pinyin: override, source: "Taiwan MOE Concise Dictionary" };

  const moeReadings = [...new Map((moeReadingsByTitle.get(traditional) ?? []).map((reading) => [normalizedPinyin(reading), reading])).values()];
  if (moeReadings.length === 1) {
    return normalizedPinyin(moeReadings[0]) === normalizedPinyin(mainlandPinyin)
      ? undefined
      : { pinyin: moeReadings[0], source: "Taiwan MOE Concise Dictionary" };
  }
  if (moeReadings.some((reading) => normalizedPinyin(reading) === normalizedPinyin(mainlandPinyin))) return undefined;

  const cedictTaiwanReadings = cedictEntry.definitions
    .flatMap((definition) => [...definition.matchAll(/Taiwan pr\.\s*\[([^\]]+)\]/giu)].map((match) => toneMarkedPinyin(match[1])));
  const cedictTaiwan = cedictTaiwanReadings.find((reading) => normalizedPinyin(reading) !== normalizedPinyin(mainlandPinyin));
  return cedictTaiwan === undefined ? undefined : { pinyin: cedictTaiwan, source: "CC-CEDICT Taiwan pronunciation" };
}

for (const row of mappings.rows) {
  const mappingCode = row[mappings.at.mapping_code];
  const simplifiedSentence = row[mappings.at.simplified_sentence];
  const traditionalSentence = row[mappings.at.traditional_sentence];
  const words = [];
  for (const part of segmenter.segment(simplifiedSentence)) {
    if (!part.isWordLike || !hanOnly.test(part.segment)) continue;
    if ([...part.segment].length >= 2 && dictionary.has(part.segment)) words.push(part.segment);
    else words.push(...dictionarySplit(part.segment));
  }
  for (const word of words) {
    if (inventory.has(word)) continue;
    const entry = usableEntry(word, traditionalSentence);
    if (!entry) continue;
    const override = vocabularyOverrides.get(word);
    const traditional = override?.traditional ?? traditionalFormInExample(simplifiedSentence, traditionalSentence, word, entry.traditional);
    const numberedPinyin = override?.pinyin ?? entry.pinyin;
    const mainlandPinyin = toneMarkedPinyin(numberedPinyin);
    const taiwanPinyin = taiwanPinyinFor(word, traditional, mainlandPinyin, entry);
    const exampleProvenance = provenanceByMapping.get(mappingCode) ?? { sourceType: "preexisting", sourceId: "", sourceSentence: "" };
    inventory.set(word, {
      mappingCode,
      simplified: word,
      traditional,
      mainlandPinyin,
      taiwanPinyin: taiwanPinyin?.pinyin ?? "",
      taiwanPinyinSource: taiwanPinyin?.source ?? "",
      meaning: override?.meaning ?? shortGloss(entry.definitions),
      simplifiedSentence,
      traditionalSentence,
      ...exampleProvenance,
    });
  }
}

function toneMarkedSyllable(raw) {
  const match = /^(.*?)([1-5])$/u.exec(raw);
  if (!match) return raw.toLowerCase().replaceAll("u:", "ü").replaceAll("v", "ü");
  let syllable = match[1].toLowerCase().replaceAll("u:", "ü").replaceAll("v", "ü");
  const tone = Number(match[2]);
  if (tone === 5) return syllable;
  const vowels = { a: "āáǎà", e: "ēéěè", i: "īíǐì", o: "ōóǒò", u: "ūúǔù", ü: "ǖǘǚǜ" };
  let index = syllable.indexOf("a");
  if (index < 0) index = syllable.indexOf("e");
  if (index < 0 && syllable.includes("ou")) index = syllable.indexOf("o");
  if (index < 0) {
    for (let cursor = syllable.length - 1; cursor >= 0; cursor--) {
      if (vowels[syllable[cursor]]) { index = cursor; break; }
    }
  }
  if (index < 0) return syllable;
  return `${syllable.slice(0, index)}${vowels[syllable[index]][tone - 1]}${syllable.slice(index + 1)}`;
}

function toneMarkedPinyin(value) {
  return value
    .replace(/([1-5])(?=[A-Za-züÜv])/gu, "$1 ")
    .split(/\s+/u)
    .map(toneMarkedSyllable)
    .join(" ");
}

const header = ["order", "source_mapping", "simplified", "traditional", "pinyin", "taiwan_pinyin", "meaning", "simplified_sentence", "traditional_sentence", "example_source", "example_source_id", "source_sentence", "pinyin_source", "taiwan_pinyin_source"];
const outputRows = [...inventory.values()].map((entry, index) => [
  String(index + 1), entry.mappingCode, entry.simplified, entry.traditional,
  entry.mainlandPinyin, entry.taiwanPinyin, entry.meaning, entry.simplifiedSentence, entry.traditionalSentence,
  entry.sourceType, entry.sourceId, entry.sourceSentence, "CC-CEDICT", entry.taiwanPinyinSource,
]);
await writeFile(outputPath, [header, ...outputRows].map((row) => row.join("\t")).join("\n") + "\n", "utf8");
console.log(`Wrote ${outputRows.length} distinct Level I vocabulary entries to ${outputPath}`);
