import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";

import { auditActiveCast } from "../dist/packages/core/index.js";

const workspace = join(process.cwd(), "..");
const repository = join(workspace, "german-curriculum");
const unitRoot = join(repository, "units", "german-core");
const directories = new Map([
  [6, "chapter-006-a-small-shopping-trip"],
  [7, "chapter-007-ordering-at-a-cafe"],
  [8, "chapter-008-a-busy-evening"],
  [9, "chapter-009-repairing-a-bicycle"],
  [10, "chapter-010-a-rainy-bus-ride"]
]);
const expected = new Map([
  [6, ["CAST-005"]],
  [7, ["CAST-001", "CAST-002"]],
  [8, ["CAST-003", "CAST-004"]],
  [9, ["CAST-003", "CAST-004"]],
  [10, ["CAST-001", "CAST-002"]]
]);

function primaryReading(markdown) {
  const match = /^### (Dialogue|Narrative)\s*$\n([\s\S]*?)(?=^### New Vocabulary\s*$)/mu.exec(markdown);
  assert.ok(match);
  const blocks = match[2].trim().split(/\n\s*\n/u).filter(Boolean);
  return { mode: match[1], setup: blocks[0], body: blocks.slice(1).join("\n") };
}

test("German Chapters 6–10 vary meaningful cast and introduce every initial active person", async () => {
  const cast = JSON.parse(await readFile(join(repository, "name-pools", "canonical-cast.json"), "utf8"));
  const chapters = [];
  const signatures = [];
  const union = new Set();
  for (const [chapter, directory] of directories) {
    const sidecar = JSON.parse(await readFile(join(unitRoot, directory, "chapter-participants.json"), "utf8"));
    const markdown = await readFile(join(unitRoot, directory, "chapter.md"), "utf8");
    const translation = await readFile(join(unitRoot, directory, "reading-translation.en.json"), "utf8");
    const support = await readFile(join(process.cwd(), "curriculum-support", "german", `chapter-${String(chapter).padStart(3, "0")}`, "reading-support.json"), "utf8");
    const reading = primaryReading(markdown);
    assert.deepEqual(sidecar.canonicalCastIds, expected.get(chapter), `Chapter ${chapter} canonical cast`);
    assert.equal(sidecar.canonicalCastIds.length <= 3, true);
    for (const id of sidecar.canonicalCastIds) union.add(id);
    signatures.push([...sidecar.canonicalCastIds].sort().join("|"));
    for (const participant of sidecar.primaryReadingParticipants) {
      assert.equal(`${reading.setup}\n${reading.body}`.includes(participant.label), true, `Chapter ${chapter} source contains ${participant.label}`);
    }
    for (const participant of sidecar.translationParticipants ?? []) {
      assert.equal(translation.includes(participant.label), true, `Chapter ${chapter} translation contains ${participant.label}`);
    }
    for (const participant of sidecar.supportParticipants ?? []) {
      assert.equal(`${reading.setup}\n${support}`.includes(participant.label), true, `Chapter ${chapter} support contains ${participant.label}`);
    }
    chapters.push({
      chapter,
      authorship: "new",
      migrationStatus: "compliant",
      participatingPersonIds: sidecar.canonicalCastIds,
      meaningfulPersonIds: sidecar.canonicalCastIds,
      functionalParticipants: sidecar.unnamedFunctionalParticipants
    });
  }
  assert.deepEqual([...union].sort(), ["CAST-001", "CAST-002", "CAST-003", "CAST-004", "CAST-005"]);
  assert.ok(new Set(signatures).size > 1);
  assert.doesNotThrow(() => auditActiveCast({
    canonicalPersonIds: cast.cast.map((person) => person.id),
    progression: cast.activeCast.progression,
    chapters
  }));
});

test("German repaired readings retain the approved people and literal Review evidence", async () => {
  const chapter6 = await readFile(join(unitRoot, directories.get(6), "chapter.md"), "utf8");
  const chapter8 = await readFile(join(unitRoot, directories.get(8), "chapter.md"), "utf8");
  const chapter9 = await readFile(join(unitRoot, directories.get(9), "chapter.md"), "utf8");
  assert.match(chapter6, /Hannah kauft einen Apfel\./u);
  assert.doesNotMatch(chapter6, /Jonas kauft einen Apfel|Mia kauft eine Banane/u);
  assert.match(chapter8, /Leonie steht früh auf\./u);
  assert.match(chapter8, /Tobias steht später auf\./u);
  assert.doesNotMatch(chapter8, /Mia steht früh auf|Jonas steht später auf/u);
  assert.match(chapter9, /^Leonie: Kannst du helfen\?$/mu);
  assert.match(chapter9, /^Tobias: Ja, vielleicht kann ich das Fahrrad reparieren\.$/mu);
  const deck = await readFile(join(process.cwd(), "review-content", "german", "review-decks", "chapter-006-010", "cards.tsv"), "utf8");
  for (const evidence of [
    "Hannah kauft einen Apfel.",
    "Sie kauft eine Banane.",
    "Leonie steht früh auf.",
    "Tobias steht später auf.",
    "Danach ruft Leonie eine Freundin an.",
    "Tobias kocht eine Suppe."
  ]) assert.equal(deck.includes(evidence), true, evidence);
  for (const stale of [
    "Jonas kauft einen Apfel.",
    "Mia kauft eine Banane.",
    "Mia steht früh auf.",
    "Jonas steht später auf.",
    "Danach ruft Mia eine Freundin an.",
    "Jonas kocht eine Suppe."
  ]) assert.equal(deck.includes(stale), false, stale);
});
