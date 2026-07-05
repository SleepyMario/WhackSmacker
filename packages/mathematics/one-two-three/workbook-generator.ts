import { objectFamilies } from "./object-catalog";
import {
  answerForQuantity,
  beginnerVolumeOneUnits,
  oneTwoThreeUnitDefinition,
  workbookContent,
  type BeginnerVolumeOneWorkbook,
  type CountingExercise,
  type CountingQuantity,
  type CountingUnit,
  type CountingUnitDefinition,
  type CountingVariation,
  type ExercisePage,
  type OneTwoThreeGenerationOptions,
  type OneTwoThreeWorkbook,
  type WorkbookGenerationOptions,
  type WorkbookPage
} from "./workbook-model";

const defaultPalette = [
  ["#e84d4f", "#6ab547", "#7f4f24"],
  ["#f59f00", "#ffd43b", "#2f9e44"],
  ["#339af0", "#74c0fc", "#1864ab"],
  ["#845ef7", "#b197fc", "#5f3dc4"],
  ["#20c997", "#96f2d7", "#087f5b"],
  ["#ff8787", "#ffc9c9", "#c92a2a"],
  ["#fab005", "#ffe066", "#e67700"],
  ["#51cf66", "#b2f2bb", "#2b8a3e"],
  ["#4dabf7", "#d0ebff", "#1971c2"],
  ["#f06595", "#fcc2d7", "#a61e4d"],
  ["#15aabf", "#99e9f2", "#0b7285"],
  ["#ff6b6b", "#ffd8a8", "#862e9c"]
] as const;

const layoutKinds = ["row", "arc", "two-row", "cluster", "symmetric"] as const;

export function generateOneTwoThreeWorkbook(options: OneTwoThreeGenerationOptions = {}): OneTwoThreeWorkbook {
  const seed = normalizeSeed(options.seed ?? createDefaultSeed());
  const random = createSeededRandom(seed);
  const pageCounter = { pageIndex: 0, exercisePageIndex: 0 };
  const unit = generateCountingUnit(oneTwoThreeUnitDefinition, random, pageCounter, { includeTitlePage: false });

  return {
    kind: "unit",
    title: "One, Two, Three",
    seed,
    pageCount: unit.exercisePages.length,
    exercisePageCount: unit.exercisePages.length,
    exerciseCount: unit.exerciseCount,
    pages: unit.exercisePages,
    unit
  };
}

export function generateBeginnerVolumeOneWorkbook(options: WorkbookGenerationOptions = {}): BeginnerVolumeOneWorkbook {
  const seed = normalizeSeed(options.seed ?? createDefaultSeed());
  const random = createSeededRandom(seed);
  const pages: WorkbookPage[] = [
    {
      kind: "introduction",
      index: 0,
      title: workbookContent.introductionTitle,
      text: workbookContent.introductionText
    }
  ];
  const pageCounter = { pageIndex: 1, exercisePageIndex: 0 };
  const units: CountingUnit[] = [];

  for (const definition of beginnerVolumeOneUnits) {
    const unit = generateCountingUnit(definition, random, pageCounter, { includeTitlePage: true });
    units.push(unit);
    pages.push(unit.titlePage, ...unit.exercisePages);
  }

  return {
    kind: "volume",
    title: workbookContent.volumeTitle,
    seed,
    introductionPageCount: 1,
    unitTitlePageCount: units.length,
    exercisePageCount: pages.filter((page) => page.kind === "exercise").length,
    exerciseCount: units.reduce((total, unit) => total + unit.exerciseCount, 0),
    pageCount: pages.length,
    pages,
    units
  };
}

export interface SeededRandom {
  next(): number;
  integer(minInclusive: number, maxInclusive: number): number;
  pick<T>(values: readonly T[]): T;
  shuffle<T>(values: readonly T[]): T[];
}

export function createSeededRandom(seed: number): SeededRandom {
  let state = normalizeSeed(seed);

  const next = (): number => {
    state += 0x6d2b79f5;
    let mixed = state;
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };

  return {
    next,
    integer(minInclusive, maxInclusive) {
      return Math.floor(next() * (maxInclusive - minInclusive + 1)) + minInclusive;
    },
    pick(values) {
      if (values.length === 0) {
        throw new Error("Cannot pick from an empty list.");
      }

      return values[Math.floor(next() * values.length)];
    },
    shuffle(values) {
      const shuffled = [...values];
      for (let index = shuffled.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(next() * (index + 1));
        [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
      }

      return shuffled;
    }
  };
}

export function normalizeSeed(seed: number): number {
  const normalized = Math.trunc(seed) >>> 0;
  return normalized === 0 ? 1 : normalized;
}

function createDefaultSeed(): number {
  return Math.floor(Date.now() % 2147483647) + 1;
}

function generateCountingUnit(
  definition: CountingUnitDefinition,
  random: SeededRandom,
  pageCounter: { pageIndex: number; exercisePageIndex: number },
  options: { includeTitlePage: boolean }
): CountingUnit {
  const titlePage = {
    kind: "unit-title" as const,
    index: options.includeTitlePage ? pageCounter.pageIndex : -1,
    unitId: definition.id,
    label: definition.label,
    title: definition.title
  };

  if (options.includeTitlePage) {
    pageCounter.pageIndex += 1;
  }

  const quantities = createUnitQuantities(definition, random);
  const pages: ExercisePage[] = [];
  let previousFamily = "";

  for (let unitPageIndex = 0; unitPageIndex < definition.exercisePageCount; unitPageIndex += 1) {
    const pageQuantities = quantities.slice(unitPageIndex * 4, unitPageIndex * 4 + 4);
    const pageFamilies = choosePageFamilies(random, previousFamily);
    previousFamily = pageFamilies[pageFamilies.length - 1] ?? previousFamily;
    const pageIndex = pageCounter.pageIndex;
    const exercisePageIndex = pageCounter.exercisePageIndex;

    const exercises: CountingExercise[] = pageQuantities.map((quantity, position) => ({
      id: `${definition.id}-p${unitPageIndex + 1}-e${position + 1}`,
      unitId: definition.id,
      unitTitle: definition.title,
      pageIndex,
      unitPageIndex,
      exercisePageIndex,
      position: position as 0 | 1 | 2 | 3,
      objectFamily: pageFamilies[position],
      quantity,
      correctAnswer: answerForQuantity(quantity),
      answerChoices: definition.answerChoices,
      variation: createVariation(random)
    }));

    pages.push({
      kind: "exercise",
      index: pageIndex,
      unitId: definition.id,
      unitTitle: definition.title,
      unitPageIndex,
      exercisePageIndex,
      exercises
    });
    pageCounter.pageIndex += 1;
    pageCounter.exercisePageIndex += 1;
  }

  return {
    definition,
    titlePage,
    exercisePages: pages,
    exerciseCount: pages.reduce((total, page) => total + page.exercises.length, 0)
  };
}

function createUnitQuantities(definition: CountingUnitDefinition, random: SeededRandom): CountingQuantity[] {
  if (definition.id === "four-five") {
    const pages = Array.from({ length: definition.exercisePageCount }, () => random.shuffle<CountingQuantity>([4, 4, 5, 5]));
    return random.shuffle(pages).flat();
  }

  if (definition.id === "one-to-five") {
    const templates: CountingQuantity[][] = [];
    for (let cycle = 0; cycle < 10; cycle += 1) {
      templates.push([2, 3, 4, 5], [1, 3, 4, 5], [1, 2, 4, 5], [1, 2, 3, 5], [1, 2, 3, 4]);
    }

    return random.shuffle(templates).flatMap((page) => random.shuffle(page));
  }

  const quantities: CountingQuantity[] = [];

  for (const quantity of definition.quantities) {
    quantities.push(...Array<CountingQuantity>(definition.targetDistribution[quantity]).fill(quantity));
  }

  for (let attempt = 0; attempt < 200; attempt += 1) {
    const shuffled = random.shuffle(quantities);
    if (pageQuantityConstraintsPass(shuffled, definition)) {
      return shuffled;
    }
  }

  throw new Error(`Unable to create varied quantity pages for ${definition.title}.`);
}

function pageQuantityConstraintsPass(quantities: readonly CountingQuantity[], definition: CountingUnitDefinition): boolean {
  for (let pageStart = 0; pageStart < quantities.length; pageStart += 4) {
    const page = quantities.slice(pageStart, pageStart + 4);
    if (new Set(page).size < definition.minimumDistinctQuantitiesPerPage) {
      return false;
    }
  }

  return true;
}

function choosePageFamilies(random: SeededRandom, previousFamily: string): string[] {
  const families = random.shuffle(objectFamilies.map((family) => family.id));
  const withoutImmediateRepeat = previousFamily.length > 0 ? families.filter((family) => family !== previousFamily) : families;
  return withoutImmediateRepeat.slice(0, 4);
}

function createVariation(random: SeededRandom): CountingVariation {
  const palette = random.pick(defaultPalette);

  return {
    color: palette[0],
    accentColor: palette[1],
    detailColor: palette[2],
    scale: 0.88 + random.next() * 0.12,
    rotation: -8 + random.next() * 16,
    variant: random.integer(0, 9999),
    layout: random.pick(layoutKinds)
  };
}
