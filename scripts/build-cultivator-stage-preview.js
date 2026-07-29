"use strict";

/**
 * Build PNG frame previews + browser HTML for a cultivator stage (Cursor can't view SVG).
 *
 * Usage:
 *   node scripts/build-cultivator-stage-preview.js --stage=arhat
 *
 * Outputs in assets/source/cultivator/candidates/:
 *   - {stage}-working-1..6.png  (copied from split)
 *   - preview-{stage}.html      (open in browser)
 */

const fs = require("node:fs");
const path = require("node:path");
const { splitWorkingSheet, GENERATED_DIR, EXPECTED_FRAMES } = require("./split-cultivator-spritesheet");

const REPO_ROOT = path.resolve(__dirname, "..");
const CANDIDATES_DIR = path.join(REPO_ROOT, "assets", "source", "cultivator", "candidates");
const WORKING_PERIOD = "1.4s";

function workingFrameKeyframes(frameIndex) {
  const count = EXPECTED_FRAMES;
  const startPct = ((frameIndex - 1) / count) * 100;
  const endPct = (frameIndex / count) * 100;
  const lines = [`@keyframes knock-frame-${frameIndex} {`];
  if (frameIndex === 1) {
    lines.push("  0% { opacity: 1; }");
  } else {
    lines.push("  0% { opacity: 0; }");
    lines.push(`  ${startPct}% { opacity: 0; }`);
    lines.push(`  ${startPct + 0.001}% { opacity: 1; }`);
  }
  if (frameIndex === count) {
    lines.push("  100% { opacity: 1; }");
  } else {
    lines.push(`  ${endPct}% { opacity: 1; }`);
    lines.push(`  ${endPct + 0.001}% { opacity: 0; }`);
    lines.push("  100% { opacity: 0; }");
  }
  lines.push("}");
  return lines.join("\n");
}

function buildKnockCss() {
  const rules = [];
  for (let i = 1; i <= EXPECTED_FRAMES; i += 1) {
    rules.push(workingFrameKeyframes(i));
    rules.push(
      `#knock-frame-${i} { animation: knock-frame-${i} ${WORKING_PERIOD} linear infinite; }`
    );
  }
  return rules.join("\n");
}

function buildPreviewHtml(stageId) {
  const bust = `?t=${Date.now()}`;
  const knockFrames = Array.from({ length: EXPECTED_FRAMES }, (_, i) => {
    const n = i + 1;
    return `<img id="knock-frame-${n}" class="knock-frame" src="${stageId}-working-${n}.png${bust}" alt="frame ${n}"/>`;
  }).join("\n");

  const idlePath = `${stageId}-idle.png`;
  const hasIdle = fs.existsSync(path.join(CANDIDATES_DIR, idlePath));
  const idleSrc = `${idlePath}${bust}`;
  const w1Src = `${stageId}-working-1.png${bust}`;

  return `<!DOCTYPE html>
<html lang="zh">
<head>
  <meta charset="utf-8"/>
  <title>Cultivator preview — ${stageId}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 24px;
      font-family: system-ui, sans-serif;
      background: #1a1a1a;
      color: #e8e8e8;
    }
    h1 { font-size: 18px; margin: 0 0 8px; }
    p { margin: 0 0 16px; color: #aaa; font-size: 13px; line-height: 1.5; }
    .row { display: flex; flex-wrap: wrap; gap: 24px; align-items: flex-start; }
    .panel {
      background: repeating-conic-gradient(#2a2a2a 0% 25%, #1f1f1f 0% 50%) 50% / 16px 16px;
      border: 1px solid #444;
      border-radius: 8px;
      padding: 12px;
      min-width: 200px;
    }
    .panel h2 { font-size: 13px; margin: 0 0 8px; color: #ccc; }
    .stage-img { max-width: 280px; max-height: 320px; display: block; margin: 0 auto; }
    .knock-stage {
      position: relative;
      width: 280px;
      height: 320px;
      margin: 0 auto;
    }
    .knock-frame {
      position: absolute;
      left: 0;
      top: 0;
      width: 100%;
      height: 100%;
      object-fit: contain;
      opacity: 0;
    }
    #knock-frame-1 { opacity: 1; }
    .thumbs {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 24px;
    }
    .thumbs img {
      width: 96px;
      height: auto;
      background: repeating-conic-gradient(#2a2a2a 0% 25%, #1f1f1f 0% 50%) 50% / 8px 8px;
      border: 1px solid #444;
      border-radius: 4px;
    }
    ${buildKnockCss()}
  </style>
</head>
<body>
  <h1>${stageId} — cultivator preview</h1>
  <p>Cursor 不能直接看 SVG；用本页在浏览器里预览敲木鱼动画。对比 idle 与 working 是否位置/大小一致。</p>
  <div class="row">
    ${hasIdle ? `<div class="panel">
      <h2>Idle（静默）</h2>
      <img class="stage-img" src="${idleSrc}" alt="idle"/>
    </div>
    <div class="panel">
      <h2>半透明叠对比（红=idle，青=working1）</h2>
      <div class="knock-stage" style="position:relative;width:280px;height:320px;margin:0 auto;">
        <img src="${idleSrc}" alt="idle" style="position:absolute;inset:0;width:100%;height:100%;object-fit:contain;opacity:0.55;filter:sepia(1) saturate(3) hue-rotate(-30deg);"/>
        <img src="${w1Src}" alt="w1" style="position:absolute;inset:0;width:100%;height:100%;object-fit:contain;opacity:0.55;filter:sepia(1) saturate(3) hue-rotate(130deg);"/>
      </div>
    </div>` : ""}
    <div class="panel">
      <h2>Working 单帧对照（第 1 帧，无动画）</h2>
      <img class="stage-img" src="${w1Src}" alt="working-1"/>
    </div>
    <div class="panel">
      <h2>Working 动画（与桌宠 SVG 相同 CSS）</h2>
      <div class="knock-stage">
        ${knockFrames}
      </div>
    </div>
    <div class="panel">
      <h2>精灵图 sheet</h2>
      <img class="stage-img" src="${stageId}-working-sheet.png${bust}" alt="sheet"/>
    </div>
  </div>
  <h2 style="font-size:13px;margin:24px 0 8px;color:#ccc;">6 帧切分</h2>
  <div class="thumbs">
    ${Array.from({ length: EXPECTED_FRAMES }, (_, i) =>
      `<img src="${stageId}-working-${i + 1}.png${bust}" alt="frame ${i + 1}"/>`
    ).join("\n    ")}
  </div>
</body>
</html>
`;
}

function main(argv = process.argv.slice(2)) {
  const stageArg = argv.find((a) => a.startsWith("--stage="));
  const stageId = stageArg ? stageArg.slice("--stage=".length).trim() : "";
  if (!stageId) {
    console.error("Usage: node scripts/build-cultivator-stage-preview.js --stage=arhat");
    process.exit(1);
  }

  const candidateSheet = path.join(CANDIDATES_DIR, `${stageId}-working-sheet.png`);
  const generatedSheet = path.join(GENERATED_DIR, `${stageId}-working-sheet.png`);
  if (!fs.existsSync(candidateSheet)) {
    console.error(`Missing ${path.relative(REPO_ROOT, candidateSheet)}`);
    process.exit(1);
  }

  fs.mkdirSync(GENERATED_DIR, { recursive: true });
  fs.copyFileSync(candidateSheet, generatedSheet);

  const { canvasW, canvasH, mode } = splitWorkingSheet(stageId);
  console.log(`split ${stageId}: ${canvasW}x${canvasH} (${mode})`);

  for (let i = 1; i <= EXPECTED_FRAMES; i += 1) {
    const src = path.join(GENERATED_DIR, `${stageId}-working-${i}.png`);
    const dest = path.join(CANDIDATES_DIR, `${stageId}-working-${i}.png`);
    fs.copyFileSync(src, dest);
  }

  const htmlPath = path.join(CANDIDATES_DIR, `preview-${stageId}.html`);
  fs.writeFileSync(htmlPath, buildPreviewHtml(stageId), "utf8");

  console.log(`Preview files in ${path.relative(REPO_ROOT, CANDIDATES_DIR)}:`);
  console.log(`  preview-${stageId}.html  ← open in browser`);
  for (let i = 1; i <= EXPECTED_FRAMES; i += 1) {
    console.log(`  ${stageId}-working-${i}.png`);
  }
}

if (require.main === module) main();

module.exports = { buildPreviewHtml, main };
