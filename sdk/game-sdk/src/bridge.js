"use strict";

/**
 * Wrap window.clawdGame with small ergonomics. Works in Node tests when an
 * api mock is injected; in the sandbox pass nothing to use window.clawdGame.
 */
function createBridge(api) {
  function getApi() {
    if (api) return api;
    if (typeof globalThis !== "undefined" && globalThis.clawdGame) return globalThis.clawdGame;
    throw new Error("clawdGame API unavailable — are you running inside a Clawd game window?");
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
    bindLifecyclePauseResume: ({ pause, resume } = {}) => {
      return getApi().on("lifecycle", (payload) => {
        const phase = payload && payload.phase;
        if (phase === "pause" && typeof pause === "function") pause();
        if (phase === "resume" && typeof resume === "function") resume();
      });
    },
  };
}

module.exports = { createBridge };
