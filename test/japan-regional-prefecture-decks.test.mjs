import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { test } from "node:test";

import {
  japanRegionDecks,
  japanRegionalPrefectureSplitDirectory
} from "../dist/packages/geography/japan-regions.js";

test("every Japanese regional prefecture has regional romanized and kanji highlight artwork", async () => {
  const regions = JSON.parse(await readFile(new URL("../dist/packages/geography/data/japan-regions/regions.json", import.meta.url), "utf8"));
  const prefectures = JSON.parse(await readFile(new URL("../dist/packages/geography/data/japan-hard/prefectures.json", import.meta.url), "utf8"));
  const byName = new Map(prefectures.map(prefecture => [prefecture.answer, prefecture]));
  let count = 0;
  for (const region of regions) {
    const slug = region.id.replace(/-highlight$/u, "");
    assert.ok(japanRegionDecks.some(candidate => candidate.slug === slug));
    for (const kanji of [false, true]) {
      const directory = japanRegionalPrefectureSplitDirectory(slug, kanji);
      await access(new URL(`../dist/packages/geography/data/${directory}/reference.png`, import.meta.url));
      for (const name of region.prefectures) {
        const prefecture = byName.get(name);
        assert.ok(prefecture, `${slug}: missing ${name} metadata`);
        const stem = prefecture.id.replace(/-highlight$/u, "");
        await access(new URL(`../dist/packages/geography/data/${directory}/${stem}-question.png`, import.meta.url));
        await access(new URL(`../dist/packages/geography/data/${directory}/${stem}-answer.png`, import.meta.url));
        count++;
      }
    }
  }
  assert.equal(count, 94, "47 prefectures in each of two script variants");
});
