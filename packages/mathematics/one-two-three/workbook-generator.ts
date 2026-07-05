import { objectFamilies } from "./object-catalog";
import {
  answerForQuantity,
  oneTwoThreeAnswerChoices,
  type OneTwoThreeExercise,
  type OneTwoThreeGenerationOptions,
  type OneTwoThreeQuantity,
  type OneTwoThreeVariation,
  type OneTwoThreeWorkbook
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
  ["#f06595", "#fcc2d7", "#a61e4d"]
] as const;

export function generateOneTwoThreeWorkbook(options: OneTwoThreeGenerationOptions = {}): OneTwoThreeWorkbook {
  const seed = normalizeSeed(options.seed ?? createDefaultSeed());
  const random = createSeededRandom(seed);
  const quantities = createBalancedQuantities(random);
  const pages = [];
  let previousFamily = "";

  for (let pageIndex = 0; pageIndex < 50; pageIndex += 1) {
    const pageQuantities = quantities.slice(pageIndex * 4, pageIndex * 4 + 4);
    const pageFamilies = choosePageFamilies(random, previousFamily);
    previousFamily = pageFamilies[pageFamilies.length - 1] ?? previousFamily;

    const exercises: OneTwoThreeExercise[] = pageQuantities.map((quantity, position) => ({
      id: `p${pageIndex + 1}-e${position + 1}`,
      pageIndex,
      position: position as 0 | 1 | 2 | 3,
      objectFamily: pageFamilies[position],
      quantity,
      correctAnswer: answerForQuantity(quantity),
      answerChoices: oneTwoThreeAnswerChoices,
      variation: createVariation(random)
    }));

    pages.push({ index: pageIndex, exercises });
  }

  return {
    title: "One, Two, Three",
    seed,
    pageCount: 50,
    exerciseCount: 200,
    pages
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

function createBalancedQuantities(random: SeededRandom): OneTwoThreeQuantity[] {
  const quantities: OneTwoThreeQuantity[] = [
    ...Array<OneTwoThreeQuantity>(67).fill(1),
    ...Array<OneTwoThreeQuantity>(67).fill(2),
    ...Array<OneTwoThreeQuantity>(66).fill(3)
  ];

  const shuffled = random.shuffle(quantities);
  enforcePageQuantityVariety(shuffled);
  return shuffled;
}

function enforcePageQuantityVariety(quantities: OneTwoThreeQuantity[]): void {
  for (let pageStart = 0; pageStart < quantities.length; pageStart += 4) {
    const page = quantities.slice(pageStart, pageStart + 4);
    if (new Set(page).size > 1) {
      continue;
    }

    const repeatedQuantity = page[0];
    const swapIndex = quantities.findIndex((quantity, index) => index > pageStart + 3 && quantity !== repeatedQuantity);
    if (swapIndex === -1) {
      throw new Error("Unable to create varied quantity pages.");
    }

    [quantities[pageStart + 3], quantities[swapIndex]] = [quantities[swapIndex], quantities[pageStart + 3]];
  }
}

function choosePageFamilies(random: SeededRandom, previousFamily: string): string[] {
  const families = random.shuffle(objectFamilies.map((family) => family.id));
  const withoutImmediateRepeat = previousFamily.length > 0 ? families.filter((family) => family !== previousFamily) : families;
  return withoutImmediateRepeat.slice(0, 4);
}

function createVariation(random: SeededRandom): OneTwoThreeVariation {
  const palette = random.pick(defaultPalette);

  return {
    color: palette[0],
    accentColor: palette[1],
    detailColor: palette[2],
    scale: 0.88 + random.next() * 0.14,
    rotation: -8 + random.next() * 16,
    variant: random.integer(0, 9999)
  };
}
