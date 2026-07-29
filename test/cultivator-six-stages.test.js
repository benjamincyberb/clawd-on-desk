"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const themeLoader = require("../src/theme-loader");
const {
  normalizeMeritCultivator,
  resolveStage,
  resolveProgressionStageFromBucket,
  applyMeritStageToTheme,
  collectProgressionAssetFiles,
} = require("../src/theme-progression");
const {
  generateAll,
  fileName,
  OUT_DIR,
  MANIFEST_PATH,
} = require("../scripts/generate-cultivator-assets");

const REPO_ROOT = path.join(__dirname, "..");
const CULTIVATOR_THEME_JSON = path.join(REPO_ROOT, "themes", "cultivator", "theme.json");
const TEST_THRESHOLDS = [
  { merit: 0, id: "mortal" },
  { merit: 4, id: "mortal" },
  { merit: 5, id: "adept" },
  { merit: 49, id: "adept" },
  { merit: 50, id: "novice" },
  { merit: 149, id: "novice" },
  { merit: 150, id: "arhat" },
  { merit: 299, id: "arhat" },
  { merit: 300, id: "bodhisattva" },
  { merit: 388, id: "bodhisattva" },
  { merit: 499, id: "bodhisattva" },
  { merit: 500, id: "buddha" },
  { merit: 9999, id: "buddha" },
];

describe("cultivator six-stage progression", () => {
  const raw = JSON.parse(fs.readFileSync(CULTIVATOR_THEME_JSON, "utf8"));
  const cap = normalizeMeritCultivator(raw, { isBuiltin: true });
  const stages = cap.stages;

  it("theme.json defines six monotonic test-scaled stages", () => {
    assert.equal(cap.enabled, true);
    assert.equal(stages.length, 6);
    assert.deepEqual(stages.map((s) => s.id), [
      "mortal", "adept", "novice", "arhat", "bodhisattva", "buddha",
    ]);
    assert.deepEqual(stages.map((s) => s.requiredMerit), [0, 5, 50, 150, 300, 500]);
  });

  it("forces object SVG channel so CSS knock/halo animations play", () => {
    // eyeTracking is off; without object channel Chromium freezes CSS @keyframes in <img>.
    assert.equal(raw.eyeTracking && raw.eyeTracking.enabled, false);
    assert.equal(raw.rendering && raw.rendering.svgChannel, "object");
    themeLoader.init(path.join(REPO_ROOT, "src"), path.join(REPO_ROOT, ".tmp-userdata"));
    themeLoader.bindActiveThemeRuntime(null);
    const theme = themeLoader.loadTheme("cultivator", { progressionStageId: "arhat" });
    assert.equal(theme.rendering.svgChannel, "object");
  });

  it("resolves merit thresholds including 388 bodhisattva and 500 buddha", () => {
    for (const { merit, id } of TEST_THRESHOLDS) {
      assert.equal(resolveStage(merit, stages).id, id, `merit ${merit} should be ${id}`);
    }
    assert.equal(
      resolveProgressionStageFromBucket({ merit: 388 }, stages),
      "bodhisattva"
    );
    assert.equal(
      resolveProgressionStageFromBucket({ merit: 500 }, stages),
      "buddha"
    );
  });

  it("generated assets match manifest and theme references", () => {
    const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
    const generated = generateAll(manifest);
    assert.equal(generated.size, 36);

    for (const [name] of generated) {
      const onDisk = path.join(OUT_DIR, name);
      assert.ok(fs.existsSync(onDisk), `missing asset ${name}`);
    }

    const progressionFiles = collectProgressionAssetFiles(stages);
    for (const file of progressionFiles) {
      assert.ok(
        fs.existsSync(path.join(OUT_DIR, file)),
        `missing progression asset ${file}`
      );
    }
  });

  it("loader builds six merit stage profiles and switches without reload", () => {
    themeLoader.init(path.join(REPO_ROOT, "src"), path.join(REPO_ROOT, ".tmp-userdata"));
    themeLoader.bindActiveThemeRuntime(null);

    const theme = themeLoader.loadTheme("cultivator", { progressionStageId: "mortal" });
    assert.ok(theme._meritStageProfiles);
    assert.equal(Object.keys(theme._meritStageProfiles).length, 6);

    assert.equal(applyMeritStageToTheme(theme, "bodhisattva"), true);
    assert.equal(theme._meritStageId, "bodhisattva");
    assert.ok(theme.states.idle[0].includes("bodhisattva-idle"));
    assert.ok(theme.workingTiers[0].file.includes("bodhisattva-working"));

    assert.equal(applyMeritStageToTheme(theme, "buddha"), true);
    assert.ok(theme.states.idle[0].includes("buddha-idle"));
    assert.ok(theme.workingTiers[0].file.includes("buddha-working"));
  });

  it("each stage idle/working asset is AI sprite with CSS motion", () => {
    for (const stageId of ["mortal", "adept", "novice", "arhat", "bodhisattva", "buddha"]) {
      const idle = fs.readFileSync(path.join(OUT_DIR, fileName(stageId, "idle")), "utf8");
      const working = fs.readFileSync(path.join(OUT_DIR, fileName(stageId, "working")), "utf8");
      assert.ok(idle.includes("data:image/png"), `${stageId}-idle should embed AI PNG`);
      assert.ok(idle.includes("@keyframes"), `${stageId}-idle must include CSS animation`);
      assert.ok(idle.includes("sprite-js"), `${stageId}-idle must animate sprite group`);
      assert.ok(working.includes("data:image/png"), `${stageId}-working should embed AI frame PNGs`);
      assert.ok(working.includes("@keyframes") || working.includes("<animate"), `${stageId}-working must animate`);
      assert.ok(!working.includes("woodfish-js"), `${stageId}-working should not use separate woodfish overlay`);
      assert.ok(!working.includes("torso-knock"), `${stageId}-working should not use continuous torso-knock`);
      if (stageId === "buddha") {
        assert.ok(working.includes("no-knock") || working.includes("万佛朝圣"), `${stageId}-working is no-knock`);
        assert.ok(!working.includes("knock-frame-1"), `${stageId}-working must not use knock frames`);
        continue;
      }
      assert.ok(working.includes("knock-frames"), `${stageId}-working must use full AI frame stack`);
      assert.ok(working.includes("knock-frame-1"), `${stageId}-working must include knock-frame-1`);
      assert.ok(working.includes("knock-frame-6"), `${stageId}-working must include knock-frame-6`);
      assert.ok(working.includes('<animate attributeName="opacity"'), `${stageId}-working must use SMIL frame cuts`);
      assert.ok(working.includes("linear"), `${stageId}-working must use linear discrete frame cuts`);
      assert.ok(!working.includes("step-end"), `${stageId}-working should not use step-end (blank-gap risk)`);
    }
  });

  it("each stage idle asset is visually distinct from mortal", () => {
    const mortalIdle = fs.readFileSync(path.join(OUT_DIR, fileName("mortal", "idle")), "utf8");
    for (const stageId of ["adept", "novice", "arhat", "bodhisattva", "buddha"]) {
      const content = fs.readFileSync(path.join(OUT_DIR, fileName(stageId, "idle")), "utf8");
      assert.notEqual(content, mortalIdle, `${stageId}-idle should differ from mortal-idle`);
    }
  });
});
