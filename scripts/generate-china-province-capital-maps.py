#!/usr/bin/env python3
"""Generate clipped province-capital maps for China and China (Taiwan)."""
from __future__ import annotations

import json
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.path import Path as MatplotlibPath
from matplotlib.patches import PathPatch, Polygon as PatchPolygon

ROOT = Path(__file__).resolve().parents[1]
GEOGRAPHY = ROOT / "packages/geography/data"
PROVINCE_FILL = "#82a8df"
CAPITAL_FILL = "#ee8c72"
BORDER = "#243a45"
SEA = "#f6f2e8"

CONFIGS = [{
    "label": "China",
    "data": GEOGRAPHY / "china-province-capitals",
    "division_data": GEOGRAPHY / "china-divisions",
    "adm1": GEOGRAPHY / "china-divisions/source-CHN-adm1.geojson",
    "adm2": GEOGRAPHY / "china-province-capitals/source-chn-adm2.geojson",
    "province_lookup": "name",
}, {
    "label": "China (Taiwan)",
    "data": GEOGRAPHY / "china-taiwan-province-capitals",
    "division_data": GEOGRAPHY / "china-roc-divisions",
    "adm1": GEOGRAPHY / "china-roc-divisions/source-TWN-adm1.geojson",
    "adm2": GEOGRAPHY / "china-taiwan-province-capitals/source-twn-adm2.geojson",
    "province_lookup": "code",
}]


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
    twice_area = x_total = y_total = 0.0
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
    return min(p[0] for p in points), min(p[1] for p in points), max(p[0] for p in points), max(p[1] for p in points)


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


def draw_geometry(axis, feature, fill, linewidth=0.8, zorder=2, clip_path=None):
    for ring in outer_rings(feature):
        patch = PatchPolygon(ring, closed=True, facecolor=fill, edgecolor=BORDER, linewidth=linewidth, zorder=zorder)
        if clip_path is not None:
            patch.set_clip_path(clip_path)
        axis.add_patch(patch)


def assign_adm2(adm1_features, adm2_features):
    result = {id(feature): [] for feature in adm1_features}
    for subdivision in adm2_features:
        point = representative_point(subdivision)
        candidates = [province for province in adm1_features if within(point, province)]
        if candidates:
            result[id(min(candidates, key=feature_area))].append(subdivision)
    return result


def choose_capital(row, subdivisions, all_adm2):
    feature_name = row.get("capitalFeature")
    if feature_name:
        matches = [feature for feature in all_adm2 if feature["properties"].get("shapeName") == feature_name]
        if len(matches) == 1:
            return matches
    point = row["capitalLon"], row["capitalLat"]
    candidates = [feature for feature in subdivisions if within(point, feature)]
    if not candidates:
        candidates = [feature for feature in all_adm2 if within(point, feature)]
    if not candidates:
        raise RuntimeError(f'No capital boundary contains {row["capitalEnglish"]} at {point}')
    # Taiwan uses non-overlapping townships; mainland source geometry can include
    # overlapping administrative levels, where the broader capital-city polygon
    # is the desired teaching area.
    return [max(candidates, key=feature_area) if row.get("sourceGroup") == "CHN" else min(candidates, key=feature_area)]


def render(config, row, province, subdivisions, all_adm2):
    whole_province = bool(row.get("wholeProvince"))
    capitals = [] if whole_province else choose_capital(row, subdivisions, all_adm2)
    destination_root = config["data"] / "maps"
    destination_root.mkdir(parents=True, exist_ok=True)
    for answer in (False, True):
        figure = plt.figure(figsize=(16, 10), dpi=100, facecolor=SEA)
        axis = figure.add_axes([0.035, 0.10, 0.93, 0.82], facecolor=SEA)
        draw_geometry(axis, province, CAPITAL_FILL if whole_province else PROVINCE_FILL, 1.05, 1)
        clip_path = province_clip_path(axis, province)
        for subdivision in subdivisions:
            for ring in outer_rings(subdivision):
                boundary = PatchPolygon(ring, closed=True, facecolor="none", edgecolor=BORDER, linewidth=0.34, zorder=2)
                boundary.set_clip_path(clip_path)
                axis.add_patch(boundary)
        for capital in capitals:
            draw_geometry(axis, capital, CAPITAL_FILL, 0.8, 3, clip_path)

        x0, y0, x1, y1 = bounds(province)
        dx, dy = max(x1 - x0, 0.02), max(y1 - y0, 0.02)
        axis.set_xlim(x0 - dx * 0.045, x1 + dx * 0.045)
        axis.set_ylim(y0 - dy * 0.045, y1 + dy * 0.045)
        axis.set_aspect("equal")
        axis.axis("off")
        title = f'{row["provinceEnglish"]} — {row["capitalEnglish"]}' if answer else f'{row["provinceEnglish"]} — Province Capital Area'
        figure.text(0.5, 0.955, title, ha="center", va="top", fontsize=26, fontweight="bold", color=BORDER)
        figure.text(0.5, 0.052, "capital city / administrative seat", ha="center", fontsize=16, color=CAPITAL_FILL, fontweight="bold")
        figure.text(0.5, 0.022, "ADM1 and ADM2 boundaries: geoBoundaries", ha="center", fontsize=9, color="#64737a")
        destination = destination_root / f'{row["id"]}-{"answer" if answer else "question"}.png'
        figure.savefig(destination, facecolor=SEA)
        plt.close(figure)


def generate(config):
    rows = json.loads((config["data"] / "capitals.json").read_text())
    divisions = json.loads((config["division_data"] / "divisions.json").read_text())
    division_codes = {item["id"].removesuffix("-highlight"): item["sourceCode"] for item in divisions}
    adm1 = json.loads(config["adm1"].read_text())["features"]
    adm2 = json.loads(config["adm2"].read_text())["features"]
    assigned = assign_adm2(adm1, adm2)
    for row in rows:
        row["sourceGroup"] = "CHN" if config["label"] == "China" else "TWN"
        if config["province_lookup"] == "name":
            source_name = {
                "Ningxia Hui Autonomous Region": "Ningxia Ningxia Hui Autonomous Region",
                "Guangdong Province": "Guangzhou Province",
            }.get(row["provinceEnglish"], row["provinceEnglish"])
            matches = [feature for feature in adm1 if feature["properties"].get("shapeName") == source_name]
        else:
            source_code = division_codes[row["id"]]
            matches = [feature for feature in adm1 if feature["properties"].get("shapeISO") == source_code]
        if len(matches) != 1:
            raise RuntimeError(f'Expected one ADM1 match for {config["label"]} / {row["id"]}, found {len(matches)}')
        province = matches[0]
        render(config, row, province, assigned[id(province)], adm2)
    print(f'Generated {len(rows) * 2} {config["label"]} province-capital images')


def main():
    for config in CONFIGS:
        generate(config)


if __name__ == "__main__":
    main()
