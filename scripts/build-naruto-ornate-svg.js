#!/usr/bin/env node
"use strict";

/**
 * Ornate vector Naruto desk-pet (no copyrighted embeds).
 * Idle + thinking per stage; heavy chakra FX tuned for 32x32 viewBox.
 *
 * Usage: node scripts/build-naruto-ornate-svg.js [--actions idle,thinking]
 */

const fs = require("fs");
const path = require("path");

const REPO_ROOT = path.join(__dirname, "..");
const OUT_DIR = path.join(REPO_ROOT, "themes", "naruto", "assets");

const VB = { x: -8, y: -6, w: 32, h: 32 };
const CX = 8;
const BASELINE = 20;

const STAGES = {
  academy: {
    suit: "#F06B1F",
    suitDark: "#C44E12",
    hair: "#F5C842",
    skin: "#FFE8D6",
    chakra: "#F06B1F",
    auraOpacity: 0.1,
    leaves: true,
    headband: false,
  },
  genin: {
    suit: "#F06B1F",
    suitDark: "#C44E12",
    hair: "#F5C842",
    skin: "#FFE8D6",
    chakra: "#4DB8FF",
    auraOpacity: 0.22,
    clone: true,
    headband: true,
  },
  sage: {
    suit: "#F06B1F",
    suitDark: "#C44E12",
    hair: "#F5C842",
    skin: "#FFE8D6",
    chakra: "#E67E22",
    auraOpacity: 0.3,
    sageMarkings: true,
    headband: true,
    natureDots: 6,
  },
  kcm: {
    suit: "#FFD84A",
    suitDark: "#E6B800",
    hair: "#F5C842",
    skin: "#FFE8D6",
    chakra: "#FFD84A",
    auraOpacity: 0.42,
    cloak: true,
    sealMarks: true,
    headband: true,
    flames: true,
  },
  sixpaths: {
    suit: "#FFD84A",
    suitDark: "#E67E22",
    hair: "#F5C842",
    skin: "#FFE8D6",
    chakra: "#FFD84A",
    auraOpacity: 0.5,
    cloak: true,
    magatama: true,
    orbs: true,
    headband: false,
  },
  kurama: {
    suit: "#FFD84A",
    suitDark: "#C0392B",
    hair: "#F5C842",
    skin: "#FFF5E6",
    chakra: "#C0392B",
    auraOpacity: 0.62,
    cloak: true,
    spiral: true,
    orbs: true,
    kuramaGlow: true,
    headband: false,
  },
};

function defs(gid, cfg) {
  return `<defs>
  <radialGradient id="${gid}-aura" cx="50%" cy="42%" r="50%">
    <stop offset="0%" stop-color="${cfg.chakra}" stop-opacity="0.95"/>
    <stop offset="45%" stop-color="${cfg.chakra}" stop-opacity="0.35"/>
    <stop offset="100%" stop-color="${cfg.chakra}" stop-opacity="0"/>
  </radialGradient>
  <radialGradient id="${gid}-core" cx="50%" cy="50%" r="50%">
    <stop offset="0%" stop-color="#FFFBE8" stop-opacity="0.9"/>
    <stop offset="100%" stop-color="${cfg.chakra}" stop-opacity="0"/>
  </radialGradient>
  <linearGradient id="${gid}-suit" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0%" stop-color="${cfg.suit}"/>
    <stop offset="100%" stop-color="${cfg.suitDark}"/>
  </linearGradient>
  <linearGradient id="${gid}-hair" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stop-color="#FFF3B0"/>
    <stop offset="100%" stop-color="${cfg.hair}"/>
  </linearGradient>
</defs>`;
}

function smilFloat(dur, dist) {
  return `<animateTransform attributeName="transform" type="translate" values="0 0; 0 ${dist}; 0 0" dur="${dur}s" repeatCount="indefinite"/>`;
}

function aura(gid, cfg, thinking) {
  const r = thinking ? 12.5 : 13.5;
  const cy = 10.5;
  return `<g id="aura-js" opacity="${cfg.auraOpacity}">
  <circle cx="${CX}" cy="${cy}" r="${r}" fill="url(#${gid}-aura)">
    <animate attributeName="opacity" values="${cfg.auraOpacity};${Math.min(0.9, cfg.auraOpacity + 0.18)};${cfg.auraOpacity}" dur="2.6s" repeatCount="indefinite"/>
  </circle>
  <circle cx="${CX}" cy="${cy}" r="7" fill="url(#${gid}-core)" opacity="${thinking ? 0.25 : 0.45}"/>
</g>`;
}

function truthSeekerOrbs(cfg) {
  if (!cfg.orbs) return "";
  const pts = [
    [8, 2.0], [12.6, 4.2], [13.8, 8.8], [12.2, 13.6], [8, 15.8], [3.8, 13.6], [2.2, 8.8], [3.4, 4.2],
  ];
  const body = pts
    .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="0.62" fill="#1C1C22" stroke="${cfg.chakra}" stroke-width="0.18" opacity="0.95"/>`)
    .join("");
  return `<g id="orbs-js">
  <animateTransform attributeName="transform" type="rotate" values="0 8 10;360 8 10" dur="14s" repeatCount="indefinite"/>
  ${body}
</g>`;
}

function natureParticles(cfg) {
  if (!cfg.natureDots) return "";
  const pts = [
    [3, 16, 2.1], [13, 15, 2.7], [2.5, 7, 3.2], [13.5, 5, 2.4], [5, 2.5, 2.9], [11, 2.8, 2.2],
  ];
  return `<g id="nature-js">${pts
    .map(
      ([x, y, d], i) => `<circle cx="${x}" cy="${y}" r="0.42" fill="${cfg.chakra}" opacity="0.8">
    <animate attributeName="opacity" values="0.2;0.9;0.2" dur="${d}s" begin="${i * 0.35}s" repeatCount="indefinite"/>
  </circle>`
    )
    .join("")}
</g>`;
}

function leaves(cfg) {
  if (!cfg.leaves) return "";
  return `<g id="leaves-js" fill="#4A7C3F" opacity="0.85">
  <path d="M2 3 Q2.8 2.2 3.6 3 Q2.8 3.8 2 3 Z"><animateTransform attributeName="transform" type="translate" values="0 0;1.2 2.4;0 0" dur="5s" repeatCount="indefinite"/></path>
  <path d="M13 5 Q13.8 4.2 14.6 5 Q13.8 5.8 13 5 Z"><animateTransform attributeName="transform" type="translate" values="0 0;-1 2.8;0 0" dur="6s" begin="1s" repeatCount="indefinite"/></path>
</g>`;
}

function cloneAfterimage(cfg) {
  if (!cfg.clone) return "";
  return `<g id="clone-js" opacity="0.28" transform="translate(3.4,0.6)">
  <animate attributeName="opacity" values="0.18;0.34;0.18" dur="1.8s" repeatCount="indefinite"/>
  <ellipse cx="8" cy="19.4" rx="3.4" ry="0.7" fill="#000" opacity="0.12"/>
  <path d="M4.4 11.5 Q4.2 17 6.2 18.8 L9.8 18.8 Q11.8 17 11.6 11.5 Z" fill="${cfg.suit}"/>
  <circle cx="8" cy="7.4" r="2.7" fill="${cfg.skin}"/>
</g>`;
}

function cloakFX(cfg) {
  if (!cfg.cloak) return "";
  const flame = cfg.flames
    ? `<g id="flames-js" fill="${cfg.chakra}" opacity="0.5">
      <path d="M2.5 15 Q1.8 12.5 2.8 11 Q3.2 13 2.5 15Z"/>
      <path d="M13.5 14 Q14.3 11.5 13.2 10.6 Q12.8 13 13.5 14Z"/>
    </g>`
    : "";
  return `<g id="cloak-js" fill="none" stroke="${cfg.chakra}" stroke-width="0.55" opacity="0.85">
  <path d="M3.2 18.5 Q2.2 14.5 4.4 10.8" stroke-linecap="round"/>
  <path d="M12.8 18.5 Q13.8 14.5 11.6 10.8" stroke-linecap="round"/>
  <path d="M4.5 9.5 Q8 7.2 11.5 9.5" stroke-linecap="round" opacity="0.5"/>
</g>${flame}`;
}

function kuramaSilhouette(cfg) {
  if (!cfg.kuramaGlow) return "";
  return `<g id="kurama-js" opacity="0.3" fill="${cfg.chakra}">
  <animate attributeName="opacity" values="0.22;0.38;0.22" dur="3s" repeatCount="indefinite"/>
  <path d="M4.5 3.2 L5.8 5.4 L4.2 5.8 Z M11.5 3.2 L10.2 5.4 L11.8 5.8 Z"/>
  <ellipse cx="8" cy="7.8" rx="5.6" ry="4.2" opacity="0.25"/>
</g>`;
}

function magatama(cfg) {
  if (!cfg.magatama) return "";
  return `<g id="magatama-js" fill="#1C1C22">
  <path d="M6 11.8 a0.7 0.7 0 1 0 0.6 1.2 a0.9 0.9 0 1 1 -0.6 -1.2Z"/>
  <path d="M8 12.6 a0.7 0.7 0 1 0 0.6 1.2 a0.9 0.9 0 1 1 -0.6 -1.2Z"/>
  <path d="M10 11.8 a0.7 0.7 0 1 0 0.6 1.2 a0.9 0.9 0 1 1 -0.6 -1.2Z"/>
</g>`;
}

function headband(cfg) {
  if (!cfg.headband) return "";
  return `<g id="headband-js">
  <rect x="4.1" y="4.55" width="7.8" height="1.05" rx="0.22" fill="#23262B" stroke="#1A1208" stroke-width="0.18"/>
  <rect x="6.35" y="4.72" width="3.3" height="0.72" rx="0.12" fill="#C8CDD4" stroke="#1A1208" stroke-width="0.14"/>
  <path d="M7.2 5.08 a0.5 0.5 0 1 1 1 0 a0.28 0.28 0 1 0 -0.56 0" fill="none" stroke="#1A1208" stroke-width="0.12"/>
</g>`;
}

function face(cfg, thinking) {
  const outline = "#1A1208";
  const whisk = `<path d="M4.55 7.35h1.35M4.65 8.05h1.25M4.75 8.75h1.15M10.1 7.35h1.35M10.1 8.05h1.25M10.1 8.75h1.15"
    stroke="${outline}" stroke-width="0.2" stroke-linecap="round" opacity="0.8"/>`;
  const sage = cfg.sageMarkings
    ? `<ellipse cx="5.25" cy="7.6" rx="0.62" ry="0.95" fill="${cfg.chakra}" opacity="0.9"/>
       <ellipse cx="10.75" cy="7.6" rx="0.62" ry="0.95" fill="${cfg.chakra}" opacity="0.9"/>`
    : "";
  const eyes = thinking
    ? `<g id="eyes-js">
      <ellipse cx="6" cy="7.1" rx="0.5" ry="0.55" fill="#fff" stroke="${outline}" stroke-width="0.22"/>
      <circle cx="6" cy="7.15" r="0.24" fill="${outline}"/>
      <ellipse cx="10" cy="7.1" rx="0.5" ry="0.55" fill="#fff" stroke="${outline}" stroke-width="0.22"/>
      <circle cx="10" cy="7.15" r="0.24" fill="${outline}"/>
      <path d="M5.4 6.4 Q6 6.05 6.6 6.4 M9.4 6.4 Q10 6.05 10.6 6.4" fill="none" stroke="${outline}" stroke-width="0.24" stroke-linecap="round"/>
    </g>`
    : `<g id="eyes-js">
      <ellipse cx="6" cy="7.05" rx="0.52" ry="0.58" fill="#fff" stroke="${outline}" stroke-width="0.22"/>
      <circle cx="6" cy="7.1" r="0.25" fill="${outline}"/>
      <circle cx="6.12" cy="6.95" r="0.08" fill="#fff"/>
      <ellipse cx="10" cy="7.05" rx="0.52" ry="0.58" fill="#fff" stroke="${outline}" stroke-width="0.22"/>
      <circle cx="10" cy="7.1" r="0.25" fill="${outline}"/>
      <circle cx="10.12" cy="6.95" r="0.08" fill="#fff"/>
    </g>`;
  const mouth = thinking
    ? `<path d="M7.3 9.35 Q8 9.05 8.7 9.35" fill="none" stroke="${outline}" stroke-width="0.26" stroke-linecap="round"/>`
    : `<path d="M7.2 9.25 Q8 9.75 8.8 9.25" fill="none" stroke="${outline}" stroke-width="0.26" stroke-linecap="round"/>`;
  return `${sage}${eyes}${whisk}${mouth}`;
}

function hair(cfg) {
  return `<path id="hair-js"
    d="M4.9 5.1 Q4.1 3.1 5.6 2.3 Q6.5 3.5 7.1 4.1 Q7.5 2.1 8.1 1.7 Q8.7 2.1 8.9 4 Q9.8 2.7 11 2.5 Q11.6 3.9 10.7 5.2 Q11.9 5.5 11.7 6.5 Q10.3 6.1 8 6 Q5.7 6.1 4.3 6.6 Q4.2 5.6 4.9 5.1 Z"
    fill="url(#HAIR)" stroke="#1A1208" stroke-width="0.24"/>`;
}

function body(cfg, thinking) {
  const outline = "#1A1208";
  const lean = thinking ? `transform="rotate(-3 8 12)"` : "";
  const handToChin = thinking
    ? `<g id="hand-chin">
      <path d="M11.8 12.8 Q13.2 10 10.6 8.7" fill="none" stroke="${cfg.skin}" stroke-width="1.05" stroke-linecap="round"/>
      <circle cx="10.5" cy="8.55" r="0.52" fill="${cfg.skin}" stroke="${outline}" stroke-width="0.18"/>
    </g>`
    : "";
  const arms = thinking
    ? handToChin
    : `<g id="arms">
      <ellipse cx="3.7" cy="13.6" rx="1.05" ry="1.55" fill="${cfg.suit}" stroke="${outline}" stroke-width="0.26"/>
      <ellipse cx="12.3" cy="13.6" rx="1.05" ry="1.55" fill="${cfg.suit}" stroke="${outline}" stroke-width="0.26"/>
    </g>`;
  return `<g id="body-js" ${lean}>
  <ellipse cx="6.1" cy="18.3" rx="1.25" ry="1.5" fill="#23262B" stroke="${outline}" stroke-width="0.26"/>
  <ellipse cx="9.9" cy="18.3" rx="1.25" ry="1.5" fill="#23262B" stroke="${outline}" stroke-width="0.26"/>
  <path d="M4.1 11.3 Q3.9 16.9 6 18.7 L10 18.7 Q12.1 16.9 11.9 11.3 Z"
    fill="url(#SUIT)" stroke="${outline}" stroke-width="0.3"/>
  <path d="M5.2 11.6 L8 17.4 L10.8 11.6" fill="${cfg.suitDark}" opacity="0.4"/>
  ${magatama(cfg)}
  ${arms}
</g>`;
}

function spiral(cfg) {
  if (!cfg.spiral) return "";
  return `<path d="M6.2 12.5 a1.6 1.6 0 1 0 1.6 2.6 a1.1 1.1 0 1 1 -0.9 -1.9" fill="none" stroke="${cfg.chakra}" stroke-width="0.3" opacity="0.85"/>`;
}

function build(stageId, action) {
  const cfg = STAGES[stageId];
  const thinking = action === "thinking";
  const gid = `nrt-${stageId}-${action}`;
  const style = `<style><![CDATA[
@keyframes breathe { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-0.3px); } }
#whole-js { animation: breathe 2.4s ease-in-out infinite; transform-box: fill-box; transform-origin: center bottom; }
]]></style>`;

  const bg = `${aura(gid, cfg, thinking)}${kuramaSilhouette(cfg)}${truthSeekerOrbs(cfg)}${natureParticles(cfg)}${leaves(cfg)}`;
  const figure = `${cloneAfterimage(cfg)}<g id="whole-js">
  ${smilFloat(2.4, -0.3)}
  ${cloakFX(cfg)}
  ${body(cfg, thinking).replace("url(#SUIT)", `url(#${gid}-suit)`)}
  ${spiral(cfg)}
  <circle cx="${CX}" cy="7" r="3.15" fill="${cfg.skin}" stroke="#1A1208" stroke-width="0.3"/>
  ${hair(cfg).replace("url(#HAIR)", `url(#${gid}-hair)`)}
  ${headband(cfg)}
  ${face(cfg, thinking)}
</g>`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="${VB.x} ${VB.y} ${VB.w} ${VB.h}" width="256" height="256">
<!-- naruto:${stageId}:${action} ornate vector (scripts/build-naruto-ornate-svg.js) -->
${style}
${defs(gid, cfg)}
<ellipse id="shadow-js" cx="${CX}" cy="19.5" rx="5.6" ry="1.1" fill="#000" opacity="0.24"/>
${bg}
${figure}
</svg>
`;
}

function main() {
  const arg = process.argv.find((a) => a.startsWith("--actions="));
  const actions = arg ? arg.split("=")[1].split(",") : ["idle", "thinking"];
  fs.mkdirSync(OUT_DIR, { recursive: true });
  let n = 0;
  for (const stageId of Object.keys(STAGES)) {
    for (const action of actions) {
      fs.writeFileSync(path.join(OUT_DIR, `${stageId}-${action}.svg`), build(stageId, action), "utf8");
      n += 1;
    }
  }
  console.log(`ornate: wrote ${n} svg(s) (${actions.join("/")}) → ${path.relative(REPO_ROOT, OUT_DIR)}`);
}

main();
