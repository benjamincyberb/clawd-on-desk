"use strict";

const { describe, it, beforeEach, afterEach, mock } = require("node:test");
const assert = require("node:assert");
const path = require("path");
const themeLoader = require("../src/theme-loader");
const { createMeritEngine } = require("../src/merit-engine");
const { normalizeMeritCultivator } = require("../src/theme-progression");

themeLoader.init(path.join(__dirname, "..", "src"));
const theme = themeLoader.loadTheme("clawd");

function flush() {
  return new Promise((resolve) => setImmediate(resolve));
}

function makeCtx(overrides = {}) {
  return {
    lang: "en",
    theme,
    doNotDisturb: false,
    miniTransitioning: false,
    miniMode: false,
    mouseOverPet: false,
    idlePaused: false,
    forceEyeResend: false,
    eyePauseUntil: 0,
    mouseStillSince: Date.now(),
    miniSleepPeeked: false,
    playSound: () => {},
    sendToRenderer: () => {},
    syncHitWin: () => {},
    sendToHitWin: () => {},
    miniPeekIn: () => {},
    miniPeekOut: () => {},
    buildContextMenu: () => {},
    buildTrayMenu: () => {},
    pendingPermissions: [],
    resolvePermissionEntry: () => {},
    processKill: () => true,
    getCursorScreenPoint: () => ({ x: 0, y: 0 }),
    ...overrides,
  };
}

const CAPABILITY = normalizeMeritCultivator({
  meritCultivator: {
    enabled: true,
    params: {
      meritPerSec: 1,
      completionMerit: 50,
      errorMerit: 5,
      maxMeritPerSec: 1,
      minEventCooldownMs: 1000,
      dailyBonus: 100,
      streakDays: 7,
      streakBonus: 500,
      dailyCap: 10000,
    },
    stages: [
      { id: "mortal", requiredMerit: 0, name: { en: "Mortal" } },
      { id: "adept", requiredMerit: 1000, name: { en: "Adept" } },
    ],
  },
}, { isBuiltin: true });

describe("merit-engine snapshot runtime", () => {
  let flushes;
  let awards;
  let levelUps;
  let engine;
  let savedDebounceEnv;

  beforeEach(() => {
    mock.timers.enable({ apis: ["setTimeout", "setInterval", "Date"] });
    savedDebounceEnv = process.env.CLAWD_COMPLETION_DEBOUNCE_MS;
    process.env.CLAWD_COMPLETION_DEBOUNCE_MS = "1000";
    flushes = [];
    awards = [];
    levelUps = [];
    engine = createMeritEngine({
      now: () => Date.now(),
      setInterval,
      clearInterval,
      flushIntervalMs: 30_000,
      onFlush: (themeId, progress) => flushes.push({ themeId, progress }),
      onAward: (award) => awards.push(award),
      onLevelUp: (payload) => levelUps.push(payload),
      onNeedStage: async () => {},
    });
    engine.setThemeActive("cultivator", CAPABILITY, null);
  });

  afterEach(() => {
    engine.cleanup();
    mock.timers.reset();
    if (savedDebounceEnv === undefined) delete process.env.CLAWD_COMPLETION_DEBOUNCE_MS;
    else process.env.CLAWD_COMPLETION_DEBOUNCE_MS = savedDebounceEnv;
  });

  it("awards global 1/s for productive sessions and does not multiply concurrent sessions", () => {
    engine.onSnapshot({
      sessions: [
        { id: "a", state: "working", headless: false, hiddenFromHud: false },
        { id: "b", state: "thinking", headless: false, hiddenFromHud: false },
      ],
    });
    for (let i = 0; i < 10; i++) mock.timers.tick(1000);
    assert.strictEqual(engine.getProgress().merit, 110); // 100 daily + 10 thinking
    assert.ok(awards.some((a) => a.type === "dailyBonus"));
  });

  it("awards completion once for Stop badge=done and ignores duplicate snapshots", () => {
    const snapshot = {
      sessions: [{
        id: "s1",
        state: "idle",
        badge: "done",
        headless: false,
        lastEvent: { rawEvent: "Stop", at: 100 },
      }],
    };
    engine.onSnapshot(snapshot);
    engine.onSnapshot(snapshot);
    assert.strictEqual(engine.getProgress().merit, 150); // daily 100 + completion 50
    assert.strictEqual(awards.filter((a) => a.type === "completion").length, 1);
  });

  it("awards error without completion for PostToolUseFailure", () => {
    engine.onSnapshot({
      sessions: [{
        id: "s1",
        state: "idle",
        badge: "interrupted",
        headless: false,
        lastEvent: { rawEvent: "PostToolUseFailure", at: 200 },
      }],
    });
    assert.strictEqual(engine.getProgress().merit, 105); // daily 100 + error 5
    assert.strictEqual(awards.filter((a) => a.type === "completion").length, 0);
  });

  it("ignores PostCompact and does not treat it as completion", () => {
    engine.onSnapshot({
      sessions: [{
        id: "s1",
        state: "idle",
        badge: "idle",
        headless: false,
        lastEvent: { rawEvent: "PostCompact", at: 300 },
      }],
    });
    assert.strictEqual(engine.getProgress().merit, 0);
  });

  it("pauses accrual under DND and resumes without backfill", () => {
    engine.onSnapshot({
      sessions: [{ id: "a", state: "working", headless: false, hiddenFromHud: false }],
    });
    for (let i = 0; i < 2; i++) mock.timers.tick(1000);
    const before = engine.getProgress().merit;
    engine.setDnd(true);
    for (let i = 0; i < 5; i++) mock.timers.tick(1000);
    assert.strictEqual(engine.getProgress().merit, before);
    engine.setDnd(false);
    engine.onSnapshot({
      sessions: [{ id: "a", state: "working", headless: false, hiddenFromHud: false }],
    });
    mock.timers.tick(1000);
    assert.strictEqual(engine.getProgress().merit, before + 1);
  });

  it("continues accrual while session is visible-hiddenFromHud=false even if headless is false", () => {
    engine.onSnapshot({
      sessions: [{ id: "a", state: "working", headless: false, hiddenFromHud: false }],
    });
    for (let i = 0; i < 3; i++) mock.timers.tick(1000);
    assert.ok(engine.getProgress().merit >= 103);
  });

  it("excludes headless productive sessions from continuous accrual", () => {
    engine.onSnapshot({
      sessions: [{ id: "a", state: "working", headless: true, hiddenFromHud: false }],
    });
    mock.timers.tick(5000);
    assert.strictEqual(engine.getProgress().merit, 0);
  });

  it("integrates with state.js completion debounce: held Stop does not award until promote", async () => {
    const api = require("../src/state")(makeCtx({
      broadcastSessionSnapshot: (snapshot) => engine.onSnapshot(snapshot),
    }));
    try {
      api.updateSession("s1", "attention", "Stop", {
        agentId: "claude-code",
        assistantLastOutput: "done",
      });
      await flush();
      assert.strictEqual(
        awards.filter((a) => a.type === "completion").length,
        0,
        "held Stop must not award completion"
      );
      mock.timers.tick(1000);
      await flush();
      assert.strictEqual(
        awards.filter((a) => a.type === "completion").length,
        1,
        "promote awards completion once"
      );
    } finally {
      api.cleanup();
    }
  });

  it("does not flush every second during continuous accrual", () => {
    engine.onSnapshot({
      sessions: [{ id: "a", state: "working", headless: false, hiddenFromHud: false }],
    });
    // daily bonus flushes immediately once
    const afterDaily = flushes.length;
    assert.ok(afterDaily >= 1);
    for (let i = 0; i < 10; i++) mock.timers.tick(1000);
    assert.strictEqual(flushes.length, afterDaily, "thinking ticks must not flush each second");
  });

  it("crosses stage threshold once and requests stage visuals", async () => {
    engine.setThemeActive("cultivator", CAPABILITY, {
      merit: 999,
      dayKey: "2026-07-26",
      dailyEarned: 999,
      lastActiveDayKey: "2026-07-26",
      streakDays: 1,
      introSeen: true,
    });
    engine.onSnapshot({
      sessions: [{ id: "a", state: "working", headless: false, hiddenFromHud: false }],
    });
    mock.timers.tick(1000);
    await flush();
    assert.strictEqual(levelUps.length, 1);
    assert.strictEqual(levelUps[0].nextStage.id, "adept");
    mock.timers.tick(1000);
    await flush();
    assert.strictEqual(levelUps.length, 1);
  });

  it("refreshThemeContext keeps live merit when prefs bucket lags", () => {
    engine.setThemeActive("cultivator", CAPABILITY, {
      merit: 5,
      dayKey: "2026-07-26",
      dailyEarned: 5,
      lastActiveDayKey: "2026-07-26",
      streakDays: 1,
      introSeen: true,
    });
    engine.refreshThemeContext("cultivator", CAPABILITY, {
      merit: 0,
      dayKey: "2026-07-26",
      dailyEarned: 0,
      lastActiveDayKey: "2026-07-26",
      streakDays: 1,
      introSeen: true,
    });
    assert.strictEqual(engine.getProgress().merit, 5);
    assert.strictEqual(engine.getStatus().stageId, "mortal");
  });

  it("reset clears merit and refreshThemeContext does not restore stale bucket", () => {
    engine.setThemeActive("cultivator", CAPABILITY, {
      merit: 5000,
      dayKey: "2026-07-26",
      dailyEarned: 5000,
      lastActiveDayKey: "2026-07-26",
      streakDays: 2,
      introSeen: true,
    });
    const result = engine.reset(true);
    assert.strictEqual(result.status, "ok");
    assert.strictEqual(engine.getProgress().merit, 0);
    assert.strictEqual(engine.getStatus().stageId, "mortal");
    engine.refreshThemeContext("cultivator", CAPABILITY, {
      merit: 5000,
      dayKey: "2026-07-26",
      dailyEarned: 5000,
      lastActiveDayKey: "2026-07-26",
      streakDays: 2,
      introSeen: true,
    });
    assert.strictEqual(engine.getProgress().merit, 0);
    assert.strictEqual(engine.getStatus().stageId, "mortal");
  });
});
