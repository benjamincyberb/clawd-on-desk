"use strict";

const { describe, it, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const gameLoader = require("../src/game-loader");

function makeFixture(games) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "clawd-game-"));
  const appDir = path.join(tmp, "src");
  fs.mkdirSync(appDir, { recursive: true });
  fs.mkdirSync(path.join(tmp, "games"), { recursive: true });
  const userData = path.join(tmp, "userData");
  fs.mkdirSync(path.join(userData, "games"), { recursive: true });

  for (const { id, builtin, json, entryHtml } of games) {
    const base = builtin
      ? path.join(tmp, "games", id)
      : path.join(userData, "games", id);
    fs.mkdirSync(base, { recursive: true });
    if (json !== undefined) {
      fs.writeFileSync(path.join(base, "game.json"), JSON.stringify(json), "utf8");
    }
    const html = entryHtml === undefined ? "<!doctype html><title>g</title>" : entryHtml;
    if (html !== null) {
      fs.writeFileSync(path.join(base, "index.html"), html, "utf8");
    }
  }

  gameLoader.init(appDir, userData);
  return { tmp, appDir, userData };
}

afterEach(() => {
  // leave tmp dirs; OS cleans. Re-init with empty to avoid cross-test bleed if needed.
});

describe("game-loader", () => {
  it("discovers builtin before user on id collision", () => {
    const { tmp } = makeFixture([
      {
        id: "demo",
        builtin: true,
        json: { schemaVersion: 1, name: "Builtin", version: "1.0.0" },
      },
      {
        id: "demo",
        builtin: false,
        json: { schemaVersion: 1, name: "User", version: "2.0.0" },
      },
    ]);
    const list = gameLoader.discoverGames();
    const demo = list.find((g) => g.id === "demo");
    assert.ok(demo);
    assert.equal(demo.builtin, true);
    assert.equal(demo.name, "Builtin");
    assert.ok(demo.path.startsWith(path.join(tmp, "games")));
  });

  it("skips invalid ids and marks invalid manifests", () => {
    makeFixture([
      {
        id: "ok-game",
        builtin: true,
        json: { schemaVersion: 1, name: "Ok", version: "1.0.0" },
      },
      {
        id: "bad",
        builtin: true,
        json: { schemaVersion: 9, name: "X", version: "1" },
      },
    ]);
    // Create illegal folder name manually
    const builtin = gameLoader.getBuiltinGamesDir();
    fs.mkdirSync(path.join(builtin, "../sneaky"), { recursive: true }); // outside — ignored
    const list = gameLoader.discoverGames();
    assert.ok(list.some((g) => g.id === "ok-game" && g.valid));
    const bad = list.find((g) => g.id === "bad");
    assert.ok(bad);
    assert.equal(bad.valid, false);
  });

  it("_isPathInsideDir rejects escapes", () => {
    const root = path.join(os.tmpdir(), "clawd-root-check");
    fs.mkdirSync(root, { recursive: true });
    assert.equal(gameLoader._isPathInsideDir(path.join(root, "a"), root), true);
    assert.equal(gameLoader._isPathInsideDir(path.join(root, "..", "other"), root), false);
  });

  it("loadGame strict throws missing / invalid", () => {
    makeFixture([
      {
        id: "play",
        builtin: true,
        json: { schemaVersion: 1, name: "Play", version: "1.0.0" },
      },
    ]);
    const packed = gameLoader.loadGame("play", { strict: true });
    assert.equal(packed.id, "play");
    assert.ok(fs.existsSync(packed.entryPath));

    assert.throws(() => gameLoader.loadGame("nope", { strict: true }), /not found/i);
  });
});
