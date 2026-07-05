#!/usr/bin/env node

import { chessModule } from "../../packages/chess";
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

Legacy language commands:
  whacksmacker status
  whacksmacker decks
  whacksmacker review <deck-name>
  wsm status
  wsm decks
  wsm review <deck-name>

Domain-prefixed language commands:
  whacksmacker language status
  whacksmacker language decks
  whacksmacker language review <deck-name>
  wsm language status
  wsm language decks
  wsm language review <deck-name>

Geography commands:
  whacksmacker geography continents
  wsm geography continents
      Six-continent terminal map review.

Mathematics commands:
  whacksmacker mathematics beginner-volume-one [--output ./beginner-mathematics-volume-one.pdf] [--seed 184726]
  wsm mathematics beginner-volume-one [--output ./beginner-mathematics-volume-one.pdf] [--seed 184726]
      Generate the complete beginner mathematics Volume 1 workbook.
      Default output filename: ./beginner-mathematics-volume-one.pdf
      The workbook contains 1 introduction page, 3 unit title pages, 130 exercise pages, and 520 exercises.

  whacksmacker mathematics one-two-three [--output ./one-two-three-workbook.pdf] [--seed 184726]
  wsm mathematics one-two-three [--output ./one-two-three-workbook.pdf] [--seed 184726]
      Generate the standalone 50-page Unit 1 introductory counting workbook.
      Default output filename: ./one-two-three-workbook.pdf
      The workbook contains 200 exercises.
      No database or network connection is used by mathematics workbook generation.

Modules:
  Language      Available through AnkiConnect
  Chess         Placeholder
  Geography     Continents review available
  Mathematics   Beginner mathematics workbook generators

Interactive controls:
  Up/Down arrows  Move selection
  Enter           Select
  Escape          Return
  q               Quit
  Ctrl-C          Exit

Review controls:
  Enter or Space  Reveal the answer
  1               Again
  2               Hard
  3               Good
  4               Easy
  q               Stop the review

Anki requirement:
  Anki must be running.
  AnkiConnect must be installed and reachable at http://127.0.0.1:8765.

Options:
  --output PATH  Workbook output path for mathematics workbook generation.
  --seed N       Reproducible workbook seed for mathematics workbook generation.
  -h, --help      Show this help.
  -v, --version   Show the WhackSmacker version.`;

const legacyAliases = new Map<string, readonly string[]>([
  ["status", ["language", "status"]],
  ["decks", ["language", "decks"]],
  ["review", ["language", "review"]]
]);

export interface ResolvedCliCommand {
  readonly command: CliCommand;
  readonly args: readonly string[];
  readonly path: readonly string[];
}

export function createCommandRegistry(): InMemoryCliCommandRegistry {
  const cli = new InMemoryCliCommandRegistry();
  const context = {
    features: createEnabledFeatures(["cli", "language", "anki", "chess", "geography", "mathematics"]),
    paths: createDefaultAppPaths(),
    logger: consoleLogger,
    cli
  };

  languageModule.register(context);
  chessModule.register(context);
  geographyModule.register(context);
  mathematicsModule.register(context);

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

  if (argv.length === 0) {
    await runInteractiveMenu(registry);
    return;
  }

  const resolved = resolveCliCommand(registry, argv);

  if (resolved === null) {
    console.error(`Unknown command: ${argv.join(" ")}\nRun 'whacksmacker --help' or 'wsm --help' for usage.`);
    process.exitCode = 1;
    return;
  }

  await dispatch(resolved.command, resolved.args);
}

function isHelpRequest(argv: readonly string[]): boolean {
  return argv.length === 1 && (argv[0] === "help" || argv[0] === "--help" || argv[0] === "-h");
}

function isVersionRequest(argv: readonly string[]): boolean {
  return argv.length === 1 && (argv[0] === "--version" || argv[0] === "-v");
}

export function resolveCliCommand(registry: InMemoryCliCommandRegistry, argv: readonly string[]): ResolvedCliCommand | null {
  const commandName = argv[0];

  if (commandName === undefined) {
    return null;
  }

  const aliasPath = legacyAliases.get(commandName);
  if (aliasPath !== undefined) {
    const command = registry.find(aliasPath);
    if (command === null) {
      return null;
    }

    return { command, args: argv.slice(1), path: aliasPath };
  }

  const path = argv.slice(0, 2);
  const command = registry.find(path);
  if (command === null) {
    return null;
  }

  return { command, args: argv.slice(2), path };
}
