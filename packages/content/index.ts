import {
  detectContentPackageUpdates,
  inspectUserDataBackup,
  installContentPackage,
  listInstalledReadablePackages,
  listAvailableContentPackages,
  listInstalledContentPackages,
  listReadableContentEntries,
  listIntegratedDueReviewItems,
  findNextReadingReviewSource,
  findFirstClassModule,
  formatFirstClassModuleInfo,
  getBuiltInFirstClassModules,
  installedPackageToFirstClassModuleDescriptor,
  isLanguageLikeModulePackage,
  listReadingReviewItems,
  listReadingReviewSources,
  localized,
  migrateUserDataBackupFile,
  orderReviewItemsForSession,
  readInstalledContentEntry,
  restoreUserDataBackup,
  recordReadingReviewAnswer,
  removeContentPackage,
  renderReadingReviewItem,
  renderReadingContent,
  syncReadingReviewItems,
  sortFirstClassModules,
  updateContentPackage,
  writeUserDataBackup,
  isReviewRating,
  type DomainModule,
  type CurriculumDisplayMode,
  type FirstClassModuleDescriptor,
  type InstalledPackageRecord,
  type RenderedExercise,
  type ReviewRating
} from "../core";

declare const process: {
  stdin: NodeInput;
  stdout: NodeOutput;
  env: Record<string, string | undefined>;
};

interface NodeInput {
  setEncoding?(encoding: string): void;
  on(event: "data", listener: (chunk: unknown) => void): void;
  on(event: "end" | "close", listener: () => void): void;
  off(event: "data", listener: (chunk: unknown) => void): void;
  off(event: "end" | "close", listener: () => void): void;
  resume(): void;
  pause(): void;
}

interface NodeOutput {
  isTTY?: boolean;
  write(text: string): void;
}

interface LineReader {
  promptLine(prompt: string): Promise<string | null>;
  close(): void;
}

interface PendingLineRead {
  readonly resolve: (line: string | null) => void;
}

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
          console.log(`- ${entry.packageId} ${entry.packageVersion} ${localized(entry.displayName, "en-US")}`);
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
        console.log(renderReadingContent(result, parsed.options.view));
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
          const title = source.title === undefined ? "" : ` ${source.title}`;
          console.log(`- ${source.packageId} ${source.packageVersion} ${source.sourcePath}${title} (${source.itemCount} items${source.sourceExists ? "" : ", missing source"})`);
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

    context.cli.register({
      path: ["review", "run"],
      summary: "Run a native review session for a review source",
      run: async (args) => {
        const options = parseOptions(args, ["package", "source"]);
        await runReviewSourceSession({
          dataDir: options.dataDir,
          packageId: options.package,
          packageVersion: options.version,
          sourcePath: options.source,
          now: options.now ?? currentTimestamp(),
          shuffle: options.noShuffle !== true
        });
      }
    });

    context.cli.register({
      path: ["module", "list"],
      summary: "List first-class WhackSmacker modules",
      run: async (args) => {
        const options = parseOptions(args, []);
        const modules = await listFirstClassModulesForContentCli(options.dataDir);
        console.log("WhackSmacker modules:");
        for (const descriptor of modules) {
          console.log(`- ${descriptor.moduleId} ${descriptor.version} ${descriptor.category} ${descriptor.sourceKind} ${descriptor.displayName}`);
        }
      }
    });

    context.cli.register({
      path: ["module", "info"],
      summary: "Show first-class WhackSmacker module metadata",
      run: async (args) => {
        const parsed = parseModuleCommand(args);
        const modules = await listFirstClassModulesForContentCli(parsed.options.dataDir);
        const descriptor = findFirstClassModule(modules, parsed.moduleId);
        if (descriptor === undefined) {
          throw new Error(`Unknown module: ${parsed.moduleId}`);
        }
        console.log(formatFirstClassModuleInfo(descriptor));
      }
    });

    context.cli.register({
      path: ["module", "build"],
      summary: "Show how a first-class module is currently built or packaged",
      run: async (args) => {
        const parsed = parseModuleCommand(args);
        const modules = await listFirstClassModulesForContentCli(parsed.options.dataDir);
        const descriptor = findFirstClassModule(modules, parsed.moduleId);
        if (descriptor === undefined) {
          throw new Error(`Unknown module: ${parsed.moduleId}`);
        }
        console.log(renderModuleBuildStatus(descriptor));
      }
    });

    context.cli.register({
      path: ["backup", "create"],
      summary: "Create a user data backup",
      run: async (args) => {
        const options = parseOptions(args, ["output"]);
        const backup = await writeUserDataBackup({
          dataDir: options.dataDir,
          outputPath: options.output,
          createdAt: options.now ?? currentTimestamp()
        });
        console.log("Backup created.");
        console.log(`File: ${options.output}`);
        console.log(`Sections: ${backup.includedSections.join(", ") || "none"}`);
        console.log(`Installed package hints: ${backup.restoreHints.installedPackages.length}`);
      }
    });

    context.cli.register({
      path: ["backup", "inspect"],
      summary: "Inspect a user data backup",
      run: async (args) => {
        const backupPath = args[0];
        if (backupPath === undefined || backupPath.startsWith("--")) {
          throw new Error("A backup path is required.");
        }
        const inspection = await inspectUserDataBackup(backupPath);
        if (!inspection.valid) {
          console.log("Backup invalid.");
          for (const error of inspection.errors) {
            console.log(`- ${error}`);
          }
          return;
        }
        console.log("Backup valid.");
        console.log(`Format: ${inspection.backupFormatVersion}`);
        console.log(`Created: ${inspection.createdAt}`);
        console.log(`WhackSmacker: ${inspection.whackSmackerVersion}`);
        console.log(`Sections: ${inspection.includedSections.join(", ") || "none"}`);
        console.log(`Installed package hints: ${inspection.installedPackages.length}`);
      }
    });

    context.cli.register({
      path: ["backup", "restore"],
      summary: "Restore a user data backup",
      run: async (args) => {
        const backupPath = args[0];
        if (backupPath === undefined || backupPath.startsWith("--")) {
          throw new Error("A backup path is required.");
        }
        const options = parseOptions(args.slice(1), []);
        const result = await restoreUserDataBackup({
          backupPath,
          dataDir: options.dataDir,
          force: options.force
        });
        console.log("Backup restored.");
        console.log(`Sections: ${result.restored.join(", ") || "none"}`);
        for (const path of result.paths) {
          console.log(`- ${path}`);
        }
      }
    });

    context.cli.register({
      path: ["backup", "migrate"],
      summary: "Migrate a user data backup to the latest format",
      run: async (args) => {
        const backupPath = args[0];
        if (backupPath === undefined || backupPath.startsWith("--")) {
          throw new Error("A backup path is required.");
        }
        const options = parseOptions(args.slice(1), ["output"]);
        const backup = await migrateUserDataBackupFile(backupPath, options.output);
        console.log("Backup migrated.");
        console.log(`File: ${options.output}`);
        console.log(`Format: ${backup.backupFormatVersion}`);
      }
    });
  }
};

interface RunReviewSourceSessionOptions {
  readonly dataDir?: string;
  readonly packageId?: string;
  readonly packageVersion?: string;
  readonly sourcePath?: string;
  readonly now: string;
  readonly shuffle?: boolean;
}

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
  readonly output: string;
  readonly noShuffle?: boolean;
  readonly view: CurriculumDisplayMode;
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

async function runReviewSourceSession(options: RunReviewSourceSessionOptions): Promise<void> {
  if (options.packageId === undefined) {
    throw new Error("--package is required.");
  }
  if (options.sourcePath === undefined) {
    throw new Error("--source is required.");
  }

  const reader = new ReviewLineInput();
  try {
    let sourcePath = options.sourcePath;
    while (true) {
      const completed = await runSingleReviewSource(reader, { ...options, packageId: options.packageId, sourcePath });
      if (!completed) {
        return;
      }

      const next = await findNextReadingReviewSource({
        dataDir: options.dataDir,
        packageId: options.packageId,
        packageVersion: options.packageVersion,
        sourcePath
      });

      if (next === undefined) {
        console.log("No next review deck is available.");
        return;
      }

      const answer = ((await reader.promptLine("Do you want to continue with the next deck? (y/n) ")) ?? "").trim().toLowerCase();
      if (answer !== "y" && answer !== "yes") {
        console.log("Review stopped.");
        return;
      }

      console.log(`Starting next review deck: ${reviewSourceLabel(next.title, next.sourcePath)}`);
      sourcePath = next.sourcePath;
    }
  } finally {
    reader.close();
  }
}

async function runSingleReviewSource(
  reader: LineReader,
  options: RunReviewSourceSessionOptions & { readonly packageId: string; readonly sourcePath: string }
): Promise<boolean> {
  const sources = await listReadingReviewSources({
    dataDir: options.dataDir,
    packageId: options.packageId,
    packageVersion: options.packageVersion
  });
  const source = sources.find((candidate) => candidate.sourcePath === options.sourcePath);
  const label = reviewSourceLabel(source?.title, options.sourcePath);

  await syncReadingReviewItems({
    dataDir: options.dataDir,
    packageId: options.packageId,
    packageVersion: options.packageVersion,
    now: options.now
  });

  const sourceItems = await listReadingReviewItems({
    dataDir: options.dataDir,
    packageId: options.packageId,
    packageVersion: options.packageVersion,
    sourcePath: options.sourcePath
  });
  const sourceItemIds = new Set(sourceItems.map((item) => item.item.id));
  const due = (await listIntegratedDueReviewItems({
    dataDir: options.dataDir,
    packageId: options.packageId,
    packageVersion: options.packageVersion,
    now: options.now
  })).filter((item) => sourceItemIds.has(item.itemId) && (item.sourcePath === undefined || item.sourcePath === options.sourcePath));

  if (due.length === 0) {
    console.log(`No due review items found for deck: ${label}`);
  }

  const sessionItems = orderReviewItemsForSession(due, { shuffle: options.shuffle !== false });
  for (const dueItem of sessionItems) {
    const prompt = await renderReadingReviewItem({
      dataDir: options.dataDir,
      packageId: dueItem.packageId,
      packageVersion: dueItem.packageVersion,
      ...(dueItem.sourcePath === undefined ? {} : { sourcePath: dueItem.sourcePath }),
      itemId: dueItem.itemId
    });
    console.log(formatStudyReviewExercise(prompt.rendered, "prompt").trimEnd());

    const reveal = ((await reader.promptLine("Press Enter to show answer, or q to stop: ")) ?? "q").trim().toLowerCase();
    if (reveal === "q" || reveal === "quit") {
      console.log("Review stopped.");
      return false;
    }

    const answer = await renderReadingReviewItem({
      dataDir: options.dataDir,
      packageId: dueItem.packageId,
      packageVersion: dueItem.packageVersion,
      ...(dueItem.sourcePath === undefined ? {} : { sourcePath: dueItem.sourcePath }),
      itemId: dueItem.itemId,
      answer: true
    });
    console.log(formatStudyReviewExercise(answer.rendered, "answer").trimEnd());

    const rating = await promptForRating(reader);
    if (rating === null) {
      console.log("Review stopped.");
      return false;
    }
    await recordReadingReviewAnswer({
      dataDir: options.dataDir,
      packageId: dueItem.packageId,
      packageVersion: dueItem.packageVersion,
      ...(dueItem.sourcePath === undefined ? {} : { sourcePath: dueItem.sourcePath }),
      itemId: dueItem.itemId,
      rating,
      reviewedAt: options.now
    });
  }

  console.log(`Completed review deck: ${label}`);
  return true;
}

function formatStudyReviewExercise(exercise: RenderedExercise, side: "prompt" | "answer"): string {
  const colorsEnabled = shouldUseReviewColors();
  const title = side === "prompt" ? "Review Prompt" : "Review Answer";
  const width = 64;
  const border = "-".repeat(width);
  const sections: string[] = [
    "",
    reviewColor(border, side, colorsEnabled),
    reviewColor(centerText(title, width), side, colorsEnabled),
    reviewColor(centerText(exercise.title, width), side, colorsEnabled),
    reviewColor(border, side, colorsEnabled),
    ""
  ];
  if (side === "prompt") {
    sections.push("", "Prompt", ...prefixStudyLines(exercise.promptLines));
    if (exercise.hintLines.length > 0) {
      sections.push("", "Hints", ...prefixStudyLines(exercise.hintLines));
    }
  } else {
    sections.push("", "Answer", ...prefixStudyLines(exercise.answerLines));
    if (exercise.noteLines.length > 0) {
      sections.push("", "Notes", ...prefixStudyLines(exercise.noteLines));
    }
  }
  sections.push("", reviewColor(border, side, colorsEnabled));
  return `${sections.join("\n").trimEnd()}\n`;
}

function prefixStudyLines(lines: readonly string[]): readonly string[] {
  return lines.map((line) => `  ${line}`);
}

function shouldUseReviewColors(): boolean {
  return process.stdout.isTTY === true && process.env.NO_COLOR === undefined;
}

function reviewColor(text: string, side: "prompt" | "answer", colorsEnabled: boolean): string {
  if (!colorsEnabled) {
    return text;
  }
  const color = side === "prompt" ? "\x1b[1m\x1b[36m" : "\x1b[1m\x1b[32m";
  return `${color}${text}\x1b[0m`;
}

function centerText(text: string, width: number): string {
  const normalized = text.length > width ? `${text.slice(0, Math.max(0, width - 3))}...` : text;
  const padding = Math.max(0, width - normalized.length);
  const left = Math.floor(padding / 2);
  const right = padding - left;
  return `${" ".repeat(left)}${normalized}${" ".repeat(right)}`;
}

async function promptForRating(reader: LineReader): Promise<ReviewRating | null> {
  while (true) {
    const line = await reader.promptLine("Choose a rating (1 again / 2 hard / 3 good / 4 easy, or q to stop): ");
    if (line === null) {
      return null;
    }
    const rating = normalizeReviewRating(line.trim().toLowerCase());
    if (rating === null) {
      return null;
    }
    if (isReviewRating(rating)) {
      return rating;
    }
    console.log("Rating must be one of: 1, 2, 3, 4, again, hard, good, easy, or q.");
  }
}

function normalizeReviewRating(value: string): ReviewRating | string | null {
  if (value === "q" || value === "quit") {
    return null;
  }
  if (value === "1") {
    return "again";
  }
  if (value === "2") {
    return "hard";
  }
  if (value === "3") {
    return "good";
  }
  if (value === "4") {
    return "easy";
  }
  return value;
}

function reviewSourceLabel(title: string | undefined, sourcePath: string): string {
  return title ?? sourcePath;
}

class ReviewLineInput implements LineReader {
  private buffer = "";
  private readonly resolvers: PendingLineRead[] = [];
  private closed = false;

  private readonly onData = (chunk: unknown): void => {
    this.buffer += String(chunk);
    this.flush();
  };

  private readonly onClose = (): void => {
    this.closed = true;
    this.flush();
  };

  constructor() {
    process.stdin.setEncoding?.("utf8");
    process.stdin.on("data", this.onData);
    process.stdin.on("end", this.onClose);
    process.stdin.on("close", this.onClose);
    process.stdin.resume();
  }

  promptLine(prompt: string): Promise<string | null> {
    process.stdout.write(prompt);

    return new Promise((resolve) => {
      this.resolvers.push({ resolve });
      this.flush();
    });
  }

  close(): void {
    process.stdin.off("data", this.onData);
    process.stdin.off("end", this.onClose);
    process.stdin.off("close", this.onClose);
    process.stdin.pause();
  }

  private flush(): void {
    while (this.resolvers.length > 0) {
      const line = this.readLine();
      if (line !== undefined) {
        this.resolvers.shift()?.resolve(line);
        continue;
      }

      if (this.closed) {
        this.resolvers.shift()?.resolve(null);
        continue;
      }

      return;
    }
  }

  private readLine(): string | undefined {
    const newlineIndex = this.buffer.indexOf("\n");
    if (newlineIndex === -1) {
      return undefined;
    }

    const line = this.buffer.slice(0, newlineIndex).replace(/\r$/u, "");
    this.buffer = this.buffer.slice(newlineIndex + 1);
    return line;
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

function parseModuleCommand(args: readonly string[]): { readonly moduleId: string; readonly options: ParsedOptions } {
  const moduleId = args[0];
  if (moduleId === undefined || moduleId.startsWith("--")) {
    throw new Error("A module ID is required.");
  }
  return { moduleId, options: parseOptions(args.slice(1), []) };
}

async function listFirstClassModulesForContentCli(dataDir?: string): Promise<readonly FirstClassModuleDescriptor[]> {
  const installed = await listInstalledReadablePackages(dataDir);
  const descriptors: FirstClassModuleDescriptor[] = [];

  for (const contentPackage of installed) {
    if (!isLanguageLikeModulePackage(contentPackage.packageId)) {
      continue;
    }
    const [entries, sources] = await Promise.all([
      listReadableContentEntries(contentPackage.packageId, dataDir, contentPackage.packageVersion),
      listReadingReviewSources({
        dataDir,
        packageId: contentPackage.packageId,
        packageVersion: contentPackage.packageVersion
      })
    ]);
    const descriptor = installedPackageToFirstClassModuleDescriptor(contentPackage, {
      readableContentCount: entries.length,
      reviewSourceCount: sources.length
    });
    if (descriptor !== null) {
      descriptors.push(descriptor);
    }
  }

  return sortFirstClassModules([...descriptors, ...getBuiltInFirstClassModules()]);
}

function renderModuleBuildStatus(descriptor: FirstClassModuleDescriptor): string {
  if (descriptor.sourceKind === "content-package") {
    const target = contentPackageTargetForModuleId(descriptor.moduleId);
    return [
      descriptor.displayName,
      "",
      `Module ID: ${descriptor.moduleId}`,
      "Build status: content package",
      target === undefined ? "Package generator target: not known yet" : `Package generator target: ${target}`,
      "",
      "Use the content package generator workflow to build a .wspkg from the canonical source repository.",
      "The installed package remains read-only; user progress stays outside installed package directories."
    ].join("\n");
  }

  return [
    descriptor.displayName,
    "",
    `Module ID: ${descriptor.moduleId}`,
    `Build status: ${descriptor.sourceKind}`,
    "",
    "This module is represented in the first-class module registry.",
    "A downloadable module artifact builder is not implemented for this built-in/native module yet."
  ].join("\n");
}

function contentPackageTargetForModuleId(moduleId: string): string | undefined {
  const suffix = moduleId.replace(/^com\.sleepymario\.language\./u, "");
  const targets: Record<string, string> = {
    korean: "korean-curriculum",
    "chinese.mandarin.traditional": "chinese-mandarin-traditional-curriculum",
    "chinese.mandarin.simplified": "chinese-mandarin-simplified-curriculum",
    japanese: "japanese-curriculum",
    vietnamese: "vietnamese-curriculum",
    dutch: "dutch-curriculum",
    german: "german-curriculum",
    french: "french-curriculum",
    spanish: "spanish-curriculum"
  };
  return targets[suffix];
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
  let output = "";
  let noShuffle = false;
  let view: CurriculumDisplayMode = "normal";

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
    } else if (arg === "--output") {
      output = readValue(args, index, arg);
      index += 1;
    } else if (arg === "--no-shuffle") {
      noShuffle = true;
    } else if (arg === "--view") {
      const value = readValue(args, index, arg);
      if (value !== "normal" && value !== "developer") throw new Error("--view must be normal or developer.");
      view = value;
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
    if (option === "output" && output.length === 0) {
      throw new Error("--output is required.");
    }
  }

  return { catalogue, dataDir, version, package: packageId, force, all, file, source, limit, answer, rating, now, output, noShuffle, view };
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
