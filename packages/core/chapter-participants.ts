import {
  activePersonIdsForChapter,
  activeCastSizeForChapter
} from "./language-curriculum-policy";
import type { CanonicalPersonV2 } from "./canonical-cast";
import {
  canonicalFullNameForEastAsianPolicy,
  eastAsianFullNamePresentationPolicyName,
  eastAsianNamePolicyContext,
  type ChineseScriptVariant
} from "./east-asian-name-policy";

export const chapterParticipantMetadataFileName = "chapter-participants.json";
export const chapterParticipantSchemaVersion = 1;

export type PrimaryParticipantKind =
  | "dialogue-speaker"
  | "narrative-participant"
  | "narrative-subject";

export interface UnnamedFunctionalParticipant {
  readonly localId: string;
  readonly roleLabel: string;
  readonly supportedProjectionLabels?: readonly string[];
}

export interface PrimaryReadingParticipant {
  readonly participantId: string;
  readonly kind: PrimaryParticipantKind;
  readonly label: string;
}

export interface ProjectedParticipant {
  readonly participantId: string;
  readonly label: string;
}

export interface ChapterParticipantDocument {
  readonly schemaVersion: 1;
  readonly chapter: number;
  readonly canonicalCastIds: readonly string[];
  readonly unnamedFunctionalParticipants: readonly UnnamedFunctionalParticipant[];
  readonly primaryReadingParticipants: readonly PrimaryReadingParticipant[];
  readonly introductionParticipants: readonly ProjectedParticipant[];
  readonly translationParticipants?: readonly ProjectedParticipant[];
  readonly supportParticipants?: readonly ProjectedParticipant[];
}

export interface ChapterParticipantReconciliationOptions {
  readonly sourceFile: string;
  readonly chapterMarkdown: string;
  readonly canonicalCast: readonly Pick<CanonicalPersonV2, "id" | "displayName" | "traditionalDisplayName" | "simplifiedDisplayName">[];
  readonly activeCastProgression: readonly string[];
  readonly curriculumIdentity?: string;
  readonly chineseScriptVariant?: ChineseScriptVariant;
  readonly translationText?: string;
  readonly supportText?: string;
}

export interface ChapterParticipantReconciliationResult {
  readonly chapter: number;
  readonly mode: "dialogue" | "narrative";
  readonly canonicalCastIds: readonly string[];
  readonly functionalParticipantIds: readonly string[];
  readonly namedCastCeiling: 3 | 4;
  readonly structuralDialogueLabels: readonly string[];
}

const documentKeys = new Set([
  "schemaVersion",
  "chapter",
  "canonicalCastIds",
  "unnamedFunctionalParticipants",
  "primaryReadingParticipants",
  "introductionParticipants",
  "translationParticipants",
  "supportParticipants"
]);
const functionalKeys = new Set(["localId", "roleLabel", "supportedProjectionLabels"]);
const primaryKeys = new Set(["participantId", "kind", "label"]);
const projectionKeys = new Set(["participantId", "label"]);
const primaryKinds = new Set<PrimaryParticipantKind>(["dialogue-speaker", "narrative-participant", "narrative-subject"]);
const genericSpeakerLabel = /^(?:[A-C]|speaker\s*[1-9]\d*|person\s*[1-9]\d*)$/iu;

export function assertValidChapterParticipants(
  value: unknown,
  options: ChapterParticipantReconciliationOptions
): asserts value is ChapterParticipantDocument {
  reconcileChapterParticipants(value, options);
}

export function reconcileChapterParticipants(
  value: unknown,
  options: ChapterParticipantReconciliationOptions
): ChapterParticipantReconciliationResult {
  const source = options.sourceFile;
  if (!isRecord(value)) throw new Error(`${source}: chapter participant metadata must be an object`);
  assertOnlyKeys(value, documentKeys, source);
  if (value.schemaVersion !== chapterParticipantSchemaVersion) throw new Error(`${source}: schemaVersion must be 1`);
  if (!Number.isInteger(value.chapter) || (value.chapter as number) < 1) throw new Error(`${source}: chapter must be a positive integer`);
  const chapter = value.chapter as number;
  const castIds = stringArray(value.canonicalCastIds, `${source}: canonicalCastIds`);
  const duplicatedCastId = firstDuplicate(castIds);
  if (duplicatedCastId !== undefined) throw new Error(`${source}: duplicate canonical participant declaration ${duplicatedCastId}`);
  for (const id of castIds) if (!/^CAST-\d{3}$/u.test(id)) throw new Error(`${source}: canonical participant ID must match CAST-NNN; current invalid value ${id}`);

  const castById = new Map(options.canonicalCast.map(person => [person.id, person]));
  const eastAsianPolicy = eastAsianNamePolicyContext(options.curriculumIdentity, options.chineseScriptVariant);
  const requiredFullNames = new Map<string, string>();
  if (eastAsianPolicy !== undefined) {
    for (const person of options.canonicalCast) {
      requiredFullNames.set(person.id, canonicalFullNameForEastAsianPolicy(person, eastAsianPolicy));
    }
  }
  const castLabelToId = new Map<string, string>();
  for (const person of options.canonicalCast) {
    for (const label of canonicalNameForms(person)) {
      const key = normalizeLabel(label);
      const existing = castLabelToId.get(key);
      if (existing !== undefined && existing !== person.id) throw new Error(`${source}: canonical name form ${label} resolves to both ${existing} and ${person.id}`);
      castLabelToId.set(key, person.id);
    }
  }
  for (const id of castIds) if (!castById.has(id)) throw new Error(`${source}: canonical participant ${id} does not resolve in the canonical cast`);

  const functional = parseFunctionalParticipants(value.unnamedFunctionalParticipants, source);
  const functionsById = new Map(functional.map(person => [person.localId, person]));
  const functionIds = functional.map(person => person.localId);
  const duplicateFunctionId = firstDuplicate(functionIds);
  if (duplicateFunctionId !== undefined) throw new Error(`${source}: duplicate functional participant declaration ${duplicateFunctionId}`);
  const duplicateRoleLabel = firstDuplicate(functional.map(person => normalizeLabel(person.roleLabel)));
  if (duplicateRoleLabel !== undefined) throw new Error(`${source}: duplicate functional role-label declaration ${duplicateRoleLabel}`);
  for (const person of functional) {
    const disguisedLabel = [person.roleLabel, ...(person.supportedProjectionLabels ?? [])]
      .find(label => castLabelToId.has(normalizeLabel(label)));
    if (disguisedLabel !== undefined) {
      throw new Error(`${source}: functional role ${person.localId} uses canonical full name ${disguisedLabel}; a canonical person cannot be disguised as an unnamed functional role`);
    }
  }

  const primary = parsePrimaryParticipants(value.primaryReadingParticipants, source);
  const introduction = parseProjectedParticipants(value.introductionParticipants, `${source}: introductionParticipants`);
  const translation = value.translationParticipants === undefined ? [] : parseProjectedParticipants(value.translationParticipants, `${source}: translationParticipants`);
  const support = value.supportParticipants === undefined ? [] : parseProjectedParticipants(value.supportParticipants, `${source}: supportParticipants`);
  assertUniqueUses(primary, source);
  assertUniqueProjections(introduction, `${source}: introductionParticipants`);
  assertUniqueProjections(translation, `${source}: translationParticipants`);
  assertUniqueProjections(support, `${source}: supportParticipants`);

  const declared = new Set([...castIds, ...functionIds]);
  for (const use of [...primary, ...introduction, ...translation, ...support]) {
    if (!declared.has(use.participantId)) throw new Error(`${source}: participant use ${use.participantId} is not declared as canonical cast or an unnamed functional participant`);
    if (genericSpeakerLabel.test(use.label)) throw new Error(`${source}: generic A/B/C or numbered speaker label ${use.label} is prohibited`);
  }
  for (const use of primary) {
    const role = functionsById.get(use.participantId);
    if (role !== undefined && use.label !== role.roleLabel) {
      throw new Error(`${source}: functional participant ${role.localId} must use exact primary-reading role label ${role.roleLabel}; current invalid label ${use.label}`);
    }
  }
  for (const use of [...introduction, ...translation, ...support]) {
    const role = functionsById.get(use.participantId);
    if (role !== undefined && use.label !== role.roleLabel && !role.supportedProjectionLabels?.includes(use.label)) {
      throw new Error(`${source}: functional participant ${role.localId} projection label ${use.label} is not its exact role label ${role.roleLabel} or an explicitly supported projection label`);
    }
  }
  const canonicalUseLabels = new Set(primary.filter(use => castById.has(use.participantId)).map(use => normalizeLabel(use.label)));
  for (const person of functional) {
    if (canonicalUseLabels.has(normalizeLabel(person.roleLabel))) {
      throw new Error(`${source}: functional role label ${person.roleLabel} is also assigned to a canonical participant and cannot evade canonical-cast accounting`);
    }
  }

  const reading = extractPrimaryReading(options.chapterMarkdown, source);
  for (const label of reading.dialogueSpeakerLabels) {
    if (genericSpeakerLabel.test(label)) throw new Error(`${source}: generic A/B/C or numbered structural Dialogue speaker label ${label} is prohibited`);
  }
  for (const use of primary) {
    if (reading.mode === "dialogue" && use.kind !== "dialogue-speaker") {
      throw new Error(`${source}: Dialogue primary reading cannot declare ${use.kind} for ${use.participantId}`);
    }
    if (reading.mode === "narrative" && use.kind === "dialogue-speaker") {
      throw new Error(`${source}: Narrative primary reading cannot declare Dialogue speaker ${use.participantId}`);
    }
    if (use.kind === "dialogue-speaker" && !reading.dialogueSpeakerLabels.includes(use.label)) {
      throw new Error(`${source}: declared Dialogue participant ${use.participantId} with label ${use.label} is absent from the actual primary reading`);
    }
    const expectedFullName = requiredFullNames.get(use.participantId);
    if (expectedFullName !== undefined && use.kind === "dialogue-speaker" && use.label !== expectedFullName) {
      throw new Error(`${source}: Chapter ${chapter} participant ${use.participantId} structural Dialogue label ${JSON.stringify(use.label)} violates ${eastAsianFullNamePresentationPolicyName}; expected exact canonical full name ${JSON.stringify(expectedFullName)}`);
    }
    if (use.kind !== "dialogue-speaker" && !containsExactLabel(reading.body, use.label)) {
      throw new Error(`${source}: declared Narrative participant ${use.participantId} with label ${use.label} is absent from the actual primary reading`);
    }
  }
  for (const structuralLabel of reading.dialogueSpeakerLabels) {
    if (!primary.some(use => use.kind === "dialogue-speaker" && use.label === structuralLabel)) {
      throw new Error(`${source}: actual structural Dialogue speaker ${structuralLabel} is omitted from chapter participant metadata`);
    }
  }

  const primaryIds = new Set(primary.map(use => use.participantId));
  for (const id of castIds) if (!primaryIds.has(id)) throw new Error(`${source}: declared canonical participant ${id} is absent from the actual primary reading`);
  for (const id of functionIds) if (!primaryIds.has(id)) throw new Error(`${source}: declared functional participant ${id} is absent from the actual primary reading`);
  for (const id of primaryIds) if (!declared.has(id)) throw new Error(`${source}: actual participant ${id} was not declared`);

  const introductionIds = new Set(introduction.map(use => use.participantId));
  for (const id of primaryIds) if (!introductionIds.has(id)) throw new Error(`${source}: primary participant ${id} is omitted from the people/subject-and-setting introduction`);
  for (const id of introductionIds) if (!primaryIds.has(id)) throw new Error(`${source}: introduction participant ${id} is absent from the actual primary-reading participant set`);
  for (const use of introduction) {
    const expectedFullName = requiredFullNames.get(use.participantId);
    if (expectedFullName !== undefined && use.label !== expectedFullName) {
      throw new Error(`${source}: Chapter ${chapter} introduction participant ${use.participantId} label ${JSON.stringify(use.label)} violates ${eastAsianFullNamePresentationPolicyName}; expected exact canonical full name ${JSON.stringify(expectedFullName)}`);
    }
    if (!containsExactLabel(reading.introduction, use.label)) {
      throw new Error(`${source}: introduction participant ${use.participantId} label ${use.label} is absent from the actual introduction`);
    }
  }
  if (eastAsianPolicy !== undefined) {
    if (/\bCAST-\d{3}\b/u.test(reading.introduction)) {
      throw new Error(`${source}: Chapter ${chapter} learner-facing introduction exposes an internal cast ID in violation of ${eastAsianFullNamePresentationPolicyName}`);
    }
    for (const [id, expectedFullName] of requiredFullNames) {
      if (containsExactLabel(reading.introduction, expectedFullName) && !primaryIds.has(id)) {
        throw new Error(`${source}: Chapter ${chapter} introduction names absent canonical participant ${id} (${expectedFullName}) in violation of ${eastAsianFullNamePresentationPolicyName}`);
      }
    }
    assertEastAsianProjectionSet(translation, primaryIds, value, "translationParticipants", options.translationText, source, chapter);
    assertEastAsianProjectionSet(support, primaryIds, value, "supportParticipants", options.supportText, source, chapter);
    for (const use of support) {
      const expectedFullName = requiredFullNames.get(use.participantId);
      if (expectedFullName !== undefined && use.label !== expectedFullName) {
        throw new Error(`${source}: Chapter ${chapter} support participant ${use.participantId} label ${JSON.stringify(use.label)} violates ${eastAsianFullNamePresentationPolicyName}; expected ${JSON.stringify(expectedFullName)}`);
      }
    }
    if (options.supportText !== undefined) {
      assertEastAsianSupportIntroductions(options.supportText, [...primaryIds], requiredFullNames, functionsById, source, chapter);
    }
  }
  reconcileProjection(translation, options.translationText, `${source}: translationParticipants`);
  reconcileProjection(support, options.supportText, `${source}: supportParticipants`);

  // Canonical names inside another person's speech or narration may be bare
  // references. Structural Dialogue speakers and sidecar-declared substantive
  // Narrative participants are reconciled above; references do not become
  // participants or qualifying appearances merely because their name occurs.

  const active = new Set(activePersonIdsForChapter(chapter, options.activeCastProgression));
  for (const id of castIds) if (!active.has(id)) throw new Error(`${source}: canonical participant ${id} is inactive at Chapter ${chapter}`);
  const ceiling = chapter <= 75 ? 3 : 4;
  if (castIds.length > ceiling) {
    throw new Error(`${source}: Chapter ${chapter} declares ${castIds.length} canonical cast participants; named-cast ceiling is ${ceiling}. Unnamed functional participants are excluded from this count.`);
  }
  if (active.size !== activeCastSizeForChapter(chapter)) throw new Error(`${source}: internal active-cast calculation disagrees with Chapter ${chapter}`);

  return {
    chapter,
    mode: reading.mode,
    canonicalCastIds: castIds,
    functionalParticipantIds: functionIds,
    namedCastCeiling: ceiling,
    structuralDialogueLabels: reading.dialogueSpeakerLabels
  };
}

function parseFunctionalParticipants(value: unknown, source: string): UnnamedFunctionalParticipant[] {
  if (!Array.isArray(value)) throw new Error(`${source}: unnamedFunctionalParticipants must be an array`);
  return value.map((candidate, index) => {
    const label = `${source}: unnamedFunctionalParticipants[${index}]`;
    if (!isRecord(candidate)) throw new Error(`${label} must be an object`);
    assertOnlyKeys(candidate, functionalKeys, label);
    if (typeof candidate.localId !== "string" || !/^ROLE-[A-Z0-9][A-Z0-9-]*$/u.test(candidate.localId)) {
      throw new Error(`${label}.localId must be a chapter-local ROLE-* identifier and must not use CAST-*`);
    }
    if (typeof candidate.roleLabel !== "string" || candidate.roleLabel.trim() === "") throw new Error(`${label}.roleLabel must be the exact nonempty target-language role label`);
    const roleLabel = candidate.roleLabel;
    const supportedProjectionLabels = candidate.supportedProjectionLabels === undefined
      ? undefined
      : stringArray(candidate.supportedProjectionLabels, `${label}.supportedProjectionLabels`);
    if (supportedProjectionLabels !== undefined) {
      const duplicate = firstDuplicate(supportedProjectionLabels.map(normalizeLabel));
      if (duplicate !== undefined) throw new Error(`${label}.supportedProjectionLabels contains duplicate label ${duplicate}`);
      if (supportedProjectionLabels.some(projected => normalizeLabel(projected) === normalizeLabel(roleLabel))) {
        throw new Error(`${label}.supportedProjectionLabels must not repeat the exact target-language roleLabel`);
      }
    }
    return {
      localId: candidate.localId,
      roleLabel,
      ...(supportedProjectionLabels === undefined ? {} : { supportedProjectionLabels })
    };
  });
}

function parsePrimaryParticipants(value: unknown, source: string): PrimaryReadingParticipant[] {
  if (!Array.isArray(value)) throw new Error(`${source}: primaryReadingParticipants must be an array`);
  return value.map((candidate, index) => {
    const label = `${source}: primaryReadingParticipants[${index}]`;
    if (!isRecord(candidate)) throw new Error(`${label} must be an object`);
    assertOnlyKeys(candidate, primaryKeys, label);
    if (typeof candidate.participantId !== "string" || !/^(?:CAST-\d{3}|ROLE-[A-Z0-9][A-Z0-9-]*)$/u.test(candidate.participantId)) throw new Error(`${label}.participantId must be a declared CAST-* or chapter-local ROLE-* ID`);
    if (typeof candidate.kind !== "string" || !primaryKinds.has(candidate.kind as PrimaryParticipantKind)) throw new Error(`${label}.kind is invalid`);
    if (typeof candidate.label !== "string" || candidate.label.trim() === "") throw new Error(`${label}.label must be nonempty`);
    return { participantId: candidate.participantId, kind: candidate.kind as PrimaryParticipantKind, label: candidate.label };
  });
}

function parseProjectedParticipants(value: unknown, source: string): ProjectedParticipant[] {
  if (!Array.isArray(value)) throw new Error(`${source} must be an array`);
  return value.map((candidate, index) => {
    const label = `${source}[${index}]`;
    if (!isRecord(candidate)) throw new Error(`${label} must be an object`);
    assertOnlyKeys(candidate, projectionKeys, label);
    if (typeof candidate.participantId !== "string" || !/^(?:CAST-\d{3}|ROLE-[A-Z0-9][A-Z0-9-]*)$/u.test(candidate.participantId)) throw new Error(`${label}.participantId must be a declared CAST-* or ROLE-* ID`);
    if (typeof candidate.label !== "string" || candidate.label.trim() === "") throw new Error(`${label}.label must be nonempty`);
    return { participantId: candidate.participantId, label: candidate.label };
  });
}

function extractPrimaryReading(markdown: string, source: string): {
  readonly mode: "dialogue" | "narrative";
  readonly introduction: string;
  readonly body: string;
  readonly dialogueSpeakerLabels: readonly string[];
} {
  const normalized = markdown.replace(/\r\n?/gu, "\n");
  const headingPattern = /^(#{2,3})\s+(?:Learner-facing )?(Dialogue|Narrative|Controlled Reading|Read Content)\s*$/gimu;
  const heading = headingPattern.exec(normalized);
  if (heading === null) throw new Error(`${source}: chapter has no primary Dialogue or Narrative heading`);
  const level = heading[1].length;
  const start = heading.index + heading[0].length;
  const rest = normalized.slice(start).replace(/^\s*\n/u, "");
  const endMatch = new RegExp(`^#{1,${level}}\\s+`, "mu").exec(rest);
  const section = (endMatch === null ? rest : rest.slice(0, endMatch.index)).trim();
  const mode = /^Dialogue$/iu.test(heading[2]) ? "dialogue" : "narrative";
  if (mode === "dialogue") {
    const lines = section.split("\n");
    const firstSpeaker = lines.findIndex(line => structuralSpeakerLabel(line) !== undefined);
    if (firstSpeaker < 0) throw new Error(`${source}: Dialogue contains no structural speaker labels`);
    const introduction = lines.slice(0, firstSpeaker).join("\n").trim();
    const body = lines.slice(firstSpeaker).join("\n").trim();
    const dialogueSpeakerLabels = [...new Set(lines.slice(firstSpeaker).flatMap(line => {
      const label = structuralSpeakerLabel(line);
      return label === undefined ? [] : [label];
    }))];
    return { mode, introduction, body, dialogueSpeakerLabels };
  }
  const paragraphs = section.split(/\n\s*\n/u).map(part => part.trim()).filter(Boolean);
  if (paragraphs.length < 2) throw new Error(`${source}: Narrative must contain a separate people/subject-and-setting introduction before its body`);
  return { mode, introduction: paragraphs[0], body: paragraphs.slice(1).join("\n\n"), dialogueSpeakerLabels: [] };
}

function structuralSpeakerLabel(line: string): string | undefined {
  const match = line.match(/^([^:：\n]{1,80}?)\s*[:：]\s*\S/u);
  return match?.[1].trim();
}

function reconcileProjection(entries: readonly ProjectedParticipant[], text: string | undefined, source: string): void {
  if (entries.length === 0) return;
  if (text === undefined) throw new Error(`${source} declares identity projections but no projection text was supplied for validation`);
  for (const entry of entries) if (!containsExactLabel(text, entry.label)) throw new Error(`${source}: label ${entry.label} for ${entry.participantId} is absent from the supplied projection`);
}

function assertEastAsianProjectionSet(
  entries: readonly ProjectedParticipant[],
  primaryIds: ReadonlySet<string>,
  document: Record<string, unknown>,
  field: "translationParticipants" | "supportParticipants",
  projectionText: string | undefined,
  source: string,
  chapter: number
): void {
  if (projectionText === undefined) return;
  if (!Object.prototype.hasOwnProperty.call(document, field)) {
    throw new Error(`${source}: Chapter ${chapter} ${field} is required when that projection is packaged under ${eastAsianFullNamePresentationPolicyName}`);
  }
  const projectedIds = new Set(entries.map(entry => entry.participantId));
  for (const id of primaryIds) {
    if (!projectedIds.has(id)) throw new Error(`${source}: Chapter ${chapter} ${field} omits primary participant ${id}`);
  }
  for (const id of projectedIds) {
    if (!primaryIds.has(id)) throw new Error(`${source}: Chapter ${chapter} ${field} declares absent primary participant ${id}`);
  }
}

function assertEastAsianSupportIntroductions(
  text: string,
  primaryIds: readonly string[],
  requiredFullNames: ReadonlyMap<string, string>,
  functionsById: ReadonlyMap<string, UnnamedFunctionalParticipant>,
  source: string,
  chapter: number
): void {
  let document: unknown;
  try {
    document = JSON.parse(text);
  } catch (error) {
    throw new Error(`${source}: Chapter ${chapter} packaged reading support is invalid JSON (${error instanceof Error ? error.message : String(error)})`);
  }
  if (!isRecord(document) || !Array.isArray(document.audienceSections)) {
    throw new Error(`${source}: Chapter ${chapter} reading support has no audienceSections for ${eastAsianFullNamePresentationPolicyName}`);
  }
  const section = document.audienceSections.find(candidate => isRecord(candidate) && candidate.sourceHeading === "Brief Introduction");
  if (!isRecord(section)) {
    throw new Error(`${source}: Chapter ${chapter} reading support has no Brief Introduction projection for ${eastAsianFullNamePresentationPolicyName}`);
  }
  for (const audience of ["normal", "expert"] as const) {
    const prose = section[audience];
    if (typeof prose !== "string" || prose.trim() === "") {
      throw new Error(`${source}: Chapter ${chapter} ${audience} Brief Introduction is missing under ${eastAsianFullNamePresentationPolicyName}`);
    }
    if (/\bCAST-\d{3}\b/u.test(prose)) {
      throw new Error(`${source}: Chapter ${chapter} ${audience} Brief Introduction exposes an internal cast ID`);
    }
    for (const id of primaryIds) {
      const label = requiredFullNames.get(id) ?? functionsById.get(id)?.roleLabel;
      if (label !== undefined && !containsExactLabel(prose, label)) {
        throw new Error(`${source}: Chapter ${chapter} ${audience} Brief Introduction omits ${id}; expected exact ${JSON.stringify(label)} under ${eastAsianFullNamePresentationPolicyName}`);
      }
    }
  }
}

function containsExactLabel(text: string, label: string): boolean {
  const normalizedText = text.normalize("NFC");
  const normalizedLabel = label.normalize("NFC");
  if (/^[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}\p{Script=Thai}]+$/u.test(normalizedLabel)) {
    return normalizedText.includes(normalizedLabel);
  }
  if (/^[\p{L}\p{N}_ ]+$/u.test(normalizedLabel) && /[\p{L}\p{N}_]/u.test(normalizedLabel)) {
    const escaped = normalizedLabel.replace(/[\\^$.*+?()[\]{}|]/gu, "\\$&");
    return new RegExp(`(^|[^\\p{L}\\p{N}_])${escaped}([^\\p{L}\\p{N}_]|$)`, "u").test(normalizedText);
  }
  return normalizedText.includes(normalizedLabel);
}

function canonicalNameForms(person: Pick<CanonicalPersonV2, "displayName" | "traditionalDisplayName" | "simplifiedDisplayName">): readonly string[] {
  return [person.displayName, person.traditionalDisplayName, person.simplifiedDisplayName]
    .filter((value): value is string => typeof value === "string" && value.trim() !== "")
    .filter((value, index, all) => all.indexOf(value) === index);
}

function assertOnlyKeys(value: Record<string, unknown>, allowed: ReadonlySet<string>, source: string): void {
  const extra = Object.keys(value).find(key => !allowed.has(key));
  if (extra !== undefined) throw new Error(`${source}: unsupported field ${extra}; functional participants cannot acquire biography, continuity, cast relationships, or stable personal history`);
}

function stringArray(value: unknown, source: string): string[] {
  if (!Array.isArray(value) || value.some(item => typeof item !== "string")) throw new Error(`${source} must be a string array`);
  return value as string[];
}

function firstDuplicate(values: readonly string[]): string | undefined {
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) return value;
    seen.add(value);
  }
  return undefined;
}

function assertUniqueUses(values: readonly PrimaryReadingParticipant[], source: string): void {
  const duplicate = firstDuplicate(values.map(value => `${value.participantId}\u0000${value.kind}\u0000${normalizeLabel(value.label)}`));
  if (duplicate !== undefined) throw new Error(`${source}: duplicate primary participant declaration`);
}

function assertUniqueProjections(values: readonly ProjectedParticipant[], source: string): void {
  const duplicate = firstDuplicate(values.map(value => `${value.participantId}\u0000${normalizeLabel(value.label)}`));
  if (duplicate !== undefined) throw new Error(`${source}: duplicate participant projection declaration`);
}

function normalizeLabel(value: string): string {
  return value.normalize("NFKC").replace(/\s+/gu, " ").trim().toLocaleLowerCase();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
