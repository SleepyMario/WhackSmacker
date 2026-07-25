import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const modulesRoot = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const configs = [
  ["arabic", 5, ["لَيْلَى", "سَامِي"]],
  ["french", 10, ["Lina", "Marc"]],
  ["german", 10, ["Mia", "Jonas"]],
  ["hindi", 5, ["रीना", "अमित"]],
  ["russian", 5, ["Анна", "Иван"]],
  ["spanish", 5, ["Ana", "Luis"]],
  ["thai", 5, ["มาลี", "นนท์"]],
  ["zulu", 5, ["Thandi", "Sipho"]]
];

async function participantFiles(root) {
  const found = [];
  async function visit(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) await visit(path);
      else if (entry.name === "chapter-participants.json") found.push(path);
    }
  }
  await visit(root);
  return found.sort();
}

test("all 50 Phase 7A sidecars preserve ordinary short forms and canonical ceilings", async () => {
  let total = 0;
  for (const [language, expectedCount, familiarLabels] of configs) {
    const repository = join(modulesRoot, `${language}-curriculum`);
    const files = await participantFiles(join(repository, "units"));
    assert.equal(files.length, expectedCount, language);
    total += files.length;
    const documents = await Promise.all(files.map(async path => JSON.parse(await readFile(path, "utf8"))));
    for (const document of documents) {
      assert.equal(document.schemaVersion, 1);
      assert.equal(document.canonicalCastIds.length <= 3, true);
      assert.equal(document.canonicalCastIds.every(id => /^CAST-\d{3}$/u.test(id)), true);
      assert.equal(document.unnamedFunctionalParticipants.every(person => /^ROLE-/u.test(person.localId)), true);
      assert.equal(document.unnamedFunctionalParticipants.every(person => !Object.hasOwn(person, "castId")), true);
      assert.equal(document.primaryReadingParticipants.every(person => !person.label.startsWith("CAST-")), true);
    }
    const labels = new Set(documents.flatMap(document => document.primaryReadingParticipants.map(person => person.label)));
    for (const label of familiarLabels) assert.equal(labels.has(label), true, `${language}: ${label}`);
  }
  assert.equal(total, 50);
});

test("French and German chapter-local relational participants remain non-cast", async () => {
  const french7 = JSON.parse(await readFile(join(modulesRoot, "french-curriculum/units/french-core/chapter-007-buying-bread/chapter-participants.json"), "utf8"));
  const french10 = JSON.parse(await readFile(join(modulesRoot, "french-curriculum/units/french-core/chapter-010-a-family-visit/chapter-participants.json"), "utf8"));
  const german8 = JSON.parse(await readFile(join(modulesRoot, "german-curriculum/units/german-core/chapter-008-a-busy-evening/chapter-participants.json"), "utf8"));
  assert.deepEqual(french7.unnamedFunctionalParticipants.map(person => person.localId), ["ROLE-SELLER"]);
  assert.deepEqual(french10.unnamedFunctionalParticipants.map(person => person.localId), ["ROLE-BROTHER", "ROLE-SISTER"]);
  assert.deepEqual(german8.unnamedFunctionalParticipants.map(person => person.localId), ["ROLE-FRIEND"]);
  assert.equal(french10.canonicalCastIds.length, 1);
  assert.equal(german8.canonicalCastIds.length, 2);
  assert.deepEqual(french7.translationParticipants.at(-1), { participantId: "ROLE-SELLER", label: "Seller" });
  assert.deepEqual(german8.translationParticipants.at(-1), { participantId: "ROLE-FRIEND", label: "friend" });
});

test("Phase 7A participant IDs do not enter canonical casts or learner-facing chapters", async () => {
  for (const [language] of configs) {
    const repository = join(modulesRoot, `${language}-curriculum`);
    const castText = await readFile(join(repository, "name-pools/canonical-cast.json"), "utf8");
    assert.equal(castText.includes("ROLE-"), false, language);
    for (const sidecar of await participantFiles(join(repository, "units"))) {
      const chapterText = await readFile(join(dirname(sidecar), "chapter.md"), "utf8");
      assert.equal(/\b(?:CAST|ROLE)-[A-Z0-9-]+\b/u.test(chapterText), false, sidecar);
    }
  }
});

test("Phase 7B Dutch and Vietnamese sidecars resolve, expose activation previews, and preserve exact authored sets", async () => {
  for (const [language, expectedCount, through] of [["dutch", 85, 85], ["vietnamese", 50, 50]]) {
    const repository = join(modulesRoot, `${language}-curriculum`);
    const cast = JSON.parse(await readFile(join(repository, "name-pools/canonical-cast.json"), "utf8"));
    assert.equal(cast.schemaVersion, 2, language);
    const ids = new Set(cast.cast.map(person => person.id));
    const files = await participantFiles(join(repository, "units"));
    assert.equal(files.length, expectedCount, language);
    for (const path of files) {
      const document = JSON.parse(await readFile(path, "utf8"));
      assert.equal(document.chapter <= through, true);
      assert.equal(document.canonicalCastIds.every(id => ids.has(id)), true, path);
      assert.deepEqual(
        new Set(document.primaryReadingParticipants.filter(person => person.participantId.startsWith("CAST-")).map(person => person.participantId)),
        new Set(document.canonicalCastIds),
        path
      );
    }
  }

  const dutchFiles = await participantFiles(join(modulesRoot, "dutch-curriculum/units"));
  const byChapter = new Map(await Promise.all(dutchFiles.map(async path => {
    const document = JSON.parse(await readFile(path, "utf8"));
    return [document.chapter, document];
  })));
  assert.deepEqual(byChapter.get(76).canonicalCastIds, ["CAST-006", "CAST-001", "CAST-004"]);
  assert.deepEqual(byChapter.get(77).canonicalCastIds, ["CAST-008", "CAST-007", "CAST-010"]);
  assert.deepEqual(byChapter.get(78).canonicalCastIds, ["CAST-016", "CAST-004", "CAST-025"]);
  assert.deepEqual(byChapter.get(79).canonicalCastIds, ["CAST-024", "CAST-002", "CAST-027"]);
  assert.deepEqual(byChapter.get(80).canonicalCastIds, ["CAST-015", "CAST-014", "CAST-013"]);
});

test("Phase 7B literal identity evidence and completed appearance coverage are current", async () => {
  const dutch = join(modulesRoot, "dutch-curriculum");
  const appearance = await readFile(join(dutch, "name-pools/appearance-ledger.md"), "utf8");
  assert.match(appearance, /CAST-005.*21, 22, 24, 37, 38.*5\/5 — passed/u);
  assert.match(appearance, /61–80.*completed.*CAST-010: 9; CAST-011: 5; CAST-012: 8.*passed/u);
  assert.match(appearance, /Pre-activation preview appearances.*CAST-016 in Chapter 78.*CAST-027 in Chapter 79.*CAST-014 in Chapter 80/u);
  const changed = [
    join(dutch, "units/dutch-core/chapter-078-a-morning-in-the-garden/chapter.md"),
    join(dutch, "units/dutch-core/chapter-079-building-a-bookcase-together/chapter.md"),
    join(dutch, "units/dutch-core/chapter-080-the-first-week-of-the-course/chapter.md"),
    join(modulesRoot, "whacksmacker/review-content/dutch/review-decks/chapter-076-080/cards.tsv")
  ];
  const text = (await Promise.all(changed.map(path => readFile(path, "utf8")))).join("\n");
  assert.match(text, /\bJoris\b/u);
  assert.match(text, /\bFinn\b/u);
  assert.match(text, /\bGerard\b/u);
  assert.match(text, /\bLuuk\b/u);
  const chapter78 = await readFile(changed[0], "utf8");
  assert.match(chapter78, /Joris sluit de kast, maar hij laat het hek nog even open\./u);
  const chapter78Translation = await readFile(join(dutch, "units/dutch-core/chapter-078-a-morning-in-the-garden/reading-translation.en.json"), "utf8");
  const chapter78Support = await readFile(join(modulesRoot, "whacksmacker/curriculum-support/dutch/chapter-078/reading-support.json"), "utf8");
  assert.match(chapter78Translation, /Joris closes the cupboard, but he leaves/u);
  assert.match(chapter78Support, /Joris \[\[grammar:sluit\]\] de kast, maar hij \[\[grammar:laat\]\]/u);
  const chapter80 = await readFile(changed[2], "utf8");
  assert.match(chapter80, /\b(?:Emma|Bram)\b/u);
  const vietnameseAppearance = await readFile(join(modulesRoot, "vietnamese-curriculum/name-pools/appearance-ledger.md"), "utf8");
  assert.match(vietnameseAppearance, /41–60 \| incomplete progress.*pending/u);
});
