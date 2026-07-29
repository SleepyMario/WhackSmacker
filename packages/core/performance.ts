import { AsyncLocalStorage } from "node:async_hooks";
import { appendFileSync } from "node:fs";
import { performance } from "node:perf_hooks";

export type PerformanceMetadataValue = string | number | boolean | null | undefined;
export type PerformanceMetadata = Readonly<Record<string, PerformanceMetadataValue>>;

interface PerformanceSpanContext {
  readonly id: number;
}

interface PerformanceTraceEvent {
  readonly type: "span" | "counter" | "mark";
  readonly name: string;
  readonly elapsedMs: number;
  readonly spanId?: number;
  readonly parentSpanId?: number;
  readonly durationMs?: number;
  readonly value?: number;
  readonly metadata?: PerformanceMetadata;
}

const enabled = process.env.WSM_PERF === "1";
const traceFile = process.env.WSM_PERF_FILE?.trim();
const origin = performance.now();
const storage = enabled ? new AsyncLocalStorage<PerformanceSpanContext>() : undefined;
const events: PerformanceTraceEvent[] = [];
const counters = new Map<string, number>();
let nextSpanId = 1;
let flushed = false;

function safeMetadata(metadata: PerformanceMetadata | undefined): PerformanceMetadata | undefined {
  if (metadata === undefined) return undefined;
  const safe = Object.fromEntries(Object.entries(metadata).filter(([, value]) =>
    value === undefined || value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean"
  ));
  return Object.keys(safe).length === 0 ? undefined : safe;
}

function record(event: PerformanceTraceEvent): void {
  if (enabled) events.push(event);
}

export function performanceTracingEnabled(): boolean {
  return enabled;
}

export async function perfSpan<T>(name: string, metadata: PerformanceMetadata | undefined, operation: () => Promise<T>): Promise<T> {
  if (!enabled || storage === undefined) return operation();
  const spanId = nextSpanId++;
  const parentSpanId = storage.getStore()?.id;
  const started = performance.now();
  try {
    return await storage.run({ id: spanId }, operation);
  } finally {
    record({
      type: "span",
      name,
      elapsedMs: started - origin,
      spanId,
      ...(parentSpanId === undefined ? {} : { parentSpanId }),
      durationMs: performance.now() - started,
      ...(safeMetadata(metadata) === undefined ? {} : { metadata: safeMetadata(metadata) })
    });
  }
}

export function perfSpanSync<T>(name: string, metadata: PerformanceMetadata | undefined, operation: () => T): T {
  if (!enabled || storage === undefined) return operation();
  const spanId = nextSpanId++;
  const parentSpanId = storage.getStore()?.id;
  const started = performance.now();
  try {
    return storage.run({ id: spanId }, operation);
  } finally {
    record({
      type: "span",
      name,
      elapsedMs: started - origin,
      spanId,
      ...(parentSpanId === undefined ? {} : { parentSpanId }),
      durationMs: performance.now() - started,
      ...(safeMetadata(metadata) === undefined ? {} : { metadata: safeMetadata(metadata) })
    });
  }
}

export function perfCount(name: string, increment = 1): void {
  if (!enabled) return;
  counters.set(name, (counters.get(name) ?? 0) + increment);
}

export function perfMark(name: string, metadata?: PerformanceMetadata): void {
  if (!enabled) return;
  const parentSpanId = storage?.getStore()?.id;
  record({
    type: "mark",
    name,
    elapsedMs: performance.now() - origin,
    ...(parentSpanId === undefined ? {} : { parentSpanId }),
    ...(safeMetadata(metadata) === undefined ? {} : { metadata: safeMetadata(metadata) })
  });
}

export function startPerfSpan(name: string, metadata?: PerformanceMetadata): () => void {
  if (!enabled) return () => undefined;
  const spanId = nextSpanId++;
  const parentSpanId = storage?.getStore()?.id;
  const started = performance.now();
  let finished = false;
  return () => {
    if (finished) return;
    finished = true;
    record({
      type: "span",
      name,
      elapsedMs: started - origin,
      spanId,
      ...(parentSpanId === undefined ? {} : { parentSpanId }),
      durationMs: performance.now() - started,
      ...(safeMetadata(metadata) === undefined ? {} : { metadata: safeMetadata(metadata) })
    });
  };
}

export function flushPerformanceTrace(): void {
  if (!enabled || flushed) return;
  flushed = true;
  for (const [name, value] of counters) {
    events.push({ type: "counter", name, value, elapsedMs: performance.now() - origin });
  }
  const output = events.map((event) => JSON.stringify(event)).join("\n");
  if (output.length === 0) return;
  if (traceFile !== undefined && traceFile.length > 0) appendFileSync(traceFile, `${output}\n`, "utf8");
  else process.stderr.write(`${output}\n`);
}

if (enabled) {
  process.once("beforeExit", flushPerformanceTrace);
  process.once("exit", flushPerformanceTrace);
}
