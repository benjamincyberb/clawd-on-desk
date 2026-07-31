"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert");

const createThemeFadeSequencer = require("../src/theme-fade-sequencer");

describe("theme-fade-sequencer render backend switch", () => {
  it("loadFile when renderLoadFilePath is provided, otherwise reload", async () => {
    const loadCalls = [];
    const reloadCalls = [];
    const timers = [];
    const makeWin = (label) => ({
      isDestroyed: () => false,
      webContents: {
        once() {},
        removeListener() {},
        loadFile(p) { loadCalls.push({ label, p }); },
        reload() { reloadCalls.push(label); },
      },
    });
    const renderWin = makeWin("render");
    const hitWin = makeWin("hit");
    const sequencer = createThemeFadeSequencer({
      getRenderWindow: () => renderWin,
      getHitWindow: () => hitWin,
      animateWindowOpacity: () => Promise.resolve(true),
      setWindowOpacity: () => {},
      setTimeout: (fn, ms) => {
        const id = { fn, ms };
        timers.push(id);
        return id;
      },
      clearTimeout: (id) => {
        const idx = timers.indexOf(id);
        if (idx >= 0) timers.splice(idx, 1);
      },
      fadeOutMs: 0,
      fadeInMs: 0,
      fallbackMs: 10_000,
    });

    sequencer.run({ renderLoadFilePath: "/tmp/index-rive.html" });
    await new Promise((r) => setTimeout(r, 20));

    assert.deepStrictEqual(loadCalls, [{ label: "render", p: "/tmp/index-rive.html" }]);
    assert.deepStrictEqual(reloadCalls, ["hit"]);
  });
});
