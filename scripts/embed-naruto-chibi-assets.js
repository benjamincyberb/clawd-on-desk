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

function svg(stageId, action, pngBuffer, viewBox) {
  const encoded = pngBuffer.toString("base64");
  const vb = `${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`;
  const cx = viewBox.x + viewBox.width / 2;
  const by = viewBox.y + viewBox.height - 1.15;
  const zzz = action === "sleeping"
    ? `<g fill="#5EA9E8" font-family="serif" font-weight="700">
        <text x="12.2" y="4.2" font-size="1.55">Z</text>
        <text x="13.6" y="2.75" font-size="2.05">Z</text>
      </g>`
    : "";
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" width="256" height="256">
<!-- naruto:${stageId}:${action} standalone generated chibi sprite (embed-naruto-chibi-assets.js) -->
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

const WORKING_PERIOD = "1.4s";

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
