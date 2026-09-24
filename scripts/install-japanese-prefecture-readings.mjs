// Rebuild only the Japanese prefecture reading package and install into its dedicated local feed.
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const root = dirname(dirname(fileURLToPath(import.meta.url)));
const core = createRequire(import.meta.url)(join(root, "dist/packages/core/index.js"));
const stamp = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
const output = join(root, ".local-content/japanese-prefectures-artifacts");
const result = await core.generateContentPackage({ targetId: "japanese-prefectures-kanji", outputDirectory: output, generatedAt: stamp, sourceRoot: root });
await core.generateLocalContentPackageCatalogue({ packagesDirectory: output, outputPath: join(output, "catalogue.json"), generatedAt: stamp });
await core.installContentPackage({ cataloguePath: join(output, "catalogue.json"), packageId: result.packageId, dataDir: join(root, ".local-content/japanese-prefectures"), installedAt: stamp });
console.log("Japanese prefecture reading package installed locally.");
