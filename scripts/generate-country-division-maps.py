#!/usr/bin/env python3
"""Generate consistent country first-level administrative geography artwork."""

from __future__ import annotations

import colorsys
import json
import math
import os
import re
import sys
from pathlib import Path

os.environ.setdefault("MPLCONFIGDIR", "/tmp/whacksmacker-country-maps-mpl")
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.patheffects as path_effects
from matplotlib.patches import Polygon

ROOT = Path(__file__).resolve().parents[1]
CONFIGS = {
    "united-kingdom": {"source": "source-GBR-adm1.geojson", "title": "United Kingdom — Constituent Countries", "unit": "constituent country"},
    "belgium": {
        "directory": "belgium-provinces",
        "source": "source-BEL-nuts2-2024.geojson",
        "title": "Belgium — Provinces and Brussels",
        "unit": "province or region",
        "count_label": "10 provinces + Brussels",
        "inline_names": True,
        "inline_name_labels": {
            "West Flanders": "West\nFlanders", "East Flanders": "East\nFlanders",
            "Flemish Brabant": "Flemish\nBrabant", "Walloon Brabant": "Walloon\nBrabant",
        },
        "inline_name_font_sizes": {
            "Antwerp": 25, "West Flanders": 22, "East Flanders": 21,
            "Limburg": 23, "Flemish Brabant": 17, "Walloon Brabant": 15,
            "Liège": 25, "Hainaut": 28, "Namur": 24, "Luxembourg": 23,
        },
        "wide": True,
    },
    "france": {"source": "source-FRA-adm1.geojson", "title": "France — Metropolitan Regions", "unit": "region"},
    "spain": {
        "source": "source-ESP-adm1.geojson",
        "title": "Spain — Autonomous-level Divisions",
        "unit": "autonomous-level division",
        "figure_inset": "Canarias",
        # Keep the island shapes in the neutral reference, but omit the inset
        # caption there: spelling out "Canary Islands" beside the active
        # question gives away that answer in easy mode.
        "hide_figure_inset_caption_on_reference": True,
        # Ceuta and Melilla are correct at their real positions on the North
        # African coast, but are too small for a visible selected-state fill.
        # Repeat their true outlines at a readable scale in anonymous detail
        # panels; the answer remains undisclosed on question artwork.
        "detail_insets": [
            {"feature": "Ciudad Autónoma de Ceuta"},
            {"feature": "Ciudad Autónoma de Melilla"},
        ],
        "context_sources": [
            {"source": "context/source-MAR-adm0.geojson", "fill": "#d8dedc", "linewidth": .75},
            {"source": "context/source-GIB-adm0.geojson", "fill": "#f5f1e8", "linewidth": 1.25},
        ],
        "fixed_callouts": {
            "Ciudad Autónoma de Ceuta": (-5.85, 35.43),
            "Ciudad Autónoma de Melilla": (-2.35, 34.90),
        },
    },
    "italy": {
        "directory": "italy-regions",
        "source": "source-ITA-regions.geojson",
        "title": "Italy — Regions",
        "unit": "region",
        # Lampedusa and Linosa are the two tiny southernmost source components.
        # Omitting them from this regional study map recovers enough vertical
        # extent to make mainland Italy, Sicily and Sardinia substantially
        # larger without changing their geographic aspect ratio.
        "drop_components_below": {"Sicilia": 36.0},
        "margin_x": .035,
        "margin_y": .035,
    },
    "china": {"source": "source-CHN-adm1.geojson", "title": "China — Provincial-level Divisions", "unit": "provincial-level division", "exclude": ["Taiwan Province"], "rename": {"Guangzhou Province": "Guangdong Province", "Ningxia Ningxia Hui Autonomous Region": "Ningxia Hui Autonomous Region"}, "wide": True, "named_layout": "below", "legend_columns": 3},
    "china-taiwan": {
        "directory": "china-roc-divisions",
        "source": "source-TWN-adm1.geojson",
        "title": "China (Taiwan) — First-level Divisions",
        "unit": "first-level division",
        "rename": {
            "Matsu Islands": "Lienchiang County",
            "Kinmen": "Kinmen County",
            "Penghu": "Penghu County",
            "Keelung": "Keelung City",
            "Taipei": "Taipei City",
            "New Taipei": "New Taipei City",
            "Taoyuan": "Taoyuan City",
            "Hsinchu": "Hsinchu City",
            "Taichung": "Taichung City",
            "Chiayi": "Chiayi City",
            "Tainan": "Tainan City",
            "Kaohsiung": "Kaohsiung City",
        },
        # Keep the established IDs and asset stems so this naming correction
        # does not reset learner progress.
        "id_stems": {
            "Matsu Islands": "matsu-islands", "Kinmen": "kinmen", "Penghu": "penghu",
            "Keelung": "keelung", "Taipei": "taipei", "New Taipei": "new-taipei",
            "Taoyuan": "taoyuan", "Hsinchu": "hsinchu", "Taichung": "taichung",
            "Chiayi": "chiayi", "Tainan": "tainan", "Kaohsiung": "kaohsiung",
        },
        # Remote jurisdictions and Dongsha are displayed in stable figure-level
        # insets. The principal island can therefore fill the study canvas.
        "component_insets": [
            {"feature": "Lienchiang County", "label": "Lienchiang County"},
            {"feature": "Kinmen County", "label": "Kinmen County"},
            {"feature": "Penghu County", "label": "Penghu County"},
            {"feature": "Kaohsiung City", "label": "Dongsha Islands", "max_x_below": 119.0},
        ],
        "margin_x": .035,
        "margin_y": .025,
        "callout_offset": .025,
        # Keep the four remote-island insets visual and numbered only. Their
        # names remain available through the deck answer/legend instead of
        # being printed beneath the island artwork.
        "hide_component_inset_names": True,
        "fixed_callouts": {"Taipei City": (121.30, 25.25)},
        "label_positions": {"New Taipei City": (121.72, 24.92)},
    },
    "india": {"source": "source-IND-adm1.geojson", "title": "India — States and Union Territories", "unit": "state or union territory"},
    "australia": {"source": "source-AUS-adm1.geojson", "title": "Australia — States and Territories", "unit": "state or territory", "exclude": ["Other Territories"], "wide": True},
    "canada": {
        "source": "source-CAN-adm1.geojson",
        "title": "Canada — Provinces and Territories",
        "unit": "province or territory",
        "count_label": "10 provinces + 3 territories",
        "wide": True,
        "compact_wide": True,
        "legend_columns": 1,
        "margin_x": .035,
        "margin_y": .035,
        "projection": "canada-lambert",
        "number_font_size": 22,
        "callout_font_size": 22,
        "callout_box_pad": .22,
        "legend_font_size": 18,
        "label_positions_lonlat": {
            "Yukon": (-135.5, 64.4),
            "Northwest Territories": (-120.0, 65.1),
            "Nunavut": (-96.0, 67.4),
            "British Columbia": (-124.2, 54.8),
            "Alberta": (-114.4, 54.7),
            "Saskatchewan": (-106.0, 54.8),
            "Manitoba": (-97.0, 54.7),
            "Ontario": (-85.2, 50.5),
            "Quebec": (-71.8, 52.2),
            "Newfoundland and Labrador": (-61.8, 53.2),
            "New Brunswick": (-66.6, 46.5),
            "Nova Scotia": (-63.6, 44.7),
        },
        "fixed_callouts_lonlat": {
            "Prince Edward Island": (-59.9, 47.2),
        },
    },
    "ussr-former": {
        "source": "source-former-ussr-republics.geojson",
        "title": "USSR (Former) — Union Republics",
        "unit": "union republic",
        "count_label": "15 union republics",
        "wide": True,
        "compact_wide": True,
        "projection": "ussr-lambert",
        "number_font_size": 20,
        "callout_font_size": 20,
        "callout_box_pad": .20,
        "legend_font_size": 17,
        "right_legend_columns": 2,
        "right_legend_width": 14,
        "named_map_right": .42,
        "right_legend_start": .45,
        "margin_x": .045,
        "margin_y": .045,
        "label_positions_lonlat": {
            "Russian Soviet Federative Socialist Republic": (82.0, 61.0),
            "Ukrainian Soviet Socialist Republic": (31.0, 49.0),
            "Byelorussian Soviet Socialist Republic": (28.0, 53.7),
            "Estonian Soviet Socialist Republic": (25.5, 58.6),
            "Latvian Soviet Socialist Republic": (24.6, 57.0),
            "Lithuanian Soviet Socialist Republic": (23.8, 55.2),
            "Moldavian Soviet Socialist Republic": (28.5, 47.1),
            "Georgian Soviet Socialist Republic": (43.5, 42.1),
            "Armenian Soviet Socialist Republic": (44.8, 40.2),
            "Azerbaijan Soviet Socialist Republic": (47.7, 40.5),
            "Kazakh Soviet Socialist Republic": (68.0, 48.0),
            "Uzbek Soviet Socialist Republic": (64.0, 41.1),
            "Turkmen Soviet Socialist Republic": (59.0, 39.1),
            "Kirghiz Soviet Socialist Republic": (74.5, 41.5),
            "Tajik Soviet Socialist Republic": (71.0, 38.6),
        },
        "fixed_callouts_lonlat": {
            "Estonian Soviet Socialist Republic": (19.0, 59.7),
            "Latvian Soviet Socialist Republic": (19.0, 57.8),
            "Lithuanian Soviet Socialist Republic": (19.0, 55.9),
            "Moldavian Soviet Socialist Republic": (21.5, 47.3),
            "Armenian Soviet Socialist Republic": (39.5, 38.7),
        },
    },
    "united-states": {
        "source": "source-USA-adm1.geojson",
        "title": "United States — States",
        "unit": "state",
        "count_label": "50 states",
        "wide": True,
        "compact_wide": True,
        "projection": "usa-albers",
        "number_font_size": 18,
        "callout_font_size": 18,
        "callout_box_pad": .18,
        "legend_font_size": 18,
        "right_legend_columns": 2,
        "right_legend_width": 5,
        "named_map_right": .57,
        "named_map_bottom": .205,
        "named_map_top": .94,
        "right_legend_start": .59,
        "right_legend_column_step": .15,
        "right_legend_top": .84,
        "right_legend_bottom": .18,
        "right_legend_side_groups": [
            list(range(10, 27)),
            list(range(30, 47)),
        ],
        "right_legend_bottom_groups": [
            [1, 2, 3],
            [4, 5, 6],
            [7, 8, 9],
            [27, 28, 29],
            [47, 48, 49, 50],
        ],
        "right_legend_bottom_start": .045,
        "right_legend_bottom_column_step": .19,
        "right_legend_bottom_positions": [.045, .235, .425, .59, .74],
        "right_legend_bottom_top": .145,
        "right_legend_bottom_row_step": .043,
        "margin_x": .035,
        "margin_y": .035,
        "label_positions_lonlat": {
            "Montana": (-109.6, 47.0),
        },
        "fixed_callouts": {
            "Vermont": (0.28737280018338546, 0.49),
            "New Hampshire": (0.3033392865697186, 0.46),
        },
        "fixed_callouts_lonlat": {
            "Massachusetts": (-65.0, 42.8),
            "Rhode Island": (-65.0, 41.8),
            "Connecticut": (-66.0, 40.8),
            "New Jersey": (-68.0, 39.8),
            "Delaware": (-69.0, 38.8),
            "Maryland": (-69.0, 37.8),
            "Hawaii": (-105.0, 24.7),
        },
        "order": [
            "Kentucky", "North Carolina", "Arizona",
            "Arkansas", "Oklahoma", "South Carolina",
            "New Mexico", "Georgia", "Mississippi",
            "Washington", "North Dakota", "Maine", "Oregon", "Montana", "Minnesota", "Idaho",
            "Vermont", "New Hampshire", "Michigan", "Wisconsin", "New York", "Massachusetts",
            "Rhode Island", "Wyoming", "South Dakota", "Connecticut",
            "Tennessee", "Alabama", "Louisiana", "Texas",
            "Pennsylvania", "New Jersey", "Iowa", "Nebraska", "Delaware", "Utah", "Ohio",
            "Maryland", "West Virginia", "Illinois", "Colorado", "Nevada", "California", "Indiana",
            "Virginia", "Kansas", "Missouri", "Florida", "Alaska", "Hawaii",
        ],
    },
    "russian-federal-districts": {
        "directory": "russian-federal-districts",
        "source": "source-RUS-federal-districts.geojson",
        "title": "Russian Federation",
        "unit": "federal district",
        "count_label": "8 federal districts",
        "wide": True,
        "compact_wide": True,
        "projection": "russia-equirect",
        "order": [
            "Central", "Northwestern", "Southern", "North Caucasian",
            "Volga", "Ural", "Siberian", "Far Eastern",
        ],
        "inline_names": True,
        "inline_name_boxes": True,
        "feature_colors": {
            "Central": "#e78b79", "Northwestern": "#83b9dc",
            "Southern": "#e3bd74", "North Caucasian": "#c386d9",
            "Volga": "#89c978", "Ural": "#db83ae",
            "Siberian": "#8b9ed7", "Far Eastern": "#79c9be",
        },
        "inline_name_font_sizes": {
            "Central": 11, "Northwestern": 12, "Southern": 11,
            "North Caucasian": 8, "Volga": 12, "Ural": 16,
            "Siberian": 17, "Far Eastern": 17,
        },
        "label_positions_lonlat": {
            "Central": (38.2, 54.6), "Northwestern": (43.0, 64.0),
            "Southern": (39.0, 47.0), "North Caucasian": (45.0, 43.8),
            "Volga": (53.0, 55.2), "Ural": (70.0, 61.2),
            "Siberian": (96.0, 59.0), "Far Eastern": (137.0, 61.0),
        },
        "number_font_size": 18,
        "disable_callouts": True,
        "margin_x": .025,
        "margin_y": .08,
        "hide_footer": True,
    },
    "russian-federation": {
        "directory": "russian-federation-divisions",
        "source": "source-RUS-claimed-ADM1.geojson",
        "title": "Russian Federation",
        "unit": "federal subject",
        "count_label": "89 federal subjects",
        "wide": True,
        "compact_wide": True,
        "projection": "russia-equirect",
        "number_font_size": 14,
        "callout_font_size": 14,
        "callout_box_pad": .14,
        "margin_x": .025,
        "margin_y": .035,
        "hide_footer": True,
        "overview_only": True,
    },
    "yugoslavia-former": {"source": "source-former-yugoslavia-republics.geojson", "title": "Yugoslavia (Former) — Constituent Republics", "unit": "constituent republic"},
}


def rings(geometry: dict) -> list[list[list[float]]]:
    coordinates = geometry["coordinates"]
    if geometry["type"] == "Polygon": return [coordinates[0]]
    if geometry["type"] == "MultiPolygon": return [polygon[0] for polygon in coordinates]
    raise ValueError(f"Unsupported geometry: {geometry['type']}")


def display_ring(ring: list[list[float]]) -> list[list[float]]:
    """Bound render cost while retaining small administrative units."""
    if len(ring) <= 500: return ring
    step = math.ceil(len(ring) / 500)
    reduced = ring[::step]
    if reduced[-1] != ring[-1]: reduced.append(ring[-1])
    return reduced


def polygon_area(ring: list[list[float]]) -> float:
    return abs(sum(ring[i][0] * ring[(i + 1) % len(ring)][1] - ring[(i + 1) % len(ring)][0] * ring[i][1]
                   for i in range(len(ring)))) / 2


def feature_area(feature: dict) -> float:
    return sum(polygon_area(ring) for ring in rings(feature["geometry"]))


def label_point(feature: dict) -> tuple[float, float]:
    ring = max(rings(feature["geometry"]), key=polygon_area)
    return (sum(p[0] for p in ring) / len(ring), sum(p[1] for p in ring) / len(ring))


def slug(value: str) -> str:
    value = value.lower().translate(str.maketrans({"ä":"ae","ö":"oe","ü":"ue","ß":"ss","đ":"d"}))
    return re.sub(r"[^a-z0-9]+", "-", value).strip("-")


def project_point(point: tuple[float, float] | list[float], projection: str | None) -> tuple[float, float]:
    """Project lon/lat coordinates while preserving the country's real aspect."""
    lon, lat = point[:2]
    if projection == "russia-equirect":
        return (lon + 360 if lon < 0 else lon), lat
    if projection not in {"canada-lambert", "ussr-lambert", "usa-albers"}: return lon, lat
    # Canada uses Statistics Canada's Canada Atlas parameters. The former
    # USSR uses an equivalent Eurasia-centred conic view so its extreme
    # east-west extent remains readable without changing geographic shapes.
    phi = math.radians(lat); lam = math.radians(lon)
    if projection == "canada-lambert":
        phi1, phi2 = math.radians(49), math.radians(77)
        phi0, lam0 = math.radians(49), math.radians(-95)
    elif projection == "ussr-lambert":
        phi1, phi2 = math.radians(45), math.radians(65)
        phi0, lam0 = math.radians(55), math.radians(80)
    else:
        phi1, phi2 = math.radians(29.5), math.radians(45.5)
        phi0, lam0 = math.radians(23), math.radians(-96)
    n = math.log(math.cos(phi1) / math.cos(phi2)) / math.log(
        math.tan(math.pi / 4 + phi2 / 2) / math.tan(math.pi / 4 + phi1 / 2)
    )
    f = math.cos(phi1) * math.tan(math.pi / 4 + phi1 / 2) ** n / n
    rho = f / math.tan(math.pi / 4 + phi / 2) ** n
    rho0 = f / math.tan(math.pi / 4 + phi0 / 2) ** n
    delta = (lam - lam0 + math.pi) % (2 * math.pi) - math.pi
    return rho * math.sin(n * delta), rho0 - rho * math.cos(n * delta)


def transform_geometry(feature: dict, key: str, config: dict) -> None:
    """Place geographically detached units in conventional readable insets."""
    name = feature["answer"]
    def transform(point: list[float]) -> list[float]:
        x, y = point[:2]
        if key == "spain" and name == "Canarias":
            x = -9.08 + (x + 18.16) * .70
            y = 33.62 + (y - 27.64) * .70
        elif key == "united-states" and name == "Alaska":
            if x > 0: x -= 360
            x = -126.5 + (x + 170) * .28
            y = 22.0 + (y - 50) * .25
        elif key == "united-states" and name == "Hawaii":
            x = -111.0 + (x + 160) * .60
            y = 23.0 + (y - 18) * .60
        x, y = project_point((x, y), config.get("projection"))
        point[0], point[1] = x, y
        return point
    geometry = feature["geometry"]
    if geometry["type"] == "Polygon":
        geometry["coordinates"] = [[transform(point) for point in ring] for ring in geometry["coordinates"]]
    elif geometry["type"] == "MultiPolygon":
        geometry["coordinates"] = [[[transform(point) for point in ring] for ring in polygon] for polygon in geometry["coordinates"]]


def filter_geometry_components(feature: dict, config: dict) -> None:
    """Remove explicitly excluded remote components without reshaping retained land."""
    cutoff = config.get("drop_components_below", {}).get(feature["answer"])
    geometry = feature["geometry"]
    if cutoff is None or geometry["type"] != "MultiPolygon":
        return
    geometry["coordinates"] = [
        polygon for polygon in geometry["coordinates"]
        if max(point[1] for ring in polygon for point in ring) >= cutoff
    ]


def spread(values: list[tuple[float, dict]], minimum: float, maximum: float, gap: float) -> dict[str, float]:
    if not values: return {}
    ordered = sorted(values, key=lambda item: item[0])
    ys = [max(minimum, min(maximum, value)) for value, _ in ordered]
    for i in range(1, len(ys)): ys[i] = max(ys[i], ys[i - 1] + gap)
    overflow = ys[-1] - maximum
    if overflow > 0: ys = [y - overflow for y in ys]
    for i in range(len(ys) - 2, -1, -1): ys[i] = min(ys[i], ys[i + 1] - gap)
    return {feature["answer"]: y for y, (_, feature) in zip(ys, ordered)}


def generate(key: str) -> None:
    config = CONFIGS[key]
    directory = config.get("directory", f"{key}-divisions")
    data = ROOT / "packages/geography/data" / directory
    split = data / "split"
    source = json.loads((data / config["source"]).read_text(encoding="utf-8"))
    context_features = []
    for context in config.get("context_sources", []):
        context_source = json.loads((data / context["source"]).read_text(encoding="utf-8"))
        context_features.extend((feature, context) for feature in context_source["features"])
    excluded = set(config.get("exclude", [])); rename = config.get("rename", {})
    features = []
    for feature in source["features"]:
        original = feature["properties"]["shapeName"]
        if original in excluded: continue
        feature["answer"] = rename.get(original, original)
        feature["idStem"] = config.get("id_stems", {}).get(original, slug(feature["answer"]))
        transform_geometry(feature, key, config)
        filter_geometry_components(feature, config)
        feature["center"] = label_point(feature)
        features.append(feature)
    features.sort(key=lambda item: (-item["center"][1], item["center"][0], item["answer"]))
    if "order" in config:
        by_answer = {feature["answer"]: feature for feature in features}
        features = [by_answer[answer] for answer in config["order"]]
    component_insets = config.get("component_insets", [])
    detail_insets = config.get("detail_insets", [])
    full_inset_answers = {spec["feature"] for spec in component_insets if "max_x_below" not in spec}

    def ring_in_component_inset(feature: dict, ring: list[list[float]]) -> bool:
        for spec in component_insets:
            if spec["feature"] != feature["answer"] or "max_x_below" not in spec:
                continue
            if max(point[0] for point in ring) < spec["max_x_below"]:
                return True
        return False

    def primary_rings(feature: dict) -> list[list[list[float]]]:
        if feature["answer"] in full_inset_answers:
            return []
        return [ring for ring in rings(feature["geometry"]) if not ring_in_component_inset(feature, ring)]

    inset_name = config.get("figure_inset")
    inset_feature = next((feature for feature in features if feature["answer"] == inset_name), None)
    extent_features = [feature for feature in features if feature is not inset_feature]
    all_points = [p for feature in extent_features for ring in primary_rings(feature) for p in ring]
    min_x,max_x=min(p[0] for p in all_points),max(p[0] for p in all_points)
    min_y,max_y=min(p[1] for p in all_points),max(p[1] for p in all_points)
    width,height=max_x-min_x,max_y-min_y
    colors={f["answer"]:colorsys.hsv_to_rgb((i*.61803398875)%1,.38,.84) for i,f in enumerate(features,1)}
    colors.update(config.get("feature_colors", {}))
    tiny=[]
    for feature in extent_features:
        pts=[p for ring in primary_rings(feature) for p in ring]
        if not pts: continue
        fw=max(p[0] for p in pts)-min(p[0] for p in pts); fh=max(p[1] for p in pts)-min(p[1] for p in pts)
        if not config.get("disable_callouts") and (fw < width*.032 or fh < height*.032 or feature_area(feature) < width*height*.0007): tiny.append(feature)
    left=[(f["center"][1],f) for f in tiny if f["center"][0] < (min_x+max_x)/2]
    right=[(f["center"][1],f) for f in tiny if f["center"][0] >= (min_x+max_x)/2]
    callout_positions: dict[str, tuple[float, float]] = {}
    left_columns = int(config.get("left_callout_columns", 0))
    if left_columns:
        # Preserve north-to-south ordering while alternating between adjacent
        # columns. Each column therefore needs only half as many labels and the
        # leader lines remain short around the crowded western edge.
        ordered_left = sorted(left, key=lambda item: item[0])
        groups = [ordered_left[index::left_columns] for index in range(left_columns)]
        offsets = config.get("callout_offsets", [.045 + .075 * index for index in range(left_columns)])
        gap = height * config.get("callout_gap", .045)
        for column, group in enumerate(groups):
            positions = spread(group, min_y, max_y, gap)
            tx = min_x - width * offsets[column]
            for answer, ty in positions.items():
                callout_positions[answer] = (tx, ty)
        right_positions = spread(right, min_y, max_y, gap)
        for _, feature in right:
            answer = feature["answer"]
            tx = feature["center"][0] + width * config.get("right_callout_offset", .035)
            callout_positions[answer] = (tx, right_positions[answer])
    else:
        left_y=spread(left,min_y,max_y,height*.045); right_y=spread(right,min_y,max_y,height*.045)
        callout_offset = config.get("callout_offset", .10)
        for answer, ty in left_y.items(): callout_positions[answer] = (min_x-width*callout_offset, ty)
        for answer, ty in right_y.items(): callout_positions[answer] = (max_x+width*callout_offset, ty)
    callout_positions.update(config.get("fixed_callouts", {}))
    callout_positions.update({
        answer: project_point(point, config.get("projection"))
        for answer, point in config.get("fixed_callouts_lonlat", {}).items()
    })
    label_positions = dict(config.get("label_positions", {}))
    label_positions.update({
        answer: project_point(point, config.get("projection"))
        for answer, point in config.get("label_positions_lonlat", {}).items()
    })

    def draw(path: Path, target: str|None=None, labels: str|None=None, title: str|None=None):
        aspect=width/max(height,1e-9)
        fig_w=max(10,min(24,11*aspect)); fig_h=max(10,min(18,11/aspect))
        if config.get("compact_wide"):
            fig_h=max(5.5,min(12,fig_w/aspect+1.4))
        named_below = labels == "name" and config.get("named_layout") == "below"
        legend_columns = config.get("legend_columns", 1)
        legend_rows = math.ceil(len(features) / legend_columns)
        inline_names = labels == "name" and config.get("inline_names")
        if labels=="name" and not inline_names:
            if named_below: fig_h += max(3.2, legend_rows * .34)
            else: fig_w += config.get("right_legend_width", 7)
        fig,ax=plt.subplots(figsize=(fig_w,fig_h),dpi=180)
        for context_feature, context in context_features:
            for ring in rings(context_feature["geometry"]):
                if polygon_area(ring) < .000002: continue
                ax.add_patch(Polygon(
                    display_ring(ring), closed=True, facecolor=context["fill"],
                    edgecolor="#304247", linewidth=context["linewidth"], zorder=0,
                ))
        for feature in sorted(features,key=feature_area,reverse=True):
            if feature is inset_feature: continue
            selected=feature["answer"]==target
            fill="#e98255" if selected else (colors[feature["answer"]] if target is None else "#dce1df")
            feature_rings = primary_rings(feature)
            if not feature_rings: continue
            largest = max(polygon_area(ring) for ring in feature_rings)
            for ring in feature_rings:
                if polygon_area(ring) < max(width * height * 0.000002, largest * 0.00001): continue
                ax.add_patch(Polygon(display_ring(ring),closed=True,facecolor=fill,edgecolor="#304247",linewidth=.65))
        if inline_names:
            inline_labels = config.get("inline_name_labels", {})
            inline_sizes = config.get("inline_name_font_sizes", {})
            for feature in features:
                x,y=label_positions.get(feature["answer"], feature["center"])
                answer=feature["answer"]
                if answer == "Brussels":
                    ax.annotate("Brussels",xy=(x,y),xytext=(x,max_y+height*.075),ha="center",va="center",
                                fontsize=18,fontweight="bold",color="#142429",
                                bbox=dict(boxstyle="round,pad=.16",facecolor="#fffdf4",alpha=.94,linewidth=0),
                                arrowprops=dict(arrowstyle="-",color="#142429",linewidth=1.4,shrinkA=5,shrinkB=2),zorder=20)
                    continue
                label = inline_labels.get(answer, answer)
                text = ax.text(x,y,label,ha="center",va="center",fontsize=inline_sizes.get(answer,20),
                               linespacing=.9,fontweight="bold",color="#142429",zorder=20,
                               bbox=(dict(boxstyle="round,pad=.20",facecolor="#fffdf4",alpha=.90,linewidth=0)
                                     if config.get("inline_name_boxes") else None))
                if not config.get("inline_name_boxes"):
                    text.set_path_effects([path_effects.withStroke(linewidth=3.2,foreground="#fffdf4",alpha=.86)])
        elif labels:
            for index,feature in enumerate(features,1):
                if feature is inset_feature: continue
                if feature["answer"] in full_inset_answers: continue
                x,y=label_positions.get(feature["answer"], feature["center"])
                if feature["answer"] in callout_positions:
                    tx,ty=callout_positions[feature["answer"]]
                    ax.annotate(str(index),xy=(x,y),xytext=(tx,ty),ha="center",va="center",
                                fontsize=config.get("callout_font_size",14),fontweight="bold",color="#142429",
                                bbox=dict(boxstyle=f"round,pad={config.get('callout_box_pad',.18)}",facecolor="#fffdf4",alpha=.92,linewidth=0),
                                arrowprops=dict(arrowstyle="-",color="#142429",linewidth=1.1,shrinkA=4,shrinkB=2),zorder=20)
                else:
                    ax.text(x,y,str(index),ha="center",va="center",fontsize=config.get("number_font_size",14),fontweight="bold",color="#142429",
                            bbox=dict(boxstyle="round,pad=.18",facecolor="#fffdf4",alpha=.84,linewidth=0),zorder=20)
        if labels=="name" and not inline_names:
            if named_below:
                legend_fraction = max(3.2, legend_rows * .34) / fig_h
                map_bottom = legend_fraction + .055
                ax.set_position([.035,map_bottom,.93,.91-map_bottom])
                per_column=math.ceil(len(features)/legend_columns)
                column_width=.94/legend_columns
                legend_top=legend_fraction+.018
                legend_bottom=.045
                for index,feature in enumerate(features,1):
                    col=(index-1)//per_column; row=(index-1)%per_column
                    x=.035+col*column_width
                    y=legend_top-row*((legend_top-legend_bottom)/max(per_column-1,1))
                    fig.text(x,y,f"{index}. {feature['answer']}",ha="left",va="center",fontsize=8.8,fontweight="bold",color="#142429")
            else:
                map_right = config.get("named_map_right", .61)
                map_bottom = config.get("named_map_bottom", .06)
                map_top = config.get("named_map_top", .94)
                ax.set_position([.03,map_bottom,map_right-.03,map_top-map_bottom])
                columns=config.get("right_legend_columns", 1 if len(features)<=24 else 2)
                per_column=math.ceil(len(features)/columns)
                legend_start=config.get("right_legend_start", .64)
                legend_width=.98-legend_start
                side_groups = config.get("right_legend_side_groups")
                if side_groups is None:
                    side_count = config.get("right_legend_side_count", len(features))
                    side_groups = []
                    side_per_column = math.ceil(side_count / columns)
                    for col in range(columns):
                        start = col * side_per_column + 1
                        side_groups.append(list(range(start, min(start + side_per_column, side_count + 1))))
                per_column=max((len(group) for group in side_groups), default=1)
                for col, group in enumerate(side_groups):
                    for row, index in enumerate(group):
                        feature = features[index - 1]
                        column_step = config.get("right_legend_column_step", legend_width / columns)
                        legend_top = config.get("right_legend_top", .91)
                        legend_bottom = config.get("right_legend_bottom", .07)
                        x=legend_start+col*column_step
                        y=legend_top-row*((legend_top-legend_bottom)/max(per_column-1,1))
                        default_legend_font = 10 if len(features)<=36 else 8.2
                        fig.text(x,y,f"{index}. {feature['answer']}",ha="left",va="center",fontsize=config.get("legend_font_size",default_legend_font),fontweight="bold",color="#142429")
                bottom_groups = config.get("right_legend_bottom_groups")
                if bottom_groups is None:
                    bottom_columns = config.get("right_legend_bottom_columns", [])
                    bottom_groups = []
                    bottom_index = side_count + 1
                    for rows in bottom_columns:
                        bottom_groups.append(list(range(bottom_index, bottom_index + rows)))
                        bottom_index += rows
                bottom_start = config.get("right_legend_bottom_start", legend_start)
                bottom_step = config.get("right_legend_bottom_column_step", column_step)
                bottom_positions = config.get("right_legend_bottom_positions")
                bottom_top = config.get("right_legend_bottom_top", .15)
                bottom_row_step = config.get("right_legend_bottom_row_step", .045)
                for col, group in enumerate(bottom_groups):
                    for row, index in enumerate(group):
                        feature = features[index - 1]
                        x = bottom_positions[col] if bottom_positions else bottom_start+col*bottom_step
                        fig.text(x,bottom_top-row*bottom_row_step,
                                 f"{index}. {feature['answer']}",ha="left",va="center",
                                 fontsize=config.get("legend_font_size",default_legend_font),
                                 fontweight="bold",color="#142429")
        margin_x=width*config.get("margin_x", .14)
        margin_y=height*config.get("margin_y", .06)
        if inline_names: margin_y=max(margin_y,height*.14)
        ax.set_xlim(min_x-margin_x,max_x+margin_x); ax.set_ylim(min_y-margin_y,max_y+margin_y)
        ax.set_aspect("equal"); ax.axis("off"); ax.set_title(title or config["title"],fontsize=17,pad=12,fontweight="bold")
        if component_insets:
            if labels == "name":
                ax.set_position([.18,.06,.43,.88])
                inset_x, inset_width = .018, .14
            else:
                ax.set_position([.23,.06,.74,.88])
                inset_x, inset_width = .02, .18
            inset_positions = [.755, .555, .355, .155]
            for spec, inset_y in zip(component_insets, inset_positions):
                feature = next(item for item in features if item["answer"] == spec["feature"])
                inset_rings = [
                    ring for ring in rings(feature["geometry"])
                    if "max_x_below" not in spec or max(point[0] for point in ring) < spec["max_x_below"]
                ]
                inset_ax = fig.add_axes([inset_x, inset_y, inset_width, .15], facecolor="#eee9df")
                selected = feature["answer"] == target
                fill = "#e98255" if selected else (colors[feature["answer"]] if target is None else "#dce1df")
                points = [point for ring in inset_rings for point in ring]
                inset_min_x, inset_max_x = min(p[0] for p in points), max(p[0] for p in points)
                inset_min_y, inset_max_y = min(p[1] for p in points), max(p[1] for p in points)
                inset_w, inset_h = inset_max_x-inset_min_x, inset_max_y-inset_min_y
                for ring in inset_rings:
                    inset_ax.add_patch(Polygon(display_ring(ring),closed=True,facecolor=fill,
                                               edgecolor="#304247",linewidth=.8))
                if labels is not None:
                    index = features.index(feature)+1
                    inset_ax.text((inset_min_x+inset_max_x)/2,(inset_min_y+inset_max_y)/2,str(index),
                                  ha="center",va="center",fontsize=15,fontweight="bold",color="#142429",
                                  bbox=dict(boxstyle="round,pad=.16",facecolor="#fffdf4",alpha=.9,linewidth=0),zorder=20)
                inset_ax.set_xlim(inset_min_x-inset_w*.08,inset_max_x+inset_w*.08)
                inset_ax.set_ylim(inset_min_y-inset_h*.28,inset_max_y+inset_h*.08)
                inset_ax.set_aspect("equal"); inset_ax.set_xticks([]); inset_ax.set_yticks([])
                for spine in inset_ax.spines.values():
                    spine.set_color("#607176"); spine.set_linewidth(1); spine.set_linestyle((0,(5,4)))
                if not config.get("hide_component_inset_names"):
                    inset_ax.text(.5,.025,spec["label"],transform=inset_ax.transAxes,ha="center",va="bottom",
                                  fontsize=8.5,fontweight="bold",color="#46585d")
        show_figure_inset = inset_feature is not None
        if show_figure_inset:
            # Keep the remote archipelago out of the main geographic extent.
            # A compact figure-level inset reserves only the lower-left space
            # actually needed by the islands, their number and their border.
            if labels == "name":
                ax.set_position([.035, .245, .57, .69])
                inset_position = [.035, .045, .205, .17]
            else:
                ax.set_position([.045, .225, .91, .715])
                inset_position = [.035, .04, .22, .17]
            inset_ax = fig.add_axes(inset_position, facecolor="#eee9df")
            selected = inset_feature["answer"] == target
            fill = "#e98255" if selected else (colors[inset_feature["answer"]] if target is None else "#dce1df")
            inset_rings = rings(inset_feature["geometry"])
            inset_points = [point for ring in inset_rings for point in ring]
            inset_min_x, inset_max_x = min(p[0] for p in inset_points), max(p[0] for p in inset_points)
            inset_min_y, inset_max_y = min(p[1] for p in inset_points), max(p[1] for p in inset_points)
            inset_width, inset_height = inset_max_x - inset_min_x, inset_max_y - inset_min_y
            for ring in inset_rings:
                inset_ax.add_patch(Polygon(display_ring(ring), closed=True, facecolor=fill,
                                           edgecolor="#304247", linewidth=.75))
            if labels is not None:
                inset_index = features.index(inset_feature) + 1
                inset_x, inset_y = inset_feature["center"]
                inset_ax.text(inset_x, inset_y, str(inset_index), ha="center", va="center",
                              fontsize=15, fontweight="bold", color="#142429",
                              bbox=dict(boxstyle="round,pad=.16", facecolor="#fffdf4", alpha=.9, linewidth=0),
                              zorder=20)
            inset_ax.set_xlim(inset_min_x - inset_width * .055, inset_max_x + inset_width * .055)
            inset_ax.set_ylim(inset_min_y - inset_height * .22, inset_max_y + inset_height * .08)
            inset_ax.set_aspect("equal")
            inset_ax.set_xticks([]); inset_ax.set_yticks([])
            for spine in inset_ax.spines.values():
                spine.set_color("#607176"); spine.set_linewidth(1.0); spine.set_linestyle((0, (5, 4)))
            if not (target is None and labels is None and
                    config.get("hide_figure_inset_caption_on_reference")):
                inset_ax.text(.5, .025, "Canary Islands", transform=inset_ax.transAxes,
                              ha="center", va="bottom", fontsize=8.5,
                              fontweight="bold", color="#46585d")
        if detail_insets:
            # These panels enlarge tiny first-level divisions without moving
            # or inflating their canonical geometry on the main map. Their
            # captions remain anonymous on question/reference artwork so the
            # panel itself does not disclose the answer.
            panel_width = .145
            panel_gap = .025
            panel_start = .36
            for panel_index, spec in enumerate(detail_insets):
                feature = next(item for item in features if item["answer"] == spec["feature"])
                # The source may include extremely small detached rocks or
                # outlying Spanish possessions in the same multipolygon. The
                # detail panel represents the named city's principal landmass;
                # use its largest component so those distant points cannot
                # shrink the city to an unreadable dot.
                feature_rings = rings(feature["geometry"])
                detail_rings = [max(feature_rings, key=polygon_area)]
                detail_points = [point for ring in detail_rings for point in ring]
                detail_min_x, detail_max_x = min(p[0] for p in detail_points), max(p[0] for p in detail_points)
                detail_min_y, detail_max_y = min(p[1] for p in detail_points), max(p[1] for p in detail_points)
                detail_width = detail_max_x - detail_min_x
                detail_height = detail_max_y - detail_min_y
                detail_ax = fig.add_axes([
                    panel_start + panel_index * (panel_width + panel_gap), .04, panel_width, .17
                ], facecolor="#eee9df")
                selected = feature["answer"] == target
                fill = "#e98255" if selected else (colors[feature["answer"]] if target is None else "#dce1df")
                for ring in detail_rings:
                    detail_ax.add_patch(Polygon(display_ring(ring), closed=True, facecolor=fill,
                                                edgecolor="#304247", linewidth=1.0))
                if labels is not None:
                    detail_index = features.index(feature) + 1
                    detail_ax.text((detail_min_x + detail_max_x) / 2, (detail_min_y + detail_max_y) / 2,
                                   str(detail_index), ha="center", va="center", fontsize=15,
                                   fontweight="bold", color="#142429",
                                   bbox=dict(boxstyle="round,pad=.16", facecolor="#fffdf4",
                                             alpha=.9, linewidth=0), zorder=20)
                pad_x = max(detail_width * .20, detail_height * .10)
                pad_y = max(detail_height * .20, detail_width * .10)
                detail_ax.set_xlim(detail_min_x - pad_x, detail_max_x + pad_x)
                detail_ax.set_ylim(detail_min_y - pad_y, detail_max_y + pad_y)
                detail_ax.set_aspect("equal")
                detail_ax.set_xticks([]); detail_ax.set_yticks([])
                for spine in detail_ax.spines.values():
                    spine.set_color("#607176"); spine.set_linewidth(1.0); spine.set_linestyle((0, (5, 4)))
                caption = feature["answer"] if title == feature["answer"] or labels == "name" else "Enlarged detail"
                detail_ax.text(.5, .025, caption, transform=detail_ax.transAxes,
                               ha="center", va="bottom", fontsize=8.0,
                               fontweight="bold", color="#46585d")
        count_label = config.get("count_label", f"{len(features)} {config['unit']}s")
        if not config.get("hide_footer"):
            fig.text(.5,.014,f"{count_label} • north is up",ha="center",fontsize=7,color="#46585d")
        if labels!="name" and inset_feature is None and not component_insets and not detail_insets:
            fig.tight_layout(rect=(0,.03,1,.97))
        path.parent.mkdir(parents=True,exist_ok=True); fig.savefig(path,bbox_inches="tight",facecolor="#f5f1e8"); plt.close(fig)

    split.mkdir(parents=True,exist_ok=True)
    draw(split/"reference.png")
    draw(data/"divisions-numbered.png",labels="number")
    if config.get("overview_only"):
        return
    draw(data/"divisions-named.png",labels="name")
    metadata=[]
    for feature in features:
        stem=feature["idStem"]
        metadata.append({"id":f"{stem}-highlight","answer":feature["answer"],"kind":config["unit"].title(),"sourceCode":feature["properties"].get("shapeISO","")})
        draw(split/f"{stem}-question.png",target=feature["answer"],title=f"Which {config['unit']} is highlighted?")
        draw(split/f"{stem}-answer.png",target=feature["answer"],title=feature["answer"])
    (data/"divisions.json").write_text(json.dumps(metadata,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")


if __name__ == "__main__":
    requested=sys.argv[1:] or list(CONFIGS)
    for country in requested:
        print(f"Generating {country}...",flush=True); generate(country)
