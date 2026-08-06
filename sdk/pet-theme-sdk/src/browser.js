"use strict";

/**
 * Browser-friendly IIFE build of @clawd/pet-theme-sdk.
 * Theme packages load this as vendor/clawd-pet-sdk.js.
 */
(function (root) {
  "use strict";

  function createBridge(api) {
    function getApi() {
      if (api) return api;
      if (typeof root !== "undefined" && root.clawdPet) return root.clawdPet;
      throw new Error("clawdPet API unavailable — are you running inside a Clawd sandbox pet theme?");
    }

    return {
      getApi: getApi,
      ready: function () { return getApi().ready(); },
      getInfo: function () { return getApi().getInfo(); },
      getAgentSnapshot: function () { return getApi().getAgentSnapshot(); },
      emitPetEvent: function (payload) { return getApi().emitPetEvent(payload); },
      storage: {
        get: function (key) { return getApi().storage.get(key); },
        set: function (key, value) { return getApi().storage.set(key, value); },
        delete: function (key) { return getApi().storage.delete(key); },
        keys: function () { return getApi().storage.keys(); },
        clear: function () { return getApi().storage.clear(); },
      },
      on: function (eventName, handler) { return getApi().on(eventName, handler); },
      onState: function (handler) { return getApi().on("state", handler); },
      onCursor: function (handler) { return getApi().on("cursor", handler); },
      onClick: function (handler) { return getApi().on("click", handler); },
      onDragStart: function (handler) { return getApi().on("drag-start", handler); },
      onDragEnd: function (handler) { return getApi().on("drag-end", handler); },
      onDnd: function (handler) { return getApi().on("dnd", handler); },
      onMini: function (handler) { return getApi().on("mini", handler); },
    };
  }

  function create() {
    return createBridge();
  }

  root.ClawdPetSdk = { createBridge: createBridge, create: create };
})(typeof globalThis !== "undefined" ? globalThis : this);
