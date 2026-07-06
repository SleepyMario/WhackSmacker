import { linguisticTerminologySnapshot } from "./linguistic-terminology-snapshot";

export interface RelatedLinguisticTerm {
  readonly label: string;
  readonly target: string;
}

export interface LinguisticTerm {
  readonly id: string;
  readonly heading: string;
  readonly aliases: readonly string[];
  readonly category: string;
  readonly sourceFile: string;
  readonly sourceAnchor: string;
  readonly shortDefinition: string;
  readonly explanation: string;
  readonly example?: string;
  readonly relatedTerms: readonly RelatedLinguisticTerm[];
}

export interface LinguisticTerminologySnapshot {
  readonly sourceRepository: string;
  readonly sourceCommit: string | null;
  readonly terms: readonly LinguisticTerm[];
}

export interface RenderTerminologyOptions {
  readonly query?: string;
  readonly category?: string;
  readonly id?: string;
}

export function getLinguisticTerminologySnapshot(): LinguisticTerminologySnapshot {
  return linguisticTerminologySnapshot;
}

export function getLinguisticTerminologyCategories(snapshot = linguisticTerminologySnapshot): readonly string[] {
  return [...new Set(snapshot.terms.map((term) => term.category))].sort((left, right) => left.localeCompare(right));
}

export function searchLinguisticTerms(query: string, snapshot = linguisticTerminologySnapshot): readonly LinguisticTerm[] {
  const normalizedQuery = normalizeSearchText(query);
  if (normalizedQuery.length === 0) {
    return snapshot.terms;
  }

  return snapshot.terms.filter((term) => {
    const haystack = normalizeSearchText(
      [
        term.heading,
        term.id,
        term.category,
        term.aliases.join(" "),
        term.shortDefinition,
        term.explanation,
        term.example ?? ""
      ].join(" ")
    );

    return haystack.includes(normalizedQuery);
  });
}

export function filterLinguisticTermsByCategory(category: string, snapshot = linguisticTerminologySnapshot): readonly LinguisticTerm[] {
  const normalizedCategory = normalizeSearchText(category);

  return snapshot.terms.filter((term) => normalizeSearchText(term.category) === normalizedCategory);
}

export function findLinguisticTermById(id: string, snapshot = linguisticTerminologySnapshot): LinguisticTerm | null {
  return snapshot.terms.find((term) => term.id === id) ?? null;
}

export function resolveRelatedLinguisticTerm(term: LinguisticTerm, relatedTerm: RelatedLinguisticTerm, snapshot = linguisticTerminologySnapshot): LinguisticTerm | null {
  const target = resolveRelatedTarget(term.sourceFile, relatedTerm.target);

  return snapshot.terms.find((candidate) => `${candidate.sourceFile}#${candidate.sourceAnchor}` === target) ?? null;
}

export function renderLinguisticTerminology(options: RenderTerminologyOptions = {}, snapshot = linguisticTerminologySnapshot): string {
  const terms = selectTerms(options, snapshot);
  const lines = [
    "Linguistic Terminology",
    "",
    "Technical glossary used across WhackSmacker language curricula.",
    "",
    `Canonical source: ${snapshot.sourceRepository}${snapshot.sourceCommit === null ? "" : ` @ ${snapshot.sourceCommit}`}`,
    "",
    "Categories:",
    ...getLinguisticTerminologyCategories(snapshot).map((category) => `- ${category}`)
  ];

  if (options.query === undefined && options.category === undefined && options.id === undefined) {
    lines.push("", "Alphabetical Index:", ...snapshot.terms.map((term) => `- ${term.heading} — ${term.id}`));
  }

  lines.push("", renderSelectionHeading(options, terms.length));

  if (terms.length === 0) {
    lines.push("No terminology entries matched.");
    return lines.join("\n");
  }

  for (const term of terms) {
    lines.push("", renderLinguisticTerm(term, snapshot));
  }

  return lines.join("\n");
}

export async function languageTerminology(args: readonly string[]): Promise<void> {
  const options = parseTerminologyArgs(args);
  console.log(renderLinguisticTerminology(options));
}

function selectTerms(options: RenderTerminologyOptions, snapshot: LinguisticTerminologySnapshot): readonly LinguisticTerm[] {
  if (options.id !== undefined) {
    const term = findLinguisticTermById(options.id, snapshot);
    return term === null ? [] : [term];
  }

  let terms = options.category === undefined ? snapshot.terms : filterLinguisticTermsByCategory(options.category, snapshot);
  if (options.query !== undefined) {
    const scopedSnapshot = { ...snapshot, terms };
    terms = searchLinguisticTerms(options.query, scopedSnapshot);
  }

  return terms;
}

function renderSelectionHeading(options: RenderTerminologyOptions, count: number): string {
  if (options.id !== undefined) {
    return `Stable ID: ${options.id}`;
  }

  if (options.query !== undefined && options.category !== undefined) {
    return `Search: ${options.query} in ${options.category} (${count} result${count === 1 ? "" : "s"})`;
  }

  if (options.query !== undefined) {
    return `Search: ${options.query} (${count} result${count === 1 ? "" : "s"})`;
  }

  if (options.category !== undefined) {
    return `Category: ${options.category} (${count} term${count === 1 ? "" : "s"})`;
  }

  return `All Terms (${count})`;
}

function renderLinguisticTerm(term: LinguisticTerm, snapshot: LinguisticTerminologySnapshot): string {
  const lines = [
    `## ${term.heading}`,
    `ID: ${term.id}`,
    `Category: ${term.category}`
  ];

  if (term.aliases.length > 0) {
    lines.push(`Also called: ${term.aliases.join(", ")}`);
  }

  lines.push("", "Short definition:", term.shortDefinition, "", "Explanation:", term.explanation);

  if (term.example !== undefined) {
    lines.push("", "Example:", term.example);
  }

  if (term.relatedTerms.length > 0) {
    lines.push("", "Related terms:");
    for (const relatedTerm of term.relatedTerms) {
      const target = resolveRelatedLinguisticTerm(term, relatedTerm, snapshot);
      lines.push(`- ${relatedTerm.label}${target === null ? "" : ` — ${target.id}`}`);
    }
  }

  return lines.join("\n");
}

function parseTerminologyArgs(args: readonly string[]): RenderTerminologyOptions {
  const options: { query?: string; category?: string; id?: string } = {};

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--search") {
      options.query = readValue(args, index, arg);
      index += 1;
    } else if (arg === "--category") {
      options.category = readValue(args, index, arg);
      index += 1;
    } else if (arg === "--id") {
      options.id = readValue(args, index, arg);
      index += 1;
    } else if (arg === "--help" || arg === "-h") {
      throw new Error("Usage: whacksmacker language terminology [--search <text>] [--category <name>] [--id <stable-id>]");
    } else {
      throw new Error(`Unknown terminology option: ${arg}`);
    }
  }

  return options;
}

function readValue(args: readonly string[], index: number, option: string): string {
  const value = args[index + 1];
  if (value === undefined || value.trim().length === 0) {
    throw new Error(`Missing value for ${option}`);
  }

  return value;
}

function normalizeSearchText(value: string): string {
  return value.toLocaleLowerCase();
}

function resolveRelatedTarget(sourceFile: string, target: string): string {
  const [targetFile, anchor] = target.split("#");

  if (anchor === undefined || anchor.length === 0) {
    return "";
  }

  if (targetFile.length === 0) {
    return `${sourceFile}#${anchor}`;
  }

  if (targetFile.includes("/") || targetFile.startsWith("..")) {
    return "";
  }

  return `terms/${targetFile}#${anchor}`;
}
