// --- Phaser desk-pet spike (CLAWD_RENDER_BACKEND=phaser / CLAWD_PHASER_SPIKE=1) ---
// Renders inside the transparent pet window — NOT a separate game BrowserWindow.
// Cursor arrives via pixi-cursor IPC (hit window owns real pointer / drag).

"use strict";

const stageEl = document.getElementById("phaser-stage");
const badgeEl = document.getElementById("phaser-badge");
const errorEl = document.getElementById("phaser-error");

const STATE_HUE = {
  idle: 165,
  thinking: 210,
  working: 18,
  juggling: 18,
  attention: 48,
  notification: 48,
  error: 0,
  sleeping: 250,
};

let game = null;
let sceneRef = null;
let ready = false;
let petVisualReadyNotified = false;
let destroyed = false;
let pointerX = 0;
let pointerY = 0;
let hasPointer = false;
let pendingState = "idle";

function showError(message) {
  if (!errorEl) return;
  errorEl.style.display = "block";
  errorEl.textContent = String(message || "unknown phaser error");
}

function clearError() {
  if (!errorEl) return;
  errorEl.style.display = "none";
  errorEl.textContent = "";
}

function logWarn(...args) {
  try { console.warn("[phaser]", ...args); } catch {}
}

function logInfo(...args) {
  try { console.info("[phaser]", ...args); } catch {}
}

function setBadge(text) {
  if (badgeEl) badgeEl.textContent = String(text || "Phaser");
}

function hueFor(state) {
  return STATE_HUE[state] != null ? STATE_HUE[state] : 165;
}

function notifyPetVisualReadyOnce() {
  if (petVisualReadyNotified) return;
  if (!window.electronAPI || typeof window.electronAPI.notifyPetVisualReady !== "function") return;
  petVisualReadyNotified = true;
  window.electronAPI.notifyPetVisualReady();
  logInfo("pet-visual-ready sent");
}

function fallbackToSvg(reason) {
  logWarn("falling back to SVG entry:", reason);
  showError(`Phaser spike failed: ${reason}\nFalling back to index.html…`);
  setTimeout(() => {
    try { location.replace("index.html"); } catch {}
  }, 250);
}

class PetOrbitScene extends Phaser.Scene {
  create() {
    sceneRef = this;
    const w = this.scale.width || 256;
    const h = this.scale.height || 256;
    this.hue = hueFor(pendingState);
    this.targetHue = this.hue;
    this.pointer = new Phaser.Math.Vector2(w * 0.5, h * 0.55);
    this.orb = new Phaser.Math.Vector2(this.pointer.x, this.pointer.y);
    this.gfx = this.add.graphics();
    this.trail = [];
    this.sparks = [];
    this.cameras.main.setBackgroundColor("rgba(0,0,0,0)");
    ready = true;
    setBadge(`Phaser · pet · ${pendingState}`);
    notifyPetVisualReadyOnce();
    logInfo("scene ready");
  }

  spawnBurst(x, y, count) {
    for (let i = 0; i < count; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = 60 + Math.random() * 180;
      this.sparks.push({
        x, y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        life: 0.4 + Math.random() * 0.5,
        age: 0,
        r: 1.2 + Math.random() * 2.2,
      });
    }
  }

  applyExternalPointer(x, y) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    this.pointer.set(x, y);
  }

  applyExternalState(state) {
    this.targetHue = hueFor(state || "idle");
  }

  update(_t, dtMs) {
    const dt = Math.min(0.05, (dtMs || 16) / 1000);
    this.hue += (this.targetHue - this.hue) * Math.min(1, dt * 4);

    if (hasPointer) {
      this.pointer.set(pointerX, pointerY);
    }

    this.orb.x += (this.pointer.x - this.orb.x) * Math.min(1, dt * 8);
    this.orb.y += (this.pointer.y - this.orb.y) * Math.min(1, dt * 8);

    this.trail.push({ x: this.orb.x, y: this.orb.y, age: 0 });
    if (this.trail.length > 32) this.trail.shift();
    for (const p of this.trail) p.age += dt;

    const busy = pendingState === "working" || pendingState === "juggling" || pendingState === "thinking";
    if (busy && Math.random() < (pendingState === "thinking" ? 0.1 : 0.2)) {
      const ang = Math.random() * Math.PI * 2;
      const rad = 14 + Math.random() * 28;
      this.sparks.push({
        x: this.orb.x + Math.cos(ang) * rad,
        y: this.orb.y + Math.sin(ang) * rad,
        vx: (Math.random() - 0.5) * 30,
        vy: -20 - Math.random() * 40,
        life: 0.7 + Math.random() * 0.5,
        age: 0,
        r: 1 + Math.random() * 1.6,
      });
    }

    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const s = this.sparks[i];
      s.age += dt;
      s.vy += 50 * dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      if (s.age >= s.life) this.sparks.splice(i, 1);
    }

    this.drawFrame();
  }

  drawFrame() {
    const g = this.gfx;
    const hue = this.hue;
    g.clear();

    // No full-window fill — keep Electron pet window transparent.
    for (let i = 1; i < this.trail.length; i++) {
      const a = this.trail[i - 1];
      const b = this.trail[i];
      const k = 1 - a.age / 0.5;
      if (k <= 0) continue;
      const c = Phaser.Display.Color.HSLToColor(hue / 360, 0.85, 0.55 + k * 0.2);
      g.lineStyle(2 + k * 5, c.color, k * 0.75);
      g.beginPath();
      g.moveTo(a.x, a.y);
      g.lineTo(b.x, b.y);
      g.strokePath();
    }

    const pulse = 0.5 + 0.5 * Math.sin(this.time.now * 0.004);
    for (let r = 0; r < 3; r++) {
      const radius = 22 + r * 14 + pulse * 3;
      const c = Phaser.Display.Color.HSLToColor(hue / 360, 0.7, 0.45);
      g.lineStyle(1.5, c.color, 0.22 - r * 0.05);
      g.strokeCircle(this.orb.x, this.orb.y, radius);
    }

    const core = Phaser.Display.Color.HSLToColor(hue / 360, 0.9, 0.62);
    g.fillStyle(core.color, 0.28);
    g.fillCircle(this.orb.x, this.orb.y, 22);
    g.fillStyle(0xffffff, 0.92);
    g.fillCircle(this.orb.x, this.orb.y, 4);
    g.fillStyle(core.color, 0.9);
    g.fillCircle(this.orb.x, this.orb.y, 9);

    for (const s of this.sparks) {
      const k = 1 - s.age / s.life;
      const c = Phaser.Display.Color.HSLToColor(hue / 360, 0.95, 0.6);
      g.fillStyle(c.color, k);
      g.fillCircle(s.x, s.y, s.r * (0.5 + k));
    }
  }
}

function destroyApp() {
  if (destroyed) return;
  destroyed = true;
  ready = false;
  sceneRef = null;
  try {
    if (game) game.destroy(true);
  } catch {}
  game = null;
}

function boot() {
  if (destroyed) return;
  if (!window.Phaser || typeof window.Phaser.Game !== "function") {
    throw new Error("Phaser global missing — vendor/phaser.min.js failed to load");
  }
  if (!stageEl) throw new Error("#phaser-stage missing");

  clearError();
  const w = Math.max(64, stageEl.clientWidth || window.innerWidth || 256);
  const h = Math.max(64, stageEl.clientHeight || window.innerHeight || 256);

  game = new Phaser.Game({
    type: Phaser.WEBGL,
    parent: stageEl,
    width: w,
    height: h,
    backgroundColor: "#00000000",
    transparent: true,
    scene: PetOrbitScene,
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    render: {
      transparent: true,
      clearBeforeRender: true,
    },
  });
  setBadge("Phaser · pet · booting…");
  logInfo("boot complete");
}

if (window.electronAPI && typeof window.electronAPI.onPixiCursor === "function") {
  window.electronAPI.onPixiCursor((payload) => {
    if (!payload || !Number.isFinite(payload.x) || !Number.isFinite(payload.y)) return;
    pointerX = payload.x;
    pointerY = payload.y;
    hasPointer = true;
    if (sceneRef && typeof sceneRef.applyExternalPointer === "function") {
      sceneRef.applyExternalPointer(pointerX, pointerY);
    }
  });
}

if (window.electronAPI && typeof window.electronAPI.onStateChange === "function") {
  window.electronAPI.onStateChange((state) => {
    pendingState = state || "idle";
    if (sceneRef && typeof sceneRef.applyExternalState === "function") {
      sceneRef.applyExternalState(pendingState);
    }
    setBadge(`Phaser · pet · ${pendingState}`);
  });
}

if (window.electronAPI && typeof window.electronAPI.onPlayClickReaction === "function") {
  window.electronAPI.onPlayClickReaction(() => {
    if (!sceneRef || typeof sceneRef.spawnBurst !== "function") return;
    const x = hasPointer ? pointerX : (sceneRef.orb ? sceneRef.orb.x : 128);
    const y = hasPointer ? pointerY : (sceneRef.orb ? sceneRef.orb.y : 128);
    sceneRef.spawnBurst(x, y, 22);
    setBadge(`Phaser · pet · click`);
  });
}

window.addEventListener("beforeunload", () => {
  destroyApp();
});

try {
  boot();
} catch (err) {
  const message = err && err.message ? err.message : String(err || "boot failed");
  logWarn(message);
  fallbackToSvg(message);
}
