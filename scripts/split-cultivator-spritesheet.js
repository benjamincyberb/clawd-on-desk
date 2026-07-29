"use strict";

/**
 * Split a horizontal cultivator working spritesheet into 6 equal-size full frames.
 * Finds content columns separated by transparent gaps (not hard equal-width slices),
 * then bottom-centers each panel into a shared canvas so playback does not jitter.
 *
 * Input:  assets/source/cultivator/generated/{stage}-working-sheet.png
 * Output: assets/source/cultivator/generated/{stage}-working-1..6.png
 */

const fs = require("node:fs");
const path = require("node:path");
const { decodePng, encodePng, processFile } = require("./make-cultivator-pngs-transparent");

const REPO_ROOT = path.resolve(__dirname, "..");
const GENERATED_DIR = path.join(REPO_ROOT, "assets", "source", "cultivator", "generated");
const EXPECTED_FRAMES = 6;
const MIN_GAP = 4;
const ALPHA_THRESHOLD = 16;
const PAD = 8;

function columnHasContent(rgba, width, height, x) {
  for (let y = 0; y < height; y += 1) {
    if (rgba[(y * width + x) * 4 + 3] > ALPHA_THRESHOLD) return true;
  }
  return false;
}

function findContentRuns(rgba, width, height, minGap = MIN_GAP) {
  const runs = [];
  let i = 0;
  while (i < width) {
    while (i < width && !columnHasContent(rgba, width, height, i)) i += 1;
    if (i >= width) break;
    const start = i;
    while (i < width && columnHasContent(rgba, width, height, i)) i += 1;
    const end = i; // exclusive
    // Skip tiny noise blobs
    if (end - start >= 8) runs.push({ start, end });
    // Consume gap (already at transparent); keep consuming until next content
    let gap = 0;
    while (i < width && !columnHasContent(rgba, width, height, i)) {
      i += 1;
      gap += 1;
    }
    // If gap is tiny between two runs, they may still be separate characters;
    // we already closed the previous run at first transparent column.
    void gap;
    void minGap;
  }
  return runs;
}

function contentBBox(rgba, width, height, x0, x1) {
  let minX = x1;
  let maxX = x0;
  let minY = height;
  let maxY = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      if (rgba[(y * width + x) * 4 + 3] > ALPHA_THRESHOLD) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < minX || maxY < minY) {
    return { minX: x0, minY: 0, maxX: x1 - 1, maxY: height - 1 };
  }
  return { minX, minY, maxX, maxY };
}

function nearestNeighborScale(src, srcW, srcH, dstW, dstH) {
  const out = Buffer.alloc(dstW * dstH * 4);
  for (let y = 0; y < dstH; y += 1) {
    const sy = Math.min(srcH - 1, Math.floor((y * srcH) / dstH));
    for (let x = 0; x < dstW; x += 1) {
      const sx = Math.min(srcW - 1, Math.floor((x * srcW) / dstW));
      const si = (sy * srcW + sx) * 4;
      const di = (y * dstW + x) * 4;
      out[di] = src[si];
      out[di + 1] = src[si + 1];
      out[di + 2] = src[si + 2];
      out[di + 3] = src[si + 3];
    }
  }
  return out;
}

function extractPanelRaw(rgba, srcWidth, srcHeight, run) {
  const box = contentBBox(rgba, srcWidth, srcHeight, run.start, run.end);
  const contentW = box.maxX - box.minX + 1;
  const contentH = box.maxY - box.minY + 1;
  const out = Buffer.alloc(contentW * contentH * 4);
  for (let y = 0; y < contentH; y += 1) {
    for (let x = 0; x < contentW; x += 1) {
      const si = ((box.minY + y) * srcWidth + (box.minX + x)) * 4;
      const di = (y * contentW + x) * 4;
      out[di] = rgba[si];
      out[di + 1] = rgba[si + 1];
      out[di + 2] = rgba[si + 2];
      out[di + 3] = rgba[si + 3];
    }
  }
  return { width: contentW, height: contentH, rgba: out };
}

/**
 * Body-anchored metrics for a standalone image. Locks scale on the seated BODY
 * (head-top → seat-bottom), NOT the full alpha bbox: a raised mallet is a thin,
 * tall protrusion that would otherwise inflate the height and shrink the character.
 * The mallet is allowed to extend into the transparent padding.
 */
function bodyMetrics(img) {
  const { width: W, height: H, rgba } = img;
  const rowCount = new Array(H).fill(0);
  let minX = W;
  let maxX = -1;
  let minY = H;
  let maxY = -1;
  for (let y = 0; y < H; y += 1) {
    let c = 0;
    for (let x = 0; x < W; x += 1) {
      if (rgba[(y * W + x) * 4 + 3] > ALPHA_THRESHOLD) {
        c += 1;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
    rowCount[y] = c;
  }
  if (maxX < minX || maxY < minY) {
    return { bodyTopY: 0, bottomY: H - 1, bodyH: H, baseCenterX: W / 2 };
  }
  const contentW = maxX - minX + 1;
  // First row (top→down) that is "wide" marks the head, skipping the thin mallet column.
  const wideRow = Math.max(12, Math.round(contentW * 0.14));
  let bodyTopY = minY;
  for (let y = minY; y <= maxY; y += 1) {
    if (rowCount[y] >= wideRow) {
      bodyTopY = y;
      break;
    }
  }
  const bottomY = maxY;
  const bodyH = Math.max(1, bottomY - bodyTopY + 1);
  // Horizontal anchor = center of mass of the seated base (bottom 45% of the body),
  // which stays put even while the arm swings.
  const baseTop = Math.max(bodyTopY, bottomY - Math.round(bodyH * 0.45));
  let sx = 0;
  let n = 0;
  for (let y = baseTop; y <= bottomY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      if (rgba[(y * W + x) * 4 + 3] > ALPHA_THRESHOLD) {
        sx += x;
        n += 1;
      }
    }
  }
  const baseCenterX = n ? sx / n : (minX + maxX) / 2;
  return { bodyTopY, bottomY, bodyH, baseCenterX };
}

/**
 * Place panel content onto a square canvas matching idle's footprint so idle→working
 * does not jump in scale/position inside the shared SVG viewBox.
 *
 * Scale is a SINGLE value shared by all frames of the sheet (caller passes the same
 * `scale`), so per-frame body-detection noise can never make one frame bigger/smaller
 * than another. Only the seat baseline + base center are aligned per frame. The raised
 * mallet extends into the top padding instead of shrinking the body.
 */
function placeOnIdleAnchoredCanvas(panel, idleAnchor, scale) {
  const canvas = idleAnchor.canvas;
  const m = bodyMetrics(panel);
  const dstW = Math.max(1, Math.round(panel.width * scale));
  const dstH = Math.max(1, Math.round(panel.height * scale));
  const scaled = nearestNeighborScale(panel.rgba, panel.width, panel.height, dstW, dstH);
  // Map this frame's baseline + base-center onto idle's, so all frames register 1:1.
  const destX = Math.round(idleAnchor.baseCenterX - m.baseCenterX * scale);
  const destY = Math.round(idleAnchor.bottomY - m.bottomY * scale);
  const out = Buffer.alloc(canvas * canvas * 4);
  for (let y = 0; y < dstH; y += 1) {
    const cy = destY + y;
    if (cy < 0 || cy >= canvas) continue;
    for (let x = 0; x < dstW; x += 1) {
      const si = (y * dstW + x) * 4;
      if (scaled[si + 3] === 0) continue;
      const cx = destX + x;
      if (cx < 0 || cx >= canvas) continue;
      const di = (cy * canvas + cx) * 4;
      out[di] = scaled[si];
      out[di + 1] = scaled[si + 1];
      out[di + 2] = scaled[si + 2];
      out[di + 3] = scaled[si + 3];
    }
  }
  return { width: canvas, height: canvas, rgba: out };
}

function loadIdleAnchor(stageId) {
  const candidates = [
    path.join(REPO_ROOT, "assets", "source", "cultivator", "candidates", `${stageId}-idle.png`),
    path.join(GENERATED_DIR, `${stageId}-idle.png`),
  ];
  for (const idlePath of candidates) {
    if (!fs.existsSync(idlePath)) continue;
    const { width, height, rgba } = decodePng(fs.readFileSync(idlePath));
    const box = contentBBox(rgba, width, height, 0, width);
    const m = bodyMetrics({ width, height, rgba });
    return {
      canvas: Math.max(width, height),
      contentW: box.maxX - box.minX + 1,
      contentH: box.maxY - box.minY + 1,
      bottomY: box.maxY,
      topY: box.minY,
      bodyH: m.bodyH,
      bodyTopY: m.bodyTopY,
      baseCenterX: m.baseCenterX,
      path: idlePath,
    };
  }
  return null;
}

function extractNormalized(rgba, srcWidth, srcHeight, run, canvasW, canvasH) {
  const box = contentBBox(rgba, srcWidth, srcHeight, run.start, run.end);
  const contentW = box.maxX - box.minX + 1;
  const contentH = box.maxY - box.minY + 1;
  const out = Buffer.alloc(canvasW * canvasH * 4);
  const destX = Math.max(0, Math.floor((canvasW - contentW) / 2));
  const destY = Math.max(0, canvasH - contentH - PAD);
  for (let y = 0; y < contentH; y += 1) {
    for (let x = 0; x < contentW; x += 1) {
      const si = ((box.minY + y) * srcWidth + (box.minX + x)) * 4;
      const di = ((destY + y) * canvasW + (destX + x)) * 4;
      out[di] = rgba[si];
      out[di + 1] = rgba[si + 1];
      out[di + 2] = rgba[si + 2];
      out[di + 3] = rgba[si + 3];
    }
  }
  return { width: canvasW, height: canvasH, rgba: out };
}

function equalWidthRuns(width, count = EXPECTED_FRAMES) {
  const panelW = Math.floor(width / count);
  return Array.from({ length: count }, (_, i) => ({
    start: i * panelW,
    end: i === count - 1 ? width : (i + 1) * panelW,
  }));
}

function splitWorkingSheet(stageId, options = {}) {
  const sheetPath =
    options.sheetPath || path.join(GENERATED_DIR, `${stageId}-working-sheet.png`);
  if (!fs.existsSync(sheetPath)) {
    throw new Error(`missing working sheet: ${sheetPath}`);
  }
  // Chroma-key first so gaps are truly transparent
  processFile(sheetPath);
  const { width, height, rgba } = decodePng(fs.readFileSync(sheetPath));
  let runs = findContentRuns(rgba, width, height);
  let mode = "gap";
  if (runs.length !== EXPECTED_FRAMES) {
    console.warn(
      `${stageId}: gap split found ${runs.length} runs, falling back to equal-width ${EXPECTED_FRAMES}`
    );
    runs = equalWidthRuns(width, EXPECTED_FRAMES);
    mode = "equal";
  }

  let maxW = 0;
  let maxH = 0;
  for (const run of runs) {
    const box = contentBBox(rgba, width, height, run.start, run.end);
    maxW = Math.max(maxW, box.maxX - box.minX + 1);
    maxH = Math.max(maxH, box.maxY - box.minY + 1);
  }

  const idleAnchor = options.idleAnchor !== false ? loadIdleAnchor(stageId) : null;
  let canvasW;
  let canvasH;
  let placeMode = mode;
  if (idleAnchor) {
    canvasW = idleAnchor.canvas;
    canvasH = idleAnchor.canvas;
    placeMode = `${mode}+idle-anchor`;
  } else {
    canvasW = maxW + PAD * 2;
    // Use content height only — do NOT keep the full sheet height (often ~1024),
    // or characters become tiny when fitted into the square pet viewBox.
    canvasH = maxH + PAD * 2;
  }

  // Pre-extract raw panels and derive ONE uniform scale for the whole sheet.
  // The generated 6 panels already share the same character size, so we must not
  // rescale them relative to each other — that is exactly what produced the
  // "一大一小" flicker. We take the median body height across frames (robust to a
  // couple of bad head-top detections on raised-mallet frames) and lock every
  // frame to idle with that single factor.
  const rawPanels = idleAnchor
    ? runs.map((run) => extractPanelRaw(rgba, width, height, run))
    : null;
  let uniformScale = 1;
  if (idleAnchor) {
    const bodyHeights = rawPanels.map((p) => bodyMetrics(p).bodyH).sort((a, b) => a - b);
    const mid = Math.floor(bodyHeights.length / 2);
    const medianBodyH =
      bodyHeights.length % 2
        ? bodyHeights[mid]
        : (bodyHeights[mid - 1] + bodyHeights[mid]) / 2;
    uniformScale = idleAnchor.bodyH / medianBodyH;
  }

  const outputs = [];
  for (let i = 0; i < EXPECTED_FRAMES; i += 1) {
    let panel;
    if (idleAnchor) {
      panel = placeOnIdleAnchoredCanvas(rawPanels[i], idleAnchor, uniformScale);
    } else {
      panel = extractNormalized(rgba, width, height, runs[i], canvasW, canvasH);
    }
    const outPath = path.join(GENERATED_DIR, `${stageId}-working-${i + 1}.png`);
    fs.writeFileSync(outPath, encodePng(panel.width, panel.height, panel.rgba));
    outputs.push(outPath);
  }
  return { outputs, runs, canvasW, canvasH, mode: placeMode, idleAnchor: !!idleAnchor };
}

function main(argv = process.argv.slice(2)) {
  const stageArg = argv.find((a) => a.startsWith("--stage="));
  const stages = stageArg
    ? stageArg.slice("--stage=".length).split(",").filter(Boolean)
    : ["mortal", "adept", "novice", "arhat", "bodhisattva", "buddha"];
  for (const stageId of stages) {
    const sheetPath = path.join(GENERATED_DIR, `${stageId}-working-sheet.png`);
    if (!fs.existsSync(sheetPath)) {
      console.warn(`skip ${stageId}: missing ${path.relative(REPO_ROOT, sheetPath)}`);
      continue;
    }
    const { outputs, canvasW, canvasH, mode } = splitWorkingSheet(stageId);
    console.log(
      `split ${stageId}: ${outputs.length} frames → ${canvasW}x${canvasH} (${mode})`
    );
  }
}

if (require.main === module) main();

module.exports = {
  splitWorkingSheet,
  findContentRuns,
  equalWidthRuns,
  EXPECTED_FRAMES,
  GENERATED_DIR,
};
