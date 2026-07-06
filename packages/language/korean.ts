import {
  listInstalledReadablePackages,
  listReadableContentEntries,
  readInstalledContentEntry,
  renderReadingContent,
  type ReadableContentEntry
} from "../core";

export const koreanPackageId = "com.sleepymario.language.korean";
export const hangulFoundationRoot = "units/hangul-foundation/";
export const hangulFoundationIndexPath = "units/hangul-foundation/README.md";

export interface KoreanLanguageOptions {
  readonly dataDir?: string;
  readonly packageVersion?: string;
  readonly file?: string;
}

export interface KoreanLanguageOverview {
  readonly installed: boolean;
  readonly packageId: string;
  readonly packageVersion?: string;
  readonly displayName?: string;
  readonly hangulFoundationEntries: readonly ReadableContentEntry[];
}

export async function getKoreanLanguageOverview(options: KoreanLanguageOptions = {}): Promise<KoreanLanguageOverview> {
  const installedPackages = await listInstalledReadablePackages(options.dataDir);
  const selected = installedPackages
    .filter((contentPackage) => contentPackage.packageId === koreanPackageId)
    .filter((contentPackage) => options.packageVersion === undefined || contentPackage.packageVersion === options.packageVersion)
    .sort((left, right) => compareSemver(right.packageVersion, left.packageVersion))[0];

  if (selected === undefined) {
    return {
      installed: false,
      packageId: koreanPackageId,
      packageVersion: options.packageVersion,
      hangulFoundationEntries: []
    };
  }

  const entries = await listReadableContentEntries(koreanPackageId, options.dataDir, selected.packageVersion);

  return {
    installed: true,
    packageId: selected.packageId,
    packageVersion: selected.packageVersion,
    displayName: selected.displayName,
    hangulFoundationEntries: entries.filter(isHangulFoundationEntry)
  };
}

export async function renderKoreanLanguage(options: KoreanLanguageOptions = {}): Promise<string> {
  const overview = await getKoreanLanguageOverview(options);

  if (!overview.installed) {
    return renderKoreanLanguageOverview(overview);
  }

  if (options.file !== undefined) {
    return renderReadingContent(
      await readInstalledContentEntry({
        dataDir: options.dataDir,
        packageId: koreanPackageId,
        packageVersion: overview.packageVersion,
        path: options.file
      })
    );
  }

  return renderKoreanLanguageOverview(overview);
}

export function renderKoreanLanguageOverview(overview: KoreanLanguageOverview): string {
  const lines = [
    "Korean",
    "",
    "Native language content is loaded from installed WhackSmacker content packages.",
    "",
    `Package: ${overview.packageId}`
  ];

  if (!overview.installed) {
    lines.push(
      "Status: not installed",
      "",
      "Korean content is not installed.",
      "Install the Korean content package before browsing Hangul Foundation content:",
      "",
      "  whacksmacker content install com.sleepymario.language.korean --catalogue <catalogue.json>",
      "",
      "After installation, rerun:",
      "",
      "  whacksmacker language korean"
    );
    return lines.join("\n");
  }

  lines.push(
    `Status: installed`,
    `Version: ${overview.packageVersion ?? "unknown"}`,
    `Title: ${overview.displayName ?? "Korean Curriculum"}`,
    "",
    "Hangul Foundation"
  );

  if (overview.hangulFoundationEntries.length === 0) {
    lines.push("", "No Hangul Foundation readable entries were found in the installed package.");
    return lines.join("\n");
  }

  lines.push(
    "",
    "Readable entries:",
    ...overview.hangulFoundationEntries.map((entry) => `- ${entry.path}`),
    "",
    "Open an entry with:",
    "",
    "  whacksmacker language korean --file <path>"
  );

  return lines.join("\n");
}

export async function languageKorean(args: readonly string[]): Promise<void> {
  console.log(await renderKoreanLanguage(parseKoreanLanguageArgs(args)));
}

export function parseKoreanLanguageArgs(args: readonly string[]): KoreanLanguageOptions {
  const options: { dataDir?: string; packageVersion?: string; file?: string } = {};

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--data-dir") {
      options.dataDir = requireValue(args, index, "--data-dir");
      index += 1;
      continue;
    }

    if (arg === "--version") {
      options.packageVersion = requireValue(args, index, "--version");
      index += 1;
      continue;
    }

    if (arg === "--file") {
      options.file = requireValue(args, index, "--file");
      index += 1;
      continue;
    }

    throw new Error("Usage: whacksmacker language korean [--file <path>] [--version <version>] [--data-dir <dir>]");
  }

  return options;
}

function requireValue(args: readonly string[], index: number, option: string): string {
  const value = args[index + 1];
  if (value === undefined || value.startsWith("--")) {
    throw new Error(`${option} requires a value.`);
  }
  return value;
}

function isHangulFoundationEntry(entry: ReadableContentEntry): boolean {
  return entry.path === hangulFoundationIndexPath || entry.path.startsWith(hangulFoundationRoot);
}

function compareSemver(left: string, right: string): number {
  const leftParts = left.split(".").map(Number);
  const rightParts = right.split(".").map(Number);
  for (let index = 0; index < 3; index += 1) {
    const difference = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);
    if (difference !== 0) {
      return difference;
    }
  }
  return 0;
}
