"use strict";

/**
 * Wrap window.clawdPet with small ergonomics. Works in Node tests when an
 * api mock is injected; in the sandbox pass nothing to use window.clawdPet.
 */
function createBridge(api) {
  function getApi() {
    if (api) return api;
    if (typeof globalThis !== "undefined" && globalThis.clawdPet) return globalThis.clawdPet;
    throw new Error("clawdPet API unavailable — are you running inside a Clawd sandbox pet theme?");
  }

  return {
    getApi,
    ready: () => getApi().ready(),
    getInfo: () => getApi().getInfo(),
    getAgentSnapshot: () => getApi().getAgentSnapshot(),
    emitPetEvent: (payload) => getApi().emitPetEvent(payload),
    storage: {
      get: (key) => getApi().storage.get(key),
      set: (key, value) => getApi().storage.set(key, value),
      delete: (key) => getApi().storage.delete(key),
      keys: () => getApi().storage.keys(),
      clear: () => getApi().storage.clear(),
    },
    on: (eventName, handler) => getApi().on(eventName, handler),
    onState: (handler) => getApi().on("state", handler),
    onCursor: (handler) => getApi().on("cursor", handler),
    onClick: (handler) => getApi().on("click", handler),
    onDragStart: (handler) => getApi().on("drag-start", handler),
    onDragEnd: (handler) => getApi().on("drag-end", handler),
    onDnd: (handler) => getApi().on("dnd", handler),
    onMini: (handler) => getApi().on("mini", handler),
  };
}

function create() {
  return createBridge();
}

module.exports = { createBridge, create };
