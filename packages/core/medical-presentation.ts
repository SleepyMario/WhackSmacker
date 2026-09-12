import type { MemorizationItem, MemorizationContentBlock } from "./memorization-item";
import { localized } from "./localized-content";

export function isMedicalItem(item: MemorizationItem): boolean {
  return item.tags?.includes("medical") === true;
}

export function medicalArtworkAllowed(item: MemorizationItem, side: "prompt" | "answer" = "prompt"): boolean {
  if (!isMedicalItem(item)) return true;
  if (side === "answer") return true;
  const base = item.language?.base;
  const phrase = item.prompt.language;
  return base !== undefined && phrase !== undefined
    && base.toLowerCase().split("-")[0] === phrase.toLowerCase().split("-")[0];
}

const categories: Readonly<Record<string, string>> = {
  terminology: "medical terminology", cardiovascular: "the cardiovascular system",
  respiratory: "the respiratory system", digestive: "the digestive system",
  nervous: "the nervous system", musculoskeletal: "the musculoskeletal system",
  endocrine: "the endocrine system", "urinary-reproductive": "urology and reproductive medicine",
  "hematology-lymphatic": "hematology and the lymphatic system",
  pediatrics: "pediatrics", "health-insurance": "health insurance"
};

/** Display-only projection: never rewrite stored cards or scheduler fingerprints. */
export function medicalPresentation(item: MemorizationItem, locale: string): MemorizationItem {
  if (!isMedicalItem(item)) return item;
  const category = item.tags?.map(tag => categories[tag]).find(Boolean);
  const notes = `Part of ${category ?? "medicine"}.`;
  if (medicalArtworkAllowed(item)) return { ...item, notes };
  const strip = (block: MemorizationContentBlock): MemorizationContentBlock => {
    const text = localized(block.text, locale)
      .replace(/!\[[^\]]*\]\([^)]*\)/gu, "")
      .replace(/^Artwork:\s*$/gmu, "").trim();
    return { ...block, text, plainText: text, mediaType: "text/plain" };
  };
  return {
    ...item, notes, prompt: strip(item.prompt)
  };
}
