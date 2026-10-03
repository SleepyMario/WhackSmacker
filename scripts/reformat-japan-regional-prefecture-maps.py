#!/usr/bin/env python3
"""Reformat Japan's regional prefecture maps around each region's shape."""

from pathlib import Path
from shutil import copy2
import json

import numpy as np
from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
MAP_DIR = ROOT / "packages/geography/data/japan-regions/prefecture-decks"
SOURCE_DIR = MAP_DIR / "source-portrait"
VARIANTS = ("numbered", "named", "kanji", "reference")

# Bounds cover the cartography and its labels, omitting the old portrait card's
# decorative title, footer, and unused whitespace.
REGIONS = {
    "hokkaido": {"crop": (60, 325, 970, 1046), "canvas": (1500, 1000)},
    # Keep the full Aomori-to-Fukushima extent; this tall region reaches much
    # closer to the original map panel's upper and lower edges than the others.
    "tohoku": {"crop": (109, 100, 878, 1230), "canvas": (1000, 1400)},
    "kanto": {"crop": (55, 150, 847, 1170), "canvas": (1400, 1100)},
    "chubu": {"crop": (84, 140, 924, 1070), "canvas": (1100, 1400)},
    "kansai": {"crop": (21, 288, 957, 1068), "canvas": (1500, 1000)},
    "chugoku": {"crop": (25, 297, 971, 1023), "canvas": (1600, 900)},
    "shikoku": {"crop": (21, 249, 970, 1002), "canvas": (1600, 900)},
    # Include the dedicated Okinawa inset below the main Kyūshū map.
    "kyushu": {"crop": (90, 90, 930, 1290), "canvas": (1000, 1400)},
}

# Prefecture fill colours follow the numbered order in regions.json. Keeping
# them explicit also lets validation prove that no detached territory vanished
# from a crop (notably Okinawa).
PREFECTURE_COLORS = {
    "hokkaido": [(134, 156, 209)],
    "tohoku": [(178, 209, 134), (209, 134, 200), (134, 209, 197), (209, 175, 134), (153, 134, 209), (137, 209, 134)],
    "kanto": [(209, 134, 159), (134, 181, 209), (203, 209, 134), (193, 134, 209), (134, 209, 171), (209, 149, 134), (134, 140, 209)],
    "chubu": [(162, 209, 134), (209, 134, 184), (134, 206, 209), (209, 190, 134), (168, 134, 209), (134, 209, 146), (209, 134, 143), (134, 165, 209), (187, 209, 134)],
    "kansai": [(209, 134, 209), (134, 209, 187), (209, 165, 134), (143, 134, 209), (147, 209, 134), (209, 134, 169), (134, 191, 209)],
    "chugoku": [(209, 206, 134), (184, 134, 209), (134, 209, 162), (209, 140, 134), (134, 150, 209)],
    "shikoku": [(172, 209, 134), (209, 134, 194), (134, 209, 202), (209, 180, 134)],
    "kyushu": [(159, 134, 209), (134, 209, 137), (209, 134, 153), (134, 175, 209), (197, 209, 134), (199, 134, 209), (134, 209, 177), (209, 155, 134)],
}

NEUTRAL = np.array((220, 224, 223), dtype=np.uint8)
HIGHLIGHT = np.array((239, 126, 75), dtype=np.uint8)
FONT_PATH = "/usr/share/fonts/noto-cjk/NotoSansCJK-Regular.ttc"


def fit_inside(image: Image.Image, size: tuple[int, int], margin: int = 20) -> Image.Image:
    available = (size[0] - 2 * margin, size[1] - 2 * margin)
    scale = min(available[0] / image.width, available[1] / image.height)
    resized = image.resize((round(image.width * scale), round(image.height * scale)), Image.Resampling.LANCZOS)
    canvas = Image.new("RGB", size, (248, 246, 240))
    canvas.paste(resized, ((size[0] - resized.width) // 2, (size[1] - resized.height) // 2))
    return canvas


def colour_mask(image: Image.Image, colours: list[tuple[int, int, int]], tolerance: int = 18) -> np.ndarray:
    pixels = np.array(image.convert("RGB")).astype(np.int16)
    mask = np.zeros(pixels.shape[:2], dtype=bool)
    for colour in colours:
        distance = np.max(np.abs(pixels - np.array(colour, dtype=np.int16)), axis=2)
        mask |= distance <= tolerance
    return mask


def square_dilate(mask: np.ndarray, radius: int) -> np.ndarray:
    """Fast square dilation using a summed-area table."""
    size = radius * 2 + 1
    padded = np.pad(mask.astype(np.uint8), radius)
    summed = np.pad(padded, ((1, 0), (1, 0))).cumsum(axis=0).cumsum(axis=1)
    windows = summed[size:, size:] - summed[:-size, size:] - summed[size:, :-size] + summed[:-size, :-size]
    return windows > 0


def direct_canvas_crop(image: Image.Image, colours: list[tuple[int, int, int]], padding: int = 12) -> Image.Image:
    """Keep the complete coloured region while removing the old framed panel."""
    rgb = image.convert("RGB")
    pixels = np.array(rgb).astype(np.int16)
    region = colour_mask(rgb, colours)
    if not region.any():
        raise ValueError("regional artwork contains no expected prefecture colours")
    # Preserve the dark number/name glyphs and their immediate surroundings.
    # This retains labels extending over water without retaining the old map
    # frame or neighbouring-region outlines.
    near_region = square_dilate(region, 100)
    dark_labels = (np.max(pixels, axis=2) < 105) & near_region
    region_ys = np.where(region)[0]
    dark_labels[:max(0, int(region_ys.min()) - 10)] = False
    labels = square_dilate(dark_labels, 40)
    keep = square_dilate(region, 3) | labels
    ys, xs = np.where(keep)
    left = max(0, int(xs.min()) - padding)
    top = max(0, int(ys.min()) - padding)
    right = min(rgb.width, int(xs.max()) + padding + 1)
    bottom = min(rgb.height, int(ys.max()) + padding + 1)
    cropped_pixels = pixels[top:bottom, left:right].copy()
    ocean = np.max(np.abs(cropped_pixels - np.array((237, 243, 244), dtype=np.int16)), axis=2) <= 22
    neighbour = np.max(np.abs(cropped_pixels - np.array((220, 224, 223), dtype=np.int16)), axis=2) <= 22
    cropped_pixels[ocean | neighbour] = np.array((248, 246, 240), dtype=np.int16)
    cropped = Image.fromarray(cropped_pixels.astype(np.uint8), "RGB")
    keep_cropped = keep[top:bottom, left:right]
    keep_image = Image.fromarray((keep_cropped.astype(np.uint8) * 255), "L")
    canvas = Image.new("RGB", cropped.size, (248, 246, 240))
    canvas.paste(cropped, mask=keep_image)
    return canvas


def highlighted_region_map(source: Image.Image, colours: list[tuple[int, int, int]], selected: int) -> Image.Image:
    pixels = np.array(source.convert("RGB"))
    original = pixels.astype(np.int16)
    matches = []
    for colour in colours:
        distance = np.max(np.abs(original - np.array(colour, dtype=np.int16)), axis=2)
        matches.append(distance <= 12)
    for match in matches:
        pixels[match] = NEUTRAL
    pixels[matches[selected]] = HIGHLIGHT
    return Image.fromarray(pixels, "RGB")


def add_answer_label(image: Image.Image, label: str) -> Image.Image:
    result = image.copy()
    draw = ImageDraw.Draw(result)
    font = ImageFont.truetype(FONT_PATH, max(28, round(result.height * 0.03)))
    box = draw.textbbox((0, 0), label, font=font, stroke_width=1)
    width, height = box[2] - box[0], box[3] - box[1]
    x, y = (result.width - width) // 2, 18
    draw.rounded_rectangle((x - 14, y - 6, x + width + 14, y + height + 10), radius=10, fill=(248, 246, 240), outline=(123, 149, 158), width=2)
    draw.text((x, y), label, font=font, fill=(38, 61, 70), stroke_width=1, stroke_fill=(38, 61, 70))
    return result


def main() -> None:
    SOURCE_DIR.mkdir(exist_ok=True)
    region_metadata = {entry["id"].removesuffix("-highlight"): entry for entry in json.loads((MAP_DIR.parent / "regions.json").read_text())}
    prefectures = {entry["answer"]: entry for entry in json.loads((MAP_DIR.parent.parent / "japan-hard/prefectures.json").read_text())}
    for slug, spec in REGIONS.items():
        colours = PREFECTURE_COLORS[slug]
        for variant in VARIANTS:
            destination = MAP_DIR / f"{slug}-{variant}.png"
            source = SOURCE_DIR / destination.name
            if not source.exists():
                copy2(destination, source)
            original = Image.open(source).convert("RGB")
            direct = direct_canvas_crop(original, colours)
            fit_inside(direct, spec["canvas"]).save(destination, optimize=True)
        cropped_reference = direct_canvas_crop(Image.open(SOURCE_DIR / f"{slug}-reference.png").convert("RGB"), colours)
        names = region_metadata[slug]["prefectures"]
        if len(names) != len(colours):
            raise ValueError(f"{slug}: {len(names)} prefectures but {len(colours)} colours")
        split = MAP_DIR / slug / "split"
        split_kanji = MAP_DIR / slug / "split-kanji"
        split.mkdir(parents=True, exist_ok=True)
        split_kanji.mkdir(parents=True, exist_ok=True)
        fit_inside(cropped_reference, spec["canvas"]).save(split / "reference.png", optimize=True)
        fit_inside(cropped_reference, spec["canvas"]).save(split_kanji / "reference.png", optimize=True)
        for index, name in enumerate(names):
            stem = prefectures[name]["id"].removesuffix("-highlight")
            highlighted = fit_inside(highlighted_region_map(cropped_reference, colours, index), spec["canvas"])
            highlighted.save(split / f"{stem}-question.png", optimize=True)
            highlighted.save(split_kanji / f"{stem}-question.png", optimize=True)
            add_answer_label(highlighted, name).save(split / f"{stem}-answer.png", optimize=True)
            add_answer_label(highlighted, prefectures[name]["japanese"]).save(split_kanji / f"{stem}-answer.png", optimize=True)


if __name__ == "__main__":
    main()
