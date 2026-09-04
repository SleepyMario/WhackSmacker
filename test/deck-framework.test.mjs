import assert from "node:assert/strict";
import { test } from "node:test";

import {
  animalsLegacyVersionMigrations,
  compareDeckFrameworkVersions,
  defaultDeckInteractionProfile,
  immutableDeckArtifactKey,
  legacyPackageVersionMigration,
  memorizationOutputsFromAnswer,
  projectDeckFrameworkVersion,
  validateDeckFrameworkVersion,
  validateDeckInteractionProfile,
  validateMediaPolicy,
  validateUniversalDeckEntry
} from "../dist/packages/core/index.js";

test("deck content version and artifact revision validate independently as one explicit axis pair", () => {
  assert.deepEqual(validateDeckFrameworkVersion({ packageVersion: "9.9.9", deckVersion: "0.0.1", artifactRevision: 3 }).errors, []);
  assert.match(validateDeckFrameworkVersion({ packageVersion: "0.0.1", deckVersion: "0.0.1", artifactRevision: 0 }).errors.join("\n"), /positive integer/u);
  assert.match(validateDeckFrameworkVersion({ packageVersion: "0.0.1", deckVersion: "0.0.1" }).errors.join("\n"), /declared together/u);
});

test("legacy versions default safely while immutable identity includes both canonical axes", () => {
  assert.deepEqual(projectDeckFrameworkVersion({ packageVersion: "1.2.3" }), { deckVersion: "1.2.3", artifactRevision: 1 });
  assert.equal(immutableDeckArtifactKey("com.example", { packageVersion: "7.7.7", deckVersion: "0.0.1", artifactRevision: 3 }), "com.example@0.0.1#3");
});

test("newest projection sorts semantic deck version and then artifact revision", () => {
  assert.ok(compareDeckFrameworkVersions({ packageVersion: "9.0.0", deckVersion: "0.0.1", artifactRevision: 3 }, { packageVersion: "1.0.0", deckVersion: "0.0.1", artifactRevision: 2 }) > 0);
  assert.ok(compareDeckFrameworkVersions({ packageVersion: "0.0.0", deckVersion: "0.1.0", artifactRevision: 1 }, { packageVersion: "9.0.0", deckVersion: "0.0.9", artifactRevision: 99 }) > 0);
});

test("Animals historical technical versions have one explicit idempotent migration plan", () => {
  assert.deepEqual(animalsLegacyVersionMigrations.map((entry) => [entry.legacyPackageVersion, entry.deckVersion, entry.artifactRevision]), [
    ["0.0.0", "0.0.1", 1], ["0.0.1", "0.0.1", 2], ["0.0.2", "0.0.1", 3]
  ]);
  for (const expected of animalsLegacyVersionMigrations) {
    assert.deepEqual(legacyPackageVersionMigration(expected.packageId, expected.legacyPackageVersion, animalsLegacyVersionMigrations), { deckVersion: expected.deckVersion, artifactRevision: expected.artifactRevision });
  }
});

test("one and three outputs use the same ordered stable output model", () => {
  assert.deepEqual(memorizationOutputsFromAnswer({ text: "one", mediaType: "text/plain" }).map((output) => output.id), ["answer"]);
  assert.deepEqual(memorizationOutputsFromAnswer({ text: "A: alpha\nB: beta\nC: gamma", mediaType: "text/plain" }).map((output) => output.id), ["a", "b", "c"]);
  assert.deepEqual(
    memorizationOutputsFromAnswer({ text: "Pinyin: 陸：wùzhì\n台：wùzhí\nCharacters: 物质 / 物質", mediaType: "text/plain" }).map((output) => [output.id, output.content.text]),
    [["pinyin", "陸：wùzhì\n台：wùzhí"], ["characters", "物质 / 物質"]]
  );
});

test("synthetic Korean and Vietnamese three-output fixtures need no language switch", () => {
  for (const language of ["ko", "vi"]) {
    const outputs = memorizationOutputsFromAnswer({ text: "A: first\nB: second\nC: third", mediaType: "text/plain", language });
    assert.deepEqual(outputs.map((output) => output.id), ["a", "b", "c"]);
  }
});

test("interaction contradictions are rejected and valid precomposed behavior is accepted", () => {
  assert.deepEqual(validateDeckInteractionProfile(defaultDeckInteractionProfile).errors, []);
  assert.match(validateDeckInteractionProfile({ ...defaultDeckInteractionProfile, reveal: "sequential" }).errors.join("\n"), /sequential reveal/u);
  assert.match(validateDeckInteractionProfile({ ...defaultDeckInteractionProfile, grading: "output-specific", satisfaction: "one" }).errors.join("\n"), /output-specific grading/u);
});

test("media policies and input, shared-output, and output-specific bindings are orthogonal", () => {
  const base = {
    entryId: "entry-1", input: { text: "prompt" },
    outputs: [{ id: "a", content: { text: "one" } }, { id: "b", content: { text: "two" } }, { id: "c", content: { text: "three" } }],
    interaction: { ...defaultDeckInteractionProfile, labels: "independent", outputMedia: "output-specific" }
  };
  const media = [
    binding("prompt", "input", "illustration"),
    binding("shared", "shared-output", "wildlife"),
    binding("a", "output", "detail", "a"), binding("b", "output", "detail", "b"), binding("c", "output", "detail", "c")
  ];
  assert.deepEqual(validateUniversalDeckEntry({ ...base, media }, "optional").errors, []);
  assert.deepEqual(validateUniversalDeckEntry({ ...base, media: [] }, "optional").errors, []);
  assert.match(validateUniversalDeckEntry({ ...base, media }, "none").errors.join("\n"), /forbids media/u);
  assert.match(validateUniversalDeckEntry({ ...base, media: [{ ...media[0], approval: "draft" }] }, "required").errors.join("\n"), /approved non-placeholder/u);
  assert.deepEqual(validateMediaPolicy("required").errors, []);
});

function binding(id, side, role, outputId) {
  return { id, side, ...(outputId === undefined ? {} : { outputId }), role, path: `media/${id}.png`, mediaType: "image/png", sha256: "a".repeat(64), size: 1, width: 1, height: 1, approval: "approved" };
}
