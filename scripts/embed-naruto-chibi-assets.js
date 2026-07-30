#!/usr/bin/env node
"use strict";

/**
 * Embed generated, standalone chibi Naruto sprites in runtime SVGs.
 *
 * Source sprites must first have the generation checkerboard removed:
 *   PYTHONPATH=.tools/pillow /Users/Admin/Desktop/dep/.venv/bin/python \
 *     scripts/make-naruto-pngs-transparent.py
 *
 * Then:
 *   node scripts/embed-naruto-chibi-assets.js
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const MANIFEST = path.join(ROOT, "assets", "source", "naruto", "manifest.json");
const INPUT_DIR = path.join(ROOT, "assets", "source", "naruto", "generated", "runtime");
const OUT_DIR = path.join(ROOT, "themes", "naruto", "assets");
const ACTIONS = ["idle", "thinking", "working", "attention", "error", "sleeping"];

function animation(action) {
  if (action === "thinking") {
    return `<animateTransform attributeName="transform" type="translate"
      values="0 0;0 -0.22;0 0" dur="2.8s" repeatCount="indefinite"/>`;
  }
  if (action === "working") {
    return `<animateTransform attributeName="transform" type="translate"
      values="0 0;0 -0.35;0 0" dur="1.15s" repeatCount="indefinite"/>`;
  }
  if (action === "sleeping") {
    return `<animateTransform attributeName="transform" type="translate"
      values="0 0;0 0.18;0 0" dur="3.2s" repeatCount="indefinite"/>`;
  }
  return `<animateTransform attributeName="transform" type="translate"
    values="0 0;0 -0.24;0 0" dur="2.5s" repeatCount="indefinite"/>`;
}

function spriteAction(action) {
  return action === "thinking" || action === "working" ? action : "idle";
}

const WORKING_PERIOD = "1.4s";

/** Six Paths runtime FX: rotating truth-seeker orbs + golden seal bloom. */
function sixpathsFxMarkup(viewBox, mode) {
  const cx = viewBox.x + viewBox.width / 2;
  const cy = viewBox.y + viewBox.height * 0.42;
  const intense = mode === "working";
  const orbitDur = intense ? "2.2s" : "5.5s";
  const bloomPeak = intense ? 0.58 : 0.34;
  const bloomRest = intense ? 0.3 : 0.18;
  const orbR = intense ? 7.6 : 6.4;
  // Working frames already bake truth-seeker orbs; keep code orbs for idle aura only.
  const orbs = intense
    ? ""
    : Array.from({ length: 6 }, (_, index) => {
      const angle = (index / 6) * Math.PI * 2;
      const x = (Math.cos(angle) * orbR).toFixed(2);
      const y = (Math.sin(angle) * orbR * 0.72).toFixed(2);
      return `<circle cx="${x}" cy="${y}" r="0.58" fill="#1A1520" stroke="#F5D76E" stroke-width="0.12"/>`;
    }).join("");
  const orbit = intense
    ? ""
    : `<g transform="translate(${cx} ${cy})">
    <g>
      <animateTransform attributeName="transform" type="rotate" from="0" to="360"
        dur="${orbitDur}" repeatCount="indefinite"/>
      ${orbs}
    </g>
  </g>`;
  const sparks = Array.from({ length: intense ? 10 : 5 }, (_, index) => {
    const angle = (index / (intense ? 10 : 5)) * Math.PI * 2;
    const radius = intense ? 9.4 : 8.2;
    const x = (cx + Math.cos(angle) * radius).toFixed(2);
    const y = (cy + Math.sin(angle) * radius * 0.8).toFixed(2);
    const begin = (index * (intense ? 0.1 : 0.35)).toFixed(2);
    return `<circle cx="${x}" cy="${y}" r="0.26" fill="#FFE9A0" opacity="0">
  <animate attributeName="opacity" dur="${intense ? "1.2s" : "2.8s"}" begin="${begin}s" repeatCount="indefinite"
    keyTimes="0;0.2;0.7;1" values="0;${intense ? 0.95 : 0.7};0.3;0"/>
  <animate attributeName="r" dur="${intense ? "1.2s" : "2.8s"}" begin="${begin}s" repeatCount="indefinite"
    keyTimes="0;0.2;1" values="0.08;${intense ? 0.36 : 0.26};0.06"/>
</circle>`;
  }).join("\n");
  const hexSeal = intense
    ? `<g opacity="0">
  <polygon points="${[
    [cx + 4.8, cy - 1.2],
    [cx + 7.1, cy + 0.2],
    [cx + 6.4, cy + 2.8],
    [cx + 4.0, cy + 3.5],
    [cx + 2.5, cy + 1.6],
    [cx + 3.2, cy - 0.6],
  ].map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(" ")}"
    fill="none" stroke="#FFE28A" stroke-width="0.22"/>
  <animate attributeName="opacity" dur="${WORKING_PERIOD}" repeatCount="indefinite"
    calcMode="discrete" keyTimes="0;0.33;0.66;1" values="0;0.85;0;0"/>
</g>`
    : "";
  const blade = intense
    ? `<g opacity="0">
  <rect x="${(cx + 5.4).toFixed(2)}" y="${(viewBox.y + 0.8).toFixed(2)}" width="1.55" height="19.2" rx="0.6"
    fill="url(#sixpaths-blade)"/>
  <animate attributeName="opacity" dur="${WORKING_PERIOD}" repeatCount="indefinite"
    calcMode="discrete" keyTimes="0;0.66;1" values="0;0.95;0"/>
</g>`
    : "";
  return `
<defs>
  <radialGradient id="sixpaths-bloom" cx="50%" cy="42%" r="55%">
    <stop offset="0%" stop-color="#FFF6C8" stop-opacity="0.85"/>
    <stop offset="45%" stop-color="#F5D76E" stop-opacity="0.35"/>
    <stop offset="100%" stop-color="#F5D76E" stop-opacity="0"/>
  </radialGradient>
  <linearGradient id="sixpaths-blade" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stop-color="#FFF8D0" stop-opacity="0"/>
    <stop offset="35%" stop-color="#FFE28A" stop-opacity="0.95"/>
    <stop offset="65%" stop-color="#F5D76E" stop-opacity="0.9"/>
    <stop offset="100%" stop-color="#FFF8D0" stop-opacity="0"/>
  </linearGradient>
</defs>
<g id="sixpaths-fx" pointer-events="none">
  <ellipse cx="${cx}" cy="${cy}" rx="${intense ? 11.2 : 10.2}" ry="${intense ? 12.4 : 11.4}" fill="url(#sixpaths-bloom)">
    <animate attributeName="opacity" dur="${intense ? "1.05s" : "3.2s"}" repeatCount="indefinite"
      calcMode="spline" keyTimes="0;0.5;1" values="${bloomRest};${bloomPeak};${bloomRest}"
      keySplines="0.4 0 0.6 1;0.4 0 0.6 1"/>
  </ellipse>
  <circle cx="${cx}" cy="${cy}" r="${(orbR + 0.4).toFixed(2)}" fill="none" stroke="#F5D76E"
    stroke-width="${intense ? 0.28 : 0.14}" opacity="${intense ? 0.6 : 0.32}">
    <animate attributeName="opacity" dur="${intense ? "1.05s" : "3.6s"}" repeatCount="indefinite"
      values="${intense ? "0.4;0.85;0.4" : "0.2;0.42;0.2"}"/>
    <animate attributeName="r" dur="${intense ? WORKING_PERIOD : "4.8s"}" repeatCount="indefinite"
      values="${(orbR + 0.2).toFixed(2)};${(orbR + 1.1).toFixed(2)};${(orbR + 0.2).toFixed(2)}"/>
  </circle>
  ${orbit}
  ${sparks}
  ${hexSeal}
  ${blade}
</g>`;
}

/** KCM runtime FX: golden cloak-flame aura + bijuu-dama / shockwave accents. */
function kcmFxMarkup(viewBox, mode) {
  const cx = viewBox.x + viewBox.width / 2;
  const cy = viewBox.y + viewBox.height * 0.45;
  const by = viewBox.y + viewBox.height - 2.4;
  const intense = mode === "working";
  const bloomPeak = intense ? 0.62 : 0.36;
  const bloomRest = intense ? 0.32 : 0.18;
  const flames = Array.from({ length: intense ? 7 : 5 }, (_, index) => {
    const spread = intense ? 4.8 : 3.8;
    const x = (cx - spread + (index * (spread * 2) / ((intense ? 7 : 5) - 1))).toFixed(2);
    const h = (intense ? 2.8 : 2.1) + (index % 3) * 0.35;
    const begin = (index * 0.14).toFixed(2);
    return `<path d="M ${x} ${by.toFixed(2)} q 0.35 -${(h * 0.55).toFixed(2)} 0 -${h.toFixed(2)} q -0.35 ${(h * 0.45).toFixed(2)} 0 ${h.toFixed(2)} Z"
      fill="#FFB84A" opacity="0.35">
  <animate attributeName="opacity" dur="${intense ? "0.85s" : "1.8s"}" begin="${begin}s" repeatCount="indefinite"
    values="0.2;${intense ? 0.85 : 0.55};0.2"/>
  <animateTransform attributeName="transform" type="translate" dur="${intense ? "0.85s" : "1.8s"}"
    begin="${begin}s" repeatCount="indefinite" values="0 0;0 -0.45;0 0"/>
</path>`;
  }).join("\n");
  const sparks = Array.from({ length: intense ? 9 : 4 }, (_, index) => {
    const angle = (index / (intense ? 9 : 4)) * Math.PI * 2;
    const radius = intense ? 8.8 : 7.4;
    const x = (cx + Math.cos(angle) * radius).toFixed(2);
    const y = (cy + Math.sin(angle) * radius * 0.75).toFixed(2);
    const begin = (index * (intense ? 0.11 : 0.4)).toFixed(2);
    return `<circle cx="${x}" cy="${y}" r="0.24" fill="#FFE7A0" opacity="0">
  <animate attributeName="opacity" dur="${intense ? "1.1s" : "2.6s"}" begin="${begin}s" repeatCount="indefinite"
    keyTimes="0;0.18;0.7;1" values="0;${intense ? 0.95 : 0.65};0.28;0"/>
</circle>`;
  }).join("\n");
  const afterimages = intense
    ? `<g opacity="0">
  <ellipse cx="${(cx - 3.8).toFixed(2)}" cy="${cy.toFixed(2)}" rx="1.1" ry="4.2" fill="#FFD56A" opacity="0.45"/>
  <ellipse cx="${(cx - 5.6).toFixed(2)}" cy="${cy.toFixed(2)}" rx="0.8" ry="3.4" fill="#FFC14A" opacity="0.3"/>
  <animate attributeName="opacity" dur="${WORKING_PERIOD}" repeatCount="indefinite"
    calcMode="discrete" keyTimes="0;0.33;1" values="0.9;0;0"/>
</g>`
    : "";
  const dama = intense
    ? `<g opacity="0">
  <circle cx="${(cx + 1.2).toFixed(2)}" cy="${(cy + 1.6).toFixed(2)}" r="2.4" fill="url(#kcm-dama)"/>
  <circle cx="${(cx + 1.2).toFixed(2)}" cy="${(cy + 1.6).toFixed(2)}" r="3.1" fill="none" stroke="#FFE28A" stroke-width="0.2" opacity="0.7">
    <animate attributeName="r" dur="0.55s" repeatCount="indefinite" values="2.7;3.35;2.7"/>
  </circle>
  <animate attributeName="opacity" dur="${WORKING_PERIOD}" repeatCount="indefinite"
    calcMode="discrete" keyTimes="0;0.33;0.66;1" values="0;0.95;0;0"/>
</g>`
    : "";
  const shockwave = intense
    ? `<g opacity="0">
  <ellipse cx="${(cx + 6.4).toFixed(2)}" cy="${cy.toFixed(2)}" rx="4.8" ry="5.6" fill="none"
    stroke="#FFE28A" stroke-width="0.45"/>
  <ellipse cx="${(cx + 7.6).toFixed(2)}" cy="${cy.toFixed(2)}" rx="6.2" ry="6.8" fill="none"
    stroke="#FFB84A" stroke-width="0.28" opacity="0.7"/>
  <animate attributeName="opacity" dur="${WORKING_PERIOD}" repeatCount="indefinite"
    calcMode="discrete" keyTimes="0;0.66;1" values="0;0.95;0"/>
</g>`
    : "";
  const magatama = intense
    ? ""
    : `<g opacity="0.55">
  <circle cx="${(cx - 1.15).toFixed(2)}" cy="${(cy - 1.1).toFixed(2)}" r="0.42" fill="#1A1520"/>
  <circle cx="${(cx + 1.15).toFixed(2)}" cy="${(cy - 1.1).toFixed(2)}" r="0.42" fill="#1A1520"/>
  <animate attributeName="opacity" dur="2.4s" repeatCount="indefinite" values="0.35;0.8;0.35"/>
</g>`;
  return `
<defs>
  <radialGradient id="kcm-bloom" cx="50%" cy="48%" r="58%">
    <stop offset="0%" stop-color="#FFF1B0" stop-opacity="0.9"/>
    <stop offset="40%" stop-color="#FFC14A" stop-opacity="0.4"/>
    <stop offset="100%" stop-color="#FF8A1A" stop-opacity="0"/>
  </radialGradient>
  <radialGradient id="kcm-dama" cx="40%" cy="35%" r="65%">
    <stop offset="0%" stop-color="#FFF8D8" stop-opacity="1"/>
    <stop offset="45%" stop-color="#FFC14A" stop-opacity="0.95"/>
    <stop offset="100%" stop-color="#FF8A1A" stop-opacity="0.75"/>
  </radialGradient>
</defs>
<g id="kcm-fx" pointer-events="none">
  <ellipse cx="${cx}" cy="${cy}" rx="${intense ? 11.4 : 9.8}" ry="${intense ? 12.6 : 11.0}" fill="url(#kcm-bloom)">
    <animate attributeName="opacity" dur="${intense ? "0.95s" : "2.8s"}" repeatCount="indefinite"
      calcMode="spline" keyTimes="0;0.5;1" values="${bloomRest};${bloomPeak};${bloomRest}"
      keySplines="0.4 0 0.6 1;0.4 0 0.6 1"/>
  </ellipse>
  ${flames}
  ${magatama}
  ${sparks}
  ${afterimages}
  ${dama}
  ${shockwave}
</g>`;
}

function stageFxMarkup(stageId, action, viewBox) {
  if (action === "sleeping" || action === "error") return "";
  const mode = action === "working" ? "working" : "idle";
  if (stageId === "sixpaths") return sixpathsFxMarkup(viewBox, mode);
  if (stageId === "kcm") return kcmFxMarkup(viewBox, mode);
  return "";
}

function svg(stageId, action, pngBuffer, viewBox) {
  const encoded = pngBuffer.toString("base64");
  const vb = `${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`;
  const cx = viewBox.x + viewBox.width / 2;
  const by = viewBox.y + viewBox.height - 1.15;
  const fx = stageFxMarkup(stageId, action, viewBox);
  const zzz = action === "sleeping"
    ? `<g fill="#5EA9E8" font-family="serif" font-weight="700">
        <text x="12.2" y="4.2" font-size="1.55">Z</text>
        <text x="13.6" y="2.75" font-size="2.05">Z</text>
      </g>`
    : "";
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" width="256" height="256">
<!-- naruto:${stageId}:${action} standalone generated chibi sprite (embed-naruto-chibi-assets.js) -->
${fx}
<ellipse id="shadow-js" cx="${cx}" cy="${by}" rx="4.75" ry="0.76" fill="#000" opacity="0.18"/>
<g id="body-js">
  ${animation(action)}
  <image href="data:image/png;base64,${encoded}"
    x="${viewBox.x}" y="${viewBox.y}" width="${viewBox.width}" height="${viewBox.height}"
    preserveAspectRatio="xMidYMid meet"/>
</g>
${zzz}
<g id="eyes-js" opacity="0"><circle cx="8" cy="6.25" r="0.01"/></g>
</svg>
`;
}

/**
 * Hard visibility cuts for stacked sprite frames.
 *
 * Use visibility (not opacity): opacity can still composite two stacked frames
 * during interpolation / channel conflicts and leave "previous frame corners".
 * visibility is binary — no alpha blend between frames.
 */
function workingFrameKeyframes(frameIndex, count) {
  const startPct = ((frameIndex - 1) / count) * 100;
  const endPct = (frameIndex / count) * 100;
  const lines = [`@keyframes naruto-frame-${frameIndex} {`];
  if (frameIndex === 1) {
    lines.push("  0% { visibility: visible; }");
  } else {
    lines.push("  0% { visibility: hidden; }");
    lines.push(`  ${startPct}% { visibility: hidden; }`);
    lines.push(`  ${startPct + 0.001}% { visibility: visible; }`);
  }
  if (frameIndex === count) {
    lines.push("  100% { visibility: visible; }");
  } else {
    lines.push(`  ${endPct}% { visibility: visible; }`);
    lines.push(`  ${endPct + 0.001}% { visibility: hidden; }`);
    lines.push("  100% { visibility: hidden; }");
  }
  lines.push("}");
  return lines.join("\n");
}

/** SMIL discrete visibility — survives <img> channel where CSS may not play. */
function workingFrameSmil(frameIndex, count) {
  const start = (frameIndex - 1) / count;
  const end = frameIndex / count;
  let keyTimes;
  let values;
  if (frameIndex === 1) {
    keyTimes = `0;${end};1`;
    values = "visible;hidden;hidden";
  } else if (frameIndex === count) {
    keyTimes = `0;${start};1`;
    values = "hidden;visible;visible";
  } else {
    keyTimes = `0;${start};${end};1`;
    values = "hidden;visible;hidden;hidden";
  }
  return (
    `<animate attributeName="visibility" dur="${WORKING_PERIOD}" repeatCount="indefinite" ` +
    `calcMode="discrete" keyTimes="${keyTimes}" values="${values}"/>`
  );
}

function workingSvg(stageId, frameBuffers, viewBox) {
  const vb = `${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`;
  const cx = viewBox.x + viewBox.width / 2;
  const by = viewBox.y + viewBox.height - 1.15;
  const count = frameBuffers.length;
  const fx = stageFxMarkup(stageId, "working", viewBox);
  const frameMarkup = frameBuffers.map((buffer, index) => {
    const frameNum = index + 1;
    const encoded = buffer.toString("base64");
    return `<g id="naruto-frame-${frameNum}" class="working-frame frame-${frameNum}" visibility="hidden">
  ${workingFrameSmil(frameNum, count)}
  <image href="data:image/png;base64,${encoded}"
    x="${viewBox.x}" y="${viewBox.y}" width="${viewBox.width}" height="${viewBox.height}"
    preserveAspectRatio="xMidYMid meet"/>
</g>`;
  }).join("\n");
  const frameCss = frameBuffers.map((_, index) => {
    const frameNum = index + 1;
    return `${workingFrameKeyframes(frameNum, count)}
.frame-${frameNum} { animation: naruto-frame-${frameNum} ${WORKING_PERIOD} linear infinite; }`;
  }).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" width="256" height="256">
<!-- naruto:${stageId}:working ${count}-frame combat animation (embed-naruto-chibi-assets.js) -->
<style><![CDATA[
.working-frame { visibility: hidden; }
${frameCss}
]]></style>
${fx}
<ellipse id="shadow-js" cx="${cx}" cy="${by}" rx="4.75" ry="0.76" fill="#000" opacity="0.18"/>
<g id="body-js">
${frameMarkup}
</g>
<g id="eyes-js" opacity="0"><circle cx="8" cy="6.25" r="0.01"/></g>
</svg>
`;
}

function main() {
  const manifest = JSON.parse(fs.readFileSync(MANIFEST, "utf8"));
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const missing = [];
  let count = 0;
  for (const stage of manifest.stages) {
    for (const action of ACTIONS) {
      if (action === "working") {
        const frames = Array.from({ length: 3 }, (_, index) => (
          path.join(INPUT_DIR, `${stage.id}-working-${index + 1}.png`)
        ));
        const absent = frames.filter((file) => !fs.existsSync(file));
        if (absent.length) {
          missing.push(...absent.map((file) => path.relative(ROOT, file)));
          continue;
        }
        const output = path.join(OUT_DIR, `${stage.id}-working.svg`);
        fs.writeFileSync(
          output,
          workingSvg(stage.id, frames.map((file) => fs.readFileSync(file)), manifest.viewBox),
          "utf8"
        );
        count += 1;
        continue;
      }
      const sourceAction = spriteAction(action);
      const source = path.join(INPUT_DIR, `${stage.id}-${sourceAction}.png`);
      if (!fs.existsSync(source)) {
        missing.push(path.relative(ROOT, source));
        continue;
      }
      const output = path.join(OUT_DIR, `${stage.id}-${action}.svg`);
      fs.writeFileSync(output, svg(stage.id, action, fs.readFileSync(source), manifest.viewBox), "utf8");
      count += 1;
    }
  }
  if (missing.length) {
    console.error(`missing ${missing.length} transparent runtime sprite(s):`);
    for (const file of missing) console.error(`  - ${file}`);
    process.exit(1);
  }
  console.log(`embedded ${count} standalone chibi SVG(s)`);
}

main();
