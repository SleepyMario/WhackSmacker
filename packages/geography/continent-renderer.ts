import { continentDefinitions, type ContinentDefinition, type Coordinate, type Polygon } from "./data/continents";

const ansi = {
  reset: "\x1b[0m",
  brightCyan: "\x1b[96m",
  dim: "\x1b[2m"
};

export interface RenderContinentMapOptions {
  readonly highlight: string;
  readonly width?: number;
  readonly height?: number;
  readonly colorsEnabled?: boolean;
}

export interface RenderedContinentMap {
  readonly text: string;
  readonly width: number;
  readonly height: number;
  readonly highlightedCells: number;
  readonly visibleContinents: readonly string[];
  readonly usedCompactFallback: boolean;
}

export function getContinentDefinitions(): readonly ContinentDefinition[] {
  return continentDefinitions;
}

export function renderContinentMap(options: RenderContinentMapOptions): RenderedContinentMap {
  const width = clampInteger(options.width ?? 72, 24, 100);
  const height = clampInteger(options.height ?? 20, 10, 32);
  const colorsEnabled = options.colorsEnabled === true;
  const highlight = getContinentByNameOrId(options.highlight);

  const rows: string[] = [];
  const visible = new Set<string>();
  let highlightedCells = 0;
  const compact = width < 36;

  for (let y = 0; y < height; y += 1) {
    let row = "";
    for (let x = 0; x < width; x += 1) {
      const coordinate = projectCellToCoordinate(x, y, width, height);
      const continent = findContinentAt(coordinate);
      if (continent === undefined) {
        row += " ";
        continue;
      }

      visible.add(continent.name);
      const isHighlighted = continent.id === highlight.id;
      if (isHighlighted) {
        highlightedCells += 1;
      }

      row += renderLandCell(isHighlighted, colorsEnabled, compact);
    }
    rows.push(row.trimEnd());
  }

  return {
    text: rows.join("\n"),
    width,
    height,
    highlightedCells,
    visibleContinents: continentDefinitions.filter((continent) => visible.has(continent.name)).map((continent) => continent.name),
    usedCompactFallback: compact
  };
}

export function findContinentAt(coordinate: Coordinate): ContinentDefinition | undefined {
  return continentDefinitions.find((continent) => continent.polygons.some((polygon) => pointInPolygon(coordinate, polygon)));
}

function getContinentByNameOrId(value: string): ContinentDefinition {
  const normalized = value.toLowerCase();
  const continent = continentDefinitions.find((candidate) => candidate.id === normalized || candidate.name.toLowerCase() === normalized);
  if (continent === undefined) {
    throw new Error(`Unknown continent: ${value}`);
  }

  return continent;
}

function projectCellToCoordinate(x: number, y: number, width: number, height: number): Coordinate {
  const longitude = -180 + ((x + 0.5) / width) * 360;
  const latitude = 90 - ((y + 0.5) / height) * 180;

  return [longitude, latitude];
}

function renderLandCell(highlighted: boolean, colorsEnabled: boolean, compact: boolean): string {
  if (highlighted) {
    const cell = compact ? "#" : "█";
    return colorsEnabled ? `${ansi.brightCyan}${cell}${ansi.reset}` : cell;
  }

  const cell = compact ? "." : "░";
  return colorsEnabled ? `${ansi.dim}${cell}${ansi.reset}` : cell;
}

function pointInPolygon(point: Coordinate, polygon: Polygon): boolean {
  const [x, y] = point;
  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const [xi, yi] = polygon[i] as Coordinate;
    const [xj, yj] = polygon[j] as Coordinate;
    const intersects = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersects) {
      inside = !inside;
    }
  }

  return inside;
}

function clampInteger(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }

  return Math.max(min, Math.min(max, Math.floor(value)));
}
