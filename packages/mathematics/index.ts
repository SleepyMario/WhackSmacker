import type { DomainModule } from "../core";
import {
  beginnerVolumeOneUnits,
  fourFiveUnitDefinition,
  generateBeginnerVolumeOneWorkbookPdf,
  generateCountingUnitWorkbookPdf,
  normalizeSeed,
  oneToFiveUnitDefinition,
  oneTwoThreeUnitDefinition,
  sixToNineUnitDefinition,
  type CountingUnitDefinition
} from "./one-two-three";

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
      summary: "Generate the standalone Unit 1 introductory counting workbook",
      run: async (args) => {
        await runUnitCommand(args, oneTwoThreeUnitDefinition);
      }
    });
    context.cli.register({
      path: ["mathematics", "four-and-five"],
      summary: "Generate the standalone Unit 2 four and five workbook",
      run: async (args) => {
        await runUnitCommand(args, fourFiveUnitDefinition);
      }
    });
    context.cli.register({
      path: ["mathematics", "one-to-five"],
      summary: "Generate the standalone Unit 3 one to five workbook",
      run: async (args) => {
        await runUnitCommand(args, oneToFiveUnitDefinition);
      }
    });
    context.cli.register({
      path: ["mathematics", "six-to-nine"],
      summary: "Generate the standalone Unit 4 six through nine workbook",
      run: async (args) => {
        await runUnitCommand(args, sixToNineUnitDefinition);
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
export const defaultFourAndFiveOutputPath = "./four-and-five-workbook.pdf";
export const defaultOneToFiveOutputPath = "./one-to-five-workbook.pdf";
export const defaultSixToNineOutputPath = "./six-to-nine-workbook.pdf";
export const defaultBeginnerVolumeOneOutputPath = "./beginner-mathematics-volume-one.pdf";

export interface OneTwoThreeCommandOptions {
  readonly outputPath: string;
  readonly seed?: number;
  readonly overwrite: boolean;
}

export type BeginnerVolumeOneCommandOptions = OneTwoThreeCommandOptions;

export async function runOneTwoThreeCommand(args: readonly string[]): Promise<void> {
  await runUnitCommand(args, oneTwoThreeUnitDefinition);
}

export async function runUnitCommand(args: readonly string[], definition: CountingUnitDefinition): Promise<void> {
  const options = parseWorkbookArgs(args, defaultOutputPathForUnit(definition), `mathematics ${definition.id}`);
  let lastReportedPage = 0;

  console.log(`Generating ${definition.title} workbook...`);
  const result = await generateCountingUnitWorkbookPdf({
    outputPath: options.outputPath,
    seed: options.seed,
    overwrite: options.overwrite,
    onProgress(progress) {
      if (progress.page === progress.pageCount || progress.page - lastReportedPage >= 10) {
        lastReportedPage = progress.page;
        console.log(`Rendered ${progress.page}/${progress.pageCount} pages...`);
      }
    }
  }, definition);

  console.log("");
  console.log("Workbook created.");
  console.log("");
  console.log(`Curriculum ID: ${definition.curriculumId}`);
  console.log(`Unit: ${definition.title}`);
  console.log(`Unit introduction pages: ${result.unitIntroductionPageCount ?? 0}`);
  console.log(`Exercise pages: ${result.exercisePageCount ?? 0}`);
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
  console.log(`Overall introduction pages: ${result.introductionPageCount ?? 0}`);
  console.log(`Unit introduction pages: ${result.unitIntroductionPageCount ?? 0}`);
  console.log(`Exercise pages: ${result.exercisePageCount ?? 0}`);
  console.log(`Exercises: ${result.exerciseCount}`);
  console.log(`Total PDF pages: ${result.pageCount}`);
  for (const unit of units) {
    console.log(`${unit.definition.label} ${unit.definition.title}: ${unit.definition.exercisePageCount} exercise pages, ${unit.exerciseCount} exercises`);
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

function defaultOutputPathForUnit(definition: CountingUnitDefinition): string {
  if (definition.id === "one-two-three") {
    return defaultOneTwoThreeOutputPath;
  }
  if (definition.id === "four-and-five") {
    return defaultFourAndFiveOutputPath;
  }
  if (definition.id === "one-to-five") {
    return defaultOneToFiveOutputPath;
  }
  return defaultSixToNineOutputPath;
}

export * from "./one-two-three";
