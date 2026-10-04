// Build and install the nine Japanese Topography 漢字 subset packages.
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const core = createRequire(import.meta.url)(join(root, "dist/packages/core/index.js"));
const stamp = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
const output = join(root, ".local-content/japanese-topography-kanji-artifacts");
const requested = new Set(process.argv.slice(2));
const targetIds = ["regions", "hokkaido", "tohoku", "kanto", "chubu", "kansai", "chugoku", "shikoku", "kyushu"]
  .filter((id) => requested.size === 0 || requested.has(id))
  .map((id) => `japanese-${id}-kanji`);
if (targetIds.length === 0) throw new Error("No recognized Japanese Topography 漢字 package was requested.");

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
console.log(`${targetIds.length} Japanese Topography 漢字 package${targetIds.length === 1 ? "" : "s"} installed locally.`);
