import type { DomainModule } from "../core";
import { runContinentReview } from "./continent-review";

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
  register(context) {
    context.cli.register({
      path: ["geography", "continents"],
      summary: "Six-continent terminal map review",
      run: async () => {
        await runContinentReview();
      }
    });
  }
};

export { getContinentDefinitions, renderContinentMap } from "./continent-renderer";
export { getContinentReviewCards, runContinentReview } from "./continent-review";
