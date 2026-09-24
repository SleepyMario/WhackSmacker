import { readFile, mkdir, open, unlink } from "node:fs/promises";
import { join } from "node:path";
import { emitKeypressEvents } from "node:readline";
import { isReviewDue } from "../core/review-scheduler";
import { loadReviewProgressStore, recordStoredReviewOutcome, resolveReviewProgressDirectory } from "../core/review-progress-store";
import { kittyArtworkSequences, kittyArtworkDeleteSequence } from "../../apps/cli/terminal-artwork";

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

export function normalizePrefectureAnswer(value: string): string {
  const normalized = value.normalize("NFD").replace(/\p{M}/gu, "").trim().toLowerCase()
    .replace(/(?:[ -]+(?:prefecture|ken|fu|to|do))$/, "").replace(/[ -]+/g, "");
  const aliases: Record<string, string> = { hokkaidou: "hokkaido", toukyou: "tokyo", toukyo: "tokyo", tokyou: "tokyo", kyouto: "kyoto", oosaka: "osaka", hyougo: "hyogo", kouchi: "kochi", ooita: "oita", ohita: "oita" };
  return aliases[normalized] ?? normalized;
}

export async function runContinentsEasy(options: { progressDir?: string; mode?: "easy" | "hard"; dataset?: "japan"; nameScript?: "kanji" } = {}): Promise<void> {
  const kanji = options.nameScript === "kanji";
  const japan = options.dataset === "japan";
  const hard = options.mode === "hard";
  const title = japan ? (hard ? "Prefectures - Hard" : "Prefectures - Easy") : hard ? "Continents - Hard" : "Continents - Easy";
  const packageId = japan ? `com.sleepymario.${kanji ? "language.japanese" : "geography"}.japan-prefectures-${hard ? "hard" : "easy"}` : hard ? "com.sleepymario.geography.continents-hard" : continentEasyPackageId;
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error(`${title} needs an interactive Kitty terminal.`);
  }
  if (!(process.env.KITTY_WINDOW_ID || process.env.TERM?.includes("kitty"))) {
    throw new Error("Open this deck in Kitty to display the maps.");
  }
  let cards = japan
    ? (JSON.parse(await readFile(join(__dirname, "data", "japan-hard", "prefectures.json"), "utf8")) as { id: string; answer: string; japanese: string }[])
      .map(c => ({ ...c, answer: kanji ? c.japanese : c.answer, prompt: "Which prefecture is highlighted?", explanation: kanji ? `The highlighted prefecture is ${c.japanese}.` : `The highlighted prefecture is ${c.answer} (${c.japanese}).` }))
    : hard ? continentEasyCards : [...continentEasyCards, ...continents.map(c => ({
      id: `${c.id}-locate`, answer: String(c.number), prompt: `Which number marks ${c.answer}?`,
      explanation: `${c.answer} is number ${c.number}.`
    }))];
  const namePool = cards.map(c => c.answer);
  if (japan && !hard) cards = [...cards, ...cards.map((c, i) => ({
    id: c.id.replace(/-highlight$/, "-locate"), answer: String(i + 1),
    prompt: `Which number marks ${c.answer}?`, explanation: `${c.answer} is number ${i + 1}.`
  }))];
  const progressDir = options.progressDir ?? join(resolveReviewProgressDirectory(), "wandering-the-world");
  await mkdir(progressDir, { recursive: true });
  const lockPath = join(progressDir, japan ? `japan-prefectures-${kanji ? "kanji-" : ""}${hard ? "hard" : "easy"}.lock` : hard ? "continents-hard.lock" : "continents-easy.lock");
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
        if (!typedAnswer.trim() || (numericEntry && (!/^\d{1,2}$/.test(typedAnswer) || Number(typedAnswer) < 1 || Number(typedAnswer) > 47)) || (process.stdout.rows || 40) < 20 || (process.stdout.columns || 100) < 55) return;
        typing = false;
        const resolve = pending; pending = undefined; resolve?.(typedAnswer); return;
      }
      if (key.name === "backspace") typedAnswer = typedAnswer.slice(0, -1);
      else if (!key.ctrl && text && (numericEntry ? /^\d+$/.test(text) && typedAnswer.length + text.length <= 2 : /^[\p{L}\p{M} -]+$/u.test(text))) typedAnswer += text;
      currentDraw?.(); return;
    }
    if (pending) { const resolve = pending; pending = undefined; resolve(key.name === "return" ? "enter" : (text ?? "").toLowerCase()); }
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
    const dueCards = cards.filter(card => {
      const state = store.items.find(s => s.packageId === packageId && s.itemId === card.id);
      return !state || isReviewDue(state, sessionTime);
    });
    const queue = kanji ? dueCards : shuffled(dueCards, Math.random);
    for (const card of queue) {
      if (ended) break;
      const directNumber = !hard && card.id.endsWith("-locate");
      const choices = hard || directNumber ? [] : japan ? shuffled([card.answer, ...shuffled(namePool.filter(n => n !== card.answer), Math.random).slice(0, 3)], Math.random) : continentEasyChoices(card.answer);
      const textEntry = hard || (japan && directNumber);
      const answerKeys = directNumber ? ["1", "2", "3", "4", "5", "6", "7"] : continentEasyAnswerKeys;
      const instruction = japan && directNumber ? "Enter the map number (1–47) and press Enter. Escape returns to the menu." : japan && hard ? (kanji ? "Type the prefecture name in kanji and press Enter. Escape returns to the menu." : "Type the romanized prefecture name and press Enter. Escape returns to the menu.") : hard ? "Type the continent name and press Enter. Escape returns to the menu." : directNumber ? "Press the map number (1–7) to answer." : "Press 1–4 to answer.";
      const stem = card.id.replace(/-highlight$/, "");
      const questionPng = await readFile(directNumber ? join(__dirname, "data", japan ? "japan-hard/japan-prefectures-numbered.png" : "world-seven-continents-numbered.png") : join(__dirname, "data", japan ? (kanji ? "japan-hard/split-kanji" : "japan-hard/split") : "paired", `${stem}-question.png`));
      const answerPng = await readFile(directNumber ? join(__dirname, "data", japan ? (kanji ? "japan-hard/japan-prefectures-kanji.png" : "japan-hard/japan-prefectures-named.png") : "world-seven-continents.png") : join(__dirname, "data", japan ? (kanji ? "japan-hard/split-kanji" : "japan-hard/split") : "paired", `${stem}-answer.png`));
      const referencePng = japan && !directNumber ? await readFile(join(__dirname, "data", "japan-hard", "split", "reference.png")) : undefined;
      let feedback = "";
      const draw = () => {
        const rows = process.stdout.rows || 40, columns = process.stdout.columns || 100;
        process.stdout.write(kittyArtworkDeleteSequence() + kittyArtworkDeleteSequence(19394562) + `\x1b[2J\x1b[H${title}\n`);
        if (rows < 20 || columns < 55) {
          process.stdout.write("Please enlarge the terminal to at least 55 columns and 20 rows.\n");
          return;
        }
        if (japan) {
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
      numericEntry = japan && directNumber;
      currentDraw = draw; draw();
      let key: string;
      do { key = textEntry ? await new Promise<string>(resolve => { pending = resolve; }) : await readKey(answerKeys); }
      while (key !== "q" && ((process.stdout.rows || 40) < 20 || (process.stdout.columns || 100) < 55));
      if (ended || (!hard && key === "q")) break;
      const selected = numericEntry ? String(Number(key)) : hard || directNumber ? key : choices[continentEasyAnswerKeys.indexOf(key as typeof continentEasyAnswerKeys[number])];
      const right = kanji && !directNumber ? selected?.normalize("NFKC").trim().replace(/[都府県]$/, "") === card.answer.replace(/[都府県]$/, "") : japan ? normalizePrefectureAnswer(selected ?? "") === normalizePrefectureAnswer(card.answer) : selected?.trim().replace(/\s+/g, " ").toLowerCase() === card.answer.toLowerCase();
      await recordStoredReviewOutcome({ ...continentEasyIdentity(card.id), packageId, progressDir, reviewedAt: now(), rating: right ? "good" : "again" });
      if (right) correct++; else wrong++;
      const color = process.env.NO_COLOR === undefined ? (right ? "\x1b[32m" : "\x1b[31m") : "";
      feedback = `${color}${right ? "Correct!" : `Wrong. ${card.explanation}`}${color ? "\x1b[0m" : ""}  Enter / Space: next`;
      draw();
      if (await readKey(["enter", " "]) === "q") break;
    }
    currentDraw = undefined;
    if (!ended) {
      process.stdout.write(kittyArtworkDeleteSequence() + kittyArtworkDeleteSequence(19394562) + `\x1b[2J\x1b[H${title}\n\n`);
      process.stdout.write(queue.length ? `${correct} correct, ${wrong} incorrect.\nIncorrect answers are due again after 10 minutes.\n` : "No cards are due for review right now.\n");
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
