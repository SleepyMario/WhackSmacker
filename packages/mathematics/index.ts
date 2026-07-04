import type { DomainModule } from "../core";

export interface MathematicsTopic {
  readonly id: string;
  readonly displayName: string;
}

export interface MathematicsQuiz {
  readonly id: string;
  readonly prompt: string;
}

export const mathematicsModule: DomainModule = {
  id: "mathematics",
  displayName: "Mathematics",
  providerFeatures: [],
  register() {
    // No user-facing commands are exposed until mathematics workflows exist.
  }
};
