export const numberWords = {
  1: "one",
  2: "two",
  3: "three",
  4: "four",
  5: "five"
} as const;

export type CountingQuantity = keyof typeof numberWords;
export type NumberWord = (typeof numberWords)[CountingQuantity];

export const oneTwoThreeAnswerChoices = [numberWords[1], numberWords[2], numberWords[3]] as const;
export const fourFiveAnswerChoices = [numberWords[4], numberWords[5]] as const;
export const oneToFiveAnswerChoices = [numberWords[1], numberWords[2], numberWords[3], numberWords[4], numberWords[5]] as const;

export type OneTwoThreeQuantity = 1 | 2 | 3;
export type OneTwoThreeAnswer = (typeof oneTwoThreeAnswerChoices)[number];

export interface WorkbookContent {
  readonly introductionTitle: "Introduction";
  readonly introductionText: string;
  readonly volumeTitle: "Beginner Mathematics Volume 1";
  readonly unitLabels: readonly ["Unit 1", "Unit 2", "Unit 3"];
  readonly unitTitles: readonly ["One, Two, Three", "Four and Five", "One to Five"];
}

export const workbookContent: WorkbookContent = {
  introductionTitle: "Introduction",
  introductionText:
    "This is going to be a (way too) comprehensive curriculum on how to learn math, written by someone who suffered his whole life from math teachers. This curriculum presumes the student is at kindergarten level but has passive understanding of the written forms of the words one up to ten. This is not a classroom level replacement, games and other things should be included but won't be for now. This will be the more robotic way on learning math without too much ado.",
  volumeTitle: "Beginner Mathematics Volume 1",
  unitLabels: ["Unit 1", "Unit 2", "Unit 3"],
  unitTitles: ["One, Two, Three", "Four and Five", "One to Five"]
};

export interface CountingVariation {
  readonly color: string;
  readonly accentColor: string;
  readonly detailColor: string;
  readonly scale: number;
  readonly rotation: number;
  readonly variant: number;
  readonly layout: ObjectLayoutKind;
}

export type ObjectLayoutKind = "row" | "arc" | "two-row" | "cluster" | "symmetric";

export interface CountingUnitDefinition {
  readonly id: "one-two-three" | "four-five" | "one-to-five";
  readonly label: "Unit 1" | "Unit 2" | "Unit 3";
  readonly title: "One, Two, Three" | "Four and Five" | "One to Five";
  readonly exercisePageCount: number;
  readonly answerChoices: readonly NumberWord[];
  readonly quantities: readonly CountingQuantity[];
  readonly targetDistribution: Readonly<Record<CountingQuantity, number>>;
  readonly minimumDistinctQuantitiesPerPage: number;
}

export const oneTwoThreeUnitDefinition: CountingUnitDefinition = {
  id: "one-two-three",
  label: "Unit 1",
  title: "One, Two, Three",
  exercisePageCount: 50,
  answerChoices: oneTwoThreeAnswerChoices,
  quantities: [1, 2, 3],
  targetDistribution: { 1: 67, 2: 67, 3: 66, 4: 0, 5: 0 },
  minimumDistinctQuantitiesPerPage: 2
};

export const fourFiveUnitDefinition: CountingUnitDefinition = {
  id: "four-five",
  label: "Unit 2",
  title: "Four and Five",
  exercisePageCount: 30,
  answerChoices: fourFiveAnswerChoices,
  quantities: [4, 5],
  targetDistribution: { 1: 0, 2: 0, 3: 0, 4: 60, 5: 60 },
  minimumDistinctQuantitiesPerPage: 2
};

export const oneToFiveUnitDefinition: CountingUnitDefinition = {
  id: "one-to-five",
  label: "Unit 3",
  title: "One to Five",
  exercisePageCount: 50,
  answerChoices: oneToFiveAnswerChoices,
  quantities: [1, 2, 3, 4, 5],
  targetDistribution: { 1: 40, 2: 40, 3: 40, 4: 40, 5: 40 },
  minimumDistinctQuantitiesPerPage: 3
};

export const beginnerVolumeOneUnits = [
  oneTwoThreeUnitDefinition,
  fourFiveUnitDefinition,
  oneToFiveUnitDefinition
] as const;

export interface CountingExercise {
  readonly id: string;
  readonly unitId: CountingUnitDefinition["id"];
  readonly unitTitle: CountingUnitDefinition["title"];
  readonly pageIndex: number;
  readonly unitPageIndex: number;
  readonly exercisePageIndex: number;
  readonly position: 0 | 1 | 2 | 3;
  readonly objectFamily: string;
  readonly quantity: CountingQuantity;
  readonly correctAnswer: NumberWord;
  readonly answerChoices: readonly NumberWord[];
  readonly variation: CountingVariation;
}

export interface ExercisePage {
  readonly kind: "exercise";
  readonly index: number;
  readonly unitId: CountingUnitDefinition["id"];
  readonly unitTitle: CountingUnitDefinition["title"];
  readonly unitPageIndex: number;
  readonly exercisePageIndex: number;
  readonly exercises: readonly CountingExercise[];
}

export interface IntroductionPage {
  readonly kind: "introduction";
  readonly index: number;
  readonly title: "Introduction";
  readonly text: string;
}

export interface UnitTitlePage {
  readonly kind: "unit-title";
  readonly index: number;
  readonly unitId: CountingUnitDefinition["id"];
  readonly label: CountingUnitDefinition["label"];
  readonly title: CountingUnitDefinition["title"];
}

export type WorkbookPage = IntroductionPage | UnitTitlePage | ExercisePage;

export interface CountingUnit {
  readonly definition: CountingUnitDefinition;
  readonly titlePage: UnitTitlePage;
  readonly exercisePages: readonly ExercisePage[];
  readonly exerciseCount: number;
}

export interface BeginnerVolumeOneWorkbook {
  readonly kind: "volume";
  readonly title: "Beginner Mathematics Volume 1";
  readonly seed: number;
  readonly introductionPageCount: number;
  readonly unitTitlePageCount: number;
  readonly exercisePageCount: number;
  readonly exerciseCount: number;
  readonly pageCount: number;
  readonly pages: readonly WorkbookPage[];
  readonly units: readonly CountingUnit[];
}

export interface OneTwoThreeWorkbook {
  readonly kind: "unit";
  readonly title: "One, Two, Three";
  readonly seed: number;
  readonly pageCount: number;
  readonly exercisePageCount: number;
  readonly exerciseCount: number;
  readonly pages: readonly ExercisePage[];
  readonly unit: CountingUnit;
}

export interface WorkbookGenerationOptions {
  readonly seed?: number;
}

export type OneTwoThreeGenerationOptions = WorkbookGenerationOptions;
export type OneTwoThreeVariation = CountingVariation;
export type OneTwoThreeExercise = CountingExercise & {
  readonly quantity: OneTwoThreeQuantity;
  readonly correctAnswer: OneTwoThreeAnswer;
  readonly answerChoices: readonly OneTwoThreeAnswer[];
};
export type OneTwoThreePage = ExercisePage & {
  readonly exercises: readonly OneTwoThreeExercise[];
};

export function answerForQuantity(quantity: CountingQuantity): NumberWord {
  return numberWords[quantity];
}

export function isOneTwoThreeQuantity(value: number): value is OneTwoThreeQuantity {
  return value === 1 || value === 2 || value === 3;
}

export function isCountingQuantity(value: number): value is CountingQuantity {
  return value === 1 || value === 2 || value === 3 || value === 4 || value === 5;
}
