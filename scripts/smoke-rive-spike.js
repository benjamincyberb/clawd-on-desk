#!/usr/bin/env node
"use strict";

/**
 * Headless-ish smoke for the Rive adaptation demo.
 * Spawns Electron with a tiny harness that loads the same vendor stack as
 * src/index-rive.html (canvas-single + vehicles.riv state machine).
 *
 * Usage: node scripts/smoke-rive-spike.js
 * Exit 0 on Rive boot + state machine inputs; non-zero on failure.
 */

const path = require("path");
const fs = require("fs");
const { spawn } = require("child_process");

const ROOT = path.join(__dirname, "..");
const electronInstall = require("./verify-electron-install").verifyElectronInstall({
  context: "smoke-rive-spike",
});
if (!electronInstall.ok) {
  console.error(require("./verify-electron-install").formatElectronInstallFailure(electronInstall));
  process.exit(1);
}

const electronBin = require("electron");
const harnessPath = path.join(ROOT, "scripts", "_rive-spike-smoke-main.js");

const required = [
  "src/vendor/rive.js",
  "src/rive-renderer.js",
  "src/index-rive.html",
  "assets/source/rive/demo.riv",
];
for (const rel of required) {
  if (!fs.existsSync(path.join(ROOT, rel))) {
    console.error("missing required file:", rel);
    process.exit(1);
  }
}

const child = spawn(electronBin, [harnessPath], {
  cwd: ROOT,
  env: { ...process.env, ELECTRON_RUN_AS_NODE: undefined },
  stdio: ["ignore", "pipe", "pipe"],
});

let out = "";
let timedOut = false;
const timer = setTimeout(() => {
  timedOut = true;
  child.kill("SIGTERM");
}, 20000);

child.stdout.on("data", (buf) => { out += buf.toString(); process.stdout.write(buf); });
child.stderr.on("data", (buf) => { out += buf.toString(); process.stderr.write(buf); });

child.on("close", (code) => {
  clearTimeout(timer);
  if (timedOut) {
    console.error("smoke-rive-spike: timeout");
    process.exit(1);
  }
  const ok = /SMOKE_RIVE_OK/.test(out);
  if (!ok) {
    console.error("smoke-rive-spike: missing SMOKE_RIVE_OK marker");
    process.exit(code || 1);
  }
  process.exit(0);
});
