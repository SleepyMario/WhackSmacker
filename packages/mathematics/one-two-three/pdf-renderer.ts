import { drawTargetObjects, type Bounds, type DrawingContext, type Point } from "./object-catalog";
import { a4Portrait, createDocumentPageLayouts } from "./page-layout";
import { generateBeginnerVolumeOneWorkbook, generateOneTwoThreeWorkbook } from "./workbook-generator";
import type { BeginnerVolumeOneWorkbook, OneTwoThreeGenerationOptions, OneTwoThreeWorkbook, WorkbookPage } from "./workbook-model";

declare function require(name: "node:fs/promises"): {
  mkdir(path: string, options: { recursive: boolean }): Promise<void>;
  stat(path: string): Promise<unknown>;
  writeFile(path: string, data: Uint8Array): Promise<void>;
};

declare function require(name: "node:path"): {
  dirname(path: string): string;
  resolve(path: string): string;
};

declare const Buffer: {
  byteLength(text: string, encoding: "utf8"): number;
  from(text: string, encoding: "utf8"): Uint8Array;
};

export interface WorkbookRenderOptions extends OneTwoThreeGenerationOptions {
  readonly outputPath: string;
  readonly overwrite?: boolean;
  readonly onProgress?: (progress: WorkbookRenderProgress) => void;
}

export interface WorkbookRenderProgress {
  readonly page: number;
  readonly pageCount: number;
}

export interface WorkbookRenderResult {
  readonly outputPath: string;
  readonly pageCount: number;
  readonly introductionPageCount?: number;
  readonly unitTitlePageCount?: number;
  readonly exercisePageCount?: number;
  readonly exerciseCount: number;
  readonly seed: number;
  readonly workbook: BeginnerVolumeOneWorkbook | OneTwoThreeWorkbook;
}

export async function generateOneTwoThreeWorkbookPdf(options: WorkbookRenderOptions): Promise<WorkbookRenderResult> {
  const path = require("node:path");
  const fs = require("node:fs/promises");
  const outputPath = path.resolve(options.outputPath);
  await assertCanWriteOutput(outputPath, options.overwrite === true);

  const workbook = generateOneTwoThreeWorkbook({ seed: options.seed });
  const pdf = renderWorkbookToPdfBuffer(workbook, options.onProgress);

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, pdf);

  return {
    outputPath,
    pageCount: workbook.pageCount,
    exerciseCount: workbook.exerciseCount,
    seed: workbook.seed,
    workbook
  };
}

export async function generateBeginnerVolumeOneWorkbookPdf(options: WorkbookRenderOptions): Promise<WorkbookRenderResult> {
  const path = require("node:path");
  const fs = require("node:fs/promises");
  const outputPath = path.resolve(options.outputPath);
  await assertCanWriteOutput(outputPath, options.overwrite === true);

  const workbook = generateBeginnerVolumeOneWorkbook({ seed: options.seed });
  const pdf = renderWorkbookToPdfBuffer(workbook, options.onProgress);

  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, pdf);

  return {
    outputPath,
    pageCount: workbook.pageCount,
    introductionPageCount: workbook.introductionPageCount,
    unitTitlePageCount: workbook.unitTitlePageCount,
    exercisePageCount: workbook.exercisePageCount,
    exerciseCount: workbook.exerciseCount,
    seed: workbook.seed,
    workbook
  };
}

export function renderWorkbookToPdfBuffer(
  workbook: BeginnerVolumeOneWorkbook | OneTwoThreeWorkbook,
  onProgress?: (progress: WorkbookRenderProgress) => void
): Uint8Array {
  const document = new SimplePdfDocument();
  const layouts = createDocumentPageLayouts(workbook);
  const pageCount = workbook.pageCount;

  for (const layout of layouts) {
    const canvas = new PdfCanvas(layout.width, layout.height);
    canvas.rect(0, 0, layout.width, layout.height, "#fffdf8");
    renderDocumentPage(canvas, layout.page, layout);

    document.addPage(layout.width, layout.height, canvas.content());
    onProgress?.({ page: layout.page.index + 1, pageCount });
  }

  return document.toBuffer();
}

function renderDocumentPage(
  canvas: PdfCanvas,
  page: WorkbookPage,
  layout: ReturnType<typeof createDocumentPageLayouts>[number]
): void {
  if (page.kind === "introduction") {
    renderIntroductionPage(canvas, page.title, page.text);
    return;
  }

  if (page.kind === "unit-title") {
    renderUnitTitlePage(canvas, page.label, page.title);
    return;
  }

  canvas.text(page.unitTitle, layout.margin, 34, 22, "#243b53");

  for (const exerciseLayout of layout.exercises) {
    const { exercise, bounds, illustrationBounds, choicesBounds } = exerciseLayout;
    canvas.roundedRect(bounds.x, bounds.y, bounds.width, bounds.height, 8, "#ffffff", "#d8dee9", 1);
    canvas.rect(illustrationBounds.x, illustrationBounds.y, illustrationBounds.width, illustrationBounds.height, "#f8fbff", "#edf2ff", 0.8);
    drawTargetObjects(canvas, exercise.objectFamily, exercise.quantity, illustrationBounds, exercise.variation);
    renderChoices(canvas, choicesBounds, exercise.answerChoices);
  }
}

function renderIntroductionPage(canvas: PdfCanvas, title: string, text: string): void {
  const margin = 58;
  canvas.text(title, margin, 88, 34, "#243b53");
  const lines = wrapText(text, 58);
  let y = 150;
  for (const line of lines) {
    canvas.text(line, margin, y, 16, "#243b53");
    y += 26;
  }
}

function renderUnitTitlePage(canvas: PdfCanvas, label: string, title: string): void {
  canvas.text(label, 88, a4Portrait.height * 0.42, 28, "#4263eb");
  canvas.text(title, 88, a4Portrait.height * 0.49, 40, "#243b53");
}

async function assertCanWriteOutput(outputPath: string, overwrite: boolean): Promise<void> {
  const fs = require("node:fs/promises");

  try {
    await fs.stat(outputPath);
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      return;
    }

    throw error;
  }

  if (!overwrite) {
    throw new Error(`Output file already exists: ${outputPath}`);
  }
}

function renderChoices(canvas: PdfCanvas, bounds: Bounds, choices: readonly string[]): void {
  const lineHeight = bounds.height / choices.length;
  const fontSize = choices.length > 3 ? 18 : 21;

  choices.forEach((choice, index) => {
    const baseline = bounds.y + lineHeight * index + lineHeight * 0.68;
    canvas.circle(bounds.x + 10, baseline - 6, 3.8, "#243b53");
    canvas.text(choice, bounds.x + 25, baseline, fontSize, "#243b53");
  });
}

function wrapText(text: string, maxLineLength: number): string[] {
  const words = text.split(/\s+/u);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current.length === 0 ? word : `${current} ${word}`;
    if (candidate.length > maxLineLength && current.length > 0) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }

  if (current.length > 0) {
    lines.push(current);
  }

  return lines;
}

class PdfCanvas implements DrawingContext {
  private readonly parts: string[] = [];

  constructor(
    private readonly width: number,
    private readonly height: number
  ) {}

  content(): string {
    return this.parts.join("\n");
  }

  circle(x: number, y: number, radius: number, fill: string, stroke?: string, lineWidth = 1): void {
    this.ellipse(x, y, radius, radius, fill, stroke, lineWidth);
  }

  ellipse(x: number, y: number, radiusX: number, radiusY: number, fill: string, stroke?: string, lineWidth = 1): void {
    const k = 0.5522847498;
    const cx = x;
    const cy = this.toPdfY(y);
    const rx = radiusX;
    const ry = radiusY;
    this.setPaint(fill, stroke, lineWidth);
    this.parts.push(`${format(cx + rx)} ${format(cy)} m`);
    this.parts.push(`${format(cx + rx)} ${format(cy + ry * k)} ${format(cx + rx * k)} ${format(cy + ry)} ${format(cx)} ${format(cy + ry)} c`);
    this.parts.push(`${format(cx - rx * k)} ${format(cy + ry)} ${format(cx - rx)} ${format(cy + ry * k)} ${format(cx - rx)} ${format(cy)} c`);
    this.parts.push(`${format(cx - rx)} ${format(cy - ry * k)} ${format(cx - rx * k)} ${format(cy - ry)} ${format(cx)} ${format(cy - ry)} c`);
    this.parts.push(`${format(cx + rx * k)} ${format(cy - ry)} ${format(cx + rx)} ${format(cy - ry * k)} ${format(cx + rx)} ${format(cy)} c`);
    this.parts.push(stroke === undefined ? "f" : "B");
  }

  rect(x: number, y: number, width: number, height: number, fill: string, stroke?: string, lineWidth = 1): void {
    this.setPaint(fill, stroke, lineWidth);
    this.parts.push(`${format(x)} ${format(this.toPdfY(y + height))} ${format(width)} ${format(height)} re`);
    this.parts.push(stroke === undefined ? "f" : "B");
  }

  roundedRect(x: number, y: number, width: number, height: number, radius: number, fill: string, stroke?: string, lineWidth = 1): void {
    const r = Math.min(radius, width / 2, height / 2);
    const k = 0.5522847498;
    const left = x;
    const right = x + width;
    const top = this.toPdfY(y);
    const bottom = this.toPdfY(y + height);
    this.setPaint(fill, stroke, lineWidth);
    this.parts.push(`${format(left + r)} ${format(bottom)} m`);
    this.parts.push(`${format(right - r)} ${format(bottom)} l`);
    this.parts.push(`${format(right - r + r * k)} ${format(bottom)} ${format(right)} ${format(bottom + r - r * k)} ${format(right)} ${format(bottom + r)} c`);
    this.parts.push(`${format(right)} ${format(top - r)} l`);
    this.parts.push(`${format(right)} ${format(top - r + r * k)} ${format(right - r + r * k)} ${format(top)} ${format(right - r)} ${format(top)} c`);
    this.parts.push(`${format(left + r)} ${format(top)} l`);
    this.parts.push(`${format(left + r - r * k)} ${format(top)} ${format(left)} ${format(top - r + r * k)} ${format(left)} ${format(top - r)} c`);
    this.parts.push(`${format(left)} ${format(bottom + r)} l`);
    this.parts.push(`${format(left)} ${format(bottom + r - r * k)} ${format(left + r - r * k)} ${format(bottom)} ${format(left + r)} ${format(bottom)} c`);
    this.parts.push(stroke === undefined ? "f" : "B");
  }

  polygon(points: readonly Point[], fill: string, stroke?: string, lineWidth = 1): void {
    if (points.length === 0) {
      return;
    }

    this.setPaint(fill, stroke, lineWidth);
    this.parts.push(`${format(points[0].x)} ${format(this.toPdfY(points[0].y))} m`);
    for (const point of points.slice(1)) {
      this.parts.push(`${format(point.x)} ${format(this.toPdfY(point.y))} l`);
    }
    this.parts.push("h");
    this.parts.push(stroke === undefined ? "f" : "B");
  }

  line(x1: number, y1: number, x2: number, y2: number, stroke: string, lineWidth = 1): void {
    this.setStroke(stroke, lineWidth);
    this.parts.push(`${format(x1)} ${format(this.toPdfY(y1))} m`);
    this.parts.push(`${format(x2)} ${format(this.toPdfY(y2))} l`);
    this.parts.push("S");
  }

  text(text: string, x: number, y: number, size: number, fill: string): void {
    const escaped = text.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
    this.setFill(fill);
    this.parts.push("BT");
    this.parts.push(`/F1 ${format(size)} Tf`);
    this.parts.push(`${format(x)} ${format(this.toPdfY(y))} Td`);
    this.parts.push(`(${escaped}) Tj`);
    this.parts.push("ET");
  }

  private setPaint(fill: string, stroke: string | undefined, lineWidth: number): void {
    this.setFill(fill);
    if (stroke !== undefined) {
      this.setStroke(stroke, lineWidth);
    }
  }

  private setFill(color: string): void {
    const { r, g, b } = parseHexColor(color);
    this.parts.push(`${format(r)} ${format(g)} ${format(b)} rg`);
  }

  private setStroke(color: string, lineWidth: number): void {
    const { r, g, b } = parseHexColor(color);
    this.parts.push(`${format(r)} ${format(g)} ${format(b)} RG`);
    this.parts.push(`${format(lineWidth)} w`);
  }

  private toPdfY(y: number): number {
    return this.height - y;
  }
}

class SimplePdfDocument {
  private readonly pages: { width: number; height: number; content: string }[] = [];

  addPage(width: number, height: number, content: string): void {
    this.pages.push({ width, height, content });
  }

  toBuffer(): Uint8Array {
    const objects: string[] = [];
    const catalogId = this.reserve(objects);
    const pagesId = this.reserve(objects);
    const fontId = this.reserve(objects);
    const pageIds: number[] = [];

    for (const page of this.pages) {
      const pageId = this.reserve(objects);
      const contentId = this.reserve(objects);
      pageIds.push(pageId);
      const stream = page.content;
      objects[contentId - 1] = `<< /Length ${Buffer.byteLength(stream, "utf8")} >>\nstream\n${stream}\nendstream`;
      objects[pageId - 1] = `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${format(page.width)} ${format(page.height)}] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentId} 0 R >>`;
    }

    objects[catalogId - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
    objects[pagesId - 1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${this.pages.length} >>`;
    objects[fontId - 1] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";

    return buildPdf(objects, catalogId);
  }

  private reserve(objects: string[]): number {
    objects.push("");
    return objects.length;
  }
}

function buildPdf(objects: readonly string[], rootObjectId: number): Uint8Array {
  const chunks: string[] = ["%PDF-1.4\n"];
  const offsets = [0];

  for (let index = 0; index < objects.length; index += 1) {
    offsets.push(Buffer.byteLength(chunks.join(""), "utf8"));
    chunks.push(`${index + 1} 0 obj\n${objects[index]}\nendobj\n`);
  }

  const xrefOffset = Buffer.byteLength(chunks.join(""), "utf8");
  chunks.push(`xref\n0 ${objects.length + 1}\n`);
  chunks.push("0000000000 65535 f \n");
  for (const offset of offsets.slice(1)) {
    chunks.push(`${String(offset).padStart(10, "0")} 00000 n \n`);
  }
  chunks.push(`trailer\n<< /Size ${objects.length + 1} /Root ${rootObjectId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`);

  return Buffer.from(chunks.join(""), "utf8");
}

function parseHexColor(color: string): { r: number; g: number; b: number } {
  const match = /^#(?<r>[0-9a-f]{2})(?<g>[0-9a-f]{2})(?<b>[0-9a-f]{2})$/iu.exec(color);
  if (match?.groups === undefined) {
    throw new Error(`Unsupported color: ${color}`);
  }

  return {
    r: Number.parseInt(match.groups.r, 16) / 255,
    g: Number.parseInt(match.groups.g, 16) / 255,
    b: Number.parseInt(match.groups.b, 16) / 255
  };
}

function format(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(3).replace(/0+$/u, "").replace(/\.$/u, "");
}

function isNodeError(error: unknown): error is Error & { code?: string } {
  return error instanceof Error && "code" in error;
}
