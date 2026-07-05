import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import {
  generateBeginnerVolumeOneWorkbook,
  generateBeginnerVolumeOneWorkbookPdf,
  generateCountingUnitWorkbook,
  generateCountingUnitWorkbookPdf,
  generateOneTwoThreeWorkbook,
  generateOneTwoThreeWorkbookPdf,
  oneTwoThreeUnitDefinition,
  sixToNineUnitDefinition
} from "../dist/packages/mathematics/index.js";

test("One, Two, Three PDF generation creates a standalone 51-page workbook", async () => {
  const directory = await mkdtemp(join(tmpdir(), "one-two-three-pdf-test-"));
  const outputPath = join(directory, "workbook.pdf");

  try {
    const progress = [];
    const result = await generateOneTwoThreeWorkbookPdf({
      outputPath,
      seed: 184726,
      onProgress: (entry) => progress.push(entry)
    });

    assert.equal(result.pageCount, 51);
    assert.equal(result.unitIntroductionPageCount, 1);
    assert.equal(result.exercisePageCount, 50);
    assert.equal(result.exerciseCount, 200);
    assert.equal(result.seed, 184726);
    assert.equal(result.outputPath, outputPath);
    assert.deepEqual(
      result.workbook.pages.filter((page) => page.kind === "exercise").map((page) => page.exercises.map((exercise) => [exercise.quantity, exercise.objectFamily])),
      generateOneTwoThreeWorkbook({ seed: 184726 }).pages.filter((page) => page.kind === "exercise").map((page) => page.exercises.map((exercise) => [exercise.quantity, exercise.objectFamily]))
    );
    assert.equal(progress.length, 51);

    const file = await readFile(outputPath);
    assert.ok(file.length > 100_000);

    const pdfInfo = await run("pdfinfo", [outputPath]);
    assert.equal(pdfInfo.exitCode, 0, pdfInfo.stderr);
    assert.match(pdfInfo.stdout, /^Pages:\s+51$/m);

    const text = await run("pdftotext", [outputPath, "-"]);
    assert.equal(text.exitCode, 0, text.stderr);
    assert.match(text.stdout.replace(/\s+/gu, " "), /Unit 1 One, Two, Three/);
    assert.equal(countWord(text.stdout, "one"), 200);
    assert.equal(countWord(text.stdout, "two"), 200);
    assert.equal(countWord(text.stdout, "three"), 200);
    assert.equal(countWord(text.stdout, "1"), 1);
    assert.equal(countWord(text.stdout, "2"), 0);
    assert.equal(countWord(text.stdout, "3"), 0);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("Unit 004 PDF generation creates a standalone 61-page workbook", async () => {
  const directory = await mkdtemp(join(tmpdir(), "six-to-nine-pdf-test-"));
  const outputPath = join(directory, "six-to-nine.pdf");

  try {
    const result = await generateCountingUnitWorkbookPdf({ outputPath, seed: 184726 }, sixToNineUnitDefinition);

    assert.equal(result.pageCount, 61);
    assert.equal(result.unitIntroductionPageCount, 1);
    assert.equal(result.exercisePageCount, 60);
    assert.equal(result.exerciseCount, 240);
    assert.deepEqual(
      result.workbook.pages.filter((page) => page.kind === "exercise").map((page) => page.exercises.map((exercise) => [exercise.quantity, exercise.objectFamily])),
      generateCountingUnitWorkbook(sixToNineUnitDefinition, { seed: 184726 }).pages
        .filter((page) => page.kind === "exercise")
        .map((page) => page.exercises.map((exercise) => [exercise.quantity, exercise.objectFamily]))
    );

    const pdfInfo = await run("pdfinfo", [outputPath]);
    assert.equal(pdfInfo.exitCode, 0, pdfInfo.stderr);
    assert.match(pdfInfo.stdout, /^Pages:\s+61$/m);

    const text = await run("pdftotext", [outputPath, "-"]);
    assert.equal(text.exitCode, 0, text.stderr);
    assert.match(text.stdout.replace(/\s+/gu, " "), /Unit 4 Six, Seven, Eight, Nine/);
    for (const word of ["six", "seven", "eight", "nine"]) {
      assert.equal(countWord(text.stdout, word), 240);
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("unit PDF generation does not silently overwrite", async () => {
  const directory = await mkdtemp(join(tmpdir(), "one-two-three-overwrite-test-"));
  const outputPath = join(directory, "workbook.pdf");

  try {
    await generateCountingUnitWorkbookPdf({ outputPath, seed: 1 }, oneTwoThreeUnitDefinition);
    await assert.rejects(
      () => generateCountingUnitWorkbookPdf({ outputPath, seed: 1 }, oneTwoThreeUnitDefinition),
      /Output file already exists/
    );
    await generateCountingUnitWorkbookPdf({ outputPath, seed: 1, overwrite: true }, oneTwoThreeUnitDefinition);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("complete beginner volume PDF generation creates the full 195-page workbook", async () => {
  const directory = await mkdtemp(join(tmpdir(), "beginner-volume-one-pdf-test-"));
  const outputPath = join(directory, "beginner-volume-one.pdf");

  try {
    const progress = [];
    const result = await generateBeginnerVolumeOneWorkbookPdf({
      outputPath,
      seed: 184726,
      onProgress: (entry) => progress.push(entry)
    });

    assert.equal(result.pageCount, 195);
    assert.equal(result.introductionPageCount, 1);
    assert.equal(result.unitIntroductionPageCount, 4);
    assert.equal(result.exercisePageCount, 190);
    assert.equal(result.exerciseCount, 760);
    assert.equal(result.seed, 184726);
    assert.equal(result.outputPath, outputPath);
    assert.deepEqual(
      result.workbook.pages.filter((page) => page.kind === "exercise").map((page) => page.exercises.map((exercise) => [exercise.quantity, exercise.objectFamily])),
      generateBeginnerVolumeOneWorkbook({ seed: 184726 }).pages.filter((page) => page.kind === "exercise").map((page) => page.exercises.map((exercise) => [exercise.quantity, exercise.objectFamily]))
    );
    assert.equal(progress.length, 195);

    const file = await readFile(outputPath);
    assert.ok(file.length > 350_000);

    const pdfInfo = await run("pdfinfo", [outputPath]);
    assert.equal(pdfInfo.exitCode, 0, pdfInfo.stderr);
    assert.match(pdfInfo.stdout, /^Pages:\s+195$/m);

    const text = await run("pdftotext", [outputPath, "-"]);
    assert.equal(text.exitCode, 0, text.stderr);
    const normalizedText = text.stdout.replace(/\s+/gu, " ");
    assert.match(normalizedText, /Introduction/);
    assert.match(normalizedText, /This is going to be a \(way too\) comprehensive curriculum/);
    assert.match(normalizedText, /math teachers/);
    assert.match(normalizedText, /kindergarten level/);
    assert.match(normalizedText, /robotic way on learning math/);
    assert.match(normalizedText, /Unit 1 One, Two, Three/);
    assert.match(normalizedText, /Unit 2 Four and Five/);
    assert.match(normalizedText, /Unit 3 One to Five/);
    assert.match(normalizedText, /Unit 4 Six, Seven, Eight, Nine/);
    for (const word of ["one", "two", "three", "four", "five", "six", "seven", "eight", "nine"]) {
      assert.ok(countWord(text.stdout, word) > 0);
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("complete beginner volume PDF generation does not silently overwrite", async () => {
  const directory = await mkdtemp(join(tmpdir(), "beginner-volume-overwrite-test-"));
  const outputPath = join(directory, "workbook.pdf");

  try {
    await generateBeginnerVolumeOneWorkbookPdf({ outputPath, seed: 1 });
    await assert.rejects(
      () => generateBeginnerVolumeOneWorkbookPdf({ outputPath, seed: 1 }),
      /Output file already exists/
    );
    await generateBeginnerVolumeOneWorkbookPdf({ outputPath, seed: 1, overwrite: true });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

function countWord(text, word) {
  const matches = text.match(new RegExp(`\\b${word}\\b`, "gu"));
  return matches?.length ?? 0;
}

async function run(command, args) {
  const child = spawn(command, args, {
    cwd: process.cwd(),
    stdio: ["ignore", "pipe", "pipe"]
  });

  let stdout = "";
  let stderr = "";
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => {
    stdout += chunk;
  });
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
  });

  const exitCode = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`command timed out: ${command} ${args.join(" ")}`));
    }, 10000);

    child.on("error", reject);
    child.on("close", (code) => {
      clearTimeout(timeout);
      resolve(code);
    });
  });

  return { exitCode, stdout, stderr };
}
