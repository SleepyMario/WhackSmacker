import type { Bounds } from "./object-catalog";
import type {
  BeginnerVolumeOneWorkbook,
  CountingExercise,
  ExercisePage,
  OneTwoThreeWorkbook,
  WorkbookPage
} from "./workbook-model";

export const a4Portrait = {
  width: 595.28,
  height: 841.89
} as const;

export interface ExerciseLayout {
  readonly exercise: CountingExercise;
  readonly bounds: Bounds;
  readonly illustrationBounds: Bounds;
  readonly choicesBounds: Bounds;
}

export interface PageLayout {
  readonly page: ExercisePage;
  readonly width: number;
  readonly height: number;
  readonly margin: number;
  readonly exercises: readonly ExerciseLayout[];
}

export interface DocumentPageLayout {
  readonly page: WorkbookPage;
  readonly width: number;
  readonly height: number;
  readonly margin: number;
  readonly exercises: readonly ExerciseLayout[];
}

export function createWorkbookPageLayouts(workbook: OneTwoThreeWorkbook): PageLayout[] {
  return workbook.pages.filter((page): page is ExercisePage => page.kind === "exercise").map((page) => createPageLayout(page));
}

export function createDocumentPageLayouts(workbook: BeginnerVolumeOneWorkbook | OneTwoThreeWorkbook): DocumentPageLayout[] {
  const pages = workbook.kind === "volume" ? workbook.pages : workbook.pages;
  return pages.map((page) => createDocumentPageLayout(page));
}

export function createPageLayout(page: ExercisePage): PageLayout {
  return createExercisePageLayout(page);
}

export function createDocumentPageLayout(page: WorkbookPage): DocumentPageLayout {
  if (page.kind !== "exercise") {
    return {
      page,
      width: a4Portrait.width,
      height: a4Portrait.height,
      margin: 54,
      exercises: []
    };
  }

  return createExercisePageLayout(page);
}

function createExercisePageLayout(page: ExercisePage): PageLayout {
  const margin = 36;
  const gutter = 18;
  const titleHeight = 34;
  const contentTop = margin + titleHeight;
  const contentWidth = a4Portrait.width - margin * 2;
  const contentHeight = a4Portrait.height - contentTop - margin;
  const cellWidth = (contentWidth - gutter) / 2;
  const cellHeight = (contentHeight - gutter) / 2;

  const exercises = page.exercises.map((exercise) => {
    const column = exercise.position % 2;
    const row = Math.floor(exercise.position / 2);
    const bounds = {
      x: margin + column * (cellWidth + gutter),
      y: contentTop + row * (cellHeight + gutter),
      width: cellWidth,
      height: cellHeight
    };
    const innerPadding = 18;
    const choiceCount = exercise.answerChoices.length;
    const choicesHeight = choiceCount <= 3 ? bounds.height * 0.27 : bounds.height * 0.33;
    const illustrationHeight = choiceCount <= 3 ? bounds.height * 0.56 : bounds.height * 0.5;
    const illustrationBounds = {
      x: bounds.x + innerPadding,
      y: bounds.y + innerPadding,
      width: bounds.width - innerPadding * 2,
      height: illustrationHeight
    };
    const choicesBounds = {
      x: bounds.x + innerPadding + 8,
      y: bounds.y + bounds.height * (choiceCount <= 3 ? 0.64 : 0.59),
      width: bounds.width - innerPadding * 2,
      height: choicesHeight
    };

    return { exercise, bounds, illustrationBounds, choicesBounds };
  });

  return {
    page,
    width: a4Portrait.width,
    height: a4Portrait.height,
    margin,
    exercises
  };
}
