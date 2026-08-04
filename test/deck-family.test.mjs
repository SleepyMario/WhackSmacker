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
