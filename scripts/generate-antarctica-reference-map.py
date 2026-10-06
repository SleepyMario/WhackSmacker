#!/usr/bin/env python3
"""Render the static Wandering the World Antarctica reference map."""

from __future__ import annotations

import json
import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "packages" / "geography" / "data" / "antarctica"
SOURCE = DATA_DIR / "source-ATA-adm0.geojson"
OUTPUT = DATA_DIR / "antarctica-map.png"

WIDTH = 2400
HEIGHT = 2400
BACKGROUND = "#f5f1e7"
GRID = "#c8d6d5"
LAND = "#8eb8c7"
COAST = "#263d45"
TEXT = "#263d45"


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    name = "DejaVuSans-Bold.ttf" if bold else "DejaVuSans.ttf"
    return ImageFont.truetype(f"/usr/share/fonts/dejavu/{name}", size)


def polar_xy(lon: float, lat: float) -> tuple[float, float]:
    """South-polar azimuthal-equidistant coordinates with 0° longitude up."""
    radius = 90.0 + lat
    angle = math.radians(lon)
    return radius * math.sin(angle), -radius * math.cos(angle)


def main() -> None:
    feature_collection = json.loads(SOURCE.read_text(encoding="utf-8"))
    geometry = feature_collection["features"][0]["geometry"]
    polygons = [geometry["coordinates"]] if geometry["type"] == "Polygon" else geometry["coordinates"]
    # Natural Earth's longitude-cut ring includes a near-pole bridge from
    # -180° to +180°. In a polar view that bridge becomes an artificial wedge
    # through the continent. Join the two adjacent coastline ends directly.
    source_rings = [
        [[point for point in ring if point[1] > -89] for ring in polygon]
        for polygon in polygons
    ]
    projected = [
        [[polar_xy(lon, lat) for lon, lat, *_ in ring] for ring in polygon]
        for polygon in source_rings
    ]

    points = [point for polygon in projected for ring in polygon for point in ring]
    min_x = min(x for x, _ in points)
    max_x = max(x for x, _ in points)
    min_y = min(y for _, y in points)
    max_y = max(y for _, y in points)

    image = Image.new("RGB", (WIDTH, HEIGHT), BACKGROUND)
    draw = ImageDraw.Draw(image)
    title_font = font(88, bold=True)
    label_font = font(40, bold=True)
    source_font = font(25)

    draw.text((WIDTH / 2, 92), "Antarctica", fill=TEXT, font=title_font, anchor="ma")

    # Keep only a narrow paper margin while leaving room for the title and source.
    map_box = (115, 250, WIDTH - 115, HEIGHT - 150)
    left, top, right, bottom = map_box
    scale = min((right - left) / (max_x - min_x), (bottom - top) / (max_y - min_y))
    offset_x = (left + right) / 2 - scale * (min_x + max_x) / 2
    offset_y = (top + bottom) / 2 - scale * (min_y + max_y) / 2

    def canvas(point: tuple[float, float]) -> tuple[float, float]:
        x, y = point
        return offset_x + scale * x, offset_y + scale * y

    pole = canvas((0.0, 0.0))
    for latitude in (-80, -70, -60):
        radius = scale * (90 + latitude)
        draw.ellipse(
            (pole[0] - radius, pole[1] - radius, pole[0] + radius, pole[1] + radius),
            outline=GRID,
            width=3,
        )
    outer_radius = scale * 30
    for longitude in range(-150, 181, 30):
        edge = canvas(polar_xy(longitude, -60))
        draw.line((pole, edge), fill=GRID, width=3)

    for source_polygon, polygon in zip(source_rings, projected):
        exterior = [canvas(point) for point in polygon[0]]
        draw.polygon(exterior, fill=LAND)
        # The ADM0 ring closes at the South Pole. Drawing that closure as a
        # normal outline creates a false line across the ice, so render only
        # the short, genuine coastline segments.
        closed_source = source_polygon[0] + source_polygon[0][:1]
        closed_exterior = exterior + exterior[:1]
        for source_start, source_end, start, end in zip(closed_source, closed_source[1:], closed_exterior, closed_exterior[1:]):
            artificial_dateline_edge = abs(source_start[0]) > 179 and abs(source_end[0]) > 179
            if not artificial_dateline_edge and math.dist(start, end) < scale * 3:
                draw.line((start, end), fill=COAST, width=5)
        for hole in polygon[1:]:
            interior = [canvas(point) for point in hole]
            draw.polygon(interior, fill=BACKGROUND)
            for start, end in zip(interior, interior[1:]):
                if math.dist(start, end) < scale * 3:
                    draw.line((start, end), fill=COAST, width=3)

    pole_radius = 10
    draw.ellipse(
        (pole[0] - pole_radius, pole[1] - pole_radius, pole[0] + pole_radius, pole[1] + pole_radius),
        fill=TEXT,
    )
    draw.text((pole[0] + 25, pole[1] + 14), "South Pole", fill=TEXT, font=label_font, anchor="lm")

    draw.text(
        (WIDTH / 2, HEIGHT - 72),
        "South-polar reference map • north is outward • boundary source: geoBoundaries / Natural Earth (public domain)",
        fill=TEXT,
        font=source_font,
        anchor="ms",
    )
    image.save(OUTPUT, optimize=True)


if __name__ == "__main__":
    main()
