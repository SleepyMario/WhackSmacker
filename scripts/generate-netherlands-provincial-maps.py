#!/usr/bin/env python3
"""Generate Netherlands province quiz artwork."""

from __future__ import annotations

import colorsys
import json
import os
import re
from pathlib import Path

os.environ.setdefault("MPLCONFIGDIR", "/tmp/whacksmacker-netherlands-map-mpl")

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.path import Path as PlotPath
from matplotlib.patches import PathPatch
from matplotlib.patches import Polygon

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "packages/geography/data/netherlands-provinces"
SPLIT = DATA / "split"


def rings(geometry: dict) -> list[list[list[float]]]:
    coordinates = geometry["coordinates"]
    if geometry["type"] == "Polygon":
        return [coordinates[0]]
    if geometry["type"] == "MultiPolygon":
        return [polygon[0] for polygon in coordinates]
    raise ValueError(f"Unsupported geometry: {geometry['type']}")


def polygon_area(ring: list[list[float]]) -> float:
    return abs(sum(
        ring[i][0] * ring[(i + 1) % len(ring)][1] - ring[(i + 1) % len(ring)][0] * ring[i][1]
        for i in range(len(ring))
    )) / 2


def label_point(feature: dict) -> tuple[float, float]:
    ring = max(rings(feature["geometry"]), key=polygon_area)
    xs = [point[0] for point in ring]
    ys = [point[1] for point in ring]
    return (sum(xs) / len(xs), sum(ys) / len(ys))


def feature_area(feature: dict) -> float:
    return sum(polygon_area(ring) for ring in rings(feature["geometry"]))


def slug(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")


features: list[dict] = []
source = json.loads((DATA / "source-nld-adm1.geojson").read_text(encoding="utf-8"))
for feature in source["features"]:
    feature["answer"] = feature["properties"]["shapeName"]
    feature["center"] = label_point(feature)
    features.append(feature)

land_source = json.loads((DATA / "source-natural-earth-land.geojson").read_text(encoding="utf-8"))
lake_source = json.loads((DATA / "source-natural-earth-lakes.geojson").read_text(encoding="utf-8"))
minor_islands_source = json.loads((DATA / "source-natural-earth-minor-islands.geojson").read_text(encoding="utf-8"))
europe_lake_source = json.loads((DATA / "source-natural-earth-lakes-europe.geojson").read_text(encoding="utf-8"))
land_source["features"].extend(minor_islands_source["features"])
lake_source["features"].extend(europe_lake_source["features"])

# A stable north-to-south teaching order makes the numbered reference easier to scan.
features.sort(key=lambda item: (-item["center"][1], item["center"][0], item["answer"]))
colors = {
    feature["answer"]: colorsys.hsv_to_rgb((index * .61803398875) % 1, .38, .84)
    for index, feature in enumerate(features, 1)
}

label_callouts: dict[str, tuple[float, float]] = {}
internal_label_overrides: dict[str, tuple[float, float]] = {}

all_points = [point for feature in features for ring in rings(feature["geometry"]) for point in ring]
min_lon = min(point[0] for point in all_points)
max_lon = max(point[0] for point in all_points)
min_lat = min(point[1] for point in all_points)
max_lat = max(point[1] for point in all_points)


def geometry_rings(geometry: dict) -> list[list[list[float]]]:
    if geometry["type"] == "Polygon":
        return geometry["coordinates"]
    if geometry["type"] == "MultiPolygon":
        return [ring for polygon in geometry["coordinates"] for ring in polygon]
    return []


def touches_view(ring: list[list[float]]) -> bool:
    xs = [point[0] for point in ring]
    ys = [point[1] for point in ring]
    return not (max(xs) < min_lon - .5 or min(xs) > max_lon + .5 or max(ys) < min_lat - .5 or min(ys) > max_lat + .5)


def compound_path(source_data: dict) -> PlotPath:
    paths = []
    for feature in source_data["features"]:
        for ring in geometry_rings(feature["geometry"]):
            if len(ring) >= 3 and touches_view(ring):
                paths.append(PlotPath(ring + [ring[0]],
                                      [PlotPath.MOVETO] + [PlotPath.LINETO] * (len(ring) - 1) + [PlotPath.CLOSEPOLY]))
    return PlotPath.make_compound_path(*paths)


land_path = compound_path(land_source)
lake_path = compound_path(lake_source)


def draw_map(path: Path, *, target: str | None = None, labels: str | None = None, title: str = "Netherlands — Provinces") -> None:
    fig, ax = plt.subplots(figsize=((12 if labels == "name" else 9), 12), dpi=180)
    land_clip = PathPatch(land_path, transform=ax.transData)
    # Draw enclosing provinces first and tiny metropolitan units last. Some
    # source polygons overlap rather than carrying explicit interior holes.
    draw_order = sorted(features, key=feature_area, reverse=True)
    if target is not None:
        draw_order = [feature for feature in draw_order if feature["answer"] != target] + [
            feature for feature in draw_order if feature["answer"] == target
        ]
    for feature in draw_order:
        selected = feature["answer"] == target
        fill = "#e98255" if selected else (colors[feature["answer"]] if target is None else "#dce1df")
        for ring in rings(feature["geometry"]):
            province_patch = Polygon(ring, closed=True, facecolor=fill, edgecolor="#304247", linewidth=.75)
            province_patch.set_clip_path(land_clip)
            ax.add_patch(province_patch)

    # Administrative polygons include provincial water surfaces. Redraw actual
    # lakes so het IJsselmeer remains visible, while the land clip preserves the
    # Wadden Islands instead of filling the Wadden Sea around them.
    ax.add_patch(PathPatch(lake_path, transform=ax.transData, facecolor="#f5f1e8",
                           edgecolor="#304247", linewidth=.65, zorder=10))

    if labels is not None:
        for index, feature in enumerate(features, 1):
            target_x, target_y = feature["center"]
            if feature["answer"] in label_callouts:
                label_x, label_y = label_callouts[feature["answer"]]
                ax.annotate(
                    str(index), xy=(target_x, target_y), xytext=(label_x, label_y),
                    ha="center", va="center", fontsize=14, fontweight="bold", color="#142429",
                    bbox=dict(boxstyle="round,pad=.18", facecolor="#fffdf4", alpha=.92, linewidth=0),
                    arrowprops=dict(arrowstyle="-", color="#142429", linewidth=1.15, shrinkA=4, shrinkB=2),
                    zorder=20,
                )
            else:
                label_x, label_y = internal_label_overrides.get(feature["answer"], (target_x, target_y))
                ax.text(label_x, label_y, str(index), ha="center", va="center", fontsize=14,
                        fontweight="bold", color="#142429",
                        bbox=dict(boxstyle="round,pad=.18", facecolor="#fffdf4", alpha=.84, linewidth=0),
                        zorder=20)

    if labels == "name":
        ax.set_position([.04, .06, .55, .87])
        for index, feature in enumerate(features, 1):
            fig.text(.64, .84 - (index - 1) * .065, f"{index}. {feature['answer']}",
                     ha="left", va="center", fontsize=10.5, fontweight="bold", color="#142429")

    ax.set_xlim(min_lon - .35, max_lon + .35)
    ax.set_ylim(min_lat - .35, max_lat + .35)
    ax.set_aspect("equal")
    ax.axis("off")
    ax.set_title(title, fontsize=17, pad=12, fontweight="bold")
    fig.text(.5, .018, "Twelve provinces • north is up",
             ha="center", fontsize=7, color="#46585d")
    if labels != "name":
        fig.tight_layout(rect=(0, .035, 1, .97))
    path.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(path, bbox_inches="tight", facecolor="#f5f1e8")
    plt.close(fig)


SPLIT.mkdir(parents=True, exist_ok=True)
draw_map(SPLIT / "reference.png")
draw_map(DATA / "netherlands-provinces-numbered.png", labels="number")
draw_map(DATA / "netherlands-provinces-named.png", labels="name")

metadata = []
for feature in features:
    stem = slug(feature["answer"])
    metadata.append({
        "id": f"{stem}-highlight",
        "answer": feature["answer"],
        "kind": "Province",
        "sourceCode": feature["properties"].get("shapeISO", "")
    })
    draw_map(SPLIT / f"{stem}-question.png", target=feature["answer"], title="Which province is highlighted?")
    draw_map(SPLIT / f"{stem}-answer.png", target=feature["answer"], title=feature["answer"])

(DATA / "provinces.json").write_text(json.dumps(metadata, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
