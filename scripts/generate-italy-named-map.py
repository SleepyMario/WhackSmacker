#!/usr/bin/env python3
"""Build Italy's approved named overview from its retained map-only source."""

from pathlib import Path
import json

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "packages/geography/data/italy-regions"
SOURCE = DATA_DIR / "divisions-named-base.png"
DESTINATION = DATA_DIR / "divisions-named.png"

CANVAS_SIZE = (3000, 1770)
BACKGROUND = (245, 241, 232)
TEXT = (20, 36, 41)
KEY_TOP = 125
KEY_STEP = 155
KEY_FONT_SIZE = 36
KEY_COLUMNS = ((1950, 0, 10), (2470, 10, 20))
FONT_PATH = Path("/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf")


def main() -> None:
    divisions = json.loads((DATA_DIR / "divisions.json").read_text(encoding="utf-8"))
    names = [division["answer"] for division in divisions]
    if len(names) != 20:
        raise ValueError(f"expected 20 Italian regions, found {len(names)}")

    source = Image.open(SOURCE).convert("RGB")
    if source.size != (2386, 1770):
        raise ValueError(f"unexpected retained Italy source size: {source.size}")

    canvas = Image.new("RGB", CANVAS_SIZE, BACKGROUND)
    canvas.paste(source, (0, 0))

    # Keep the complete approved cartography and replace only its former key.
    # The title, map, labels, attribution and footer remain byte-for-byte where
    # they already fit; the wider right side gives the key two readable columns.
    draw = ImageDraw.Draw(canvas)
    draw.rectangle((1900, 70, CANVAS_SIZE[0], 1695), fill=BACKGROUND)
    if not FONT_PATH.is_file():
        raise FileNotFoundError(f"required map font is unavailable: {FONT_PATH}")
    font = ImageFont.truetype(FONT_PATH, KEY_FONT_SIZE)

    for x, start, stop in KEY_COLUMNS:
        for row, index in enumerate(range(start, stop)):
            label = f"{index + 1}. {names[index]}"
            y = KEY_TOP + row * KEY_STEP
            box = draw.textbbox((x, y), label, font=font)
            if box[2] >= CANVAS_SIZE[0] or box[3] >= CANVAS_SIZE[1]:
                raise ValueError(f"Italy key label does not fit: {label}")
            draw.text((x, y), label, font=font, fill=TEXT)

    canvas.save(DESTINATION, optimize=True)


if __name__ == "__main__":
    main()
