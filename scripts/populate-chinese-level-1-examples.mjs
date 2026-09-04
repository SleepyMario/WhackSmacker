import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();
const sourcesRoot = join(root, "review-content", "chinese-simplified-traditional", "level-1", "sources");
const mappingsPath = join(sourcesRoot, "mappings.tsv");
const examplesPath = join(sourcesRoot, "example-provenance.tsv");

const parseTsv = async (path) => {
  const lines = (await readFile(path, "utf8")).trimEnd().split("\n");
  const header = lines.shift().split("\t");
  const rows = lines.map((line) => line.replace(/\r$/u, "").split("\t"));
  return { header, rows, at: Object.fromEntries(header.map((name, index) => [name, index])) };
};

const mappings = await parseTsv(mappingsPath);
const examples = await parseTsv(examplesPath);
const requiredExampleHeader = [
  "mapping_code", "source_type", "source_id", "simplified_word", "traditional_word",
  "simplified_sentence", "traditional_sentence", "source_sentence"
];
if (JSON.stringify(examples.header) !== JSON.stringify(requiredExampleHeader)) {
  throw new Error(`Unexpected example provenance header in ${examplesPath}`);
}

const exampleByCode = new Map();
for (const row of examples.rows) {
  if (row.length !== examples.header.length) throw new Error(`Malformed example provenance row: ${row.join(" | ")}`);
  const code = row[examples.at.mapping_code];
  if (exampleByCode.has(code)) throw new Error(`Duplicate example provenance for ${code}`);
  if (!row[examples.at.simplified_sentence].includes(row[examples.at.simplified_word])) {
    throw new Error(`Simplified sentence does not contain its context word at ${code}`);
  }
  if (!row[examples.at.traditional_sentence].includes(row[examples.at.traditional_word])) {
    throw new Error(`Traditional sentence does not contain its context word at ${code}`);
  }
  exampleByCode.set(code, row);
}

let replaced = 0;
for (const row of mappings.rows) {
  const code = row[mappings.at.mapping_code];
  const example = exampleByCode.get(code);
  if (!example) continue;
  if (row[mappings.at.simplified_example] !== example[examples.at.simplified_word] ||
      row[mappings.at.traditional_example] !== example[examples.at.traditional_word]) {
    throw new Error(`Context-word mismatch at ${code}`);
  }
  row[mappings.at.example_source] = example[examples.at.source_type] === "tatoeba" ? "corpus-example" : "authored-example";
  row[mappings.at.original_example_source] = example[examples.at.source_type] === "tatoeba"
    ? `tatoeba:${example[examples.at.source_id]}`
    : "project-authored";
  row[mappings.at.simplified_sentence] = example[examples.at.simplified_sentence];
  row[mappings.at.traditional_sentence] = example[examples.at.traditional_sentence];
  replaced++;
}
if (replaced !== examples.rows.length) throw new Error(`Expected ${examples.rows.length} replacements, made ${replaced}`);
const unresolved = mappings.rows.filter((row) =>
  row[mappings.at.simplified_sentence].includes("例句中使用了") || row[mappings.at.traditional_sentence].includes("例句中使用了")
);
if (unresolved.length > 0) throw new Error(`Placeholder examples remain: ${unresolved.map((row) => row[mappings.at.mapping_code]).join(", ")}`);

await writeFile(mappingsPath, [mappings.header, ...mappings.rows].map((row) => row.join("\t")).join("\n") + "\n", "utf8");
console.log(`Replaced ${replaced} placeholder pairs; no placeholder examples remain.`);
