export const canonicalCastIds = Array.from(
  { length: 30 },
  (_, index) => `CAST-${String(index + 1).padStart(3, "0")}`
);

export function canonicalCastFixture() {
  const cast = canonicalCastIds.map((id, index) => {
    const partnerIndex = index % 2 === 0 ? index + 1 : index - 1;
    const partner = canonicalCastIds[partnerIndex];
    return {
      id,
      displayName: `Fixture${index + 1} Example`,
      age: 30 + index,
      gender: index % 2 === 0 ? "female" : "male",
      origin: `Raised in fixture district ${index + 1} with established family and community ties.`,
      residence: `Lives in fixture neighborhood ${index + 1} in a stable home.`,
      dailyRole: `documented community role ${index + 1}`,
      relationshipStatus: `married to ${partner}`,
      household: `shared household with ${partner}`,
      relevantFamily: `spouse ${partner}; additional family outside the recurring cast`,
      background: `Fixture person ${index + 1} has a specific personal history, daily responsibilities, community commitments, and continuing plans.`,
      interests: `reading, hiking, and fixture interest ${index + 1}`,
      personality: "patient, observant, and practical",
      castRelationships: [{ targetCastId: partner, type: "spouse" }],
      recurringContexts: `home routines, daily role ${index + 1}, and community events`,
      continuityNotes: "Keep the established age, household, relationship, daily role, and personal commitments consistent."
    };
  });
  return {
    schemaVersion: 2,
    cast,
    deckPersonPool: [...canonicalCastIds],
    activeCast: { schemaVersion: 2, progression: [...canonicalCastIds] }
  };
}

export function chapterParticipantFixture(chapter, label = "Fixture1 Example") {
  return {
    schemaVersion: 1,
    chapter,
    canonicalCastIds: ["CAST-001"],
    unnamedFunctionalParticipants: [],
    primaryReadingParticipants: [{ participantId: "CAST-001", kind: "dialogue-speaker", label }],
    introductionParticipants: [{ participantId: "CAST-001", label }]
  };
}

export function dialogueChapterFixture(chapter, title, line, label = "Fixture1 Example") {
  return `# ${title}\n\n## Dialogue\n\n${label} is in the fixture setting.\n\n${label}: ${line}\n`;
}
