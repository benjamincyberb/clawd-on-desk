"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert");

const backends = require("../src/render-backends");
const schema = require("../src/theme-schema");

describe("render-backends registry", () => {
  it("exposes theme and runtime backend lists including sandbox", () => {
    assert.ok(backends.THEME_RENDER_BACKENDS.includes("svg"));
    assert.ok(backends.THEME_RENDER_BACKENDS.includes("rive"));
    assert.ok(backends.THEME_RENDER_BACKENDS.includes("sandbox"));
    assert.ok(backends.RUNTIME_RENDER_BACKENDS.includes("pixi"));
    assert.ok(backends.RUNTIME_RENDER_BACKENDS.includes("phaser"));
    assert.ok(backends.RUNTIME_RENDER_BACKENDS.includes("sandbox"));
    assert.ok(backends.RENDER_BACKENDS.has("sandbox"));
  });

  it("matches theme-schema resolveThemeRenderBackend for svg/rive/sandbox", () => {
    const cases = [
      { renderBackend: "svg" },
      { renderBackend: "rive", rive: { file: "a.riv" } },
      { renderBackend: "sandbox", sandbox: { entry: "index.html" } },
      { rive: { file: "hero.riv" } },
      { sandbox: { entry: "pet.html" } },
      {},
    ];
    for (const raw of cases) {
      assert.strictEqual(
        backends.resolveThemeRenderBackend(raw),
        schema.resolveThemeRenderBackend(raw),
        JSON.stringify(raw)
      );
    }
  });

  it("applies env spikes in resolveRuntimeRenderBackend", () => {
    assert.strictEqual(
      backends.resolveRuntimeRenderBackend({ renderBackend: "svg" }, { CLAWD_RENDER_BACKEND: "phaser" }),
      "phaser"
    );
    assert.strictEqual(
      backends.resolveRuntimeRenderBackend({ renderBackend: "svg" }, { CLAWD_RIVE_SPIKE: "1" }),
      "rive"
    );
    assert.strictEqual(
      backends.resolveRuntimeRenderBackend({ renderBackend: "sandbox", sandbox: { entry: "index.html" } }, {}),
      "sandbox"
    );
  });

  it("resolves trusted entry files and sandbox null entry", () => {
    assert.strictEqual(backends.resolveTrustedEntryFile("svg"), "index.html");
    assert.strictEqual(backends.resolveTrustedEntryFile("rive"), "index-rive.html");
    assert.strictEqual(backends.resolveTrustedEntryFile("pixi"), "index-pixi.html");
    assert.strictEqual(backends.resolveTrustedEntryFile("phaser"), "index-phaser.html");
    assert.strictEqual(backends.resolveTrustedEntryFile("sandbox"), null);
  });

  it("flags cursor stream / derived hitboxes / svg customization", () => {
    assert.strictEqual(backends.needsCursorStream("sandbox"), true);
    assert.strictEqual(backends.needsCursorStream("rive"), true);
    assert.strictEqual(backends.needsCursorStream("svg"), false);
    assert.strictEqual(backends.usesDerivedHitBoxes("sandbox"), true);
    assert.strictEqual(backends.disablesSvgCustomization("sandbox"), true);
    assert.strictEqual(backends.isSandboxBackend("sandbox"), true);
  });

  it("allowlists sandbox asset paths", () => {
    assert.strictEqual(backends.isAllowedSandboxAssetPath("index.html"), true);
    assert.strictEqual(backends.isAllowedSandboxAssetPath("vendor/phaser.min.js"), true);
    assert.strictEqual(backends.isAllowedSandboxAssetPath("../etc/passwd"), false);
    assert.strictEqual(backends.isAllowedSandboxAssetPath("evil.sh"), false);
    assert.strictEqual(backends.isAllowedSandboxAssetPath("/abs/path.js"), false);
  });
});
