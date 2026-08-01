"use strict";

const fs = require("fs");
const path = require("path");
const { GAME_ID_RE } = require("./game-schema");

// Scoped KV save store for sandboxed games.
// Layout: {userData}/game-saves/<gameId>/<key>.json  (value string inside)

const MAX_KEY_LEN = 128;
const KEY_RE = /^[a-zA-Z0-9._-]+$/;
const MAX_VALUE_BYTES = 64 * 1024;
const MAX_KEYS = 64;
const MAX_TOTAL_BYTES = 512 * 1024;

let savesRoot = null;

function init(userData) {
  savesRoot = userData ? path.join(userData, "game-saves") : null;
}

function getSavesRoot() {
  return savesRoot;
}

function _gameDir(gameId) {
  if (!savesRoot || typeof gameId !== "string" || !GAME_ID_RE.test(gameId)) return null;
  const dir = path.join(savesRoot, gameId);
  const resolved = path.resolve(dir);
  const root = path.resolve(savesRoot);
  const prefix = root.endsWith(path.sep) ? root : root + path.sep;
  if (resolved !== root && !resolved.startsWith(prefix)) return null;
  return resolved;
}

function validateKey(key) {
  if (typeof key !== "string" || !key || key.length > MAX_KEY_LEN || !KEY_RE.test(key)) {
    return { ok: false, code: "bad-key", message: "invalid storage key" };
  }
  return { ok: true };
}

function _utf8Bytes(s) {
  return Buffer.byteLength(String(s), "utf8");
}

function _listKeyFiles(dir) {
  if (!dir || !fs.existsSync(dir)) return [];
  let names;
  try {
    names = fs.readdirSync(dir);
  } catch {
    return [];
  }
  return names.filter((n) => n.endsWith(".json") && KEY_RE.test(n.slice(0, -5)));
}

function _measureTotal(dir) {
  let total = 0;
  for (const name of _listKeyFiles(dir)) {
    try {
      total += fs.statSync(path.join(dir, name)).size;
    } catch {
      // ignore
    }
  }
  return total;
}

function get(gameId, key) {
  const keyCheck = validateKey(key);
  if (!keyCheck.ok) return { status: "error", code: keyCheck.code, message: keyCheck.message };
  const dir = _gameDir(gameId);
  if (!dir) return { status: "error", code: "no-store", message: "save store not initialized" };
  const file = path.join(dir, `${key}.json`);
  if (!fs.existsSync(file)) return { status: "ok", value: null };
  try {
    const raw = JSON.parse(fs.readFileSync(file, "utf8"));
    if (!raw || typeof raw.value !== "string") return { status: "ok", value: null };
    return { status: "ok", value: raw.value };
  } catch {
    return { status: "ok", value: null };
  }
}

function set(gameId, key, value) {
  const keyCheck = validateKey(key);
  if (!keyCheck.ok) return { status: "error", code: keyCheck.code, message: keyCheck.message };
  if (typeof value !== "string") {
    return { status: "error", code: "bad-value", message: "value must be a string" };
  }
  const bytes = _utf8Bytes(value);
  if (bytes > MAX_VALUE_BYTES) {
    return { status: "error", code: "quota", message: "value exceeds 64 KiB" };
  }
  const dir = _gameDir(gameId);
  if (!dir) return { status: "error", code: "no-store", message: "save store not initialized" };
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch (err) {
    return { status: "error", code: "io", message: err.message || "mkdir failed" };
  }
  const file = path.join(dir, `${key}.json`);
  const exists = fs.existsSync(file);
  const keys = _listKeyFiles(dir);
  if (!exists && keys.length >= MAX_KEYS) {
    return { status: "error", code: "quota", message: `max ${MAX_KEYS} keys per game` };
  }
  const payload = JSON.stringify({ value, updatedAt: Date.now() });
  const nextBytes = _utf8Bytes(payload);
  let currentTotal = _measureTotal(dir);
  if (exists) {
    try { currentTotal -= fs.statSync(file).size; } catch { /* ignore */ }
  }
  if (currentTotal + nextBytes > MAX_TOTAL_BYTES) {
    return { status: "error", code: "quota", message: "total save budget exceeded (512 KiB)" };
  }
  try {
    fs.writeFileSync(file, payload, "utf8");
    return { status: "ok" };
  } catch (err) {
    return { status: "error", code: "io", message: err.message || "write failed" };
  }
}

function del(gameId, key) {
  const keyCheck = validateKey(key);
  if (!keyCheck.ok) return { status: "error", code: keyCheck.code, message: keyCheck.message };
  const dir = _gameDir(gameId);
  if (!dir) return { status: "error", code: "no-store", message: "save store not initialized" };
  const file = path.join(dir, `${key}.json`);
  try {
    if (fs.existsSync(file)) fs.unlinkSync(file);
    return { status: "ok" };
  } catch (err) {
    return { status: "error", code: "io", message: err.message || "delete failed" };
  }
}

function keys(gameId) {
  const dir = _gameDir(gameId);
  if (!dir) return { status: "error", code: "no-store", message: "save store not initialized", keys: [] };
  const list = _listKeyFiles(dir).map((n) => n.slice(0, -5));
  return { status: "ok", keys: list };
}

function clear(gameId) {
  const dir = _gameDir(gameId);
  if (!dir) return { status: "error", code: "no-store", message: "save store not initialized" };
  if (!fs.existsSync(dir)) return { status: "ok" };
  for (const name of _listKeyFiles(dir)) {
    try { fs.unlinkSync(path.join(dir, name)); } catch { /* ignore */ }
  }
  try {
    // Remove empty dir if possible
    fs.rmdirSync(dir);
  } catch {
    // ignore non-empty / busy
  }
  return { status: "ok" };
}

function clearAllForGame(gameId) {
  return clear(gameId);
}

module.exports = {
  MAX_KEY_LEN,
  KEY_RE,
  MAX_VALUE_BYTES,
  MAX_KEYS,
  MAX_TOTAL_BYTES,
  init,
  getSavesRoot,
  get,
  set,
  delete: del,
  keys,
  clear,
  clearAllForGame,
  validateKey,
};
