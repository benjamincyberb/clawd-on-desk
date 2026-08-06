"use strict";

/**
 * Aurora Core — lavish sandbox Phaser desk-pet demo.
 * Driven entirely by window.clawdPet (no electronAPI).
 */

const badgeEl = document.getElementById("badge");

const STATE = {
  idle: {
    hue: 168,
    accent: 42,
    pulse: 1.0,
    swirl: 1.0,
    sparks: 0.35,
    label: "Idle",
  },
  thinking: {
    hue: 215,
    accent: 280,
    pulse: 1.35,
    swirl: 1.6,
    sparks: 0.55,
    label: "Thinking",
  },
  working: {
    hue: 22,
    accent: 48,
    pulse: 1.85,
    swirl: 2.4,
    sparks: 1.0,
    label: "Working",
  },
  juggling: {
    hue: 18,
    accent: 320,
    pulse: 2.0,
    swirl: 2.8,
    sparks: 1.15,
    label: "Juggling",
  },
  attention: {
    hue: 48,
    accent: 12,
    pulse: 1.7,
    swirl: 1.8,
    sparks: 0.8,
    label: "Attention",
  },
  notification: {
    hue: 52,
    accent: 200,
    pulse: 1.6,
    swirl: 1.7,
    sparks: 0.75,
    label: "Notify",
  },
  error: {
    hue: 0,
    accent: 330,
    pulse: 2.1,
    swirl: 2.2,
    sparks: 1.2,
    label: "Error",
  },
  sleeping: {
    hue: 255,
    accent: 210,
    pulse: 0.45,
    swirl: 0.35,
    sparks: 0.12,
    label: "Sleep",
  },
  waking: {
    hue: 175,
    accent: 55,
    pulse: 1.4,
    swirl: 1.5,
    sparks: 0.7,
    label: "Waking",
  },
};

let sceneRef = null;
let ready = false;
let pointerX = 0;
let pointerY = 0;
let hasPointer = false;
let pendingState = "idle";

function setBadge(text) {
  if (badgeEl) badgeEl.textContent = String(text || "Aurora");
}

function profileFor(state) {
  return STATE[state] || STATE.idle;
}

function hsl(h, s, l, a) {
  const c = Phaser.Display.Color.HSLToColor(
    ((h % 360) + 360) % 360 / 360,
    Phaser.Math.Clamp(s, 0, 1),
    Phaser.Math.Clamp(l, 0, 1)
  );
  return { color: c.color, alpha: a == null ? 1 : a };
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function angleLerp(a, b, t) {
  let d = ((b - a + 540) % 360) - 180;
  return a + d * t;
}

class AuroraScene extends Phaser.Scene {
  create() {
    sceneRef = this;
    const w = this.scale.width || 256;
    const h = this.scale.height || 256;
    const cx = w * 0.5;
    const cy = h * 0.52;

    const p = profileFor(pendingState);
    this.hue = p.hue;
    this.accent = p.accent;
    this.pulse = p.pulse;
    this.swirl = p.swirl;
    this.sparkRate = p.sparks;
    this.target = { ...p };

    this.core = new Phaser.Math.Vector2(cx, cy);
    this.pointer = new Phaser.Math.Vector2(cx, cy);
    this.vel = new Phaser.Math.Vector2(0, 0);

    this.gfx = this.add.graphics();
    this.timeSec = 0;
    this.ribbon = [];
    this.motes = [];
    this.sparks = [];
    this.shockwaves = [];
    this.orbitAngle = 0;
    this.bloomFlash = 0;
    this.clickRipple = 0;

    for (let i = 0; i < 42; i++) {
      this.motes.push(this._spawnMote(w, h, true));
    }

    this.cameras.main.setBackgroundColor("rgba(0,0,0,0)");
    ready = true;
    setBadge(`Aurora · ${p.label}`);
  }

  _spawnMote(w, h, scatter) {
    const ang = Math.random() * Math.PI * 2;
    const rad = scatter ? 20 + Math.random() * 110 : 50 + Math.random() * 90;
    return {
      ang,
      rad,
      spin: (0.15 + Math.random() * 0.55) * (Math.random() < 0.5 ? -1 : 1),
      size: 0.8 + Math.random() * 2.4,
      phase: Math.random() * Math.PI * 2,
      life: scatter ? 0.4 + Math.random() * 0.6 : 1,
      twinkle: 1.5 + Math.random() * 3,
      hueShift: (Math.random() - 0.5) * 40,
    };
  }

  spawnBurst(x, y, power) {
    const n = Math.floor(28 + power * 36);
    for (let i = 0; i < n; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = 80 + Math.random() * (220 + power * 180);
      this.sparks.push({
        x,
        y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        life: 0.45 + Math.random() * 0.7,
        max: 0.45 + Math.random() * 0.7,
        size: 1.5 + Math.random() * 3.5,
        hue: this.hue + (Math.random() - 0.5) * 50,
        accent: Math.random() < 0.35,
      });
    }
    this.shockwaves.push({ x, y, r: 8, life: 1, max: 70 + power * 40 });
    this.shockwaves.push({ x, y, r: 4, life: 1, max: 110 + power * 55, delay: 0.08 });
    this.bloomFlash = Math.min(1.4, this.bloomFlash + 0.9 + power * 0.5);
    this.clickRipple = 1;
  }

  setAgentState(state) {
    pendingState = state || "idle";
    const p = profileFor(pendingState);
    this.target = { ...p };
    setBadge(`Aurora · ${p.label}`);
  }

  setPointer(x, y) {
    this.pointer.set(x, y);
  }

  update(_t, dtMs) {
    const dt = Math.min(0.05, (dtMs || 16) / 1000);
    this.timeSec += dt;

    this.hue = angleLerp(this.hue, this.target.hue, Math.min(1, dt * 3.2));
    this.accent = angleLerp(this.accent, this.target.accent, Math.min(1, dt * 2.6));
    this.pulse = lerp(this.pulse, this.target.pulse, Math.min(1, dt * 3));
    this.swirl = lerp(this.swirl, this.target.swirl, Math.min(1, dt * 3));
    this.sparkRate = lerp(this.sparkRate, this.target.sparks, Math.min(1, dt * 3));
    this.bloomFlash = Math.max(0, this.bloomFlash - dt * 1.4);
    this.clickRipple = Math.max(0, this.clickRipple - dt * 1.8);

    const follow = hasPointer ? 10 : 2.8;
    const ax = (this.pointer.x - this.core.x) * follow;
    const ay = (this.pointer.y - this.core.y) * follow;
    this.vel.x = lerp(this.vel.x, ax, Math.min(1, dt * 6));
    this.vel.y = lerp(this.vel.y, ay, Math.min(1, dt * 6));
    this.core.x += this.vel.x * dt;
    this.core.y += this.vel.y * dt;

    // Soft leash toward center so pet stays readable while dragging cursor away.
    const w = this.scale.width || 256;
    const h = this.scale.height || 256;
    const homeX = w * 0.5;
    const homeY = h * 0.52;
    if (!hasPointer) {
      this.core.x += (homeX - this.core.x) * Math.min(1, dt * 1.4);
      this.core.y += (homeY - this.core.y) * Math.min(1, dt * 1.4);
      this.pointer.x += (homeX - this.pointer.x) * Math.min(1, dt * 1.2);
      this.pointer.y += (homeY - this.pointer.y) * Math.min(1, dt * 1.2);
    }

    this.orbitAngle += dt * (0.7 + this.swirl * 0.9);

    this.ribbon.unshift({
      x: this.core.x,
      y: this.core.y,
      a: 1,
      hue: this.hue,
    });
    if (this.ribbon.length > 36) this.ribbon.pop();
    for (const p of this.ribbon) p.a *= 0.94;

    // Ambient mote motion + occasional respawn.
    for (const m of this.motes) {
      m.ang += m.spin * dt * this.swirl;
      m.phase += dt * m.twinkle;
      m.life = Math.min(1, m.life + dt * 0.35);
    }
    if (Math.random() < dt * (0.8 + this.sparkRate * 2.5)) {
      const idx = Math.floor(Math.random() * this.motes.length);
      this.motes[idx] = this._spawnMote(w, h, false);
    }

    // Soft continuous ember spray near core when energetic.
    if (Math.random() < dt * this.sparkRate * 6) {
      const ang = Math.random() * Math.PI * 2;
      const spd = 20 + Math.random() * 70 * this.sparkRate;
      this.sparks.push({
        x: this.core.x + Math.cos(ang) * 10,
        y: this.core.y + Math.sin(ang) * 10,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd - 20,
        life: 0.35 + Math.random() * 0.45,
        max: 0.35 + Math.random() * 0.45,
        size: 1 + Math.random() * 2.2,
        hue: this.hue + (Math.random() - 0.5) * 30,
        accent: Math.random() < 0.25,
      });
    }

    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const s = this.sparks[i];
      s.life -= dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.vy += 90 * dt;
      s.vx *= 0.99;
      if (s.life <= 0) this.sparks.splice(i, 1);
    }

    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const sw = this.shockwaves[i];
      if (sw.delay > 0) {
        sw.delay -= dt;
        continue;
      }
      sw.r += (sw.max - sw.r) * Math.min(1, dt * 5.5) + 40 * dt;
      sw.life -= dt * 1.35;
      if (sw.life <= 0) this.shockwaves.splice(i, 1);
    }

    this._draw();
  }

  _draw() {
    const g = this.gfx;
    g.clear();
    const t = this.timeSec;
    const cx = this.core.x;
    const cy = this.core.y;
    const breathe = 0.5 + 0.5 * Math.sin(t * (1.6 + this.pulse * 0.8));
    const energy = this.pulse * (0.85 + 0.15 * breathe) + this.bloomFlash * 0.55;

    // Far aurora wash
    for (let i = 3; i >= 0; i--) {
      const r = 58 + i * 22 + breathe * 8 + this.bloomFlash * 18;
      const col = hsl(this.hue + i * 12, 0.7, 0.55, 0.04 + i * 0.015 + this.bloomFlash * 0.03);
      g.fillStyle(col.color, col.alpha);
      g.fillCircle(cx, cy + 6, r);
    }

    // Ribbon trail (layered)
    for (let i = this.ribbon.length - 1; i >= 0; i--) {
      const p = this.ribbon[i];
      const k = i / this.ribbon.length;
      const r = 4 + (1 - k) * 14 * energy * 0.35;
      const c1 = hsl(p.hue, 0.85, 0.58, p.a * 0.22);
      const c2 = hsl(p.hue + 40, 0.9, 0.7, p.a * 0.12);
      g.fillStyle(c2.color, c2.alpha);
      g.fillCircle(p.x + Math.sin(t * 3 + i) * 2, p.y + Math.cos(t * 2.4 + i) * 2, r * 1.35);
      g.fillStyle(c1.color, c1.alpha);
      g.fillCircle(p.x, p.y, r);
    }

    // Orbital rings
    this._drawRing(g, cx, cy, 34 + breathe * 3, this.orbitAngle, 18, this.hue, 0.35 * energy);
    this._drawRing(g, cx, cy, 48 + breathe * 4, -this.orbitAngle * 1.35, 12, this.accent, 0.28 * energy);
    this._drawRing(g, cx, cy, 62 + this.clickRipple * 10, this.orbitAngle * 0.7, 9, this.hue + 80, 0.18 * energy);

    // Ambient motes
    for (const m of this.motes) {
      const tw = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(m.phase));
      const x = cx + Math.cos(m.ang) * m.rad;
      const y = cy + Math.sin(m.ang) * m.rad * 0.78;
      const col = hsl(this.hue + m.hueShift, 0.85, 0.72, m.life * tw * 0.55 * energy);
      g.fillStyle(col.color, col.alpha);
      g.fillCircle(x, y, m.size * (0.7 + tw * 0.5));
      if (tw > 0.85) {
        const hot = hsl(this.accent, 0.9, 0.85, m.life * 0.35);
        g.fillStyle(hot.color, hot.alpha);
        g.fillCircle(x, y, m.size * 0.45);
      }
    }

    // Shockwaves
    for (const sw of this.shockwaves) {
      if (sw.delay > 0) continue;
      const a = Math.max(0, sw.life) * 0.55;
      const c = hsl(this.accent, 0.95, 0.7, a);
      g.lineStyle(2.5, c.color, c.alpha);
      g.strokeCircle(sw.x, sw.y, sw.r);
      const c2 = hsl(this.hue, 0.8, 0.65, a * 0.45);
      g.lineStyle(1.2, c2.color, c2.alpha);
      g.strokeCircle(sw.x, sw.y, sw.r * 0.72);
    }

    // Sparks
    for (const s of this.sparks) {
      const a = Math.max(0, s.life / s.max);
      const col = hsl(s.accent ? this.accent : s.hue, 0.95, 0.68, a);
      g.fillStyle(col.color, col.alpha);
      g.fillCircle(s.x, s.y, s.size * (0.5 + a));
      if (a > 0.55) {
        g.fillStyle(0xffffff, a * 0.55);
        g.fillCircle(s.x, s.y, s.size * 0.35);
      }
    }

    // Core bloom layers
    const bloom = 22 + energy * 10 + this.bloomFlash * 16;
    for (let i = 4; i >= 1; i--) {
      const col = hsl(this.hue + i * 8, 0.85, 0.6, (0.07 + i * 0.03) * energy);
      g.fillStyle(col.color, col.alpha);
      g.fillCircle(cx, cy, bloom * (0.45 + i * 0.18));
    }

    // Crystalline body
    const body = hsl(this.hue, 0.82, 0.58, 0.96);
    const rim = hsl(this.accent, 0.9, 0.7, 0.55 + 0.25 * breathe);
    g.fillStyle(rim.color, rim.alpha);
    g.fillCircle(cx, cy, 19 + breathe * 2 + this.bloomFlash * 3);
    g.fillStyle(body.color, body.alpha);
    g.fillCircle(cx, cy, 15.5 + breathe * 1.2);

    // Inner core + facets
    const inner = hsl(this.hue + 20, 0.7, 0.78, 0.9);
    g.fillStyle(inner.color, inner.alpha);
    g.fillCircle(cx - 1, cy - 1, 8.5);
    g.fillStyle(0xffffff, 0.9);
    g.fillCircle(cx - 4.5, cy - 5, 3.2);
    g.fillStyle(0xffffff, 0.35 + this.bloomFlash * 0.35);
    g.fillCircle(cx + 3.5, cy + 4, 2.1);

    // Cross-sparkle flares
    const flareA = t * (1.2 + this.swirl * 0.5);
    this._drawFlare(g, cx, cy, 26 + energy * 8, flareA, this.hue, 0.35 * energy);
    this._drawFlare(g, cx, cy, 18 + energy * 5, flareA + Math.PI / 4, this.accent, 0.22 * energy);
  }

  _drawRing(g, cx, cy, radius, angle, ticks, hue, alpha) {
    for (let i = 0; i < ticks; i++) {
      const a = angle + (i / ticks) * Math.PI * 2;
      const pulse = 0.55 + 0.45 * Math.sin(this.timeSec * 3 + i);
      const x = cx + Math.cos(a) * radius;
      const y = cy + Math.sin(a) * radius * 0.72;
      const col = hsl(hue + i * 4, 0.9, 0.65, alpha * pulse);
      g.fillStyle(col.color, col.alpha);
      g.fillCircle(x, y, 1.6 + pulse * 1.4);
      if (i % 3 === 0) {
        const link = hsl(hue, 0.75, 0.55, alpha * 0.25);
        g.lineStyle(1, link.color, link.alpha);
        const x2 = cx + Math.cos(a + 0.2) * radius;
        const y2 = cy + Math.sin(a + 0.2) * radius * 0.72;
        g.lineBetween(x, y, x2, y2);
      }
    }
  }

  _drawFlare(g, cx, cy, len, angle, hue, alpha) {
    const c = hsl(hue, 0.95, 0.75, alpha);
    g.lineStyle(1.5, c.color, c.alpha);
    for (let i = 0; i < 4; i++) {
      const a = angle + (i * Math.PI) / 2;
      g.lineBetween(
        cx + Math.cos(a) * 6,
        cy + Math.sin(a) * 6,
        cx + Math.cos(a) * len,
        cy + Math.sin(a) * len
      );
    }
    const soft = hsl(hue, 0.8, 0.85, alpha * 0.45);
    g.fillStyle(soft.color, soft.alpha);
    g.fillCircle(cx, cy, 3);
  }
}

async function boot() {
  const sdk = window.ClawdPetSdk.create();
  await sdk.ready();

  const w = window.innerWidth || 256;
  const h = window.innerHeight || 256;
  // eslint-disable-next-line no-new
  new Phaser.Game({
    type: Phaser.WEBGL,
    parent: "stage",
    width: w,
    height: h,
    backgroundColor: "#00000000",
    transparent: true,
    scene: AuroraScene,
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
  });

  sdk.onState((payload) => {
    pendingState = (payload && payload.state) || "idle";
    if (sceneRef && ready) sceneRef.setAgentState(pendingState);
    else setBadge(`Aurora · ${profileFor(pendingState).label}`);
  });

  sdk.onCursor((payload) => {
    if (!payload) return;
    hasPointer = payload.inside !== false;
    pointerX = Number(payload.x) || 0;
    pointerY = Number(payload.y) || 0;
    if (sceneRef && ready) sceneRef.setPointer(pointerX, pointerY);
  });

  sdk.onClick(() => {
    if (!sceneRef || !ready) return;
    const x = hasPointer ? pointerX : sceneRef.core.x;
    const y = hasPointer ? pointerY : sceneRef.core.y;
    const power = Math.min(1.4, 0.7 + sceneRef.pulse * 0.25);
    sceneRef.spawnBurst(x, y, power);
  });

  sdk.onDragStart(() => setBadge(`Aurora · Drag · ${profileFor(pendingState).label}`));
  sdk.onDragEnd(() => setBadge(`Aurora · ${profileFor(pendingState).label}`));

  try {
    const snap = await sdk.getAgentSnapshot();
    if (snap && snap.state) {
      pendingState = snap.state;
      if (sceneRef && ready) sceneRef.setAgentState(pendingState);
    }
  } catch { /* ignore */ }
}

boot().catch((err) => {
  setBadge("Aurora · error");
  console.error("[template-phaser]", err);
});
