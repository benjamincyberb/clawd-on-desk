"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  normalizeGames,
  isGameEnabled,
  setGameEnabled,
  cloneDefaultGames,
} = require("../src/games-settings");

describe("games-settings", () => {
  it("normalizeGames drops garbage", () => {
    assert.deepEqual(normalizeGames(null), cloneDefaultGames());
    const n = normalizeGames({
      enabledById: {
        a: true,
        b: { enabled: false },
        "": { enabled: true },
        long: "nope",
      },
    });
    assert.deepEqual(n.enabledById.a, { enabled: true });
    assert.deepEqual(n.enabledById.b, { enabled: false });
    assert.equal(n.enabledById[""], undefined);
  });

  it("isGameEnabled defaults to true", () => {
    assert.equal(isGameEnabled({}, "missing"), true);
    assert.equal(isGameEnabled({ enabledById: { x: { enabled: false } } }, "x"), false);
    assert.equal(isGameEnabled({ enabledById: { x: { enabled: true } } }, "x"), true);
  });

  it("setGameEnabled returns new map", () => {
    const next = setGameEnabled({}, "merit-cultivator", false);
    assert.equal(isGameEnabled(next, "merit-cultivator"), false);
    assert.equal(isGameEnabled({}, "merit-cultivator"), true);
  });
});
