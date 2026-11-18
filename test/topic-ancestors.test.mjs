import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import {
  validateContentPackageManifest,
  validateContentPackageCatalogue
} from "../dist/packages/core/index.js";
import { groupExplicitTopicMenuLeaves } from "../dist/apps/cli/interactive-menu.js";

const ancestors = [
  { id: "video-games", displayName: "Video Games" },
  { id: "the-legend-of-zelda", displayName: "The Legend of Zelda" }
];
const leaf = (id, label) => ({ id, label, kind: "review-source" });
const example = (path) => readFile(new URL(path, import.meta.url), "utf8").then(JSON.parse);

test("topic ancestry is accepted by package and catalogue contracts", async () => {
  const topic = { id: "breath-of-the-wild", displayName: "Breath of the Wild", deckDisplayName: "NPC Dialogue", ancestors };
  const manifest = await example("../docs/content-packages/examples/linguistic-terminology-manifest.example.json");
  manifest.topic = topic;
  assert.deepEqual(validateContentPackageManifest(manifest).errors, []);
  const catalogue = await example("../docs/content-packages/examples/local-catalogue.example.json");
  catalogue.packages[0].topic = topic;
  assert.deepEqual(validateContentPackageCatalogue(catalogue).errors, []);
});

test("topic ancestry validation rejects repeated and malformed parents", async () => {
  const manifest = await example("../docs/content-packages/examples/linguistic-terminology-manifest.example.json");
  manifest.topic = {
    id: "breath-of-the-wild", displayName: "Breath of the Wild", deckDisplayName: "NPC Dialogue",
    ancestors: [{ id: "video-games", displayName: "Video Games" }, { id: "video-games", displayName: "Duplicate" }]
  };
  assert.match(validateContentPackageManifest(manifest).errors.join("\n"), /must not repeat/);
  manifest.topic.ancestors = [];
  assert.match(validateContentPackageManifest(manifest).errors.join("\n"), /1–8/);
});

test("Zelda Private decks render three explicit levels, preserving original leaf IDs", () => {
  const inputs = ["NPC Dialogue", "Quests", "Items"].map((label, idx) => ({
    topicId: "breath-of-the-wild",
    topicLabel: "Breath of the Wild",
    topicAncestors: ancestors.map((a) => ({ id: a.id, label: a.displayName })),
    leaf: leaf(`stable-card-${idx}`, label)
  }));
  const grouped = groupExplicitTopicMenuLeaves("com.sleepymario.language.japanese", "custom", inputs);
  assert.deepEqual(grouped.map((n) => n.label), ["Video Games"]);
  const franchise = grouped[0].children[0];
  const game = franchise.children[0];
  assert.equal(franchise.label, "The Legend of Zelda");
  assert.equal(game.label, "Breath of the Wild");
  assert.deepEqual(game.children.map((n) => n.label), ["Items", "NPC Dialogue", "Quests"]);
  assert.equal(game.children[0].id, "stable-card-2");
});

test("old topic grouping and direct-leaf identity remain stable", () => {
  const group = groupExplicitTopicMenuLeaves("lang", "custom", [
    { topicId: "animals", topicLabel: "Animals", leaf: leaf("old-id", "Animals") }
  ]);
  assert.equal(group.length, 1);
  assert.equal(group[0].id, "old-id");
});
