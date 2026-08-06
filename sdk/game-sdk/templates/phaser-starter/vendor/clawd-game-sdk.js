"use strict";

// UMD-ish browser bundle (no build step). Copy into game vendor/.
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.ClawdGameSdk = api;
})(typeof self !== "undefined" ? self : this, function () {
  function createBridge(api) {
    function getApi() {
      if (api) return api;
      if (typeof globalThis !== "undefined" && globalThis.clawdGame) return globalThis.clawdGame;
      throw new Error("clawdGame API unavailable");
    }
    return {
      getApi,
      ready: () => getApi().ready(),
      getInfo: () => getApi().getInfo(),
      close: () => getApi().close(),
      getAgentSnapshot: () => getApi().getAgentSnapshot(),
      getThemeInfo: () => getApi().getThemeInfo(),
      emitPetEvent: (payload) => getApi().emitPetEvent(payload),
      storage: {
        get: (key) => getApi().storage.get(key),
        set: (key, value) => getApi().storage.set(key, value),
        delete: (key) => getApi().storage.delete(key),
        keys: () => getApi().storage.keys(),
        clear: () => getApi().storage.clear(),
      },
      on: (eventName, handler) => getApi().on(eventName, handler),
      onAgent: (handler) => getApi().on("agent", handler),
      onLifecycle: (handler) => getApi().on("lifecycle", handler),
      bindLifecyclePauseResume: ({ pause, resume } = {}) =>
        getApi().on("lifecycle", (payload) => {
          const phase = payload && payload.phase;
          if (phase === "pause" && typeof pause === "function") pause();
          if (phase === "resume" && typeof resume === "function") resume();
        }),
    };
  }

  function create(api) {
    const bridge = createBridge(api);
    let paused = false;
    return {
      ...bridge,
      isLifecyclePaused: () => paused,
      attachPhaserGame: (game) =>
        bridge.bindLifecyclePauseResume({
          pause: () => {
            paused = true;
            try {
              if (game && game.loop && typeof game.loop.sleep === "function") game.loop.sleep();
            } catch { /* ignore */ }
          },
          resume: () => {
            paused = false;
            try {
              if (game && game.loop && typeof game.loop.wake === "function") game.loop.wake();
            } catch { /* ignore */ }
          },
        }),
      svgToTextureHint: (relPath, opts) => ({
        kind: "svg",
        path: String(relPath || "").replace(/^\.\//, ""),
        scale: opts && Number.isFinite(opts.scale) ? opts.scale : 1,
        maxEdge: opts && Number.isFinite(opts.maxEdge) ? opts.maxEdge : 1024,
      }),
    };
  }

  return { create, createBridge };
});
