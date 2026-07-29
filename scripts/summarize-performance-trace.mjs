#!/usr/bin/env node

import { readFile } from "node:fs/promises";

const paths = process.argv.slice(2);
if (paths.length === 0) {
  console.error("Usage: node scripts/summarize-performance-trace.mjs TRACE.jsonl [...]");
  process.exitCode = 1;
} else {
  const events = (await Promise.all(paths.map(async (path) =>
    (await readFile(path, "utf8")).split(/\r?\n/u).filter(Boolean).map((line) => JSON.parse(line))
  ))).flat();
  const spans = events.filter((event) => event.type === "span" && Number.isFinite(event.durationMs));
  const counters = new Map();
  for (const event of events.filter((candidate) => candidate.type === "counter")) {
    counters.set(event.name, (counters.get(event.name) ?? 0) + event.value);
  }
  const groups = new Map();
  for (const span of spans) {
    const group = groups.get(span.name) ?? [];
    group.push(span.durationMs);
    groups.set(span.name, group);
  }
  const percentile = (values, fraction) => {
    const sorted = [...values].sort((left, right) => left - right);
    return sorted[Math.max(0, Math.ceil(sorted.length * fraction) - 1)] ?? 0;
  };
  const rows = [...groups].map(([name, durations]) => ({
    name,
    count: durations.length,
    total: durations.reduce((sum, duration) => sum + duration, 0),
    min: Math.min(...durations),
    p50: percentile(durations, 0.5),
    p95: percentile(durations, 0.95),
    max: Math.max(...durations)
  })).sort((left, right) => right.total - left.total);
  console.log("Span                                      count    total ms     min ms     p50 ms     p95 ms     max ms");
  for (const row of rows) {
    console.log(`${row.name.padEnd(40)} ${String(row.count).padStart(5)} ${row.total.toFixed(2).padStart(11)} ${row.min.toFixed(2).padStart(10)} ${row.p50.toFixed(2).padStart(10)} ${row.p95.toFixed(2).padStart(10)} ${row.max.toFixed(2).padStart(10)}`);
  }
  if (counters.size > 0) {
    console.log("\nCounters");
    for (const [name, value] of [...counters].sort(([left], [right]) => left.localeCompare(right))) {
      console.log(`${name.padEnd(40)} ${value}`);
    }
  }
  const byId = new Map(spans.filter((span) => Number.isFinite(span.spanId)).map((span) => [span.spanId, span]));
  const edges = new Map();
  for (const span of spans) {
    if (!Number.isFinite(span.parentSpanId)) continue;
    const parent = byId.get(span.parentSpanId);
    if (parent === undefined) continue;
    const name = `${parent.name} -> ${span.name}`;
    const durations = edges.get(name) ?? [];
    durations.push(span.durationMs);
    edges.set(name, durations);
  }
  if (edges.size > 0) {
    console.log("\nNested contributors");
    for (const [name, durations] of [...edges].sort((left, right) => right[1].reduce((sum, value) => sum + value, 0) - left[1].reduce((sum, value) => sum + value, 0))) {
      const total = durations.reduce((sum, duration) => sum + duration, 0);
      console.log(`${name.padEnd(64)} ${String(durations.length).padStart(5)} ${total.toFixed(2).padStart(11)} ${percentile(durations, 0.5).toFixed(2).padStart(10)} ${percentile(durations, 0.95).toFixed(2).padStart(10)}`);
    }
  }
}
