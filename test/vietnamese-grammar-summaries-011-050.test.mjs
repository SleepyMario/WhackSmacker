import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";
const root = join(process.cwd(), "..", "vietnamese-curriculum", "units", "vietnamese-core");
for (let start = 11; start <= 46; start += 5) {
  const end = start + 4;
  test(`Vietnamese Grammar Easy/Hard ${start}-${end} have identical IDs and patterns`, async () => {
    const prefix = `chapter-${String(start).padStart(3,"0")}-${String(end).padStart(3,"0")}-grammar-`;
    const [easy, hard] = await Promise.all(["easy", "hard"].map((level) => readFile(join(root, `${prefix}${level}`, "chapter.md"), "utf8")));
    const ids = (text) => [...text.matchAll(/^- (VIE-GRAMMAR-\d{3}[A-Z]?) -- (.+)$/gmu)].map((m) => [m[1], m[2]]);
    assert.deepEqual(ids(easy), ids(hard));
    assert.equal(ids(easy).length, start <= 21 ? 5 : start === 26 ? 7 : 10);
  });
}
