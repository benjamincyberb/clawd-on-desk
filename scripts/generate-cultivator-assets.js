"use strict";

const fs = require("node:fs");
const path = require("node:path");

const REPO_ROOT = path.resolve(__dirname, "..");
const MANIFEST_PATH = path.join(REPO_ROOT, "assets", "source", "cultivator", "manifest.json");
const OUT_DIR = path.join(REPO_ROOT, "themes", "cultivator", "assets");
const AI_GENERATED_DIR = path.join(REPO_ROOT, "assets", "source", "cultivator", "generated");

function readManifest() {
  return JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
}

function resolvePalette(stage, manifest) {
  const guide = manifest.styleGuide || {};
  const p = stage.palette || {};
  return {
    ...p,
    outline: guide.outline || "#1A1208",
    outlineWidth: Number(guide.outlineWidth) || 0.38,
    innerRobe: guide.innerRobe || p.robe || "#F5D76E",
    innerRobeDark: guide.innerRobeDark || p.robeDark || "#D4A843",
    kasayaRed: guide.kasayaRed || "#B83232",
    kasayaGrid: guide.kasayaGrid || "#F1C40F",
    blush: guide.blush || "#F4A6A0",
    cloud: guide.cloud || "#FFF8F0",
    bindi: guide.bindi || "#C0392B",
  };
}

function strokeAttrs(palette) {
  return `stroke="${palette.outline}" stroke-width="${palette.outlineWidth}" stroke-linejoin="round"`;
}

function accessoryBeads(palette) {
  const s = strokeAttrs(palette);
  return [
    `<g id="beads">`,
    `  <path d="M5.2 9.5 Q8 11.8 10.8 9.5" fill="none" stroke="${palette.outline}" stroke-width="0.45"/>`,
    `  <circle cx="5.2" cy="9.5" r="0.5" fill="${palette.gold}" ${s}/>`,
    `  <circle cx="8" cy="11" r="0.5" fill="${palette.gold}" ${s}/>`,
    `  <circle cx="10.8" cy="9.5" r="0.5" fill="${palette.gold}" ${s}/>`,
    `</g>`,
  ].join("\n");
}

function accessoryCenser(palette) {
  return [
    `<g id="censer" transform="translate(12.8,12.5)">`,
    `  <rect x="-1.1" y="0" width="2.2" height="1.4" rx="0.3" fill="${palette.wood}"/>`,
    `  <rect x="-0.35" y="-1.4" width="0.7" height="1.5" fill="${palette.gold}"/>`,
    `  <circle class="smoke" cx="0" cy="-2.2" r="0.55" fill="${palette.accent}" opacity="0.55"/>`,
    `</g>`,
  ].join("\n");
}

function accessoryLotus(palette) {
  return [
    `<g id="lotus" transform="translate(8,18.2)">`,
    `  <ellipse cx="0" cy="0" rx="4.2" ry="1.1" fill="${palette.gold}" opacity="0.85"/>`,
    `  <path d="M-2.8 0 Q-1.4 -1.8 0 -0.6 Q1.4 -1.8 2.8 0" fill="${palette.accent}" opacity="0.7"/>`,
    `  <path d="M-1.8 0.2 Q0 -2.2 1.8 0.2" fill="${palette.gold}" opacity="0.55"/>`,
    `</g>`,
  ].join("\n");
}

function accessoryCandle(palette) {
  return [
    `<g id="candle" transform="translate(1.2,11.8)">`,
    `  <rect x="0" y="0" width="1.2" height="3.2" rx="0.2" fill="${palette.wood}"/>`,
    `  <ellipse cx="0.6" cy="-0.4" rx="0.35" ry="0.55" fill="${palette.gold}" opacity="0.9"/>`,
    `  <circle class="smoke" cx="0.6" cy="-1.2" r="0.4" fill="${palette.accent}" opacity="0.5"/>`,
    `</g>`,
  ].join("\n");
}

function accessoryBell(palette) {
  return [
    `<g id="bell" transform="translate(13.8,10.2)">`,
    `  <path d="M0 0 Q1.2 0.8 0 2.4 Q-1.2 0.8 0 0" fill="${palette.gold}"/>`,
    `  <circle cx="0" cy="2.6" r="0.35" fill="${palette.robeDark}"/>`,
    `</g>`,
  ].join("\n");
}

function accessoryKasaya(palette, stageId) {
  const s = strokeAttrs(palette);
  if (stageId === "bodhisattva") {
    return [
      `<g id="kasaya">`,
      `  <path d="M2.4 11.2 L13.6 11.2 L12.6 15.2 L3.4 15.2 Z" fill="${palette.kasayaRed}" ${s}/>`,
      `  <path d="M3.2 11.8 H12.8" stroke="${palette.kasayaGrid}" stroke-width="0.35"/>`,
      `  <path d="M4 12.6 H12" stroke="${palette.kasayaGrid}" stroke-width="0.35"/>`,
      `  <path d="M4.8 13.4 H11.2" stroke="${palette.kasayaGrid}" stroke-width="0.35"/>`,
      `  <path d="M5.6 14.2 H10.4" stroke="${palette.kasayaGrid}" stroke-width="0.35"/>`,
      `</g>`,
    ].join("\n");
  }
  return [
    `<g id="kasaya">`,
    `  <path d="M2.6 11.3 L13.4 11.3 L12.5 14.6 L3.5 14.6 Z" fill="${palette.gold}" opacity="0.35" ${s}/>`,
    `  <path d="M3.2 11.8 L12.8 11.8" fill="none" stroke="${palette.gold}" stroke-width="0.45"/>`,
    `</g>`,
  ].join("\n");
}

function accessoryAura(palette) {
  return [
    `<circle class="aura" cx="8" cy="10" r="6.8" fill="none" stroke="${palette.gold}" stroke-width="0.45" opacity="0.35"/>`,
    `<circle class="aura" cx="8" cy="10" r="5.4" fill="none" stroke="${palette.accent}" stroke-width="0.35" opacity="0.25"/>`,
  ].join("\n");
}

function accessoryClouds(palette) {
  const fill = palette.cloud || palette.accent;
  const s = strokeAttrs(palette);
  return [
    `<g id="clouds" opacity="0.7">`,
    `  <ellipse cx="2.2" cy="4.0" rx="2.0" ry="0.7" fill="${fill}" ${s}/>`,
    `  <ellipse cx="13.8" cy="3.6" rx="2.2" ry="0.75" fill="${fill}" ${s}/>`,
    `  <ellipse cx="8" cy="2.2" rx="3.0" ry="0.6" fill="${palette.gold}" opacity="0.35" ${s}/>`,
    `</g>`,
  ].join("\n");
}

function accessoryPreciousRobe(palette) {
  return [
    `<g id="precious-robe">`,
    `  <path d="M3.2 10.8 L12.8 10.8 L13.5 16.2 L2.5 16.2 Z" fill="${palette.gold}" opacity="0.2"/>`,
    `  <path d="M4 11.5 L12 11.5" stroke="${palette.gold}" stroke-width="0.4" fill="none"/>`,
    `  <circle cx="6" cy="13.2" r="0.35" fill="${palette.gold}"/>`,
    `  <circle cx="8" cy="14" r="0.35" fill="${palette.accent}"/>`,
    `  <circle cx="10" cy="13.2" r="0.35" fill="${palette.gold}"/>`,
    `</g>`,
  ].join("\n");
}

function accessoryLotusHalo(palette) {
  return [
    `<g id="lotus-halo" transform="translate(8,5.8)">`,
    `  <ellipse cx="0" cy="0" rx="4.5" ry="1.2" fill="none" stroke="${palette.gold}" stroke-width="0.5" opacity="0.8"/>`,
    `  <path d="M-3.5 0.2 Q-1.8 -1.5 0 0.2 Q1.8 -1.5 3.5 0.2" fill="${palette.accent}" opacity="0.5"/>`,
    `  <path d="M-2.2 0.4 Q0 -1.8 2.2 0.4" fill="${palette.gold}" opacity="0.4"/>`,
    `</g>`,
  ].join("\n");
}

function accessoryLotusSeat(palette) {
  return [
    `<g id="lotus-seat" transform="translate(8,18.2)">`,
    `  <ellipse cx="0" cy="0" rx="5.5" ry="1.35" fill="${palette.gold}" opacity="0.9"/>`,
    `  <path d="M-3.8 0.2 Q-1.8 -2.2 0 -0.5 Q1.8 -2.2 3.8 0.2" fill="${palette.accent}" opacity="0.75"/>`,
    `  <path d="M-2.5 0.4 Q0 -2.8 2.5 0.4" fill="${palette.gold}" opacity="0.55"/>`,
    `  <ellipse cx="0" cy="0.3" rx="3.2" ry="0.75" fill="${palette.accent}" opacity="0.45"/>`,
    `</g>`,
  ].join("\n");
}

function accessoryMoralRing(palette, stageId) {
  const rx = stageId === "buddha" ? 8.4 : (stageId === "bodhisattva" ? 7.8 : 6.9);
  const ry = stageId === "buddha" ? 7.8 : (stageId === "bodhisattva" ? 7.2 : 6.3);
  const innerRx = stageId === "buddha" ? 7.2 : (stageId === "bodhisattva" ? 6.6 : 5.7);
  const innerRy = stageId === "buddha" ? 6.6 : (stageId === "bodhisattva" ? 6.0 : 5.1);
  return [
    `<g id="moral-ring" opacity="0.85">`,
    `  <ellipse cx="8" cy="9" rx="${rx}" ry="${ry}" fill="${palette.gold}" opacity="0.14"/>`,
    `  <ellipse cx="8" cy="9" rx="${rx - 0.7}" ry="${ry - 0.7}" fill="none" stroke="${palette.gold}" stroke-width="0.8"/>`,
    `  <ellipse cx="8" cy="9" rx="${innerRx}" ry="${innerRy}" fill="none" stroke="${palette.accent}" stroke-width="0.5" opacity="0.75"/>`,
    `</g>`,
  ].join("\n");
}

function accessoryCrown(palette) {
  const s = strokeAttrs(palette);
  return [
    `<g id="crown">`,
    `  <path d="M4.8 4.9 L5.8 2.2 L8 3.4 L10.2 2.2 L11.2 4.9 Z" fill="${palette.gold}" ${s}/>`,
    `  <rect x="5.1" y="4.7" width="5.8" height="1.1" rx="0.25" fill="${palette.gold}" ${s}/>`,
    `  <circle cx="6.2" cy="3.0" r="0.35" fill="${palette.accent}" ${s}/>`,
    `  <circle cx="8" cy="2.6" r="0.4" fill="${palette.kasayaRed || "#C0392B"}" ${s}/>`,
    `  <circle cx="9.8" cy="3.0" r="0.35" fill="${palette.accent}" ${s}/>`,
    `</g>`,
  ].join("\n");
}

function accessoryThrone(palette) {
  return accessoryLotusSeat(palette);
}

function accessoryRadiance(palette) {
  return [
    `<g id="radiance" opacity="0.45">`,
    `  <circle cx="8" cy="9" r="7.5" fill="${palette.gold}" opacity="0.15"/>`,
    `  <path d="M8 1.5 L8.3 4.5 M8 14.5 L8.3 11.5 M1.5 9 L4.5 8.7 M14.5 9 L11.5 8.7" stroke="${palette.gold}" stroke-width="0.4"/>`,
    `  <path d="M3.2 3.2 L5.2 5 M10.8 3.2 L12.8 5 M3.2 14.8 L5.2 12.8 M10.8 14.8 L12.8 12.8" stroke="${palette.accent}" stroke-width="0.35"/>`,
    `</g>`,
  ].join("\n");
}

function accessoryPetals(palette) {
  return [
    `<g id="petals" opacity="0.7">`,
    `  <ellipse cx="3" cy="3.5" rx="0.5" ry="0.9" fill="${palette.accent}" transform="rotate(-25 3 3.5)"/>`,
    `  <ellipse cx="13" cy="4" rx="0.45" ry="0.85" fill="${palette.gold}" transform="rotate(20 13 4)"/>`,
    `  <ellipse cx="5.5" cy="2" rx="0.4" ry="0.75" fill="${palette.accent}" transform="rotate(-10 5.5 2)"/>`,
    `  <ellipse cx="10.5" cy="2.2" rx="0.4" ry="0.7" fill="${palette.gold}" transform="rotate(15 10.5 2.2)"/>`,
    `</g>`,
  ].join("\n");
}

function accessoryHalo(palette) {
  return [
    `<circle class="halo-ring" cx="8" cy="6" r="5.6" fill="none" stroke="${palette.gold}" stroke-width="0.65" opacity="0.75"/>`,
    `<circle class="halo-ring" cx="8" cy="6" r="4.8" fill="none" stroke="${palette.accent}" stroke-width="0.4" opacity="0.5"/>`,
  ].join("\n");
}

const ACCESSORY_RENDERERS = {
  beads: accessoryBeads,
  censer: accessoryCenser,
  lotus: accessoryLotus,
  candle: accessoryCandle,
  bell: accessoryBell,
  kasaya: accessoryKasaya,
  aura: accessoryAura,
  clouds: accessoryClouds,
  preciousRobe: accessoryPreciousRobe,
  lotusHalo: accessoryLotusHalo,
  throne: accessoryThrone,
  lotusSeat: accessoryLotusSeat,
  moralRing: accessoryMoralRing,
  crown: accessoryCrown,
  radiance: accessoryRadiance,
  petals: accessoryPetals,
  halo: accessoryHalo,
};

const BACKGROUND_ACCESSORIES = new Set([
  "radiance", "clouds", "petals", "throne", "lotusSeat", "lotus", "moralRing",
]);
const BODY_ACCESSORY_ORDER = [
  "kasaya", "preciousRobe", "crown", "aura", "halo", "lotusHalo",
  "beads", "censer", "candle", "bell",
];

function callAccessory(render, palette, stageId) {
  if (typeof render !== "function") return "";
  if (render.length >= 2) return render(palette, stageId);
  return render(palette);
}

function accessoriesMarkup(stage, palette) {
  const stageId = stage.id;
  const parts = [];
  const seen = new Set();
  for (const key of BODY_ACCESSORY_ORDER) {
    if (!(stage.accessories || []).includes(key)) continue;
    const render = ACCESSORY_RENDERERS[key];
    if (render) {
      parts.push(callAccessory(render, palette, stageId));
      seen.add(key);
    }
  }
  for (const key of stage.accessories || []) {
    if (seen.has(key) || BACKGROUND_ACCESSORIES.has(key)) continue;
    const render = ACCESSORY_RENDERERS[key];
    if (render) parts.push(callAccessory(render, palette, stageId));
  }
  return parts.join("\n");
}

function bodyMarkup(palette, pose, stage) {
  const stageId = stage && stage.id;
  const isMortal = stageId === "mortal";
  const isMonk = stageId && stageId !== "mortal";
  const s = strokeAttrs(palette);
  const robeFill = isMortal ? palette.robe : palette.innerRobe;
  const robeDark = isMortal ? palette.robeDark : palette.innerRobeDark;
  const armStroke = `stroke="${palette.outline}" stroke-width="0.55" stroke-linecap="round" fill="none"`;

  const arms = pose === "celebrate"
    ? `<path d="M3.0 11.8 Q1.2 8.8 4.0 7.5" ${armStroke}/>
       <path d="M13.0 11.8 Q14.8 8.8 12.0 7.5" ${armStroke}/>`
    : pose === "knock"
      ? `<path d="M3.2 12.2 Q2.0 10.6 3.6 9.4" ${armStroke}/>
         <g class="mallet" transform-origin="12.4px 9.6px">
           <path d="M11.0 12.4 L13.6 7.6" stroke="${palette.wood}" stroke-width="0.9" stroke-linecap="round"/>
           <rect x="12.8" y="6.4" width="2.2" height="1.5" rx="0.35" fill="${palette.wood}" ${s}/>
         </g>`
      : `<path d="M3.4 12.4 Q2.4 14.0 4.6 14.6" ${armStroke}/>
         <path d="M12.6 12.4 Q13.6 14.0 11.4 14.6" ${armStroke}/>`;

  const woodfish = (pose === "knock" || pose === "idle" || pose === "chant")
    ? `<g id="woodfish" transform="translate(5.8,14.8)">
         <ellipse cx="2.0" cy="1.2" rx="2.5" ry="1.4" fill="${palette.wood}" ${s}/>
         <ellipse cx="2.0" cy="1.2" rx="1.5" ry="0.75" fill="${robeDark}" opacity="0.35"/>
       </g>`
    : "";

  const legs = [
    `<rect x="4.0" y="17.6" width="2.4" height="1.5" rx="0.4" fill="${robeDark}" ${s}/>`,
    `<rect x="9.6" y="17.6" width="2.4" height="1.5" rx="0.4" fill="${robeDark}" ${s}/>`,
  ].join("\n");

  const robe = isMortal
    ? `<path d="M4.0 12.0 Q8 10.6 12.0 12.0 L12.6 18.4 Q8 19.8 3.4 18.4 Z" fill="${robeFill}" ${s}/>`
    : `<path d="M3.0 11.8 Q8 10.0 13.0 11.8 L13.6 18.6 Q8 20.4 2.4 18.6 Z" fill="${robeFill}" ${s}/>`;

  const hair = isMonk
    ? `<path d="M4.6 5.4 Q8 2.0 11.4 5.4 L11.0 4.6 Q8 3.2 4.6 4.4 Z" fill="${palette.hair}" ${s}/>`
    : "";

  const bindi = (stageId === "arhat" || stageId === "bodhisattva" || stageId === "buddha")
    ? `<circle cx="8" cy="5.4" r="0.38" fill="${palette.bindi}" ${s}/>`
    : "";

  const head = [
    `<circle cx="8" cy="6.3" r="3.6" fill="${palette.skin}" ${s}/>`,
    `<circle cx="5.5" cy="6.9" r="0.6" fill="${palette.blush}" opacity="0.6"/>`,
    `<circle cx="10.5" cy="6.9" r="0.6" fill="${palette.blush}" opacity="0.6"/>`,
    bindi,
    hair,
  ].join("\n");

  return [
    `<ellipse cx="8" cy="19.2" rx="5.2" ry="1.15" fill="rgba(0,0,0,0.16)"/>`,
    legs,
    robe,
    `<path d="M8 11.2 V18.4" stroke="${robeDark}" stroke-width="0.4" opacity="0.45"/>`,
    arms,
    woodfish,
    head,
  ].join("\n");
}

function styleBlock(action, stage) {
  const rules = [
    `@keyframes breathe { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-0.35px); } }`,
    `@keyframes blink { 0%,92%,100% { transform: scaleY(1); } 95% { transform: scaleY(0.12); } }`,
    `#body-js { animation: breathe 3.2s ease-in-out infinite; }`,
    `#eyes-js { transform-origin: 8px 6.2px; animation: blink 4.2s ease-in-out infinite; }`,
  ];
  if (action === "idle") {
    rules.push(
      `@keyframes idle-sway { 0%,100% { transform: rotate(0deg); } 50% { transform: rotate(1.5deg); } }`,
      `#woodfish { transform-origin: 7.8px 16px; animation: idle-sway 4.2s ease-in-out infinite; }`
    );
  }
  if (action === "thinking" || action === "working") {
    const knockMs = action === "working" ? 0.55 : 0.75;
    rules.push(
      `@keyframes knock { 0%,100% { transform: rotate(0deg); } 40% { transform: rotate(-18deg); } 55% { transform: rotate(8deg); } }`,
      `.mallet { animation: knock ${knockMs}s ease-in-out infinite; }`
    );
    if (action === "working") {
      rules.push(
        `@keyframes woodfish-hit { 0%,100% { transform: scale(1); } 45% { transform: scale(1.08); } 55% { transform: scale(0.96); } }`,
        `#woodfish { transform-origin: 7.8px 16px; animation: woodfish-hit ${knockMs}s ease-in-out infinite; }`
      );
    }
  }
  if (action === "attention") {
    rules.push(
      `@keyframes glow { 0%,100% { opacity: 0.35; } 50% { opacity: 0.8; } }`,
      `.halo { animation: glow 1.4s ease-in-out infinite; }`,
      `.halo-ring { animation: glow 1.6s ease-in-out infinite; }`
    );
  }
  if (action === "error") {
    rules.push(
      `@keyframes sigh { 0%,100% { transform: translateY(0); } 50% { transform: translateY(0.45px); } }`,
      `#body-js { animation: sigh 2.4s ease-in-out infinite; }`
    );
  }
  if (action === "sleeping") {
    rules.push(
      `@keyframes zzz { 0% { opacity: 0; transform: translate(0,0); } 60% { opacity: 0.8; } 100% { opacity: 0; transform: translate(1.4px,-2.2px); } }`,
      `.zzz { animation: zzz 2.2s ease-in-out infinite; }`
    );
  }
  if ((stage.accessories || []).includes("aura") || (stage.accessories || []).includes("radiance")
    || (stage.accessories || []).includes("moralRing")) {
    rules.push(
      `@keyframes moral-pulse { 0%,100% { opacity: 0.55; } 50% { opacity: 0.9; } }`,
      `#moral-ring { animation: moral-pulse 3.2s ease-in-out infinite; }`,
      `.aura { animation: moral-pulse 3.2s ease-in-out infinite; }`
    );
  }
  if (action !== "idle" && action !== "sleeping") {
    rules.push(
      `@keyframes smoke { 0%,100% { transform: translateY(0); opacity: 0.4; } 50% { transform: translateY(-1.1px); opacity: 0.75; } }`,
      `.smoke { animation: smoke 2.8s ease-in-out infinite; }`
    );
  }
  return `<style><![CDATA[\n${rules.join("\n")}\n]]></style>`;
}

function eyesMarkup(action, palette) {
  const s = strokeAttrs(palette);
  if (action === "sleeping") {
    return `<path d="M6.0 6.5 H7.5 M8.5 6.5 H10.0" stroke="${palette.outline}" stroke-width="0.5" stroke-linecap="round"/>`;
  }
  if (action === "error") {
    return `<g>
      <ellipse cx="6.4" cy="6.4" rx="0.7" ry="0.85" fill="${palette.hair}" ${s}/>
      <ellipse cx="9.6" cy="6.4" rx="0.7" ry="0.85" fill="${palette.hair}" ${s}/>
      <path d="M5.8 5.4 L7.0 5.9 M10.2 5.4 L9.0 5.9" stroke="${palette.outline}" stroke-width="0.35" fill="none"/>
    </g>`;
  }
  return `<g>
    <ellipse cx="6.4" cy="6.2" rx="0.88" ry="1.05" fill="${palette.hair}" ${s}/>
    <ellipse cx="9.6" cy="6.2" rx="0.88" ry="1.05" fill="${palette.hair}" ${s}/>
    <circle cx="6.7" cy="5.9" r="0.28" fill="#fff"/>
    <circle cx="9.9" cy="5.9" r="0.28" fill="#fff"/>
    <circle cx="6.9" cy="5.7" r="0.12" fill="${palette.outline}"/>
    <circle cx="10.1" cy="5.7" r="0.12" fill="${palette.outline}"/>
  </g>`;
}

function extrasMarkup(action, palette) {
  if (action === "attention") {
    return `<circle class="halo" cx="8" cy="6.2" r="5.1" fill="none" stroke="${palette.gold}" stroke-width="0.55" opacity="0.55"/>`;
  }
  if (action === "sleeping") {
    return `<text class="zzz" x="11.5" y="3.2" font-size="2.2" fill="${palette.gold}" font-family="monospace">z</text>`;
  }
  return "";
}

function poseForAction(action) {
  if (action === "thinking" || action === "working") return "knock";
  if (action === "attention") return "celebrate";
  return "idle";
}

function backgroundMarkup(stage, palette) {
  const stageId = stage.id;
  const parts = [];
  for (const key of stage.accessories || []) {
    if (!BACKGROUND_ACCESSORIES.has(key)) continue;
    const render = ACCESSORY_RENDERERS[key];
    if (render) parts.push(callAccessory(render, palette, stageId));
  }
  return parts.join("\n");
}

function renderSvg(stage, action, viewBox, manifest) {
  const palette = resolvePalette(stage, manifest);
  const pose = poseForAction(action);
  const vb = `${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`;
  const bg = backgroundMarkup(stage, palette);
  const lines = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" width="256" height="256">`,
    `<!-- cultivator:${stage.id}:${action} generated by scripts/generate-cultivator-assets.js -->`,
    styleBlock(action, stage),
    bg ? `<g id="stage-bg">${bg}</g>` : "",
    `<g id="shadow-js" style="transform-origin: 8px 19px">`,
    `  <ellipse cx="8" cy="19.2" rx="5.2" ry="1.15" fill="rgba(0,0,0,0.16)"/>`,
    `</g>`,
    `<g id="body-js">`,
    bodyMarkup(palette, pose, stage).split("\n").filter((line) => !line.includes('cy="19.2"')).join("\n"),
    accessoriesMarkup(stage, palette),
    extrasMarkup(action, palette),
    `</g>`,
    `<g id="eyes-js">`,
    eyesMarkup(action, palette),
    `</g>`,
    `</svg>`,
    ``,
  ];
  return lines.join("\n");
}

function fileName(stageId, action) {
  return `${stageId}-${action}.svg`;
}

function generateAll(manifest) {
  const out = new Map();
  for (const stage of manifest.stages) {
    for (const action of manifest.actions) {
      out.set(fileName(stage.id, action), renderSvg(stage, action, manifestoViewBox(manifest), manifest));
    }
  }
  return out;
}

function manifestoViewBox(manifest) {
  return manifest.viewBox || { x: -8, y: -6, width: 32, height: 32 };
}

function hasAiSprite(stageId, action) {
  return fs.existsSync(path.join(AI_GENERATED_DIR, `${stageId}-${action}.png`));
}

function writeAssets(files, { checkOnly = false, skipAiSprites = true, force = false } = {}) {
  if (!checkOnly) fs.mkdirSync(OUT_DIR, { recursive: true });
  let drift = 0;
  let skipped = 0;
  const skipAi = skipAiSprites && !force;
  for (const [name, content] of [...files.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const match = /^([a-z]+)-([a-z]+)\.svg$/.exec(name);
    if (
      skipAi
      && match
      && hasAiSprite(match[1], match[2])
    ) {
      skipped += 1;
      continue;
    }
    const target = path.join(OUT_DIR, name);
    if (checkOnly) {
      if (!fs.existsSync(target)) {
        console.error(`missing: ${name}`);
        drift += 1;
        continue;
      }
      const existing = fs.readFileSync(target, "utf8");
      if (existing !== content) {
        console.error(`drift: ${name}`);
        drift += 1;
      }
      continue;
    }
    fs.writeFileSync(target, content, "utf8");
  }
  return { drift, skipped };
}

function main(argv = process.argv.slice(2)) {
  const checkOnly = argv.includes("--check");
  const force = argv.includes("--force");
  const manifest = readManifest();
  const files = generateAll(manifest);
  const skipAiSprites = !force;
  const { drift, skipped } = writeAssets(files, { checkOnly, skipAiSprites, force });
  if (checkOnly) {
    if (drift > 0) {
      console.error(`cultivator assets check failed: ${drift} file(s)`);
      process.exit(1);
    }
    const skipNote = skipped > 0 ? `, skipped ${skipped} AI sprite(s)` : "";
    console.log(`cultivator assets check ok (${files.size - skipped} file(s)${skipNote})`);
    return;
  }
  console.log(`wrote ${files.size - skipped} cultivator assets to ${OUT_DIR}${skipped ? ` (skipped ${skipped} AI sprite(s))` : ""}`);
}

if (require.main === module) main();

module.exports = {
  generateAll,
  fileName,
  OUT_DIR,
  MANIFEST_PATH,
  AI_GENERATED_DIR,
  hasAiSprite,
};
