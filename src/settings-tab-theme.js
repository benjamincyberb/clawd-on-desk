"use strict";

(function initSettingsTabTheme(root) {
  const PREVIEW_TARGET_CONTENT_RATIO = 0.55;

  let state = null;
  let runtime = null;
  let helpers = null;
  let ops = null;
  let readers = null;
  let customizingThemeId = null;
  let customizationSelectionPendingThemeId = null;
  let customizationSelectionSeq = 0;
  let renderHooksRef = null;

  function t(key) {
    return helpers.t(key);
  }

  function render(parent) {
    const detailTheme = Array.isArray(runtime.themeList)
      ? runtime.themeList.find((theme) => (
        theme
        && theme.id === customizingThemeId
        && theme.active
        && supportsThemeCustomization(theme)
      ))
      : null;
    if (detailTheme) {
      renderThemeDetail(parent, detailTheme);
      return;
    }
    customizingThemeId = null;

    const h1 = document.createElement("h1");
    h1.textContent = t("themeTitle");
    parent.appendChild(h1);

    const subtitle = document.createElement("p");
    subtitle.className = "subtitle";
    subtitle.textContent = t("themeSubtitle");
    parent.appendChild(subtitle);
    parent.appendChild(buildThemeActions());

    if (runtime.themeList === null) {
      const loading = document.createElement("div");
      loading.className = "placeholder-desc";
      parent.appendChild(loading);
      ops.fetchThemes().then(() => {
        if (state.activeTab === "theme") ops.requestRender({ content: true });
      });
      return;
    }

    if (runtime.themeList.length === 0) {
      const empty = document.createElement("div");
      empty.className = "placeholder";
      empty.innerHTML = `<div class="placeholder-desc">${helpers.escapeHtml(t("themeEmpty"))}</div>`;
      parent.appendChild(empty);
      return;
    }

    for (const section of getThemeSections(runtime.themeList)) {
      const sectionEl = document.createElement("section");
      sectionEl.className = "theme-section";
      sectionEl.setAttribute("aria-labelledby", `theme-section-${section.id}`);

      const title = document.createElement("h2");
      title.id = `theme-section-${section.id}`;
      title.className = "theme-section-title";
      title.textContent = section.title;
      sectionEl.appendChild(title);

      const grid = document.createElement("div");
      grid.className = "theme-grid";
      for (const theme of section.themes) {
        grid.appendChild(buildThemeCard(theme));
      }
      sectionEl.appendChild(grid);
      parent.appendChild(sectionEl);
    }

    const active = (runtime.themeList || []).find((theme) => theme && theme.active);
    if (
      active
      && active.capabilities
      && active.capabilities.meritCultivator
      && active.capabilities.meritCultivator.enabled
    ) {
      parent.appendChild(buildMeritCultivatorPanel(active));
    }
  }

  function getThemeSections(themes) {
    const groups = {
      builtin: [],
      importedCodexPets: [],
      user: [],
    };
    for (const theme of themes || []) {
      if (theme && theme.builtin) groups.builtin.push(theme);
      else if (theme && theme.managedCodexPet) groups.importedCodexPets.push(theme);
      else groups.user.push(theme);
    }
    return [
      { id: "builtin", title: t("themeGroupBuiltIn"), themes: groups.builtin },
      { id: "imported-codex-pets", title: t("themeGroupImportedCodexPets"), themes: groups.importedCodexPets },
      { id: "user", title: t("themeGroupUserThemes"), themes: groups.user },
    ].filter((section) => section.themes.length > 0);
  }

  function localizeField(value) {
    if (value == null) return "";
    if (typeof value === "string") return value;
    if (typeof value === "object") {
      const lang = readers.getLang();
      if (value[lang]) return value[lang];
      if (value.en) return value.en;
      if (value.zh) return value.zh;
      const firstKey = Object.keys(value)[0];
      if (firstKey) return value[firstKey];
    }
    return "";
  }

  function applyThemePreviewScale(el, contentRatio) {
    if (!Number.isFinite(contentRatio) || contentRatio <= 0) return;
    if (contentRatio <= PREVIEW_TARGET_CONTENT_RATIO) return;
    const scale = PREVIEW_TARGET_CONTENT_RATIO / contentRatio;
    const pct = `${(scale * 100).toFixed(2)}%`;
    el.style.maxWidth = pct;
    el.style.maxHeight = pct;
  }

  function applyThemePreviewOffset(el, offsetPct) {
    if (!offsetPct) return;
    const { x, y } = offsetPct;
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    if (Math.abs(x) < 0.5 && Math.abs(y) < 0.5) return;
    el.style.transform = `translate(${x.toFixed(2)}%, ${y.toFixed(2)}%)`;
  }

  function getCodexPetPreviewAtlasUrl(theme) {
    return theme
      && theme.codexPet
      && typeof theme.codexPet.previewAtlasUrl === "string"
      && theme.codexPet.previewAtlasUrl;
  }

  function buildCodexPetAtlasPreview(theme) {
    const frame = document.createElement("span");
    frame.className = "theme-thumb-atlas-frame";
    applyThemePreviewScale(frame, theme.previewContentRatio);
    applyThemePreviewOffset(frame, theme.previewContentOffsetPct);

    const img = document.createElement("img");
    img.src = getCodexPetPreviewAtlasUrl(theme);
    img.alt = "";
    img.draggable = false;
    frame.appendChild(img);
    return frame;
  }

  function buildThemePreviewMedia(theme) {
    if (theme.managedCodexPet && getCodexPetPreviewAtlasUrl(theme)) {
      return buildCodexPetAtlasPreview(theme);
    }
    const img = document.createElement("img");
    img.src = theme.previewFileUrl;
    img.alt = "";
    img.draggable = false;
    applyThemePreviewScale(img, theme.previewContentRatio);
    applyThemePreviewOffset(img, theme.previewContentOffsetPct);
    return img;
  }

  function getThemeCapabilityBadgeLabels(theme) {
    const caps = theme && theme.capabilities;
    if (!caps || typeof caps !== "object") return [];
    const badges = [];
    if (caps.idleMode === "tracked") badges.push(t("themeCapabilityTracked"));
    else if (caps.idleMode === "animated") badges.push(t("themeCapabilityAnimated"));
    else if (caps.idleMode === "static") badges.push(t("themeCapabilityStatic"));
    if (caps.miniMode) badges.push(t("themeCapabilityMini"));
    if (caps.sleepMode === "direct") badges.push(t("themeCapabilityDirectSleep"));
    if (caps.powerProfile === "scripted") badges.push(t("themeCapabilityFineMotion"));
    if (caps.reactions === false) badges.push(t("themeCapabilityNoReactions"));
    if (caps.meritCultivator && caps.meritCultivator.enabled) {
      badges.push(t("themeCapabilityMerit"));
    }
    if (caps.renderBackend === "rive") badges.push(t("themeCapabilityRive"));
    if (caps.renderBackend === "sandbox") badges.push(t("themeCapabilitySandbox"));
    return badges;
  }

  function supportsThemeCustomization(theme) {
    const caps = theme && theme.capabilities;
    return !!(caps && (caps.petTint === true || caps.accessories === true));
  }

  function mirrorThemeSelectionResult(themeId, result) {
    if (!Array.isArray(runtime.themeList)) return null;
    const runtimeCapabilities = (
      result
      && result.customizationCapabilities
      && typeof result.customizationCapabilities === "object"
      && !Array.isArray(result.customizationCapabilities)
    )
      ? result.customizationCapabilities
      : null;
    runtime.themeList = runtime.themeList.map((entry) => (
      entry
        ? {
            ...entry,
            active: entry.id === themeId,
            capabilities: entry.id === themeId && runtimeCapabilities
              ? { ...(entry.capabilities || {}), ...runtimeCapabilities }
              : entry.capabilities,
          }
        : entry
    ));
    return runtime.themeList.find((entry) => entry && entry.id === themeId) || null;
  }

  function openThemeCustomization(theme) {
    if (!theme || !supportsThemeCustomization(theme)) return;
    if (theme.active) {
      customizingThemeId = theme.id;
      ops.requestRender({ content: true });
      return;
    }
    if (customizationSelectionPendingThemeId) return;

    const requestSeq = ++customizationSelectionSeq;
    customizationSelectionPendingThemeId = theme.id;
    ops.requestRender({ content: true });
    Promise.resolve(window.settingsAPI.command("setThemeSelection", { themeId: theme.id }))
      .then((result) => {
        if (requestSeq !== customizationSelectionSeq) return;
        if (!result || result.status !== "ok") {
          const message = (result && result.message) || "unknown error";
          ops.showToast(t("toastSaveFailed") + message, { error: true });
          return;
        }
        // The controller has already activated and committed this theme before
        // returning ok. Mirror that acknowledged result into the renderer's
        // metadata cache so opening the detail does not depend on a second IPC
        // fetch that can fail independently.
        const activeEntry = mirrorThemeSelectionResult(theme.id, result);
        customizingThemeId = supportsThemeCustomization(activeEntry) ? theme.id : null;
      })
      .catch((err) => {
        if (requestSeq !== customizationSelectionSeq) return;
        const message = (err && err.message) || "unknown error";
        ops.showToast(t("toastSaveFailed") + message, { error: true });
      })
      .finally(() => {
        if (requestSeq !== customizationSelectionSeq) return;
        customizationSelectionPendingThemeId = null;
        if (state.activeTab === "theme") ops.requestRender({ content: true });
      });
  }

  function closeThemeCustomization() {
    customizingThemeId = null;
    ops.requestRender({ content: true });
  }

  function renderThemeDetail(parent, theme) {
    const back = document.createElement("button");
    back.type = "button";
    back.className = "theme-detail-back";
    back.textContent = `\u2039 ${t("themeBackToPets")}`;
    back.addEventListener("click", closeThemeCustomization);
    parent.appendChild(back);

    const hero = document.createElement("div");
    hero.className = "theme-detail-hero";
    const preview = document.createElement("div");
    preview.className = "theme-thumb theme-detail-preview";
    if (theme.previewFileUrl || getCodexPetPreviewAtlasUrl(theme)) {
      preview.appendChild(buildThemePreviewMedia(theme));
    } else {
      const glyph = document.createElement("span");
      glyph.className = "theme-thumb-empty";
      glyph.textContent = t("themeThumbMissing");
      preview.appendChild(glyph);
    }
    hero.appendChild(preview);

    const heading = document.createElement("div");
    heading.className = "theme-detail-heading";
    const h1 = document.createElement("h1");
    h1.textContent = localizeField(theme.name) || theme.id;
    heading.appendChild(h1);
    const current = document.createElement("div");
    current.className = "theme-detail-current";
    current.textContent = t("themeActiveIndicator");
    heading.appendChild(current);
    hero.appendChild(heading);
    parent.appendChild(hero);

    const section = document.createElement("section");
    section.className = "section theme-detail-section";
    const title = document.createElement("h2");
    title.textContent = t("themeAppearanceTitle");
    section.appendChild(title);
    const caps = theme.capabilities || {};
    if (caps.petTint === true) section.appendChild(buildThemeTintRow(theme));
    if (caps.accessories === true) section.appendChild(buildThemeAccessoryRow(theme));
    parent.appendChild(section);
  }

  function getTintOptions() {
    return Array.isArray(runtime.petTintOptions)
      ? runtime.petTintOptions.filter((entry) => (
        entry
        && typeof entry.id === "string"
        && /^[a-z][a-z0-9-]{0,31}$/.test(entry.id)
        && typeof entry.labelKey === "string"
        && /^[A-Za-z][A-Za-z0-9]{0,63}$/.test(entry.labelKey)
      ))
      : [];
  }

  function getThemeTintId(themeId, options) {
    const selections = state.snapshot && state.snapshot.petTint;
    const value = typeof selections === "string"
      ? selections
      : (selections && typeof selections === "object" ? selections[themeId] : null);
    return options.some((entry) => entry.id === value) ? value : "none";
  }

  function getAccessoryOptions() {
    return Array.isArray(runtime.petAccessoryOptions)
      ? runtime.petAccessoryOptions.filter((entry) => (
        entry
        && typeof entry.id === "string"
        && /^[a-z][a-z0-9-]{0,31}$/.test(entry.id)
        && typeof entry.labelKey === "string"
        && /^[A-Za-z][A-Za-z0-9]{0,63}$/.test(entry.labelKey)
      ))
      : [];
  }

  function getThemeAccessoryId(themeId, options) {
    const selections = state.snapshot && state.snapshot.petAccessory;
    const value = selections && typeof selections === "object" && !Array.isArray(selections)
      ? selections[themeId]
      : null;
    return options.some((entry) => entry.id === value) ? value : "none";
  }

  function buildThemeTintRow(theme) {
    const row = document.createElement("div");
    row.className = "row theme-customization-row";

    const text = document.createElement("div");
    text.className = "row-text";
    const label = document.createElement("span");
    label.className = "row-label";
    label.textContent = t("rowPetColor");
    const desc = document.createElement("span");
    desc.className = "row-desc";
    desc.textContent = t("themePetColorDesc");
    text.appendChild(label);
    text.appendChild(desc);

    const control = document.createElement("div");
    control.className = "row-control";
    const select = document.createElement("select");
    select.className = "pet-tint-select";
    select.setAttribute("aria-label", t("rowPetColor"));
    const options = getTintOptions();
    for (const entry of options) {
      const option = document.createElement("option");
      option.value = entry.id;
      option.textContent = t(entry.labelKey);
      select.appendChild(option);
    }
    if (options.length === 0) {
      const option = document.createElement("option");
      option.value = "none";
      option.textContent = t("tintNone");
      select.appendChild(option);
      select.disabled = true;
    }

    function syncFromSnapshot() {
      select.value = getThemeTintId(theme.id, options);
      select.classList.remove("pending");
      select.disabled = options.length === 0;
    }

    select.addEventListener("change", () => {
      if (select.disabled || select.classList.contains("pending")) return;
      const next = select.value;
      const committed = getThemeTintId(theme.id, options);
      if (next === committed) return;
      const current = state.snapshot && state.snapshot.petTint;
      const nextMap = current && typeof current === "object" && !Array.isArray(current)
        ? { ...current }
        : {};
      if (next === "none") delete nextMap[theme.id];
      else nextMap[theme.id] = next;
      select.classList.add("pending");
      select.disabled = true;
      Promise.resolve(window.settingsAPI.update("petTint", nextMap))
        .then((result) => {
          if (result && result.status === "ok") return;
          const message = (result && result.message) || "unknown error";
          ops.showToast(t("toastSaveFailed") + message, { error: true });
          syncFromSnapshot();
        })
        .catch((err) => {
          const message = (err && err.message) || "unknown error";
          ops.showToast(t("toastSaveFailed") + message, { error: true });
          syncFromSnapshot();
        })
        .finally(() => {
          if (document.body.contains(select)) {
            select.classList.remove("pending");
            select.disabled = options.length === 0;
          }
        });
    });

    control.appendChild(select);
    row.appendChild(text);
    row.appendChild(control);
    syncFromSnapshot();
    return row;
  }

  function buildThemeAccessoryRow(theme) {
    const row = document.createElement("div");
    row.className = "row theme-customization-row";

    const text = document.createElement("div");
    text.className = "row-text";
    const label = document.createElement("span");
    label.className = "row-label";
    label.textContent = t("rowPetAccessory");
    const desc = document.createElement("span");
    desc.className = "row-desc";
    desc.textContent = t("themePetAccessoryDesc");
    text.appendChild(label);
    text.appendChild(desc);

    const control = document.createElement("div");
    control.className = "row-control";
    const select = document.createElement("select");
    select.className = "pet-accessory-select";
    select.setAttribute("aria-label", t("rowPetAccessory"));
    const options = getAccessoryOptions();
    for (const entry of options) {
      const option = document.createElement("option");
      option.value = entry.id;
      option.textContent = t(entry.labelKey);
      select.appendChild(option);
    }
    if (options.length === 0) {
      const option = document.createElement("option");
      option.value = "none";
      option.textContent = t("accessoryNone");
      select.appendChild(option);
      select.disabled = true;
    }

    function syncFromSnapshot() {
      select.value = getThemeAccessoryId(theme.id, options);
      select.classList.remove("pending");
      select.disabled = options.length === 0;
    }

    select.addEventListener("change", () => {
      if (select.disabled || select.classList.contains("pending")) return;
      const next = select.value;
      const committed = getThemeAccessoryId(theme.id, options);
      if (next === committed) return;
      const current = state.snapshot && state.snapshot.petAccessory;
      const nextMap = current && typeof current === "object" && !Array.isArray(current)
        ? { ...current }
        : {};
      if (next === "none") delete nextMap[theme.id];
      else nextMap[theme.id] = next;
      select.classList.add("pending");
      select.disabled = true;
      Promise.resolve(window.settingsAPI.update("petAccessory", nextMap))
        .then((result) => {
          if (result && result.status === "ok") return;
          const message = (result && result.message) || "unknown error";
          ops.showToast(t("toastSaveFailed") + message, { error: true });
          syncFromSnapshot();
        })
        .catch((err) => {
          const message = (err && err.message) || "unknown error";
          ops.showToast(t("toastSaveFailed") + message, { error: true });
          syncFromSnapshot();
        })
        .finally(() => {
          if (document.body.contains(select)) {
            select.classList.remove("pending");
            select.disabled = options.length === 0;
          }
        });
    });

    control.appendChild(select);
    row.appendChild(text);
    row.appendChild(control);
    syncFromSnapshot();
    return row;
  }

  function localizeStageName(name) {
    if (typeof name === "string") return name;
    if (!name || typeof name !== "object") return "";
    const lang = (readers && typeof readers.getLang === "function")
      ? readers.getLang()
      : "en";
    if (typeof name[lang] === "string") return name[lang];
    if (typeof name.en === "string") return name.en;
    if (typeof name.zh === "string") return name.zh;
    const first = Object.values(name).find((value) => typeof value === "string");
    return first || "";
  }

  function buildMeritCultivatorPanel(theme) {
    const panel = document.createElement("section");
    panel.className = "merit-panel";
    panel.setAttribute("aria-labelledby", "merit-panel-title");

    const title = document.createElement("h2");
    title.id = "merit-panel-title";
    title.className = "theme-section-title";
    title.textContent = t("meritPanelTitle");
    panel.appendChild(title);

    const disclaimer = document.createElement("p");
    disclaimer.className = "merit-disclaimer";
    disclaimer.textContent = t("meritCulturalDisclaimer");
    panel.appendChild(disclaimer);

    const statusBox = document.createElement("div");
    statusBox.className = "merit-status-box";
    statusBox.textContent = t("meritStatusLoading");
    panel.appendChild(statusBox);

    const overlayRow = document.createElement("label");
    overlayRow.className = "merit-toggle-row";
    const overlayInput = document.createElement("input");
    overlayInput.type = "checkbox";
    overlayInput.checked = state.snapshot
      ? state.snapshot.meritOverlayEnabled !== false
      : true;
    const overlayText = document.createElement("span");
    overlayText.textContent = t("meritOverlayToggle");
    overlayRow.appendChild(overlayInput);
    overlayRow.appendChild(overlayText);
    overlayInput.addEventListener("change", () => {
      if (!window.settingsAPI || typeof window.settingsAPI.update !== "function") return;
      const next = !!overlayInput.checked;
      window.settingsAPI.update("meritOverlayEnabled", next).then((result) => {
        if (!result || result.status !== "ok") {
          overlayInput.checked = !next;
          ops.showToast(t("toastSaveFailed") + ((result && result.message) || ""), { error: true });
        }
      }).catch((err) => {
        overlayInput.checked = !next;
        ops.showToast(t("toastSaveFailed") + (err && err.message), { error: true });
      });
    });
    panel.appendChild(overlayRow);

    const meritStages = theme.capabilities.meritCultivator.stages || [];
    if (meritStages.length > 0) {
      panel.appendChild(buildMeritDebugStageRow(theme, meritStages));
      panel.appendChild(buildMeritKnockButton(theme, meritStages));
    }

    const resetBtn = document.createElement("button");
    resetBtn.type = "button";
    resetBtn.className = "soft-btn settings-confirm-danger";
    resetBtn.textContent = t("meritResetButton");
    resetBtn.addEventListener("click", () => handleResetMeritProgress(theme));
    panel.appendChild(resetBtn);

    if (window.settingsAPI && typeof window.settingsAPI.getMeritStatus === "function") {
      window.settingsAPI.getMeritStatus().then((status) => {
        if (!status || !status.enabled) {
          statusBox.textContent = t("meritStatusInactive");
          return;
        }
        const stageName = status.stageNameText || localizeStageName(status.stageName) || status.stageId || "";
        const next = Number.isFinite(status.nextRequiredMerit)
          ? Math.max(0, status.nextRequiredMerit - (status.merit || 0))
          : null;
        const lines = [
          `${t("meritStatusStage")}: ${stageName}`,
          `${t("meritStatusTotal")}: ${Math.floor(status.merit || 0)}`,
          next == null ? t("meritStatusMaxStage") : `${t("meritStatusToNext")}: ${next}`,
          `${t("meritStatusStreak")}: ${Math.floor(status.streakDays || 0)}`,
        ];
        statusBox.textContent = lines.join("\n");
      }).catch(() => {
        statusBox.textContent = t("meritStatusInactive");
      });
    }

    return panel;
  }

  function buildMeritDebugStageRow(theme, stages) {
    const row = document.createElement("div");
    row.className = "merit-debug-row";

    const label = document.createElement("label");
    label.className = "merit-debug-label";
    label.textContent = t("meritDebugStageLabel");
    row.appendChild(label);

    const hint = document.createElement("p");
    hint.className = "merit-debug-hint";
    hint.textContent = t("meritDebugStageHint");
    row.appendChild(hint);

    const select = document.createElement("select");
    select.className = "merit-debug-select";

    const autoOpt = document.createElement("option");
    autoOpt.value = "auto";
    autoOpt.textContent = t("meritDebugStageAuto");
    select.appendChild(autoOpt);

    for (const stage of stages) {
      const opt = document.createElement("option");
      opt.value = stage.id;
      opt.textContent = localizeStageName(stage.name) || stage.id;
      select.appendChild(opt);
    }

    const bucket = state.snapshot && state.snapshot.meritProgress
      ? state.snapshot.meritProgress[theme.id]
      : null;
    const currentDebug = bucket && bucket.debugStageId;
    select.value = currentDebug || "auto";

    select.addEventListener("change", () => {
      if (!window.settingsAPI || typeof window.settingsAPI.command !== "function") return;
      const stageId = select.value;
      const prevValue = currentDebug || "auto";
      select.disabled = true;
      window.settingsAPI.command("previewMeritStage", {
        themeId: theme.id,
        stageId,
      }).then((result) => {
        select.disabled = false;
        if (!result || result.status !== "ok") {
          select.value = prevValue;
          ops.showToast(t("toastSaveFailed") + ((result && result.message) || ""), { error: true });
          return;
        }
        ops.showToast(t("meritDebugStageApplied"));
        if (state.activeTab === "theme") ops.requestRender({ content: true });
      }).catch((err) => {
        select.disabled = false;
        select.value = prevValue;
        ops.showToast(t("toastSaveFailed") + (err && err.message), { error: true });
      });
    });

    row.appendChild(select);
    return row;
  }

  function resolveMeritDebugStageId(theme, stages) {
    const bucket = state.snapshot && state.snapshot.meritProgress
      ? state.snapshot.meritProgress[theme.id]
      : null;
    if (bucket && typeof bucket.debugStageId === "string" && bucket.debugStageId) {
      if (stages.some((entry) => entry.id === bucket.debugStageId)) {
        return bucket.debugStageId;
      }
    }
    return null;
  }

  function buildMeritKnockButton(theme, stages) {
    const wrap = document.createElement("div");
    wrap.className = "merit-debug-row";

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "soft-btn";
    btn.textContent = t("meritKnockButton");
    btn.addEventListener("click", () => {
      if (!window.settingsAPI || typeof window.settingsAPI.previewAnimationOverride !== "function") {
        ops.showToast(t("toastSaveFailed") + "preview unavailable", { error: true });
        return;
      }
      const debugStageId = resolveMeritDebugStageId(theme, stages);
      const fetchStage = window.settingsAPI.getMeritStatus
        ? window.settingsAPI.getMeritStatus()
        : Promise.resolve(null);
      btn.disabled = true;
      fetchStage.then((status) => {
        const stageId = debugStageId
          || (status && status.stageId)
          || (stages[0] && stages[0].id)
          || "mortal";
        const file = `${stageId}-working.svg`;
        return window.settingsAPI.previewAnimationOverride({
          stateKey: "working",
          file,
          durationMs: 4000,
        }).then((result) => {
          if (!result || result.status !== "ok") {
            ops.showToast(t("toastSaveFailed") + ((result && result.message) || ""), { error: true });
            return;
          }
          ops.showToast(t("meritKnockApplied"));
        });
      }).catch((err) => {
        ops.showToast(t("toastSaveFailed") + (err && err.message), { error: true });
      }).finally(() => {
        btn.disabled = false;
      });
    });
    wrap.appendChild(btn);
    return wrap;
  }

  function handleResetMeritProgress(theme) {
    if (!window.settingsAPI || typeof window.settingsAPI.command !== "function") return;
    const run = () => {
      window.settingsAPI.command("resetMeritProgress", { confirmed: true, themeId: theme && theme.id })
        .then((result) => {
          if (!result || result.status !== "ok") {
            ops.showToast(t("toastSaveFailed") + ((result && result.message) || ""), { error: true });
            return;
          }
          ops.showToast(t("meritResetDone"));
          if (state.activeTab === "theme") ops.requestRender({ content: true });
        })
        .catch((err) => {
          ops.showToast(t("toastSaveFailed") + (err && err.message), { error: true });
        });
    };

    if (typeof ops.showSettingsConfirmModal === "function") {
      ops.showSettingsConfirmModal({
        title: t("meritResetConfirmTitle"),
        detail: t("meritResetConfirmDetail"),
        actions: [
          { id: "cancel", label: t("meritResetCancel") },
          { id: "confirm", label: t("meritResetConfirm"), tone: "danger" },
        ],
      }).then((actionId) => {
        if (actionId === "confirm") run();
      });
      return;
    }
    if (window.confirm(t("meritResetConfirmDetail"))) run();
  }

  function buildThemeActions() {
    const row = document.createElement("div");
    row.className = "theme-actions";

    const codexGroup = buildThemeActionGroup(t("themeActionGroupCodexPets"));
    const importBtn = document.createElement("button");
    importBtn.type = "button";
    importBtn.className = "soft-btn";
    importBtn.textContent = t("themeImportPetZip");
    importBtn.disabled = !!runtime.codexPetZipImportPending
      || !window.settingsAPI
      || typeof window.settingsAPI.importCodexPetZip !== "function";
    if (runtime.codexPetZipImportPending) importBtn.classList.add("pending");
    importBtn.addEventListener("click", handleImportCodexPetZip);
    codexGroup.buttons.appendChild(importBtn);

    const refreshBtn = document.createElement("button");
    refreshBtn.type = "button";
    refreshBtn.className = "soft-btn";
    refreshBtn.textContent = t("themeRefreshImportedPets");
    refreshBtn.disabled = !!runtime.codexPetsRefreshPending
      || !window.settingsAPI
      || typeof window.settingsAPI.refreshCodexPets !== "function";
    if (runtime.codexPetsRefreshPending) refreshBtn.classList.add("pending");
    refreshBtn.addEventListener("click", handleRefreshCodexPets);
    codexGroup.buttons.appendChild(refreshBtn);

    const adoptPetdexBtn = document.createElement("button");
    adoptPetdexBtn.type = "button";
    adoptPetdexBtn.className = "soft-btn";
    adoptPetdexBtn.textContent = t("themeAdoptPetdex");
    adoptPetdexBtn.title = t("themeAdoptPetdexHint");
    adoptPetdexBtn.disabled = !!runtime.petdexAdoptPending
      || !window.settingsAPI
      || typeof window.settingsAPI.adoptPetdexPet !== "function"
      || typeof window.settingsAPI.browsePetdexPets !== "function";
    if (runtime.petdexAdoptPending) adoptPetdexBtn.classList.add("pending");
    adoptPetdexBtn.addEventListener("click", handleAdoptPetdexPet);
    codexGroup.buttons.appendChild(adoptPetdexBtn);
    row.appendChild(codexGroup.group);

    const userThemeGroup = buildThemeActionGroup(t("themeActionGroupUserThemes"));
    const importThemeBtn = document.createElement("button");
    importThemeBtn.type = "button";
    importThemeBtn.className = "soft-btn";
    importThemeBtn.textContent = t("themeImportUserThemeZip");
    importThemeBtn.title = t("themeImportUserThemeZipHint");
    importThemeBtn.disabled = !!runtime.userThemeZipImportPending
      || !window.settingsAPI
      || typeof window.settingsAPI.importUserThemeZip !== "function";
    if (runtime.userThemeZipImportPending) importThemeBtn.classList.add("pending");
    importThemeBtn.addEventListener("click", handleImportUserThemeZip);
    userThemeGroup.buttons.appendChild(importThemeBtn);

    const userThemeFolderBtn = document.createElement("button");
    userThemeFolderBtn.type = "button";
    userThemeFolderBtn.className = "soft-btn";
    userThemeFolderBtn.textContent = t("themeOpenUserThemesFolder");
    userThemeFolderBtn.disabled = !window.settingsAPI
      || typeof window.settingsAPI.openUserThemesDir !== "function";
    userThemeFolderBtn.addEventListener("click", handleOpenUserThemesFolder);
    userThemeGroup.buttons.appendChild(userThemeFolderBtn);

    const refreshThemesBtn = document.createElement("button");
    refreshThemesBtn.type = "button";
    refreshThemesBtn.className = "soft-btn";
    refreshThemesBtn.textContent = t("themeRefreshThemes");
    refreshThemesBtn.disabled = !window.settingsAPI
      || typeof window.settingsAPI.listThemes !== "function";
    refreshThemesBtn.addEventListener("click", handleRefreshThemes);
    userThemeGroup.buttons.appendChild(refreshThemesBtn);
    row.appendChild(userThemeGroup.group);

    return row;
  }

  function buildThemeActionGroup(title) {
    const group = document.createElement("div");
    group.className = "theme-action-group";
    const label = document.createElement("div");
    label.className = "theme-action-label";
    label.textContent = title;
    group.appendChild(label);
    const buttons = document.createElement("div");
    buttons.className = "theme-action-buttons";
    group.appendChild(buttons);
    return { group, buttons };
  }

  function stopThemeCardButtonKeydown(ev) {
    ev.stopPropagation();
  }

  function buildThemeCard(theme) {
    const card = document.createElement("div");
    card.className = "theme-card";
    card.setAttribute("role", "radio");
    card.setAttribute("tabindex", "0");
    card.setAttribute("aria-checked", theme.active ? "true" : "false");
    if (theme.active) card.classList.add("active");

    const thumb = document.createElement("div");
    thumb.className = "theme-thumb";
    if (theme.previewFileUrl || getCodexPetPreviewAtlasUrl(theme)) {
      thumb.appendChild(buildThemePreviewMedia(theme));
    } else {
      const glyph = document.createElement("span");
      glyph.className = "theme-thumb-empty";
      glyph.textContent = t("themeThumbMissing");
      thumb.appendChild(glyph);
    }
    card.appendChild(thumb);

    const name = document.createElement("div");
    name.className = "theme-card-name";
    const nameText = document.createElement("span");
    nameText.className = "theme-card-name-text";
    nameText.textContent = localizeField(theme.name) || theme.id;
    name.appendChild(nameText);
    if (theme.builtin) {
      const badge = document.createElement("span");
      badge.className = "theme-card-badge";
      badge.textContent = t("themeBadgeBuiltin");
      name.appendChild(badge);
    }
    if (theme.managedCodexPet) {
      const badge = document.createElement("span");
      badge.className = "theme-card-badge accent";
      badge.textContent = t("themeBadgeCodexPet");
      name.appendChild(badge);
    }
    card.appendChild(name);

    const capLabels = getThemeCapabilityBadgeLabels(theme);
    if (capLabels.length) {
      const caps = document.createElement("div");
      caps.className = "theme-card-capabilities";
      for (const label of capLabels) {
        const badge = document.createElement("span");
        badge.className = "theme-card-badge";
        badge.textContent = label;
        caps.appendChild(badge);
      }
      card.appendChild(caps);
    }

    const canDelete = !theme.builtin && !theme.active && !theme.managedCodexPet;
    const canRemoveCodexPet = !!theme.managedCodexPet;
    const footer = document.createElement("div");
    footer.className = "theme-card-footer";
    const indicator = document.createElement("span");
    indicator.className = "theme-card-check";
    indicator.textContent = theme.active ? t("themeActiveIndicator") : "";
    if (!theme.active) indicator.setAttribute("aria-hidden", "true");
    footer.appendChild(indicator);
    if (supportsThemeCustomization(theme)) {
      const btn = document.createElement("button");
      btn.className = "theme-customize-btn";
      btn.type = "button";
      btn.textContent = `${t("themeCustomize")} \u203a`;
      btn.setAttribute("aria-label", `${t("themeCustomize")}: ${localizeField(theme.name) || theme.id}`);
      btn.disabled = !!customizationSelectionPendingThemeId;
      if (customizationSelectionPendingThemeId === theme.id) btn.classList.add("pending");
      btn.addEventListener("click", (ev) => {
        ev.stopPropagation();
        openThemeCustomization(theme);
      });
      btn.addEventListener("keydown", stopThemeCardButtonKeydown);
      footer.appendChild(btn);
    }
    if (canDelete) {
      const btn = document.createElement("button");
      btn.className = "theme-delete-btn";
      btn.type = "button";
      btn.textContent = "\u{1F5D1}";
      btn.title = t("themeDeleteLabel");
      btn.setAttribute("aria-label", t("themeDeleteLabel"));
      btn.addEventListener("click", (ev) => {
        ev.stopPropagation();
        handleDeleteTheme(theme);
      });
      btn.addEventListener("keydown", stopThemeCardButtonKeydown);
      footer.appendChild(btn);
    }
    if (canRemoveCodexPet) {
      const btn = document.createElement("button");
      btn.className = "theme-uninstall-btn";
      btn.type = "button";
      btn.textContent = t("themeUninstallPetLabel");
      btn.title = t("themeUninstallPetLabel");
      btn.setAttribute("aria-label", t("themeUninstallPetLabel"));
      btn.disabled = runtime.codexPetRemovalPendingThemeId === theme.id;
      btn.addEventListener("click", (ev) => {
        ev.stopPropagation();
        handleRemoveCodexPet(theme);
      });
      btn.addEventListener("keydown", stopThemeCardButtonKeydown);
      footer.appendChild(btn);
    }
    card.appendChild(footer);

    if (!theme.active) {
      helpers.attachActivation(card, () => (
        Promise.resolve(window.settingsAPI.command("setThemeSelection", { themeId: theme.id }))
          .then((result) => {
            if (result && result.status === "ok") {
              mirrorThemeSelectionResult(theme.id, result);
              if (state.activeTab === "theme") ops.requestRender({ content: true });
            }
            return result;
          })
      ));
    }
    return card;
  }

  function formatCodexPetsRefreshOk(result) {
    const summary = (result && result.summary) || {};
    const formatter = t("toastCodexPetsRefreshOk");
    if (typeof formatter === "function") {
      return formatter(
        summary.imported || 0,
        summary.updated || 0,
        summary.unchanged || 0,
        summary.removed || 0,
        summary.invalid || 0,
        !!(result && result.switchedToFallback)
      );
    }
    return String(formatter);
  }

  function formatCodexPetsRefreshFailed(message) {
    const formatter = t("toastCodexPetsRefreshFailed");
    if (typeof formatter === "function") return formatter(message || "unknown error");
    return String(formatter) + (message || "unknown error");
  }

  function handleRefreshCodexPets() {
    if (!window.settingsAPI || typeof window.settingsAPI.refreshCodexPets !== "function") return;
    runtime.codexPetsRefreshPending = true;
    if (state.activeTab === "theme") ops.requestRender({ content: true });
    window.settingsAPI.refreshCodexPets()
      .then((result) => {
        if (!result || result.status !== "ok") {
          ops.showToast(formatCodexPetsRefreshFailed(result && result.message), { error: true });
          return null;
        }
        ops.showToast(formatCodexPetsRefreshOk(result));
        return ops.fetchThemes().then(() => {
          if (state.activeTab === "theme") ops.requestRender({ content: true });
        });
      })
      .catch((err) => {
        ops.showToast(formatCodexPetsRefreshFailed(err && err.message), { error: true });
      })
      .finally(() => {
        runtime.codexPetsRefreshPending = false;
        if (state.activeTab === "theme") ops.requestRender({ content: true });
      });
  }

  function handleOpenUserThemesFolder() {
    if (!window.settingsAPI || typeof window.settingsAPI.openUserThemesDir !== "function") return;
    window.settingsAPI.openUserThemesDir()
      .then((result) => {
        if (!result || result.status !== "ok") {
          ops.showToast(t("toastUserThemesFolderFailed") + ((result && result.message) || "unknown error"), { error: true });
        }
      })
      .catch((err) => {
        ops.showToast(t("toastUserThemesFolderFailed") + (err && err.message), { error: true });
      });
  }

  function handleRefreshThemes() {
    ops.fetchThemes().then(() => {
      if (state.activeTab === "theme") ops.requestRender({ content: true });
    });
  }

  function formatUserThemeZipImportOk(result) {
    const formatter = t("toastUserThemeZipImportOk");
    const name = localizeField(result && result.name) || (result && result.themeId) || "theme";
    let message = typeof formatter === "function" ? formatter(name) : String(formatter);
    if (result && (result.rive || result.renderBackend === "rive")) {
      const warn = t("toastUserThemeZipImportRiveWarning");
      if (warn) message = `${message} ${warn}`;
    }
    if (result && (result.sandbox || result.renderBackend === "sandbox")) {
      const warn = t("toastUserThemeZipImportSandboxWarning");
      if (warn) message = `${message} ${warn}`;
    }
    return message;
  }

  function formatUserThemeZipImportFailed(message) {
    const formatter = t("toastUserThemeZipImportFailed");
    if (typeof formatter === "function") return formatter(message || "unknown error");
    return String(formatter) + (message || "unknown error");
  }

  function handleImportUserThemeZip() {
    if (!window.settingsAPI || typeof window.settingsAPI.importUserThemeZip !== "function") return;
    runtime.userThemeZipImportPending = true;
    if (state.activeTab === "theme") ops.requestRender({ content: true });
    window.settingsAPI.importUserThemeZip()
      .then((result) => {
        if (!result || result.status === "cancel") return null;
        if (result.status !== "ok") {
          ops.showToast(formatUserThemeZipImportFailed(result && result.message), { error: true });
          return null;
        }
        ops.showToast(formatUserThemeZipImportOk(result));
        return ops.fetchThemes().then(() => {
          if (state.activeTab === "theme") ops.requestRender({ content: true });
        });
      })
      .catch((err) => {
        ops.showToast(formatUserThemeZipImportFailed(err && err.message), { error: true });
      })
      .finally(() => {
        runtime.userThemeZipImportPending = false;
        if (state.activeTab === "theme") ops.requestRender({ content: true });
      });
  }

  function formatCodexPetZipImportOk(result) {
    const imported = result && result.imported;
    const name = imported && (imported.displayName || imported.id);
    const formatter = t("toastCodexPetZipImportOk");
    if (typeof formatter === "function") return formatter(name || "Codex Pet");
    return String(formatter);
  }

  function formatCodexPetZipImportFailed(message) {
    const formatter = t("toastCodexPetZipImportFailed");
    if (typeof formatter === "function") return formatter(message || "unknown error");
    return String(formatter) + (message || "unknown error");
  }

  function handleImportCodexPetZip() {
    if (!window.settingsAPI || typeof window.settingsAPI.importCodexPetZip !== "function") return;
    runtime.codexPetZipImportPending = true;
    if (state.activeTab === "theme") ops.requestRender({ content: true });
    window.settingsAPI.importCodexPetZip()
      .then((result) => {
        if (!result || result.status === "cancel") return null;
        if (result.status !== "ok") {
          ops.showToast(formatCodexPetZipImportFailed(result && result.message), { error: true });
          return null;
        }
        ops.showToast(formatCodexPetZipImportOk(result));
        return ops.fetchThemes().then(() => {
          if (state.activeTab === "theme") ops.requestRender({ content: true });
        });
      })
      .catch((err) => {
        ops.showToast(formatCodexPetZipImportFailed(err && err.message), { error: true });
      })
      .finally(() => {
        runtime.codexPetZipImportPending = false;
        if (state.activeTab === "theme") ops.requestRender({ content: true });
      });
  }

  function formatPetdexBrowseFailed(message) {
    const formatter = t("themePetdexBrowseFailed");
    return typeof formatter === "function" ? formatter(message || "") : `Couldn't load Petdex catalog: ${message || ""}`;
  }

  function restorePetdexModalHook() {
    if (!renderHooksRef) return;
    if (runtime.petdexModalPrevModalHook) {
      renderHooksRef.modal = runtime.petdexModalPrevModalHook;
      runtime.petdexModalPrevModalHook = null;
    }
  }

  function closePetdexModal() {
    const modalState = runtime.petdexModal;
    if (modalState && modalState.searchTimer) clearTimeout(modalState.searchTimer);
    runtime.petdexModal = null;
    restorePetdexModalHook();
    ops.requestRender({ modal: true });
  }

  function fetchPetdexBrowse(query) {
    if (!runtime.petdexModal || !window.settingsAPI || typeof window.settingsAPI.browsePetdexPets !== "function") return;
    runtime.petdexModal.loading = true;
    runtime.petdexModal.error = null;
    if (state.activeTab === "theme") ops.requestRender({ modal: true });
    window.settingsAPI.browsePetdexPets(query)
      .then((result) => {
        if (!runtime.petdexModal) return;
        if (!result || result.status !== "ok") {
          runtime.petdexModal.pets = [];
          runtime.petdexModal.error = (result && result.message) || "unknown error";
          return;
        }
        runtime.petdexModal.pets = Array.isArray(result.pets) ? result.pets : [];
        const selectedSlug = runtime.petdexModal.selectedSlug;
        if (selectedSlug && !runtime.petdexModal.pets.some((pet) => pet.slug === selectedSlug)) {
          runtime.petdexModal.selectedSlug = runtime.petdexModal.pets[0] ? runtime.petdexModal.pets[0].slug : null;
        } else if (!selectedSlug && runtime.petdexModal.pets[0]) {
          runtime.petdexModal.selectedSlug = runtime.petdexModal.pets[0].slug;
        }
      })
      .catch((err) => {
        if (!runtime.petdexModal) return;
        runtime.petdexModal.pets = [];
        runtime.petdexModal.error = err && err.message ? err.message : String(err);
      })
      .finally(() => {
        if (!runtime.petdexModal) return;
        runtime.petdexModal.loading = false;
        if (state.activeTab === "theme") ops.requestRender({ modal: true });
      });
  }

  function schedulePetdexSearch(query) {
    if (!runtime.petdexModal) return;
    if (runtime.petdexModal.searchTimer) clearTimeout(runtime.petdexModal.searchTimer);
    runtime.petdexModal.searchTimer = setTimeout(() => {
      runtime.petdexModal.searchTimer = null;
      fetchPetdexBrowse(query);
    }, 250);
  }

  function buildPetdexAtlasThumb(spritesheetUrl) {
    const frame = document.createElement("span");
    frame.className = "petdex-modal-atlas-frame";

    const img = document.createElement("img");
    img.src = spritesheetUrl;
    img.alt = "";
    img.loading = "lazy";
    img.referrerPolicy = "no-referrer";
    img.draggable = false;
    img.addEventListener("error", () => {
      frame.remove();
    });
    frame.appendChild(img);
    return frame;
  }

  function renderPetdexModal() {
    const rootNode = document.getElementById("modalRoot");
    if (!rootNode || !runtime.petdexModal) return;
    const modalState = runtime.petdexModal;
    rootNode.innerHTML = "";

    const overlay = document.createElement("div");
    overlay.className = "modal-backdrop";
    overlay.addEventListener("click", (ev) => {
      if (ev.target === overlay && !runtime.petdexAdoptPending) closePetdexModal();
    });

    const modal = document.createElement("div");
    modal.className = "asset-picker-modal petdex-modal";

    const title = document.createElement("h2");
    title.textContent = t("themeAdoptPetdex");
    modal.appendChild(title);

    const subtitle = document.createElement("p");
    subtitle.className = "subtitle";
    subtitle.textContent = t("themeAdoptPetdexHint");
    modal.appendChild(subtitle);

    const toolbar = document.createElement("div");
    toolbar.className = "asset-picker-toolbar petdex-modal-toolbar";
    const searchInput = document.createElement("input");
    searchInput.type = "search";
    searchInput.className = "petdex-search-input";
    searchInput.placeholder = t("themePetdexModalSearch");
    searchInput.value = modalState.query || "";
    searchInput.disabled = !!runtime.petdexAdoptPending;
    searchInput.addEventListener("input", () => {
      if (!runtime.petdexModal) return;
      runtime.petdexModal.query = searchInput.value;
      schedulePetdexSearch(searchInput.value.trim());
    });
    toolbar.appendChild(searchInput);

    const openSiteBtn = document.createElement("button");
    openSiteBtn.type = "button";
    openSiteBtn.className = "soft-btn";
    openSiteBtn.textContent = t("themePetdexOpenSite");
    openSiteBtn.disabled = !!runtime.petdexAdoptPending;
    openSiteBtn.addEventListener("click", () => helpers.openExternalSafe("https://petdex.dev"));
    toolbar.appendChild(openSiteBtn);
    modal.appendChild(toolbar);

    const list = document.createElement("div");
    list.className = "asset-picker-list petdex-modal-list";
    if (modalState.loading) {
      const loading = document.createElement("div");
      loading.className = "placeholder-desc";
      loading.textContent = t("themePetdexModalLoading");
      list.appendChild(loading);
    } else if (modalState.error) {
      const errorNode = document.createElement("div");
      errorNode.className = "placeholder-desc";
      errorNode.textContent = formatPetdexBrowseFailed(modalState.error);
      list.appendChild(errorNode);
    } else if (!modalState.pets || !modalState.pets.length) {
      const empty = document.createElement("div");
      empty.className = "placeholder-desc";
      empty.textContent = t("themePetdexModalEmpty");
      list.appendChild(empty);
    } else {
      for (const pet of modalState.pets) {
        const item = document.createElement("button");
        item.type = "button";
        item.className = "asset-picker-item petdex-modal-item"
          + (modalState.selectedSlug === pet.slug ? " active" : "");
        item.disabled = !!runtime.petdexAdoptPending;

        if (pet.spritesheetUrl) {
          item.appendChild(buildPetdexAtlasThumb(pet.spritesheetUrl));
        }

        const meta = document.createElement("div");
        meta.className = "petdex-modal-meta";
        const nameNode = document.createElement("div");
        nameNode.className = "petdex-modal-name";
        nameNode.textContent = pet.displayName || pet.slug;
        meta.appendChild(nameNode);
        const slugNode = document.createElement("div");
        slugNode.className = "petdex-modal-slug";
        slugNode.textContent = pet.slug;
        meta.appendChild(slugNode);
        item.appendChild(meta);

        item.addEventListener("click", () => {
          if (!runtime.petdexModal || runtime.petdexAdoptPending) return;
          runtime.petdexModal.selectedSlug = pet.slug;
          renderPetdexModal();
        });
        list.appendChild(item);
      }
    }
    modal.appendChild(list);

    const footer = document.createElement("div");
    footer.className = "asset-picker-footer";
    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.className = "soft-btn";
    cancelBtn.textContent = t("themePetdexModalCancel");
    cancelBtn.disabled = !!runtime.petdexAdoptPending;
    cancelBtn.addEventListener("click", closePetdexModal);
    footer.appendChild(cancelBtn);

    const adoptBtn = document.createElement("button");
    adoptBtn.type = "button";
    adoptBtn.className = "soft-btn accent";
    adoptBtn.textContent = t("themePetdexModalAdopt");
    adoptBtn.disabled = !!runtime.petdexAdoptPending
      || modalState.loading
      || !modalState.selectedSlug;
    if (runtime.petdexAdoptPending) adoptBtn.classList.add("pending");
    adoptBtn.addEventListener("click", () => {
      if (!modalState.selectedSlug) return;
      adoptPetdexSlug(modalState.selectedSlug, { closeModalOnSuccess: true });
    });
    footer.appendChild(adoptBtn);
    modal.appendChild(footer);

    overlay.appendChild(modal);
    rootNode.appendChild(overlay);
    if (!modalState.loading) searchInput.focus();
  }

  function openPetdexAdoptModal() {
    if (runtime.petdexModal || runtime.petdexAdoptPending) return;
    if (!window.settingsAPI || typeof window.settingsAPI.browsePetdexPets !== "function") return;
    runtime.petdexModal = {
      query: "",
      pets: [],
      loading: true,
      error: null,
      selectedSlug: null,
      searchTimer: null,
    };
    if (renderHooksRef) {
      runtime.petdexModalPrevModalHook = renderHooksRef.modal;
      renderHooksRef.modal = function renderThemeModalHook() {
        if (runtime.petdexModal) {
          renderPetdexModal();
          return;
        }
        if (typeof runtime.petdexModalPrevModalHook === "function") runtime.petdexModalPrevModalHook();
      };
    }
    fetchPetdexBrowse("");
    ops.requestRender({ modal: true });
  }

  function formatPetdexAdoptOk(result) {
    const imported = result && result.imported;
    const name = (imported && (imported.displayName || imported.slug || imported.id)) || "";
    const formatter = t("toastPetdexAdoptOk");
    return typeof formatter === "function" ? formatter(name) : `Adopted "${name}" from Petdex.`;
  }

  function formatPetdexAdoptFailed(message) {
    const formatter = t("toastPetdexAdoptFailed");
    return typeof formatter === "function" ? formatter(message || "") : `Couldn't adopt Petdex pet: ${message || ""}`;
  }

  function adoptPetdexSlug(slug, options = {}) {
    const trimmed = String(slug || "").trim();
    if (!trimmed) return;
    if (!window.settingsAPI || typeof window.settingsAPI.adoptPetdexPet !== "function") return;
    if (runtime.petdexAdoptPending) return;

    runtime.petdexAdoptPending = true;
    if (state.activeTab === "theme") ops.requestRender({ content: true, modal: true });
    window.settingsAPI.adoptPetdexPet(trimmed)
      .then((result) => {
        if (!result || result.status === "cancel") return null;
        if (result.status !== "ok") {
          ops.showToast(formatPetdexAdoptFailed(result && result.message), { error: true });
          return null;
        }
        ops.showToast(formatPetdexAdoptOk(result));
        if (options.closeModalOnSuccess) closePetdexModal();
        return ops.fetchThemes().then(() => {
          if (state.activeTab === "theme") ops.requestRender({ content: true });
        });
      })
      .catch((err) => {
        ops.showToast(formatPetdexAdoptFailed(err && err.message), { error: true });
      })
      .finally(() => {
        runtime.petdexAdoptPending = false;
        if (state.activeTab === "theme") ops.requestRender({ content: true, modal: !!runtime.petdexModal });
      });
  }

  function handleAdoptPetdexPet() {
    openPetdexAdoptModal();
  }

  function onExit() {
    customizationSelectionSeq += 1;
    customizingThemeId = null;
    customizationSelectionPendingThemeId = null;
    closePetdexModal();
  }

  function formatCodexPetRemoveOk(result) {
    const removed = result && result.removed;
    const name = removed && (removed.displayName || removed.id);
    const formatter = t("toastCodexPetRemoveOk");
    if (typeof formatter === "function") return formatter(name || "Codex Pet", !!(result && result.switchedToFallback));
    return String(formatter);
  }

  function formatCodexPetRemoveFailed(message) {
    const formatter = t("toastCodexPetRemoveFailed");
    if (typeof formatter === "function") return formatter(message || "unknown error");
    return String(formatter) + (message || "unknown error");
  }

  function handleRemoveCodexPet(theme) {
    if (!window.settingsAPI || typeof window.settingsAPI.removeCodexPet !== "function") return;
    runtime.codexPetRemovalPendingThemeId = theme.id;
    if (state.activeTab === "theme") ops.requestRender({ content: true });
    window.settingsAPI.removeCodexPet(theme.id)
      .then((result) => {
        if (!result || result.status === "cancel") return null;
        if (result.status !== "ok") {
          ops.showToast(formatCodexPetRemoveFailed(result && result.message), { error: true });
          return null;
        }
        ops.showToast(formatCodexPetRemoveOk(result));
        return ops.fetchThemes().then(() => {
          if (state.activeTab === "theme") ops.requestRender({ content: true });
        });
      })
      .catch((err) => {
        ops.showToast(formatCodexPetRemoveFailed(err && err.message), { error: true });
      })
      .finally(() => {
        runtime.codexPetRemovalPendingThemeId = null;
        if (state.activeTab === "theme") ops.requestRender({ content: true });
      });
  }

  function handleDeleteTheme(theme) {
    if (!window.settingsAPI) return;
    window.settingsAPI
      .confirmRemoveTheme(theme.id)
      .then((res) => {
        if (!res || !res.confirmed) return null;
        return window.settingsAPI.command("removeTheme", theme.id);
      })
      .then((result) => {
        if (result == null) return;
        if (result.status !== "ok") {
          const msg = (result && result.message) || "unknown error";
          ops.showToast(t("toastThemeDeleteFailed") + msg, { error: true });
          return;
        }
        ops.showToast(t("toastThemeDeleted"));
        ops.fetchThemes().then(() => {
          if (state.activeTab === "theme") ops.requestRender({ content: true });
        });
      })
      .catch((err) => {
        ops.showToast(t("toastThemeDeleteFailed") + (err && err.message), { error: true });
      });
  }

  function init(core) {
    state = core.state;
    runtime = core.runtime;
    helpers = core.helpers;
    ops = core.ops;
    readers = core.readers;
    renderHooksRef = core.renderHooks;
    core.tabs.theme = {
      render,
      onExit,
    };
  }

  root.ClawdSettingsTabTheme = { init };
})(globalThis);
