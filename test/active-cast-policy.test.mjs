import assert from "node:assert/strict";
import { test } from "node:test";

import {
  activeCastSizeForChapter,
  activePersonIdsForChapter,
  assertActiveCastProgression,
  activeCastBlockReport,
  auditActiveCast,
  leastUsedSuitableActivePersonIds
} from "../dist/packages/core/index.js";

const ids = Array.from({ length: 30 }, (_, index) => `CAST-${String(index + 1).padStart(3, "0")}`);
const record = (chapter, personIds, extra = {}) => ({ chapter, authorship: "new", migrationStatus: "compliant", participatingPersonIds: personIds, meaningfulPersonIds: personIds, ...extra });

test("active pool expands by three only after each twenty-chapter block and caps permanently at thirty", () => {
  const boundaries = [[1, 5], [20, 5], [21, 8], [40, 8], [41, 11], [60, 11], [61, 14], [80, 14], [81, 17], [100, 17], [101, 20], [120, 20], [121, 23], [140, 23], [141, 26], [160, 26], [161, 29], [180, 29], [181, 30], [200, 30], [201, 30], [999, 30]];
  for (const [chapter, size] of boundaries) {
    assert.equal(activeCastSizeForChapter(chapter), size);
    assert.deepEqual(activePersonIdsForChapter(chapter, ids), ids.slice(0, size));
  }
  assert.ok(activePersonIdsForChapter(181, ids).includes(ids[0]));
  assert.ok(activePersonIdsForChapter(201, ids).includes(ids[29]));
});

test("progression must be an exact permutation of the canonical thirty", () => {
  assert.doesNotThrow(() => assertActiveCastProgression(ids, ids));
  assert.throws(() => assertActiveCastProgression(ids, [...ids.slice(0, 29), ids[0]]), /duplicate/u);
  assert.throws(() => assertActiveCastProgression(ids, ids.slice(0, 29)), /exactly 30/u);
  assert.throws(() => assertActiveCastProgression(ids, [...ids, "CAST-031"]), /exactly 30/u);
  assert.throws(() => assertActiveCastProgression(ids, [...ids.slice(0, 29), "CAST-031"]), /unknown.*omits/u);
  assert.throws(() => assertActiveCastProgression([...ids.slice(0, 29), "CAST-031"], ids), /unknown/u);
});

test("dialogue and narrative identities are checked while unrelated proper nouns are outside cast-ID scope", () => {
  assert.throws(() => auditActiveCast({ canonicalPersonIds: ids, progression: ids, chapters: [record(1, [], { dialogueSpeakerIds: [ids[5]] })] }), /inactive canonical person/u);
  assert.throws(() => auditActiveCast({ canonicalPersonIds: ids, progression: ids, chapters: [record(2, [], { narrativePersonIds: [ids[6]] })] }), /inactive canonical person/u);
  assert.throws(() => auditActiveCast({ canonicalPersonIds: ids, progression: ids, chapters: [record(1, ["UNKNOWN"])] }), /unknown canonical person/u);
  assert.doesNotThrow(() => auditActiveCast({ canonicalPersonIds: ids, progression: ids, chapters: [record(1, [ids[0]], { recurringRelationship: "siblings; Paris and Victor Hugo are ordinary textual proper nouns" })] }));
});

test("reviews reuse source-chapter people and cannot independently activate later people", () => {
  assert.doesNotThrow(() => auditActiveCast({ canonicalPersonIds: ids, progression: ids, chapters: [record(1, [ids[0]]), record(6, [], { reviewPersonIds: [ids[0]], reviewSourceChapters: [1] })] }));
  assert.throws(() => auditActiveCast({ canonicalPersonIds: ids, progression: ids, chapters: [record(1, [ids[0]]), record(6, [], { reviewPersonIds: [ids[2]], reviewSourceChapters: [1] })] }), /not active in a declared source chapter/u);
  assert.throws(() => auditActiveCast({ canonicalPersonIds: ids, progression: ids, chapters: [record(1, [ids[0]]), record(21, [], { reviewPersonIds: [ids[3]], reviewSourceChapters: [1] })] }), /not active in a declared source chapter/u);
});

test("appearance audit tracks IDs, warns on severe imbalance, and keeps recurring relationships valid", () => {
  const chapters = Array.from({ length: 20 }, (_, index) => record(index + 1, index < 5 ? [ids[0], ids[0], ids[1], ids[2], ids[3], ids[4]] : [ids[0], ids[0]], { recurringRelationship: "recurring classmates" }));
  const audit = auditActiveCast({ canonicalPersonIds: ids, progression: ids, chapters });
  assert.equal(audit.appearancesByChapter[1][ids[0]], 1);
  assert.equal(audit.cumulativeAppearances[ids[0]], 20);
  assert.equal(audit.blocks[0].appearancesByPersonId[ids[1]], 5);
  assert.match(audit.warnings[0], /severe active-cast appearance imbalance/u);
  assert.deepEqual(leastUsedSuitableActivePersonIds({ chapter: 1, progression: ids, cumulativeAppearances: audit.cumulativeAppearances, count: 2 }), [ids[1], ids[2]]);
});

test("completed blocks require five distinct meaningful chapters for every newly activated person", () => {
  const first = Array.from({ length: 20 }, (_, index) => record(index + 1, index < 5 ? ids.slice(0, 5) : []));
  assert.equal(auditActiveCast({ canonicalPersonIds: ids, progression: ids, chapters: first }).blocks[0].coverageStatus, "complete");
  assert.throws(() => auditActiveCast({ canonicalPersonIds: ids, progression: ids, chapters: first.map((item) => ({ ...item, meaningfulPersonIds: item.chapter === 5 ? item.meaningfulPersonIds.filter((id) => id !== ids[4]) : item.meaningfulPersonIds })) }), /has 4 distinct.*5 required/u);

  const second = Array.from({ length: 20 }, (_, index) => record(index + 21, index < 5 ? [ids[0], ids[1], ids[5], ids[6], ids[7]] : []));
  assert.doesNotThrow(() => auditActiveCast({ canonicalPersonIds: ids, progression: ids, chapters: [...first, ...second] }));
  assert.throws(() => auditActiveCast({ canonicalPersonIds: ids, progression: ids, chapters: [...first, ...second.map((item) => ({ ...item, meaningfulPersonIds: item.meaningfulPersonIds.filter((id) => id !== ids[0] && id !== ids[1]) }))] }), /old cast has 0 of 15/u);
});

test("incomplete blocks are pending and metadata or review references do not satisfy coverage", () => {
  const audit = auditActiveCast({ canonicalPersonIds: ids, progression: ids, chapters: [record(1, [], { participatingPersonIds: ids.slice(0, 5), dialogueSpeakerIds: ids.slice(0, 5) })] });
  assert.equal(audit.blocks[0].coverageStatus, "pending");
  assert.deepEqual(audit.blocks[0].missingNewPersonIds, ids.slice(0, 5));
  assert.equal(audit.blocks[0].activationPeople[0].remainingCount, 5);
  assert.deepEqual(audit.blocks[0].activationPeople[0].qualifyingChapterNumbers, []);
  assert.deepEqual(audit.pendingCoverageBlocks, ["1-20"]);
});

test("activation reports continue through Chapter 181 and stop after Chapter 200", () => {
  const appearancesByChapter = Object.fromEntries(Array.from({ length: 5 }, (_, index) => [181 + index, { [ids[29]]: 1, [ids[0]]: 1 }]));
  const report = activeCastBlockReport({ chapterStart: 181, progression: ids, appearancesByChapter, suppliedChapters: new Set(Array.from({ length: 20 }, (_, index) => 181 + index)) });
  assert.equal(report.activationPeople.length, 1);
  assert.equal(report.activationPeople[0].status, "passed");
  assert.deepEqual(report.activationPeople[0].qualifyingChapterNumbers, [181, 182, 183, 184, 185]);
  const post200 = activeCastBlockReport({ chapterStart: 201, progression: ids, appearancesByChapter: {}, suppliedChapters: new Set() });
  assert.deepEqual(post200.activationPeople, []);
  assert.equal(post200.distributionStatus, "not-applicable");
});

test("Chapter 201 permits ID-less functional roles but rejects a hidden detailed cast", () => {
  const incidental = { nameOrRole: "Mr. Johnson, newsreader", function: "reads the evening bulletin", lightlyDescribed: true };
  assert.doesNotThrow(() => auditActiveCast({ canonicalPersonIds: ids, progression: ids, chapters: [record(201, [], { incidentalPeople: [incidental] })] }));
  assert.throws(() => auditActiveCast({ canonicalPersonIds: ids, progression: ids, chapters: [record(200, [], { incidentalPeople: [incidental] })] }), /only from Chapter 201/u);
  assert.throws(() => auditActiveCast({ canonicalPersonIds: ids, progression: ids, chapters: [record(201, [], { incidentalPeople: [{ ...incidental, canonicalPersonId: "CAST-031" }] })] }), /must not receive a canonical ID/u);
  assert.throws(() => auditActiveCast({ canonicalPersonIds: ids, progression: ids, chapters: [record(201, [], { incidentalPeople: [{ ...incidental, biography: "A long life story" }] })] }), /canonical-style biography/u);
});

test("legacy violations remain visible but new violations cannot use migration status", () => {
  const audit = auditActiveCast({ canonicalPersonIds: ids, progression: ids, chapters: [{ chapter: 1, authorship: "legacy", migrationStatus: "pending-legacy-migration", participatingPersonIds: [ids[10]] }] });
  assert.equal(audit.status, "pending-legacy-migration");
  assert.deepEqual(audit.pendingChapters, [1]);
  assert.throws(() => auditActiveCast({ canonicalPersonIds: ids, progression: ids, chapters: [{ chapter: 1, authorship: "new", migrationStatus: "pending-legacy-migration", participatingPersonIds: [ids[10]] }] }), /newly authored content cannot be marked/u);
});
