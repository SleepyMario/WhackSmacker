export const strengthenedCanonicalCastSchemaVersion = 2;
export const canonicalCastRecordCount = 30;
export const canonicalGenderValues = ["female", "male", "nonbinary"] as const;

export type CanonicalGender = typeof canonicalGenderValues[number];

export type CanonicalRelationshipType =
  | "parent" | "child" | "sibling" | "spouse" | "partner"
  | "grandparent" | "grandchild" | "other-family"
  | "friend" | "neighbour" | "colleague" | "classmate"
  | "teacher" | "student" | "supervisor" | "employee"
  | "mentor" | "mentee" | "housemate" | "acquaintance"
  | "professional-contact" | "service-provider" | "customer"
  | "supplier" | "client" | "volunteer-colleague" | "other";

export interface CanonicalCastRelationshipV2 {
  readonly targetCastId: string;
  readonly type: CanonicalRelationshipType;
  readonly description?: string;
}

export interface CanonicalPersonV2 {
  readonly id: string;
  readonly displayName: string;
  readonly traditionalDisplayName?: string;
  readonly simplifiedDisplayName?: string;
  readonly age: number;
  readonly gender: CanonicalGender;
  readonly origin: string;
  readonly residence: string;
  readonly dailyRole: string;
  readonly relationshipStatus: string;
  readonly household: string;
  readonly relevantFamily: string;
  readonly background: string;
  readonly interests: string;
  readonly personality: string;
  readonly castRelationships: readonly CanonicalCastRelationshipV2[];
  readonly recurringContexts: string;
  readonly continuityNotes: string;
}

export interface CanonicalCastV2 {
  readonly schemaVersion: 2;
  readonly cast: readonly CanonicalPersonV2[];
  readonly deckPersonPool: readonly string[];
  readonly activeCast: {
    readonly schemaVersion: 2;
    readonly progression: readonly string[];
  };
}

export interface CanonicalCastValidationContext {
  readonly sourceFile: string;
}

export interface CanonicalCastValidationResult {
  readonly schemaVersion: number | null;
  readonly legacy: boolean;
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
}

const profileStringFields = [
  "displayName", "origin", "residence", "dailyRole", "relationshipStatus",
  "household", "relevantFamily", "background", "interests", "personality",
  "recurringContexts", "continuityNotes"
] as const;
const documentKeys = new Set(["schemaVersion", "cast", "deckPersonPool", "activeCast"]);
const activeCastKeys = new Set(["schemaVersion", "progression"]);
const personKeys = new Set([
  "id", "displayName", "traditionalDisplayName", "simplifiedDisplayName",
  "age", "gender", "origin", "residence", "dailyRole", "relationshipStatus",
  "household", "relevantFamily", "background", "interests", "personality",
  "castRelationships", "recurringContexts", "continuityNotes"
]);
const relationshipKeys = new Set(["targetCastId", "type", "description"]);

const relationshipTypes = new Set<CanonicalRelationshipType>([
  "parent", "child", "sibling", "spouse", "partner", "grandparent",
  "grandchild", "other-family", "friend", "neighbour", "colleague",
  "classmate", "teacher", "student", "supervisor", "employee", "mentor",
  "mentee", "housemate", "acquaintance", "professional-contact",
  "service-provider", "customer", "supplier", "client", "volunteer-colleague",
  "other"
]);

const reciprocalType = new Map<CanonicalRelationshipType, CanonicalRelationshipType>([
  ["parent", "child"], ["child", "parent"], ["sibling", "sibling"],
  ["spouse", "spouse"], ["partner", "partner"], ["grandparent", "grandchild"],
  ["grandchild", "grandparent"], ["other-family", "other-family"],
  ["friend", "friend"], ["neighbour", "neighbour"], ["colleague", "colleague"],
  ["classmate", "classmate"], ["teacher", "student"], ["student", "teacher"],
  ["supervisor", "employee"], ["employee", "supervisor"], ["mentor", "mentee"],
  ["mentee", "mentor"], ["housemate", "housemate"],
  ["acquaintance", "acquaintance"], ["professional-contact", "professional-contact"],
  ["service-provider", "customer"], ["customer", "service-provider"],
  ["supplier", "client"], ["client", "supplier"],
  ["volunteer-colleague", "volunteer-colleague"], ["other", "other"]
]);

const placeholder = /^(?:todo|tbd|unknown|unspecified|placeholder|null|n\/a|none)$/iu;
const placeholderFragment = /\b(?:lorem ipsum|generated person|generic filler)\b/iu;
const genericBiography = /\bis established in the curriculum as\b/iu;
const genericRoleName = /^(?:the\s+)?(?:baker|shopkeeper|clerk|waiter|cashier|receptionist|driver|doctor|nurse|teacher|newsreader|police officer|ticket seller|店員|점원|vendeur)$/iu;

export function validateCanonicalCast(value: unknown, context: CanonicalCastValidationContext): CanonicalCastValidationResult {
  if (!isRecord(value)) {
    return { schemaVersion: null, legacy: false, errors: [`${context.sourceFile}: canonical cast must be an object`], warnings: [] };
  }
  const version = typeof value.schemaVersion === "number" ? value.schemaVersion : null;
  if (value.schemaVersion === 1) {
    return {
      schemaVersion: 1,
      legacy: false,
      errors: [
        `${context.sourceFile}: schemaVersion 1 is a historical diagnostic format only; strengthened schemaVersion 2 is required`,
        ...validateLegacyShape(value, context.sourceFile)
      ],
      warnings: []
    };
  }
  if (value.schemaVersion !== 2) {
    return {
      schemaVersion: version,
      legacy: false,
      errors: [`${context.sourceFile}: canonical cast schemaVersion must be 2; current invalid value ${formatValue(value.schemaVersion)}`],
      warnings: []
    };
  }
  return { schemaVersion: 2, legacy: false, errors: validateV2(value, context.sourceFile), warnings: [] };
}

export function assertValidCanonicalCastV2(value: unknown, context: CanonicalCastValidationContext): asserts value is CanonicalCastV2 {
  const result = validateCanonicalCast(value, context);
  if (result.errors.length > 0) throw new Error(result.errors.join("\n"));
  if (result.legacy) throw new Error(`${context.sourceFile}: schema v1 compatibility does not satisfy the strengthened canonical-cast contract`);
}

function validateLegacyShape(value: Record<string, unknown>, sourceFile: string): string[] {
  const errors: string[] = [];
  const cast = value.cast;
  if (!Array.isArray(cast) || cast.length !== canonicalCastRecordCount) {
    errors.push(`${sourceFile}: legacy cast must still contain exactly 30 people`);
    return errors;
  }
  const ids = cast.flatMap(person => isRecord(person) && typeof person.id === "string" ? [person.id] : []);
  validatePermutation(value.deckPersonPool, ids, `${sourceFile}: deckPersonPool`, errors);
  const activeCast = value.activeCast;
  validatePermutation(isRecord(activeCast) ? activeCast.progression : undefined, ids, `${sourceFile}: activeCast.progression`, errors);
  if (!isRecord(activeCast) || activeCast.schemaVersion !== 1) {
    errors.push(`${sourceFile}: legacy activeCast.schemaVersion must be 1`);
  } else {
    const migration = activeCast.legacyMigration;
    if (!isRecord(migration)) {
      errors.push(`${sourceFile}: named legacy compatibility requires activeCast.legacyMigration with explicit status and note`);
    } else {
      if (typeof migration.status !== "string" || !/^(?:pending|complete-through-chapter-[1-9]\d*)$/u.test(migration.status)) {
        errors.push(`${sourceFile}: named legacy compatibility status must be pending or complete-through-chapter-N`);
      }
      if (typeof migration.note !== "string" || migration.note.trim() === "") {
        errors.push(`${sourceFile}: named legacy compatibility requires a substantive activeCast.legacyMigration.note`);
      }
    }
  }
  return errors;
}

function validateV2(value: Record<string, unknown>, sourceFile: string): string[] {
  const errors: string[] = [];
  validateOnlyKeys(value, documentKeys, sourceFile, errors);
  const cast = value.cast;
  if (!Array.isArray(cast) || cast.length !== canonicalCastRecordCount) {
    return [`${sourceFile}: canonical cast must contain exactly 30 people; current invalid value ${Array.isArray(cast) ? cast.length : formatValue(cast)}`];
  }
  if (!isRecord(value.activeCast) || value.activeCast.schemaVersion !== 2) {
    errors.push(`${sourceFile}: activeCast.schemaVersion must be 2`);
  } else {
    validateOnlyKeys(value.activeCast, activeCastKeys, `${sourceFile}: activeCast`, errors);
  }
  const people = new Map<string, Record<string, unknown>>();
  const names = new Set<string>();
  const semanticIdentities = new Map<string, string>();
  for (const [index, person] of cast.entries()) {
    if (!isRecord(person)) {
      errors.push(`${sourceFile}: cast[${index}] must be an object`);
      continue;
    }
    const id = typeof person.id === "string" ? person.id : `<index-${index}>`;
    const name = typeof person.displayName === "string" ? person.displayName : "<name unavailable>";
    validateOnlyKeys(person, personKeys, `${sourceFile}: cast[${index}]`, errors);
    if (typeof person.id !== "string" || !/^CAST-\d{3}$/u.test(person.id)) {
      errors.push(personError(sourceFile, id, name, "id", person.id, "must match CAST- followed by exactly three digits"));
    } else if (people.has(person.id)) {
      errors.push(personError(sourceFile, id, name, "id", person.id, "must be unique"));
    } else {
      people.set(person.id, person);
    }
    for (const field of profileStringFields) {
      const fieldValue = person[field];
      if (typeof fieldValue !== "string" || fieldValue.trim() === "" || placeholder.test(fieldValue.trim()) || placeholderFragment.test(fieldValue)) {
        errors.push(personError(sourceFile, id, name, field, fieldValue, "must be substantive non-placeholder text"));
      }
    }
    if (typeof person.displayName === "string") {
      const normalized = normalize(person.displayName);
      if (genericRoleName.test(person.displayName.trim())) errors.push(personError(sourceFile, id, name, "displayName", person.displayName, "must not be a generic functional-role label"));
      const hasScriptPair = typeof person.traditionalDisplayName === "string" || typeof person.simplifiedDisplayName === "string";
      if (!hasScriptPair && !hasCanonicalFullNameShape(person.displayName)) {
        errors.push(personError(sourceFile, id, name, "displayName", person.displayName, "non-Mandarin canonical full name must contain at least two name components"));
      }
      if (names.has(normalized)) errors.push(personError(sourceFile, id, name, "displayName", person.displayName, "must be unique"));
      names.add(normalized);
    }
    if ((person.traditionalDisplayName === undefined) !== (person.simplifiedDisplayName === undefined)) {
      errors.push(personError(sourceFile, id, name, "traditionalDisplayName/simplifiedDisplayName", {
        traditionalDisplayName: person.traditionalDisplayName,
        simplifiedDisplayName: person.simplifiedDisplayName
      }, "Mandarin script forms must be declared together"));
    }
    if (!Number.isInteger(person.age) || (person.age as number) < 0 || (person.age as number) > 120) {
      errors.push(personError(sourceFile, id, name, "age", person.age, "must be a plausible integer from 0 through 120"));
    }
    if (!canonicalGenderValues.includes(person.gender as CanonicalGender)) {
      errors.push(personError(sourceFile, id, name, "gender", person.gender, "must be female, male, or nonbinary"));
    }
    if (typeof person.background === "string" && (person.background.trim().split(/\s+/u).length < 12 || genericBiography.test(person.background))) {
      errors.push(personError(sourceFile, id, name, "background", person.background, "must be a specific biography of at least 12 words"));
    }
    for (const field of ["interests", "personality"] as const) {
      const fieldValue = person[field];
      if (typeof fieldValue === "string" && fieldValue.trim().split(/[,;、，؛]|\band\b|และ|고/iu).filter(part => part.trim() !== "").length < 2) {
        errors.push(personError(sourceFile, id, name, field, fieldValue, `must identify at least two substantive ${field === "interests" ? "interests or hobbies" : "traits"}`));
      }
    }
    if (Number.isInteger(person.age) && typeof person.dailyRole === "string") {
      if ((person.age as number) < 14 && !/(?:\b(?:student|pupil|schoolchild|child|learner)\b|छात्र|छात्रा|विद्यार्थी|小学生|학생|นักเรียน|учени|alumn)/iu.test(person.dailyRole)) {
        errors.push(personError(sourceFile, id, name, "dailyRole", person.dailyRole, "a person under 14 must have an age-appropriate child or student daily role"));
      } else if ((person.age as number) < 18 && !/(?:\b(?:student|pupil|school|learner|apprentice|trainee)\b|छात्र|छात्रा|विद्यार्थी|中学生|高校生|学生|학생|นักเรียน|школь|учени|estudiante|alumn)/iu.test(person.dailyRole)) {
        errors.push(personError(sourceFile, id, name, "dailyRole", person.dailyRole, "a person under 18 must have an age-appropriate educational or supervised training role"));
      }
    }
    if (!Array.isArray(person.castRelationships) || person.castRelationships.length === 0) {
      errors.push(personError(sourceFile, id, name, "castRelationships", person.castRelationships, "must contain structured stable-ID relationships"));
    }
    const semanticIdentity = fingerprintSemanticIdentity(person);
    const duplicateIdentity = semanticIdentities.get(semanticIdentity);
    if (duplicateIdentity !== undefined) {
      errors.push(personError(sourceFile, id, name, "semantic identity", semanticIdentity, `duplicates the substantive semantic identity of ${duplicateIdentity}`));
    } else {
      semanticIdentities.set(semanticIdentity, id);
    }
  }
  const ids = [...people.keys()];
  validatePermutation(value.deckPersonPool, ids, `${sourceFile}: deckPersonPool`, errors);
  validatePermutation(isRecord(value.activeCast) ? value.activeCast.progression : undefined, ids, `${sourceFile}: activeCast.progression`, errors);
  validateRelationshipGraph(people, sourceFile, errors);
  return errors;
}

function hasCanonicalFullNameShape(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.split(/\s+/u).length >= 2) return true;
  return /^[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]{2,}$/u.test(trimmed)
    || /^\p{Script=Hangul}{2,}$/u.test(trimmed);
}

function validateRelationshipGraph(people: ReadonlyMap<string, Record<string, unknown>>, sourceFile: string, errors: string[]): void {
  for (const [id, person] of people) {
    const name = typeof person.displayName === "string" ? person.displayName : "<name unavailable>";
    const relationships = Array.isArray(person.castRelationships) ? person.castRelationships : [];
    const seen = new Set<string>();
    const partnerships = new Set<string>();
    for (const [index, candidate] of relationships.entries()) {
      if (!isRecord(candidate)) {
        errors.push(personError(sourceFile, id, name, `castRelationships[${index}]`, candidate, "must be an object"));
        continue;
      }
      validateOnlyKeys(candidate, relationshipKeys, `${sourceFile}: ${id}.castRelationships[${index}]`, errors);
      const targetId = candidate.targetCastId;
      const type = candidate.type;
      if (typeof targetId !== "string" || !/^CAST-\d{3}$/u.test(targetId)) {
        errors.push(personError(sourceFile, id, name, `castRelationships[${index}].targetCastId`, targetId, "must resolve to a canonical CAST-* ID and never to a functional participant"));
        continue;
      }
      if (targetId === id) errors.push(personError(sourceFile, id, name, `castRelationships[${index}]`, candidate, "self-relations are prohibited"));
      if (!people.has(targetId)) errors.push(personError(sourceFile, id, name, `castRelationships[${index}].targetCastId`, targetId, "must resolve inside the canonical cast"));
      if (typeof type !== "string" || !relationshipTypes.has(type as CanonicalRelationshipType)) {
        errors.push(personError(sourceFile, id, name, `castRelationships[${index}].type`, type, "must use a controlled relationship type"));
        continue;
      }
      if (type === "other" && (typeof candidate.description !== "string" || candidate.description.trim().length < 3)) {
        errors.push(personError(sourceFile, id, name, `castRelationships[${index}].description`, candidate.description, "other relationships require a substantive description"));
      }
      const key = `${targetId}\u0000${type}`;
      if (seen.has(key)) errors.push(personError(sourceFile, id, name, `castRelationships[${index}]`, candidate, "duplicate equivalent relationship is prohibited"));
      seen.add(key);
      if (type === "spouse" || type === "partner") partnerships.add(`${type}:${targetId}`);
      const target = people.get(targetId);
      const expected = reciprocalType.get(type as CanonicalRelationshipType);
      if (target !== undefined && expected !== undefined) {
        const targetRelationships = Array.isArray(target.castRelationships) ? target.castRelationships : [];
        const reciprocal = targetRelationships.some(item =>
          isRecord(item) && item.targetCastId === id && item.type === expected
        );
        if (!reciprocal) errors.push(personError(sourceFile, id, name, `castRelationships[${index}]`, candidate, `requires reciprocal ${expected} from ${targetId}`));
        if ((type === "parent" || type === "grandparent") && Number.isInteger(person.age) && Number.isInteger(target.age)) {
          const gap = type === "parent" ? 12 : 25;
          if ((person.age as number) - (target.age as number) < gap) {
            errors.push(personError(sourceFile, id, name, `castRelationships[${index}]`, candidate, `${type} chronology requires an age gap of at least ${gap} years`));
          }
        }
      }
    }
    const partnershipTargets = new Set([...partnerships].map(entry => entry.split(":")[1]));
    const partnershipTypes = new Set([...partnerships].map(entry => entry.split(":")[0]));
    if (partnershipTargets.size > 1 || partnershipTypes.size > 1) {
      errors.push(personError(sourceFile, id, name, "castRelationships", relationships, "contradictory spouse/partner relationships are prohibited"));
    }
  }
}

function validatePermutation(value: unknown, ids: readonly string[], field: string, errors: string[]): void {
  if (!Array.isArray(value) || value.length !== canonicalCastRecordCount) {
    errors.push(`${field} must contain exactly 30 IDs`);
    return;
  }
  const canonical = new Set(ids);
  const seen = new Set<string>();
  for (const id of value) {
    if (typeof id !== "string" || !canonical.has(id)) errors.push(`${field} references unknown cast ID ${formatValue(id)}`);
    else if (seen.has(id)) errors.push(`${field} contains duplicate cast ID ${id}`);
    else seen.add(id);
  }
  for (const id of canonical) if (!seen.has(id)) errors.push(`${field} omits cast ID ${id}`);
}

function personError(sourceFile: string, id: string, name: string, field: string, value: unknown, rule: string): string {
  return `${sourceFile}: cast ID ${id}; canonical full name ${name}; field ${field}; current invalid value ${formatValue(value)}; violated rule: ${rule}`;
}

function normalize(value: string): string {
  return value.normalize("NFKC").replace(/\s+/gu, " ").trim().toLocaleLowerCase();
}

function fingerprintSemanticIdentity(person: Record<string, unknown>): string {
  const excluded = new Set(["id", "displayName", "traditionalDisplayName", "simplifiedDisplayName"]);
  return JSON.stringify(Object.fromEntries(
    Object.entries(person)
      .filter(([key]) => !excluded.has(key))
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) => [key, normalizeIdentityValue(value)])
  ));
}

function normalizeIdentityValue(value: unknown): unknown {
  if (typeof value === "string") return normalize(value);
  if (Array.isArray(value)) return value.map(normalizeIdentityValue);
  if (isRecord(value)) {
    return Object.fromEntries(Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => [key, normalizeIdentityValue(child)]));
  }
  return value;
}

function formatValue(value: unknown): string {
  if (value === undefined) return "<missing>";
  const serialized = JSON.stringify(value);
  if (serialized === undefined) return String(value);
  return serialized.length > 200 ? `${serialized.slice(0, 197)}...` : serialized;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateOnlyKeys(value: Record<string, unknown>, allowed: ReadonlySet<string>, where: string, errors: string[]): void {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) errors.push(`${where}: unsupported schema field ${key}`);
  }
}
