import assert from "node:assert/strict";
import { test } from "node:test";

import { createCommandRegistry, resolveCliCommand } from "../dist/apps/cli/main.js";
import { chessModule } from "../dist/packages/chess/index.js";
import { contentModule } from "../dist/packages/content/index.js";
import { InMemoryCliCommandRegistry, DomainModuleRegistry, createDefaultAppPaths, createEnabledFeatures, consoleLogger } from "../dist/packages/core/index.js";
import { geographyModule } from "../dist/packages/geography/index.js";
import { languageModule } from "../dist/packages/language/index.js";
import { mathematicsModule } from "../dist/packages/mathematics/index.js";

function createRegistrationContext(cli = new InMemoryCliCommandRegistry()) {
  return {
    features: createEnabledFeatures(["cli", "language", "chess", "geography", "mathematics", "content"]),
    paths: createDefaultAppPaths(),
    logger: consoleLogger,
    cli
  };
}

function registeredPaths(registry) {
  return registry.list().map((command) => command.path.join(" ")).sort();
}

test("application CLI registry exposes language commands and the geography prototype", () => {
  const registry = createCommandRegistry();

  assert.deepEqual(registeredPaths(registry), [
    "backup create",
    "backup inspect",
    "backup migrate",
    "backup restore",
    "chess",
    "content available",
    "content files",
    "content install",
    "content installed",
    "content read",
    "content remove",
    "content update",
    "content updates",
    "geography continents",
    "language korean",
    "language terminology",
    "language terms",
    "mathematics beginner-volume-one",
    "mathematics four-and-five",
    "mathematics one-to-five",
    "mathematics one-two-three",
    "mathematics six-to-nine",
    "module build",
    "module info",
    "module list",
    "review answer",
    "review due",
    "review items",
    "review run",
    "review show",
    "review sources"
  ]);
});

test("removed Anki language aliases no longer resolve while native review commands do", () => {
  const registry = createCommandRegistry();

  assert.equal(resolveCliCommand(registry, ["status"]), null);
  assert.equal(resolveCliCommand(registry, ["decks"]), null);
  assert.equal(resolveCliCommand(registry, ["review", "Default"]), null);
  assert.equal(resolveCliCommand(registry, ["review", "sources"])?.path.join(" "), "review sources");
  assert.equal(resolveCliCommand(registry, ["review", "due"])?.path.join(" "), "review due");
  assert.equal(resolveCliCommand(registry, ["review", "run"])?.path.join(" "), "review run");
  assert.equal(resolveCliCommand(registry, ["module", "list"])?.path.join(" "), "module list");
  assert.equal(resolveCliCommand(registry, ["module", "info"])?.path.join(" "), "module info");
  assert.equal(resolveCliCommand(registry, ["module", "build"])?.path.join(" "), "module build");
});

test("domain-prefixed language commands resolve directly", () => {
  const registry = createCommandRegistry();

  assert.equal(resolveCliCommand(registry, ["language", "status"]), null);
  assert.equal(resolveCliCommand(registry, ["language", "decks"]), null);
  assert.equal(resolveCliCommand(registry, ["language", "review", "Default"]), null);
  assert.equal(resolveCliCommand(registry, ["language", "korean"])?.path.join(" "), "language korean");
  assert.deepEqual(resolveCliCommand(registry, ["language", "korean", "--data-dir", "/tmp/wsm"])?.args, ["--data-dir", "/tmp/wsm"]);
  assert.equal(resolveCliCommand(registry, ["language", "terms"])?.path.join(" "), "language terms");
  assert.deepEqual(resolveCliCommand(registry, ["language", "terms", "--file", "INDEX.md"])?.args, ["--file", "INDEX.md"]);
  assert.equal(resolveCliCommand(registry, ["language", "terminology"])?.path.join(" "), "language terminology");
  assert.deepEqual(resolveCliCommand(registry, ["language", "terminology", "--search", "semivowel"])?.args, ["--search", "semivowel"]);
});

test("current domain modules register successfully", () => {
  const registry = new DomainModuleRegistry();

  registry.register(languageModule);
  registry.register(chessModule);
  registry.register(geographyModule);
  registry.register(mathematicsModule);
  registry.register(contentModule);

  assert.deepEqual(
    registry.list().map((module) => module.id),
    ["language", "chess", "geography", "mathematics", "content"]
  );
});

test("chess and mathematics expose CLI commands", () => {
  const cli = new InMemoryCliCommandRegistry();
  const context = createRegistrationContext(cli);

  chessModule.register(context);
  mathematicsModule.register(context);

  assert.deepEqual(registeredPaths(cli), [
    "chess",
    "mathematics beginner-volume-one",
    "mathematics four-and-five",
    "mathematics one-to-five",
    "mathematics one-two-three",
    "mathematics six-to-nine"
  ]);
});

test("geography registers the continents prototype command", () => {
  const cli = new InMemoryCliCommandRegistry();
  const context = createRegistrationContext(cli);

  geographyModule.register(context);

  assert.deepEqual(registeredPaths(cli), ["geography continents"]);
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
