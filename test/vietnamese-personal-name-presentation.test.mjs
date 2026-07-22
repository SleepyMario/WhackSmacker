import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";

const appRoot = process.cwd();
const curriculumRoot = join(appRoot, "..", "vietnamese-curriculum");
const coreRoot = join(curriculumRoot, "units", "vietnamese-core");
const inventory = JSON.parse(await readFile(join(curriculumRoot, "name-pools", "personal-name-presentation.json"), "utf8"));
const characters = inventory.characters;

async function chapters() {
  const entries = await readdir(coreRoot, { withFileTypes: true });
  return new Map(await Promise.all(entries
    .filter((entry) => entry.isDirectory() && /^chapter-\d{3}-(?!\d{3}-grammar)/u.test(entry.name))
    .map(async (entry) => [Number(entry.name.slice(8, 11)), await readFile(join(coreRoot, entry.name, "chapter.md"), "utf8")])));
}

test("Vietnamese introductions retain full names and established prose uses structured short forms", async () => {
  const sources = await chapters();
  for (const person of characters) {
    for (const chapter of person.chapters) {
      const markdown = sources.get(chapter);
      assert.ok(markdown, `missing Chapter ${chapter}`);
      const section = /^### (?:Learner-facing )?(?:Dialogue|Narrative)\s*$([\s\S]*?)(?=^### )/mu.exec(markdown)?.[1] ?? "";
      const paragraphs = section.trim().split(/\n\s*\n/u);
      const introduction = paragraphs.shift() ?? "";
      let primary = paragraphs.join("\n\n");
      assert.match(introduction, new RegExp(person.fullName.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"), "u"));
      for (const exception of person.justifiedFullNameOccurrences.filter((row) => row.chapter === chapter)) {
        assert.ok(primary.includes(exception.sentence), `${person.personId} missing exception in Chapter ${chapter}`);
        primary = primary.replaceAll(exception.sentence, "");
      }
      assert.equal(primary.includes(person.fullName), false, `${person.fullName} repeated in Chapter ${chapter}`);
      if (chapter !== 2) assert.ok(section.includes(person.shortForm), `${person.shortForm} absent in Chapter ${chapter}`);
    }
  }
  assert.ok(sources.get(1).includes("Tôi là Nguyễn Minh Anh."));
  assert.ok(sources.get(2).includes("Tên tôi là Nguyễn Gia Bảo."));
  assert.ok(sources.get(10).includes("Minh Anh sống ở Hà Nội."));
  assert.ok(sources.get(50).includes("Cuối cùng, Ngọc Linh mở bảng tổng kết."));
  assert.equal(sources.get(50).includes("Cuối cùng, Phạm Ngọc Linh mở bảng tổng kết."), false);
});

test("Vietnamese translations, Normal, Expert, and Review evidence use corrected source names", async () => {
  const sources = await chapters();
  for (let chapter = 11; chapter <= 50; chapter += 1) {
    const directory = (await readdir(coreRoot)).find((entry) => entry.startsWith(`chapter-${String(chapter).padStart(3, "0")}-`) && !entry.includes("grammar"));
    const translation = JSON.parse(await readFile(join(coreRoot, directory, "reading-translation.en.json"), "utf8"));
    const serialized = JSON.stringify(translation);
    for (const person of characters) assert.equal(serialized.includes(person.fullName), false, `Chapter ${chapter} translation retained ${person.fullName}`);
  }
  for (let chapter = 1; chapter <= 50; chapter += 1) {
    const supportPath = join(appRoot, "curriculum-support", "vietnamese", `chapter-${String(chapter).padStart(3, "0")}`, "reading-support.json");
    const support = await readFile(supportPath, "utf8");
    const source = sources.get(chapter);
    for (const match of support.matchAll(/`([^`]*(?:Minh Anh|Quốc Huy|Thu Hà|Gia Bảo|Mai Chi|Thị Lan|Hoàng Nam|Ngọc Linh|Bình An|Thảo Vy|Maria)[^`]*[.?!])`/gu)) {
      assert.ok(source.includes(match[1]), `Chapter ${chapter} support quote is stale: ${match[1]}`);
    }
  }
});

test("Vietnamese display-name changes preserve Review IDs, counts, and lexical/grammar identities", async () => {
  const reviewRoot = join(appRoot, "review-content", "vietnamese", "review-decks");
  const dirs = (await readdir(reviewRoot)).filter((entry) => /^chapter-\d{3}-\d{3}$/u.test(entry)).sort();
  const ids = [];
  for (const directory of dirs) {
    const rows = (await readFile(join(reviewRoot, directory, "cards.tsv"), "utf8")).trimEnd().split(/\r?\n/u).slice(1);
    ids.push(...rows.map((row) => row.split("\t")[0]));
    const range = directory.slice(8).split("-").map(Number).join("-");
    assert.equal(rows.length, inventory.identityBaseline.reviewCardCounts[range]);
    assert.equal(rows.length / 2, inventory.identityBaseline.reviewSenseCounts[range]);
  }
  const cardDigest = createHash("sha256").update(`${[...new Set(ids)].sort().join("\n")}\n`).digest("hex");
  assert.equal(cardDigest, inventory.identityBaseline.reviewCardIdsSha256);
  const allSource = [...(await chapters()).values()].join("\n") + (await Promise.all((await readdir(coreRoot)).filter((entry) => entry.includes("grammar")).map((entry) => readFile(join(coreRoot, entry, "chapter.md"), "utf8")))).join("\n");
  const lexicalIds = [...new Set(allSource.match(/vi\.[a-z][a-z0-9.-]+/gu) ?? [])].sort();
  const lexicalDigest = createHash("sha256").update(`${lexicalIds.join("\n")}\n`).digest("hex");
  assert.equal(lexicalDigest, inventory.identityBaseline.lexicalIdsSha256);
  const grammarIds = [...new Set(allSource.match(/VIE-GRAMMAR-[0-9]+[A-Z]?/gu) ?? [])].sort();
  const grammarDigest = createHash("sha256").update(`${grammarIds.join("\n")}\n`).digest("hex");
  assert.equal(grammarDigest, inventory.identityBaseline.grammarIdsSha256);
});
