import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

import {
  assertCanonicalCastBootstrapBeforeOrdinaryContent,
  assertInstalledCurriculumParticipants,
  assertPackagedCanonicalCastAndParticipants,
  auditActiveCast,
  isContentPackageSourceFileAllowed,
  reconcileChapterParticipants,
  validateCanonicalCast
} from "../dist/packages/core/index.js";

const ids = Array.from({ length: 30 }, (_, index) => `CAST-${String(index + 1).padStart(3, "0")}`);

function validCast() {
  const cast = ids.map((id, index) => {
    const partnerIndex = index % 2 === 0 ? index + 1 : index - 1;
    return {
      id,
      displayName: `Person ${index + 1} Example`,
      age: 30 + index,
      gender: index % 2 === 0 ? "female" : "male",
      origin: `Raised in Example City district ${index + 1} with an established local community.`,
      residence: `Lives in Example City neighborhood ${index + 1} in a stable home.`,
      dailyRole: `community role ${index + 1}`,
      relationshipStatus: `married to ${ids[partnerIndex]}`,
      household: `shared household with ${ids[partnerIndex]}`,
      relevantFamily: `spouse ${ids[partnerIndex]}; other family outside the recurring cast`,
      background: `Person ${index + 1} has a specific community history and balances daily responsibilities with continuing education and local commitments.`,
      interests: `interest ${index + 1}, hiking, and reading`,
      personality: `patient, practical, and observant`,
      castRelationships: [{ targetCastId: ids[partnerIndex], type: "spouse" }],
      recurringContexts: `workplace ${index + 1}, home routines, and community events`,
      continuityNotes: `Keep the established household, role, age, and community commitments consistent across later chapters.`
    };
  });
  return {
    schemaVersion: 2,
    cast,
    deckPersonPool: [...ids],
    activeCast: { schemaVersion: 2, progression: [...ids] }
  };
}

function errorsFor(document) {
  return validateCanonicalCast(document, {
    sourceFile: "/fixture/name-pools/canonical-cast.json"
  }).errors.join("\n");
}

test("strengthened cast accepts exactly thirty complete unique people and exact pool permutations", () => {
  assert.equal(errorsFor(validCast()), "");

  const nativeStructuredText = validCast();
  nativeStructuredText.cast[0].interests = "読書、写真";
  nativeStructuredText.cast[0].personality = "親切、几帳面";
  nativeStructuredText.cast[0].age = 12;
  nativeStructuredText.cast[0].dailyRole = "地域の小学生";
  assert.equal(errorsFor(nativeStructuredText), "", "native list delimiters and student roles remain valid structured background data");

  for (const mutation of [
    document => document.cast.pop(),
    document => { document.cast[1].id = document.cast[0].id; },
    document => { document.cast[1].displayName = document.cast[0].displayName; },
    document => { document.deckPersonPool[29] = document.deckPersonPool[0]; },
    document => { document.activeCast.progression[29] = document.activeCast.progression[0]; }
  ]) {
    const document = validCast();
    mutation(document);
    assert.notEqual(errorsFor(document), "");
  }
});

test("strengthened person background fields reject missing, empty, placeholder, invalid typed, and generic values", () => {
  const cases = [
    ["missing background", person => { delete person.background; }, /field background/u],
    ["empty residence", person => { person.residence = "   "; }, /field residence/u],
    ["placeholder origin", person => { person.origin = "TODO"; }, /field origin/u],
    ["missing age", person => { delete person.age; }, /field age/u],
    ["invalid age", person => { person.age = -2; }, /field age/u],
    ["missing gender", person => { delete person.gender; }, /field gender/u],
    ["invalid gender", person => { person.gender = "inferred"; }, /field gender/u],
    ["unsupported schema field", person => { person.chapterAppearances = [1]; }, /unsupported schema field chapterAppearances/u],
    ["missing role", person => { delete person.dailyRole; }, /field dailyRole/u],
    ["missing interests", person => { delete person.interests; }, /field interests/u],
    ["empty interests", person => { person.interests = ""; }, /field interests/u],
    ["generic biography", person => { person.background = `${person.displayName} is established in the curriculum as a worker.`; }, /field background/u]
  ];
  for (const [label, mutate, expected] of cases) {
    const document = validCast();
    mutate(document.cast[0]);
    assert.match(errorsFor(document), expected, label);
  }
});

test("duplicate semantic identity and permanent generic-role names are rejected", () => {
  const duplicate = validCast();
  duplicate.cast[1] = structuredClone(duplicate.cast[0]);
  duplicate.cast[1].id = ids[1];
  duplicate.cast[1].displayName = "Distinct Semantic Duplicate";
  assert.match(errorsFor(duplicate), /semantic identity/u);
  const duplicateName = validCast();
  duplicateName.cast[1].displayName = duplicateName.cast[0].displayName;
  assert.match(errorsFor(duplicateName), /displayName.*unique/u);
  const role = validCast();
  role.cast[0].displayName = "the clerk";
  assert.match(errorsFor(role), /generic functional-role label/u);
});

test("structured relationships validate reciprocity, targets, direction, chronology, duplication, and functional exclusion", () => {
  assert.equal(errorsFor(validCast()), "");
  const cases = [
    ["dangling", document => { document.cast[0].castRelationships = [{ targetCastId: "CAST-999", type: "friend" }]; }, /resolve inside/u],
    ["self", document => { document.cast[0].castRelationships = [{ targetCastId: ids[0], type: "friend" }]; }, /self-relations/u],
    ["contradictory direction", document => {
      document.cast[0].castRelationships = [{ targetCastId: ids[1], type: "parent" }];
      document.cast[1].castRelationships = [{ targetCastId: ids[0], type: "parent" }];
    }, /requires reciprocal child/u],
    ["impossible chronology", document => {
      document.cast[0].age = 20;
      document.cast[1].age = 19;
      document.cast[0].castRelationships = [{ targetCastId: ids[1], type: "parent" }];
      document.cast[1].castRelationships = [{ targetCastId: ids[0], type: "child" }];
    }, /chronology/u],
    ["invalid reciprocal", document => {
      document.cast[0].castRelationships = [{ targetCastId: ids[1], type: "friend" }];
      document.cast[1].castRelationships = [{ targetCastId: ids[0], type: "colleague" }];
    }, /requires reciprocal friend/u],
    ["duplicate", document => {
      document.cast[0].castRelationships.push({ targetCastId: ids[1], type: "spouse" });
    }, /duplicate equivalent/u],
    ["functional target", document => {
      document.cast[0].castRelationships = [{ targetCastId: "ROLE-CLERK", type: "friend" }];
    }, /functional participant/u]
  ];
  for (const [label, mutate, expected] of cases) {
    const document = validCast();
    mutate(document);
    assert.match(errorsFor(document), expected, label);
  }
});

test("schema v1 is historical diagnostic data and is rejected for every repository", () => {
  const legacy = validCast();
  legacy.schemaVersion = 1;
  legacy.activeCast.schemaVersion = 1;
  legacy.activeCast.legacyMigration = {
    status: "complete-through-chapter-80",
    note: "Actual authored progress is represented explicitly in the named migration path."
  };
  for (const person of legacy.cast) {
    delete person.gender;
    person.castRelationships = "legacy free text";
  }
  const rejected = validateCanonicalCast(legacy, { sourceFile: "/fixture/canonical-cast.json" });
  assert.match(rejected.errors.join("\n"), /historical diagnostic format only/u);
  for (const repositoryName of ["dutch-curriculum", "vietnamese-curriculum"]) {
    const result = validateCanonicalCast(legacy, { sourceFile: `/${repositoryName}/canonical-cast.json` });
    assert.match(result.errors.join("\n"), /strengthened schemaVersion 2 is required/u);
    assert.equal(result.legacy, false);
    assert.deepEqual(result.warnings, []);
  }
  const invalidStatus = structuredClone(legacy);
  invalidStatus.activeCast.legacyMigration.status = "complete";
  assert.match(errorsFor(invalidStatus), /historical diagnostic format only/u);
});

test("published schemas preserve v1 legacy semantics and define v2 plus chapter participants deliberately", async () => {
  const v1 = JSON.parse(await readFile(new URL("../schemas/canonical-cast-v1.schema.json", import.meta.url), "utf8"));
  const v2 = JSON.parse(await readFile(new URL("../schemas/canonical-cast-v2.schema.json", import.meta.url), "utf8"));
  const participants = JSON.parse(await readFile(new URL("../schemas/chapter-participants-v1.schema.json", import.meta.url), "utf8"));
  assert.equal(v1.properties.schemaVersion.const, 1);
  assert.equal(v1.properties.activeCast.properties.legacyMigration.properties.status.const, "pending");
  assert.equal(v2.properties.schemaVersion.const, 2);
  assert.deepEqual(v2.$defs.person.properties.gender.enum, ["female", "male", "nonbinary"]);
  assert.equal(participants.properties.unnamedFunctionalParticipants.items.$ref, "#/$defs/functionalParticipant");
  assert.equal(participants.$defs.functionalParticipant.properties.supportedProjectionLabels.uniqueItems, true);
});

function castIdentities() {
  return ids.map((id, index) => ({
    id,
    displayName: `Person ${index + 1} Example`
  }));
}

function dialogueFixture({ chapter = 1, canonicalCount = 1, functionLabels = [] } = {}) {
  const canonicalIds = ids.slice(0, canonicalCount);
  const functions = functionLabels.map((roleLabel, index) => ({ localId: `ROLE-${index + 1}`, roleLabel }));
  const primary = [
    ...canonicalIds.map((participantId, index) => ({ participantId, kind: "dialogue-speaker", label: `Person ${index + 1} Example` })),
    ...functions.map(person => ({ participantId: person.localId, kind: "dialogue-speaker", label: person.roleLabel }))
  ];
  const introduction = primary.map(({ participantId, label }) => ({ participantId, label }));
  const introText = introduction.map(item => item.label).join(", ");
  const body = primary.map(item => `${item.label}: A line for ${item.label}.`).join("\n");
  return {
    document: {
      schemaVersion: 1,
      chapter,
      canonicalCastIds: canonicalIds,
      unnamedFunctionalParticipants: functions,
      primaryReadingParticipants: primary,
      introductionParticipants: introduction
    },
    markdown: `# Chapter ${chapter}\n\n## Dialogue\n\n${introText} meet in a local setting.\n\n${body}\n\n## New Vocabulary\n`
  };
}

function reconcile(fixture, extra = {}) {
  return reconcileChapterParticipants(fixture.document, {
    sourceFile: "/fixture/chapter-participants.json",
    chapterMarkdown: fixture.markdown,
    canonicalCast: castIdentities(),
    activeCastProgression: ids,
    ...extra
  });
}

test("unnamed functional participants are allowed from Chapter 1 as Dialogue speakers without CAST IDs or a numerical ceiling", () => {
  const fixture = dialogueFixture({ chapter: 1, canonicalCount: 3, functionLabels: ["the baker", "the clerk", "the cashier", "the driver", "the receptionist"] });
  const result = reconcile(fixture);
  assert.equal(result.canonicalCastIds.length, 3);
  assert.equal(result.functionalParticipantIds.length, 5);
  assert.equal(result.namedCastCeiling, 3);
  assert.equal(result.structuralDialogueLabels.includes("the clerk"), true);
});

test("unnamed functional participants are allowed in Narrative and remain excluded from the four-person ceiling", () => {
  const canonicalIds = ids.slice(0, 4);
  const fixture = {
    document: {
      schemaVersion: 1,
      chapter: 76,
      canonicalCastIds: canonicalIds,
      unnamedFunctionalParticipants: [{ localId: "ROLE-BAKER", roleLabel: "the baker" }],
      primaryReadingParticipants: [
        ...canonicalIds.map((participantId, index) => ({ participantId, kind: "narrative-participant", label: `Person ${index + 1} Example` })),
        { participantId: "ROLE-BAKER", kind: "narrative-subject", label: "the baker" }
      ],
      introductionParticipants: [
        ...canonicalIds.map((participantId, index) => ({ participantId, label: `Person ${index + 1} Example` })),
        { participantId: "ROLE-BAKER", label: "the baker" }
      ]
    },
    markdown: `# Chapter 76\n\n## Narrative\n\nPerson 1 Example, Person 2 Example, Person 3 Example, Person 4 Example, and the baker meet at the bakery.\n\nPerson 1 Example greets Person 2 Example. Person 3 Example speaks to Person 4 Example while the baker opens the shop.\n\n## New Vocabulary\n`
  };
  const result = reconcile(fixture);
  assert.equal(result.canonicalCastIds.length, 4);
  assert.equal(result.functionalParticipantIds.length, 1);
});

test("named-cast ceilings count canonical people only at the exact Chapter 75 and 76 boundary", () => {
  assert.doesNotThrow(() => reconcile(dialogueFixture({ chapter: 75, canonicalCount: 3, functionLabels: ["the clerk"] })));
  assert.throws(() => reconcile(dialogueFixture({ chapter: 75, canonicalCount: 4 })), /ceiling is 3/u);
  assert.doesNotThrow(() => reconcile(dialogueFixture({ chapter: 76, canonicalCount: 4, functionLabels: ["the clerk"] })));
  assert.throws(() => reconcile(dialogueFixture({ chapter: 76, canonicalCount: 5 })), /ceiling is 4/u);
});

test("functional participants are excluded from activation and appearance coverage", () => {
  const audit = auditActiveCast({
    canonicalPersonIds: ids,
    progression: ids,
    chapters: [{
      chapter: 1,
      authorship: "new",
      migrationStatus: "compliant",
      participatingPersonIds: [ids[0]],
      meaningfulPersonIds: [ids[0]],
      functionalParticipants: [{ localId: "ROLE-CLERK", roleLabel: "the clerk" }]
    }]
  });
  assert.deepEqual(audit.appearancesByChapter[1], { [ids[0]]: 1 });
  assert.equal(Object.hasOwn(audit.cumulativeAppearances, "ROLE-CLERK"), false);
});

test("functional declarations reject CAST IDs, generic speakers, continuity/biography, and canonical disguises", () => {
  const castId = dialogueFixture({ functionLabels: ["the clerk"] });
  castId.document.unnamedFunctionalParticipants[0].localId = "CAST-030";
  assert.throws(() => reconcile(castId), /ROLE-\* identifier/u);

  const generic = dialogueFixture();
  generic.document.primaryReadingParticipants[0].label = "A";
  generic.document.introductionParticipants[0].label = "A";
  generic.markdown = generic.markdown.replaceAll("Person 1 Example", "A");
  assert.throws(() => reconcile(generic), /generic A\/B\/C/u);

  const continuity = dialogueFixture({ functionLabels: ["the clerk"] });
  continuity.document.unnamedFunctionalParticipants[0].biography = "A recurring life story";
  assert.throws(() => reconcile(continuity), /unsupported field biography/u);

  const disguised = dialogueFixture({ canonicalCount: 0, functionLabels: ["Person 1 Example"] });
  assert.throws(() => reconcile(disguised), /cannot be disguised/u);
});

test("participant reconciliation rejects omitted, undeclared, absent, label-mismatched, and inactive identities", () => {
  const matched = dialogueFixture({ canonicalCount: 1 });
  assert.doesNotThrow(() => reconcile(matched));

  const omittedCanonicalSpeaker = dialogueFixture({ canonicalCount: 1 });
  omittedCanonicalSpeaker.markdown = omittedCanonicalSpeaker.markdown.replace(
    "Person 1 Example: A line for Person 1 Example.",
    "Person 1 Example: A line.\nPerson 2 Example: An undeclared canonical line."
  );
  assert.throws(() => reconcile(omittedCanonicalSpeaker), /structural Dialogue speaker Person 2 Example is omitted/u);

  const undeclaredNamedPerson = dialogueFixture({ canonicalCount: 1 });
  undeclaredNamedPerson.markdown = undeclaredNamedPerson.markdown.replace(
    "Person 1 Example: A line for Person 1 Example.",
    "Person 1 Example: A line.\nAlice Example: An undeclared personal speaker."
  );
  assert.throws(() => reconcile(undeclaredNamedPerson), /structural Dialogue speaker Alice Example is omitted/u);

  const omitted = dialogueFixture({ canonicalCount: 1, functionLabels: ["the clerk"] });
  omitted.document.primaryReadingParticipants.pop();
  assert.throws(() => reconcile(omitted), /structural Dialogue speaker the clerk is omitted/u);

  const absent = dialogueFixture({ canonicalCount: 1 });
  absent.markdown = absent.markdown.replace("Person 1 Example: A line for Person 1 Example.", "");
  assert.throws(() => reconcile(absent), /no structural speaker labels|declared Dialogue participant.*absent/u);

  const undeclaredFunctional = dialogueFixture({ canonicalCount: 1 });
  undeclaredFunctional.markdown = undeclaredFunctional.markdown.replace("Person 1 Example: A line for Person 1 Example.", "Person 1 Example: A line.\nthe clerk: A line.");
  assert.throws(() => reconcile(undeclaredFunctional), /structural Dialogue speaker the clerk is omitted/u);

  const roleMismatch = dialogueFixture({ functionLabels: ["the clerk"] });
  roleMismatch.document.primaryReadingParticipants[1].label = "the cashier";
  assert.throws(() => reconcile(roleMismatch), /exact primary-reading role label the clerk/u);

  const inactive = dialogueFixture({ chapter: 1, canonicalCount: 1 });
  inactive.document.canonicalCastIds = [ids[5]];
  inactive.document.primaryReadingParticipants[0].participantId = ids[5];
  inactive.document.primaryReadingParticipants[0].label = "Person 6 Example";
  inactive.document.introductionParticipants[0].participantId = ids[5];
  inactive.document.introductionParticipants[0].label = "Person 6 Example";
  inactive.markdown = inactive.markdown.replaceAll("Person 1 Example", "Person 6 Example");
  assert.throws(() => reconcile(inactive), /outside the active progression prefix/u);
});

test("a bare canonical-name reference does not create a participant or appearance", () => {
  const referenced = dialogueFixture({ canonicalCount: 1 });
  referenced.markdown = referenced.markdown.replace(
    "Person 1 Example: A line for Person 1 Example.",
    "Person 1 Example: Person 2 Example will arrive tomorrow."
  );
  assert.doesNotThrow(() => reconcile(referenced));
});

test("translation and support identity projections are validated when declared", () => {
  const fixture = dialogueFixture({ functionLabels: ["the clerk"] });
  fixture.document.translationParticipants = [{ participantId: ids[0], label: "Person 1 Example" }];
  fixture.document.supportParticipants = [{ participantId: "ROLE-1", label: "the clerk" }];
  assert.doesNotThrow(() => reconcile(fixture, { translationText: "Person 1 Example speaks.", supportText: "The note mentions the clerk." }));
  assert.throws(() => reconcile(fixture, { translationText: "Someone speaks.", supportText: "The note mentions the clerk." }), /translationParticipants.*absent/u);
});

test("ordinary curricula preserve canonical short forms and explicitly map natural unnamed-role projections", () => {
  const short = dialogueFixture({ canonicalCount: 1 });
  short.document.primaryReadingParticipants[0].label = "Mia";
  short.document.introductionParticipants[0].label = "Mia";
  short.markdown = short.markdown.replaceAll("Person 1 Example", "Mia");
  assert.doesNotThrow(() => reconcile(short, { curriculumIdentity: "german-curriculum" }));

  const role = dialogueFixture({ canonicalCount: 1, functionLabels: ["Vendeur"] });
  role.document.unnamedFunctionalParticipants[0].supportedProjectionLabels = ["the seller", "Seller"];
  role.document.introductionParticipants[1].label = "the seller";
  role.document.translationParticipants = [{ participantId: "ROLE-1", label: "Seller" }];
  role.markdown = role.markdown.replace("Vendeur meet", "the seller meets");
  assert.doesNotThrow(() => reconcile(role, { translationText: "Seller: Thank you." }));

  const stale = structuredClone(role);
  stale.document.translationParticipants[0].label = "cashier";
  assert.throws(() => reconcile(stale, { translationText: "cashier: Thank you." }), /not its exact role label.*or an explicitly supported projection label/u);
  assert.equal(role.markdown.includes("CAST-"), false);
});

test("package-generation and installed-reader validation preserve and reconcile strengthened participant metadata", () => {
  const cast = validCast();
  const fixture = dialogueFixture({ chapter: 1, canonicalCount: 1, functionLabels: ["the clerk"] });
  const path = "units/example-core/chapter-001-test";
  const sourceFiles = [
    { path: "name-pools/canonical-cast.json", text: JSON.stringify(cast) },
    { path: `${path}/chapter.md`, text: fixture.markdown },
    { path: `${path}/chapter-participants.json`, text: JSON.stringify(fixture.document) }
  ];
  assert.equal(isContentPackageSourceFileAllowed(`${path}/chapter-participants.json`), true);
  assert.doesNotThrow(() => assertPackagedCanonicalCastAndParticipants({ id: "example-curriculum", contentType: "language-curriculum" }, sourceFiles));
  const snapshot = {
    contentSchema: "whacksmacker-source-markdown-snapshot-v1",
    files: [
      { path: "name-pools/canonical-cast.json", mediaType: "application/json", text: JSON.stringify(cast) },
      { path: `${path}/chapter.md`, mediaType: "text/markdown", text: fixture.markdown },
      { path: `${path}/chapter-participants.json`, mediaType: "application/json", text: JSON.stringify(fixture.document) }
    ]
  };
  assert.doesNotThrow(() => assertInstalledCurriculumParticipants(snapshot, "com.example.language"));
  snapshot.files.pop();
  assert.throws(() => assertInstalledCurriculumParticipants(snapshot, "com.example.language"), /missing required chapter-participants\.json/u);
});

test("Phase 0 accepts a valid cast-only source but keeps it package-less", () => {
  const files = [{ path: "name-pools/canonical-cast.json", text: JSON.stringify(validCast()) }];
  const status = assertCanonicalCastBootstrapBeforeOrdinaryContent(files, {
    sourceLabel: "source:example-curriculum",
    requireOrdinaryContent: false
  });
  assert.equal(status.phase0Complete, true);
  assert.equal(status.chapterCount, 0);
  assert.equal(status.packageable, false);
  assert.throws(
    () => assertCanonicalCastBootstrapBeforeOrdinaryContent(files, {
      sourceLabel: "package:example-curriculum",
      requireOrdinaryContent: true
    }),
    /must remain package-less until ordinary content exists/u
  );
});

test("Chapter 1 bootstrap failures name Phase 0 for absent, short, incomplete, and invalid-progression casts", () => {
  const fixture = dialogueFixture({ chapter: 1, canonicalCount: 1 });
  const path = "units/example-core/chapter-001-test";
  const chapterFiles = [
    { path: `${path}/chapter.md`, text: fixture.markdown },
    { path: `${path}/chapter-participants.json`, text: JSON.stringify(fixture.document) }
  ];
  assert.throws(
    () => assertPackagedCanonicalCastAndParticipants({ id: "example-curriculum", contentType: "language-curriculum" }, chapterFiles),
    /complete canonical 30-person cast must be authored and validated before Chapter 1[\s\S]*canonical-cast\.json is absent/iu
  );
  for (const [label, mutate, expected] of [
    ["29 people", document => document.cast.pop(), /exactly 30 people/u],
    ["incomplete biography", document => { document.cast[0].background = "Too short."; }, /specific biography/u],
    ["invalid progression", document => { document.activeCast.progression[29] = ids[0]; }, /progression.*duplicate/u]
  ]) {
    const cast = validCast();
    mutate(cast);
    assert.throws(
      () => assertPackagedCanonicalCastAndParticipants(
        { id: "example-curriculum", contentType: "language-curriculum" },
        [{ path: "name-pools/canonical-cast.json", text: JSON.stringify(cast) }, ...chapterFiles]
      ),
      error => {
        assert.match(error.message, /complete canonical 30-person cast must be authored and validated before Chapter 1/iu, label);
        assert.match(error.message, expected, label);
        return true;
      }
    );
  }
});
