import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";
import { promisify } from "node:util";
import { assertLexicalTopicInventory, reviewBlockForChapter } from "../dist/packages/core/index.js";

const appRoot = process.cwd();
const execFileAsync = promisify(execFile);
const header = "card_id\tdeck\tkind\tsource_chapter\tprompt_language\tanswer_language\tprompt\taccepted_answers\tdistractors\texplanation\tlexical_ids\tgrammar_ids\tgeographic_ids\tprovenance_path\tprovenance_locator\tprovenance_evidence\texamples\ttags";

for (const config of [
  { language: "Dutch", code: "dutch", repository: "dutch-curriculum", maxChapter: 75, canonicalSenses: 683, topics: 38, forbidden: /^chapter-076-/u },
  { language: "Vietnamese", code: "vietnamese", repository: "vietnamese-curriculum", maxChapter: 50, canonicalSenses: 396, topics: 33, forbidden: /^chapter-051-/u }
]) {
  test(`${config.language} lexical-topic inventory resolves to reading and bidirectional review evidence`, async () => {
    const curriculumRoot = join(appRoot, "..", config.repository);
    const inventory = JSON.parse(await readFile(join(curriculumRoot, "lexical-topics.json"), "utf8"));
    const audit = JSON.parse(await readFile(join(curriculumRoot, "lexical-topic-audit.json"), "utf8"));
    assert.equal(inventory.max_ordinary_chapter, config.maxChapter);
    const evidence = await collectEvidence(config.code, curriculumRoot);
    const result = assertLexicalTopicInventory(inventory, evidence);
    assert.equal(result.topicCount, inventory.topics.length);
    assert.equal(result.topicCount, config.topics);
    assert.equal(result.introducedExpansionSenseCount > 0, true);
    assert.equal(result.reinforcementSenseCount, 0);

    for (const topic of inventory.topics) {
      const firstAnchor = Math.min(...topic.anchor_senses.map((sense) => sense.first_introduction_chapter));
      assert.equal(topic.first_attested_chapter, firstAnchor, `${topic.topic_id}: first attested chapter`);
      assert.equal(topic.first_attested_sense, topic.anchor_senses[0].sense_id, `${topic.topic_id}: first attested sense`);
      for (const sense of topic.initial_expansion_senses) assert.equal(sense.first_introduction_chapter >= topic.first_attested_chapter, true, `${sense.sense_id}: initial chronology`);
      for (const sense of topic.later_expansion_senses) assert.equal(sense.first_introduction_chapter > topic.first_attested_chapter, true, `${sense.sense_id}: later chronology`);
    }

    assert.equal(audit.summary.total_canonical_senses_audited, config.canonicalSenses);
    assert.equal(audit.summary.total_topics, config.topics);
    assert.equal(audit.canonical_senses.length, config.canonicalSenses);
    assert.deepEqual(audit.missing_topics, []);
    assert.deepEqual(audit.invalid_topic_records, []);
    assert.equal(audit.review_findings.every((finding) => finding.mismatch_count === 0 && finding.card_count === finding.canonical_sense_count * 2), true);

    const unitEntries = await readdir(join(curriculumRoot, "units", `${config.code}-core`));
    assert.equal(unitEntries.some((entry) => config.forbidden.test(entry)), false);
  });
}

test("lexical-topic validation keeps reinforcement out of new review accounting", () => {
  const sense = {
    lexical_id: "nl.noun.test", sense_id: "nl.noun.test.item", citation_form: "de test", meaning: "test item",
    topic_role: "anchor", topic_first_chapter: 1, topic_expansion_stage: 0,
    first_introduction_chapter: 1, chapter_attestations: [1]
  };
  const reinforcement = { ...sense, topic_role: "reinforcement", topic_expansion_stage: 2, chapter_attestations: [6] };
  const inventory = {
    schema_version: 1, language: "nl", max_ordinary_chapter: 70,
    topics: [{ topic_id: "test.topic", display_name: "Test", first_attested_chapter: 1, first_attested_sense: sense.sense_id, status: "observed", chapter_attestations: [1, 6], anchor_senses: [sense], initial_expansion_senses: [], later_expansion_senses: [], reinforcement_senses: [reinforcement] }]
  };
  const evidence = {
    canonicalSenseIds: new Set([sense.sense_id]),
    learnerFacingAttestations: new Map([[sense.sense_id, new Set([1, 6])]]),
    reviewSenseIdsByBlock: new Map([["001-005", new Set([sense.sense_id])]])
  };
  const result = assertLexicalTopicInventory(inventory, evidence);
  assert.equal(result.introducedExpansionSenseCount, 0);
  assert.equal(result.reinforcementSenseCount, 1);
});

test("generated lexical-topic audit reports are current", async () => {
  await execFileAsync(process.execPath, ["scripts/generate-lexical-topic-audit.mjs", "--check"], { cwd: appRoot });
});

test("lexical-topic validation rejects duplicate IDs, wrong first chapters, and chapter overflow", () => {
  const anchor = { lexical_id: "vi.noun.a", sense_id: "vi.noun.a.a", citation_form: "a", meaning: "a", topic_role: "anchor", topic_first_chapter: 2, topic_expansion_stage: 0, first_introduction_chapter: 2, chapter_attestations: [2] };
  const topic = { topic_id: "sample", display_name: "Sample", first_attested_chapter: 2, first_attested_sense: anchor.sense_id, status: "observed", chapter_attestations: [2], anchor_senses: [anchor], initial_expansion_senses: [], later_expansion_senses: [] };
  assert.throws(() => assertLexicalTopicInventory({ schema_version: 1, language: "vi", max_ordinary_chapter: 50, topics: [topic, topic] }), /Duplicate lexical topic ID/u);
  assert.throws(() => assertLexicalTopicInventory({ schema_version: 1, language: "vi", max_ordinary_chapter: 50, topics: [{ ...topic, status: "complete" }] }), /unsupported descriptive status/u);
  assert.throws(() => assertLexicalTopicInventory({ schema_version: 1, language: "vi", max_ordinary_chapter: 50, topics: [{ ...topic, first_attested_chapter: 3, chapter_attestations: [2, 3] }] }), /topic-first-chapter/u);
  assert.throws(() => assertLexicalTopicInventory({ schema_version: 1, language: "vi", max_ordinary_chapter: 50, topics: [{ ...topic, chapter_attestations: [2, 51] }] }), /exceeds maximum Chapter 50/u);
  assert.equal(reviewBlockForChapter(13), "011-015");
});

test("lexical-topic validation permits an indefinitely sparse singleton without a quota or schedule", () => {
  const anchor = { lexical_id: "nl.noun.peer", sense_id: "nl.noun.peer.fruit", citation_form: "de peer", meaning: "pear", topic_role: "anchor", topic_first_chapter: 8, topic_expansion_stage: 0, first_introduction_chapter: 8, chapter_attestations: [8] };
  const inventory = { schema_version: 1, language: "nl", max_ordinary_chapter: 70, topics: [{ topic_id: "food.fruit", display_name: "Fruit", first_attested_chapter: 8, first_attested_sense: anchor.sense_id, status: "observed", chapter_attestations: [8], anchor_senses: [anchor], initial_expansion_senses: [], later_expansion_senses: [] }] };
  assert.deepEqual(assertLexicalTopicInventory(inventory), { topicCount: 1, introducedExpansionSenseCount: 0, reinforcementSenseCount: 0 });
});

test("lexical-topic identity distinguishes homonymous senses while allowing variant forms on one canonical sense", () => {
  const makeAnchor = (topicId, lexicalId, senseId, meaning) => ({ lexical_topic: topicId, lexical_id: lexicalId, sense_id: senseId, citation_form: "cam", meaning, topic_role: "anchor", topic_first_chapter: 8, topic_expansion_stage: 0, first_introduction_chapter: 8, chapter_attestations: [8] });
  const fruit = { ...makeAnchor("food.fruit", "vi.noun.cam", "vi.noun.cam.orange-fruit", "orange (fruit)"), regional_variants: ["trái cam"] };
  const colour = makeAnchor("descriptive.colours", "vi.adjective.cam", "vi.adjective.cam.orange-colour", "orange (colour)");
  const record = (topic_id, display_name, anchor) => ({ topic_id, display_name, first_attested_chapter: 8, first_attested_sense: anchor.sense_id, status: "observed", chapter_attestations: [8], anchor_senses: [anchor], initial_expansion_senses: [], later_expansion_senses: [] });
  const result = assertLexicalTopicInventory({ schema_version: 1, language: "vi", max_ordinary_chapter: 50, topics: [record("food.fruit", "Fruit", fruit), record("descriptive.colours", "Colours", colour)] });
  assert.equal(result.topicCount, 2);
  assert.equal(result.introducedExpansionSenseCount, 0);
});

test("one canonical sense may belong to multiple topics without duplicating lexical identity", () => {
  const shared = { lexical_id: "vi.noun.nha-hang", sense_id: "vi.noun.nha-hang.restaurant", citation_form: "nhà hàng", meaning: "restaurant", topic_role: "anchor", topic_first_chapter: 14, topic_expansion_stage: 0, first_introduction_chapter: 14, chapter_attestations: [14] };
  const record = (topic_id, display_name) => ({ topic_id, display_name, first_attested_chapter: 14, first_attested_sense: shared.sense_id, status: "observed", chapter_attestations: [14], anchor_senses: [{ ...shared, lexical_topic: topic_id }], initial_expansion_senses: [], later_expansion_senses: [] });
  const evidence = { canonicalSenseIds: new Set([shared.sense_id]), learnerFacingAttestations: new Map([[shared.sense_id, new Set([14])]]), reviewSenseIdsByBlock: new Map([["011-015", new Set([shared.sense_id])]]) };
  const result = assertLexicalTopicInventory({ schema_version: 1, language: "vi", max_ordinary_chapter: 50, topics: [record("food.meals", "Food and meals"), record("public.places", "Public places")] }, evidence);
  assert.equal(result.topicCount, 2);
});

async function collectEvidence(code, curriculumRoot) {
  const deckRoot = join(appRoot, "review-content", code, "review-decks");
  const deckDirectories = await readdir(deckRoot);
  const canonicalSenseIds = new Set();
  const learnerFacingAttestations = new Map();
  const reviewSenseIdsByBlock = new Map();
  const directions = new Map();
  const cardCounts = new Map();
  for (const directory of deckDirectories.filter((entry) => /^chapter-\d{3}-\d{3}$/u.test(entry))) {
    const block = directory.slice("chapter-".length);
    const rows = parseDeck(await readFile(join(deckRoot, directory, "cards.tsv"), "utf8"));
    for (const row of rows) {
      const [lexicalId, senseId] = row.lexicalIds;
      assert.equal(senseId.startsWith(`${lexicalId}.`), true);
      canonicalSenseIds.add(senseId);
      const source = await readFile(join(curriculumRoot, row.provenancePath), "utf8");
      assert.equal(row.examples.length >= 1 && row.examples.length <= 3, true, `${senseId}: one to three examples`);
      for (const example of row.examples) assert.equal(source.includes(example), true, `${senseId}: ${example}`);
      const chapters = learnerFacingAttestations.get(senseId) ?? new Set();
      chapters.add(row.sourceChapter);
      learnerFacingAttestations.set(senseId, chapters);
      const blockSenses = reviewSenseIdsByBlock.get(block) ?? new Set();
      blockSenses.add(senseId);
      reviewSenseIdsByBlock.set(block, blockSenses);
      const key = `${block}:${senseId}`;
      const pair = directions.get(key) ?? new Set();
      pair.add(`${row.promptLanguage}->${row.answerLanguage}`);
      directions.set(key, pair);
      cardCounts.set(key, (cardCounts.get(key) ?? 0) + 1);
      assert.equal(block, reviewBlockForChapter(row.sourceChapter));
    }
  }
  for (const [key, pair] of directions) {
    const language = code === "dutch" ? "nl" : "vi";
    assert.deepEqual([...pair].sort(), [`en->${language}`, `${language}->en`].sort(), key);
    assert.equal(cardCounts.get(key), 2, `${key}: exactly one card in each direction`);
  }
  return { canonicalSenseIds, learnerFacingAttestations, reviewSenseIdsByBlock };
}

function parseDeck(text) {
  const lines = text.trimEnd().split(/\r?\n/u);
  assert.equal(lines[0], header);
  return lines.slice(1).map((line) => {
    const fields = line.split("\t");
    assert.equal(fields.length, 18);
    return {
      sourceChapter: Number(fields[3]), promptLanguage: fields[4], answerLanguage: fields[5],
      lexicalIds: JSON.parse(fields[10]), provenancePath: fields[13], examples: JSON.parse(fields[16])
    };
  });
}
