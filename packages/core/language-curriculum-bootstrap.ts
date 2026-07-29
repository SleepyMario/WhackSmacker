import {
  validateCanonicalCast,
  type CanonicalCastV2
} from "./canonical-cast";
import {
  chapterParticipantMetadataFileName,
  reconcileChapterParticipants
} from "./chapter-participants";
import type { ChineseScriptVariant } from "./east-asian-name-policy";
import {
  auditActiveCast,
  type ActiveCastChapterRecord
} from "./language-curriculum-policy";

export const canonicalCastBootstrapPolicyName = "ordinary-language-canonical-cast-phase-0";
export const canonicalCastBootstrapRequiredMessage =
  "The complete canonical 30-person cast must be authored and validated before Chapter 1 or any other ordinary chapter may be created, generated, accepted, packaged, or installed.";
export const castOnlyCurriculumPackageMessage =
  "A curriculum with a valid canonical cast but no ordinary chapters is a valid Phase 0 source and must remain package-less until ordinary content exists.";

export interface CurriculumBootstrapFile {
  readonly path: string;
  readonly mediaType?: string;
  readonly text: unknown;
}

export interface CanonicalCastBootstrapOptions {
  readonly sourceLabel: string;
  readonly requireOrdinaryContent: boolean;
  readonly curriculumIdentity?: string;
  readonly chineseScriptVariant?: ChineseScriptVariant;
}

export interface CanonicalCastBootstrapResult {
  readonly cast: CanonicalCastV2 | null;
  readonly chapterCount: number;
  readonly phase0Complete: true;
  readonly packageable: boolean;
  readonly legacy: boolean;
  readonly warnings: readonly string[];
}

export function assertCanonicalCastBootstrapBeforeOrdinaryContent(
  files: readonly CurriculumBootstrapFile[],
  options: CanonicalCastBootstrapOptions
): CanonicalCastBootstrapResult {
  const chapters = files.filter(file => isOrdinaryChapterPath(file.path));
  const castFile = files.find(file => file.path === "name-pools/canonical-cast.json");
  const castText = castFile === undefined ? undefined : canonicalText(castFile.text);
  if (castText === undefined) {
    throw bootstrapFailure(
      `${options.sourceLabel}: canonical-cast.json is absent or unreadable; Phase 0 is incomplete.`
    );
  }

  let castDocument: unknown;
  try {
    castDocument = JSON.parse(castText);
  } catch (error) {
    throw bootstrapFailure(
      `${options.sourceLabel}/name-pools/canonical-cast.json: invalid JSON (${error instanceof Error ? error.message : String(error)})`
    );
  }

  const validation = validateCanonicalCast(castDocument, {
    sourceFile: `${options.sourceLabel}/name-pools/canonical-cast.json`
  });
  if (validation.errors.length > 0) {
    throw bootstrapFailure(validation.errors.join("\n"));
  }

  if (chapters.length === 0) {
    if (options.requireOrdinaryContent) {
      throw bootstrapFailure(castOnlyCurriculumPackageMessage);
    }
    return {
      cast: validation.legacy ? null : castDocument as CanonicalCastV2,
      chapterCount: 0,
      phase0Complete: true,
      packageable: false,
      legacy: validation.legacy,
      warnings: validation.warnings
    };
  }

  if (validation.legacy) {
    return {
      cast: null,
      chapterCount: chapters.length,
      phase0Complete: true,
      packageable: true,
      legacy: true,
      warnings: validation.warnings
    };
  }

  const cast = castDocument as CanonicalCastV2;
  const auditChapters: ActiveCastChapterRecord[] = [];
  for (const chapterFile of chapters) {
    const chapterText = canonicalText(chapterFile.text);
    if (chapterText === undefined) {
      throw bootstrapFailure(`${options.sourceLabel}/${chapterFile.path}: ordinary chapter text is unreadable.`);
    }
    const chapterDirectory = dirname(chapterFile.path);
    const participantPath = `${chapterDirectory}/${chapterParticipantMetadataFileName}`;
    const participantFile = files.find(file => file.path === participantPath);
    const participantText = participantFile === undefined ? undefined : canonicalText(participantFile.text);
    if (participantText === undefined) {
      throw bootstrapFailure(
        `${options.sourceLabel}/${chapterFile.path}: strengthened-cast chapter is missing required ${chapterParticipantMetadataFileName}.`
      );
    }
    let participants: unknown;
    try {
      participants = JSON.parse(participantText);
    } catch (error) {
      throw bootstrapFailure(
        `${options.sourceLabel}/${participantPath}: invalid JSON (${error instanceof Error ? error.message : String(error)})`
      );
    }
    const translation = files.find(file => file.path === `${chapterDirectory}/reading-translation.en.json`);
    const support = files.find(file => file.path === `${chapterDirectory}/reading-support.json`);
    const translationText = translation === undefined ? undefined : canonicalText(translation.text);
    const supportText = support === undefined ? undefined : canonicalText(support.text);
    try {
      const reconciled = reconcileChapterParticipants(participants, {
        sourceFile: `${options.sourceLabel}/${participantPath}`,
        chapterMarkdown: chapterText,
        canonicalCast: cast.cast,
        activeCastProgression: cast.activeCast.progression,
        ...(options.curriculumIdentity === undefined ? {} : { curriculumIdentity: options.curriculumIdentity }),
        ...(options.chineseScriptVariant === undefined ? {} : { chineseScriptVariant: options.chineseScriptVariant }),
        ...(translationText === undefined ? {} : { translationText }),
        ...(supportText === undefined ? {} : { supportText })
      });
      auditChapters.push({
        chapter: reconciled.chapter,
        authorship: "new",
        migrationStatus: "compliant",
        participatingPersonIds: reconciled.canonicalCastIds,
        meaningfulPersonIds: reconciled.canonicalCastIds
      });
    } catch (error) {
      throw bootstrapFailure(error instanceof Error ? error.message : String(error));
    }
  }

  let auditWarnings: readonly string[] = [];
  try {
    auditWarnings = auditActiveCast({
      canonicalPersonIds: cast.cast.map((person) => person.id),
      progression: cast.activeCast.progression,
      chapters: auditChapters
    }).warnings;
  } catch (error) {
    throw bootstrapFailure(error instanceof Error ? error.message : String(error));
  }

  return {
    cast,
    chapterCount: chapters.length,
    phase0Complete: true,
    packageable: true,
    legacy: false,
    warnings: [...validation.warnings, ...auditWarnings]
  };
}

export function assertCanonicalCastBootstrapSnapshot(
  snapshot: unknown,
  options: CanonicalCastBootstrapOptions
): CanonicalCastBootstrapResult {
  if (!isRecord(snapshot) || snapshot.contentSchema !== "whacksmacker-source-markdown-snapshot-v1" || !Array.isArray(snapshot.files)) {
    throw bootstrapFailure(`${options.sourceLabel}: language curriculum content is not a readable source snapshot.`);
  }
  const files: CurriculumBootstrapFile[] = snapshot.files.map((candidate, index) => {
    if (!isRecord(candidate) || typeof candidate.path !== "string") {
      throw bootstrapFailure(`${options.sourceLabel}: source snapshot file ${index} has no valid package-relative path.`);
    }
    return {
      path: candidate.path,
      ...(typeof candidate.mediaType === "string" ? { mediaType: candidate.mediaType } : {}),
      text: candidate.text
    };
  });
  return assertCanonicalCastBootstrapBeforeOrdinaryContent(files, options);
}

function bootstrapFailure(detail: string): Error {
  return new Error(`${canonicalCastBootstrapRequiredMessage}\n${detail}`);
}

function isOrdinaryChapterPath(path: string): boolean {
  return /^units\/.+\/chapter-\d+[^/]*\/chapter\.md$/u.test(path)
    && !/-foundation\//u.test(path)
    && !/-grammar-(?:easy|hard)\/chapter\.md$/u.test(path);
}

function dirname(path: string): string {
  const index = path.lastIndexOf("/");
  return index < 0 ? "." : path.slice(0, index);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function canonicalText(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (!isRecord(value)) return undefined;
  for (const locale of ["en", "en-US", "zh-TW"]) {
    if (typeof value[locale] === "string") return value[locale];
  }
  return Object.values(value).find((candidate): candidate is string => typeof candidate === "string");
}
