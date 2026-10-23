import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";

const args = process.argv.slice(2);
const dataDir = process.env.WHACKSMACKER_DATA_DIR ?? "/data";
const cataloguePath = process.env.WHACKSMACKER_CORE_CATALOGUE ?? "/core-feed/catalogue.json";
try {
  const require = createRequire(import.meta.url);
  const { installContentPackage, listInstalledContentPackages } = require("/app/dist/packages/core/content-package-manager.js");
  const catalogue = JSON.parse(await readFile(cataloguePath, "utf8"));
  const { immutableDeckArtifactKey } = require("/app/dist/packages/core/deck-framework.js");
  const installed = new Set((await listInstalledContentPackages(dataDir)).map(item => immutableDeckArtifactKey(item.packageId, item)));
  for (const entry of catalogue.packages) {
    const key = immutableDeckArtifactKey(entry.packageId, entry);
    if (!installed.has(key)) {
      await installContentPackage({ cataloguePath, packageId: entry.packageId, packageVersion: entry.packageVersion,
        deckVersion: entry.deckVersion, artifactRevision: entry.artifactRevision, dataDir });
      installed.add(key);
    }
  }
} catch (error) {
  console.error(`Unable to initialize bundled core reviews: ${String(error)}`);
  process.exit(1);
}
const child = spawn("node", ["/app/dist/main.js", ...args], { stdio: "inherit" });
child.on("exit", code => process.exit(code ?? 1));
