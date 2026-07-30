#!/usr/bin/env python3
"""Split Naruto working sheets into normalized transparent frames.

Equal-width slices cut through overlapping jutsu FX and leave neighbor-panel
corners in the next frame. This splitter mirrors cultivator:

1. chroma-key generator checkerboard (edge flood + large neutral pockets)
2. find content columns separated by transparent gaps
3. merge/split runs to the expected panel count
4. drop edge-touching fragment components
5. place every frame on a shared canvas with idle feet/base anchoring and one
   uniform scale so size/position do not jump between frames
"""

from __future__ import annotations

from collections import deque
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
GENERATED = ROOT / "assets" / "source" / "naruto" / "generated"
RUNTIME = GENERATED / "runtime"
CANVAS = 512
ALPHA = 16
MIN_RUN = 20
FRAGMENT_MAX_AREA_RATIO = 0.12

STAGES = ("academy", "genin", "sage", "kcm", "sixpaths", "kurama")
FRAME_SPECS = {
    # Academy 6-panel sheet has a near-empty "kunai only" panel at index 3; skip it.
    "academy": {"source": "academy-working-sheet.png", "expected": 6, "pick": (0, 2, 5)},
    # Kurama sheet chroma-keys into three natural content groups.
    "kurama": {"source": "kurama-working-sheet.png", "expected": 3, "pick": (0, 1, 2)},
    "genin": {"source": "genin-working-sheet-3f.png", "expected": 3, "pick": (0, 1, 2)},
    "sage": {"source": "sage-working-sheet-3f.png", "expected": 3, "pick": (0, 1, 2)},
    "kcm": {"source": "kcm-working-sheet-3f.png", "expected": 3, "pick": (0, 1, 2)},
    "sixpaths": {"source": "sixpaths-working-sheet-3f.png", "expected": 3, "pick": (0, 1, 2)},
}


def is_light_neutral(pixel):
    r, g, b = pixel[:3]
    return min(r, g, b) >= 220 and max(r, g, b) - min(r, g, b) <= 22


def erase_checkerboard(image):
    """Clear generator checkerboard from edges and large enclosed pockets."""
    image = image.convert("RGBA")
    width, height = image.size
    pixels = image.load()
    visited = bytearray(width * height)
    queue = deque()

    def enqueue(x, y):
        index = y * width + x
        if visited[index]:
            return
        if not is_light_neutral(pixels[x, y]):
            return
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

    # Second pass: large enclosed light-neutral pockets (checkerboard trapped
    # inside translucent FX rings) that edge-flood cannot reach.
    for y in range(height):
        for x in range(width):
            index = y * width + x
            if visited[index] or not is_light_neutral(pixels[x, y]):
                continue
            component = []
            queue.append((x, y))
            visited[index] = 1
            while queue:
                cx, cy = queue.popleft()
                component.append((cx, cy))
                for nx, ny in ((cx - 1, cy), (cx + 1, cy), (cx, cy - 1), (cx, cy + 1)):
                    if nx < 0 or ny < 0 or nx >= width or ny >= height:
                        continue
                    nindex = ny * width + nx
                    if visited[nindex]:
                        continue
                    if not is_light_neutral(pixels[nx, ny]):
                        continue
                    visited[nindex] = 1
                    queue.append((nx, ny))
            if len(component) >= 80:
                for cx, cy in component:
                    pixels[cx, cy] = (0, 0, 0, 0)
    return image


def column_opaque_count(image, x):
    height = image.size[1]
    pixels = image.load()
    return sum(1 for y in range(height) if pixels[x, y][3] > ALPHA)


def find_content_runs(image):
    width = image.size[0]
    runs = []
    x = 0
    while x < width:
        while x < width and column_opaque_count(image, x) == 0:
            x += 1
        if x >= width:
            break
        start = x
        while x < width and column_opaque_count(image, x) > 0:
            x += 1
        end = x
        if end - start >= MIN_RUN:
            runs.append([start, end])
    return runs


def equal_width_runs(width, count):
    panel_w = width / count
    return [
        [round(index * panel_w), round((index + 1) * panel_w)]
        for index in range(count)
    ]


def merge_runs_to_count(runs, expected):
    runs = [list(run) for run in runs]
    while len(runs) > expected:
        best_index = 0
        best_gap = None
        for index in range(len(runs) - 1):
            gap = runs[index + 1][0] - runs[index][1]
            width_sum = (runs[index][1] - runs[index][0]) + (
                runs[index + 1][1] - runs[index + 1][0]
            )
            # Prefer tiny gaps; break ties by merging the smaller pair first.
            score = (gap, width_sum)
            if best_gap is None or score < best_gap:
                best_gap = score
                best_index = index
        left = runs[best_index]
        right = runs[best_index + 1]
        runs[best_index] = [left[0], right[1]]
        del runs[best_index + 1]
    return runs


def connected_components(image):
    width, height = image.size
    pixels = image.load()
    visited = bytearray(width * height)
    components = []
    for y in range(height):
        for x in range(width):
            index = y * width + x
            if visited[index] or pixels[x, y][3] <= ALPHA:
                continue
            queue = deque([(x, y)])
            visited[index] = 1
            cells = []
            min_x = max_x = x
            min_y = max_y = y
            while queue:
                cx, cy = queue.popleft()
                cells.append((cx, cy))
                if cx < min_x:
                    min_x = cx
                if cx > max_x:
                    max_x = cx
                if cy < min_y:
                    min_y = cy
                if cy > max_y:
                    max_y = cy
                for nx, ny in ((cx - 1, cy), (cx + 1, cy), (cx, cy - 1), (cx, cy + 1)):
                    if nx < 0 or ny < 0 or nx >= width or ny >= height:
                        continue
                    nindex = ny * width + nx
                    if visited[nindex] or pixels[nx, ny][3] <= ALPHA:
                        continue
                    visited[nindex] = 1
                    queue.append((nx, ny))
            components.append(
                {
                    "cells": cells,
                    "area": len(cells),
                    "min_x": min_x,
                    "max_x": max_x,
                    "min_y": min_y,
                    "max_y": max_y,
                    "touches_left": min_x <= 1,
                    "touches_right": max_x >= width - 2,
                    "touches_top": min_y <= 1,
                    "touches_bottom": max_y >= height - 2,
                }
            )
    return components


def drop_edge_fragments(panel):
    """Remove small neighbor leftovers glued to panel edges."""
    panel = panel.copy()
    width, height = panel.size
    pixels = panel.load()
    components = connected_components(panel)
    if not components:
        return panel
    total = sum(component["area"] for component in components)
    main = max(components, key=lambda component: component["area"])
    for component in components:
        if component is main:
            continue
        ratio = component["area"] / max(total, 1)
        edge_touch = (
            component["touches_left"]
            or component["touches_right"]
            or component["touches_top"]
            or component["touches_bottom"]
        )
        if edge_touch and ratio <= FRAGMENT_MAX_AREA_RATIO:
            for x, y in component["cells"]:
                pixels[x, y] = (0, 0, 0, 0)
            continue
        # Thin vertical slivers on either side are almost always cut bleed.
        comp_w = component["max_x"] - component["min_x"] + 1
        if (
            (component["touches_left"] or component["touches_right"])
            and comp_w <= max(8, width // 18)
        ):
            for x, y in component["cells"]:
                pixels[x, y] = (0, 0, 0, 0)
    return panel


def content_bbox(image):
    return image.getchannel("A").point(lambda value: 255 if value > ALPHA else 0).getbbox()


def body_metrics(image):
    width, height = image.size
    pixels = image.load()
    row_count = [0] * height
    min_x, max_x = width, -1
    min_y, max_y = height, -1
    for y in range(height):
        count = 0
        for x in range(width):
            if pixels[x, y][3] > ALPHA:
                count += 1
                min_x = min(min_x, x)
                max_x = max(max_x, x)
                min_y = min(min_y, y)
                max_y = max(max_y, y)
        row_count[y] = count
    if max_x < min_x or max_y < min_y:
        return {"body_top": 0, "bottom": height - 1, "body_h": height, "base_cx": width / 2}

    content_w = max_x - min_x + 1
    wide_row = max(12, round(content_w * 0.14))
    body_top = min_y
    for y in range(min_y, max_y + 1):
        if row_count[y] >= wide_row:
            body_top = y
            break
    bottom = max_y
    body_h = max(1, bottom - body_top + 1)
    base_top = max(body_top, bottom - round(body_h * 0.45))
    sx = 0
    n = 0
    for y in range(base_top, bottom + 1):
        for x in range(min_x, max_x + 1):
            if pixels[x, y][3] > ALPHA:
                sx += x
                n += 1
    return {
        "body_top": body_top,
        "bottom": bottom,
        "body_h": body_h,
        "base_cx": sx / n if n else (min_x + max_x) / 2,
    }


def load_idle_anchor(stage):
    for candidate in (RUNTIME / f"{stage}-idle.png", GENERATED / f"{stage}-idle.png"):
        if not candidate.exists():
            continue
        image = Image.open(candidate).convert("RGBA")
        metrics = body_metrics(image)
        return {
            "canvas": max(image.size),
            "bottom": metrics["bottom"],
            "body_h": metrics["body_h"],
            "base_cx": metrics["base_cx"],
            "path": candidate,
        }
    return None


def place_on_canvas(panel, anchor, scale, canvas=CANVAS):
    dst_w = max(1, round(panel.size[0] * scale))
    dst_h = max(1, round(panel.size[1] * scale))
    scaled = panel.resize((dst_w, dst_h), Image.Resampling.LANCZOS)
    scaled_metrics = body_metrics(scaled)
    if anchor:
        dest_x = round(anchor["base_cx"] - scaled_metrics["base_cx"])
        dest_y = round(anchor["bottom"] - scaled_metrics["bottom"])
    else:
        dest_x = round((canvas - dst_w) / 2)
        dest_y = round(canvas - scaled_metrics["bottom"] - 24)
    out = Image.new("RGBA", (canvas, canvas), (0, 0, 0, 0))
    out.alpha_composite(scaled, (dest_x, dest_y))
    return out


def resolve_runs(stage, sheet):
    spec = FRAME_SPECS[stage]
    pick_count = len(spec["pick"])
    runs = find_content_runs(sheet)
    # Prefer the natural panel count when it already matches the output frame count.
    if len(runs) == pick_count:
        return runs, "gap"
    if len(runs) > spec["expected"]:
        runs = merge_runs_to_count(runs, spec["expected"])
        return runs, f"gap-merge:{len(runs)}"
    if len(runs) == spec["expected"]:
        return runs, "gap"
    print(
        f"  {stage}: gap split found {len(runs)} runs, "
        f"fallback equal-width {spec['expected']}"
    )
    return equal_width_runs(sheet.size[0], spec["expected"]), "equal"


def extract_panels(stage, sheet):
    spec = FRAME_SPECS[stage]
    runs, mode = resolve_runs(stage, sheet)
    panels = []
    for index in spec["pick"]:
        start, end = runs[index]
        panel = drop_edge_fragments(sheet.crop((start, 0, end, sheet.size[1])))
        bbox = content_bbox(panel)
        if not bbox:
            raise ValueError(f"{stage}: empty panel {index} after fragment cleanup")
        panels.append(panel.crop(bbox))
    return panels, mode


def split_stage(stage):
    spec = FRAME_SPECS[stage]
    source = GENERATED / spec["source"]
    sheet = erase_checkerboard(Image.open(source))
    panels, mode = extract_panels(stage, sheet)
    anchor = load_idle_anchor(stage)
    body_heights = sorted(body_metrics(panel)["body_h"] for panel in panels)
    mid = len(body_heights) // 2
    median_body_h = (
        body_heights[mid]
        if len(body_heights) % 2
        else (body_heights[mid - 1] + body_heights[mid]) / 2
    )
    if anchor:
        idle_scale = CANVAS / anchor["canvas"]
        target_body_h = anchor["body_h"] * idle_scale
        scale = target_body_h / median_body_h
        place_anchor = {
            "bottom": anchor["bottom"] * idle_scale,
            "body_h": target_body_h,
            "base_cx": anchor["base_cx"] * idle_scale,
        }
    else:
        scale = (CANVAS * 0.72) / median_body_h
        place_anchor = None

    RUNTIME.mkdir(parents=True, exist_ok=True)
    for stale in RUNTIME.glob(f"{stage}-working-*.png"):
        stale.unlink()

    for index, panel in enumerate(panels, start=1):
        placed = place_on_canvas(panel, place_anchor, scale, CANVAS)
        # Final pass after placement: clear any residual checkerboard pockets.
        placed = erase_checkerboard(placed)
        placed.save(RUNTIME / f"{stage}-working-{index}.png")
    print(f"  {stage}: {len(panels)} frames via {mode}+idle-anchor={bool(anchor)}")


def main():
    missing = [
        stage for stage in STAGES
        if not (GENERATED / FRAME_SPECS[stage]["source"]).exists()
    ]
    if missing:
        raise SystemExit(f"missing working sheets: {', '.join(missing)}")
    print("splitting Naruto working sheets with gap detection + feet anchoring")
    for stage in STAGES:
        split_stage(stage)
    print(f"split {len(STAGES) * 3} transparent Naruto working frames")


if __name__ == "__main__":
    main()
