import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import {
  contentPackageCatalogueFormatVersion,
  generateContentPackage,
  generateLocalContentPackageCatalogue,
  validateContentPackageCatalogue,
  whackSmackerPackageMediaType
} from "../dist/packages/core/index.js";

const exampleUrl = new URL("../docs/content-packages/examples/local-catalogue.example.json", import.meta.url);
const schemaUrl = new URL("../schemas/content-package-catalogue-v1.schema.json", import.meta.url);

test("content package catalogue JSON Schema parses as Draft 2020-12", async () => {
  const schema = JSON.parse(await readFile(schemaUrl, "utf8"));

  assert.equal(schema.$schema, "https://json-schema.org/draft/2020-12/schema");
  assert.equal(schema.properties.catalogueFormatVersion.const, contentPackageCatalogueFormatVersion);
});

test("example catalogue validates", async () => {
  assertValid(await readJson(exampleUrl));
});

test("empty catalogues are valid for local development", async () => {
  const catalogue = validCatalogue();
  catalogue.packages = [];

  assertValid(catalogue);
});

test("malformed catalogue ID fails", () => {
  const catalogue = validCatalogue();
  catalogue.catalogueId = "Local Catalogue";

  assertInvalid(catalogue, /catalogueId must use lowercase reverse-domain ID syntax/);
});

test("unsupported catalogue format version fails", () => {
  const catalogue = validCatalogue();
  catalogue.catalogueFormatVersion = 2;

  assertInvalid(catalogue, /Unsupported catalogueFormatVersion: 2/);
});

test("invalid timestamp fails", () => {
  const catalogue = validCatalogue();
  catalogue.generatedAt = "2026-07-06";

  assertInvalid(catalogue, /generatedAt must be an ISO 8601 UTC timestamp/);
});

test("malformed package URL fails", () => {
  const catalogue = validCatalogue();
  catalogue.packages[0].package.url = "not a url";

  assertInvalid(catalogue, /package\.url must be a valid file:\/\/ or https:\/\/ URL/);
});

test("unsupported http package URL fails", () => {
  const catalogue = validCatalogue();
  catalogue.packages[0].package.url = "http://example.invalid/package.wspkg";

  assertInvalid(catalogue, /package\.url must be a valid file:\/\/ or https:\/\/ URL/);
});

test("valid file and https package URLs pass", () => {
  const catalogue = validCatalogue();
  catalogue.packages[0].package.url = "file:///tmp/package.wspkg";
  catalogue.packages[1].package.url = "https://example.invalid/package.wspkg";

  assertValid(catalogue);
});

test("invalid package checksum fails", () => {
  const catalogue = validCatalogue();
  catalogue.packages[0].package.sha256 = "not-a-checksum";

  assertInvalid(catalogue, /sha256 must be a lowercase 64-character SHA-256 digest/);
});

test("negative package size fails", () => {
  const catalogue = validCatalogue();
  catalogue.packages[0].package.size = -1;

  assertInvalid(catalogue, /size must be a non-negative safe integer/);
});

test("duplicate package ID and version fails", () => {
  const catalogue = validCatalogue();
  catalogue.packages[1].packageId = catalogue.packages[0].packageId;
  catalogue.packages[1].packageVersion = catalogue.packages[0].packageVersion;

  assertInvalid(catalogue, /Duplicate package entry: com\.sleepymario\.language\.korean@0\.1\.0/);
});

test("duplicate package URL fails", () => {
  const catalogue = validCatalogue();
  catalogue.packages[1].package.url = catalogue.packages[0].package.url;

  assertInvalid(catalogue, /Duplicate package URL:/);
});

test("self-dependency fails", () => {
  const catalogue = validCatalogue();
  catalogue.packages[0].dependencies = [{ packageId: catalogue.packages[0].packageId, version: ">=0.1.0 <1.0.0" }];

  assertInvalid(catalogue, /must not depend on itself/);
});

test("malformed dependency version range fails", () => {
  const catalogue = validCatalogue();
  catalogue.packages[0].dependencies = [{ packageId: "com.sleepymario.language.linguistic-terminology", version: "latest" }];

  assertInvalid(catalogue, /version must be a documented SemVer-compatible range/);
});

test("duplicate dependencies fail", () => {
  const catalogue = validCatalogue();
  catalogue.packages[0].dependencies = [
    { packageId: "com.sleepymario.language.linguistic-terminology", version: ">=0.1.0 <1.0.0" },
    { packageId: "com.sleepymario.language.linguistic-terminology", version: ">=0.1.0 <1.0.0" }
  ];

  assertInvalid(catalogue, /Duplicate dependency: com\.sleepymario\.language\.linguistic-terminology/);
});

test("generated catalogue from validation packages contains expected local packages", async () => {
  const packageDirectory = await mkdtemp(join(tmpdir(), "wsm-catalogue-packages-"));
  const catalogueDirectory = await mkdtemp(join(tmpdir(), "wsm-catalogue-output-"));

  try {
    await generateContentPackage({
      targetId: "linguistic-terminology",
      outputDirectory: packageDirectory,
      generatedAt: "2026-07-06T00:00:00Z"
    });
    await generateContentPackage({
      targetId: "korean-curriculum",
      outputDirectory: packageDirectory,
      generatedAt: "2026-07-06T00:00:00Z"
    });
    await generateContentPackage({
      targetId: "chinese-curriculum",
      outputDirectory: packageDirectory,
      generatedAt: "2026-07-06T00:00:00Z"
    });
    await generateContentPackage({
      targetId: "vietnamese-curriculum",
      outputDirectory: packageDirectory,
      generatedAt: "2026-07-06T00:00:00Z"
    });
    await generateContentPackage({
      targetId: "dutch-curriculum",
      outputDirectory: packageDirectory,
      generatedAt: "2026-07-06T00:00:00Z"
    });
    await generateContentPackage({
      targetId: "german-curriculum",
      outputDirectory: packageDirectory,
      generatedAt: "2026-07-06T00:00:00Z"
    });

    const outputPath = join(catalogueDirectory, "catalogue.json");
    const first = await generateLocalContentPackageCatalogue({
      packagesDirectory: packageDirectory,
      outputPath,
      generatedAt: "2026-07-06T00:00:00Z"
    });
    const second = await generateLocalContentPackageCatalogue({
      packagesDirectory: packageDirectory,
      outputPath,
      generatedAt: "2026-07-06T00:00:00Z"
    });

    assert.equal(first.packageCount, 6);
    assert.equal(first.changed, true);
    assert.equal(second.changed, false);
    assertValid(first.catalogue);
    assert.deepEqual(
      first.catalogue.packages.map((entry) => entry.packageId),
      [
        "com.sleepymario.language.chinese",
        "com.sleepymario.language.dutch",
        "com.sleepymario.language.german",
        "com.sleepymario.language.korean",
        "com.sleepymario.language.linguistic-terminology",
        "com.sleepymario.language.vietnamese"
      ]
    );
    assert.equal(first.catalogue.packages[0].package.mediaType, whackSmackerPackageMediaType);
    assert.equal(first.catalogue.packages.every((entry) => entry.package.url.startsWith("file://")), true);

    for (const entry of first.catalogue.packages) {
      const archivePath = new URL(entry.package.url).pathname;
      assert.equal(entry.package.size, (await stat(archivePath)).size);
      assert.equal(entry.package.sha256, await fileSha256(archivePath));
    }

    assert.deepEqual(JSON.parse(await readFile(outputPath, "utf8")), first.catalogue);
    assert.equal((await readFile(outputPath, "utf8")).includes("content/content.json"), false);
  } finally {
    await rm(packageDirectory, { recursive: true, force: true });
    await rm(catalogueDirectory, { recursive: true, force: true });
  }
});

function assertValid(catalogue) {
  const result = validateContentPackageCatalogue(catalogue);

  assert.deepEqual(result.errors, []);
  assert.equal(result.valid, true);
}

function assertInvalid(catalogue, pattern) {
  const result = validateContentPackageCatalogue(catalogue);

  assert.equal(result.valid, false);
  assert.match(result.errors.join("\n"), pattern);
}

function validCatalogue() {
  return {
    catalogueFormatVersion: 1,
    catalogueId: "com.sleepymario.local",
    displayName: "Local Catalogue",
    description: "Local catalogue.",
    generatedAt: "2026-07-06T00:00:00Z",
    packages: [
      validPackage("com.sleepymario.language.korean", "file:///tmp/korean.wspkg"),
      validPackage("com.sleepymario.language.linguistic-terminology", "https://example.invalid/terminology.wspkg")
    ]
  };
}

function validPackage(packageId, url) {
  return {
    packageId,
    packageVersion: "0.1.0",
    displayName: "Package",
    description: "Package description.",
    contentType: "language-curriculum",
    contentSchemaVersion: "1.0.0",
    minimumWhackSmackerVersion: "0.1.0",
    source: {
      repository: "https://example.invalid/source",
      commit: "0000000000000000000000000000000000000000"
    },
    package: {
      url,
      mediaType: "application/vnd.whacksmacker.package+zip",
      size: 0,
      sha256: "0000000000000000000000000000000000000000000000000000000000000000"
    },
    dependencies: []
  };
}

async function readJson(url) {
  return JSON.parse(await readFile(url, "utf8"));
}

async function fileSha256(path) {
  return createHash("sha256").update(await readFile(path)).digest("hex");
}
