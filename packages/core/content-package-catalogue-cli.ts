import { generateLocalContentPackageCatalogue } from "./content-package-catalogue";

declare const process: {
  argv: string[];
  exitCode?: number;
};

async function main(argv = process.argv.slice(2)): Promise<void> {
  const options = parseArgs(argv);
  const result = await generateLocalContentPackageCatalogue(options);

  console.log("Local content package catalogue generated.");
  console.log(`Packages: ${result.packageCount}`);
  console.log(`File: ${result.outputPath}`);
  console.log(`Changed: ${result.changed ? "yes" : "no"}`);
}

interface CliOptions {
  readonly packagesDirectory: string;
  readonly outputPath: string;
  readonly generatedAt: string;
  readonly catalogueId?: string;
  readonly displayName?: string;
  readonly description?: string;
}

function parseArgs(argv: readonly string[]): CliOptions {
  let packagesDirectory: string | undefined;
  let outputPath: string | undefined;
  let generatedAt = "2026-07-06T00:00:00Z";
  let catalogueId: string | undefined;
  let displayName: string | undefined;
  let description: string | undefined;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--packages-dir") {
      packagesDirectory = readValue(argv, index, arg);
      index += 1;
    } else if (arg === "--output") {
      outputPath = readValue(argv, index, arg);
      index += 1;
    } else if (arg === "--generated-at") {
      generatedAt = readValue(argv, index, arg);
      index += 1;
    } else if (arg === "--catalogue-id") {
      catalogueId = readValue(argv, index, arg);
      index += 1;
    } else if (arg === "--display-name") {
      displayName = readValue(argv, index, arg);
      index += 1;
    } else if (arg === "--description") {
      description = readValue(argv, index, arg);
      index += 1;
    } else if (arg === "--help" || arg === "-h") {
      console.log(usage);
      return { packagesDirectory: "", outputPath: "", generatedAt };
    } else {
      throw new Error(`Unknown catalogue option: ${arg}`);
    }
  }

  if (packagesDirectory === undefined || outputPath === undefined) {
    throw new Error("Both --packages-dir and --output are required.");
  }

  return { packagesDirectory, outputPath, generatedAt, catalogueId, displayName, description };
}

function readValue(argv: readonly string[], index: number, option: string): string {
  const value = argv[index + 1];
  if (value === undefined || value.trim().length === 0) {
    throw new Error(`Missing value for ${option}`);
  }
  return value;
}

const usage = `WhackSmacker local content package catalogue generator

Usage:
  node dist/packages/core/content-package-catalogue-cli.js --packages-dir <dir> --output <catalogue.json> [--generated-at <iso-date>]`;

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
