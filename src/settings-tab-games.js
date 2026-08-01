"use strict";

(function initSettingsTabGames(root) {
  let state = null;
  let helpers = null;
  let ops = null;
  let readers = null;

  let gamesCache = null;
  let gamesLoading = false;
  let actionPending = false;

  function t(key) {
    return helpers.t(key);
  }

  function isEnabled(gameId) {
    const games = state.snapshot && state.snapshot.games;
    const map = games && games.enabledById ? games.enabledById : {};
    const entry = map[gameId];
    if (!entry) return true;
    return entry.enabled !== false;
  }

  function refreshGames() {
    if (!window.settingsAPI || typeof window.settingsAPI.listGames !== "function") {
      gamesCache = [];
      return Promise.resolve();
    }
    gamesLoading = true;
    ops.requestRender({ content: true });
    return window.settingsAPI.listGames().then((list) => {
      gamesCache = Array.isArray(list) ? list : [];
      gamesLoading = false;
      ops.requestRender({ content: true });
    }).catch((err) => {
      gamesLoading = false;
      gamesCache = [];
      ops.showToast(t("toastSaveFailed") + (err && err.message), { error: true });
      ops.requestRender({ content: true });
    });
  }

  function setEnabled(gameId, enabled) {
    if (!window.settingsAPI || typeof window.settingsAPI.command !== "function") return;
    actionPending = true;
    ops.requestRender({ content: true });
    window.settingsAPI.command("games.setEnabled", { gameId, enabled: !!enabled }).then((result) => {
      actionPending = false;
      if (!result || result.status !== "ok") {
        ops.showToast((result && result.message) || t("toastSaveFailed"), { error: true });
      }
      ops.requestRender({ content: true });
    }).catch((err) => {
      actionPending = false;
      ops.showToast(t("toastSaveFailed") + (err && err.message), { error: true });
      ops.requestRender({ content: true });
    });
  }

  function launch(gameId) {
    if (!window.settingsAPI || typeof window.settingsAPI.launchGame !== "function") return;
    actionPending = true;
    ops.requestRender({ content: true });
    window.settingsAPI.launchGame(gameId).then((result) => {
      actionPending = false;
      if (!result || result.status !== "ok") {
        ops.showToast((result && result.message) || t("gamesLaunchFailed"), { error: true });
      } else {
        ops.showToast(t("gamesLaunchOk"));
      }
      ops.requestRender({ content: true });
    }).catch((err) => {
      actionPending = false;
      ops.showToast(t("gamesLaunchFailed") + " " + (err && err.message), { error: true });
      ops.requestRender({ content: true });
    });
  }

  function clearSaves(gameId) {
    if (!window.settingsAPI || typeof window.settingsAPI.clearGameSaves !== "function") return;
    actionPending = true;
    ops.requestRender({ content: true });
    window.settingsAPI.clearGameSaves(gameId).then((result) => {
      actionPending = false;
      if (!result || result.status !== "ok") {
        ops.showToast((result && result.message) || t("toastSaveFailed"), { error: true });
      } else {
        ops.showToast(t("gamesSavesCleared"));
      }
      ops.requestRender({ content: true });
    }).catch((err) => {
      actionPending = false;
      ops.showToast(t("toastSaveFailed") + (err && err.message), { error: true });
      ops.requestRender({ content: true });
    });
  }

  function buildGameRow(game) {
    const row = document.createElement("div");
    row.className = "row";

    const text = document.createElement("div");
    text.className = "row-text";
    const title = document.createElement("div");
    title.className = "row-title";
    title.textContent = game.name || game.id;
    const desc = document.createElement("div");
    desc.className = "row-desc";
    const bits = [];
    if (game.version) bits.push("v" + game.version);
    if (game.builtin) bits.push(t("gamesBuiltin"));
    if (game.engine) bits.push(game.engine);
    if (!game.valid) bits.push(t("gamesInvalid"));
    desc.textContent = bits.join(" · ") || game.id;
    text.appendChild(title);
    text.appendChild(desc);
    row.appendChild(text);

    const actions = document.createElement("div");
    actions.className = "row-actions";
    actions.style.display = "flex";
    actions.style.gap = "8px";
    actions.style.alignItems = "center";

    const enabled = isEnabled(game.id);
    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "btn";
    toggle.textContent = enabled ? t("gamesDisable") : t("gamesEnable");
    toggle.disabled = actionPending;
    toggle.addEventListener("click", () => setEnabled(game.id, !enabled));
    actions.appendChild(toggle);

    const play = document.createElement("button");
    play.type = "button";
    play.className = "btn primary";
    play.textContent = t("gamesLaunch");
    play.disabled = actionPending || !game.valid || !enabled;
    play.addEventListener("click", () => launch(game.id));
    actions.appendChild(play);

    const clear = document.createElement("button");
    clear.type = "button";
    clear.className = "btn";
    clear.textContent = t("gamesClearSaves");
    clear.disabled = actionPending;
    clear.addEventListener("click", () => clearSaves(game.id));
    actions.appendChild(clear);

    row.appendChild(actions);
    return row;
  }

  function render(parent) {
    const h1 = document.createElement("h1");
    h1.textContent = t("gamesTitle");
    parent.appendChild(h1);

    const subtitle = document.createElement("p");
    subtitle.className = "subtitle";
    subtitle.textContent = t("gamesSubtitle");
    parent.appendChild(subtitle);

    if (gamesCache === null && !gamesLoading) {
      refreshGames();
    }

    const toolbar = document.createElement("div");
    toolbar.className = "row";
    const refreshBtn = document.createElement("button");
    refreshBtn.type = "button";
    refreshBtn.className = "btn";
    refreshBtn.textContent = t("gamesRefresh");
    refreshBtn.disabled = gamesLoading || actionPending;
    refreshBtn.addEventListener("click", () => refreshGames());
    toolbar.appendChild(refreshBtn);
    parent.appendChild(toolbar);

    if (gamesLoading && !gamesCache) {
      const p = document.createElement("p");
      p.className = "subtitle";
      p.textContent = t("gamesLoading");
      parent.appendChild(p);
      return;
    }

    const list = Array.isArray(gamesCache) ? gamesCache : [];
    if (!list.length) {
      const empty = document.createElement("p");
      empty.className = "subtitle";
      empty.textContent = t("gamesEmpty");
      parent.appendChild(empty);
      return;
    }

    const sectionKids = list.map(buildGameRow);
    parent.appendChild(helpers.buildSection(t("gamesInstalledTitle"), sectionKids));
  }

  function init(core) {
    state = core.state;
    helpers = core.helpers;
    ops = core.ops;
    readers = core.readers;
    core.tabs.games = { render };
  }

  root.ClawdSettingsTabGames = { init };
})(globalThis);
