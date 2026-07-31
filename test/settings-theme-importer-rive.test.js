"use strict";

const { describe, it, afterEach } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const { importUserThemeZip } = require("../src/settings-theme-importer");

const cleanupDirs = [];

function makeTmpDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "clawd-rive-import-"));
  cleanupDirs.push(dir);
  return dir;
}

afterEach(() => {
  while (cleanupDirs.length) {
    fs.rmSync(cleanupDirs.pop(), { recursive: true, force: true });
  }
});

describe("settings-theme-importer rive packages", () => {
  it("imports a rive theme zip and flags renderBackend", () => {
    const root = makeTmpDir();
    const userThemesDir = path.join(root, "themes");
    const pkgDir = path.join(root, "rive-pet");
    fs.mkdirSync(path.join(pkgDir, "assets"), { recursive: true });
    const themeJson = {
      schemaVersion: 1,
      name: "Rive Import",
      version: "1.0.0",
      renderBackend: "rive",
      rive: { file: "pet.riv" },
      viewBox: { x: 0, y: 0, width: 64, height: 64 },
      eyeTracking: { enabled: false },
      sleepSequence: { mode: "direct" },
      states: {
        idle: ["pet.riv"],
        thinking: ["pet.riv"],
        working: ["pet.riv"],
        sleeping: { fallbackTo: "idle" },
      },
    };
    fs.writeFileSync(path.join(pkgDir, "theme.json"), JSON.stringify(themeJson, null, 2));
    fs.writeFileSync(path.join(pkgDir, "assets", "pet.riv"), Buffer.alloc(64, 7));
    const zipPath = path.join(root, "rive-pet.zip");
    execFileSync("zip", ["-r", zipPath, "rive-pet"], { cwd: root });

    const result = importUserThemeZip(zipPath, { userThemesDir });
    assert.strictEqual(result.status, "ok");
    assert.strictEqual(result.themeId, "rive-pet");
    assert.strictEqual(result.renderBackend, "rive");
    assert.strictEqual(result.rive, true);
    assert.ok(fs.existsSync(path.join(userThemesDir, "rive-pet", "assets", "pet.riv")));
  });
});
