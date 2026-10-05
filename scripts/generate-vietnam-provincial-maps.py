#!/usr/bin/env python3
"""Generate the post-2025 Vietnam provincial-level quiz artwork."""

import colorsys
import json
import os
import re
import unicodedata
from pathlib import Path

os.environ.setdefault("MPLCONFIGDIR", "/tmp/whacksmacker-vietnam-map-mpl")
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import Polygon

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "packages/geography/data/vietnam-provinces"
SOURCE = DATA / "provinces-source.json"
SPLIT = DATA / "split"
SPLIT.mkdir(parents=True, exist_ok=True)

# Canonical Wandering the World map-artwork priorities:
#   1. maximize the complete visible landmass;
#   2. then maximize readable map-label and legend text.
# Labels may sit inside a division or move into open canvas space with a leader
# line. They must never force the geography itself to be rendered needlessly
# small. See packages/geography/data/MAP_ARTWORK_RULES.md.

raw = json.loads(SOURCE.read_text(encoding="utf-8"))
provinces = sorted(raw["provinces"], key=lambda item: int(item["id"]))
for province in provinces:
    if province["name"].startswith("TP. "):
        province["name"] = province["name"][4:]

def slug(value: str) -> str:
    value = unicodedata.normalize("NFD", value.replace("Đ", "D").replace("đ", "d"))
    return re.sub(r"[^a-z0-9]+", "-", "".join(ch for ch in value if not unicodedata.combining(ch)).lower()).strip("-")

colors = {p["id"]: colorsys.hsv_to_rgb((index * .61803398875) % 1, .42, .82) for index, p in enumerate(provinces, 1)}
# Tight mainland learning view. The southern padding includes the complete
# visible Cà Mau geometry; remote offshore islands remain intentionally omitted.
extent = (102.02, 110.76, 7.72, 23.52)
regional_source_extent = (102.0, 110.8, 8.0, 23.6)

# Keep one large label size throughout. Dense delta and metropolitan units use
# leader lines to nearby open space rather than smaller, harder-to-read text.
label_callouts = {
    "Hà Nội": (102.55, 21.15),
    "Bắc Ninh": (109.25, 21.55),
    "Hải Phòng": (109.25, 20.95),
    "Hưng Yên": (102.55, 20.55),
    "Ninh Bình": (109.25, 20.30),
    "Hồ Chí Minh": (109.65, 11.05),
    "Đồng Tháp": (103.05, 10.55),
    "Vĩnh Long": (109.65, 10.25),
    "Cần Thơ": (109.65, 9.65),
}

# A few compact metropolitan shapes need a deliberate point inside the region
# so their leader line does not appear to stop at a neighbouring border.
label_anchor_overrides = {
    "Hồ Chí Minh": (106.62, 10.82),
}

def visible_parts(province, view_extent=extent):
    result = []
    for ring in province["polygons"]:
        if len(ring) < 3:
            continue
        xs = [point[0] for point in ring]
        ys = [point[1] for point in ring]
        if max(xs) < view_extent[0] or min(xs) > view_extent[1] or max(ys) < view_extent[2] or min(ys) > view_extent[3]:
            continue
        result.append(ring)
    return result

def label_point(province, view_extent=extent):
    parts = visible_parts(province, view_extent)
    def area_and_centroid(ring):
        area2 = cx = cy = 0.0
        for (x1, y1), (x2, y2) in zip(ring, ring[1:] + ring[:1]):
            cross = x1 * y2 - x2 * y1
            area2 += cross
            cx += (x1 + x2) * cross
            cy += (y1 + y2) * cross
        if abs(area2) < 1e-12:
            return 0.0, (sum(x for x, _ in ring) / len(ring), sum(y for _, y in ring) / len(ring))
        return abs(area2) / 2, (cx / (3 * area2), cy / (3 * area2))
    _, point = max((area_and_centroid(ring) for ring in parts), key=lambda item: item[0])
    return point

def subset_extent(subset):
    points = [point for province in subset for ring in visible_parts(province, regional_source_extent) for point in ring]
    points.extend(label_callouts[province["name"]] for province in subset if province["name"] in label_callouts)
    return (min(x for x, _ in points) - .12, max(x for x, _ in points) + .12,
            min(y for _, y in points) - .12, max(y for _, y in points) + .12)

def draw_map(path: Path, target=None, labels=None, title="Vietnam — Provincial-level Divisions",
             subset=None, view_extent=extent, legend_columns=2, landscape=False,
             direct_canvas=False, question_title="Which provincial-level division is highlighted?",
             footer="Current 34-unit structure (effective 1 July 2025). Remote offshore islands omitted from this learning view."):
    displayed = provinces if subset is None else subset
    if direct_canvas:
        if landscape:
            fig = plt.figure(figsize=((16, 8) if labels == "name" else (12, 8)), facecolor="#f8f6f0")
            # Keep the key at the far right and give the geography the larger
            # share of the canvas.
            rect = [.015, .055, .68, .89] if labels == "name" else [.015, .05, .97, .90]
        else:
            fig = plt.figure(figsize=((13, 12) if labels == "name" else (8, 12)), facecolor="#f8f6f0")
            rect = [.015, .045, .66, .91] if labels == "name" else [.015, .045, .97, .91]
        ax = fig.add_axes(rect, facecolor="#f8f6f0")
    else:
        fig = plt.figure(figsize=((16, 8) if labels == "name" and landscape else (12, 8) if landscape else (12 if labels == "name" else 8, 12)), facecolor="#f8f6f0")
        ax = fig.add_axes(([.04, .10, .54, .80] if labels == "name" and landscape else [.06, .10, .88, .80] if landscape else [.04, .08, .54, .84] if labels == "name" else [.08, .08, .84, .84]), facecolor="#eaf1f3")
    ax.set_xlim(view_extent[:2]); ax.set_ylim(view_extent[2:]); ax.set_aspect("equal")
    ax.set_xticks([]); ax.set_yticks([])
    for spine in ax.spines.values():
        if direct_canvas:
            spine.set_visible(False)
        else:
            spine.set_edgecolor("#bcc9ca")
    for province in displayed:
        selected = province["id"] == target
        fill = "#e98255" if selected else (colors[province["id"]] if target is None else "#dce1df")
        edge = "#243e48" if selected else "#789096"
        for ring in visible_parts(province, view_extent):
            ax.add_patch(Polygon(ring, closed=True, facecolor=fill, edgecolor=edge, linewidth=1.25 if selected else .45))
    if labels:
        label_font_size = 24 if len(displayed) <= 8 else 17 if len(displayed) <= 15 else 14
        for index, province in enumerate(displayed, 1):
            x, y = label_point(province, view_extent)
            if len(displayed) <= 8:
                x, y = label_anchor_overrides.get(province["name"], (x, y))
            if not (view_extent[0] <= x <= view_extent[1] and view_extent[2] <= y <= view_extent[3]):
                continue
            if province["name"] in label_callouts:
                label_x, label_y = label_callouts[province["name"]]
                ax.annotate(str(index), xy=(x, y), xytext=(label_x, label_y),
                            ha="center", va="center", fontsize=label_font_size, weight="bold", color="#182f38",
                            bbox={"boxstyle":"round,pad=.18", "fc":"#f8f6f0", "ec":"none", "alpha":.92},
                            arrowprops={"arrowstyle":"-", "color":"#182f38", "linewidth":1.15,
                                        "shrinkA":4, "shrinkB":2}, zorder=20)
            else:
                ax.text(x, y, str(index), ha="center", va="center", fontsize=label_font_size, weight="bold",
                        color="#182f38", bbox={"boxstyle":"round,pad=.18", "fc":"#f8f6f0", "ec":"none", "alpha":.84},
                        zorder=20)
    if labels == "name":
        rows = (len(displayed) + legend_columns - 1) // legend_columns
        legend_x = .75 if landscape and legend_columns == 1 else .72 if legend_columns == 1 else .72
        legend_font_size = 16 if len(displayed) <= 8 else 12 if len(displayed) <= 15 else 9
        for index, province in enumerate(displayed, 1):
            column = (index - 1) // rows
            row = (index - 1) % rows
            fig.text(legend_x + column * .14, .86 - row * min(.065, .78 / max(rows - 1, 1)),
                     f"{index}. {province['name']}", ha="left", va="center",
                     fontsize=legend_font_size, weight="bold", color="#182f38")
    title_font_size = 19 if len(displayed) <= 15 else 17
    fig.text(.5, .97, title, ha="center", va="top", fontsize=title_font_size, color="#243e48", weight="bold")
    fig.text(.5, .025, footer,
             ha="center", fontsize=6.5, color="#60747b")
    fig.savefig(path, dpi=125)
    plt.close(fig)

draw_map(SPLIT / "reference.png", direct_canvas=True)
draw_map(DATA / "vietnam-provinces-numbered.png", labels="number", direct_canvas=True)
draw_map(DATA / "vietnam-provinces-named.png", labels="name", direct_canvas=True)

metadata = []
for province in provinces:
    stem = slug(province["name"])
    metadata.append({"id": f"{stem}-highlight", "answer": province["name"], "kind": province["type"], "code": province["id"]})
    draw_map(SPLIT / f"{stem}-question.png", target=province["id"], title="Which provincial-level division is highlighted?", direct_canvas=True)
    draw_map(SPLIT / f"{stem}-answer.png", target=province["id"], title=province["name"], direct_canvas=True)

(DATA / "provinces.json").write_text(json.dumps(metadata, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

regions = {
    "north": ("North", provinces[:15]),
    "central": ("Central", provinces[15:26]),
    "south": ("South", provinces[26:]),
}
for region_slug, (region_label, region_provinces) in regions.items():
    region_dir = DATA / "regions" / region_slug
    region_split = region_dir / "split"
    region_split.mkdir(parents=True, exist_ok=True)
    region_extent = subset_extent(region_provinces)
    region_title = f"Vietnam — {region_label}"
    landscape = region_slug in {"north", "south"}
    draw_map(region_split / "reference.png", title=region_title, subset=region_provinces,
             view_extent=region_extent, landscape=landscape, direct_canvas=True)
    draw_map(region_dir / "provinces-numbered.png", labels="number", title=region_title,
             subset=region_provinces, view_extent=region_extent, landscape=landscape, direct_canvas=True)
    draw_map(region_dir / "provinces-named.png", labels="name", title=region_title,
             subset=region_provinces, view_extent=region_extent, legend_columns=1, landscape=landscape,
             direct_canvas=True)
    region_metadata = []
    for province in region_provinces:
        stem = slug(province["name"])
        region_metadata.append({"id": f"{stem}-highlight", "answer": province["name"],
                                "kind": province["type"], "code": province["id"]})
        draw_map(region_split / f"{stem}-question.png", target=province["id"],
                 title="Which provincial-level division is highlighted?", subset=region_provinces,
                 view_extent=region_extent, landscape=landscape, direct_canvas=True)
        draw_map(region_split / f"{stem}-answer.png", target=province["id"], title=province["name"],
                 subset=region_provinces, view_extent=region_extent, landscape=landscape,
                 direct_canvas=True)
    (region_dir / "provinces.json").write_text(
        json.dumps(region_metadata, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

# Lingoland Vietnamese reuses the validated geometry and label placement, with
# only learner-facing artwork text localized. This keeps WtW and Lingoland maps
# visually identical while preserving independent packages and progress.
VI_DATA = DATA / "language-vietnamese"
VI_FOOTER = "Cơ cấu 34 đơn vị hiện hành (có hiệu lực từ ngày 1 tháng 7 năm 2025). Không hiển thị các đảo xa bờ trong bản đồ học tập này."
VI_QUESTION = "Đơn vị hành chính cấp tỉnh nào được tô màu?"
VI_DATA.mkdir(parents=True, exist_ok=True)
vi_split = VI_DATA / "split"
vi_split.mkdir(parents=True, exist_ok=True)
draw_map(vi_split / "reference.png", title="Việt Nam — Các đơn vị hành chính cấp tỉnh", direct_canvas=True, footer=VI_FOOTER)
draw_map(VI_DATA / "vietnam-provinces-numbered.png", labels="number", title="Việt Nam — Các đơn vị hành chính cấp tỉnh", direct_canvas=True, footer=VI_FOOTER)
draw_map(VI_DATA / "vietnam-provinces-named.png", labels="name", title="Việt Nam — Các đơn vị hành chính cấp tỉnh", direct_canvas=True, footer=VI_FOOTER)
for province in provinces:
    stem = slug(province["name"])
    draw_map(vi_split / f"{stem}-question.png", target=province["id"], title=VI_QUESTION, direct_canvas=True, footer=VI_FOOTER)
    draw_map(vi_split / f"{stem}-answer.png", target=province["id"], title=province["name"], direct_canvas=True, footer=VI_FOOTER)

vi_region_labels = {"north": "Miền Bắc", "central": "Miền Trung", "south": "Miền Nam"}
for region_slug, (_, region_provinces) in regions.items():
    region_dir = VI_DATA / "regions" / region_slug
    region_split = region_dir / "split"
    region_split.mkdir(parents=True, exist_ok=True)
    region_extent = subset_extent(region_provinces)
    region_title = f"Việt Nam — {vi_region_labels[region_slug]}"
    landscape = region_slug in {"north", "south"}
    draw_map(region_split / "reference.png", title=region_title, subset=region_provinces,
             view_extent=region_extent, landscape=landscape, direct_canvas=True, footer=VI_FOOTER)
    draw_map(region_dir / "provinces-numbered.png", labels="number", title=region_title,
             subset=region_provinces, view_extent=region_extent, landscape=landscape, direct_canvas=True, footer=VI_FOOTER)
    draw_map(region_dir / "provinces-named.png", labels="name", title=region_title,
             subset=region_provinces, view_extent=region_extent, legend_columns=1, landscape=landscape,
             direct_canvas=True, footer=VI_FOOTER)
    for province in region_provinces:
        stem = slug(province["name"])
        draw_map(region_split / f"{stem}-question.png", target=province["id"], title=VI_QUESTION,
                 subset=region_provinces, view_extent=region_extent, landscape=landscape,
                 direct_canvas=True, footer=VI_FOOTER)
        draw_map(region_split / f"{stem}-answer.png", target=province["id"], title=province["name"],
                 subset=region_provinces, view_extent=region_extent, landscape=landscape,
                 direct_canvas=True, footer=VI_FOOTER)
