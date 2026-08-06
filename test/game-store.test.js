"use strict";

const { describe, it, before } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const gameStore = require("../src/game-store");

describe("game-store", () => {
  let userData;

  before(() => {
    userData = fs.mkdtempSync(path.join(os.tmpdir(), "clawd-gsaves-"));
    gameStore.init(userData);
  });

  it("get/set/delete/keys/clear round-trip", () => {
    const id = "store-demo";
    assert.equal(gameStore.get(id, "score").value, null);
    assert.equal(gameStore.set(id, "score", "10").status, "ok");
    assert.equal(gameStore.get(id, "score").value, "10");
    assert.deepEqual(gameStore.keys(id).keys.sort(), ["score"]);
    assert.equal(gameStore.delete(id, "score").status, "ok");
    assert.equal(gameStore.get(id, "score").value, null);
    gameStore.set(id, "a", "1");
    gameStore.set(id, "b", "2");
    assert.equal(gameStore.clear(id).status, "ok");
    assert.deepEqual(gameStore.keys(id).keys, []);
  });

  it("rejects bad keys and non-string values", () => {
    const id = "store-demo2";
    assert.equal(gameStore.set(id, "../x", "1").status, "error");
    assert.equal(gameStore.set(id, "ok", 1).status, "error");
  });

  it("enforces value size quota", () => {
    const id = "store-quota";
    const big = "x".repeat(gameStore.MAX_VALUE_BYTES + 1);
    const r = gameStore.set(id, "big", big);
    assert.equal(r.status, "error");
    assert.equal(r.code, "quota");
  });

  it("enforces max key count", () => {
    const id = "store-many";
    for (let i = 0; i < gameStore.MAX_KEYS; i += 1) {
      assert.equal(gameStore.set(id, `k${i}`, "v").status, "ok");
    }
    const r = gameStore.set(id, "overflow", "v");
    assert.equal(r.status, "error");
    assert.equal(r.code, "quota");
    gameStore.clear(id);
  });

  it("keeps saves under game-saves root (no path escape via gameId)", () => {
    const r = gameStore.set("../escape", "k", "v");
    assert.equal(r.status, "error");
  });
});
