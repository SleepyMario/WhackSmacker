import {
  listInstalledReadablePackages,
  listReadableContentEntries,
  readInstalledContentEntry,
  renderReadingContent,
  type ReadableContentEntry
} from "../core";
import { linguisticTerminologySnapshot } from "./linguistic-terminology-snapshot";

export const linguisticTerminologyPackageId = "com.sleepymario.language.linguistic-terminology";

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

export interface LinguisticTermsOptions {
  readonly dataDir?: string;
  readonly packageVersion?: string;
  readonly file?: string;
  readonly group?: string;
}

export interface LinguisticTermsOverview {
  readonly installed: boolean;
  readonly packageId: string;
  readonly packageVersion?: string;
  readonly displayName?: string;
  readonly groups: readonly LinguisticTermsGroup[];
  readonly readableEntries: readonly ReadableContentEntry[];
}

export interface LinguisticTermsGroup {
  readonly id: string;
  readonly label: string;
  readonly entries: readonly ReadableContentEntry[];
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

export async function getLinguisticTermsOverview(options: LinguisticTermsOptions = {}): Promise<LinguisticTermsOverview> {
  const installedPackages = await listInstalledReadablePackages(options.dataDir);
  const selected = installedPackages
    .filter((contentPackage) => contentPackage.packageId === linguisticTerminologyPackageId)
    .filter((contentPackage) => options.packageVersion === undefined || contentPackage.packageVersion === options.packageVersion)
    .sort((left, right) => compareSemver(right.packageVersion, left.packageVersion))[0];

  if (selected === undefined) {
    return {
      installed: false,
      packageId: linguisticTerminologyPackageId,
      packageVersion: options.packageVersion,
      groups: [],
      readableEntries: []
    };
  }

  const readableEntries = await listReadableContentEntries(linguisticTerminologyPackageId, options.dataDir, selected.packageVersion);

  return {
    installed: true,
    packageId: selected.packageId,
    packageVersion: selected.packageVersion,
    displayName: selected.displayName,
    groups: groupLinguisticTermsEntries(readableEntries),
    readableEntries
  };
}

export async function renderLinguisticTerms(options: LinguisticTermsOptions = {}): Promise<string> {
  const overview = await getLinguisticTermsOverview(options);

  if (!overview.installed) {
    return renderLinguisticTermsOverview(overview);
  }

  if (options.file !== undefined) {
    return renderReadingContent(
      await readInstalledContentEntry({
        dataDir: options.dataDir,
        packageId: linguisticTerminologyPackageId,
        packageVersion: overview.packageVersion,
        path: options.file
      })
    );
  }

  if (options.group !== undefined) {
    return renderLinguisticTermsGroup(overview, options.group);
  }

  return renderLinguisticTermsOverview(overview);
}

export function renderLinguisticTermsOverview(overview: LinguisticTermsOverview): string {
  const lines = [
    "Linguistic Terms",
    "",
    "Native terminology content is loaded from the installed WhackSmacker terminology package.",
    "",
    `Package: ${overview.packageId}`
  ];

  if (!overview.installed) {
    lines.push(
      "Status: not installed",
      "",
      "Linguistic Terminology content is not installed.",
      "Install the terminology content package before browsing terminology source files:",
      "",
      "  whacksmacker content install com.sleepymario.language.linguistic-terminology --catalogue <catalogue.json>",
      "",
      "After installation, rerun:",
      "",
    "  whacksmacker language terms"
    );
    return lines.join("\n");
  }

  lines.push(
    "Status: installed",
    `Version: ${overview.packageVersion ?? "unknown"}`,
    `Title: ${overview.displayName ?? "Linguistic Terminology"}`,
    "",
    "Groups"
  );

  if (overview.readableEntries.length === 0) {
    lines.push("", "No readable terminology entries were found in the installed package.");
    return lines.join("\n");
  }

  lines.push(
    "",
    ...overview.groups.map((group) => `- ${group.label} (${group.entries.length} entries)`),
    "",
    "Open a group with:",
    "",
    "  whacksmacker language terms <group>",
    "",
    "Open an entry with:",
    "",
    "  whacksmacker language terms --file <path>"
  );

  return lines.join("\n");
}

export function renderLinguisticTermsGroup(overview: LinguisticTermsOverview, groupName: string): string {
  const normalizedGroup = normalizeGroupName(groupName);
  const group = overview.groups.find((candidate) => candidate.id === normalizedGroup || normalizeGroupName(candidate.label) === normalizedGroup);
  const lines = [
    "Linguistic Terms",
    "",
    `Package: ${overview.packageId}`,
    `Version: ${overview.packageVersion ?? "unknown"}`,
    ""
  ];

  if (group === undefined) {
    lines.push(
      `Group not found: ${groupName}`,
      "",
      "Available groups:",
      ...overview.groups.map((candidate) => `- ${candidate.label}`)
    );
    return lines.join("\n");
  }

  lines.push(
    group.label,
    "",
    "Readable entries:",
    ...group.entries.map((entry) => `- ${entry.path}`),
    "",
    "Open an entry with:",
    "",
    `  whacksmacker language terms ${group.id} --file <path>`
  );

  return lines.join("\n");
}

export async function languageTerms(args: readonly string[]): Promise<void> {
  console.log(await renderLinguisticTerms(parseLinguisticTermsArgs(args)));
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

export function parseLinguisticTermsArgs(args: readonly string[]): LinguisticTermsOptions {
  const options: { dataDir?: string; packageVersion?: string; file?: string; group?: string } = {};

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--data-dir") {
      options.dataDir = readValue(args, index, arg);
      index += 1;
      continue;
    }

    if (arg === "--version") {
      options.packageVersion = readValue(args, index, arg);
      index += 1;
      continue;
    }

    if (arg === "--file") {
      options.file = readValue(args, index, arg);
      index += 1;
      continue;
    }

    if (!arg.startsWith("--") && options.group === undefined) {
      options.group = arg;
      continue;
    }

    throw new Error("Usage: whacksmacker language terms [<group>] [--file <path>] [--version <version>] [--data-dir <dir>]");
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

function normalizeGroupName(value: string): string {
  return value.trim().toLocaleLowerCase().replace(/\s+/gu, "-");
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

function prioritizedTermsEntries(entries: readonly ReadableContentEntry[]): readonly ReadableContentEntry[] {
  return [...entries].sort((left, right) => entryPriority(left.path) - entryPriority(right.path) || left.path.localeCompare(right.path));
}

export function groupLinguisticTermsEntries(entries: readonly ReadableContentEntry[]): readonly LinguisticTermsGroup[] {
  const groups = new Map<string, { label: string; entries: ReadableContentEntry[] }>();
  groups.set("general", { label: "General", entries: [] });

  for (const entry of entries) {
    const group = groupForTermsEntry(entry.path);
    const existing = groups.get(group.id) ?? { label: group.label, entries: [] };
    existing.entries.push(entry);
    groups.set(group.id, existing);
  }

  return [...groups.entries()]
    .map(([id, group]) => ({
      id,
      label: group.label,
      entries: prioritizedTermsEntries(group.entries)
    }))
    .filter((group) => group.entries.length > 0)
    .sort((left, right) => {
      if (left.id === "general") {
        return -1;
      }
      if (right.id === "general") {
        return 1;
      }
      return left.label.localeCompare(right.label);
    });
}

function groupForTermsEntry(path: string): { id: string; label: string } {
  const match = /^terms\/([^/]+)\.md$/u.exec(path);
  if (match === null) {
    return { id: "general", label: "General" };
  }

  const language = knownLanguageSpecificTermFiles.get(match[1]);
  if (language === undefined) {
    return { id: "general", label: "General" };
  }

  return { id: match[1], label: language };
}

const knownLanguageSpecificTermFiles = new Map<string, string>([
  ["arabic", "Arabic"],
  ["chinese", "Chinese"],
  ["dutch", "Dutch"],
  ["french", "French"],
  ["german", "German"],
  ["hindi", "Hindi"],
  ["japanese", "Japanese"],
  ["korean", "Korean"],
  ["russian", "Russian"],
  ["spanish", "Spanish"],
  ["vietnamese", "Vietnamese"],
  ["zulu", "Zulu"]
]);

function entryPriority(path: string): number {
  if (path === "INDEX.md") {
    return 0;
  }
  if (path === "README.md") {
    return 1;
  }
  if (path.startsWith("terms/")) {
    return 2;
  }
  return 3;
}

function compareSemver(left: string, right: string): number {
  const leftParts = left.split(".").map(Number);
  const rightParts = right.split(".").map(Number);
  for (let index = 0; index < 3; index += 1) {
    const difference = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);
    if (difference !== 0) {
      return difference;
    }
  }
  return 0;
}
