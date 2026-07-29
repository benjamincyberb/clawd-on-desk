"use strict";

/**
 * Main-process bridge for the merit cultivator engine.
 * Keeps Electron IPC / prefs flush / runtime stage visuals out of the pure engine.
 */

const { createMeritEngine } = require("./merit-engine");
const {
  localizeStageName,
  previewMeritForStage,
  resolveStage,
} = require("./theme-progression");

function createMeritBridge(deps = {}) {
  const {
    settingsController,
    getActiveTheme,
    activateThemeRuntime,
    getThemeMetadata,
    getLang,
    getDoNotDisturb,
    sendToRenderer,
    playSound,
    isSuspended,
    setMeritStage,
  } = deps;

  let engine = null;

  function peekMeritCap(themeId) {
    if (typeof getThemeMetadata !== "function" || !themeId) return null;
    try {
      const meta = getThemeMetadata(themeId);
      return meta && meta.capabilities && meta.capabilities.meritCultivator;
    } catch {
      return null;
    }
  }

  function getMeritCapability(themeId) {
    const fresh = peekMeritCap(themeId);
    const theme = typeof getActiveTheme === "function" ? getActiveTheme() : null;
    const loaded = theme && theme._id === themeId && theme._capabilities && theme._capabilities.meritCultivator;
    if (!fresh && !loaded) return null;
    if (!fresh) return loaded;
    if (!loaded) return fresh;
    return {
      ...loaded,
      enabled: fresh.enabled,
      params: fresh.params || loaded.params,
      stages: fresh.stages || loaded.stages,
    };
  }

  function getProgressBucket(themeId) {
    const map = settingsController.get("meritProgress") || {};
    return (themeId && map[themeId]) || null;
  }

  function getLiveProgressBucket(themeId) {
    if (engine && engine._isEnabled() && engine.getStatus().themeId === themeId) {
      const live = engine.getProgress();
      const stored = getProgressBucket(themeId) || {};
      // Live engine progress is authoritative during a session (reset, awards).
      // Do not Math.max with store — that blocks resets and external prefs reloads.
      return {
        ...stored,
        ...live,
        introSeen: stored.introSeen || live.introSeen,
      };
    }
    return getProgressBucket(themeId);
  }

  function applyMeritStageVisuals(themeId, stageId) {
    if (!themeId || !stageId || typeof setMeritStage !== "function") return false;
    const theme = typeof getActiveTheme === "function" ? getActiveTheme() : null;
    if (!theme || theme._id !== themeId) return false;
    return setMeritStage(stageId) === true;
  }

  function writeProgressBucket(themeId, progress) {
    if (!themeId || !progress) return;
    const map = { ...(settingsController.get("meritProgress") || {}) };
    map[themeId] = progress;
    const result = settingsController.applyUpdate("meritProgress", map);
    if (result && result.status === "error") {
      console.warn("Clawd: meritProgress flush failed:", result.message);
    }
  }

  function resolveProgressionStageId(themeId, meritCap, meritOverride) {
    if (!meritCap || !meritCap.enabled || !Array.isArray(meritCap.stages)) return null;
    const bucket = getLiveProgressBucket(themeId) || {};
    const debugStageId = typeof bucket.debugStageId === "string" && bucket.debugStageId.trim()
      ? bucket.debugStageId.trim()
      : null;
    if (debugStageId && meritCap.stages.some((entry) => entry.id === debugStageId)) {
      return debugStageId;
    }
    const merit = Number.isFinite(meritOverride)
      ? meritOverride
      : (bucket.merit || 0);
    const stage = resolveStage(merit, meritCap.stages);
    return stage ? stage.id : (meritCap.stages[0] && meritCap.stages[0].id) || null;
  }

  function enrichStatus(status) {
    const lang = typeof getLang === "function" ? getLang() : "en";
    const overlayEnabled = settingsController.get("meritOverlayEnabled") !== false;
    return {
      ...status,
      stageNameText: localizeStageName(status && status.stageName, lang),
      overlayEnabled,
      progressPct: status && Number.isFinite(status.progressRatio)
        ? Math.round(status.progressRatio * 100)
        : 0,
    };
  }

  function broadcastStatus(extra = {}) {
    if (!engine || typeof sendToRenderer !== "function") return;
    const status = enrichStatus({ ...engine.getStatus(getLang ? getLang() : "en"), ...extra });
    sendToRenderer("merit-status", status);
  }

  function syncToActiveTheme() {
    const theme = typeof getActiveTheme === "function" ? getActiveTheme() : null;
    const themeId = theme && theme._id;
    const cap = getMeritCapability(themeId);
    if (!engine) return null;
    const progressBucket = getLiveProgressBucket(themeId);
    if (engine._isEnabled() && engine.getStatus().themeId === themeId) {
      engine.refreshThemeContext(themeId, cap, progressBucket);
    } else {
      engine.setThemeActive(themeId, cap, progressBucket);
    }
    const live = engine.getProgress();
    const stageId = resolveProgressionStageId(themeId, cap);
    if (stageId && cap && cap.enabled) {
      applyMeritStageVisuals(themeId, stageId);
    }
    broadcastStatus();
    return stageId ? resolveStage(live.merit || 0, (cap && cap.stages) || []) : null;
  }

  function ensureEngine() {
    if (engine) return engine;
    engine = createMeritEngine({
      onStatus: (status) => {
        sendToRenderer("merit-status", enrichStatus(status));
      },
      onAward: (award, status) => {
        sendToRenderer("merit-award", {
          award,
          status: enrichStatus(status),
        });
      },
      onLevelUp: (payload) => {
        if (typeof getDoNotDisturb === "function" && getDoNotDisturb()) return;
        const lang = getLang ? getLang() : "en";
        const next = payload && payload.nextStage;
        sendToRenderer("merit-level-up", {
          themeId: payload.themeId,
          stageId: next && next.id,
          stageName: next && next.name,
          stageNameText: localizeStageName(next && next.name, lang),
          title: lang === "zh" || lang === "zh-TW" ? "境界突破" : (lang === "ko" ? "경지 돌파" : (lang === "ja" ? "境地突破" : "Realm breakthrough")),
          status: enrichStatus(payload.status || {}),
        });
        if (typeof playSound === "function") playSound("complete");
      },
      onFlush: (themeId, progress) => {
        writeProgressBucket(themeId, progress);
      },
      onNeedStage: (themeId, stageId) => new Promise((resolve) => {
        applyMeritStageVisuals(themeId, stageId);
        syncToActiveTheme();
        resolve();
      }),
    });
    if (typeof getDoNotDisturb === "function") {
      engine.setDnd(!!getDoNotDisturb());
    }
    if (typeof isSuspended === "function") {
      engine.setSuspended(!!isSuspended());
    }
    syncToActiveTheme();
    return engine;
  }

  function activateTheme(themeId, variantId, overrideMap, options) {
    ensureEngine();
    engine.flush();
    const cap = peekMeritCap(themeId);
    const progressionStageId = (
      options && typeof options.progressionStageId === "string" && options.progressionStageId
    ) || resolveProgressionStageId(themeId, cap) || undefined;

    const result = activateThemeRuntime(themeId, variantId, overrideMap, {
      ...(options || {}),
      progressionStageId,
      onReloadFinished: () => {
        syncToActiveTheme();
        maybeMarkIntro();
        if (options && typeof options.onReloadFinished === "function") {
          options.onReloadFinished();
        }
      },
    });
    syncToActiveTheme();
    return result;
  }

  function maybeMarkIntro() {
    if (!engine || !engine._isEnabled()) return;
    const status = engine.getStatus();
    if (status.introSeen) return;
    if (engine.markIntro()) {
      const lang = getLang ? getLang() : "en";
      const text = lang === "zh" || lang === "zh-TW"
        ? "开始修行吧"
        : (lang === "ko" ? "수행을 시작하세요" : (lang === "ja" ? "修行を始めよう" : "Begin your cultivation"));
      sendToRenderer("merit-level-up", {
        intro: true,
        title: text,
        stageNameText: "",
        status: enrichStatus(engine.getStatus(lang)),
      });
    }
  }

  function onSnapshot(snapshot) {
    if (!engine) ensureEngine();
    engine.onSnapshot(snapshot);
  }

  function setDnd(enabled) {
    if (!engine) return;
    engine.setDnd(enabled);
  }

  function setSuspended(enabled) {
    if (!engine) return;
    engine.setSuspended(enabled);
  }

  function resetMeritProgress({ confirmed } = {}) {
    ensureEngine();
    const result = engine.reset(confirmed === true);
    if (result.status !== "ok") return result;
    const theme = typeof getActiveTheme === "function" ? getActiveTheme() : null;
    const themeId = theme && theme._id;
    if (themeId && result.stage) {
      applyMeritStageVisuals(themeId, result.stage.id);
    }
    broadcastStatus({ reset: true });
    return { ...result, themeId };
  }

  function previewMeritStage(payload = {}) {
    let themeId = payload && typeof payload.themeId === "string" && payload.themeId.trim()
      ? payload.themeId.trim()
      : null;
    if (!themeId) {
      const theme = typeof getActiveTheme === "function" ? getActiveTheme() : null;
      themeId = theme && theme._id;
    }
    if (!themeId) {
      return { status: "error", message: "previewMeritStage requires themeId" };
    }

    const cap = getMeritCapability(themeId);
    if (!cap || !cap.enabled || !Array.isArray(cap.stages) || cap.stages.length === 0) {
      return { status: "error", message: "merit cultivator not enabled for theme" };
    }

    const stageId = payload && typeof payload.stageId === "string" ? payload.stageId.trim() : "";
    const clear = !stageId || stageId === "auto";
    if (!clear && !cap.stages.some((entry) => entry.id === stageId)) {
      return { status: "error", message: `unknown stage: ${stageId}` };
    }

    ensureEngine();
    const stages = cap.stages;
    const bucket = getLiveProgressBucket(themeId) || {};
    const dailyCap = Number(cap.params && cap.params.dailyCap) || 10000;

    let nextBucket;
    if (clear) {
      nextBucket = { ...bucket, debugStageId: null };
    } else {
      const merit = previewMeritForStage(stageId, stages);
      nextBucket = {
        ...bucket,
        merit,
        dailyEarned: dailyCap,
        debugStageId: stageId,
        peakStageId: stageId,
      };
    }

    if (engine._isEnabled() && engine.getStatus().themeId === themeId) {
      engine.setProgress(nextBucket);
    } else {
      engine.setThemeActive(themeId, cap, nextBucket);
    }

    const resolvedStageId = clear
      ? (resolveStage(nextBucket.merit || 0, stages) && resolveStage(nextBucket.merit, stages).id)
      : stageId;
    applyMeritStageVisuals(themeId, resolvedStageId);
    writeProgressBucket(themeId, engine.getProgress());
    broadcastStatus({ debugPreview: !clear });

    return {
      status: "ok",
      themeId,
      stageId: resolvedStageId,
      progress: engine.getProgress(),
      debug: !clear,
    };
  }

  function getStatus() {
    ensureEngine();
    return enrichStatus(engine.getStatus(getLang ? getLang() : "en"));
  }

  function flush() {
    if (engine) engine.flush();
  }

  function cleanup() {
    if (!engine) return;
    engine.cleanup();
    engine = null;
  }

  function resolveStartupProgressionStageId(themeId) {
    return resolveProgressionStageId(themeId, peekMeritCap(themeId));
  }

  return {
    ensureEngine,
    activateTheme,
    onSnapshot,
    setDnd,
    setSuspended,
    resetMeritProgress,
    previewMeritStage,
    getStatus,
    flush,
    cleanup,
    broadcastStatus,
    syncToActiveTheme,
    resolveStartupProgressionStageId,
    getProgressBucket,
  };
}

module.exports = {
  createMeritBridge,
};
