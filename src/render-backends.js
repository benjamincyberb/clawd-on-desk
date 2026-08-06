"use strict";

/**
 * Single registry for desk-pet render backends.
 * Theme authors pick svg / rive / sandbox via theme.json.
 * pixi / phaser remain env-only trusted spikes (CLAWD_*_SPIKE / CLAWD_RENDER_BACKEND).
 */

const THEME_RENDER_BACKENDS = Object.freeze(["svg", "rive", "sandbox"]);
const RUNTIME_RENDER_BACKENDS = Object.freeze(["svg", "rive", "pixi", "phaser", "sandbox"]);
const THEME_RENDER_BACKEND_SET = new Set(THEME_RENDER_BACKENDS);
const RUNTIME_RENDER_BACKEND_SET = new Set(RUNTIME_RENDER_BACKENDS);

/** @deprecated use THEME_RENDER_BACKENDS — kept as Set for theme-schema callers */
const RENDER_BACKENDS = THEME_RENDER_BACKEND_SET;

const TRUSTED_ENTRY_FILES = Object.freeze({
  svg: "index.html",
  rive: "index-rive.html",
  pixi: "index-pixi.html",
  phaser: "index-phaser.html",
});

const SANDBOX_ENGINES = Object.freeze(["phaser", "pixi", "custom"]);
const SANDBOX_ENGINE_SET = new Set(SANDBOX_ENGINES);
const SANDBOX_ASSET_EXTENSIONS = Object.freeze([
  ".html", ".js", ".css",
  ".png", ".webp", ".jpg", ".jpeg", ".gif",
  ".json", ".atlas", ".wasm",
  ".woff", ".woff2",
]);
const SANDBOX_ASSET_EXT_SET = new Set(SANDBOX_ASSET_EXTENSIONS);

function isPlainObject(v) {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function isThemeRenderBackend(name) {
  return THEME_RENDER_BACKEND_SET.has(name);
}

function isRuntimeRenderBackend(name) {
  return RUNTIME_RENDER_BACKEND_SET.has(name);
}

function isSandboxEngine(name) {
  return SANDBOX_ENGINE_SET.has(name);
}

function isAllowedSandboxAssetPath(relPath) {
  if (typeof relPath !== "string" || !relPath) return false;
  const normalized = relPath.replace(/\\/g, "/");
  if (!normalized || normalized.includes("..") || normalized.startsWith("/")) return false;
  const base = normalized.split("/").pop() || "";
  const dot = base.lastIndexOf(".");
  if (dot < 0) return false;
  return SANDBOX_ASSET_EXT_SET.has(base.slice(dot).toLowerCase());
}

/**
 * Resolve the theme-authored backend from theme.json (or merged theme).
 * Env spikes are NOT applied here — use resolveRuntimeRenderBackend for windows.
 */
function resolveThemeRenderBackend(themeOrRaw) {
  if (!themeOrRaw || typeof themeOrRaw !== "object") return "svg";
  const explicit = typeof themeOrRaw.renderBackend === "string"
    ? themeOrRaw.renderBackend.trim().toLowerCase()
    : "";
  if (explicit === "sandbox") return "sandbox";
  if (explicit === "rive") return "rive";
  if (explicit === "svg" || explicit === "pixi" || explicit === "phaser") return "svg";
  if (
    isPlainObject(themeOrRaw.sandbox)
    && typeof themeOrRaw.sandbox.entry === "string"
    && themeOrRaw.sandbox.entry.trim()
  ) {
    return "sandbox";
  }
  if (
    isPlainObject(themeOrRaw.rive)
    && typeof themeOrRaw.rive.file === "string"
    && themeOrRaw.rive.file
  ) {
    return "rive";
  }
  const idle = themeOrRaw.states && themeOrRaw.states.idle;
  const idleFiles = Array.isArray(idle)
    ? idle
    : (idle && Array.isArray(idle.files) ? idle.files : []);
  if (idleFiles.some((f) => typeof f === "string" && f.toLowerCase().endsWith(".riv"))) {
    return "rive";
  }
  return "svg";
}

/**
 * Runtime backend for the pet render window: env spikes override theme.
 */
function resolveRuntimeRenderBackend(theme, env = process.env) {
  const explicit = String((env && env.CLAWD_RENDER_BACKEND) || "").trim().toLowerCase();
  if (RUNTIME_RENDER_BACKEND_SET.has(explicit)) return explicit;
  if (env && env.CLAWD_RIVE_SPIKE === "1") return "rive";
  if (env && env.CLAWD_PIXI_SPIKE === "1") return "pixi";
  if (env && env.CLAWD_PHASER_SPIKE === "1") return "phaser";
  return resolveThemeRenderBackend(theme);
}

function resolveTrustedEntryFile(backend) {
  if (backend === "sandbox") return null;
  return TRUSTED_ENTRY_FILES[backend] || TRUSTED_ENTRY_FILES.svg;
}

function needsCursorStream(backend) {
  return backend === "pixi"
    || backend === "rive"
    || backend === "phaser"
    || backend === "sandbox";
}

function usesDerivedHitBoxes(backend) {
  return backend === "rive" || backend === "sandbox";
}

function disablesSvgCustomization(backend) {
  return backend === "rive" || backend === "sandbox";
}

function isSandboxBackend(backend) {
  return backend === "sandbox";
}

module.exports = {
  THEME_RENDER_BACKENDS,
  RUNTIME_RENDER_BACKENDS,
  RENDER_BACKENDS,
  TRUSTED_ENTRY_FILES,
  SANDBOX_ENGINES,
  SANDBOX_ASSET_EXTENSIONS,
  isThemeRenderBackend,
  isRuntimeRenderBackend,
  isSandboxEngine,
  isAllowedSandboxAssetPath,
  resolveThemeRenderBackend,
  resolveRuntimeRenderBackend,
  resolveTrustedEntryFile,
  needsCursorStream,
  usesDerivedHitBoxes,
  disablesSvgCustomization,
  isSandboxBackend,
};
