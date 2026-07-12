import assert from "node:assert/strict";
import { test } from "node:test";
import { activeCastBlockReport, auditActiveCast } from "../dist/packages/core/index.js";

const ids = Array.from({ length: 30 }, (_, index) => `CAST-${String(index + 1).padStart(3, "0")}`);
const complete = (start) => new Set(Array.from({ length: 20 }, (_, index) => start + index));
const report = (appearancesByChapter, suppliedChapters = complete(21), chapterStart = 21) => activeCastBlockReport({ chapterStart, progression: ids, appearancesByChapter, suppliedChapters });

test("exactly one-third old-cast person-chapter appearances passes using ceil(total / 3)", () => {
  const appearances = Object.fromEntries(Array.from({ length: 5 }, (_, index) => [21 + index, { [ids[0]]: 1, [ids[5]]: 1, [ids[6]]: 1 }]));
  const value = report(appearances);
  assert.equal(value.oldCastAppearanceCount, 5);
  assert.equal(value.newCastAppearanceCount, 10);
  assert.equal(value.totalCanonicalAppearanceCount, 15);
  assert.equal(value.requiredMinimumOldCastCount, 5);
  assert.equal(value.oldCastPercentage, 1 / 3);
  assert.equal(value.distributionStatus, "passed");
});

test("more than one third passes and less than one third fails only when complete", () => {
  const enough = Object.fromEntries(Array.from({ length: 5 }, (_, index) => [21 + index, { [ids[0]]: 1, [ids[1]]: 1, [ids[5]]: 1, [ids[6]]: 1, [ids[7]]: 1 }]));
  assert.equal(report(enough).distributionStatus, "passed");
  const low = Object.fromEntries(Array.from({ length: 5 }, (_, index) => [21 + index, { [ids[0]]: 1, [ids[5]]: 1, [ids[6]]: 1, [ids[7]]: 1 }]));
  assert.equal(report(low).requiredMinimumOldCastCount, 7);
  assert.equal(report(low).distributionStatus, "failed");
  assert.equal(report(low, new Set([21, 22, 23, 24, 25])).distributionStatus, "pending");
  assert.equal(report(low, new Set([21, 22, 23, 24, 25])).distributionOnTrack, false);
});

test("distinct person-chapter counting ignores duplicate lines and non-meaningful fields", () => {
  const chapters = Array.from({ length: 40 }, (_, index) => ({ chapter: index + 1, authorship: "new", migrationStatus: "compliant", meaningfulPersonIds: index < 5 ? ids.slice(0, 5) : index >= 20 && index < 25 ? [ids[0], ids[0], ids[1], ids[5], ids[5], ids[6], ids[7]] : [], participatingPersonIds: ids.slice(0, index < 20 ? 5 : 8), reviewPersonIds: [], incidentalPeople: [] }));
  const audit = auditActiveCast({ canonicalPersonIds: ids, progression: ids, chapters });
  assert.equal(audit.blocks[1].oldCastAppearanceCount, 10);
  assert.equal(audit.blocks[1].newCastAppearanceCount, 15);
  assert.equal(audit.blocks[1].distributionStatus, "passed");
});

test("old-cast ratio and five-chapter activation minimum fail independently", () => {
  const first = Array.from({ length: 20 }, (_, index) => ({ chapter: index + 1, authorship: "new", migrationStatus: "compliant", meaningfulPersonIds: index < 5 ? ids.slice(0, 5) : [] }));
  const second = Array.from({ length: 20 }, (_, index) => ({ chapter: index + 21, authorship: "new", migrationStatus: "compliant", meaningfulPersonIds: index < 5 ? [ids[0], ids[1], ids[2], ids[3], ids[4], ids[5], ids[6]] : [] }));
  assert.throws(() => auditActiveCast({ canonicalPersonIds: ids, progression: ids, chapters: [...first, ...second] }), new RegExp(`${ids[7]}.*0 distinct.*5 required`, "u"));
});

test("the ratio remains active at 181-200 and is absent before activation and after Chapter 200", () => {
  assert.equal(report({}, complete(1), 1).distributionStatus, "not-applicable");
  const final = Object.fromEntries(Array.from({ length: 5 }, (_, index) => [181 + index, { [ids[0]]: 1, [ids[29]]: 1 }]));
  assert.equal(report(final, complete(181), 181).distributionStatus, "passed");
  assert.equal(report({}, new Set(), 201).distributionStatus, "not-applicable");
});

test("five-chapter activation reports apply at every boundary from Chapter 21 through 181", () => {
  for (const chapterStart of [21, 41, 61, 81, 101, 121, 141, 161, 181]) {
    const previousCount = Math.min(30, 5 + 3 * Math.floor((chapterStart - 2) / 20));
    const activeCount = Math.min(30, 5 + 3 * Math.floor((chapterStart - 1) / 20));
    const newlyActive = ids.slice(previousCount, activeCount);
    const appearances = Object.fromEntries(Array.from({ length: 5 }, (_, index) => [chapterStart + index, Object.fromEntries([ids[0], ...newlyActive].map((id) => [id, 1]))]));
    const value = report(appearances, complete(chapterStart), chapterStart);
    assert.equal(value.activationPeople.length, newlyActive.length);
    assert.ok(value.activationPeople.every((person) => person.status === "passed" && person.distinctQualifyingChapterCount === 5));
  }
});
