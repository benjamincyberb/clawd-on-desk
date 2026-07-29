"use strict";

const {
  isPlainObject,
  getStateFiles,
  getStateBindingEntry,
  deepMergeObject,
  basenameOnly,
  mergeDefaults,
} = require("./theme-schema");
const { applyUserOverridesPatch } = require("./theme-variants");

const PROGRESSION_VISUAL_KEYS = new Set([
  "states",
  "workingTiers",
  "idleAnimations",
  "objectScale",
  "fileHitBoxes",
  "timings",
]);

const DEFAULT_MERIT_PARAMS = Object.freeze({
  meritPerSec: 1,
  completionMerit: 50,
  errorMerit: 5,
  maxMeritPerSec: 1,
  minEventCooldownMs: 1000,
  dailyBonus: 100,
  streakDays: 7,
  streakBonus: 500,
  dailyCap: 10000,
  meritTickMs: null,
  meritPerTick: null,
});

function clampFinite(value, fallback, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function normalizeLocalizedName(value, fallbackId) {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (isPlainObject(value)) {
    const out = {};
    for (const [lang, text] of Object.entries(value)) {
      if (typeof text === "string" && text.trim()) out[lang] = text.trim();
    }
    if (Object.keys(out).length) return out;
  }
  return fallbackId;
}

function normalizeParams(rawParams) {
  const src = isPlainObject(rawParams) ? rawParams : {};
  const out = {
    meritPerSec: clampFinite(src.meritPerSec, DEFAULT_MERIT_PARAMS.meritPerSec, 0, 100),
    completionMerit: clampFinite(src.completionMerit, DEFAULT_MERIT_PARAMS.completionMerit, 0, 1_000_000),
    errorMerit: clampFinite(src.errorMerit, DEFAULT_MERIT_PARAMS.errorMerit, 0, 1_000_000),
    maxMeritPerSec: clampFinite(src.maxMeritPerSec, DEFAULT_MERIT_PARAMS.maxMeritPerSec, 0, 100),
    minEventCooldownMs: Math.round(clampFinite(
      src.minEventCooldownMs,
      DEFAULT_MERIT_PARAMS.minEventCooldownMs,
      0,
      60_000
    )),
    dailyBonus: clampFinite(src.dailyBonus, DEFAULT_MERIT_PARAMS.dailyBonus, 0, 1_000_000),
    streakDays: Math.round(clampFinite(src.streakDays, DEFAULT_MERIT_PARAMS.streakDays, 1, 365)),
    streakBonus: clampFinite(src.streakBonus, DEFAULT_MERIT_PARAMS.streakBonus, 0, 1_000_000),
    dailyCap: clampFinite(src.dailyCap, DEFAULT_MERIT_PARAMS.dailyCap, 1, 10_000_000),
  };
  if (src.meritTickMs != null) {
    out.meritTickMs = Math.round(clampFinite(src.meritTickMs, 1000, 200, 5000));
  }
  if (src.meritPerTick != null) {
    out.meritPerTick = clampFinite(src.meritPerTick, 1, 0, 1000);
  }
  return out;
}

function normalizeVisuals(rawVisuals) {
  if (!isPlainObject(rawVisuals)) return null;
  const out = {};
  for (const key of PROGRESSION_VISUAL_KEYS) {
    if (!(key in rawVisuals)) continue;
    out[key] = rawVisuals[key];
  }
  return Object.keys(out).length ? out : null;
}

function normalizeStages(rawStages) {
  if (!Array.isArray(rawStages) || rawStages.length === 0) return null;
  const stages = [];
  let lastRequired = -1;
  const seenIds = new Set();

  for (let i = 0; i < rawStages.length; i++) {
    const entry = rawStages[i];
    if (!isPlainObject(entry)) return null;
    const id = typeof entry.id === "string" && entry.id.trim()
      ? entry.id.trim()
      : `stage-${i}`;
    if (seenIds.has(id)) return null;
    seenIds.add(id);

    const requiredMerit = Number(entry.requiredMerit);
    if (!Number.isFinite(requiredMerit) || requiredMerit < 0) return null;
    if (i === 0 && requiredMerit !== 0) return null;
    if (requiredMerit <= lastRequired) return null;
    lastRequired = requiredMerit;

    stages.push({
      id,
      requiredMerit,
      name: normalizeLocalizedName(entry.name, id),
      visuals: normalizeVisuals(entry.visuals),
    });
  }
  return stages;
}

/**
 * Normalize theme.json meritCultivator into a capability object.
 * External (non-builtin) themes never get an enabled capability.
 */
function normalizeMeritCultivator(raw, options = {}) {
  const isBuiltin = !!options.isBuiltin;
  const block = isPlainObject(raw && raw.meritCultivator) ? raw.meritCultivator : null;
  if (!block || block.enabled !== true || !isBuiltin) {
    return { enabled: false, params: { ...DEFAULT_MERIT_PARAMS }, stages: null };
  }
  const stages = normalizeStages(block.stages);
  if (!stages) {
    return { enabled: false, params: { ...DEFAULT_MERIT_PARAMS }, stages: null };
  }
  return {
    enabled: true,
    params: normalizeParams(block.params),
    stages,
  };
}

function resolveStage(merit, stages) {
  if (!Array.isArray(stages) || stages.length === 0) return null;
  const safeMerit = Number.isFinite(merit) ? Math.max(0, merit) : 0;
  let current = stages[0];
  for (const stage of stages) {
    if (safeMerit >= stage.requiredMerit) current = stage;
    else break;
  }
  return current;
}

function resolveProgressionStageFromBucket(progressBucket, stages) {
  if (!Array.isArray(stages) || stages.length === 0) return null;
  const bucket = progressBucket && typeof progressBucket === "object" ? progressBucket : {};
  const debugStageId = typeof bucket.debugStageId === "string" && bucket.debugStageId.trim()
    ? bucket.debugStageId.trim()
    : null;
  if (debugStageId && stages.some((entry) => entry.id === debugStageId)) {
    return debugStageId;
  }
  const stage = resolveStage(bucket.merit || 0, stages);
  return (stage && stage.id) || (stages[0] && stages[0].id) || null;
}

/** Merit value that lands in the middle of a stage band for debug previews. */
function previewMeritForStage(stageId, stages) {
  if (!Array.isArray(stages) || stages.length === 0) return 0;
  const index = stages.findIndex((entry) => entry.id === stageId);
  if (index < 0) return 0;
  const stage = stages[index];
  const next = stages[index + 1];
  if (!next) return stage.requiredMerit;
  const gap = next.requiredMerit - stage.requiredMerit;
  if (gap <= 1) return stage.requiredMerit;
  return stage.requiredMerit + Math.floor(gap / 2);
}

function resolveStageIndex(merit, stages) {
  if (!Array.isArray(stages) || stages.length === 0) return -1;
  const stage = resolveStage(merit, stages);
  return stages.findIndex((entry) => entry.id === stage.id);
}

function nextStageThreshold(merit, stages) {
  const index = resolveStageIndex(merit, stages);
  if (index < 0 || index >= stages.length - 1) return null;
  return stages[index + 1];
}

function mergeStateBindings(baseStates, patchStates) {
  if (!isPlainObject(patchStates)) return baseStates;
  const next = isPlainObject(baseStates) ? { ...baseStates } : {};
  for (const [stateKey, entry] of Object.entries(patchStates)) {
    if (stateKey.startsWith("_")) continue;
    if (Array.isArray(entry)) {
      next[stateKey] = entry.map((file) => basenameOnly(file)).filter(Boolean);
      continue;
    }
    if (isPlainObject(entry)) {
      const current = getStateBindingEntry(next[stateKey] || []);
      const files = getStateFiles(entry);
      next[stateKey] = {
        files: files.length ? files.map((file) => basenameOnly(file)).filter(Boolean) : current.files,
        fallbackTo: entry.fallbackTo !== undefined ? entry.fallbackTo : current.fallbackTo,
      };
    }
  }
  return next;
}

/**
 * Apply stage visuals onto a raw theme object (after user variant, before user overrides).
 */
function applyProgressionVisuals(raw, stage) {
  if (!isPlainObject(raw) || !stage || !isPlainObject(stage.visuals)) return raw;
  const patched = { ...raw };
  const visuals = stage.visuals;

  if (visuals.states) {
    patched.states = mergeStateBindings(raw.states, visuals.states);
  }
  if (Array.isArray(visuals.workingTiers)) {
    patched.workingTiers = visuals.workingTiers;
  }
  if (Array.isArray(visuals.idleAnimations)) {
    patched.idleAnimations = visuals.idleAnimations;
  }
  if (isPlainObject(visuals.objectScale)) {
    patched.objectScale = isPlainObject(raw.objectScale)
      ? deepMergeObject(raw.objectScale, visuals.objectScale)
      : visuals.objectScale;
  }
  if (isPlainObject(visuals.fileHitBoxes)) {
    patched.fileHitBoxes = isPlainObject(raw.fileHitBoxes)
      ? { ...raw.fileHitBoxes, ...visuals.fileHitBoxes }
      : { ...visuals.fileHitBoxes };
  }
  if (isPlainObject(visuals.timings)) {
    patched.timings = isPlainObject(raw.timings)
      ? deepMergeObject(raw.timings, visuals.timings)
      : visuals.timings;
  }
  return patched;
}

function cloneMeritStageVisualSlice(value) {
  if (value == null) return value;
  if (Array.isArray(value)) return value.map((entry) => cloneMeritStageVisualSlice(entry));
  if (!isPlainObject(value)) return value;
  const out = {};
  for (const [key, child] of Object.entries(value)) {
    out[key] = cloneMeritStageVisualSlice(child);
  }
  return out;
}

function extractMeritStageVisualSlice(theme) {
  if (!theme || typeof theme !== "object") return null;
  const slice = {
    states: cloneMeritStageVisualSlice(theme.states),
    workingTiers: cloneMeritStageVisualSlice(theme.workingTiers),
    jugglingTiers: cloneMeritStageVisualSlice(theme.jugglingTiers),
    idleAnimations: cloneMeritStageVisualSlice(theme.idleAnimations),
    objectScale: cloneMeritStageVisualSlice(theme.objectScale),
    fileHitBoxes: cloneMeritStageVisualSlice(theme.fileHitBoxes),
    timings: cloneMeritStageVisualSlice(theme.timings),
  };
  if (Array.isArray(theme.wideHitboxFiles)) {
    slice.wideHitboxFiles = [...theme.wideHitboxFiles];
  }
  if (Array.isArray(theme.sleepingHitboxFiles)) {
    slice.sleepingHitboxFiles = [...theme.sleepingHitboxFiles];
  }
  if (theme.miniMode) {
    slice.miniMode = cloneMeritStageVisualSlice(theme.miniMode);
  }
  return slice;
}

/**
 * Pre-merge per-stage runtime visual snapshots (variant base + stage visuals + user overrides).
 */
function buildMeritStageProfiles(afterVariant, stages, userOverrides, themeId, isBuiltin) {
  if (!Array.isArray(stages) || stages.length === 0) return null;
  const profiles = {};
  for (const stage of stages) {
    let patched = applyProgressionVisuals(afterVariant, stage);
    if (userOverrides) patched = applyUserOverridesPatch(patched, userOverrides);
    const merged = mergeDefaults(patched, themeId, isBuiltin);
    profiles[stage.id] = extractMeritStageVisualSlice(merged);
  }
  return profiles;
}

function applyMeritStageVisualSlice(theme, slice) {
  if (!theme || !slice) return false;
  theme.states = cloneMeritStageVisualSlice(slice.states);
  theme.workingTiers = cloneMeritStageVisualSlice(slice.workingTiers);
  theme.jugglingTiers = cloneMeritStageVisualSlice(slice.jugglingTiers);
  theme.idleAnimations = cloneMeritStageVisualSlice(slice.idleAnimations);
  theme.objectScale = cloneMeritStageVisualSlice(slice.objectScale);
  theme.fileHitBoxes = cloneMeritStageVisualSlice(slice.fileHitBoxes);
  theme.timings = cloneMeritStageVisualSlice(slice.timings);
  if (Array.isArray(slice.wideHitboxFiles)) {
    theme.wideHitboxFiles = [...slice.wideHitboxFiles];
  }
  if (Array.isArray(slice.sleepingHitboxFiles)) {
    theme.sleepingHitboxFiles = [...slice.sleepingHitboxFiles];
  }
  if (slice.miniMode) {
    theme.miniMode = cloneMeritStageVisualSlice(slice.miniMode);
  }
  return true;
}

/**
 * Swap active merit stage visuals in-memory (no theme reload).
 */
function applyMeritStageToTheme(theme, stageId) {
  if (!theme || typeof stageId !== "string" || !stageId) return false;
  const profiles = theme._meritStageProfiles;
  if (!profiles || !profiles[stageId]) return false;
  if (theme._meritStageId === stageId && theme._progressionStageId === stageId) return false;
  applyMeritStageVisualSlice(theme, profiles[stageId]);
  theme._meritStageId = stageId;
  theme._progressionStageId = stageId;
  return true;
}

function collectProgressionAssetFiles(stages) {
  const files = new Set();
  if (!Array.isArray(stages)) return files;
  for (const stage of stages) {
    const visuals = stage && stage.visuals;
    if (!visuals) continue;
    if (isPlainObject(visuals.states)) {
      for (const entry of Object.values(visuals.states)) {
        for (const file of getStateFiles(entry)) {
          const safe = basenameOnly(file);
          if (safe) files.add(safe);
        }
      }
    }
    for (const group of [visuals.workingTiers, visuals.idleAnimations]) {
      if (!Array.isArray(group)) continue;
      for (const entry of group) {
        if (entry && typeof entry.file === "string") {
          const safe = basenameOnly(entry.file);
          if (safe) files.add(safe);
        }
      }
    }
  }
  return files;
}

function localizeStageName(name, lang = "en") {
  if (typeof name === "string") return name;
  if (!isPlainObject(name)) return "";
  if (typeof name[lang] === "string") return name[lang];
  if (typeof name.en === "string") return name.en;
  if (typeof name.zh === "string") return name.zh;
  const first = Object.values(name).find((value) => typeof value === "string");
  return first || "";
}

module.exports = {
  DEFAULT_MERIT_PARAMS,
  PROGRESSION_VISUAL_KEYS,
  normalizeMeritCultivator,
  normalizeParams,
  normalizeStages,
  resolveStage,
  resolveProgressionStageFromBucket,
  previewMeritForStage,
  resolveStageIndex,
  nextStageThreshold,
  applyProgressionVisuals,
  buildMeritStageProfiles,
  extractMeritStageVisualSlice,
  applyMeritStageToTheme,
  collectProgressionAssetFiles,
  localizeStageName,
};
