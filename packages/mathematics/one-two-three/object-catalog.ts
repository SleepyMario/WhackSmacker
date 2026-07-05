import type { CountingQuantity, CountingVariation } from "./workbook-model";

export interface Bounds {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface DrawingContext {
  circle(x: number, y: number, radius: number, fill: string, stroke?: string, lineWidth?: number): void;
  ellipse(x: number, y: number, radiusX: number, radiusY: number, fill: string, stroke?: string, lineWidth?: number): void;
  rect(x: number, y: number, width: number, height: number, fill: string, stroke?: string, lineWidth?: number): void;
  roundedRect(x: number, y: number, width: number, height: number, radius: number, fill: string, stroke?: string, lineWidth?: number): void;
  polygon(points: readonly Point[], fill: string, stroke?: string, lineWidth?: number): void;
  line(x1: number, y1: number, x2: number, y2: number, stroke: string, lineWidth?: number): void;
  text(text: string, x: number, y: number, size: number, fill: string): void;
}

export interface ObjectRenderer {
  readonly id: string;
  readonly displayName: string;
  draw(context: DrawingContext, bounds: Bounds, variation: CountingVariation): void;
}

export interface ObjectRenderPlan {
  readonly familyId: string;
  readonly quantity: CountingQuantity;
  readonly bounds: Bounds;
  readonly objectBounds: readonly Bounds[];
  readonly remoteAssetReferences: readonly string[];
}

export const objectFamilies: readonly ObjectRenderer[] = [
  createRenderer("apple", "Apple", drawApple),
  createRenderer("orange", "Orange", drawOrange),
  createRenderer("banana", "Banana", drawBanana),
  createRenderer("flower", "Flower", drawFlower),
  createRenderer("tree", "Tree", drawTree),
  createRenderer("star", "Star", drawStar),
  createRenderer("moon", "Moon", drawMoon),
  createRenderer("sun", "Sun", drawSun),
  createRenderer("ball", "Ball", drawBall),
  createRenderer("balloon", "Balloon", drawBalloon),
  createRenderer("car", "Car", drawCar),
  createRenderer("boat", "Boat", drawBoat),
  createRenderer("house", "House", drawHouse),
  createRenderer("fish", "Fish", drawFish),
  createRenderer("bird", "Bird", drawBird),
  createRenderer("cat", "Cat", drawCat),
  createRenderer("dog", "Dog", drawDog),
  createRenderer("duck", "Duck", drawDuck),
  createRenderer("butterfly", "Butterfly", drawButterfly),
  createRenderer("ladybug", "Ladybug", drawLadybug),
  createRenderer("kite", "Kite", drawKite),
  createRenderer("block", "Block", drawBlock),
  createRenderer("heart", "Heart", drawHeart),
  createRenderer("ice-cream", "Ice Cream", drawIceCream),
  createRenderer("cupcake", "Cupcake", drawCupcake),
  createRenderer("pencil", "Pencil", drawPencil),
  createRenderer("book", "Book", drawBook)
];

export function findObjectRenderer(familyId: string): ObjectRenderer {
  const renderer = objectFamilies.find((family) => family.id === familyId);
  if (renderer === undefined) {
    throw new Error(`Unknown object family: ${familyId}`);
  }

  return renderer;
}

export function drawTargetObjects(
  context: DrawingContext,
  familyId: string,
  quantity: CountingQuantity,
  bounds: Bounds,
  variation: CountingVariation
): ObjectRenderPlan {
  const renderer = findObjectRenderer(familyId);
  const objectBounds = createObjectBounds(quantity, bounds, variation.scale, variation.layout, variation.variant);

  for (const objectBound of objectBounds) {
    renderer.draw(context, objectBound, variation);
  }

  return { familyId, quantity, bounds, objectBounds, remoteAssetReferences: [] };
}

export function inspectObjectRenderPlan(familyId: string, quantity: CountingQuantity, bounds: Bounds): ObjectRenderPlan {
  findObjectRenderer(familyId);
  return {
    familyId,
    quantity,
    bounds,
    objectBounds: createObjectBounds(quantity, bounds, 0.95, "two-row", 0),
    remoteAssetReferences: []
  };
}

function createRenderer(id: string, displayName: string, draw: ObjectRenderer["draw"]): ObjectRenderer {
  return { id, displayName, draw };
}

function createObjectBounds(
  quantity: CountingQuantity,
  bounds: Bounds,
  scale: number,
  layout: CountingVariation["layout"],
  variant: number
): Bounds[] {
  const padding = Math.min(bounds.width, bounds.height) * 0.06;
  const usable = {
    x: bounds.x + padding,
    y: bounds.y + padding,
    width: bounds.width - padding * 2,
    height: bounds.height - padding * 2
  };
  const selectedLayout = normalizeLayoutForQuantity(quantity, layout);
  const centers = createObjectCenters(quantity, usable, selectedLayout, variant);
  const minimumGap = Math.min(usable.width, usable.height) * 0.05;
  const minCenterDistance = centers.length <= 1 ? Math.min(usable.width, usable.height) : findMinimumCenterDistance(centers);
  const size = Math.min(
    minCenterDistance * 0.68,
    usable.width * (quantity <= 3 ? 0.54 : quantity <= 5 ? 0.42 : 0.3),
    usable.height * (quantity <= 3 ? 0.62 : quantity <= 5 ? 0.36 : 0.28)
  ) * scale;
  const clampedSize = Math.max(28, Math.min(size, Math.min(usable.width, usable.height) - minimumGap));

  return centers.map((center) => ({
    x: clamp(center.x - clampedSize / 2, usable.x, usable.x + usable.width - clampedSize),
    y: clamp(center.y - clampedSize / 2, usable.y, usable.y + usable.height - clampedSize),
    width: clampedSize,
    height: clampedSize
  }));
}

function createObjectCenters(quantity: CountingQuantity, bounds: Bounds, layout: CountingVariation["layout"], variant: number): Point[] {
  const centerX = bounds.x + bounds.width / 2;
  const centerY = bounds.y + bounds.height / 2;
  const jitter = ((variant % 9) - 4) / 4;

  if (quantity === 1) {
    return [{ x: centerX, y: centerY }];
  }

  if (layout === "row") {
    const step = bounds.width / (quantity + 1);
    return Array.from({ length: quantity }, (_, index) => ({
      x: bounds.x + step * (index + 1),
      y: centerY + Math.sin(index + variant) * bounds.height * 0.05
    }));
  }

  if (layout === "arc") {
    const step = bounds.width / (quantity + 1);
    return Array.from({ length: quantity }, (_, index) => {
      const distance = Math.abs(index - (quantity - 1) / 2);
      return {
        x: bounds.x + step * (index + 1),
        y: centerY + distance * bounds.height * 0.12 - bounds.height * 0.06
      };
    });
  }

  if (layout === "cluster") {
    const presets: Record<CountingQuantity, readonly Point[]> = {
      1: [{ x: 0.5, y: 0.5 }],
      2: [{ x: 0.34, y: 0.5 }, { x: 0.66, y: 0.5 }],
      3: [{ x: 0.5, y: 0.29 }, { x: 0.33, y: 0.68 }, { x: 0.67, y: 0.68 }],
      4: [{ x: 0.32, y: 0.32 }, { x: 0.68, y: 0.32 }, { x: 0.3, y: 0.7 }, { x: 0.7, y: 0.68 }],
      5: [{ x: 0.5, y: 0.25 }, { x: 0.28, y: 0.5 }, { x: 0.72, y: 0.48 }, { x: 0.36, y: 0.76 }, { x: 0.66, y: 0.74 }],
      6: [{ x: 0.28, y: 0.3 }, { x: 0.5, y: 0.28 }, { x: 0.72, y: 0.31 }, { x: 0.3, y: 0.69 }, { x: 0.52, y: 0.72 }, { x: 0.74, y: 0.68 }],
      7: [{ x: 0.22, y: 0.28 }, { x: 0.42, y: 0.26 }, { x: 0.62, y: 0.29 }, { x: 0.82, y: 0.31 }, { x: 0.3, y: 0.7 }, { x: 0.52, y: 0.73 }, { x: 0.74, y: 0.69 }],
      8: [{ x: 0.22, y: 0.3 }, { x: 0.42, y: 0.27 }, { x: 0.62, y: 0.3 }, { x: 0.82, y: 0.28 }, { x: 0.24, y: 0.7 }, { x: 0.44, y: 0.73 }, { x: 0.64, y: 0.69 }, { x: 0.84, y: 0.72 }],
      9: [{ x: 0.2, y: 0.24 }, { x: 0.4, y: 0.22 }, { x: 0.6, y: 0.25 }, { x: 0.8, y: 0.23 }, { x: 0.3, y: 0.52 }, { x: 0.5, y: 0.55 }, { x: 0.7, y: 0.52 }, { x: 0.4, y: 0.8 }, { x: 0.62, y: 0.78 }]
    };
    return presets[quantity].map((point, index) => ({
      x: bounds.x + bounds.width * point.x + Math.sin(variant + index) * bounds.width * 0.018,
      y: bounds.y + bounds.height * point.y + Math.cos(variant + index) * bounds.height * 0.018
    }));
  }

  if (layout === "symmetric") {
    const presets: Record<CountingQuantity, readonly Point[]> = {
      1: [{ x: 0.5, y: 0.5 }],
      2: [{ x: 0.35, y: 0.5 }, { x: 0.65, y: 0.5 }],
      3: [{ x: 0.5, y: 0.25 }, { x: 0.32, y: 0.68 }, { x: 0.68, y: 0.68 }],
      4: [{ x: 0.32, y: 0.32 }, { x: 0.68, y: 0.32 }, { x: 0.32, y: 0.68 }, { x: 0.68, y: 0.68 }],
      5: [{ x: 0.5, y: 0.25 }, { x: 0.3, y: 0.47 }, { x: 0.7, y: 0.47 }, { x: 0.36, y: 0.75 }, { x: 0.64, y: 0.75 }],
      6: [{ x: 0.28, y: 0.3 }, { x: 0.5, y: 0.3 }, { x: 0.72, y: 0.3 }, { x: 0.28, y: 0.7 }, { x: 0.5, y: 0.7 }, { x: 0.72, y: 0.7 }],
      7: [{ x: 0.22, y: 0.3 }, { x: 0.42, y: 0.3 }, { x: 0.62, y: 0.3 }, { x: 0.82, y: 0.3 }, { x: 0.32, y: 0.7 }, { x: 0.52, y: 0.7 }, { x: 0.72, y: 0.7 }],
      8: [{ x: 0.22, y: 0.3 }, { x: 0.42, y: 0.3 }, { x: 0.62, y: 0.3 }, { x: 0.82, y: 0.3 }, { x: 0.22, y: 0.7 }, { x: 0.42, y: 0.7 }, { x: 0.62, y: 0.7 }, { x: 0.82, y: 0.7 }],
      9: [{ x: 0.25, y: 0.24 }, { x: 0.5, y: 0.24 }, { x: 0.75, y: 0.24 }, { x: 0.25, y: 0.52 }, { x: 0.5, y: 0.52 }, { x: 0.75, y: 0.52 }, { x: 0.25, y: 0.8 }, { x: 0.5, y: 0.8 }, { x: 0.75, y: 0.8 }]
    };
    return presets[quantity].map((point) => ({
      x: bounds.x + bounds.width * point.x,
      y: bounds.y + bounds.height * point.y
    }));
  }

  const rowCountsByQuantity: Record<CountingQuantity, readonly number[]> = {
    1: [1],
    2: [2],
    3: [3],
    4: [2, 2],
    5: [3, 2],
    6: [3, 3],
    7: [4, 3],
    8: [4, 4],
    9: [3, 3, 3]
  };
  const rowCounts = rowCountsByQuantity[quantity];
  const rowY = rowCounts.length === 3 ? [0.24, 0.52, 0.8] : [0.32, 0.7];
  return rowCounts.flatMap((count, rowIndex) =>
    rowCenters(count, bounds.x, bounds.width, bounds.y + bounds.height * rowY[rowIndex], rowIndex % 2 === 0 ? jitter : -jitter)
  );
}

function normalizeLayoutForQuantity(quantity: CountingQuantity, layout: CountingVariation["layout"]): CountingVariation["layout"] {
  if (quantity <= 3 && layout === "two-row") {
    return "arc";
  }

  if (quantity >= 4 && layout === "row") {
    return "two-row";
  }

  if (quantity >= 4 && layout === "arc") {
    return "cluster";
  }

  return layout;
}

function rowCenters(count: number, x: number, width: number, y: number, jitter: number): Point[] {
  const step = width / (count + 1);
  return Array.from({ length: count }, (_, index) => ({
    x: x + step * (index + 1) + jitter * width * 0.015,
    y
  }));
}

function findMinimumCenterDistance(centers: readonly Point[]): number {
  let minimum = Number.POSITIVE_INFINITY;

  for (let outer = 0; outer < centers.length; outer += 1) {
    for (let inner = outer + 1; inner < centers.length; inner += 1) {
      const dx = centers[outer].x - centers[inner].x;
      const dy = centers[outer].y - centers[inner].y;
      minimum = Math.min(minimum, Math.hypot(dx, dy));
    }
  }

  return minimum;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function drawApple(context: DrawingContext, b: Bounds, v: CountingVariation): void {
  const cx = b.x + b.width / 2;
  context.circle(cx, b.y + b.height * 0.55, b.width * 0.3, v.color, "#8f2d2d", 2);
  context.line(cx, b.y + b.height * 0.28, cx + b.width * 0.08, b.y + b.height * 0.12, "#7f4f24", 4);
  context.ellipse(cx + b.width * 0.2, b.y + b.height * 0.16, b.width * 0.15, b.height * 0.08, v.accentColor, "#2b8a3e", 1);
}

function drawOrange(context: DrawingContext, b: Bounds, v: CountingVariation): void {
  context.circle(b.x + b.width / 2, b.y + b.height / 2, b.width * 0.36, "#ff922b", "#e8590c", 2);
  context.circle(b.x + b.width * 0.38, b.y + b.height * 0.38, b.width * 0.06, "#ffd8a8");
}

function drawBanana(context: DrawingContext, b: Bounds): void {
  context.ellipse(b.x + b.width * 0.5, b.y + b.height * 0.56, b.width * 0.42, b.height * 0.2, "#ffd43b", "#f08c00", 2);
  context.ellipse(b.x + b.width * 0.5, b.y + b.height * 0.45, b.width * 0.34, b.height * 0.15, "#ffffff");
}

function drawFlower(context: DrawingContext, b: Bounds, v: CountingVariation): void {
  const cx = b.x + b.width / 2;
  const cy = b.y + b.height * 0.43;
  for (let i = 0; i < 6; i += 1) {
    const angle = (Math.PI * 2 * i) / 6;
    context.ellipse(cx + Math.cos(angle) * b.width * 0.18, cy + Math.sin(angle) * b.height * 0.18, b.width * 0.13, b.height * 0.09, v.color, "#c2255c", 1);
  }
  context.circle(cx, cy, b.width * 0.11, "#ffd43b", "#f08c00", 1);
  context.line(cx, cy + b.height * 0.12, cx, b.y + b.height * 0.92, "#2b8a3e", 3);
}

function drawTree(context: DrawingContext, b: Bounds, v: CountingVariation): void {
  context.rect(b.x + b.width * 0.43, b.y + b.height * 0.53, b.width * 0.14, b.height * 0.33, "#8b5e34");
  context.circle(b.x + b.width * 0.5, b.y + b.height * 0.38, b.width * 0.34, v.accentColor, "#2b8a3e", 2);
}

function drawStar(context: DrawingContext, b: Bounds, v: CountingVariation): void {
  const cx = b.x + b.width / 2;
  const cy = b.y + b.height / 2;
  const points: Point[] = [];
  for (let i = 0; i < 10; i += 1) {
    const radius = i % 2 === 0 ? b.width * 0.38 : b.width * 0.17;
    const angle = -Math.PI / 2 + (Math.PI * 2 * i) / 10;
    points.push({ x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius });
  }
  context.polygon(points, "#ffd43b", "#f08c00", 2);
  context.circle(cx - b.width * 0.1, cy - b.height * 0.03, b.width * 0.025, v.detailColor);
}

function drawMoon(context: DrawingContext, b: Bounds): void {
  context.circle(b.x + b.width * 0.48, b.y + b.height * 0.48, b.width * 0.35, "#ffe066", "#fab005", 2);
  context.circle(b.x + b.width * 0.62, b.y + b.height * 0.4, b.width * 0.33, "#ffffff");
}

function drawSun(context: DrawingContext, b: Bounds): void {
  const cx = b.x + b.width / 2;
  const cy = b.y + b.height / 2;
  for (let i = 0; i < 10; i += 1) {
    const angle = (Math.PI * 2 * i) / 10;
    context.line(cx, cy, cx + Math.cos(angle) * b.width * 0.44, cy + Math.sin(angle) * b.height * 0.44, "#fab005", 3);
  }
  context.circle(cx, cy, b.width * 0.28, "#ffd43b", "#f08c00", 2);
}

function drawBall(context: DrawingContext, b: Bounds, v: CountingVariation): void {
  const cx = b.x + b.width / 2;
  const cy = b.y + b.height / 2;
  context.circle(cx, cy, b.width * 0.35, v.color, v.detailColor, 2);
  context.line(cx - b.width * 0.28, cy, cx + b.width * 0.28, cy, "#ffffff", 2);
  context.line(cx, cy - b.height * 0.28, cx, cy + b.height * 0.28, "#ffffff", 2);
}

function drawBalloon(context: DrawingContext, b: Bounds, v: CountingVariation): void {
  const cx = b.x + b.width / 2;
  context.ellipse(cx, b.y + b.height * 0.38, b.width * 0.29, b.height * 0.34, v.color, v.detailColor, 2);
  context.polygon([{ x: cx - 5, y: b.y + b.height * 0.68 }, { x: cx + 5, y: b.y + b.height * 0.68 }, { x: cx, y: b.y + b.height * 0.76 }], v.color);
  context.line(cx, b.y + b.height * 0.75, cx - b.width * 0.08, b.y + b.height * 0.95, "#495057", 1);
}

function drawCar(context: DrawingContext, b: Bounds, v: CountingVariation): void {
  context.roundedRect(b.x + b.width * 0.12, b.y + b.height * 0.45, b.width * 0.76, b.height * 0.24, 7, v.color, v.detailColor, 2);
  context.polygon([{ x: b.x + b.width * 0.28, y: b.y + b.height * 0.45 }, { x: b.x + b.width * 0.42, y: b.y + b.height * 0.28 }, { x: b.x + b.width * 0.62, y: b.y + b.height * 0.28 }, { x: b.x + b.width * 0.75, y: b.y + b.height * 0.45 }], v.accentColor, v.detailColor, 2);
  context.circle(b.x + b.width * 0.3, b.y + b.height * 0.72, b.width * 0.08, "#343a40");
  context.circle(b.x + b.width * 0.7, b.y + b.height * 0.72, b.width * 0.08, "#343a40");
}

function drawBoat(context: DrawingContext, b: Bounds, v: CountingVariation): void {
  context.polygon([{ x: b.x + b.width * 0.16, y: b.y + b.height * 0.58 }, { x: b.x + b.width * 0.84, y: b.y + b.height * 0.58 }, { x: b.x + b.width * 0.7, y: b.y + b.height * 0.78 }, { x: b.x + b.width * 0.3, y: b.y + b.height * 0.78 }], v.color, v.detailColor, 2);
  context.line(b.x + b.width * 0.48, b.y + b.height * 0.54, b.x + b.width * 0.48, b.y + b.height * 0.2, "#495057", 2);
  context.polygon([{ x: b.x + b.width * 0.5, y: b.y + b.height * 0.22 }, { x: b.x + b.width * 0.72, y: b.y + b.height * 0.5 }, { x: b.x + b.width * 0.5, y: b.y + b.height * 0.5 }], v.accentColor, v.detailColor, 1);
}

function drawHouse(context: DrawingContext, b: Bounds, v: CountingVariation): void {
  context.rect(b.x + b.width * 0.23, b.y + b.height * 0.45, b.width * 0.54, b.height * 0.36, v.accentColor, v.detailColor, 2);
  context.polygon([{ x: b.x + b.width * 0.17, y: b.y + b.height * 0.45 }, { x: b.x + b.width * 0.5, y: b.y + b.height * 0.16 }, { x: b.x + b.width * 0.83, y: b.y + b.height * 0.45 }], v.color, v.detailColor, 2);
  context.rect(b.x + b.width * 0.45, b.y + b.height * 0.62, b.width * 0.12, b.height * 0.19, "#ffffff", v.detailColor, 1);
}

function drawFish(context: DrawingContext, b: Bounds, v: CountingVariation): void {
  context.ellipse(b.x + b.width * 0.48, b.y + b.height * 0.5, b.width * 0.29, b.height * 0.2, v.color, v.detailColor, 2);
  context.polygon([{ x: b.x + b.width * 0.18, y: b.y + b.height * 0.5 }, { x: b.x + b.width * 0.03, y: b.y + b.height * 0.34 }, { x: b.x + b.width * 0.03, y: b.y + b.height * 0.66 }], v.accentColor, v.detailColor, 2);
  context.circle(b.x + b.width * 0.62, b.y + b.height * 0.44, b.width * 0.025, "#212529");
}

function drawBird(context: DrawingContext, b: Bounds, v: CountingVariation): void {
  context.ellipse(b.x + b.width * 0.52, b.y + b.height * 0.52, b.width * 0.28, b.height * 0.2, v.color, v.detailColor, 2);
  context.circle(b.x + b.width * 0.72, b.y + b.height * 0.39, b.width * 0.13, v.color, v.detailColor, 2);
  context.polygon([{ x: b.x + b.width * 0.84, y: b.y + b.height * 0.39 }, { x: b.x + b.width * 0.96, y: b.y + b.height * 0.34 }, { x: b.x + b.width * 0.84, y: b.y + b.height * 0.46 }], "#ffd43b");
}

function drawCat(context: DrawingContext, b: Bounds, v: CountingVariation): void {
  context.circle(b.x + b.width * 0.5, b.y + b.height * 0.52, b.width * 0.3, v.color, v.detailColor, 2);
  context.polygon([{ x: b.x + b.width * 0.3, y: b.y + b.height * 0.32 }, { x: b.x + b.width * 0.38, y: b.y + b.height * 0.13 }, { x: b.x + b.width * 0.46, y: b.y + b.height * 0.32 }], v.color, v.detailColor, 2);
  context.polygon([{ x: b.x + b.width * 0.54, y: b.y + b.height * 0.32 }, { x: b.x + b.width * 0.62, y: b.y + b.height * 0.13 }, { x: b.x + b.width * 0.7, y: b.y + b.height * 0.32 }], v.color, v.detailColor, 2);
  context.circle(b.x + b.width * 0.4, b.y + b.height * 0.5, b.width * 0.025, "#212529");
  context.circle(b.x + b.width * 0.6, b.y + b.height * 0.5, b.width * 0.025, "#212529");
}

function drawDog(context: DrawingContext, b: Bounds, v: CountingVariation): void {
  context.circle(b.x + b.width * 0.5, b.y + b.height * 0.52, b.width * 0.3, v.color, v.detailColor, 2);
  context.ellipse(b.x + b.width * 0.24, b.y + b.height * 0.46, b.width * 0.11, b.height * 0.19, v.accentColor, v.detailColor, 2);
  context.ellipse(b.x + b.width * 0.76, b.y + b.height * 0.46, b.width * 0.11, b.height * 0.19, v.accentColor, v.detailColor, 2);
  context.circle(b.x + b.width * 0.5, b.y + b.height * 0.58, b.width * 0.045, "#212529");
}

function drawDuck(context: DrawingContext, b: Bounds, v: CountingVariation): void {
  context.ellipse(b.x + b.width * 0.47, b.y + b.height * 0.58, b.width * 0.32, b.height * 0.2, "#ffd43b", "#f08c00", 2);
  context.circle(b.x + b.width * 0.66, b.y + b.height * 0.39, b.width * 0.14, "#ffd43b", "#f08c00", 2);
  context.polygon([{ x: b.x + b.width * 0.78, y: b.y + b.height * 0.39 }, { x: b.x + b.width * 0.94, y: b.y + b.height * 0.33 }, { x: b.x + b.width * 0.78, y: b.y + b.height * 0.45 }], v.color);
}

function drawButterfly(context: DrawingContext, b: Bounds, v: CountingVariation): void {
  const cx = b.x + b.width / 2;
  context.ellipse(cx - b.width * 0.16, b.y + b.height * 0.42, b.width * 0.18, b.height * 0.24, v.color, v.detailColor, 2);
  context.ellipse(cx + b.width * 0.16, b.y + b.height * 0.42, b.width * 0.18, b.height * 0.24, v.accentColor, v.detailColor, 2);
  context.ellipse(cx, b.y + b.height * 0.54, b.width * 0.06, b.height * 0.25, "#495057");
  context.line(cx, b.y + b.height * 0.33, cx - b.width * 0.12, b.y + b.height * 0.2, "#495057", 1);
  context.line(cx, b.y + b.height * 0.33, cx + b.width * 0.12, b.y + b.height * 0.2, "#495057", 1);
}

function drawLadybug(context: DrawingContext, b: Bounds, v: CountingVariation): void {
  const cx = b.x + b.width / 2;
  const cy = b.y + b.height / 2;
  context.circle(cx, cy, b.width * 0.32, "#e03131", "#212529", 2);
  context.line(cx, cy - b.height * 0.28, cx, cy + b.height * 0.28, "#212529", 2);
  context.circle(cx - b.width * 0.12, cy - b.height * 0.04, b.width * 0.035, v.detailColor);
  context.circle(cx + b.width * 0.13, cy + b.height * 0.08, b.width * 0.035, v.detailColor);
}

function drawKite(context: DrawingContext, b: Bounds, v: CountingVariation): void {
  const cx = b.x + b.width / 2;
  context.polygon([{ x: cx, y: b.y + b.height * 0.12 }, { x: b.x + b.width * 0.78, y: b.y + b.height * 0.42 }, { x: cx, y: b.y + b.height * 0.73 }, { x: b.x + b.width * 0.22, y: b.y + b.height * 0.42 }], v.color, v.detailColor, 2);
  context.line(cx, b.y + b.height * 0.73, cx - b.width * 0.12, b.y + b.height * 0.95, "#495057", 1);
}

function drawBlock(context: DrawingContext, b: Bounds, v: CountingVariation): void {
  context.roundedRect(b.x + b.width * 0.18, b.y + b.height * 0.2, b.width * 0.64, b.height * 0.64, 8, v.color, v.detailColor, 2);
  context.line(b.x + b.width * 0.32, b.y + b.height * 0.42, b.x + b.width * 0.68, b.y + b.height * 0.42, "#ffffff", 3);
  context.line(b.x + b.width * 0.32, b.y + b.height * 0.58, b.x + b.width * 0.68, b.y + b.height * 0.58, "#ffffff", 3);
}

function drawHeart(context: DrawingContext, b: Bounds, v: CountingVariation): void {
  const cx = b.x + b.width / 2;
  context.circle(cx - b.width * 0.14, b.y + b.height * 0.4, b.width * 0.17, v.color, v.detailColor, 1.5);
  context.circle(cx + b.width * 0.14, b.y + b.height * 0.4, b.width * 0.17, v.color, v.detailColor, 1.5);
  context.polygon([{ x: cx - b.width * 0.32, y: b.y + b.height * 0.48 }, { x: cx + b.width * 0.32, y: b.y + b.height * 0.48 }, { x: cx, y: b.y + b.height * 0.82 }], v.color, v.detailColor, 1.5);
}

function drawIceCream(context: DrawingContext, b: Bounds, v: CountingVariation): void {
  context.polygon([{ x: b.x + b.width * 0.34, y: b.y + b.height * 0.55 }, { x: b.x + b.width * 0.66, y: b.y + b.height * 0.55 }, { x: b.x + b.width * 0.5, y: b.y + b.height * 0.92 }], "#d8a45f", "#8f5f2a", 2);
  context.circle(b.x + b.width * 0.5, b.y + b.height * 0.39, b.width * 0.24, v.color, v.detailColor, 2);
}

function drawCupcake(context: DrawingContext, b: Bounds, v: CountingVariation): void {
  context.polygon([{ x: b.x + b.width * 0.28, y: b.y + b.height * 0.52 }, { x: b.x + b.width * 0.72, y: b.y + b.height * 0.52 }, { x: b.x + b.width * 0.64, y: b.y + b.height * 0.84 }, { x: b.x + b.width * 0.36, y: b.y + b.height * 0.84 }], v.accentColor, v.detailColor, 2);
  context.ellipse(b.x + b.width * 0.5, b.y + b.height * 0.42, b.width * 0.28, b.height * 0.16, v.color, v.detailColor, 2);
  context.circle(b.x + b.width * 0.5, b.y + b.height * 0.25, b.width * 0.04, "#e03131");
}

function drawPencil(context: DrawingContext, b: Bounds, v: CountingVariation): void {
  context.rect(b.x + b.width * 0.2, b.y + b.height * 0.42, b.width * 0.52, b.height * 0.16, v.color, v.detailColor, 2);
  context.polygon([{ x: b.x + b.width * 0.72, y: b.y + b.height * 0.42 }, { x: b.x + b.width * 0.9, y: b.y + b.height * 0.5 }, { x: b.x + b.width * 0.72, y: b.y + b.height * 0.58 }], "#f1c27d", v.detailColor, 2);
  context.rect(b.x + b.width * 0.12, b.y + b.height * 0.42, b.width * 0.08, b.height * 0.16, "#f783ac", v.detailColor, 1);
}

function drawBook(context: DrawingContext, b: Bounds, v: CountingVariation): void {
  context.roundedRect(b.x + b.width * 0.2, b.y + b.height * 0.24, b.width * 0.28, b.height * 0.56, 4, v.color, v.detailColor, 2);
  context.roundedRect(b.x + b.width * 0.48, b.y + b.height * 0.24, b.width * 0.32, b.height * 0.56, 4, v.accentColor, v.detailColor, 2);
  context.line(b.x + b.width * 0.48, b.y + b.height * 0.26, b.x + b.width * 0.48, b.y + b.height * 0.78, "#ffffff", 2);
}
