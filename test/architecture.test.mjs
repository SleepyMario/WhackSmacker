import assert from "node:assert/strict";
import { test } from "node:test";

import { createCommandRegistry, resolveCliCommand } from "../dist/apps/cli/main.js";
import { chessModule } from "../dist/packages/chess/index.js";
import { InMemoryCliCommandRegistry, DomainModuleRegistry, createDefaultAppPaths, createEnabledFeatures, consoleLogger } from "../dist/packages/core/index.js";
import { geographyModule } from "../dist/packages/geography/index.js";
import { languageModule } from "../dist/packages/language/index.js";
import { mathematicsModule } from "../dist/packages/mathematics/index.js";

function createRegistrationContext(cli = new InMemoryCliCommandRegistry()) {
  return {
    features: createEnabledFeatures(["cli", "language", "anki", "chess", "geography", "mathematics"]),
    paths: createDefaultAppPaths(),
    logger: consoleLogger,
    cli
  };
}

function registeredPaths(registry) {
  return registry.list().map((command) => command.path.join(" ")).sort();
}

test("application CLI registry exposes only language user commands", () => {
  const registry = createCommandRegistry();

  assert.deepEqual(registeredPaths(registry), ["language decks", "language review", "language status"]);
});

test("legacy language aliases resolve to language command paths", () => {
  const registry = createCommandRegistry();

  assert.equal(resolveCliCommand(registry, ["status"])?.path.join(" "), "language status");
  assert.equal(resolveCliCommand(registry, ["decks"])?.path.join(" "), "language decks");
  assert.equal(resolveCliCommand(registry, ["review", "Default"])?.path.join(" "), "language review");
  assert.deepEqual(resolveCliCommand(registry, ["review", "Deck With Spaces"])?.args, ["Deck With Spaces"]);
});

test("domain-prefixed language commands resolve directly", () => {
  const registry = createCommandRegistry();

  assert.equal(resolveCliCommand(registry, ["language", "status"])?.path.join(" "), "language status");
  assert.equal(resolveCliCommand(registry, ["language", "decks"])?.path.join(" "), "language decks");
  assert.equal(resolveCliCommand(registry, ["language", "review", "Default"])?.path.join(" "), "language review");
  assert.deepEqual(resolveCliCommand(registry, ["language", "review", "Default"])?.args, ["Default"]);
});

test("current domain modules register successfully", () => {
  const registry = new DomainModuleRegistry();

  registry.register(languageModule);
  registry.register(chessModule);
  registry.register(geographyModule);
  registry.register(mathematicsModule);

  assert.deepEqual(
    registry.list().map((module) => module.id),
    ["language", "chess", "geography", "mathematics"]
  );
});

test("placeholder domains expose no user commands yet", () => {
  const cli = new InMemoryCliCommandRegistry();
  const context = createRegistrationContext(cli);

  chessModule.register(context);
  geographyModule.register(context);
  mathematicsModule.register(context);

  assert.deepEqual(cli.list(), []);
});

test("duplicate module identifiers are rejected clearly", () => {
  const registry = new DomainModuleRegistry();

  registry.register(chessModule);

  assert.throws(() => registry.register(chessModule), /Domain module is already registered: chess/);
});

test("duplicate CLI command paths are rejected clearly and do not overwrite", async () => {
  const registry = new InMemoryCliCommandRegistry();
  const calls = [];
  const original = {
    path: ["language", "status"],
    summary: "Original",
    run: async () => {
      calls.push("original");
    }
  };
  const duplicate = {
    path: ["language", "status"],
    summary: "Duplicate",
    run: async () => {
      calls.push("duplicate");
    }
  };

  registry.register(original);

  assert.throws(() => registry.register(duplicate), /CLI command path is already registered: language status/);

  await registry.find(["language", "status"])?.run([]);
  assert.deepEqual(calls, ["original"]);
});
