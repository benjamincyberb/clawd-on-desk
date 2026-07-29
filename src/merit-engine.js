"use strict";

/**
 * Merit engine runtime: snapshot fanout + ticker + persistence callbacks.
 * Pure Electron-free aside from injectable timers/clock.
 */

const core = require("./merit-engine-core");
const {
  DEFAULT_MERIT_PARAMS,
  localizeStageName,
  resolveStage,
} = require("./theme-progression");

const MAX_DEDUPE_KEYS = 500;
const DEFAULT_FLUSH_MS = 30_000;
const MAX_TICK_DT_SEC = 2;

function createMeritEngine(options = {}) {
  const nowFn = typeof options.now === "function" ? options.now : () => Date.now();
  const setIntervalFn = options.setInterval || setInterval;
  const clearIntervalFn = options.clearInterval || clearInterval;
  const flushIntervalMs = Number.isFinite(options.flushIntervalMs)
    ? options.flushIntervalMs
    : DEFAULT_FLUSH_MS;

  let themeId = null;
  let enabled = false;
  let params = { ...DEFAULT_MERIT_PARAMS };
  let stages = null;
  let progress = core.createEmptyProgress();
  let dirty = false;
  let productive = false;
  let dnd = false;
  let suspended = false;
  let ticker = null;
  let lastTickAt = null;
  let lastFlushAt = 0;
  let dedupe = new Map(); // key -> at
  let completionCooldownUntil = new Map(); // sessionId -> ts
  let upgrading = false;
  let pendingUpgrade = null;

  const listeners = {
    onStatus: typeof options.onStatus === "function" ? options.onStatus : null,
    onAward: typeof options.onAward === "function" ? options.onAward : null,
    onLevelUp: typeof options.onLevelUp === "function" ? options.onLevelUp : null,
    onFlush: typeof options.onFlush === "function" ? options.onFlush : null,
    onNeedStage: typeof options.onNeedStage === "function" ? options.onNeedStage : null,
  };

  function emitStatus(extra = {}) {
    if (!listeners.onStatus) return;
    const status = core.buildStatus(progress, stages || []);
    listeners.onStatus({
      ...status,
      themeId,
      enabled,
      overlayVisible: enabled,
      ...extra,
    });
  }

  function markDirty() {
    dirty = true;
  }

  function rememberDedupe(key) {
    if (!key) return false;
    if (dedupe.has(key)) return false;
    dedupe.set(key, nowFn());
    if (dedupe.size > MAX_DEDUPE_KEYS) {
      const first = dedupe.keys().next().value;
      dedupe.delete(first);
    }
    return true;
  }

  function flush(force = false) {
    if (!dirty && !force) return false;
    if (!themeId) return false;
    const snapshot = core.normalizeProgress(progress);
    dirty = false;
    lastFlushAt = nowFn();
    if (listeners.onFlush) listeners.onFlush(themeId, snapshot);
    return true;
  }

  function maybeFlush(forceImmediate) {
    if (!dirty) return;
    if (forceImmediate || nowFn() - lastFlushAt >= flushIntervalMs) {
      flush(true);
    }
  }

  function handleAwards(result, { immediateFlush = false } = {}) {
    if (!result) return;
    progress = result.progress;
    if (result.granted > 0) markDirty();
    if (Array.isArray(result.awards)) {
      for (const award of result.awards) {
        if (listeners.onAward) listeners.onAward(award, core.buildStatus(progress, stages || []));
      }
    }
    emitStatus();
    if (result.stageChanged && result.nextStage) {
      queueUpgrade(result.previousStage, result.nextStage);
      maybeFlush(true);
    } else {
      maybeFlush(immediateFlush);
    }
  }

  function queueUpgrade(previousStage, nextStage) {
    pendingUpgrade = { previousStage, nextStage };
    if (upgrading) return;
    runUpgradeQueue();
  }

  function runUpgradeQueue() {
    if (upgrading || !pendingUpgrade || !enabled) return;
    const job = pendingUpgrade;
    pendingUpgrade = null;
    upgrading = true;
    flush(true);
    const stageId = job.nextStage && job.nextStage.id;
    const finish = () => {
      upgrading = false;
      if (listeners.onLevelUp) {
        listeners.onLevelUp({
          themeId,
          previousStage: job.previousStage,
          nextStage: job.nextStage,
          status: core.buildStatus(progress, stages || []),
        });
      }
      emitStatus({ levelUp: true });
      if (pendingUpgrade) runUpgradeQueue();
    };

    if (listeners.onNeedStage && stageId) {
      Promise.resolve(listeners.onNeedStage(themeId, stageId))
        .then(finish)
        .catch(() => finish());
    } else {
      finish();
    }
  }

  function stopTicker() {
    if (ticker) {
      clearIntervalFn(ticker);
      ticker = null;
    }
    lastTickAt = null;
  }

  function tickIntervalMs() {
    const ms = Number(params.meritTickMs);
    if (Number.isFinite(ms) && ms >= 200) return Math.round(ms);
    return 1000;
  }

  function usesPerTickMerit() {
    const tickMerit = Number(params.meritPerTick);
    return Number.isFinite(tickMerit) && tickMerit > 0;
  }

  function startTicker() {
    if (ticker || !enabled) return;
    lastTickAt = nowFn();
    ticker = setIntervalFn(() => tick(), tickIntervalMs());
    if (ticker && typeof ticker.unref === "function") ticker.unref();
  }

  function tick() {
    if (!enabled || dnd || suspended || !productive) {
      lastTickAt = nowFn();
      return;
    }
    const now = nowFn();
    if (usesPerTickMerit()) {
      lastTickAt = now;
      const result = core.awardProductiveTick(progress, params, stages, { now });
      handleAwards(result);
      return;
    }
    const dtMs = lastTickAt == null ? tickIntervalMs() : Math.max(0, now - lastTickAt);
    lastTickAt = now;
    const dtSec = Math.min(MAX_TICK_DT_SEC, dtMs / 1000);
    if (dtSec <= 0) return;
    const result = core.accrueSeconds(progress, dtSec, params, stages, {
      now,
      maxDtSec: MAX_TICK_DT_SEC,
    });
    handleAwards(result);
  }

  function refreshThemeContext(nextThemeId, capability, progressBucket) {
    const nextEnabled = !!(capability && capability.enabled && Array.isArray(capability.stages));
    if (!themeId || themeId !== nextThemeId || !enabled || !nextEnabled) {
      return setThemeActive(nextThemeId, capability, progressBucket);
    }
    stopTicker();
    params = { ...DEFAULT_MERIT_PARAMS, ...(capability.params || {}) };
    stages = capability.stages;
    // Keep in-session progress; only params/stages refresh here. Progress reload
    // happens via setThemeActive (theme switch / startup) or reset().
    startTicker();
    emitStatus();
    return resolveStage(progress.merit, stages);
  }

  function setThemeActive(nextThemeId, capability, progressBucket) {
    flush(true);
    stopTicker();
    themeId = typeof nextThemeId === "string" && nextThemeId ? nextThemeId : null;
    enabled = !!(capability && capability.enabled && Array.isArray(capability.stages));
    params = enabled
      ? { ...DEFAULT_MERIT_PARAMS, ...(capability.params || {}) }
      : { ...DEFAULT_MERIT_PARAMS };
    stages = enabled ? capability.stages : null;
    progress = core.normalizeProgress(progressBucket || core.createEmptyProgress());
    productive = false;
    dedupe = new Map();
    completionCooldownUntil = new Map();
    pendingUpgrade = null;
    upgrading = false;
    dirty = false;
    if (enabled) startTicker();
    emitStatus();
    return resolveStage(progress.merit, stages || []);
  }

  function setDnd(next) {
    dnd = !!next;
    if (dnd) {
      productive = false;
      lastTickAt = nowFn();
    }
  }

  function setSuspended(next) {
    suspended = !!next;
    lastTickAt = nowFn();
  }

  function onSnapshot(snapshot) {
    if (!enabled || !stages) return;
    if (dnd) {
      productive = false;
      return;
    }
    const sessions = Array.isArray(snapshot && snapshot.sessions) ? snapshot.sessions : [];
    const now = nowFn();
    let anyProductive = false;

    for (const session of sessions) {
      if (core.isProductiveSession(session)) anyProductive = true;

      const key = core.eventDedupeKey(session);
      if (!key || !rememberDedupe(key)) continue;

      if (core.isCompletionAward(session)) {
        const until = completionCooldownUntil.get(session.id) || 0;
        if (now < until) continue;
        completionCooldownUntil.set(session.id, now + params.minEventCooldownMs);
        const daily = core.applyDailyOnProductive(progress, params, stages, { now });
        handleAwards(daily, { immediateFlush: true });
        const done = core.applyCompletion(progress, params, stages, { now });
        handleAwards(done, { immediateFlush: true });
        continue;
      }

      if (core.isErrorAward(session)) {
        const daily = core.applyDailyOnProductive(progress, params, stages, { now });
        handleAwards(daily, { immediateFlush: true });
        const fail = core.applyError(progress, params, stages, { now });
        handleAwards(fail, { immediateFlush: true });
      }
    }

    if (anyProductive && !productive) {
      const daily = core.applyDailyOnProductive(progress, params, stages, { now });
      handleAwards(daily, { immediateFlush: daily.granted > 0 });
    }
    productive = anyProductive;
  }

  function markIntro() {
    const next = core.markIntroSeen(progress);
    if (next.introSeen !== progress.introSeen) {
      progress = next;
      markDirty();
      maybeFlush(true);
      emitStatus({ intro: true });
      return true;
    }
    return false;
  }

  function reset(confirmed) {
    if (confirmed !== true) {
      return { status: "error", message: "resetMeritProgress requires confirmed:true" };
    }
    progress = core.resetProgress(progress);
    markDirty();
    flush(true);
    const stage = resolveStage(progress.merit, stages || []);
    emitStatus({ reset: true });
    return { status: "ok", stage, progress: core.normalizeProgress(progress) };
  }

  function getStatus(lang = "en") {
    const status = core.buildStatus(progress, stages || [], lang);
    return {
      ...status,
      themeId,
      enabled,
      stageNameText: localizeStageName(status.stageName, lang),
      progress: core.normalizeProgress(progress),
      params: { ...params },
      stages,
    };
  }

  function getProgress() {
    return core.normalizeProgress(progress);
  }

  function setProgress(progressBucket) {
    if (!enabled) return null;
    progress = core.normalizeProgress(progressBucket);
    markDirty();
    flush(true);
    emitStatus();
    return resolveStage(progress.merit, stages || []);
  }

  function cleanup() {
    flush(true);
    stopTicker();
    dedupe = new Map();
    completionCooldownUntil = new Map();
    pendingUpgrade = null;
    upgrading = false;
    enabled = false;
    themeId = null;
    stages = null;
    productive = false;
  }

  return {
    setThemeActive,
    refreshThemeContext,
    setDnd,
    setSuspended,
    onSnapshot,
    markIntro,
    reset,
    flush: () => flush(true),
    getStatus,
    getProgress,
    setProgress,
    cleanup,
    // test helpers
    _isEnabled: () => enabled,
    _isProductive: () => productive,
    _tick: tick,
  };
}

module.exports = {
  createMeritEngine,
};
