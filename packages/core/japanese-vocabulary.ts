export interface JapaneseVocabularyEntryValidationOptions {
  readonly expectedReading?: string;
  readonly context?: string;
}

export interface JapaneseVocabularyEntryValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
}

export interface JapaneseStructuredReviewItem {
  readonly cardId: string;
  readonly sourceChapter?: number;
  readonly promptLanguage: string;
  readonly answerLanguage: string;
  readonly prompt: string;
  readonly acceptedAnswers: readonly string[];
  readonly testedLexicalIds: readonly string[];
  readonly examples?: readonly string[];
  readonly provenance?: {
    readonly path: string;
    readonly locator: string;
    readonly evidence: string;
  };
}

export const japaneseContextualReadingIdentityPolicy = "japanese-contextual-reading-identity-policy";

export interface JapaneseContextualReadingOccurrence {
  readonly occurrenceId: string;
  readonly chapter: number;
  readonly sourcePath: string;
  readonly sourceLocator: string;
  readonly evidence: string;
  readonly surfaceForm: string;
  readonly contextualReading?: string;
}

export interface JapaneseContextualReadingEntry {
  readonly lexicalEntryId: string;
  readonly senseId: string;
  readonly writtenForm: string;
  readonly meaning: string;
  readonly partOfSpeech: string;
  readonly firstIntroductionChapter: number;
  readonly logicalEntryValues: readonly string[];
  readonly occurrences: readonly JapaneseContextualReadingOccurrence[];
}

export interface JapaneseContextualReadingDocument {
  readonly schemaVersion: 1;
  readonly policy: typeof japaneseContextualReadingIdentityPolicy;
  readonly curriculumId: string;
  readonly auditedThroughChapter: number;
  readonly entries: readonly JapaneseContextualReadingEntry[];
}

const kanjiPattern = /\p{Script=Han}/u;
const katakanaPattern = /\p{Script=Katakana}/u;
const latinPattern = /\p{Script=Latin}/u;
const kanaSegmentPattern = /[\p{Script=Hiragana}\p{Script=Katakana}ー]+/gu;
const allowedReadingCharacterPattern = /[\p{Script=Hiragana}\p{Mark}\p{Punctuation}\sー]/u;
const formatCharacterPattern = /[\p{Punctuation}\s]/u;

export function japaneseExpressionContainsKanji(expression: string): boolean {
  return kanjiPattern.test(expression);
}

export function validateJapaneseVocabularyEntry(
  values: unknown,
  options: JapaneseVocabularyEntryValidationOptions = {}
): JapaneseVocabularyEntryValidationResult {
  const context = options.context ?? "Japanese vocabulary entry";
  const errors: string[] = [];
  if (!Array.isArray(values)) {
    return { valid: false, errors: [`${context} must be an array of values.`] };
  }
  if (values.length < 2) {
    return { valid: false, errors: [`${context} must contain an other-language value and a Japanese value.`] };
  }
  const [otherLanguageValue, japaneseValue, reading] = values;
  for (const [index, value] of values.entries()) {
    if (typeof value !== "string" || value.trim().length === 0) {
      errors.push(`${context} value ${index + 1} must be a nonempty string.`);
    } else if (value !== value.normalize("NFC")) {
      errors.push(`${context} value ${index + 1} must be NFC-normalized.`);
    }
  }
  if (typeof otherLanguageValue !== "string" || typeof japaneseValue !== "string") {
    return { valid: errors.length === 0, errors };
  }

  const containsKanji = japaneseExpressionContainsKanji(japaneseValue);
  const requiredWidth = containsKanji ? 3 : 2;
  if (values.length !== requiredWidth) {
    errors.push(`${context} must contain exactly ${requiredWidth} values because the Japanese expression ${containsKanji ? "contains" : "does not contain"} kanji.`);
  }
  if (!containsKanji || typeof reading !== "string" || reading.length === 0) {
    return { valid: errors.length === 0, errors };
  }

  if (kanjiPattern.test(reading)) errors.push(`${context} reading must not contain kanji.`);
  if (latinPattern.test(reading)) errors.push(`${context} reading must not contain romaji.`);
  if (katakanaPattern.test(reading)) errors.push(`${context} reading must not contain ordinary katakana letters.`);
  const unsupported = [...reading].filter((character) => !allowedReadingCharacterPattern.test(character));
  if (unsupported.length > 0) errors.push(`${context} reading contains unsupported non-hiragana characters: ${[...new Set(unsupported)].join("")}.`);

  const writtenFormatting = [...japaneseValue].filter((character) => formatCharacterPattern.test(character)).join("");
  const readingFormatting = [...reading].filter((character) => formatCharacterPattern.test(character)).join("");
  if (writtenFormatting !== readingFormatting) {
    errors.push(`${context} reading must preserve the Japanese expression's punctuation and spaces.`);
  }

  let searchFrom = 0;
  for (const match of japaneseValue.matchAll(kanaSegmentPattern)) {
    const segment = katakanaToHiragana(match[0]);
    const foundAt = reading.indexOf(segment, searchFrom);
    if (foundAt === -1) {
      errors.push(`${context} reading is incomplete: it must preserve the full kana segment ${segment}.`);
      break;
    }
    searchFrom = foundAt + segment.length;
  }
  const firstSegment = japaneseValue.match(new RegExp(`^${kanaSegmentPattern.source}`, "u"))?.[0];
  if (firstSegment !== undefined && !reading.startsWith(katakanaToHiragana(firstSegment))) {
    errors.push(`${context} reading is incomplete or out of order at the beginning of the expression.`);
  }
  const finalSegment = japaneseValue.match(new RegExp(`${kanaSegmentPattern.source}$`, "u"))?.[0];
  if (finalSegment !== undefined && !reading.endsWith(katakanaToHiragana(finalSegment))) {
    errors.push(`${context} reading is incomplete or out of order at the end of the expression.`);
  }
  if (options.expectedReading !== undefined && reading !== options.expectedReading) {
    errors.push(`${context} reading must equal the complete lexical reading ${options.expectedReading}.`);
  }
  return { valid: errors.length === 0, errors };
}

export function assertValidJapaneseVocabularyEntry(
  values: unknown,
  options: JapaneseVocabularyEntryValidationOptions = {}
): void {
  const result = validateJapaneseVocabularyEntry(values, options);
  if (!result.valid) throw new Error(result.errors.join("\n"));
}

export function assertValidJapaneseStructuredReviewItems(
  items: readonly JapaneseStructuredReviewItem[],
  sourcePath: string,
  contextualReadings?: JapaneseContextualReadingDocument
): void {
  const byLexicalIdentity = new Map<string, JapaneseStructuredReviewItem[]>();
  for (const item of items) {
    const identity = item.testedLexicalIds.join("\0");
    if (identity.length === 0) throw new Error(`${sourcePath}: ${item.cardId} must identify its Japanese lexical entry.`);
    const grouped = byLexicalIdentity.get(identity) ?? [];
    grouped.push(item);
    byLexicalIdentity.set(identity, grouped);
  }

  const entriesByIdentity = contextualReadings === undefined
    ? undefined
    : validateJapaneseContextualReadingDocument(contextualReadings, sourcePath);
  const writtenCounts = contextualReadings === undefined
    ? new Map<string, number>()
    : countBy(contextualReadings.entries.map((entry) => entry.writtenForm));
  for (const [identity, grouped] of byLexicalIdentity) {
    const sourceToTarget = exactlyOne(grouped.filter((item) =>
      item.answerLanguage === "ja" && item.promptLanguage !== "ja" && item.promptLanguage !== "ja-Kana"
    ), sourcePath, "meaning-to-Japanese");
    const targetToSource = exactlyOne(grouped.filter((item) =>
      item.promptLanguage === "ja" && item.answerLanguage !== "ja"
    ), sourcePath, "Japanese-to-meaning");
    const readingToTarget = atMostOne(grouped.filter((item) =>
      item.promptLanguage === "ja-Kana" && item.answerLanguage === "ja"
    ), sourcePath, "reading-to-Japanese");
    if (grouped.length !== 2 + (readingToTarget === undefined ? 0 : 1)) {
      throw new Error(`${sourcePath}: ${sourceToTarget.cardId} has an unsupported Japanese review direction.`);
    }

    const sourceFields = parseSingleStructuredAnswer(sourceToTarget, sourcePath);
    const targetFields = parseSingleStructuredAnswer(targetToSource, sourcePath);
    const contextualEntry = entriesByIdentity?.get(identity);
    const written = parseJapaneseToMeaningPrompt(targetToSource.prompt, contextualEntry, writtenCounts, sourcePath, targetToSource.cardId);
    const meaning = sourceToTarget.prompt;
    const containsKanji = japaneseExpressionContainsKanji(written);
    const reading = containsKanji ? sourceFields.get("Reading") : undefined;
    const expectedSourceLabels = containsKanji ? ["Reading", "Japanese"] : ["Japanese"];
    const expectedTargetLabels = containsKanji ? ["Meaning", "Reading"] : ["Meaning"];
    assertExactLabels(sourceFields, expectedSourceLabels, sourcePath, sourceToTarget.cardId);
    assertExactLabels(targetFields, expectedTargetLabels, sourcePath, targetToSource.cardId);
    if (sourceFields.get("Japanese") !== written) {
      throw new Error(`${sourcePath}: ${sourceToTarget.cardId} Japanese value must match ${targetToSource.cardId}'s written-form prompt.`);
    }
    if (targetFields.get("Meaning") !== meaning) {
      throw new Error(`${sourcePath}: ${targetToSource.cardId} meaning must match ${sourceToTarget.cardId}'s other-language prompt.`);
    }
    if (containsKanji && targetFields.get("Reading") !== reading) {
      throw new Error(`${sourcePath}: ${targetToSource.cardId} must use the same complete lexical reading as ${sourceToTarget.cardId}.`);
    }

    if (readingToTarget !== undefined) {
      const readingFields = parseSingleStructuredAnswer(readingToTarget, sourcePath);
      assertExactLabels(readingFields, ["Meaning", "Japanese"], sourcePath, readingToTarget.cardId);
      if (readingFields.get("Meaning") !== meaning || readingFields.get("Japanese") !== written) {
        throw new Error(`${sourcePath}: ${readingToTarget.cardId} must match the same meaning and Japanese expression as its A/C cards.`);
      }
      const expectedPrompt = reading ?? written;
      if (readingToTarget.prompt !== expectedPrompt) {
        throw new Error(`${sourcePath}: ${readingToTarget.cardId} must prompt with ${containsKanji ? "the complete lexical hiragana reading" : "the kana-only Japanese expression without a separate reading value"}.`);
      }
      if (japaneseMoraCount(readingToTarget.prompt) < 2) {
        throw new Error(`${sourcePath}: ${readingToTarget.cardId} violates the two-or-more-mora B-card distinctiveness rule.`);
      }
    }

    if (readingToTarget === undefined && japaneseMoraCount(reading ?? written) >= 2) {
      throw new Error(`${sourcePath}: ${sourceToTarget.cardId} requires one reading-to-Japanese B card because its prompt has two or more mora.`);
    }

    const values = containsKanji ? [meaning, written, reading] : [meaning, written];
    assertValidJapaneseVocabularyEntry(values, {
      expectedReading: readingToTarget?.prompt,
      context: `${sourcePath}: ${sourceToTarget.cardId}`
    });
    if (contextualEntry !== undefined) {
      assertReviewGroupMatchesContextualEntry(grouped, contextualEntry, written, reading, sourcePath);
    }
  }
  if (contextualReadings !== undefined) {
    const expected = new Set(contextualReadings.entries.map((entry) => `${entry.lexicalEntryId}\0${entry.senseId}`));
    const actual = new Set(byLexicalIdentity.keys());
    for (const identity of expected) if (!actual.has(identity)) throw new Error(`${sourcePath}: canonical Japanese reading identity ${identity.replace("\0", " / ")} has no Review entry.`);
    for (const identity of actual) if (!expected.has(identity)) throw new Error(`${sourcePath}: stale or orphaned Japanese Review identity ${identity.replace("\0", " / ")}.`);
  }
}

export function validateJapaneseContextualReadingDocument(
  document: JapaneseContextualReadingDocument,
  sourcePath = "japanese-contextual-readings.json"
): ReadonlyMap<string, JapaneseContextualReadingEntry> {
  if (document.schemaVersion !== 1 || document.policy !== japaneseContextualReadingIdentityPolicy) {
    throw new Error(`${sourcePath}: schemaVersion 1 and policy ${japaneseContextualReadingIdentityPolicy} are required.`);
  }
  if (!Number.isSafeInteger(document.auditedThroughChapter) || document.auditedThroughChapter < 1 || !Array.isArray(document.entries)) {
    throw new Error(`${sourcePath}: auditedThroughChapter and entries are required.`);
  }
  const byIdentity = new Map<string, JapaneseContextualReadingEntry>();
  const occurrenceIds = new Set<string>();
  const identityByLexicalEntry = new Map<string, string>();
  const identityByWrittenReadingSense = new Map<string, string>();
  for (const [index, entry] of document.entries.entries()) {
    const where = `${sourcePath}: entries[${index}] ${entry.lexicalEntryId} / ${entry.senseId}`;
    const identity = `${entry.lexicalEntryId}\0${entry.senseId}`;
    if (byIdentity.has(identity)) throw new Error(`${where}: duplicate lexical/sense identity.`);
    if (!entry.senseId.startsWith(`${entry.lexicalEntryId}.`)) throw new Error(`${where}: sense ID must be owned by its lexical entry ID.`);
    if (!Number.isSafeInteger(entry.firstIntroductionChapter) || entry.firstIntroductionChapter < 1 || entry.firstIntroductionChapter > document.auditedThroughChapter) {
      throw new Error(`${where}: invalid first-introduction chapter ${entry.firstIntroductionChapter}.`);
    }
    const result = validateJapaneseVocabularyEntry(entry.logicalEntryValues, { context: where });
    if (!result.valid) throw new Error(result.errors.join("\n"));
    if (entry.logicalEntryValues[0] !== entry.meaning || entry.logicalEntryValues[1] !== entry.writtenForm) {
      throw new Error(`${where}: logical entry values must store the exact meaning and written form.`);
    }
    if (!Array.isArray(entry.occurrences) || entry.occurrences.length === 0) throw new Error(`${where}: at least one primary-reading occurrence is required.`);
    const reading = entry.logicalEntryValues[2];
    const lexicalReading = identityByLexicalEntry.get(entry.lexicalEntryId);
    if (lexicalReading !== undefined && lexicalReading !== (reading ?? "")) throw new Error(`${where}: one lexical entry ID spans several contextual readings.`);
    identityByLexicalEntry.set(entry.lexicalEntryId, reading ?? "");
    const duplicateKey = `${entry.writtenForm}\0${reading ?? ""}\0${entry.meaning}\0${entry.partOfSpeech}`;
    const duplicateIdentity = identityByWrittenReadingSense.get(duplicateKey);
    if (duplicateIdentity !== undefined && duplicateIdentity !== identity) throw new Error(`${where}: duplicate written-form and reading identity already belongs to ${duplicateIdentity.replace("\0", " / ")}.`);
    identityByWrittenReadingSense.set(duplicateKey, identity);
    let first = Number.POSITIVE_INFINITY;
    for (const occurrence of entry.occurrences) {
      const occurrenceWhere = `${where}: occurrence ${occurrence.occurrenceId}`;
      if (occurrenceIds.has(occurrence.occurrenceId)) throw new Error(`${occurrenceWhere}: duplicate occurrence ID.`);
      occurrenceIds.add(occurrence.occurrenceId);
      if (!Number.isSafeInteger(occurrence.chapter) || occurrence.chapter < 1 || occurrence.chapter > document.auditedThroughChapter) throw new Error(`${occurrenceWhere}: invalid chapter.`);
      first = Math.min(first, occurrence.chapter);
      if (!occurrence.evidence.includes(occurrence.surfaceForm)) throw new Error(`${occurrenceWhere}: surface form is absent from the literal evidence.`);
      const occurrenceContainsKanji = japaneseExpressionContainsKanji(occurrence.surfaceForm);
      if (occurrenceContainsKanji) {
        const occurrenceResult = validateJapaneseVocabularyEntry([entry.meaning, occurrence.surfaceForm, occurrence.contextualReading], { context: occurrenceWhere });
        if (!occurrenceResult.valid) throw new Error(occurrenceResult.errors.join("\n"));
      } else if (occurrence.contextualReading !== undefined) {
        throw new Error(`${occurrenceWhere}: kana-only occurrence must not store a redundant contextual reading.`);
      }
      if (occurrence.surfaceForm === entry.writtenForm && occurrence.contextualReading !== reading) throw new Error(`${occurrenceWhere}: exact written-form occurrence must use canonical reading ${reading}.`);
    }
    if (first !== entry.firstIntroductionChapter) throw new Error(`${where}: firstIntroductionChapter ${entry.firstIntroductionChapter} disagrees with earliest occurrence chapter ${first}.`);
    byIdentity.set(identity, entry);
  }
  return byIdentity;
}

function assertReviewGroupMatchesContextualEntry(
  items: readonly JapaneseStructuredReviewItem[],
  entry: JapaneseContextualReadingEntry,
  written: string,
  reading: string | undefined,
  sourcePath: string
): void {
  const where = `${sourcePath}: ${entry.lexicalEntryId} / ${entry.senseId}`;
  if (written !== entry.writtenForm || reading !== entry.logicalEntryValues[2]) throw new Error(`${where}: Review written form/reading ${written} / ${reading ?? "(none)"} disagrees with canonical contextual identity ${entry.writtenForm} / ${entry.logicalEntryValues[2] ?? "(none)"}.`);
  const identitySlug = entry.senseId.replaceAll(".", "-");
  for (const item of items) {
    const directionSlug = item.promptLanguage === "ja-Kana"
      ? "b-reading-to-japanese"
      : item.promptLanguage === "ja"
        ? "c-japanese-to-english"
        : "a-english-to-japanese";
    if (!item.cardId.endsWith(`/${identitySlug}/${directionSlug}`)) throw new Error(`${where}: Review card ID ${item.cardId} is not the deterministic reading-aware ID for ${directionSlug}.`);
    if (item.sourceChapter !== undefined && item.sourceChapter !== entry.firstIntroductionChapter) throw new Error(`${where}: Review card ${item.cardId} has source chapter ${item.sourceChapter}, expected true first introduction ${entry.firstIntroductionChapter}.`);
    const examples = item.examples ?? [];
    if (examples.length < 1 || examples.length > 3) throw new Error(`${where}: Review card ${item.cardId} must have one to three exact examples.`);
    for (const example of examples) {
      if (!entry.occurrences.some((occurrence) => occurrence.evidence === example)) throw new Error(`${where}: Review card ${item.cardId} example does not map to an occurrence with the same reading identity: ${example}`);
    }
    if (item.provenance !== undefined && !entry.occurrences.some((occurrence) => occurrence.sourcePath === item.provenance?.path
      && occurrence.sourceLocator === item.provenance.locator && occurrence.evidence === item.provenance.evidence)) {
      throw new Error(`${where}: Review card ${item.cardId} has stale or unresolved provenance ${item.provenance.path} @ ${item.provenance.locator}.`);
    }
  }
}

function parseJapaneseToMeaningPrompt(
  prompt: string,
  entry: JapaneseContextualReadingEntry | undefined,
  writtenCounts: ReadonlyMap<string, number>,
  sourcePath: string,
  cardId: string
): string {
  if (entry === undefined || (writtenCounts.get(entry.writtenForm) ?? 0) < 2) return prompt;
  const match = prompt.match(/^Japanese: (.+); Context: (.+)$/u);
  if (match === null || match[1] !== entry.writtenForm || !entry.occurrences.some((occurrence) => occurrence.evidence === match[2])) {
    throw new Error(`${sourcePath}: ${cardId} is an ambiguous C card and requires the deterministic Japanese/Context discriminator from its own literal occurrence.`);
  }
  return match[1];
}

function countBy(values: readonly string[]): ReadonlyMap<string, number> {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return counts;
}

export function japaneseMoraCount(value: string): number {
  return [...value.normalize("NFC")].filter((character) => !/[ゃゅょぁぃぅぇぉゎ\p{Mark}\p{Punctuation}\s]/u.test(character)).length;
}

function parseSingleStructuredAnswer(
  item: JapaneseStructuredReviewItem,
  sourcePath: string
): ReadonlyMap<string, string> {
  if (item.acceptedAnswers.length !== 1) {
    throw new Error(`${sourcePath}: ${item.cardId} must encode exactly one structured Japanese answer.`);
  }
  const answer = item.acceptedAnswers[0] ?? "";
  const marker = /(?:^|; )(Meaning|Reading|Japanese): /gu;
  const matches = [...answer.matchAll(marker)];
  if (matches.length === 0 || matches[0]?.index !== 0) {
    throw new Error(`${sourcePath}: ${item.cardId} has a malformed structured Japanese answer.`);
  }
  const fields = new Map<string, string>();
  for (const [index, match] of matches.entries()) {
    const label = match[1] ?? "";
    const valueStart = (match.index ?? 0) + match[0].length;
    const valueEnd = matches[index + 1]?.index ?? answer.length;
    const value = answer.slice(valueStart, valueEnd);
    if (fields.has(label) || value.trim().length === 0) {
      throw new Error(`${sourcePath}: ${item.cardId} has a duplicated or empty ${label || "structured"} value.`);
    }
    fields.set(label, value);
  }
  return fields;
}

function assertExactLabels(
  fields: ReadonlyMap<string, string>,
  expected: readonly string[],
  sourcePath: string,
  cardId: string
): void {
  if ([...fields.keys()].join("\0") !== expected.join("\0")) {
    throw new Error(`${sourcePath}: ${cardId} must contain exactly the structured values ${expected.join(", ")}.`);
  }
}

function exactlyOne(
  items: readonly JapaneseStructuredReviewItem[],
  sourcePath: string,
  direction: string
): JapaneseStructuredReviewItem {
  if (items.length !== 1) throw new Error(`${sourcePath}: each Japanese lexical entry must have exactly one ${direction} card.`);
  return items[0] as JapaneseStructuredReviewItem;
}

function atMostOne(
  items: readonly JapaneseStructuredReviewItem[],
  sourcePath: string,
  direction: string
): JapaneseStructuredReviewItem | undefined {
  if (items.length > 1) throw new Error(`${sourcePath}: each Japanese lexical entry may have at most one ${direction} card.`);
  return items[0];
}

function katakanaToHiragana(value: string): string {
  return [...value].map((character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return codePoint >= 0x30a1 && codePoint <= 0x30f6
      ? String.fromCodePoint(codePoint - 0x60)
      : character;
  }).join("");
}
