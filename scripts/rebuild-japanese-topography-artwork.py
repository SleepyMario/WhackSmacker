#!/usr/bin/env python3
"""Build Lingoland-only Japanese artwork from the accepted geography maps."""

from pathlib import Path
from shutil import copy2
import json

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "packages/geography/data"
JAPAN = DATA / "japan-hard"
REGIONS = DATA / "japan-regions"
REVIEW = ROOT / "review-content/japanese"
CREAM = (248, 246, 240)
INK = (36, 62, 72)
MUTED = (96, 116, 123)
FONT = "/usr/share/fonts/source-han-sans/SourceHanSansJP-Regular.otf"
FONT_BOLD = "/usr/share/fonts/source-han-sans/SourceHanSansJP-Bold.otf"


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(FONT_BOLD if bold else FONT, size)


def localized_card(source: Path, destination: Path, title: str, note: str | None = None) -> None:
    image = Image.open(source).convert("RGB")
    draw = ImageDraw.Draw(image)
    width, height = image.size
    draw.rectangle((0, 0, width, round(height * .086)), fill=CREAM)
    draw.text((round(width * .04), round(height * .025)), title, font=font(max(22, round(width * .032))), fill=INK)
    draw.rectangle((0, round(height * .947), width, height), fill=CREAM)
    footer = "出典：国土地理院「地球地図日本」／dataofjapan。一部の離島は省略されています。"
    draw.text((round(width * .04), round(height * .971)), footer, font=font(max(8, round(width * .010))), fill=MUTED)
    if note is not None:
        draw.rectangle((round(width * .34), round(height * .845), width, round(height * .946)), fill=CREAM)
        draw.text((round(width * .39), round(height * .875)), note, font=font(max(12, round(width * .015))), fill=MUTED)
    destination.parent.mkdir(parents=True, exist_ok=True)
    image.save(destination, optimize=True)


def main() -> None:
    # Whole-country split artwork is rendered separately in Japanese and copied
    # into split-kanji before this script runs. Keep package media synchronized.
    prefectures = json.loads((JAPAN / "prefectures.json").read_text())
    for number, entry in enumerate(prefectures, 1):
        stem = entry["id"].removesuffix("-highlight")
        copy2(JAPAN / "split-kanji" / f"{stem}-answer.png", REVIEW / "prefectures-kanji/media" / f"{number:02}.png")

    # Overall regions need Japanese-only variants so Wandering the World keeps
    # its romanized artwork byte-for-byte unchanged.
    region_metadata = json.loads((REGIONS / "regions.json").read_text())
    japanese = ["北海道", "東北", "関東", "中部", "関西", "中国", "四国", "九州"]
    localized_card(REGIONS / "reference.png", REGIONS / "reference-kanji.png", "日本の地方", "沖縄の拡大図。北が上です。")
    localized_card(REGIONS / "japan-regions-numbered.png", REGIONS / "japan-regions-numbered-kanji.png", "日本の地方", "沖縄の拡大図。北が上です。")
    localized_card(REGIONS / "japan-regions-kanji.png", REGIONS / "japan-regions-kanji.png", "日本の地方", "沖縄の拡大図。北が上です。")
    for number, (entry, label) in enumerate(zip(region_metadata, japanese), 1):
        stem = entry["id"].removesuffix("-highlight")
        localized_card(REGIONS / f"{stem}-question.png", REGIONS / f"{stem}-question-kanji.png", "色が付いている地方はどこですか。", "沖縄の拡大図。北が上です。")
        localized_card(REGIONS / f"{stem}-answer-kanji.png", REGIONS / f"{stem}-answer-kanji.png", "色が付いている地方はどこですか。", "沖縄の拡大図。北が上です。")
        copy2(REGIONS / f"{stem}-answer-kanji.png", REVIEW / "regions-kanji/media" / f"{number:02}.png")

    # Regional maps already use the accepted direct-canvas geometry and have no
    # embedded English. Give number drills their own LL asset names and refresh
    # every regional 漢字 card image from the matching highlighted answer.
    prefectures_by_name = {entry["answer"]: entry for entry in prefectures}
    for entry in region_metadata:
        slug = entry["id"].removesuffix("-highlight")
        copy2(REGIONS / "prefecture-decks" / f"{slug}-numbered.png", REGIONS / "prefecture-decks" / f"{slug}-numbered-kanji.png")
        destination = REVIEW / f"prefectures-kanji-{slug}/media"
        for name in entry["prefectures"]:
            item = prefectures_by_name[name]
            number = prefectures.index(item) + 1
            stem = item["id"].removesuffix("-highlight")
            copy2(REGIONS / "prefecture-decks" / slug / "split-kanji" / f"{stem}-answer.png", destination / f"{number:02}.png")


if __name__ == "__main__":
    main()
