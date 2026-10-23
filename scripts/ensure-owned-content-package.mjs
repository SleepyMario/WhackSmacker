// Retained package revisions are immutable. Bump the target revision to rebuild.
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

export async function ensureOwnedContentPackage(core, options) {
  const target = core.contentPackageGeneratorTargets.find(value => value.id === options.targetId);
  if (!target) throw new Error(`Unknown target: ${options.targetId}`);
  let catalogue;
  try {
    catalogue = JSON.parse(await readFile(join(options.outputDirectory, "catalogue.json"), "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  const entry = catalogue?.packages.find(value => value.packageId === target.packageId
    && value.deckVersion === target.deckVersion && value.artifactRevision === target.artifactRevision);
  if (entry) {
    const bytes = await readFile(fileURLToPath(entry.package.url));
    if (bytes.length !== entry.package.size || createHash("sha256").update(bytes).digest("hex") !== entry.package.sha256) {
      throw new Error(`Retained artifact failed integrity verification: ${target.id}`);
    }
    console.log(`Reusing immutable ${target.id} revision ${target.artifactRevision}; bump the revision for source changes.`);
    return { targetId: target.id, packageId: target.packageId };
  }
  return core.generateContentPackage(options);
}
