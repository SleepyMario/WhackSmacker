#!/usr/bin/env node

import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { isAbsolute, join, resolve } from "node:path";
import { deflateSync } from "node:zlib";

const outputArgument = process.argv[2] === "--output" ? process.argv[3] : undefined;
if (outputArgument === undefined || !isAbsolute(outputArgument)) {
  throw new Error("Usage: node scripts/create-terminal-artwork-smoke-fixture.mjs --output /absolute/disposable/content-directory");
}
const dataDir = resolve(outputArgument);
if (dataDir === "/" || dataDir.split("/").filter(Boolean).length < 3) {
  throw new Error("The disposable fixture output must be a narrowly scoped absolute directory.");
}

const packageId = "com.sleepymario.language.terminal-artwork-smoke";
const packageVersion = "1.0.0";
const installPath = `packages/${packageId}/${packageVersion}`;
const packageRoot = join(dataDir, installPath);
const itemPath = "content/memorization/artwork-smoke.json";
const sourcePath = "units/terminal-artwork-smoke/chapter-001/chapter.md";
const promptPath = "media/prompt.png";
const answerPath = "media/answer.png";
const promptBytes = solidPng(64, 64, 238, 126, 64);
const answerBytes = solidPng(64, 64, 54, 148, 103);
const items = {
  schemaVersion: 1,
  items: [
    {
      schemaVersion: 1,
      id: "smoke/image-card",
      kind: "vocabulary",
      prompt: {
        text: `![Disposable prompt illustration](${promptPath})\n\nPrompt-side artwork`,
        plainText: "[Image: Disposable prompt illustration]\n\nPrompt-side artwork",
        mediaType: "text/markdown"
      },
      answer: {
        text: `![Disposable answer photograph](${answerPath})\n\nAnswer-side artwork`,
        plainText: "[Image: Disposable answer photograph]\n\nAnswer-side artwork",
        mediaType: "text/markdown"
      },
      source: { path: sourcePath, title: "Artwork Smoke Deck" }
    },
    {
      schemaVersion: 1,
      id: "smoke/text-card",
      kind: "vocabulary",
      prompt: { text: "Text-only prompt", mediaType: "text/plain" },
      answer: { text: "Text-only answer", mediaType: "text/plain" },
      source: { path: sourcePath, title: "Artwork Smoke Deck" }
    }
  ]
};
const itemBytes = Buffer.from(`${JSON.stringify(items, null, 2)}\n`);
const manifest = {
  packageFormatVersion: 1,
  packageId,
  packageVersion,
  displayName: "Terminal Artwork Smoke Language",
  description: "Disposable local-only terminal artwork fixture.",
  contentType: "language-curriculum",
  capabilities: ["core-review"],
  contentSchemaVersion: "1.0.0",
  minimumWhackSmackerVersion: "0.0.1",
  source: { repository: "https://example.invalid/whacksmacker-terminal-artwork-smoke", commit: "0".repeat(40) },
  generatedAt: "2026-08-04T00:00:00Z",
  generator: { name: "whacksmacker-terminal-artwork-smoke-fixture", version: "1.0.0" },
  entryPoints: [{ id: "review", mediaType: "application/vnd.whacksmacker.memorization-items+json", path: itemPath, role: "primary" }],
  files: [
    fileRecord(itemPath, "application/vnd.whacksmacker.memorization-items+json", itemBytes),
    fileRecord(promptPath, "image/png", promptBytes),
    fileRecord(answerPath, "image/png", answerBytes)
  ]
};
const registry = {
  registryFormatVersion: 1,
  updatedAt: "2026-08-04T00:00:00Z",
  packages: [{
    packageId,
    packageVersion,
    displayName: manifest.displayName,
    contentType: manifest.contentType,
    capabilities: manifest.capabilities,
    contentSchemaVersion: manifest.contentSchemaVersion,
    minimumWhackSmackerVersion: manifest.minimumWhackSmackerVersion,
    source: manifest.source,
    installedAt: "2026-08-04T00:00:00Z",
    installPath,
    manifestSha256: "0".repeat(64),
    archiveSha256: "1".repeat(64),
    archiveSize: 1,
    catalogueId: "com.sleepymario.local.terminal-artwork-smoke"
  }]
};

await mkdir(join(packageRoot, "content/memorization"), { recursive: true, mode: 0o700 });
await mkdir(join(packageRoot, "media"), { recursive: true, mode: 0o700 });
await writeFile(join(packageRoot, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 });
await writeFile(join(packageRoot, itemPath), itemBytes, { mode: 0o600 });
await writeFile(join(packageRoot, promptPath), promptBytes, { mode: 0o600 });
await writeFile(join(packageRoot, answerPath), answerBytes, { mode: 0o600 });
await mkdir(dataDir, { recursive: true, mode: 0o700 });
await writeFile(join(dataDir, "registry.json"), `${JSON.stringify(registry, null, 2)}\n`, { mode: 0o600 });

console.log(dataDir);

function fileRecord(path, mediaType, data) {
  return { path, mediaType, size: data.length, sha256: createHash("sha256").update(data).digest("hex") };
}

function solidPng(width, height, red, green, blue) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.set([8, 2, 0, 0, 0], 8);
  const row = Buffer.alloc(1 + width * 3);
  for (let column = 0; column < width; column += 1) row.set([red, green, blue], 1 + column * 3);
  const pixels = Buffer.concat(Array.from({ length: height }, () => row));
  return Buffer.concat([signature, pngChunk("IHDR", ihdr), pngChunk("IDAT", deflateSync(pixels)), pngChunk("IEND", Buffer.alloc(0))]);
}

function pngChunk(name, data) {
  const type = Buffer.from(name, "ascii");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([type, data])));
  return Buffer.concat([length, type, data, checksum]);
}

function crc32(data) {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
