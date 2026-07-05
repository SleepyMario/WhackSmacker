import type { DomainModule } from "../core";
import { generateBeginnerVolumeOneWorkbookPdf, generateOneTwoThreeWorkbookPdf, normalizeSeed } from "./one-two-three";

export interface MathematicsTopic {
  readonly id: string;
  readonly displayName: string;
}

export interface MathematicsQuiz {
  readonly id: string;
  readonly prompt: string;
}

export const mathematicsModule: DomainModule = {
  id: "mathematics",
  displayName: "Mathematics",
  providerFeatures: [],
  register(context) {
    context.cli.register({
      path: ["mathematics", "one-two-three"],
      summary: "Generate the 50-page introductory counting workbook",
      run: async (args) => {
        await runOneTwoThreeCommand(args);
      }
    });
    context.cli.register({
      path: ["mathematics", "beginner-volume-one"],
      summary: "Generate the complete beginner mathematics volume one workbook",
      run: async (args) => {
        await runBeginnerVolumeOneCommand(args);
      }
    });
  }
};

export const defaultOneTwoThreeOutputPath = "./one-two-three-workbook.pdf";
export const defaultBeginnerVolumeOneOutputPath = "./beginner-mathematics-volume-one.pdf";

export interface OneTwoThreeCommandOptions {
  readonly outputPath: string;
  readonly seed?: number;
  readonly overwrite: boolean;
}

export type BeginnerVolumeOneCommandOptions = OneTwoThreeCommandOptions;

export async function runOneTwoThreeCommand(args: readonly string[]): Promise<void> {
  const options = parseOneTwoThreeArgs(args);
  let lastReportedPage = 0;

  console.log("Generating One, Two, Three workbook...");
  const result = await generateOneTwoThreeWorkbookPdf({
    outputPath: options.outputPath,
    seed: options.seed,
    overwrite: options.overwrite,
    onProgress(progress) {
      if (progress.page === progress.pageCount || progress.page - lastReportedPage >= 10) {
        lastReportedPage = progress.page;
        console.log(`Rendered ${progress.page}/${progress.pageCount} pages...`);
      }
    }
  });

  console.log("");
  console.log("Workbook created.");
  console.log("");
  console.log(`Pages: ${result.pageCount}`);
  console.log(`Exercises: ${result.exerciseCount}`);
  console.log(`Seed: ${result.seed}`);
  console.log(`File: ${result.outputPath}`);
}

export function parseOneTwoThreeArgs(args: readonly string[]): OneTwoThreeCommandOptions {
  return parseWorkbookArgs(args, defaultOneTwoThreeOutputPath, "mathematics one-two-three");
}

export async function runBeginnerVolumeOneCommand(args: readonly string[]): Promise<void> {
  const options = parseBeginnerVolumeOneArgs(args);
  let lastReportedPage = 0;

  console.log("Generating Beginner Mathematics Volume 1 workbook...");
  const result = await generateBeginnerVolumeOneWorkbookPdf({
    outputPath: options.outputPath,
    seed: options.seed,
    overwrite: options.overwrite,
    onProgress(progress) {
      if (progress.page === progress.pageCount || progress.page - lastReportedPage >= 10) {
        lastReportedPage = progress.page;
        console.log(`Rendered ${progress.page}/${progress.pageCount} pages...`);
      }
    }
  });

  const units = result.workbook.kind === "volume" ? result.workbook.units : [];

  console.log("");
  console.log("Workbook created.");
  console.log("");
  console.log(`Introduction pages: ${result.introductionPageCount ?? 0}`);
  console.log(`Unit title pages: ${result.unitTitlePageCount ?? 0}`);
  console.log(`Exercise pages: ${result.exercisePageCount ?? 0}`);
  console.log(`Exercises: ${result.exerciseCount}`);
  for (const unit of units) {
    console.log(`${unit.definition.label} ${unit.definition.title}: ${unit.exerciseCount} exercises`);
  }
  console.log(`Seed: ${result.seed}`);
  console.log(`File: ${result.outputPath}`);
}

export function parseBeginnerVolumeOneArgs(args: readonly string[]): BeginnerVolumeOneCommandOptions {
  return parseWorkbookArgs(args, defaultBeginnerVolumeOneOutputPath, "mathematics beginner-volume-one");
}

function parseWorkbookArgs(args: readonly string[], defaultOutputPath: string, commandName: string): OneTwoThreeCommandOptions {
  let outputPath = defaultOutputPath;
  let seed: number | undefined;
  let overwrite = false;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--output") {
      const value = args[index + 1];
      if (value === undefined || value.startsWith("--")) {
        throw new Error("--output requires a path.");
      }
      outputPath = value;
      index += 1;
      continue;
    }

    if (arg === "--seed") {
      const value = args[index + 1];
      if (value === undefined || value.startsWith("--")) {
        throw new Error("--seed requires an integer.");
      }
      const parsed = Number(value);
      if (!Number.isSafeInteger(parsed) || parsed <= 0) {
        throw new Error("--seed must be a positive integer.");
      }
      seed = normalizeSeed(parsed);
      index += 1;
      continue;
    }

    if (arg === "--overwrite") {
      overwrite = true;
      continue;
    }

    throw new Error(`Unknown ${commandName} option: ${arg}`);
  }

  return { outputPath, seed, overwrite };
}

export * from "./one-two-three";
