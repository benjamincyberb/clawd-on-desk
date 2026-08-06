"use strict";

const { createBridge } = require("./bridge");
const { createPerformanceHelpers } = require("./performance");
const { svgToTextureHint } = require("./assets");

function create(api) {
  const bridge = createBridge(api);
  const perf = createPerformanceHelpers(bridge);
  return {
    ...bridge,
    ...perf,
    svgToTextureHint,
  };
}

module.exports = {
  create,
  createBridge,
  createPerformanceHelpers,
  svgToTextureHint,
};
