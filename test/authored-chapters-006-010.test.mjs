import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { buildLanguageTree, renderLanguageTreeRightPane } from "../dist/apps/cli/interactive-menu.js";
import { generateContentPackage, generateLocalContentPackageCatalogue, installContentPackage } from "../dist/packages/core/index.js";

const workspace = join(process.cwd(), "..");
const configs = [
  { slug: "french", label: "French", code: "fr", prefix: "FRA", senses: 44, cards: 88, lines: 38, directions: ["en-to-fr", "fr-to-en"] },
  { slug: "german", label: "German", code: "de", prefix: "GER", senses: 48, cards: 96, lines: 40, directions: ["de-to-en", "en-to-de"] },
  { slug: "japanese", label: "Japanese", code: "ja", prefix: "JPN", senses: 43, cards: 129, lines: 40, directions: ["en-to-ja", "ja-Kana-to-ja", "ja-to-en"] },
  { slug: "korean", label: "Korean", code: "ko", prefix: "KOR", senses: 45, cards: 90, lines: 40, directions: ["en-to-ko", "ko-to-en"] }
];

const technicalIntroduction = /\b(?:grammarId|lexicalId|schemaVersion|sourcePath|chapterMode|sentenceCount|reviewCards)\b|\bcanonical Chapter \d+ pattern\b|\bliteral source evidence\b|\bcanonical citation forms\b|\bcom\.sleepymario\.[\w.-]+\b|(?:^|\s)(?:\/[\w.-]+){2,}|[{}]\s*["'][A-Za-z]/iu;

for (const config of configs) {
  test(`${config.slug} Chapters 6–10 reconstruct lexical, grammar, support, and Review evidence`, async () => {
    const repository = join(workspace, `${config.slug}-curriculum`);
    const unitRoot = join(repository, "units", `${config.slug}-core`);
    const directories = (await readdir(unitRoot, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory() && /^chapter-0(?:0[6-9]|10)-/u.test(entry.name) && !entry.name.includes("grammar"))
      .map((entry) => entry.name)
      .sort();
    assert.equal(directories.length, 5);

    const reconstructed = [];
    const grammarIds = [];
    let learnerFacingLines = 0;
    for (const [offset, directory] of directories.entries()) {
      const chapter = offset + 6;
      const markdown = await readFile(join(unitRoot, directory, "chapter.md"), "utf8");
      const reading = primaryReading(markdown);
      const rawReadingLines = primaryReadingLines(markdown, false);
      const rawReading = rawReadingLines.join("\n");
      const introduction = sectionBody(markdown, "Brief Introduction", 2);
      const translation = JSON.parse(await readFile(join(unitRoot, directory, "reading-translation.en.json"), "utf8"));
      const translated = translation.readingType === "dialogue" ? translation.turns : translation.sentences;
      const ledger = parseMarkdownTable(await readFile(join(unitRoot, directory, "ledger.md"), "utf8"), "| Entry ID | Sense ID | Form | Meaning | POS | Reading line |");
      const grammarId = `${config.prefix}-GRAMMAR-${String(chapter).padStart(3, "0")}`;
      assert.match(markdown, new RegExp(`^chapter: ${chapter}$`, "mu"));
      assert.match(markdown, new RegExp(`grammar_id: "${grammarId}"`, "u"));
      assert.equal(reading.length, translated.length);
      assert.equal(reading.length >= 6, true);
      assert.equal(JSON.stringify(translation), JSON.stringify(translation).normalize("NFC"));
      assert.doesNotMatch(markdown, /TODO|FIXME|placeholder|dummy/iu);
      assert.ok(introduction.length > 0 && introduction.length <= 300);
      assert.doesNotMatch(introduction, technicalIntroduction);
      assert.doesNotMatch(introduction, /\b(?:this chapter teaches|this chapter shows|use .+ to|canonical|schema|source evidence)\b/iu);
      assert.equal(rawReading.includes(introduction), false);
      assert.equal(JSON.stringify(translation).includes(introduction), false);
      assert.ok(markdown.indexOf(`### ${chapter % 2 === 1 ? "Dialogue" : "Narrative"}`) < markdown.indexOf("### New Vocabulary"));
      assert.ok(markdown.indexOf("### New Vocabulary") < markdown.indexOf("### Grammar"));
      learnerFacingLines += reading.length;
      grammarIds.push(grammarId);
      for (const row of ledger) {
        const line = Number(row[5]);
        assert.equal(line >= 1 && line <= reading.length, true, `${row[1]} locator`);
        const evidence = learnerEvidenceForRow(row, rawReadingLines[line - 1], reading[line - 1]);
        reconstructed.push({ chapter, directory, lexicalId: row[0], senseId: row[1], canonical: row[2], evidence, line });
      }
      const support = JSON.parse(await readFile(join(process.cwd(), "curriculum-support", config.slug, `chapter-${String(chapter).padStart(3, "0")}`, "reading-support.json"), "utf8"));
      const supportIntroduction = support.audienceSections.find((section) => section.sourceHeading === "Brief Introduction");
      assert.ok(supportIntroduction);
      assert.equal(supportIntroduction.normal, introduction);
      assert.equal(supportIntroduction.expert, introduction);
      assert.doesNotMatch(supportIntroduction.normal, technicalIntroduction);
      assert.doesNotMatch(supportIntroduction.expert, technicalIntroduction);
      for (const audience of ["normal", "expert"]) {
        const breakdownRows = support.breakdown[audience].split("\n").filter((line) => line.startsWith("- "));
        assert.equal(breakdownRows.length, reading.length, `${config.slug} ${chapter} ${audience} breakdown count`);
        assert.equal(support.breakdown[audience].includes(introduction), false);
        for (const line of reading) assert.equal(support.breakdown[audience].includes(line), true, `${config.slug} ${chapter} ${audience} breakdown omits a line`);
      }
    }
    assert.equal(learnerFacingLines, config.lines);
    assert.equal(reconstructed.length, config.senses);
    assert.equal(new Set(reconstructed.map((sense) => sense.senseId)).size, config.senses);

    const cumulative = parseMarkdownTable(await readFile(join(unitRoot, "cumulative-ledger.md"), "utf8"), "| Entry ID | Sense ID | Learner-facing form | Meaning | POS | First | Review | Provenance | Line |")
      .filter((row) => Number(row[5]) >= 6 && Number(row[5]) <= 10);
    assert.deepEqual(new Set(cumulative.map((row) => row[1])), new Set(reconstructed.map((sense) => sense.senseId)));

    const vocabulary = JSON.parse(await readFile(join(repository, "vocabulary-forms.json"), "utf8"));
    const rows = vocabulary.displayRows.filter((row) => row.chapter >= 6 && row.chapter <= 10);
    const occurrences = new Map(vocabulary.occurrences.map((occurrence) => [occurrence.id, occurrence]));
    assert.equal(rows.length, config.senses);
    assert.deepEqual(new Set(rows.map((row) => row.canonicalSenseId)), new Set(reconstructed.map((sense) => sense.senseId)));
    for (const row of rows) {
      const occurrence = occurrences.get(row.occurrenceId);
      const source = reconstructed.find((sense) => sense.senseId === row.canonicalSenseId);
      assert.ok(occurrence && source);
      assert.equal(occurrence.sentenceOrExample, source.evidence);
      assert.equal(source.evidence.normalize("NFC").includes(row.surfaceForm.normalize("NFC")), true, `${row.id} surface evidence`);
    }

    const cards = parseDeck(await readFile(join(process.cwd(), "review-content", config.slug, "review-decks", "chapter-006-010", "cards.tsv"), "utf8"));
    assert.equal(cards.length, config.cards);
    assert.equal(new Set(cards.map((card) => card.id)).size, config.cards);
    assert.deepEqual(new Set(cards.map((card) => card.senseId)), new Set(reconstructed.map((sense) => sense.senseId)));
    const directionsBySense = new Map();
    for (const card of cards) {
      const source = reconstructed.find((sense) => sense.senseId === card.senseId);
      assert.ok(source);
      assert.equal(card.chapter, source.chapter);
      assert.equal(card.locator, `${/dialogue/iu.test((await readFile(join(unitRoot, source.directory, "chapter.md"), "utf8")).match(/^type:\s*"?([^"\n]+)/mu)?.[1] ?? "") ? "Dialogue" : "Narrative"} > line ${source.line}`);
      assert.equal(card.evidence, source.evidence);
      assert.equal(card.examples.includes(source.evidence), true);
      const chapterMarkdown = await readFile(join(unitRoot, source.directory, "chapter.md"), "utf8");
      assert.equal(card.evidence.includes(sectionBody(chapterMarkdown, "Brief Introduction", 2)), false);
      assert.equal(card.examples.includes(sectionBody(chapterMarkdown, "Brief Introduction", 2)), false);
      const directions = directionsBySense.get(card.senseId) ?? new Set();
      directions.add(`${card.promptLanguage}-to-${card.answerLanguage}`);
      directionsBySense.set(card.senseId, directions);
    }
    for (const directions of directionsBySense.values()) assert.deepEqual([...directions].sort(), [...config.directions].sort());

    for (const level of ["easy", "hard"]) {
      const summary = await readFile(join(unitRoot, `chapter-006-010-grammar-${level}`, "chapter.md"), "utf8");
      assert.deepEqual([...new Set(summary.match(new RegExp(`${config.prefix}-GRAMMAR-\\d{3}`, "gu")))], grammarIds);
    }
  });
}

test("French, German, Japanese, and Korean Chapters 6–10 render complete installed readings in every learner view", async () => {
  const root = await mkdtemp(join(tmpdir(), "wsm-reading-repair-006-010-"));
  const packagesDirectory = join(root, "packages");
  const cataloguePath = join(root, "catalogue.json");
  const dataDir = join(root, "data");
  try {
    for (const config of configs) {
      await generateContentPackage({ targetId: `${config.slug}-curriculum`, outputDirectory: packagesDirectory, generatedAt: "2026-07-23T00:00:00Z" });
    }
    await generateLocalContentPackageCatalogue({ packagesDirectory, outputPath: cataloguePath, generatedAt: "2026-07-23T00:00:00Z" });
    for (const config of configs) {
      await installContentPackage({ cataloguePath, dataDir, packageId: `com.sleepymario.language.${config.slug}`, installedAt: "2026-07-23T00:00:00Z" });
    }

    const tree = await buildLanguageTree(dataDir, "normal");
    for (const config of configs) {
      const language = tree.children.find((node) => node.label === config.label);
      const readContent = language?.children?.find((node) => node.label === "Read content");
      assert.ok(readContent, `${config.label} Read content menu`);
      for (const chapter of [6, 7, 8, 9, 10]) {
        const node = readContent.children.find((candidate) => candidate.filePath?.includes(`/chapter-${String(chapter).padStart(3, "0")}-`) && candidate.filePath.endsWith("/chapter.md"));
        assert.ok(node, `${config.label} Chapter ${chapter} menu node`);
        const source = await readFile(join(workspace, `${config.slug}-curriculum`, node.filePath), "utf8");
        const heading = chapter % 2 === 1 ? "Dialogue" : "Narrative";
        const expectedReading = primaryReading(source, false);
        const expectedIntroduction = sectionBody(source, "Brief Introduction", 2);
        for (const displayMode of ["normal", "expert"]) {
          const rendered = await renderLanguageTreeRightPane(node, { dataDir, displayMode });
          assert.equal(sectionBody(rendered, "Brief Introduction"), expectedIntroduction);
          assert.equal(sectionBody(rendered, heading), expectedReading);
          assert.doesNotMatch(sectionBody(rendered, "Brief Introduction"), technicalIntroduction);
          assert.ok(rendered.indexOf(`### ${heading}`) < rendered.indexOf("### New Vocabulary"));
          assert.ok(rendered.indexOf("### New Vocabulary") < rendered.indexOf("### Grammar"));
        }

        const translated = await renderLanguageTreeRightPane(node, { dataDir, displayMode: "normal", translationsEnabled: true });
        const brokenDown = await renderLanguageTreeRightPane(node, { dataDir, displayMode: "normal", breakdownEnabled: true });
        const translationBody = sectionBody(translated, "Natural English Translation");
        const breakdownBody = sectionBody(brokenDown, "Line-by-line Breakdown");
        assert.ok(translationBody.length > 0, `${config.label} Chapter ${chapter} Translation`);
        assert.ok(breakdownBody.length > 0, `${config.label} Chapter ${chapter} Breakdown`);
        assert.equal(translationBody.includes(expectedIntroduction), false);
        assert.equal(breakdownBody.includes(expectedIntroduction), false);
        assert.equal(sectionBody(translated, heading), expectedReading);
        assert.equal(sectionBody(brokenDown, heading), expectedReading);
        assert.equal(breakdownBody.split("\n").filter((line) => line.startsWith("- ")).length, primaryReading(source).length);
      }
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});


test("French, German, Japanese, and Korean Chapters 6–10 retain the approved content repairs", async () => {
  const expected = {
    french: {
      9: {
        includes: ["Quelle robe préfères-tu ?", "Moi, je préfère la robe rouge et le sac bleu."],
        excludes: ["Quelle robe ?", "Et moi, la robe rouge."]
      }
    },
    german: {
      7: {
        includes: ["Heute bin ich der Kellner.", "Danach möchte ich bezahlen."],
        excludes: ["Kellner: Ich bin der Kellner.", "Möchtest du bezahlen?"]
      },
      9: {
        includes: ["Ja, ich kann die Schraube festziehen."],
        excludes: ["Ja, vielleicht."]
      },
      10: {
        includes: ["Jonas fährt mit dem Bus, weil es regnet.", "Später kommt Jonas zu Mia."],
        excludes: ["Jonas fährt heute Bus", "Jonas ist im Café."]
      }
    },
    japanese: {
      6: {
        includes: ["机の上に大きい本があります。", "あきは大きい本を読みます。"],
        excludes: ["教室は静かです。"]
      },
      8: {
        includes: ["昼は学校にいます。", "午後は本を読みます。", "夜は帰ります。"],
        excludes: ["午後に本を読みます。", "部屋へ帰ります。", "学校で本を読みます。"]
      },
      9: {
        includes: ["店員: はい。", "水、ジュース、サンドイッチ、三つですね。"],
        excludes: ["店員ですか。", "三つですか。"]
      },
      10: {
        includes: ["二人は駅の近くの店へ行きました。", "夕方、二人は帰りました。"],
        excludes: ["二人は店で写真を見ました。", "二人は部屋へ帰りました。"]
      }
    },
    korean: {
      7: {
        includes: ["점원: 네."],
        excludes: ["점원이에요?"]
      },
      9: {
        includes: ["아니요, 오늘은 안 운동해요."],
        excludes: ["네, 주말에는 운동해요."]
      },
      10: {
        includes: ["준호가 시장에 왔어요.", "두 친구는 공원 사진을 봤어요.", "저녁에 민지는 집에 왔어요."],
        excludes: ["친구가 시장에 왔어요.", "저녁에 집에 왔어요."]
      }
    }
  };

  for (const [slug, chapters] of Object.entries(expected)) {
    const unitRoot = join(workspace, `${slug}-curriculum`, "units", `${slug}-core`);
    for (const [chapter, rules] of Object.entries(chapters)) {
      const directory = (await readdir(unitRoot, { withFileTypes: true }))
        .find((entry) => entry.isDirectory() && entry.name.startsWith(`chapter-${String(chapter).padStart(3, "0")}-`) && !entry.name.includes("grammar"))?.name;
      assert.ok(directory, `${slug} Chapter ${chapter}`);
      const source = await readFile(join(unitRoot, directory, "chapter.md"), "utf8");
      for (const value of rules.includes) assert.equal(source.includes(value), true, `${slug} ${chapter} includes ${value}`);
      for (const value of rules.excludes) assert.equal(source.includes(value), false, `${slug} ${chapter} excludes ${value}`);
    }
  }
});

function primaryReading(markdown, stripSpeakers = true) {
  const lines = primaryReadingLines(markdown, stripSpeakers);
  return stripSpeakers ? lines : lines.join("\n");
}

function primaryReadingLines(markdown, stripSpeakers = true) {
  const match = /^### (Dialogue|Narrative)\s*$\n([\s\S]*?)(?=^### New Vocabulary\s*$)/mu.exec(markdown);
  assert.ok(match);
  return match[2].trim().split(/\r?\n/u)
    .map((line) => stripSpeakers && match[1] === "Dialogue" ? line.replace(/^[^:]+:\s*/u, "").trim() : line.trim())
    .filter(Boolean);
}

function learnerEvidenceForRow(row, rawLine, utterance) {
  const speaker = /^([^:]+):/u.exec(rawLine)?.[1]?.trim();
  if (speaker && row[2].normalize("NFC").includes(speaker.normalize("NFC"))) return rawLine;
  return utterance;
}

function sectionBody(markdown, heading, level = 3) {
  const lines = markdown.split(/\r?\n/u);
  const marker = `${"#".repeat(level)} ${heading}`;
  const start = lines.indexOf(marker);
  assert.notEqual(start, -1, marker);
  const end = lines.findIndex((line, index) => index > start && (heading === "Brief Introduction"
    ? /^#{1,6}\s/u.test(line)
    : new RegExp(`^#{1,${level}}\\s`, "u").test(line)));
  return lines.slice(start + 1, end < 0 ? lines.length : end).join("\n").trim();
}

function parseMarkdownTable(text, header) {
  const lines = text.split(/\r?\n/u);
  const start = lines.indexOf(header);
  assert.notEqual(start, -1, header);
  const rows = [];
  for (const line of lines.slice(start + 2)) {
    if (!line.startsWith("|")) break;
    rows.push(line.slice(1, -1).split("|").map((cell) => cell.trim()));
  }
  return rows;
}

function parseDeck(text) {
  return text.trimEnd().split("\n").slice(1).map((line) => {
    const fields = line.split("\t");
    assert.equal(fields.length, 18);
    return {
      id: fields[0],
      chapter: Number(fields[3]),
      promptLanguage: fields[4],
      answerLanguage: fields[5],
      senseId: JSON.parse(fields[10]).at(-1),
      locator: fields[14],
      evidence: fields[15],
      examples: JSON.parse(fields[16])
    };
  });
}
