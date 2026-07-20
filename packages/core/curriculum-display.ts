export type CurriculumDisplayMode = "normal" | "expert" | "developer";
export type CurriculumContentRole = "reading" | "grammar-easy" | "grammar-hard";

export interface CurriculumProjectionOptions {
  readonly contentRole?: CurriculumContentRole;
  readonly translationsEnabled?: boolean;
}

export const defaultCurriculumDisplayMode: CurriculumDisplayMode = "normal";
export const developerOnlyStartMarker = "<!-- whacksmacker:developer-only:start -->";
export const developerOnlyEndMarker = "<!-- whacksmacker:developer-only:end -->";

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
  const grammarProjected = projectGrammarRole(withoutRawUsage, mode, options.contentRole ?? "reading");
  return normalizeReadContentHeadingSpacing(collapseExcessBlankLines(simplifyReadingHeadings(grammarProjected)));
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
