// --- Generic Rive input bindings (pure, UMD) ---
// The Rive renderer is theme-agnostic: it knows nothing about any specific
// .riv file, input name, or character. Every theme declares, in its
// theme.json, how Clawd's runtime signals (agent state / hover / pointer /
// click) drive its own state-machine inputs. This module turns that
// declaration + a runtime context into a flat list of input operations that
// the renderer applies by EXACT input name. No regex, no name guessing, no
// per-theme branches.
//
// Declarative form (theme.json → rive.bindings), keyed by exact input name:
//
//   "bindings": {
//     "istracking": { "from": "hover" },
//     "Strenght":   { "from": "state", "map": { "idle": 0, "thinking": 50, "working": 100 }, "default": 0 },
//     "numLook":    { "from": "pointerX", "range": [0, 100], "default": 50 },
//     "isHandsUp":  { "from": "stateIn", "states": ["working", "juggling"] },
//     "Blink":      { "on": { "click": true } },
//     "trigSuccess":{ "on": { "enterStates": ["attention", "notification"], "click": true } }
//   }
//
// Sources:
//   from:"hover"     → boolean, true when the pointer hovers the pet
//   from:"stateIn"   → boolean, true when the current agent state is in `states`
//   from:"pointerX"  → number, pointer X mapped through `range` (default [0,100])
//   from:"pointerY"  → number, pointer Y mapped through `range`
//   from:"state"     → number, `map[state]` (falls back to `default`, else 0)
//   from:"constant"  → number or boolean `value`
//   on:{...}         → trigger; fires on `click` and/or when entering `enterStates`
//
// Legacy form (rive.inputs + rive.stateLevels) is adapted into the same model
// so older themes keep working without change.

"use strict";

(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  if (root) root.RiveBindings = api;
})(typeof self !== "undefined" ? self : this, function () {
  function isPlainObject(v) {
    return !!v && typeof v === "object" && !Array.isArray(v);
  }

  function asStringList(v) {
    if (typeof v === "string") return v.trim() ? [v.trim()] : [];
    if (!Array.isArray(v)) return [];
    const out = [];
    for (const item of v) {
      if (typeof item === "string" && item.trim()) out.push(item.trim());
    }
    return out;
  }

  // Normalize one raw binding entry for a given input name. Returns null when
  // the entry is unusable (unknown source and no trigger config).
  function normalizeEntry(input, raw) {
    const name = typeof input === "string" ? input.trim() : "";
    if (!name || !isPlainObject(raw)) return null;

    if (isPlainObject(raw.on)) {
      const enterStates = asStringList(raw.on.enterStates || raw.on.states);
      const click = raw.on.click === true;
      if (!enterStates.length && !click) return null;
      return { input: name, kind: "trigger", enterStates, click };
    }

    const from = typeof raw.from === "string" ? raw.from.trim() : "";
    switch (from) {
      case "hover":
        return { input: name, kind: "bool", source: "hover" };
      case "stateIn": {
        const states = asStringList(raw.states);
        if (!states.length) return null;
        return { input: name, kind: "bool", source: "stateIn", states };
      }
      case "constant": {
        if (typeof raw.value === "boolean") {
          return { input: name, kind: "bool", source: "constant", value: raw.value };
        }
        if (Number.isFinite(raw.value)) {
          return { input: name, kind: "number", source: "constant", value: Number(raw.value) };
        }
        return null;
      }
      case "state": {
        const map = isPlainObject(raw.map) ? raw.map : {};
        const def = Number.isFinite(raw.default) ? Number(raw.default) : 0;
        return { input: name, kind: "number", source: "state", map, default: def };
      }
      case "pointerX":
      case "pointerY": {
        const range = Array.isArray(raw.range)
          && Number.isFinite(raw.range[0]) && Number.isFinite(raw.range[1])
          ? [Number(raw.range[0]), Number(raw.range[1])]
          : [0, 100];
        const hasDefault = Number.isFinite(raw.default);
        return {
          input: name,
          kind: "number",
          source: from,
          range,
          default: hasDefault ? Number(raw.default) : (range[0] + range[1]) / 2,
        };
      }
      default:
        return null;
    }
  }

  // Accept bindings as an object keyed by input name, or an array of
  // { input, ... } entries.
  function normalizeExplicitBindings(bindings) {
    const out = [];
    if (Array.isArray(bindings)) {
      for (const raw of bindings) {
        if (!isPlainObject(raw)) continue;
        const entry = normalizeEntry(raw.input, raw);
        if (entry) out.push(entry);
      }
    } else if (isPlainObject(bindings)) {
      for (const key of Object.keys(bindings)) {
        const entry = normalizeEntry(key, bindings[key]);
        if (entry) out.push(entry);
      }
    }
    return out;
  }

  // Adapt the legacy { inputs:{level,hover,bump}, stateLevels:{...} } shape into
  // the declarative model so existing themes keep working untouched.
  function adaptLegacy(riveCfg) {
    const out = [];
    const inputs = isPlainObject(riveCfg.inputs) ? riveCfg.inputs : {};
    const stateLevels = isPlainObject(riveCfg.stateLevels) ? riveCfg.stateLevels : {};

    if (typeof inputs.hover === "string" && inputs.hover.trim()) {
      out.push({ input: inputs.hover.trim(), kind: "bool", source: "hover" });
    }
    if (typeof inputs.level === "string" && inputs.level.trim()) {
      const map = {};
      for (const key of Object.keys(stateLevels)) {
        if (Number.isFinite(stateLevels[key])) map[key] = Number(stateLevels[key]);
      }
      out.push({ input: inputs.level.trim(), kind: "number", source: "state", map, default: 0 });
    }
    if (typeof inputs.bump === "string" && inputs.bump.trim()) {
      out.push({ input: inputs.bump.trim(), kind: "trigger", enterStates: [], click: true });
    }
    return out;
  }

  // Public: resolve a theme's rive config into a canonical bindings array.
  // Explicit `bindings` win; otherwise fall back to the legacy adapter.
  function normalizeRiveBindings(riveCfg) {
    if (!isPlainObject(riveCfg)) return [];
    const explicit = normalizeExplicitBindings(riveCfg.bindings);
    if (explicit.length) return explicit;
    return adaptLegacy(riveCfg);
  }

  function clamp01(n) {
    if (!Number.isFinite(n)) return null;
    return n < 0 ? 0 : n > 1 ? 1 : n;
  }

  function scaleRange(p01, range, fallback) {
    if (p01 == null) return fallback;
    const lo = range[0];
    const hi = range[1];
    return lo + p01 * (hi - lo);
  }

  // Public: given canonical bindings and a runtime context, return the flat
  // list of ops the renderer should apply.
  //
  // ctx = {
  //   cause: "state" | "pointer" | "click" | "init",
  //   state: <agent state string>,
  //   hover: <bool>,
  //   pointerX01: <0..1 | null>,   pointerY01: <0..1 | null>,
  // }
  //
  // Returns: [{ input, kind:"bool", set:<bool> }
  //          | { input, kind:"number", set:<number> }
  //          | { input, kind:"trigger", fire:true }]
  //
  // Bool/number ops are idempotent and always emitted (safe to re-apply).
  // Trigger ops are only emitted when the cause matches their config.
  function computeInputOps(bindings, ctx) {
    const list = Array.isArray(bindings) ? bindings : [];
    const c = isPlainObject(ctx) ? ctx : {};
    const cause = typeof c.cause === "string" ? c.cause : "state";
    const state = typeof c.state === "string" ? c.state : "idle";
    const hover = !!c.hover;
    const px = clamp01(c.pointerX01);
    const py = clamp01(c.pointerY01);
    const ops = [];

    for (const b of list) {
      if (!b || typeof b.input !== "string") continue;
      if (b.kind === "trigger") {
        let fire = false;
        if (cause === "click" && b.click) fire = true;
        else if (cause === "state" && Array.isArray(b.enterStates) && b.enterStates.includes(state)) fire = true;
        if (fire) ops.push({ input: b.input, kind: "trigger", fire: true });
        continue;
      }
      if (b.kind === "bool") {
        let val = false;
        if (b.source === "hover") val = hover;
        else if (b.source === "stateIn") val = Array.isArray(b.states) && b.states.includes(state);
        else if (b.source === "constant") val = !!b.value;
        ops.push({ input: b.input, kind: "bool", set: val });
        continue;
      }
      if (b.kind === "number") {
        let val = 0;
        if (b.source === "state") {
          val = Number.isFinite(b.map && b.map[state]) ? Number(b.map[state]) : b.default;
        } else if (b.source === "pointerX") {
          val = scaleRange(px, b.range, b.default);
        } else if (b.source === "pointerY") {
          val = scaleRange(py, b.range, b.default);
        } else if (b.source === "constant") {
          val = b.value;
        }
        if (Number.isFinite(val)) ops.push({ input: b.input, kind: "number", set: Number(val) });
        continue;
      }
    }
    return ops;
  }

  return {
    normalizeRiveBindings,
    computeInputOps,
    _normalizeEntry: normalizeEntry,
    _adaptLegacy: adaptLegacy,
  };
});
