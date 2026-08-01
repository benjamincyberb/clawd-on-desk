"use strict";

// Prefs domain for installed games: enable/disable + last-launched bookkeeping.
// Discovery lives in game-loader.js; this only persists user intent.

const DEFAULT_GAMES = Object.freeze({
  // gameId → { enabled: boolean }
  enabledById: Object.freeze({}),
});

function cloneDefaultGames() {
  return {
    enabledById: {},
  };
}

function normalizeGames(value) {
  const base = cloneDefaultGames();
  if (!value || typeof value !== "object" || Array.isArray(value)) return base;
  const src = value.enabledById && typeof value.enabledById === "object" && !Array.isArray(value.enabledById)
    ? value.enabledById
    : {};
  const enabledById = {};
  for (const [id, entry] of Object.entries(src)) {
    if (typeof id !== "string" || !id || id.length > 64) continue;
    if (entry === true || entry === false) {
      enabledById[id] = { enabled: entry };
      continue;
    }
    if (entry && typeof entry === "object") {
      enabledById[id] = { enabled: entry.enabled !== false };
    }
  }
  base.enabledById = enabledById;
  return base;
}

function validateGames(value) {
  normalizeGames(value);
  return { status: "ok" };
}

function isGameEnabled(gamesPrefs, gameId) {
  const cfg = normalizeGames(gamesPrefs);
  const entry = cfg.enabledById[gameId];
  if (!entry) return true; // default enabled when discovered
  return entry.enabled !== false;
}

function setGameEnabled(gamesPrefs, gameId, enabled) {
  const next = normalizeGames(gamesPrefs);
  next.enabledById = { ...next.enabledById, [gameId]: { enabled: enabled === true } };
  return next;
}

module.exports = {
  DEFAULT_GAMES,
  cloneDefaultGames,
  normalizeGames,
  validateGames,
  isGameEnabled,
  setGameEnabled,
};
