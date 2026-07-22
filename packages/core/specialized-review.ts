export interface SpecializedReviewPackageDefinition {
  readonly targetId: string;
  readonly packageId: string;
  readonly languagePackageId: string;
  readonly languageDisplayName: string;
  readonly deckDisplayName: string;
  readonly targetLanguage: string;
  readonly languages: readonly string[];
  readonly sourcePath: string;
}

export const specializedReviewPackageDefinitions: readonly SpecializedReviewPackageDefinition[] = [
  {
    targetId: "dutch-specialized-medical-1",
    packageId: "com.sleepymario.language.dutch.specialized.medical-1",
    languagePackageId: "com.sleepymario.language.dutch",
    languageDisplayName: "Dutch",
    deckDisplayName: "Medical I",
    targetLanguage: "nl",
    languages: ["nl", "en"],
    sourcePath: "../language-curriculum-specialized/specialized-content/medical/dutch-english"
  },
  {
    targetId: "chinese-traditional-specialized-medical-1",
    packageId: "com.sleepymario.language.chinese-traditional.specialized.medical-1",
    languagePackageId: "com.sleepymario.language.chinese-traditional",
    languageDisplayName: "Chinese (Traditional)",
    deckDisplayName: "Medical I",
    targetLanguage: "zh-Hant",
    languages: ["en", "zh-Hant"],
    sourcePath: "../language-curriculum-specialized/specialized-content/medical/english-chinese-traditional"
  }
];

export function specializedReviewPackageDefinition(packageId: string): SpecializedReviewPackageDefinition | undefined {
  return specializedReviewPackageDefinitions.find((definition) => definition.packageId === packageId);
}
