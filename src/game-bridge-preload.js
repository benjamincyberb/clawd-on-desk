"use strict";

// Sandboxed game preload — only API surface for clawd.game.v1.
// See docs/guides/game-api-v1.md.

const { contextBridge, ipcRenderer } = require("electron");

const listeners = new Map();

function emitLocal(eventName, payload) {
  const set = listeners.get(eventName);
  if (!set) return;
  for (const cb of set) {
    try { cb(payload); } catch (err) { console.warn("[clawdGame] listener threw:", err); }
  }
}

ipcRenderer.on("game:event", (_e, envelope) => {
  if (!envelope || typeof envelope !== "object") return;
  const name = typeof envelope.event === "string" ? envelope.event : "";
  if (!name) return;
  emitLocal(name, envelope.payload);
});

function on(eventName, handler) {
  if (typeof eventName !== "string" || typeof handler !== "function") return () => {};
  let set = listeners.get(eventName);
  if (!set) {
    set = new Set();
    listeners.set(eventName, set);
  }
  set.add(handler);
  return () => set.delete(handler);
}

const storage = {
  get: (key) => ipcRenderer.invoke("game:storage-get", key),
  set: (key, value) => ipcRenderer.invoke("game:storage-set", { key, value }),
  delete: (key) => ipcRenderer.invoke("game:storage-delete", key),
  keys: () => ipcRenderer.invoke("game:storage-keys"),
  clear: () => ipcRenderer.invoke("game:storage-clear"),
};

const windowApi = {
  resize: (size) => ipcRenderer.invoke("game:window-resize", size),
  close: () => ipcRenderer.invoke("game:close"),
};

contextBridge.exposeInMainWorld("clawdGame", {
  apiVersion: "v1",
  getInfo: () => ipcRenderer.invoke("game:get-info"),
  ready: () => ipcRenderer.invoke("game:ready"),
  close: () => ipcRenderer.invoke("game:close"),
  getAgentSnapshot: () => ipcRenderer.invoke("game:get-agent-snapshot"),
  getThemeInfo: () => ipcRenderer.invoke("game:get-theme-info"),
  emitPetEvent: (payload) => ipcRenderer.invoke("game:emit-pet-event", payload),
  storage,
  window: windowApi,
  on,
});
