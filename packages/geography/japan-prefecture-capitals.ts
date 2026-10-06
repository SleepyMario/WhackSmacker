import { mkdir, open, readFile, unlink } from "node:fs/promises";
import { join } from "node:path";
import { emitKeypressEvents } from "node:readline";
import { isReviewDeckManuallyFinished, isReviewDue, isReviewItemBuryEligible } from "../core/review-scheduler";
import { buryStoredReviewItem, loadReviewProgressStore, recordStoredReviewOutcome, resolveReviewProgressDirectory } from "../core/review-progress-store";
import { formatGeographySessionScore, shuffled } from "./continents-easy";

export const japanPrefectureCapitalsPackageId = "com.sleepymario.geography.japan-prefecture-capitals";

export interface JapanPrefectureCapital {
  readonly id: string;
  readonly prefectureEnglish: string;
  readonly prefectureJapanese: string;
  readonly prefectureReading: string;
  readonly capitalEnglish: string;
  readonly capitalJapanese: string;
  readonly capitalReading: string;
}

interface CapitalCard {
  readonly id: string;
  readonly prompt: string;
  readonly answer: string;
  readonly explanation: string;
  readonly answerPool: readonly string[];
}

const now = (): string => new Date().toISOString().replace(/\.\d{3}Z$/u, "Z");

export async function loadJapanPrefectureCapitals(): Promise<readonly JapanPrefectureCapital[]> {
  return JSON.parse(await readFile(join(__dirname, "data", "japan-prefecture-capitals", "capitals.json"), "utf8")) as JapanPrefectureCapital[];
}

export function makeJapanPrefectureCapitalCards(rows: readonly JapanPrefectureCapital[]): readonly CapitalCard[] {
  const prefectures = rows.map(row => row.prefectureEnglish);
  const capitals = rows.map(row => row.capitalEnglish);
  return rows.flatMap(row => [{
    id: `${row.id}-prefecture-to-capital`,
    prompt: `What is the capital of ${row.prefectureEnglish}?`,
    answer: row.capitalEnglish,
    explanation: `The capital of ${row.prefectureEnglish} is ${row.capitalEnglish} (${row.capitalJapanese}).`,
    answerPool: capitals
  }, {
    id: `${row.id}-capital-to-prefecture`,
    prompt: `Which prefecture has ${row.capitalEnglish} as its capital?`,
    answer: row.prefectureEnglish,
    explanation: `${row.capitalEnglish} (${row.capitalJapanese}) is the capital of ${row.prefectureEnglish} (${row.prefectureJapanese}).`,
    answerPool: prefectures
  }]);
}

export async function runJapanPrefectureCapitals(options: { progressDir?: string } = {}): Promise<void> {
  if (!process.stdin.isTTY || !process.stdout.isTTY) throw new Error("Prefecture Capitals needs an interactive terminal.");
  const progressDir = options.progressDir ?? join(resolveReviewProgressDirectory(), "wandering-the-world");
  await mkdir(progressDir, { recursive: true });
  const lockPath = join(progressDir, "japan-prefecture-capitals.lock");
  let lock;
  try { lock = await open(lockPath, "wx"); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EEXIST") throw new Error("Prefecture Capitals is already open. Close the other session first.");
    throw error;
  }

  const cards = makeJapanPrefectureCapitalCards(await loadJapanPrefectureCapitals());
  const store = await loadReviewProgressStore(progressDir);
  const states = new Map(store.items.filter(state => state.packageId === japanPrefectureCapitalsPackageId).map(state => [state.itemId, state]));
  const finished = isReviewDeckManuallyFinished(store.finishedDecks, { packageId: japanPrefectureCapitalsPackageId, packageVersion: "0.1.0" });
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
    if (pending !== undefined) { const resolve = pending; pending = undefined; resolve(key.name === "return" ? "enter" : text === "B" ? "B" : text); }
  };
  const readKey = async (allowed: readonly string[]): Promise<string> => {
    while (!stopped) {
      const value = await new Promise<string>(resolve => { pending = resolve; });
      if (allowed.includes(value) || value === "q") return value;
    }
    return "q";
  };

  let correct = 0, wrong = 0;
  try {
    emitKeypressEvents(process.stdin);
    process.stdin.setRawMode(true); process.stdin.resume(); process.stdin.on("keypress", onKey);
    for (const card of queue) {
      if (stopped) break;
      const choices = shuffled([card.answer, ...shuffled(card.answerPool.filter(value => value !== card.answer), Math.random).slice(0, 3)], Math.random);
      process.stdout.write(`\x1b[2J\x1b[HWandering the World — Japan — Prefecture Capitals\n\n${card.prompt}\n\n`);
      choices.forEach((choice, index) => process.stdout.write(`${index + 1}. ${choice}\n`));
      process.stdout.write("\nPress 1–4 to answer. Q or Escape returns to the menu.\n");
      const key = await readKey(["1", "2", "3", "4"]);
      if (key === "q") break;
      const right = choices[Number(key) - 1] === card.answer;
      if (right) correct++; else wrong++;
      const state = states.get(card.id);
      const buryEligible = state !== undefined && isReviewItemBuryEligible(state);
      process.stdout.write(`\n${right ? "Correct!" : `Wrong. ${card.explanation}`}\nEnter / Space: next${buryEligible ? "   B Bury permanently" : ""}\n`);
      const action = await readKey(buryEligible ? ["enter", " ", "B"] : ["enter", " "]);
      if (action === "q") break;
      const identity = { packageId: japanPrefectureCapitalsPackageId, packageVersion: "0.1.0", itemId: card.id };
      if (action === "B") await buryStoredReviewItem({ ...identity, progressDir, buriedAt: now() });
      else await recordStoredReviewOutcome({ ...identity, progressDir, reviewedAt: now(), rating: right ? "good" : "again" });
    }
    process.stdout.write(`\x1b[2J\x1b[HWandering the World — Japan — Prefecture Capitals\n\n`);
    process.stdout.write(queue.length > 0 ? `${formatGeographySessionScore(correct, wrong, queue.length)}\nIncorrect answers are due again after 10 minutes.\n` : "No cards are due for review right now.\n");
    if (!stopped) { process.stdout.write("\nPress Enter or Space to return.\n"); await readKey(["enter", " "]); }
  } finally {
    process.stdin.off("keypress", onKey); process.stdin.setRawMode(wasRaw); process.stdin.pause();
    await lock.close(); await unlink(lockPath);
  }
}
