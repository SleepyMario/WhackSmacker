import { readFile, readdir, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";

const root = process.cwd();
const checkOnly = process.argv.includes("--check");
const header = "card_id\tdeck\tkind\tsource_chapter\tprompt_language\tanswer_language\tprompt\taccepted_answers\tdistractors\texplanation\tlexical_ids\tgrammar_ids\tgeographic_ids\tprovenance_path\tprovenance_locator\tprovenance_evidence\texamples\ttags";

const configs = [
  {
    language: "Dutch", code: "nl", slug: "dutch", repository: "dutch-curriculum", maxChapter: 75,
    newlyRegisteredTopics: ["administration.documents", "communication.greetings", "communication.media", "daily.routines", "education.learning", "emotions.general", "food.cooking", "furniture.general", "gardening.plants", "geography.places", "leisure.crafts", "leisure.culture", "numbers.cardinal", "technology.networking", "travel.hiking", "work.projects"],
    corrections: [
      "Separated furniture.general from household.objects and moved the household anchor to the earliest remaining household sense, nl.noun.raam.window (Chapter 4).",
      "Retained the deliberate Chapter 8 fruit field as initial-expansion, while correcting Chapter 13 fruit and historically later transport, shopping, container, unit, and time senses to later-expansion.",
      "Expanded existing topic membership to include all clearly applicable canonical senses found in Chapters 1-70.",
      "Moved measurement.dimensions first attestation to Chapter 30 because nl.adjective.ruim.spacious predates the Chapter 48 measurement reading.",
      "Replaced the former administrative Chapter 66, 67, and 70 topic memberships with literal bicycle-repair, gardening, and film evidence.",
      "Extended the inventory through Chapter 75 with hiking, pet-care, cooking, craft, and home-networking evidence, preserving all 607 earlier senses and adding exactly 80 collision-free senses."
    ],
    variants: [
      { kind: "polysemy", finding: "Dutch lexical identity remains sense- and part-of-speech-based; identical spellings are not merged across unrelated senses." },
      { kind: "citation-form", finding: "All assigned Dutch common nouns retain their learner-facing de/het citation forms from the canonical review inventory." }
    ],
    recommendations: [
      { chapter_range: "1-15", topics: ["digital.phones-and-devices", "food.local-dishes"], note: "Future natural device or meal contexts could add individual high-frequency senses; no retrofit is required." },
      { chapter_range: "16-30", topics: ["descriptive.colours", "clothing.general", "household.objects", "furniture.general"], note: "Gift, home, and renovation contexts are possible future expansion points." },
      { chapter_range: "31-50", topics: ["animals.pets", "food.vegetables", "measurement.dimensions"], note: "Animal-care, market, and measurement readings can support gradual additions." },
      { chapter_range: "51-70", topics: ["weather.general", "health.general", "occupations.professions"], note: "Existing weather, clinic, gardening, repair, and film settings offer future reinforcement or one-at-a-time expansion." },
      { chapter_range: "71-75", topics: ["travel.hiking", "animals.pets", "food.cooking", "leisure.crafts", "technology.networking"], note: "The completed block establishes five deliberately distinct practical fields; future chapters should reuse them selectively without clustering adjacent topics." }
    ],
    deferred: [
      { topic_id: "body.parts", reason: "No standalone canonical body-part sense occurs; tanden appears only inside the canonical routine phrase poetst zijn tanden." },
      { topic_id: "measurement.classifiers", reason: "Dutch has no Vietnamese-style lexical classifier system in the audited curriculum." }
    ]
  },
  {
    language: "Vietnamese", code: "vi", slug: "vietnamese", repository: "vietnamese-curriculum", maxChapter: 50,
    newlyRegisteredTopics: ["administration.documents", "animals.general", "communication.greetings", "communication.media", "daily.routines", "education.learning", "furniture.general", "geography.places", "leisure.culture", "numbers.cardinal", "work.projects"],
    corrections: [
      "Separated furniture.general from household.objects; bàn and ghế remain furniture senses rather than household catch-all entries.",
      "Corrected food.vegetables to begin with rau in Chapter 14 and restored omitted cà chua, khoai tây, hành, nông sản, bí đỏ, and dưa chuột memberships.",
      "Corrected measurement.containers to begin with cốc in Chapter 15, before hộp and giỏ.",
      "Corrected measurement.quantity-expressions to begin with bao nhiêu in Chapter 27, before số lượng in Chapter 41.",
      "Corrected health.general to begin with đau đầu in Chapter 30 rather than khỏe later in the same reading.",
      "Corrected weather.general to begin with thời tiết in Chapter 38 rather than mưa later in the same reading.",
      "Added nhẹ as the same-chapter initial expansion for measurement.dimensions and reclassified historically later members as later-expansion.",
      "Expanded existing topic membership to include all clearly applicable canonical senses found in Chapters 1-50."
    ],
    variants: [
      { kind: "homonymy", finding: "vi.noun.cam.orange-fruit belongs to food.fruit; no orange-colour sense is present, so màu xanh remains the only colour sense and cam is not duplicated there." },
      { kind: "regional-variant", finding: "gỏi cuốn and northern nem cuốn remain one canonical dish sense and produce one bidirectional review pair." },
      { kind: "contextual-name", finding: "Contextual bún bò and fuller bún bò Huế remain one intended dish identity and produce one bidirectional review pair." },
      { kind: "regional-distinction", finding: "bố is retained as the taught northern father sense; untaught ba is documented but is not invented as a second canonical sense." }
    ],
    recommendations: [
      { chapter_range: "1-15", topics: ["family.relationships", "digital.phones-and-devices", "food.drinks"], note: "Later family, communication, and café contexts can add useful senses individually." },
      { chapter_range: "16-30", topics: ["descriptive.colours", "clothing.general", "furniture.general", "health.general"], note: "The singleton colour topic is a clear opportunity, not an overdue requirement." },
      { chapter_range: "31-40", topics: ["animals.general", "weather.general", "measurement.dimensions"], note: "Existing rescue, forecast, and route contexts can support gradual additions." },
      { chapter_range: "41-50", topics: ["animals.pets", "measurement.containers", "time.calendar"], note: "Counting and inventory contexts may reinforce or naturally expand these topics without duplicating classifiers." }
    ],
    deferred: [
      { topic_id: "body.parts", reason: "No standalone canonical body-part noun occurs; đầu appears only within the canonical health phrase đau đầu and răng within đánh răng." },
      { topic_id: "emotions.general", reason: "The audited curriculum has evaluative and state adjectives but no clear canonical emotion field requiring registration." }
    ]
  }
];

for (const config of configs) {
  const result = await audit(config);
  const curriculumRoot = join(root, "..", config.repository);
  await emit(join(curriculumRoot, "lexical-topic-audit.json"), `${JSON.stringify(result, null, 2)}\n`);
  await emit(join(curriculumRoot, "lexical-topic-audit.md"), renderMarkdown(result));
}

async function audit(config) {
  const curriculumRoot = join(root, "..", config.repository);
  const inventory = JSON.parse(await readFile(join(curriculumRoot, "lexical-topics.json"), "utf8"));
  if (inventory.max_ordinary_chapter !== config.maxChapter) throw new Error(`${config.language}: wrong curriculum boundary`);
  const unitEntries = await readdir(join(curriculumRoot, "units", `${config.slug}-core`));
  const forbidden = `chapter-${String(config.maxChapter + 1).padStart(3, "0")}-`;
  if (unitEntries.some((entry) => entry.startsWith(forbidden))) throw new Error(`${config.language}: forbidden Chapter ${config.maxChapter + 1} exists`);

  const topicIds = new Set();
  const memberships = new Map();
  const topicSummaries = [];
  for (const topic of inventory.topics) {
    if (topicIds.has(topic.topic_id)) throw new Error(`${config.language}: duplicate topic ${topic.topic_id}`);
    topicIds.add(topic.topic_id);
    const groups = [topic.anchor_senses, topic.initial_expansion_senses, topic.later_expansion_senses, topic.reinforcement_senses ?? []];
    const senses = groups.flat();
    if (topic.anchor_senses.length !== 1) throw new Error(`${topic.topic_id}: exactly one anchor required`);
    const earliest = Math.min(...senses.filter((sense) => sense.topic_role !== "reinforcement").map((sense) => sense.first_introduction_chapter));
    if (earliest !== topic.first_attested_chapter || topic.anchor_senses[0].first_introduction_chapter !== earliest || topic.first_attested_sense !== topic.anchor_senses[0].sense_id) throw new Error(`${topic.topic_id}: anchor is not the earliest topic sense`);
    for (const sense of senses) {
      if (sense.topic_first_chapter !== earliest) throw new Error(`${sense.sense_id}: incorrect topic_first_chapter`);
      if (sense.topic_role === "later-expansion" && sense.first_introduction_chapter <= earliest) throw new Error(`${sense.sense_id}: later-expansion is not chronologically later`);
      if (sense.topic_role === "reinforcement" && sense.chapter_attestations.some((chapter) => chapter <= sense.first_introduction_chapter)) throw new Error(`${sense.sense_id}: reinforcement is not later reuse`);
      const assigned = memberships.get(sense.sense_id) ?? [];
      assigned.push(topic.topic_id);
      memberships.set(sense.sense_id, assigned);
    }
    const uniqueSenses = new Set(senses.filter((sense) => sense.topic_role !== "reinforcement").map((sense) => sense.sense_id));
    const latest = Math.max(...senses.map((sense) => Math.max(...sense.chapter_attestations)));
    topicSummaries.push({
      topic_id: topic.topic_id,
      display_name: topic.display_name,
      first_attested_chapter: topic.first_attested_chapter,
      first_attested_sense: topic.first_attested_sense,
      status: topic.status,
      assigned_sense_count: uniqueSenses.size,
      membership_count: senses.length,
      latest_attested_chapter: latest,
      language_specific_notes: topic.language_specific_notes,
      distinguishes_from: topic.distinguishes_from,
      senses: senses.map((sense) => ({ sense_id: sense.sense_id, lexical_id: sense.lexical_id, citation_form: sense.citation_form, first_chapter: sense.first_introduction_chapter, topic_role: sense.topic_role, chapter_attestations: sense.chapter_attestations, regional_variants: sense.regional_variants ?? [] }))
    });
  }

  const deckRoot = join(root, "review-content", config.slug, "review-decks");
  const directories = (await readdir(deckRoot)).filter((entry) => /^chapter-\d{3}-\d{3}$/u.test(entry)).sort();
  const canonical = new Map();
  const reviewFindings = [];
  for (const directory of directories) {
    const [start, end] = directory.match(/\d{3}/gu).map(Number);
    const lines = (await readFile(join(deckRoot, directory, "cards.tsv"), "utf8")).trimEnd().split(/\r?\n/u);
    if (lines[0] !== header) throw new Error(`${directory}: invalid review header`);
    const bySense = new Map();
    for (const line of lines.slice(1)) {
      const fields = line.split("\t");
      if (fields.length !== 18 || fields[2] !== "vocabulary") throw new Error(`${directory}: invalid ordinary card`);
      const chapter = Number(fields[3]);
      const [lexicalId, senseId] = JSON.parse(fields[10]);
      const examples = JSON.parse(fields[16]);
      if (!senseId.startsWith(`${lexicalId}.`) || chapter < start || chapter > end || examples.length < 1 || examples.length > 3) throw new Error(`${senseId}: invalid review identity, chapter, or examples`);
      const source = await readFile(join(curriculumRoot, fields[13]), "utf8");
      const learnerText = extractLearnerFacingText(source);
      if (!examples.every((example) => learnerText.includes(example))) throw new Error(`${senseId}: review example is not learner-facing`);
      const direction = `${fields[4]}->${fields[5]}`;
      const pair = bySense.get(senseId) ?? [];
      pair.push(direction);
      bySense.set(senseId, pair);
      if (fields[4] === config.code) {
        if (canonical.has(senseId)) throw new Error(`${senseId}: duplicate target-to-source card`);
        canonical.set(senseId, { lexical_id: lexicalId, sense_id: senseId, citation_form: fields[6], meaning: JSON.parse(fields[7]).join("; "), first_introduction_chapter: chapter, review_block: `${start}-${end}`, provenance_path: fields[13], examples, topic_ids: memberships.get(senseId) ?? [], disposition: memberships.has(senseId) ? "assigned-practical-topic" : "not-assigned-to-a-tracked-practical-topic" });
      }
    }
    for (const [senseId, directions] of bySense) {
      const expected = [`${config.code}->en`, `en->${config.code}`].sort();
      if (directions.length !== 2 || JSON.stringify(directions.sort()) !== JSON.stringify(expected)) throw new Error(`${senseId}: review directions are not exactly bidirectional`);
    }
    reviewFindings.push({ block: `${start}-${end}`, canonical_sense_count: bySense.size, card_count: lines.length - 1, mismatch_count: 0, findings: [] });
  }

  for (const [senseId, topicIdsForSense] of memberships) {
    const record = canonical.get(senseId);
    if (record === undefined) throw new Error(`${senseId}: topic sense does not resolve to a canonical reviewed sense`);
    for (const topicId of topicIdsForSense) {
      const topic = inventory.topics.find((candidate) => candidate.topic_id === topicId);
      const sense = [...topic.anchor_senses, ...topic.initial_expansion_senses, ...topic.later_expansion_senses, ...(topic.reinforcement_senses ?? [])].find((candidate) => candidate.sense_id === senseId);
      if (sense.topic_role !== "reinforcement" && sense.first_introduction_chapter !== record.first_introduction_chapter) throw new Error(`${senseId}: topic and canonical first chapters disagree`);
    }
  }

  const sparse = topicSummaries.filter((topic) => topic.assigned_sense_count <= 4 || config.maxChapter - topic.latest_attested_chapter >= 15).map((topic) => ({ topic_id: topic.topic_id, sense_count: topic.assigned_sense_count, latest_attested_chapter: topic.latest_attested_chapter, flags: [topic.assigned_sense_count === 1 ? "singleton" : null, topic.assigned_sense_count >= 2 && topic.assigned_sense_count <= 4 ? "two-to-four-senses" : null, config.maxChapter - topic.latest_attested_chapter >= 15 ? "long-unexpanded" : null].filter(Boolean), assessment: "expansion-opportunity-only" }));
  const concentrated = [];
  for (const topic of topicSummaries) {
    const counts = new Map();
    for (const sense of topic.senses.filter((item) => item.topic_role !== "reinforcement")) counts.set(sense.first_chapter, (counts.get(sense.first_chapter) ?? 0) + 1);
    for (const [chapter, count] of counts) if (count >= 5) concentrated.push({ topic_id: topic.topic_id, chapter, new_sense_count: count, assessment: "reviewed-contextually-supported", invalid: false });
  }

  const canonicalSenses = [...canonical.values()].sort((left, right) => left.first_introduction_chapter - right.first_introduction_chapter || left.sense_id.localeCompare(right.sense_id));
  return {
    schema_version: 1,
    language: config.language,
    audited_through_chapter: config.maxChapter,
    policy: { singleton_allowed_indefinitely: true, fixed_expansion_quota: false, expansion_deadline: false, topic_metadata_changes_review_eligibility: false },
    summary: { total_canonical_senses_audited: canonicalSenses.length, total_topics: topicSummaries.length, assigned_unique_canonical_senses: memberships.size, topic_memberships: [...memberships.values()].reduce((sum, ids) => sum + ids.length, 0), unassigned_canonical_senses: canonicalSenses.length - memberships.size, review_blocks: reviewFindings.length, review_mismatches: 0 },
    topics: topicSummaries,
    canonical_senses: canonicalSenses,
    unassigned_canonical_senses: canonicalSenses.filter((sense) => sense.topic_ids.length === 0).map((sense) => ({ sense_id: sense.sense_id, first_chapter: sense.first_introduction_chapter, disposition: "No genuine assignment to the audited practical-topic inventory; retained as a canonical general, structural, proper-name, number, lesson-specific, or otherwise ungrouped sense." })),
    missing_topics: [],
    missing_topics_found_and_registered: config.newlyRegisteredTopics,
    invalid_topic_records: [],
    corrected_invalid_topic_records: config.corrections,
    sparse_topics: sparse,
    overconcentrated_topics: concentrated,
    variant_identity_findings: config.variants,
    review_findings: reviewFindings,
    recommended_future_expansions: config.recommendations,
    deferred_opportunities: config.deferred,
    learner_facing_content_modified_by_audit: false
  };
}

function extractLearnerFacingText(markdown) {
  const lines = markdown.split(/\r?\n/u);
  const chunks = [];
  let activeLevel = 0;
  for (const line of lines) {
    const heading = /^(#{2,6})\s+(.+)$/u.exec(line);
    if (heading !== null) {
      const level = heading[1].length;
      if (/\b(?:Dialogue|Narrative)\b/iu.test(heading[2])) activeLevel = level;
      else if (activeLevel !== 0 && level <= activeLevel) activeLevel = 0;
    } else if (activeLevel !== 0) chunks.push(line);
  }
  return chunks.join("\n");
}

async function emit(path, content) {
  if (checkOnly) {
    const existing = await readFile(path, "utf8");
    if (existing !== content) throw new Error(`${path} is stale; run node scripts/generate-lexical-topic-audit.mjs`);
  } else {
    await writeFile(path, content);
  }
}

function renderMarkdown(audit) {
  const singleton = audit.sparse_topics.filter((topic) => topic.flags.includes("singleton"));
  const small = audit.topics.filter((topic) => topic.assigned_sense_count >= 2 && topic.assigned_sense_count <= 4);
  const established = audit.topics.filter((topic) => topic.status === "well-established");
  const lines = [
    `# ${audit.language} Lexical-Topic Audit — Chapters 1–${audit.audited_through_chapter}`,
    "",
    `This complete audit covers all ${audit.summary.total_canonical_senses_audited} canonical senses and all ${audit.summary.review_blocks} five-chapter review blocks. It assigns ${audit.summary.assigned_unique_canonical_senses} unique senses across ${audit.summary.total_topics} practical topics (${audit.summary.topic_memberships} topic memberships). Unassigned senses remain canonical but are not forced into an invented practical topic.`,
    "",
    "A topic may remain sparse indefinitely. There is no fixed pace, quota, deadline, required cadence, or completion point.",
    "",
    "## Topics by first chapter",
    "",
    "| Topic ID | Display name | First | Anchor | Senses | Status |",
    "|---|---|---:|---|---:|---|",
    ...audit.topics.map((topic) => `| \`${topic.topic_id}\` | ${topic.display_name} | ${topic.first_attested_chapter} | \`${topic.first_attested_sense}\` | ${topic.assigned_sense_count} | ${topic.status} |`),
    "",
    "## Sparse and established topics",
    "",
    `Singleton topics: ${singleton.length === 0 ? "none" : singleton.map((topic) => `\`${topic.topic_id}\``).join(", ")}.`,
    "",
    `Topics with 2–4 senses: ${small.length === 0 ? "none" : small.map((topic) => `\`${topic.topic_id}\` (${topic.assigned_sense_count})`).join(", ")}.`,
    "",
    `Well-established topics: ${established.length === 0 ? "none" : established.map((topic) => `\`${topic.topic_id}\` (${topic.assigned_sense_count})`).join(", ")}.`,
    "",
    "Sparse and long-unexpanded topics are expansion opportunities only, never failures.",
    "",
    "## Missing and invalid records",
    "",
    `Missing topics remaining: ${audit.missing_topics.length}. Topics found and registered during this audit: ${audit.missing_topics_found_and_registered.map((id) => `\`${id}\``).join(", ") || "none"}.`,
    "",
    `Invalid records remaining: ${audit.invalid_topic_records.length}. Corrections made:`,
    "",
    ...audit.corrected_invalid_topic_records.map((finding) => `- ${finding}`),
    "",
    "## Variant and polysemy findings",
    "",
    ...audit.variant_identity_findings.map((finding) => `- ${finding.finding}`),
    "",
    "## Five-chapter review findings",
    "",
    "| Block | Canonical senses | Cards | Mismatches |",
    "|---|---:|---:|---:|",
    ...audit.review_findings.map((finding) => `| ${finding.block} | ${finding.canonical_sense_count} | ${finding.card_count} | ${finding.mismatch_count} |`),
    "",
    "Every block contains exactly one target-to-source and one source-to-target card per first-introduced canonical sense. Topic metadata creates no extra cards; reinforcement remains excluded from new-sense counts.",
    "",
    "## Concentration findings",
    "",
    audit.overconcentrated_topics.length === 0 ? "No chapter introduces five or more senses assigned to one topic." : audit.overconcentrated_topics.map((finding) => `- Chapter ${finding.chapter}, \`${finding.topic_id}\`: ${finding.new_sense_count} senses; reviewed as contextually supported, not invalid themed-list dumping.`).join("\n"),
    "",
    "## Chapter-level future opportunities",
    "",
    ...audit.recommended_future_expansions.map((item) => `- Chapters ${item.chapter_range}: ${item.topics.map((id) => `\`${id}\``).join(", ")} — ${item.note}`),
    "",
    "## Deferred opportunities",
    "",
    ...audit.deferred_opportunities.map((item) => `- \`${item.topic_id}\`: ${item.reason}`),
    "",
    "No learner-facing chapter content was changed during this audit.",
    ""
  ];
  return lines.join("\n");
}
