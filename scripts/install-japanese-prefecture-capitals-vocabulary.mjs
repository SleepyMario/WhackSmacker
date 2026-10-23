import { ensureOwnedContentPackage } from "./ensure-owned-content-package.mjs";
// Build and install the Japanese Prefecture Capitals Vocabulary package.
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const core = createRequire(import.meta.url)(join(root, "dist/packages/core/index.js"));
const stamp = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
const output = join(root, "../japanese-curriculum/artifacts/packages/japanese-prefecture-capitals-vocabulary");
const result = await ensureOwnedContentPackage(core, {
  targetId: "japanese-general-prefecture-capitals-vocabulary",
  outputDirectory: output,
  generatedAt: stamp,
  sourceRoot: dirname(root)
});
await core.generateLocalContentPackageCatalogue({ packagesDirectory: output, outputPath: join(output, "catalogue.json"), generatedAt: stamp });
await core.installContentPackage({
  cataloguePath: join(output, "catalogue.json"),
  packageId: result.packageId,
  dataDir: core.resolveContentDataDirectory(),
  installedAt: stamp
});
console.log("Japanese Prefecture Capitals Vocabulary package installed locally.");
