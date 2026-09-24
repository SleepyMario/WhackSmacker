import type { DomainModule } from "../core";
import { runContinentsEasy } from "./continents-easy";
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
  displayName: "Wandering the World",
  providerFeatures: [],
  register(context) {
    for (const mode of ["easy", "hard"] as const) context.cli.register({
      path: ["geography", `japanese-prefectures-${mode}`],
      summary: `Japanese prefectures in kanji (${mode})`,
      run: async () => { await runContinentsEasy({ dataset: "japan", mode, nameScript: "kanji" }); }
    });
    context.cli.register({
      path: ["geography", "japan-prefectures-easy"],
      summary: "Japan prefectures: four choices and numbered-map questions",
      run: async () => { await runContinentsEasy({ dataset: "japan", mode: "easy" }); }
    });
    context.cli.register({
      path: ["geography", "japan-prefectures-hard"],
      summary: "Japan prefectures: highlighted maps with romanized typed answers",
      run: async () => { await runContinentsEasy({ dataset: "japan", mode: "hard" }); }
    });
    context.cli.register({
      path: ["geography", "continents-hard"],
      summary: "Continents - Hard: type the highlighted continent name",
      run: async () => { await runContinentsEasy({ mode: "hard" }); }
    });
    context.cli.register({
      path: ["geography", "continents-easy"],
      summary: "Continents - Easy: find the named continent on a numbered map",
      run: async () => { await runContinentsEasy(); }
    });
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
