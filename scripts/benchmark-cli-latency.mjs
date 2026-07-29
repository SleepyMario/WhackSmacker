#!/usr/bin/env node

import { performance } from "node:perf_hooks";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

const args = Object.fromEntries(process.argv.slice(2).map((value, index, all) => value.startsWith("--") ? [value.slice(2), all[index + 1]] : []).filter(Boolean));
const dataDir = args["data-dir"];
if (!dataDir) throw new Error("--data-dir is required and must point to a supported package-manager installation.");
const root = resolve(args.root ?? process.cwd());
const repetitions = Number.parseInt(args.repetitions ?? "5", 10);
const warmup = Number.parseInt(args.warmup ?? "1", 10);
const cataloguePath = args.catalogue;
const cli = await import(pathToFileURL(resolve(root, "dist/apps/cli/main.js")).href);
const menu = await import(pathToFileURL(resolve(root, "dist/apps/cli/interactive-menu.js")).href);

const key = (name, sequence = name === "return" ? "\r" : name === "q" ? "q" : "") => ({ name, sequence, ctrl: false, meta: false, shift: false });
const down = (label) => ({ label, key: key("down") });
const enter = (label) => ({ label, key: key("return") });
const scenarios = [
  {
    name: "dutch-projections",
    actions: [
      down("focus_languages"), enter("open_languages"), down("focus_arabic"), down("focus_chinese"), down("focus_dutch"), enter("expand_curriculum"),
      down("focus_read"), enter("expand_read"), down("open_chapter"),
      { label: "toggle_translation_key", key: key("t", "t") },
      { label: "focus_toggles", key: key("right") }, down("focus_view"), enter("change_view"), down("focus_translation"), enter("change_translation"), down("focus_breakdown"), enter("change_breakdown"),
      { label: "return_navigation", key: key("left") }, { label: "quit", key: key("q", "q") }
    ]
  },
  {
    name: "source",
    actions: [
      down("focus_languages"), enter("open_languages"), down("focus_arabic"), down("focus_chinese"), down("focus_dutch"), enter("expand_curriculum"),
      down("focus_read"), enter("expand_read"), down("open_chapter"), { label: "focus_toggles", key: key("right") }, enter("change_source"),
      { label: "return_navigation", key: key("left") }, { label: "quit", key: key("q", "q") }
    ]
  },
  {
    name: "dutch-review",
    actions: [
      down("focus_languages"), enter("open_languages"), down("focus_arabic"), down("focus_chinese"), down("focus_dutch"), enter("expand_curriculum"),
      down("focus_read"), down("focus_review"), enter("open_review_decks"), down("open_review_source"), enter("start_review"),
      { label: "return_from_review", key: key("q", "q") }, down("switch_review_source"), enter("start_switched_review"),
      { label: "return_from_review", key: key("q", "q") }, { label: "quit", key: key("q", "q") }
    ]
  }
];

class BenchmarkTerminal {
  constructor(actions, started) {
    this.actions = [...actions];
    this.isInteractive = true;
    this.colorsEnabled = false;
    this.width = 160;
    this.current = undefined;
    this.samples = [];
    this.started = started;
    this.firstFrameMs = undefined;
  }
  write() {
    this.firstFrameMs ??= performance.now() - this.started;
    if (this.current !== undefined) {
      this.samples.push({ label: this.current.label, durationMs: performance.now() - this.current.started });
      this.current = undefined;
    }
  }
  async readKey() {
    const action = this.actions.shift();
    if (action === undefined) throw new Error("benchmark terminal ran out of actions");
    this.current = { label: action.label, started: performance.now() };
    return action.key;
  }
  enter() {}
  restore() {}
}

const samples = new Map();
for (let iteration = 0; iteration < warmup + repetitions; iteration += 1) {
  for (const scenario of scenarios) {
    const started = performance.now();
    const terminal = new BenchmarkTerminal(scenario.actions, started);
    await menu.runInteractiveMenu(cli.createCommandRegistry(), terminal, { dataDir, cataloguePath });
    if (iteration < warmup) continue;
    const startup = samples.get("startup_to_first_frame") ?? [];
    startup.push(terminal.firstFrameMs ?? performance.now() - started);
    samples.set("startup_to_first_frame", startup);
    for (const sample of terminal.samples) {
      if (!/^(open_|expand_|change_|toggle_|start_|switch_|return_from_review)/u.test(sample.label)) continue;
      const values = samples.get(sample.label) ?? [];
      values.push(sample.durationMs);
      samples.set(sample.label, values);
    }
  }
}

const percentile = (values, fraction) => [...values].sort((left, right) => left - right)[Math.max(0, Math.ceil(values.length * fraction) - 1)] ?? 0;
const result = [...samples].map(([action, values]) => ({
  action,
  count: values.length,
  minMs: Math.min(...values),
  p50Ms: percentile(values, 0.5),
  p95Ms: percentile(values, 0.95),
  maxMs: Math.max(...values)
})).sort((left, right) => left.action.localeCompare(right.action));
console.log(JSON.stringify({ root, dataDir, repetitions, warmup, results: result }, null, 2));
