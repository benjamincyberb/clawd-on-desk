"use strict";

const {
  clampSizeUi,
  formatSizeKey,
  prefsSizeToUi,
  uiSizeToPrefs,
} = require("./pet-size-step");
const { getProportionalPixelSize } = require("./size-utils");

const SIZE_RATIO_MIN = uiSizeToPrefs(1);
const SIZE_RATIO_MAX = uiSizeToPrefs(100);

const CORNER_ANCHORS = {
  nw: {
    opposite(b) {
      return { x: b.x + b.width, y: b.y + b.height };
    },
    place(ox, oy, side) {
      return { x: ox - side, y: oy - side, width: side, height: side };
    },
  },
  ne: {
    opposite(b) {
      return { x: b.x, y: b.y + b.height };
    },
    place(ox, oy, side) {
      return { x: ox, y: oy - side, width: side, height: side };
    },
  },
  sw: {
    opposite(b) {
      return { x: b.x + b.width, y: b.y };
    },
    place(ox, oy, side) {
      return { x: ox - side, y: oy, width: side, height: side };
    },
  },
  se: {
    opposite(b) {
      return { x: b.x, y: b.y };
    },
    place(ox, oy, side) {
      return { x: ox, y: oy, width: side, height: side };
    },
  },
};

function workAreaBasePx(workArea) {
  const width = Number(workArea && workArea.width) || 0;
  const height = Number(workArea && workArea.height) || 0;
  return Math.max(width, height) || width || 0;
}

function clampSidePx(side, workArea, minRatio, maxRatio) {
  const minR = Number.isFinite(minRatio) ? minRatio : SIZE_RATIO_MIN;
  const maxR = Number.isFinite(maxRatio) ? maxRatio : SIZE_RATIO_MAX;
  const minPx = getProportionalPixelSize(minR, workArea).width;
  const maxPx = getProportionalPixelSize(maxR, workArea).width;
  const lo = Math.max(1, Math.min(minPx, maxPx));
  const hi = Math.max(lo, Math.max(minPx, maxPx));
  return Math.max(lo, Math.min(hi, Math.round(side)));
}

/**
 * Uniform square resize from a dragged corner. The opposite corner stays fixed
 * for the gesture (startBounds). Side length follows max(|dx|, |dy|) so the
 * cursor tracks the dragged corner of a square.
 */
function computeResizeBounds({
  corner,
  cursorScreenX,
  cursorScreenY,
  startBounds,
  workArea,
  minRatio = SIZE_RATIO_MIN,
  maxRatio = SIZE_RATIO_MAX,
} = {}) {
  const anchor = CORNER_ANCHORS[corner];
  if (!anchor || !startBounds) return null;
  const w = Number(startBounds.width);
  const h = Number(startBounds.height);
  if (!(w > 0) || !(h > 0)) return null;
  if (!Number.isFinite(cursorScreenX) || !Number.isFinite(cursorScreenY)) return null;

  const opp = anchor.opposite(startBounds);
  const sideRaw = Math.max(
    Math.abs(cursorScreenX - opp.x),
    Math.abs(cursorScreenY - opp.y),
  );
  const side = clampSidePx(sideRaw, workArea, minRatio, maxRatio);
  return anchor.place(opp.x, opp.y, side);
}

/**
 * Convert a realized pixel width to the nearest `P:<ratio>` prefs key.
 */
function boundsToSizeKey(width, workArea) {
  const basePx = workAreaBasePx(workArea);
  const px = Number(width);
  if (!(basePx > 0) || !(px > 0)) return null;
  const ratio = (px / basePx) * 100;
  const ui = clampSizeUi(prefsSizeToUi(ratio));
  return formatSizeKey(ui);
}

module.exports = {
  SIZE_RATIO_MIN,
  SIZE_RATIO_MAX,
  CORNER_ANCHORS,
  computeResizeBounds,
  boundsToSizeKey,
  clampSidePx,
  workAreaBasePx,
};
