#!/usr/bin/env python3
"""Generate combined-Korea province-capital maps from ADM1 and ADM2 GeoJSON."""
from __future__ import annotations

import json
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.path import Path as MatplotlibPath
from matplotlib.patches import PathPatch
from matplotlib.patches import Polygon as PatchPolygon

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "packages/geography/data/korea-province-capitals"
PROVINCES = ROOT / "packages/geography/data/korea-provinces"
OUT = DATA / "maps"
CAPITALS = DATA / "capitals.json"

PROVINCE_FILL = "#82a8df"
CAPITAL_FILL = "#ee8c72"
BORDER = "#243a45"
SEA = "#f6f2e8"


def outer_rings(feature):
    geometry = feature["geometry"]
    coordinates = geometry["coordinates"]
    if geometry["type"] == "Polygon":
        return [coordinates[0]]
    if geometry["type"] == "MultiPolygon":
        return [polygon[0] for polygon in coordinates]
    raise ValueError(geometry["type"])


def ring_area(ring):
    return abs(sum(
        ring[index][0] * ring[(index + 1) % len(ring)][1]
        - ring[(index + 1) % len(ring)][0] * ring[index][1]
        for index in range(len(ring))
    ) / 2)


def ring_centroid(ring):
    twice_area = 0.0
    x_total = 0.0
    y_total = 0.0
    for index in range(len(ring)):
        x1, y1 = ring[index]
        x2, y2 = ring[(index + 1) % len(ring)]
        cross = x1 * y2 - x2 * y1
        twice_area += cross
        x_total += (x1 + x2) * cross
        y_total += (y1 + y2) * cross
    if abs(twice_area) < 1e-12:
        return ring[0]
    return x_total / (3 * twice_area), y_total / (3 * twice_area)


def point_in_ring(point, ring):
    x, y = point
    inside = False
    for index in range(len(ring)):
        x1, y1 = ring[index]
        x2, y2 = ring[(index + 1) % len(ring)]
        if (y1 > y) != (y2 > y) and x < (x2 - x1) * (y - y1) / (y2 - y1) + x1:
            inside = not inside
    return inside


def feature_area(feature):
    return sum(ring_area(ring) for ring in outer_rings(feature))


def representative_point(feature):
    return ring_centroid(max(outer_rings(feature), key=ring_area))


def within(point, feature):
    return any(point_in_ring(point, ring) for ring in outer_rings(feature))


def bounds(feature):
    points = [point for ring in outer_rings(feature) for point in ring]
    return (
        min(point[0] for point in points),
        min(point[1] for point in points),
        max(point[0] for point in points),
        max(point[1] for point in points),
    )


def province_clip_path(axis, feature):
    paths = []
    for ring in outer_rings(feature):
        vertices = list(ring)
        if vertices[0] != vertices[-1]:
            vertices.append(vertices[0])
        codes = [MatplotlibPath.MOVETO] + [MatplotlibPath.LINETO] * (len(vertices) - 2) + [MatplotlibPath.CLOSEPOLY]
        paths.append(MatplotlibPath(vertices, codes))
    path = paths[0] if len(paths) == 1 else MatplotlibPath.make_compound_path(*paths)
    patch = PathPatch(path, transform=axis.transData, facecolor="none", edgecolor="none")
    axis.add_patch(patch)
    return patch


def draw_geometry(ax, feature, fill, linewidth=0.8, zorder=2, clip_path=None):
    for ring in outer_rings(feature):
        patch = PatchPolygon(
            ring,
            closed=True,
            facecolor=fill,
            edgecolor=BORDER,
            linewidth=linewidth,
            zorder=zorder,
        )
        if clip_path is not None:
            patch.set_clip_path(clip_path)
        ax.add_patch(patch)


def assigned_adm2(adm1_features, adm2_features):
    result = {feature["properties"]["shapeISO"]: [] for feature in adm1_features}
    for feature in adm2_features:
        point = representative_point(feature)
        candidates = [province for province in adm1_features if within(point, province)]
        if candidates:
            province = min(candidates, key=feature_area)
            result[province["properties"]["shapeISO"]].append(feature)
    return result


def render(row, province, subdivisions):
    separate_capital = row["capitalFeature"] is not None
    # Boundary releases can differ slightly at the coast or around enclaves.
    # Always include the explicitly named capital even when its representative
    # point falls just outside the older ADM1 outline.
    if separate_capital:
        source = ADM2[row["sourceGroup"]]
        explicit = [feature for feature in source if feature["properties"]["shapeName"] == row["capitalFeature"]]
        capital_matches = explicit
        if not capital_matches:
            raise RuntimeError(f'No ADM2 capital match for {row["id"]}: {row["capitalFeature"]}')
    else:
        capital_matches = []

    for answer in (False, True):
        figure = plt.figure(figsize=(16, 10), dpi=100, facecolor=SEA)
        axis = figure.add_axes([0.035, 0.10, 0.93, 0.82], facecolor=SEA)
        draw_geometry(axis, province, PROVINCE_FILL if separate_capital else CAPITAL_FILL, 1.05, 1)
        clip_path = province_clip_path(axis, province)

        # Internal boundaries remain visible, while the capital municipality is
        # laid over the province in the same coral used by the Japanese maps.
        for feature in subdivisions:
            for ring in outer_rings(feature):
                boundary = PatchPolygon(
                    ring,
                    closed=True,
                    facecolor="none",
                    edgecolor=BORDER,
                    linewidth=0.38,
                    zorder=2,
                )
                boundary.set_clip_path(clip_path)
                axis.add_patch(boundary)
        for feature in capital_matches:
            draw_geometry(axis, feature, CAPITAL_FILL, 0.8, 3, clip_path)

        x0, y0, x1, y1 = bounds(province)
        dx = max(x1 - x0, 0.02)
        dy = max(y1 - y0, 0.02)
        axis.set_xlim(x0 - dx * 0.045, x1 + dx * 0.045)
        axis.set_ylim(y0 - dy * 0.045, y1 + dy * 0.045)
        axis.set_aspect("equal")
        axis.axis("off")

        title = (
            f'{row["provinceEnglish"]} — {row["capitalEnglish"]}'
            if answer
            else f'{row["provinceEnglish"]} — Province Capital Area'
        )
        figure.text(0.5, 0.955, title, ha="center", va="top", fontsize=26, fontweight="bold", color=BORDER)
        figure.text(0.5, 0.052, "capital city / administrative seat", ha="center", fontsize=16, color=CAPITAL_FILL, fontweight="bold")
        figure.text(0.5, 0.022, "ADM1 and ADM2 boundaries: geoBoundaries", ha="center", fontsize=9, color="#64737a")
        destination = OUT / f'{row["id"]}-{"answer" if answer else "question"}.png'
        figure.savefig(destination, facecolor=SEA)
        plt.close(figure)


rows = json.loads(CAPITALS.read_text())
ADM1 = {
    "KOR": json.loads((PROVINCES / "source-kor-adm1.geojson").read_text())["features"],
    "PRK": json.loads((PROVINCES / "source-prk-adm1.geojson").read_text())["features"],
}
ADM2 = {
    "KOR": json.loads((DATA / "source-kor-adm2.geojson").read_text())["features"],
    "PRK": json.loads((DATA / "source-prk-adm2.geojson").read_text())["features"],
}
ASSIGNED = {group: assigned_adm2(ADM1[group], ADM2[group]) for group in ADM1}


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for row in rows:
        provinces = [feature for feature in ADM1[row["sourceGroup"]] if feature["properties"]["shapeISO"] == row["sourceCode"]]
        if len(provinces) != 1:
            raise RuntimeError(f'Expected one ADM1 feature for {row["id"]}: {row["sourceCode"]}')
        subdivisions = list(ASSIGNED[row["sourceGroup"]][row["sourceCode"]])
        render(row, provinces[0], subdivisions)
    print(f"Generated {len(rows) * 2} Korea province-capital map images in {OUT}")


if __name__ == "__main__":
    main()
