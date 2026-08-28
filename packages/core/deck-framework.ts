import type { LocalizedContentValue } from "./localized-content";

export const knownMediaPolicies = ["none", "optional", "required"] as const;
export type MediaPolicy = (typeof knownMediaPolicies)[number];

export const knownOutputRevealModes = ["together", "sequential"] as const;
export const knownOutputSatisfactionModes = ["one", "all"] as const;
export const knownOutputGradingModes = ["shared", "output-specific"] as const;
export const knownReverseCardModes = ["combined", "per-output", "precomposed"] as const;
export const knownOutputLabelModes = ["none", "independent"] as const;
export const knownOutputMediaModes = ["none", "shared", "output-specific"] as const;

export interface DeckInteractionProfile {
  readonly reveal: (typeof knownOutputRevealModes)[number];
  readonly satisfaction: (typeof knownOutputSatisfactionModes)[number];
  readonly grading: (typeof knownOutputGradingModes)[number];
  readonly reverseCards: (typeof knownReverseCardModes)[number];
  readonly labels: (typeof knownOutputLabelModes)[number];
  readonly outputMedia: (typeof knownOutputMediaModes)[number];
}

export const defaultDeckInteractionProfile: DeckInteractionProfile = Object.freeze({
  reveal: "together",
  satisfaction: "all",
  grading: "shared",
  reverseCards: "precomposed",
  labels: "none",
  outputMedia: "none"
});

export interface DeckFrameworkVersionIdentity {
  readonly deckVersion: string;
  readonly artifactRevision: number;
}

export interface LegacyPackageVersionProjection {
  readonly packageVersion: string;
  readonly deckVersion?: string;
  readonly artifactRevision?: number;
}

export interface UniversalEntryOutput<TContent = LocalizedContentValue> {
  readonly id: string;
  readonly label?: LocalizedContentValue;
  readonly content: TContent;
}

export interface UniversalEntryMediaBinding {
  readonly id: string;
  readonly side: "input" | "shared-output" | "output";
  readonly outputId?: string;
  readonly role: string;
  readonly path: string;
  readonly mediaType: "image/png" | "image/jpeg" | "image/webp";
  readonly sha256: string;
  readonly size: number;
  readonly width: number;
  readonly height: number;
  readonly approval: "approved" | "draft" | "rejected";
  readonly placeholder?: boolean;
}

export interface UniversalDeckEntry<TInput = LocalizedContentValue, TOutput = LocalizedContentValue> {
  readonly entryId: string;
  readonly input: TInput;
  readonly outputs: readonly UniversalEntryOutput<TOutput>[];
  readonly interaction: DeckInteractionProfile;
  readonly media: readonly UniversalEntryMediaBinding[];
}

export interface DeckFrameworkValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
}

export function validateDeckFrameworkVersion(
  value: LegacyPackageVersionProjection,
  field = "package"
): DeckFrameworkValidationResult {
  const errors: string[] = [];
  if (value.deckVersion !== undefined && !isSemver(value.deckVersion)) {
    errors.push(`${field}.deckVersion must use MAJOR.MINOR.PATCH Semantic Versioning.`);
  }
  if (value.artifactRevision !== undefined && (!Number.isSafeInteger(value.artifactRevision) || value.artifactRevision < 1)) {
    errors.push(`${field}.artifactRevision must be a positive integer.`);
  }
  if ((value.deckVersion === undefined) !== (value.artifactRevision === undefined)) {
    errors.push(`${field}.deckVersion and artifactRevision must be declared together.`);
  }
  return { valid: errors.length === 0, errors };
}

export function projectDeckFrameworkVersion(value: LegacyPackageVersionProjection): DeckFrameworkVersionIdentity {
  return {
    deckVersion: value.deckVersion ?? value.packageVersion,
    artifactRevision: value.artifactRevision ?? 1
  };
}

export function immutableDeckArtifactKey(packageId: string, value: LegacyPackageVersionProjection): string {
  const projected = projectDeckFrameworkVersion(value);
  return `${packageId}@${projected.deckVersion}#${projected.artifactRevision}`;
}

export function compareDeckFrameworkVersions(left: LegacyPackageVersionProjection, right: LegacyPackageVersionProjection): number {
  const leftVersion = projectDeckFrameworkVersion(left);
  const rightVersion = projectDeckFrameworkVersion(right);
  const semantic = compareSemver(leftVersion.deckVersion, rightVersion.deckVersion);
  return semantic === 0 ? leftVersion.artifactRevision - rightVersion.artifactRevision : semantic;
}

export function validateMediaPolicy(value: unknown, field = "mediaPolicy"): DeckFrameworkValidationResult {
  return knownMediaPolicies.includes(value as MediaPolicy)
    ? { valid: true, errors: [] }
    : { valid: false, errors: [`${field} must be none, optional, or required.`] };
}

export function validateDeckInteractionProfile(value: unknown, field = "interactionProfile"): DeckFrameworkValidationResult {
  const errors: string[] = [];
  if (!isRecord(value)) return { valid: false, errors: [`${field} must be an object.`] };
  validateEnum(value.reveal, knownOutputRevealModes, `${field}.reveal`, errors);
  validateEnum(value.satisfaction, knownOutputSatisfactionModes, `${field}.satisfaction`, errors);
  validateEnum(value.grading, knownOutputGradingModes, `${field}.grading`, errors);
  validateEnum(value.reverseCards, knownReverseCardModes, `${field}.reverseCards`, errors);
  validateEnum(value.labels, knownOutputLabelModes, `${field}.labels`, errors);
  validateEnum(value.outputMedia, knownOutputMediaModes, `${field}.outputMedia`, errors);
  if (value.reveal === "sequential" && value.grading === "shared") {
    errors.push(`${field} cannot use sequential reveal with shared grading.`);
  }
  if (value.grading === "output-specific" && value.satisfaction === "one") {
    errors.push(`${field} cannot use output-specific grading when one output satisfies the answer.`);
  }
  return { valid: errors.length === 0, errors };
}

export function validateUniversalDeckEntry(value: unknown, mediaPolicy: MediaPolicy): DeckFrameworkValidationResult {
  const errors: string[] = [];
  if (!isRecord(value)) return { valid: false, errors: ["entry must be an object."] };
  if (!isStableId(value.entryId)) errors.push("entry.entryId must be a stable ID.");
  if (!Array.isArray(value.outputs) || value.outputs.length < 1) {
    errors.push("entry.outputs must contain at least one output.");
  } else {
    const ids = new Set<string>();
    for (const [index, output] of value.outputs.entries()) {
      if (!isRecord(output) || !isStableId(output.id)) errors.push(`entry.outputs[${index}].id must be a stable ID.`);
      else if (ids.has(output.id as string)) errors.push(`entry.outputs contains duplicate ID: ${String(output.id)}`);
      else ids.add(output.id as string);
      if (!isRecord(output) || !("content" in output)) errors.push(`entry.outputs[${index}].content is required.`);
    }
  }
  errors.push(...validateDeckInteractionProfile(value.interaction, "entry.interaction").errors);
  if (!Array.isArray(value.media)) errors.push("entry.media must be an array.");
  else validateMediaBindings(value.media, value.outputs, mediaPolicy, errors);
  return { valid: errors.length === 0, errors };
}

function validateMediaBindings(media: readonly unknown[], outputs: unknown, mediaPolicy: MediaPolicy, errors: string[]): void {
  const outputIds = new Set(Array.isArray(outputs) ? outputs.flatMap((output) => isRecord(output) && typeof output.id === "string" ? [output.id] : []) : []);
  const identities = new Set<string>();
  for (const [index, binding] of media.entries()) {
    const field = `entry.media[${index}]`;
    if (!isRecord(binding)) { errors.push(`${field} must be an object.`); continue; }
    if (!isStableId(binding.id)) errors.push(`${field}.id must be a stable ID.`);
    if (binding.side !== "input" && binding.side !== "shared-output" && binding.side !== "output") errors.push(`${field}.side is unsupported.`);
    if (binding.side === "output" && (typeof binding.outputId !== "string" || !outputIds.has(binding.outputId))) errors.push(`${field}.outputId must reference an output.`);
    if (binding.side !== "output" && binding.outputId !== undefined) errors.push(`${field}.outputId is allowed only for output-specific media.`);
    if (typeof binding.role !== "string" || !/^[a-z0-9][a-z0-9-]*$/u.test(binding.role)) errors.push(`${field}.role must be a stable lowercase slug.`);
    if (typeof binding.path !== "string" || !isSafePath(binding.path)) errors.push(`${field}.path must be a safe package-relative path.`);
    if (!/^[a-f0-9]{64}$/u.test(typeof binding.sha256 === "string" ? binding.sha256 : "")) errors.push(`${field}.sha256 must be a lowercase SHA-256 digest.`);
    for (const key of ["size", "width", "height"] as const) if (!Number.isSafeInteger(binding[key]) || (binding[key] as number) < 1) errors.push(`${field}.${key} must be a positive integer.`);
    if (binding.approval !== "approved" && binding.approval !== "draft" && binding.approval !== "rejected") errors.push(`${field}.approval is unsupported.`);
    const identity = `${String(binding.side)}\0${String(binding.outputId ?? "")}\0${String(binding.role)}`;
    if (identities.has(identity)) errors.push(`${field} duplicates entryId + side/outputId + role.`);
    identities.add(identity);
  }
  if (mediaPolicy === "none" && media.length > 0) errors.push("mediaPolicy none forbids media bindings.");
  if (mediaPolicy === "required" && media.some((binding) => !isRecord(binding) || binding.approval !== "approved" || binding.placeholder === true)) {
    errors.push("mediaPolicy required accepts only approved non-placeholder media for production readiness.");
  }
}

function validateEnum(value: unknown, allowed: readonly string[], field: string, errors: string[]): void {
  if (typeof value !== "string" || !allowed.includes(value)) errors.push(`${field} is unsupported.`);
}

function isStableId(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && !/[\0\r\n\t]/u.test(value);
}

function isSafePath(value: string): boolean {
  return value.length > 0 && !value.startsWith("/") && !value.includes("\\") && !value.split("/").some((part) => part === "" || part === "." || part === "..");
}

function isSemver(value: string): boolean {
  return /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/u.test(value);
}

function compareSemver(left: string, right: string): number {
  const leftParts = left.split(".").map(Number);
  const rightParts = right.split(".").map(Number);
  for (let index = 0; index < 3; index += 1) {
    const difference = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);
    if (difference !== 0) return difference;
  }
  return 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
