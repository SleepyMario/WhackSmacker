import type { Bounds } from "./object-catalog";
import type { OneTwoThreeExercise, OneTwoThreePage, OneTwoThreeWorkbook } from "./workbook-model";

export const a4Portrait = {
  width: 595.28,
  height: 841.89
} as const;

export interface ExerciseLayout {
  readonly exercise: OneTwoThreeExercise;
  readonly bounds: Bounds;
  readonly illustrationBounds: Bounds;
  readonly choicesBounds: Bounds;
}

export interface PageLayout {
  readonly page: OneTwoThreePage;
  readonly width: number;
  readonly height: number;
  readonly margin: number;
  readonly exercises: readonly ExerciseLayout[];
}

export function createWorkbookPageLayouts(workbook: OneTwoThreeWorkbook): PageLayout[] {
  return workbook.pages.map((page) => createPageLayout(page));
}

export function createPageLayout(page: OneTwoThreePage): PageLayout {
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
    const illustrationBounds = {
      x: bounds.x + innerPadding,
      y: bounds.y + innerPadding,
      width: bounds.width - innerPadding * 2,
      height: bounds.height * 0.56
    };
    const choicesBounds = {
      x: bounds.x + innerPadding + 8,
      y: bounds.y + bounds.height * 0.64,
      width: bounds.width - innerPadding * 2,
      height: bounds.height * 0.27
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
