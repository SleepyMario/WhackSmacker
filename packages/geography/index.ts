import type { DomainModule } from "../core";
import { countryDivisionDecks, koreaRegionDecks, runContinentsEasy, vietnamRegionDecks } from "./continents-easy";
import { runContinentReview } from "./continent-review";
import { japanRegionDecks } from "./japan-regions";
import { runJapanPrefectureCapitals } from "./japan-prefecture-capitals";
import { runKoreaProvinceCapitals } from "./korea-province-capitals";

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
    context.cli.register({
      path: ["geography", "japan-prefecture-capitals-vocabulary"],
      summary: "Japan prefectural capitals vocabulary in both directions",
      run: async () => { await runJapanPrefectureCapitals({ mode: "vocabulary" }); }
    });
    context.cli.register({
      path: ["geography", "japan-prefecture-capitals-map-easy"],
      summary: "Identify Japanese prefectural capitals from municipality maps with four choices",
      run: async () => { await runJapanPrefectureCapitals({ mode: "map-easy" }); }
    });
    context.cli.register({
      path: ["geography", "japan-prefecture-capitals-map-hard"],
      summary: "Identify Japanese prefectural capitals from municipality maps by typing the answer",
      run: async () => { await runJapanPrefectureCapitals({ mode: "map-hard" }); }
    });
    context.cli.register({
      path: ["geography", "japan-prefecture-capitals"],
      summary: "Legacy alias for Japan prefectural-capitals vocabulary",
      run: async () => { await runJapanPrefectureCapitals({ mode: "vocabulary" }); }
    });
    for (const mode of ["vocabulary", "map-easy", "map-hard"] as const) context.cli.register({
      path: ["geography", `korea-province-capitals-${mode}`],
      summary: `Korea province capitals (${mode})`,
      run: async () => { await runKoreaProvinceCapitals({ mode }); }
    });
    for (const mode of ["easy", "hard"] as const) context.cli.register({
      path: ["geography", `japanese-prefectures-${mode}`],
      summary: `Japanese prefectures in kanji (${mode})`,
      run: async () => { await runContinentsEasy({ dataset: "japan", mode, nameScript: "kanji" }); }
    });
    for (const region of japanRegionDecks) for (const mode of ["easy", "hard"] as const) context.cli.register({
      path: ["geography", `japan-prefectures-${region.slug}-${mode}`],
      summary: `${region.label} prefectures (${mode})`,
      run: async () => { await runContinentsEasy({ dataset: "japan", region: region.slug, mode }); }
    });
    for (const region of japanRegionDecks) for (const mode of ["easy", "hard"] as const) context.cli.register({
      path: ["geography", `japanese-prefectures-${region.slug}-${mode}`],
      summary: `${region.japanese} prefectures in Japanese (${mode})`,
      run: async () => { await runContinentsEasy({ dataset: "japan", region: region.slug, mode, nameScript: "kanji" }); }
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
    for (const mode of ["easy", "hard"] as const) context.cli.register({
      path: ["geography", `vietnam-provincial-divisions-${mode}`],
      summary: `Vietnam provincial-level divisions (${mode})`,
      run: async () => { await runContinentsEasy({ dataset: "vietnam", mode }); }
    });
    for (const region of vietnamRegionDecks) for (const mode of ["easy", "hard"] as const) context.cli.register({
      path: ["geography", `vietnam-provincial-divisions-${region.slug}-${mode}`],
      summary: `Vietnam ${region.label} provincial-level divisions (${mode})`,
      run: async () => { await runContinentsEasy({ dataset: "vietnam", vietnamRegion: region.slug, mode }); }
    });
    for (const mode of ["easy", "hard"] as const) context.cli.register({
      path: ["geography", `vietnamese-provincial-divisions-${mode}`],
      summary: `Vietnam provincial-level divisions in Vietnamese (${mode})`,
      run: async () => { await runContinentsEasy({ dataset: "vietnam", mode, nameScript: "vietnamese" }); }
    });
    for (const region of vietnamRegionDecks) for (const mode of ["easy", "hard"] as const) context.cli.register({
      path: ["geography", `vietnamese-provincial-divisions-${region.slug}-${mode}`],
      summary: `Vietnam ${region.label} provincial-level divisions in Vietnamese (${mode})`,
      run: async () => { await runContinentsEasy({ dataset: "vietnam", vietnamRegion: region.slug, mode, nameScript: "vietnamese" }); }
    });
    for (const mode of ["easy", "hard"] as const) context.cli.register({
      path: ["geography", `korea-provincial-divisions-${mode}`],
      summary: `Korea provincial-level divisions (${mode})`,
      run: async () => { await runContinentsEasy({ dataset: "korea", mode }); }
    });
    for (const region of koreaRegionDecks) for (const mode of ["easy", "hard"] as const) context.cli.register({
      path: ["geography", `korea-provincial-divisions-${region.slug}-${mode}`],
      summary: `Korea ${region.label} provincial-level divisions (${mode})`,
      run: async () => { await runContinentsEasy({ dataset: "korea", koreaRegion: region.slug, mode }); }
    });
    for (const mode of ["easy", "hard"] as const) context.cli.register({
      path: ["geography", `korean-provincial-divisions-${mode}`],
      summary: `Korea provincial-level divisions in Korean (${mode})`,
      run: async () => { await runContinentsEasy({ dataset: "korea", mode, nameScript: "hangul" }); }
    });
    for (const region of koreaRegionDecks) for (const mode of ["easy", "hard"] as const) context.cli.register({
      path: ["geography", `korean-provincial-divisions-${region.slug}-${mode}`],
      summary: `Korea ${region.label} provincial-level divisions in Korean (${mode})`,
      run: async () => { await runContinentsEasy({ dataset: "korea", koreaRegion: region.slug, mode, nameScript: "hangul" }); }
    });
    for (const mode of ["easy", "hard"] as const) context.cli.register({
      path: ["geography", `netherlands-provinces-${mode}`],
      summary: `Netherlands provinces (${mode})`,
      run: async () => { await runContinentsEasy({ dataset: "netherlands", mode }); }
    });
    for (const mode of ["easy", "hard"] as const) context.cli.register({
      path: ["geography", `germany-states-${mode}`],
      summary: `Germany states (${mode})`,
      run: async () => { await runContinentsEasy({ dataset: "germany", mode }); }
    });
    for (const country of countryDivisionDecks) for (const mode of ["easy", "hard"] as const) context.cli.register({
      path: ["geography", `${country.dataset}-divisions-${mode}`],
      summary: `${country.label} ${country.deck.toLowerCase()} (${mode})`,
      run: async () => { await runContinentsEasy({ dataset: country.dataset, mode }); }
    });
    for (const mode of ["easy", "hard"] as const) context.cli.register({
      path: ["geography", `japan-regions-${mode}`],
      summary: `Japan regions: highlighted maps with romanized ${mode === "easy" ? "choices and numbered-map questions" : "typed answers"}`,
      run: async () => { await runContinentsEasy({ dataset: "japan-regions", mode }); }
    });
    for (const mode of ["easy", "hard"] as const) context.cli.register({
      path: ["geography", `japanese-regions-${mode}`],
      summary: `Japan regions in Japanese (${mode})`,
      run: async () => { await runContinentsEasy({ dataset: "japan-regions", mode, nameScript: "kanji" }); }
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
