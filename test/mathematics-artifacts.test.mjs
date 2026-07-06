import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const defaultMathArtifacts = [
  "one-two-three-workbook.pdf",
  "four-and-five-workbook.pdf",
  "one-to-five-workbook.pdf",
  "six-to-nine-workbook.pdf",
  "beginner-mathematics-volume-one.pdf"
];

test("mathematics artifact policy documents on-demand generation and future packaging", async () => {
  const policy = await readFile(new URL("../docs/mathematics-artifacts.md", import.meta.url), "utf8");

  assert.match(policy, /currently generates mathematics workbook PDFs on demand/u);
  assert.match(policy, /No pregenerated mathematics PDFs are committed today/u);
  assert.match(policy, /math-artifacts\//u);
  assert.match(policy, /com\.sleepymario\.mathematics\.curriculum/u);
  assert.match(policy, /User progress must remain outside installed package directories/u);
});

test("known mathematics PDF outputs are ignored by git", async () => {
  const gitignore = await readFile(new URL("../.gitignore", import.meta.url), "utf8");

  assert.match(gitignore, /^math-artifacts\/$/m);
  for (const artifact of defaultMathArtifacts) {
    assert.match(gitignore, new RegExp(`^${escapeRegex(artifact)}$`, "m"));
  }
});

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

