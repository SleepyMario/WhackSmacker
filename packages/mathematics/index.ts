import type { DomainModule } from "../core";
import { generateOneTwoThreeWorkbookPdf, normalizeSeed } from "./one-two-three";

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
  }
};

export const defaultOneTwoThreeOutputPath = "./one-two-three-workbook.pdf";

export interface OneTwoThreeCommandOptions {
  readonly outputPath: string;
  readonly seed?: number;
  readonly overwrite: boolean;
}

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
  let outputPath = defaultOneTwoThreeOutputPath;
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

    throw new Error(`Unknown mathematics one-two-three option: ${arg}`);
  }

  return { outputPath, seed, overwrite };
}

export * from "./one-two-three";
