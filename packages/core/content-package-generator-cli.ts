import { generateContentPackage, contentPackageGeneratorTargets } from "./content-package-generator";

declare const process: {
  argv: string[];
  exitCode?: number;
};

async function main(argv = process.argv.slice(2)): Promise<void> {
  const options = parseArgs(argv);
  const targetIds = options.targets.length === 0 ? contentPackageGeneratorTargets.map((target) => target.id) : options.targets;

  for (const targetId of targetIds) {
    const result = await generateContentPackage({
      targetId,
      outputDirectory: options.outputDirectory,
      generatedAt: options.generatedAt
    });

    console.log(`Package generated: ${result.packageId}`);
    console.log(`Version: ${result.packageVersion}`);
    console.log(`File: ${result.filePath}`);
    console.log(`SHA-256: ${result.archiveSha256}`);
  }
}

interface CliOptions {
  readonly outputDirectory: string;
  readonly generatedAt: string;
  readonly targets: readonly string[];
}

function parseArgs(argv: readonly string[]): CliOptions {
  let outputDirectory = "packages-output";
  let generatedAt = "2026-07-06T00:00:00Z";
  const targets: string[] = [];

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--output-dir") {
      outputDirectory = readValue(argv, index, arg);
      index += 1;
    } else if (arg === "--generated-at") {
      generatedAt = readValue(argv, index, arg);
      index += 1;
    } else if (arg === "--target") {
      targets.push(readValue(argv, index, arg));
      index += 1;
    } else if (arg === "--help" || arg === "-h") {
      console.log(usage);
      return { outputDirectory, generatedAt, targets: [] };
    } else {
      throw new Error(`Unknown package generator option: ${arg}`);
    }
  }

  return { outputDirectory, generatedAt, targets };
}

function readValue(argv: readonly string[], index: number, option: string): string {
  const value = argv[index + 1];
  if (value === undefined || value.trim().length === 0) {
    throw new Error(`Missing value for ${option}`);
  }

  return value;
}

const usage = `WhackSmacker content package generator

Usage:
  node dist/packages/core/content-package-generator-cli.js [--output-dir <path>] [--generated-at <iso-date>] [--target <id>]

Targets:
${contentPackageGeneratorTargets.map((target) => `  ${target.id} -> ${target.packageId}`).join("\n")}`;

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
