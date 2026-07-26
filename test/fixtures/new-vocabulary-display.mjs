export const ordinaryThreeEntries = [
  "# Fixture",
  "",
  "### Brief Introduction",
  "",
  "Introduction line one.",
  "",
  "Introduction line two.",
  "",
  "### Dialogue",
  "",
  "A: First line.",
  "B: Second line.",
  "",
  "### New Vocabulary",
  "",
  "| Form | Meaning | Part of speech | Note |",
  "|---|---|---|---|",
  "| alpha | first | noun | note one |",
  "| beta | second | phrase | note two |",
  "| gamma | third | verb | note three |",
  "",
  "### Grammar",
  "",
  "Grammar line one.",
  "",
  "Grammar line two.",
  "",
  "### Exercises",
  "",
  "1. Exercise line.",
  "",
  "### Other Table",
  "",
  "| Form | Meaning | Part of speech | Note |",
  "|---|---|---|---|",
  "| outside one | first | noun | unchanged |",
  "| outside two | second | noun | unchanged |"
].join("\n");

export const wrappedMiddleEntry = ordinaryThreeEntries.replace(
  "| beta | second | phrase | note two |",
  "| beta first<br>beta second | second first<br>second second | phrase | note two |"
);

export const semanticContinuationEntry = ordinaryThreeEntries.replace(
  "| alpha | first | noun | note one |\n| beta | second | phrase | note two |",
  "| gaat | goes | verb | finite form |\n| → gaan |  | verb | Citation form |"
);

export const japaneseThreeEntries = ordinaryThreeEntries.replace(
  "| Form | Meaning | Part of speech | Note |\n|---|---|---|---|\n| alpha | first | noun | note one |\n| beta | second | phrase | note two |\n| gamma | third | verb | note three |",
  "| Form | Reading | Meaning | Part of speech | Note |\n|---|---|---|---|---|\n| 学生 | がくせい | student | noun | school context |\n| こんにちは |  | hello | phrase | kana-only form |\n| 食べます | たべます | eat | verb | polite contextual form |"
);
