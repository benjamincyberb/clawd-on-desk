"use strict";

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const themeLoader = require("../src/theme-loader");
const { resolveSandboxThemeRoot } = require("../src/theme-assets-cache");

describe("sandbox theme loader assets", () => {
  let tmpRoot;
  let themeDir;
  let cacheDir;

  before(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "clawd-sandbox-theme-"));
    themeDir = path.join(tmpRoot, "themes", "orbit");
    cacheDir = path.join(tmpRoot, "theme-cache");
    fs.mkdirSync(path.join(themeDir, "vendor"), { recursive: true });
    fs.writeFileSync(path.join(themeDir, "theme.json"), JSON.stringify({
      schemaVersion: 1,
      name: "Orbit",
      version: "1.0.0",
      renderBackend: "sandbox",
      sandbox: { entry: "index.html", engine: "phaser", network: false },
      viewBox: { x: 0, y: 0, width: 256, height: 256 },
      layout: {
        contentBox: { x: 48, y: 32, width: 160, height: 192 },
        centerX: 128,
        baselineY: 224,
        visibleHeightRatio: 0.75,
        baselineBottomRatio: 0.05,
      },
      eyeTracking: { enabled: false },
      sleepSequence: { mode: "direct" },
      states: {
        idle: ["_sandbox"],
        thinking: ["_sandbox"],
        working: ["_sandbox"],
        sleeping: { fallbackTo: "idle" },
      },
    }, null, 2));
    fs.writeFileSync(path.join(themeDir, "index.html"), "<!doctype html><title>x</title>");
    fs.writeFileSync(path.join(themeDir, "main.js"), "console.log('ok');");
    fs.writeFileSync(path.join(themeDir, "vendor", "phaser.min.js"), "/* phaser */");
    fs.writeFileSync(path.join(themeDir, "evil.sh"), "#!/bin/sh\necho no");
    fs.writeFileSync(path.join(themeDir, "notes.txt"), "ignored");
  });

  after(() => {
    try { fs.rmSync(tmpRoot, { recursive: true, force: true }); } catch { /* ignore */ }
  });

  it("resolveSandboxThemeRoot copies allowlisted files and skips .sh/.txt", () => {
    const root = resolveSandboxThemeRoot("orbit", themeDir, { themeCacheDir: cacheDir });
    assert.ok(fs.existsSync(path.join(root, "index.html")));
    assert.ok(fs.existsSync(path.join(root, "main.js")));
    assert.ok(fs.existsSync(path.join(root, "vendor", "phaser.min.js")));
    assert.ok(!fs.existsSync(path.join(root, "evil.sh")));
    assert.ok(!fs.existsSync(path.join(root, "notes.txt")));
  });

  it("theme-loader loads sandbox theme and points protocol root at cache", () => {
    themeLoader.init(path.join(__dirname, "..", "src"), tmpRoot);
    // Point user themes at our fixture by loading via mergeDefaults path —
    // loadTheme needs the theme under userThemesDir which init set to tmpRoot/themes.
    const theme = themeLoader.loadTheme("orbit", { strict: true });
    assert.strictEqual(theme.renderBackend, "sandbox");
    assert.strictEqual(theme.sandbox.entry, "index.html");
    assert.ok(theme._sandboxRoot);
    assert.ok(theme._sandboxRoot.includes("theme-cache"));
    assert.ok(fs.existsSync(path.join(theme._sandboxRoot, "index.html")));
    assert.ok(!fs.existsSync(path.join(theme._sandboxRoot, "evil.sh")));
  });
});
