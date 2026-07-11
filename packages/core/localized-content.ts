export type LocalizedContentMap = Readonly<Record<string, string>>;
export type LocalizedContentValue = string | LocalizedContentMap;

export function localized(
  value: LocalizedContentValue | null | undefined,
  locale: string,
  fallbackLocale = "en-US"
): string {
  if (typeof value === "string") {
    return value;
  }
  if (value === null || value === undefined || typeof value !== "object" || Array.isArray(value)) {
    return "";
  }
  const selected = localeCandidates(locale).map((candidate) => usableString(value[candidate])).find((candidate) => candidate !== undefined);
  if (selected !== undefined) {
    return selected;
  }
  const fallback = localeCandidates(fallbackLocale).map((candidate) => usableString(value[candidate])).find((candidate) => candidate !== undefined);
  if (fallback !== undefined) {
    return fallback;
  }
  for (const key of Object.keys(value).sort()) {
    const candidate = usableString(value[key]);
    if (candidate !== undefined) {
      return candidate;
    }
  }
  return "";
}

function localeCandidates(locale: string): readonly string[] {
  const normalized = locale.trim();
  if (normalized === "zh-Hant-TW" || normalized === "zh-TW") {
    return [normalized, "zh-TW", "zh-Hant-TW"];
  }
  if (normalized === "en-US" || normalized === "en") {
    return [normalized, "en", "en-US"];
  }
  return [normalized];
}

export function isLocalizedContentValue(value: unknown, allowEmptyString = false): value is LocalizedContentValue {
  if (typeof value === "string") {
    return allowEmptyString || value.trim().length > 0;
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const entries = Object.entries(value);
  return entries.length > 0 && entries.every(([locale, text]) =>
    locale.trim().length > 0 && typeof text === "string" && (allowEmptyString || text.trim().length > 0)
  );
}

function usableString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}
