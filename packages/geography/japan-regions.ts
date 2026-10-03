export const japanRegionDecks = [
  { slug: "hokkaido", label: "Hokkaidou", answer: "Hokkaidō", japanese: "北海道", mapLayout: "landscape" },
  { slug: "tohoku", label: "Touhoku", answer: "Tōhoku", japanese: "東北", mapLayout: "portrait" },
  { slug: "kanto", label: "Kantou", answer: "Kantō", japanese: "関東", mapLayout: "landscape" },
  { slug: "chubu", label: "Chuubu", answer: "Chūbu", japanese: "中部", mapLayout: "portrait" },
  { slug: "kansai", label: "Kansai", answer: "Kansai", japanese: "関西", mapLayout: "landscape" },
  { slug: "chugoku", label: "Chuugoku", answer: "Chūgoku", japanese: "中国", mapLayout: "top-down" },
  { slug: "shikoku", label: "Shikoku", answer: "Shikoku", japanese: "四国", mapLayout: "top-down" },
  { slug: "kyushu", label: "Kyuushuu", answer: "Kyūshū", japanese: "九州", mapLayout: "portrait" }
] as const;

export type JapanRegionSlug = typeof japanRegionDecks[number]["slug"];

export function japanRegionalPrefectureSplitDirectory(slug: JapanRegionSlug, kanji: boolean): string {
  return `japan-regions/prefecture-decks/${slug}/${kanji ? "split-kanji" : "split"}`;
}
