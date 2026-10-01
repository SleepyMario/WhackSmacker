import json
import os
import pty
import re
import select
import struct
import subprocess
import tempfile
import termios
import time
import fcntl
from pathlib import Path

ROOT = str(Path(__file__).resolve().parent.parent)
REGIONS = json.load(open(ROOT + "/packages/geography/data/japan-regions/regions.json"))
PREFECTURES = json.load(open(ROOT + "/packages/geography/data/japan-hard/prefectures.json"))

def start(command, data):
    master, slave = pty.openpty()
    fcntl.ioctl(slave, termios.TIOCSWINSZ, struct.pack("HHHH", 45, 120, 0, 0))
    env = dict(os.environ, TERM="xterm-kitty", KITTY_WINDOW_ID="test", XDG_DATA_HOME=data)
    source = f"Math.random=()=>0.999999999; process.argv=['node','dist/main.js','geography','{command}']; require('./dist/main.js');"
    process = subprocess.Popen(["node", "-e", source], cwd=ROOT, env=env, stdin=slave, stdout=slave, stderr=slave)
    os.close(slave)
    return process, master

def read_until(master, needle):
    end = time.time() + 20
    output = b""
    while time.time() < end:
        if select.select([master], [], [], .2)[0]:
            try: output += os.read(master, 65536)
            except OSError: break
            if needle in output: return output
    raise AssertionError(("missing", needle, output[-1500:]))

def finish(process, master):
    if process.poll() is None: process.kill()
    os.close(master)

for region in REGIONS:
    slug = region["id"].removesuffix("-highlight")
    cards = [card for card in PREFECTURES if card["answer"] in region["prefectures"]]

    easy_data = tempfile.mkdtemp(prefix=f"wsm-{slug}-easy-")
    process, master = start(f"japan-prefectures-{slug}-easy", easy_data)
    try:
        for card in cards:
            output = read_until(master, b"Press 1")
            plain = re.sub(r"\x1b\[[0-9;?]*[A-Za-z]", "", output.decode("utf-8", "ignore"))
            choices = dict(re.findall(r"([1-4])\. ([A-Za-z ]+)", plain))
            assert len(choices) == min(4, len(cards)), (slug, choices)
            assert set(value.strip() for value in choices.values()).issubset(set(region["prefectures"])), (slug, choices)
            answer_key = next(key for key, value in choices.items() if value.strip() == card["answer"])
            os.write(master, answer_key.encode())
            read_until(master, b"Correct!"); os.write(master, b" ")
        for number, card in enumerate(cards, 1):
            output = read_until(master, b"Enter the map number")
            assert ("Which number marks " + card["answer"] + "?").encode() in output
            os.write(master, (str(number) + "\r").encode())
            read_until(master, b"Correct!"); os.write(master, b" ")
        read_until(master, b"You scored 100%")
        os.write(master, b" "); process.wait(timeout=5); assert process.returncode == 0
    finally:
        finish(process, master)
    store = json.load(open(easy_data + "/whacksmacker/progress/wandering-the-world/review-progress.json"))
    assert len(store["events"]) == len(cards) * 2
    assert all(event["packageId"] == f"com.sleepymario.geography.japan-prefectures-{slug}-easy" for event in store["events"])

    hard_data = tempfile.mkdtemp(prefix=f"wsm-{slug}-hard-")
    process, master = start(f"japan-prefectures-{slug}-hard", hard_data)
    try:
        for card in cards:
            output = read_until(master, b"Type the romanized prefecture name")
            assert b"Which prefecture is highlighted?" in output
            os.write(master, (card["answer"] + "\r").encode())
            read_until(master, b"Correct!"); os.write(master, b" ")
        read_until(master, b"You scored 100%")
        os.write(master, b" "); process.wait(timeout=5); assert process.returncode == 0
    finally:
        finish(process, master)
    store = json.load(open(hard_data + "/whacksmacker/progress/wandering-the-world/review-progress.json"))
    assert len(store["events"]) == len(cards)
    assert all(event["packageId"] == f"com.sleepymario.geography.japan-prefectures-{slug}-hard" for event in store["events"])

    print(f"{slug}: {len(cards) * 2} Easy and {len(cards)} Hard questions passed.")

print("All 16 regional prefecture decks passed highlighted choices, local numbered maps, typed answers, scores, and isolated progress tests.")
