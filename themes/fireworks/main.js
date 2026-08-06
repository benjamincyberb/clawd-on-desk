"use strict";

/**
 * Demolition Nova v11 — B-tier illustration 祈年殿 (code, not photo).
 * Offscreen Canvas 2.5× paint → Phaser texture. Idle look is the acceptance bar;
 * click still runs the four demolition modes (smoke-check only this round).
 */

const badgeEl = document.getElementById("badge");

const MAX_P = 1800;
const MAX_GLOW = 32;
const MAX_SHOCK = 18;
const MAX_DEBRIS = 110;
const MAX_DUST = 140;
const MAX_CHUNKS = 72;

const MODES = ["tier", "shatter", "lean", "core"];
const MODE_LABEL = {
  tier: "分层剥落",
  shatter: "碎裂崩解",
  lean: "倾塌砸碎",
  core: "向心爆轰",
};

const PAL = {
  blueDeep: "#0f2f7a",
  blue: "#1a4fb8",
  blueMid: "#2a6ad4",
  blueLite: "#5a9aef",
  blueHi: "#9ec8ff",
  redDeep: "#6e1210",
  red: "#c42822",
  redLite: "#e84838",
  gold: "#e8b84a",
  goldLite: "#ffe29a",
  goldDeep: "#b8862a",
  frieze: "#1e6a9a",
  friezeG: "#2a8a6a",
  stone: "#e8e2d6",
  stoneMid: "#cfc7b8",
  stoneDark: "#9a9286",
  wood: "#4a2818",
};

let sceneRef = null;
let ready = false;
let combo = 0;
let comboTimer = 0;
let modeIdx = 0;

function setBadge(t) {
  if (badgeEl) badgeEl.textContent = String(t || "祈年殿");
}

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function room(arr, max) {
  return Math.max(0, max - arr.length);
}

function rgba(hex, a) {
  const n = hex.replace("#", "");
  const r = parseInt(n.slice(0, 2), 16);
  const g = parseInt(n.slice(2, 4), 16);
  const b = parseInt(n.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

/** Paint a detailed 祈年殿 into a canvas (B-tier illustration — code, not photo). */
function paintTemple(W, H) {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, W, H);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  const cx = W * 0.5;
  const ground = H * 0.935;
  const top = H * 0.045;
  const tall = ground - top;

  // Soft ground shadow
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.32)";
  ctx.beginPath();
  ctx.ellipse(cx, ground + 4, W * 0.4, 16, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // --- Three marble terraces (bottom → top), thick discs ---
  const terraces = [
    { y: ground - tall * 0.01, r: W * 0.41, h: tall * 0.032 },
    { y: ground - tall * 0.052, r: W * 0.345, h: tall * 0.03 },
    { y: ground - tall * 0.094, r: W * 0.285, h: tall * 0.028 },
  ];
  for (let ti = 0; ti < terraces.length; ti++) {
    drawTerrace(ctx, cx, terraces[ti], ti);
  }

  const hallBot = terraces[2].y - terraces[2].h - 1;
  // Hall under lowest eave; roofs leave clear inter-eave gaps
  const roofs = [
    { peak: top + tall * 0.055, eave: top + tall * 0.175, r: W * 0.175 },
    { peak: top + tall * 0.255, eave: top + tall * 0.395, r: W * 0.255 },
    { peak: top + tall * 0.475, eave: top + tall * 0.615, r: W * 0.345 },
  ];
  const hallTop = roofs[2].eave;
  const hallR = W * 0.188;

  drawHall(ctx, cx, hallTop, hallBot, hallR);

  // Roofs bottom → top; ring fills gap between eave[i-1] and peak[i]
  for (let i = 2; i >= 0; i--) {
    if (i > 0) {
      drawRing(ctx, cx, roofs[i - 1].eave, roofs[i].peak, roofs[i].r * 0.4, i);
    }
    drawRoof(ctx, cx, roofs[i], i);
  }

  // Upper inter-eave plaque
  const plaqueY = (roofs[0].eave + roofs[1].peak) * 0.5;
  drawPlaque(ctx, cx, plaqueY - tall * 0.018, W * 0.07, tall * 0.036);

  drawFinial(ctx, cx, top + tall * 0.008, roofs[0].peak);

  return canvas;
}

function drawTerrace(ctx, cx, t, idx) {
  const { y, r, h } = t;
  const ry = r * 0.22;

  // Stacked ellipses = visible thickness (side dark → top light)
  const steps = Math.max(10, Math.round(h));
  for (let i = 0; i < steps; i++) {
    const tt = i / (steps - 1 || 1);
    const yy = y - h + tt * h;
    const rr = lerp(r * 0.985, r, tt);
    const shade = lerp(1.08, 0.62, tt);
    const g = ctx.createLinearGradient(cx - rr, 0, cx + rr, 0);
    g.addColorStop(0, shadeColor(PAL.stoneDark, shade * 0.85));
    g.addColorStop(0.3, shadeColor(PAL.stoneMid, shade));
    g.addColorStop(0.5, shadeColor(PAL.stone, shade * 1.05));
    g.addColorStop(0.7, shadeColor(PAL.stoneMid, shade));
    g.addColorStop(1, shadeColor(PAL.stoneDark, shade * 0.8));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(cx, yy, rr, ry * lerp(0.95, 1.05, tt), 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Top deck — cooler white, radial highlight
  const topY = y - h;
  const topGrad = ctx.createRadialGradient(cx - r * 0.2, topY - 3, 2, cx, topY, r);
  topGrad.addColorStop(0, "#f7f3ec");
  topGrad.addColorStop(0.45, "#ebe4d8");
  topGrad.addColorStop(0.8, PAL.stoneMid);
  topGrad.addColorStop(1, PAL.stoneDark);
  ctx.fillStyle = topGrad;
  ctx.beginPath();
  ctx.ellipse(cx, topY, r * 0.97, ry * 0.95, 0, 0, Math.PI * 2);
  ctx.fill();

  // Front rim highlight
  ctx.strokeStyle = "rgba(255,255,255,0.4)";
  ctx.lineWidth = Math.max(1, r * 0.008);
  ctx.beginPath();
  ctx.ellipse(cx, topY, r * 0.97, ry * 0.95, 0, Math.PI * 1.02, Math.PI * 1.98);
  ctx.stroke();

  // Side face darkening under front lip
  ctx.strokeStyle = "rgba(80,70,60,0.35)";
  ctx.lineWidth = Math.max(1.5, h * 0.25);
  ctx.beginPath();
  ctx.ellipse(cx, y - 1, r * 0.99, ry * 1.02, 0, 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.stroke();

  // Balustrade on upper two terraces
  if (idx >= 0) {
    const n = 20 + idx * 6;
    const railR = r * 0.92;
    for (let k = 0; k < n; k++) {
      const ang = (k / n) * Math.PI * 2 - Math.PI / 2;
      // hide far side
      if (Math.sin(ang) > 0.42) continue;
      const px = cx + Math.cos(ang) * railR;
      const sy = topY + Math.sin(ang) * ry * 0.92;
      const postH = Math.max(6, h * 0.85);
      const shade = 0.75 + 0.25 * Math.cos(ang);
      ctx.fillStyle = shadeColor(PAL.stone, shade);
      ctx.fillRect(px - 1.4, sy - postH, 2.8, postH);
      ctx.fillStyle = shadeColor(PAL.stoneDark, shade * 0.9);
      ctx.fillRect(px - 1.4, sy - postH, 1.1, postH);
      // cap
      ctx.fillStyle = "#f0ebe3";
      ctx.beginPath();
      ctx.ellipse(px, sy - postH - 1, 2.6, 1.6, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    // rail ring (front arc)
    ctx.strokeStyle = "rgba(220,214,200,0.85)";
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.ellipse(cx, topY - Math.max(6, h * 0.85) - 1, railR, ry * 0.9, 0, Math.PI * 1.05, Math.PI * 1.95);
    ctx.stroke();
  }
}

function drawHall(ctx, cx, yTop, yBot, r) {
  const h = yBot - yTop;
  const strips = 64;
  for (let i = 0; i < strips; i++) {
    const t0 = i / strips;
    const t1 = (i + 1) / strips;
    const u0 = -1 + 2 * t0;
    const u1 = -1 + 2 * t1;
    // cylinder projection
    const x0 = cx + Math.sin(u0 * Math.PI * 0.5) * r;
    const x1 = cx + Math.sin(u1 * Math.PI * 0.5) * r;
    const light = 0.48 + 0.52 * Math.cos(u0 * Math.PI * 0.5);
    // warm lacquer: mid-bright, edges darker
    ctx.fillStyle = shadeColor(PAL.red, light);
    ctx.fillRect(x0, yTop, Math.max(1.2, x1 - x0 + 0.6), h);
  }

  // Under-eave AO
  const ao = ctx.createLinearGradient(0, yTop, 0, yTop + h * 0.22);
  ao.addColorStop(0, "rgba(0,0,0,0.42)");
  ao.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = ao;
  ctx.fillRect(cx - r, yTop, r * 2, h * 0.22);

  // Floor contact shadow
  const floorAo = ctx.createLinearGradient(0, yBot - h * 0.08, 0, yBot);
  floorAo.addColorStop(0, "rgba(0,0,0,0)");
  floorAo.addColorStop(1, "rgba(0,0,0,0.22)");
  ctx.fillStyle = floorAo;
  ctx.fillRect(cx - r, yBot - h * 0.08, r * 2, h * 0.08);

  // Column shafts
  for (let i = 0; i < 12; i++) {
    const u = -0.92 + i * (1.84 / 11);
    const x = cx + Math.sin(u * Math.PI * 0.5) * r * 0.93;
    const half = 3.2;
    const g = ctx.createLinearGradient(x - half, 0, x + half, 0);
    g.addColorStop(0, PAL.redDeep);
    g.addColorStop(0.4, PAL.redLite);
    g.addColorStop(0.55, "#ff6a55");
    g.addColorStop(1, PAL.redDeep);
    ctx.fillStyle = g;
    ctx.fillRect(x - half, yTop + 5, half * 2, h - 10);
    ctx.strokeStyle = rgba(PAL.gold, 0.5);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, yTop + 5);
    ctx.lineTo(x, yBot - 5);
    ctx.stroke();
  }

  // Gold-framed doors with depth (4)
  const doors = [-0.58, -0.2, 0.2, 0.58];
  const dh = h * 0.58;
  const dy = yBot - dh - 8;
  const dw = r * 0.155;
  for (const u of doors) {
    const x = cx + Math.sin(u * Math.PI * 0.5) * r * 0.94;
    // recessed shadow behind frame
    ctx.fillStyle = "rgba(20,5,5,0.45)";
    roundRect(ctx, x - dw + 1, dy + 2, dw * 2, dh, 2, "rgba(20,5,5,0.45)");

    const fg = ctx.createLinearGradient(x - dw, dy, x + dw, dy + dh);
    fg.addColorStop(0, PAL.goldLite);
    fg.addColorStop(0.35, PAL.gold);
    fg.addColorStop(0.7, PAL.goldDeep);
    fg.addColorStop(1, "#8a6420");
    roundRect(ctx, x - dw, dy, dw * 2, dh, 2.5, fg);

    // inner dark panel
    roundRect(ctx, x - dw + 3, dy + 3, dw * 2 - 6, dh - 6, 1.5, "#2a140c");
    // wood grain panels
    roundRect(ctx, x - dw + 4.5, dy + 5, dw - 5, dh - 10, 1, PAL.wood);
    roundRect(ctx, x + 0.5, dy + 5, dw - 5, dh - 10, 1, shadeColor(PAL.wood, 0.85));

    // warm interior glow
    const glow = ctx.createRadialGradient(x, dy + dh * 0.35, 1, x, dy + dh * 0.4, dw * 0.9);
    glow.addColorStop(0, "rgba(255,200,120,0.4)");
    glow.addColorStop(0.6, "rgba(255,160,80,0.12)");
    glow.addColorStop(1, "rgba(255,160,80,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(x - dw, dy, dw * 2, dh);

    // lattice mullions
    ctx.strokeStyle = rgba(PAL.gold, 0.85);
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(x, dy + 4);
    ctx.lineTo(x, dy + dh - 4);
    ctx.moveTo(x - dw + 4, dy + dh * 0.42);
    ctx.lineTo(x + dw - 4, dy + dh * 0.42);
    ctx.stroke();
    // frame highlight edge
    ctx.strokeStyle = "rgba(255,240,180,0.55)";
    ctx.lineWidth = 1;
    ctx.strokeRect(x - dw + 1, dy + 1, dw * 2 - 2, dh - 2);
  }

  // Lacquer specular
  const spec = ctx.createLinearGradient(cx - r * 0.25, 0, cx + r * 0.08, 0);
  spec.addColorStop(0, "rgba(255,255,255,0)");
  spec.addColorStop(0.45, "rgba(255,210,190,0.16)");
  spec.addColorStop(0.55, "rgba(255,230,210,0.08)");
  spec.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = spec;
  ctx.fillRect(cx - r * 0.28, yTop, r * 0.4, h);
}

function drawRing(ctx, cx, y0, y1, r, idx) {
  // Ensure visible gap cylinder between roofs
  const h = Math.max(14, y1 - y0);
  const strips = 40;
  for (let i = 0; i < strips; i++) {
    const t0 = i / strips;
    const u0 = -1 + 2 * t0;
    const u1 = -1 + 2 * ((i + 1) / strips);
    const x0 = cx + Math.sin(u0 * Math.PI * 0.5) * r;
    const x1 = cx + Math.sin(u1 * Math.PI * 0.5) * r;
    const light = 0.55 + 0.45 * Math.cos(u0 * Math.PI * 0.5);
    ctx.fillStyle = shadeColor(PAL.red, light);
    ctx.fillRect(x0, y0, Math.max(1, x1 - x0 + 0.5), h);
  }

  // Upper AO from roof above
  const ao = ctx.createLinearGradient(0, y0, 0, y0 + h * 0.35);
  ao.addColorStop(0, "rgba(0,0,0,0.3)");
  ao.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = ao;
  ctx.fillRect(cx - r * 1.05, y0, r * 2.1, h * 0.35);

  // Painted dougong / caisson band
  const bandY = y0 + h * 0.28;
  const bandH = Math.max(8, h * 0.42);
  const bg = ctx.createLinearGradient(0, bandY, 0, bandY + bandH);
  if (idx === 1) {
    bg.addColorStop(0, "#2a8a6a");
    bg.addColorStop(0.5, "#1a6a50");
    bg.addColorStop(1, "#0d4030");
  } else {
    bg.addColorStop(0, "#3a8aba");
    bg.addColorStop(0.5, "#1e6a9a");
    bg.addColorStop(1, "#0d3a55");
  }
  ctx.fillStyle = bg;
  ctx.fillRect(cx - r * 1.05, bandY, r * 2.1, bandH);

  // Gold rail lines
  ctx.strokeStyle = rgba(PAL.gold, 0.75);
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(cx - r * 1.05, bandY + 1);
  ctx.lineTo(cx + r * 1.05, bandY + 1);
  ctx.moveTo(cx - r * 1.05, bandY + bandH - 1);
  ctx.lineTo(cx + r * 1.05, bandY + bandH - 1);
  ctx.stroke();

  // Bracket / dougong motifs
  const n = 16;
  for (let i = 0; i < n; i++) {
    const u = -0.92 + i * (1.84 / (n - 1));
    const x = cx + u * r;
    // gold stud
    const gg = ctx.createRadialGradient(x - 0.5, bandY + bandH * 0.4, 0.3, x, bandY + bandH * 0.45, 2.8);
    gg.addColorStop(0, PAL.goldLite);
    gg.addColorStop(0.5, PAL.gold);
    gg.addColorStop(1, PAL.goldDeep);
    ctx.fillStyle = gg;
    ctx.beginPath();
    ctx.arc(x, bandY + bandH * 0.45, 2.4, 0, Math.PI * 2);
    ctx.fill();
    // mini bracket arms
    ctx.fillStyle = rgba(PAL.goldLite, 0.65);
    ctx.fillRect(x - 4, bandY + 2, 8, 1.8);
    ctx.fillRect(x - 1.4, bandY + 2, 2.8, bandH - 3);
    // teal/blue accent block
    ctx.fillStyle = idx === 1 ? "rgba(120,220,180,0.35)" : "rgba(120,180,230,0.35)";
    ctx.fillRect(x - 3.5, bandY + bandH * 0.55, 7, bandH * 0.28);
  }

  // Tiny columns peeking in ring
  for (let i = 0; i < 8; i++) {
    const u = -0.85 + i * (1.7 / 7);
    const x = cx + Math.sin(u * Math.PI * 0.5) * r * 0.9;
    ctx.fillStyle = shadeColor(PAL.redLite, 0.9);
    ctx.fillRect(x - 1.5, y0 + 2, 3, h - 4);
  }
}

function drawRoof(ctx, cx, roof, tier) {
  const { peak, eave, r } = roof;
  const h = eave - peak;

  // Soft shadow under eave onto ring/hall
  ctx.fillStyle = "rgba(5,12,40,0.4)";
  ctx.beginPath();
  ctx.ellipse(cx, eave + 4, r * 1.04, r * 0.2, 0, 0, Math.PI * 2);
  ctx.fill();

  // Layered conical glaze (more layers for smooth cone)
  const layers = 28;
  for (let i = 0; i < layers; i++) {
    const t0 = i / layers;
    const t1 = (i + 1) / layers;
    const ease = (t) => t * t * (3 - 2 * t);
    const y0 = lerp(peak, eave, ease(t0));
    const y1 = lerp(peak, eave, ease(t1));
    // slight eave flare + flying upturn in outer third
    const flare0 = 1 + Math.pow(t0, 2.2) * 0.16;
    const flare1 = 1 + Math.pow(t1, 2.2) * 0.16;
    const lift0 = t0 > 0.68 ? -((t0 - 0.68) / 0.32) * h * 0.14 : 0;
    const lift1 = t1 > 0.68 ? -((t1 - 0.68) / 0.32) * h * 0.14 : 0;
    const r0 = r * (0.08 + t0 * 0.92) * flare0;
    const r1 = r * (0.08 + t1 * 0.92) * flare1;

    let base = PAL.blue;
    if (t0 < 0.12) base = PAL.blueDeep;
    else if (t0 < 0.35) base = PAL.blue;
    else if (t0 < 0.7) base = PAL.blueMid;
    else if (t0 < 0.88) base = PAL.blueLite;
    else base = "#7ab0f5";

    const g = ctx.createLinearGradient(cx - r1, 0, cx + r1, 0);
    g.addColorStop(0, shadeHex(base, 0.48));
    g.addColorStop(0.22, shadeHex(base, 0.85));
    g.addColorStop(0.42, shadeHex(base, 1.18));
    g.addColorStop(0.55, shadeHex(base, 1.25));
    g.addColorStop(0.72, shadeHex(base, 1.05));
    g.addColorStop(0.9, shadeHex(base, 0.7));
    g.addColorStop(1, shadeHex(base, 0.42));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(cx - r0, y0 + lift0);
    ctx.lineTo(cx + r0, y0 + lift0);
    ctx.lineTo(cx + r1, y1 + lift1);
    ctx.lineTo(cx - r1, y1 + lift1);
    ctx.closePath();
    ctx.fill();
  }

  // Tile ridges (≥16, denser on lower roofs)
  const ridges = 18 + tier * 5;
  ctx.lineWidth = Math.max(0.8, r * 0.006);
  for (let i = 0; i < ridges; i++) {
    const u = -0.96 + i * (1.92 / (ridges - 1));
    const dark = Math.abs(u) > 0.7;
    ctx.strokeStyle = rgba(PAL.blueDeep, dark ? 0.55 : 0.38);
    ctx.beginPath();
    ctx.moveTo(cx + u * r * 0.1, peak + 4);
    ctx.quadraticCurveTo(
      cx + u * r * 0.5,
      lerp(peak, eave, 0.5),
      cx + u * r * 0.99,
      eave - Math.abs(u) * h * 0.12
    );
    ctx.stroke();
  }

  // Alternate lighter ridge highlight
  ctx.strokeStyle = "rgba(160,200,255,0.22)";
  ctx.lineWidth = 0.8;
  for (let i = 0; i < ridges; i += 2) {
    const u = -0.96 + i * (1.92 / (ridges - 1)) + 0.02;
    ctx.beginPath();
    ctx.moveTo(cx + u * r * 0.12, peak + 6);
    ctx.quadraticCurveTo(
      cx + u * r * 0.52,
      lerp(peak, eave, 0.52),
      cx + u * r * 0.97,
      eave - Math.abs(u) * h * 0.11
    );
    ctx.stroke();
  }

  // Glaze specular sheen (wet ceramic look)
  const sheen = ctx.createLinearGradient(cx - r * 0.45, peak, cx + r * 0.15, eave);
  sheen.addColorStop(0, "rgba(200,230,255,0)");
  sheen.addColorStop(0.35, "rgba(200,230,255,0.28)");
  sheen.addColorStop(0.48, "rgba(220,240,255,0.12)");
  sheen.addColorStop(0.65, "rgba(180,210,255,0)");
  sheen.addColorStop(1, "rgba(180,210,255,0)");
  ctx.fillStyle = sheen;
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.18, peak + 2);
  ctx.lineTo(cx + r * 0.06, peak + 2);
  ctx.lineTo(cx - r * 0.05, eave - h * 0.05);
  ctx.lineTo(cx - r * 0.5, eave - h * 0.02);
  ctx.closePath();
  ctx.fill();

  // Bright eave rim (glazed edge)
  ctx.strokeStyle = PAL.blueHi;
  ctx.lineWidth = Math.max(2, r * 0.018);
  ctx.beginPath();
  for (let i = 0; i <= 32; i++) {
    const u = -1 + (2 * i) / 32;
    const lift = -Math.abs(u) * h * 0.12;
    const x = cx + u * r * 1.01;
    const y = eave + lift;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  // Dark under-eave band (AO lip)
  ctx.strokeStyle = "rgba(10,20,50,0.55)";
  ctx.lineWidth = Math.max(2.5, r * 0.02);
  ctx.beginPath();
  for (let i = 0; i <= 32; i++) {
    const u = -1 + (2 * i) / 32;
    const lift = -Math.abs(u) * h * 0.08;
    const x = cx + u * r * 0.98;
    const y = eave + lift + 3;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();

  // Flying eaves + gold tips
  for (const side of [-1, 1]) {
    const tipX = cx + side * (r + 10 + tier * 2);
    const tipY = eave - h * 0.16;
    const midX = cx + side * (r + 1);
    const midY = eave - 4;
    const baseX = cx + side * (r - 14);
    const baseY = eave + 3;
    const rg = ctx.createLinearGradient(baseX, baseY, tipX, tipY);
    rg.addColorStop(0, PAL.blueMid);
    rg.addColorStop(0.5, PAL.blueLite);
    rg.addColorStop(1, "#a8d0ff");
    ctx.fillStyle = rg;
    ctx.beginPath();
    ctx.moveTo(baseX, baseY);
    ctx.quadraticCurveTo(midX, midY - 6, tipX, tipY);
    ctx.quadraticCurveTo(midX + side * 3, midY + 5, baseX + side * 5, baseY + 3);
    ctx.closePath();
    ctx.fill();
    // gold corner ornament
    const gg = ctx.createRadialGradient(tipX - side, tipY - 1, 0.4, tipX, tipY, 5);
    gg.addColorStop(0, "#fff6d0");
    gg.addColorStop(0.35, PAL.goldLite);
    gg.addColorStop(0.7, PAL.gold);
    gg.addColorStop(1, PAL.goldDeep);
    ctx.fillStyle = gg;
    ctx.beginPath();
    ctx.arc(tipX, tipY, 3.8, 0, Math.PI * 2);
    ctx.fill();
    // small spike
    ctx.fillStyle = PAL.goldLite;
    ctx.beginPath();
    ctx.moveTo(tipX, tipY - 6);
    ctx.lineTo(tipX + side * 2.5, tipY);
    ctx.lineTo(tipX - side * 1.5, tipY + 1);
    ctx.closePath();
    ctx.fill();
  }

  // Peak gold collar
  const pg = ctx.createRadialGradient(cx - 2, peak - 1, 0.5, cx, peak + 2, r * 0.16);
  pg.addColorStop(0, "#fff4c8");
  pg.addColorStop(0.35, PAL.goldLite);
  pg.addColorStop(0.65, PAL.gold);
  pg.addColorStop(1, PAL.blueDeep);
  ctx.fillStyle = pg;
  ctx.beginPath();
  ctx.ellipse(cx, peak + 2, r * 0.15, r * 0.048, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawPlaque(ctx, cx, y, w, h) {
  const x = cx - w * 0.5;
  // shadow
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  roundRect(ctx, x + 2, y + 2, w, h, 3, "rgba(0,0,0,0.35)");
  const g = ctx.createLinearGradient(x, y, x + w, y + h);
  g.addColorStop(0, "#0c326e");
  g.addColorStop(0.5, "#081e48");
  g.addColorStop(1, "#061536");
  roundRect(ctx, x, y, w, h, 3, g);
  ctx.strokeStyle = PAL.gold;
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 1.5, y + 1.5, w - 3, h - 3);
  ctx.strokeStyle = PAL.goldLite;
  ctx.lineWidth = 1.2;
  ctx.strokeRect(x + 4, y + 4, w - 8, h - 8);
  // four character lines (stylized)
  ctx.strokeStyle = rgba(PAL.goldLite, 0.9);
  ctx.lineWidth = 1.6;
  for (let i = 0; i < 4; i++) {
    const yy = y + h * (0.22 + i * 0.17);
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.26, yy);
    ctx.lineTo(cx + w * 0.26, yy);
    ctx.stroke();
  }
}

function drawFinial(ctx, cx, yTop, yBot) {
  // shaft
  const shaftG = ctx.createLinearGradient(cx - 2, yTop, cx + 2, yBot);
  shaftG.addColorStop(0, PAL.goldLite);
  shaftG.addColorStop(0.5, PAL.gold);
  shaftG.addColorStop(1, PAL.goldDeep);
  ctx.strokeStyle = shaftG;
  ctx.lineWidth = 3.2;
  ctx.beginPath();
  ctx.moveTo(cx, yTop + 8);
  ctx.lineTo(cx, yBot);
  ctx.stroke();

  // stacked gourd / baosha
  const balls = [
    { y: yTop + 2, r: 7.5 },
    { y: yTop + 14, r: 5.8 },
    { y: yTop + 24, r: 4.2 },
    { y: yTop + 32, r: 3.2 },
  ];
  for (const b of balls) {
    const g = ctx.createRadialGradient(cx - b.r * 0.35, b.y - b.r * 0.35, 0.4, cx, b.y, b.r);
    g.addColorStop(0, "#fff8e0");
    g.addColorStop(0.25, PAL.goldLite);
    g.addColorStop(0.55, PAL.gold);
    g.addColorStop(1, PAL.goldDeep);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, b.y, b.r, 0, Math.PI * 2);
    ctx.fill();
    // rim ring
    ctx.strokeStyle = "rgba(120,80,20,0.45)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(cx, b.y + b.r * 0.35, b.r * 0.85, b.r * 0.25, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  // tip sparkle
  ctx.fillStyle = "#fffef5";
  ctx.beginPath();
  ctx.arc(cx - 2, yTop - 1, 2.2, 0, Math.PI * 2);
  ctx.fill();
}

function roundRect(ctx, x, y, w, h, r, fill) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  ctx.fill();
}

function shadeColor(hex, mul) {
  const n = hex.replace("#", "");
  let r = parseInt(n.slice(0, 2), 16);
  let g = parseInt(n.slice(2, 4), 16);
  let b = parseInt(n.slice(4, 6), 16);
  r = clamp((r * mul) | 0, 0, 255);
  g = clamp((g * mul) | 0, 0, 255);
  b = clamp((b * mul) | 0, 0, 255);
  return `rgb(${r},${g},${b})`;
}

function shadeHex(hex, mul) {
  return shadeColor(hex, mul);
}

function pickDebris(kind) {
  const map = {
    blue: [PAL.blue, PAL.blueLite, PAL.blueMid],
    red: [PAL.red, PAL.redLite, PAL.redDeep],
    gold: [PAL.gold, PAL.goldLite],
    stone: [PAL.stone, PAL.stoneMid, PAL.stoneDark],
  };
  const pool = kind && map[kind] ? map[kind] : [PAL.blue, PAL.red, PAL.gold, PAL.stone];
  const hex = pool[(Math.random() * pool.length) | 0];
  const n = hex.replace("#", "");
  return {
    r: parseInt(n.slice(0, 2), 16),
    g: parseInt(n.slice(2, 4), 16),
    b: parseInt(n.slice(4, 6), 16),
  };
}

class TempleScene extends Phaser.Scene {
  create() {
    sceneRef = this;
    this.w = this.scale.width || 320;
    this.h = this.scale.height || 480;
    this.t = 0;
    this.flash = 0;
    this.shake = 0;
    this.zoomPunch = 0;

    this.particles = [];
    this.glows = [];
    this.shocks = [];
    this.dust = [];
    this.debris = [];
    this.chunks = [];

    this.gfx = this.add.graphics().setDepth(30);
    this.cameras.main.setBackgroundColor("rgba(0,0,0,0)");

    this.phase = "idle";
    this.rebuildT = 0;
    this.lean = 0;
    this.leanVel = 0;
    this.sink = 0;
    this.fire = 0;

    this._bake();
    ready = true;
    setBadge("祈年殿 · 点击炸毁");
  }

  _bake() {
    if (this.templeImg) this.templeImg.destroy();
    // High-res paint then scale down for sharpness (B-tier detail)
    const pw = Math.max(400, Math.floor(this.w * 2.5));
    const ph = Math.max(600, Math.floor(this.h * 2.5));
    const canvas = paintTemple(pw, ph);
    if (this.textures.exists("templePaint")) this.textures.remove("templePaint");
    this.textures.addCanvas("templePaint", canvas);
    this.texW = pw;
    this.texH = ph;

    const margin = 4;
    const maxW = this.w - margin * 2;
    const maxH = this.h * 0.92;
    const scale = Math.min(maxW / pw, maxH / ph);
    this.dw = pw * scale;
    this.dh = ph * scale;
    this.tcx = this.w * 0.5;
    this.tcy = this.h * 0.5;

    this.templeImg = this.add.image(this.tcx, this.tcy, "templePaint").setDepth(5);
    this.templeImg.setDisplaySize(this.dw, this.dh);
    this.templeImg.setAlpha(1);

    // Tier Y fractions for peel (aligned to v11 roof / hall / terrace bands)
    this.tiers = [
      { y0: 0.03, y1: 0.22 },
      { y0: 0.18, y1: 0.42 },
      { y0: 0.38, y1: 0.62 },
      { y0: 0.58, y1: 0.84 },
      { y0: 0.80, y1: 1.00 },
    ];
  }

  blast() {
    if (this.phase === "rebuild") return;
    if (this.phase === "rubble") {
      this._rebuild();
      return;
    }
    if (this.phase !== "idle") {
      this._punch();
      return;
    }

    combo += 1;
    comboTimer = 2.5;
    const mode = MODES[modeIdx % MODES.length];
    modeIdx += 1;
    const power = 1 + Math.min(2.5, combo * 0.24);

    this.phase = "blasting";
    this.fire = 1;
    this.templeImg.setVisible(false);
    setBadge(`祈年殿 · ${MODE_LABEL[mode]} · x${combo}`);

    this.flash = 1.2 + power * 0.35;
    this.shake = 0.75 + power * 0.3;
    this.zoomPunch = 0.5;
    this._glow(this.tcx, this.tcy, 80, { r: 232, g: 184, b: 74 }, 0.9);
    this._shock(this.tcx, this.tcy, 120, 4);

    if (mode === "tier") this._modeTier(power);
    else if (mode === "shatter") this._modeShatter(power);
    else if (mode === "lean") this._modeLean(power);
    else this._modeCore(power);

    this.time.delayedCall(1500 + power * 150, () => {
      if (!ready) return;
      if (this.phase === "blasting") this._toRubble();
    });
  }

  _makeChunk(sx, sy, sw, sh) {
    if (this.chunks.length >= MAX_CHUNKS) return null;
    const key = `c${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const cnv = document.createElement("canvas");
    cnv.width = sw;
    cnv.height = sh;
    const ctx = cnv.getContext("2d");
    const src = this.textures.get("templePaint").getSourceImage();
    ctx.drawImage(src, sx, sy, sw, sh, 0, 0, sw, sh);
    this.textures.addCanvas(key, cnv);
    const scale = this.dw / this.texW;
    const img = this.add.image(
      this.tcx - this.dw * 0.5 + (sx + sw * 0.5) * scale,
      this.tcy - this.dh * 0.5 + (sy + sh * 0.5) * scale,
      key
    ).setDepth(8);
    img.setDisplaySize(sw * scale, sh * scale);
    img.setData("texKey", key);
    return img;
  }

  _modeTier(power) {
    for (let i = 0; i < this.tiers.length; i++) {
      this.time.delayedCall(i * 170, () => {
        if (!ready || this.phase === "rebuild") return;
        const t = this.tiers[i];
        const y0 = (t.y0 * this.texH) | 0;
        const y1 = (t.y1 * this.texH) | 0;
        const h = Math.max(8, y1 - y0);
        const cols = 4;
        const cw = (this.texW / cols) | 0;
        for (let c = 0; c < cols; c++) {
          const img = this._makeChunk(c * cw, y0, c === cols - 1 ? this.texW - c * cw : cw, h);
          if (!img) continue;
          const side = c < cols / 2 ? -1 : 1;
          this.chunks.push({
            img,
            vx: side * (60 + power * 50 + Math.random() * 80),
            vy: -100 - power * 40 - Math.random() * 60,
            rot: 0,
            spin: side * (1.2 + Math.random() * 2),
            life: 1.2 + Math.random() * 0.4,
            max: 1.6,
            grav: 300,
          });
        }
        const cy = this.tcy - this.dh * 0.5 + ((y0 + h * 0.5) / this.texH) * this.dh;
        this._burst(this.tcx, cy, 40, power, i < 3 ? "blue" : "red");
        this._spawnDust(this.tcx, cy, 14);
        this.flash = Math.min(2.3, this.flash + 0.2);
      });
    }
  }

  _modeShatter(power) {
    const cols = 5;
    const rows = 7;
    const cw = (this.texW / cols) | 0;
    const ch = (this.texH / rows) | 0;
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        if (Math.random() < 0.1) continue;
        const sx = col * cw;
        const sy = row * ch;
        const sw = col === cols - 1 ? this.texW - sx : cw;
        const sh = row === rows - 1 ? this.texH - sy : ch;
        const img = this._makeChunk(sx, sy, sw, sh);
        if (!img) continue;
        const ang = Math.atan2(img.y - this.tcy, img.x - this.tcx);
        const spd = 130 + power * 90 + Math.random() * 140;
        this.chunks.push({
          img,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd - 70,
          rot: (Math.random() - 0.5) * 1.5,
          spin: (Math.random() - 0.5) * 7,
          life: 1.0 + Math.random() * 0.5,
          max: 1.5,
          grav: 320,
        });
      }
    }
    this._burst(this.tcx, this.tcy, 90, power, null);
    this._spawnDust(this.tcx, this.tcy, 40);
  }

  _modeLean(power) {
    const img = this.add.image(this.tcx, this.tcy, "templePaint").setDepth(6);
    img.setDisplaySize(this.dw, this.dh);
    const dir = Math.random() < 0.5 ? -1 : 1;
    this.chunks.push({
      img,
      vx: dir * 25,
      vy: -15,
      rot: 0,
      spin: dir * (1.6 + power * 0.35),
      life: 0.8,
      max: 0.85,
      grav: 100,
      leanBomb: true,
    });
    this.time.delayedCall(720, () => {
      if (!ready) return;
      for (let i = this.chunks.length - 1; i >= 0; i--) {
        const c = this.chunks[i];
        if (!c.leanBomb) continue;
        const ox = c.img.x;
        const oy = c.img.y;
        this._killChunk(c);
        this.chunks.splice(i, 1);
        // mini shatter from pose
        for (let k = 0; k < 16; k++) {
          const sw = 36 + ((Math.random() * 50) | 0);
          const sh = 30 + ((Math.random() * 50) | 0);
          const sx = ((Math.random() * (this.texW - sw)) | 0);
          const sy = ((Math.random() * (this.texH - sh)) | 0);
          const piece = this._makeChunk(sx, sy, sw, sh);
          if (!piece) continue;
          piece.setPosition(ox + (Math.random() - 0.5) * 30, oy + (Math.random() - 0.5) * 30);
          const ang = Math.random() * Math.PI * 2;
          const spd = 110 + power * 70 + Math.random() * 120;
          this.chunks.push({
            img: piece,
            vx: Math.cos(ang) * spd,
            vy: Math.sin(ang) * spd - 50,
            rot: (Math.random() - 0.5) * 2,
            spin: (Math.random() - 0.5) * 6,
            life: 1.0 + Math.random() * 0.4,
            max: 1.4,
            grav: 340,
          });
        }
        this._burst(ox, oy, 70, power, null);
        this.flash = Math.min(2.4, this.flash + 0.5);
      }
    });
  }

  _modeCore(power) {
    const img = this.add.image(this.tcx, this.tcy, "templePaint").setDepth(6);
    img.setDisplaySize(this.dw, this.dh);
    this.chunks.push({
      img,
      vx: 0, vy: 0, rot: 0, spin: 0,
      life: 0.3, max: 0.3, grav: 0,
      inhale: true,
    });
    this.time.delayedCall(260, () => {
      if (!ready) return;
      for (let i = this.chunks.length - 1; i >= 0; i--) {
        if (this.chunks[i].inhale) {
          this._killChunk(this.chunks[i]);
          this.chunks.splice(i, 1);
        }
      }
      this._modeShatter(power * 1.15);
      this.flash = 2.4;
      this.zoomPunch = 1;
    });
  }

  _punch() {
    this.flash = Math.min(2.2, this.flash + 0.3);
    this.shake = Math.min(1.2, this.shake + 0.22);
    this._burst(this.tcx, this.tcy, 30, 1.1, null);
  }

  _toRubble() {
    this.phase = "rubble";
    for (const c of this.chunks) this._killChunk(c);
    this.chunks = [];
    this.fire = 0.6;
    setBadge("祈年殿 · 废墟 · 再点重建");
    this.time.delayedCall(2200, () => {
      if (this.phase === "rubble") this._rebuild();
    });
  }

  _rebuild() {
    this.phase = "rebuild";
    this.rebuildT = 0;
    this.fire = 0;
    for (const c of this.chunks) this._killChunk(c);
    this.chunks = [];
    this.templeImg.setVisible(true);
    this.templeImg.setAlpha(0);
    setBadge("祈年殿 · 重建中…");
  }

  _killChunk(c) {
    if (!c || !c.img) return;
    const k = c.img.getData && c.img.getData("texKey");
    c.img.destroy();
    c.img = null;
    if (k && this.textures.exists(k)) {
      try { this.textures.remove(k); } catch { /* ignore */ }
    }
  }

  _burst(x, y, n, power, kind) {
    const count = Math.min(n | 0, room(this.particles, MAX_P));
    for (let i = 0; i < count; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = (120 + power * 90) * (0.4 + Math.random());
      const col = pickDebris(kind);
      const life = 0.5 + Math.random() * 0.65;
      this.particles.push({
        x, y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd - 35,
        life, max: life,
        size: 2 + Math.random() * 3.2,
        r: col.r, g: col.g, b: col.b,
        hot: 0.6,
        grav: 95,
      });
    }
  }

  _spawnDust(x, y, n) {
    const count = Math.min(n, room(this.dust, MAX_DUST));
    for (let i = 0; i < count; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = 20 + Math.random() * 65;
      this.dust.push({
        x: x + (Math.random() - 0.5) * 20,
        y: y + (Math.random() - 0.5) * 14,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd - 25,
        life: 1.1 + Math.random(),
        max: 2,
        size: 8 + Math.random() * 16,
        a: 0.2 + Math.random() * 0.2,
      });
    }
  }

  _glow(x, y, rad, color, strength) {
    if (this.glows.length >= MAX_GLOW) this.glows.shift();
    this.glows.push({
      x, y, rad,
      r: color.r, g: color.g, b: color.b,
      a: strength || 0.7,
      life: 0.5, max: 0.7,
    });
  }

  _shock(x, y, max, width) {
    if (this.shocks.length >= MAX_SHOCK) this.shocks.shift();
    this.shocks.push({ x, y, rad: 8, max, life: 1, width: width || 3 });
  }

  update(_t, dtMs) {
    const dt = Math.min(0.045, (dtMs || 16) / 1000);
    this.t += dt;
    this.flash = Math.max(0, this.flash - dt * 1.4);
    this.shake = Math.max(0, this.shake - dt * 2.2);
    this.zoomPunch = Math.max(0, this.zoomPunch - dt * 2.6);
    comboTimer = Math.max(0, comboTimer - dt);
    if (comboTimer <= 0) combo = 0;

    if (this.scale.width !== this.w || this.scale.height !== this.h) {
      this.w = this.scale.width || this.w;
      this.h = this.scale.height || this.h;
      if (this.phase === "idle") this._bake();
    }

    if (this.phase === "rebuild") {
      this.rebuildT = Math.min(1, this.rebuildT + dt * 0.65);
      this.templeImg.setAlpha(this.rebuildT);
      if (this.rebuildT >= 1) {
        this.phase = "idle";
        setBadge(`祈年殿 · ${MODE_LABEL[MODES[modeIdx % MODES.length]]} · 就绪`);
      }
    }

    if (this.phase === "rubble") this.fire = Math.max(0.2, this.fire - dt * 0.12);

    for (let i = this.chunks.length - 1; i >= 0; i--) {
      const c = this.chunks[i];
      if (c.inhale && c.img) {
        c.life -= dt;
        const k = 1 - (1 - c.life / c.max) * 0.2;
        c.img.setScale(
          (this.dw / this.texW) * k,
          (this.dh / this.texH) * k
        );
        if (c.life <= 0) {
          this._killChunk(c);
          this.chunks.splice(i, 1);
        }
        continue;
      }
      c.life -= dt;
      c.vy += (c.grav || 300) * dt;
      c.vx *= 0.995;
      if (c.img) {
        c.img.x += c.vx * dt;
        c.img.y += c.vy * dt;
        c.rot += c.spin * dt;
        c.img.setRotation(c.rot);
        c.img.setAlpha(Math.max(0, c.life / c.max));
      }
      if (c.life <= 0) {
        this._killChunk(c);
        this.chunks.splice(i, 1);
      }
    }

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      p.vy += p.grav * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.life <= 0) this.particles.splice(i, 1);
    }

    for (let i = this.dust.length - 1; i >= 0; i--) {
      const d = this.dust[i];
      d.life -= dt;
      d.vx *= 0.97; d.vy *= 0.97;
      d.vy -= 8 * dt;
      d.x += d.vx * dt; d.y += d.vy * dt;
      d.size += 11 * dt;
      if (d.life <= 0) this.dust.splice(i, 1);
    }

    for (let i = this.glows.length - 1; i >= 0; i--) {
      const g = this.glows[i];
      g.life -= dt; g.rad += 50 * dt; g.a *= 0.95;
      if (g.life <= 0) this.glows.splice(i, 1);
    }

    for (let i = this.shocks.length - 1; i >= 0; i--) {
      const sw = this.shocks[i];
      sw.rad += (sw.max - sw.rad) * Math.min(1, dt * 7) + 70 * dt;
      sw.life -= dt * 1.5;
      if (sw.life <= 0) this.shocks.splice(i, 1);
    }

    this._drawFx();
  }

  _drawFx() {
    const g = this.gfx;
    g.clear();
    const sx = (Math.random() - 0.5) * this.shake * 12;
    const sy = (Math.random() - 0.5) * this.shake * 12;
    const z = 1 + this.zoomPunch * 0.06;
    const cx0 = this.w * 0.5;
    const cy0 = this.h * 0.5;
    const tx = (x, y) => ({
      x: cx0 + (x - cx0) * z + sx,
      y: cy0 + (y - cy0) * z + sy,
    });

    if (this.templeImg && this.templeImg.visible) {
      this.templeImg.setPosition(this.tcx + sx, this.tcy + sy);
    }

    if (this.flash > 0.02) {
      g.fillStyle(0xfff3dc, Math.min(0.4, this.flash * 0.25));
      g.fillRect(0, 0, this.w, this.h);
    }

    if (this.phase === "rubble" || this.phase === "rebuild") {
      const a = this.phase === "rebuild" ? 1 - this.rebuildT : 1;
      const p = tx(this.tcx, this.tcy + this.dh * 0.32);
      g.fillStyle(0x1a4fb8, 0.55 * a);
      g.fillEllipse(p.x - 6, p.y - 10, 70, 20);
      g.fillStyle(0xc42822, 0.5 * a);
      g.fillEllipse(p.x + 12, p.y - 6, 60, 16);
      g.fillStyle(0xcfc7b8, 0.55 * a);
      g.fillEllipse(p.x, p.y, 90, 16);
      if (this.fire > 0.15) {
        const flick = 0.7 + 0.3 * Math.sin(this.t * 15);
        g.fillStyle(0xff3a10, 0.35 * this.fire * a * flick);
        g.fillCircle(p.x - 6, p.y - 10, 6);
        g.fillStyle(0xffd070, 0.4 * this.fire * a * flick);
        g.fillCircle(p.x + 4, p.y - 12, 3.5);
      }
    }

    for (const d of this.dust) {
      const a = Math.max(0, d.life / d.max) * d.a;
      const p = tx(d.x, d.y);
      g.fillStyle(0xcfc7b8, a);
      g.fillCircle(p.x, p.y, d.size);
    }

    for (const gl of this.glows) {
      const a = gl.a * Math.max(0, gl.life / gl.max);
      const p = tx(gl.x, gl.y);
      for (let k = 5; k >= 1; k--) {
        g.fillStyle(Phaser.Display.Color.GetColor(gl.r, gl.g, gl.b), a * 0.04 * k);
        g.fillCircle(p.x, p.y, gl.rad * (0.25 + k * 0.2));
      }
    }

    for (const sw of this.shocks) {
      const a = Math.max(0, sw.life) * 0.6;
      const p = tx(sw.x, sw.y);
      g.lineStyle(sw.width, 0xffe0a0, a);
      g.strokeCircle(p.x, p.y, sw.rad);
    }

    for (const p of this.particles) {
      const a = Math.max(0, p.life / p.max);
      const pos = tx(p.x, p.y);
      g.fillStyle(Phaser.Display.Color.GetColor(p.r, p.g, p.b), a * 0.9);
      g.fillCircle(pos.x, pos.y, p.size);
    }
  }
}

async function boot() {
  const sdk = window.ClawdPetSdk.create();
  await sdk.ready();

  const w = window.innerWidth || 320;
  const h = window.innerHeight || 480;

  // eslint-disable-next-line no-new
  new Phaser.Game({
    type: Phaser.WEBGL,
    parent: "stage",
    width: w,
    height: h,
    backgroundColor: "#00000000",
    transparent: true,
    scene: TempleScene,
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
  });

  sdk.onClick(() => {
    if (!sceneRef || !ready) return;
    sceneRef.blast();
  });

  setBadge("祈年殿 · 就绪");
}

boot().catch((err) => {
  setBadge("祈年殿 · error");
  console.error("[temple]", err);
});
