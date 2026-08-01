"use strict";

// game.json schema + normalize for Clawd Game API v1.
// Pure functions — no fs / Electron. See docs/guides/game-api-v1.md.

const GAME_SCHEMA_VERSION = 1;
const DEFAULT_ENTRY = "index.html";

const DEFAULT_WINDOW = Object.freeze({
  width: 720,
  height: 480,
  minWidth: 320,
  minHeight: 240,
  maxWidth: 1920,
  maxHeight: 1200,
  resizable: true,
});

const WINDOW_HARD = Object.freeze({
  minWidth: 320,
  minHeight: 240,
  maxWidth: 1920,
  maxHeight: 1200,
});

const PET_EVENT_TYPES = Object.freeze(["easter-egg", "notify", "celebrate"]);

const GAME_ID_RE = /^[a-z0-9][a-z0-9._-]{0,63}$/i;

function isPlainObject(v) {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function clampInt(n, lo, hi, fallback) {
  if (!Number.isFinite(n)) return fallback;
  return Math.round(Math.min(hi, Math.max(lo, n)));
}

function basenameOnly(p) {
  if (typeof p !== "string") return "";
  const s = p.trim().replace(/\\/g, "/");
  if (!s || s.includes("..") || s.startsWith("/") || /^[a-zA-Z]:/.test(s)) return "";
  return s.replace(/^\.\//, "");
}

function normalizeCapabilities(raw) {
  const src = isPlainObject(raw) ? raw : {};
  return {
    network: src.network === true,
    petEvents: src.petEvents === true,
    // agentFeed defaults ON when omitted
    agentFeed: src.agentFeed !== false,
  };
}

function normalizeWindow(raw) {
  const src = isPlainObject(raw) ? raw : {};
  const width = clampInt(src.width, WINDOW_HARD.minWidth, WINDOW_HARD.maxWidth, DEFAULT_WINDOW.width);
  const height = clampInt(src.height, WINDOW_HARD.minHeight, WINDOW_HARD.maxHeight, DEFAULT_WINDOW.height);
  const minWidth = clampInt(
    src.minWidth,
    WINDOW_HARD.minWidth,
    width,
    Math.min(DEFAULT_WINDOW.minWidth, width)
  );
  const minHeight = clampInt(
    src.minHeight,
    WINDOW_HARD.minHeight,
    height,
    Math.min(DEFAULT_WINDOW.minHeight, height)
  );
  let maxWidth = src.maxWidth !== undefined
    ? clampInt(src.maxWidth, width, WINDOW_HARD.maxWidth, WINDOW_HARD.maxWidth)
    : WINDOW_HARD.maxWidth;
  let maxHeight = src.maxHeight !== undefined
    ? clampInt(src.maxHeight, height, WINDOW_HARD.maxHeight, WINDOW_HARD.maxHeight)
    : WINDOW_HARD.maxHeight;
  if (maxWidth < width) maxWidth = width;
  if (maxHeight < height) maxHeight = height;
  return {
    width,
    height,
    minWidth,
    minHeight,
    maxWidth,
    maxHeight,
    resizable: src.resizable !== false,
  };
}

/**
 * Validate raw game.json. Returns a list of error strings (empty = ok).
 * @param {unknown} raw
 * @param {{ gameId?: string }} [opts]
 */
function validateGame(raw, opts = {}) {
  const errors = [];
  if (!isPlainObject(raw)) {
    errors.push("game.json must be a JSON object");
    return errors;
  }
  if (raw.schemaVersion !== GAME_SCHEMA_VERSION) {
    errors.push(`schemaVersion must be ${GAME_SCHEMA_VERSION}, got ${JSON.stringify(raw.schemaVersion)}`);
  }
  if (typeof raw.name !== "string" || !raw.name.trim()) {
    errors.push('name must be a non-empty string');
  }
  if (typeof raw.version !== "string" || !raw.version.trim()) {
    errors.push('version must be a non-empty string');
  }
  if (raw.entry !== undefined) {
    const entry = basenameOnly(raw.entry);
    if (!entry || !entry.toLowerCase().endsWith(".html")) {
      errors.push('entry must be a relative .html path inside the package');
    }
  }
  if (raw.window !== undefined && !isPlainObject(raw.window)) {
    errors.push("window must be an object");
  }
  if (raw.capabilities !== undefined && !isPlainObject(raw.capabilities)) {
    errors.push("capabilities must be an object");
  }
  if (raw.icon !== undefined) {
    const icon = basenameOnly(raw.icon);
    if (!icon) errors.push("icon must be a relative path inside the package");
  }
  if (raw.engine !== undefined && typeof raw.engine !== "string") {
    errors.push("engine must be a string when present");
  }
  if (opts.gameId && !GAME_ID_RE.test(opts.gameId)) {
    errors.push(`game id "${opts.gameId}" is invalid (use letters, digits, ._- ; max 64)`);
  }
  return errors;
}

/**
 * Normalize a validated (or partially valid) raw manifest into runtime config.
 * Does not throw; callers should validate first for user-facing errors.
 */
function normalizeGame(raw, opts = {}) {
  const src = isPlainObject(raw) ? raw : {};
  const entry = basenameOnly(src.entry) || DEFAULT_ENTRY;
  const icon = src.icon !== undefined ? basenameOnly(src.icon) || null : null;
  return {
    schemaVersion: GAME_SCHEMA_VERSION,
    id: typeof opts.gameId === "string" ? opts.gameId : "",
    name: typeof src.name === "string" ? src.name.trim() : "",
    version: typeof src.version === "string" ? src.version.trim() : "",
    author: typeof src.author === "string" ? src.author.trim() : "",
    description: typeof src.description === "string" ? src.description.trim() : "",
    entry,
    window: normalizeWindow(src.window),
    capabilities: normalizeCapabilities(src.capabilities),
    engine: typeof src.engine === "string" ? src.engine.trim().toLowerCase() : "",
    icon,
  };
}

function mergeGameDefaults(raw, opts = {}) {
  return normalizeGame(raw, opts);
}

function isAllowedPetEventType(type) {
  return typeof type === "string" && PET_EVENT_TYPES.includes(type);
}

module.exports = {
  GAME_SCHEMA_VERSION,
  DEFAULT_ENTRY,
  DEFAULT_WINDOW,
  WINDOW_HARD,
  PET_EVENT_TYPES,
  GAME_ID_RE,
  isPlainObject,
  basenameOnly,
  validateGame,
  normalizeGame,
  mergeGameDefaults,
  normalizeCapabilities,
  normalizeWindow,
  isAllowedPetEventType,
};
