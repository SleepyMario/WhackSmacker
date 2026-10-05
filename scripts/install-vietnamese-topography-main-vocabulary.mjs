// Build and install the Vietnamese Topography main vocabulary package.
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const privateDeckRoot = join(root, "..", "..", "whacksmacker-decks-private");
const core = createRequire(import.meta.url)(join(root, "dist/packages/core/index.js"));
const stamp = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
const output = join(root, ".local-content/vietnamese-topography-main-vocabulary-artifacts");
const result = await core.generateContentPackage({
  targetId: "vietnamese-general-topography-main-vocabulary",
  outputDirectory: output,
  generatedAt: stamp,
  sourceRoot: privateDeckRoot
});
await core.generateLocalContentPackageCatalogue({ packagesDirectory: output, outputPath: join(output, "catalogue.json"), generatedAt: stamp });
await core.installContentPackage({
  cataloguePath: join(output, "catalogue.json"),
  packageId: result.packageId,
  dataDir: join(root, ".local-content/vietnamese-topography"),
  installedAt: stamp
});
console.log("Vietnamese Topography main vocabulary package installed locally.");
