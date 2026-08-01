import { unicodeTerminalDisplayWidth } from "./unicode-display-width";

export type CurriculumDisplayMode = "normal" | "expert" | "developer";
export type CurriculumContentRole = "reading" | "grammar-easy" | "grammar-hard";

export interface CurriculumProjectionOptions {
  readonly contentRole?: CurriculumContentRole;
  readonly translationsEnabled?: boolean;
  readonly notesEnabled?: boolean;
}

export interface ReadingAudienceSection {
  readonly sourceHeading: string;
  readonly normalHeading?: string | null;
  readonly expertHeading?: string;
  readonly normal: string;
  readonly expert: string;
}

export interface ReadingSupport {
  readonly schemaVersion: 1;
  readonly semanticRoleSyntaxVersion?: 1;
  readonly sourcePath: "chapter.md";
  readonly audienceSections: readonly ReadingAudienceSection[];
  readonly breakdown?: { readonly normal: string; readonly expert: string };
  readonly characters?: { readonly heading: string; readonly normal: string; readonly expert: string };
}

export interface StructuredReadingTranslation {
  readonly schemaVersion: 1;
  readonly id: string;
  readonly language: "en";
  readonly sourceLanguage: string;
  readonly sourcePath: "chapter.md";
  readonly sourceSection: string;
  readonly readingType: "dialogue" | "narrative";
  readonly turns?: readonly { readonly speaker: string; readonly text: string }[];
  readonly sentences?: readonly string[];
  readonly paragraphs?: readonly string[];
}

export interface ReadingChapterProjectionOptions {
  readonly mode?: CurriculumDisplayMode;
  readonly translationsEnabled?: boolean;
  readonly charactersEnabled?: boolean;
  readonly breakdownEnabled?: boolean;
  readonly notesEnabled?: boolean;
  readonly support?: ReadingSupport;
  readonly translation?: StructuredReadingTranslation;
}

export const defaultCurriculumDisplayMode: CurriculumDisplayMode = "normal";
export const developerOnlyStartMarker = "<!-- whacksmacker:developer-only:start -->";
export const developerOnlyEndMarker = "<!-- whacksmacker:developer-only:end -->";

/**
 * Projects one audience-specific support section into rendered chapter Markdown.
 * This helper deliberately knows nothing about readable-content discovery or
 * navigation nodes: audience headings are right-pane content only.
 */
export function projectReadingAudienceSection(
  section: ReadingAudienceSection,
  mode: CurriculumDisplayMode = defaultCurriculumDisplayMode
): string {
  const grammarSection = section.sourceHeading === "New Grammar" || section.sourceHeading === "New Grammar / Pattern";
  if (mode === "developer") {
    return grammarSection
      ? `### Grammar\n\n#### Normal\n\n${section.normal}\n\n#### Expert\n\n${section.expert}`
      : `### ${section.sourceHeading}: Normal\n\n${section.normal}\n\n### ${section.sourceHeading}: Expert\n\n${section.expert}`;
  }
  const content = mode === "expert" ? section.expert : section.normal;
  const audienceHeading = mode === "expert"
    ? section.expertHeading ?? section.sourceHeading
    : section.normalHeading === undefined
      ? section.sourceHeading
      : section.normalHeading;
  if (audienceHeading === null) return content;
  return `### ${grammarSection ? "Grammar" : audienceHeading}\n\n${content}`;
}

/**
 * Applies the same additive learner-support projection for every Reader
 * surface. The primary chapter remains authoritative; sidecars can replace
 * only their named support sections and can never replace the reading body.
 */
export function projectReadingChapterMarkdown(
  markdown: string,
  options: ReadingChapterProjectionOptions = {}
): string {
  const mode = options.mode ?? defaultCurriculumDisplayMode;
  let output = markdown;
  if (options.charactersEnabled !== true) {
    output = removeNamedSectionFromMarkdown(output, "Sino-Vietnamese Vocabulary");
    output = removeNamedSectionFromMarkdown(output, "Sino-Korean Vocabulary");
    output = removeNamedSectionFromMarkdown(output, "Hanja");
    output = removeNamedSectionFromMarkdown(output, "Character Notes");
  }
  if (options.support !== undefined) {
    output = applyReadingSupport(output, options.support, {
      mode,
      charactersEnabled: options.charactersEnabled === true,
      breakdownEnabled: options.breakdownEnabled === true
    });
  } else if (options.breakdownEnabled === true) {
    output = insertBeforeExercises(output, "### Line-by-line Breakdown\n\nBreakdown unavailable for this chapter.\n");
  }
  let translationAvailable = hasNaturalEnglishTranslation(output);
  if (options.translationsEnabled === true && options.translation !== undefined) {
    output = insertStructuredReadingTranslation(output, options.translation);
    translationAvailable = true;
  }
  if (options.translationsEnabled === true) {
    output = addSpeakerLabelsToEmbeddedDialogueTranslation(output);
    if (!translationAvailable) {
      output = `${output.trimEnd()}\n\n### Natural English Translation\n\nTranslation unavailable for this chapter.\n`;
    }
  }
  return projectCurriculumMarkdown(output, mode, {
    contentRole: "reading",
    translationsEnabled: options.translationsEnabled === true,
    notesEnabled: options.notesEnabled !== false
  });
}

export function parseReadingSupport(text: string): ReadingSupport | undefined {
  try {
    const value = JSON.parse(text) as ReadingSupport;
    if (value.schemaVersion !== 1 || value.sourcePath !== "chapter.md" || !Array.isArray(value.audienceSections)) return undefined;
    if (value.semanticRoleSyntaxVersion !== undefined && value.semanticRoleSyntaxVersion !== 1) return undefined;
    if (!value.audienceSections.every((section) => typeof section.sourceHeading === "string"
      && (section.normalHeading === undefined || section.normalHeading === null || typeof section.normalHeading === "string")
      && (section.expertHeading === undefined || typeof section.expertHeading === "string")
      && typeof section.normal === "string"
      && typeof section.expert === "string")) return undefined;
    return value;
  } catch {
    return undefined;
  }
}

export function parseStructuredReadingTranslation(text: string): StructuredReadingTranslation | undefined {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return undefined;
  }
  if (!isObjectRecord(value)
    || value.schemaVersion !== 1
    || typeof value.id !== "string"
    || value.id.trim().length === 0
    || value.language !== "en"
    || typeof value.sourceLanguage !== "string"
    || value.sourceLanguage.trim().length === 0
    || value.sourcePath !== "chapter.md"
    || typeof value.sourceSection !== "string"
    || value.sourceSection.trim().length === 0
    || (value.readingType !== "dialogue" && value.readingType !== "narrative")
    || ["introduction", "context", "setting", "participants", "sceneIntroduction"].some((key) => key in value)) {
    return undefined;
  }
  const dialogueIsValid = value.readingType === "dialogue"
    && Array.isArray(value.turns)
    && value.turns.length > 0
    && value.turns.every((turn) => isObjectRecord(turn)
      && typeof turn.speaker === "string"
      && turn.speaker.trim().length > 0
      && typeof turn.text === "string"
      && turn.text.trim().length > 0);
  const narrativeIsValid = value.readingType === "narrative"
    && ((Array.isArray(value.sentences)
      && value.sentences.length > 0
      && value.sentences.every((sentence) => typeof sentence === "string" && sentence.trim().length > 0))
      || (Array.isArray(value.paragraphs)
        && value.paragraphs.length > 0
        && value.paragraphs.every((paragraph) => typeof paragraph === "string" && paragraph.trim().length > 0)));
  return dialogueIsValid || narrativeIsValid ? value as unknown as StructuredReadingTranslation : undefined;
}

function applyReadingSupport(
  markdown: string,
  support: ReadingSupport,
  options: { readonly mode: CurriculumDisplayMode; readonly charactersEnabled: boolean; readonly breakdownEnabled: boolean }
): string {
  let output = markdown;
  const primarySetup = primaryReadingSetup(markdown);
  for (const section of support.audienceSections) {
    if (isPrimaryReadingHeading(section.sourceHeading)) continue;
    if (section.sourceHeading === "Brief Introduction"
      && primarySetup !== undefined
      && [section.normal, section.expert].some((value) => normalizedSetup(value).includes(normalizedSetup(primarySetup)))) continue;
    output = replaceNamedSection(output, section.sourceHeading, projectReadingAudienceSection(section, options.mode));
  }
  const embeddedBreakdown = markdownSectionBody(output, "Line-by-Line Breakdown")
    ?? markdownSectionBody(output, "Line-by-line Breakdown");
  output = removeNamedSectionFromMarkdown(output, "Line-by-Line Breakdown");
  output = removeNamedSectionFromMarkdown(output, "Line-by-line Breakdown");
  output = removeNamedSectionFromMarkdown(output, "Sino-Vietnamese Vocabulary");
  output = removeNamedSectionFromMarkdown(output, "Sino-Korean Vocabulary");
  output = removeNamedSectionFromMarkdown(output, "Hanja");
  output = removeNamedSectionFromMarkdown(output, "Character Notes");
  if (options.charactersEnabled && support.characters !== undefined) {
    const body = options.mode === "developer"
      ? `### ${support.characters.heading}\n\n#### Normal\n\n${support.characters.normal}\n\n#### Expert\n\n${support.characters.expert}`
      : `### ${support.characters.heading}\n\n${options.mode === "expert" ? support.characters.expert : support.characters.normal}`;
    output = insertAfterNamedSection(output, "New Vocabulary", body);
  }
  if (options.breakdownEnabled) {
    const body = support.breakdown === undefined
      ? embeddedBreakdown === undefined
        ? "### Line-by-line Breakdown\n\nBreakdown unavailable for this chapter."
        : `### Line-by-line Breakdown\n\n${embeddedBreakdown}`
      : options.mode === "developer"
        ? `### Line-by-line Breakdown: Normal\n\n${support.breakdown.normal}\n\n### Line-by-line Breakdown: Expert\n\n${support.breakdown.expert}`
        : `### Line-by-line Breakdown\n\n${options.mode === "expert" ? support.breakdown.expert : support.breakdown.normal}`;
    output = insertBeforeExercises(output, body);
  }
  return output;
}

function primaryReadingSetup(markdown: string): string | undefined {
  for (const heading of ["Dialogue", "Narrative"]) {
    const body = markdownSectionBody(markdown, heading);
    if (body === undefined) continue;
    return body.split(/\n\s*\n/u).find((part) => part.trim() !== "")?.trim();
  }
  return undefined;
}

function normalizedSetup(value: string): string {
  return value.normalize("NFKC").replace(/\s+/gu, " ").trim();
}

function isPrimaryReadingHeading(title: string): boolean {
  return /^(?:Dialogue|Narrative|Learner-facing (?:Dialogue|Narrative|Controlled Reading|Read Content)|Controlled Reading|Read Content|Model Dialogue|Model Mini Dialogue|Model Mini Text)$/iu.test(title.trim());
}

function markdownSectionBody(markdown: string, title: string): string | undefined {
  const range = markdownSectionRange(markdown, title);
  if (range === undefined) return undefined;
  const body = range.lines.slice(range.start + 1, range.end).join("\n").trim();
  return body.length === 0 ? undefined : body;
}

function markdownSectionRange(markdown: string, title: string): { readonly lines: string[]; readonly start: number; readonly end: number } | undefined {
  const lines = markdown.replace(/\r\n?/gu, "\n").split("\n");
  const escapedTitle = title.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  const start = lines.findIndex((line) => new RegExp(`^#{1,6}\\s+${escapedTitle}\\s*$`, "u").test(line.trim()));
  if (start < 0) return undefined;
  const level = /^(#{1,6})/u.exec(lines[start] ?? "")?.[1]?.length ?? 1;
  const next = lines.findIndex((line, index) => index > start && (() => {
    const nextLevel = /^(#{1,6})\s+/u.exec(line.trim())?.[1]?.length;
    return nextLevel !== undefined && (title === "Brief Introduction" || nextLevel <= level);
  })());
  return { lines, start, end: next < 0 ? lines.length : next };
}

function replaceNamedSection(markdown: string, title: string, replacement: string): string {
  const range = markdownSectionRange(markdown, title);
  return range === undefined ? markdown : [...range.lines.slice(0, range.start), ...replacement.split("\n"), ...range.lines.slice(range.end)].join("\n");
}

function removeNamedSectionFromMarkdown(markdown: string, title: string): string {
  const range = markdownSectionRange(markdown, title);
  return range === undefined ? markdown : [...range.lines.slice(0, range.start), ...range.lines.slice(range.end)].join("\n");
}

function insertAfterNamedSection(markdown: string, title: string, addition: string): string {
  const range = markdownSectionRange(markdown, title);
  if (range === undefined) return markdown;
  const developerOnlyStart = range.lines.findIndex((line, index) => index > range.start && index < range.end && line.trim() === developerOnlyStartMarker);
  const insertionIndex = developerOnlyStart < 0 ? range.end : developerOnlyStart;
  return [...range.lines.slice(0, insertionIndex), "", ...addition.split("\n"), ...range.lines.slice(insertionIndex)].join("\n");
}

function insertBeforeExercises(markdown: string, addition: string): string {
  const lines = markdown.replace(/\r\n?/gu, "\n").split("\n");
  const index = lines.findIndex((line) => /^##\s+Simple Exercises\s*$/iu.test(line.trim()));
  const at = index < 0 ? lines.length : index;
  return [...lines.slice(0, at), "", ...addition.split("\n"), "", ...lines.slice(at)].join("\n");
}

function insertStructuredReadingTranslation(markdown: string, translation: StructuredReadingTranslation): string {
  const lines = markdown.replace(/\r\n?/gu, "\n").split("\n");
  const escapedSourceSection = translation.sourceSection.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  const sourceHeading = new RegExp(`^#{2,3}\\s+${escapedSourceSection}$`, "u");
  const sourceHeadingIndex = lines.findIndex((line) => sourceHeading.test(line.trim()));
  if (sourceHeadingIndex < 0) return markdown;
  const nextSectionIndex = lines.findIndex((line, index) => index > sourceHeadingIndex && /^###\s+/u.test(line));
  if (nextSectionIndex < 0) return markdown;
  const translationBody = translation.readingType === "dialogue"
    ? formatStructuredTranslationTurns(translation.turns ?? [])
    : translation.sentences ?? translation.paragraphs ?? [];
  return [...lines.slice(0, nextSectionIndex), "### Natural English Translation", "", ...translationBody, "", ...lines.slice(nextSectionIndex)].join("\n");
}

function formatStructuredTranslationTurns(turns: readonly { readonly speaker: string; readonly text: string }[]): readonly string[] {
  const speakerWidth = Math.max(...turns.map((turn) => unicodeTerminalDisplayWidth(turn.speaker)));
  return turns.map((turn) => `${turn.speaker}${" ".repeat(Math.max(0, speakerWidth - unicodeTerminalDisplayWidth(turn.speaker)))}: ${turn.text}`);
}

function hasNaturalEnglishTranslation(markdown: string): boolean {
  return /^#{1,6}\s+(?:Natural English Translation|English translation)\s*$/imu.test(markdown);
}

function addSpeakerLabelsToEmbeddedDialogueTranslation(markdown: string): string {
  const lines = markdown.replace(/\r\n?/gu, "\n").split("\n");
  const dialogueHeading = lines.findIndex((line) => /^###\s+(?:Learner-facing )?Dialogue\s*$/iu.test(line.trim()));
  const translationHeading = lines.findIndex((line) => /^###\s+(?:Natural English Translation|English translation)\s*$/iu.test(line.trim()));
  if (dialogueHeading < 0 || translationHeading < 0 || translationHeading <= dialogueHeading) return markdown;
  const sourceEnd = lines.findIndex((line, index) => index > dialogueHeading && /^###\s+/u.test(line.trim()));
  const translationEnd = lines.findIndex((line, index) => index > translationHeading && /^###\s+/u.test(line.trim()));
  const sourceLines = lines.slice(dialogueHeading + 1, sourceEnd < 0 ? lines.length : sourceEnd)
    .map((line) => /^\s*(\S(?:.*?\S)?)\s*[:：]\s*\S/u.exec(line)?.[1])
    .filter((speaker): speaker is string => speaker !== undefined);
  const end = translationEnd < 0 ? lines.length : translationEnd;
  const translatedIndexes = lines.slice(translationHeading + 1, end)
    .map((line, offset) => ({ index: translationHeading + 1 + offset, line }))
    .filter(({ line }) => line.trim().length > 0 && !/^```/u.test(line.trim()));
  if (sourceLines.length === 0 || translatedIndexes.length !== sourceLines.length || translatedIndexes.some(({ line }) => isDialogueSpeakerLine(line))) return markdown;
  const speakerWidth = Math.max(...sourceLines.map(unicodeTerminalDisplayWidth));
  for (const [index, translated] of translatedIndexes.entries()) {
    const speaker = sourceLines[index] ?? "";
    lines[translated.index] = `${speaker}${" ".repeat(Math.max(0, speakerWidth - unicodeTerminalDisplayWidth(speaker)))}: ${translated.line.trim()}`;
  }
  return lines.join("\n");
}

function isDialogueSpeakerLine(line: string): boolean {
  return /^\s*\S(?:.*?\S)?\s*[:：]\s*\S/u.test(line);
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export interface NormalViewVoiceViolation {
  readonly line: number;
  readonly label: string;
  readonly text: string;
}

export function projectCurriculumMarkdown(
  text: string,
  mode: CurriculumDisplayMode = defaultCurriculumDisplayMode,
  options: CurriculumProjectionOptions = {}
): string {
  const normalized = text.replace(/\r\n?/gu, "\n");
  const grammarTitles = collectGrammarHumanTitles(normalized);
  const withoutContentWrapper = removeContentWrapperHeading(normalized);
  const withoutRereading = removeCompleteRereadingSection(withoutContentWrapper);
  const withoutHiddenTranslation = options.translationsEnabled === true
    ? withoutRereading
    : removeNaturalEnglishTranslationSection(withoutRereading);
  const withoutFrontmatter = mode === "developer" ? withoutHiddenTranslation : removeFrontmatter(withoutHiddenTranslation);
  const output: string[] = [];
  let developerOnlyDepth = 0;
  for (const line of withoutFrontmatter.split("\n")) {
    const marker = line.trim();
    if (marker === developerOnlyStartMarker) {
      developerOnlyDepth += 1;
      continue;
    }
    if (marker === developerOnlyEndMarker) {
      developerOnlyDepth = Math.max(0, developerOnlyDepth - 1);
      continue;
    }
    if (mode === "developer" || developerOnlyDepth === 0) output.push(line);
  }
  const projected = output.join("\n");
  const withoutGrammarIdentifiers = projectReadContentGrammarIdentifiers(projected, grammarTitles);
  const readerSafe = projectReadContentInternalFields(withoutGrammarIdentifiers, mode);
  const audienceVocabulary = mode === "developer" ? readerSafe : projectVocabularyNotes(readerSafe, mode);
  const withoutRawUsage = mode === "developer" ? audienceVocabulary : hideRawVocabularyUsage(audienceVocabulary);
  const notesProjected = options.notesEnabled === false ? hideNewVocabularyNoteColumn(withoutRawUsage) : withoutRawUsage;
  const grammarProjected = projectGrammarRole(notesProjected, mode, options.contentRole ?? "reading");
  return normalizeReadContentHeadingSpacing(collapseExcessBlankLines(simplifyReadingHeadings(grammarProjected)));
}

export function hideNewVocabularyNoteColumn(text: string): string {
  const output: string[] = [];
  const lines = text.split("\n");
  let vocabularyHeadingLevel: number | undefined;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    const heading = /^(#{1,6})\s+(.+)$/u.exec(line.trim());
    if (heading !== null) {
      const level = heading[1]?.length ?? 0;
      if (/^(?:New\s+)?Vocabulary\b/iu.test(heading[2] ?? "")) vocabularyHeadingLevel = level;
      else if (vocabularyHeadingLevel !== undefined && level <= vocabularyHeadingLevel) vocabularyHeadingLevel = undefined;
    }
    if (!isMarkdownTableRow(line.trim())) {
      output.push(line);
      continue;
    }
    const table: string[] = [line];
    while (index + 1 < lines.length && isMarkdownTableRow((lines[index + 1] ?? "").trim())) {
      index += 1;
      table.push(lines[index] ?? "");
    }
    output.push(...hideNoteColumn(table, vocabularyHeadingLevel !== undefined));
  }
  return output.join("\n");
}

function hideNoteColumn(lines: readonly string[], inVocabularySection: boolean): readonly string[] {
  if (!inVocabularySection) return lines;
  const rows = lines.map((line) => line.trim().slice(1, -1).split("|").map((cell) => cell.trim()));
  const header = rows.find((row) => !isMarkdownSeparatorRow(row)) ?? [];
  const noteColumn = header.findIndex((cell) => /^(?:note|notes)$/iu.test(cell));
  if (noteColumn < 0) return lines;
  return rows.map((row) => `| ${row.filter((_, column) => column !== noteColumn).join(" | ")} |`);
}

const internalIdentityLabels = new Set([
  "canonical identity",
  "canonical id",
  "canonicalidentity",
  "canonicalid",
  "lexical identity",
  "lexical id",
  "lexicalidentity",
  "lexicalid",
  "lexical entry id",
  "lexicalentryid",
  "entry id",
  "entryid",
  "sense identity",
  "sense id",
  "senseidentity",
  "senseid",
  "grammar identity",
  "grammar id",
  "grammar ids",
  "grammaridentity",
  "grammarid",
  "grammarids"
]);

const grammarIdentifierSource = "[A-Z][A-Z0-9]{1,15}-GRAMMAR-[0-9]+[A-Z0-9]*";

function collectGrammarHumanTitles(text: string): ReadonlyMap<string, string> {
  const titles = new Map<string, string>();
  const inventoryEntry = new RegExp(
    `grammarId\\s*:\\s*(${grammarIdentifierSource})\\s*,\\s*learnerFacingPattern\\s*:\\s*["']([^"']+)["']`,
    "gu"
  );
  for (const match of text.matchAll(inventoryEntry)) {
    const identifier = match[1];
    const title = match[2]?.trim();
    if (identifier !== undefined && title !== undefined && title.length > 0) titles.set(identifier, title);
  }
  const listedTitle = new RegExp(
    `^\\s*[-*]\\s+\\x60?(${grammarIdentifierSource})\\x60?\\s*(?:--|[—–:])\\s*(.+?)\\s*$`,
    "gmu"
  );
  for (const match of text.matchAll(listedTitle)) {
    const identifier = match[1];
    const title = match[2]?.replace(/^`|`$/gu, "").trim();
    if (identifier !== undefined && title !== undefined && title.length > 0 && !titles.has(identifier)) titles.set(identifier, title);
  }
  return titles;
}

function projectReadContentGrammarIdentifiers(text: string, titles: ReadonlyMap<string, string>): string {
  const exactIdentifier = new RegExp(`^\\x60?(${grammarIdentifierSource})\\x60?$`, "u");
  const identifierWithSeparator = new RegExp(`\\x60?${grammarIdentifierSource}\\x60?\\s*(?:--|[—–:])\\s*`, "gu");
  const anyIdentifier = new RegExp(`\\x60?${grammarIdentifierSource}\\x60?`, "gu");
  const grammarField = new RegExp(`^\\s*(?:grammar_id|grammarId)\\s*:\\s*["']?${grammarIdentifierSource}["']?\\s*,?\\s*$`, "u");
  const inlineGrammarField = new RegExp(`(?:grammar_id|grammarId)\\s*:\\s*["']?${grammarIdentifierSource}["']?\\s*,?\\s*`, "gu");
  const output: string[] = [];
  for (const line of text.split("\n")) {
    if (grammarField.test(line.trim())) continue;
    const heading = /^(#{1,6})\s+(.+?)\s*$/u.exec(line.trim());
    if (heading !== null) {
      const exact = exactIdentifier.exec(heading[2] ?? "");
      if (exact !== null) {
        const title = titles.get(exact[1] ?? "");
        if (title !== undefined) output.push(`${heading[1]} ${title}`);
        continue;
      }
    }
    const withoutFields = line.replace(inlineGrammarField, "");
    const projected = withoutFields
      .replace(identifierWithSeparator, "")
      .replace(anyIdentifier, "")
      .replace(/\{\s*,/gu, "{")
      .replace(/,\s*\}/gu, " }")
      .replace(/[ \t]+$/gu, "");
    if (/^\s*[-*]\s*$/u.test(projected)) continue;
    output.push(projected);
  }
  return output.join("\n");
}

function normalizedFieldLabel(value: string): string {
  return value
    .replace(/[`*_]/gu, "")
    .replace(/([a-z])([A-Z])/gu, "$1 $2")
    .replace(/[^\p{Letter}\p{Number}]+/gu, " ")
    .trim()
    .toLowerCase();
}

function projectReadContentInternalFields(text: string, mode: CurriculumDisplayMode): string {
  const lines = text.split("\n");
  const output: string[] = [];
  let charactersHeadingLevel: number | undefined;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    const heading = /^(#{1,6})\s+(.+)$/u.exec(line.trim());
    if (heading !== null) {
      const level = heading[1]?.length ?? 1;
      const title = heading[2]?.trim() ?? "";
      if (/^(?:Sino-Vietnamese Vocabulary|Sino-Korean Vocabulary|Hanja)$/iu.test(title)) charactersHeadingLevel = level;
      else if (charactersHeadingLevel !== undefined && level <= charactersHeadingLevel) charactersHeadingLevel = undefined;
    }
    if (isInternalIdentityFieldLine(line)) continue;
    if (!isMarkdownTableRow(line.trim())) {
      output.push(line);
      continue;
    }
    const table = [line];
    while (index + 1 < lines.length && isMarkdownTableRow((lines[index + 1] ?? "").trim())) {
      index += 1;
      table.push(lines[index] ?? "");
    }
    output.push(...projectReadContentTable(table, charactersHeadingLevel !== undefined, mode));
  }
  return output.join("\n");
}

function isInternalIdentityFieldLine(line: string): boolean {
  if (/(?:^|[,\[{]\s*)(?:canonicalIdentity|canonicalId|lexicalEntryId|entryId|senseId|grammarIdentity|grammarIds|grammarId|grammar_ids|grammar_id)\s*:/u.test(line)) return true;
  const field = /^\s*(?:[-*]\s+)?(?:[`*_]*)([\p{Letter}\p{Number}_ -]+?)(?:[`*_]*)\s*:\s*\S/u.exec(line);
  return field !== null && internalIdentityLabels.has(normalizedFieldLabel(field[1] ?? ""));
}

function projectReadContentTable(
  lines: readonly string[],
  inCharactersSection: boolean,
  mode: CurriculumDisplayMode
): readonly string[] {
  const rows = lines.map((line) => line.trim().slice(1, -1).split("|").map((cell) => cell.trim()));
  const headerIndex = rows.findIndex((row) => !isMarkdownSeparatorRow(row));
  if (headerIndex < 0) return lines;
  const header = rows[headerIndex] ?? [];
  const labels = header.map(normalizedFieldLabel);
  const visibleColumns = labels
    .map((label, column) => ({ label, column }))
    .filter(({ label }) => !internalIdentityLabels.has(label))
    .filter(({ label }) => !inCharactersSection || label !== "status")
    .map(({ column }) => column);
  const projected = rows.map((row) => visibleColumns.map((column) => row[column] ?? ""));
  if (inCharactersSection) {
    const projectedHeader = projected[headerIndex] ?? [];
    for (let column = 0; column < projectedHeader.length; column += 1) {
      const label = normalizedFieldLabel(projectedHeader[column] ?? "");
      if (/^(?:vietnamese|vietnamese word|korean|korean word|word)$/u.test(label)) projectedHeader[column] = "Word";
      else if (/^(?:characters|hanja|hanja form)$/u.test(label)) projectedHeader[column] = "Characters";
      else if (/^(?:english|meaning|meaning in this usage)$/u.test(label)) projectedHeader[column] = "Meaning";
      else if (mode !== "developer" && /^(?:evidence|note|usage)$/u.test(label)) projectedHeader[column] = "Usage";
    }
  }
  return projected.map((row) => `| ${row.join(" | ")} |`);
}

export function normalizeReadContentHeadingSpacing(text: string): string {
  const source = text.replace(/\r\n?/gu, "\n").split("\n");
  const output: string[] = [];
  let inCodeFence = false;
  const isCleanBlank = (line: string): boolean => line.replace(/\x1b\[[0-9;]*m/gu, "").trim().length === 0;
  for (let index = 0; index < source.length; index += 1) {
    const line = source[index] ?? "";
    if (/^\s*```/u.test(line)) {
      inCodeFence = !inCodeFence;
      output.push(line);
      continue;
    }
    if (!inCodeFence && /^#{1,6}\s+\S/u.test(line.trim())) {
      while (output.length > 0 && isCleanBlank(output[output.length - 1] ?? "")) output.pop();
      output.push("", line.trimEnd(), "");
      while (index + 1 < source.length && isCleanBlank(source[index + 1] ?? "")) index += 1;
      continue;
    }
    output.push(isCleanBlank(line) ? "" : line);
  }
  return output.join("\n");
}

export function removeContentWrapperHeading(text: string): string {
  return text
    .split("\n")
    .filter((line) => !/^#{1,6}\s+Content\s*$/iu.test(line.trim()))
    .join("\n");
}

function simplifyReadingHeadings(text: string): string {
  return canonicalizeGrammarHeadings(text
    .replace(/^(#{1,6})\s+Learner-facing Dialogue\s*$/gimu, "$1 Dialogue")
    .replace(/^(#{1,6})\s+Learner-facing (?:Narrative|Controlled Reading|Read Content)\s*$/gimu, "$1 Narrative"));
}

function canonicalizeGrammarHeadings(text: string): string {
  const output: string[] = [];
  let containingGrammarLevel: number | undefined;
  for (const line of text.split("\n")) {
    const heading = /^(#{1,6})\s+(.+?)\s*$/u.exec(line.trim());
    if (heading !== null) {
      const level = heading[1]?.length ?? 1;
      const title = heading[2] ?? "";
      if (containingGrammarLevel !== undefined && level <= containingGrammarLevel) containingGrammarLevel = undefined;
      if (/^Grammar(?:(?:\s*[-:]\s*|\s+)(?:Easy|Hard|Normal|Expert)|\s+(?:Point|Points|Section))?$/iu.test(title)) {
        if (containingGrammarLevel !== undefined && level > containingGrammarLevel) continue;
        containingGrammarLevel = level;
        output.push(`${heading[1]} Grammar`);
        continue;
      }
    }
    output.push(line);
  }
  return output.join("\n");
}

export function removeCompleteRereadingSection(text: string): string {
  return removeNamedMarkdownSection(text.replace(/\r\n?/gu, "\n"), /^Complete Rereading$/iu);
}

function removeNaturalEnglishTranslationSection(text: string): string {
  return removeNamedMarkdownSection(text, /^(?:Natural English Translation|English translation)$/iu);
}

function removeNamedMarkdownSection(text: string, titlePattern: RegExp): string {
  const lines = text.split("\n");
  const output: string[] = [];
  let removedLevel: number | undefined;
  for (const line of lines) {
    const heading = /^(#{1,6})\s+(.+?)\s*$/u.exec(line.trim());
    if (removedLevel !== undefined) {
      if (heading === null || (heading[1]?.length ?? 0) > removedLevel) continue;
      removedLevel = undefined;
    }
    if (heading !== null && titlePattern.test(heading[2] ?? "")) {
      removedLevel = heading[1]?.length ?? 1;
      continue;
    }
    output.push(line);
  }
  return output.join("\n");
}

function projectGrammarRole(text: string, mode: CurriculumDisplayMode, role: CurriculumContentRole): string {
  if (role === "reading") return text;
  if ((role === "grammar-easy" && mode === "expert") || (role === "grammar-hard" && mode === "normal")) return "";
  const modeLabel = mode === "developer" ? role === "grammar-easy" ? "\n\n## Normal" : "\n\n## Expert" : "";
  return text.replace(/^#\s+Grammar\s*-\s*(?:Easy|Hard)\s*$/imu, `# Grammar${modeLabel}`);
}

export function combineDeveloperGrammarMarkdown(normal: string, expert: string): string {
  const normalProjection = projectCurriculumMarkdown(normal, "developer", { contentRole: "grammar-easy" });
  const expertProjection = projectCurriculumMarkdown(expert, "developer", { contentRole: "grammar-hard" });
  return collapseExcessBlankLines([
    "# Grammar",
    removeTopLevelGrammarHeading(normalProjection),
    removeTopLevelGrammarHeading(expertProjection)
  ].filter((part) => part.trim().length > 0).join("\n\n"));
}

function removeTopLevelGrammarHeading(text: string): string {
  return text.replace(/^#\s+Grammar\s*$/imu, "").trim();
}

export function projectReviewTextForMode(text: string, mode: CurriculumDisplayMode): string {
  if (mode !== "normal") return text;
  const projected = text.replace(
    /\s*(?:[;,—–-]\s*)?\bin the (?:taught frame|attested frame|licensed construction)\b[.!?;,]*\s*$/iu,
    ""
  ).trimEnd();
  return projected === text.trimEnd() ? projected : projected.replace(/\s*\/\s*/gu, "; ");
}

function projectVocabularyNotes(text: string, mode: Exclude<CurriculumDisplayMode, "developer">): string {
  const output: string[] = [];
  const lines = text.split("\n");
  let vocabularyHeadingLevel: number | undefined;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    const heading = /^(#{1,6})\s+(.+)$/u.exec(line.trim());
    if (heading !== null) {
      const level = heading[1]?.length ?? 0;
      if (/^(?:New\s+)?Vocabulary\b/iu.test(heading[2] ?? "")) vocabularyHeadingLevel = level;
      else if (vocabularyHeadingLevel !== undefined && level <= vocabularyHeadingLevel) vocabularyHeadingLevel = undefined;
    }
    if (!isMarkdownTableRow(line.trim())) {
      output.push(line);
      continue;
    }
    const table: string[] = [line];
    while (index + 1 < lines.length && isMarkdownTableRow((lines[index + 1] ?? "").trim())) {
      index += 1;
      table.push(lines[index] ?? "");
    }
    output.push(...projectVocabularyTableNotes(table, vocabularyHeadingLevel !== undefined, mode));
  }
  return output.join("\n");
}

function projectVocabularyTableNotes(
  lines: readonly string[],
  inVocabularySection: boolean,
  mode: Exclude<CurriculumDisplayMode, "developer">
): readonly string[] {
  const rows = lines.map((line) => line.trim().slice(1, -1).split("|").map((cell) => cell.trim()));
  const header = rows.find((row) => !isMarkdownSeparatorRow(row)) ?? [];
  const labels = header.map((cell) => cell.toLowerCase());
  const noteColumn = labels.findIndex((label) => label === "notes" || label === "note");
  const usageColumn = labels.indexOf("usage");
  const vocabularyTable = inVocabularySection || noteColumn >= 0
    && labels.some((label) => label === "meaning" || label === "english" || label.includes("meaning in this usage"));
  if (!vocabularyTable || noteColumn < 0) return lines;
  return rows.map((row) => {
    if (isMarkdownSeparatorRow(row) || row === header) return `| ${row.join(" | ")} |`;
    const projected = [...row];
    projected[noteColumn] = mode === "normal"
      ? normalVocabularyNote(projected[noteColumn] ?? "")
      : expertVocabularyNote(projected[noteColumn] ?? "", usageColumn < 0 ? "" : projected[usageColumn] ?? "");
    return `| ${projected.join(" | ")} |`;
  });
}

function normalVocabularyNote(note: string): string {
  const normalized = note.trim();
  if (/^Verb\s*\(copula\)$/iu.test(normalized)) return "Verb";
  return note;
}

function expertVocabularyNote(note: string, usage: string): string {
  const normalized = note.trim();
  const evidence = `${normalized} ${usage}`.toLowerCase();
  if (/^Verb\s*\(copula\)$/iu.test(normalized)) return "Copular verb";
  if (/^Verb$/iu.test(normalized) && /\bexistential(?:-presentational)?\b/u.test(evidence)) return "Existential verb";
  if (/^Verb$/iu.test(normalized) && /\bmodal(?: verb)?\b/u.test(evidence)) return "Modal verb";
  if (/^Pronoun$/iu.test(normalized) && /\bfirst-person singular\b/u.test(evidence)) return "Personal pronoun (first person singular)";
  if (/^Demonstrative$/iu.test(normalized) && /\bpresentational subject\b/u.test(evidence)) return "Demonstrative pronoun";
  if (/^Preposition$/iu.test(normalized) && /\blocative\b/u.test(evidence)) return "Locative preposition";
  if (/^Conjunction$/iu.test(normalized) && /\bcoordinating\b/u.test(evidence)) return "Coordinating conjunction";
  if (/^Adverb$/iu.test(normalized) && /\btemporal\b/u.test(evidence)) return "Temporal adverb";
  if (/^Noun$/iu.test(normalized) && /\bcommon noun\b/u.test(evidence)) return "Common noun";
  if (/^Noun$/iu.test(normalized) && /\bmass noun\b/u.test(evidence)) return "Mass noun";
  if (/^Noun$/iu.test(normalized) && /\bcount noun\b/u.test(evidence)) return "Count noun";
  return note;
}

function hideRawVocabularyUsage(text: string): string {
  const output: string[] = [];
  const lines = text.split("\n");
  let vocabularyHeadingLevel: number | undefined;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    const heading = /^(#{1,6})\s+(.+)$/u.exec(line.trim());
    if (heading !== null) {
      const level = heading[1]?.length ?? 0;
      if (/^(?:New\s+)?Vocabulary\b/iu.test(heading[2] ?? "")) vocabularyHeadingLevel = level;
      else if (vocabularyHeadingLevel !== undefined && level <= vocabularyHeadingLevel) vocabularyHeadingLevel = undefined;
    }
    if (!isMarkdownTableRow(line.trim())) {
      output.push(line);
      continue;
    }
    const table: string[] = [line];
    while (index + 1 < lines.length && isMarkdownTableRow((lines[index + 1] ?? "").trim())) {
      index += 1;
      table.push(lines[index] ?? "");
    }
    output.push(...hideRawUsageColumn(table, vocabularyHeadingLevel !== undefined));
  }
  return output.join("\n");
}

function hideRawUsageColumn(lines: readonly string[], inVocabularySection: boolean): readonly string[] {
  const rows = lines.map((line) => line.trim().slice(1, -1).split("|").map((cell) => cell.trim()));
  const header = rows.find((row) => !isMarkdownSeparatorRow(row)) ?? [];
  const labels = header.map((cell) => cell.toLowerCase());
  const usageColumn = labels.indexOf("usage");
  const vocabularyTable = inVocabularySection || labels.some((label) => label === "notes" || label === "note")
    && labels.some((label) => label === "meaning" || label === "english" || label.includes("meaning in this usage"));
  if (!vocabularyTable || usageColumn < 0) return lines;
  return rows.map((row) => `| ${row.filter((_, column) => column !== usageColumn).join(" | ")} |`);
}

function isMarkdownSeparatorRow(row: readonly string[]): boolean {
  return row.length > 0 && row.every((cell) => /^:?-{3,}:?$/u.test(cell));
}

export function normalViewVoiceViolations(text: string): readonly NormalViewVoiceViolation[] {
  const normal = projectCurriculumMarkdown(text, "normal");
  const violations: NormalViewVoiceViolation[] = [];
  let inCodeFence = false;
  let inLearnerReadContent = false;
  for (const [index, line] of normal.split("\n").entries()) {
    const trimmed = line.trim();
    if (/^```/u.test(trimmed)) {
      inCodeFence = !inCodeFence;
      continue;
    }
    if (inCodeFence) continue;
    const heading = /^(#{1,6})\s+(.+)$/u.exec(trimmed);
    if (heading !== null) {
      const level = heading[1]?.length ?? 0;
      const title = heading[2] ?? "";
      if (level <= 3) inLearnerReadContent = /^(?:Dialogue|Narrative|Learner-facing (?:Dialogue|Controlled Reading|Narrative|Read Content))$/iu.test(title);
      continue;
    }
    if (inLearnerReadContent || trimmed.startsWith(">") || isMarkdownTableRow(trimmed)) continue;
    const instructionalText = removeQuotedAndCodeText(line);
    const match = /\b(the learner|learners|the student|students|the user)\b/iu.exec(instructionalText);
    if (match !== null) violations.push({ line: index + 1, label: match[1] ?? match[0], text: line });
  }
  return violations;
}

function isMarkdownTableRow(line: string): boolean {
  return line.startsWith("|") && line.endsWith("|");
}

function removeQuotedAndCodeText(line: string): string {
  return line
    .replace(/`[^`]*`/gu, "")
    .replace(/“[^”]*”/gu, "")
    .replace(/"[^"]*"/gu, "");
}

function removeFrontmatter(text: string): string {
  return text.replace(/^---\n[\s\S]*?\n---(?:\n|$)/u, "");
}

function collapseExcessBlankLines(text: string): string {
  return text.replace(/\n{3,}/gu, "\n\n").replace(/^\n+/u, "").replace(/\n+$/u, "");
}
