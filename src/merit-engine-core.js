"use strict";

const {
  DEFAULT_MERIT_PARAMS,
  resolveStage,
  resolveStageIndex,
  nextStageThreshold,
} = require("./theme-progression");

const PRODUCTIVE_STATES = new Set(["thinking", "working", "juggling"]);
const COMPLETION_EVENTS = new Set(["Stop", "event_msg:task_complete"]);
const ERROR_EVENTS = new Set(["PostToolUseFailure", "StopFailure", "ApiError"]);

function createEmptyProgress() {
  return {
    merit: 0,
    dayKey: null,
    dailyEarned: 0,
    lastActiveDayKey: null,
    streakDays: 0,
    introSeen: false,
  };
}

function clampMerit(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(Number.MAX_SAFE_INTEGER, Math.floor(n));
}

function normalizeProgress(raw) {
  const src = raw && typeof raw === "object" ? raw : {};
  const out = {
    merit: clampMerit(src.merit),
    dayKey: typeof src.dayKey === "string" && src.dayKey ? src.dayKey : null,
    dailyEarned: clampMerit(src.dailyEarned),
    lastActiveDayKey: typeof src.lastActiveDayKey === "string" && src.lastActiveDayKey
      ? src.lastActiveDayKey
      : null,
    streakDays: Math.max(0, Math.min(3650, Math.floor(Number(src.streakDays) || 0))),
    introSeen: src.introSeen === true,
  };
  if (typeof src.peakStageId === "string" && src.peakStageId.trim()) {
    out.peakStageId = src.peakStageId.trim();
  }
  if (typeof src.debugStageId === "string" && src.debugStageId.trim()) {
    out.debugStageId = src.debugStageId.trim();
  }
  return out;
}

function localDayKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function previousDayKey(dayKey) {
  if (typeof dayKey !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(dayKey)) return null;
  const [y, m, d] = dayKey.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() - 1);
  return localDayKey(date);
}

function ensureDayBucket(progress, dayKey) {
  if (progress.dayKey === dayKey) return progress;
  return {
    ...progress,
    dayKey,
    dailyEarned: 0,
  };
}

function awardAmount(progress, amount, params) {
  const room = Math.max(0, params.dailyCap - progress.dailyEarned);
  const granted = Math.min(clampMerit(amount), room);
  if (granted <= 0) {
    return { progress, granted: 0 };
  }
  return {
    progress: {
      ...progress,
      merit: clampMerit(progress.merit + granted),
      dailyEarned: clampMerit(progress.dailyEarned + granted),
    },
    granted,
  };
}

function withStageDelta(before, after, stages) {
  return {
    progress: after,
    previousStage: resolveStage(before.merit, stages),
    nextStage: resolveStage(after.merit, stages),
    stageChanged: resolveStageIndex(before.merit, stages) !== resolveStageIndex(after.merit, stages),
  };
}

function accrueSeconds(progressInput, dtSec, paramsInput, stages, options = {}) {
  const params = { ...DEFAULT_MERIT_PARAMS, ...(paramsInput || {}) };
  const dayKey = options.dayKey || localDayKey(options.now ? new Date(options.now) : undefined);
  let progress = ensureDayBucket(normalizeProgress(progressInput), dayKey);
  const before = progress;

  const dt = Number(dtSec);
  if (!Number.isFinite(dt) || dt <= 0) {
    return { ...withStageDelta(before, progress, stages), awards: [], granted: 0 };
  }

  const cappedDt = Math.min(dt, options.maxDtSec != null ? options.maxDtSec : Number.POSITIVE_INFINITY);
  const rate = Math.min(params.meritPerSec, params.maxMeritPerSec);
  const amount = rate * cappedDt;
  const { progress: next, granted } = awardAmount(progress, amount, params);
  progress = next;

  const awards = granted > 0
    ? [{ type: "thinking", amount: granted }]
    : [];

  return {
    ...withStageDelta(before, progress, stages),
    awards,
    granted,
  };
}

function awardProductiveTick(progressInput, paramsInput, stages, options = {}) {
  const params = { ...DEFAULT_MERIT_PARAMS, ...(paramsInput || {}) };
  const tickMerit = Number(params.meritPerTick);
  if (!Number.isFinite(tickMerit) || tickMerit <= 0) {
    const progress = normalizeProgress(progressInput);
    return {
      ...withStageDelta(progress, progress, stages),
      awards: [],
      granted: 0,
    };
  }
  const dayKey = options.dayKey || localDayKey(options.now ? new Date(options.now) : undefined);
  let progress = ensureDayBucket(normalizeProgress(progressInput), dayKey);
  const before = progress;
  const { progress: next, granted } = awardAmount(progress, tickMerit, params);
  progress = next;
  return {
    ...withStageDelta(before, progress, stages),
    awards: granted > 0 ? [{ type: "knock", amount: granted }] : [],
    granted,
  };
}

function applyDailyOnProductive(progressInput, paramsInput, stages, options = {}) {
  const params = { ...DEFAULT_MERIT_PARAMS, ...(paramsInput || {}) };
  const dayKey = options.dayKey || localDayKey(options.now ? new Date(options.now) : undefined);
  let progress = ensureDayBucket(normalizeProgress(progressInput), dayKey);
  const before = progress;
  const awards = [];

  if (progress.lastActiveDayKey === dayKey) {
    return { ...withStageDelta(before, progress, stages), awards, granted: 0 };
  }

  let streakDays = 1;
  if (progress.lastActiveDayKey && progress.lastActiveDayKey === previousDayKey(dayKey)) {
    streakDays = Math.max(1, progress.streakDays + 1);
  }

  progress = {
    ...progress,
    lastActiveDayKey: dayKey,
    streakDays,
  };

  let granted = 0;
  const daily = awardAmount(progress, params.dailyBonus, params);
  progress = daily.progress;
  granted += daily.granted;
  if (daily.granted > 0) {
    awards.push({ type: "dailyBonus", amount: daily.granted });
  }

  if (streakDays === params.streakDays) {
    const streak = awardAmount(progress, params.streakBonus, params);
    progress = streak.progress;
    granted += streak.granted;
    if (streak.granted > 0) {
      awards.push({ type: "streakBonus", amount: streak.granted });
    }
  }

  return {
    ...withStageDelta(before, progress, stages),
    awards,
    granted,
  };
}

function applyCompletion(progressInput, paramsInput, stages, options = {}) {
  const params = { ...DEFAULT_MERIT_PARAMS, ...(paramsInput || {}) };
  const dayKey = options.dayKey || localDayKey(options.now ? new Date(options.now) : undefined);
  let progress = ensureDayBucket(normalizeProgress(progressInput), dayKey);
  const before = progress;
  const { progress: next, granted } = awardAmount(progress, params.completionMerit, params);
  progress = next;
  return {
    ...withStageDelta(before, progress, stages),
    awards: granted > 0 ? [{ type: "completion", amount: granted }] : [],
    granted,
  };
}

function applyError(progressInput, paramsInput, stages, options = {}) {
  const params = { ...DEFAULT_MERIT_PARAMS, ...(paramsInput || {}) };
  const dayKey = options.dayKey || localDayKey(options.now ? new Date(options.now) : undefined);
  let progress = ensureDayBucket(normalizeProgress(progressInput), dayKey);
  const before = progress;
  const { progress: next, granted } = awardAmount(progress, params.errorMerit, params);
  progress = next;
  return {
    ...withStageDelta(before, progress, stages),
    awards: granted > 0 ? [{ type: "error", amount: granted }] : [],
    granted,
  };
}

function markIntroSeen(progressInput) {
  const progress = normalizeProgress(progressInput);
  if (progress.introSeen) return progress;
  return { ...progress, introSeen: true };
}

function resetProgress(progressInput) {
  const progress = normalizeProgress(progressInput);
  return {
    ...createEmptyProgress(),
    introSeen: progress.introSeen === true,
  };
}

function buildStatus(progressInput, stages, lang = "en") {
  const progress = normalizeProgress(progressInput);
  const stage = resolveStage(progress.merit, stages);
  const next = nextStageThreshold(progress.merit, stages);
  const currentRequired = stage ? stage.requiredMerit : 0;
  const nextRequired = next ? next.requiredMerit : null;
  const span = nextRequired != null ? Math.max(1, nextRequired - currentRequired) : 1;
  const into = nextRequired != null ? Math.max(0, progress.merit - currentRequired) : span;
  return {
    merit: progress.merit,
    stageId: stage ? stage.id : null,
    stageName: stage ? stage.name : null,
    stageIndex: resolveStageIndex(progress.merit, stages),
    nextStageId: next ? next.id : null,
    nextRequiredMerit: nextRequired,
    progressRatio: nextRequired == null ? 1 : Math.min(1, into / span),
    streakDays: progress.streakDays,
    dailyEarned: progress.dailyEarned,
    introSeen: progress.introSeen,
    lang,
  };
}

function isProductiveSession(session) {
  if (!session || session.headless || session.hiddenFromHud) return false;
  return PRODUCTIVE_STATES.has(session.state);
}

function isCompletionAward(session) {
  if (!session || session.headless) return false;
  if (session.badge !== "done") return false;
  const rawEvent = session.lastEvent && session.lastEvent.rawEvent;
  return COMPLETION_EVENTS.has(rawEvent);
}

function isErrorAward(session) {
  if (!session || session.headless) return false;
  const rawEvent = session.lastEvent && session.lastEvent.rawEvent;
  return ERROR_EVENTS.has(rawEvent);
}

function eventDedupeKey(session) {
  if (!session || !session.id || !session.lastEvent) return null;
  const rawEvent = session.lastEvent.rawEvent;
  const at = Number(session.lastEvent.at);
  if (!rawEvent || !Number.isFinite(at)) return null;
  return `${session.id}:${rawEvent}:${at}`;
}

module.exports = {
  PRODUCTIVE_STATES,
  COMPLETION_EVENTS,
  ERROR_EVENTS,
  createEmptyProgress,
  normalizeProgress,
  clampMerit,
  localDayKey,
  previousDayKey,
  accrueSeconds,
  awardProductiveTick,
  applyDailyOnProductive,
  applyCompletion,
  applyError,
  markIntroSeen,
  resetProgress,
  buildStatus,
  isProductiveSession,
  isCompletionAward,
  isErrorAward,
  eventDedupeKey,
};
