// --- Rive theme renderer (index-rive.html) ---
// Driven by window.themeConfig / onThemeConfig when the active theme has
// renderBackend "rive". Spike env (CLAWD_RIVE_SPIKE / CLAWD_RENDER_BACKEND=rive)
// falls back to assets/source/rive/demo.riv when no theme file is configured.
// Cursor arrives via pixi-cursor IPC (render window ignores mouse events).
// Listener-based .riv files (e.g. isTracking gaze) need those coords replayed
// onto the canvas as synthetic pointer events — the hit window owns real input.

"use strict";

const SPIKE_DEMO_RIV_URL = "../assets/source/rive/demo.riv";
// Prefer character SMs (teddy Login Machine) before skills / generic fallbacks.
const DEFAULT_STATE_MACHINES = [
  "Login Machine",
  "Clawd",
  "Designer's Test",
  "State Machine 1",
  "bumpy",
  "Button",
];
const DEFAULT_INPUTS = { level: "Level", hover: "Hovering", bump: "bump" };
const DEFAULT_STATE_LEVELS = {
  idle: 0,
  thinking: 1,
  working: 2,
  juggling: 2,
  attention: 1,
  notification: 1,
  error: 1,
  sleeping: 0,
  waking: 0,
};
const BOOT_TIMEOUT_MS = 12000;
const MAX_RIVE_FETCH_BYTES = 20 * 1024 * 1024;

const stageEl = document.getElementById("rive-stage");
const canvasEl = document.getElementById("rive-canvas");
const badgeEl = document.getElementById("rive-badge");
const errorEl = document.getElementById("rive-error");

let activeThemeConfig = window.themeConfig || null;
let fxCanvas = null;
let fxCtx = null;
let riveInstance = null;
let smName = null;
let inputsByName = Object.create(null);
let ready = false;
let petVisualReadyNotified = false;
let destroyed = false;
let pendingState = "idle";
let pointerX = 0;
let pointerY = 0;
let hasPointer = false;
let level = 0;
let hover = false;
let fxParticles = [];
let fxTrail = [];
let fxRaf = 0;
let timeMs = 0;
let burstUntil = 0;
let bootGeneration = 0;
let loadedAssetUrl = null;
function showError(message) {
  if (!errorEl) return;
  errorEl.style.display = "block";
  errorEl.textContent = String(message || "unknown rive error");
}

function clearError() {
  if (!errorEl) return;
  errorEl.style.display = "none";
  errorEl.textContent = "";
}

function logWarn(...args) {
  try { console.warn("[rive]", ...args); } catch {}
}

function logInfo(...args) {
  try { console.info("[rive]", ...args); } catch {}
}

function setBadge(text) {
  if (badgeEl) badgeEl.textContent = String(text || "Rive");
}

function isSpikeMode() {
  const backend = activeThemeConfig && activeThemeConfig.renderBackend;
  if (backend === "rive" && activeThemeConfig.rive && activeThemeConfig.rive.assetUrl) return false;
  return true;
}

function getRiveConfig() {
  const rive = activeThemeConfig && activeThemeConfig.rive && typeof activeThemeConfig.rive === "object"
    ? activeThemeConfig.rive
    : null;
  const inputs = { ...DEFAULT_INPUTS, ...(rive && rive.inputs ? rive.inputs : {}) };
  const stateLevels = { ...DEFAULT_STATE_LEVELS, ...(rive && rive.stateLevels ? rive.stateLevels : {}) };
  let stateMachines = [];
  if (rive && typeof rive.stateMachine === "string" && rive.stateMachine.trim()) {
    stateMachines.push(rive.stateMachine.trim());
  }
  if (rive && Array.isArray(rive.stateMachines)) {
    for (const name of rive.stateMachines) {
      if (typeof name === "string" && name.trim() && !stateMachines.includes(name.trim())) {
        stateMachines.push(name.trim());
      }
    }
  }
  for (const name of DEFAULT_STATE_MACHINES) {
    if (!stateMachines.includes(name)) stateMachines.push(name);
  }
  const bindings = rive && (Array.isArray(rive.bindings)
    || (rive.bindings && typeof rive.bindings === "object"))
    ? rive.bindings
    : null;
  return {
    file: rive && typeof rive.file === "string" ? rive.file : null,
    assetUrl: rive && typeof rive.assetUrl === "string" && rive.assetUrl ? rive.assetUrl : null,
    stateMachines,
    inputs,
    stateLevels,
    bindings,
    fx: !!(rive && rive.fx === true),
  };
}

// Canonical, theme-authored input bindings for the active config. The renderer
// has zero knowledge of any specific .riv, input name, or character — it only
// applies these ops by exact input name. rive-bindings.js owns the shape and
// the legacy (inputs/stateLevels) adapter.
function resolveActiveBindings() {
  const RB = window.RiveBindings;
  if (!RB || typeof RB.normalizeRiveBindings !== "function") return [];
  try {
    return RB.normalizeRiveBindings(getRiveConfig());
  } catch {
    return [];
  }
}

let activeBindings = [];

// Apply a flat op list (from RiveBindings.computeInputOps) to the live state
// machine. Each op targets an input by exact name; type is checked against the
// real input so a mismatched declaration is skipped instead of throwing.
function ensureRiveListeners() {
  if (!riveInstance || typeof riveInstance.setupRiveListeners !== "function") return;
  try { riveInstance.setupRiveListeners(); } catch {}
}

// Replay main-process cursor samples onto the Rive canvas so Listener-based
// state machines (gaze / flip-on-click, etc.) track the global pointer.
function dispatchCanvasPointer(type, localX, localY) {
  if (!canvasEl || !ready) return;
  const rect = canvasEl.getBoundingClientRect();
  const clientX = rect.left + localX;
  const clientY = rect.top + localY;
  const isDown = type === "mousedown";
  try {
    canvasEl.dispatchEvent(new MouseEvent(type, {
      bubbles: true,
      cancelable: true,
      clientX,
      clientY,
      screenX: clientX,
      screenY: clientY,
      button: 0,
      buttons: isDown ? 1 : 0,
    }));
  } catch {}
}

function applyOps(ops) {
  if (!Array.isArray(ops)) return;
  for (const op of ops) {
    if (!op || typeof op.input !== "string") continue;
    const input = findInput(op.input);
    if (!input) continue;
    if (op.kind === "trigger") {
      if (typeof input.fire === "function") { try { input.fire(); } catch {} }
    } else if (op.kind === "bool") {
      if (typeof input.value === "boolean") { try { input.value = !!op.set; } catch {} }
    } else if (op.kind === "number") {
      if (typeof input.value === "number" && Number.isFinite(op.set)) {
        try { input.value = op.set; } catch {}
      }
    }
  }
}

function computeOps(cause) {
  const RB = window.RiveBindings;
  if (!RB || typeof RB.computeInputOps !== "function") return [];
  const w = Math.max(1, (canvasEl && canvasEl.clientWidth) || 1);
  const h = Math.max(1, (canvasEl && canvasEl.clientHeight) || 1);
  return RB.computeInputOps(activeBindings, {
    cause,
    state: pendingState,
    hover,
    pointerX01: hasPointer ? pointerX / w : null,
    pointerY01: hasPointer ? pointerY / h : null,
  });
}

// Overlay FX (radial glow + rising particles + cursor trail) is opt-in.
// Real themes render their .riv untouched unless they set rive.fx: true.
// The dev spike demo keeps FX so its showcase behaviour is unchanged.
function fxEnabled() {
  if (isSpikeMode()) return true;
  return getRiveConfig().fx === true;
}

function resolveRivUrl() {
  const cfg = getRiveConfig();
  if (cfg.assetUrl) return cfg.assetUrl;
  return SPIKE_DEMO_RIV_URL;
}

function displayName() {
  const cfg = getRiveConfig();
  if (cfg.file) return cfg.file.replace(/\.riv$/i, "");
  return "demo";
}

function fallbackToSvg(reason) {
  if (!isSpikeMode()) {
    logWarn("theme rive failed (no SVG fallback):", reason);
    showError(`Rive theme failed:\n${reason}`);
    notifyPetVisualReadyOnce();
    return;
  }
  logWarn("falling back to SVG entry:", reason);
  showError(`Rive demo failed: ${reason}\nFalling back to index.html…`);
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

function removeFxCanvas() {
  if (fxRaf) { cancelAnimationFrame(fxRaf); fxRaf = 0; }
  fxParticles = [];
  fxTrail = [];
  if (fxCanvas && fxCanvas.parentNode) {
    try { fxCanvas.parentNode.removeChild(fxCanvas); } catch {}
  }
  fxCanvas = null;
  fxCtx = null;
}

function ensureFxCanvas() {
  if (!fxEnabled()) { removeFxCanvas(); return; }
  if (fxCanvas || !stageEl) return;
  fxCanvas = document.createElement("canvas");
  fxCanvas.id = "rive-fx";
  fxCanvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:1;";
  stageEl.appendChild(fxCanvas);
  fxCtx = fxCanvas.getContext("2d");
  if (badgeEl) badgeEl.style.zIndex = "2";
}

function resizeCanvases() {
  if (!stageEl) return;
  const w = Math.max(1, stageEl.clientWidth || window.innerWidth || 256);
  const h = Math.max(1, stageEl.clientHeight || window.innerHeight || 256);
  const dpr = window.devicePixelRatio || 1;

  if (canvasEl) {
    canvasEl.width = Math.floor(w * dpr);
    canvasEl.height = Math.floor(h * dpr);
    canvasEl.style.width = w + "px";
    canvasEl.style.height = h + "px";
    if (riveInstance && typeof riveInstance.resizeDrawingSurfaceToCanvas === "function") {
      try { riveInstance.resizeDrawingSurfaceToCanvas(); } catch {}
    }
  }

  ensureFxCanvas();
  if (fxCanvas) {
    fxCanvas.width = Math.floor(w * dpr);
    fxCanvas.height = Math.floor(h * dpr);
    if (fxCtx) fxCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
}

function indexInputs() {
  inputsByName = Object.create(null);
  if (!riveInstance || !smName) return;
  let inputs = null;
  try { inputs = riveInstance.stateMachineInputs(smName); } catch (err) {
    logWarn("stateMachineInputs failed:", err && err.message);
    return;
  }
  if (!Array.isArray(inputs)) return;
  for (const input of inputs) {
    if (!input || !input.name) continue;
    inputsByName[String(input.name)] = input;
    inputsByName[String(input.name).toLowerCase()] = input;
  }
  logInfo("inputs:", Object.keys(inputsByName).filter((k) => k === k.toLowerCase()));
}

// Resolve a live state-machine input by exact name (case-insensitive as a
// convenience for author typos). No fuzzy alias lists — bindings name the
// input explicitly.
function findInput(name) {
  if (!name) return null;
  return inputsByName[name] || inputsByName[String(name).toLowerCase()] || null;
}

function spawnBurst(x, y, count, hue) {
  if (!fxEnabled()) return;
  const n = Math.max(8, Math.min(40, count || 18));
  for (let i = 0; i < n; i++) {
    const ang = Math.random() * Math.PI * 2;
    const spd = 40 + Math.random() * 160;
    fxParticles.push({
      x, y,
      vx: Math.cos(ang) * spd,
      vy: Math.sin(ang) * spd - 30,
      life: 0.5 + Math.random() * 0.45,
      age: 0,
      r: 1.5 + Math.random() * 3,
      hue: hue + (Math.random() * 40 - 20),
    });
  }
  burstUntil = timeMs + 350;
}

function applyPointerToInputs() {
  if (!ready || !canvasEl) return;
  const w = Math.max(1, canvasEl.clientWidth || 1);
  const h = Math.max(1, canvasEl.clientHeight || 1);
  const cx = w * 0.5;
  const cy = h * 0.55;
  const dist = Math.hypot(pointerX - cx, pointerY - cy);
  const over = hasPointer && pointerX >= 0 && pointerY >= 0 && pointerX <= w && pointerY <= h;
  const near = hasPointer && dist < Math.min(w, h) * 0.42;
  hover = over || near;

  applyOps(computeOps("pointer"));
  if (hasPointer) {
    dispatchCanvasPointer("mousemove", pointerX, pointerY);
  }

  if (fxEnabled() && hasPointer) {
    fxTrail.push({ x: pointerX, y: pointerY, age: 0, life: 0.35 });
    if (fxTrail.length > 28) fxTrail.shift();
  }
}

// Coarse 0..2 level derived from stateLevels — used ONLY for opt-in FX
// hue/intensity, never to drive the .riv (that is binding-only).
function levelForState(state) {
  const cfg = getRiveConfig();
  const s = String(state || "idle");
  if (Object.prototype.hasOwnProperty.call(cfg.stateLevels, s)
    && Number.isFinite(cfg.stateLevels[s])) {
    return Math.max(0, Math.min(2, Math.floor(cfg.stateLevels[s])));
  }
  if (s === "working" || s === "juggling") return 2;
  if (s === "thinking" || s === "attention" || s === "notification" || s === "error") return 1;
  return 0;
}

function applyAgentState(state) {
  pendingState = state || "idle";
  if (!ready) return;
  const s = String(pendingState);

  applyOps(computeOps("state"));

  level = levelForState(s);
  const w = canvasEl ? canvasEl.clientWidth : 128;
  const h = canvasEl ? canvasEl.clientHeight : 128;
  const hue = level === 2 ? 15 : level === 1 ? 200 : 140;
  spawnBurst(w * 0.5, h * 0.55, 12 + level * 8, hue);
  setBadge(`Rive · ${displayName()} · ${s}${hover ? " · hover" : ""}`);
}

function tickFx(now) {
  if (destroyed || !fxCtx || !fxCanvas) return;
  const dt = Math.min(0.05, (now - (tickFx._last || now)) / 1000);
  tickFx._last = now;
  timeMs += dt * 1000;

  const w = fxCanvas.clientWidth || (fxCanvas.width / (window.devicePixelRatio || 1));
  const h = fxCanvas.clientHeight || (fxCanvas.height / (window.devicePixelRatio || 1));
  fxCtx.clearRect(0, 0, w, h);

  const hue = level === 2 ? 18 : level === 1 ? 205 : 155;
  const pulseBase = 0.18;
  const g = fxCtx.createRadialGradient(w * 0.5, h * 0.58, 8, w * 0.5, h * 0.58, Math.min(w, h) * 0.55);
  const pulse = pulseBase + Math.sin(timeMs * 0.004) * 0.03 + (burstUntil > timeMs ? 0.08 : 0);
  g.addColorStop(0, `hsla(${hue}, 90%, 60%, ${pulse})`);
  g.addColorStop(1, "hsla(0,0%,0%,0)");
  fxCtx.fillStyle = g;
  fxCtx.fillRect(0, 0, w, h);

  if (Math.random() < 0.25 + level * 0.1) {
    fxParticles.push({
      x: Math.random() * w,
      y: h + 4,
      vx: (Math.random() - 0.5) * 20,
      vy: -20 - Math.random() * 40,
      life: 1.2 + Math.random(),
      age: 0,
      r: 1 + Math.random() * 1.8,
      hue: hue + Math.random() * 30,
    });
  }

  fxCtx.lineCap = "round";
  fxCtx.lineJoin = "round";
  for (let i = 1; i < fxTrail.length; i++) {
    const a = fxTrail[i - 1];
    const b = fxTrail[i];
    a.age += dt;
    const alpha = Math.max(0, 1 - a.age / a.life) * 0.55;
    fxCtx.strokeStyle = `hsla(${hue}, 100%, 70%, ${alpha})`;
    fxCtx.lineWidth = 2 + (1 - i / fxTrail.length) * 6;
    fxCtx.beginPath();
    fxCtx.moveTo(a.x, a.y);
    fxCtx.lineTo(b.x, b.y);
    fxCtx.stroke();
  }
  fxTrail = fxTrail.filter((p) => p.age < p.life);

  if (hasPointer) {
    const rg = fxCtx.createRadialGradient(pointerX, pointerY, 0, pointerX, pointerY, 28);
    rg.addColorStop(0, `hsla(${hue}, 100%, 80%, 0.55)`);
    rg.addColorStop(1, "hsla(0,0%,0%,0)");
    fxCtx.fillStyle = rg;
    fxCtx.beginPath();
    fxCtx.arc(pointerX, pointerY, 28, 0, Math.PI * 2);
    fxCtx.fill();
  }

  for (let i = fxParticles.length - 1; i >= 0; i--) {
    const p = fxParticles[i];
    p.age += dt;
    p.vy += 40 * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    const k = 1 - p.age / p.life;
    if (k <= 0) { fxParticles.splice(i, 1); continue; }
    fxCtx.beginPath();
    fxCtx.fillStyle = `hsla(${p.hue}, 95%, 65%, ${k})`;
    fxCtx.arc(p.x, p.y, p.r * (0.5 + k), 0, Math.PI * 2);
    fxCtx.fill();
  }

  if (badgeEl && ready) {
    const hoverTag = hover ? " · hover" : "";
    badgeEl.textContent = `Rive · ${displayName()}${hoverTag} · ${pendingState}`;
  }

  fxRaf = requestAnimationFrame(tickFx);
}

async function loadRivBuffer(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error("fetch .riv failed: HTTP " + res.status + " (" + url + ")");
  const buf = await res.arrayBuffer();
  if (buf.byteLength > MAX_RIVE_FETCH_BYTES) {
    throw new Error(`.riv exceeds ${MAX_RIVE_FETCH_BYTES} bytes`);
  }
  if (buf.byteLength < 16) throw new Error(".riv file too small / empty");
  return buf;
}

function createRiveWithSm(riveApi, buffer, sm) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const failTimer = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error("Rive onLoad timeout for sm=" + sm));
    }, BOOT_TIMEOUT_MS);

    try {
      const instance = new riveApi.Rive({
        buffer,
        canvas: canvasEl,
        autoplay: true,
        stateMachines: sm,
        // Listeners attach to the canvas; real OS pointer never hits it (hit
        // window owns input). dispatchCanvasPointer replays pixi-cursor coords.
        shouldDisableRiveListeners: false,
        layout: riveApi.Layout
          ? new riveApi.Layout({
            fit: riveApi.Fit ? riveApi.Fit.Contain : "contain",
            alignment: riveApi.Alignment ? riveApi.Alignment.Center : "center",
          })
          : undefined,
        onLoad: () => {
          if (settled) return;
          settled = true;
          clearTimeout(failTimer);
          resolve(instance);
        },
        onLoadError: (err) => {
          if (settled) return;
          settled = true;
          clearTimeout(failTimer);
          reject(err || new Error("Rive onLoadError sm=" + sm));
        },
      });
    } catch (err) {
      clearTimeout(failTimer);
      if (!settled) {
        settled = true;
        reject(err);
      }
    }
  });
}

function cleanupRiveInstance() {
  ready = false;
  if (fxRaf) cancelAnimationFrame(fxRaf);
  fxRaf = 0;
  try {
    if (riveInstance && typeof riveInstance.cleanup === "function") riveInstance.cleanup();
  } catch {}
  try {
    if (riveInstance && typeof riveInstance.stop === "function") riveInstance.stop();
  } catch {}
  riveInstance = null;
  smName = null;
  inputsByName = Object.create(null);
  loadedAssetUrl = null;
}

async function boot(reason) {
  if (destroyed) return;
  const gen = ++bootGeneration;
  const riveApi = window.rive;
  if (!riveApi || typeof riveApi.Rive !== "function") {
    throw new Error("rive global missing — vendor/rive.js failed to load");
  }
  if (!canvasEl) throw new Error("#rive-canvas missing");

  cleanupRiveInstance();
  clearError();
  resizeCanvases();

  const rivUrl = resolveRivUrl();
  setBadge(`Rive · ${displayName()} · loading…`);
  logInfo("boot", reason || "start", "url=", rivUrl);

  const buffer = await loadRivBuffer(rivUrl);
  if (gen !== bootGeneration || destroyed) return;
  logInfo(".riv bytes=", buffer.byteLength);

  const candidates = getRiveConfig().stateMachines;
  let lastErr = null;
  for (const sm of candidates) {
    if (gen !== bootGeneration || destroyed) return;
    try {
      riveInstance = await createRiveWithSm(riveApi, buffer, sm);
      smName = sm;
      lastErr = null;
      break;
    } catch (err) {
      lastErr = err;
      try {
        if (riveInstance && typeof riveInstance.cleanup === "function") riveInstance.cleanup();
      } catch {}
      riveInstance = null;
    }
  }
  if (!riveInstance) throw lastErr || new Error("no state machine could load");
  if (gen !== bootGeneration || destroyed) {
    cleanupRiveInstance();
    return;
  }

  loadedAssetUrl = rivUrl;
  resizeCanvases();
  indexInputs();
  ensureRiveListeners();
  activeBindings = resolveActiveBindings();
  ready = true;
  applyAgentState(pendingState);
  applyPointerToInputs();
  notifyPetVisualReadyOnce();
  setBadge(`Rive · ${displayName()} · ${smName} · L${level}`);
  logInfo("boot complete; sm=", smName, "inputs=", Object.keys(inputsByName).length);

  if (fxEnabled()) {
    fxRaf = requestAnimationFrame(tickFx);
  }
}

function destroyApp() {
  if (destroyed) return;
  destroyed = true;
  bootGeneration += 1;
  cleanupRiveInstance();
}

function applyThemeConfig(cfg) {
  activeThemeConfig = cfg || null;
  const nextUrl = resolveRivUrl();
  if (ready && loadedAssetUrl && nextUrl === loadedAssetUrl) {
    activeBindings = resolveActiveBindings();
    applyAgentState(pendingState);
    applyPointerToInputs();
    return;
  }
  boot("theme-config").catch((err) => {
    const message = err && err.message ? err.message : String(err || "boot failed");
    logWarn(message);
    fallbackToSvg(message);
  });
}

if (window.electronAPI && typeof window.electronAPI.onPixiCursor === "function") {
  window.electronAPI.onPixiCursor((payload) => {
    if (!payload || !Number.isFinite(payload.x) || !Number.isFinite(payload.y)) return;
    pointerX = payload.x;
    pointerY = payload.y;
    hasPointer = true;
    applyPointerToInputs();
  });
}

if (window.electronAPI && typeof window.electronAPI.onStateChange === "function") {
  window.electronAPI.onStateChange((state) => {
    applyAgentState(state || "idle");
  });
}

if (window.electronAPI && typeof window.electronAPI.onThemeConfig === "function") {
  window.electronAPI.onThemeConfig((cfg) => {
    applyThemeConfig(cfg);
  });
}

if (window.electronAPI && typeof window.electronAPI.onPlayClickReaction === "function") {
  window.electronAPI.onPlayClickReaction(() => {
    const w = canvasEl ? canvasEl.clientWidth : 128;
    const h = canvasEl ? canvasEl.clientHeight : 128;
    const x = hasPointer ? pointerX : w * 0.5;
    const y = hasPointer ? pointerY : h * 0.55;
    // Click reaction is theme-authored: fire whatever the theme bound to click.
    dispatchCanvasPointer("mousedown", x, y);
    dispatchCanvasPointer("mouseup", x, y);
    applyOps(computeOps("click"));
    spawnBurst(x, y, 20, level === 2 ? 15 : 190);
    setBadge(`Rive · ${displayName()} · click`);
  });
}

window.addEventListener("resize", () => {
  resizeCanvases();
  applyPointerToInputs();
});

window.addEventListener("beforeunload", () => {
  destroyApp();
});

boot("initial").catch((err) => {
  const message = err && err.message ? err.message : String(err || "boot failed");
  logWarn(message);
  fallbackToSvg(message);
});
