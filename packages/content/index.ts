import {
  detectContentPackageUpdates,
  installContentPackage,
  listInstalledReadablePackages,
  listAvailableContentPackages,
  listInstalledContentPackages,
  listReadableContentEntries,
  listIntegratedDueReviewItems,
  listReadingReviewItems,
  listReadingReviewSources,
  readInstalledContentEntry,
  recordReadingReviewAnswer,
  removeContentPackage,
  renderReadingReviewItem,
  renderReadingContent,
  syncReadingReviewItems,
  updateContentPackage,
  isReviewRating,
  type DomainModule,
  type InstalledPackageRecord
} from "../core";

export const contentModule: DomainModule = {
  id: "content",
  displayName: "Content",
  providerFeatures: [],
  register(context) {
    context.cli.register({
      path: ["content", "available"],
      summary: "List packages available in a content catalogue",
      run: async (args) => {
        const options = parseOptions(args, ["catalogue"]);
        const packages = await listAvailableContentPackages(options.catalogue);
        console.log("Available packages:");
        for (const entry of packages) {
          console.log(`- ${entry.packageId} ${entry.packageVersion} ${entry.displayName}`);
        }
      }
    });

    context.cli.register({
      path: ["content", "install"],
      summary: "Install a package from a content catalogue",
      run: async (args) => {
        const parsed = parsePackageCommand(args, ["catalogue"]);
        const result = await installContentPackage({
          cataloguePath: parsed.options.catalogue,
          dataDir: parsed.options.dataDir,
          packageId: parsed.packageId,
          packageVersion: parsed.options.version,
          force: parsed.options.force
        });
        console.log(result.installed ? "Package installed." : "Package already installed.");
        console.log(`Package: ${result.record.packageId}`);
        console.log(`Version: ${result.record.packageVersion}`);
        console.log(`Path: ${result.installPath}`);
      }
    });

    context.cli.register({
      path: ["content", "installed"],
      summary: "List installed content packages",
      run: async (args) => {
        const options = parseOptions(args, []);
        printInstalled(await listInstalledContentPackages(options.dataDir));
      }
    });

    context.cli.register({
      path: ["content", "updates"],
      summary: "List content package updates available from a catalogue",
      run: async (args) => {
        const options = parseOptions(args, ["catalogue"]);
        const updates = await detectContentPackageUpdates(options.catalogue, options.dataDir);
        if (updates.length === 0) {
          console.log("No package updates available.");
          return;
        }
        console.log("Package updates:");
        for (const update of updates) {
          console.log(`- ${update.packageId} ${update.installedVersion} -> ${update.availableVersion}`);
        }
      }
    });

    context.cli.register({
      path: ["content", "update"],
      summary: "Install the newest package version available from a catalogue",
      run: async (args) => {
        const parsed = parsePackageCommand(args, ["catalogue"]);
        const result = await updateContentPackage({
          cataloguePath: parsed.options.catalogue,
          dataDir: parsed.options.dataDir,
          packageId: parsed.packageId
        });
        console.log("Package updated.");
        console.log(`Package: ${result.record.packageId}`);
        console.log(`Version: ${result.record.packageVersion}`);
        console.log(`Path: ${result.installPath}`);
      }
    });

    context.cli.register({
      path: ["content", "remove"],
      summary: "Remove an installed content package version",
      run: async (args) => {
        const parsed = parsePackageCommand(args, []);
        const result = await removeContentPackage({
          dataDir: parsed.options.dataDir,
          packageId: parsed.packageId,
          packageVersion: parsed.options.version,
          allVersions: parsed.options.all
        });
        console.log("Package removed.");
        for (const record of result.removed) {
          console.log(`- ${record.packageId} ${record.packageVersion}`);
        }
      }
    });

    context.cli.register({
      path: ["content", "files"],
      summary: "List readable files in an installed content package",
      run: async (args) => {
        const parsed = parsePackageCommand(args, []);
        const entries = await listReadableContentEntries(parsed.packageId, parsed.options.dataDir, parsed.options.version);
        console.log(`Readable files for ${parsed.packageId}${parsed.options.version === undefined ? "" : ` ${parsed.options.version}`}:`);
        for (const entry of entries) {
          console.log(`- ${entry.path} ${entry.mediaType}`);
        }
      }
    });

    context.cli.register({
      path: ["content", "read"],
      summary: "Read installed package content",
      run: async (args) => {
        if (args.length === 0 || args[0]?.startsWith("--")) {
          const options = parseOptions(args, []);
          const packages = await listInstalledReadablePackages(options.dataDir);
          if (packages.length === 0) {
            console.log("No readable content packages installed.");
            return;
          }
          console.log("Readable content packages:");
          for (const contentPackage of packages) {
            console.log(`- ${contentPackage.packageId} ${contentPackage.packageVersion} ${contentPackage.displayName}`);
          }
          return;
        }

        const parsed = parsePackageCommand(args, []);
        if (parsed.options.file === undefined) {
          const entries = await listReadableContentEntries(parsed.packageId, parsed.options.dataDir, parsed.options.version);
          console.log(`Readable files for ${parsed.packageId}${parsed.options.version === undefined ? "" : ` ${parsed.options.version}`}:`);
          for (const entry of entries) {
            console.log(`- ${entry.path} ${entry.mediaType}`);
          }
          return;
        }

        const result = await readInstalledContentEntry({
          dataDir: parsed.options.dataDir,
          packageId: parsed.packageId,
          packageVersion: parsed.options.version,
          path: parsed.options.file
        });
        console.log(renderReadingContent(result));
      }
    });

    context.cli.register({
      path: ["review", "sources"],
      summary: "List reading files that have review items",
      run: async (args) => {
        const options = parseOptions(args, []);
        const sources = await listReadingReviewSources({
          dataDir: options.dataDir,
          packageId: options.package,
          packageVersion: options.version
        });
        if (sources.length === 0) {
          console.log("No reading sources with review items found.");
          return;
        }
        console.log("Reading review sources:");
        for (const source of sources) {
          console.log(`- ${source.packageId} ${source.packageVersion} ${source.sourcePath} (${source.itemCount} items${source.sourceExists ? "" : ", missing source"})`);
        }
      }
    });

    context.cli.register({
      path: ["review", "items"],
      summary: "List review items from installed content",
      run: async (args) => {
        const options = parseOptions(args, ["package"]);
        const items = await listReadingReviewItems({
          dataDir: options.dataDir,
          packageId: options.package,
          packageVersion: options.version,
          sourcePath: options.source
        });
        if (items.length === 0) {
          console.log("No review items found.");
          return;
        }
        console.log("Review items:");
        for (const item of items) {
          console.log(`- ${item.packageId} ${item.packageVersion} ${item.item.id} ${item.item.kind}${item.sourcePath === undefined ? "" : ` source=${item.sourcePath}`}`);
        }
      }
    });

    context.cli.register({
      path: ["review", "due"],
      summary: "List due native review items",
      run: async (args) => {
        const options = parseOptions(args, []);
        const now = options.now ?? currentTimestamp();
        await syncReadingReviewItems({
          dataDir: options.dataDir,
          packageId: options.package,
          packageVersion: options.version,
          now
        });
        const due = await listIntegratedDueReviewItems({
          dataDir: options.dataDir,
          packageId: options.package,
          packageVersion: options.version,
          now,
          limit: options.limit
        });
        if (due.length === 0) {
          console.log("No native review items due.");
          return;
        }
        console.log("Due review items:");
        for (const item of due) {
          console.log(`- ${item.packageId} ${item.packageVersion} ${item.itemId} next=${item.nextReviewAt} status=${item.status}`);
        }
      }
    });

    context.cli.register({
      path: ["review", "show"],
      summary: "Render a native review item",
      run: async (args) => {
        const parsed = parseReviewItemCommand(args, []);
        const result = await renderReadingReviewItem({
          dataDir: parsed.options.dataDir,
          packageId: parsed.packageId,
          packageVersion: parsed.options.version,
          itemId: parsed.itemId,
          answer: parsed.options.answer
        });
        console.log(result.text.trimEnd());
      }
    });

    context.cli.register({
      path: ["review", "answer"],
      summary: "Record a native review rating",
      run: async (args) => {
        const parsed = parseReviewItemCommand(args, ["rating"]);
        if (!isReviewRating(parsed.options.rating)) {
          throw new Error("--rating must be one of: again, hard, good, easy.");
        }
        const result = await recordReadingReviewAnswer({
          dataDir: parsed.options.dataDir,
          packageId: parsed.packageId,
          packageVersion: parsed.options.version,
          itemId: parsed.itemId,
          rating: parsed.options.rating,
          reviewedAt: parsed.options.now ?? currentTimestamp()
        });
        console.log("Review rating recorded.");
        console.log(`Package: ${result.state.packageId}`);
        console.log(`Version: ${result.state.packageVersion}`);
        console.log(`Item: ${result.state.itemId}`);
        console.log(`Rating: ${result.event.rating}`);
        console.log(`Next review: ${result.state.nextReviewAt}`);
      }
    });
  }
};

interface ParsedOptions {
  readonly catalogue: string;
  readonly dataDir?: string;
  readonly version?: string;
  readonly package?: string;
  readonly force?: boolean;
  readonly all?: boolean;
  readonly file?: string;
  readonly source?: string;
  readonly limit?: number;
  readonly answer?: boolean;
  readonly rating?: string;
  readonly now?: string;
}

function printInstalled(packages: readonly InstalledPackageRecord[]): void {
  if (packages.length === 0) {
    console.log("No content packages installed.");
    return;
  }
  console.log("Installed packages:");
  for (const record of packages) {
    console.log(`- ${record.packageId} ${record.packageVersion} ${record.displayName}`);
  }
}

function parsePackageCommand(args: readonly string[], required: readonly string[]): { readonly packageId: string; readonly options: ParsedOptions } {
  const packageId = args[0];
  if (packageId === undefined || packageId.startsWith("--")) {
    throw new Error("A package ID is required.");
  }
  return { packageId, options: parseOptions(args.slice(1), required) };
}

function parseReviewItemCommand(
  args: readonly string[],
  required: readonly string[]
): { readonly packageId: string; readonly itemId: string; readonly options: ParsedOptions } {
  const packageId = args[0];
  const itemId = args[1];
  if (packageId === undefined || packageId.startsWith("--")) {
    throw new Error("A package ID is required.");
  }
  if (itemId === undefined || itemId.startsWith("--")) {
    throw new Error("An item ID is required.");
  }
  return { packageId, itemId, options: parseOptions(args.slice(2), required) };
}

function parseOptions(args: readonly string[], required: readonly string[]): ParsedOptions {
  let catalogue = "";
  let dataDir: string | undefined;
  let version: string | undefined;
  let packageId: string | undefined;
  let force = false;
  let all = false;
  let file: string | undefined;
  let source: string | undefined;
  let limit: number | undefined;
  let answer = false;
  let rating: string | undefined;
  let now: string | undefined;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--catalogue") {
      catalogue = readValue(args, index, arg);
      index += 1;
    } else if (arg === "--data-dir") {
      dataDir = readValue(args, index, arg);
      index += 1;
    } else if (arg === "--version") {
      version = readValue(args, index, arg);
      index += 1;
    } else if (arg === "--package") {
      packageId = readValue(args, index, arg);
      index += 1;
    } else if (arg === "--force") {
      force = true;
    } else if (arg === "--all") {
      all = true;
    } else if (arg === "--file") {
      file = readValue(args, index, arg);
      index += 1;
    } else if (arg === "--source") {
      source = readValue(args, index, arg);
      index += 1;
    } else if (arg === "--limit") {
      limit = readPositiveInteger(readValue(args, index, arg), arg);
      index += 1;
    } else if (arg === "--answer") {
      answer = true;
    } else if (arg === "--rating") {
      rating = readValue(args, index, arg);
      index += 1;
    } else if (arg === "--now") {
      now = readValue(args, index, arg);
      index += 1;
    } else {
      throw new Error(`Unknown content option: ${arg}`);
    }
  }

  for (const option of required) {
    if (option === "catalogue" && catalogue.length === 0) {
      throw new Error("--catalogue is required.");
    }
    if (option === "package" && packageId === undefined) {
      throw new Error("--package is required.");
    }
    if (option === "rating" && rating === undefined) {
      throw new Error("--rating is required.");
    }
  }

  return { catalogue, dataDir, version, package: packageId, force, all, file, source, limit, answer, rating, now };
}

function readValue(args: readonly string[], index: number, option: string): string {
  const value = args[index + 1];
  if (value === undefined || value.trim().length === 0) {
    throw new Error(`Missing value for ${option}`);
  }
  return value;
}

function readPositiveInteger(value: string, option: string): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new Error(`${option} must be a positive integer.`);
  }
  return parsed;
}

function currentTimestamp(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/u, "Z");
}
