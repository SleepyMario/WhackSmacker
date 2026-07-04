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

declare const process: {
  argv: string[];
  exitCode?: number;
};

export const usage = `Usage:
whacksmacker
wsm
whacksmacker help

whacksmacker status
whacksmacker decks
whacksmacker review <deck-name>

whacksmacker language status
whacksmacker language decks
whacksmacker language review <deck-name>

Run without arguments to open the interactive module menu.`;

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
  const registry = createCommandRegistry();

  if (argv.length === 0) {
    await runInteractiveMenu(registry);
    return;
  }

  if (isHelpRequest(argv)) {
    console.log(usage);
    return;
  }

  const resolved = resolveCliCommand(registry, argv);

  if (resolved === null) {
    console.error(usage);
    process.exitCode = 1;
    return;
  }

  await dispatch(resolved.command, resolved.args);
}

function isHelpRequest(argv: readonly string[]): boolean {
  return argv.length === 1 && (argv[0] === "help" || argv[0] === "--help" || argv[0] === "-h");
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
