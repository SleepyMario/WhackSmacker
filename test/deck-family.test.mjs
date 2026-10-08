import assert from "node:assert/strict";
import { test } from "node:test";

import {
  deckFamilyPackageMenuPresentation,
  packagesForLanguageAndDeckFamily,
  reconcileInstalledDeckFamilyMetadata
} from "../dist/packages/core/index.js";

const languageOne = "com.sleepymario.language.one";
const languageTwo = "com.sleepymario.language.two";

test("deck family filtering uses explicit metadata and exact language associations", () => {
  const packages = [
    familyPackage("com.example.topic.animals.general", "Animals", "general", [languageOne]),
    familyPackage("com.example.topic.animals.specialized", "Animals", "specialized", [languageOne]),
    familyPackage("local.user.decks.vietnamese-notes", "Personal Notes", "custom", [languageOne]),
    familyPackage("com.example.topic.shared.general", "Shared Topic", "general", [languageOne, languageTwo]),
    familyPackage("com.example.topic.general-in-id", "Specialized in title", undefined, [languageOne]),
    familyPackage("com.example.topic.other", "Animals", "general", [languageTwo])
  ];

  assert.deepEqual(
    packagesForLanguageAndDeckFamily(packages, languageOne, "general").map((entry) => entry.packageId),
    ["com.example.topic.animals.general", "com.example.topic.shared.general"]
  );
  assert.deepEqual(
    packagesForLanguageAndDeckFamily(packages, languageOne, "specialized").map((entry) => entry.packageId),
    ["com.example.topic.animals.specialized"]
  );
  assert.deepEqual(
    packagesForLanguageAndDeckFamily(packages, languageOne, "custom").map((entry) => entry.packageId),
    ["local.user.decks.vietnamese-notes"]
  );
  assert.deepEqual(
    packagesForLanguageAndDeckFamily(packages, languageTwo, "general").map((entry) => entry.packageId),
    ["com.example.topic.other", "com.example.topic.shared.general"]
  );
});

test("deck family package ordering is deterministic and retains only the newest installed version", () => {
  const packages = [
    familyPackage("com.example.topic.zeta", "Zeta", "general", [languageOne], "1.0.0"),
    familyPackage("com.example.topic.alpha-b", "Alpha", "general", [languageOne], "1.0.0"),
    familyPackage("com.example.topic.alpha-a", "Alpha", "general", [languageOne], "1.0.0"),
    familyPackage("com.example.topic.zeta", "Zeta", "general", [languageOne], "1.2.0")
  ];

  assert.deepEqual(
    packagesForLanguageAndDeckFamily(packages, languageOne, "general").map((entry) => `${entry.packageId}@${entry.packageVersion}`),
    [
      "com.example.topic.alpha-a@1.0.0",
      "com.example.topic.alpha-b@1.0.0",
      "com.example.topic.zeta@1.2.0"
    ]
  );
});

test("a package moved to another deck family appears only in its newest family", () => {
  const packages = [
    {
      ...familyPackage("local.user.decks.korean-kgfil-iv-vocabulary", "KGfIL - IV - Vocabulary", "general", [languageOne]),
      deckVersion: "0.1.0",
      artifactRevision: 1
    },
    {
      ...familyPackage("local.user.decks.korean-kgfil-iv-vocabulary", "KGfIL - IV - Vocabulary", "custom", [languageOne]),
      deckVersion: "0.1.0",
      artifactRevision: 2
    }
  ];

  assert.deepEqual(packagesForLanguageAndDeckFamily(packages, languageOne, "general"), []);
  assert.deepEqual(
    packagesForLanguageAndDeckFamily(packages, languageOne, "custom").map((entry) => entry.artifactRevision),
    [2]
  );
});

test("KGfIL custom decks use chapter order and place Vocabulary before Sentences", () => {
  const packages = [
    familyPackage("local.user.decks.korean-kgfil-iv-sentences", "KGfIL - IV - Sentences", "custom", [languageOne]),
    familyPackage("local.user.decks.korean-kgfil-iii-sentences", "KGfIL - III - Sentences", "custom", [languageOne]),
    familyPackage("local.user.decks.korean-kgfil-i-sentences", "KGfIL - I - Sentences", "custom", [languageOne]),
    familyPackage("local.user.decks.korean-kgfil-iv-vocabulary", "KGfIL - IV - Vocabulary", "custom", [languageOne]),
    familyPackage("local.user.decks.korean-kgfil-v-a-sentences", "KGfIL - V-A - Sentences", "custom", [languageOne]),
    familyPackage("local.user.decks.korean-kgfil-v-a-vocabulary", "KGfIL - V-A - Vocabulary", "custom", [languageOne]),
    familyPackage("local.user.decks.korean-kgfil-v-b-sentences", "KGfIL - V-B - Sentences", "custom", [languageOne]),
    familyPackage("local.user.decks.korean-kgfil-v-b-vocabulary", "KGfIL - V-B - Vocabulary", "custom", [languageOne]),
    familyPackage("local.user.decks.korean-kgfil-vi-sentences", "KGfIL - VI - Sentences", "custom", [languageOne]),
    familyPackage("local.user.decks.korean-kgfil-vi-vocabulary", "KGfIL - VI - Vocabulary", "custom", [languageOne]),
    familyPackage("local.user.decks.korean-kgfil-vii-a-sentences", "KGfIL - VII-A - Sentences", "custom", [languageOne]),
    familyPackage("local.user.decks.korean-kgfil-vii-a-vocabulary", "KGfIL - VII-A - Vocabulary", "custom", [languageOne]),
    familyPackage("local.user.decks.korean-kgfil-viii-sentences", "KGfIL - VIII - Sentences", "custom", [languageOne]),
    familyPackage("local.user.decks.korean-kgfil-viii-vocabulary", "KGfIL - VIII - Vocabulary", "custom", [languageOne]),
    familyPackage("local.user.decks.korean-kgfil-ix-a-sentences", "KGfIL - IX-A - Sentences", "custom", [languageOne]),
    familyPackage("local.user.decks.korean-kgfil-ix-a-vocabulary", "KGfIL - IX-A - Vocabulary", "custom", [languageOne]),
    familyPackage("local.user.decks.korean-kgfil-ix-b-sentences", "KGfIL - IX-B - Sentences", "custom", [languageOne]),
    familyPackage("local.user.decks.korean-kgfil-ix-b-vocabulary", "KGfIL - IX-B - Vocabulary", "custom", [languageOne]),
    familyPackage("local.user.decks.korean-kgfil-ix-c-sentences", "KGfIL - IX-C - Sentences", "custom", [languageOne]),
    familyPackage("local.user.decks.korean-kgfil-ix-c-vocabulary", "KGfIL - IX-C - Vocabulary", "custom", [languageOne]),
    familyPackage("local.user.decks.korean-kgfil-x-sentences", "KGfIL - X - Sentences", "custom", [languageOne]),
    familyPackage("local.user.decks.korean-kgfil-x-vocabulary", "KGfIL - X - Vocabulary", "custom", [languageOne]),
    familyPackage("local.user.decks.korean-kgfil-iii-vocabulary", "KGfIL - III - Vocabulary", "custom", [languageOne]),
    familyPackage("local.user.decks.korean-kgfil-i-vocabulary", "KGfIL - I - Vocabulary", "custom", [languageOne])
  ];

  assert.deepEqual(
    packagesForLanguageAndDeckFamily(packages, languageOne, "custom").map((entry) => entry.displayName),
    [
      "KGfIL - I - Vocabulary",
      "KGfIL - I - Sentences",
      "KGfIL - III - Vocabulary",
      "KGfIL - III - Sentences",
      "KGfIL - IV - Vocabulary",
      "KGfIL - IV - Sentences",
      "KGfIL - V-A - Vocabulary",
      "KGfIL - V-A - Sentences",
      "KGfIL - V-B - Vocabulary",
      "KGfIL - V-B - Sentences",
      "KGfIL - VI - Vocabulary",
      "KGfIL - VI - Sentences",
      "KGfIL - VII-A - Vocabulary",
      "KGfIL - VII-A - Sentences",
      "KGfIL - VIII - Vocabulary",
      "KGfIL - VIII - Sentences",
      "KGfIL - IX-A - Vocabulary",
      "KGfIL - IX-A - Sentences",
      "KGfIL - IX-B - Vocabulary",
      "KGfIL - IX-B - Sentences",
      "KGfIL - IX-C - Vocabulary",
      "KGfIL - IX-C - Sentences",
      "KGfIL - X - Vocabulary",
      "KGfIL - X - Sentences"
    ]
  );
});

test("installed family reconciliation uses exact current package identity and never display titles", () => {
  const installed = [
    legacyPackage("com.example.medical.nl", "Medical I", "0.1.0", "specialized-review"),
    legacyPackage("com.example.medical.zh", "Not a medical title", "0.1.0", "specialized-review"),
    legacyPackage("com.example.general.title-only", "General Medical Specialized", "0.1.0", "specialized-review"),
    legacyPackage("com.example.medical.old", "Medical I", "0.0.9", "specialized-review"),
    legacyPackage("com.example.medical.wrong-type", "Medical I", "0.1.0", "core-review")
  ];
  const metadata = [
    packageMetadata("com.example.medical.nl", "0.1.0", "specialized-review", "specialized", [languageOne]),
    packageMetadata("com.example.medical.zh", "0.1.0", "specialized-review", "specialized", [languageTwo]),
    packageMetadata("com.example.medical.old", "0.1.0", "specialized-review", "specialized", [languageOne]),
    packageMetadata("com.example.medical.wrong-type", "0.1.0", "specialized-review", "specialized", [languageOne])
  ];

  const reconciled = reconcileInstalledDeckFamilyMetadata(installed, metadata);
  assert.deepEqual(reconciled.map((entry) => [entry.packageId, entry.deckFamily, entry.relatedPackageIds]), [
    ["com.example.medical.nl", "specialized", [languageOne]],
    ["com.example.medical.zh", "specialized", [languageTwo]],
    ["com.example.general.title-only", undefined, undefined],
    ["com.example.medical.old", undefined, undefined],
    ["com.example.medical.wrong-type", undefined, undefined]
  ]);
  assert.deepEqual(
    packagesForLanguageAndDeckFamily(reconciled, languageOne, "specialized").map((entry) => entry.packageId),
    ["com.example.medical.nl"]
  );
  assert.deepEqual(
    packagesForLanguageAndDeckFamily(reconciled, languageTwo, "specialized").map((entry) => entry.packageId),
    ["com.example.medical.zh"]
  );
});

test("ambiguous or invalid current metadata leaves a genuinely unclassified legacy package unchanged", () => {
  const installed = [legacyPackage("com.example.legacy", "Specialized title", "1.0.0", "specialized-review")];
  const ambiguous = [
    packageMetadata("com.example.legacy", "1.0.0", "specialized-review", "general", [languageOne]),
    packageMetadata("com.example.legacy", "1.0.0", "specialized-review", "specialized", [languageOne])
  ];
  const invalidAssociation = [packageMetadata("com.example.legacy", "1.0.0", "specialized-review", "specialized", [])];

  assert.equal(reconcileInstalledDeckFamilyMetadata(installed, ambiguous)[0], installed[0]);
  assert.equal(reconcileInstalledDeckFamilyMetadata(installed, invalidAssociation)[0], installed[0]);
});

test("a single Review source supplies the exact concise family package label without title parsing", () => {
  const presentation = deckFamilyPackageMenuPresentation(
    "Language Family Long Descriptive Package",
    [{ authoritativeTitle: "Concise Source Title", fallbackLabel: "fallback" }],
    "Review deck"
  );

  assert.deepEqual(presentation, {
    packageLabel: "Concise Source Title",
    sourceLabels: ["Review deck"]
  });
});

test("a synthetic package with multiple Review sources retains its unambiguous package-level label", () => {
  const presentation = deckFamilyPackageMenuPresentation(
    "Synthetic Multi-source Package",
    [
      { authoritativeTitle: "First Source", fallbackLabel: "first" },
      { authoritativeTitle: "Second Source", fallbackLabel: "second" }
    ],
    "Review deck"
  );

  assert.deepEqual(presentation, {
    packageLabel: "Synthetic Multi-source Package",
    sourceLabels: ["First Source", "Second Source"]
  });
});

function familyPackage(packageId, displayName, deckFamily, relatedPackageIds, packageVersion = "1.0.0") {
  return { packageId, packageVersion, displayName, deckFamily, relatedPackageIds };
}

function legacyPackage(packageId, displayName, packageVersion, contentType) {
  return { packageId, packageVersion, displayName, contentType };
}

function packageMetadata(packageId, packageVersion, contentType, deckFamily, relatedPackageIds) {
  return { packageId, packageVersion, contentType, deckFamily, relatedPackageIds };
}
