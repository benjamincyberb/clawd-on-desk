"use strict";

const { normalizeRiveBindings } = require("./rive-bindings");
const renderBackends = require("./render-backends");

// Defaults used when theme.json omits optional fields.

const DEFAULT_SOUNDS = {
  complete: "complete.mp3",
  confirm: "confirm.mp3",
};

// State-scoped looping / cadence sounds. Themes map a display state to a
// logical sound name from `sounds`. Only "loop" is implemented today; other
// modes may be added without changing callers that already pass mode through.
const STATE_SOUND_MODES = new Set(["loop"]);

const DEFAULT_TIMINGS = {
  minDisplay: {
    attention: 4000, error: 5000, sweeping: 5500,
    notification: 2500, carrying: 3000, working: 1000, thinking: 1000,
  },
  autoReturn: {
    attention: 4000, error: 5000, sweeping: 300000,
    notification: 2500, carrying: 3000,
  },
  yawnDuration: 3000,
  wakeDuration: 1500,
  deepSleepTimeout: 600000,
  mouseIdleTimeout: 20000,
  mouseSleepTimeout: 60000,
};

const DEFAULT_HITBOXES = {
  default: { x: -1, y: 5, w: 17, h: 12 },
  sleeping: { x: -2, y: 9, w: 19, h: 7 },
  wide: { x: -3, y: 3, w: 21, h: 14 },
};

const DEFAULT_OBJECT_SCALE = {
  widthRatio: 1.9, heightRatio: 1.3,
  offsetX: -0.45, offsetY: -0.25,
};
const DEFAULT_LAYOUT = {
  centerXRatio: 0.5,
  baselineBottomRatio: 0.05,
  visibleHeightRatio: 0.58,
};

const DEFAULT_EYE_TRACKING = {
  enabled: false,
  states: [],
  eyeRatioX: 0.5,
  eyeRatioY: 0.5,
  maxOffset: 3,
  bodyScale: 0.33,
  shadowStretch: 0.15,
  shadowShift: 0.3,
  ids: { eyes: "eyes-js", body: "body-js", shadow: "shadow-js", dozeEyes: "eyes-doze" },
  shadowOrigin: "7.5px 15px",
};

const REQUIRED_STATES = ["idle", "working", "thinking"];
const FULL_SLEEP_REQUIRED_STATES = ["yawning", "dozing", "collapsing", "waking"];
const MINI_REQUIRED_STATES = [
  "mini-idle",
  "mini-enter",
  "mini-enter-sleep",
  "mini-crabwalk",
  "mini-peek",
  "mini-alert",
  "mini-happy",
  "mini-sleep",
];
const VISUAL_FALLBACK_STATES = new Set([
  "error",
  "attention",
  "notification",
  "sweeping",
  "carrying",
  "sleeping",
  "roam",
]);

const RENDER_BACKENDS = renderBackends.RENDER_BACKENDS;
const DEFAULT_SANDBOX_ENGINE = "phaser";
const DEFAULT_RIVE_STATE_LEVELS = {
  idle: 0,
  thinking: 1,
  working: 2,
  juggling: 2,
  sleeping: 0,
  dozing: 0,
  yawning: 0,
  collapsing: 0,
  waking: 0,
  "mini-idle": 0,
  "mini-sleep": 0,
  "mini-peek": 1,
  "mini-alert": 2,
  "mini-happy": 1,
};
const DEFAULT_RIVE_INPUTS = {
  level: "Level",
  hover: "Hovering",
  bump: "bump",
};
const DEFAULT_RIVE_STATE_MACHINES = [
  "Login Machine",
  "Clawd",
  "Designer's Test",
  "State Machine 1",
];
const MAX_RIVE_FILE_BYTES = 20 * 1024 * 1024;

function resolveThemeRenderBackend(themeOrRaw) {
  return renderBackends.resolveThemeRenderBackend(themeOrRaw);
}

function normalizeSandboxConfig(rawSandbox, rawTheme) {
  const backend = resolveThemeRenderBackend(rawTheme);
  if (backend !== "sandbox") return null;
  const src = isPlainObject(rawSandbox) ? rawSandbox : {};
  let entry = typeof src.entry === "string" ? basenameOnly(src.entry) : "";
  if (!entry) entry = "index.html";
  const engineRaw = typeof src.engine === "string" ? src.engine.trim().toLowerCase() : "";
  const engine = renderBackends.isSandboxEngine(engineRaw) ? engineRaw : DEFAULT_SANDBOX_ENGINE;
  return {
    entry,
    engine,
    network: src.network === true,
  };
}

function normalizeRiveConfig(rawRive, rawTheme) {
  const backend = resolveThemeRenderBackend(rawTheme);
  if (backend !== "rive") {
    return null;
  }
  const src = isPlainObject(rawRive) ? rawRive : {};
  let file = typeof src.file === "string" ? basenameOnly(src.file) : "";
  if (!file) {
    const idleFiles = getStateFiles(rawTheme && rawTheme.states && rawTheme.states.idle);
    file = idleFiles.find((f) => typeof f === "string" && f.toLowerCase().endsWith(".riv")) || "";
    file = basenameOnly(file) || "";
  }
  const inputs = { ...DEFAULT_RIVE_INPUTS };
  if (isPlainObject(src.inputs)) {
    for (const key of Object.keys(DEFAULT_RIVE_INPUTS)) {
      if (typeof src.inputs[key] === "string" && src.inputs[key].trim()) {
        inputs[key] = src.inputs[key].trim();
      }
    }
  }
  const stateLevels = { ...DEFAULT_RIVE_STATE_LEVELS };
  if (isPlainObject(src.stateLevels)) {
    for (const [state, level] of Object.entries(src.stateLevels)) {
      if (typeof state === "string" && state && Number.isFinite(level)) {
        stateLevels[state] = Math.max(0, Math.min(2, Math.floor(level)));
      }
    }
  }
  let stateMachines = [];
  if (typeof src.stateMachine === "string" && src.stateMachine.trim()) {
    stateMachines.push(src.stateMachine.trim());
  }
  if (Array.isArray(src.stateMachines)) {
    for (const name of src.stateMachines) {
      if (typeof name === "string" && name.trim() && !stateMachines.includes(name.trim())) {
        stateMachines.push(name.trim());
      }
    }
  }
  for (const name of DEFAULT_RIVE_STATE_MACHINES) {
    if (!stateMachines.includes(name)) stateMachines.push(name);
  }
  // Declarative input bindings drive the generic renderer. Kept as a JSON-safe
  // passthrough; rive-bindings.js is the single source of truth for shape and
  // legacy (inputs/stateLevels) adaptation.
  let bindings = null;
  if (isPlainObject(src.bindings) || Array.isArray(src.bindings)) {
    bindings = src.bindings;
  }
  return {
    file: file || null,
    stateMachine: stateMachines[0] || DEFAULT_RIVE_STATE_MACHINES[0],
    stateMachines,
    inputs,
    stateLevels,
    bindings,
    maxFileBytes: MAX_RIVE_FILE_BYTES,
  };
}

function validateTheme(cfg) {
  const errors = [];
  const sleepMode = deriveSleepMode(cfg);
  const normalizedStates = normalizeStateBindings(cfg && cfg.states);

  if (cfg.schemaVersion !== 1) {
    errors.push(`schemaVersion must be 1, got ${cfg.schemaVersion}`);
  }
  if (!cfg.name) errors.push("missing required field: name");
  if (!cfg.version) errors.push("missing required field: version");

  if (!cfg.viewBox || cfg.viewBox.width == null || cfg.viewBox.height == null ||
      cfg.viewBox.x == null || cfg.viewBox.y == null) {
    errors.push("missing or incomplete viewBox (need x, y, width, height)");
  }

  if (!cfg.states) {
    errors.push("missing required field: states");
  } else {
    for (const s of REQUIRED_STATES) {
      if (!hasStateFiles(cfg.states[s])) {
        errors.push(`states.${s} must be a non-empty array`);
      }
    }
    if (!hasStateBinding(cfg.states.sleeping)) {
      errors.push("states.sleeping must define files or fallbackTo");
    }
    if (sleepMode === "full") {
      for (const s of FULL_SLEEP_REQUIRED_STATES) {
        if (!hasStateFiles(cfg.states[s])) {
          errors.push(`sleepSequence.mode=full requires states.${s} to be a non-empty array`);
        }
      }
    }
  }

  if (cfg.renderBackend !== undefined) {
    const backend = typeof cfg.renderBackend === "string"
      ? cfg.renderBackend.trim().toLowerCase()
      : "";
    if (!RENDER_BACKENDS.has(backend)) {
      errors.push(`renderBackend must be "svg", "rive", or "sandbox", got ${JSON.stringify(cfg.renderBackend)}`);
    }
  }

  const resolvedBackend = resolveThemeRenderBackend(cfg);
  if (resolvedBackend === "rive") {
    if (cfg.rive !== undefined && !isPlainObject(cfg.rive)) {
      errors.push("rive must be an object when present");
    }
    const riveCfg = normalizeRiveConfig(cfg.rive, cfg);
    if (!riveCfg || !riveCfg.file || !riveCfg.file.toLowerCase().endsWith(".riv")) {
      errors.push('renderBackend "rive" requires rive.file or states.idle to reference a .riv asset');
    }
    if (isPlainObject(cfg.rive) && cfg.rive.bindings !== undefined) {
      const raw = cfg.rive.bindings;
      const isContainer = isPlainObject(raw) || Array.isArray(raw);
      const count = Array.isArray(raw) ? raw.length : (isPlainObject(raw) ? Object.keys(raw).length : 0);
      if (!isContainer) {
        errors.push("rive.bindings must be an object keyed by input name or an array of entries");
      } else if (count > 0 && normalizeRiveBindings({ bindings: raw }).length === 0) {
        errors.push("rive.bindings has no usable entries (each needs a valid `from` or `on`)");
      }
    }
    if (cfg.eyeTracking && cfg.eyeTracking.enabled) {
      errors.push('eyeTracking.enabled is not supported with renderBackend "rive"');
    }
  }

  if (resolvedBackend === "sandbox") {
    if (cfg.sandbox !== undefined && !isPlainObject(cfg.sandbox)) {
      errors.push("sandbox must be an object when present");
    }
    const rawEntry = isPlainObject(cfg.sandbox) && typeof cfg.sandbox.entry === "string"
      ? cfg.sandbox.entry.trim()
      : "";
    if (!rawEntry) {
      errors.push('renderBackend "sandbox" requires sandbox.entry to be an .html file');
    } else if (rawEntry.includes("/") || rawEntry.includes("\\") || rawEntry.includes("..")) {
      errors.push("sandbox.entry must be a basename (no path separators or ..)");
    } else if (!rawEntry.toLowerCase().endsWith(".html")) {
      errors.push('renderBackend "sandbox" requires sandbox.entry to be an .html file');
    }
    if (isPlainObject(cfg.sandbox) && cfg.sandbox.engine !== undefined) {
      const eng = typeof cfg.sandbox.engine === "string"
        ? cfg.sandbox.engine.trim().toLowerCase()
        : "";
      if (eng && !renderBackends.isSandboxEngine(eng)) {
        errors.push(`sandbox.engine must be one of ${renderBackends.SANDBOX_ENGINES.join(", ")}`);
      }
    }
    if (cfg.eyeTracking && cfg.eyeTracking.enabled) {
      errors.push('eyeTracking.enabled is not supported with renderBackend "sandbox"');
    }
  }

  if (cfg.eyeTracking && cfg.eyeTracking.enabled) {
    if (!Array.isArray(cfg.eyeTracking.states) || cfg.eyeTracking.states.length === 0) {
      errors.push("eyeTracking.states must be a non-empty array when eyeTracking.enabled=true");
    }
  }

  // eyeTracking.states listed states must use .svg if enabled (SVG backend only)
  if (resolvedBackend === "svg" && cfg.eyeTracking && cfg.eyeTracking.enabled && cfg.states) {
    for (const stateName of (cfg.eyeTracking.states || [])) {
      const files = getStateFiles(cfg.states[stateName]).length > 0
        ? getStateFiles(cfg.states[stateName])
        : (cfg.miniMode && cfg.miniMode.states && cfg.miniMode.states[stateName]);
      if (files) {
        for (const f of files) {
          if (!f.endsWith(".svg")) {
            errors.push(`eyeTracking state "${stateName}" file "${f}" must be .svg`);
          }
        }
      }
    }
  }

  if (cfg.sleepSequence !== undefined) {
    const rawMode = cfg.sleepSequence && cfg.sleepSequence.mode;
    if (rawMode !== "full" && rawMode !== "direct") {
      errors.push(`sleepSequence.mode must be "full" or "direct", got ${rawMode}`);
    }
  }

  if (cfg.updateVisuals !== undefined) {
    if (!isPlainObject(cfg.updateVisuals)) {
      errors.push("updateVisuals must be an object when present");
    } else if (
      cfg.updateVisuals.checking !== undefined
      && (typeof cfg.updateVisuals.checking !== "string" || !cfg.updateVisuals.checking)
    ) {
      errors.push("updateVisuals.checking must be a non-empty string when present");
    }
  }

  if (cfg.updateBubbleAnchorBox !== undefined) {
    const box = cfg.updateBubbleAnchorBox;
    if (
      !isPlainObject(box)
      || box.x == null
      || box.y == null
      || box.width == null
      || box.height == null
      || !Number.isFinite(box.x)
      || !Number.isFinite(box.y)
      || !Number.isFinite(box.width)
      || !Number.isFinite(box.height)
    ) {
      errors.push("updateBubbleAnchorBox must include finite x, y, width, height");
    }
  }

  if (cfg.rendering !== undefined) {
    if (!isPlainObject(cfg.rendering)) {
      errors.push("rendering must be an object when present");
    } else if (
      cfg.rendering.svgChannel !== undefined
      && cfg.rendering.svgChannel !== "auto"
      && cfg.rendering.svgChannel !== "object"
    ) {
      errors.push(`rendering.svgChannel must be "auto" or "object", got ${cfg.rendering.svgChannel}`);
    }
  }

  if (cfg.customization !== undefined) {
    if (!isPlainObject(cfg.customization)) {
      errors.push("customization must be an object when present");
    } else {
      if (
        cfg.customization.petTint !== undefined
        && typeof cfg.customization.petTint !== "boolean"
      ) {
        errors.push(`customization.petTint must be a boolean, got ${JSON.stringify(cfg.customization.petTint)}`);
      }
      const accessoryResult = normalizeAccessoryAttachments(
        cfg.customization.accessories,
        cfg
      );
      errors.push(...accessoryResult.errors);
    }
  }

  if (cfg.roamFlipAssets !== undefined && typeof cfg.roamFlipAssets !== "boolean") {
    errors.push(`roamFlipAssets must be a boolean, got ${JSON.stringify(cfg.roamFlipAssets)}`);
  }

  if (cfg.stateSounds !== undefined) {
    if (!isPlainObject(cfg.stateSounds)) {
      errors.push("stateSounds must be an object when present");
    } else {
      const knownSounds = {
        ...DEFAULT_SOUNDS,
        ...(isPlainObject(cfg.sounds) ? cfg.sounds : {}),
      };
      for (const [stateKey, entry] of Object.entries(cfg.stateSounds)) {
        if (!stateKey) {
          errors.push("stateSounds keys must be non-empty state names");
          continue;
        }
        if (!isPlainObject(entry)) {
          errors.push(`stateSounds.${stateKey} must be an object`);
          continue;
        }
        if (typeof entry.sound !== "string" || !entry.sound) {
          errors.push(`stateSounds.${stateKey}.sound must be a non-empty string`);
        } else if (!Object.prototype.hasOwnProperty.call(knownSounds, entry.sound)
          || knownSounds[entry.sound] == null) {
          errors.push(`stateSounds.${stateKey}.sound "${entry.sound}" is not defined in sounds`);
        }
        const mode = entry.mode === undefined ? "loop" : entry.mode;
        if (!STATE_SOUND_MODES.has(mode)) {
          errors.push(`stateSounds.${stateKey}.mode must be one of ${[...STATE_SOUND_MODES].join("|")}, got ${JSON.stringify(entry.mode)}`);
        }
      }
    }
  }

  const fallbackStateKeys = Object.keys(normalizedStates);
  for (const stateKey of fallbackStateKeys) {
    const entry = normalizedStates[stateKey];
    if (!entry.fallbackTo) continue;
    if (!VISUAL_FALLBACK_STATES.has(stateKey)) {
      errors.push(`states.${stateKey}.fallbackTo is only allowed on error/attention/notification/sweeping/carrying/sleeping/roam`);
      continue;
    }
    if (!Object.prototype.hasOwnProperty.call(normalizedStates, entry.fallbackTo)) {
      errors.push(`states.${stateKey}.fallbackTo target "${entry.fallbackTo}" does not exist`);
    }
  }

  for (const stateKey of fallbackStateKeys) {
    const visited = new Set([stateKey]);
    let hops = 0;
    let cursor = stateKey;
    while (true) {
      const entry = normalizedStates[cursor];
      if (!entry || !entry.fallbackTo) break;
      const target = entry.fallbackTo;
      hops++;
      if (hops > 3) {
        errors.push(`states.${stateKey}.fallbackTo exceeds 3 hop limit`);
        break;
      }
      if (visited.has(target)) {
        errors.push(`states.${stateKey}.fallbackTo forms a cycle`);
        break;
      }
      visited.add(target);
      if (!Object.prototype.hasOwnProperty.call(normalizedStates, target)) {
        break;
      }
      cursor = target;
    }
    const terminal = normalizedStates[cursor];
    if (!terminal || !hasStateFiles(terminal)) {
      errors.push(`states.${stateKey}.fallbackTo chain does not terminate in real files`);
    }
  }

  if (fallbackStateKeys.length > 0 && !fallbackStateKeys.some((stateKey) => hasStateFiles(normalizedStates[stateKey]))) {
    errors.push("theme must declare at least one state with real files");
  }

  if (isMiniSupported(cfg)) {
    for (const stateName of MINI_REQUIRED_STATES) {
      const files = cfg.miniMode.states && cfg.miniMode.states[stateName];
      if (!Array.isArray(files) || files.length === 0) {
        errors.push(`miniMode.supported=true requires miniMode.states.${stateName} to be a non-empty array`);
      }
    }
  }

  if (cfg.layout) {
    const cb = cfg.layout.contentBox;
    if (!cb || cb.x == null || cb.y == null || cb.width == null || cb.height == null) {
      errors.push("layout.contentBox must include x, y, width, height");
    }
  }

  return errors;
}

function isPlainObject(v) {
  return v && typeof v === "object" && !Array.isArray(v);
}

function hasNonEmptyArray(value) {
  return Array.isArray(value) && value.length > 0;
}

function getStateBindingEntry(entry) {
  if (Array.isArray(entry)) {
    return { files: [...entry], fallbackTo: null };
  }
  if (isPlainObject(entry)) {
    return {
      files: Array.isArray(entry.files) ? [...entry.files] : [],
      fallbackTo: (typeof entry.fallbackTo === "string" && entry.fallbackTo) ? entry.fallbackTo : null,
    };
  }
  return { files: [], fallbackTo: null };
}

function getStateFiles(entry) {
  return getStateBindingEntry(entry).files;
}

function hasStateFiles(entry) {
  return getStateFiles(entry).length > 0;
}

function hasStateBinding(entry) {
  const normalized = getStateBindingEntry(entry);
  return normalized.files.length > 0 || !!normalized.fallbackTo;
}

function normalizeStateBindings(states) {
  const normalized = {};
  if (!isPlainObject(states)) return normalized;
  for (const [stateKey, entry] of Object.entries(states)) {
    if (stateKey.startsWith("_")) continue;
    normalized[stateKey] = getStateBindingEntry(entry);
  }
  return normalized;
}

function hasReactionBindings(reactions) {
  if (!isPlainObject(reactions)) return false;
  return Object.values(reactions).some((entry) =>
    isPlainObject(entry)
    && (
      (typeof entry.file === "string" && entry.file.length > 0)
      || (typeof entry.fileLeft === "string" && entry.fileLeft.length > 0)
      || (typeof entry.fileRight === "string" && entry.fileRight.length > 0)
      || (Array.isArray(entry.files) && entry.files.some((file) => typeof file === "string" && file.length > 0))
    )
  );
}

function isMiniSupported(cfg) {
  return !!(isPlainObject(cfg && cfg.miniMode) && cfg.miniMode.supported !== false);
}

function supportsIdleTracking(cfg) {
  return !!(
    isPlainObject(cfg && cfg.eyeTracking)
    && cfg.eyeTracking.enabled
    && Array.isArray(cfg.eyeTracking.states)
    && cfg.eyeTracking.states.includes("idle")
  );
}

function deriveIdleMode(cfg) {
  if (supportsIdleTracking(cfg)) return "tracked";
  if (hasNonEmptyArray(cfg && cfg.idleAnimations)) return "animated";
  return "static";
}

function deriveSleepMode(cfg) {
  return (cfg && cfg.sleepSequence && cfg.sleepSequence.mode === "direct") ? "direct" : "full";
}

function isSvgFilename(value) {
  return typeof value === "string" && value.toLowerCase().endsWith(".svg");
}

function hasScriptedSvgRuntime(cfg, options = {}) {
  const trustedRuntimeAllowed = !!options.trustedRuntimeAllowed;
  const scriptedFiles = cfg
    && cfg.trustedRuntime
    && Array.isArray(cfg.trustedRuntime.scriptedSvgFiles)
    ? cfg.trustedRuntime.scriptedSvgFiles
    : [];
  if (trustedRuntimeAllowed && scriptedFiles.some((file) => isSvgFilename(file))) return true;
  return !!(
    isPlainObject(cfg && cfg.rendering)
    && cfg.rendering.svgChannel === "object"
  );
}

function derivePowerProfile(cfg, options = {}) {
  return hasScriptedSvgRuntime(cfg, options) ? "scripted" : "standard";
}

function addVisualUsage(out, stateFamily, file, source) {
  const safe = basenameOnly(file);
  if (!safe) return;
  out.push({ stateFamily, file: safe, source });
}

function addVisualBinding(out, stateFamily, binding, source) {
  for (const file of getStateFiles(binding)) {
    addVisualUsage(out, stateFamily, file, source);
  }
}

function getCanonicalFileViewBoxes(cfg) {
  const out = {};
  if (!isPlainObject(cfg && cfg.fileViewBoxes)) return out;
  for (const [rawFile, rawViewBox] of Object.entries(cfg.fileViewBoxes)) {
    const file = basenameOnly(rawFile);
    const viewBox = normalizeViewBox(rawViewBox);
    if (file && viewBox) out[file] = viewBox;
  }
  return out;
}

/**
 * Canonical projection of every runtime-reachable visual usage. Unlike the
 * historical filename Set this retains the state family and effective
 * viewBox, so accessory coverage cannot accidentally apply root coordinates
 * to mini art. This is intentionally pure and works on raw or normalized
 * theme objects.
 */
function projectThemeVisualUsages(cfg) {
  const usages = [];
  for (const [state, binding] of Object.entries((cfg && cfg.states) || {})) {
    addVisualBinding(usages, `normal:${state}`, binding, `states.${state}`);
  }
  if (isMiniSupported(cfg)) {
    for (const [state, binding] of Object.entries(
      (cfg && cfg.miniMode && cfg.miniMode.states) || {}
    )) {
      addVisualBinding(usages, `mini:${state}`, binding, `miniMode.states.${state}`);
    }
  }
  for (const [groupName, group] of [
    ["workingTiers", cfg && cfg.workingTiers],
    ["jugglingTiers", cfg && cfg.jugglingTiers],
    ["idleAnimations", cfg && cfg.idleAnimations],
  ]) {
    for (const entry of Array.isArray(group) ? group : []) {
      if (entry && typeof entry.file === "string") {
        addVisualUsage(usages, `normal:${groupName}`, entry.file, groupName);
      }
    }
  }
  for (const [name, entry] of Object.entries((cfg && cfg.reactions) || {})) {
    if (!isPlainObject(entry)) continue;
    for (const key of ["file", "fileLeft", "fileRight"]) {
      if (typeof entry[key] === "string") {
        addVisualUsage(usages, `reaction:${name}`, entry[key], `reactions.${name}.${key}`);
      }
    }
    for (const file of Array.isArray(entry.files) ? entry.files : []) {
      addVisualUsage(usages, `reaction:${name}`, file, `reactions.${name}.files`);
    }
  }
  for (const [hint, file] of Object.entries((cfg && cfg.displayHintMap) || {})) {
    if (typeof file === "string") {
      addVisualUsage(usages, `display-hint:${hint}`, file, `displayHintMap.${hint}`);
    }
  }
  if (
    isPlainObject(cfg && cfg.updateVisuals)
    && typeof cfg.updateVisuals.checking === "string"
  ) {
    addVisualUsage(
      usages,
      "normal:update-checking",
      cfg.updateVisuals.checking,
      "updateVisuals.checking"
    );
  }
  if (
    isPlainObject(cfg && cfg.timings)
    && typeof cfg.timings.dndSleepTransitionSvg === "string"
  ) {
    addVisualUsage(
      usages,
      "dnd:sleep-transition",
      cfg.timings.dndSleepTransitionSvg,
      "timings.dndSleepTransitionSvg"
    );
  }
  const lowPower = cfg
    && cfg.rendering
    && cfg.rendering.lowPowerStaticImageOverrides;
  for (const [state, override] of Object.entries(lowPower || {})) {
    if (!isPlainObject(override)) continue;
    const isMiniState = state.startsWith("mini-");
    if (isMiniState && !isMiniSupported(cfg)) continue;
    const usageFamily = isMiniState ? "mini:" : "";
    if (typeof override.from === "string") {
      addVisualUsage(
        usages,
        `${usageFamily}low-power-source:${state}`,
        override.from,
        `rendering.lowPowerStaticImageOverrides.${state}.from`
      );
    }
    if (typeof override.to === "string") {
      addVisualUsage(
        usages,
        `${usageFamily}low-power-static:${state}`,
        override.to,
        `rendering.lowPowerStaticImageOverrides.${state}.to`
      );
    }
  }

  const rootViewBox = normalizeViewBox(cfg && cfg.viewBox);
  const miniViewBox = normalizeViewBox(cfg && cfg.miniMode && cfg.miniMode.viewBox);
  const fileViewBoxes = getCanonicalFileViewBoxes(cfg);
  return usages.map((usage) => {
    const fileViewBox = fileViewBoxes[usage.file];
    const isMini = usage.stateFamily.startsWith("mini:");
    const effectiveViewBox = fileViewBox || (isMini && miniViewBox) || rootViewBox;
    return {
      ...usage,
      effectiveViewBox: effectiveViewBox ? { ...effectiveViewBox } : null,
      viewBoxSource: fileViewBox ? "file" : (isMini && miniViewBox ? "mini" : "root"),
    };
  });
}

function hasOnlyKeys(value, allowed, pathName, errors) {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) errors.push(`${pathName}.${key} is not supported`);
  }
}

function normalizeAccessoryFrame(value, viewBox, pathName, errors, targetLocal = false) {
  if (!isPlainObject(value)) {
    errors.push(`${pathName} must be an object`);
    return null;
  }
  hasOnlyKeys(value, new Set(["cx", "baseY", "width"]), pathName, errors);
  const { cx, baseY, width } = value;
  if (![cx, baseY, width].every(Number.isFinite) || width <= 0) {
    errors.push(`${pathName} must contain finite cx/baseY and positive width`);
    return null;
  }
  if (targetLocal) {
    if (Math.abs(cx) > 1_000_000 || Math.abs(baseY) > 1_000_000 || width > 1_000_000) {
      errors.push(`${pathName} exceeds target-local numeric limits`);
      return null;
    }
  } else {
    if (!viewBox) {
      errors.push(`${pathName} cannot be validated without an effective viewBox`);
      return null;
    }
    if (
      width > 4 * viewBox.width
      || cx < viewBox.x - viewBox.width
      || cx > viewBox.x + 2 * viewBox.width
      || baseY < viewBox.y - viewBox.height
      || baseY > viewBox.y + 2 * viewBox.height
    ) {
      errors.push(`${pathName} exceeds effective viewBox bounds`);
      return null;
    }
  }
  return { cx, baseY, width };
}

function normalizeAccessoryFollowTarget(value, pathName, errors) {
  if (!isPlainObject(value)) {
    errors.push(`${pathName} must be an object`);
    return null;
  }
  hasOnlyKeys(value, new Set(["id", "frame"]), pathName, errors);
  if (
    typeof value.id !== "string"
    || !/^[A-Za-z_][A-Za-z0-9_.:-]{0,127}$/.test(value.id)
  ) {
    errors.push(`${pathName}.id must be a safe exact SVG id`);
  }
  const frame = normalizeAccessoryFrame(
    value.frame,
    null,
    `${pathName}.frame`,
    errors,
    true
  );
  if (
    typeof value.id !== "string"
    || !/^[A-Za-z_][A-Za-z0-9_.:-]{0,127}$/.test(value.id)
    || !frame
  ) {
    return null;
  }
  return { id: value.id, frame };
}

function normalizeAccessoryStaticSection(value, viewBox, pathName, errors) {
  if (!isPlainObject(value)) {
    errors.push(`${pathName} must be an object`);
    return null;
  }
  hasOnlyKeys(value, new Set(["staticFrame"]), pathName, errors);
  const staticFrame = normalizeAccessoryFrame(
    value.staticFrame,
    viewBox,
    `${pathName}.staticFrame`,
    errors
  );
  return staticFrame ? { staticFrame } : null;
}

function viewBoxKey(viewBox) {
  if (!viewBox) return "missing";
  return [viewBox.x, viewBox.y, viewBox.width, viewBox.height].join(",");
}

function normalizeAccessoryFileDescriptor(value, viewBox, pathName, errors) {
  if (!isPlainObject(value)) {
    errors.push(`${pathName} must be an object`);
    return null;
  }
  hasOnlyKeys(
    value,
    new Set(["visibility", "staticFrame", "followTarget"]),
    pathName,
    errors
  );
  if (value.visibility !== undefined) {
    if (value.visibility !== "hidden") {
      errors.push(`${pathName}.visibility must be "hidden"`);
      return null;
    }
    if (value.staticFrame !== undefined || value.followTarget !== undefined) {
      errors.push(`${pathName} hidden descriptors cannot define placement`);
      return null;
    }
    return { visibility: "hidden" };
  }
  const staticFrame = normalizeAccessoryFrame(
    value.staticFrame,
    viewBox,
    `${pathName}.staticFrame`,
    errors
  );
  const followTarget = value.followTarget === undefined
    ? null
    : normalizeAccessoryFollowTarget(
      value.followTarget,
      `${pathName}.followTarget`,
      errors
    );
  if (!staticFrame || (value.followTarget !== undefined && !followTarget)) return null;
  return followTarget ? { staticFrame, followTarget } : { staticFrame };
}

/**
 * Strictly normalize customization.accessories. Structural errors are
 * returned to validateTheme; coverage gaps are intentionally handled by
 * deriveAccessoryCapability so an otherwise valid theme can simply opt out.
 */
function normalizeAccessoryAttachments(value, cfg) {
  const errors = [];
  if (value === undefined || value === false || value === null) {
    return { value: null, errors };
  }
  if (!isPlainObject(value)) {
    return {
      value: null,
      errors: ["customization.accessories must be an object or false"],
    };
  }
  hasOnlyKeys(
    value,
    new Set(["default", "mini", "files"]),
    "customization.accessories",
    errors
  );

  const rootViewBox = normalizeViewBox(cfg && cfg.viewBox);
  const miniViewBox = normalizeViewBox(cfg && cfg.miniMode && cfg.miniMode.viewBox);
  const usages = projectThemeVisualUsages(cfg);
  const usagesByFile = new Map();
  for (const usage of usages) {
    const existing = usagesByFile.get(usage.file) || [];
    existing.push(usage);
    usagesByFile.set(usage.file, existing);
  }

  const normalized = { files: {} };
  if (value.default !== undefined) {
    const defaultSection = normalizeAccessoryStaticSection(
      value.default,
      rootViewBox,
      "customization.accessories.default",
      errors
    );
    if (defaultSection) normalized.default = defaultSection;
  }
  if (value.mini !== undefined) {
    const miniSection = normalizeAccessoryStaticSection(
      value.mini,
      miniViewBox,
      "customization.accessories.mini",
      errors
    );
    if (miniSection) normalized.mini = miniSection;
  }
  if (value.files !== undefined) {
    if (!isPlainObject(value.files)) {
      errors.push("customization.accessories.files must be an object map");
    } else {
      for (const [rawFile, descriptor] of Object.entries(value.files)) {
        const file = basenameOnly(rawFile);
        if (
          typeof rawFile !== "string"
          || rawFile !== file
          || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,254}$/.test(file)
        ) {
          errors.push(`customization.accessories.files["${rawFile}"] must be a safe basename`);
          continue;
        }
        const fileUsages = usagesByFile.get(file) || [];
        const uniqueViewBoxes = new Map();
        for (const usage of fileUsages) {
          uniqueViewBoxes.set(viewBoxKey(usage.effectiveViewBox), usage.effectiveViewBox);
        }
        if (uniqueViewBoxes.size > 1) {
          errors.push(`customization.accessories.files["${file}"] has multiple effective viewBoxes`);
          continue;
        }
        const effectiveViewBox = uniqueViewBoxes.size === 1
          ? [...uniqueViewBoxes.values()][0]
          : (getCanonicalFileViewBoxes(cfg)[file] || rootViewBox);
        const normalizedDescriptor = normalizeAccessoryFileDescriptor(
          descriptor,
          effectiveViewBox,
          `customization.accessories.files["${file}"]`,
          errors
        );
        if (normalizedDescriptor) normalized.files[file] = normalizedDescriptor;
      }
    }
  }
  return {
    value: errors.length === 0 ? normalized : null,
    errors,
  };
}

function deriveAccessoryCapability(cfg) {
  const parsed = normalizeAccessoryAttachments(
    cfg && cfg.customization && cfg.customization.accessories,
    cfg
  );
  if (parsed.errors.length > 0 || !parsed.value) return false;
  const attachments = parsed.value;
  const usages = projectThemeVisualUsages(cfg);
  if (usages.length === 0) return false;

  const usageFiles = new Set(usages.map((usage) => usage.file));
  for (const file of Object.keys(attachments.files)) {
    if (!usageFiles.has(file)) return false;
  }

  const viewBoxesByFile = new Map();
  for (const usage of usages) {
    const keys = viewBoxesByFile.get(usage.file) || new Set();
    keys.add(viewBoxKey(usage.effectiveViewBox));
    viewBoxesByFile.set(usage.file, keys);
  }
  if ([...viewBoxesByFile.values()].some((keys) => keys.size !== 1)) return false;

  for (const usage of usages) {
    if (!usage.effectiveViewBox) return false;
    const fileDescriptor = attachments.files[usage.file];
    if (fileDescriptor) {
      if (fileDescriptor.visibility === "hidden") continue;
      if (!fileDescriptor.staticFrame) return false;
      continue;
    }
    if (usage.viewBoxSource === "file") return false;
    if (usage.viewBoxSource === "mini") {
      if (!attachments.mini || !attachments.mini.staticFrame) return false;
      continue;
    }
    if (!attachments.default || !attachments.default.staticFrame) return false;
  }
  return true;
}

function buildCapabilities(cfg, options = {}) {
  const {
    normalizeMeritCultivator,
  } = require("./theme-progression");
  const meritCultivator = normalizeMeritCultivator(cfg, {
    isBuiltin: !!options.trustedRuntimeAllowed || !!options.isBuiltin,
  });
  return {
    eyeTracking: !!(
      isPlainObject(cfg && cfg.eyeTracking)
      && cfg.eyeTracking.enabled
      && hasNonEmptyArray(cfg.eyeTracking.states)
      && !renderBackends.disablesSvgCustomization(resolveThemeRenderBackend(cfg))
    ),
    miniMode: isMiniSupported(cfg),
    idleAnimations: hasNonEmptyArray(cfg && cfg.idleAnimations),
    reactions: hasReactionBindings(cfg && cfg.reactions),
    workingTiers: hasNonEmptyArray(cfg && cfg.workingTiers),
    jugglingTiers: hasNonEmptyArray(cfg && cfg.jugglingTiers),
    idleMode: deriveIdleMode(cfg),
    sleepMode: deriveSleepMode(cfg),
    powerProfile: derivePowerProfile(cfg, options),
    petTint: !!(
      isPlainObject(cfg && cfg.customization)
      && cfg.customization.petTint === true
      && !renderBackends.disablesSvgCustomization(resolveThemeRenderBackend(cfg))
    ),
    accessories: deriveAccessoryCapability(cfg),
    meritCultivator,
    renderBackend: resolveThemeRenderBackend(cfg),
  };
}

function addThemeAssetFile(out, filename) {
  const safe = basenameOnly(filename);
  if (safe) out.add(safe);
}

function collectRequiredAssetFiles(theme) {
  const files = new Set();
  const backend = resolveThemeRenderBackend(theme);
  // Sandbox themes render via package entry HTML/JS — state visual files are
  // state-machine placeholders and are not required assets.
  if (backend !== "sandbox") {
    for (const usage of projectThemeVisualUsages(theme)) {
      addThemeAssetFile(files, usage.file);
    }
  }
  if (theme && theme.rive && typeof theme.rive.file === "string") {
    addThemeAssetFile(files, theme.rive.file);
  }
  if (isPlainObject(theme && theme.meritCultivator) && Array.isArray(theme.meritCultivator.stages)) {
    const { collectProgressionAssetFiles } = require("./theme-progression");
    for (const file of collectProgressionAssetFiles(theme.meritCultivator.stages)) {
      addThemeAssetFile(files, file);
    }
  }
  return [...files];
}

function deepMergeObject(base, patch) {
  if (!isPlainObject(base)) return patch;
  const out = { ...base };
  for (const [k, v] of Object.entries(patch)) {
    if (isPlainObject(v) && isPlainObject(out[k])) {
      out[k] = deepMergeObject(out[k], v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

function basenameOnly(value) {
  return typeof value === "string" ? value.replace(/^.*[\/\\]/, "") : value;
}

function normalizeViewBox(value) {
  if (!isPlainObject(value)) return null;
  const { x, y, width, height } = value;
  if (![x, y, width, height].every(Number.isFinite) || width <= 0 || height <= 0) {
    return null;
  }
  return { x, y, width, height };
}

function normalizeTrustedRuntime(value, isBuiltin, themeId) {
  const out = { scriptedSvgFiles: [] };
  if (!isBuiltin) {
    if (value !== undefined) {
      console.warn(`[theme-loader] trustedRuntime ignored for non-builtin theme "${themeId}"`);
    }
    return out;
  }
  if (!isPlainObject(value) || !Array.isArray(value.scriptedSvgFiles)) {
    return out;
  }
  const seen = new Set();
  for (const file of value.scriptedSvgFiles) {
    if (typeof file !== "string") continue;
    const safeFile = basenameOnly(file);
    if (!safeFile || !safeFile.toLowerCase().endsWith(".svg") || seen.has(safeFile)) continue;
    seen.add(safeFile);
    out.scriptedSvgFiles.push(safeFile);
  }
  if (isPlainObject(value.scriptedSvgCycleMs)) {
    const cycleMap = {};
    for (const [file, ms] of Object.entries(value.scriptedSvgCycleMs)) {
      const safeFile = basenameOnly(file);
      if (!safeFile || !safeFile.toLowerCase().endsWith(".svg") || !seen.has(safeFile)) continue;
      if (!Number.isFinite(ms) || ms <= 0) continue;
      cycleMap[safeFile] = Math.round(ms);
    }
    if (Object.keys(cycleMap).length > 0) out.scriptedSvgCycleMs = cycleMap;
  }
  return out;
}

function normalizeRendering(value) {
  if (!isPlainObject(value)) return { svgChannel: "auto" };
  const lowPowerStaticImageOverrides = {};
  if (isPlainObject(value.lowPowerStaticImageOverrides)) {
    for (const [state, override] of Object.entries(value.lowPowerStaticImageOverrides)) {
      if (!isPlainObject(override)) continue;
      const from = basenameOnly(override.from);
      const to = basenameOnly(override.to);
      if (!state || !from || !to) continue;
      lowPowerStaticImageOverrides[state] = { from, to };
    }
  }
  const rendering = {
    svgChannel: value.svgChannel === "object" ? "object" : "auto",
  };
  if (Object.keys(lowPowerStaticImageOverrides).length > 0) {
    rendering.lowPowerStaticImageOverrides = lowPowerStaticImageOverrides;
  }
  return {
    ...rendering,
  };
}

function warnFileViewBoxDropped(rawKey, reason) {
  console.warn(`[theme-loader] fileViewBoxes["${rawKey}"] dropped: ${reason}`);
}

function normalizeFileViewBoxes(value) {
  const out = {};
  if (value == null) return out;
  if (!isPlainObject(value)) {
    console.warn("[theme-loader] fileViewBoxes dropped: expected object map");
    return out;
  }

  for (const [rawKey, viewBox] of Object.entries(value)) {
    const key = basenameOnly(rawKey);
    if (!key) {
      warnFileViewBoxDropped(rawKey, "invalid filename key");
      continue;
    }
    const normalized = normalizeViewBox(viewBox);
    if (!normalized) {
      warnFileViewBoxDropped(rawKey, "expected finite x/y/width/height with positive width/height");
      continue;
    }
    out[key] = normalized;
  }
  return out;
}

function warnFileHitBoxDropped(rawKey, reason) {
  console.warn(`[theme-loader] fileHitBoxes["${rawKey}"] dropped: ${reason}`);
}

function normalizeFileHitBoxes(value) {
  const out = {};
  if (value == null) return out;
  if (!isPlainObject(value)) {
    console.warn("[theme-loader] fileHitBoxes dropped: expected object map");
    return out;
  }

  for (const [rawKey, box] of Object.entries(value)) {
    const key = basenameOnly(rawKey);
    if (!key) {
      warnFileHitBoxDropped(rawKey, "invalid filename key");
      continue;
    }
    if (!isPlainObject(box)) {
      warnFileHitBoxDropped(rawKey, "expected object with finite x/y/w/h");
      continue;
    }
    const { x, y, w, h } = box;
    if (![x, y, w, h].every(Number.isFinite) || w <= 0 || h <= 0) {
      warnFileHitBoxDropped(rawKey, "missing/invalid x/y/w/h");
      continue;
    }
    out[key] = { x, y, w, h };
  }
  return out;
}

function mergeFileHitBoxes(base, patch) {
  return {
    ...normalizeFileHitBoxes(base),
    ...normalizeFileHitBoxes(patch),
  };
}

// Rive artboards are usually 256×256 (or similar), not the Clawd SVG crab
// coordinate system. Without an authored hitBoxes block, DEFAULT_HITBOXES
// collapses to a ~13×9px click island — the pet looks "stuck" and cannot be
// dragged. Prefer layout.contentBox, then the full viewBox.
function deriveContentBoxHitBox(theme) {
  const cb = theme && theme.layout && theme.layout.contentBox;
  if (
    cb
    && Number.isFinite(cb.x) && Number.isFinite(cb.y)
    && Number.isFinite(cb.width) && Number.isFinite(cb.height)
    && cb.width > 0 && cb.height > 0
  ) {
    return { x: cb.x, y: cb.y, w: cb.width, h: cb.height };
  }
  const vb = theme && theme.viewBox;
  if (
    vb
    && Number.isFinite(vb.x) && Number.isFinite(vb.y)
    && Number.isFinite(vb.width) && Number.isFinite(vb.height)
    && vb.width > 0 && vb.height > 0
  ) {
    return { x: vb.x, y: vb.y, w: vb.width, h: vb.height };
  }
  return null;
}

/** @deprecated prefer deriveContentBoxHitBox — kept for existing tests/callers */
function deriveRiveDefaultHitBox(theme) {
  return deriveContentBoxHitBox(theme);
}

function mergeDefaults(raw, themeId, isBuiltin) {
  const theme = { ...raw, _id: themeId, _builtin: !!isBuiltin };
  // NOTE: This preserves pre-A1 behavior: some nested values are shallow-copied
  // and basename normalization below can mutate caller-owned raw subobjects.
  // Clean this up separately after Round A2 stabilizes.

  // timings
  theme.timings = {
    ...DEFAULT_TIMINGS,
    ...(raw.timings || {}),
    minDisplay: { ...DEFAULT_TIMINGS.minDisplay, ...(raw.timings && raw.timings.minDisplay) },
    autoReturn: { ...DEFAULT_TIMINGS.autoReturn, ...(raw.timings && raw.timings.autoReturn) },
  };

  // hitBoxes (SVG defaults first; Rive without authored hitBoxes is rewritten
  // after layout/viewBox are known — see below).
  theme.hitBoxes = { ...DEFAULT_HITBOXES, ...(raw.hitBoxes || {}) };
  theme.fileHitBoxes = normalizeFileHitBoxes(raw.fileHitBoxes);
  // fileViewBoxes / miniMode.viewBox are layout metadata only and safe for external themes.
  theme.fileViewBoxes = normalizeFileViewBoxes(raw.fileViewBoxes);
  theme.wideHitboxFiles = raw.wideHitboxFiles || [];
  theme.sleepingHitboxFiles = raw.sleepingHitboxFiles || [];

  // trustedRuntime grants script execution capability, so it requires loader-derived built-in trust.
  theme.trustedRuntime = normalizeTrustedRuntime(raw.trustedRuntime, isBuiltin, themeId);
  theme.rendering = normalizeRendering(raw.rendering);
  theme.renderBackend = resolveThemeRenderBackend(raw);
  theme.rive = normalizeRiveConfig(raw.rive, { ...raw, renderBackend: theme.renderBackend });
  theme.sandbox = normalizeSandboxConfig(raw.sandbox, { ...raw, renderBackend: theme.renderBackend });
  // Rive / sandbox themes cannot use SVG eye-tracking / tint / accessories in v1.
  if (renderBackends.disablesSvgCustomization(theme.renderBackend)) {
    theme.eyeTracking = {
      ...DEFAULT_EYE_TRACKING,
      enabled: false,
      states: [],
    };
  }
  theme.customization = {
    petTint: !!(
      isPlainObject(raw.customization)
      && raw.customization.petTint === true
      && !renderBackends.disablesSvgCustomization(theme.renderBackend)
    ),
    accessories: null,
  };

  // objectScale
  theme.objectScale = { ...DEFAULT_OBJECT_SCALE, ...(raw.objectScale || {}) };
  {
    const vb = theme.viewBox || { width: 1, height: 1 };
    const aspect = (vb.width && vb.height) ? (vb.width / vb.height) : 1;
    const os = theme.objectScale;
    const derivedObjBottom = os.objBottom != null ? os.objBottom : (1 - os.offsetY - os.heightRatio);
    const rawOs = raw.objectScale || {};

    if (os.imgWidthRatio == null) {
      os.imgWidthRatio = Math.min(os.widthRatio, os.heightRatio * aspect);
    }
    if (rawOs.imgOffsetX == null) {
      os.imgOffsetX = os.offsetX + Math.max(0, (os.widthRatio - os.imgWidthRatio) / 2);
    }
    if (os.imgBottom == null) {
      const fittedHeightRatio = aspect > 0 ? (os.imgWidthRatio / aspect) : os.heightRatio;
      os.imgBottom = derivedObjBottom + Math.max(0, (os.heightRatio - fittedHeightRatio) / 2);
    }
  }

  // layout
  if (raw.layout && raw.layout.contentBox) {
    const cb = raw.layout.contentBox;
    theme.layout = {
      ...DEFAULT_LAYOUT,
      ...raw.layout,
      contentBox: { ...cb },
    };
    if (theme.layout.centerX == null) theme.layout.centerX = cb.x + cb.width / 2;
    if (theme.layout.baselineY == null) theme.layout.baselineY = cb.y + cb.height;
  } else {
    theme.layout = null;
  }

  // Rive / sandbox: replace clawd-sized DEFAULT_HITBOXES when the theme did not author any.
  if (renderBackends.usesDerivedHitBoxes(theme.renderBackend) && !isPlainObject(raw.hitBoxes)) {
    const derived = deriveContentBoxHitBox(theme);
    if (derived) {
      theme.hitBoxes = {
        default: { ...derived },
        sleeping: { ...derived },
        wide: { ...derived },
      };
    }
  }

  // eyeTracking (already forced off for rive/sandbox above)
  if (!renderBackends.disablesSvgCustomization(theme.renderBackend)) {
    theme.eyeTracking = { ...DEFAULT_EYE_TRACKING, ...(raw.eyeTracking || {}) };
    theme.eyeTracking.ids = {
      ...DEFAULT_EYE_TRACKING.ids,
      ...(raw.eyeTracking && raw.eyeTracking.ids || {}),
    };
  }

  theme.sleepSequence = { mode: deriveSleepMode(raw) };

  // Roam visuals are mirrored while walking left, assuming right-facing
  // artwork; themes whose roam asset is drawn facing left set this to invert
  // the mirror. Pure rendering flag — safe for external themes.
  theme.roamFlipAssets = !!raw.roamFlipAssets;

  // miniMode
  if (raw.miniMode) {
    theme.miniMode = {
      supported: true,
      offsetRatio: 0.486,
      ...raw.miniMode,
      viewBox: normalizeViewBox(raw.miniMode.viewBox),
      timings: {
        minDisplay: {},
        autoReturn: {},
        ...(raw.miniMode.timings || {}),
      },
      glyphFlips: raw.miniMode.glyphFlips || {},
    };
  } else {
    theme.miniMode = { supported: false, states: {}, viewBox: null, timings: { minDisplay: {}, autoReturn: {} }, glyphFlips: {} };
  }

  theme.customization.accessories = renderBackends.disablesSvgCustomization(theme.renderBackend)
    ? null
    : normalizeAccessoryAttachments(
      isPlainObject(raw.customization) ? raw.customization.accessories : undefined,
      theme
    ).value;

  // Merge mini timings into main timings for state.js convenience
  if (theme.miniMode.timings) {
    Object.assign(theme.timings.minDisplay, theme.miniMode.timings.minDisplay || {});
    Object.assign(theme.timings.autoReturn, theme.miniMode.timings.autoReturn || {});
  }

  // displayHintMap
  theme.displayHintMap = raw.displayHintMap || {};

  // sounds
  theme.sounds = { ...DEFAULT_SOUNDS, ...(raw.sounds || {}) };

  // stateSounds — optional per-state loop/cadence bindings (sound names only)
  theme.stateSounds = {};
  if (isPlainObject(raw.stateSounds)) {
    for (const [stateKey, entry] of Object.entries(raw.stateSounds)) {
      if (!stateKey || !isPlainObject(entry)) continue;
      if (typeof entry.sound !== "string" || !entry.sound) continue;
      const mode = entry.mode === undefined ? "loop" : entry.mode;
      if (!STATE_SOUND_MODES.has(mode)) continue;
      theme.stateSounds[stateKey] = { sound: entry.sound, mode };
    }
  }

  // reactions
  theme.reactions = raw.reactions || null;

  // workingTiers / jugglingTiers — auto sort descending by minSessions
  if (theme.workingTiers) {
    theme.workingTiers.sort((a, b) => b.minSessions - a.minSessions);
  }
  if (theme.jugglingTiers) {
    theme.jugglingTiers.sort((a, b) => b.minSessions - a.minSessions);
  }

  // idleAnimations
  theme.idleAnimations = raw.idleAnimations || [];

  // updater-specific visual bindings
  theme.updateVisuals = isPlainObject(raw.updateVisuals) ? { ...raw.updateVisuals } : {};
  theme.updateBubbleAnchorBox = isPlainObject(raw.updateBubbleAnchorBox)
    ? { ...raw.updateBubbleAnchorBox }
    : null;

  // Filename sanitization: basename all file references to prevent path traversal.
  const bn = basenameOnly;
  const normalizedStates = normalizeStateBindings(raw.states);
  theme.states = {};
  theme._stateBindings = {};
  for (const [stateKey, entry] of Object.entries(normalizedStates)) {
    const files = entry.files.map(bn);
    theme.states[stateKey] = files;
    theme._stateBindings[stateKey] = {
      files,
      fallbackTo: entry.fallbackTo || null,
    };
  }
  if (theme.miniMode && theme.miniMode.states) {
    for (const [s, files] of Object.entries(theme.miniMode.states)) {
      if (Array.isArray(files)) theme.miniMode.states[s] = files.map(bn);
    }
  }
  if (theme.reactions) {
    for (const r of Object.values(theme.reactions)) {
      if (r && r.file) r.file = bn(r.file);
      if (r && r.fileLeft) r.fileLeft = bn(r.fileLeft);
      if (r && r.fileRight) r.fileRight = bn(r.fileRight);
      if (r && Array.isArray(r.files)) r.files = r.files.map(bn);
    }
  }
  if (theme.sounds) {
    for (const [k, v] of Object.entries(theme.sounds)) {
      theme.sounds[k] = v == null ? null : bn(v);
    }
  }
  // stateSounds references logical sound names (not filenames) — no basename.
  if (theme.displayHintMap) {
    for (const [k, v] of Object.entries(theme.displayHintMap)) theme.displayHintMap[k] = bn(v);
  }
  if (theme.workingTiers) {
    for (const t of theme.workingTiers) { if (t.file) t.file = bn(t.file); }
  }
  if (theme.jugglingTiers) {
    for (const t of theme.jugglingTiers) { if (t.file) t.file = bn(t.file); }
  }
  if (Array.isArray(theme.idleAnimations)) {
    for (const a of theme.idleAnimations) { if (a && a.file) a.file = bn(a.file); }
  }
  if (theme.updateVisuals) {
    if (typeof theme.updateVisuals.checking === "string" && theme.updateVisuals.checking) {
      theme.updateVisuals.checking = bn(theme.updateVisuals.checking);
    } else {
      delete theme.updateVisuals.checking;
    }
  }
  if (
    theme.timings
    && typeof theme.timings.dndSleepTransitionSvg === "string"
    && theme.timings.dndSleepTransitionSvg
  ) {
    theme.timings.dndSleepTransitionSvg = bn(theme.timings.dndSleepTransitionSvg);
  }
  if (Array.isArray(theme.wideHitboxFiles)) theme.wideHitboxFiles = theme.wideHitboxFiles.map(bn);
  if (Array.isArray(theme.sleepingHitboxFiles)) theme.sleepingHitboxFiles = theme.sleepingHitboxFiles.map(bn);
  if (theme.rive && theme.rive.file) theme.rive.file = bn(theme.rive.file);
  if (theme.sandbox && theme.sandbox.entry) theme.sandbox.entry = bn(theme.sandbox.entry);

  return theme;
}

module.exports = {
  DEFAULT_SOUNDS,
  STATE_SOUND_MODES,
  DEFAULT_TIMINGS,
  DEFAULT_HITBOXES,
  DEFAULT_OBJECT_SCALE,
  DEFAULT_LAYOUT,
  DEFAULT_EYE_TRACKING,
  REQUIRED_STATES,
  FULL_SLEEP_REQUIRED_STATES,
  MINI_REQUIRED_STATES,
  VISUAL_FALLBACK_STATES,
  RENDER_BACKENDS,
  DEFAULT_RIVE_STATE_LEVELS,
  DEFAULT_RIVE_INPUTS,
  DEFAULT_RIVE_STATE_MACHINES,
  MAX_RIVE_FILE_BYTES,
  resolveThemeRenderBackend,
  normalizeRiveConfig,
  normalizeSandboxConfig,
  deriveContentBoxHitBox,
  deriveRiveDefaultHitBox,
  validateTheme,
  mergeDefaults,
  isPlainObject,
  hasNonEmptyArray,
  getStateBindingEntry,
  getStateFiles,
  hasStateFiles,
  hasStateBinding,
  normalizeStateBindings,
  hasReactionBindings,
  supportsIdleTracking,
  deriveIdleMode,
  deriveSleepMode,
  buildCapabilities,
  projectThemeVisualUsages,
  normalizeAccessoryAttachments,
  deriveAccessoryCapability,
  collectRequiredAssetFiles,
  deepMergeObject,
  basenameOnly,
  normalizeViewBox,
  normalizeTrustedRuntime,
  normalizeRendering,
  normalizeFileViewBoxes,
  normalizeFileHitBoxes,
  mergeFileHitBoxes,
};
