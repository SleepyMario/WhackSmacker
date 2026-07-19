import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";

const curriculumRoot = join(process.cwd(), "..", "dutch-curriculum", "units", "dutch-core");
const blocks = [[1, 5], [6, 10], [11, 15], [16, 20], [21, 25]];


test("Dutch Grammar Easy and Hard summaries exactly mirror each five-chapter grammar inventory", async () => {
  for (const [start, end] of blocks) {
    const slug = `${String(start).padStart(3, "0")}-${String(end).padStart(3, "0")}`;
    const easy = await readFile(join(curriculumRoot, `chapter-${slug}-grammar-easy`, "chapter.md"), "utf8");
    const hard = await readFile(join(curriculumRoot, `chapter-${slug}-grammar-hard`, "chapter.md"), "utf8");
    const chapterInventory = [];
    const primaryReading = [];
    for (let chapter = start; chapter <= end; chapter += 1) {
      const directory = await chapterDirectory(chapter);
      const markdown = await readFile(join(curriculumRoot, directory, "chapter.md"), "utf8");
      chapterInventory.push({
        id: /^grammar_id:\s*"([^"]+)"$/mu.exec(markdown)?.[1],
        pattern: /^grammar_pattern:\s*"([^"]+)"$/mu.exec(markdown)?.[1]
      });
      primaryReading.push(...primaryReadingUnits(markdown));
    }

    const easyPoints = grammarPoints(easy);
    const hardPoints = grammarPoints(hard);
    assert.deepEqual(easyPoints, chapterInventory.map((item) => item.pattern), `Easy ${start}-${end} patterns`);
    assert.deepEqual(hardPoints, easyPoints, `Hard ${start}-${end} patterns`);
    assert.deepEqual(developerGrammarIds(easy), chapterInventory.map((item) => item.id), `Easy ${start}-${end} IDs`);
    assert.deepEqual(developerGrammarIds(hard), chapterInventory.map((item) => item.id), `Hard ${start}-${end} IDs`);
    assert.equal(new Set(easyPoints).size, 5);
    assert.equal(new Set(developerGrammarIds(easy)).size, 5);

    const patternSet = new Set(easyPoints);
    for (const [level, markdown] of [["Easy", easy], ["Hard", hard]]) {
      assert.doesNotMatch(markdown, /^#{1,6}\s+(?:Content|Complete Rereading)\s*$/imu);
      const examples = [...markdown.matchAll(/`([^`\n]+)`/gu)].map((match) => match[1])
        .filter((value) => /[.!?]$/u.test(value))
        .filter((value) => !value.includes("...") && !patternSet.has(value))
        .filter((value) => !/\bN\b|\bsubject\b|\bclause\b|V stem/iu.test(value));
      const nonLiteral = examples.filter((example) => !primaryReading.includes(example));
      assert.deepEqual(nonLiteral, [], `${level} ${start}-${end} quoted examples are literal block reading sentences`);
    }
  }
});

async function chapterDirectory(chapter) {
  const { readdir } = await import("node:fs/promises");
  const entries = await readdir(curriculumRoot, { withFileTypes: true });
  const prefix = `chapter-${String(chapter).padStart(3, "0")}-`;
  const match = entries.find((entry) => entry.isDirectory() && entry.name.startsWith(prefix) && !entry.name.includes("grammar"));
  assert.ok(match, `Chapter ${chapter} directory`);
  return match.name;
}

function grammarPoints(markdown) {
  const section = /^## Grammar Points\n\n([\s\S]*?)(?=\n(?:<!--|## ))/mu.exec(markdown);
  assert.ok(section);
  return [...section[1].matchAll(/^- `([^`]+)`$/gmu)].map((match) => match[1]);
}

function developerGrammarIds(markdown) {
  return [...markdown.matchAll(/^- (DUT-GRAMMAR-\d{3}) --/gmu)].map((match) => match[1]);
}

function primaryReadingUnits(markdown) {
  const chapter = Number.parseInt(/^chapter:\s*(\d+)$/mu.exec(markdown)?.[1] ?? "0", 10);
  const section = /^### (Dialogue|Narrative)\n\n([\s\S]*?)(?=^### New Vocabulary$)/mu.exec(markdown);
  assert.ok(section);
  const blocks = section[2].trim().split(/\n\s*\n/u).filter(Boolean).slice(1);
  if (section[1] === "Dialogue") {
    return blocks.join("\n").split(/\r?\n/u).filter(Boolean).flatMap((line) => {
      const utterance = /^.*?\s*:\s*(.+)$/u.exec(line)?.[1].trim();
      return utterance === undefined ? [] : [utterance, ...splitSentences(utterance)];
    });
  }
  if (chapter <= 20) return blocks.join("\n").split(/\r?\n/u).map((line) => line.trim()).filter(Boolean);
  return blocks.flatMap(splitSentences);
}

function splitSentences(text) {
  return [...new Intl.Segmenter("nl", { granularity: "sentence" }).segment(text)]
    .map(({ segment }) => segment.trim())
    .filter(Boolean);
}
