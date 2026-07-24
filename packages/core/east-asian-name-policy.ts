import type { CanonicalPersonV2 } from "./canonical-cast";

export const eastAsianFullNamePresentationPolicyName = "east-asian-full-name-presentation-policy";

export type EastAsianCurriculumLanguage = "chinese" | "japanese" | "korean";
export type ChineseScriptVariant = "traditional" | "simplified";

export interface EastAsianNamePolicyContext {
  readonly language: EastAsianCurriculumLanguage;
  readonly chineseScriptVariant?: ChineseScriptVariant;
}

export function eastAsianNamePolicyContext(
  curriculumIdentity: string | undefined,
  chineseScriptVariant?: ChineseScriptVariant
): EastAsianNamePolicyContext | undefined {
  if (curriculumIdentity === undefined) return undefined;
  const normalized = curriculumIdentity.toLocaleLowerCase();
  const language = normalized.includes("chinese") || normalized.includes("mandarin")
    ? "chinese"
    : normalized.includes("japanese")
      ? "japanese"
      : normalized.includes("korean")
        ? "korean"
        : undefined;
  if (language === undefined) return undefined;
  const inferredChineseScriptVariant = language === "chinese"
    ? chineseScriptVariant
      ?? (/(?:traditional|zh-hant)/u.test(normalized)
        ? "traditional"
        : /(?:simplified|zh-hans)/u.test(normalized)
          ? "simplified"
          : undefined)
    : undefined;
  return {
    language,
    ...(inferredChineseScriptVariant === undefined ? {} : { chineseScriptVariant: inferredChineseScriptVariant })
  };
}

export function canonicalFullNameForEastAsianPolicy(
  person: Pick<CanonicalPersonV2, "id" | "displayName" | "traditionalDisplayName" | "simplifiedDisplayName">,
  context: EastAsianNamePolicyContext
): string {
  if (context.language === "chinese") {
    if (context.chineseScriptVariant === undefined) {
      throw new Error(`${eastAsianFullNamePresentationPolicyName}: Chinese curriculum context must distinguish traditional or simplified script`);
    }
    const selected = context.chineseScriptVariant === "traditional"
      ? person.traditionalDisplayName
      : person.simplifiedDisplayName;
    if (typeof selected !== "string" || selected.trim() === "") {
      throw new Error(`${eastAsianFullNamePresentationPolicyName}: ${person.id} has no ${context.chineseScriptVariant} canonical full name`);
    }
    if (!/^\p{Script=Han}+$/u.test(selected)) {
      throw new Error(`${eastAsianFullNamePresentationPolicyName}: ${person.id} ${context.chineseScriptVariant} canonical full name ${JSON.stringify(selected)} has a full-name script mismatch; expected Han characters`);
    }
    return selected;
  }
  const expectedScript = context.language === "japanese"
    ? /^[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}々〆ヵヶー・]+$/u
    : /^\p{Script=Hangul}+$/u;
  if (!expectedScript.test(person.displayName)) {
    throw new Error(`${eastAsianFullNamePresentationPolicyName}: ${person.id} canonical full name ${JSON.stringify(person.displayName)} has a full-name script mismatch for ${context.language}`);
  }
  return person.displayName;
}

export function isEastAsianFullNamePolicyEnabled(curriculumIdentity: string | undefined): boolean {
  return eastAsianNamePolicyContext(curriculumIdentity) !== undefined;
}
