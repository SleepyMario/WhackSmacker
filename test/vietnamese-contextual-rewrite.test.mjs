import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";

const appRoot = process.cwd();
const curriculumRoot = join(appRoot, "..", "vietnamese-curriculum");
const unitsRoot = join(curriculumRoot, "units", "vietnamese-core");
const fixture = JSON.parse(await readFile(join(appRoot, "test", "fixtures", "vietnamese-contextual-rewrite.json"), "utf8"));
const normalized = (value) => value.normalize("NFC").replace(/\s+/gu, " ").trim();

test("Vietnamese contextual rewrite matches the independent authored semantic inventory", async () => {
  assert.equal(fixture.schemaVersion, 1);
  assert.equal(fixture.chapters.length, 30);
  assert.equal(new Set(fixture.chapters.flatMap((item) => item.grammarIds)).size, 32);
  assert.equal(fixture.manuscriptSha256, "1ebe8dd8d138c81d4a9c87936682579708f19e72ce4e98860078fd1deb55355f");
  const directories = await readdir(unitsRoot);
  assert.equal(directories.some((name) => /^chapter-0(?:3[1-9]|[4-9]\d)-basic/u.test(name)), false);

  for (const expected of fixture.chapters) {
    const directory = directories.find((name) => name.startsWith(`chapter-${String(expected.chapter).padStart(3, "0")}-basic-sentences-`));
    assert.ok(directory, `missing Chapter ${expected.chapter}`);
    const markdown = await readFile(join(unitsRoot, directory, "chapter.md"), "utf8");
    const sidecar = JSON.parse(await readFile(join(unitsRoot, directory, "chapter-participants.json"), "utf8"));
    const translation = expected.chapter <= 10 ? null : JSON.parse(await readFile(join(unitsRoot, directory, "reading-translation.en.json"), "utf8"));
    assert.equal(/^title:\s*"([^"]+)"$/mu.exec(markdown)?.[1], expected.title);
    const section = new RegExp(`^### ${expected.readingType}\\s*$\\n([\\s\\S]*?)(?=^### )`, "mu").exec(markdown)?.[1]?.trim();
    assert.ok(section, `Chapter ${expected.chapter} reading section`);
    const [context, ...body] = section.split(/\n\s*\n/u);
    assert.equal(normalized(context), normalized(expected.context));
    const readingBody = body.join("\n\n").replace(/^```text\s*\n|\n```$/gu, "");
    assert.equal(normalized(readingBody), normalized(expected.readingLines.join(" ")), `Chapter ${expected.chapter} reading prose`);
    assert.deepEqual(sidecar.canonicalCastIds, expected.participantIds);
    assert.deepEqual(JSON.parse(/^first_profile_person_ids:\s*(\[[^\n]+\])$/mu.exec(markdown)?.[1] ?? "[]"), expected.firstProfilePersonIds);
    assert.deepEqual([...new Set(markdown.match(/VIE-GRAMMAR-\d+[A-Z]?/gu) ?? [])], expected.grammarIds);
    assert.deepEqual(sidecar.unnamedFunctionalParticipants.map(({ localId, roleLabel }) => ({ localId, roleLabel })), expected.unnamedRoles);
    if (translation) {
      const actualTranslations = translation.turns?.map((turn) => turn.text)
        ?? translation.sentences
        ?? translation.paragraphs.slice(1);
      assert.equal(normalized(actualTranslations.join(" ")), normalized(expected.translations.join(" ")), `Chapter ${expected.chapter} translation prose`);
    }
  }
});

test("the contextual fixture itself is deterministic and NFC", async () => {
  const bytes = await readFile(join(appRoot, "test", "fixtures", "vietnamese-contextual-rewrite.json"));
  assert.equal(bytes.toString("utf8"), bytes.toString("utf8").normalize("NFC"));
  assert.equal(createHash("sha256").update(bytes).digest("hex").length, 64);
});
