import { readFile, mkdir, open, unlink } from "node:fs/promises";
import { join } from "node:path";
import { emitKeypressEvents } from "node:readline";
import { isReviewDue, isReviewItemBuryEligible } from "../core/review-scheduler";
import { buryStoredReviewItem, loadReviewProgressStore, recordStoredReviewOutcome, resolveReviewProgressDirectory } from "../core/review-progress-store";
import { kittyArtworkSequences, kittyArtworkDeleteSequence } from "../../apps/cli/terminal-artwork";
import { japanRegionDecks, japanRegionalPrefectureSplitDirectory, type JapanRegionSlug } from "./japan-regions";

const continents = [
  { id: "north-america", number: 1, answer: "North America" },
  { id: "south-america", number: 2, answer: "South America" },
  { id: "africa", number: 3, answer: "Africa" },
  { id: "europe", number: 4, answer: "Europe" },
  { id: "asia", number: 5, answer: "Asia" },
  { id: "oceania", number: 6, answer: "Oceania" },
  { id: "antarctica", number: 7, answer: "Antarctica" }
] as const;
export const continentEasyCards = [
  ...continents.map(c => ({ ...c, id: `${c.id}-highlight`, prompt: "Which one is the highlighted continent?", explanation: `The highlighted continent is ${c.answer}.` }))
];
export const continentEasyAnswerKeys = ["1", "2", "3", "4"] as const;
export const continentEasyPackageId = "com.sleepymario.geography.continents-easy";
export const vietnamRegionDecks = [
  { slug: "north", label: "North", count: 15 },
  { slug: "central", label: "Central", count: 11 },
  { slug: "south", label: "South", count: 8 }
] as const;
export type VietnamRegionSlug = typeof vietnamRegionDecks[number]["slug"];
export const koreaRegionDecks = [
  { slug: "north", label: "North", count: 11 },
  { slug: "south", label: "South", count: 17 }
] as const;
export type KoreaRegionSlug = typeof koreaRegionDecks[number]["slug"];
export const countryDivisionDecks = [
  { dataset: "united-kingdom", label: "United Kingdom", directory: "united-kingdom-divisions", deck: "Constituent Countries", singular: "constituent country", count: 4, answerHint: "Type the constituent-country name", mapLayout: "side-by-side" },
  { dataset: "belgium-regions", label: "Belgium", directory: "belgium-regions", deck: "Regions", singular: "region", count: 3, answerHint: "Type the region name", mapLayout: "side-by-side" },
  { dataset: "belgium", label: "Belgium", directory: "belgium-provinces", deck: "Provinces and Brussels", singular: "province or Brussels", count: 11, answerHint: "Type the province name or Brussels", mapLayout: "top-down" },
  { dataset: "france", label: "France", directory: "france-divisions", deck: "Metropolitan Regions", singular: "region", count: 13, answerHint: "Type the region name; diacritics are optional", mapLayout: "side-by-side" },
  { dataset: "spain", label: "Spain", directory: "spain-divisions", deck: "Autonomous-level Divisions", singular: "autonomous-level division", count: 19, answerHint: "Type the division name; diacritics are optional", mapLayout: "side-by-side" },
  { dataset: "italy", label: "Italy", directory: "italy-regions", deck: "Regions", singular: "region", count: 20, answerHint: "Type the Italian region name", mapLayout: "side-by-side" },
  { dataset: "russian-federation", label: "Russia", directory: "russian-federation-divisions", deck: "Federal Subjects", scope: "All", singular: "federal subject", count: 89, answerHint: "Type the federal-subject name", mapLayout: "top-down" },
  { dataset: "russian-federal-districts", label: "Russia", directory: "russian-federal-districts", deck: "Federal Districts", scope: "Main Regions", singular: "federal district", count: 8, answerHint: "Type the federal-district name", mapLayout: "top-down" },
  { dataset: "china", label: "China", directory: "china-divisions", deck: "Provincial-level Divisions", singular: "provincial-level division", count: 33, answerHint: "Type the division name", mapLayout: "top-down" },
  { dataset: "china-taiwan", label: "China (Taiwan)", directory: "china-roc-divisions", deck: "First-level Divisions", singular: "first-level division", count: 22, answerHint: "Type the division name", mapLayout: "side-by-side" },
  { dataset: "india", label: "India", directory: "india-divisions", deck: "States and Union Territories", singular: "state or union territory", count: 36, answerHint: "Type the state or union-territory name; diacritics are optional", mapLayout: "side-by-side" },
  { dataset: "australia", label: "Australia", directory: "australia-divisions", deck: "States and Territories", singular: "state or territory", count: 8, answerHint: "Type the state or territory name", mapLayout: "side-by-side" },
  { dataset: "canada", label: "Canada", directory: "canada-divisions", deck: "Provinces and Territories", singular: "province or territory", count: 13, answerHint: "Type the province or territory name", mapLayout: "top-down" },
  { dataset: "ussr-former", label: "USSR (Former)", directory: "ussr-former-divisions", deck: "Union Republics", singular: "union republic", count: 15, answerHint: "Type the full union-republic name", mapLayout: "top-down" },
  { dataset: "united-states", label: "United States", directory: "united-states-divisions", deck: "States", singular: "state", count: 50, answerHint: "Type the state name", mapLayout: "top-down" },
  { dataset: "yugoslavia-former", label: "Yugoslavia (Former)", directory: "yugoslavia-former-divisions", deck: "Constituent Republics", singular: "constituent republic", count: 6, answerHint: "Type the constituent-republic name", mapLayout: "side-by-side" }
] as const;
export type CountryDivisionDataset = typeof countryDivisionDecks[number]["dataset"];
const now = (): string => new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
export function continentEasyIdentity(id: string) {
  return { packageId: continentEasyPackageId, packageVersion: "0.1.0", itemId: id };
}
export function shuffled<T>(values: readonly T[], random: () => number): T[] {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j]!, result[i]!];
  }
  return result;
}
export function continentEasyChoices(answer: string, random = Math.random): string[] {
  const pool = continents.map(c => String(c.answer));
  const others = shuffled(pool.filter(c => c !== answer), random).slice(0, 3);
  return shuffled([answer, ...others], random);
}

export function formatGeographySessionScore(correct: number, incorrect: number, total: number): string {
  const answered = correct + incorrect;
  const unanswered = Math.max(0, total - answered);
  if (answered === 0) {
    return [
      "Session ended before any questions were answered.",
      `0 correct, 0 incorrect${unanswered > 0 ? `, ${unanswered} unanswered` : ""}.`
    ].join("\n");
  }
  const percentage = Math.round((correct / answered) * 100);
  return [
    `You scored ${percentage}%.`,
    `${correct} correct, ${incorrect} incorrect${unanswered > 0 ? `, ${unanswered} unanswered` : ""}.`,
    ...(unanswered > 0 ? ["Session ended early."] : [])
  ].join("\n");
}

export function normalizePrefectureAnswer(value: string): string {
  const normalized = value.replace(/[Đđ]/g, "d").normalize("NFD").replace(/\p{M}/gu, "").trim().toLowerCase()
    .replace(/^(?:tinh|thanh pho|tp\.?)[ .-]+/, "").replace(/(?:[ .-]+(?:prefecture|province|city|ken|fu|to|do))$/, "")
    .replace(/[^a-z0-9]+/g, "");
  const aliases: Record<string, string> = { hokkaidou: "hokkaido", toukyou: "tokyo", toukyo: "tokyo", tokyou: "tokyo", kyouto: "kyoto", oosaka: "osaka", hyougo: "hyogo", kouchi: "kochi", ooita: "oita", ohita: "oita" };
  return aliases[normalized] ?? normalized;
}

export async function runContinentsEasy(options: { progressDir?: string; mode?: "easy" | "hard"; dataset?: "japan" | "japan-regions" | "vietnam" | "korea" | "netherlands" | "germany" | CountryDivisionDataset; region?: JapanRegionSlug; vietnamRegion?: VietnamRegionSlug; koreaRegion?: KoreaRegionSlug; nameScript?: "kanji" } = {}): Promise<void> {
  const kanji = options.nameScript === "kanji";
  const japan = options.dataset === "japan";
  const regions = options.dataset === "japan-regions";
  const vietnam = options.dataset === "vietnam";
  const korea = options.dataset === "korea";
  const netherlands = options.dataset === "netherlands";
  const germany = options.dataset === "germany";
  const countryDivision = countryDivisionDecks.find(deck => deck.dataset === options.dataset);
  const japanMap = japan || regions;
  const administrativeMap = japanMap || vietnam || korea || netherlands || germany || countryDivision !== undefined;
  const prefectureRegion = options.region === undefined ? undefined : japanRegionDecks.find(region => region.slug === options.region);
  const vietnamRegion = options.vietnamRegion === undefined ? undefined : vietnamRegionDecks.find(region => region.slug === options.vietnamRegion);
  const koreaRegion = options.koreaRegion === undefined ? undefined : koreaRegionDecks.find(region => region.slug === options.koreaRegion);
  const hard = options.mode === "hard";
  const title = prefectureRegion !== undefined
    ? kanji ? `都道府県 - ${prefectureRegion.japanese} - ${hard ? "上級" : "初級"}` : `Prefectures - ${prefectureRegion.label} - ${hard ? "Hard" : "Easy"}`
    : regions
    ? kanji ? `都道府県 - 地方 - ${hard ? "上級" : "初級"}` : `Prefectures - Regions - ${hard ? "Hard" : "Easy"}`
    : netherlands ? `Provinces - All - ${hard ? "Hard" : "Easy"}`
    : germany ? `States - All - ${hard ? "Hard" : "Easy"}`
    : countryDivision !== undefined ? `${"scope" in countryDivision ? countryDivision.scope : `${countryDivision.deck} - All`} - ${hard ? "Hard" : "Easy"}`
    : vietnam ? `Provincial-level Divisions - ${vietnamRegion?.label ?? "All"} - ${hard ? "Hard" : "Easy"}`
    : korea ? `Provincial-level Divisions - ${koreaRegion?.label ?? "All"} - ${hard ? "Hard" : "Easy"}`
    : japan ? kanji ? `都道府県 - 全国 - ${hard ? "上級" : "初級"}` : (hard ? "Prefectures - All - Hard" : "Prefectures - All - Easy") : hard ? "Continents - Hard" : "Continents - Easy";
  const packageId = prefectureRegion !== undefined
    ? `com.sleepymario.${kanji ? "language.japanese" : "geography"}.japan-prefectures-${prefectureRegion.slug}-${hard ? "hard" : "easy"}`
    : regions
    ? `com.sleepymario.${kanji ? "language.japanese" : "geography"}.japan-regions-${hard ? "hard" : "easy"}`
    : vietnam ? `com.sleepymario.geography.vietnam-provincial-divisions-${vietnamRegion === undefined ? "" : `${vietnamRegion.slug}-`}${hard ? "hard" : "easy"}`
    : korea ? `com.sleepymario.geography.korea-provincial-divisions-${koreaRegion === undefined ? "" : `${koreaRegion.slug}-`}${hard ? "hard" : "easy"}`
    : netherlands ? `com.sleepymario.geography.netherlands-provinces-${hard ? "hard" : "easy"}`
    : germany ? `com.sleepymario.geography.germany-states-${hard ? "hard" : "easy"}`
    : countryDivision !== undefined ? `com.sleepymario.geography.${countryDivision.dataset}-divisions-${hard ? "hard" : "easy"}`
    : japan ? `com.sleepymario.${kanji ? "language.japanese" : "geography"}.japan-prefectures-${hard ? "hard" : "easy"}` : hard ? "com.sleepymario.geography.continents-hard" : continentEasyPackageId;
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error(`${title} needs an interactive Kitty terminal.`);
  }
  if (!(process.env.KITTY_WINDOW_ID || process.env.TERM?.includes("kitty"))) {
    throw new Error("Open this deck in Kitty to display the maps.");
  }
  const regionMetadata = prefectureRegion === undefined ? undefined
    : (JSON.parse(await readFile(join(__dirname, "data", "japan-regions", "regions.json"), "utf8")) as { id: string; answer: string; prefectures: string[] }[])
      .find(region => region.id === `${prefectureRegion.slug}-highlight`);
  let cards = regions
    ? (JSON.parse(await readFile(join(__dirname, "data", "japan-regions", "regions.json"), "utf8")) as { id: string; answer: string }[])
      .map(c => {
        const answer = kanji ? japanRegionDecks.find(region => `${region.slug}-highlight` === c.id)!.japanese : c.answer;
        return { ...c, answer, prompt: kanji ? "色が付いている地方はどこですか。" : "Which region is highlighted?", explanation: kanji ? `色が付いている地方は${answer}です。` : `The highlighted region is ${answer}.` };
      })
    : vietnam
      ? (JSON.parse(await readFile(join(__dirname, "data", "vietnam-provinces", ...(vietnamRegion === undefined ? [] : ["regions", vietnamRegion.slug]), "provinces.json"), "utf8")) as { id: string; answer: string; kind: string }[])
        .map(c => ({ ...c, prompt: "Which provincial-level division is highlighted?", explanation: `The highlighted division is ${c.answer}.` }))
    : korea
      ? (JSON.parse(await readFile(join(__dirname, "data", "korea-provinces", ...(koreaRegion === undefined ? [] : ["regions", koreaRegion.slug]), "provinces.json"), "utf8")) as { id: string; answer: string; kind: string }[])
        .map(c => ({ ...c, prompt: "Which provincial-level division is highlighted?", explanation: `The highlighted division is ${c.answer}.` }))
    : netherlands
      ? (JSON.parse(await readFile(join(__dirname, "data", "netherlands-provinces", "provinces.json"), "utf8")) as { id: string; answer: string; kind: string }[])
        .map(c => ({ ...c, prompt: "Which province is highlighted?", explanation: `The highlighted province is ${c.answer}.` }))
    : germany
      ? (JSON.parse(await readFile(join(__dirname, "data", "germany-states", "states.json"), "utf8")) as { id: string; answer: string; kind: string }[])
        .map(c => ({ ...c, prompt: "Which state is highlighted?", explanation: `The highlighted state is ${c.answer}.` }))
    : countryDivision !== undefined
      ? (JSON.parse(await readFile(join(__dirname, "data", countryDivision.directory, "divisions.json"), "utf8")) as { id: string; answer: string; kind: string }[])
        .map(c => ({ ...c, prompt: `Which ${countryDivision.singular} is highlighted?`, explanation: `The highlighted ${countryDivision.singular} is ${c.answer}.` }))
    : japan
      ? (JSON.parse(await readFile(join(__dirname, "data", "japan-hard", "prefectures.json"), "utf8")) as { id: string; answer: string; japanese: string }[])
        .filter(card => regionMetadata === undefined || regionMetadata.prefectures.includes(card.answer))
      .map(c => ({ ...c, answer: kanji ? c.japanese : c.answer, prompt: kanji ? "色が付いている都道府県はどこですか。" : "Which prefecture is highlighted?", explanation: kanji ? `色が付いている都道府県は${c.japanese}です。` : `The highlighted prefecture is ${c.answer} (${c.japanese}).` }))
    : hard ? continentEasyCards : [...continentEasyCards, ...continents.map(c => ({
      id: `${c.id}-locate`, answer: String(c.number), prompt: `Which number marks ${c.answer}?`,
      explanation: `${c.answer} is number ${c.number}.`
    }))];
  const namePool = cards.map(c => c.answer);
  if (administrativeMap && !hard) cards = [...cards, ...cards.map((c, i) => ({
    id: c.id.replace(/-highlight$/, "-locate"), answer: String(i + 1),
    prompt: kanji ? `${c.answer}は何番ですか。` : `Which number marks ${c.answer}?`, explanation: kanji ? `${c.answer}は${i + 1}番です。` : `${c.answer} is number ${i + 1}.`
  }))];
  const progressDir = options.progressDir ?? join(resolveReviewProgressDirectory(), "wandering-the-world");
  await mkdir(progressDir, { recursive: true });
  const lockPath = join(progressDir, prefectureRegion !== undefined
    ? `${kanji ? "japanese" : "japan"}-prefectures-${prefectureRegion.slug}-${hard ? "hard" : "easy"}.lock`
    : regions
    ? `${kanji ? "japanese" : "japan"}-regions-${hard ? "hard" : "easy"}.lock`
    : vietnam ? `vietnam-provincial-divisions-${vietnamRegion === undefined ? "" : `${vietnamRegion.slug}-`}${hard ? "hard" : "easy"}.lock`
    : korea ? `korea-provincial-divisions-${koreaRegion === undefined ? "" : `${koreaRegion.slug}-`}${hard ? "hard" : "easy"}.lock`
    : netherlands ? `netherlands-provinces-${hard ? "hard" : "easy"}.lock`
    : germany ? `germany-states-${hard ? "hard" : "easy"}.lock`
    : countryDivision !== undefined ? `${countryDivision.dataset}-divisions-${hard ? "hard" : "easy"}.lock`
    : japan ? `japan-prefectures-${kanji ? "kanji-" : ""}${hard ? "hard" : "easy"}.lock` : hard ? "continents-hard.lock" : "continents-easy.lock");
  let lock;
  try { lock = await open(lockPath, "wx"); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") throw new Error(`${title} is already open. Close the other session first.`);
    throw error;
  }
  const wasRaw = process.stdin.isRaw;
  let pending: ((key: string) => void) | undefined;
  let ended = false;
  const quit = () => { ended = true; pending?.("q"); pending = undefined; };
  let typing = false;
  let numericEntry = false;
  let typedAnswer = "";
  const onKey = (text: string, key: { name?: string; ctrl?: boolean }) => {
    if ((key.ctrl && key.name === "c") || key.name === "escape" || (!typing && text === "q")) { quit(); return; }
    if (typing) {
      if (key.name === "return") {
        const maximumMapNumber = administrativeMap ? namePool.length : 7;
        if (!typedAnswer.trim() || (numericEntry && (!/^\d{1,2}$/.test(typedAnswer) || Number(typedAnswer) < 1 || Number(typedAnswer) > maximumMapNumber)) || (process.stdout.rows || 40) < 20 || (process.stdout.columns || 100) < 55) return;
        typing = false;
        const resolve = pending; pending = undefined; resolve?.(typedAnswer); return;
      }
      if (key.name === "backspace") typedAnswer = typedAnswer.slice(0, -1);
      else if (!key.ctrl && text && (numericEntry ? /^\d+$/.test(text) && typedAnswer.length + text.length <= 2 : /^[\p{L}\p{M} -]+$/u.test(text))) typedAnswer += text;
      currentDraw?.(); return;
    }
    if (pending) { const resolve = pending; pending = undefined; resolve(key.name === "return" ? "enter" : text === "B" ? "B" : (text ?? "").toLowerCase()); }
  };
  const readKey = async (allowed: readonly string[]): Promise<string> => {
    while (!ended) {
      const key = await new Promise<string>(resolve => { pending = resolve; });
      if (allowed.includes(key) || key === "q") return key;
    }
    return "q";
  };
  let currentDraw: (() => void) | undefined;
  const onResize = () => currentDraw?.();
  let correct = 0, wrong = 0;
  try {
    emitKeypressEvents(process.stdin);
    process.stdin.setRawMode(true); process.stdin.resume();
    process.stdin.on("keypress", onKey); process.stdin.on("end", quit);
    process.on("SIGTERM", quit); process.on("SIGINT", quit);
    process.stdout.on("resize", onResize);
    const sessionTime = now();
    const store = await loadReviewProgressStore(progressDir);
    const statesByItemId = new Map(store.items.filter(state => state.packageId === packageId).map(state => [state.itemId, state]));
    const dueCards = cards.filter(card => {
      const state = statesByItemId.get(card.id);
      return !state || isReviewDue(state, sessionTime);
    });
    const queue = shuffled(dueCards, Math.random);
    for (const card of queue) {
      if (ended) break;
      const directNumber = !hard && card.id.endsWith("-locate");
      const choicePool = namePool.filter(name => name !== card.answer);
      const choices = hard || directNumber ? [] : administrativeMap ? shuffled([card.answer, ...shuffled(choicePool, Math.random).slice(0, 3)], Math.random) : continentEasyChoices(card.answer);
      const textEntry = hard || (administrativeMap && directNumber);
      const answerKeys = directNumber
        ? ["1", "2", "3", "4", "5", "6", "7"]
        : continentEasyAnswerKeys.slice(0, choices.length);
      const instruction = kanji && directNumber ? `地図の番号（1〜${namePool.length}）を入力して、Enterキーを押してください。Escapeキーでメニューに戻ります。`
        : kanji && hard ? `${regions ? "地方名" : "都道府県名"}を日本語で入力して、Enterキーを押してください。Escapeキーでメニューに戻ります。`
        : prefectureRegion !== undefined && directNumber ? `Enter the map number (1–${namePool.length}) and press Enter. Escape returns to the menu.`
        : regions && directNumber ? "Enter the map number (1–8) and press Enter. Escape returns to the menu."
        : japan && directNumber ? "Enter the map number (1–47) and press Enter. Escape returns to the menu."
        : vietnam && directNumber ? `Enter the map number (1–${namePool.length}) and press Enter. Escape returns to the menu.`
        : korea && directNumber ? `Enter the map number (1–${namePool.length}) and press Enter. Escape returns to the menu.`
        : netherlands && directNumber ? "Enter the map number (1–12) and press Enter. Escape returns to the menu."
        : germany && directNumber ? "Enter the map number (1–16) and press Enter. Escape returns to the menu."
        : countryDivision !== undefined && directNumber ? `Enter the map number (1–${namePool.length}) and press Enter. Escape returns to the menu.`
        : regions && hard ? (kanji ? "Type the region name in Japanese and press Enter. Escape returns to the menu." : "Type the romanized region name and press Enter. Escape returns to the menu.")
        : japan && hard ? (kanji ? "Type the prefecture name in kanji and press Enter. Escape returns to the menu." : "Type the romanized prefecture name and press Enter. Escape returns to the menu.")
        : vietnam && hard ? "Type the Vietnamese name; diacritics are optional. Press Enter to answer. Escape returns to the menu."
        : korea && hard ? "Type the romanized division name and press Enter. Escape returns to the menu."
        : netherlands && hard ? "Type the Dutch province name and press Enter. Diacritics are optional. Escape returns to the menu."
        : germany && hard ? "Type the German state name and press Enter. Umlauts are optional. Escape returns to the menu."
        : countryDivision !== undefined && hard ? `${countryDivision.answerHint} and press Enter. Escape returns to the menu.`
        : hard ? "Type the continent name and press Enter. Escape returns to the menu." : directNumber ? "Press the map number (1–7) to answer." : "Press 1–4 to answer.";
      const stem = card.id.replace(/-highlight$/, "");
      const regionalPrefectureAsset = prefectureRegion === undefined ? undefined : join("japan-regions", "prefecture-decks", `${prefectureRegion.slug}`);
      const regionalPrefectureSplit = prefectureRegion === undefined ? undefined : japanRegionalPrefectureSplitDirectory(prefectureRegion.slug, kanji);
      const vietnamAssetRoot = join("vietnam-provinces", ...(vietnamRegion === undefined ? [] : ["regions", vietnamRegion.slug]));
      const vietnamNumberedAsset = join(vietnamAssetRoot, vietnamRegion === undefined ? "vietnam-provinces-numbered.png" : "provinces-numbered.png");
      const vietnamNamedAsset = join(vietnamAssetRoot, vietnamRegion === undefined ? "vietnam-provinces-named.png" : "provinces-named.png");
      const koreaAssetRoot = join("korea-provinces", ...(koreaRegion === undefined ? [] : ["regions", koreaRegion.slug]));
      const koreaNumberedAsset = join(koreaAssetRoot, koreaRegion === undefined ? "korea-provinces-numbered.png" : "provinces-numbered.png");
      const koreaNamedAsset = join(koreaAssetRoot, koreaRegion === undefined ? "korea-provinces-named.png" : "provinces-named.png");
      const questionPng = await readFile(directNumber
        ? join(__dirname, "data", regionalPrefectureAsset !== undefined ? `${regionalPrefectureAsset}-numbered${kanji ? "-kanji" : ""}.png` : regions ? `japan-regions/japan-regions-numbered${kanji ? "-kanji" : ""}.png` : japan ? `japan-hard/japan-prefectures-numbered${kanji ? "-kanji" : ""}.png` : vietnam ? vietnamNumberedAsset : korea ? koreaNumberedAsset : netherlands ? "netherlands-provinces/netherlands-provinces-numbered.png" : germany ? "germany-states/germany-states-numbered.png" : countryDivision !== undefined ? `${countryDivision.directory}/divisions-numbered.png` : "world-seven-continents-numbered.png")
        : join(__dirname, "data", regionalPrefectureSplit ?? (regions ? "japan-regions" : japan ? (kanji ? "japan-hard/split-kanji" : "japan-hard/split") : vietnam ? join(vietnamAssetRoot, "split") : korea ? join(koreaAssetRoot, "split") : netherlands ? "netherlands-provinces/split" : germany ? "germany-states/split" : countryDivision !== undefined ? `${countryDivision.directory}/split` : "paired"), `${stem}-question${regions && kanji ? "-kanji" : ""}.png`));
      const answerPng = await readFile(directNumber
        ? join(__dirname, "data", regionalPrefectureAsset !== undefined ? `${regionalPrefectureAsset}-${kanji ? "kanji" : "named"}.png` : regions ? `japan-regions/japan-regions-${kanji ? "kanji" : "named"}.png` : japan ? (kanji ? "japan-hard/japan-prefectures-kanji.png" : "japan-hard/japan-prefectures-named.png") : vietnam ? vietnamNamedAsset : korea ? koreaNamedAsset : netherlands ? "netherlands-provinces/netherlands-provinces-named.png" : germany ? "germany-states/germany-states-named.png" : countryDivision !== undefined ? `${countryDivision.directory}/divisions-named.png` : "world-seven-continents.png")
        : join(__dirname, "data", regionalPrefectureSplit ?? (regions ? "japan-regions" : japan ? (kanji ? "japan-hard/split-kanji" : "japan-hard/split") : vietnam ? join(vietnamAssetRoot, "split") : korea ? join(koreaAssetRoot, "split") : netherlands ? "netherlands-provinces/split" : germany ? "germany-states/split" : countryDivision !== undefined ? `${countryDivision.directory}/split` : "paired"), `${stem}-${regions && kanji ? "answer-kanji" : "answer"}.png`));
      const referencePng = administrativeMap && !directNumber
        ? await readFile(regionalPrefectureAsset !== undefined
          ? join(__dirname, "data", `${regionalPrefectureAsset}-reference.png`)
          : join(__dirname, "data", regions ? "japan-regions" : japan ? (kanji ? "japan-hard/split-kanji" : "japan-hard/split") : vietnam ? join(vietnamAssetRoot, "split") : korea ? join(koreaAssetRoot, "split") : netherlands ? "netherlands-provinces/split" : germany ? "germany-states/split" : `${countryDivision!.directory}/split`, regions && kanji ? "reference-kanji.png" : "reference.png"))
        : undefined;
      let feedback = "";
      const draw = () => {
        const rows = process.stdout.rows || 40, columns = process.stdout.columns || 100;
        process.stdout.write(kittyArtworkDeleteSequence() + kittyArtworkDeleteSequence(19394562) + `\x1b[2J\x1b[H${title}\n`);
        if (rows < 20 || columns < 55) {
          process.stdout.write("Please enlarge the terminal to at least 55 columns and 20 rows.\n");
          return;
        }
        if (administrativeMap) {
          const regionalLayout = prefectureRegion?.mapLayout ?? countryDivision?.mapLayout;
          const leftWidth = Math.floor(columns / 2) - 2;
          const rightStart = Math.floor(columns / 2) + 2;
          const rightWidth = columns - rightStart;
          const fit = (png: Uint8Array, maxWidth: number, maxHeight: number) => {
            const bytes = Buffer.from(png);
            const cellRatio = bytes.readUInt32BE(20) / bytes.readUInt32BE(16) / 2;
            const heightRows = Math.max(1, Math.min(maxHeight, Math.floor(maxWidth * cellRatio)));
            return { widthColumns: Math.max(1, Math.min(maxWidth, Math.floor(heightRows / cellRatio))), heightRows };
          };
          const rightPng = feedback ? answerPng : questionPng;
          if (regionalLayout === "top-down" && !directNumber) {
            const paneGap = 2;
            const paneWidth = Math.floor((columns - paneGap - 2) / 2);
            const mapHeight = Math.max(5, rows - 10);
            const referenceSize = fit(referencePng!, paneWidth, mapHeight);
            const activeSize = fit(rightPng, paneWidth, mapHeight);
            const referenceColumn = 1 + Math.floor((paneWidth - referenceSize.widthColumns) / 2);
            const activePaneStart = paneWidth + paneGap + 1;
            const activeColumn = activePaneStart + Math.floor((paneWidth - activeSize.widthColumns) / 2);
            process.stdout.write(`\x1b[2;${referenceColumn}H`);
            for (const sequence of kittyArtworkSequences({ pngData: referencePng!, rectangle: { column: referenceColumn, row: 2, ...referenceSize } })) process.stdout.write(sequence);
            process.stdout.write(`\x1b[2;${activeColumn}H`);
            for (const sequence of kittyArtworkSequences({ pngData: rightPng, imageId: 19394562, rectangle: { column: activeColumn, row: 2, ...activeSize } })) process.stdout.write(sequence);
            let textRow = Math.max(referenceSize.heightRows, activeSize.heightRows) + 3;
            const lines = [card.prompt, ...(textEntry ? [`Answer: ${typedAnswer}`] : choices.map((choice, i) => `${i + 1}. ${choice}`)), feedback || instruction];
            for (const line of lines) {
              if (textRow < rows) process.stdout.write(`\x1b[${textRow++};1H${line.slice(0, columns - 1)}\n`);
            }
            return;
          }
          if (regionalLayout === "top-down" && directNumber) {
            const mapRow = 2;
            const mapSize = fit(rightPng, columns - 2, Math.max(5, rows - 10));
            const mapColumn = 1 + Math.floor((columns - 2 - mapSize.widthColumns) / 2);
            process.stdout.write(`\x1b[${mapRow};${mapColumn}H`);
            for (const sequence of kittyArtworkSequences({ pngData: rightPng, imageId: 19394562, rectangle: { column: mapColumn, row: mapRow, ...mapSize } })) process.stdout.write(sequence);
            let textRow = mapRow + mapSize.heightRows + 1;
            for (const line of [card.prompt, `Answer: ${typedAnswer}`, feedback || instruction]) {
              if (textRow < rows) process.stdout.write(`\x1b[${textRow++};1H${line.slice(0, columns - 1)}\n`);
            }
            return;
          }
          const rightSize = fit(rightPng, rightWidth, rows - 1);
          process.stdout.write(`\x1b[1;${rightStart + Math.floor((rightWidth - rightSize.widthColumns) / 2)}H`);
          for (const sequence of kittyArtworkSequences({ pngData: rightPng, imageId: 19394562, rectangle: { column: rightStart, row: 1, ...rightSize } })) process.stdout.write(sequence);
          let textRow = 4;
          if (!directNumber) {
            const leftPng = referencePng!;
            const leftSize = fit(leftPng, leftWidth, Math.max(3, rows - 14));
            process.stdout.write("\x1b[3;1H");
            for (const sequence of kittyArtworkSequences({ pngData: leftPng, rectangle: { column: 1, row: 3, ...leftSize } })) process.stdout.write(sequence);
            textRow = leftSize.heightRows + 4;
          }
          const lines = [card.prompt, "", ...(textEntry ? [`Answer: ${typedAnswer}`] : choices.map((choice, i) => `${i + 1}. ${choice}`)), "", feedback || instruction];
          // Wrap all controls inside the left pane without scrolling the reference.
          for (const line of lines) {
            const words = line.split(" "); let part = "";
            for (const word of words) {
              if (part && part.length + word.length + 1 > leftWidth) {
                if (textRow < rows) process.stdout.write(`\x1b[${textRow++};1H${part}\n`);
                part = word;
              } else part += (part ? " " : "") + word;
            }
            if (textRow < rows) process.stdout.write(`\x1b[${textRow++};1H${part}\n`);
          }
          return;
        }
        const cellRatio = directNumber ? (japan ? .5 : .3) : japan ? 12 / 36 : 8 / 44;
        const height = Math.max(6, Math.min(rows - 13, Math.floor((columns - 2) * cellRatio)));
        const width = Math.min(columns - 2, Math.floor(height / cellRatio));
        process.stdout.write("\x1b[3;1H");
        for (const sequence of kittyArtworkSequences({ pngData: feedback ? answerPng : questionPng, rectangle: { column: 1, row: 3, widthColumns: width, heightRows: height } })) process.stdout.write(sequence);
        process.stdout.write(`\x1b[${height + 4};1H${card.prompt}\n\n`);
        if (textEntry) process.stdout.write(`Answer: ${typedAnswer}\n`);
        choices.forEach((choice, i) => process.stdout.write(`${continentEasyAnswerKeys[i]!.toUpperCase()}. ${choice}\n`));
        process.stdout.write(`\n${feedback || `${instruction}${textEntry ? "" : " Q or Escape returns to the menu."}`}\n`);
      };
      typedAnswer = "";
      typing = textEntry;
      numericEntry = administrativeMap && directNumber;
      currentDraw = draw; draw();
      let key: string;
      do { key = textEntry ? await new Promise<string>(resolve => { pending = resolve; }) : await readKey(answerKeys); }
      while (key !== "q" && ((process.stdout.rows || 40) < 20 || (process.stdout.columns || 100) < 55));
      if (ended || (!hard && key === "q")) break;
      const selected = numericEntry ? String(Number(key)) : hard || directNumber ? key : choices[continentEasyAnswerKeys.indexOf(key as typeof continentEasyAnswerKeys[number])];
      const right = kanji && !directNumber ? selected?.normalize("NFKC").trim().replace(/[都府県]$/, "") === card.answer.replace(/[都府県]$/, "") : administrativeMap ? normalizePrefectureAnswer(selected ?? "") === normalizePrefectureAnswer(card.answer) : selected?.trim().replace(/\s+/g, " ").toLowerCase() === card.answer.toLowerCase();
      if (right) correct++; else wrong++;
      const currentState = statesByItemId.get(card.id);
      const buryEligible = currentState !== undefined && isReviewItemBuryEligible(currentState);
      const color = process.env.NO_COLOR === undefined ? (right ? "\x1b[32m" : "\x1b[31m") : "";
      feedback = `${color}${right ? "Correct!" : `Wrong. ${card.explanation}`}${color ? "\x1b[0m" : ""}  Enter / Space: next${buryEligible ? "   B Bury permanently" : ""}`;
      draw();
      const action = await readKey(buryEligible ? ["enter", " ", "B"] : ["enter", " "]);
      if (action === "q") break;
      if (action === "B") {
        await buryStoredReviewItem({ ...continentEasyIdentity(card.id), packageId, progressDir, buriedAt: now() });
      } else {
        await recordStoredReviewOutcome({ ...continentEasyIdentity(card.id), packageId, progressDir, reviewedAt: now(), rating: right ? "good" : "again" });
      }
    }
    currentDraw = undefined;
    process.stdout.write(kittyArtworkDeleteSequence() + kittyArtworkDeleteSequence(19394562) + `\x1b[2J\x1b[H${title}\n\n`);
    if (queue.length > 0) {
      process.stdout.write(`${formatGeographySessionScore(correct, wrong, queue.length)}\nIncorrect answers are due again after 10 minutes.\n`);
    } else {
      process.stdout.write("No cards are due for review right now.\n");
    }
    if (!ended) {
      process.stdout.write("\nPress Enter or Space to return.\n");
      await readKey(["enter", " "]);
    }
  } finally {
    process.stdout.off("resize", onResize);
    process.stdin.off("keypress", onKey); process.stdin.off("end", quit);
    process.off("SIGTERM", quit); process.off("SIGINT", quit);
    process.stdin.setRawMode(wasRaw); process.stdin.pause();
    process.stdout.write(kittyArtworkDeleteSequence() + kittyArtworkDeleteSequence(19394562));
    await lock.close(); await unlink(lockPath);
  }
}
