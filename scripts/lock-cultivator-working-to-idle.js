"use strict";

/**
 * @deprecated Do NOT use. Regenerates cause face cuts / ghosting.
 * Prefer regenerating working sheets under cultivator-asset-standard constraints.
 * See docs/guides/cultivator-asset-pipeline.md (废弃补救).
 *
 * Lock working frames to the confirmed idle portrait.
 * Upper body / halo / clouds stay from idle; only a lower action ROI
 * (hands + wooden fish + mallet) is taken from the AI working frame.
 *
 * Usage (deprecated):
 *   node scripts/lock-cultivator-working-to-idle.js --stage=arhat
 */

const fs = require("node:fs");
const path = require("node:path");
const { decodePng, encodePng, processFile } = require("./make-cultivator-pngs-transparent");

const REPO_ROOT = path.resolve(__dirname, "..");
const GENERATED_DIR = path.join(REPO_ROOT, "assets", "source", "cultivator", "generated");
const CANDIDATES_DIR = path.join(REPO_ROOT, "assets", "source", "cultivator", "candidates");
const FRAME_COUNT = 6;
const ALPHA = 16;

if (require.main === module) {
  console.warn(
    "[DEPRECATED] lock-cultivator-working-to-idle.js — regenerate working sheets instead; see docs/guides/cultivator-asset-pipeline.md"
  );
}

function contentBBox(rgba, width, height) {
  let minX = width;
  let maxX = 0;
  let minY = height;
  let maxY = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (rgba[(y * width + x) * 4 + 3] > ALPHA) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < minX || maxY < minY) {
    return { minX: 0, minY: 0, maxX: width - 1, maxY: height - 1 };
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

function extractContent(rgba, width, height, box) {
  const w = box.maxX - box.minX + 1;
  const h = box.maxY - box.minY + 1;
  const out = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const si = ((box.minY + y) * width + (box.minX + x)) * 4;
      const di = (y * w + x) * 4;
      out[di] = rgba[si];
      out[di + 1] = rgba[si + 1];
      out[di + 2] = rgba[si + 2];
      out[di + 3] = rgba[si + 3];
    }
  }
  return { width: w, height: h, rgba: out };
}

function placeContentOnCanvas(content, canvas, destX, destY) {
  const out = Buffer.alloc(canvas * canvas * 4);
  for (let y = 0; y < content.height; y += 1) {
    const ty = destY + y;
    if (ty < 0 || ty >= canvas) continue;
    for (let x = 0; x < content.width; x += 1) {
      const tx = destX + x;
      if (tx < 0 || tx >= canvas) continue;
      const si = (y * content.width + x) * 4;
      if (content.rgba[si + 3] <= ALPHA) continue;
      const di = (ty * canvas + tx) * 4;
      out[di] = content.rgba[si];
      out[di + 1] = content.rgba[si + 1];
      out[di + 2] = content.rgba[si + 2];
      out[di + 3] = content.rgba[si + 3];
    }
  }
  return out;
}

function normalizeToIdleCanvas(pngPath, idleMeta) {
  processFile(pngPath);
  const { width, height, rgba } = decodePng(fs.readFileSync(pngPath));
  const box = contentBBox(rgba, width, height);
  const content = extractContent(rgba, width, height, box);
  const scale = idleMeta.contentH / content.height;
  let dstW = Math.max(1, Math.round(content.width * scale));
  let dstH = Math.max(1, Math.round(content.height * scale));
  if (dstW > idleMeta.contentW * 1.15) {
    const fit = (idleMeta.contentW * 1.15) / dstW;
    dstW = Math.max(1, Math.round(dstW * fit));
    dstH = Math.max(1, Math.round(dstH * fit));
  }
  const scaled = {
    width: dstW,
    height: dstH,
    rgba: nearestNeighborScale(content.rgba, content.width, content.height, dstW, dstH),
  };
  const destX = Math.floor((idleMeta.canvas - dstW) / 2);
  const destY = idleMeta.bottomY - dstH + 1;
  return {
    width: idleMeta.canvas,
    height: idleMeta.canvas,
    rgba: placeContentOnCanvas(scaled, idleMeta.canvas, destX, destY),
  };
}

function colorDiff(a, ai, b, bi) {
  return Math.abs(a[ai] - b[bi])
    + Math.abs(a[ai + 1] - b[bi + 1])
    + Math.abs(a[ai + 2] - b[bi + 2]);
}

/**
 * Exact idle base. Only paste high-difference working pixels in the lower
 * action ROI (woodfish / mallet). Prayer hands are covered by sampling
 * nearby idle robe pixels so the clasped pose does not ghost.
 */
function sampleIdleNeighbor(idleRgba, width, height, x, y) {
  // Prefer pixels above/beside (robe/chest), skip transparent.
  const offsets = [
    [0, -6], [0, -12], [-8, -4], [8, -4], [-12, 0], [12, 0], [0, 8],
  ];
  for (const [dx, dy] of offsets) {
    const nx = x + dx;
    const ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
    const i = (ny * width + nx) * 4;
    if (idleRgba[i + 3] > ALPHA) {
      return [idleRgba[i], idleRgba[i + 1], idleRgba[i + 2], idleRgba[i + 3]];
    }
  }
  return null;
}

function coverPrayerHands(out, idleRgba, width, height, idleBox) {
  const contentH = idleBox.maxY - idleBox.minY + 1;
  const contentW = idleBox.maxX - idleBox.minX + 1;
  const handsTop = idleBox.minY + Math.floor(contentH * 0.50);
  const handsBottom = idleBox.minY + Math.floor(contentH * 0.68);
  const handsLeft = idleBox.minX + Math.floor(contentW * 0.32);
  const handsRight = idleBox.minX + Math.floor(contentW * 0.68);
  const cx = (handsLeft + handsRight) / 2;
  const cy = (handsTop + handsBottom) / 2;
  const rx = (handsRight - handsLeft) / 2;
  const ry = (handsBottom - handsTop) / 2;

  for (let y = handsTop; y <= handsBottom; y += 1) {
    for (let x = handsLeft; x <= handsRight; x += 1) {
      const nx = (x - cx) / rx;
      const ny = (y - cy) / ry;
      if (nx * nx + ny * ny > 1) continue;
      const i = (y * width + x) * 4;
      if (idleRgba[i + 3] <= ALPHA) continue;
      const sample = sampleIdleNeighbor(idleRgba, width, height, x, y - 10);
      if (!sample) continue;
      out[i] = sample[0];
      out[i + 1] = sample[1];
      out[i + 2] = sample[2];
      out[i + 3] = sample[3];
    }
  }
}

function lockFrame(idleRgba, workingRgba, width, height, idleBox) {
  const out = Buffer.from(idleRgba);
  coverPrayerHands(out, idleRgba, width, height, idleBox);

  const contentH = idleBox.maxY - idleBox.minY + 1;
  const contentW = idleBox.maxX - idleBox.minX + 1;
  const actionTop = idleBox.minY + Math.floor(contentH * 0.50);
  const actionLeft = idleBox.minX + Math.floor(contentW * 0.08);
  const actionRight = idleBox.minX + Math.floor(contentW * 0.80);
  const DIFF_MIN = 90;

  for (let y = actionTop; y <= idleBox.maxY && y < height; y += 1) {
    for (let x = actionLeft; x <= actionRight && x < width; x += 1) {
      const i = (y * width + x) * 4;
      if (workingRgba[i + 3] <= ALPHA) continue;
      const idleEmpty = idleRgba[i + 3] <= ALPHA;
      const diff = colorDiff(workingRgba, i, idleRgba, i);
      // High threshold: only new props (woodfish/mallet/arm), not redrawn robe.
      if (!idleEmpty && diff < DIFF_MIN) continue;
      out[i] = workingRgba[i];
      out[i + 1] = workingRgba[i + 1];
      out[i + 2] = workingRgba[i + 2];
      out[i + 3] = workingRgba[i + 3];
    }
  }
  return out;
}

function loadIdle(stageId) {
  const idlePath = path.join(CANDIDATES_DIR, `${stageId}-idle.png`);
  if (!fs.existsSync(idlePath)) {
    throw new Error(`missing idle: ${idlePath}`);
  }
  processFile(idlePath);
  const decoded = decodePng(fs.readFileSync(idlePath));
  const box = contentBBox(decoded.rgba, decoded.width, decoded.height);
  return {
    path: idlePath,
    width: decoded.width,
    height: decoded.height,
    rgba: decoded.rgba,
    box,
    meta: {
      canvas: Math.max(decoded.width, decoded.height),
      contentW: box.maxX - box.minX + 1,
      contentH: box.maxY - box.minY + 1,
      bottomY: box.maxY,
      topY: box.minY,
    },
  };
}

function resolveWorkingSource(stageId, frameIndex) {
  const candidates = [
    path.join(CANDIDATES_DIR, "arhat-working-raw", `${frameIndex}.png`),
    path.join(CANDIDATES_DIR, `${stageId}-working-${frameIndex}.png`),
    path.join(GENERATED_DIR, `${stageId}-working-${frameIndex}.png`),
  ];
  // Prefer stage-generic raw folder name
  candidates.unshift(path.join(CANDIDATES_DIR, `${stageId}-working-raw`, `${frameIndex}.png`));
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function main(argv = process.argv.slice(2)) {
  const stageArg = argv.find((a) => a.startsWith("--stage="));
  const stageId = stageArg ? stageArg.slice("--stage=".length).trim() : "";
  if (!stageId) {
    console.error("Usage: node scripts/lock-cultivator-working-to-idle.js --stage=arhat");
    process.exit(1);
  }

  const idle = loadIdle(stageId);
  // Normalize idle onto square canvas if needed
  let idleCanvasRgba = idle.rgba;
  let canvas = idle.width;
  let idleBox = idle.box;
  if (idle.width !== idle.height) {
    const content = extractContent(idle.rgba, idle.width, idle.height, idle.box);
    const destX = Math.floor((idle.meta.canvas - content.width) / 2);
    const destY = idle.meta.bottomY; // keep absolute? use top
    idleCanvasRgba = placeContentOnCanvas(
      content,
      idle.meta.canvas,
      Math.floor((idle.meta.canvas - content.width) / 2),
      idle.box.minY
    );
    canvas = idle.meta.canvas;
    idleBox = contentBBox(idleCanvasRgba, canvas, canvas);
  }

  fs.mkdirSync(GENERATED_DIR, { recursive: true });
  const outputs = [];
  for (let i = 1; i <= FRAME_COUNT; i += 1) {
    const src = resolveWorkingSource(stageId, i);
    if (!src) {
      console.warn(`skip frame ${i}: missing working source`);
      continue;
    }
    const normalized = normalizeToIdleCanvas(src, {
      canvas,
      contentW: idleBox.maxX - idleBox.minX + 1,
      contentH: idleBox.maxY - idleBox.minY + 1,
      bottomY: idleBox.maxY,
    });
    const locked = lockFrame(
      idleCanvasRgba,
      normalized.rgba,
      canvas,
      canvas,
      idleBox
    );
    const outPath = path.join(GENERATED_DIR, `${stageId}-working-${i}.png`);
    const candPath = path.join(CANDIDATES_DIR, `${stageId}-working-${i}.png`);
    const buf = encodePng(canvas, canvas, locked);
    fs.writeFileSync(outPath, buf);
    fs.writeFileSync(candPath, buf);
    outputs.push(outPath);
    console.log(`locked ${stageId}-working-${i}.png ← ${path.relative(REPO_ROOT, src)}`);
  }

  // Rebuild a contact sheet for review
  if (outputs.length === FRAME_COUNT) {
    console.log(`locked ${outputs.length} frames to idle for ${stageId}`);
  }
}

if (require.main === module) main();

module.exports = { lockFrame, normalizeToIdleCanvas, loadIdle };
