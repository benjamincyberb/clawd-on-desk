// Pixi MeshRope mouse trail — adapted from the official PixiJS example:
// https://pixijs.com/8.x/examples/advanced/mouse-trail (MIT)
// Procedural trail texture (no CDN). Driven by spike IPC, not DOM mousemove
// (render window uses setIgnoreMouseEvents).

"use strict";

const HISTORY_SIZE = 20;
const ROPE_SIZE = 100;

function cubicInterpolate(array, t, tangentFactor) {
  const k = tangentFactor == null ? 1 : tangentFactor;
  const n = array.length - 1;
  let i = Math.floor(t);
  if (i < 0) i = 0;
  if (i >= n) return array[n];
  const ft = t - i;
  const p0 = array[i === 0 ? i : i - 1];
  const p1 = array[i];
  const p2 = array[i > n - 1 ? n : i + 1];
  const p3 = array[i > n - 2 ? n : i + 2];
  const m1 = k * (p2 - p0);
  const m2 = k * (p3 - p1);
  const a = (2 * p1) - (2 * p2) + m1 + m2;
  const b = (-3 * p1) + (3 * p2) - (2 * m1) - m2;
  const c = m1;
  const d = p1;
  return (a * ft * ft * ft) + (b * ft * ft) + (c * ft) + d;
}

function createTrailTexture(PIXI) {
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  // Warm chakra / fire look for Naruto spike
  g.addColorStop(0, "rgba(255, 245, 200, 1)");
  g.addColorStop(0.25, "rgba(255, 180, 60, 0.85)");
  g.addColorStop(0.55, "rgba(255, 90, 20, 0.35)");
  g.addColorStop(1, "rgba(255, 40, 0, 0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return PIXI.Texture.from(canvas);
}

/**
 * @param {object} opts
 * @param {typeof window.PIXI} opts.PIXI
 * @param {import('pixi.js').Application} opts.app
 * @returns {{ setPointer: Function, burst: Function, destroy: Function, rope: object }}
 */
function createMouseTrail(opts) {
  const PIXI = opts.PIXI;
  const app = opts.app;
  const texture = createTrailTexture(PIXI);

  const historyX = new Array(HISTORY_SIZE).fill(app.screen.width * 0.5);
  const historyY = new Array(HISTORY_SIZE).fill(app.screen.height * 0.55);
  const points = [];
  for (let i = 0; i < ROPE_SIZE; i++) {
    points.push(new PIXI.Point(historyX[0], historyY[0]));
  }

  const rope = new PIXI.MeshRope({ texture, points });
  rope.blendMode = "add";
  rope.alpha = 0.9;
  app.stage.addChild(rope);

  let mouseX = historyX[0];
  let mouseY = historyY[0];
  let hasPointer = false;
  let sparks = [];

  function setPointer(x, y) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    mouseX = x;
    mouseY = y;
    hasPointer = true;
  }

  function burst(x, y, count) {
    const cx = Number.isFinite(x) ? x : mouseX;
    const cy = Number.isFinite(y) ? y : mouseY;
    const n = Math.max(6, Math.min(28, count || 14));
    for (let i = 0; i < n; i++) {
      const g = new PIXI.Graphics();
      const r = 1.5 + Math.random() * 2.5;
      g.circle(0, 0, r);
      g.fill({ color: Math.random() > 0.45 ? 0xffd080 : 0xff6a20 });
      g.x = cx;
      g.y = cy;
      g.blendMode = "add";
      const ang = Math.random() * Math.PI * 2;
      const spd = 40 + Math.random() * 140;
      sparks.push({
        g,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd - 40,
        life: 0.45 + Math.random() * 0.35,
        age: 0,
      });
      app.stage.addChild(g);
    }
  }

  function onTick(ticker) {
    if (hasPointer) {
      historyX.pop();
      historyX.unshift(mouseX);
      historyY.pop();
      historyY.unshift(mouseY);
    }

    for (let i = 0; i < ROPE_SIZE; i++) {
      const t = (i / ROPE_SIZE) * HISTORY_SIZE;
      points[i].x = cubicInterpolate(historyX, t);
      points[i].y = cubicInterpolate(historyY, t);
    }

    const dt = (ticker.deltaMS || 16) / 1000;
    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i];
      s.age += dt;
      s.vy += 180 * dt;
      s.g.x += s.vx * dt;
      s.g.y += s.vy * dt;
      const k = 1 - s.age / s.life;
      s.g.alpha = Math.max(0, k);
      s.g.scale.set(0.4 + k * 0.9);
      if (s.age >= s.life) {
        try { app.stage.removeChild(s.g); s.g.destroy(); } catch {}
        sparks.splice(i, 1);
      }
    }
  }

  app.ticker.add(onTick);

  function destroy() {
    try { app.ticker.remove(onTick); } catch {}
    for (const s of sparks) {
      try { app.stage.removeChild(s.g); s.g.destroy(); } catch {}
    }
    sparks = [];
    try { app.stage.removeChild(rope); rope.destroy(); } catch {}
    try { texture.destroy(true); } catch {}
  }

  return { setPointer, burst, destroy, rope };
}

// UMD-ish for script tag / CommonJS
if (typeof module !== "undefined" && module.exports) {
  module.exports = { createMouseTrail, createTrailTexture };
}
if (typeof window !== "undefined") {
  window.ClawdPixiMouseTrail = { createMouseTrail, createTrailTexture };
}
