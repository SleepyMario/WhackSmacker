import { ensureOwnedContentPackage } from "./ensure-owned-content-package.mjs";
// Build and install the private 初級日本語習作 decks in the normal local data directory.
import { createRequire } from "node:module";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const core = createRequire(import.meta.url)(join(root, "dist/packages/core/index.js"));
// Keep the authored timestamp fixed so rerunning the installer with unchanged
// source reproduces every current immutable package revision byte for byte.
const existingStamp = "2026-10-01T08:38:05Z";
const thirdDeckStamp = "2026-10-15T08:00:00Z";
const fourthDeckStamp = "2026-10-15T12:00:00Z";
const output = join(root, "../..", "whacksmacker-decks-private/artifacts/packages/japanese-shokyu-nihongo-shusaku");
const sourceRoot = join(homedir(), "Projects/whacksmacker-decks-private");
const dataDir = process.env.WHACKSMACKER_DATA_DIR ?? join(homedir(), ".local/share/whacksmacker");
const targetIds = [
  "japanese-custom-shokyu-nihongo-shusaku-i-vocabulary",
  "japanese-custom-shokyu-nihongo-shusaku-i-sentences",
  "japanese-custom-shokyu-nihongo-shusaku-ii-vocabulary",
  "japanese-custom-shokyu-nihongo-shusaku-ii-sentences",
  "japanese-custom-shokyu-nihongo-shusaku-iii-vocabulary",
  "japanese-custom-shokyu-nihongo-shusaku-iii-sentences",
  "japanese-custom-shokyu-nihongo-shusaku-iv-vocabulary",
  "japanese-custom-shokyu-nihongo-shusaku-iv-sentences"
];
const installTargetIds = new Set([
  "japanese-custom-shokyu-nihongo-shusaku-iv-vocabulary",
  "japanese-custom-shokyu-nihongo-shusaku-iv-sentences"
]);

const generated = [];
for (const targetId of targetIds) {
  const generatedAt = targetId.includes("-iv-") ? fourthDeckStamp : targetId.includes("-iii-") ? thirdDeckStamp : existingStamp;
  generated.push(await ensureOwnedContentPackage(core, { targetId, outputDirectory: output, generatedAt, sourceRoot }));
}
await core.generateLocalContentPackageCatalogue({
  packagesDirectory: output,
  outputPath: join(output, "catalogue.json"),
  generatedAt: fourthDeckStamp
});
for (const result of generated) {
  if (!installTargetIds.has(result.targetId)) continue;
  await core.installContentPackage({
    cataloguePath: join(output, "catalogue.json"),
    packageId: result.packageId,
    dataDir,
    installedAt: fourthDeckStamp
  });
}

console.log(`Installed ${installTargetIds.size} new 初級日本語習作 decks in ${dataDir}.`);
