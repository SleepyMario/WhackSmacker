import { chmod, cp, mkdir, writeFile } from "node:fs/promises";

await mkdir("dist", { recursive: true });

await writeFile("dist/main.js", "#!/usr/bin/env node\nrequire(\"./apps/cli/main\").main();\n");
await chmod("dist/main.js", 0o755);
await cp("apps/web/public", "dist/apps/web/public", { recursive: true });
await mkdir("dist/apps/cli/content", { recursive: true });
await cp("../japanese-curriculum/introductions/cast-introduction-i.md", "dist/apps/cli/content/japanese-cast-introduction-i.md");
await cp("../japanese-curriculum/introductions/cast-introduction-ii.md", "dist/apps/cli/content/japanese-cast-introduction-ii.md");
await mkdir("dist/apps/cli/content/media", { recursive: true });
await cp("../japanese-curriculum/introductions/media/cast-introduction-i.png", "dist/apps/cli/content/media/cast-introduction-i.png");
await cp("../japanese-curriculum/introductions/media/cast-introduction-ii.png", "dist/apps/cli/content/media/cast-introduction-ii.png");
for (const [chapter, source] of [["001", "chapter-001-a-first-meeting"], ["002", "chapter-002-akis-introduction"], ["003", "chapter-003-checking-study-supplies"], ["004", "chapter-004-rens-study-materials"], ["005", "chapter-005-at-the-cafe"], ["006", "chapter-006-meeting-misaki"], ["007", "chapter-007-misakis-pottery"], ["008", "chapter-008-misakis-pottery-studio"], ["009", "chapter-009-choosing-a-study-day"], ["010", "chapter-010-misakis-saturday"]]) {
  await mkdir(`dist/apps/cli/content/japanese/chapter-${chapter}`, { recursive: true });
  for (const file of ["chapter.md", "reading-support.json", "reading-translation.en.json"]) {
    await cp(`../japanese-curriculum/units/japanese-core/${source}/${file}`, `dist/apps/cli/content/japanese/chapter-${chapter}/${file}`);
  }
  if (Number(chapter) >= 8) {
    await mkdir(`dist/apps/cli/content/japanese/chapter-${chapter}/media`, { recursive: true });
    await cp(`../japanese-curriculum/units/japanese-core/${source}/media/scene.png`, `dist/apps/cli/content/japanese/chapter-${chapter}/media/scene.png`);
  }
}

await mkdir("dist/apps/cli/content/japanese/chapter-001/media", { recursive: true });
await cp("../japanese-curriculum/units/japanese-core/chapter-001-a-first-meeting/media/scene.png", "dist/apps/cli/content/japanese/chapter-001/media/scene.png");

await mkdir("dist/apps/cli/content/japanese/chapter-002/media", { recursive: true });
await cp("../japanese-curriculum/units/japanese-core/chapter-002-akis-introduction/media/scene.png", "dist/apps/cli/content/japanese/chapter-002/media/scene.png");

await mkdir("dist/apps/cli/content/japanese/chapter-003/media", { recursive: true });
await cp("../japanese-curriculum/units/japanese-core/chapter-003-checking-study-supplies/media/scene.png", "dist/apps/cli/content/japanese/chapter-003/media/scene.png");

await mkdir("dist/apps/cli/content/japanese/chapter-004/media", { recursive: true });
await cp("../japanese-curriculum/units/japanese-core/chapter-004-rens-study-materials/media/scene.png", "dist/apps/cli/content/japanese/chapter-004/media/scene.png");

await mkdir("dist/apps/cli/content/japanese/chapter-005/media", { recursive: true });
await cp("../japanese-curriculum/units/japanese-core/chapter-005-at-the-cafe/media/scene.png", "dist/apps/cli/content/japanese/chapter-005/media/scene.png");

await mkdir("dist/apps/cli/content/japanese/chapter-006/media", { recursive: true });
await cp("../japanese-curriculum/units/japanese-core/chapter-006-meeting-misaki/media/scene.png", "dist/apps/cli/content/japanese/chapter-006/media/scene.png");

for (const variant of ["easy", "hard"]) {
  await cp(`../japanese-curriculum/units/japanese-core/chapter-001-005-grammar-${variant}/chapter.md`, `dist/apps/cli/content/japanese/grammar-001-005-${variant}.md`);
  await cp(`../japanese-curriculum/units/japanese-core/chapter-006-010-grammar-${variant}/chapter.md`, `dist/apps/cli/content/japanese/grammar-006-010-${variant}.md`);
}

for (const person of ["aki", "ren", "yuki"]) {
  await cp(`../japanese-curriculum/introductions/cast-${person}.md`, `dist/apps/cli/content/japanese-cast-${person}.md`);
}

await mkdir("dist/apps/cli/content/japanese/chapter-007/media", { recursive: true });
await cp("../japanese-curriculum/units/japanese-core/chapter-007-misakis-pottery/media/scene.png", "dist/apps/cli/content/japanese/chapter-007/media/scene.png");

await cp("../korean-curriculum/introductions/cast-introduction-i.md", "dist/apps/cli/content/korean-cast-introduction-i.md");
await cp("../korean-curriculum/introductions/media/cast-introduction-i.png", "dist/apps/cli/content/media/korean-cast-introduction-i.png");

await mkdir("dist/apps/cli/content/korean/chapter-001/media", { recursive: true });
for (const file of ["chapter.md", "reading-support.json", "reading-translation.en.json", "media/scene.png"]) {
  await cp(`../korean-curriculum/units/korean-core/chapter-001-a-polite-first-meeting/${file}`, `dist/apps/cli/content/korean/chapter-001/${file}`);
}

await mkdir("dist/apps/cli/content/korean/chapter-002/media", { recursive: true });
for (const file of ["chapter.md", "reading-support.json", "reading-translation.en.json", "media/scene.png"]) {
  await cp(`../korean-curriculum/units/korean-core/chapter-002-seoyeons-introduction/${file}`, `dist/apps/cli/content/korean/chapter-002/${file}`);
}

for (const [number, slug] of [["003", "at-the-campus-club-table"], ["004", "seoyeons-design-desk"], ["005", "a-cafe-break"]]) {
  await mkdir(`dist/apps/cli/content/korean/chapter-${number}/media`, { recursive: true });
  for (const file of ["chapter.md", "reading-support.json", "reading-translation.en.json", "chapter-participants.json", "media/scene.png"]) {
    await cp(`../korean-curriculum/units/korean-core/chapter-${number}-${slug}/${file}`, `dist/apps/cli/content/korean/chapter-${number}/${file}`);
  }
}
for (const variant of ["easy", "hard"]) {
  await cp(`../korean-curriculum/units/korean-core/chapter-001-005-grammar-${variant}/chapter.md`, `dist/apps/cli/content/korean/grammar-001-005-${variant}.md`);
}

await cp("../vietnamese-curriculum/introductions/cast-introduction-i.md", "dist/apps/cli/content/vietnamese-cast-introduction-i.md");
await cp("../vietnamese-curriculum/introductions/media/cast-introduction-i.png", "dist/apps/cli/content/media/vietnamese-cast-introduction-i.png");
await mkdir("dist/apps/cli/content/vietnamese/chapter-001/media", { recursive: true });
for (const file of ["chapter.md", "reading-support.json", "reading-translation.en.json", "media/scene.png"]) {
  await cp(`../vietnamese-curriculum/units/vietnamese-core/chapter-001-a-first-meeting/${file}`, `dist/apps/cli/content/vietnamese/chapter-001/${file}`);
}

await mkdir("dist/apps/cli/content/vietnamese/chapter-002/media", { recursive: true });
for (const file of ["chapter.md", "reading-support.json", "reading-translation.en.json", "media/scene.png"]) {
  await cp(`../vietnamese-curriculum/units/vietnamese-core/chapter-002-marias-introduction/${file}`, `dist/apps/cli/content/vietnamese/chapter-002/${file}`);
}

// Current Vietnamese first block, with colocated authored support and artwork.
for (const [number, slug] of [["003", "tea-with-minh-anh"], ["004", "in-the-kitchen"], ["005", "a-neighborhood-walk"]]) {
  await mkdir(`dist/apps/cli/content/vietnamese/chapter-${number}/media`, { recursive: true });
  for (const file of ["chapter.md", "reading-support.json", "reading-translation.en.json", "chapter-participants.json", "media/scene.png"]) {
    await cp(`../vietnamese-curriculum/units/vietnamese-core/chapter-${number}-${slug}/${file}`, `dist/apps/cli/content/vietnamese/chapter-${number}/${file}`);
  }
}
for (const variant of ["easy", "hard"]) {
  await cp(`../vietnamese-curriculum/units/vietnamese-core/chapter-001-005-grammar-${variant}/chapter.md`, `dist/apps/cli/content/vietnamese/grammar-001-005-${variant}.md`);
}
