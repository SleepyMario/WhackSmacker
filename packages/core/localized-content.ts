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
  const selected = usableString(value[locale]);
  if (selected !== undefined) {
    return selected;
  }
  const fallback = usableString(value[fallbackLocale]);
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
