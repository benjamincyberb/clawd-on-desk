"use strict";

const fs = require("fs");
const path = require("path");
const {
  validateGame,
  normalizeGame,
  GAME_ID_RE,
  basenameOnly,
} = require("./game-schema");

let builtinGamesDir = null;
let userGamesDir = null;
let userDataDir = null;

function init(appDir, userData) {
  builtinGamesDir = path.join(appDir, "..", "games");
  if (userData) {
    userDataDir = userData;
    userGamesDir = path.join(userData, "games");
  } else {
    userDataDir = null;
    userGamesDir = null;
  }
}

function getBuiltinGamesDir() {
  return builtinGamesDir;
}

function getUserGamesDir() {
  return userGamesDir;
}

function _isPathInsideDir(candidate, root) {
  if (!candidate || !root) return false;
  const resolvedCandidate = path.resolve(candidate);
  const resolvedRoot = path.resolve(root);
  if (resolvedCandidate === resolvedRoot) return true;
  const prefix = resolvedRoot.endsWith(path.sep) ? resolvedRoot : resolvedRoot + path.sep;
  return resolvedCandidate.startsWith(prefix);
}

function _safeReadJson(filePath) {
  try {
    const text = fs.readFileSync(filePath, "utf8");
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function _scanGamesDir(dir, builtin, out, seen) {
  if (!dir || !fs.existsSync(dir)) return;
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const ent of entries) {
    if (!ent.isDirectory()) continue;
    const id = ent.name;
    if (!GAME_ID_RE.test(id) || seen.has(id)) continue;
    const gameDir = path.join(dir, id);
    const manifestPath = path.join(gameDir, "game.json");
    if (!fs.existsSync(manifestPath)) continue;
    const raw = _safeReadJson(manifestPath);
    if (!raw) continue;
    const errors = validateGame(raw, { gameId: id });
    const game = normalizeGame(raw, { gameId: id });
    seen.add(id);
    out.push({
      id,
      name: game.name || id,
      version: game.version || "",
      path: gameDir,
      builtin: !!builtin,
      valid: errors.length === 0,
      errors,
      manifest: game,
    });
  }
}

/**
 * Discover built-in + user games. Built-in ids win on collision.
 * @returns {Array<{id,name,version,path,builtin,valid,errors,manifest}>}
 */
function discoverGames() {
  const games = [];
  const seen = new Set();
  if (builtinGamesDir) _scanGamesDir(builtinGamesDir, true, games, seen);
  if (userGamesDir) _scanGamesDir(userGamesDir, false, games, seen);
  games.sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
  return games;
}

function _resolveGameDir(gameId) {
  if (typeof gameId !== "string" || !GAME_ID_RE.test(gameId)) return null;
  if (builtinGamesDir) {
    const p = path.join(builtinGamesDir, gameId);
    if (_isPathInsideDir(p, builtinGamesDir) && fs.existsSync(path.join(p, "game.json"))) {
      return { path: p, builtin: true };
    }
  }
  if (userGamesDir) {
    const p = path.join(userGamesDir, gameId);
    if (_isPathInsideDir(p, userGamesDir) && fs.existsSync(path.join(p, "game.json"))) {
      return { path: p, builtin: false };
    }
  }
  return null;
}

/**
 * Load and validate a game package. Throws on hard failure when strict.
 * @returns {{ id, path, builtin, raw, game, entryPath }}
 */
function loadGame(gameId, opts = {}) {
  const strict = opts.strict !== false;
  const resolved = _resolveGameDir(gameId);
  if (!resolved) {
    const err = new Error(`Game not found: ${gameId}`);
    err.code = "not-found";
    if (strict) throw err;
    return null;
  }
  const manifestPath = path.join(resolved.path, "game.json");
  const raw = _safeReadJson(manifestPath);
  if (!raw) {
    const err = new Error(`Invalid game.json for ${gameId}`);
    err.code = "invalid-json";
    if (strict) throw err;
    return null;
  }
  const errors = validateGame(raw, { gameId });
  if (errors.length) {
    const err = new Error(`Game "${gameId}" failed validation: ${errors.join("; ")}`);
    err.code = "invalid";
    err.errors = errors;
    if (strict) throw err;
    return null;
  }
  const game = normalizeGame(raw, { gameId });
  const entryRel = basenameOnly(game.entry) || "index.html";
  const entryPath = path.join(resolved.path, entryRel);
  if (!_isPathInsideDir(entryPath, resolved.path) || !fs.existsSync(entryPath)) {
    const err = new Error(`Game entry not found: ${entryRel}`);
    err.code = "missing-entry";
    if (strict) throw err;
    return null;
  }
  return {
    id: gameId,
    path: resolved.path,
    builtin: resolved.builtin,
    raw,
    game,
    entryPath,
    entryRel,
  };
}

function listGamesWithMetadata() {
  return discoverGames().map((g) => ({
    id: g.id,
    name: g.name,
    version: g.version,
    builtin: g.builtin,
    valid: g.valid,
    errors: g.errors,
    author: g.manifest.author || "",
    description: g.manifest.description || "",
    engine: g.manifest.engine || "",
    capabilities: g.manifest.capabilities,
    window: g.manifest.window,
    enabled: true, // prefs overlay applied by caller
  }));
}

function ensureUserGamesDir() {
  if (!userGamesDir) return null;
  try {
    fs.mkdirSync(userGamesDir, { recursive: true });
  } catch {
    return null;
  }
  return userGamesDir;
}

module.exports = {
  init,
  getBuiltinGamesDir,
  getUserGamesDir,
  discoverGames,
  loadGame,
  listGamesWithMetadata,
  ensureUserGamesDir,
  // test helpers
  _isPathInsideDir,
  _resolveGameDir,
};
