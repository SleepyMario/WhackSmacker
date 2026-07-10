import { isSourceLocale, type SourceLocale } from "../i18n";

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

export const sourceLanguageSettingsFormatVersion = 1;

export interface SourceLanguageSettings {
  readonly settingsFormatVersion: 1;
  readonly sourceLanguage: SourceLocale;
}

export function defaultSourceLanguageSettings(): SourceLanguageSettings {
  return { settingsFormatVersion: sourceLanguageSettingsFormatVersion, sourceLanguage: "en-US" };
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
  try {
    const value = JSON.parse(await readFile(sourceLanguageSettingsPath(settingsDir), "utf8")) as unknown;
    if (isSourceLanguageSettings(value)) {
      return value;
    }
    return defaultSourceLanguageSettings();
  } catch (error) {
    if (isMissingFileError(error)) {
      return defaultSourceLanguageSettings();
    }
    throw error;
  }
}

export async function saveSourceLanguage(sourceLanguage: SourceLocale, settingsDir?: string): Promise<string> {
  const directory = resolveSettingsDirectory(settingsDir);
  const path = join(directory, "settings.json");
  const temporaryPath = `${path}.${process.pid}.tmp`;
  await mkdir(directory, { recursive: true });
  await writeFile(temporaryPath, `${JSON.stringify({ settingsFormatVersion: sourceLanguageSettingsFormatVersion, sourceLanguage }, null, 2)}\n`, "utf8");
  await rename(temporaryPath, path);
  return path;
}

function isSourceLanguageSettings(value: unknown): value is SourceLanguageSettings {
  return typeof value === "object" && value !== null &&
    "settingsFormatVersion" in value && value.settingsFormatVersion === sourceLanguageSettingsFormatVersion &&
    "sourceLanguage" in value && isSourceLocale(value.sourceLanguage);
}

function isMissingFileError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}
