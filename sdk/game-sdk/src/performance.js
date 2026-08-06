"use strict";

/**
 * Performance budget helpers for Phaser (or any ticker with pause/resume).
 */
function createPerformanceHelpers(bridge) {
  let paused = false;

  function attachPhaserGame(game) {
    if (!game || !game.loop) {
      return bridge.bindLifecyclePauseResume({});
    }
    return bridge.bindLifecyclePauseResume({
      pause: () => {
        paused = true;
        try {
          if (typeof game.loop.sleep === "function") game.loop.sleep();
          else if (game.scene && typeof game.scene.pause === "function") {
            const keys = game.scene.getScenes(true).map((s) => s.scene.key);
            for (const key of keys) game.scene.pause(key);
          }
        } catch { /* ignore */ }
      },
      resume: () => {
        paused = false;
        try {
          if (typeof game.loop.wake === "function") game.loop.wake();
          else if (game.scene && typeof game.scene.resume === "function") {
            const keys = game.scene.getScenes(false).map((s) => s.scene.key);
            for (const key of keys) game.scene.resume(key);
          }
        } catch { /* ignore */ }
      },
    });
  }

  return {
    isLifecyclePaused: () => paused,
    attachPhaserGame,
  };
}

module.exports = { createPerformanceHelpers };
