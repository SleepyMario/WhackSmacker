import { isSourceLocale, type SourceLocale } from "../i18n";
import {
  defaultNewVocabularyDisplayPreferences,
  isVocabularyEntrySpacing,
  type NewVocabularyDisplayPreferences
} from "../../packages/core/vocabulary-rendering";
import { perfCount, perfSpan, perfSpanSync } from "../../packages/core/performance";

declare function require(name: "node:fs/promises"): {
  mkdir(path: string, options: { recursive: boolean }): Promise<void>;
  readFile(path: string, encoding: "utf8"): Promise<string>;
  rename(oldPath: string, newPath: string): Promise<void>;
  writeFile(path: string, data: string, encoding: "utf8"): Promise<void>;
};
declare function require(name: "node:path"): {
  dirname(path: string): string;
  join(...paths: string[]): string;
  resolve(path: string): string;
};
declare const process: { env: Record<string, string | undefined>; pid: number };

const { mkdir, readFile, rename, writeFile } = require("node:fs/promises");
const { dirname, join, resolve } = require("node:path");

export const sourceLanguageSettingsFormatVersion = 2;

export interface SourceLanguageSettings {
  readonly settingsFormatVersion: 2;
  readonly sourceLanguage: SourceLocale;
  readonly newVocabulary: NewVocabularyDisplayPreferences;
}

export function defaultSourceLanguageSettings(): SourceLanguageSettings {
  return {
    settingsFormatVersion: sourceLanguageSettingsFormatVersion,
    sourceLanguage: "en-US",
    newVocabulary: defaultNewVocabularyDisplayPreferences
  };
}

export function resolveSettingsDirectory(settingsDir?: string, env = process.env): string {
  if (settingsDir !== undefined && settingsDir.trim().length > 0) {
    return resolve(settingsDir);
  }
  if (env.XDG_DATA_HOME !== undefined && env.XDG_DATA_HOME.trim().length > 0) {
    return join(env.XDG_DATA_HOME, "whacksmacker", "settings");
  }
  if (env.HOME === undefined || env.HOME.trim().length === 0) {
    throw new Error("Cannot resolve WhackSmacker settings without HOME or XDG_DATA_HOME.");
  }
  return join(env.HOME, ".local", "share", "whacksmacker", "settings");
}

export function defaultSettingsDirectoryForContentDataDirectory(contentDataDir: string): string {
  return join(dirname(resolve(contentDataDir)), "settings");
}

export function sourceLanguageSettingsPath(settingsDir?: string): string {
  return join(resolveSettingsDirectory(settingsDir), "settings.json");
}

export async function loadSourceLanguageSettings(settingsDir?: string): Promise<SourceLanguageSettings> {
  return perfSpan("settings.load", { settingsDir: settingsDir ?? "default" }, async () => {
  try {
    perfCount("filesystem.read.count");
    const text = await readFile(sourceLanguageSettingsPath(settingsDir), "utf8");
    const value = perfSpanSync("json.parse", { kind: "settings" }, () => {
      perfCount("json.parse.count");
      return JSON.parse(text) as unknown;
    });
    return normalizeSourceLanguageSettings(value);
  } catch (error) {
    if (isMissingFileError(error) || error instanceof SyntaxError) {
      return defaultSourceLanguageSettings();
    }
    throw error;
  }
  });
}

export async function saveSourceLanguage(sourceLanguage: SourceLocale, settingsDir?: string): Promise<string> {
  const current = await loadSourceLanguageSettings(settingsDir);
  return writeSourceLanguageSettings({ ...current, sourceLanguage }, settingsDir);
}

export async function saveNewVocabularyDisplayPreferences(
  newVocabulary: NewVocabularyDisplayPreferences,
  settingsDir?: string
): Promise<string> {
  const current = await loadSourceLanguageSettings(settingsDir);
  return writeSourceLanguageSettings({ ...current, newVocabulary }, settingsDir);
}

async function writeSourceLanguageSettings(settings: SourceLanguageSettings, settingsDir?: string): Promise<string> {
  const directory = resolveSettingsDirectory(settingsDir);
  const path = join(directory, "settings.json");
  const temporaryPath = `${path}.${process.pid}.tmp`;
  await mkdir(directory, { recursive: true });
  await writeFile(temporaryPath, `${JSON.stringify(settings, null, 2)}\n`, "utf8");
  await rename(temporaryPath, path);
  return path;
}

function normalizeSourceLanguageSettings(value: unknown): SourceLanguageSettings {
  const defaults = defaultSourceLanguageSettings();
  if (typeof value !== "object" || value === null) return defaults;
  const record = value as Record<string, unknown>;
  const sourceLanguage = isSourceLocale(record.sourceLanguage) ? record.sourceLanguage : defaults.sourceLanguage;
  const nested = typeof record.newVocabulary === "object" && record.newVocabulary !== null
    ? record.newVocabulary as Record<string, unknown>
    : {};
  const notesVisible = typeof nested.notesVisible === "boolean"
    ? nested.notesVisible
    : typeof record.notesEnabled === "boolean"
      ? record.notesEnabled
      : defaults.newVocabulary.notesVisible;
  const entrySpacing = isVocabularyEntrySpacing(nested.entrySpacing)
    ? nested.entrySpacing
    : defaults.newVocabulary.entrySpacing;
  return {
    settingsFormatVersion: sourceLanguageSettingsFormatVersion,
    sourceLanguage,
    newVocabulary: { notesVisible, entrySpacing }
  };
}

function isMissingFileError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}
