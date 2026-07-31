# Vendored render runtimes (dev-only spikes)

## PixiJS v8.15.0
Source: https://github.com/pixijs/pixijs
License: MIT (see PIXI-LICENSE)
Vendored for CLAWD_PIXI_SPIKE / CLAWD_RENDER_BACKEND=pixi (dev-only Pixi adaptation demo).
Files:
  pixi.min.js          <- dist/pixi.min.js
  pixi-unsafe-eval.js  <- dist/packages/unsafe-eval.min.js (strict CSP polyfill; load BEFORE Application.init)

CSP notes (index-pixi.html):
  - Do NOT add script-src 'unsafe-eval' when pixi-unsafe-eval.js is loaded first.
  - Pixi Assets workers require: worker-src 'self' blob:
  - Texture loads may need: img-src ... blob:; connect-src 'self' file:

## Rive (@rive-app/canvas-single 2.x)
Source: https://github.com/rive-app/rive-wasm
License: MIT (see RIVE-LICENSE)
Vendored for CLAWD_RIVE_SPIKE / CLAWD_RENDER_BACKEND=rive (dev-only Rive adaptation demo).
Files:
  rive.js              <- node_modules/@rive-app/canvas-single/rive.js (WASM inlined)

CSP notes (index-rive.html):
  - script-src must include 'wasm-unsafe-eval' for WASM instantiation
  - canvas-single embeds WASM in the JS bundle — no separate rive.wasm fetch
  - Loading a local .riv needs: connect-src 'self' file: data:

Demo asset (not in this folder):
  assets/source/rive/demo.riv  <- official vehicles.riv (cdn.rive.app)

Refresh commands:
  npm run vendor:pixi
  npm run vendor:rive
