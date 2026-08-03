import type { ContentPackageFileRecord } from "./content-package-spec";

export const supportedPackageImageMediaTypes = ["image/webp", "image/png", "image/jpeg"] as const;
export type SupportedPackageImageMediaType = (typeof supportedPackageImageMediaTypes)[number];

export interface MemorizationMarkdownImage {
  readonly alt: string;
  readonly path: string;
  readonly start: number;
  readonly end: number;
}

const markdownImagePattern = /!\[([^\]\r\n]*)\]\(([^)\r\n]*)\)/gu;

export function packageImageMediaTypeForPath(path: string): SupportedPackageImageMediaType | undefined {
  if (path.endsWith(".webp")) return "image/webp";
  if (path.endsWith(".png")) return "image/png";
  if (path.endsWith(".jpg") || path.endsWith(".jpeg")) return "image/jpeg";
  return undefined;
}

export function isSafePackageImagePath(path: string): boolean {
  if (!path.startsWith("media/") || path.length === "media/".length) return false;
  if (path.startsWith("/") || path.includes("\\") || path.includes("\0")) return false;
  if (path.includes("?") || path.includes("#") || path.includes(":")) return false;
  if (path.includes("%") || /^(?:[a-z]:|\/\/)/iu.test(path)) return false;
  const segments = path.split("/");
  if (segments.some((segment) => segment.length === 0 || segment === "." || segment === "..")) return false;
  return packageImageMediaTypeForPath(path) !== undefined;
}

export function parseMemorizationMarkdownImages(markdown: string): readonly MemorizationMarkdownImage[] {
  const images: MemorizationMarkdownImage[] = [];
  markdownImagePattern.lastIndex = 0;
  for (const match of markdown.matchAll(markdownImagePattern)) {
    const alt = match[1] ?? "";
    const path = match[2] ?? "";
    if (alt.trim().length === 0) {
      throw new Error("Markdown package images require non-empty alt text.");
    }
    if (alt !== alt.trim() || /[\u0000-\u001f\u007f]/u.test(alt)) {
      throw new Error("Markdown package image alt text must be trimmed and contain no control characters.");
    }
    if (!isSafePackageImagePath(path)) {
      throw new Error(`Unsafe or unsupported Markdown package image path: ${path}`);
    }
    images.push({ alt, path, start: match.index ?? 0, end: (match.index ?? 0) + match[0].length });
  }
  return images;
}

export function markdownWithImagePlaceholders(markdown: string): string {
  return replaceMarkdownImages(markdown, (image) => `[Image: ${image.alt}]`);
}

export function markdownForPedagogicalFingerprint(markdown: string): string {
  return replaceMarkdownImages(markdown, (image) => `![${image.alt}](media/package-image)`);
}

function replaceMarkdownImages(markdown: string, replacement: (image: MemorizationMarkdownImage) => string): string {
  const images = parseMemorizationMarkdownImages(markdown);
  if (images.length === 0) return markdown;
  let output = "";
  let offset = 0;
  for (const image of images) {
    output += markdown.slice(offset, image.start);
    output += replacement(image);
    offset = image.end;
  }
  return output + markdown.slice(offset);
}

export function memorizationMediaReferences(value: unknown): readonly MemorizationMarkdownImage[] {
  const records = collectionItems(value);
  const references: MemorizationMarkdownImage[] = [];
  for (const item of records) {
    for (const side of [item.prompt, item.answer]) {
      if (!isRecord(side) || side.mediaType !== "text/markdown") continue;
      for (const text of localizedStrings(side.text)) references.push(...parseMemorizationMarkdownImages(text));
    }
    if (Array.isArray(item.acceptedAnswers)) {
      for (const answer of item.acceptedAnswers) {
        if (typeof answer === "string") references.push(...parseMemorizationMarkdownImages(answer));
      }
    }
  }
  return references;
}

export function assertMemorizationMediaManifestReferences(
  value: unknown,
  files: readonly ContentPackageFileRecord[]
): readonly MemorizationMarkdownImage[] {
  const references = memorizationMediaReferences(value);
  const records = new Map<string, ContentPackageFileRecord>();
  for (const file of files) {
    if (records.has(file.path)) throw new Error(`Duplicate or ambiguous package asset path: ${file.path}`);
    records.set(file.path, file);
  }
  for (const reference of references) {
    const record = records.get(reference.path);
    if (record === undefined) throw new Error(`Markdown package image is missing from package metadata: ${reference.path}`);
    const expectedMediaType = packageImageMediaTypeForPath(reference.path);
    if (record.mediaType !== expectedMediaType) {
      throw new Error(`Markdown package image MIME type mismatch for ${reference.path}: expected ${expectedMediaType}, got ${record.mediaType}`);
    }
  }
  return references;
}

function collectionItems(value: unknown): readonly Record<string, unknown>[] {
  if (!isRecord(value)) return [];
  if (Array.isArray(value.items)) return value.items.filter(isRecord);
  return [value];
}

function localizedStrings(value: unknown): readonly string[] {
  if (typeof value === "string") return [value];
  if (!isRecord(value)) return [];
  return Object.values(value).filter((candidate): candidate is string => typeof candidate === "string");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
