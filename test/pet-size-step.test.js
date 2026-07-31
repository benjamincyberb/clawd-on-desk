"use strict";

const assert = require("node:assert");
const { describe, it } = require("node:test");

const {
  SIZE_STEP_UI,
  SIZE_PRESETS,
  currentSizeToUi,
  computeSizeStepKey,
  nearestPresetUi,
  isCurrentPreset,
  formatSizeKey,
  prefsSizeToUi,
} = require("../src/pet-size-step");

const WA = { width: 1920, height: 1080 };

describe("SIZE_PRESETS", () => {
  it("is monotonic and within UI 1..100", () => {
    assert.ok(SIZE_PRESETS.length >= 2);
    for (let i = 0; i < SIZE_PRESETS.length; i++) {
      const ui = SIZE_PRESETS[i].ui;
      assert.ok(ui >= 1 && ui <= 100, `preset ${SIZE_PRESETS[i].id} ui out of range`);
      if (i > 0) {
        assert.ok(ui > SIZE_PRESETS[i - 1].ui, "presets must be strictly increasing");
      }
    }
  });
});

describe("currentSizeToUi", () => {
  it("maps P:<ratio> through prefsSizeToUi", () => {
    assert.strictEqual(currentSizeToUi("P:9", 200, WA), prefsSizeToUi(9));
    assert.strictEqual(currentSizeToUi("P:15", 200, WA), prefsSizeToUi(15));
  });

  it("reverses legacy S/M/L from pixel width against work-area long edge", () => {
    // 192px on 1920 long edge → 10% → UI 33
    const ui = currentSizeToUi("M", 192, WA);
    assert.strictEqual(ui, prefsSizeToUi(10));
  });

  it("falls back to default P:9 when work area / pixel width missing", () => {
    assert.strictEqual(currentSizeToUi("M", 0, null), prefsSizeToUi(9));
    assert.strictEqual(currentSizeToUi(undefined, 100, {}), prefsSizeToUi(9));
  });
});

describe("computeSizeStepKey", () => {
  it("increments and decrements by stepUi", () => {
    const up = computeSizeStepKey({
      currentSize: "P:9",
      currentPixelWidth: 200,
      workArea: WA,
      stepUi: SIZE_STEP_UI,
    });
    assert.strictEqual(up, formatSizeKey(prefsSizeToUi(9) + SIZE_STEP_UI));

    const down = computeSizeStepKey({
      currentSize: "P:9",
      currentPixelWidth: 200,
      workArea: WA,
      stepUi: -SIZE_STEP_UI,
    });
    assert.strictEqual(down, formatSizeKey(prefsSizeToUi(9) - SIZE_STEP_UI));
  });

  it("returns null at the upper and lower UI boundaries", () => {
    assert.strictEqual(computeSizeStepKey({
      currentSize: "P:30",
      currentPixelWidth: 500,
      workArea: WA,
      stepUi: SIZE_STEP_UI,
    }), null);

    // P:0.3 → UI 1 (prefs 0.3 * 100/30 ≈ 1)
    assert.strictEqual(computeSizeStepKey({
      currentSize: "P:0.3",
      currentPixelWidth: 20,
      workArea: WA,
      stepUi: -SIZE_STEP_UI,
    }), null);
  });

  it("returns null for zero / non-finite stepUi", () => {
    assert.strictEqual(computeSizeStepKey({
      currentSize: "P:9", currentPixelWidth: 200, workArea: WA, stepUi: 0,
    }), null);
    assert.strictEqual(computeSizeStepKey({
      currentSize: "P:9", currentPixelWidth: 200, workArea: WA, stepUi: NaN,
    }), null);
  });

  it("steps legacy S/M/L keys via pixel reverse", () => {
    const key = computeSizeStepKey({
      currentSize: "S",
      currentPixelWidth: 192,
      workArea: WA,
      stepUi: SIZE_STEP_UI,
    });
    assert.ok(typeof key === "string" && key.startsWith("P:"));
    const nextUi = currentSizeToUi(key, 0, WA);
    const curUi = currentSizeToUi("S", 192, WA);
    assert.strictEqual(nextUi, curUi + SIZE_STEP_UI);
  });
});

describe("nearestPresetUi / isCurrentPreset", () => {
  it("picks the closest preset", () => {
    assert.strictEqual(nearestPresetUi(20), 20);
    assert.strictEqual(nearestPresetUi(34), 35);
    assert.strictEqual(nearestPresetUi(51), 50);
  });

  it("marks only the nearest preset as current", () => {
    assert.strictEqual(isCurrentPreset(35, 34), true);
    assert.strictEqual(isCurrentPreset(20, 34), false);
  });
});
