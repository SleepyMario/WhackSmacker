export const oneTwoThreeAnswerChoices = ["one", "two", "three"] as const;

export type OneTwoThreeQuantity = 1 | 2 | 3;
export type OneTwoThreeAnswer = (typeof oneTwoThreeAnswerChoices)[number];

export interface OneTwoThreeVariation {
  readonly color: string;
  readonly accentColor: string;
  readonly detailColor: string;
  readonly scale: number;
  readonly rotation: number;
  readonly variant: number;
}

export interface OneTwoThreeExercise {
  readonly id: string;
  readonly pageIndex: number;
  readonly position: 0 | 1 | 2 | 3;
  readonly objectFamily: string;
  readonly quantity: OneTwoThreeQuantity;
  readonly correctAnswer: OneTwoThreeAnswer;
  readonly answerChoices: readonly OneTwoThreeAnswer[];
  readonly variation: OneTwoThreeVariation;
}

export interface OneTwoThreePage {
  readonly index: number;
  readonly exercises: readonly OneTwoThreeExercise[];
}

export interface OneTwoThreeWorkbook {
  readonly title: "One, Two, Three";
  readonly seed: number;
  readonly pageCount: 50;
  readonly exerciseCount: 200;
  readonly pages: readonly OneTwoThreePage[];
}

export interface OneTwoThreeGenerationOptions {
  readonly seed?: number;
}

export function answerForQuantity(quantity: OneTwoThreeQuantity): OneTwoThreeAnswer {
  switch (quantity) {
    case 1:
      return "one";
    case 2:
      return "two";
    case 3:
      return "three";
  }
}

export function isOneTwoThreeQuantity(value: number): value is OneTwoThreeQuantity {
  return value === 1 || value === 2 || value === 3;
}
