import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();
const sourcesRoot = join(root, "review-content", "chinese-simplified-traditional", "level-3", "sources");
const mappingsPath = join(sourcesRoot, "mappings.tsv");
const outputPath = join(sourcesRoot, "example-provenance.tsv");

const lines = (await readFile(mappingsPath, "utf8")).trimEnd().split("\n");
const header = lines.shift().split("\t");
const at = Object.fromEntries(header.map((name, index) => [name, index]));
const rows = lines.map((line) => line.replace(/\r$/u, "").split("\t"));

function genericSentence(word, traditional = false, classificationWord = word) {
  const one = traditional ? "一個" : "一个";
  const aKind = traditional ? "一種" : "一种";
  const rare = traditional ? "較少見的詞語" : "较少见的词语";
  const person = traditional ? "人名" : "人名";
  const place = traditional ? "地名" : "地名";
  const animal = traditional ? "動物" : "动物";
  const bird = traditional ? "鳥" : "鸟";
  const fish = traditional ? "魚類或水生動物" : "鱼类或水生动物";
  const plant = traditional ? "植物" : "植物";
  const medicine = traditional ? "醫學詞語" : "医学词语";
  const material = traditional ? "材料或化學物質" : "材料或化学物质";
  const object = traditional ? "器物" : "器物";
  const expression = traditional ? "成語或固定說法" : "成语或固定说法";

  if (/^(闫怀礼|奕䜣|范晔|阮大铖|智𫖮|皇甫镈|朱镕基|麹义|武士彟)$/u.test(classificationWord)) {
    return `${word}是${one}${person}。`;
  }
  if (/(区|區|河|溪|水|口|坜|壢|涌|谷|州|县|縣)$/u.test(classificationWord)) {
    return `${word}是${one}${place}。`;
  }
  if (/(鹎|鵯|鹟|鶲|鹀|鵐|鹨|鷚|鹱|鸌|鹯|鸇|鹡鸰|鶺鴒|鸺鹠|鵂鶹|鹔鹴|鷫鸘|鸧鹒|鶬鶊|䴙䴘|鸊鷉|鹍|鵾|鹢|鷁|鹲|鸏|鹙鹭|鶖鷺|鹃|鵑|䴕|鴷)$/u.test(classificationWord)) {
    return `${word}是${aKind}${bird}。`;
  }
  if (/(鱼|魚|鲃|䰾|鲂|魴|鲗|鰂|鲙|鱠|鲭|鯖|鲯鳅|鯕鰍|鳑鲏|鰟鮍|鳂|鰃|鳣|鱣|鮟鱇|白鱀豚)$/u.test(classificationWord)) {
    return `${word}是${aKind}${fish}。`;
  }
  if (/(草|木|薯蓣|薯蕷|白蔹|白蘞|豨莶|豨薟|芎䓖|芎藭|筼筜|篔簹)$/u.test(classificationWord)) {
    return `${word}是${aKind}${plant}。`;
  }
  if (/(颞颥|顳顬|腘窝|膕窩|耵聍|耵聹)$/u.test(classificationWord)) {
    return `${word}是${one}${medicine}。`;
  }
  if (/(哒嗪|噠嗪|二𫫇英|二噁英|酦酵|醱酵|锖色|錆色)$/u.test(classificationWord)) {
    return `${word}是${aKind}${material}。`;
  }
  if (/(辒辌|轀輬|辀|輈|钌铞儿|釕銱兒|铴锣|鐋鑼|钜子|鉅子|榇|櫬|弦|舍)$/u.test(classificationWord)) {
    return `${word}是${aKind}${object}。`;
  }
  if (/(之交|以下|除奸|同轨|同軌|举赢|舉贏|诐行|詖行|侥幸|僥倖|南琛|无遗|無遺|水栗|歷落|千金|举火|舉火|一针一|一針一|赪尾|赬尾|馌耕|饁耕|瘅恶|癉惡|谫识|謭識|条约|條約|酾雨|釃雨|埋香|花娇|花嬌|索黡|索黶|狼顾|狼顧|然而笑)$/u.test(classificationWord)) {
    return `${word}是${one}${expression}。`;
  }
  if (/(人名|地名)/u.test(classificationWord)) return `${word}是${one}${traditional ? "種類" : "种类"}。`;
  return `${word}是${one}${rare}。`;
}

const output = [[
  "mapping_code", "source_type", "source_id", "simplified_word", "traditional_word",
  "simplified_sentence", "traditional_sentence", "source_sentence"
]];

for (const row of rows) {
  const simplifiedSentence = row[at.simplified_sentence];
  const traditionalSentence = row[at.traditional_sentence];
  const projectAuthored = row[at.original_example_source] === "project-authored";
  if (!projectAuthored && !simplifiedSentence.includes("例句中使用了") && !traditionalSentence.includes("例句中使用了")) continue;
  const code = row[at.mapping_code];
  const simplifiedWord = row[at.simplified_example];
  const traditionalWord = row[at.traditional_example];
  const authoredSimplified = genericSentence(simplifiedWord, false);
  const authoredTraditional = genericSentence(traditionalWord, true, simplifiedWord);
  output.push([
    code, "authored", `level-3/${code}`, simplifiedWord, traditionalWord,
    authoredSimplified, authoredTraditional, authoredSimplified
  ]);
}

if (output.length !== 147) throw new Error(`Expected 146 placeholder replacements, found ${output.length - 1}`);
await writeFile(outputPath, `${output.map((row) => row.join("\t")).join("\n")}\n`, "utf8");
console.log(`Prepared ${output.length - 1} short Level III example pairs in ${outputPath}`);
