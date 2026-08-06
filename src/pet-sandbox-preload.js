"use strict";

// Sandboxed desk-pet preload — only API surface for clawd-pet.v1.
// No electronAPI. Theme code cannot reach fs / arbitrary IPC.

const { contextBridge, ipcRenderer } = require("electron");

const listeners = new Map();

function emitLocal(eventName, payload) {
  const set = listeners.get(eventName);
  if (!set) return;
  for (const cb of set) {
    try { cb(payload); } catch (err) { console.warn("[clawdPet] listener threw:", err); }
  }
}

ipcRenderer.on("pet:event", (_e, envelope) => {
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
  get: (key) => ipcRenderer.invoke("petbridge:storage-get", key),
  set: (key, value) => ipcRenderer.invoke("petbridge:storage-set", { key, value }),
  delete: (key) => ipcRenderer.invoke("petbridge:storage-delete", key),
  keys: () => ipcRenderer.invoke("petbridge:storage-keys"),
  clear: () => ipcRenderer.invoke("petbridge:storage-clear"),
};

contextBridge.exposeInMainWorld("clawdPet", {
  apiVersion: "v1",
  getInfo: () => ipcRenderer.invoke("petbridge:get-info"),
  ready: () => ipcRenderer.invoke("petbridge:ready"),
  getAgentSnapshot: () => ipcRenderer.invoke("petbridge:get-agent-snapshot"),
  emitPetEvent: (payload) => ipcRenderer.invoke("petbridge:emit-pet-event", payload),
  storage,
  on,
});
