#!/usr/bin/env python3
"""Generate Germany state quiz artwork with readable, consistent labels."""

from __future__ import annotations

import colorsys
import json
import os
import re
from pathlib import Path

os.environ.setdefault("MPLCONFIGDIR", "/tmp/whacksmacker-germany-map-mpl")
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import Polygon

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "packages/geography/data/germany-states"
SPLIT = DATA / "split"


def rings(geometry: dict) -> list[list[list[float]]]:
    coordinates = geometry["coordinates"]
    if geometry["type"] == "Polygon":
        return [coordinates[0]]
    if geometry["type"] == "MultiPolygon":
        return [polygon[0] for polygon in coordinates]
    raise ValueError(f"Unsupported geometry: {geometry['type']}")


def polygon_area(ring: list[list[float]]) -> float:
    return abs(sum(ring[i][0] * ring[(i + 1) % len(ring)][1] - ring[(i + 1) % len(ring)][0] * ring[i][1]
                   for i in range(len(ring)))) / 2


def label_point(feature: dict) -> tuple[float, float]:
    ring = max(rings(feature["geometry"]), key=polygon_area)
    return (sum(point[0] for point in ring) / len(ring), sum(point[1] for point in ring) / len(ring))


def slug(value: str) -> str:
    replacements = str.maketrans({"ä": "ae", "ö": "oe", "ü": "ue", "ß": "ss"})
    return re.sub(r"[^a-z0-9]+", "-", value.lower().translate(replacements)).strip("-")


source = json.loads((DATA / "source-deu-adm1.geojson").read_text(encoding="utf-8"))
features = []
for feature in source["features"]:
    feature["answer"] = feature["properties"]["shapeName"]
    feature["center"] = label_point(feature)
    features.append(feature)

# North-to-south order makes the numbered key predictable.
features.sort(key=lambda item: (-item["center"][1], item["center"][0], item["answer"]))
colors = {feature["answer"]: colorsys.hsv_to_rgb((index * .61803398875) % 1, .38, .84)
          for index, feature in enumerate(features, 1)}
all_points = [point for feature in features for ring in rings(feature["geometry"]) for point in ring]
min_lon, max_lon = min(p[0] for p in all_points), max(p[0] for p in all_points)
min_lat, max_lat = min(p[1] for p in all_points), max(p[1] for p in all_points)

# Put dense city-states outside their polygons without shrinking their labels.
callouts = {
    "Bremen": (6.55, 53.35),
    "Hamburg": (11.35, 54.25),
    "Berlin": (14.35, 52.85),
    "Saarland": (6.10, 49.25),
}


def draw_map(path: Path, *, target: str | None = None, labels: str | None = None,
             title: str = "Germany — States") -> None:
    fig, ax = plt.subplots(figsize=((11 if labels == "name" else 9), 12), dpi=180)
    for feature in features:
        selected = feature["answer"] == target
        fill = "#e98255" if selected else (colors[feature["answer"]] if target is None else "#dce1df")
        for ring in rings(feature["geometry"]):
            ax.add_patch(Polygon(ring, closed=True, facecolor=fill, edgecolor="#304247", linewidth=.8))

    if labels is not None:
        for index, feature in enumerate(features, 1):
            x, y = feature["center"]
            if feature["answer"] in callouts:
                tx, ty = callouts[feature["answer"]]
                ax.annotate(str(index), xy=(x, y), xytext=(tx, ty), ha="center", va="center",
                            fontsize=14, fontweight="bold", color="#142429",
                            bbox=dict(boxstyle="round,pad=.18", facecolor="#fffdf4", alpha=.92, linewidth=0),
                            arrowprops=dict(arrowstyle="-", color="#142429", linewidth=1.15, shrinkA=4, shrinkB=2),
                            zorder=20)
            else:
                ax.text(x, y, str(index), ha="center", va="center", fontsize=14, fontweight="bold",
                        color="#142429", bbox=dict(boxstyle="round,pad=.18", facecolor="#fffdf4", alpha=.84, linewidth=0),
                        zorder=20)
    if labels == "name":
        # Use the full upper artwork area for Germany.  The sixteen-entry key
        # sits below it in two vertical columns of eight, so the map no longer
        # has to shrink to make room for a tall right-hand legend.
        ax.set_position([.075, .285, .85, .655])
        per_column = 8
        for index, feature in enumerate(features, 1):
            column = (index - 1) // per_column
            row = (index - 1) % per_column
            fig.text(.08 + column * .49, .245 - row * .027,
                     f"{index}. {feature['answer']}", ha="left", va="center",
                     fontsize=11.5, fontweight="bold", color="#142429")

    ax.set_xlim(min_lon - .8, max_lon + .8)
    ax.set_ylim(min_lat - .35, max_lat + .35)
    ax.set_aspect("equal")
    ax.axis("off")
    ax.set_title(title, fontsize=17, pad=12, fontweight="bold")
    fig.text(.5, .018, "Sixteen states • north is up", ha="center", fontsize=7, color="#46585d")
    if labels != "name":
        fig.tight_layout(rect=(0, .035, 1, .97))
    path.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(path, bbox_inches="tight", facecolor="#f5f1e8")
    plt.close(fig)


SPLIT.mkdir(parents=True, exist_ok=True)
draw_map(SPLIT / "reference.png")
draw_map(DATA / "germany-states-numbered.png", labels="number")
draw_map(DATA / "germany-states-named.png", labels="name")
metadata = []
for feature in features:
    stem = slug(feature["answer"])
    metadata.append({"id": f"{stem}-highlight", "answer": feature["answer"], "kind": "Land",
                     "sourceCode": feature["properties"].get("shapeISO", "")})
    draw_map(SPLIT / f"{stem}-question.png", target=feature["answer"], title="Which state is highlighted?")
    draw_map(SPLIT / f"{stem}-answer.png", target=feature["answer"], title=feature["answer"])
(DATA / "states.json").write_text(json.dumps(metadata, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
