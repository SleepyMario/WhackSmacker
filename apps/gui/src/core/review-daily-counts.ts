import type { ReviewProgressStore } from "./review-scheduler";

export function reviewDay(timestamp: string): string {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** Stored totals survive deck resets. Legacy history is counted once on first use. */
export function dailyReviewCounts(store: ReviewProgressStore): Record<string, number> {
  if (store.dailyReviewCounts !== undefined) return { ...store.dailyReviewCounts };
  const counts: Record<string, number> = {};
  for (const event of store.events) {
    const day = reviewDay(event.reviewedAt);
    counts[day] = (counts[day] ?? 0) + 1;
  }
  return counts;
}

export function renderDailyReviewHistory(counts: Readonly<Record<string, number>>): string {
  const rows = Object.entries(counts).sort(([a], [b]) => b.localeCompare(a));
  return ["Daily reviews — all decks", "Each completed rating counts, including repeats.", "Days use your local time zone. Older totals use retained review history.", "", ...rows.map(([day, count]) => `${day}  ${count}`), ...(rows.length ? [] : ["No reviews recorded yet."])].join("\n");
}
