// --- Pixi adaptation demo (dev-only, CLAWD_PIXI_SPIKE=1) ---
// Standalone showcase — NOT the desk-pet SVG / Naruto path.
// Goal: transparent Electron + WebGL + CSP + cursor IPC + effect ceiling.
//
// Effects (procedural, no remote assets):
//   1) Starwarp field — classic Pixi examples pattern
//   2) MeshRope mouse trail — official Pixi advanced/mouse-trail (MIT)
//   3) Click nova — additive particle burst via hit-window IPC
//   4) Soft core orb + built-in BlurFilter (GPU filter path)

"use strict";

const STAR_COUNT = 180;
const WARP_BASE = 0.35;
const WARP_BOOST = 2.8;

const stageEl = document.getElementById("pixi-stage");
const errorEl = document.getElementById("pixi-error");

let app = null;
let badge = null;
let mouseTrail = null;
let stars = null;
let core = null;
let ready = false;
let petVisualReadyNotified = false;
let destroyed = false;
let pointerX = 0;
let pointerY = 0;
let hasPointer = false;
let warpBoost = 0;
let timeMs = 0;

function showError(message) {
  if (!errorEl) return;
  errorEl.style.display = "block";
  errorEl.textContent = String(message || "unknown pixi demo error");
}

function logWarn(...args) {
  try { console.warn("[pixi-demo]", ...args); } catch {}
}

function logInfo(...args) {
  try { console.info("[pixi-demo]", ...args); } catch {}
}

function fallbackToSvg(reason) {
  logWarn("falling back to SVG entry:", reason);
  showError(`Pixi demo failed: ${reason}\nFalling back to index.html…`);
  setTimeout(() => {
    try { location.replace("index.html"); } catch {}
  }, 250);
}

function notifyPetVisualReadyOnce() {
  if (petVisualReadyNotified) return;
  if (!window.electronAPI || typeof window.electronAPI.notifyPetVisualReady !== "function") return;
  petVisualReadyNotified = true;
  window.electronAPI.notifyPetVisualReady();
  logInfo("pet-visual-ready sent");
}

function assertWebGlRenderer(application) {
  const renderer = application && application.renderer;
  const name = renderer
    && (renderer.name
      || (renderer.constructor && renderer.constructor.name)
      || "");
  const type = renderer && renderer.type;
  const looksWebGl = /webgl/i.test(String(name))
    || type === (window.PIXI && window.PIXI.RendererType && window.PIXI.RendererType.WEBGL)
    || !!(renderer && renderer.gl);
  if (!looksWebGl) {
    throw new Error(`expected WebGL renderer, got name=${name || "?"} type=${type}`);
  }
  logInfo("renderer ok:", name || "WebGL", "type=", type);
  return name || "WebGL";
}

function createStarTexture(PIXI) {
  const size = 16;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.35, "rgba(180,220,255,0.85)");
  g.addColorStop(1, "rgba(80,140,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return PIXI.Texture.from(canvas);
}

function buildStarfield(PIXI, application) {
  const tex = createStarTexture(PIXI);
  const layer = new PIXI.Container();
  const list = [];
  const w = application.screen.width;
  const h = application.screen.height;
  for (let i = 0; i < STAR_COUNT; i++) {
    const s = new PIXI.Sprite(tex);
    s.anchor.set(0.5);
    s.blendMode = "add";
    s.ox = (Math.random() - 0.5) * w;
    s.oy = (Math.random() - 0.5) * h;
    s.z = Math.random() * w;
    layer.addChild(s);
    list.push(s);
  }
  application.stage.addChild(layer);
  return { layer, list, texture: tex };
}

function buildCore(PIXI, application) {
  const g = new PIXI.Graphics();
  g.circle(0, 0, 28);
  g.fill({ color: 0x66ccff, alpha: 0.55 });
  g.circle(0, 0, 14);
  g.fill({ color: 0xffffff, alpha: 0.9 });
  g.circle(0, 0, 48);
  g.stroke({ width: 2, color: 0x88ddff, alpha: 0.35 });

  const holder = new PIXI.Container();
  holder.addChild(g);
  holder.x = application.screen.width * 0.5;
  holder.y = application.screen.height * 0.5;

  // Built-in GPU filter — proves filter pipeline under our CSP/vendor build.
  if (PIXI.BlurFilter) {
    try {
      holder.filters = [new PIXI.BlurFilter({ strength: 2, quality: 3 })];
    } catch (err) {
      logWarn("BlurFilter unavailable:", err && err.message);
    }
  }

  application.stage.addChild(holder);
  return holder;
}

function layoutHud() {
  if (!app || !badge) return;
  badge.anchor.set(0, 1);
  badge.x = 8;
  badge.y = app.screen.height - 8;
  const scale = Math.max(0.8, Math.min(1.25, app.screen.width / 220));
  badge.scale.set(scale);
}

function onResize() {
  if (!app || !ready) return;
  layoutHud();
}

function onTick(ticker) {
  if (!ready || destroyed || !app) return;
  const dt = ticker.deltaMS || 16;
  timeMs += dt;
  const w = app.screen.width;
  const h = app.screen.height;
  const cx = hasPointer ? pointerX : w * 0.5;
  const cy = hasPointer ? pointerY : h * 0.5;

  warpBoost = Math.max(0, warpBoost - dt * 0.0035);
  const speed = (WARP_BASE + warpBoost * WARP_BOOST) * dt;

  if (stars) {
    for (const s of stars.list) {
      s.z -= speed * (0.8 + (w - s.z) / w);
      if (s.z < 1) {
        s.ox = (Math.random() - 0.5) * w;
        s.oy = (Math.random() - 0.5) * h;
        s.z = w;
      }
      const scale = w / s.z;
      s.x = cx + s.ox * scale * 0.12;
      s.y = cy + s.oy * scale * 0.12;
      s.scale.set(Math.min(2.2, 0.25 + scale * 0.85));
      s.alpha = Math.min(1, 0.15 + (1 - s.z / w) * 1.5);
    }
  }

  if (core) {
    const pulse = 1 + Math.sin(timeMs * 0.004) * 0.1;
    core.scale.set(pulse);
    core.x += (cx - core.x) * 0.1;
    core.y += (cy - core.y) * 0.1;
  }
}

async function boot() {
  if (!window.PIXI || typeof window.PIXI.Application !== "function") {
    throw new Error("PIXI global missing — vendor/pixi.min.js failed to load");
  }

  app = new window.PIXI.Application();
  await app.init({
    preference: "webgl",
    backgroundAlpha: 0,
    antialias: true,
    resizeTo: window,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true,
    powerPreference: "high-performance",
  });
  const rendererName = assertWebGlRenderer(app);

  if (stageEl) stageEl.appendChild(app.canvas);
  else document.body.appendChild(app.canvas);

  pointerX = app.screen.width * 0.5;
  pointerY = app.screen.height * 0.5;

  stars = buildStarfield(window.PIXI, app);

  const trailFactory = window.ClawdPixiMouseTrail && window.ClawdPixiMouseTrail.createMouseTrail;
  if (typeof trailFactory === "function") {
    mouseTrail = trailFactory({ PIXI: window.PIXI, app });
    logInfo("mouse trail enabled (official MeshRope example)");
  } else {
    logWarn("pixi-mouse-trail.js missing — trail disabled");
  }

  core = buildCore(window.PIXI, app);

  badge = new window.PIXI.Text({
    text: "Pixi demo · starwarp + trail",
    style: {
      fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
      fontSize: 12,
      fontWeight: "700",
      fill: 0xd8f0ff,
      stroke: { color: 0x061018, width: 3, join: "round" },
      dropShadow: {
        alpha: 0.55,
        blur: 2,
        color: 0x000000,
        distance: 1,
      },
    },
  });
  app.stage.addChild(badge);
  layoutHud();

  ready = true;
  app.ticker.add(onTick);
  try { app.render(); } catch {}
  notifyPetVisualReadyOnce();
  logInfo("boot complete; renderer=", rendererName, "stars=", STAR_COUNT, "trail=", !!mouseTrail);
}

function destroyApp() {
  if (destroyed) return;
  destroyed = true;
  ready = false;
  try {
    if (mouseTrail && typeof mouseTrail.destroy === "function") mouseTrail.destroy();
  } catch {}
  mouseTrail = null;
  try {
    if (stars && stars.texture) stars.texture.destroy(true);
  } catch {}
  stars = null;
  core = null;
  try {
    if (app) {
      try { app.ticker.stop(); } catch {}
      try { app.destroy(true, { children: true, texture: false }); } catch {}
    }
  } catch {}
  app = null;
  badge = null;
}

if (window.electronAPI && typeof window.electronAPI.onPixiCursor === "function") {
  window.electronAPI.onPixiCursor((payload) => {
    if (!payload || !Number.isFinite(payload.x) || !Number.isFinite(payload.y)) return;
    pointerX = payload.x;
    pointerY = payload.y;
    hasPointer = true;
    if (mouseTrail) mouseTrail.setPointer(payload.x, payload.y);
  });
}

if (window.electronAPI && typeof window.electronAPI.onPlayClickReaction === "function") {
  window.electronAPI.onPlayClickReaction(() => {
    warpBoost = 1;
    if (mouseTrail) mouseTrail.burst(pointerX, pointerY, 22);
  });
}

// Agent busy states briefly boost warp — demo wiring only, not pet animation.
if (window.electronAPI && typeof window.electronAPI.onStateChange === "function") {
  window.electronAPI.onStateChange((state) => {
    if (state === "working" || state === "juggling" || state === "thinking") {
      warpBoost = Math.max(warpBoost, 0.55);
    }
  });
}

window.addEventListener("resize", onResize);

document.addEventListener("visibilitychange", () => {
  if (!app || !app.ticker) return;
  if (document.hidden) {
    try { app.ticker.stop(); } catch {}
  } else if (!destroyed) {
    try { app.ticker.start(); } catch {}
  }
});

window.addEventListener("beforeunload", () => {
  destroyApp();
});

boot().catch((err) => {
  const message = err && err.message ? err.message : String(err || "boot failed");
  logWarn(message);
  fallbackToSvg(message);
});
