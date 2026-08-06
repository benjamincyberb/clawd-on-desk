"use strict";

/**
 * Sandbox host for code desk-pet themes (clawd-pet.v1).
 * Theme HTML/JS runs with sandbox+contextIsolation, no electronAPI.
 * Events arrive as pet:event envelopes; outbound via petbridge:* IPC.
 */

const { ipcMain, protocol, session, net } = require("electron");
const path = require("path");
const { pathToFileURL } = require("url");
const { isAllowedPetEventType } = require("./game-schema");
const gameStore = require("./game-store");
const {
  isAllowedSandboxAssetPath,
  resolveThemeRenderBackend,
} = require("./render-backends");

const PROTOCOL = "clawd-pet";
const MAX_PET_EVENT_JSON = 4 * 1024;

/** Channels from sendToRenderer that are forwarded into the sandbox. */
const ALLOWED_RELAY_CHANNELS = Object.freeze({
  "state-change": "state",
  "pixi-cursor": "cursor",
  "play-click-reaction": "click",
  "start-drag-reaction": "drag-start",
  "end-drag-reaction": "drag-end",
  "dnd-change": "dnd",
  "mini-mode-change": "mini",
  "theme-config": "theme-config",
  "wake-from-doze": "wake",
  "kimi-permission-pulse": "permission-pulse",
});

let protocolRegistered = false;
let ipcWired = false;
let active = null; // { themeId, themeDir, theme, ready }
let deps = null;
let getRenderWindow = () => null;

function setDeps(d) {
  deps = d || {};
  if (typeof deps.getRenderWindow === "function") {
    getRenderWindow = deps.getRenderWindow;
  }
}

function getActive() {
  return active;
}

function isActiveSandbox() {
  return !!(active && active.themeId);
}

function setActiveTheme(theme) {
  if (!theme || resolveThemeRenderBackend(theme) !== "sandbox") {
    active = null;
    return null;
  }
  const themeDir = theme._themeDir || theme._sandboxRoot || null;
  const entry = theme.sandbox && theme.sandbox.entry ? theme.sandbox.entry : "index.html";
  active = {
    themeId: theme._id,
    themeDir,
    theme,
    entry,
    ready: false,
  };
  return active;
}

function clearActive() {
  active = null;
}

function buildCsp(capabilities) {
  const network = !!(capabilities && capabilities.network);
  const connect = network
    ? "connect-src 'self' https: wss:;"
    : "connect-src 'self';";
  return [
    "default-src 'none'",
    "script-src 'self' 'unsafe-eval' 'wasm-unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "media-src 'self' blob:",
    "font-src 'self' data:",
    "worker-src 'self' blob:",
    "child-src 'none'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
    "frame-ancestors 'none'",
    connect,
  ].join("; ");
}

function registerSchemesBeforeReady() {
  try {
    protocol.registerSchemesAsPrivileged([
      {
        scheme: PROTOCOL,
        privileges: {
          standard: true,
          secure: true,
          supportFetchAPI: true,
          corsEnabled: true,
          stream: true,
        },
      },
    ]);
    protocolRegistered = true;
  } catch (err) {
    console.warn("[pet-sandbox] registerSchemesAsPrivileged:", err && err.message);
  }
}

function resolveSafeFile(root, rel) {
  if (!root || typeof rel !== "string") return null;
  const decoded = rel.replace(/^\/+/, "");
  if (!decoded || decoded.includes("..") || !isAllowedSandboxAssetPath(decoded)) {
    return null;
  }
  const filePath = path.normalize(path.join(root, decoded));
  const rootNorm = path.normalize(root + path.sep);
  if (!filePath.startsWith(rootNorm) && filePath !== path.normalize(root)) {
    return null;
  }
  return filePath;
}

/**
 * Pure helper for tests: decide whether a protocol path is allowed.
 * Returns { ok, status, filePath? }.
 */
function resolveProtocolPath(root, requestUrl) {
  if (typeof requestUrl === "string") {
    // Reject traversal before URL normalization can collapse "../".
    const raw = requestUrl.toLowerCase();
    if (raw.includes("..") || raw.includes("%2e%2e") || raw.includes("%2e.")) {
      return { ok: false, status: 403, reason: "forbidden" };
    }
  }
  let url;
  try {
    url = new URL(requestUrl);
  } catch {
    return { ok: false, status: 400, reason: "bad url" };
  }
  const rel = decodeURIComponent(url.pathname || "/").replace(/^\/+/, "");
  if (!rel || rel.includes("..")) {
    return { ok: false, status: 403, reason: "forbidden" };
  }
  if (!isAllowedSandboxAssetPath(rel)) {
    return { ok: false, status: 403, reason: "extension" };
  }
  const filePath = resolveSafeFile(root, rel);
  if (!filePath) {
    return { ok: false, status: 403, reason: "forbidden" };
  }
  return { ok: true, status: 200, filePath, rel };
}

function attachProtocolHandler() {
  const ses = session.defaultSession;
  try {
    ses.protocol.handle(PROTOCOL, async (request) => {
      if (!active || !active.themeDir) {
        return new Response("no active sandbox theme", { status: 404 });
      }
      const resolved = resolveProtocolPath(active.themeDir, request.url);
      if (!resolved.ok) {
        return new Response(resolved.reason || "forbidden", { status: resolved.status });
      }
      try {
        return net.fetch(pathToFileURL(resolved.filePath).toString());
      } catch (err) {
        return new Response(String(err && err.message || "not found"), { status: 404 });
      }
    });
  } catch (err) {
    try {
      protocol.registerFileProtocol(PROTOCOL, (request, callback) => {
        if (!active || !active.themeDir) return callback({ error: -6 });
        const resolved = resolveProtocolPath(active.themeDir, request.url);
        if (!resolved.ok) return callback({ error: -10 });
        callback({ path: resolved.filePath });
      });
    } catch (err2) {
      console.warn("[pet-sandbox] protocol registration failed:", err2 && err2.message);
    }
  }
}

function sanitizeStatePayload(state, svg) {
  return {
    state: typeof state === "string" ? state.slice(0, 64) : "idle",
    // svg path is unused by sandbox themes; omit large strings
    visual: typeof svg === "string" ? svg.slice(0, 256) : null,
  };
}

function sanitizeCursorPayload(payload) {
  const src = payload && typeof payload === "object" ? payload : {};
  const x = Number(src.x);
  const y = Number(src.y);
  return {
    x: Number.isFinite(x) ? x : 0,
    y: Number.isFinite(y) ? y : 0,
    inside: src.inside !== false,
  };
}

function sanitizeRelayPayload(channel, args) {
  switch (channel) {
    case "state-change":
      return sanitizeStatePayload(args[0], args[1]);
    case "pixi-cursor":
      return sanitizeCursorPayload(args[0]);
    case "play-click-reaction":
      return {
        duration: Number.isFinite(args[1]) ? args[1] : 0,
      };
    case "start-drag-reaction":
      return {
        direction: args[0] === "left" || args[0] === "right" ? args[0] : null,
      };
    case "end-drag-reaction":
      return {};
    case "dnd-change":
      return { enabled: !!args[0] };
    case "mini-mode-change":
      return {
        enabled: !!args[0],
        edge: typeof args[1] === "string" ? args[1].slice(0, 32) : null,
      };
    case "theme-config":
      return sanitizeThemeConfig(args[0]);
    case "wake-from-doze":
    case "kimi-permission-pulse":
      return {};
    default:
      return null;
  }
}

function sanitizeThemeConfig(cfg) {
  const src = cfg && typeof cfg === "object" ? cfg : {};
  return {
    themeId: typeof src.themeId === "string" ? src.themeId.slice(0, 128) : "",
    name: typeof src.name === "string" ? src.name.slice(0, 128) : "",
    renderBackend: "sandbox",
    viewBox: src.viewBox && typeof src.viewBox === "object" ? {
      x: Number(src.viewBox.x) || 0,
      y: Number(src.viewBox.y) || 0,
      width: Number(src.viewBox.width) || 256,
      height: Number(src.viewBox.height) || 256,
    } : { x: 0, y: 0, width: 256, height: 256 },
    sandbox: src.sandbox && typeof src.sandbox === "object" ? {
      entry: typeof src.sandbox.entry === "string" ? src.sandbox.entry.slice(0, 128) : "index.html",
      engine: typeof src.sandbox.engine === "string" ? src.sandbox.engine.slice(0, 32) : "phaser",
      network: src.sandbox.network === true,
    } : null,
  };
}

/**
 * Map a sendToRenderer(channel, ...args) call into a pet:event send.
 * Returns true if handled (including intentionally dropped non-allowlist).
 */
function relayToSandbox(channel, args) {
  if (!isActiveSandbox()) return false;
  const eventName = ALLOWED_RELAY_CHANNELS[channel];
  if (!eventName) {
    // Non-allowlisted channels are silently dropped for sandbox themes.
    return true;
  }
  const payload = sanitizeRelayPayload(channel, args || []);
  if (payload == null) return true;
  sendEvent(eventName, payload);
  return true;
}

function sendEvent(event, payload) {
  const win = getRenderWindow();
  if (!win || (typeof win.isDestroyed === "function" && win.isDestroyed())) return;
  try {
    win.webContents.send("pet:event", { event, payload });
  } catch {
    // ignore
  }
}

function sanitizeAgentSnapshot(raw) {
  const src = raw && typeof raw === "object" ? raw : {};
  const sessionsIn = Array.isArray(src.sessions) ? src.sessions : [];
  const sessions = sessionsIn.slice(0, 32).map((s) => ({
    id: typeof s.id === "string" ? s.id.slice(0, 128) : "",
    agentId: typeof s.agentId === "string" ? s.agentId.slice(0, 64)
      : (typeof s.agent === "string" ? s.agent.slice(0, 64) : ""),
    state: typeof s.state === "string" ? s.state.slice(0, 32) : "",
    label: typeof s.label === "string" ? s.label.slice(0, 128)
      : (typeof s.alias === "string" ? s.alias.slice(0, 128) : ""),
  })).filter((s) => s.id);
  return {
    state: typeof src.state === "string" ? src.state.slice(0, 32) : "idle",
    sessions,
  };
}

function wireIpc() {
  if (ipcWired) return;
  ipcWired = true;

  const guard = (fn) => async (event, ...args) => {
    const win = getRenderWindow();
    if (!active || !win || event.sender !== win.webContents) {
      return { status: "error", code: "no-active", message: "no active sandbox theme" };
    }
    return fn(event, ...args);
  };

  ipcMain.handle("petbridge:get-info", guard(async () => {
    const t = active.theme;
    return {
      apiVersion: "v1",
      themeId: active.themeId,
      name: t && t.name ? String(t.name).slice(0, 128) : "",
      version: t && t.version ? String(t.version).slice(0, 64) : "",
      engine: t && t.sandbox && t.sandbox.engine ? t.sandbox.engine : "phaser",
      network: !!(t && t.sandbox && t.sandbox.network),
      renderBackend: "sandbox",
    };
  }));

  ipcMain.handle("petbridge:ready", guard(async () => {
    active.ready = true;
    if (typeof deps.onReady === "function") {
      try { deps.onReady({ themeId: active.themeId }); } catch { /* ignore */ }
    }
    return { status: "ok" };
  }));

  ipcMain.handle("petbridge:get-agent-snapshot", guard(async () => {
    const raw = typeof deps.getAgentSnapshot === "function" ? deps.getAgentSnapshot() : {};
    return sanitizeAgentSnapshot(raw);
  }));

  ipcMain.handle("petbridge:emit-pet-event", guard(async (_e, payload) => {
    if (!payload || typeof payload !== "object") {
      return { status: "error", code: "bad-payload", message: "payload required" };
    }
    const type = typeof payload.type === "string" ? payload.type : "";
    if (!isAllowedPetEventType(type)) {
      return { status: "error", code: "bad-type", message: "type not allowlisted" };
    }
    let detail = payload.detail;
    try {
      const json = JSON.stringify(detail === undefined ? null : detail);
      if (json && json.length > MAX_PET_EVENT_JSON) {
        return { status: "error", code: "quota", message: "detail too large" };
      }
      detail = detail === undefined ? null : JSON.parse(json);
    } catch {
      return { status: "error", code: "bad-payload", message: "detail not JSON-serializable" };
    }
    if (typeof deps.onPetEvent === "function") {
      try { deps.onPetEvent({ type, detail, themeId: active.themeId }); } catch { /* ignore */ }
    }
    return { status: "ok" };
  }));

  ipcMain.handle("petbridge:storage-get", guard(async (_e, key) => {
    const r = gameStore.get(active.themeId, key);
    if (r.status !== "ok") return r;
    return r.value;
  }));
  ipcMain.handle("petbridge:storage-set", guard(async (_e, body) => {
    return gameStore.set(active.themeId, body && body.key, body && body.value);
  }));
  ipcMain.handle("petbridge:storage-delete", guard(async (_e, key) => gameStore.delete(active.themeId, key)));
  ipcMain.handle("petbridge:storage-keys", guard(async () => {
    const r = gameStore.keys(active.themeId);
    return r.status === "ok" ? r.keys : [];
  }));
  ipcMain.handle("petbridge:storage-clear", guard(async () => gameStore.clear(active.themeId)));
}

function init(d) {
  setDeps(d);
  if (!protocolRegistered) {
    try {
      protocol.registerSchemesAsPrivileged?.([
        {
          scheme: PROTOCOL,
          privileges: {
            standard: true,
            secure: true,
            supportFetchAPI: true,
            corsEnabled: true,
            stream: true,
          },
        },
      ]);
      protocolRegistered = true;
    } catch { /* may already be registered before ready */ }
  }
  attachProtocolHandler();
  wireIpc();
}

function buildSandboxEntryUrl(theme) {
  if (!theme || resolveThemeRenderBackend(theme) !== "sandbox") return null;
  const id = theme._id || "theme";
  const entry = (theme.sandbox && theme.sandbox.entry) || "index.html";
  return `${PROTOCOL}://${id}/${String(entry).replace(/\\/g, "/")}`;
}

function getSandboxWebPreferences(preloadPath, themeConfig) {
  return {
    preload: preloadPath,
    nodeIntegration: false,
    contextIsolation: true,
    sandbox: true,
    webSecurity: true,
    allowRunningInsecureContent: false,
    backgroundThrottling: false,
    additionalArguments: [
      "--theme-config=" + JSON.stringify(themeConfig || null),
      "--clawd-pet-sandbox=1",
    ],
  };
}

module.exports = {
  PROTOCOL,
  ALLOWED_RELAY_CHANNELS,
  registerSchemesBeforeReady,
  init,
  setDeps,
  setActiveTheme,
  clearActive,
  getActive,
  isActiveSandbox,
  buildCsp,
  buildSandboxEntryUrl,
  getSandboxWebPreferences,
  resolveProtocolPath,
  resolveSafeFile,
  relayToSandbox,
  sendEvent,
  sanitizeRelayPayload,
  sanitizeAgentSnapshot,
  isAllowedSandboxAssetPath,
};
