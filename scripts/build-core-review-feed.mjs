import { execFileSync } from "node:child_process";
import { mkdir, rm } from "node:fs/promises";

const output = process.argv[2] ?? "/core-feed";
const generatedAt = process.env.SOURCE_DATE_EPOCH
  ? new Date(Number(process.env.SOURCE_DATE_EPOCH) * 1000).toISOString().replace(/\.\d{3}Z$/u, "Z")
  : "2026-07-13T00:00:00Z";
const targets = ["korean", "chinese-traditional", "chinese-simplified", "english", "japanese", "vietnamese", "dutch", "german", "french", "spanish"].map(value => `${value}-core-reviews`);

await rm(output, { recursive: true, force: true });
await mkdir(`${output}/packages`, { recursive: true });
execFileSync("node", ["dist/packages/core/content-package-generator-cli.js", ...targets.flatMap(target => ["--target", target]), "--output-dir", `${output}/packages`, "--generated-at", generatedAt], { stdio: "inherit" });
execFileSync("node", ["dist/packages/core/content-package-catalogue-cli.js", "--packages-dir", `${output}/packages`, "--output", `${output}/catalogue.json`, "--generated-at", generatedAt], { stdio: "inherit" });
