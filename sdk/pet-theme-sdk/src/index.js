"use strict";

const { createBridge, create } = require("./bridge");

module.exports = {
  createBridge,
  create,
};

// Browser / clawd-pet:// bundle entry (no CommonJS).
if (typeof globalThis !== "undefined") {
  globalThis.ClawdPetSdk = { createBridge, create };
}
