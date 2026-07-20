export interface SinoVietnameseConstituent {
  readonly position: number;
  readonly reading: string;
  readonly character: string;
}

export interface SinoVietnameseLexicalRecord {
  readonly record_id: string;
  readonly citation_form: string;
  readonly canonical_lexical_id: string;
  readonly canonical_sense_id: string;
  readonly english_meaning: string;
  readonly han_viet_reading_or_constituent_readings: readonly string[];
  readonly characters: string;
  readonly constituents: readonly SinoVietnameseConstituent[];
  readonly first_introduced_chapter: number;
  readonly chapter_attestations: readonly number[];
  readonly chapter_section_locator: string;
  readonly literal_learner_facing_evidence: readonly string[];
  readonly modern_vietnamese_note: string;
  readonly variant_identity: string | null;
  readonly status: "canonical-established";
}

export interface SinoVietnameseMorphemeRecord {
  readonly morpheme_id: string;
  readonly reading: string;
  readonly character: string;
  readonly lexical_sense_ids: readonly string[];
}

export interface SinoVietnameseLexicon {
  readonly schema_version: 1;
  readonly language: "Vietnamese";
  readonly language_code: "vi";
  readonly audited_through_chapter: 50;
  readonly normalization: "NFC";
  readonly records: readonly SinoVietnameseLexicalRecord[];
  readonly constituent_morphemes: readonly SinoVietnameseMorphemeRecord[];
}

export interface SinoVietnameseCanonicalEvidence {
  readonly lexicalId: string;
  readonly firstChapter: number;
  readonly learnerFacingText: string;
}

export interface SinoVietnameseValidationEvidence {
  readonly canonicalBySenseId: ReadonlyMap<string, SinoVietnameseCanonicalEvidence>;
}

export interface SinoVietnameseValidationResult {
  readonly lexicalSenseCount: number;
  readonly constituentMorphemeCount: number;
  readonly chapterCount: number;
}

export function assertSinoVietnameseLexicon(
  lexicon: SinoVietnameseLexicon,
  evidence?: SinoVietnameseValidationEvidence
): SinoVietnameseValidationResult {
  if (lexicon.schema_version !== 1 || lexicon.language !== "Vietnamese" || lexicon.language_code !== "vi") throw new Error("Invalid Sino-Vietnamese lexicon identity or schema.");
  if (lexicon.audited_through_chapter !== 50) throw new Error("Sino-Vietnamese lexicon must stop at Vietnamese Chapter 50.");
  if (lexicon.normalization !== "NFC") throw new Error("Sino-Vietnamese lexicon normalization must be NFC.");

  const recordIds = new Set<string>();
  const senseIds = new Set<string>();
  const chapters = new Set<number>();
  for (const record of lexicon.records) {
    assertNfcStrings(record, record.canonical_sense_id);
    if (!/^sv\.vi\.[a-z0-9.-]+$/u.test(record.record_id) || recordIds.has(record.record_id)) throw new Error(`Duplicate or invalid Sino-Vietnamese record ID: ${record.record_id}`);
    recordIds.add(record.record_id);
    if (senseIds.has(record.canonical_sense_id)) throw new Error(`Duplicate Sino-Vietnamese canonical sense: ${record.canonical_sense_id}`);
    senseIds.add(record.canonical_sense_id);
    if (!record.canonical_sense_id.startsWith(`${record.canonical_lexical_id}.`)) throw new Error(`${record.canonical_sense_id}: does not resolve under ${record.canonical_lexical_id}.`);
    if (!Number.isInteger(record.first_introduced_chapter) || record.first_introduced_chapter < 1 || record.first_introduced_chapter > 50) throw new Error(`${record.canonical_sense_id}: invalid first chapter.`);
    chapters.add(record.first_introduced_chapter);
    if (!record.chapter_attestations.includes(record.first_introduced_chapter)) throw new Error(`${record.canonical_sense_id}: chapter attestations omit the first chapter.`);
    if (record.literal_learner_facing_evidence.length === 0) throw new Error(`${record.canonical_sense_id}: literal learner-facing evidence is required.`);
    if (!/^[\p{Script=Han}]+$/u.test(record.characters)) throw new Error(`${record.canonical_sense_id}: characters must contain only valid Han characters.`);
    if (record.constituents.length === 0 || record.constituents.map((entry) => entry.character).join("") !== record.characters) throw new Error(`${record.canonical_sense_id}: constituent characters do not reconstruct the word.`);
    if (record.constituents.map((entry) => entry.reading).join("\u0000") !== record.han_viet_reading_or_constituent_readings.join("\u0000")) throw new Error(`${record.canonical_sense_id}: Hán-Việt readings disagree with constituents.`);
    record.constituents.forEach((constituent, index) => {
      if (constituent.position !== index + 1 || constituent.reading.trim() === "" || !/^[\p{Script=Han}]$/u.test(constituent.character)) throw new Error(`${record.canonical_sense_id}: invalid constituent at position ${index + 1}.`);
    });
    if (record.status !== "canonical-established") throw new Error(`${record.canonical_sense_id}: speculative entries cannot be canonical.`);
    const canonical = evidence?.canonicalBySenseId.get(record.canonical_sense_id);
    if (evidence !== undefined && canonical === undefined) throw new Error(`${record.canonical_sense_id}: does not resolve to canonical curriculum evidence.`);
    if (canonical !== undefined) {
      if (canonical.lexicalId !== record.canonical_lexical_id) throw new Error(`${record.canonical_sense_id}: canonical lexical ID mismatch.`);
      if (canonical.firstChapter !== record.first_introduced_chapter) throw new Error(`${record.canonical_sense_id}: first chapter is not the earliest canonical introduction.`);
      for (const literal of record.literal_learner_facing_evidence) if (!canonical.learnerFacingText.includes(literal)) throw new Error(`${record.canonical_sense_id}: evidence is not learner-facing Dialogue or Narrative content.`);
    }
  }

  const morphemeIds = new Set<string>();
  const morphemeKeys = new Set<string>();
  for (const morpheme of lexicon.constituent_morphemes) {
    assertNfcStrings(morpheme, morpheme.morpheme_id);
    const key = `${morpheme.reading}\u0000${morpheme.character}`;
    if (morphemeIds.has(morpheme.morpheme_id) || morphemeKeys.has(key)) throw new Error(`Duplicate Sino-Vietnamese constituent morpheme: ${morpheme.morpheme_id}`);
    morphemeIds.add(morpheme.morpheme_id);
    morphemeKeys.add(key);
    if (!/^[\p{Script=Han}]$/u.test(morpheme.character) || morpheme.reading.trim() === "") throw new Error(`${morpheme.morpheme_id}: invalid reading or character.`);
    if (morpheme.lexical_sense_ids.length === 0 || new Set(morpheme.lexical_sense_ids).size !== morpheme.lexical_sense_ids.length) throw new Error(`${morpheme.morpheme_id}: lexical sense links must be unique and nonempty.`);
    for (const senseId of morpheme.lexical_sense_ids) if (!senseIds.has(senseId)) throw new Error(`${morpheme.morpheme_id}: unresolved lexical sense ${senseId}.`);
  }
  return { lexicalSenseCount: senseIds.size, constituentMorphemeCount: morphemeIds.size, chapterCount: chapters.size };
}

function assertNfcStrings(value: unknown, label: string): void {
  if (typeof value === "string") {
    if (value !== value.normalize("NFC")) throw new Error(`${label}: string is not NFC-normalized.`);
    return;
  }
  if (Array.isArray(value)) {
    for (const child of value) assertNfcStrings(child, label);
    return;
  }
  if (typeof value === "object" && value !== null) for (const child of Object.values(value)) assertNfcStrings(child, label);
}
