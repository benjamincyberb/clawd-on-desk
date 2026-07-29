"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const themeLoader = require("../src/theme-loader");
const {
  normalizeMeritCultivator,
  resolveStage,
  resolveProgressionStageFromBucket,
  previewMeritForStage,
  applyProgressionVisuals,
  applyMeritStageToTheme,
  buildMeritStageProfiles,
  collectProgressionAssetFiles,
} = require("../src/theme-progression");

function baseTheme(extra = {}) {
  return {
    schemaVersion: 1,
    name: "Cultivator Test",
    version: "1.0.0",
    viewBox: { x: 0, y: 0, width: 16, height: 16 },
    sleepSequence: { mode: "direct" },
    states: {
      idle: ["mortal-idle.svg"],
      thinking: ["mortal-thinking.svg"],
      working: ["mortal-working.svg"],
      sleeping: ["mortal-sleeping.svg"],
    },
    ...extra,
  };
}

const twoStages = [
  { id: "mortal", requiredMerit: 0, name: { en: "Mortal" } },
  {
    id: "adept",
    requiredMerit: 1000,
    name: { en: "Adept" },
    visuals: {
      states: { idle: ["adept-idle.svg"], working: ["adept-working.svg"] },
      workingTiers: [{ minSessions: 1, file: "adept-working.svg" }],
    },
  },
];

describe("theme-progression", () => {
  it("derives stage from merit thresholds", () => {
    assert.equal(resolveStage(0, twoStages).id, "mortal");
    assert.equal(resolveStage(999, twoStages).id, "mortal");
    assert.equal(resolveStage(1000, twoStages).id, "adept");
    assert.equal(resolveStage(5000, twoStages).id, "adept");
  });

  it("derives progression stage id from merit bucket", () => {
    assert.equal(
      resolveProgressionStageFromBucket({ merit: 2 }, twoStages),
      "mortal"
    );
    assert.equal(
      resolveProgressionStageFromBucket({ merit: 1500 }, twoStages),
      "adept"
    );
    assert.equal(
      resolveProgressionStageFromBucket({ merit: 1500, debugStageId: "mortal" }, twoStages),
      "mortal"
    );
  });

  it("previewMeritForStage lands in the middle of a stage band", () => {
    assert.equal(previewMeritForStage("mortal", twoStages), 500);
    assert.equal(previewMeritForStage("adept", twoStages), 1000);
  });

  it("resolves six-stage test thresholds from cultivator theme", () => {
    const raw = JSON.parse(fs.readFileSync(
      path.join(__dirname, "..", "themes", "cultivator", "theme.json"),
      "utf8"
    ));
    const cap = normalizeMeritCultivator(raw, { isBuiltin: true });
    const stages = cap.stages;
    assert.equal(resolveStage(388, stages).id, "bodhisattva");
    assert.equal(resolveStage(500, stages).id, "buddha");
  });

  it("rejects non-monotonic or duplicate stage configs", () => {
    const badDup = normalizeMeritCultivator({
      meritCultivator: {
        enabled: true,
        stages: [
          { id: "a", requiredMerit: 0 },
          { id: "a", requiredMerit: 10 },
        ],
      },
    }, { isBuiltin: true });
    assert.equal(badDup.enabled, false);

    const badOrder = normalizeMeritCultivator({
      meritCultivator: {
        enabled: true,
        stages: [
          { id: "a", requiredMerit: 0 },
          { id: "b", requiredMerit: 0 },
        ],
      },
    }, { isBuiltin: true });
    assert.equal(badOrder.enabled, false);
  });

  it("ignores meritCultivator on external themes", () => {
    const cap = normalizeMeritCultivator({
      meritCultivator: { enabled: true, stages: twoStages },
    }, { isBuiltin: false });
    assert.equal(cap.enabled, false);
  });

  it("applies stage visuals after base states", () => {
    const raw = baseTheme();
    const patched = applyProgressionVisuals(raw, twoStages[1]);
    assert.deepEqual(patched.states.idle, ["adept-idle.svg"]);
    assert.deepEqual(patched.states.thinking, ["mortal-thinking.svg"]);
    assert.equal(patched.workingTiers[0].file, "adept-working.svg");
  });

  it("collects progression asset files", () => {
    const files = [...collectProgressionAssetFiles(twoStages)];
    assert.ok(files.includes("adept-idle.svg"));
    assert.ok(files.includes("adept-working.svg"));
  });

  it("loader applies progression before user overrides", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "clawd-progression-"));
    const appDir = path.join(tmp, "src");
    const userData = path.join(tmp, "userData");
    const themeDir = path.join(tmp, "themes", "cultivator");
    const assetsDir = path.join(themeDir, "assets");
    fs.mkdirSync(appDir, { recursive: true });
    fs.mkdirSync(assetsDir, { recursive: true });
    for (const file of [
      "mortal-idle.svg",
      "mortal-thinking.svg",
      "mortal-working.svg",
      "mortal-sleeping.svg",
      "adept-idle.svg",
      "adept-working.svg",
      "user-idle.svg",
    ]) {
      fs.writeFileSync(path.join(assetsDir, file), "<svg></svg>");
    }
    fs.writeFileSync(path.join(themeDir, "theme.json"), JSON.stringify(baseTheme({
      meritCultivator: { enabled: true, stages: twoStages },
    })));

    themeLoader.init(appDir, userData);
    themeLoader.bindActiveThemeRuntime(null);

    const adept = themeLoader.loadTheme("cultivator", {
      progressionStageId: "adept",
      overrides: {
        states: { idle: { file: "user-idle.svg" } },
      },
    });
    assert.equal(adept._builtin, true);
    assert.equal(adept._progressionStageId, "adept");
    assert.equal(adept._capabilities.meritCultivator.enabled, true);
    const idleFiles = Array.isArray(adept.states.idle)
      ? adept.states.idle
      : (adept.states.idle && adept.states.idle.files) || [];
    assert.ok(idleFiles.some((f) => String(f).includes("user-idle")));

    const mortal = themeLoader.loadTheme("cultivator", { progressionStageId: "mortal" });
    const mortalIdle = Array.isArray(mortal.states.idle)
      ? mortal.states.idle
      : (mortal.states.idle && mortal.states.idle.files) || [];
    assert.ok(mortalIdle.some((f) => String(f).includes("mortal-idle")));
  });

  it("applies merit stage visuals in-memory without reload", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "clawd-merit-stage-"));
    const appDir = path.join(tmp, "src");
    const userData = path.join(tmp, "userData");
    const themeDir = path.join(tmp, "themes", "cultivator");
    const assetsDir = path.join(themeDir, "assets");
    fs.mkdirSync(appDir, { recursive: true });
    fs.mkdirSync(assetsDir, { recursive: true });
    for (const file of [
      "mortal-idle.svg",
      "mortal-working.svg",
      "adept-idle.svg",
      "adept-working.svg",
    ]) {
      fs.writeFileSync(path.join(assetsDir, file), "<svg></svg>");
    }
    fs.writeFileSync(path.join(themeDir, "theme.json"), JSON.stringify(baseTheme({
      meritCultivator: { enabled: true, stages: twoStages },
    })));

    themeLoader.init(appDir, userData);
    themeLoader.bindActiveThemeRuntime(null);

    const mortal = themeLoader.loadTheme("cultivator", { progressionStageId: "mortal" });
    assert.ok(mortal._meritStageProfiles);
    assert.equal(mortal._meritStageId, "mortal");
    assert.ok(mortal.states.working[0].includes("mortal-working"));

    const switched = applyMeritStageToTheme(mortal, "adept");
    assert.equal(switched, true);
    assert.equal(mortal._meritStageId, "adept");
    assert.ok(mortal.states.working[0].includes("adept-working"));

    const again = applyMeritStageToTheme(mortal, "adept");
    assert.equal(again, false);
  });
});
