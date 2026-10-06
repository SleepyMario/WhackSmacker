import { mkdir, open, readFile, unlink } from "node:fs/promises";
import { join } from "node:path";
import { emitKeypressEvents } from "node:readline";
import { isReviewDeckManuallyFinished, isReviewDue, isReviewItemBuryEligible } from "../core/review-scheduler";
import { buryStoredReviewItem, loadReviewProgressStore, recordStoredReviewOutcome, resolveReviewProgressDirectory } from "../core/review-progress-store";
import { formatGeographySessionScore, normalizePrefectureAnswer, shuffled } from "./continents-easy";
import { kittyArtworkDeleteSequence, kittyArtworkSequences } from "../../apps/cli/terminal-artwork";

export const chinaProvinceCapitalsPackageId = "com.sleepymario.geography.china-province-capitals";
export const chinaProvinceCapitalsMapEasyPackageId = "com.sleepymario.geography.china-province-capitals-map-easy";
export const chinaProvinceCapitalsMapHardPackageId = "com.sleepymario.geography.china-province-capitals-map-hard";

export interface ChinaProvinceCapital {
  readonly id: string;
  readonly provinceEnglish: string;
  readonly provinceChinese: string;
  readonly capitalEnglish: string;
  readonly capitalChinese: string;
}

interface CapitalCard {
  readonly id: string;
  readonly prompt: string;
  readonly answer: string;
  readonly explanation: string;
  readonly answerPool: readonly string[];
}

interface CapitalMapCard extends CapitalCard {
  readonly artworkId: string;
}

const now = (): string => new Date().toISOString().replace(/\.\d{3}Z$/u, "Z");

export async function loadChinaProvinceCapitals(): Promise<readonly ChinaProvinceCapital[]> {
  return JSON.parse(await readFile(join(__dirname, "data", "china-province-capitals", "capitals.json"), "utf8")) as ChinaProvinceCapital[];
}

export function makeChinaProvinceCapitalCards(rows: readonly ChinaProvinceCapital[]): readonly CapitalCard[] {
  const provinces = rows.map(row => row.provinceEnglish);
  const capitals = rows.map(row => row.capitalEnglish);
  return rows.flatMap(row => [{
    id: `${row.id}-province-to-capital`,
    prompt: `What is the capital of ${row.provinceEnglish}?`,
    answer: row.capitalEnglish,
    explanation: `The capital of ${row.provinceEnglish} is ${row.capitalEnglish} (${row.capitalChinese}).`,
    answerPool: capitals
  }, {
    id: `${row.id}-capital-to-province`,
    prompt: `Which province has ${row.capitalEnglish} as its capital?`,
    answer: row.provinceEnglish,
    explanation: `${row.capitalEnglish} (${row.capitalChinese}) is the capital of ${row.provinceEnglish} (${row.provinceChinese}).`,
    answerPool: provinces
  }]);
}

export function makeChinaProvinceCapitalMapCards(rows: readonly ChinaProvinceCapital[]): readonly CapitalMapCard[] {
  const capitals = rows.map(row => row.capitalEnglish);
  return rows.map(row => ({
    id: `${row.id}-capital-map`,
    artworkId: row.id,
    prompt: `Which province capital or administrative seat is highlighted in ${row.provinceEnglish}?`,
    answer: row.capitalEnglish,
    explanation: `${row.capitalEnglish} (${row.capitalChinese}) is the highlighted administrative seat of ${row.provinceEnglish} (${row.provinceChinese}).`,
    answerPool: capitals
  }));
}

export async function runChinaProvinceCapitals(options: { progressDir?: string; mode?: "vocabulary" | "map-easy" | "map-hard" } = {}): Promise<void> {
  if (!process.stdin.isTTY || !process.stdout.isTTY) throw new Error("Province Capitals needs an interactive terminal.");
  const mode = options.mode ?? "vocabulary";
  const mapMode = mode !== "vocabulary";
  const hard = mode === "map-hard";
  const packageId = mode === "map-easy" ? chinaProvinceCapitalsMapEasyPackageId
    : mode === "map-hard" ? chinaProvinceCapitalsMapHardPackageId
    : chinaProvinceCapitalsPackageId;
  const deckTitle = mode === "map-easy" ? "Province Capitals - Map - Easy"
    : mode === "map-hard" ? "Province Capitals - Map - Hard"
    : "Province Capitals - Vocabulary";
  const progressDir = options.progressDir ?? join(resolveReviewProgressDirectory(), "wandering-the-world");
  await mkdir(progressDir, { recursive: true });
  const lockPath = join(progressDir, `china-province-capitals-${mode}.lock`);
  let lock;
  try { lock = await open(lockPath, "wx"); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") throw new Error("Province Capitals is already open. Close the other session first.");
    throw error;
  }

  const rows = await loadChinaProvinceCapitals();
  const cards = mapMode ? makeChinaProvinceCapitalMapCards(rows) : makeChinaProvinceCapitalCards(rows);
  const store = await loadReviewProgressStore(progressDir);
  const states = new Map(store.items.filter(state => state.packageId === packageId).map(state => [state.itemId, state]));
  const finished = isReviewDeckManuallyFinished(store.finishedDecks, { packageId, packageVersion: "0.1.0" });
  const sessionTime = now();
  const queue = finished ? [] : shuffled(cards.filter(card => {
    const state = states.get(card.id);
    return state === undefined || isReviewDue(state, sessionTime);
  }), Math.random);

  const wasRaw = process.stdin.isRaw;
  let pending: ((key: string) => void) | undefined;
  let stopped = false;
  const onKey = (text: string, key: { name?: string; ctrl?: boolean }) => {
    if ((key.ctrl && key.name === "c") || key.name === "escape" || text === "q") { stopped = true; pending?.("q"); pending = undefined; return; }
    if (pending !== undefined) {
      const resolve = pending; pending = undefined;
      resolve(key.name === "return" ? "enter" : key.name === "backspace" ? "backspace" : text === "B" ? "B" : text);
    }
  };
  const readKey = async (allowed?: readonly string[]): Promise<string> => {
    while (!stopped) {
      const value = await new Promise<string>(resolve => { pending = resolve; });
      if (allowed === undefined || allowed.includes(value) || value === "q") return value;
    }
    return "q";
  };

  let correct = 0, wrong = 0;
  try {
    emitKeypressEvents(process.stdin);
    process.stdin.setRawMode(true); process.stdin.resume(); process.stdin.on("keypress", onKey);
    for (const card of queue) {
      if (stopped) break;
      const choices = hard ? [] : shuffled([card.answer, ...shuffled(card.answerPool.filter(value => value !== card.answer), Math.random).slice(0, 3)], Math.random);
      const artwork = "artworkId" in card
        ? {
            question: await readFile(join(__dirname, "data", "china-province-capitals", "maps", `${card.artworkId}-question.png`)),
            answer: await readFile(join(__dirname, "data", "china-province-capitals", "maps", `${card.artworkId}-answer.png`))
          }
        : undefined;
      let typedAnswer = "";
      const draw = (feedback = "") => {
        process.stdout.write(kittyArtworkDeleteSequence() + `\x1b[2J\x1b[HWandering the World — China — ${deckTitle}\n`);
        let textRow = 3;
        if (artwork !== undefined) {
          const png = feedback ? artwork.answer : artwork.question;
          const bytes = Buffer.from(png);
          const columns = process.stdout.columns || 100, terminalRows = process.stdout.rows || 40;
          const pixelRatio = bytes.readUInt32BE(20) / bytes.readUInt32BE(16) / 2;
          const heightRows = Math.max(8, Math.min(terminalRows - 13, Math.floor((columns - 2) * pixelRatio)));
          const widthColumns = Math.max(20, Math.min(columns - 2, Math.floor(heightRows / pixelRatio)));
          const column = Math.max(1, Math.floor((columns - widthColumns) / 2));
          process.stdout.write(`\x1b[2;${column}H`);
          for (const sequence of kittyArtworkSequences({ pngData: png, rectangle: { column, row: 2, widthColumns, heightRows } })) process.stdout.write(sequence);
          textRow = heightRows + 3;
          process.stdout.write(`\x1b[${textRow};1H`);
        }
        process.stdout.write(`${card.prompt}\n\n`);
        if (hard) process.stdout.write(`Answer: ${typedAnswer}\n`);
        else choices.forEach((choice, index) => process.stdout.write(`${index + 1}. ${choice}\n`));
        process.stdout.write(`\n${feedback || (hard ? "Type the capital or administrative-seat name and press Enter. Q or Escape returns to the menu." : "Press 1–4 to answer. Q or Escape returns to the menu.")}\n`);
      };
      draw();
      let selectedAnswer = "";
      if (hard) {
        while (!stopped) {
          const key = await readKey();
          if (key === "q") break;
          if (key === "enter" && typedAnswer.trim()) { selectedAnswer = typedAnswer; break; }
          if (key === "backspace") typedAnswer = typedAnswer.slice(0, -1);
          else if (key.length === 1 && /[A-Za-z .'-]/u.test(key)) typedAnswer += key;
          draw();
        }
      } else {
        const key = await readKey(["1", "2", "3", "4"]);
        if (key !== "q") selectedAnswer = choices[Number(key) - 1] ?? "";
      }
      if (stopped || !selectedAnswer) break;
      const right = hard
        ? normalizePrefectureAnswer(selectedAnswer) === normalizePrefectureAnswer(card.answer)
        : selectedAnswer === card.answer;
      if (right) correct++; else wrong++;
      const state = states.get(card.id);
      const buryEligible = state !== undefined && isReviewItemBuryEligible(state);
      draw(`${right ? "Correct!" : `Wrong. ${card.explanation}`}\nEnter / Space: next${buryEligible ? "   B Bury permanently" : ""}`);
      const action = await readKey(buryEligible ? ["enter", " ", "B"] : ["enter", " "]);
      if (action === "q") break;
      const identity = { packageId, packageVersion: "0.1.0", itemId: card.id };
      if (action === "B") await buryStoredReviewItem({ ...identity, progressDir, buriedAt: now() });
      else await recordStoredReviewOutcome({ ...identity, progressDir, reviewedAt: now(), rating: right ? "good" : "again" });
    }
    process.stdout.write(kittyArtworkDeleteSequence() + `\x1b[2J\x1b[HWandering the World — China — ${deckTitle}\n\n`);
    process.stdout.write(queue.length > 0 ? `${formatGeographySessionScore(correct, wrong, queue.length)}\nIncorrect answers are due again after 10 minutes.\n` : "No cards are due for review right now.\n");
    if (!stopped) { process.stdout.write("\nPress Enter or Space to return.\n"); await readKey(["enter", " "]); }
  } finally {
    process.stdin.off("keypress", onKey); process.stdin.setRawMode(wasRaw); process.stdin.pause();
    await lock.close(); await unlink(lockPath);
  }
}
