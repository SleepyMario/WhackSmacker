#!/usr/bin/env python3
"""Generate Belgium's three administrative-region geography artwork."""

from __future__ import annotations

import json
import os
from collections import defaultdict
from pathlib import Path

os.environ.setdefault("MPLCONFIGDIR", "/tmp/whacksmacker-belgium-regions-mpl")
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.patheffects as path_effects
from matplotlib.collections import LineCollection
from matplotlib.patches import Polygon

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "packages/geography/data/belgium-provinces/source-BEL-nuts2-2024.geojson"
DATA = ROOT / "packages/geography/data/belgium-regions"
SPLIT = DATA / "split"

REGION_FOR_PROVINCE = {
    "Antwerp": "Flanders",
    "Limburg": "Flanders",
    "East Flanders": "Flanders",
    "Flemish Brabant": "Flanders",
    "West Flanders": "Flanders",
    "Brussels": "Brussels",
    "Hainaut": "Wallonia",
    "Liège": "Wallonia",
    "Luxembourg": "Wallonia",
    "Namur": "Wallonia",
    "Walloon Brabant": "Wallonia",
}
ORDER = ["Flanders", "Brussels", "Wallonia"]
COLORS = {"Flanders": "#86cf83", "Brussels": "#9b82dc", "Wallonia": "#d58aa5"}


def rings(geometry: dict) -> list[list[list[float]]]:
    coordinates = geometry["coordinates"]
    if geometry["type"] == "Polygon":
        return [coordinates[0]]
    if geometry["type"] == "MultiPolygon":
        return [polygon[0] for polygon in coordinates]
    raise ValueError(f"Unsupported geometry: {geometry['type']}")


def polygon_area(ring: list[list[float]]) -> float:
    return abs(sum(
        ring[index][0] * ring[(index + 1) % len(ring)][1]
        - ring[(index + 1) % len(ring)][0] * ring[index][1]
        for index in range(len(ring))
    )) / 2


source = json.loads(SOURCE.read_text(encoding="utf-8"))
members: dict[str, list[dict]] = defaultdict(list)
for feature in source["features"]:
    province = feature["properties"]["shapeName"]
    members[REGION_FOR_PROVINCE[province]].append(feature)

all_points = [point for region in ORDER for feature in members[region]
              for ring in rings(feature["geometry"]) for point in ring]
min_x, max_x = min(point[0] for point in all_points), max(point[0] for point in all_points)
min_y, max_y = min(point[1] for point in all_points), max(point[1] for point in all_points)
width, height = max_x - min_x, max_y - min_y


def region_center(region: str) -> tuple[float, float]:
    candidates = [(polygon_area(ring), ring) for feature in members[region] for ring in rings(feature["geometry"])]
    _, ring = max(candidates, key=lambda item: item[0])
    return (sum(point[0] for point in ring) / len(ring), sum(point[1] for point in ring) / len(ring))


def boundary_segments() -> list[list[tuple[float, float]]]:
    """Keep country and inter-region borders while suppressing province lines."""
    segments: dict[tuple[tuple[float, float], tuple[float, float]], list[str]] = defaultdict(list)
    original: dict[tuple[tuple[float, float], tuple[float, float]], tuple[tuple[float, float], tuple[float, float]]] = {}
    for region in ORDER:
        for feature in members[region]:
            for ring in rings(feature["geometry"]):
                for index in range(len(ring) - 1):
                    start = tuple(ring[index][:2]); end = tuple(ring[index + 1][:2])
                    rounded = (tuple(round(value, 6) for value in start), tuple(round(value, 6) for value in end))
                    key = tuple(sorted(rounded))
                    segments[key].append(region)
                    original[key] = (start, end)
    return [list(original[key]) for key, regions in segments.items()
            if len(set(regions)) > 1 or len(regions) == 1]


OUTLINES = boundary_segments()


def draw(path: Path, *, target: str | None = None, labels: str | None = None,
         title: str = "Belgium — Regions") -> None:
    fig, ax = plt.subplots(figsize=(12, 9), dpi=180)
    for region in ORDER:
        fill = "#e98255" if region == target else (COLORS[region] if target is None else "#dce1df")
        for feature in members[region]:
            for ring in rings(feature["geometry"]):
                # A same-colour edge covers antialiasing seams between the
                # source provinces after they have been grouped into a region.
                ax.add_patch(Polygon(ring, closed=True, facecolor=fill, edgecolor=fill, linewidth=.8))
    ax.add_collection(LineCollection(OUTLINES, colors="#304247", linewidths=.7, zorder=10))

    if labels is not None:
        for index, region in enumerate(ORDER, 1):
            x, y = region_center(region)
            if region == "Brussels":
                text = region if labels == "name" else str(index)
                ax.annotate(text, xy=(x, y), xytext=(x, max_y + height * .08), ha="center", va="center",
                            fontsize=20 if labels == "name" else 18, fontweight="bold", color="#142429",
                            bbox=dict(boxstyle="round,pad=.16", facecolor="#fffdf4", alpha=.94, linewidth=0),
                            arrowprops=dict(arrowstyle="-", color="#142429", linewidth=1.4, shrinkA=5, shrinkB=2),
                            zorder=20)
            else:
                text = region if labels == "name" else str(index)
                fontsize = 25 if labels == "name" else 19
                rendered = ax.text(x, y, text, ha="center", va="center", fontsize=fontsize,
                                   fontweight="bold", color="#142429", zorder=20)
                rendered.set_path_effects([path_effects.withStroke(linewidth=3.5, foreground="#fffdf4", alpha=.9)])

    ax.set_xlim(min_x - width * .045, max_x + width * .045)
    ax.set_ylim(min_y - height * .055, max_y + height * .16)
    ax.set_aspect("equal")
    ax.axis("off")
    ax.set_title(title, fontsize=22, pad=12, fontweight="bold")
    fig.text(.5, .018, "Three administrative regions • north is up", ha="center", fontsize=9, color="#46585d")
    fig.tight_layout(rect=(.01, .04, .99, .97))
    path.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(path, bbox_inches="tight", facecolor="#f5f1e8")
    plt.close(fig)


SPLIT.mkdir(parents=True, exist_ok=True)
draw(SPLIT / "reference.png")
draw(DATA / "divisions-numbered.png", labels="number")
draw(DATA / "divisions-named.png", labels="name")
metadata = []
for region in ORDER:
    stem = region.lower()
    metadata.append({"id": f"{stem}-highlight", "answer": region, "kind": "Region"})
    draw(SPLIT / f"{stem}-question.png", target=region, title="Which region is highlighted?")
    draw(SPLIT / f"{stem}-answer.png", target=region, title=region)
(DATA / "divisions.json").write_text(json.dumps(metadata, indent=2) + "\n", encoding="utf-8")
