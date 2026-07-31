#!/usr/bin/env node
"use strict";

/**
 * Copy @rive-app/canvas-single into src/vendor and ensure the demo .riv exists.
 * Usage: npm run vendor:rive
 */

const path = require("path");
const fs = require("fs");
const https = require("https");
const http = require("http");

const ROOT = path.join(__dirname, "..");
const SRC = path.join(ROOT, "node_modules", "@rive-app", "canvas-single", "rive.js");
const DEST_DIR = path.join(ROOT, "src", "vendor");
const DEST = path.join(DEST_DIR, "rive.js");
const LICENSE = path.join(DEST_DIR, "RIVE-LICENSE");
const DEMO_DIR = path.join(ROOT, "assets", "source", "rive");
const DEMO = path.join(DEMO_DIR, "demo.riv");
const SKILLS = path.join(DEMO_DIR, "skills.riv");
// Prefer skills.riv (interactive Level SM). Fallback URL is vehicles if missing.
const DEMO_URL = "https://cdn.rive.app/animations/vehicles.riv";
const SKILLS_URL = "https://github.com/rive-app/rive-flutter/raw/master/example/assets/skills.riv";

if (!fs.existsSync(SRC)) {
  console.error("missing", SRC);
  console.error("run: npm install --save-dev @rive-app/canvas-single");
  process.exit(1);
}

fs.mkdirSync(DEST_DIR, { recursive: true });
fs.copyFileSync(SRC, DEST);
console.log("copied", path.relative(ROOT, DEST));

if (!fs.existsSync(LICENSE)) {
  fs.writeFileSync(LICENSE, `MIT License

Copyright (c) Rive

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

Source package: @rive-app/canvas-single (https://github.com/rive-app/rive-wasm)
`, "utf8");
  console.log("wrote", path.relative(ROOT, LICENSE));
}

fs.mkdirSync(DEMO_DIR, { recursive: true });

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith("https") ? https : http;
    const req = lib.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        download(res.headers.location, dest).then(resolve, reject);
        return;
      }
      if (res.statusCode !== 200) {
        reject(new Error("HTTP " + res.statusCode + " for " + url));
        res.resume();
        return;
      }
      const out = fs.createWriteStream(dest);
      res.pipe(out);
      out.on("finish", () => out.close(() => resolve()));
      out.on("error", reject);
    });
    req.on("error", reject);
  });
}

(async () => {
  if (fs.existsSync(SKILLS) && fs.statSync(SKILLS).size > 1000) {
    fs.copyFileSync(SKILLS, DEMO);
    console.log("demo.riv <- skills.riv");
    return;
  }
  if (fs.existsSync(DEMO) && fs.statSync(DEMO).size > 1000) {
    console.log("demo already present:", path.relative(ROOT, DEMO));
    return;
  }
  try {
    await download(SKILLS_URL, SKILLS);
    fs.copyFileSync(SKILLS, DEMO);
    console.log("downloaded skills -> demo.riv");
  } catch (err) {
    console.warn("skills download failed, falling back to vehicles:", err && err.message);
    await download(DEMO_URL, DEMO);
    console.log("downloaded", path.relative(ROOT, DEMO), "from", DEMO_URL);
  }
})().catch((err) => {
  console.error("failed to ensure demo.riv:", err && err.message ? err.message : err);
  process.exit(1);
});
