import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { test } from "node:test";

import {
  contentPackageGeneratorTargets,
  generateContentPackage,
  validateContentPackageManifest
} from "../dist/packages/core/index.js";

test("content package generator exposes only the initial two targets", () => {
  assert.deepEqual(
    contentPackageGeneratorTargets.map((target) => [target.id, target.packageId]),
    [
      ["linguistic-terminology", "com.sleepymario.language.linguistic-terminology"],
      ["korean-curriculum", "com.sleepymario.language.korean"]
    ]
  );
});

test("content package generator creates a valid Linguistic Terminology package", async () => {
  const directory = await mkdtemp(join(tmpdir(), "wsm-terminology-package-"));

  try {
    const result = await generateContentPackage({
      targetId: "linguistic-terminology",
      outputDirectory: directory,
      generatedAt: "2026-07-06T00:00:00Z"
    });
    const archive = await readZip(result.filePath);
    const manifest = JSON.parse(archive.get("manifest.json").toString("utf8"));
    const content = JSON.parse(archive.get("content/content.json").toString("utf8"));

    assert.equal(result.packageId, "com.sleepymario.language.linguistic-terminology");
    assert.equal(result.filePath.endsWith("com.sleepymario.language.linguistic-terminology-0.1.0.wspkg"), true);
    assert.equal(archive.has("manifest.json"), true);
    assert.equal(archive.has("content/content.json"), true);
    assert.deepEqual(validateContentPackageManifest(manifest).errors, []);
    assert.equal(manifest.contentType, "linguistic-terminology");
    assert.equal(manifest.entryPoints[0].path, "content/content.json");
    assert.equal(content.packageId, "com.sleepymario.language.linguistic-terminology");
    assert.ok(content.files.some((file) => file.path === "terms/korean.md"));
    assert.ok(content.files.some((file) => file.text.includes("## 받침")));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("content package generator creates a valid Korean Curriculum package", async () => {
  const directory = await mkdtemp(join(tmpdir(), "wsm-korean-package-"));

  try {
    const result = await generateContentPackage({
      targetId: "korean-curriculum",
      outputDirectory: directory,
      generatedAt: "2026-07-06T00:00:00Z"
    });
    const archive = await readZip(result.filePath);
    const manifest = JSON.parse(archive.get("manifest.json").toString("utf8"));
    const content = JSON.parse(archive.get("content/content.json").toString("utf8"));

    assert.equal(result.packageId, "com.sleepymario.language.korean");
    assert.equal(result.filePath.endsWith("com.sleepymario.language.korean-0.1.0.wspkg"), true);
    assert.deepEqual(validateContentPackageManifest(manifest).errors, []);
    assert.equal(manifest.contentType, "language-curriculum");
    assert.equal(manifest.dependencies[0].packageId, "com.sleepymario.language.linguistic-terminology");
    assert.equal(content.packageId, "com.sleepymario.language.korean");
    assert.ok(content.files.some((file) => file.path === "units/hangul-foundation/README.md"));
    assert.ok(content.files.some((file) => file.path === "units/hangul-foundation/chapter-01-vowels/unit-01-simple-vowels.md"));
    assert.ok(content.files.some((file) => file.path === "units/korean-core/chapter-020-basic-life-sentences-13/chapter.md"));
    assert.ok(content.files.some((file) => file.path === "review-decks/chapter-001-020/cards.tsv"));
    assert.equal(archive.has("content/memorization/review-decks/chapter-001-020.json"), true);

    const reviewItems = JSON.parse(archive.get("content/memorization/review-decks/chapter-001-020.json").toString("utf8"));
    assert.equal(reviewItems.schemaVersion, 1);
    assert.equal(reviewItems.items.length, 214);
    assert.equal(reviewItems.items[0].source.title, "Chapter 1-20");
    assert.equal(reviewItems.items[0].prompt.text, "안녕하세요");
    assert.equal(reviewItems.items[0].answer.text, "hello");
    assert.ok(reviewItems.items.some((item) => item.prompt.text === "topic particle" && item.answer.text === "은/는"));
    assert.ok(reviewItems.items.some((item) => item.prompt.text === "이/가" && item.answer.text === "subject/existence marker"));
    assert.equal(reviewItems.items.some((item) => item.prompt.text === "저는 N입니다" || item.answer.text === "저는 N입니다"), false);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("content package generation is deterministic for identical inputs", async () => {
  const firstDirectory = await mkdtemp(join(tmpdir(), "wsm-package-first-"));
  const secondDirectory = await mkdtemp(join(tmpdir(), "wsm-package-second-"));

  try {
    const first = await generateContentPackage({
      targetId: "linguistic-terminology",
      outputDirectory: firstDirectory,
      generatedAt: "2026-07-06T00:00:00Z"
    });
    const second = await generateContentPackage({
      targetId: "linguistic-terminology",
      outputDirectory: secondDirectory,
      generatedAt: "2026-07-06T00:00:00Z"
    });

    assert.equal(await fileSha256(first.filePath), await fileSha256(second.filePath));
    assert.equal(first.archiveSha256, second.archiveSha256);
  } finally {
    await rm(firstDirectory, { recursive: true, force: true });
    await rm(secondDirectory, { recursive: true, force: true });
  }
});

test("content package generator CLI can build both initial targets", async () => {
  const directory = await mkdtemp(join(tmpdir(), "wsm-package-cli-"));

  try {
    const result = await runNode([
      "dist/packages/core/content-package-generator-cli.js",
      "--output-dir",
      directory,
      "--target",
      "linguistic-terminology",
      "--target",
      "korean-curriculum"
    ]);

    assert.equal(result.exitCode, 0);
    assert.match(result.stdout, /Package generated: com\.sleepymario\.language\.linguistic-terminology/);
    assert.match(result.stdout, /Package generated: com\.sleepymario\.language\.korean/);
    assert.equal(result.stderr, "");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

async function readZip(filePath) {
  const buffer = await readFile(filePath);
  const entries = new Map();
  let offset = 0;

  while (buffer.readUInt32LE(offset) === 0x04034b50) {
    const compressionMethod = buffer.readUInt16LE(offset + 8);
    assert.equal(compressionMethod, 0);

    const compressedSize = buffer.readUInt32LE(offset + 18);
    const fileNameLength = buffer.readUInt16LE(offset + 26);
    const extraLength = buffer.readUInt16LE(offset + 28);
    const nameStart = offset + 30;
    const dataStart = nameStart + fileNameLength + extraLength;
    const name = buffer.subarray(nameStart, nameStart + fileNameLength).toString("utf8");
    const data = buffer.subarray(dataStart, dataStart + compressedSize);
    entries.set(name, data);
    offset = dataStart + compressedSize;
  }

  return entries;
}

async function fileSha256(path) {
  return createHash("sha256").update(await readFile(path)).digest("hex");
}

async function runNode(args) {
  const child = spawn(process.execPath, args, {
    cwd: process.cwd(),
    stdio: ["ignore", "pipe", "pipe"]
  });

  let stdout = "";
  let stderr = "";
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => {
    stdout += chunk;
  });
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
  });

  const exitCode = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`CLI timed out: ${args.join(" ")}`));
    }, 10000);

    child.on("error", reject);
    child.on("close", (code) => {
      clearTimeout(timeout);
      resolve(code);
    });
  });

  return { exitCode, stdout, stderr };
}
