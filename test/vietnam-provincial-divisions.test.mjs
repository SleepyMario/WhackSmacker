import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";

const root = new URL("../dist/packages/geography/data/vietnam-provinces/", import.meta.url);

test("Vietnam map uses all 34 current provincial-level divisions", async () => {
  const divisions = JSON.parse(await readFile(new URL("provinces.json", root), "utf8"));
  assert.equal(divisions.length, 34);
  assert.equal(divisions.filter((item) => item.kind === "Thành phố").length, 6);
  assert.equal(divisions.filter((item) => item.kind === "Tỉnh").length, 28);
  assert.deepEqual(divisions.map((item) => item.answer).filter((name) => ["Hà Nội", "Huế", "Đà Nẵng", "Hải Phòng", "Cần Thơ", "Hồ Chí Minh"].includes(name)).sort(),
    ["Cần Thơ", "Hà Nội", "Hải Phòng", "Huế", "Hồ Chí Minh", "Đà Nẵng"].sort());
  for (const division of divisions) {
    const stem = division.id.replace(/-highlight$/, "");
    await access(new URL(`split/${stem}-question.png`, root));
    await access(new URL(`split/${stem}-answer.png`, root));
  }
  await access(new URL("vietnam-provinces-numbered.png", root));
  await access(new URL("vietnam-provinces-named.png", root));
});

test("Vietnam regional decks contain only their regional divisions and artwork", async () => {
  const expected = [
    ["north", 15, "Hà Nội", "Ninh Bình"],
    ["central", 11, "Thanh Hóa", "Lâm Đồng"],
    ["south", 8, "Đồng Nai", "Cà Mau"]
  ];
  for (const [slug, count, first, last] of expected) {
    const regionRoot = new URL(`regions/${slug}/`, root);
    const divisions = JSON.parse(await readFile(new URL("provinces.json", regionRoot), "utf8"));
    assert.equal(divisions.length, count);
    assert.equal(divisions[0].answer, first);
    assert.equal(divisions.at(-1).answer, last);
    await access(new URL("provinces-numbered.png", regionRoot));
    await access(new URL("provinces-named.png", regionRoot));
    await access(new URL("split/reference.png", regionRoot));
    for (const division of divisions) {
      const stem = division.id.replace(/-highlight$/, "");
      await access(new URL(`split/${stem}-question.png`, regionRoot));
      await access(new URL(`split/${stem}-answer.png`, regionRoot));
    }
  }
});

test("Vietnamese Lingoland artwork mirrors every validated Vietnam map", async () => {
  const languageRoot = new URL("language-vietnamese/", root);
  const divisions = JSON.parse(await readFile(new URL("provinces.json", root), "utf8"));
  await access(new URL("vietnam-provinces-numbered.png", languageRoot));
  await access(new URL("vietnam-provinces-named.png", languageRoot));
  await access(new URL("split/reference.png", languageRoot));
  for (const division of divisions) {
    const stem = division.id.replace(/-highlight$/, "");
    await access(new URL(`split/${stem}-question.png`, languageRoot));
    await access(new URL(`split/${stem}-answer.png`, languageRoot));
  }
  for (const slug of ["north", "central", "south"]) {
    const regionRoot = new URL(`regions/${slug}/`, root);
    const localizedRoot = new URL(`regions/${slug}/`, languageRoot);
    const regional = JSON.parse(await readFile(new URL("provinces.json", regionRoot), "utf8"));
    await access(new URL("provinces-numbered.png", localizedRoot));
    await access(new URL("provinces-named.png", localizedRoot));
    await access(new URL("split/reference.png", localizedRoot));
    for (const division of regional) {
      const stem = division.id.replace(/-highlight$/, "");
      await access(new URL(`split/${stem}-question.png`, localizedRoot));
      await access(new URL(`split/${stem}-answer.png`, localizedRoot));
    }
  }
});
