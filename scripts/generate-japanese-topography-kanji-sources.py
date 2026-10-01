import csv
import json
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BASE = ROOT / "review-content/japanese/prefectures-kanji"
MAPS = ROOT / "packages/geography/data/japan-regions"
REGIONS = json.loads((MAPS / "regions.json").read_text())
PREFECTURES = list(csv.DictReader((BASE / "sources/prefectures.tsv").open(), delimiter="\t"))
PREFECTURE_METADATA = json.loads((ROOT / "packages/geography/data/japan-hard/prefectures.json").read_text())


def write_prefecture_deck(slug: str, label: str, names: list[str]) -> None:
    destination = ROOT / f"review-content/japanese/prefectures-kanji-{slug}"
    if destination.exists():
        shutil.rmtree(destination)
    (destination / "sources").mkdir(parents=True)
    (destination / "media").mkdir()
    selected_numbers = {index for index, row in enumerate(PREFECTURE_METADATA, 1) if row["answer"] in names}
    source_rows = [row for row in PREFECTURES if int(row["number"]) in selected_numbers]
    with (destination / "sources/prefectures.tsv").open("w", newline="") as output:
        writer = csv.DictWriter(output, fieldnames=["number", "kanji", "hiragana"], delimiter="\t")
        writer.writeheader(); writer.writerows(source_rows)
    with (BASE / "cards.tsv").open(newline="") as source, (destination / "cards.tsv").open("w", newline="") as output:
        reader = csv.reader(source, delimiter="\t"); writer = csv.writer(output, delimiter="\t", lineterminator="\n")
        header = next(reader); writer.writerow(header)
        for row in reader:
            number = int(row[3])
            if number not in selected_numbers: continue
            row[1] = f"Prefectures - {label} - 漢字"
            writer.writerow(row)
    for number in selected_numbers:
        shutil.copy2(BASE / f"media/{number:02}.png", destination / f"media/{number:02}.png")
    (destination / "README.md").write_text(
        f"# Prefectures - {label} - 漢字\n\n"
        f"{len(selected_numbers)} prefecture names in kanji and hiragana; {len(selected_numbers) * 2} precomposed bidirectional cards. "
        "This is the regional subset of Prefectures - All - 漢字 and uses the same card format and highlighted-prefecture answer artwork.\n"
    )


def write_regions_deck() -> None:
    destination = ROOT / "review-content/japanese/regions-kanji"
    if destination.exists():
        shutil.rmtree(destination)
    (destination / "sources").mkdir(parents=True)
    (destination / "media").mkdir()
    readings = [
        ("北海道", "ほっかいどう"), ("東北", "とうほく"), ("関東", "かんとう"), ("中部", "ちゅうぶ"),
        ("関西", "かんさい"), ("中国", "ちゅうごく"), ("四国", "しこく"), ("九州", "きゅうしゅう")
    ]
    header = ["card_id", "deck", "kind", "source_chapter", "prompt_language", "answer_language", "prompt", "accepted_answers", "distractors", "explanation", "lexical_ids", "grammar_ids", "geographic_ids", "provenance_path", "provenance_locator", "provenance_evidence", "examples", "tags"]
    rows = []
    for number, ((kanji, hiragana), region) in enumerate(zip(readings, REGIONS), 1):
        shutil.copy2(MAPS / f"{region['id'].removesuffix('-highlight')}-answer-kanji.png", destination / f"media/{number:02}.png")
        evidence = f"{kanji} = {hiragana}"
        for direction, prompt_language, answer_language, prompt, answer in (
            ("reading", "ja", "ja-Kana", kanji, hiragana),
            ("kanji", "ja-Kana", "ja", hiragana, kanji),
        ):
            answer_with_map = f"{answer}\n\n![Highlighted region](media/{number:02}.png)"
            rows.append([
                f"ja-region/{number:02}/{direction}", "Prefectures - Regions - 漢字", "vocabulary", str(number),
                prompt_language, answer_language, prompt, json.dumps([answer_with_map], ensure_ascii=False), "[]", "",
                json.dumps([f"ja.region.{number:02}"]), "[]", "[]", "sources/regions.tsv", f"Region {number:02}", evidence,
                "[]", json.dumps(["japanese", "regions", direction])
            ])
    with (destination / "cards.tsv").open("w", newline="") as output:
        writer = csv.writer(output, delimiter="\t", lineterminator="\n"); writer.writerow(header); writer.writerows(rows)
    with (destination / "sources/regions.tsv").open("w", newline="") as output:
        writer = csv.writer(output, delimiter="\t", lineterminator="\n"); writer.writerow(["number", "kanji", "hiragana"])
        for number, (kanji, hiragana) in enumerate(readings, 1): writer.writerow([number, kanji, hiragana])
    (destination / "README.md").write_text(
        "# Prefectures - Regions - 漢字\n\nEight Japanese region names in kanji and hiragana; 16 precomposed bidirectional cards. "
        "The format matches Prefectures - All - 漢字 and includes highlighted-region artwork on each answer.\n"
    )


for region, label in zip(REGIONS, ["北海道", "東北", "関東", "中部", "関西", "中国", "四国", "九州"]):
    write_prefecture_deck(region["id"].removesuffix("-highlight"), label, region["prefectures"])
write_regions_deck()
print("Generated nine Japanese Topography 漢字 source decks.")
