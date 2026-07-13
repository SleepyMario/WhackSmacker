export type CurriculumDisplayMode = "normal" | "developer";

export const defaultCurriculumDisplayMode: CurriculumDisplayMode = "normal";
export const developerOnlyStartMarker = "<!-- whacksmacker:developer-only:start -->";
export const developerOnlyEndMarker = "<!-- whacksmacker:developer-only:end -->";

export interface NormalViewVoiceViolation {
  readonly line: number;
  readonly label: string;
  readonly text: string;
}

export function projectCurriculumMarkdown(text: string, mode: CurriculumDisplayMode = defaultCurriculumDisplayMode): string {
  const normalized = text.replace(/\r\n?/gu, "\n");
  const withoutFrontmatter = mode === "normal" ? removeFrontmatter(normalized) : normalized;
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
  return collapseExcessBlankLines(output.join("\n"));
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
      if (level <= 3) inLearnerReadContent = /^Learner-facing (?:Dialogue|Controlled Reading|Narrative|Read Content)$/iu.test(title);
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
  return text.replace(/\n{3,}/gu, "\n\n").replace(/^\n+/u, "");
}
