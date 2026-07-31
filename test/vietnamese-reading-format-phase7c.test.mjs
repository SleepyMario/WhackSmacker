import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";

const curriculumRoot = join(process.cwd(), "..", "vietnamese-curriculum");
const unitsRoot = join(curriculumRoot, "units", "vietnamese-core");
const supportRoot = join(process.cwd(), "curriculum-support", "vietnamese");
const digest = (value) => createHash("sha256").update(value).digest("hex");

const expected = new Map([
  [1, ["dialogue", 9, "a9cffbd95ef24109ec211b48f8e2c7d5bff4bbdce04f217b98f6702b2da6bd2f", "722038ae05fee6bb65a9320f70642a50571c99f25108eb0344594f98cd1b2b01"]],
  [2, ["narrative", 13, "5029c5851747c8fdb8f450658aa705ad1146e63e20811c4f0b8a828b03c16e6e", "fcd491d6818ecd6b7e52a40b14f8ee99807acf0ce269ff18b0277197b644e29c"]],
  [3, ["dialogue", 8, "e85f4fc43cf11f234c576c8c7a35c675fdae3699d53a02b15a759cb7560d7d7b", "667032ccf4008d791cdd2f32476d8fd3cb314d6658f5cf0a62b9849f5bfa8be8"]],
  [4, ["narrative", 8, "c235896ce4d0f79bb82b1806277f46016e6caf9031f584ab388266821e4ba6b1", "f14157a83362c2a5b96e4a4054e9605624a15a52650e124424f097599c94ab9e"]],
  [5, ["dialogue", 11, "5d9e79b0e78933adce156c842ab4a0fbbd9326555d10cde534968850a5b1cd90", "d2a615dd5553f24b64ac18ecc80b60b784c011b546b79ed919cff3ba540adc35"]],
  [6, ["narrative", 9, "e1a3e9bf155f496c918130221112b6381a52939f422299274f4a2e5ec7f9518b", "c82feb039f07805ab38592c515b31fd1f0d2cce9164caf87de50415a29a91cd3"]],
  [7, ["dialogue", 12, "bc86b99bdd9de891a141589807b12c2de56229da2dde80fcde8eb7fb66a6b4a0", "a08fb02f58f4d79184c29fe9df028575a6adb8624981bdc28fbd5e98b19ac4ed"]],
  [8, ["narrative", 13, "1e34aaee9a518af291f67260da419e954108e2d44d6e08c5edcf9b72a45cc8ef", "faf49745448c5e5e435ca5d9fac0b2a57ae21c6556c2d923d8bc6af97b25ac3a"]],
  [9, ["dialogue", 8, "7ec264dabf576ee72af91909a4b027f901d36b93e458910f47eb53466aea62b4", "bf9987a435382833035aa470934264689c6b1c273b9c6dcb557e2cba0e4d15f6"]],
  [10, ["narrative", 9, "9062b7aec19d29213da6d4eb5c254e7927c5ffdb430a70a3e1041b7fc925e167", "1f6d607ce2c2818e07fccce3241a9f1809083a964f82af83a1c6596d6f76b27a"]]
]);

async function chapters() {
  const directories = (await readdir(unitsRoot, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory() && /^chapter-0(?:0[1-9]|10)-basic-sentences-/u.test(entry.name))
    .map((entry) => entry.name)
    .sort();
  return Promise.all(directories.map(async (directory) => ({
    chapter: Number(/^chapter-(\d{3})/u.exec(directory)?.[1]),
    directory,
    markdown: await readFile(join(unitsRoot, directory, "chapter.md"), "utf8")
  })));
}

function section(markdown, title) {
  const lines = markdown.replace(/\r\n?/gu, "\n").split("\n");
  const start = lines.findIndex((line) => new RegExp(`^#{1,6} ${title}$`, "u").test(line));
  assert.notEqual(start, -1, `missing ${title}`);
  const level = /^(#{1,6})/u.exec(lines[start])?.[1].length ?? 1;
  const end = lines.findIndex((line, index) => index > start && (/^(#{1,6})\s/u.exec(line)?.[1].length ?? 7) <= level);
  return lines.slice(start + 1, end < 0 ? lines.length : end).join("\n").trim();
}

function fenced(body) {
  const value = /^```text\s*\n([\s\S]*?)\n```/mu.exec(body)?.[1];
  assert.notEqual(value, undefined);
  return value;
}

function cleanHeadingSpacing(markdown) {
  const lines = markdown.replace(/\r\n?/gu, "\n").split("\n");
  for (const [index, line] of lines.entries()) {
    if (!/^#{1,6}\s+\S/u.test(line)) continue;
    assert.equal(lines[index - 1], "", `${line}: one empty line above`);
    assert.equal(lines[index + 1], "", `${line}: one empty line below`);
    assert.notEqual(lines[index - 2], "", `${line}: no doubled empty line above`);
    assert.notEqual(lines[index + 2], "", `${line}: no doubled empty line below`);
  }
}

test("Vietnamese Chapters 1-10 have one exact canonical primary reading and aligned translation", async () => {
  const sources = await chapters();
  assert.equal(sources.length, 10);
  const segmenter = new Intl.Segmenter("vi", { granularity: "sentence" });
  for (const { chapter, markdown } of sources) {
    const [kind, lineCount, primaryDigest, translationDigest] = expected.get(chapter);
    const heading = kind === "dialogue" ? "Dialogue" : "Narrative";
    assert.equal((markdown.match(new RegExp(`^### ${heading}$`, "gmu")) ?? []).length, 1);
    assert.doesNotMatch(markdown, /^#{1,6}\s+(?:Content|Learner-facing Dialogue|Learner-facing Narrative|Complete Rereading)\s*$/imu);
    const primary = fenced(section(markdown, heading));
    const translation = fenced(section(markdown, "Natural English Translation"));
    assert.equal(digest(primary), primaryDigest, `Chapter ${chapter} primary reading is exact`);
    assert.equal(digest(translation), translationDigest, `Chapter ${chapter} translation is exact`);
    assert.equal(primary.split("\n").length, lineCount);
    assert.equal(translation.split("\n").length, lineCount);
    assert.deepEqual(primary.split("\n").map((line) => line === ""), translation.split("\n").map((line) => line === ""));
    if (kind === "dialogue") {
      for (const line of primary.split("\n")) assert.match(line, /^\S(?:.*\S)?\s*:\s+\S/u, `Chapter ${chapter} preserves one speaker turn per line`);
    } else {
      for (const line of primary.split("\n").filter(Boolean)) {
        assert.equal([...segmenter.segment(line)].filter(({ segment }) => segment.trim()).length, 1, `Chapter ${chapter} keeps one sentence per physical line`);
      }
    }
    cleanHeadingSpacing(markdown);
  }
});

test("Vietnamese contextual rewrite preserves protected identities and records the required lexical migration", async () => {
  const sources = await chapters();
  const vocabularyMetadata = sources.map(({ markdown }) => /^vocabulary_metadata:\s*$([\s\S]*?)(?=^new_writing_system_material:)/mu.exec(markdown)?.[0].trim());
  const grammarMetadata = sources.map(({ markdown }) => /^new_grammar_structure:\s*$([\s\S]*?)(?=^grammar_easy_reference:)/mu.exec(markdown)?.[0].trim());
  const participants = await Promise.all(sources.map(({ directory }) => readFile(join(unitsRoot, directory, "chapter-participants.json"), "utf8").then(JSON.parse)));
  assert.equal(vocabularyMetadata.reduce((count, value) => count + ((value.match(/^\s+- \{entryId:/gmu) ?? []).length), 0), 60);
  assert.equal(digest(JSON.stringify(vocabularyMetadata)), "d74387f290b5c8174c79824cf38ed799ae52c3bf47e08367da5380ec6079d5fb");
  assert.equal(digest(JSON.stringify(grammarMetadata)), "7db7541c7a27250187eb7eedf7d750bdd74b22aa7aa9f7370d336826f7353deb");
  assert.deepEqual(grammarMetadata.map((value) => /grammarId:\s*(VIE-GRAMMAR-\d+)/u.exec(value)?.[1]), Array.from({ length: 10 }, (_, index) => `VIE-GRAMMAR-${String(index + 1).padStart(3, "0")}`));
  assert.equal(digest(JSON.stringify(participants)), "def438a9a15ea67de80747384dd372442ca8c559441b663cd95b8d2ae2cd2d45");

  const protectedHashes = new Map([
    ["vocabulary-forms.json", "b30577a838b5e76606ffc2546e668d16c00e687bc799fabfb40fe1314801451e"],
    ["geography-ledger.json", "9013de2b37448c8a9e87a6443a2d190062c6c44c5b95e6378b0d858b9d8e7717"],
    ["name-pools/canonical-cast.json", "03d692fc41ee30d156303ae30cdb81736d297917d50069d791accc63e34a5ab7"],
    ["name-pools/personal-name-presentation.json", "fe08763882d53527ae72571ac0a359c053a85da9d419b2c13f2692e3d5e015b3"],
    ["units/vietnamese-core/cumulative-ledger.md", "4ffa1ce89da22f344d87bb1fa9b002fe1c2710ff408125b25d33a5e4f391069c"],
    ["units/vietnamese-core/chapter-001-005-grammar-easy/chapter.md", "51eb95d90435ea547046c3f7f893b34b029294efa78ef53771dfe5e650393b10"],
    ["units/vietnamese-core/chapter-001-005-grammar-hard/chapter.md", "cb6be8fc50c6886d95db4617b6f6eb65497b582a267709db6a18fa31a83acc2a"],
    ["units/vietnamese-core/chapter-006-010-grammar-easy/chapter.md", "30d780cbe04d1429753a7eb6af8f6ba6b78943e659362dc8333c2076d5581561"],
    ["units/vietnamese-core/chapter-006-010-grammar-hard/chapter.md", "709b160ed0a5d7e72cb5928b9418f9efd1fe10643cd3fb979f6db1dd3797b91e"]
  ]);
  for (const [path, expectedDigest] of protectedHashes) assert.equal(digest(await readFile(join(curriculumRoot, path))), expectedDigest, path);
});

test("support and Review provenance resolve against canonical retained readings without identity changes", async () => {
  const sources = new Map((await chapters()).map((item) => [item.chapter, item]));
  const supports = [];
  let characterEntries = 0;
  for (let chapter = 1; chapter <= 10; chapter += 1) {
    const support = JSON.parse(await readFile(join(supportRoot, `chapter-${String(chapter).padStart(3, "0")}`, "reading-support.json"), "utf8"));
    const semantic = structuredClone(support);
    for (const entry of semantic.characters?.entries ?? []) {
      assert.equal(entry.provenance.section, chapter % 2 === 1 ? "Dialogue" : "Narrative");
      assert.match(sources.get(chapter).markdown, new RegExp(entry.usage.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "u"));
      delete entry.provenance.section;
      characterEntries += 1;
    }
    supports.push(semantic);
  }
  assert.equal(characterEntries, 17);
  assert.equal(digest(JSON.stringify(supports)), "56ba461b3776542a043167c5903b38b0a45c93c5ee359329d897268f6b874cf9");

  const paths = ["chapter-001-005", "chapter-006-010"].map((block) => join(process.cwd(), "review-content", "vietnamese", "review-decks", block, "cards.tsv"));
  const rows = [];
  for (const path of paths) {
    const [header, ...lines] = (await readFile(path, "utf8")).trimEnd().split("\n");
    const fields = header.split("\t");
    rows.push(...lines.map((line) => Object.fromEntries(fields.map((field, index) => [field, line.split("\t")[index] ?? ""]))));
  }
  assert.equal(rows.length, 132);
  assert.equal(digest(JSON.stringify(rows.map((row) => row.card_id))), "5ba38ee048898d1fa05957a8267155147f33d0b39803f0ed7a202c3e17cf8181");
  assert.equal(digest(JSON.stringify(rows.map(({ provenance_locator, ...row }) => row))), "6880d612e856c376a3dc8aae7b5b7c8eeab9d5cd79b4b471c144c84f2916dd36");
  for (const row of rows) {
    const match = /^(Dialogue|Narrative) > line (\d+)$/u.exec(row.provenance_locator);
    assert.ok(match, `${row.card_id} uses a canonical locator`);
    const chapter = Number(row.source_chapter);
    const primary = fenced(section(sources.get(chapter).markdown, match[1]));
    const line = primary.split("\n").filter(Boolean)[Number(match[2]) - 1];
    const evidence = match[1] === "Dialogue" ? /^.*?\s*:\s*(.+)$/u.exec(line)?.[1] : line;
    assert.equal(evidence, row.provenance_evidence, `${row.card_id} provenance resolves`);
  }
});
