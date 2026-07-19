export const lexicalTopicRoles = ["anchor", "initial-expansion", "later-expansion", "reinforcement"] as const;
export type LexicalTopicRole = typeof lexicalTopicRoles[number];
export const lexicalTopicStatuses = ["observed", "active", "expanding", "well-established"] as const;
export type LexicalTopicStatus = typeof lexicalTopicStatuses[number];

export interface LexicalTopicSense {
  readonly lexical_topic?: string;
  readonly lexical_id: string;
  readonly sense_id: string;
  readonly citation_form: string;
  readonly regional_variants?: readonly string[];
  readonly meaning: string;
  readonly topic_role: LexicalTopicRole;
  readonly topic_first_chapter: number;
  readonly topic_expansion_stage: number;
  readonly first_introduction_chapter: number;
  readonly chapter_attestations: readonly number[];
}

export interface LexicalTopicRecord {
  readonly topic_id: string;
  readonly display_name: string;
  readonly first_attested_chapter: number;
  readonly first_attested_sense: string;
  readonly anchor_senses: readonly LexicalTopicSense[];
  readonly initial_expansion_senses: readonly LexicalTopicSense[];
  readonly later_expansion_senses: readonly LexicalTopicSense[];
  readonly reinforcement_senses?: readonly LexicalTopicSense[];
  readonly status: LexicalTopicStatus;
  readonly chapter_attestations: readonly number[];
}

export interface LexicalTopicInventory {
  readonly schema_version: 1;
  readonly language: string;
  readonly max_ordinary_chapter: number;
  readonly topics: readonly LexicalTopicRecord[];
}

export interface LexicalTopicEvidence {
  readonly canonicalSenseIds: ReadonlySet<string>;
  readonly learnerFacingAttestations: ReadonlyMap<string, ReadonlySet<number>>;
  readonly reviewSenseIdsByBlock: ReadonlyMap<string, ReadonlySet<string>>;
}

export interface LexicalTopicAuditResult {
  readonly topicCount: number;
  readonly introducedExpansionSenseCount: number;
  readonly reinforcementSenseCount: number;
}

export function reviewBlockForChapter(chapter: number): string {
  assertChapter(chapter);
  const start = Math.floor((chapter - 1) / 5) * 5 + 1;
  return `${String(start).padStart(3, "0")}-${String(start + 4).padStart(3, "0")}`;
}

export function assertLexicalTopicInventory(
  inventory: LexicalTopicInventory,
  evidence?: LexicalTopicEvidence
): LexicalTopicAuditResult {
  if (inventory.schema_version !== 1) throw new Error("Lexical-topic inventory schema_version must be 1.");
  if (inventory.language.trim() === "") throw new Error("Lexical-topic inventory language is required.");
  assertChapter(inventory.max_ordinary_chapter);

  const topicIds = new Set<string>();
  const ownedExpansionSenses = new Map<string, string>();
  let introducedExpansionSenseCount = 0;
  let reinforcementSenseCount = 0;

  for (const topic of inventory.topics) {
    if (!/^[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)*$/u.test(topic.topic_id)) throw new Error(`Invalid stable topic ID: ${topic.topic_id}`);
    if (topicIds.has(topic.topic_id)) throw new Error(`Duplicate lexical topic ID: ${topic.topic_id}`);
    topicIds.add(topic.topic_id);
    if (topic.display_name.trim() === "") throw new Error(`${topic.topic_id}: display_name is required.`);
    if (!lexicalTopicStatuses.includes(topic.status)) throw new Error(`${topic.topic_id}: unsupported descriptive status ${topic.status}.`);
    assertChapter(topic.first_attested_chapter);
    if (topic.first_attested_chapter > inventory.max_ordinary_chapter) throw new Error(`${topic.topic_id}: first attested chapter exceeds the curriculum boundary.`);
    if (topic.anchor_senses.length !== 1) throw new Error(`${topic.topic_id}: a topic requires exactly one anchor sense.`);
    if (topic.first_attested_sense !== topic.anchor_senses[0]?.sense_id) throw new Error(`${topic.topic_id}: first_attested_sense must identify the anchor sense.`);
    if (!topic.chapter_attestations.includes(topic.first_attested_chapter)) throw new Error(`${topic.topic_id}: chapter attestations must include the first attested chapter.`);

    const groups: readonly [LexicalTopicRole, readonly LexicalTopicSense[]][] = [
      ["anchor", topic.anchor_senses],
      ["initial-expansion", topic.initial_expansion_senses],
      ["later-expansion", topic.later_expansion_senses],
      ["reinforcement", topic.reinforcement_senses ?? []]
    ];
    const topicSenseIds = new Set<string>();
    const allAttestations = new Set(topic.chapter_attestations);
    for (const chapter of topic.chapter_attestations) assertBoundedChapter(chapter, inventory.max_ordinary_chapter, topic.topic_id);

    for (const [expectedRole, senses] of groups) {
      for (const sense of senses) {
        if (sense.topic_role !== expectedRole) throw new Error(`${sense.sense_id}: expected topic_role ${expectedRole}.`);
        if (sense.lexical_topic !== undefined && sense.lexical_topic !== topic.topic_id) throw new Error(`${sense.sense_id}: lexical_topic must be ${topic.topic_id}.`);
        if (sense.topic_first_chapter !== topic.first_attested_chapter) throw new Error(`${sense.sense_id}: topic-first-chapter must be ${topic.first_attested_chapter}.`);
        if (!Number.isInteger(sense.topic_expansion_stage) || sense.topic_expansion_stage < 0) throw new Error(`${sense.sense_id}: invalid topic_expansion_stage.`);
        if (sense.lexical_id.trim() === "" || sense.sense_id.trim() === "" || sense.citation_form.trim() === "" || sense.meaning.trim() === "") throw new Error(`${topic.topic_id}: lexical-topic senses require canonical identity, citation form, and meaning.`);
        const variants = new Set<string>();
        for (const variant of sense.regional_variants ?? []) {
          if (variant.trim() === "" || variant === sense.citation_form || variants.has(variant)) throw new Error(`${sense.sense_id}: regional variants must be unique, nonempty alternatives to the citation form.`);
          variants.add(variant);
        }
        if (!sense.sense_id.startsWith(`${sense.lexical_id}.`)) throw new Error(`${sense.sense_id}: sense does not resolve under lexical ID ${sense.lexical_id}.`);
        if (topicSenseIds.has(sense.sense_id) && expectedRole !== "reinforcement") throw new Error(`${topic.topic_id}: duplicate sense ${sense.sense_id}.`);
        topicSenseIds.add(sense.sense_id);
        assertBoundedChapter(sense.first_introduction_chapter, inventory.max_ordinary_chapter, sense.sense_id);
        if (sense.first_introduction_chapter < topic.first_attested_chapter) throw new Error(`${sense.sense_id}: first introduction precedes the topic anchor.`);
        if (sense.chapter_attestations.length === 0) throw new Error(`${sense.sense_id}: chapter attestations are required.`);
        if (expectedRole !== "reinforcement" && !sense.chapter_attestations.includes(sense.first_introduction_chapter)) throw new Error(`${sense.sense_id}: chapter attestations must include the first-introduction chapter.`);
        for (const chapter of sense.chapter_attestations) {
          assertBoundedChapter(chapter, inventory.max_ordinary_chapter, sense.sense_id);
          if (!allAttestations.has(chapter)) throw new Error(`${sense.sense_id}: Chapter ${chapter} is absent from the topic chapter attestations.`);
        }
        if (expectedRole === "anchor" && sense.first_introduction_chapter !== topic.first_attested_chapter) throw new Error(`${sense.sense_id}: anchor first introduction must equal the topic first attested chapter.`);
        if (expectedRole === "reinforcement") {
          reinforcementSenseCount += 1;
        } else if (expectedRole !== "anchor") {
          const owner = ownedExpansionSenses.get(sense.sense_id);
          if (owner !== undefined && owner !== topic.topic_id) throw new Error(`${sense.sense_id}: expansion sense is owned by both ${owner} and ${topic.topic_id}.`);
          ownedExpansionSenses.set(sense.sense_id, topic.topic_id);
          introducedExpansionSenseCount += 1;
        }
        if (evidence !== undefined) assertSenseEvidence(sense, expectedRole, evidence);
      }
    }
  }

  return { topicCount: topicIds.size, introducedExpansionSenseCount, reinforcementSenseCount };
}

function assertSenseEvidence(sense: LexicalTopicSense, role: LexicalTopicRole, evidence: LexicalTopicEvidence): void {
  if (!evidence.canonicalSenseIds.has(sense.sense_id)) throw new Error(`${sense.sense_id}: does not resolve to a canonical lexical sense.`);
  const learnerChapters = evidence.learnerFacingAttestations.get(sense.sense_id);
  if (learnerChapters === undefined || !learnerChapters.has(sense.first_introduction_chapter)) throw new Error(`${sense.sense_id}: lacks learner-facing Dialogue or Narrative attestation in its first-introduction chapter.`);
  if (role === "reinforcement") return;
  const block = reviewBlockForChapter(sense.first_introduction_chapter);
  if (!evidence.reviewSenseIdsByBlock.get(block)?.has(sense.sense_id)) throw new Error(`${sense.sense_id}: missing from review block ${block}.`);
}

function assertBoundedChapter(chapter: number, max: number, label: string): void {
  assertChapter(chapter);
  if (chapter > max) throw new Error(`${label}: Chapter ${chapter} exceeds maximum Chapter ${max}.`);
}

function assertChapter(chapter: number): void {
  if (!Number.isInteger(chapter) || chapter < 1) throw new Error(`Chapter must be a positive integer: ${chapter}`);
}
