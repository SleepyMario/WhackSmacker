#!/usr/bin/env python3
"""Render the continuous Central America and Caribbean study map."""
import colorsys
import json
import re
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "packages/geography/data/central-america-countries"
SOURCE = DATA / "source-natural-earth-map-units.geojson"
FONT = "/usr/share/fonts/dejavu/DejaVuSans.ttf"
BOLD = "/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf"
W, H = 4400, 3000
PAPER = (246, 242, 233)
SEA = (224, 237, 239)
INK = (37, 54, 59)
EDGE = (55, 72, 77)
ORANGE = (235, 128, 73)
GREY = (218, 224, 223)
ORDER = [
    "Belize", "Guatemala", "El Salvador", "Honduras", "Nicaragua", "Costa Rica", "Panama",
    "Bahamas", "Cuba", "Jamaica", "Haiti", "Dominican Republic",
    "Antigua and Barbuda", "Saint Kitts and Nevis", "Dominica", "Saint Lucia",
    "Saint Vincent and the Grenadines", "Barbados", "Grenada", "Trinidad and Tobago",
    "Puerto Rico (United States)", "Turks and Caicos Islands (United Kingdom)",
    "Cayman Islands (United Kingdom)", "United States Virgin Islands",
    "British Virgin Islands (United Kingdom)", "Anguilla (United Kingdom)",
    "Montserrat (United Kingdom)", "Guadeloupe (France)", "Martinique (France)",
    "Saint Martin (France)", "Saint Barthelemy (France)", "Sint Maarten (Netherlands)",
    "Aruba (Netherlands)", "Curacao (Netherlands)", "Bonaire (Netherlands)",
    "Saba (Netherlands)", "Sint Eustatius (Netherlands)",
]
BOUNDS = (-92.5, 7.0, -58.0, 28.8)


def slug(value):
    return re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")


def polygons(feature):
    geometry = feature["geometry"]
    return [geometry["coordinates"]] if geometry["type"] == "Polygon" else geometry["coordinates"]


def palette(number):
    return tuple(round(c * 255) for c in colorsys.hsv_to_rgb((number * .61803398875) % 1, .34, .83))


def load_features():
    source = json.loads(SOURCE.read_text())
    by_name = {feature["properties"]["shapeName"]: feature for feature in source["features"]}
    return [(number, name, by_name[name]) for number, name in enumerate(ORDER, 1)]


def canvas_to_lonlat(lon, lat, frame):
    left, top, right, bottom = frame
    minlon, minlat, maxlon, maxlat = BOUNDS
    scale = min((right-left)/(maxlon-minlon), (bottom-top)/(maxlat-minlat))
    width, height = (maxlon-minlon)*scale, (maxlat-minlat)*scale
    ox, oy = left+(right-left-width)/2, top+(bottom-top-height)/2
    return ox+(lon-minlon)*scale, oy+(maxlat-lat)*scale


def label_anchor(feature):
    largest = max(polygons(feature), key=lambda polygon: abs(sum(
        ring[i][0]*ring[(i+1)%len(ring)][1]-ring[(i+1)%len(ring)][0]*ring[i][1]
        for ring in polygon for i in range(len(ring))
    )))
    ring = largest[0]
    return sum(point[0] for point in ring)/len(ring), sum(point[1] for point in ring)/len(ring)


DIRECT = {
    "Belize": (-88.65, 17.15), "Guatemala": (-90.55, 15.55), "El Salvador": (-88.95, 13.72),
    "Honduras": (-86.55, 14.85), "Nicaragua": (-85.15, 12.75), "Costa Rica": (-84.15, 9.95),
    "Panama": (-80.55, 8.72), "Bahamas": (-77.45, 24.1), "Cuba": (-78.6, 21.65),
    "Jamaica": (-77.3, 18.12), "Haiti": (-72.65, 19.05), "Dominican Republic": (-70.55, 19.0),
    "Puerto Rico (United States)": (-66.45, 18.25), "Trinidad and Tobago": (-61.25, 10.55),
}

# Ordered callouts keep every line local and prevent crossings along the island chain.
CALLOUTS = {
    "Turks and Caicos Islands (United Kingdom)": ((-71.8, 21.75), (-70.1, 23.15)),
    "Cayman Islands (United Kingdom)": ((-81.25, 19.32), (-82.4, 17.65)),
    "United States Virgin Islands": ((-64.8, 18.33), (-67.0, 20.35)),
    "British Virgin Islands (United Kingdom)": ((-64.55, 18.48), (-64.15, 21.2)),
    "Saint Martin (France)": ((-63.06, 18.08), (-61.55, 20.75)),
    "Sint Maarten (Netherlands)": ((-63.05, 18.02), (-63.0, 20.65)),
    "Saint Barthelemy (France)": ((-62.83, 17.9), (-58.45, 18.0)),
    "Anguilla (United Kingdom)": ((-63.05, 18.22), (-58.45, 19.45)),
    "Saba (Netherlands)": ((-63.24, 17.63), (-67.0, 17.75)),
    "Sint Eustatius (Netherlands)": ((-62.98, 17.49), (-58.45, 17.15)),
    "Saint Kitts and Nevis": ((-62.75, 17.3), (-67.0, 17.05)),
    "Antigua and Barbuda": ((-61.8, 17.1), (-58.45, 16.45)),
    "Montserrat (United Kingdom)": ((-62.19, 16.74), (-67.0, 16.35)),
    "Guadeloupe (France)": ((-61.55, 16.2), (-58.45, 15.65)),
    "Dominica": ((-61.36, 15.42), (-67.0, 15.55)),
    "Martinique (France)": ((-61.02, 14.65), (-58.45, 14.55)),
    "Saint Lucia": ((-60.98, 13.91), (-67.0, 14.45)),
    "Barbados": ((-59.56, 13.18), (-58.45, 13.15)),
    "Saint Vincent and the Grenadines": ((-61.2, 13.15), (-67.0, 13.35)),
    "Grenada": ((-61.68, 12.12), (-67.0, 11.55)),
    "Aruba (Netherlands)": ((-69.98, 12.52), (-71.0, 10.55)),
    "Curacao (Netherlands)": ((-68.98, 12.18), (-69.0, 10.1)),
    "Bonaire (Netherlands)": ((-68.27, 12.2), (-66.8, 10.15)),
}


def draw_map(mode="numbered", target=None, title="Central America — Countries and Territories"):
    image = Image.new("RGB", (W, H), PAPER)
    draw = ImageDraw.Draw(image)
    title_font = ImageFont.truetype(BOLD, 58)
    number_font = ImageFont.truetype(BOLD, 42)
    footer_font = ImageFont.truetype(FONT, 23)
    draw.text((W//2, 42), title, font=title_font, fill=INK, anchor="ma")
    frame = (30, 132, W-30, H-48)
    draw.rounded_rectangle(frame, radius=24, fill=SEA, outline=(112, 128, 131), width=4)

    def xy(lon, lat):
        return canvas_to_lonlat(lon, lat, (75, 175, W-75, H-95))

    for number, name, feature in load_features():
        color = ORANGE if name == target else (GREY if target else palette(number))
        for polygon in polygons(feature):
            for ring_index, ring in enumerate(polygon):
                points = [xy(point[0], point[1]) for point in ring]
                if len(points) > 2:
                    draw.polygon(points, fill=color if ring_index == 0 else SEA, outline=EDGE, width=2)

    def number_box(position, text):
        box = draw.textbbox(position, text, font=number_font, anchor="mm")
        draw.rounded_rectangle((box[0]-8, box[1]-5, box[2]+8, box[3]+5), radius=7, fill=(255, 253, 246))
        draw.text(position, text, font=number_font, fill=INK, anchor="mm")

    if mode == "numbered":
        for number, name, feature in load_features():
            if name in DIRECT:
                number_box(xy(*DIRECT[name]), str(number))
            elif name in CALLOUTS:
                source, destination = CALLOUTS[name]
                sx, sy = xy(*source); dx, dy = xy(*destination)
                # Leave a small gap before the number box.
                end_x = dx-25 if dx > sx else dx+25
                draw.line((sx, sy, end_x, dy), fill=INK, width=4)
                number_box((dx, dy), str(number))
            else:
                number_box(xy(*label_anchor(feature)), str(number))

    if target and target in CALLOUTS:
        sx, sy = xy(*CALLOUTS[target][0])
        draw.ellipse((sx-30, sy-30, sx+30, sy+30), outline=ORANGE, width=11)

    draw.text((W//2, H-62), "37 countries and territories • north is up • geographic positions preserved",
              font=footer_font, fill=(78, 90, 93), anchor="ms")
    return image


def draw_named():
    # Keep the geographic artwork large; pair its numbers with a compact three-column key.
    map_image = draw_map("numbered")
    image = Image.new("RGB", (W, 3800), PAPER)
    image.paste(map_image, (0, 0))
    draw = ImageDraw.Draw(image)
    draw.rectangle((30, 2970, W-30, 3770), fill=(255, 253, 246), outline=(112, 128, 131), width=4)
    font = ImageFont.truetype(BOLD, 27)
    columns = [ORDER[:13], ORDER[13:25], ORDER[25:]]
    starts = [80, 1530, 2960]
    number = 1
    for column_index, names in enumerate(columns):
        y = 3010
        for name in names:
            draw.text((starts[column_index], y), f"{number}. {name}", font=font, fill=INK)
            y += 56
            number += 1
    return image


def main():
    split = DATA / "split"
    split.mkdir(parents=True, exist_ok=True)
    records = []
    by_name = {name: feature for _, name, feature in load_features()}
    for number, name in enumerate(ORDER, 1):
        properties = by_name[name].get("properties", {})
        records.append({"id": f"{slug(name)}-highlight", "answer": name,
                        "kind": "Country Or Territory", "sourceCode": properties.get("shapeISO", "")})
    (DATA / "divisions.json").write_text(json.dumps(records, indent=2, ensure_ascii=False) + "\n")
    draw_map("numbered").save(DATA / "divisions-numbered.png", optimize=True)
    draw_named().save(DATA / "divisions-named.png", optimize=True)
    draw_map("reference").save(split / "reference.png", optimize=True)
    for record in records:
        stem = record["id"].removesuffix("-highlight")
        answer = record["answer"]
        draw_map("question", answer, "Which country or territory is highlighted?").save(split / f"{stem}-question.png", optimize=True)
        draw_map("question", answer, answer).save(split / f"{stem}-answer.png", optimize=True)
    print(DATA)


if __name__ == "__main__":
    main()
