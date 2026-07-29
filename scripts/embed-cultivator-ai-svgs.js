"use strict";

/**
 * Embed AI sprites with CSS motion.
 *
 * Working (current / ONLY supported for knock stages):
 *   6 full-body AI frames stacked, CSS linear + hard opacity cuts
 *   (`wrapWorkingFramesInSvg`). Body scale must match idle.
 * Working (noKnock stages, e.g. buddha):
 *   idle raster + procedural FX (`wrapNoKnockWorkingSvg`).
 * Idle / thinking / other: single raster + light CSS breathe.
 *
 * @deprecated Layered base+arm path (`wrapKnockLayeredSvg` / `KNOCK_LAYOUT` /
 * `readLayeredKnockAssets`) is retained only for archaeology and is NOT called
 * by `embedAll`. Do not revive without updating cultivator-asset-standard.md.
 */

const fs = require("node:fs");
const path = require("node:path");

const REPO_ROOT = path.resolve(__dirname, "..");
const MANIFEST_PATH = path.join(REPO_ROOT, "assets", "source", "cultivator", "manifest.json");
const GENERATED_DIR = path.join(REPO_ROOT, "assets", "source", "cultivator", "generated");
const OUT_DIR = path.join(REPO_ROOT, "themes", "cultivator", "assets");

const WORKING_FRAME_COUNT = 6;
// Slow enough that raise→strike→recoil reads on the desktop pet
const WORKING_PERIOD = "1.4s";

/**
 * Per-stage knock feedback tier. On strike (~frame 4):
 *   - `scrolls` 祥云卷纹: stylized ruyi cloud-SCROLL curls (thin stroked line motifs,
 *     NOT foggy blobs) unfurl outward from behind the character.
 *   - `halo` 佛光背光 (game-like): soft golden RADIAL glow blooming from center outward.
 *   - `haloRim`: minimal cloud-scroll line motifs decorate the halo rim (top realms).
 *     Clouds stay light decoration — they never form solid/realistic cloud shapes.
 *   - `petals`: lotus petals ring outward (top realms).
 * All FX is procedural here — PNG frames must NOT bake in clouds/halos/sparks/scrolls.
 *
 * MUST escalate monotonically with requiredMerit:
 *   mortal(0) < adept(5) < novice(50) < arhat(150) < bodhisattva(300) < buddha(500)
 *   - 佛光 halo turns on at novice; halo-rim scrolls + lotus petals start at arhat.
 */
const KNOCK_FX_TIER = {
  mortal: { palette: ["#E8CF9A", "#DCC488", "#F0DFB0"], scrolls: 5, base: 6.4, maxScale: 1.9, peak: 0.30, halo: false, haloRim: false, petals: 0, clouds: false, cloudScale: 0, cloudPeak: 0 },
  adept: { palette: ["#EBCF90", "#E0C57E", "#F4E2AE"], scrolls: 5, base: 6.6, maxScale: 2.0, peak: 0.36, halo: false, haloRim: false, petals: 0, clouds: false, cloudScale: 0, cloudPeak: 0 },
  novice: { palette: ["#EFCE7E", "#E4C168", "#F8E4A6"], scrolls: 6, base: 6.8, maxScale: 2.15, peak: 0.42, halo: true, haloRim: false, petals: 0, clouds: true, cloudScale: 1.9, cloudPeak: 0.80 },
  arhat: { palette: ["#F3C95F", "#E7BB48", "#FDE38E"], scrolls: 6, base: 7.0, maxScale: 2.3, peak: 0.48, halo: true, haloRim: true, petals: 3, clouds: true, cloudScale: 2.05, cloudPeak: 0.85 },
  bodhisattva: { palette: ["#F1CC72", "#E6BE58", "#FCE59C"], scrolls: 7, base: 7.2, maxScale: 2.45, peak: 0.52, halo: true, haloRim: true, petals: 5, clouds: true, cloudScale: 2.2, cloudPeak: 0.9 },
  buddha: { palette: ["#F6C948", "#EDBE3A", "#FFE480"], scrolls: 7, base: 7.6, maxScale: 2.7, peak: 0.58, halo: false, haloRim: false, petals: 7, clouds: true, cloudScale: 2.4, cloudPeak: 0.95, bakedHalo: true, noKnock: true },
};

/**
 * Reusable 祥云卷纹 art layer: one AI-generated transparent gold cloud-scroll ring
 * (assets/source/cultivator/fx/cloud-scrolls.png) placed BEHIND the character and
 * bloomed (scale + fade) on the knock strike. Baking clouds into the frames breaks the
 * body-height anchor / uniform scale (see docs/guides/cultivator-asset-pipeline.md), so
 * the clouds live here as a single reusable layer instead. Base64 is cached per process.
 */
const CLOUD_FX_PATH = path.join(REPO_ROOT, "assets", "source", "cultivator", "fx", "cloud-scrolls.png");
let CLOUD_FX_B64 = null;
function cloudFxBase64() {
  if (CLOUD_FX_B64 === null) {
    CLOUD_FX_B64 = fs.existsSync(CLOUD_FX_PATH)
      ? fs.readFileSync(CLOUD_FX_PATH).toString("base64")
      : "";
  }
  return CLOUD_FX_B64;
}

/** Whether this stage shows the AI 祥云 ring bloom on knock. */
function stageHasClouds(stageId) {
  return !!knockFxTier(stageId).clouds && cloudFxBase64().length > 0;
}

function knockFxTier(stageId) {
  return KNOCK_FX_TIER[stageId] || KNOCK_FX_TIER.mortal;
}

/** Persistent 佛光 aura present in BOTH idle and working (halo tiers only).
 *  Buddha bakes an ornate mandorla into the PNG (`bakedHalo`), so skip the soft
 *  procedural circle — stacking both looks muddy. */
function stageHasHalo(stageId) {
  const tier = knockFxTier(stageId);
  return !!tier.halo && !tier.bakedHalo;
}

/** Buddha (and any noKnock stage): working is idle art + 祥云, not 6-frame knock. */
function stageNoKnock(stageId) {
  return !!knockFxTier(stageId).noKnock;
}

/** @deprecated Layered knock only — unused by embedAll. */
const KNOCK_LAYOUT = {
  mortal: {
    canvas: 1024,
    pivotPx: { x: 434, y: 376 },
    fishAnchorPx: { x: 431, y: 558 },
    raiseDeg: -55,
    strikeDeg: 8,
    fx: "ripple",
  },
};

function readManifest() {
  return JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
}

function manifestoViewBox(manifest) {
  return manifest.viewBox || { x: -8, y: -6, width: 32, height: 32 };
}

function workingFramePath(stageId, frameIndex) {
  return path.join(GENERATED_DIR, `${stageId}-working-${frameIndex}.png`);
}

function readWorkingFrameBuffers(stageId) {
  const buffers = [];
  for (let i = 1; i <= WORKING_FRAME_COUNT; i += 1) {
    const framePath = workingFramePath(stageId, i);
    if (!fs.existsSync(framePath)) return null;
    buffers.push(fs.readFileSync(framePath));
  }
  return buffers;
}

/** @deprecated Layered knock only — unused by embedAll. */
function readKnockLayout(stageId) {
  const layoutPath = path.join(GENERATED_DIR, `${stageId}-knock-layout.json`);
  const fallback = KNOCK_LAYOUT[stageId] || null;
  if (!fs.existsSync(layoutPath)) return fallback;
  try {
    return { ...fallback, ...JSON.parse(fs.readFileSync(layoutPath, "utf8")) };
  } catch {
    return fallback;
  }
}

/** @deprecated Layered knock only — unused by embedAll. */
function readLayeredKnockAssets(stageId) {
  const basePath = path.join(GENERATED_DIR, `${stageId}-base.png`);
  const armPath = path.join(GENERATED_DIR, `${stageId}-arm.png`);
  const layout = readKnockLayout(stageId);
  if (!fs.existsSync(basePath) || !fs.existsSync(armPath) || !layout) return null;
  return {
    base: fs.readFileSync(basePath),
    arm: fs.readFileSync(armPath),
    layout,
  };
}

function pxToView(px, py, canvas, viewBox) {
  return {
    x: viewBox.x + (px / canvas) * viewBox.width,
    y: viewBox.y + (py / canvas) * viewBox.height,
  };
}

function workingFrameKeyframes(frameIndex) {
  // Hard opacity cuts with linear timing (not step-end): avoids blank gaps /
  // duplicate-100% bugs on the last frame that look like broken playback.
  const count = WORKING_FRAME_COUNT;
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

/**
 * SMIL opacity cuts for knock frames. CSS @keyframes only run on the <object>
 * channel (and need style-src unsafe-inline); SMIL also animates inside <img>,
 * so the knock loop survives img-channel fallback / strict CSP.
 */
function workingFrameSmil(frameIndex) {
  const count = WORKING_FRAME_COUNT;
  const start = (frameIndex - 1) / count;
  const end = frameIndex / count;
  let keyTimes;
  let values;
  if (frameIndex === 1) {
    keyTimes = `0;${end};${end + 0.000001};1`;
    values = "1;1;0;0";
  } else if (frameIndex === count) {
    keyTimes = `0;${start};${start + 0.000001};1`;
    values = "0;0;1;1";
  } else {
    keyTimes = `0;${start};${start + 0.000001};${end};${end + 0.000001};1`;
    values = "0;0;1;1;0;0";
  }
  return (
    `<animate attributeName="opacity" dur="${WORKING_PERIOD}" repeatCount="indefinite" ` +
    `calcMode="linear" keyTimes="${keyTimes}" values="${values}"/>`
  );
}

/** @deprecated Layered knock only — unused by embedAll. */
function layeredKnockStyle(layout) {
  const raise = Number(layout.raiseDeg) || -50;
  const strike = Number(layout.strikeDeg) || 6;
  const rules = [
    `@keyframes shadow-bob { 0%,100% { transform: scaleX(1); opacity: 0.2; } 50% { transform: scaleX(1.04); opacity: 0.28; } }`,
    `#shadow-js { transform-box: fill-box; transform-origin: center; animation: shadow-bob 3.2s ease-in-out infinite; }`,
    // Raise ~45%, strike ~10%, settle with FX ~45%
    `@keyframes knock-swing {`,
    `  0%, 42% { transform: rotate(${raise}deg); }`,
    `  50% { transform: rotate(${strike}deg); }`,
    `  58% { transform: rotate(${strike * 0.35}deg); }`,
    `  100% { transform: rotate(${raise}deg); }`,
    `}`,
    `#knock-arm-spin { transform-box: fill-box; transform-origin: 0 0; animation: knock-swing ${WORKING_PERIOD} ease-in-out infinite; }`,
    `@keyframes knock-ripple {`,
    `  0%, 48% { transform: scale(0.45); opacity: 0; }`,
    `  52% { transform: scale(0.7); opacity: 0.45; }`,
    `  78% { transform: scale(1.55); opacity: 0.18; }`,
    `  100% { transform: scale(1.9); opacity: 0; }`,
    `}`,
    `#knock-fx .ripple { transform-box: fill-box; transform-origin: center; animation: knock-ripple ${WORKING_PERIOD} ease-out infinite; }`,
    `#knock-fx .ripple-b { transform-box: fill-box; transform-origin: center; animation: knock-ripple ${WORKING_PERIOD} ease-out infinite; animation-delay: 0.06s; }`,
  ];
  return `<style><![CDATA[\n${rules.join("\n")}\n]]></style>`;
}

/** Persistent halo CSS shared by idle + working, so the aura never jumps between states. */
function haloStyleRules(tier) {
  // Boosted so the 佛光 actually reads on the small desktop pet (old values were ~0.18–0.45
  // over a soft gradient → effectively invisible). Still a soft radial that fades to 0.
  const rest = Math.min(0.58, 0.34 + tier.peak * 0.5);
  const bright = Math.min(0.95, 0.6 + tier.peak * 0.55);
  return [
    `@keyframes halo-breathe {`,
    `  0%,100% { transform: scale(0.97); opacity: ${rest.toFixed(2)}; }`,
    `  50% { transform: scale(1.05); opacity: ${bright.toFixed(2)}; }`,
    `}`,
    `#cult-halo { pointer-events: none; }`,
    `#cult-halo .halo-core { transform-box: fill-box; transform-origin: center; animation: halo-breathe 3.6s ease-in-out infinite; }`,
  ];
}

function animationStyle(action, options = {}) {
  const rules = [
    `@keyframes breathe { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-0.3px); } }`,
    `@keyframes shadow-bob { 0%,100% { transform: scaleX(1); opacity: 0.2; } 50% { transform: scaleX(1.04); opacity: 0.28; } }`,
    `#shadow-js { transform-box: fill-box; transform-origin: center; animation: shadow-bob 3.2s ease-in-out infinite; }`,
  ];

  // Persistent 佛光 aura: identical CSS in idle and working → no visual jump.
  if (options.hasHalo) {
    rules.push(...haloStyleRules(options.tier || knockFxTier("mortal")));
  }

  if (action === "working") {
    for (let i = 1; i <= WORKING_FRAME_COUNT; i += 1) {
      rules.push(workingFrameKeyframes(i));
      rules.push(
        `#knock-frame-${i} { animation: knock-frame-${i} ${WORKING_PERIOD} linear infinite; }`
      );
    }
    if (options.cloudFx) {
      const tier = options.tier || knockFxTier("mortal");
      const peak = tier.peak;
      const maxScale = tier.maxScale;
      rules.push(`#knock-fx { pointer-events: none; }`);
      // NOTE: 佛光 halo is now a persistent aura (haloStyleRules), NOT a knock bloom,
      // so it stays identical between idle and working. Only the 祥云 ring / petal bursts
      // below are knock-synced feedback.
      if (tier.clouds) {
        // 祥云卷纹 AI ring blooms out from behind the character on the strike, then fades.
        const cloudPeak = tier.cloudPeak;
        rules.push(
          `@keyframes knock-cloud {`,
          `  0%, 44% { transform: scale(0.5); opacity: 0; }`,
          `  54% { transform: scale(0.92); opacity: ${cloudPeak.toFixed(2)}; }`,
          `  74% { transform: scale(1.12); opacity: ${(cloudPeak * 0.55).toFixed(2)}; }`,
          `  100% { transform: scale(1.3); opacity: 0; }`,
          `}`,
          `#cloud-fx { transform-box: fill-box; transform-origin: center; animation: knock-cloud ${WORKING_PERIOD} ease-out infinite; }`
        );
      } else {
        // 祥云卷纹: cloud-scroll curls unfurl (rotate) and expand outward, then fade.
        rules.push(
          `@keyframes knock-scroll {`,
          `  0%, 46% { transform: scale(0.4) rotate(-8deg); opacity: 0; }`,
          `  56% { transform: scale(1) rotate(2deg); opacity: ${peak.toFixed(2)}; }`,
          `  76% { transform: scale(${(maxScale * 0.72).toFixed(2)}) rotate(8deg); opacity: ${(peak * 0.5).toFixed(2)}; }`,
          `  100% { transform: scale(${maxScale.toFixed(2)}) rotate(12deg); opacity: 0; }`,
          `}`,
          `#knock-fx .scroll { transform-box: fill-box; transform-origin: center; animation: knock-scroll ${WORKING_PERIOD} ease-out infinite; }`,
          `#knock-fx .s-1 { animation-delay: 0.02s; }`,
          `#knock-fx .s-2 { animation-delay: 0.05s; }`,
          `#knock-fx .s-3 { animation-delay: 0.08s; }`,
          `#knock-fx .s-4 { animation-delay: 0.04s; }`,
          `#knock-fx .s-5 { animation-delay: 0.10s; }`,
          `#knock-fx .s-6 { animation-delay: 0.07s; }`,
          `#knock-fx .s-7 { animation-delay: 0.12s; }`
        );
      }
      if (tier.petals > 0) {
        rules.push(
          `@keyframes knock-petal {`,
          `  0%, 48% { transform: scale(0.35); opacity: 0; }`,
          `  58% { transform: scale(1); opacity: ${(peak + 0.15).toFixed(2)}; }`,
          `  100% { transform: scale(1.5); opacity: 0; }`,
          `}`,
          `#knock-fx .petal { transform-box: fill-box; transform-origin: center bottom; animation: knock-petal ${WORKING_PERIOD} ease-out infinite; }`
        );
      }
    }
  } else {
    rules.push(
      `#sprite-js { transform-box: fill-box; transform-origin: 8px 16px; animation: breathe 3.2s ease-in-out infinite; }`
    );
    if (action === "attention") {
      rules.push(
        `@keyframes attention-glow { 0%,100% { transform: translateY(0) scale(1); } 50% { transform: translateY(-0.4px) scale(1.02); } }`,
        `#sprite-js { animation: attention-glow 1.2s ease-in-out infinite; }`
      );
    } else if (action === "error") {
      rules.push(
        `@keyframes sigh { 0%,100% { transform: translateY(0); } 50% { transform: translateY(0.35px); } }`,
        `#sprite-js { animation: sigh 2.2s ease-in-out infinite; }`
      );
    } else if (action === "sleeping") {
      rules.push(
        `@keyframes sleep-breathe { 0%,100% { transform: translateY(0) scaleY(1); } 50% { transform: translateY(0.2px) scaleY(0.98); } }`,
        `#sprite-js { animation: sleep-breathe 3.4s ease-in-out infinite; }`
      );
    }
  }
  return `<style><![CDATA[\n${rules.join("\n")}\n]]></style>`;
}

function rasterImageTag(pngBuffer, viewBox) {
  const base64 = pngBuffer.toString("base64");
  return [
    `<image href="data:image/png;base64,${base64}"`,
    `  x="${viewBox.x}" y="${viewBox.y}" width="${viewBox.width}" height="${viewBox.height}"`,
    `  preserveAspectRatio="xMidYMid meet"/>`,
  ].join("\n");
}

/** Minimal ruyi cloud-scroll curl as a single stroked line motif (~3 units wide). */
const SCROLL_CURL_PATH =
  "M -1.7 0.2 C -0.9 -1.1 0.8 -1.2 1.5 -0.2 C 2.0 0.6 1.4 1.6 0.5 1.6 C -0.1 1.6 -0.3 0.9 0.15 0.7";

/**
 * Persistent 佛光 aura: soft golden radial backlight (+ minimal static cloud-scroll rim
 * for high realms). Rendered behind the character in BOTH idle and working so the aura
 * never appears/disappears between states. Animated only by the shared halo-breathe CSS.
 */
function haloMarkup(viewBox, stageId) {
  const tier = knockFxTier(stageId);
  if (!tier.halo) return "";
  const cx = viewBox.x + viewBox.width / 2;
  const cy = viewBox.y + viewBox.height * 0.42;
  const gid = `buddhalight-${stageId}`;
  const parts = [
    `<g id="cult-halo" pointer-events="none" transform="translate(${cx.toFixed(2)} ${cy.toFixed(2)})">`,
    `  <defs><radialGradient id="${gid}" cx="50%" cy="50%" r="50%">`,
    `    <stop offset="0%" stop-color="${tier.palette[2]}" stop-opacity="1"/>`,
    `    <stop offset="38%" stop-color="${tier.palette[2]}" stop-opacity="0.72"/>`,
    `    <stop offset="66%" stop-color="${tier.palette[0]}" stop-opacity="0.32"/>`,
    `    <stop offset="100%" stop-color="${tier.palette[0]}" stop-opacity="0"/>`,
    `  </radialGradient></defs>`,
    `  <circle class="halo-core" cx="0" cy="0" r="9.8" fill="url(#${gid})"/>`,
  ];
  if (tier.haloRim) {
    const rim = tier.scrolls;
    for (let i = 0; i < rim; i += 1) {
      const a = -Math.PI / 2 + (i / rim) * Math.PI * 2;
      const rx = Math.cos(a) * 7.2;
      const ry = Math.sin(a) * 7.2 * 0.7;
      const rot = (a * 180) / Math.PI + 90;
      parts.push(
        `  <g class="halo-core" transform="translate(${rx.toFixed(2)} ${ry.toFixed(2)}) rotate(${rot.toFixed(1)})">` +
          `<path d="${SCROLL_CURL_PATH}" fill="none" stroke="${tier.palette[0]}" ` +
          `stroke-width="0.9" stroke-linecap="round" transform="scale(0.42)" opacity="0.8"/></g>`
      );
    }
  }
  parts.push(`</g>`);
  return parts.join("\n");
}

/**
 * 祥云卷纹 ring layer (AI art) centered behind the character. Rendered as an <image> in a
 * fill-box group so the knock-cloud CSS can scale/fade it from its own center on strike.
 */
function cloudLayerMarkup(viewBox, stageId) {
  if (!stageHasClouds(stageId)) return "";
  const tier = knockFxTier(stageId);
  const cx = viewBox.x + viewBox.width / 2;
  const cy = viewBox.y + viewBox.height * 0.42;
  const size = viewBox.width * (tier.cloudScale / 2.4) * 0.92; // buddha (2.4) ≈ 0.92*width spread
  const half = size / 2;
  const b64 = cloudFxBase64();
  return [
    `<g id="cloud-fx-pos" pointer-events="none" transform="translate(${cx.toFixed(2)} ${cy.toFixed(2)})">`,
    `  <g id="cloud-fx">`,
    `    <image href="data:image/png;base64,${b64}" x="${(-half).toFixed(2)}" y="${(-half).toFixed(2)}" ` +
      `width="${size.toFixed(2)}" height="${size.toFixed(2)}" preserveAspectRatio="xMidYMid meet"/>`,
    `  </g>`,
    `</g>`,
  ].join("\n");
}

function knockFxMarkup(viewBox, stageId) {
  const tier = knockFxTier(stageId);
  const cx = viewBox.x + viewBox.width / 2;
  const cy = viewBox.y + viewBox.height * 0.42;
  const parts = [
    `<g id="knock-fx" pointer-events="none" transform="translate(${cx.toFixed(2)} ${cy.toFixed(2)})">`,
  ];

  // 祥云卷纹: for cloud-tier stages the ring is the AI art layer (cloudLayerMarkup); only
  // low tiers (mortal/adept) fall back to these procedural line-scroll motifs.
  const n = tier.clouds ? 0 : tier.scrolls;
  for (let i = 0; i < n; i += 1) {
    const angle = -Math.PI / 2 + (i / n) * Math.PI * 2;
    const dist = 2.2 + (i % 3) * 0.8;
    const ox = Math.cos(angle) * dist;
    const oy = Math.sin(angle) * dist * 0.62;
    const rot = (angle * 180) / Math.PI + 90;
    const sc = (tier.base / 6.4) * 0.55 + (i % 2) * 0.12;
    const stroke = tier.palette[i % tier.palette.length];
    const sw = (0.5 / sc).toFixed(2);
    parts.push(
      `  <g transform="translate(${ox.toFixed(2)} ${oy.toFixed(2)}) rotate(${rot.toFixed(1)})">` +
        `<g class="scroll s-${(i % 7) + 1}"><path d="${SCROLL_CURL_PATH}" fill="none" stroke="${stroke}" ` +
        `stroke-width="${sw}" stroke-linecap="round" transform="scale(${sc.toFixed(2)})" opacity="0"/></g></g>`
    );
  }

  // Lotus petals ring outward (top realms) — small teardrop ellipses around center.
  if (tier.petals > 0) {
    for (let p = 0; p < tier.petals; p += 1) {
      const a = (p / tier.petals) * Math.PI * 2 - Math.PI / 2;
      const px = Math.cos(a) * 3.2;
      const py = Math.sin(a) * 2.1;
      const rot = (a * 180) / Math.PI + 90;
      parts.push(
        `  <g transform="translate(${px.toFixed(2)} ${py.toFixed(2)}) rotate(${rot.toFixed(1)})"><g class="petal" opacity="0"><ellipse cx="0" cy="0" rx="0.9" ry="2.1" fill="${tier.palette[0]}"/></g></g>`
      );
    }
  }

  parts.push(`</g>`);
  return parts.join("\n");
}

/**
 * @deprecated Legacy Scheme A: locked base + rotating arm.
 * Not called by embedAll — frame-by-frame full-body knock is the only path.
 */
function wrapKnockLayeredSvg(stageId, baseBuf, armBuf, layout, viewBox) {
  const vb = `${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`;
  const cx = viewBox.x + viewBox.width / 2;
  const by = viewBox.y + viewBox.height - 1.2;
  const canvas = Number(layout.canvas) || 1024;
  const pivot = pxToView(layout.pivotPx.x, layout.pivotPx.y, canvas, viewBox);
  const fish = pxToView(layout.fishAnchorPx.x, layout.fishAnchorPx.y, canvas, viewBox);
  const px = Number(pivot.x.toFixed(3));
  const py = Number(pivot.y.toFixed(3));
  const fx = Number(fish.x.toFixed(3));
  const fy = Number(fish.y.toFixed(3));

  const fxMarkup = [
    `<g id="knock-fx" pointer-events="none" transform="translate(${fx} ${fy})">`,
    `  <circle class="ripple" cx="0" cy="0" r="2.4" fill="none" stroke="#C9A227" stroke-width="0.22" opacity="0"/>`,
    `  <circle class="ripple-b" cx="0" cy="0" r="1.6" fill="none" stroke="#E8D48B" stroke-width="0.14" opacity="0"/>`,
    `</g>`,
  ].join("\n");

  return [
    "<?xml version=\"1.0\" encoding=\"UTF-8\"?>",
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" width="256" height="256">`,
    `<!-- cultivator:${stageId}:working layered knock (scripts/embed-cultivator-ai-svgs.js) -->`,
    layeredKnockStyle(layout),
    `<ellipse id="shadow-js" cx="${cx}" cy="${by}" rx="5.4" ry="1.15" fill="#000" opacity="0.22"/>`,
    fxMarkup,
    `<g id="knock-base" pointer-events="none">${rasterImageTag(baseBuf, viewBox)}</g>`,
    `<g id="knock-arm" pointer-events="none" transform="translate(${px} ${py})">`,
    `  <g id="knock-arm-spin">`,
    `    <g transform="translate(${-px} ${-py})">${rasterImageTag(armBuf, viewBox)}</g>`,
    `  </g>`,
    `</g>`,
    `<g id="eyes-js" opacity="0"><circle cx="8" cy="6.25" r="0.01"/></g>`,
    `<g id="body-js" opacity="0"><circle cx="8" cy="12" r="0.01"/></g>`,
    "</svg>",
    "",
  ].join("\n");
}

function wrapWorkingFramesInSvg(stageId, frameBuffers, viewBox) {
  const vb = `${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`;
  const cx = viewBox.x + viewBox.width / 2;
  const by = viewBox.y + viewBox.height - 1.2;
  const cloudFx = true; // behind-spread auspicious clouds for knock feedback
  const tier = knockFxTier(stageId);
  const frames = frameBuffers
    .map((buf, index) => {
      const frameNum = index + 1;
      // Start all frames at opacity 0 and let SMIL (+ CSS on object channel)
      // drive visibility — avoids a stuck first-frame still if CSS is blocked.
      return (
        `<g id="knock-frame-${frameNum}" opacity="0">` +
        workingFrameSmil(frameNum) +
        rasterImageTag(buf, viewBox) +
        `</g>`
      );
    })
    .join("\n");

  return [
    "<?xml version=\"1.0\" encoding=\"UTF-8\"?>",
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" width="256" height="256">`,
    `<!-- cultivator:${stageId}:working 6 frames + 祥云卷纹/佛光 FX (scripts/embed-cultivator-ai-svgs.js) -->`,
    animationStyle("working", { cloudFx, tier, hasHalo: stageHasHalo(stageId) }),
    `<ellipse id="shadow-js" cx="${cx}" cy="${by}" rx="5.4" ry="1.15" fill="#000" opacity="0.22"/>`,
    haloMarkup(viewBox, stageId),
    cloudLayerMarkup(viewBox, stageId),
    knockFxMarkup(viewBox, stageId),
    `<g id="knock-frames" pointer-events="none">`,
    frames,
    `</g>`,
    `<g id="eyes-js" opacity="0"><circle cx="8" cy="6.25" r="0.01"/></g>`,
    `<g id="body-js" opacity="0"><circle cx="8" cy="12" r="0.01"/></g>`,
    "</svg>",
    "",
  ].join("\n");
}

/**
 * Buddha working — option B「万佛朝圣式」:
 * no wooden-fish knock. Same idle portrait (baked ornate mandorla + lotus) with
 * continuous 祥云 orbit, soft radial halo bloom, and drifting lotus petals.
 */
function wrapNoKnockWorkingSvg(stageId, pngBuffer, viewBox) {
  const vb = `${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`;
  const cx = viewBox.x + viewBox.width / 2;
  const by = viewBox.y + viewBox.height - 1.2;
  const cy = viewBox.y + viewBox.height * 0.42;
  const tier = knockFxTier(stageId);
  const cloudPeak = tier.cloudPeak || 0.9;
  const palette = tier.palette;
  const petalN = Math.max(5, tier.petals || 7);
  const gid = `buddha-bloom-${stageId}`;

  const petals = [];
  for (let p = 0; p < petalN; p += 1) {
    const a = (p / petalN) * Math.PI * 2 - Math.PI / 2;
    const px = Math.cos(a) * (3.0 + (p % 3) * 0.55);
    const py = Math.sin(a) * (2.2 + (p % 2) * 0.4) - 1.2;
    const rot = (a * 180) / Math.PI + 90;
    const delay = (p * 0.28).toFixed(2);
    petals.push(
      `  <g transform="translate(${px.toFixed(2)} ${py.toFixed(2)}) rotate(${rot.toFixed(1)})">` +
        `<ellipse class="petal p-${(p % 5) + 1}" cx="0" cy="0" rx="0.85" ry="1.9" ` +
        `fill="${palette[p % palette.length]}" opacity="0" style="animation-delay:${delay}s"/></g>`
    );
  }

  const style = [
    `<style><![CDATA[`,
    `@keyframes breathe { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-0.25px); } }`,
    `@keyframes shadow-bob { 0%,100% { transform: scaleX(1); opacity: 0.2; } 50% { transform: scaleX(1.04); opacity: 0.28; } }`,
    `#shadow-js { transform-box: fill-box; transform-origin: center; animation: shadow-bob 3.2s ease-in-out infinite; }`,
    `#sprite-js { transform-box: fill-box; transform-origin: 8px 16px; animation: breathe 3.2s ease-in-out infinite; }`,
    // 祥云: slow orbit + breathing scale (always readable).
    `@keyframes cloud-orbit {`,
    `  0% { transform: rotate(0deg) scale(0.95); opacity: ${(cloudPeak * 0.62).toFixed(2)}; }`,
    `  50% { transform: rotate(180deg) scale(1.08); opacity: ${cloudPeak.toFixed(2)}; }`,
    `  100% { transform: rotate(360deg) scale(0.95); opacity: ${(cloudPeak * 0.62).toFixed(2)}; }`,
    `}`,
    `#cloud-fx { transform-box: fill-box; transform-origin: center; animation: cloud-orbit 8s linear infinite; }`,
    // Soft radial bloom behind baked mandorla — expands/contracts (光环外扩).
    `@keyframes halo-bloom {`,
    `  0%,100% { transform: scale(0.92); opacity: 0.35; }`,
    `  50% { transform: scale(1.18); opacity: 0.72; }`,
    `}`,
    `#cult-bloom { pointer-events: none; }`,
    `#cult-bloom .bloom-core { transform-box: fill-box; transform-origin: center; animation: halo-bloom 3.4s ease-in-out infinite; }`,
    // Lotus petals drift outward/up then fade.
    `@keyframes petal-drift {`,
    `  0% { transform: translateY(0) scale(0.55) rotate(-8deg); opacity: 0; }`,
    `  18% { transform: translateY(-1.2px) scale(1) rotate(4deg); opacity: 0.85; }`,
    `  70% { transform: translateY(-4.5px) scale(1.15) rotate(14deg); opacity: 0.4; }`,
    `  100% { transform: translateY(-7px) scale(1.25) rotate(22deg); opacity: 0; }`,
    `}`,
    `#buddha-petals .petal { transform-box: fill-box; transform-origin: center bottom; animation: petal-drift 3.6s ease-out infinite; }`,
    `]]></style>`,
  ].join("\n");

  return [
    "<?xml version=\"1.0\" encoding=\"UTF-8\"?>",
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" width="256" height="256">`,
    `<!-- cultivator:${stageId}:working no-knock 万佛朝圣 (祥云环转 + 光环外扩 + 莲瓣) -->`,
    style,
    `<ellipse id="shadow-js" cx="${cx}" cy="${by}" rx="5.4" ry="1.15" fill="#000" opacity="0.22"/>`,
    `<g id="cult-bloom" pointer-events="none" transform="translate(${cx.toFixed(2)} ${cy.toFixed(2)})">`,
    `  <defs><radialGradient id="${gid}" cx="50%" cy="50%" r="50%">`,
    `    <stop offset="0%" stop-color="${palette[2]}" stop-opacity="0.95"/>`,
    `    <stop offset="45%" stop-color="${palette[0]}" stop-opacity="0.45"/>`,
    `    <stop offset="100%" stop-color="${palette[0]}" stop-opacity="0"/>`,
    `  </radialGradient></defs>`,
    `  <circle class="bloom-core" cx="0" cy="0" r="10.5" fill="url(#${gid})"/>`,
    `</g>`,
    cloudLayerMarkup(viewBox, stageId),
    `<g id="buddha-petals" pointer-events="none" transform="translate(${cx.toFixed(2)} ${cy.toFixed(2)})">`,
    ...petals,
    `</g>`,
    `<g id="sprite-js">`,
    rasterImageTag(pngBuffer, viewBox),
    `</g>`,
    `<g id="eyes-js" opacity="0"><circle cx="8" cy="6.25" r="0.01"/></g>`,
    `<g id="body-js" opacity="0"><circle cx="8" cy="12" r="0.01"/></g>`,
    "</svg>",
    "",
  ].join("\n");
}

function wrapRasterInSvg(stageId, action, pngBuffer, viewBox) {
  const vb = `${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`;
  const cx = viewBox.x + viewBox.width / 2;
  const by = viewBox.y + viewBox.height - 1.2;
  const tier = knockFxTier(stageId);
  const hasHalo = stageHasHalo(stageId);
  return [
    "<?xml version=\"1.0\" encoding=\"UTF-8\"?>",
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" width="256" height="256">`,
    `<!-- cultivator:${stageId}:${action} AI sprite + persistent 佛光 (scripts/embed-cultivator-ai-svgs.js) -->`,
    animationStyle(action, { tier, hasHalo }),
    `<ellipse id="shadow-js" cx="${cx}" cy="${by}" rx="5.4" ry="1.15" fill="#000" opacity="0.22"/>`,
    hasHalo ? haloMarkup(viewBox, stageId) : "",
    `<g id="sprite-js">`,
    rasterImageTag(pngBuffer, viewBox),
    `</g>`,
    `<g id="eyes-js" opacity="0"><circle cx="8" cy="6.25" r="0.01"/></g>`,
    `<g id="body-js" opacity="0"><circle cx="8" cy="12" r="0.01"/></g>`,
    "</svg>",
    "",
  ].join("\n");
}

function embedAll(options = {}) {
  const manifest = readManifest();
  const viewBox = manifestoViewBox(manifest);
  const actions = options.actions || ["idle"];
  const stages = manifest.stages.map((entry) => entry.id);
  let embedded = 0;
  const missing = [];

  if (!options.checkOnly) fs.mkdirSync(OUT_DIR, { recursive: true });

  for (const stageId of stages) {
    for (const action of actions) {
      const svgPath = path.join(OUT_DIR, `${stageId}-${action}.svg`);
      let svg;

      if (action === "working") {
        // Buddha (noKnock): meditation idle art + 祥云 pulse — no wooden-fish 6-frame knock.
        if (stageNoKnock(stageId)) {
          const idlePath = path.join(GENERATED_DIR, `${stageId}-idle.png`);
          if (!fs.existsSync(idlePath)) {
            missing.push(`${stageId}-idle.png (needed for no-knock working)`);
            continue;
          }
          svg = wrapNoKnockWorkingSvg(stageId, fs.readFileSync(idlePath), viewBox);
        } else {
          // Frame-by-frame full-body knock is the ONLY supported path for knock stages:
          // every frame is a complete character at idle scale (body must NOT shrink).
          // The layered base+arm split is intentionally disabled — see
          // docs/guides/cultivator-asset-pipeline.md.
          const frameBuffers = readWorkingFrameBuffers(stageId);
          if (!frameBuffers) {
            missing.push(`${stageId}-working-1..${WORKING_FRAME_COUNT}.png`);
            continue;
          }
          svg = wrapWorkingFramesInSvg(stageId, frameBuffers, viewBox);
        }
      } else {
        let pngPath = path.join(GENERATED_DIR, `${stageId}-${action}.png`);
        if (!fs.existsSync(pngPath)) {
          // Consistency fallback: reuse the clean idle raster for static states that have
          // no dedicated art (attention/error/sleeping). The per-action CSS motion +
          // persistent halo still differentiate them, and this guarantees the body/aura
          // never diverge from idle.
          const idleFallback = path.join(GENERATED_DIR, `${stageId}-idle.png`);
          if (action !== "idle" && fs.existsSync(idleFallback)) {
            pngPath = idleFallback;
          } else {
            missing.push(`${stageId}-${action}.png`);
            continue;
          }
        }
        svg = wrapRasterInSvg(stageId, action, fs.readFileSync(pngPath), viewBox);
      }

      if (options.checkOnly) {
        if (!fs.existsSync(svgPath)) {
          missing.push(`${stageId}-${action}.svg (not embedded)`);
          continue;
        }
        const existing = fs.readFileSync(svgPath, "utf8");
        if (existing !== svg) missing.push(`${stageId}-${action}.svg (drift)`);
        else embedded += 1;
      } else {
        fs.writeFileSync(svgPath, svg, "utf8");
        embedded += 1;
      }
    }
  }

  return { embedded, missing, expected: stages.length * actions.length };
}

function main(argv = process.argv.slice(2)) {
  const checkOnly = argv.includes("--check");
  const actionsArg = argv.find((a) => a.startsWith("--actions="));
  const actions = actionsArg
    ? actionsArg.slice("--actions=".length).split(",").filter(Boolean)
    : ["idle"];

  const result = embedAll({ checkOnly, actions });
  if (result.missing.length > 0 && checkOnly) {
    console.error("cultivator AI embed check failed:");
    for (const item of result.missing) console.error(`  - ${item}`);
    process.exit(1);
  }
  if (checkOnly) {
    console.log(`cultivator AI embed check ok (${result.embedded} file(s))`);
    return;
  }
  if (result.missing.length) {
    console.error("cultivator AI embed missing inputs:");
    for (const item of result.missing) console.error(`  - ${item}`);
  }
  if (result.embedded === 0) {
    console.error("no sprites embedded");
    process.exit(1);
  }
  console.log(`embedded ${result.embedded} AI sprite(s) into ${OUT_DIR}`);
}

if (require.main === module) main();

module.exports = {
  embedAll,
  wrapRasterInSvg,
  wrapWorkingFramesInSvg,
  wrapKnockLayeredSvg,
  animationStyle,
  readWorkingFrameBuffers,
  readLayeredKnockAssets,
  KNOCK_LAYOUT,
  WORKING_FRAME_COUNT,
  GENERATED_DIR,
  OUT_DIR,
};
