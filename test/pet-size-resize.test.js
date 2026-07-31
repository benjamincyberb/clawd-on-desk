"use strict";

const assert = require("node:assert");
const { describe, it } = require("node:test");

const {
  SIZE_RATIO_MIN,
  SIZE_RATIO_MAX,
  computeResizeBounds,
  boundsToSizeKey,
} = require("../src/pet-size-resize");
const { getProportionalPixelSize } = require("../src/size-utils");
const { formatSizeKey, prefsSizeToUi } = require("../src/pet-size-step");

const WA = { x: 0, y: 0, width: 1920, height: 1080 };
const START = { x: 100, y: 100, width: 200, height: 200 };

describe("computeResizeBounds", () => {
  it("keeps the opposite corner fixed for each drag corner", () => {
    const se = computeResizeBounds({
      corner: "se",
      cursorScreenX: 100 + 300,
      cursorScreenY: 100 + 300,
      startBounds: START,
      workArea: WA,
    });
    assert.ok(se);
    assert.strictEqual(se.x, 100);
    assert.strictEqual(se.y, 100);
    assert.strictEqual(se.width, 300);
    assert.strictEqual(se.height, 300);

    const nw = computeResizeBounds({
      corner: "nw",
      cursorScreenX: 100 + 200 - 300,
      cursorScreenY: 100 + 200 - 300,
      startBounds: START,
      workArea: WA,
    });
    assert.ok(nw);
    assert.strictEqual(nw.x + nw.width, START.x + START.width);
    assert.strictEqual(nw.y + nw.height, START.y + START.height);
    assert.strictEqual(nw.width, 300);
    assert.strictEqual(nw.height, 300);

    const ne = computeResizeBounds({
      corner: "ne",
      cursorScreenX: 100 + 280,
      cursorScreenY: 100 + 200 - 280,
      startBounds: START,
      workArea: WA,
    });
    assert.ok(ne);
    assert.strictEqual(ne.x, START.x);
    assert.strictEqual(ne.y + ne.height, START.y + START.height);
    assert.strictEqual(ne.width, 280);
    assert.strictEqual(ne.height, 280);

    const sw = computeResizeBounds({
      corner: "sw",
      cursorScreenX: 100 + 200 - 260,
      cursorScreenY: 100 + 260,
      startBounds: START,
      workArea: WA,
    });
    assert.ok(sw);
    assert.strictEqual(sw.x + sw.width, START.x + START.width);
    assert.strictEqual(sw.y, START.y);
    assert.strictEqual(sw.width, 260);
    assert.strictEqual(sw.height, 260);
  });

  it("always returns a square", () => {
    const next = computeResizeBounds({
      corner: "se",
      cursorScreenX: 100 + 400,
      cursorScreenY: 100 + 120,
      startBounds: START,
      workArea: WA,
    });
    assert.ok(next);
    assert.strictEqual(next.width, next.height);
    assert.strictEqual(next.width, 400);
  });

  it("clamps to the min and max proportional ratios", () => {
    const minPx = getProportionalPixelSize(SIZE_RATIO_MIN, WA).width;
    const maxPx = getProportionalPixelSize(SIZE_RATIO_MAX, WA).width;

    const tiny = computeResizeBounds({
      corner: "se",
      cursorScreenX: START.x + 1,
      cursorScreenY: START.y + 1,
      startBounds: START,
      workArea: WA,
    });
    assert.ok(tiny);
    assert.strictEqual(tiny.width, minPx);
    assert.strictEqual(tiny.height, minPx);

    const huge = computeResizeBounds({
      corner: "se",
      cursorScreenX: START.x + 10000,
      cursorScreenY: START.y + 10000,
      startBounds: START,
      workArea: WA,
    });
    assert.ok(huge);
    assert.strictEqual(huge.width, maxPx);
    assert.strictEqual(huge.height, maxPx);
  });

  it("returns null for invalid corners / inputs", () => {
    assert.strictEqual(computeResizeBounds({
      corner: "xx",
      cursorScreenX: 10,
      cursorScreenY: 10,
      startBounds: START,
      workArea: WA,
    }), null);
    assert.strictEqual(computeResizeBounds({
      corner: "se",
      cursorScreenX: NaN,
      cursorScreenY: 10,
      startBounds: START,
      workArea: WA,
    }), null);
    assert.strictEqual(computeResizeBounds({
      corner: "se",
      cursorScreenX: 10,
      cursorScreenY: 10,
      startBounds: null,
      workArea: WA,
    }), null);
  });
});

describe("boundsToSizeKey", () => {
  it("maps pixel width back to a P:<ratio> key", () => {
    const px = getProportionalPixelSize(9, WA).width;
    assert.strictEqual(boundsToSizeKey(px, WA), formatSizeKey(prefsSizeToUi(9)));
  });

  it("returns null when work area or width is invalid", () => {
    assert.strictEqual(boundsToSizeKey(0, WA), null);
    assert.strictEqual(boundsToSizeKey(200, null), null);
  });
});
