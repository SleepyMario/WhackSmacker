export type VocabularyEntrySpacing = "separated" | "compact";

export interface NewVocabularyDisplayPreferences {
  readonly notesVisible: boolean;
  readonly entrySpacing: VocabularyEntrySpacing;
}

export const defaultNewVocabularyDisplayPreferences: NewVocabularyDisplayPreferences = Object.freeze({
  notesVisible: true,
  entrySpacing: "separated"
});

export function isVocabularyEntrySpacing(value: unknown): value is VocabularyEntrySpacing {
  return value === "separated" || value === "compact";
}

export function shouldInsertVocabularyEntrySeparator(
  entrySpacing: VocabularyEntrySpacing,
  renderedEntryCount: number
): boolean {
  return entrySpacing === "separated" && renderedEntryCount > 0;
}

export function isNewVocabularyHeading(title: string): boolean {
  return /^(?:[^/]+\s*\/\s*)?New Vocabulary$/iu.test(title.trim());
}

export function isVocabularyTableHeader(header: readonly string[]): boolean {
  const labels = header.map(normalizeLabel);
  const hasForm = labels.some((label) => label === "form" || label === "surface form" || label === "word" || label === "phrase" || /\bword$/u.test(label));
  const hasMeaning = labels.some((label) => label === "meaning" || label === "english" || label === "meaning in this usage");
  const hasNote = labels.some((label) => label === "note" || label === "notes");
  const hasLexicalColumn = hasNote || labels.some((label) => label === "part of speech" || label === "reading");
  return hasMeaning && (hasForm || hasNote) && hasLexicalColumn;
}

export function vocabularyNoteColumn(header: readonly string[]): number {
  return header.map(normalizeLabel).findIndex((label) => label === "note" || label === "notes");
}

export function isLogicalVocabularyContinuation(
  row: readonly string[],
  header: readonly string[],
  noteColumn: number
): boolean {
  const labels = header.map(normalizeLabel);
  const value = (...candidates: readonly string[]): string => {
    const column = labels.findIndex((label) => candidates.includes(label));
    return column < 0 ? "" : (row[column] ?? "").trim();
  };
  const form = value("form", "surface form", "word", "phrase");
  const meaning = value("meaning", "english", "meaning in this usage");
  const identity = value("sense id", "senseid", "sense identity", "entry id", "entryid", "lexical entry id");
  const note = noteColumn < 0 ? "" : (row[noteColumn] ?? "").trim();
  const continuationRole = value("row role", "entry role", "logical role") || note;
  return /^(?:continuation|citation(?: form)?|canonical(?: form)?|expanded(?: form)?|decomposed(?: form)?|infinitive|paradigm(?: continuation)?|wrapped note)$/iu.test(continuationRole)
    || (meaning.length === 0 && identity.length === 0 && (/^(?:[↳→]|(?:citation|canonical|expanded|decomposed|infinitive|paradigm)\b)/iu.test(form) || form.length === 0));
}

function normalizeLabel(value: string): string {
  return value.trim().toLowerCase();
}
