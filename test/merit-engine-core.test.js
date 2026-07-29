"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert");
const core = require("../src/merit-engine-core");
const {
  normalizeMeritCultivator,
  resolveStage,
  applyProgressionVisuals,
} = require("../src/theme-progression");

const STAGES = [
  { id: "mortal", requiredMerit: 0, name: { en: "Mortal", zh: "凡人" }, visuals: null },
  {
    id: "adept",
    requiredMerit: 1000,
    name: { en: "Adept", zh: "修行者" },
    visuals: { states: { thinking: ["adept-knock.svg"] } },
  },
];

const PARAMS = {
  meritPerSec: 1,
  completionMerit: 50,
  errorMerit: 5,
  maxMeritPerSec: 1,
  minEventCooldownMs: 1000,
  dailyBonus: 100,
  streakDays: 7,
  streakBonus: 500,
  dailyCap: 10000,
};

describe("merit-engine-core", () => {
  it("accrues thinking seconds with rate cap and daily cap", () => {
    const base = core.createEmptyProgress();
    const result = core.accrueSeconds(base, 10, PARAMS, STAGES, { dayKey: "2026-07-26" });
    assert.strictEqual(result.granted, 10);
    assert.strictEqual(result.progress.merit, 10);
    assert.strictEqual(result.progress.dailyEarned, 10);

    const capped = core.accrueSeconds(
      { ...result.progress, dailyEarned: 9995 },
      20,
      PARAMS,
      STAGES,
      { dayKey: "2026-07-26" }
    );
    assert.strictEqual(capped.granted, 5);
    assert.strictEqual(capped.progress.dailyEarned, 10000);
  });

  it("concurrent productive sessions still award global 1/s when called once", () => {
    // Runtime decides productive once; core accrues once per tick.
    const result = core.accrueSeconds(core.createEmptyProgress(), 10, PARAMS, STAGES, {
      dayKey: "2026-07-26",
    });
    assert.strictEqual(result.granted, 10);
  });

  it("awards completion and error separately without double completion", () => {
    let progress = core.createEmptyProgress();
    const done = core.applyCompletion(progress, PARAMS, STAGES, { dayKey: "2026-07-26" });
    assert.strictEqual(done.granted, 50);
    progress = done.progress;
    const fail = core.applyError(progress, PARAMS, STAGES, { dayKey: "2026-07-26" });
    assert.strictEqual(fail.granted, 5);
    assert.strictEqual(fail.progress.merit, 55);
  });

  it("daily bonus and streak bonus fire on first productive day transitions", () => {
    let progress = core.createEmptyProgress();
    const day1 = core.applyDailyOnProductive(progress, PARAMS, STAGES, { dayKey: "2026-07-20" });
    assert.ok(day1.awards.some((a) => a.type === "dailyBonus" && a.amount === 100));
    assert.strictEqual(day1.progress.streakDays, 1);
    progress = day1.progress;

    for (let i = 1; i < 6; i++) {
      const dayKey = `2026-07-${20 + i}`;
      const next = core.applyDailyOnProductive(progress, PARAMS, STAGES, { dayKey });
      progress = next.progress;
    }
    assert.strictEqual(progress.streakDays, 6);

    const day7 = core.applyDailyOnProductive(progress, PARAMS, STAGES, { dayKey: "2026-07-26" });
    assert.strictEqual(day7.progress.streakDays, 7);
    assert.ok(day7.awards.some((a) => a.type === "streakBonus" && a.amount === 500));
    assert.ok(day7.awards.some((a) => a.type === "dailyBonus"));

    const sameDay = core.applyDailyOnProductive(day7.progress, PARAMS, STAGES, {
      dayKey: "2026-07-26",
    });
    assert.strictEqual(sameDay.granted, 0);
  });

  it("breaks streak after a missed day", () => {
    const progress = {
      ...core.createEmptyProgress(),
      lastActiveDayKey: "2026-07-20",
      streakDays: 4,
    };
    const next = core.applyDailyOnProductive(progress, PARAMS, STAGES, { dayKey: "2026-07-22" });
    assert.strictEqual(next.progress.streakDays, 1);
  });

  it("detects stage crossing at the threshold edge once", () => {
    const before = { ...core.createEmptyProgress(), merit: 999, dayKey: "2026-07-26", dailyEarned: 999 };
    const result = core.accrueSeconds(before, 1, PARAMS, STAGES, { dayKey: "2026-07-26" });
    assert.strictEqual(result.progress.merit, 1000);
    assert.strictEqual(result.stageChanged, true);
    assert.strictEqual(result.previousStage.id, "mortal");
    assert.strictEqual(result.nextStage.id, "adept");

    const again = core.accrueSeconds(result.progress, 1, PARAMS, STAGES, { dayKey: "2026-07-26" });
    assert.strictEqual(again.stageChanged, false);
    assert.strictEqual(again.nextStage.id, "adept");
  });

  it("buildStatus derives stage from merit only", () => {
    const status = core.buildStatus({ merit: 1000 }, STAGES);
    assert.strictEqual(status.stageId, "adept");
    const mortal = core.buildStatus({ merit: 2 }, STAGES);
    assert.strictEqual(mortal.stageId, "mortal");
  });

  it("clamps non-finite merit and resets while preserving introSeen", () => {
    const bad = core.normalizeProgress({ merit: Infinity, streakDays: -3, introSeen: true });
    assert.strictEqual(bad.merit, 0);
    assert.strictEqual(bad.streakDays, 0);
    const reset = core.resetProgress(bad);
    assert.strictEqual(reset.merit, 0);
    assert.strictEqual(reset.introSeen, true);
  });

  it("classifies snapshot sessions for productive / completion / error awards", () => {
    assert.strictEqual(core.isProductiveSession({
      state: "working",
      headless: false,
      hiddenFromHud: false,
    }), true);
    assert.strictEqual(core.isProductiveSession({
      state: "working",
      headless: true,
    }), false);
    assert.strictEqual(core.isCompletionAward({
      badge: "done",
      headless: false,
      lastEvent: { rawEvent: "Stop", at: 1 },
    }), true);
    assert.strictEqual(core.isCompletionAward({
      badge: "done",
      headless: false,
      lastEvent: { rawEvent: "PostCompact", at: 1 },
    }), false);
    assert.strictEqual(core.isErrorAward({
      headless: false,
      lastEvent: { rawEvent: "PostToolUseFailure", at: 2 },
    }), true);
    assert.strictEqual(
      core.eventDedupeKey({ id: "s1", lastEvent: { rawEvent: "Stop", at: 42 } }),
      "s1:Stop:42"
    );
  });
});

describe("theme-progression", () => {
  it("enables meritCultivator only for builtin themes with valid stages", () => {
    const raw = {
      meritCultivator: {
        enabled: true,
        params: { completionMerit: 50 },
        stages: [
          { id: "mortal", requiredMerit: 0, name: { zh: "凡人" } },
          { id: "adept", requiredMerit: 1000, name: { zh: "修行者" }, visuals: { states: { idle: ["a.svg"] } } },
        ],
      },
    };
    const ok = normalizeMeritCultivator(raw, { isBuiltin: true });
    assert.strictEqual(ok.enabled, true);
    assert.strictEqual(ok.stages.length, 2);

    const external = normalizeMeritCultivator(raw, { isBuiltin: false });
    assert.strictEqual(external.enabled, false);

    const bad = normalizeMeritCultivator({
      meritCultivator: {
        enabled: true,
        stages: [
          { id: "mortal", requiredMerit: 10 },
          { id: "adept", requiredMerit: 5 },
        ],
      },
    }, { isBuiltin: true });
    assert.strictEqual(bad.enabled, false);
  });

  it("applies stage visuals after base states without mutating reserved fields", () => {
    const raw = {
      states: {
        idle: ["mortal-idle.svg"],
        thinking: ["mortal-knock.svg"],
        working: ["mortal-chant.svg"],
      },
      eyeTracking: { enabled: true },
    };
    const stage = resolveStage(1000, STAGES);
    const patched = applyProgressionVisuals(raw, stage);
    assert.deepStrictEqual(patched.states.thinking, ["adept-knock.svg"]);
    assert.deepStrictEqual(patched.states.idle, ["mortal-idle.svg"]);
    assert.strictEqual(patched.eyeTracking.enabled, true);
    assert.deepStrictEqual(raw.states.thinking, ["mortal-knock.svg"]);
  });
});
