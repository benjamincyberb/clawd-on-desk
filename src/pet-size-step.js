"use strict";

const {
  prefsSizeToUi,
  clampSizeUi,
  formatSizeKey,
  uiSizeToPrefs,
} = require("./settings-size-slider");

// Context-menu nudge step in Settings UI units (1..100).
const SIZE_STEP_UI = 8;

// Ordered presets for the context-menu radio group (UI 1..100).
const SIZE_PRESETS = [
  { id: "xs", ui: 20, labelKey: "sizePresetXs" },
  { id: "s", ui: 35, labelKey: "sizePresetS" },
  { id: "m", ui: 50, labelKey: "sizePresetM" },
  { id: "l", ui: 70, labelKey: "sizePresetL" },
  { id: "xl", ui: 90, labelKey: "sizePresetXl" },
];

function workAreaBasePx(workArea) {
  const width = Number(workArea && workArea.width) || 0;
  const height = Number(workArea && workArea.height) || 0;
  return Math.max(width, height) || width || 0;
}

/**
 * Resolve the current size key (P:<ratio> or legacy S/M/L) to Settings UI units.
 * Legacy / unknown keys reverse from the realized pixel width against the
 * work-area long edge (same base as proportional sizing).
 */
function currentSizeToUi(currentSize, currentPixelWidth, workArea) {
  if (typeof currentSize === "string" && currentSize.startsWith("P:")) {
    const ratio = parseFloat(currentSize.slice(2));
    if (Number.isFinite(ratio)) return clampSizeUi(prefsSizeToUi(ratio));
  }

  const basePx = workAreaBasePx(workArea);
  const px = Number(currentPixelWidth);
  if (!(basePx > 0) || !(px > 0)) {
    // Default prefs size is P:9 → UI 30.
    return clampSizeUi(prefsSizeToUi(9));
  }
  // Mirror main.js legacy S/M/L → P:N migration clamp upper bound (75), then
  // map through the slider's prefs↔UI conversion (prefs max is 30).
  const ratio = Math.max(1, Math.min(75, Math.round((px / basePx) * 100)));
  return clampSizeUi(prefsSizeToUi(ratio));
}

/**
 * Step the pet size by `stepUi` Settings units. Returns the next `P:<ratio>`
 * key, or null when already at the min/max boundary (no change).
 */
function computeSizeStepKey({
  currentSize,
  currentPixelWidth,
  workArea,
  stepUi,
} = {}) {
  if (!Number.isFinite(stepUi) || stepUi === 0) return null;
  const curUi = currentSizeToUi(currentSize, currentPixelWidth, workArea);
  const nextUi = clampSizeUi(curUi + stepUi);
  if (nextUi === curUi) return null;
  return formatSizeKey(nextUi);
}

function nearestPresetUi(ui) {
  const clamped = clampSizeUi(ui);
  let bestUi = SIZE_PRESETS[0].ui;
  let bestDist = Math.abs(bestUi - clamped);
  for (let i = 1; i < SIZE_PRESETS.length; i++) {
    const candidate = SIZE_PRESETS[i].ui;
    const dist = Math.abs(candidate - clamped);
    if (dist < bestDist) {
      bestDist = dist;
      bestUi = candidate;
    }
  }
  return bestUi;
}

function isCurrentPreset(presetUi, currentUi) {
  return nearestPresetUi(currentUi) === clampSizeUi(presetUi);
}

module.exports = {
  SIZE_STEP_UI,
  SIZE_PRESETS,
  currentSizeToUi,
  computeSizeStepKey,
  nearestPresetUi,
  isCurrentPreset,
  formatSizeKey,
  clampSizeUi,
  prefsSizeToUi,
  uiSizeToPrefs,
};
