#!/usr/bin/env python3
"""Remove the generator's light checkerboard from standalone Naruto sprites.

The image generator currently returns RGB PNGs with a light checkerboard baked
behind otherwise clean character art. Flood only the connected, near-neutral
light background from the canvas edge so white costume details enclosed by the
character outline remain intact.

Requires Pillow. For local development:
  PYTHONPATH=.tools/pillow /Users/Admin/Desktop/dep/.venv/bin/python \
    scripts/make-naruto-pngs-transparent.py
"""

from collections import deque
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
GENERATED = ROOT / "assets" / "source" / "naruto" / "generated"
RUNTIME = GENERATED / "runtime"
STAGES = ("academy", "genin", "sage", "kcm", "sixpaths", "kurama")
ACTIONS = ("idle", "thinking", "working")


def is_light_neutral(pixel):
    r, g, b = pixel[:3]
    return min(r, g, b) >= 220 and max(r, g, b) - min(r, g, b) <= 22


def clear_background(path):
    source = Image.open(path).convert("RGBA")
    width, height = source.size
    pixels = source.load()
    visited = bytearray(width * height)
    queue = deque()

    def enqueue(x, y):
        index = y * width + x
        if not visited[index] and is_light_neutral(pixels[x, y]):
            visited[index] = 1
            queue.append((x, y))

    for x in range(width):
        enqueue(x, 0)
        enqueue(x, height - 1)
    for y in range(height):
        enqueue(0, y)
        enqueue(width - 1, y)

    while queue:
        x, y = queue.popleft()
        pixels[x, y] = (0, 0, 0, 0)
        if x:
            enqueue(x - 1, y)
        if x + 1 < width:
            enqueue(x + 1, y)
        if y:
            enqueue(x, y - 1)
        if y + 1 < height:
            enqueue(x, y + 1)

    source.save(path)
    RUNTIME.mkdir(parents=True, exist_ok=True)
    source.resize((512, 512), Image.Resampling.LANCZOS).save(RUNTIME / path.name)


def main():
    paths = [GENERATED / f"{stage}-{action}.png" for stage in STAGES for action in ACTIONS]
    missing = [path.name for path in paths if not path.exists()]
    if missing:
        raise SystemExit(f"missing generated inputs: {', '.join(missing)}")
    for path in paths:
        clear_background(path)
    print(f"made {len(paths)} Naruto sprite PNG(s) transparent")


if __name__ == "__main__":
    main()
