"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  validateGame,
  normalizeGame,
  basenameOnly,
  isAllowedPetEventType,
  WINDOW_HARD,
} = require("../src/game-schema");

function validRaw(overrides = {}) {
  return {
    schemaVersion: 1,
    name: "Demo",
    version: "1.0.0",
    ...overrides,
  };
}

describe("game-schema validateGame", () => {
  it("accepts a minimal valid manifest", () => {
    assert.deepEqual(validateGame(validRaw()), []);
  });

  it("rejects wrong schemaVersion / missing name", () => {
    const errors = validateGame({ schemaVersion: 2, version: "1" });
    assert.ok(errors.some((e) => e.includes("schemaVersion")));
    assert.ok(errors.some((e) => e.includes("name")));
  });

  it("rejects path-traversal entry", () => {
    const errors = validateGame(validRaw({ entry: "../evil.html" }));
    assert.ok(errors.some((e) => e.includes("entry")));
  });

  it("rejects invalid gameId when provided", () => {
    const errors = validateGame(validRaw(), { gameId: "../x" });
    assert.ok(errors.some((e) => e.includes("game id")));
  });
});

describe("game-schema normalizeGame / basenameOnly", () => {
  it("clamps window size to hard limits", () => {
    const g = normalizeGame(validRaw({
      window: { width: 99999, height: 10, minWidth: 10 },
    }), { gameId: "demo" });
    assert.equal(g.window.width, WINDOW_HARD.maxWidth);
    assert.ok(g.window.height >= WINDOW_HARD.minHeight);
    assert.ok(g.window.minWidth >= WINDOW_HARD.minWidth);
  });

  it("defaults agentFeed on and strips bad paths", () => {
    assert.equal(basenameOnly("../x"), "");
    assert.equal(basenameOnly("/abs/x.html"), "");
    assert.equal(basenameOnly("play.html"), "play.html");
    const g = normalizeGame(validRaw(), { gameId: "demo" });
    assert.equal(g.capabilities.agentFeed, true);
    assert.equal(g.entry, "index.html");
  });
});

describe("game-schema pet events", () => {
  it("allowlists pet event types", () => {
    assert.equal(isAllowedPetEventType("celebrate"), true);
    assert.equal(isAllowedPetEventType("hack"), false);
  });
});
