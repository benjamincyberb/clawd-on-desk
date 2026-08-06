"use strict";

/**
 * Asset-layer hints for engines that rasterize SVG into textures.
 * The host serves package files via clawd-game:; loaders stay engine-side.
 */
function svgToTextureHint(relPath, opts = {}) {
  const path = typeof relPath === "string" ? relPath.replace(/^\.\//, "") : "";
  const scale = Number.isFinite(opts.scale) ? opts.scale : 1;
  return {
    kind: "svg",
    path,
    scale,
    // Suggested max edge for GPU budget in official templates
    maxEdge: Number.isFinite(opts.maxEdge) ? opts.maxEdge : 1024,
  };
}

module.exports = { svgToTextureHint };
