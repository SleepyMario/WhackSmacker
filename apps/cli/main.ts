#!/usr/bin/env node

import { chessModule } from "../../packages/chess";
import { contentModule } from "../../packages/content";
import {
  consoleLogger,
  createDefaultAppPaths,
  createEnabledFeatures,
  InMemoryCliCommandRegistry,
  type CliCommand
} from "../../packages/core";
import { geographyModule } from "../../packages/geography";
import { languageModule } from "../../packages/language";
import { mathematicsModule } from "../../packages/mathematics";
import { runInteractiveMenu } from "./interactive-menu";

declare function require(name: string): { version: string };

declare const process: {
  argv: string[];
  exitCode?: number;
};

const packageMetadata = require("../../../package.json");

export const appVersion = packageMetadata.version;

export const usage = `WhackSmacker

A modular terminal application for language learning, chess, geography, mathematics, and future domains.

Usage:
  wsm
  whacksmacker
  wsm <command>
  whacksmacker <command>

Interactive mode:
  wsm
  whacksmacker
  wsm --data-dir <dir>
  whacksmacker --data-dir <dir>
  whacksmacker --data-dir <dir> --catalogue <catalogue.json>
      Open the interactive menu. The Language menu discovers installed language packages from the selected content data directory.
      When --catalogue is supplied, Modules available lists first-party installable packages and Space installs the selected package.

Language commands:
  whacksmacker language korean [--file <path>] [--version <version>] [--data-dir <dir>]
  wsm language korean [--file <path>] [--version <version>] [--data-dir <dir>]
      Browse installed Korean curriculum content, including Hangul Foundation entries.

  whacksmacker language terms [<group>] [--file <path>] [--version <version>] [--data-dir <dir>]
  wsm language terms [<group>] [--file <path>] [--version <version>] [--data-dir <dir>]
      Browse installed Linguistic Terminology package content.

  whacksmacker language terminology [--search <text>] [--category <name>] [--id <stable-id>]
  wsm language terminology [--search <text>] [--category <name>] [--id <stable-id>]

Geography commands:
  whacksmacker geography continents
  wsm geography continents
      Six-continent terminal map review.

Chess commands:
  whacksmacker chess [e2e4 ...] [--legal <square>]
  wsm chess [e2e4 ...] [--legal <square>]
      Show a terminal chessboard, apply UCI-style coordinate moves, and list legal destinations.

Mathematics commands:
  whacksmacker mathematics beginner-volume-one [--output ./beginner-mathematics-volume-one.pdf] [--seed 184726]
  wsm mathematics beginner-volume-one [--output ./beginner-mathematics-volume-one.pdf] [--seed 184726]
      Generate the complete beginner mathematics Volume 1 workbook.
      Default output filename: ./beginner-mathematics-volume-one.pdf
      The workbook contains 1 overall introduction page, 4 unit introduction pages, 190 exercise pages, and 760 exercises.

  whacksmacker mathematics one-two-three [--output ./one-two-three-workbook.pdf] [--seed 184726]
  wsm mathematics one-two-three [--output ./one-two-three-workbook.pdf] [--seed 184726]
      Generate the standalone Unit 1 introductory counting workbook.
      Default output filename: ./one-two-three-workbook.pdf
      The workbook contains 200 exercises.
      No database or network connection is used by mathematics workbook generation.

  whacksmacker mathematics four-and-five [--output ./four-and-five-workbook.pdf] [--seed 184726]
  wsm mathematics four-and-five [--output ./four-and-five-workbook.pdf] [--seed 184726]
      Generate the standalone Unit 2 four and five workbook.
      Default output filename: ./four-and-five-workbook.pdf

  whacksmacker mathematics one-to-five [--output ./one-to-five-workbook.pdf] [--seed 184726]
  wsm mathematics one-to-five [--output ./one-to-five-workbook.pdf] [--seed 184726]
      Generate the standalone Unit 3 one to five workbook.
      Default output filename: ./one-to-five-workbook.pdf

  whacksmacker mathematics six-to-nine [--output ./six-to-nine-workbook.pdf] [--seed 184726]
  wsm mathematics six-to-nine [--output ./six-to-nine-workbook.pdf] [--seed 184726]
      Generate the standalone Unit 4 six through nine workbook.
      Default output filename: ./six-to-nine-workbook.pdf

Content package commands:
  whacksmacker content available --catalogue <catalogue.json>
  whacksmacker content install <package-id> --catalogue <catalogue.json> [--version <version>] [--data-dir <dir>] [--force]
  whacksmacker content installed [--data-dir <dir>]
  whacksmacker content updates --catalogue <catalogue.json> [--data-dir <dir>]
  whacksmacker content update <package-id> --catalogue <catalogue.json> [--data-dir <dir>]
  whacksmacker content remove <package-id> --version <version> [--data-dir <dir>]
  whacksmacker content read [<package-id>] [--file <path>] [--version <version>] [--data-dir <dir>]
  whacksmacker content files <package-id> [--version <version>] [--data-dir <dir>]

Native review commands:
  whacksmacker review sources [--package <package-id>] [--version <version>] [--data-dir <dir>]
  whacksmacker review items --package <package-id> [--version <version>] [--source <path>] [--data-dir <dir>]
  whacksmacker review due [--package <package-id>] [--version <version>] [--data-dir <dir>] [--limit <n>]
  whacksmacker review show <package-id> <item-id> [--version <version>] [--data-dir <dir>] [--answer]
  whacksmacker review answer <package-id> <item-id> --rating <again|hard|good|easy> [--version <version>] [--data-dir <dir>] [--now <iso-timestamp>]
  whacksmacker review run --package <package-id> --source <path> [--version <version>] [--data-dir <dir>] [--now <iso-timestamp>] [--no-shuffle]

Module commands:
  whacksmacker module list [--data-dir <dir>]
      List first-class modules from installed content packages and built-in/native modules.

  whacksmacker module info <module-id> [--data-dir <dir>]
      Show module metadata.

  whacksmacker module build <module-id> [--data-dir <dir>]
      Show the current build/package route for a module.

Backup commands:
  whacksmacker backup create --output <backup.json> [--data-dir <dir>]
  whacksmacker backup inspect <backup.json>
  whacksmacker backup restore <backup.json> [--data-dir <dir>] [--force]
  whacksmacker backup migrate <backup.json> --output <new-backup.json>

Modules:
  Languages     Installed language content packages
  Games         Chess native module
  Geography     Built-in continents review module
  Mathematics   Built-in beginner mathematics workbook generators
  Content       Downloadable content package management

Interactive controls:
  Up/Down arrows  Move selection
  Enter           Select/open
  Space           Install selected available module
  Escape          Return
  q               Quit
  Ctrl-C          Exit

Options:
  --output PATH  Workbook output path for mathematics workbook generation.
  --seed N       Reproducible workbook seed for mathematics workbook generation.
  -h, --help      Show this help.
  -v, --version   Show the WhackSmacker version.`;

export interface ResolvedCliCommand {
  readonly command: CliCommand;
  readonly args: readonly string[];
  readonly path: readonly string[];
}

interface GlobalCliOptions {
  readonly args: readonly string[];
  readonly dataDir?: string;
  readonly cataloguePath?: string;
}

export function createCommandRegistry(): InMemoryCliCommandRegistry {
  const cli = new InMemoryCliCommandRegistry();
  const context = {
    features: createEnabledFeatures(["cli", "language", "chess", "geography", "mathematics", "content"]),
    paths: createDefaultAppPaths(),
    logger: consoleLogger,
    cli
  };

  languageModule.register(context);
  chessModule.register(context);
  geographyModule.register(context);
  mathematicsModule.register(context);
  contentModule.register(context);

  return cli;
}

async function dispatch(command: CliCommand, args: readonly string[]): Promise<void> {
  try {
    await command.run(args);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exitCode = 1;
  }
}

export async function main(argv = process.argv.slice(2)): Promise<void> {
  if (isHelpRequest(argv)) {
    console.log(usage);
    return;
  }

  if (isVersionRequest(argv)) {
    console.log(appVersion);
    return;
  }

  const registry = createCommandRegistry();
  const globalOptions = parseLeadingGlobalOptions(argv);

  if (globalOptions.args.length === 0) {
    await runInteractiveMenu(registry, undefined, {
      dataDir: globalOptions.dataDir,
      cataloguePath: globalOptions.cataloguePath
    });
    return;
  }

  const interactiveOptions = parseInteractiveOptions(globalOptions.args);
  if (interactiveOptions !== null) {
    await runInteractiveMenu(registry, undefined, {
      dataDir: interactiveOptions.dataDir ?? globalOptions.dataDir,
      cataloguePath: interactiveOptions.cataloguePath ?? globalOptions.cataloguePath
    });
    return;
  }

  const resolved = resolveCliCommand(registry, globalOptions.args);

  if (resolved === null) {
    console.error(`Unknown command: ${globalOptions.args.join(" ")}\nRun 'whacksmacker --help' or 'wsm --help' for usage.`);
    process.exitCode = 1;
    return;
  }

  await dispatch(resolved.command, appendGlobalOptions(resolved, globalOptions));
}

function parseLeadingGlobalOptions(argv: readonly string[]): GlobalCliOptions {
  let dataDir: string | undefined;
  let cataloguePath: string | undefined;
  let index = 0;

  while (index < argv.length) {
    const arg = argv[index];
    if (arg === "--data-dir") {
      dataDir = readGlobalOptionValue(argv, index, arg);
      index += 2;
      continue;
    }
    if (arg === "--catalogue") {
      cataloguePath = readGlobalOptionValue(argv, index, arg);
      index += 2;
      continue;
    }
    break;
  }

  return { args: argv.slice(index), dataDir, cataloguePath };
}

function readGlobalOptionValue(argv: readonly string[], index: number, option: string): string {
  const value = argv[index + 1];
  if (value === undefined || value.trim().length === 0 || value.startsWith("--")) {
    throw new Error(`${option} requires a value.`);
  }
  return value;
}

function appendGlobalOptions(resolved: ResolvedCliCommand, globalOptions: GlobalCliOptions): readonly string[] {
  const args = [...resolved.args];
  if (globalOptions.dataDir !== undefined && commandAcceptsDataDir(resolved.path) && !args.includes("--data-dir")) {
    args.push("--data-dir", globalOptions.dataDir);
  }
  if (globalOptions.cataloguePath !== undefined && commandAcceptsCatalogue(resolved.path) && !args.includes("--catalogue")) {
    args.push("--catalogue", globalOptions.cataloguePath);
  }
  return args;
}

function commandAcceptsDataDir(path: readonly string[]): boolean {
  return path[0] === "content"
    || path[0] === "review"
    || path[0] === "module"
    || path[0] === "backup"
    || sameCliPath(path, ["language", "korean"])
    || sameCliPath(path, ["language", "terms"]);
}

function commandAcceptsCatalogue(path: readonly string[]): boolean {
  return path[0] === "content" || path[0] === "review" || path[0] === "module";
}

function parseInteractiveOptions(argv: readonly string[]): { readonly dataDir?: string; readonly cataloguePath?: string } | null {
  if (argv.length === 0) {
    return {};
  }
  let dataDir: string | undefined;
  let cataloguePath: string | undefined;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--data-dir") {
      const value = argv[index + 1];
      if (value === undefined || value.trim().length === 0) {
        return null;
      }
      dataDir = value;
      index += 1;
      continue;
    }
    if (arg === "--catalogue") {
      const value = argv[index + 1];
      if (value === undefined || value.trim().length === 0) {
        return null;
      }
      cataloguePath = value;
      index += 1;
      continue;
    }
    return null;
  }
  if (dataDir !== undefined || cataloguePath !== undefined) {
    return { dataDir, cataloguePath };
  }
  return null;
}

function isHelpRequest(argv: readonly string[]): boolean {
  return argv.length === 1 && (argv[0] === "help" || argv[0] === "--help" || argv[0] === "-h");
}

function isVersionRequest(argv: readonly string[]): boolean {
  return argv.length === 1 && (argv[0] === "--version" || argv[0] === "-v");
}

export function resolveCliCommand(registry: InMemoryCliCommandRegistry, argv: readonly string[]): ResolvedCliCommand | null {
  for (const command of [...registry.list()].sort((left, right) => right.path.length - left.path.length)) {
    if (argvStartsWith(argv, command.path)) {
      return { command, args: argv.slice(command.path.length), path: command.path };
    }
  }

  return null;
}

function argvStartsWith(argv: readonly string[], path: readonly string[]): boolean {
  return argv.length >= path.length && path.every((segment, index) => argv[index] === segment);
}

function sameCliPath(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((segment, index) => segment === right[index]);
}
