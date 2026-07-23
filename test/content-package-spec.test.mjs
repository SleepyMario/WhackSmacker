import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

import {
  isSafeContentPackagePath,
  validateContentPackageManifest,
  whackSmackerPackageExtension,
  whackSmackerPackageFormatVersion
} from "../dist/packages/core/index.js";

const terminologyExampleUrl = new URL("../docs/content-packages/examples/linguistic-terminology-manifest.example.json", import.meta.url);
const exampleManifestUrl = terminologyExampleUrl;
const schemaUrl = new URL("../schemas/content-package-manifest-v1.schema.json", import.meta.url);

test("content package constants define package format version and extension", () => {
  assert.equal(whackSmackerPackageFormatVersion, 1);
  assert.equal(whackSmackerPackageExtension, ".wspkg");
});

test("content package JSON Schema parses as Draft 2020-12", async () => {
  const schema = JSON.parse(await readFile(schemaUrl, "utf8"));

  assert.equal(schema.$schema, "https://json-schema.org/draft/2020-12/schema");
  assert.equal(schema.properties.packageFormatVersion.const, 1);
});

test("Linguistic Terminology example manifest is valid", async () => {
  assertValid(await readJson(terminologyExampleUrl));
});

test("missing required manifest fields fail", async () => {
  const manifest = await readJson(exampleManifestUrl);
  delete manifest.packageId;

  assertInvalid(manifest, /Missing required field: packageId/);
});

test("malformed package IDs fail", async () => {
  const manifest = await readJson(exampleManifestUrl);
  manifest.packageId = "Korean Curriculum";

  assertInvalid(manifest, /packageId must use reverse-domain package ID syntax/);
});

test("malformed package versions fail", async () => {
  const manifest = await readJson(exampleManifestUrl);
  manifest.packageVersion = "0.1";

  assertInvalid(manifest, /packageVersion must use MAJOR.MINOR.PATCH/);
});

test("unsupported package-format versions fail", async () => {
  const manifest = await readJson(exampleManifestUrl);
  manifest.packageFormatVersion = 2;

  assertInvalid(manifest, /Unsupported packageFormatVersion: 2/);
});

test("absolute paths fail", async () => {
  const manifest = await readJson(exampleManifestUrl);
  manifest.files[0].path = "/content/content.json";

  assertInvalid(manifest, /files\[0\]\.path must be a safe relative path/);
});

test("parent-directory traversal paths fail", async () => {
  const manifest = await readJson(exampleManifestUrl);
  manifest.files[0].path = "content/../content.json";

  assertInvalid(manifest, /files\[0\]\.path must be a safe relative path/);
});

test("backslash paths fail", async () => {
  const manifest = await readJson(exampleManifestUrl);
  manifest.files[0].path = "content\\content.json";

  assertInvalid(manifest, /files\[0\]\.path must be a safe relative path/);
});

test("path safety helper accepts only normalized archive-relative paths", () => {
  assert.equal(isSafeContentPackagePath("content/content.json"), true);
  assert.equal(isSafeContentPackagePath("/content/content.json"), false);
  assert.equal(isSafeContentPackagePath("content/../content.json"), false);
  assert.equal(isSafeContentPackagePath("content\\content.json"), false);
});

test("duplicate file paths fail", async () => {
  const manifest = await readJson(exampleManifestUrl);
  manifest.files.push({ ...manifest.files[0] });

  assertInvalid(manifest, /Duplicate file path: content\/terms\.json/);
});

test("duplicate entry-point IDs fail", async () => {
  const manifest = await readJson(terminologyExampleUrl);
  manifest.entryPoints[1].id = "primary";

  assertInvalid(manifest, /Duplicate entry point ID: primary/);
});

test("missing primary entry point fails", async () => {
  const manifest = await readJson(exampleManifestUrl);
  manifest.entryPoints[0].role = "metadata";

  assertInvalid(manifest, /At least one primary entry point is required/);
});

test("undeclared entry-point files fail", async () => {
  const manifest = await readJson(exampleManifestUrl);
  manifest.entryPoints[0].path = "content/missing.json";

  assertInvalid(manifest, /Entry point references undeclared file: content\/missing\.json/);
});

test("invalid SHA-256 strings fail", async () => {
  const manifest = await readJson(exampleManifestUrl);
  manifest.files[0].sha256 = "not-a-checksum";

  assertInvalid(manifest, /sha256 must be a lowercase 64-character SHA-256 digest/);
});

test("self-dependencies fail", async () => {
  const manifest = await readJson(exampleManifestUrl);
  manifest.dependencies = [{ packageId: manifest.packageId, version: ">=0.1.0 <1.0.0" }];

  assertInvalid(manifest, /must not depend on itself/);
});

test("duplicate dependencies fail", async () => {
  const manifest = await readJson(exampleManifestUrl);
  manifest.dependencies = [
    { packageId: "com.sleepymario.language.synthetic", version: ">=0.1.0 <1.0.0" },
    { packageId: "com.sleepymario.language.synthetic", version: ">=0.1.0 <1.0.0" }
  ];

  assertInvalid(manifest, /Duplicate dependency: com\.sleepymario\.language\.synthetic/);
});

test("Unicode display names and descriptions remain valid", async () => {
  const manifest = await readJson(exampleManifestUrl);
  manifest.displayName = "한국어 Curriculum";
  manifest.description = "한글 and Korean language content.";

  assertValid(manifest);
});

test("split package capabilities and related package IDs validate explicitly", async () => {
  const manifest = await readJson(exampleManifestUrl);
  manifest.capabilities = ["reading-curriculum"];
  manifest.relatedPackageIds = ["com.sleepymario.language.synthetic.reviews"];
  manifest.license = { spdx: null, name: "Whacksmacker Curriculum Content License", path: manifest.files[0].path };
  assertValid(manifest);
  manifest.capabilities = ["not-a-capability"];
  assertInvalid(manifest, /capabilities\[0\] is unsupported/);
});

test("legacy combined manifests remain valid only as manifests without inferred capabilities", async () => {
  const manifest = await readJson(exampleManifestUrl);
  delete manifest.capabilities;
  delete manifest.relatedPackageIds;
  assertValid(manifest);
  assert.equal(manifest.contentType, "linguistic-terminology");
});

function assertValid(manifest) {
  const result = validateContentPackageManifest(manifest);

  assert.deepEqual(result.errors, []);
  assert.equal(result.valid, true);
}

function assertInvalid(manifest, pattern) {
  const result = validateContentPackageManifest(manifest);

  assert.equal(result.valid, false);
  assert.match(result.errors.join("\n"), pattern);
}

async function readJson(url) {
  return JSON.parse(await readFile(url, "utf8"));
}
