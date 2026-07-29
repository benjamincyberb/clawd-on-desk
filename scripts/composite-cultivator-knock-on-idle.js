"use strict";

/**
 * @deprecated Do NOT use. Prop composites cannot stay pixel-identical to idle.
 * Prefer regenerating working sheets under cultivator-asset-standard constraints.
 * See docs/guides/cultivator-asset-pipeline.md (废弃补救).
 *
 * Composite knock animation onto the confirmed idle portrait.
 * Body/halo/clouds stay byte-identical to idle; only hands are covered
 * and woodfish + mallet props are overlaid in 6 knock poses.
 *
 * Usage (deprecated):
 *   node scripts/composite-cultivator-knock-on-idle.js --stage=arhat
 */

const fs = require("node:fs");
const path = require("node:path");
const { decodePng, encodePng, processFile } = require("./make-cultivator-pngs-transparent");

const REPO_ROOT = path.resolve(__dirname, "..");
const CANDIDATES_DIR = path.join(REPO_ROOT, "assets", "source", "cultivator", "candidates");
const GENERATED_DIR = path.join(REPO_ROOT, "assets", "source", "cultivator", "generated");
const ASSET_STAGING = path.join(
  process.env.HOME || "",
  ".cursor/projects/Users-Admin-Desktop-dep-clawd-on-desk/assets"
);
const FRAME_COUNT = 6;
const ALPHA = 16;

if (require.main === module) {
  console.warn(
    "[DEPRECATED] composite-cultivator-knock-on-idle.js — regenerate working sheets instead; see docs/guides/cultivator-asset-pipeline.md"
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
  return { width: dstW, height: dstH, rgba: out };
}

function rotateRgba(src, angleDeg) {
  const rad = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const cx = (src.width - 1) / 2;
  const cy = (src.height - 1) / 2;
  const corners = [
    [0, 0], [src.width, 0], [0, src.height], [src.width, src.height],
  ].map(([x, y]) => {
    const dx = x - cx;
    const dy = y - cy;
    return [dx * cos - dy * sin, dx * sin + dy * cos];
  });
  const xs = corners.map((c) => c[0]);
  const ys = corners.map((c) => c[1]);
  const minX = Math.floor(Math.min(...xs));
  const maxX = Math.ceil(Math.max(...xs));
  const minY = Math.floor(Math.min(...ys));
  const maxY = Math.ceil(Math.max(...ys));
  const outW = maxX - minX + 1;
  const outH = maxY - minY + 1;
  const out = Buffer.alloc(outW * outH * 4);
  const invCos = Math.cos(-rad);
  const invSin = Math.sin(-rad);
  for (let y = 0; y < outH; y += 1) {
    for (let x = 0; x < outW; x += 1) {
      const dx = x + minX;
      const dy = y + minY;
      const sx = Math.round(dx * invCos - dy * invSin + cx);
      const sy = Math.round(dx * invSin + dy * invCos + cy);
      if (sx < 0 || sy < 0 || sx >= src.width || sy >= src.height) continue;
      const si = (sy * src.width + sx) * 4;
      if (src.rgba[si + 3] <= ALPHA) continue;
      const di = (y * outW + x) * 4;
      out[di] = src.rgba[si];
      out[di + 1] = src.rgba[si + 1];
      out[di + 2] = src.rgba[si + 2];
      out[di + 3] = src.rgba[si + 3];
    }
  }
  return { width: outW, height: outH, rgba: out };
}

function blit(dest, destW, destH, src, destX, destY) {
  for (let y = 0; y < src.height; y += 1) {
    const ty = destY + y;
    if (ty < 0 || ty >= destH) continue;
    for (let x = 0; x < src.width; x += 1) {
      const tx = destX + x;
      if (tx < 0 || tx >= destW) continue;
      const si = (y * src.width + x) * 4;
      if (src.rgba[si + 3] <= ALPHA) continue;
      const di = (ty * destW + tx) * 4;
      const a = src.rgba[si + 3] / 255;
      dest[di] = Math.round(src.rgba[si] * a + dest[di] * (1 - a));
      dest[di + 1] = Math.round(src.rgba[si + 1] * a + dest[di + 1] * (1 - a));
      dest[di + 2] = Math.round(src.rgba[si + 2] * a + dest[di + 2] * (1 - a));
      dest[di + 3] = Math.min(255, dest[di + 3] + src.rgba[si + 3]);
    }
  }
}

function coverPrayerHands(out, idleRgba, width, height, box) {
  const contentH = box.maxY - box.minY + 1;
  const contentW = box.maxX - box.minX + 1;
  const handsTop = box.minY + Math.floor(contentH * 0.52);
  const handsBottom = box.minY + Math.floor(contentH * 0.70);
  const handsLeft = box.minX + Math.floor(contentW * 0.34);
  const handsRight = box.minX + Math.floor(contentW * 0.66);
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
      // Sample robe above the hands
      const sy = Math.max(0, y - 18);
      const si = (sy * width + x) * 4;
      if (idleRgba[si + 3] > ALPHA) {
        out[i] = idleRgba[si];
        out[i + 1] = idleRgba[si + 1];
        out[i + 2] = idleRgba[si + 2];
        out[i + 3] = idleRgba[si + 3];
      }
    }
  }
}

function loadProp(stageId, name) {
  const candidates = [
    path.join(CANDIDATES_DIR, `${stageId}-prop-${name}.png`),
    path.join(ASSET_STAGING, `${stageId}-prop-${name}.png`),
    path.join(ASSET_STAGING, `arhat-prop-${name}.png`),
  ];
  for (const p of candidates) {
    if (!fs.existsSync(p)) continue;
    processFile(p);
    const decoded = decodePng(fs.readFileSync(p));
    const box = contentBBox(decoded.rgba, decoded.width, decoded.height);
    const content = extractContent(decoded.rgba, decoded.width, decoded.height, box);
    // Persist into candidates for reuse
    const dest = path.join(CANDIDATES_DIR, `${stageId}-prop-${name}.png`);
    if (p !== dest) fs.copyFileSync(p, dest);
    return content;
  }
  throw new Error(`missing prop ${name} for ${stageId}`);
}

function main(argv = process.argv.slice(2)) {
  const stageArg = argv.find((a) => a.startsWith("--stage="));
  const stageId = stageArg ? stageArg.slice("--stage=".length).trim() : "";
  if (!stageId) {
    console.error("Usage: node scripts/composite-cultivator-knock-on-idle.js --stage=arhat");
    process.exit(1);
  }

  const idlePath = path.join(CANDIDATES_DIR, `${stageId}-idle.png`);
  processFile(idlePath);
  const idle = decodePng(fs.readFileSync(idlePath));
  const box = contentBBox(idle.rgba, idle.width, idle.height);
  const contentH = box.maxY - box.minY + 1;
  const contentW = box.maxX - box.minX + 1;

  const woodfishRaw = loadProp(stageId, "woodfish");
  const malletRaw = loadProp(stageId, "mallet");

  const fishTargetW = Math.max(24, Math.round(contentW * 0.28));
  const fishScale = fishTargetW / woodfishRaw.width;
  const woodfish = nearestNeighborScale(
    woodfishRaw.rgba,
    woodfishRaw.width,
    woodfishRaw.height,
    fishTargetW,
    Math.max(1, Math.round(woodfishRaw.height * fishScale))
  );

  const malletTargetH = Math.max(24, Math.round(contentH * 0.28));
  const malletScale = malletTargetH / malletRaw.height;
  const malletBase = nearestNeighborScale(
    malletRaw.rgba,
    malletRaw.width,
    malletRaw.height,
    Math.max(1, Math.round(malletRaw.width * malletScale)),
    malletTargetH
  );

  // Fixed woodfish position: viewer's left / in front of lap
  const fishX = box.minX + Math.floor(contentW * 0.22) - Math.floor(woodfish.width / 2);
  const fishY = box.minY + Math.floor(contentH * 0.72) - Math.floor(woodfish.height / 2);

  // Mallet pivot near top of woodfish; 6 knock angles (degrees, 0 = upright)
  const malletAngles = [-25, -15, 5, 25, 5, -10];
  const malletPivotX = fishX + Math.floor(woodfish.width * 0.55);
  const malletPivotY = fishY + Math.floor(woodfish.height * 0.15);

  fs.mkdirSync(GENERATED_DIR, { recursive: true });

  for (let i = 0; i < FRAME_COUNT; i += 1) {
    const out = Buffer.from(idle.rgba);
    coverPrayerHands(out, idle.rgba, idle.width, idle.height, box);
    blit(out, idle.width, idle.height, woodfish, fishX, fishY);

    const rotated = rotateRgba(malletBase, malletAngles[i]);
    // Anchor near bottom of mallet handle toward pivot
    const mx = malletPivotX - Math.floor(rotated.width * 0.45);
    const my = malletPivotY - Math.floor(rotated.height * 0.85);
    blit(out, idle.width, idle.height, rotated, mx, my);

    // Tiny spark on strike frame
    if (i === 3) {
      const sx = malletPivotX;
      const sy = malletPivotY;
      for (const [dx, dy] of [[0, 0], [3, 0], [-3, 0], [0, 3], [0, -3], [2, 2], [-2, 2]]) {
        const x = sx + dx;
        const y = sy + dy;
        if (x < 0 || y < 0 || x >= idle.width || y >= idle.height) continue;
        const di = (y * idle.width + x) * 4;
        out[di] = 255;
        out[di + 1] = 220;
        out[di + 2] = 80;
        out[di + 3] = 255;
      }
    }

    const buf = encodePng(idle.width, idle.height, out);
    const name = `${stageId}-working-${i + 1}.png`;
    fs.writeFileSync(path.join(GENERATED_DIR, name), buf);
    fs.writeFileSync(path.join(CANDIDATES_DIR, name), buf);
    console.log(`composited ${name}`);
  }
}

if (require.main === module) main();
