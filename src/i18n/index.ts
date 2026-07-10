import enUS from "./locales/en-US.json";
import zhHantTW from "./locales/zh-Hant-TW.json";

export const sourceLocales = ["en-US", "zh-Hant-TW"] as const;
export type SourceLocale = (typeof sourceLocales)[number];
export type TranslationParameters = Readonly<Record<string, string | number>>;

const catalogues: Record<SourceLocale, Readonly<Record<string, string>>> = {
  "en-US": enUS,
  "zh-Hant-TW": zhHantTW
};

export function isSourceLocale(value: unknown): value is SourceLocale {
  return typeof value === "string" && sourceLocales.includes(value as SourceLocale);
}

export function translate(locale: SourceLocale, key: string, parameters: TranslationParameters = {}): string {
  const template = catalogues[locale][key] ?? catalogues["en-US"][key] ?? key;
  return template.replace(/\{([^{}]+)\}/gu, (placeholder, name: string) => {
    const value = parameters[name];
    return value === undefined ? placeholder : String(value);
  });
}

export function createTranslator(locale: SourceLocale): (key: string, parameters?: TranslationParameters) => string {
  return (key, parameters) => translate(locale, key, parameters);
}

export function sourceLocaleLabel(locale: SourceLocale, displayLocale: SourceLocale = locale): string {
  return translate(displayLocale, `locale.${locale}`);
}
