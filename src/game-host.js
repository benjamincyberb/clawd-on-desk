"use strict";

const { BrowserWindow, ipcMain, protocol, session, net } = require("electron");
const path = require("path");
const { pathToFileURL } = require("url");
const gameLoader = require("./game-loader");
const gameStore = require("./game-store");
const { isAllowedPetEventType, WINDOW_HARD } = require("./game-schema");

const PROTOCOL = "clawd-game";
const MAX_PET_EVENT_JSON = 4 * 1024;

let protocolRegistered = false;
let ipcWired = false;
let active = null; // { win, packed, gameId }
let deps = null;

function _send(event, payload) {
  if (!active || !active.win || active.win.isDestroyed()) return;
  try {
    active.win.webContents.send("game:event", { event, payload });
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
  const out = {
    state: typeof src.state === "string" ? src.state.slice(0, 32) : "idle",
    sessions,
  };
  if (src.merit && typeof src.merit === "object") {
    out.merit = {
      stage: typeof src.merit.stage === "string" ? src.merit.stage.slice(0, 64) : undefined,
      points: Number.isFinite(src.merit.points) ? src.merit.points : undefined,
    };
  }
  if (src.quota && typeof src.quota === "object") {
    out.quota = { sources: typeof src.quota.sources === "object" ? src.quota.sources : undefined };
  }
  return out;
}

function registerProtocol() {
  if (protocolRegistered) return;
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
  } catch {
    // registerSchemesAsPrivileged must run before app ready — main.js may call early.
  }
  protocolRegistered = true;
}

function attachProtocolHandler() {
  // Must run after app.ready
  const ses = session.defaultSession;
  try {
    ses.protocol.handle(PROTOCOL, async (request) => {
      if (!active || !active.packed) {
        return new Response("no active game", { status: 404 });
      }
      const root = active.packed.path;
      let url;
      try {
        url = new URL(request.url);
      } catch {
        return new Response("bad url", { status: 400 });
      }
      // clawd-game://<gameId>/<path>
      const rel = decodeURIComponent(url.pathname || "/").replace(/^\/+/, "");
      if (!rel || rel.includes("..")) {
        return new Response("forbidden", { status: 403 });
      }
      const filePath = path.normalize(path.join(root, rel || "index.html"));
      if (!filePath.startsWith(path.normalize(root + path.sep)) && filePath !== path.normalize(root)) {
        return new Response("forbidden", { status: 403 });
      }
      try {
        return net.fetch(pathToFileURL(filePath).toString());
      } catch (err) {
        return new Response(String(err && err.message || "not found"), { status: 404 });
      }
    });
  } catch (err) {
    // Fallback for older Electron: protocol.registerFileProtocol
    try {
      protocol.registerFileProtocol(PROTOCOL, (request, callback) => {
        if (!active || !active.packed) return callback({ error: -6 });
        const root = active.packed.path;
        let pathname = "";
        try {
          pathname = decodeURIComponent(new URL(request.url).pathname || "/").replace(/^\/+/, "");
        } catch {
          return callback({ error: -2 });
        }
        if (!pathname || pathname.includes("..")) return callback({ error: -10 });
        const filePath = path.normalize(path.join(root, pathname));
        if (!filePath.startsWith(path.normalize(root + path.sep)) && filePath !== path.normalize(root)) {
          return callback({ error: -10 });
        }
        callback({ path: filePath });
      });
    } catch (err2) {
      console.warn("[game-host] protocol registration failed:", err2 && err2.message);
    }
  }

  // Block navigations / permissions outside the package.
  ses.setPermissionRequestHandler((_wc, _perm, callback) => callback(false));
}

function buildCsp(capabilities) {
  const connect = capabilities && capabilities.network
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

function wireIpc() {
  if (ipcWired) return;
  ipcWired = true;

  const guard = (fn) => async (event, ...args) => {
    if (!active || !active.win || event.sender !== active.win.webContents) {
      return { status: "error", code: "no-active", message: "no active game" };
    }
    return fn(event, ...args);
  };

  ipcMain.handle("game:get-info", guard(async () => {
    const g = active.packed.game;
    return {
      apiVersion: "v1",
      gameId: active.gameId,
      name: g.name,
      version: g.version,
      capabilities: g.capabilities,
      window: g.window,
      engine: g.engine || "",
    };
  }));

  ipcMain.handle("game:ready", guard(async () => {
    active.ready = true;
    return { status: "ok" };
  }));

  ipcMain.handle("game:close", guard(async () => {
    closeActive();
    return { status: "ok" };
  }));

  ipcMain.handle("game:get-agent-snapshot", guard(async () => {
    if (!active.packed.game.capabilities.agentFeed) {
      return { status: "error", code: "capability", message: "agentFeed disabled" };
    }
    const raw = typeof deps.getAgentSnapshot === "function" ? deps.getAgentSnapshot() : {};
    return sanitizeAgentSnapshot(raw);
  }));

  ipcMain.handle("game:get-theme-info", guard(async () => {
    if (typeof deps.getThemeInfo === "function") {
      const info = deps.getThemeInfo() || {};
      return {
        themeId: typeof info.themeId === "string" ? info.themeId : "",
        renderBackend: info.renderBackend === "rive" ? "rive" : "svg",
        name: typeof info.name === "string" ? info.name : "",
      };
    }
    return { themeId: "", renderBackend: "svg", name: "" };
  }));

  ipcMain.handle("game:emit-pet-event", guard(async (_e, payload) => {
    if (!active.packed.game.capabilities.petEvents) {
      return { status: "error", code: "capability", message: "petEvents disabled" };
    }
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
      try { deps.onPetEvent({ type, detail, gameId: active.gameId }); } catch { /* ignore */ }
    }
    return { status: "ok" };
  }));

  ipcMain.handle("game:storage-get", guard(async (_e, key) => {
    const r = gameStore.get(active.gameId, key);
    if (r.status !== "ok") return r;
    return r.value;
  }));

  ipcMain.handle("game:storage-set", guard(async (_e, body) => {
    const key = body && body.key;
    const value = body && body.value;
    return gameStore.set(active.gameId, key, value);
  }));

  ipcMain.handle("game:storage-delete", guard(async (_e, key) => gameStore.delete(active.gameId, key)));
  ipcMain.handle("game:storage-keys", guard(async () => {
    const r = gameStore.keys(active.gameId);
    return r.status === "ok" ? r.keys : [];
  }));
  ipcMain.handle("game:storage-clear", guard(async () => gameStore.clear(active.gameId)));

  ipcMain.handle("game:window-resize", guard(async (_e, size) => {
    const winCfg = active.packed.game.window;
    if (!winCfg.resizable) {
      return { status: "error", code: "fixed", message: "window is not resizable" };
    }
    const width = Math.round(Math.min(
      winCfg.maxWidth || WINDOW_HARD.maxWidth,
      Math.max(winCfg.minWidth, Number(size && size.width) || winCfg.width)
    ));
    const height = Math.round(Math.min(
      winCfg.maxHeight || WINDOW_HARD.maxHeight,
      Math.max(winCfg.minHeight, Number(size && size.height) || winCfg.height)
    ));
    try {
      active.win.setSize(width, height);
      return { status: "ok", width, height };
    } catch (err) {
      return { status: "error", code: "io", message: err.message || "resize failed" };
    }
  }));
}

function closeActive() {
  if (!active) return;
  const cur = active;
  active = null;
  _sendTo(cur, "lifecycle", { phase: "close" });
  try {
    if (cur.win && !cur.win.isDestroyed()) cur.win.close();
  } catch {
    // ignore
  }
}

function _sendTo(cur, event, payload) {
  if (!cur || !cur.win || cur.win.isDestroyed()) return;
  try {
    cur.win.webContents.send("game:event", { event, payload });
  } catch {
    // ignore
  }
}

/**
 * Initialize host. Call once after app.ready.
 * @param {object} d deps from main.js
 */
function init(d) {
  deps = d || {};
  registerProtocol();
  attachProtocolHandler();
  wireIpc();
}

/**
 * Call before app.ready so scheme privileges apply.
 */
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
    console.warn("[game-host] registerSchemesAsPrivileged:", err && err.message);
  }
}

function pushAgentSnapshot(raw) {
  if (!active || !active.packed || !active.packed.game.capabilities.agentFeed) return;
  _send("agent", sanitizeAgentSnapshot(raw));
}

function launchGame(gameId) {
  const packed = gameLoader.loadGame(gameId, { strict: true });
  if (active && active.win && !active.win.isDestroyed()) {
    if (active.gameId === gameId) {
      active.win.focus();
      return { status: "ok", reused: true };
    }
    closeActive();
  }

  const w = packed.game.window;
  const preloadPath = path.join(__dirname, "game-bridge-preload.js");
  const win = new BrowserWindow({
    width: w.width,
    height: w.height,
    minWidth: w.minWidth,
    minHeight: w.minHeight,
    maxWidth: w.maxWidth,
    maxHeight: w.maxHeight,
    resizable: w.resizable,
    show: false,
    frame: true,
    transparent: false,
    autoHideMenuBar: true,
    backgroundThrottling: true,
    webPreferences: {
      preload: preloadPath,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      additionalArguments: [`--clawd-game-id=${packed.id}`],
    },
  });

  if (typeof deps.getIconPath === "function") {
    const icon = deps.getIconPath();
    if (icon) {
      try { win.setIcon(icon); } catch { /* ignore */ }
    }
  }

  active = { win, packed, gameId: packed.id, ready: false };

  win.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith(`${PROTOCOL}://`)) event.preventDefault();
  });
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));

  win.webContents.on("did-finish-load", () => {
    try {
      win.webContents.insertCSS(`/* clawd-game host */`);
      // Inject CSP via meta if page omitted it (defense in depth).
      const csp = buildCsp(packed.game.capabilities).replace(/'/g, "\\'");
      win.webContents.executeJavaScript(
        `(() => { if (!document.querySelector('meta[http-equiv="Content-Security-Policy"]')) {` +
        `const m=document.createElement('meta');m.httpEquiv='Content-Security-Policy';m.content='${csp}';` +
        `document.head.prepend(m);} })();`,
        true
      ).catch(() => {});
    } catch {
      // ignore
    }
    _send("lifecycle", { phase: "launch" });
  });

  win.on("blur", () => {
    _send("lifecycle", { phase: "pause" });
    _send("visibility", { visible: true, focused: false });
  });
  win.on("focus", () => {
    _send("lifecycle", { phase: "resume" });
    _send("visibility", { visible: true, focused: true });
  });
  win.on("closed", () => {
    if (active && active.win === win) active = null;
  });

  const entryUrl = `${PROTOCOL}://${packed.id}/${packed.entryRel.replace(/\\/g, "/")}`;
  win.loadURL(entryUrl).then(() => {
    win.show();
    win.focus();
  }).catch((err) => {
    console.warn("[game-host] load failed:", err && err.message);
    // Fallback: loadFile when custom protocol fails
    try {
      win.loadFile(packed.entryPath).then(() => {
        win.show();
        win.focus();
      });
    } catch (err2) {
      console.warn("[game-host] loadFile failed:", err2 && err2.message);
      closeActive();
    }
  });

  return { status: "ok", gameId: packed.id };
}

function getActiveGameId() {
  return active ? active.gameId : null;
}

function listAndLaunchStatus() {
  return {
    activeGameId: getActiveGameId(),
    games: gameLoader.listGamesWithMetadata(),
  };
}

module.exports = {
  PROTOCOL,
  registerSchemesBeforeReady,
  init,
  launchGame,
  closeActive,
  pushAgentSnapshot,
  getActiveGameId,
  listAndLaunchStatus,
  sanitizeAgentSnapshot,
  buildCsp,
};
