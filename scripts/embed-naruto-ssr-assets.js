#!/usr/bin/env node
"use strict";

/**
 * Embed naruto-ssr Storm SSR rasters into themes/naruto SVG stubs.
 * Personal / local experiment only — see assets/source/naruto/ATTRIBUTION.md.
 *
 * Usage: node scripts/embed-naruto-ssr-assets.js
 */

const fs = require("fs");
const path = require("path");

const REPO_ROOT = path.join(__dirname, "..");
const MANIFEST_PATH = path.join(REPO_ROOT, "assets", "source", "naruto", "manifest.json");
const GEN_DIR = path.join(REPO_ROOT, "assets", "source", "naruto", "generated");
const OUT_DIR = path.join(REPO_ROOT, "themes", "naruto", "assets");

const ACTIONS = ["idle", "thinking", "working", "attention", "error", "sleeping"];

/** Per-stage source raster + aura tint (monotonic with progression). */
const STAGE_ART = {
  academy: {
    file: "chibi-porch-512.png",
    filter: "brightness(1.02) saturate(0.95)",
    aura: { color: "#F06B1F", opacity: 0.1, r: 11 },
  },
  genin: {
    file: "chibi-porch-512.png",
    filter: "none",
    aura: { color: "#4DB8FF", opacity: 0.16, r: 11.5 },
  },
  sage: {
    file: "chibi-porch-512.png",
    filter: "saturate(1.15) hue-rotate(-6deg)",
    aura: { color: "#E67E22", opacity: 0.24, r: 12 },
  },
  kcm: {
    file: "chibi-rainbow-512.png",
    filter: "saturate(1.25) brightness(1.06)",
    aura: { color: "#FFD84A", opacity: 0.34, r: 12.5 },
  },
  sixpaths: {
    file: "chibi-rainbow-512.png",
    filter: "saturate(1.3) brightness(1.08)",
    aura: { color: "#FFD84A", opacity: 0.42, r: 13 },
  },
  kurama: {
    file: "chibi-rainbow-512.png",
    filter: "saturate(1.35) contrast(1.05) brightness(1.05)",
    aura: { color: "#C0392B", opacity: 0.5, r: 13.5 },
  },
};

function mimeFor(file) {
  return file.toLowerCase().endsWith(".jpg") || file.toLowerCase().endsWith(".jpeg")
    ? "image/jpeg"
    : "image/png";
}

function actionFilter(action, stageFilter) {
  const base = stageFilter && stageFilter !== "none" ? stageFilter : "";
  if (action === "sleeping") {
    return [base, "grayscale(0.35) brightness(0.82)"].filter(Boolean).join(" ");
  }
  if (action === "error") {
    return [base, "saturate(0.7) brightness(0.9)"].filter(Boolean).join(" ");
  }
  if (action === "thinking") {
    return [base, "brightness(1.04)"].filter(Boolean).join(" ");
  }
  if (action === "attention") {
    return [base, "saturate(1.2) brightness(1.06)"].filter(Boolean).join(" ");
  }
  return base || "none";
}

function animationCss(action) {
  if (action === "working") {
    return [
      "@keyframes seal-pulse { 0%,100% { transform: translateY(0) scale(1); } 50% { transform: translateY(-0.25px) scale(1.015); } }",
      "#sprite-js { animation: seal-pulse 1.4s ease-in-out infinite; transform-box: fill-box; transform-origin: center bottom; }",
    ].join("\n");
  }
  if (action === "sleeping") {
    return [
      "@keyframes sleep-breathe { 0%,100% { transform: translateY(0); } 50% { transform: translateY(0.2px); } }",
      "#sprite-js { animation: sleep-breathe 3.4s ease-in-out infinite; transform-box: fill-box; transform-origin: center bottom; }",
    ].join("\n");
  }
  if (action === "error") {
    return [
      "@keyframes sigh { 0%,100% { transform: translateY(0); } 50% { transform: translateY(0.3px); } }",
      "#sprite-js { animation: sigh 2.2s ease-in-out infinite; transform-box: fill-box; transform-origin: center bottom; }",
    ].join("\n");
  }
  return [
    "@keyframes breathe { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-0.28px); } }",
    "#sprite-js { animation: breathe 2.6s ease-in-out infinite; transform-box: fill-box; transform-origin: center bottom; }",
  ].join("\n");
}

function wrapSvg(stageId, action, pngBuffer, viewBox, art) {
  const vb = `${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`;
  const cx = viewBox.x + viewBox.width / 2;
  const by = viewBox.y + viewBox.height - 1.2;
  const b64 = pngBuffer.toString("base64");
  const filt = actionFilter(action, art.filter);
  const filterAttr = filt && filt !== "none" ? ` style="filter:${filt}"` : "";
  const aura = art.aura || { color: "#FFD84A", opacity: 0.1, r: 10 };
  const gid = `chakra-${stageId}-${action}`;

  return [
    "<?xml version=\"1.0\" encoding=\"UTF-8\"?>",
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" width="256" height="256">`,
    `<!-- naruto:${stageId}:${action} chibi SSR-mood embed (scripts/embed-naruto-ssr-assets.js) -->`,
    `<style><![CDATA[`,
    animationCss(action),
    `@keyframes aura-breathe { 0%,100% { opacity:${aura.opacity}; } 50% { opacity:${Math.min(0.85, aura.opacity + 0.12)}; } }`,
    `#chakra-aura { animation: aura-breathe 2.8s ease-in-out infinite; }`,
    `]]></style>`,
    `<defs>`,
    `  <radialGradient id="${gid}" cx="50%" cy="42%" r="50%">`,
    `    <stop offset="0%" stop-color="${aura.color}" stop-opacity="1"/>`,
    `    <stop offset="55%" stop-color="${aura.color}" stop-opacity="0.45"/>`,
    `    <stop offset="100%" stop-color="${aura.color}" stop-opacity="0"/>`,
    `  </radialGradient>`,
    `</defs>`,
    `<ellipse id="shadow-js" cx="${cx}" cy="${by}" rx="5.4" ry="1.15" fill="#000" opacity="0.22"/>`,
    `<circle id="chakra-aura" cx="${cx}" cy="${(viewBox.y + viewBox.height * 0.42).toFixed(2)}" r="${aura.r}" fill="url(#${gid})" pointer-events="none"/>`,
    `<g id="sprite-js"${filterAttr}>`,
    `<image href="data:${mimeFor(art.file)};base64,${b64}"`,
    `  x="${viewBox.x}" y="${viewBox.y}" width="${viewBox.width}" height="${viewBox.height}"`,
    `  preserveAspectRatio="xMidYMid meet"/>`,
    `</g>`,
    `<g id="eyes-js" opacity="0"><circle cx="8" cy="6.25" r="0.01"/></g>`,
    `<g id="body-js" opacity="0"><circle cx="8" cy="12" r="0.01"/></g>`,
    `</svg>`,
    "",
  ].join("\n");
}

function main() {
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
  const viewBox = manifest.viewBox;
  fs.mkdirSync(OUT_DIR, { recursive: true });

  let written = 0;
  const missing = [];

  for (const stage of manifest.stages) {
    const art = STAGE_ART[stage.id];
    if (!art) {
      missing.push(`STAGE_ART missing for ${stage.id}`);
      continue;
    }
    const pngPath = path.join(GEN_DIR, art.file);
    if (!fs.existsSync(pngPath)) {
      missing.push(art.file);
      continue;
    }
    const buf = fs.readFileSync(pngPath);
    for (const action of ACTIONS) {
      // kurama noKnock: working == idle art (same raster + working pulse)
      const svg = wrapSvg(stage.id, action, buf, viewBox, art);
      fs.writeFileSync(path.join(OUT_DIR, `${stage.id}-${action}.svg`), svg, "utf8");
      written += 1;
    }
  }

  if (missing.length) {
    console.error("missing inputs:");
    for (const m of missing) console.error(`  - ${m}`);
    process.exit(1);
  }
  console.log(`embedded ${written} svg(s) from naruto-ssr rasters → ${path.relative(REPO_ROOT, OUT_DIR)}`);
}

main();
