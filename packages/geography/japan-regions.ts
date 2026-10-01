export const japanRegionDecks = [
  { slug: "hokkaido", label: "Hokkaidou", answer: "Hokkaidō", japanese: "北海道" },
  { slug: "tohoku", label: "Touhoku", answer: "Tōhoku", japanese: "東北" },
  { slug: "kanto", label: "Kantou", answer: "Kantō", japanese: "関東" },
  { slug: "chubu", label: "Chuubu", answer: "Chūbu", japanese: "中部" },
  { slug: "kansai", label: "Kansai", answer: "Kansai", japanese: "関西" },
  { slug: "chugoku", label: "Chuugoku", answer: "Chūgoku", japanese: "中国" },
  { slug: "shikoku", label: "Shikoku", answer: "Shikoku", japanese: "四国" },
  { slug: "kyushu", label: "Kyuushuu", answer: "Kyūshū", japanese: "九州" }
] as const;

export type JapanRegionSlug = typeof japanRegionDecks[number]["slug"];
