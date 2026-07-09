import {
  assertValidMemorizationItem,
  type MemorizationContentBlock,
  type MemorizationItem
} from "./memorization-item";

export interface ExerciseItemIdentity {
  readonly packageId: string;
  readonly packageVersion: string;
  readonly itemId: string;
}

export interface RenderExerciseOptions extends ExerciseItemIdentity {
  readonly item: unknown;
}

export interface RenderedExercise {
  readonly itemIdentity: ExerciseItemIdentity;
  readonly kind: MemorizationItem["kind"];
  readonly title: string;
  readonly promptLanguage?: string;
  readonly answerLanguage?: string;
  readonly promptLines: readonly string[];
  readonly answerLines: readonly string[];
  readonly hintLines: readonly string[];
  readonly noteLines: readonly string[];
  readonly exampleLines: readonly string[];
  readonly metadataLines: readonly string[];
  readonly warnings: readonly string[];
}

export function renderMemorizationExercise(options: RenderExerciseOptions): RenderedExercise {
  assertValidMemorizationItem(options.item);
  const item = options.item;
  const identity = {
    packageId: options.packageId,
    packageVersion: options.packageVersion,
    itemId: options.itemId
  };

  if (item.id !== options.itemId) {
    throw new Error(`Memorization item ID does not match render identity: expected ${options.itemId}, got ${item.id}`);
  }

  return {
    itemIdentity: identity,
    kind: item.kind,
    title: titleFor(item),
    ...(item.prompt.language === undefined ? {} : { promptLanguage: item.prompt.language }),
    ...(item.answer.language === undefined ? {} : { answerLanguage: item.answer.language }),
    promptLines: promptLinesFor(item),
    answerLines: answerLinesFor(item),
    hintLines: (item.hints ?? []).flatMap((hint) => normalizeLines(hint)),
    noteLines: item.notes === undefined ? [] : normalizeLines(item.notes),
    exampleLines: (item.examples ?? []).flatMap((example) => normalizeExampleLines(example)).slice(0, 3),
    metadataLines: metadataLinesFor(item, identity),
    warnings: warningsFor(item)
  };
}

export function formatRenderedExercise(exercise: RenderedExercise, side: "prompt" | "answer" | "full" = "full"): string {
  const sections: string[] = [exercise.title, `${exercise.itemIdentity.packageId} ${exercise.itemIdentity.packageVersion} ${exercise.itemIdentity.itemId}`];
  if (side === "prompt" || side === "full") {
    sections.push("", "Prompt", ...prefixLines(exercise.promptLines));
    if (exercise.hintLines.length > 0) {
      sections.push("", "Hints", ...prefixLines(exercise.hintLines));
    }
  }
  if (side === "answer" || side === "full") {
    sections.push("", "Answer", ...prefixLines(exercise.answerLines));
    if (exercise.noteLines.length > 0) {
      sections.push("", "Notes", ...prefixLines(exercise.noteLines));
    }
    if (exercise.exampleLines.length > 0) {
      sections.push("", "Example", ...prefixLines(exercise.exampleLines.map((example) => `- ${example}`)));
    }
  }
  if (side === "full" && exercise.metadataLines.length > 0) {
    sections.push("", "Metadata", ...prefixLines(exercise.metadataLines));
  }
  if (side === "full" && exercise.warnings.length > 0) {
    sections.push("", "Warnings", ...prefixLines(exercise.warnings));
  }
  return `${sections.join("\n").trimEnd()}\n`;
}

function titleFor(item: MemorizationItem): string {
  if (item.source?.title !== undefined && item.source.title.trim().length > 0) {
    return item.source.title.trim();
  }
  return `${kindLabel(item.kind)}: ${firstLine(item.prompt)}`;
}

function promptLinesFor(item: MemorizationItem): readonly string[] {
  if (item.kind === "cloze") {
    return normalizeLines(maskClozeText(blockText(item.prompt)));
  }
  return normalizeLines(blockText(item.prompt));
}

function answerLinesFor(item: MemorizationItem): readonly string[] {
  if (item.kind === "cloze") {
    const clozeAnswers = extractClozeAnswers(blockText(item.prompt));
    const answerLines = normalizeLines(blockText(item.answer));
    return clozeAnswers.length === 0 ? answerLines : [...clozeAnswers.map((answer) => `Cloze: ${answer}`), ...answerLines];
  }
  return normalizeLines(blockText(item.answer));
}

function metadataLinesFor(item: MemorizationItem, identity: ExerciseItemIdentity): readonly string[] {
  const lines = [`Kind: ${item.kind}`, `Package: ${identity.packageId}`, `Version: ${identity.packageVersion}`, `Item: ${identity.itemId}`];
  if (item.tags !== undefined && item.tags.length > 0) {
    lines.push(`Tags: ${item.tags.join(", ")}`);
  }
  if (item.source !== undefined) {
    lines.push(`Source: ${item.source.path}${item.source.anchor === undefined ? "" : `#${item.source.anchor}`}`);
  }
  if (item.language !== undefined) {
    const parts = [
      item.language.target === undefined ? undefined : `target=${item.language.target}`,
      item.language.base === undefined ? undefined : `base=${item.language.base}`,
      item.language.script === undefined ? undefined : `script=${item.language.script}`
    ].filter((part): part is string => part !== undefined);
    if (parts.length > 0) {
      lines.push(`Language: ${parts.join(", ")}`);
    }
  }
  if (item.difficulty !== undefined) {
    const parts = [
      item.difficulty.level === undefined ? undefined : `level=${item.difficulty.level}`,
      item.difficulty.label === undefined ? undefined : `label=${item.difficulty.label}`
    ].filter((part): part is string => part !== undefined);
    if (parts.length > 0) {
      lines.push(`Difficulty: ${parts.join(", ")}`);
    }
  }
  return lines;
}

function warningsFor(item: MemorizationItem): readonly string[] {
  if (item.kind === "cloze" && extractClozeAnswers(blockText(item.prompt)).length === 0) {
    return ["Cloze item has no simple {{c1::answer}} marker; rendering stored prompt and answer blocks directly."];
  }
  return [];
}

function blockText(block: MemorizationContentBlock): string {
  return block.plainText !== undefined && block.plainText.trim().length > 0 ? block.plainText : block.text;
}

function normalizeLines(text: string): readonly string[] {
  const lines = text
    .replace(/\r\n?/gu, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t\f\v]+/gu, " ").trim())
    .filter((line) => line.length > 0);
  return lines.length === 0 ? [""] : lines;
}

function normalizeExampleLines(text: string): readonly string[] {
  return text
    .replace(/\r\n?/gu, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function firstLine(block: MemorizationContentBlock): string {
  return normalizeLines(blockText(block))[0] ?? "";
}

function maskClozeText(text: string): string {
  return text.replace(/\{\{c\d*::([^}:]+)(?:::[^}]+)?\}\}/gu, "[...]");
}

function extractClozeAnswers(text: string): readonly string[] {
  return [...text.matchAll(/\{\{c\d*::([^}:]+)(?:::[^}]+)?\}\}/gu)].map((match) => match[1]?.trim() ?? "").filter((answer) => answer.length > 0);
}

function prefixLines(lines: readonly string[]): readonly string[] {
  return lines.map((line) => `  ${line}`);
}

function kindLabel(kind: MemorizationItem["kind"]): string {
  return kind
    .split("-")
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}
