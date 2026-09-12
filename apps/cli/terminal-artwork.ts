import { execFile, spawn, type ChildProcess } from "node:child_process";
import { createHash } from "node:crypto";
import { access, mkdtemp, readFile, rm } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import {
  isTerminalArtworkBackend,
  nextTerminalArtworkBackend,
  terminalArtworkBackendLabels,
  terminalArtworkBackendValues,
  type TerminalArtworkBackend
} from "../../packages/core/terminal-artwork-settings";

export {
  isTerminalArtworkBackend,
  nextTerminalArtworkBackend,
  terminalArtworkBackendLabels,
  terminalArtworkBackendValues,
  type TerminalArtworkBackend
};

export interface TerminalArtworkRectangle {
  readonly column: number;
  readonly row: number;
  readonly widthColumns: number;
  readonly heightRows: number;
}

export interface TerminalArtworkShowOptions {
  readonly identifier: string;
  readonly assetPath: string;
  readonly assetData: Uint8Array;
  readonly mediaType: "image/webp" | "image/png" | "image/jpeg";
  readonly altText: string;
  readonly rectangle: TerminalArtworkRectangle;
  readonly fit: "contain";
}

export interface TerminalArtworkHelperAvailability {
  readonly ueberzugpp: boolean;
  readonly img2sixel: boolean;
  readonly magick: boolean;
  readonly magickSixel: boolean;
}

export interface TerminalArtworkCapabilities {
  readonly configuredBackend: TerminalArtworkBackend;
  readonly selectedBackend: TerminalArtworkBackend;
  readonly ready: boolean;
  readonly failed: boolean;
  readonly reason?: string;
  readonly helpers: TerminalArtworkHelperAvailability;
  readonly terminalIndicators: readonly string[];
  readonly graphicalSession: "Wayland" | "X11" | "neither";
  readonly overlayProcess?: TerminalArtworkOverlayProcessDiagnostics;
}

export type TerminalArtworkOverlayProcessState = "spawning" | "ready" | "failed" | "stopped";

export interface TerminalArtworkOverlayProcessDiagnostics {
  readonly transport: "stdin";
  readonly state: TerminalArtworkOverlayProcessState;
  readonly stdinWritable: boolean;
  readonly exitedEarly: boolean;
  readonly stderrSummary?: string;
  readonly lastCommand?: "add" | "remove";
}

export interface TerminalArtworkController {
  readonly selectedBackend: TerminalArtworkBackend;
  readonly capabilities: TerminalArtworkCapabilities;
  start(): Promise<void>;
  show(options: TerminalArtworkShowOptions): Promise<void>;
  clear(identifier?: string): Promise<void>;
  resize(): Promise<void>;
  shutdown(): Promise<void>;
}

export interface TerminalArtworkIo {
  writeControl(data: string | Uint8Array): void;
  readonly cellPixelWidth?: number;
  readonly cellPixelHeight?: number;
}

export interface TerminalArtworkEnvironment {
  readonly TERM?: string;
  readonly TERM_PROGRAM?: string;
  readonly LC_TERMINAL?: string;
  readonly WAYLAND_DISPLAY?: string;
  readonly DISPLAY?: string;
  readonly XDG_SESSION_TYPE?: string;
  readonly XDG_RUNTIME_DIR?: string;
  readonly PATH?: string;
  readonly KITTY_WINDOW_ID?: string;
  readonly ITERM_SESSION_ID?: string;
  readonly WSM_SIXEL_SUPPORTED?: string;
  readonly WSM_TERMINAL_CELL_WIDTH_PX?: string;
  readonly WSM_TERMINAL_CELL_HEIGHT_PX?: string;
  readonly [name: string]: string | undefined;
}

export interface TerminalArtworkDetection {
  readonly configuredBackend: TerminalArtworkBackend;
  readonly selectedBackend: TerminalArtworkBackend;
  readonly ready: boolean;
  readonly reason?: string;
  readonly helpers: TerminalArtworkHelperAvailability;
  readonly executables: {
    readonly kitty?: string;
    readonly ueberzugpp?: string;
    readonly img2sixel?: string;
    readonly magick?: string;
  };
  readonly terminalIndicators: readonly string[];
  readonly graphicalSession: "Wayland" | "X11" | "neither";
}

export interface CreateTerminalArtworkControllerOptions {
  readonly configuredBackend?: TerminalArtworkBackend;
  readonly env?: TerminalArtworkEnvironment;
  readonly io: TerminalArtworkIo;
  readonly detection?: TerminalArtworkDetection;
  readonly spawnHelper?: TerminalArtworkSpawn;
}

export type TerminalArtworkSpawn = (
  executable: string,
  args: readonly string[],
  options: {
    readonly shell: false;
    readonly stdio: readonly [("pipe" | "ignore" | "inherit"), ("pipe" | "ignore" | "inherit"), ("pipe" | "ignore" | "inherit")];
    readonly env: NodeJS.ProcessEnv;
  }
) => ChildProcess;

export function selectTerminalArtworkBackend(options: {
  readonly configuredBackend: TerminalArtworkBackend;
  readonly env: TerminalArtworkEnvironment;
  readonly helpers: TerminalArtworkHelperAvailability;
  readonly hasSixelCellGeometry: boolean;
}): { readonly selectedBackend: TerminalArtworkBackend; readonly ready: boolean; readonly reason?: string } {
  const configured = options.configuredBackend;
  if (configured !== "auto") return explicitSelection(configured, options);

  if (hasKittyIndicator(options.env)) return { selectedBackend: "kitty", ready: true };
  if (hasIterm2Indicator(options.env)) return { selectedBackend: "iterm2", ready: true };
  if (nonEmpty(options.env.WAYLAND_DISPLAY) && options.helpers.ueberzugpp) return { selectedBackend: "wayland-overlay", ready: true };
  if (nonEmpty(options.env.DISPLAY) && options.helpers.ueberzugpp) return { selectedBackend: "x11-overlay", ready: true };
  if (options.env.WSM_SIXEL_SUPPORTED === "1" && sixelEncoderAvailable(options.helpers) && options.hasSixelCellGeometry) {
    return { selectedBackend: "sixel", ready: true };
  }
  return {
    selectedBackend: "disabled",
    ready: false,
    reason: "Artwork rendering is unavailable for this terminal."
  };
}

function explicitSelection(
  backend: Exclude<TerminalArtworkBackend, "auto">,
  options: {
    readonly env: TerminalArtworkEnvironment;
    readonly helpers: TerminalArtworkHelperAvailability;
    readonly hasSixelCellGeometry: boolean;
  }
): { readonly selectedBackend: TerminalArtworkBackend; readonly ready: boolean; readonly reason?: string } {
  if (backend === "disabled") return { selectedBackend: backend, ready: false, reason: "Terminal artwork is disabled." };
  if (backend === "wayland-overlay" && (!nonEmpty(options.env.WAYLAND_DISPLAY) || !options.helpers.ueberzugpp)) {
    return unavailable(backend, !nonEmpty(options.env.WAYLAND_DISPLAY) ? "a local Wayland display" : "the ueberzugpp executable");
  }
  if (backend === "x11-overlay" && (!nonEmpty(options.env.DISPLAY) || !options.helpers.ueberzugpp)) {
    return unavailable(backend, !nonEmpty(options.env.DISPLAY) ? "a local X11 display" : "the ueberzugpp executable");
  }
  if (backend === "sixel" && !sixelEncoderAvailable(options.helpers)) return unavailable(backend, "img2sixel or ImageMagick with SIXEL support");
  if (backend === "sixel" && !options.hasSixelCellGeometry) return unavailable(backend, "terminal cell pixel geometry");
  return { selectedBackend: backend, ready: true };
}

function unavailable(backend: TerminalArtworkBackend, requirement: string): { readonly selectedBackend: TerminalArtworkBackend; readonly ready: false; readonly reason: string } {
  return {
    selectedBackend: backend,
    ready: false,
    reason: `${terminalArtworkBackendLabels[backend]} artwork is unavailable; it requires ${requirement}.`
  };
}

export async function detectTerminalArtwork(
  configuredBackend: TerminalArtworkBackend = "auto",
  env: TerminalArtworkEnvironment = process.env
): Promise<TerminalArtworkDetection> {
  const [kitty, ueberzugpp, img2sixel, magick] = await Promise.all([
    findExecutable("kitty", env),
    findExecutable("ueberzugpp", env),
    findExecutable("img2sixel", env),
    findExecutable("magick", env)
  ]);
  const magickSixel = magick === undefined ? false : await imageMagickSupportsSixel(magick);
  const helpers = { ueberzugpp: ueberzugpp !== undefined, img2sixel: img2sixel !== undefined, magick: magick !== undefined, magickSixel };
  const hasSixelCellGeometry = cellPixelSize(env) !== undefined;
  const selection = selectTerminalArtworkBackend({ configuredBackend, env, helpers, hasSixelCellGeometry });
  return {
    configuredBackend,
    ...selection,
    helpers,
    executables: {
      ...(kitty === undefined ? {} : { kitty }),
      ...(ueberzugpp === undefined ? {} : { ueberzugpp }),
      ...(img2sixel === undefined ? {} : { img2sixel }),
      ...(magick === undefined ? {} : { magick })
    },
    terminalIndicators: terminalIndicators(env),
    graphicalSession: graphicalSession(env)
  };
}

export async function createTerminalArtworkController(options: CreateTerminalArtworkControllerOptions): Promise<TerminalArtworkController> {
  const env = options.env ?? process.env;
  const detection = options.detection ?? await detectTerminalArtwork(options.configuredBackend ?? "auto", env);
  const backend = detection.ready
    ? createBackend(detection, env, options.io, options.spawnHelper)
    : new DisabledArtworkBackend();
  return new ManagedTerminalArtworkController(detection, backend);
}

interface ArtworkBackendAdapter {
  start(): Promise<void>;
  show(options: TerminalArtworkShowOptions): Promise<void>;
  clear(identifier?: string): Promise<void>;
  resize(): Promise<void>;
  shutdown(): Promise<void>;
  failureReason?(): string | undefined;
  overlayProcessDiagnostics?(): TerminalArtworkOverlayProcessDiagnostics;
}

class ManagedTerminalArtworkController implements TerminalArtworkController {
  private started = false;
  private failed = false;
  private failureReason: string | undefined;
  private failedOverlayProcess: TerminalArtworkOverlayProcessDiagnostics | undefined;
  private readonly displayPreparer: SessionArtworkDisplayPreparer;

  constructor(private readonly detection: TerminalArtworkDetection, private readonly backend: ArtworkBackendAdapter) {
    this.displayPreparer = new SessionArtworkDisplayPreparer(detection.executables.magick);
  }

  get selectedBackend(): TerminalArtworkBackend { return this.detection.selectedBackend; }
  get capabilities(): TerminalArtworkCapabilities {
    const backendFailureReason = this.backend.failureReason?.();
    const failed = this.failed || backendFailureReason !== undefined;
    const overlayProcess = this.failedOverlayProcess ?? this.backend.overlayProcessDiagnostics?.();
    return {
      configuredBackend: this.detection.configuredBackend,
      selectedBackend: this.detection.selectedBackend,
      ready: this.detection.ready && this.started && !failed,
      failed,
      ...(this.failureReason === undefined && backendFailureReason === undefined && this.detection.reason === undefined
        ? {}
        : { reason: this.failureReason ?? backendFailureReason ?? this.detection.reason }),
      helpers: this.detection.helpers,
      terminalIndicators: this.detection.terminalIndicators,
      graphicalSession: this.detection.graphicalSession,
      ...(overlayProcess === undefined ? {} : { overlayProcess })
    };
  }

  async start(): Promise<void> {
    if (this.started || this.failed || !this.detection.ready) return;
    try {
      await this.backend.start();
      this.started = true;
    } catch (error) {
      await this.fail(error);
    }
  }

  async show(options: TerminalArtworkShowOptions): Promise<void> {
    if (this.failed || this.backend.failureReason?.() !== undefined || !this.detection.ready) return;
    if (!this.started) await this.start();
    if (!this.capabilities.ready) return;
    try { await this.backend.show(await this.displayPreparer.prepare(options)); } catch (error) { await this.fail(error); }
  }

  async clear(identifier?: string): Promise<void> {
    if (!this.started) return;
    try { await this.backend.clear(identifier); } catch (error) { await this.fail(error); }
  }

  async resize(): Promise<void> {
    if (!this.started || this.failed) return;
    try { await this.backend.resize(); } catch (error) { await this.fail(error); }
  }

  async shutdown(): Promise<void> {
    try { await this.backend.shutdown(); } finally {
      await this.displayPreparer.shutdown();
      this.started = false;
    }
  }

  private async fail(error: unknown): Promise<void> {
    if (this.failed) return;
    this.failed = true;
    this.failureReason = `Artwork rendering failed for this Review session: ${safeErrorMessage(error)}`;
    this.failedOverlayProcess = this.backend.overlayProcessDiagnostics?.();
    try { await this.backend.clear(); } catch { /* best-effort stale-placement cleanup */ }
    try { await this.backend.shutdown(); } catch { /* best-effort helper cleanup */ }
  }
}

interface MatteBandStatistics {
  readonly means: readonly [number, number, number];
  readonly deviations: readonly [number, number, number];
}

export interface SafeMatteTrimAnalysis {
  readonly imageWidth: number;
  readonly imageHeight: number;
  readonly cropWidth: number;
  readonly cropHeight: number;
  readonly cropX: number;
  readonly cropY: number;
  readonly bands: readonly MatteBandStatistics[];
}

export function isSafeHighConfidenceMatteTrim(analysis: SafeMatteTrimAnalysis): boolean {
  const right = analysis.imageWidth - analysis.cropX - analysis.cropWidth;
  const bottom = analysis.imageHeight - analysis.cropY - analysis.cropHeight;
  const margins = [analysis.cropX, analysis.cropY, right, bottom];
  const minimumMargin = Math.max(2, Math.floor(Math.min(analysis.imageWidth, analysis.imageHeight) * 0.01));
  const materiallyLarge = Math.ceil(Math.min(analysis.imageWidth, analysis.imageHeight) * 0.08);
  if (analysis.imageWidth <= 0 || analysis.imageHeight <= 0 || analysis.cropWidth <= 0 || analysis.cropHeight <= 0) return false;
  if (analysis.cropX < 0 || analysis.cropY < 0 || right < 0 || bottom < 0) return false;
  if (margins.some((margin) => margin < minimumMargin) || margins.every((margin) => margin < materiallyLarge)) return false;
  if (analysis.bands.length !== 4) return false;
  return analysis.bands.every((band) => {
    const minimum = Math.min(...band.means);
    const maximum = Math.max(...band.means);
    return minimum >= 0.9
      && maximum <= 1
      && maximum - minimum <= 0.08
      && band.deviations.every((deviation) => deviation >= 0 && deviation <= 0.02);
  });
}

class SessionArtworkDisplayPreparer {
  private readonly cached = new Map<string, Promise<TerminalArtworkShowOptions>>();
  private directory: string | undefined;

  constructor(private readonly magick?: string) {}

  async prepare(options: TerminalArtworkShowOptions): Promise<TerminalArtworkShowOptions> {
    if (this.magick === undefined) return options;
    const identity = createHash("sha256").update(options.assetData).digest("hex");
    const existing = this.cached.get(identity);
    if (existing !== undefined) return existing;
    const prepared = this.prepareUncached(options, identity).catch(() => options);
    this.cached.set(identity, prepared);
    return prepared;
  }

  async shutdown(): Promise<void> {
    this.cached.clear();
    const directory = this.directory;
    this.directory = undefined;
    if (directory !== undefined) await rm(directory, { recursive: true, force: true }).catch(() => undefined);
  }

  private async prepareUncached(options: TerminalArtworkShowOptions, identity: string): Promise<TerminalArtworkShowOptions> {
    if (this.directory === undefined) this.directory = await mkdtemp(join(tmpdir(), "whacksmacker-artwork-display-"));
    const outputPath = join(this.directory, `${identity}.png`);
    return prepareTerminalArtworkDisplayAsset(options, this.magick as string, outputPath);
  }
}

export async function prepareTerminalArtworkDisplayAsset(
  options: TerminalArtworkShowOptions,
  magick: string,
  outputPath: string
): Promise<TerminalArtworkShowOptions> {
  const analysis = await analyzeMatteTrim(magick, options.assetPath);
  if (analysis === undefined || !isSafeHighConfidenceMatteTrim(analysis)) return options;
  await execFileText(magick, [
    options.assetPath,
    "-crop", `${analysis.cropWidth}x${analysis.cropHeight}+${analysis.cropX}+${analysis.cropY}`,
    "+repage",
    "-define", "png:exclude-chunks=date,time",
    outputPath
  ]);
  return { ...options, assetPath: outputPath, assetData: await readFile(outputPath), mediaType: "image/png" };
}

async function analyzeMatteTrim(magick: string, assetPath: string): Promise<SafeMatteTrimAnalysis | undefined> {
  const dimensions = parseDimensions(await execFileText(magick, [assetPath, "-format", "%w %h", "info:"]));
  const geometry = parseTrimGeometry(await execFileText(magick, [assetPath, "-fuzz", "1%", "-trim", "-format", "%w %h %X %Y", "info:"]));
  if (dimensions === undefined || geometry === undefined) return undefined;
  const right = dimensions.width - geometry.x - geometry.width;
  const bottom = dimensions.height - geometry.y - geometry.height;
  if ([geometry.x, geometry.y, right, bottom].some((value) => value <= 0)) return undefined;
  const bandGeometries = [
    `${dimensions.width}x${geometry.y}+0+0`,
    `${dimensions.width}x${bottom}+0+${geometry.y + geometry.height}`,
    `${geometry.x}x${dimensions.height}+0+0`,
    `${right}x${dimensions.height}+${geometry.x + geometry.width}+0`
  ];
  const bands = await Promise.all(bandGeometries.map(async (band) => parseBandStatistics(await execFileText(magick, [
    assetPath,
    "-crop", band,
    "-colorspace", "sRGB",
    "-format", "%[fx:mean.r],%[fx:mean.g],%[fx:mean.b];%[fx:standard_deviation.r],%[fx:standard_deviation.g],%[fx:standard_deviation.b]",
    "info:"
  ]))));
  if (bands.some((band) => band === undefined)) return undefined;
  return {
    imageWidth: dimensions.width,
    imageHeight: dimensions.height,
    cropWidth: geometry.width,
    cropHeight: geometry.height,
    cropX: geometry.x,
    cropY: geometry.y,
    bands: bands as MatteBandStatistics[]
  };
}

function parseDimensions(value: string): { readonly width: number; readonly height: number } | undefined {
  const match = /^(\d+)\s+(\d+)$/u.exec(value.trim());
  if (match === null) return undefined;
  return { width: Number(match[1]), height: Number(match[2]) };
}

function parseTrimGeometry(value: string): { readonly width: number; readonly height: number; readonly x: number; readonly y: number } | undefined {
  const match = /^(\d+)\s+(\d+)\s+\+(\d+)\s+\+(\d+)$/u.exec(value.trim());
  if (match === null) return undefined;
  return { width: Number(match[1]), height: Number(match[2]), x: Number(match[3]), y: Number(match[4]) };
}

function parseBandStatistics(value: string): MatteBandStatistics | undefined {
  const parts = value.trim().split(";").map((part) => part.split(",").map(Number));
  if (parts.length !== 2 || parts.some((part) => part.length !== 3 || part.some((number) => !Number.isFinite(number)))) return undefined;
  return { means: parts[0] as [number, number, number], deviations: parts[1] as [number, number, number] };
}

class DisabledArtworkBackend implements ArtworkBackendAdapter {
  async start(): Promise<void> {}
  async show(): Promise<void> {}
  async clear(): Promise<void> {}
  async resize(): Promise<void> {}
  async shutdown(): Promise<void> {}
}

function createBackend(
  detection: TerminalArtworkDetection,
  env: TerminalArtworkEnvironment,
  io: TerminalArtworkIo,
  spawnHelper: TerminalArtworkSpawn = defaultTerminalArtworkSpawn
): ArtworkBackendAdapter {
  switch (detection.selectedBackend) {
    case "wayland-overlay":
    case "x11-overlay":
      return new UeberzugOverlayBackend(detection.selectedBackend, detection.executables.ueberzugpp as string, env, spawnHelper);
    case "kitty": return new KittyArtworkBackend(io, detection.executables.magick, detection.executables.kitty, env, spawnHelper);
    case "iterm2": return new Iterm2ArtworkBackend(io);
    case "sixel": return new SixelArtworkBackend(io, detection, env);
    default: return new DisabledArtworkBackend();
  }
}

const defaultTerminalArtworkSpawn: TerminalArtworkSpawn = (executable, args, options) => spawn(executable, [...args], {
  shell: options.shell,
  stdio: [...options.stdio],
  env: options.env
});

const stoppedOverlayDiagnostics: TerminalArtworkOverlayProcessDiagnostics = {
  transport: "stdin",
  state: "stopped",
  stdinWritable: false,
  exitedEarly: false
};
let activeOverlayDiagnostics: TerminalArtworkOverlayProcessDiagnostics = stoppedOverlayDiagnostics;

export function getActiveTerminalArtworkOverlayDiagnostics(): TerminalArtworkOverlayProcessDiagnostics {
  return activeOverlayDiagnostics;
}

class UeberzugOverlayBackend implements ArtworkBackendAdapter {
  private child: ChildProcess | undefined;
  private state: TerminalArtworkOverlayProcessState = "stopped";
  private exited = false;
  private exitedEarly = false;
  private shuttingDown = false;
  private currentIdentifier: string | undefined;
  private lastCommand: "add" | "remove" | undefined;
  private stderrText = "";
  private stderrSummary: string | undefined;
  private writeQueue: Promise<void> = Promise.resolve();

  private readonly onChildExit = (): void => {
    this.exited = true;
    if (!this.shuttingDown && this.state !== "stopped") {
      this.exitedEarly = true;
      this.markFailed("the ueberzugpp helper exited early");
    }
  };
  private readonly onChildError = (): void => {
    if (!this.shuttingDown) this.markFailed("the ueberzugpp helper could not be spawned");
  };
  private readonly onStdinError = (error: NodeJS.ErrnoException): void => {
    if (this.shuttingDown) return;
    this.markFailed(error.code === "EPIPE"
      ? "the ueberzugpp stdin stream closed"
      : "the ueberzugpp stdin stream failed");
  };
  private readonly onStderrData = (chunk: string | Buffer): void => {
    if (this.stderrText.length >= 8192) return;
    this.stderrText = `${this.stderrText}${String(chunk)}`.slice(-8192);
    if (this.state === "failed" && this.lastCommand === undefined) {
      this.stderrSummary = sanitizedStderrSummary(this.stderrText);
      this.publishDiagnostics();
    }
  };

  constructor(
    private readonly mode: "wayland-overlay" | "x11-overlay",
    private readonly executable: string,
    private readonly env: TerminalArtworkEnvironment,
    private readonly spawnHelper: TerminalArtworkSpawn
  ) {}

  async start(): Promise<void> {
    if (this.state !== "stopped" || this.child !== undefined) return;
    this.shuttingDown = false;
    this.exited = false;
    this.state = "spawning";
    this.publishDiagnostics();
    const output = this.mode === "wayland-overlay" ? "wayland" : "x11";
    try {
      this.child = this.spawnHelper(this.executable, ueberzugOverlaySpawnArguments(output), {
        shell: false,
        stdio: ["pipe", "ignore", "pipe"],
        env: { ...process.env, ...this.env }
      });
    } catch {
      this.markFailed("the ueberzugpp helper could not be spawned");
      throw new Error("the ueberzugpp helper could not be spawned");
    }
    const child = this.child;
    child.on("exit", this.onChildExit);
    child.on("error", this.onChildError);
    child.stdin?.on("error", this.onStdinError);
    child.stderr?.on("data", this.onStderrData);

    await new Promise<void>((resolve, reject) => {
      const onSpawn = (): void => {
        cleanupStartupListeners();
        if (this.exited || child.exitCode !== null || child.stdin === null || !child.stdin.writable || child.stdin.destroyed) {
          this.exitedEarly = this.exited || child.exitCode !== null;
          this.markFailed("the ueberzugpp helper exited before stdin became writable");
          reject(new Error("the ueberzugpp helper exited before stdin became writable"));
          return;
        }
        this.state = "ready";
        this.publishDiagnostics();
        resolve();
      };
      const onStartupError = (): void => {
        cleanupStartupListeners();
        this.markFailed("the ueberzugpp helper could not be spawned");
        reject(new Error("the ueberzugpp helper could not be spawned"));
      };
      const onStartupExit = (): void => {
        cleanupStartupListeners();
        this.exitedEarly = true;
        this.markFailed("the ueberzugpp helper exited before stdin became writable");
        reject(new Error("the ueberzugpp helper exited before stdin became writable"));
      };
      const cleanupStartupListeners = (): void => {
        child.off("spawn", onSpawn);
        child.off("error", onStartupError);
        child.off("exit", onStartupExit);
      };
      child.once("spawn", onSpawn);
      child.once("error", onStartupError);
      child.once("exit", onStartupExit);
    });
  }

  async show(options: TerminalArtworkShowOptions): Promise<void> {
    this.assertReady();
    if (this.currentIdentifier !== undefined && this.currentIdentifier !== options.identifier) await this.clear(this.currentIdentifier);
    await this.enqueueCommand(ueberzugOverlayAddMessage(options), "add");
    this.currentIdentifier = options.identifier;
  }

  async clear(identifier?: string): Promise<void> {
    const target = identifier ?? this.currentIdentifier;
    if (target === undefined || this.state !== "ready") return;
    await this.enqueueCommand(ueberzugOverlayRemoveMessage(target), "remove");
    if (target === this.currentIdentifier) this.currentIdentifier = undefined;
  }

  async resize(): Promise<void> { await this.clear(); }

  async shutdown(): Promise<void> {
    try {
      await this.writeQueue;
      if (this.state === "ready") await this.clear();
    } catch { /* helper may have already closed its stream */ }
    this.shuttingDown = true;
    const child = this.child;
    if (child !== undefined) {
      try { if (child.stdin !== null && !child.stdin.destroyed) child.stdin.end(); } catch { /* already closed */ }
      if (!await this.waitForExit(300)) {
        try { child.kill("SIGTERM"); } catch { /* already gone */ }
      }
      if (!await this.waitForExit(300)) {
        try { child.kill("SIGKILL"); } catch { /* already gone */ }
        await this.waitForExit(300);
      }
      child.off("exit", this.onChildExit);
      child.off("error", this.onChildError);
      child.stdin?.off("error", this.onStdinError);
      child.stderr?.off("data", this.onStderrData);
    }
    this.child = undefined;
    this.currentIdentifier = undefined;
    this.state = "stopped";
    this.publishDiagnostics();
  }

  failureReason(): string | undefined {
    if (this.state !== "failed") return undefined;
    return this.stderrSummary === undefined
      ? "Artwork rendering failed for this Review session: the ueberzugpp helper is unavailable."
      : `Artwork rendering failed for this Review session: the ueberzugpp helper is unavailable (${this.stderrSummary}).`;
  }

  overlayProcessDiagnostics(): TerminalArtworkOverlayProcessDiagnostics {
    return {
      transport: "stdin",
      state: this.state,
      stdinWritable: this.stdinWritable(),
      exitedEarly: this.exitedEarly,
      ...(this.stderrSummary === undefined ? {} : { stderrSummary: this.stderrSummary }),
      ...(this.lastCommand === undefined ? {} : { lastCommand: this.lastCommand })
    };
  }

  private enqueueCommand(value: unknown, command: "add" | "remove"): Promise<void> {
    const pending = this.writeQueue.then(() => this.writeCommand(value, command));
    this.writeQueue = pending.catch(() => undefined);
    return pending;
  }

  private writeCommand(value: unknown, command: "add" | "remove"): Promise<void> {
    this.assertReady();
    const child = this.child as ChildProcess;
    const stdin = child.stdin;
    if (stdin === null) throw new Error("the ueberzugpp stdin stream is unavailable");
    this.lastCommand = command;
    this.publishDiagnostics();
    const line = `${JSON.stringify(value)}\n`;
    return new Promise<void>((resolve, reject) => {
      let callbackComplete = false;
      let drainComplete = true;
      let settled = false;
      const finish = (): void => {
        if (!settled && callbackComplete && drainComplete) {
          settled = true;
          cleanup();
          resolve();
        }
      };
      const fail = (message: string): void => {
        if (settled) return;
        settled = true;
        cleanup();
        this.markFailed(message);
        reject(new Error(message));
      };
      const onError = (error: NodeJS.ErrnoException): void => fail(error.code === "EPIPE"
        ? "the ueberzugpp stdin stream closed"
        : "the ueberzugpp stdin stream failed");
      const onExit = (): void => fail("the ueberzugpp helper exited while receiving a command");
      const onDrain = (): void => { drainComplete = true; finish(); };
      const cleanup = (): void => {
        stdin.off("error", onError);
        stdin.off("drain", onDrain);
        child.off("exit", onExit);
      };
      stdin.once("error", onError);
      child.once("exit", onExit);
      try {
        const accepted = stdin.write(line, "utf8", (error?: Error | null) => {
          if (error !== undefined && error !== null) {
            onError(error as NodeJS.ErrnoException);
            return;
          }
          callbackComplete = true;
          finish();
        });
        if (!accepted) {
          drainComplete = false;
          stdin.once("drain", onDrain);
        }
      } catch (error) {
        onError(error as NodeJS.ErrnoException);
      }
    });
  }

  private assertReady(): void {
    if (this.state !== "ready" || this.exited || !this.stdinWritable()) {
      throw new Error("the ueberzugpp helper is not ready");
    }
  }

  private stdinWritable(): boolean {
    return this.child?.stdin !== null
      && this.child?.stdin !== undefined
      && this.child.stdin.writable
      && !this.child.stdin.destroyed
      && !this.child.stdin.writableEnded;
  }

  private markFailed(_reason: string): void {
    if (this.shuttingDown || this.state === "stopped") return;
    this.state = "failed";
    if (this.lastCommand === undefined) this.stderrSummary = sanitizedStderrSummary(this.stderrText);
    this.publishDiagnostics();
  }

  private publishDiagnostics(): void {
    activeOverlayDiagnostics = this.overlayProcessDiagnostics();
  }

  private async waitForExit(timeoutMilliseconds: number): Promise<boolean> {
    const child = this.child;
    if (child === undefined || this.exited || child.exitCode !== null) return true;
    return new Promise((resolve) => {
      const onExit = (): void => { cleanup(); resolve(true); };
      const timer = setTimeout(() => { cleanup(); resolve(false); }, timeoutMilliseconds);
      const cleanup = (): void => { clearTimeout(timer); child.off("exit", onExit); };
      child.once("exit", onExit);
    });
  }
}

export function ueberzugOverlaySpawnArguments(output: "wayland" | "x11"): readonly string[] {
  return ["layer", "--output", output];
}

export function ueberzugOverlayAddMessage(options: TerminalArtworkShowOptions): Readonly<Record<string, unknown>> {
  return {
    action: "add",
    identifier: options.identifier,
    max_height: options.rectangle.heightRows,
    max_width: options.rectangle.widthColumns,
    path: options.assetPath,
    scaler: "fit_contain",
    x: options.rectangle.column - 1,
    y: options.rectangle.row - 1
  };
}

export function ueberzugOverlayRemoveMessage(identifier: string): Readonly<Record<string, unknown>> {
  return { action: "remove", identifier };
}

const kittyImageId = 19394561;
const kittyPlacementId = 1;

export function kittyArtworkSequences(options: {
  readonly pngData: Uint8Array;
  readonly rectangle: TerminalArtworkRectangle;
  readonly chunkSize?: number;
}): readonly string[] {
  // Kitty limits each encoded payload to 4096 bytes. Split the original data
  // on a three-byte boundary and encode each part independently, matching the
  // proven Streamchat implementation and avoiding ambiguous base64 fragments.
  const encodedChunkSize = options.chunkSize ?? 4096;
  const rawChunkSize = Math.max(3, Math.floor(encodedChunkSize / 4) * 3);
  const data = Buffer.from(options.pngData);
  const chunks: string[] = [];
  for (let offset = 0; offset < data.length; offset += rawChunkSize) {
    chunks.push(data.subarray(offset, offset + rawChunkSize).toString("base64"));
  }
  if (chunks.length === 0) chunks.push("");
  return chunks.map((payload, index) => {
    const first = index === 0;
    const more = index < chunks.length - 1 ? 1 : 0;
    const keys = first
      ? `a=T,f=100,i=${kittyImageId},p=${kittyPlacementId},c=${options.rectangle.widthColumns},r=${options.rectangle.heightRows},C=1,m=${more},q=2`
      : `q=2,m=${more}`;
    return `\x1b_G${keys};${payload}\x1b\\`;
  });
}

export function kittyArtworkDeleteSequence(): string {
  return `\x1b_Ga=d,d=I,i=${kittyImageId},q=2;\x1b\\`;
}

export function kittyIcatInvocation(assetPath: string, rectangle: TerminalArtworkRectangle): {
  readonly args: readonly string[];
} {
  return {
    args: [
      "+kitten", "icat",
      "--transfer-mode", "stream",
      "--place", `${rectangle.widthColumns}x${rectangle.heightRows}@${rectangle.column - 1}x${rectangle.row - 1}`,
      "--align", "center",
      "--scale-up",
      "--stdin", "no",
      "--image-id", String(kittyImageId),
      "--no-trailing-newline",
      assetPath
    ]
  };
}

class KittyArtworkBackend implements ArtworkBackendAdapter {
  private currentRectangle: TerminalArtworkRectangle | undefined;
  constructor(
    private readonly io: TerminalArtworkIo,
    private readonly magick?: string,
    private readonly kitty?: string,
    private readonly env: TerminalArtworkEnvironment = process.env,
    private readonly spawnHelper: TerminalArtworkSpawn = defaultTerminalArtworkSpawn
  ) {}
  async start(): Promise<void> {}
  async show(options: TerminalArtworkShowOptions): Promise<void> {
    await this.clear();
    if (this.kitty !== undefined) {
      await this.showWithIcat(options);
      this.currentRectangle = options.rectangle;
      return;
    }
    const pngData = options.mediaType === "image/png" ? options.assetData : await convertToPng(options.assetPath, this.magick);
    this.io.writeControl("\x1b7");
    this.io.writeControl(cursorPosition(options.rectangle.row, options.rectangle.column));
    for (const sequence of kittyArtworkSequences({ pngData, rectangle: options.rectangle })) this.io.writeControl(sequence);
    this.io.writeControl("\x1b8");
    this.currentRectangle = options.rectangle;
  }
  async clear(): Promise<void> {
    if (this.currentRectangle === undefined) return;
    this.io.writeControl(kittyArtworkDeleteSequence());
    this.currentRectangle = undefined;
  }
  async resize(): Promise<void> { await this.clear(); }
  async shutdown(): Promise<void> { await this.clear(); }

  private async showWithIcat(options: TerminalArtworkShowOptions): Promise<void> {
    const invocation = kittyIcatInvocation(options.assetPath, options.rectangle);
    this.io.writeControl("\x1b7");
    try {
      await new Promise<void>((resolve, reject) => {
        let stderr = "";
        const child = this.spawnHelper(this.kitty as string, invocation.args, {
          shell: false,
          stdio: ["inherit", "inherit", "pipe"],
          env: { ...process.env, ...this.env }
        });
        child.stderr?.on("data", (chunk) => { stderr = `${stderr}${String(chunk)}`.slice(-512); });
        child.once("error", () => reject(new Error("Kitty's image helper could not be started.")));
        child.once("exit", (code) => code === 0
          ? resolve()
          : reject(new Error(`Kitty's image helper failed${stderr.trim() === "" ? "." : `: ${safeErrorMessage(stderr)}`}`)));
      });
    } finally {
      this.io.writeControl("\x1b8");
    }
  }
}

export function iterm2ArtworkSequence(options: {
  readonly data: Uint8Array;
  readonly rectangle: TerminalArtworkRectangle;
}): string {
  const payload = Buffer.from(options.data).toString("base64");
  return [
    "\x1b7",
    cursorPosition(options.rectangle.row, options.rectangle.column),
    `\x1b]1337;File=inline=1;width=${options.rectangle.widthColumns};height=${options.rectangle.heightRows};preserveAspectRatio=1:${payload}\x07`,
    "\x1b8"
  ].join("");
}

class Iterm2ArtworkBackend implements ArtworkBackendAdapter {
  private currentRectangle: TerminalArtworkRectangle | undefined;
  constructor(private readonly io: TerminalArtworkIo) {}
  async start(): Promise<void> {}
  async show(options: TerminalArtworkShowOptions): Promise<void> {
    await this.clear();
    this.io.writeControl(iterm2ArtworkSequence({ data: options.assetData, rectangle: options.rectangle }));
    this.currentRectangle = options.rectangle;
  }
  async clear(): Promise<void> {
    if (this.currentRectangle === undefined) return;
    this.io.writeControl(clearRectangleSequence(this.currentRectangle));
    this.currentRectangle = undefined;
  }
  async resize(): Promise<void> { await this.clear(); }
  async shutdown(): Promise<void> { await this.clear(); }
}

class SixelArtworkBackend implements ArtworkBackendAdapter {
  private currentRectangle: TerminalArtworkRectangle | undefined;
  private readonly pixelSize: { readonly width: number; readonly height: number };
  constructor(
    private readonly io: TerminalArtworkIo,
    private readonly detection: TerminalArtworkDetection,
    env: TerminalArtworkEnvironment
  ) {
    this.pixelSize = {
      width: io.cellPixelWidth ?? cellPixelSize(env)?.width ?? 0,
      height: io.cellPixelHeight ?? cellPixelSize(env)?.height ?? 0
    };
  }
  async start(): Promise<void> {
    if (this.pixelSize.width <= 0 || this.pixelSize.height <= 0) throw new Error("terminal cell pixel geometry is unavailable");
  }
  async show(options: TerminalArtworkShowOptions): Promise<void> {
    await this.clear();
    const pixelWidth = options.rectangle.widthColumns * this.pixelSize.width;
    const pixelHeight = options.rectangle.heightRows * this.pixelSize.height;
    const invocation = sixelHelperInvocation(this.detection, options.assetPath, pixelWidth, pixelHeight);
    const output = await execFileBytes(invocation.executable, invocation.args);
    this.io.writeControl("\x1b7");
    this.io.writeControl(cursorPosition(options.rectangle.row, options.rectangle.column));
    this.io.writeControl(output);
    this.io.writeControl("\x1b8");
    this.currentRectangle = options.rectangle;
  }
  async clear(): Promise<void> {
    if (this.currentRectangle === undefined) return;
    this.io.writeControl(clearRectangleSequence(this.currentRectangle));
    this.currentRectangle = undefined;
  }
  async resize(): Promise<void> { await this.clear(); }
  async shutdown(): Promise<void> { await this.clear(); }
}

export function sixelHelperInvocation(
  detection: TerminalArtworkDetection,
  assetPath: string,
  pixelWidth: number,
  pixelHeight: number
): { readonly executable: string; readonly args: readonly string[] } {
  return detection.helpers.img2sixel
    ? { executable: detection.executables.img2sixel as string, args: ["-w", String(pixelWidth), "-h", String(pixelHeight), assetPath] }
    : {
        executable: detection.executables.magick as string,
        args: [assetPath, "-resize", `${pixelWidth}x${pixelHeight}`, "sixel:-"]
      };
}

export function clearRectangleSequence(rectangle: TerminalArtworkRectangle): string {
  const blank = " ".repeat(rectangle.widthColumns);
  return [
    "\x1b7",
    ...Array.from({ length: rectangle.heightRows }, (_, index) => `${cursorPosition(rectangle.row + index, rectangle.column)}${blank}`),
    "\x1b8"
  ].join("");
}

export function formatTerminalArtworkDiagnostics(
  detection: TerminalArtworkDetection,
  rectangle?: TerminalArtworkRectangle,
  overlayProcess: TerminalArtworkOverlayProcessDiagnostics = getActiveTerminalArtworkOverlayDiagnostics()
): string {
  const helper = (available: boolean): string => available ? "available" : "unavailable";
  const overlaySelected = detection.selectedBackend === "wayland-overlay" || detection.selectedBackend === "x11-overlay";
  const reportedOverlayProcess = overlaySelected ? overlayProcess : stoppedOverlayDiagnostics;
  const operationallyReady = overlaySelected ? reportedOverlayProcess.state === "ready" && reportedOverlayProcess.stdinWritable : detection.ready;
  return [
    "Terminal artwork diagnostics",
    `Terminal indicators: ${detection.terminalIndicators.length === 0 ? "none" : detection.terminalIndicators.join(", ")}`,
    `Graphical session: ${detection.graphicalSession}`,
    `Configured backend: ${terminalArtworkBackendLabels[detection.configuredBackend]}`,
    `Selected backend: ${terminalArtworkBackendLabels[detection.selectedBackend]}`,
    `ueberzugpp: ${helper(detection.helpers.ueberzugpp)}`,
    `img2sixel: ${helper(detection.helpers.img2sixel)}`,
    `ImageMagick: ${helper(detection.helpers.magick)}`,
    `ImageMagick SIXEL: ${helper(detection.helpers.magickSixel)}`,
    `Image-capable backend ready: ${operationallyReady ? "yes" : "no"}`,
    `Overlay transport: ${reportedOverlayProcess.transport}`,
    `Overlay process state: ${reportedOverlayProcess.state}`,
    `Overlay stdin writable: ${reportedOverlayProcess.stdinWritable ? "yes" : "no"}`,
    `Overlay helper exited early: ${reportedOverlayProcess.exitedEarly ? "yes" : "no"}`,
    `Overlay last command: ${reportedOverlayProcess.lastCommand ?? "none"}`,
    ...(reportedOverlayProcess.stderrSummary === undefined ? [] : [`Overlay startup stderr: ${reportedOverlayProcess.stderrSummary}`]),
    `Current centre-pane rectangle: ${rectangle === undefined ? "not active" : `${rectangle.column},${rectangle.row} ${rectangle.widthColumns}x${rectangle.heightRows} cells`}`,
    ...(detection.reason === undefined ? [] : [`Reason: ${detection.reason}`])
  ].join("\n");
}

function cursorPosition(row: number, column: number): string { return `\x1b[${row};${column}H`; }

function terminalIndicators(env: TerminalArtworkEnvironment): readonly string[] {
  return [
    nonEmpty(env.TERM) ? `TERM=${env.TERM}` : undefined,
    nonEmpty(env.TERM_PROGRAM) ? `TERM_PROGRAM=${env.TERM_PROGRAM}` : undefined,
    nonEmpty(env.LC_TERMINAL) ? `LC_TERMINAL=${env.LC_TERMINAL}` : undefined,
    nonEmpty(env.KITTY_WINDOW_ID) ? "KITTY_WINDOW_ID=set" : undefined,
    nonEmpty(env.ITERM_SESSION_ID) ? "ITERM_SESSION_ID=set" : undefined
  ].filter((value): value is string => value !== undefined);
}

function graphicalSession(env: TerminalArtworkEnvironment): "Wayland" | "X11" | "neither" {
  if (nonEmpty(env.WAYLAND_DISPLAY)) return "Wayland";
  if (nonEmpty(env.DISPLAY)) return "X11";
  return "neither";
}

function hasKittyIndicator(env: TerminalArtworkEnvironment): boolean {
  return nonEmpty(env.KITTY_WINDOW_ID) || env.TERM_PROGRAM === "kitty";
}

function hasIterm2Indicator(env: TerminalArtworkEnvironment): boolean {
  return nonEmpty(env.ITERM_SESSION_ID) || env.TERM_PROGRAM === "iTerm.app" || env.LC_TERMINAL === "iTerm2";
}

function sixelEncoderAvailable(helpers: TerminalArtworkHelperAvailability): boolean {
  return helpers.img2sixel || helpers.magickSixel;
}

function cellPixelSize(env: TerminalArtworkEnvironment): { readonly width: number; readonly height: number } | undefined {
  const width = positiveInteger(env.WSM_TERMINAL_CELL_WIDTH_PX);
  const height = positiveInteger(env.WSM_TERMINAL_CELL_HEIGHT_PX);
  return width === undefined || height === undefined ? undefined : { width, height };
}

function positiveInteger(value: string | undefined): number | undefined {
  if (value === undefined || !/^\d+$/u.test(value)) return undefined;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : undefined;
}

async function findExecutable(name: string, env: TerminalArtworkEnvironment): Promise<string | undefined> {
  for (const directory of (env.PATH ?? "").split(delimiter)) {
    if (directory.length === 0) continue;
    const candidate = join(directory, name);
    try { await access(candidate, fsConstants.X_OK); return candidate; } catch { /* continue */ }
  }
  return undefined;
}

async function imageMagickSupportsSixel(executable: string): Promise<boolean> {
  try {
    const output = await execFileText(executable, ["-list", "format"]);
    return /^\s*SIXEL?\*?\s+SIXEL\s+rw/imu.test(output);
  } catch { return false; }
}

async function convertToPng(assetPath: string, magick: string | undefined): Promise<Uint8Array> {
  if (magick === undefined) throw new Error("Kitty requires ImageMagick to convert this validated non-PNG asset");
  return execFileBytes(magick, [assetPath, "png:-"]);
}

function execFileText(executable: string, args: readonly string[]): Promise<string> {
  return new Promise((resolve, reject) => execFile(executable, [...args], { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 }, (error, stdout) => {
    if (error !== null) reject(error); else resolve(stdout);
  }));
}

function execFileBytes(executable: string, args: readonly string[]): Promise<Uint8Array> {
  return new Promise((resolve, reject) => execFile(executable, [...args], { encoding: "buffer", maxBuffer: 64 * 1024 * 1024 }, (error, stdout) => {
    if (error !== null) reject(error); else resolve(stdout);
  }));
}

function sanitizedStderrSummary(stderr: string): string | undefined {
  const finalLine = stderr
    .replace(/\x1b\[[0-?]*[ -/]*[@-~]/gu, "")
    .split(/\r?\n/gu)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .at(-1);
  if (finalLine === undefined) return undefined;
  const withoutPaths = finalLine
    .replace(/(?:[A-Za-z]:\\|\/)\S*/gu, "[path]")
    .replace(/[\u0000-\u001f\u007f]/gu, "")
    .slice(0, 200)
    .trim();
  return withoutPaths.length === 0 ? "helper reported startup details (redacted)" : withoutPaths;
}

function nonEmpty(value: string | undefined): value is string { return value !== undefined && value.trim().length > 0; }
function safeErrorMessage(error: unknown): string { return error instanceof Error && error.message.trim().length > 0 ? error.message : "unknown backend error"; }
