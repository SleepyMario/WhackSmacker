#!/usr/bin/env python3
"""Generate one-peninsula Korea provincial-level quiz artwork."""

from __future__ import annotations

import colorsys
import json
import os
import re
from pathlib import Path

os.environ.setdefault("MPLCONFIGDIR", "/tmp/whacksmacker-korea-map-mpl")

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import Polygon

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "packages/geography/data/korea-provinces"
SPLIT = DATA / "split"

# Canonical Wandering the World map priorities: retain the complete studied
# geography, maximize its landmass on the canvas, and then maximize readable
# labels. Small divisions may use full-size external labels with leader lines.
# See packages/geography/data/MAP_ARTWORK_RULES.md.


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
for filename, area in [("source-prk-adm1.geojson", "north"), ("source-kor-adm1.geojson", "south")]:
    source = json.loads((DATA / filename).read_text(encoding="utf-8"))
    for feature in source["features"]:
        feature["area"] = area
        feature["answer"] = feature["properties"]["shapeName"]
        feature["center"] = label_point(feature)
        features.append(feature)

# A stable north-to-south teaching order makes the numbered reference easier to scan.
features.sort(key=lambda item: (-item["center"][1], item["center"][0], item["answer"]))
colors = {
    feature["answer"]: colorsys.hsv_to_rgb((index * .61803398875) % 1, .38, .84)
    for index, feature in enumerate(features, 1)
}

# Small metropolitan divisions use full-size labels outside their polygons.
# The line endpoint remains the source-derived representative point, while the
# label is moved to nearby open water so every number uses the same type size.
label_callouts = {
    "Pyongyang": (124.72, 39.22),
    "Nampo": (124.62, 38.72),
    "Seoul": (125.88, 37.70),
    "Incheon": (125.88, 37.30),
    "Sejong": (125.73, 36.60),
    "Daejeon": (125.73, 36.20),
    "Daegu": (129.95, 35.93),
    "Ulsan": (130.12, 35.55),
    "Gwangju": (125.62, 35.25),
    "Busan": (130.12, 35.08),
}

# Gyeonggi is large enough for an internal label, but its source-derived point
# falls directly beside the Seoul callout target because it surrounds Seoul.
internal_label_overrides = {
    "Gyeonggi": (127.42, 37.20),
}

all_points = [point for feature in features for ring in rings(feature["geometry"]) for point in ring]
min_lon = min(point[0] for point in all_points)
max_lon = max(point[0] for point in all_points)
min_lat = min(point[1] for point in all_points)
max_lat = max(point[1] for point in all_points)


def draw_map(path: Path, *, target: str | None = None, labels: str | None = None, title: str = "Korea — Provincial-level Divisions") -> None:
    fig, ax = plt.subplots(figsize=((12 if labels == "name" else 9), 12), dpi=180)
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
            ax.add_patch(Polygon(ring, closed=True, facecolor=fill, edgecolor="#304247", linewidth=.75))

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
            column = 0 if index <= 14 else 1
            row = index - 1 if index <= 14 else index - 15
            fig.text(.62 + column * .19, .88 - row * .055, f"{index}. {feature['answer']}",
                     ha="left", va="center", fontsize=8.5, fontweight="bold", color="#142429")

    # The whole peninsula uses one visual treatment; the inter-Korean boundary is
    # only where adjacent first-level polygons meet and is not styled specially.
    ax.set_xlim(min_lon - .35, max_lon + .35)
    ax.set_ylim(min_lat - .35, max_lat + .35)
    ax.set_aspect("equal")
    ax.axis("off")
    ax.set_title(title, fontsize=17, pad=12, fontweight="bold")
    fig.text(.5, .018, "Unified teaching map • first-level administrative divisions • north is up",
             ha="center", fontsize=7, color="#46585d")
    if labels != "name":
        fig.tight_layout(rect=(0, .035, 1, .97))
    path.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(path, bbox_inches="tight", facecolor="#f5f1e8")
    plt.close(fig)


SPLIT.mkdir(parents=True, exist_ok=True)
draw_map(SPLIT / "reference.png")
draw_map(DATA / "korea-provinces-numbered.png", labels="number")
draw_map(DATA / "korea-provinces-named.png", labels="name")

metadata = []
for feature in features:
    stem = slug(feature["answer"])
    metadata.append({
        "id": f"{stem}-highlight",
        "answer": feature["answer"],
        "kind": "Province or first-level city",
        "area": feature["area"],
        "sourceCode": feature["properties"].get("shapeISO", "")
    })
    draw_map(SPLIT / f"{stem}-question.png", target=feature["answer"], title="Which provincial-level division is highlighted?")
    draw_map(SPLIT / f"{stem}-answer.png", target=feature["answer"], title=feature["answer"])

(DATA / "provinces.json").write_text(json.dumps(metadata, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def regional_extent(displayed: list[dict]) -> tuple[float, float, float, float]:
    points = [point for feature in displayed for ring in rings(feature["geometry"]) for point in ring]
    return (
        min(point[0] for point in points) - .12,
        max(point[0] for point in points) + .12,
        min(point[1] for point in points) - .12,
        max(point[1] for point in points) + .12,
    )


def draw_regional_map(
    path: Path,
    displayed: list[dict],
    *,
    target: str | None = None,
    labels: str | None = None,
    title: str,
) -> None:
    named = labels == "name"
    map_label_font = 20
    fig = plt.figure(figsize=((14, 10) if named else (10, 10)), dpi=180, facecolor="#f5f1e8")
    ax = fig.add_axes(([.015, .055, .69, .89] if named else [.015, .055, .97, .89]), facecolor="#f5f1e8")
    draw_order = sorted(displayed, key=feature_area, reverse=True)
    if target is not None:
        draw_order = [feature for feature in draw_order if feature["answer"] != target] + [
            feature for feature in draw_order if feature["answer"] == target
        ]
    for feature in draw_order:
        selected = feature["answer"] == target
        fill = "#e98255" if selected else (colors[feature["answer"]] if target is None else "#dce1df")
        for ring in rings(feature["geometry"]):
            ax.add_patch(Polygon(ring, closed=True, facecolor=fill, edgecolor="#304247", linewidth=.75))

    if labels is not None:
        for index, feature in enumerate(displayed, 1):
            target_x, target_y = feature["center"]
            if feature["answer"] in label_callouts:
                label_x, label_y = label_callouts[feature["answer"]]
                ax.annotate(
                    str(index), xy=(target_x, target_y), xytext=(label_x, label_y),
                    ha="center", va="center", fontsize=map_label_font, fontweight="bold", color="#142429",
                    bbox=dict(boxstyle="round,pad=.18", facecolor="#fffdf4", alpha=.92, linewidth=0),
                    arrowprops=dict(arrowstyle="-", color="#142429", linewidth=1.2, shrinkA=4, shrinkB=2),
                    annotation_clip=False, zorder=20,
                )
            else:
                label_x, label_y = internal_label_overrides.get(feature["answer"], (target_x, target_y))
                ax.text(
                    label_x, label_y, str(index), ha="center", va="center", fontsize=map_label_font,
                    fontweight="bold", color="#142429",
                    bbox=dict(boxstyle="round,pad=.18", facecolor="#fffdf4", alpha=.84, linewidth=0),
                    zorder=20,
                )

    if named:
        legend_font = 14
        row_spacing = min(.068, .78 / max(len(displayed) - 1, 1))
        for index, feature in enumerate(displayed, 1):
            fig.text(
                .75, .87 - (index - 1) * row_spacing, f"{index}. {feature['answer']}",
                ha="left", va="center", fontsize=legend_font, fontweight="bold", color="#142429",
            )

    bounds = regional_extent(displayed)
    ax.set_xlim(bounds[:2])
    ax.set_ylim(bounds[2:])
    ax.set_aspect("equal")
    ax.axis("off")
    fig.text(.5, .97, title, ha="center", va="top", fontsize=19, color="#243e48", fontweight="bold")
    fig.text(
        .5, .02, "First-level administrative divisions • north is up",
        ha="center", fontsize=7, color="#46585d",
    )
    path.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(path, facecolor="#f5f1e8")
    plt.close(fig)


for region_slug, region_label in [("north", "North"), ("south", "South")]:
    region_features = [feature for feature in features if feature["area"] == region_slug]
    region_dir = DATA / "regions" / region_slug
    region_split = region_dir / "split"
    regional_title = f"Korea — {region_label}"
    draw_regional_map(region_split / "reference.png", region_features, title=regional_title)
    draw_regional_map(region_dir / "provinces-numbered.png", region_features, labels="number", title=regional_title)
    draw_regional_map(region_dir / "provinces-named.png", region_features, labels="name", title=regional_title)
    region_metadata = []
    for feature in region_features:
        stem = slug(feature["answer"])
        region_metadata.append({
            "id": f"{stem}-highlight",
            "answer": feature["answer"],
            "kind": "Province or first-level city",
            "area": feature["area"],
            "sourceCode": feature["properties"].get("shapeISO", ""),
        })
        draw_regional_map(
            region_split / f"{stem}-question.png", region_features, target=feature["answer"],
            title="Which provincial-level division is highlighted?",
        )
        draw_regional_map(
            region_split / f"{stem}-answer.png", region_features, target=feature["answer"],
            title=feature["answer"],
        )
    (region_dir / "provinces.json").write_text(
        json.dumps(region_metadata, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
