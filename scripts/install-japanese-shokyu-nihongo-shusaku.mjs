// Build and install the private 初級日本語習作 decks in the normal local data directory.
import { createRequire } from "node:module";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const core = createRequire(import.meta.url)(join(root, "dist/packages/core/index.js"));
// Keep the authored timestamp fixed so rerunning the installer with unchanged
// source reproduces every current immutable package revision byte for byte.
const stamp = "2026-10-01T08:38:05Z";
const output = join(root, ".local-content/japanese-shokyu-nihongo-shusaku-artifacts");
const sourceRoot = join(homedir(), "Projects/whacksmacker-decks-private");
const dataDir = process.env.WHACKSMACKER_DATA_DIR ?? join(homedir(), ".local/share/whacksmacker");
const targetIds = [
  "japanese-custom-shokyu-nihongo-shusaku-i-vocabulary",
  "japanese-custom-shokyu-nihongo-shusaku-i-sentences",
  "japanese-custom-shokyu-nihongo-shusaku-ii-vocabulary",
  "japanese-custom-shokyu-nihongo-shusaku-ii-sentences"
];

const generated = [];
for (const targetId of targetIds) {
  generated.push(await core.generateContentPackage({ targetId, outputDirectory: output, generatedAt: stamp, sourceRoot }));
}
await core.generateLocalContentPackageCatalogue({
  packagesDirectory: output,
  outputPath: join(output, "catalogue.json"),
  generatedAt: stamp
});
for (const result of generated) {
  await core.installContentPackage({
    cataloguePath: join(output, "catalogue.json"),
    packageId: result.packageId,
    dataDir,
    installedAt: stamp
  });
}

console.log(`Installed ${generated.length} 初級日本語習作 decks in ${dataDir}.`);
