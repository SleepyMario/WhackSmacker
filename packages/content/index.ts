import {
  detectContentPackageUpdates,
  installContentPackage,
  listInstalledReadablePackages,
  listAvailableContentPackages,
  listInstalledContentPackages,
  listReadableContentEntries,
  readInstalledContentEntry,
  removeContentPackage,
  renderReadingContent,
  updateContentPackage,
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
  }
};

interface ParsedOptions {
  readonly catalogue: string;
  readonly dataDir?: string;
  readonly version?: string;
  readonly force?: boolean;
  readonly all?: boolean;
  readonly file?: string;
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

function parseOptions(args: readonly string[], required: readonly string[]): ParsedOptions {
  let catalogue = "";
  let dataDir: string | undefined;
  let version: string | undefined;
  let force = false;
  let all = false;
  let file: string | undefined;

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
    } else if (arg === "--force") {
      force = true;
    } else if (arg === "--all") {
      all = true;
    } else if (arg === "--file") {
      file = readValue(args, index, arg);
      index += 1;
    } else {
      throw new Error(`Unknown content option: ${arg}`);
    }
  }

  for (const option of required) {
    if (option === "catalogue" && catalogue.length === 0) {
      throw new Error("--catalogue is required.");
    }
  }

  return { catalogue, dataDir, version, force, all, file };
}

function readValue(args: readonly string[], index: number, option: string): string {
  const value = args[index + 1];
  if (value === undefined || value.trim().length === 0) {
    throw new Error(`Missing value for ${option}`);
  }
  return value;
}
