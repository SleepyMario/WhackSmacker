// Build and install the nine Japanese Topography 漢字 subset packages.
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const core = createRequire(import.meta.url)(join(root, "dist/packages/core/index.js"));
const stamp = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
const output = join(root, ".local-content/japanese-topography-kanji-artifacts");
const targetIds = ["regions", "hokkaido", "tohoku", "kanto", "chubu", "kansai", "chugoku", "shikoku", "kyushu"]
  .map((id) => `japanese-${id}-kanji`);

const generated = [];
for (const targetId of targetIds) {
  generated.push(await core.generateContentPackage({ targetId, outputDirectory: output, generatedAt: stamp, sourceRoot: root }));
}
await core.generateLocalContentPackageCatalogue({ packagesDirectory: output, outputPath: join(output, "catalogue.json"), generatedAt: stamp });
for (const result of generated) {
  await core.installContentPackage({
    cataloguePath: join(output, "catalogue.json"), packageId: result.packageId,
    dataDir: join(root, ".local-content/japanese-prefectures"), installedAt: stamp
  });
}
console.log("Nine Japanese Topography 漢字 packages installed locally.");
