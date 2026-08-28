import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, stat, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PassThrough, Writable } from "node:stream";
import { test } from "node:test";

import {
  centrePaneArtworkRectangle,
  centrePaneGeometry,
  centrePaneReviewArtworkRectangle,
  EmbeddedReviewArtworkManager,
  terminalBodyHeight
} from "../dist/apps/cli/interactive-menu.js";
import { runInteractiveMenu } from "../dist/apps/cli/interactive-menu.js";
import {
  createTerminalArtworkController,
  formatTerminalArtworkDiagnostics,
  iterm2ArtworkSequence,
  isSafeHighConfidenceMatteTrim,
  kittyArtworkDeleteSequence,
  kittyArtworkSequences,
  selectTerminalArtworkBackend,
  sixelHelperInvocation,
  terminalArtworkBackendValues,
  ueberzugOverlayAddMessage,
  ueberzugOverlayRemoveMessage,
  ueberzugOverlaySpawnArguments
} from "../dist/apps/cli/terminal-artwork.js";
import { runTerminalArtworkCommand } from "../dist/apps/cli/terminal-artwork-command.js";
import {
  parseMemorizationMarkdownImages,
  resolveReadingReviewArtwork
} from "../dist/packages/core/index.js";
import { InMemoryCliCommandRegistry } from "../dist/packages/core/index.js";
import {
  loadSourceLanguageSettings,
  saveTerminalArtworkBackend
} from "../dist/src/settings/source-language.js";

const helpers = (overrides = {}) => ({ ueberzugpp: false, img2sixel: false, magick: false, magickSixel: false, ...overrides });

test("terminal artwork setting enum is deliberately narrow and persists", async () => {
  assert.deepEqual(terminalArtworkBackendValues, ["auto", "wayland-overlay", "x11-overlay", "kitty", "sixel", "iterm2", "disabled"]);
  assert.equal(terminalArtworkBackendValues.includes("chafa"), false);
  assert.equal(terminalArtworkBackendValues.some((value) => /ascii|unicode/u.test(value)), false);
  const settingsDir = await mkdtemp(join(tmpdir(), "wsm-artwork-settings-"));
  try {
    assert.equal((await loadSourceLanguageSettings(settingsDir)).terminalArtworkBackend, "auto");
    await saveTerminalArtworkBackend("wayland-overlay", settingsDir);
    assert.equal((await loadSourceLanguageSettings(settingsDir)).terminalArtworkBackend, "wayland-overlay");
    await assert.rejects(() => saveTerminalArtworkBackend("chafa", settingsDir), /Invalid terminal artwork backend/u);
  } finally { await rm(settingsDir, { recursive: true, force: true }); }
});

test("Auto chooses overlay backends for local Alacritty-like Wayland and X11 fixtures", () => {
  assert.deepEqual(selectTerminalArtworkBackend({
    configuredBackend: "auto",
    env: { TERM: "alacritty", WAYLAND_DISPLAY: "wayland-1", DISPLAY: ":0" },
    helpers: helpers({ ueberzugpp: true }),
    hasSixelCellGeometry: false
  }), { selectedBackend: "wayland-overlay", ready: true });
  assert.deepEqual(selectTerminalArtworkBackend({
    configuredBackend: "auto",
    env: { TERM: "alacritty", DISPLAY: ":0" },
    helpers: helpers({ ueberzugpp: true }),
    hasSixelCellGeometry: false
  }), { selectedBackend: "x11-overlay", ready: true });
});

test("explicit override precedes native indicators and unavailable override reports safely", () => {
  assert.deepEqual(selectTerminalArtworkBackend({
    configuredBackend: "iterm2",
    env: { KITTY_WINDOW_ID: "1", WAYLAND_DISPLAY: "wayland-1" },
    helpers: helpers({ ueberzugpp: true }),
    hasSixelCellGeometry: false
  }), { selectedBackend: "iterm2", ready: true });
  const unavailable = selectTerminalArtworkBackend({
    configuredBackend: "wayland-overlay",
    env: { WAYLAND_DISPLAY: "wayland-1" },
    helpers: helpers(),
    hasSixelCellGeometry: false
  });
  assert.equal(unavailable.ready, false);
  assert.match(unavailable.reason, /Wayland overlay.*ueberzugpp/u);
});

test("TERM substring alone does not claim Kitty or Sixel support", () => {
  const selected = selectTerminalArtworkBackend({
    configuredBackend: "auto",
    env: { TERM: "xterm-kitty-sixel" },
    helpers: helpers({ magick: true, magickSixel: true }),
    hasSixelCellGeometry: true
  });
  assert.equal(selected.selectedBackend, "disabled");
  assert.equal(selected.ready, false);
});

test("Sixel requires an encoder and safe cell-pixel geometry", () => {
  assert.match(selectTerminalArtworkBackend({ configuredBackend: "sixel", env: {}, helpers: helpers(), hasSixelCellGeometry: true }).reason, /img2sixel or ImageMagick/u);
  assert.match(selectTerminalArtworkBackend({ configuredBackend: "sixel", env: {}, helpers: helpers({ img2sixel: true }), hasSixelCellGeometry: false }).reason, /cell pixel geometry/u);
  assert.equal(selectTerminalArtworkBackend({ configuredBackend: "sixel", env: {}, helpers: helpers({ magick: true, magickSixel: true }), hasSixelCellGeometry: true }).ready, true);
});

test("Kitty sequences chunk payloads, place with stable IDs, contain in cells, and delete", () => {
  const rectangle = { column: 33, row: 8, widthColumns: 40, heightRows: 12 };
  const sequences = kittyArtworkSequences({ pngData: Buffer.alloc(9000, 7), rectangle, chunkSize: 1024 });
  assert.ok(sequences.length > 1);
  assert.match(sequences[0], /a=T,f=100,t=d,i=19394561,p=1,c=40,r=12,C=1,q=2,m=1/u);
  assert.match(sequences.at(-1), /q=2,m=0/u);
  assert.ok(sequences.every((sequence) => sequence.length < 1200));
  assert.match(kittyArtworkDeleteSequence(), /a=d,d=I,i=19394561,p=1/u);
});

test("iTerm2 sequence uses cell width/height, inline mode, aspect preservation, and cursor restore", () => {
  const sequence = iterm2ArtworkSequence({ data: Buffer.from([1, 2, 3]), rectangle: { column: 20, row: 6, widthColumns: 30, heightRows: 10 } });
  assert.match(sequence, /^\x1b7\x1b\[6;20H/u);
  assert.match(sequence, /File=inline=1;width=30;height=10;preserveAspectRatio=1:/u);
  assert.match(sequence, /AQID/u);
  assert.match(sequence, /\x07\x1b8$/u);
  assert.doesNotMatch(sequence, /\/tmp|media\//u);
});

test("overlay IPC uses stdin arguments and documented add/update/remove values", () => {
  assert.deepEqual(ueberzugOverlaySpawnArguments("wayland"), ["layer", "--output", "wayland"]);
  assert.deepEqual(ueberzugOverlaySpawnArguments("x11"), ["layer", "--output", "x11"]);
  const options = artworkOptions("/trusted/package/media/prompt.png", "prompt", { column: 31, row: 7, widthColumns: 44, heightRows: 14 });
  assert.deepEqual(ueberzugOverlayAddMessage(options), {
    action: "add", identifier: "wsm-centre-pane-artwork", max_height: 14, max_width: 44,
    path: "/trusted/package/media/prompt.png", scaler: "fit_contain", x: 30, y: 6
  });
  assert.deepEqual(ueberzugOverlayRemoveMessage("wsm-centre-pane-artwork"), { action: "remove", identifier: "wsm-centre-pane-artwork" });
});

test("overlay implementation explicitly disables shells and no longer uses socket IPC", async () => {
  const source = await readFile(new URL("../apps/cli/terminal-artwork.ts", import.meta.url), "utf8");
  assert.match(source, /shell: false/u);
  assert.doesNotMatch(source, /shell: true/u);
  assert.doesNotMatch(source, /--no-stdin|createConnection|Unix socket/u);
});

test("Wayland and X11 spawn one shell-free stdin helper with exact argument arrays", async () => {
  for (const [backend, output] of [["wayland-overlay", "wayland"], ["x11-overlay", "x11"]]) {
    const harness = overlayHarness(backend);
    const controller = await harness.controller;
    await controller.start();
    await controller.show(artworkOptions("/trusted/package/media/prompt.png", "prompt"));
    await controller.show(artworkOptions("/trusted/package/media/answer.png", "answer"));
    assert.equal(harness.invocations.length, 1);
    assert.equal(harness.invocations[0].executable, "/usr/bin/ueberzugpp");
    assert.deepEqual(harness.invocations[0].args, ["layer", "--output", output]);
    assert.equal(harness.invocations[0].options.shell, false);
    assert.deepEqual(harness.invocations[0].options.stdio, ["pipe", "ignore", "pipe"]);
    await controller.shutdown();
  }
});

test("overlay writes newline-delimited replacements and removes the stable placement before shutdown", async () => {
  const harness = overlayHarness("wayland-overlay");
  const controller = await harness.controller;
  const rectangle = { column: 31, row: 7, widthColumns: 44, heightRows: 14 };
  await controller.show(artworkOptions("/trusted/package/media/prompt.png", "prompt", rectangle));
  await controller.show(artworkOptions("/trusted/package/media/answer.png", "answer", rectangle));
  await controller.shutdown();
  assert.ok(harness.child.writes.every((line) => line.endsWith("\n")));
  assert.deepEqual(harness.child.writes.map((line) => JSON.parse(line)), [
    {
      action: "add", identifier: "wsm-centre-pane-artwork", max_height: 14, max_width: 44,
      path: "/trusted/package/media/prompt.png", scaler: "fit_contain", x: 30, y: 6
    },
    {
      action: "add", identifier: "wsm-centre-pane-artwork", max_height: 14, max_width: 44,
      path: "/trusted/package/media/answer.png", scaler: "fit_contain", x: 30, y: 6
    },
    { action: "remove", identifier: "wsm-centre-pane-artwork" }
  ]);
  assert.equal(harness.child.stdin.writableEnded, true);
  assert.equal(harness.child.listenerCount("exit"), 0);
  assert.equal(harness.child.listenerCount("error"), 0);
  assert.equal(harness.child.listenerCount("spawn"), 0);
  assert.equal(harness.child.stdin.listenerCount("error"), 0);
  assert.equal(harness.child.stderr.listenerCount("data"), 0);
  assert.equal(controller.capabilities.overlayProcess.lastCommand, "remove");
});

test("the first overlay command waits for spawn success and writable stdin", async () => {
  const harness = overlayHarness("wayland-overlay", { autoSpawn: false });
  const controller = await harness.controller;
  let complete = false;
  const showing = controller.show(artworkOptions("/trusted/package/media/prompt.png", "prompt")).then(() => { complete = true; });
  await nextTurn();
  assert.equal(complete, false);
  assert.equal(harness.child.writes.length, 0);
  assert.equal(controller.capabilities.ready, false);
  harness.child.spawnSuccessfully();
  await showing;
  assert.equal(harness.child.writes.length, 1);
  assert.equal(controller.capabilities.ready, true);
  await controller.shutdown();
});

test("early overlay exit before the first show is a sticky safe failure", async () => {
  const harness = overlayHarness("wayland-overlay", { exitImmediatelyAfterSpawn: true });
  const controller = await harness.controller;
  await controller.show(artworkOptions("/trusted/package/media/prompt.png", "prompt"));
  assert.equal(controller.capabilities.ready, false);
  assert.equal(controller.capabilities.failed, true);
  assert.equal(controller.capabilities.overlayProcess.state, "failed");
  assert.equal(controller.capabilities.overlayProcess.exitedEarly, true);
  assert.equal(harness.child.writes.length, 0);
  await controller.show(artworkOptions("/trusted/package/media/answer.png", "answer"));
  assert.equal(harness.invocations.length, 1);
  await controller.shutdown();
});

test("overlay EPIPE becomes a sticky safe failure without per-card respawn", async () => {
  const harness = overlayHarness("wayland-overlay", { epipe: true });
  const controller = await harness.controller;
  await controller.show(artworkOptions("/trusted/package/media/prompt.png", "prompt"));
  assert.equal(controller.capabilities.failed, true);
  assert.equal(controller.capabilities.overlayProcess.lastCommand, "add");
  await controller.show(artworkOptions("/trusted/package/media/answer.png", "answer"));
  assert.equal(harness.invocations.length, 1);
  await controller.shutdown();
});

test("overlay command serialization waits for stdin backpressure", async () => {
  const harness = overlayHarness("wayland-overlay", { writeDelay: 20, highWaterMark: 1 });
  const controller = await harness.controller;
  let complete = false;
  const showing = controller.show(artworkOptions("/trusted/package/media/prompt.png", "prompt")).then(() => { complete = true; });
  await new Promise((resolve) => setTimeout(resolve, 5));
  assert.equal(complete, false);
  await showing;
  assert.equal(harness.child.writes.length, 1);
  await controller.shutdown();
});

test("Sixel helper invocations keep the asset path in an argument array", () => {
  const detection = detectionFixture("sixel", { img2sixel: true }, { img2sixel: "/usr/bin/img2sixel" });
  assert.deepEqual(sixelHelperInvocation(detection, "/trusted/path with spaces/prompt.png", 320, 192), {
    executable: "/usr/bin/img2sixel",
    args: ["-w", "320", "-h", "192", "/trusted/path with spaces/prompt.png"]
  });
  const magick = detectionFixture("sixel", { magick: true, magickSixel: true }, { magick: "/usr/bin/magick" });
  assert.deepEqual(sixelHelperInvocation(magick, "/trusted/path with spaces/prompt.png", 320, 192), {
    executable: "/usr/bin/magick",
    args: ["/trusted/path with spaces/prompt.png", "-resize", "320x192", "sixel:-"]
  });
});

test("centre-pane artwork rectangle remains padded inside borders and small terminals reject it", () => {
  const pane = centrePaneGeometry(160, 40);
  const rectangle = centrePaneArtworkRectangle(pane, 11, 2);
  assert.ok(rectangle);
  assert.ok(rectangle.column > pane.column);
  assert.ok(rectangle.row > pane.row);
  assert.ok(rectangle.column + rectangle.widthColumns - 1 < pane.column + pane.widthColumns - 1);
  assert.ok(rectangle.row + rectangle.heightRows - 1 < pane.row + pane.heightRows - 1);
  assert.equal(terminalBodyHeight(10), 8);
  assert.equal(centrePaneArtworkRectangle(centrePaneGeometry(50, 10), 6, 1), undefined);
});

test("Review artwork uses one fixed reserved region above Phrase and recomputes on resize", () => {
  const prompt = "Review: Animals / 1–100\nCard: 1/200\nEsc Leave Review\n[[WHACKSMACKER_REVIEW_ARTWORK_REGION]]\nPhrase:\n  • rhinoceros\n  • The rhinoceros walks toward the water.\nAnswer:\n  Answer hidden until reveal.\n[[WHACKSMACKER_REVIEW_BOTTOM_BAR]]\nEnter/Space Reveal Answer";
  const answer = prompt.replace("Answer hidden until reveal.", "• de neushoorn\n  • De neushoorn loopt naar het water.").replace("Enter/Space Reveal Answer", "1 Again   2 Hard   3 Good   4 Easy");
  const pane = centrePaneGeometry(160, 40);
  const promptRectangle = centrePaneReviewArtworkRectangle(pane, prompt, false);
  const answerRectangle = centrePaneReviewArtworkRectangle(pane, answer, false);
  assert.deepEqual(answerRectangle, promptRectangle, "reveal replaces artwork in the same geometry");
  assert.ok(promptRectangle);
  assert.ok(promptRectangle.row > pane.row, "header remains above the reserved artwork");
  assert.ok(promptRectangle.heightRows >= 4);
  assert.notDeepEqual(centrePaneReviewArtworkRectangle(centrePaneGeometry(140, 32), prompt, false), promptRectangle, "resize recomputes current pane geometry");
});

test("safe matte trim accepts the measured rhinoceros frame and rejects accepted small mattes and natural edges", () => {
  const paleCream = { means: [0.9998, 0.9806, 0.9411], deviations: [0.0009, 0.0009, 0.0007] };
  const measuredRhinoceros = {
    imageWidth: 768, imageHeight: 768,
    cropWidth: 721, cropHeight: 559, cropX: 24, cropY: 106,
    bands: [paleCream, paleCream, paleCream, paleCream]
  };
  assert.equal(isSafeHighConfidenceMatteTrim(measuredRhinoceros), true);
  assert.equal(isSafeHighConfidenceMatteTrim({ ...measuredRhinoceros, cropWidth: 720, cropHeight: 720, cropX: 24, cropY: 24 }), false, "horse/bluebird-sized mattes remain unchanged");
  assert.equal(isSafeHighConfidenceMatteTrim({ ...measuredRhinoceros, bands: [paleCream, paleCream, paleCream, { means: [0.52, 0.71, 0.92], deviations: [0.08, 0.06, 0.04] }] }), false, "non-uniform sky/water/grass-like edges are not cropped");
  assert.equal(isSafeHighConfidenceMatteTrim({ ...measuredRhinoceros, bands: [paleCream, paleCream, paleCream] }), false, "low-confidence analysis falls back to the original");
});

test("derived matte-trim display files are session-local, cached by bytes, and cleaned on shutdown", async () => {
  const root = await mkdtemp(join(tmpdir(), "wsm-matte-session-"));
  const sourcePath = join(root, "measured-rhinoceros-matte-fixture.ppm");
  try {
    const pixels = Buffer.alloc(100 * 100 * 3);
    for (let y = 0; y < 100; y += 1) for (let x = 0; x < 100; x += 1) {
      const content = x >= 20 && x < 80 && y >= 15 && y < 85;
      const offset = ((y * 100) + x) * 3;
      pixels[offset] = content ? 55 : 250;
      pixels[offset + 1] = content ? 70 : 246;
      pixels[offset + 2] = content ? 65 : 240;
    }
    const bytes = Buffer.concat([Buffer.from("P6\n100 100\n255\n"), pixels]);
    await writeFile(sourcePath, bytes);
    const harness = overlayHarness("wayland-overlay", { magick: "/usr/bin/magick" });
    const controller = await harness.controller;
    const options = { ...artworkOptions(sourcePath, "fixture"), assetData: bytes, mediaType: "image/png" };
    await controller.show(options);
    await controller.show(options);
    const adds = harness.child.writes.map((line) => JSON.parse(line)).filter((value) => value.action === "add");
    assert.equal(adds.length, 2);
    assert.equal(adds[0].path, adds[1].path, "identical validated source bytes reuse one derived path");
    assert.notEqual(adds[0].path, sourcePath);
    assert.ok((await stat(adds[0].path)).size > 0);
    assert.deepEqual(await readFile(sourcePath), bytes);
    const derivedPath = adds[0].path;
    await controller.shutdown();
    await assert.rejects(() => stat(derivedPath), /ENOENT/u);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("validated package media resolves lazily by current side and rejects URLs, symlinks, and arbitrary paths", async () => {
  const fixture = await installedArtworkFixture();
  try {
    const prompt = await resolveReadingReviewArtwork(fixture.reviewItem, "prompt", { dataDir: fixture.dataDir });
    assert.equal(prompt.altText, "Child-book dog illustration");
    assert.equal(prompt.mediaType, "image/png");
    assert.deepEqual(Buffer.from(prompt.assetData), fixture.promptBytes);
    assert.equal(prompt.assetPath, fixture.promptPath);

    await rm(fixture.answerPath);
    await symlink(fixture.promptPath, fixture.answerPath);
    await assert.rejects(() => resolveReadingReviewArtwork(fixture.reviewItem, "answer", { dataDir: fixture.dataDir }), /not a regular installed file/u);
    assert.throws(() => parseMemorizationMarkdownImages("![remote](https://example.invalid/dog.png)"), /Unsafe or unsupported/u);
    assert.throws(() => parseMemorizationMarkdownImages("![outside](../dog.png)"), /Unsafe or unsupported/u);
  } finally { await fixture.cleanup(); }
});

test("prompt/answer/next/text-only/resize/leave lifecycle uses one fake controller and contain", async () => {
  const calls = [];
  const controller = fakeController(calls);
  const terminal = { isInteractive: true, colorsEnabled: false, width: 160, height: 40, write() {}, async readKey() {}, enter() {}, restore() {} };
  const manager = new EmbeddedReviewArtworkManager(terminal, {
    terminalArtworkBackend: "wayland-overlay",
    terminalArtworkControllerFactory: async () => controller
  });
  const prompt = reviewSession("prompt", artwork("prompt"), "card-1");
  const answer = reviewSession("answer", artwork("answer"), "card-1");
  const next = reviewSession("prompt", artwork("next"), "card-2");
  const textOnly = reviewSession("prompt", undefined, "card-3");
  const paneText = "Review\nCard\n[[WHACKSMACKER_REVIEW_ARTWORK_REGION]]\nPhrase: dog\n[[WHACKSMACKER_REVIEW_BOTTOM_BAR]]\nEnter/Space Reveal Answer";
  assert.deepEqual(await manager.sync(prompt, paneText), { rendered: true });
  assert.deepEqual(await manager.sync(answer, paneText), { rendered: true });
  assert.deepEqual(await manager.sync(next, paneText), { rendered: true });
  assert.deepEqual(await manager.sync(textOnly, paneText), { rendered: false });
  await manager.sync(prompt, paneText);
  await manager.resize();
  await manager.sync(prompt, paneText);
  await manager.shutdown();
  assert.equal(calls.filter((entry) => entry[0] === "start").length, 1);
  assert.deepEqual(calls.filter((entry) => entry[0] === "show").map((entry) => [entry[1].assetPath, entry[1].fit]), [
    ["/trusted/prompt.png", "contain"], ["/trusted/answer.png", "contain"], ["/trusted/next.png", "contain"],
    ["/trusted/prompt.png", "contain"], ["/trusted/prompt.png", "contain"]
  ]);
  assert.ok(calls.filter((entry) => entry[0] === "clear").length >= 5);
  assert.equal(calls.at(-1)[0], "shutdown");
});

test("backend failure is sticky for the Review session and does not repeatedly emit", async () => {
  const writes = [];
  const detection = detectionFixture("kitty", {}, {});
  const controller = await createTerminalArtworkController({ configuredBackend: "kitty", detection, io: { writeControl: (value) => writes.push(value) } });
  await controller.start();
  const nonPng = { ...artworkOptions("/trusted/answer.webp", "answer"), mediaType: "image/webp" };
  await controller.show(nonPng);
  assert.equal(controller.capabilities.failed, true);
  const count = writes.length;
  await controller.show(nonPng);
  assert.equal(writes.length, count);
  await controller.shutdown();
});

test("diagnostics are textual and omit package paths, checksums, socket names, and control sequences", async () => {
  const detection = { ...detectionFixture("disabled", {}, {}), configuredBackend: "auto", ready: false, reason: "Artwork rendering is unavailable for this terminal." };
  const text = formatTerminalArtworkDiagnostics(detection, { column: 33, row: 6, widthColumns: 60, heightRows: 14 });
  assert.match(text, /Configured backend: Auto/u);
  assert.match(text, /Selected backend: Disabled/u);
  assert.match(text, /33,6 60x14 cells/u);
  assert.match(text, /Overlay transport: stdin/u);
  assert.match(text, /Overlay process state: stopped/u);
  assert.match(text, /Overlay stdin writable: no/u);
  assert.match(text, /Overlay helper exited early: no/u);
  assert.match(text, /Overlay last command: none/u);
  assert.doesNotMatch(text, /\/home|sha256|ueberzugpp-\d+\.socket|\x1b|prompt|answer/u);

  const settingsDir = await mkdtemp(join(tmpdir(), "wsm-artwork-command-"));
  try {
    assert.match(await runTerminalArtworkCommand(["backend", "disabled"], { settingsDir }), /Disabled/u);
    const diagnostics = await runTerminalArtworkCommand(["diagnostics"], { settingsDir, env: { PATH: "" } });
    assert.match(diagnostics, /Configured backend: Disabled/u);
  } finally { await rm(settingsDir, { recursive: true, force: true }); }
});

test("overlay startup diagnostics sanitize stderr and do not claim readiness from executable presence", async () => {
  const harness = overlayHarness("wayland-overlay", {
    startupError: true,
    stderr: "fatal: could not open /home/learner/private/ueberzug.sock\n"
  });
  const controller = await harness.controller;
  await controller.start();
  const diagnostics = formatTerminalArtworkDiagnostics(
    detectionFixture("wayland-overlay", { ueberzugpp: true }, { ueberzugpp: "/usr/bin/ueberzugpp" }),
    undefined,
    controller.capabilities.overlayProcess
  );
  assert.match(diagnostics, /Image-capable backend ready: no/u);
  assert.match(diagnostics, /Overlay process state: failed/u);
  assert.match(diagnostics, /Overlay startup stderr: fatal: could not open \[path\]/u);
  assert.doesNotMatch(diagnostics, /\/home|private\/ueberzug|action|identifier|prompt|answer/u);
  await controller.shutdown();
});

test("SIGINT and SIGTERM follow the normal terminal cleanup path", async () => {
  const previousExitCode = process.exitCode;
  try {
    for (const [signal, expectedExitCode] of [["SIGINT", 130], ["SIGTERM", 143]]) {
      process.exitCode = undefined;
      const terminal = {
        isInteractive: true, colorsEnabled: false, width: 120, height: 35, output: "", restored: 0,
        write(text) { this.output += text; },
        readKey() { return new Promise(() => {}); },
        enter() {},
        restore() { this.restored += 1; }
      };
      const running = runInteractiveMenu(new InMemoryCliCommandRegistry(), terminal);
      setTimeout(() => process.emit(signal), 10);
      await running;
      assert.equal(terminal.restored, 1);
      assert.equal(process.exitCode, expectedExitCode);
    }
  } finally { process.exitCode = previousExitCode; }
});

function artwork(name) {
  return { altText: `${name} alt`, assetPath: `/trusted/${name}.png`, assetData: Buffer.from([1, 2, 3]), mediaType: "image/png" };
}

function overlayHarness(backend, options = {}) {
  const child = new FakeOverlayChild(options);
  const invocations = [];
  const spawnHelper = (executable, args, spawnOptions) => {
    invocations.push({ executable, args: [...args], options: { ...spawnOptions, stdio: [...spawnOptions.stdio] } });
    if (options.stderr !== undefined) child.stderr.write(options.stderr);
    const launch = () => {
      if (options.startupError === true) child.failSpawn();
      else if (options.autoSpawn !== false) {
        child.spawnSuccessfully();
        if (options.exitImmediatelyAfterSpawn === true) child.exit(1, null);
      }
    };
    if (options.startupError === true) setImmediate(launch);
    else queueMicrotask(launch);
    return child;
  };
  return {
    child,
    invocations,
    controller: createTerminalArtworkController({
      configuredBackend: backend,
      detection: detectionFixture(
        backend,
        { ueberzugpp: true, ...(options.magick === undefined ? {} : { magick: true }) },
        { ueberzugpp: "/usr/bin/ueberzugpp", ...(options.magick === undefined ? {} : { magick: options.magick }) }
      ),
      io: { writeControl() {} },
      spawnHelper
    })
  };
}

class FakeOverlayChild extends EventEmitter {
  constructor(options) {
    super();
    this.exitCode = null;
    this.signalCode = null;
    this.killed = false;
    this.writes = [];
    this.stderr = new PassThrough();
    this.stdout = null;
    this.stdin = new Writable({
      highWaterMark: options.highWaterMark ?? 16384,
      write: (chunk, _encoding, callback) => {
        this.writes.push(String(chunk));
        setTimeout(() => {
          if (options.epipe === true) {
            const error = new Error("broken pipe");
            error.code = "EPIPE";
            callback(error);
          } else callback();
        }, options.writeDelay ?? 0);
      }
    });
    this.stdin.once("finish", () => this.exit(0, null));
  }

  spawnSuccessfully() { this.emit("spawn"); }

  failSpawn() {
    const error = new Error("spawn failed");
    error.code = "ENOENT";
    this.emit("error", error);
  }

  exit(code, signal) {
    if (this.exitCode !== null || this.signalCode !== null) return;
    this.exitCode = code;
    this.signalCode = signal;
    this.emit("exit", code, signal);
  }

  kill(signal = "SIGTERM") {
    this.killed = true;
    this.exit(null, signal);
    return true;
  }
}

function nextTurn() { return new Promise((resolve) => setImmediate(resolve)); }

function reviewSession(side, currentArtwork, itemId) {
  return {
    nodeId: "review-node", node: { id: "review-node", label: "Fixture", kind: "review-source" },
    items: [{ packageId: "com.example", packageVersion: "1.0.0", itemId, firstSeenAt: "2026-08-04T00:00:00Z", nextReviewAt: "2026-08-04T00:00:00Z", reviewCount: 0, intervalDays: 0, easeFactor: 2.5, lapses: 0, suspended: false }],
    index: 0, side, artwork: currentArtwork, promptRendered: {}, ...(side === "answer" ? { answerRendered: {} } : {})
  };
}

function fakeController(calls) {
  const capabilities = { configuredBackend: "wayland-overlay", selectedBackend: "wayland-overlay", ready: true, failed: false, helpers: helpers({ ueberzugpp: true }), terminalIndicators: [], graphicalSession: "Wayland" };
  return {
    selectedBackend: "wayland-overlay", capabilities,
    async start() { calls.push(["start"]); },
    async show(options) { calls.push(["show", options]); },
    async clear(identifier) { calls.push(["clear", identifier]); },
    async resize() { calls.push(["resize"]); },
    async shutdown() { calls.push(["shutdown"]); }
  };
}

function artworkOptions(assetPath, altText, rectangle = { column: 20, row: 6, widthColumns: 30, heightRows: 10 }) {
  return { identifier: "wsm-centre-pane-artwork", assetPath, assetData: Buffer.from([1, 2, 3]), mediaType: "image/png", altText, rectangle, fit: "contain" };
}

function detectionFixture(selectedBackend, helperOverrides, executables) {
  return {
    configuredBackend: selectedBackend, selectedBackend, ready: selectedBackend !== "disabled", helpers: helpers(helperOverrides), executables,
    terminalIndicators: ["TERM=test"], graphicalSession: "neither"
  };
}

async function installedArtworkFixture() {
  const root = await mkdtemp(join(tmpdir(), "wsm-terminal-artwork-media-"));
  const dataDir = join(root, "content");
  const packageId = "com.example.artwork";
  const packageVersion = "1.0.0";
  const installPath = `packages/${packageId}/${packageVersion}`;
  const packageRoot = join(dataDir, installPath);
  const promptPath = join(packageRoot, "media/prompt.png");
  const answerPath = join(packageRoot, "media/answer.png");
  const promptBytes = tinyPng(0);
  const answerBytes = tinyPng(255);
  const manifest = {
    packageFormatVersion: 1, packageId, packageVersion, displayName: "Artwork fixture", description: "Disposable test fixture.",
    contentType: "specialized-review", capabilities: ["specialized-review"], contentSchemaVersion: "1.0.0", minimumWhackSmackerVersion: "0.0.1",
    source: { repository: "https://example.invalid/artwork", commit: "0".repeat(40) }, generatedAt: "2026-08-04T00:00:00Z",
    generator: { name: "test", version: "1.0.0" }, entryPoints: [{ id: "primary", mediaType: "image/png", path: "media/prompt.png", role: "primary" }], files: [
      fileRecord("media/prompt.png", promptBytes), fileRecord("media/answer.png", answerBytes)
    ]
  };
  const registry = { registryFormatVersion: 1, updatedAt: "2026-08-04T00:00:00Z", packages: [{
    packageId, packageVersion, displayName: "Artwork fixture", contentType: "specialized-review", capabilities: ["specialized-review"],
    contentSchemaVersion: "1.0.0", minimumWhackSmackerVersion: "0.0.1", source: manifest.source,
    installedAt: "2026-08-04T00:00:00Z", installPath, manifestSha256: "0".repeat(64), archiveSha256: "1".repeat(64), archiveSize: 1, catalogueId: "test"
  }] };
  await mkdir(join(packageRoot, "media"), { recursive: true });
  await writeFile(join(packageRoot, "manifest.json"), `${JSON.stringify(manifest)}\n`);
  await writeFile(join(dataDir, "registry.json"), `${JSON.stringify(registry)}\n`);
  await writeFile(promptPath, promptBytes);
  await writeFile(answerPath, answerBytes);
  const item = {
    schemaVersion: 1, id: "animals/dog", kind: "vocabulary",
    prompt: { text: "![Child-book dog illustration](media/prompt.png)\n\ndog", mediaType: "text/markdown" },
    answer: { text: "![Wildlife dog photograph](media/answer.png)\n\nde hond", mediaType: "text/markdown" }
  };
  return {
    dataDir, promptPath, answerPath, promptBytes,
    reviewItem: { packageId, contentPackageId: packageId, packageVersion, item },
    cleanup: () => rm(root, { recursive: true, force: true })
  };
}

function fileRecord(path, data) { return { path, mediaType: "image/png", size: data.length, sha256: createHash("sha256").update(data).digest("hex") }; }

function tinyPng(gray) {
  // Two valid tiny PNG variants kept in-memory; no binary fixture is committed.
  return Buffer.from(gray === 0
    ? "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="
    : "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZQmcAAAAASUVORK5CYII=", "base64");
}
