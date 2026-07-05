export const numberWords = {
  1: "one",
  2: "two",
  3: "three",
  4: "four",
  5: "five",
  6: "six",
  7: "seven",
  8: "eight",
  9: "nine"
} as const;

export type CountingQuantity = keyof typeof numberWords;
export type NumberWord = (typeof numberWords)[CountingQuantity];

export const oneTwoThreeAnswerChoices = [numberWords[1], numberWords[2], numberWords[3]] as const;
export const fourFiveAnswerChoices = [numberWords[4], numberWords[5]] as const;
export const oneToFiveAnswerChoices = [numberWords[1], numberWords[2], numberWords[3], numberWords[4], numberWords[5]] as const;
export const sixToNineAnswerChoices = [numberWords[6], numberWords[7], numberWords[8], numberWords[9]] as const;

export type OneTwoThreeQuantity = 1 | 2 | 3;
export type OneTwoThreeAnswer = (typeof oneTwoThreeAnswerChoices)[number];

export interface WorkbookContent {
  readonly introductionTitle: "Introduction";
  readonly introductionText: string;
  readonly volumeTitle: "Beginner Mathematics Volume 1";
  readonly unitLabels: readonly ["Unit 1", "Unit 2", "Unit 3", "Unit 4"];
  readonly unitTitles: readonly ["One, Two, Three", "Four and Five", "One to Five", "Six, Seven, Eight, Nine"];
}

export const workbookContent: WorkbookContent = {
  introductionTitle: "Introduction",
  introductionText:
    "This is going to be a (way too) comprehensive curriculum on how to learn math, written by someone who suffered his whole life from math teachers. This curriculum presumes the student is at kindergarten level but has passive understanding of the written forms of the words one up to ten. This is not a classroom level replacement, games and other things should be included but won't be for now. This will be the more robotic way on learning math without too much ado.",
  volumeTitle: "Beginner Mathematics Volume 1",
  unitLabels: ["Unit 1", "Unit 2", "Unit 3", "Unit 4"],
  unitTitles: ["One, Two, Three", "Four and Five", "One to Five", "Six, Seven, Eight, Nine"]
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
  readonly id: "one-two-three" | "four-and-five" | "one-to-five" | "six-to-nine";
  readonly label: "Unit 1" | "Unit 2" | "Unit 3" | "Unit 4";
  readonly title: "One, Two, Three" | "Four and Five" | "One to Five" | "Six, Seven, Eight, Nine";
  readonly description: string;
  readonly curriculumId: "MATH-FOUNDATION-001" | "MATH-FOUNDATION-002" | "MATH-FOUNDATION-003" | "MATH-FOUNDATION-004";
  readonly curriculumRepository: "math-curriculum";
  readonly curriculumDocument:
    | "units/001-one-two-three.md"
    | "units/002-four-and-five.md"
    | "units/003-one-to-five.md"
    | "units/004-six-to-nine.md";
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
  description: "",
  curriculumId: "MATH-FOUNDATION-001",
  curriculumRepository: "math-curriculum",
  curriculumDocument: "units/001-one-two-three.md",
  exercisePageCount: 50,
  answerChoices: oneTwoThreeAnswerChoices,
  quantities: [1, 2, 3],
  targetDistribution: { 1: 67, 2: 67, 3: 66, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0 },
  minimumDistinctQuantitiesPerPage: 2
};

export const fourFiveUnitDefinition: CountingUnitDefinition = {
  id: "four-and-five",
  label: "Unit 2",
  title: "Four and Five",
  description: "",
  curriculumId: "MATH-FOUNDATION-002",
  curriculumRepository: "math-curriculum",
  curriculumDocument: "units/002-four-and-five.md",
  exercisePageCount: 30,
  answerChoices: fourFiveAnswerChoices,
  quantities: [4, 5],
  targetDistribution: { 1: 0, 2: 0, 3: 0, 4: 60, 5: 60, 6: 0, 7: 0, 8: 0, 9: 0 },
  minimumDistinctQuantitiesPerPage: 2
};

export const oneToFiveUnitDefinition: CountingUnitDefinition = {
  id: "one-to-five",
  label: "Unit 3",
  title: "One to Five",
  description: "",
  curriculumId: "MATH-FOUNDATION-003",
  curriculumRepository: "math-curriculum",
  curriculumDocument: "units/003-one-to-five.md",
  exercisePageCount: 50,
  answerChoices: oneToFiveAnswerChoices,
  quantities: [1, 2, 3, 4, 5],
  targetDistribution: { 1: 40, 2: 40, 3: 40, 4: 40, 5: 40, 6: 0, 7: 0, 8: 0, 9: 0 },
  minimumDistinctQuantitiesPerPage: 3
};

export const sixToNineUnitDefinition: CountingUnitDefinition = {
  id: "six-to-nine",
  label: "Unit 4",
  title: "Six, Seven, Eight, Nine",
  description: "",
  curriculumId: "MATH-FOUNDATION-004",
  curriculumRepository: "math-curriculum",
  curriculumDocument: "units/004-six-to-nine.md",
  exercisePageCount: 60,
  answerChoices: sixToNineAnswerChoices,
  quantities: [6, 7, 8, 9],
  targetDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 60, 7: 60, 8: 60, 9: 60 },
  minimumDistinctQuantitiesPerPage: 4
};

export const beginnerVolumeOneUnits = [
  oneTwoThreeUnitDefinition,
  fourFiveUnitDefinition,
  oneToFiveUnitDefinition,
  sixToNineUnitDefinition
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
  readonly kind: "unit-introduction";
  readonly index: number;
  readonly unitId: CountingUnitDefinition["id"];
  readonly label: CountingUnitDefinition["label"];
  readonly title: CountingUnitDefinition["title"];
  readonly description: string;
}

export type UnitIntroductionPage = UnitTitlePage;

export type WorkbookPage = IntroductionPage | UnitIntroductionPage | ExercisePage;

export interface CountingUnit {
  readonly definition: CountingUnitDefinition;
  readonly introductionPage: UnitIntroductionPage;
  readonly exercisePages: readonly ExercisePage[];
  readonly exerciseCount: number;
}

export interface BeginnerVolumeOneWorkbook {
  readonly kind: "volume";
  readonly title: "Beginner Mathematics Volume 1";
  readonly seed: number;
  readonly introductionPageCount: number;
  readonly unitIntroductionPageCount: number;
  readonly exercisePageCount: number;
  readonly exerciseCount: number;
  readonly pageCount: number;
  readonly pages: readonly WorkbookPage[];
  readonly units: readonly CountingUnit[];
}

export interface OneTwoThreeWorkbook {
  readonly kind: "unit";
  readonly title: CountingUnitDefinition["title"];
  readonly seed: number;
  readonly pageCount: number;
  readonly unitIntroductionPageCount: number;
  readonly exercisePageCount: number;
  readonly exerciseCount: number;
  readonly pages: readonly WorkbookPage[];
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
  return value === 1 || value === 2 || value === 3 || value === 4 || value === 5 || value === 6 || value === 7 || value === 8 || value === 9;
}
