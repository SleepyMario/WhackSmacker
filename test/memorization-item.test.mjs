import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { test } from "node:test";

import {
  listInstalledMemorizationItemFiles,
  memorizationItemFileMediaType,
  memorizationItemSchemaVersion,
  normalizeMemorizationItemCollection,
  readInstalledMemorizationItems,
  validateMemorizationItem,
  validateMemorizationItemCollection
} from "../dist/packages/core/index.js";

const schemaUrl = new URL("../schemas/memorization-item-v1.schema.json", import.meta.url);

test("memorization item JSON Schema parses as Draft 2020-12", async () => {
  const schema = JSON.parse(await readFile(schemaUrl, "utf8"));

  assert.equal(schema.$schema, "https://json-schema.org/draft/2020-12/schema");
  assert.equal(schema.$defs.item.properties.schemaVersion.const, memorizationItemSchemaVersion);
});

test("valid basic memorization item passes", () => {
  assertValidItem(validItem());
});

test("valid memorization item collection passes", () => {
  const collection = { schemaVersion: 1, items: [validItem("hangul/vowels/a"), validItem("hangul/vowels/eo")] };

  assertValidCollection(collection);
});

test("language-adaptive lexical metadata survives packaged memorization collections", () => {
  const item = validItem();
  item.lexicalMetadata = {
    lexicalType: "measure-expression",
    lexicalForm: "本",
    learnerFacingForm: "本 — MW: bound books and volumes",
    grammaticalType: "MW",
    semanticScope: "bound books and volumes",
    representativeNounClasses: ["books", "volumes"],
    usageStatus: "restricted"
  };
  const collection = normalizeMemorizationItemCollection(JSON.parse(JSON.stringify({ schemaVersion: 1, items: [item] })));
  assert.equal(collection.items[0].lexicalMetadata.semanticScope, "bound books and volumes");
  assert.deepEqual(collection.items[0].lexicalMetadata.representativeNounClasses, ["books", "volumes"]);
});

test("memorization items preserve encountered form citation form and lexical sense identity", () => {
  const item = validItem();
  item.lexicalMetadata = {
    lexicalType: "verb", learnerFacingForm: "klopt — dictionary form: kloppen",
    lexicalEntryId: "nl.verb.kloppen", senseId: "nl.verb.kloppen.be-correct",
    surfaceForm: "klopt", lemma: "kloppen", citationForm: "kloppen",
    partOfSpeech: "verb", meaning: "to be correct", introductionStatus: "new-entry",
    firstIntroductionChapter: 2, encounteredForms: ["klopt"], morphologyStatus: "supporting-form"
  };
  const collection = normalizeMemorizationItemCollection(JSON.parse(JSON.stringify({ schemaVersion: 1, items: [item] })));
  assert.equal(collection.items[0].lexicalMetadata.surfaceForm, "klopt");
  assert.equal(collection.items[0].lexicalMetadata.citationForm, "kloppen");
  assert.equal(collection.items[0].lexicalMetadata.senseId, "nl.verb.kloppen.be-correct");
});

test("single item normalizes to a collection", () => {
  const collection = normalizeMemorizationItemCollection(validItem("hangul/vowels/a"));

  assert.equal(collection.schemaVersion, 1);
  assert.equal(collection.items.length, 1);
  assert.equal(collection.items[0].id, "hangul/vowels/a");
});

test("invalid item kind fails", () => {
  const item = validItem();
  item.kind = "scheduler-card";

  assertInvalidItem(item, /kind must be one of/);
});

test("unsafe item ID fails", () => {
  const item = validItem();
  item.id = "../outside";

  assertInvalidItem(item, /id must be stable/);
});

test("unsafe source path fails", () => {
  const item = validItem();
  item.source.path = "/absolute.md";

  assertInvalidItem(item, /source\.path must be a safe package-relative path/);
});

test("scheduler progress and provider-specific fields are rejected", () => {
  for (const field of ["dueAt", "interval", "easeFactor", "reviewHistory", "progress", "settings", "providerDeck", "providerNoteId"]) {
    const item = validItem();
    item[field] = "not allowed";

    assertInvalidItem(item, new RegExp(`${field}.*not allowed`));
  }
});

test("duplicate item IDs in a collection fail", () => {
  const collection = { schemaVersion: 1, items: [validItem("hangul/vowels/a"), validItem("hangul/vowels/a")] };

  assertInvalidCollection(collection, /Duplicate memorization item ID: hangul\/vowels\/a/);
});

test("tags use lowercase stable syntax and are unique", () => {
  const item = validItem();
  item.tags = ["Hangul", "hangul"];

  assertInvalidItem(item, /tags\[0\] must use lowercase tag syntax/);
});

test("installed memorization item files can be discovered and read", async () => {
  const fixture = await createInstalledMemoryFixture();
  try {
    const files = await listInstalledMemorizationItemFiles("com.sleepymario.language.memory", fixture.dataDir);
    const result = await readInstalledMemorizationItems("com.sleepymario.language.memory", "content/memorization/hangul/items.json", fixture.dataDir);

    assert.deepEqual(files.map((file) => file.path), ["content/memorization/hangul/items.json"]);
    assert.equal(files[0].mediaType, memorizationItemFileMediaType);
    assert.equal(result.items.length, 2);
    assert.equal(result.items[0].id, "hangul/vowels/a");
  } finally {
    await fixture.cleanup();
  }
});

test("installed memorization item reader rejects unsafe paths", async () => {
  const fixture = await createInstalledMemoryFixture();
  try {
    await assert.rejects(
      () => readInstalledMemorizationItems("com.sleepymario.language.memory", "../registry.json", fixture.dataDir),
      /path must be under content\/memorization and safe/
    );
  } finally {
    await fixture.cleanup();
  }
});

function validItem(id = "hangul/vowels/a") {
  return {
    schemaVersion: 1,
    id,
    kind: "vocabulary",
    prompt: {
      text: "아",
      plainText: "아",
      language: "ko",
      mediaType: "text/plain"
    },
    answer: {
      text: "Korean vowel-only syllable using ㅏ",
      mediaType: "text/plain"
    },
    hints: ["Hangul vowel"],
    notes: "Package-authored explanation only.",
    tags: ["hangul", "vowel"],
    source: {
      path: "units/introduction-to-hangul/chapter-01-vowels/unit-01-simple-vowels.md",
      title: "Simple vowels"
    },
    language: {
      target: "ko",
      base: "en",
      script: "Hangul"
    },
    difficulty: {
      level: 1,
      label: "foundation"
    },
    createdAt: "2026-07-06T00:00:00Z",
    updatedAt: "2026-07-06T00:00:00Z"
  };
}

async function createInstalledMemoryFixture() {
  const root = await mkdtemp(join(tmpdir(), "wsm-memory-items-"));
  const dataDir = join(root, "data");
  const installPath = "packages/com.sleepymario.language.memory/0.1.0";
  const packageRoot = join(dataDir, installPath);
  const items = {
    schemaVersion: 1,
    items: [validItem("hangul/vowels/a"), validItem("hangul/vowels/eo")]
  };
  const itemBuffer = Buffer.from(`${JSON.stringify(items, null, 2)}\n`, "utf8");
  const itemPath = "content/memorization/hangul/items.json";
  const manifest = {
    packageFormatVersion: 1,
    packageId: "com.sleepymario.language.memory",
    packageVersion: "0.1.0",
    displayName: "Memory Package",
    description: "Package with memorization items.",
    contentType: "language-curriculum",
    contentSchemaVersion: "1.0.0",
    minimumWhackSmackerVersion: "0.1.0",
    source: {
      repository: "https://example.invalid/memory",
      commit: "0000000000000000000000000000000000000000"
    },
    generatedAt: "2026-07-06T00:00:00Z",
    generator: {
      name: "test",
      version: "0.1.0"
    },
    entryPoints: [{ id: "primary", mediaType: "application/json", path: itemPath, role: "primary" }],
    dependencies: [],
    files: [{ path: itemPath, mediaType: memorizationItemFileMediaType, size: itemBuffer.length, sha256: sha256(itemBuffer) }]
  };
  const registry = {
    registryFormatVersion: 1,
    updatedAt: "2026-07-06T00:00:00Z",
    packages: [
      {
        packageId: "com.sleepymario.language.memory",
        packageVersion: "0.1.0",
        displayName: "Memory Package",
        contentType: "language-curriculum",
        contentSchemaVersion: "1.0.0",
        minimumWhackSmackerVersion: "0.1.0",
        source: manifest.source,
        installedAt: "2026-07-06T00:00:00Z",
        installPath,
        manifestSha256: "0".repeat(64),
        archiveSha256: "1".repeat(64),
        archiveSize: 1,
        catalogueId: "com.sleepymario.local"
      }
    ]
  };

  await writeJson(join(dataDir, "registry.json"), registry);
  await writeJson(join(packageRoot, "manifest.json"), manifest);
  await writeFileEnsured(join(packageRoot, itemPath), itemBuffer);

  return {
    dataDir,
    cleanup: () => rm(root, { recursive: true, force: true })
  };
}

function assertValidItem(item) {
  const result = validateMemorizationItem(item);

  assert.deepEqual(result.errors, []);
  assert.equal(result.valid, true);
}

function assertInvalidItem(item, pattern) {
  const result = validateMemorizationItem(item);

  assert.equal(result.valid, false);
  assert.match(result.errors.join("\n"), pattern);
}

function assertValidCollection(collection) {
  const result = validateMemorizationItemCollection(collection);

  assert.deepEqual(result.errors, []);
  assert.equal(result.valid, true);
}

function assertInvalidCollection(collection, pattern) {
  const result = validateMemorizationItemCollection(collection);

  assert.equal(result.valid, false);
  assert.match(result.errors.join("\n"), pattern);
}

async function writeJson(path, value) {
  await writeFileEnsured(path, Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8"));
}

async function writeFileEnsured(path, data) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, data);
}

function sha256(data) {
  return createHash("sha256").update(data).digest("hex");
}
