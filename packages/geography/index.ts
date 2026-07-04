import type { DomainModule } from "../core";

export interface GeographyDataset {
  readonly id: string;
  readonly displayName: string;
}

export interface LocationReference {
  readonly id: string;
  readonly label: string;
}

export interface GeographyQuiz {
  readonly id: string;
  readonly prompt: string;
}

export const geographyModule: DomainModule = {
  id: "geography",
  displayName: "Geography",
  providerFeatures: [],
  register() {
    // No user-facing commands are exposed until geography workflows exist.
  }
};
