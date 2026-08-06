// --- Input window: pointer capture, drag, click detection ---
// This is the "controller" — all input decisions happen here.
// Render window is pure "view" — receives reaction commands via IPC relay.

const area = document.getElementById("hit-area");

// ── Theme config (injected via preload-hit.js additionalArguments) ──
let tc = window.hitThemeConfig || {};
let _reactions = (tc && tc.reactions) || {};

// ── Platform (injected via preload-hit.js additionalArguments) ──
const isMac = !!(window.hitPlatform && window.hitPlatform.isMac);

// Theme switch: IPC push overrides additionalArguments
if (window.hitAPI && window.hitAPI.onThemeConfig) {
  window.hitAPI.onThemeConfig((cfg) => {
    tc = cfg || {};
    _reactions = (tc && tc.reactions) || {};
  });
}

// --- State synced from main ---
let currentSvg = null;
let currentState = null;
let miniMode = false;
let dndEnabled = false;

window.hitAPI.onStateSync((data) => {
  if (data.currentSvg !== undefined) currentSvg = data.currentSvg;
  if (data.currentState !== undefined) currentState = data.currentState;
  if (data.miniMode !== undefined) {
    miniMode = data.miniMode;
    if (!sizeEditActive) area.style.cursor = miniMode ? "default" : "";
  }
  if (data.dndEnabled !== undefined) dndEnabled = data.dndEnabled;
});

// --- Size-edit mode (work-area modal: drag corners / move pet / Confirm·Cancel) ---
let sizeEditActive = false;
let sizeEditPetRect = null;
let sizeEditHandleSize = 14;
let sizeEditCorner = null;
let sizeEditResizing = false;
const sizeEditActions = document.getElementById("size-edit-actions");
const sizeEditConfirmBtn = document.getElementById("size-edit-confirm");
const sizeEditCancelBtn = document.getElementById("size-edit-cancel");
const SIZE_EDIT_ACTIONS_GAP = 10;

function pointInRect(x, y, rect, pad = 0) {
  if (!rect) return false;
  return x >= rect.left - pad
    && y >= rect.top - pad
    && x <= rect.left + rect.width + pad
    && y <= rect.top + rect.height + pad;
}

function hitTestSizeEditCorner(x, y) {
  if (!sizeEditPetRect) return null;
  const half = Math.max(8, sizeEditHandleSize) / 2 + 4;
  const corners = {
    nw: { x: sizeEditPetRect.left, y: sizeEditPetRect.top },
    ne: { x: sizeEditPetRect.left + sizeEditPetRect.width, y: sizeEditPetRect.top },
    sw: { x: sizeEditPetRect.left, y: sizeEditPetRect.top + sizeEditPetRect.height },
    se: {
      x: sizeEditPetRect.left + sizeEditPetRect.width,
      y: sizeEditPetRect.top + sizeEditPetRect.height,
    },
  };
  for (const name of ["nw", "ne", "sw", "se"]) {
    const c = corners[name];
    if (Math.abs(x - c.x) <= half && Math.abs(y - c.y) <= half) return name;
  }
  return null;
}

function cursorForSizeEditCorner(corner) {
  if (corner === "nw" || corner === "se") return "nwse-resize";
  if (corner === "ne" || corner === "sw") return "nesw-resize";
  return "default";
}

function layoutSizeEditActions() {
  if (!sizeEditActions || !sizeEditPetRect) return;
  // Measure after making visible so offsetWidth is correct.
  const barW = sizeEditActions.offsetWidth || 160;
  const barH = sizeEditActions.offsetHeight || 30;
  const left = Math.round(
    sizeEditPetRect.left + (sizeEditPetRect.width - barW) / 2,
  );
  let top = Math.round(
    sizeEditPetRect.top + sizeEditPetRect.height + SIZE_EDIT_ACTIONS_GAP,
  );
  // Keep the bar inside the hit window when the pet sits near the bottom.
  const maxTop = Math.max(0, window.innerHeight - barH - 8);
  if (top > maxTop) {
    top = Math.max(8, Math.round(sizeEditPetRect.top - barH - SIZE_EDIT_ACTIONS_GAP));
  }
  sizeEditActions.style.left = `${Math.max(8, left)}px`;
  sizeEditActions.style.top = `${top}px`;
}

function showSizeEditActions(labels) {
  if (!sizeEditActions || !sizeEditConfirmBtn || !sizeEditCancelBtn) return;
  sizeEditConfirmBtn.textContent = (labels && labels.confirm) || "Confirm";
  sizeEditCancelBtn.textContent = (labels && labels.cancel) || "Cancel";
  sizeEditActions.classList.add("visible");
  sizeEditActions.setAttribute("aria-hidden", "false");
  layoutSizeEditActions();
}

function hideSizeEditActions() {
  if (!sizeEditActions) return;
  sizeEditActions.classList.remove("visible");
  sizeEditActions.setAttribute("aria-hidden", "true");
}

function updateSizeEditHoverCursor(clientX, clientY) {
  if (!sizeEditActive || sizeEditResizing || isDragging) return;
  const corner = hitTestSizeEditCorner(clientX, clientY);
  if (corner) {
    area.style.cursor = cursorForSizeEditCorner(corner);
    return;
  }
  if (pointInRect(clientX, clientY, sizeEditPetRect)) {
    area.style.cursor = "grab";
    return;
  }
  area.style.cursor = "default";
}

if (window.hitAPI && typeof window.hitAPI.onSizeEdit === "function") {
  window.hitAPI.onSizeEdit((data) => {
    const active = !!(data && data.active);
    sizeEditActive = active;
    if (!active) {
      sizeEditPetRect = null;
      sizeEditCorner = null;
      sizeEditResizing = false;
      hideSizeEditActions();
      area.style.cursor = miniMode ? "default" : "";
      return;
    }
    if (data.petRectClient) sizeEditPetRect = data.petRectClient;
    if (Number.isFinite(data.handleSize)) sizeEditHandleSize = data.handleSize;
    showSizeEditActions(data.labels);
  });
}

if (sizeEditConfirmBtn) {
  sizeEditConfirmBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!sizeEditActive) return;
    window.hitAPI.sizeEditCommit();
  });
}
if (sizeEditCancelBtn) {
  sizeEditCancelBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!sizeEditActive) return;
    window.hitAPI.sizeEditCancel();
  });
}
// Don't let button presses fall through into drag / outside-click logic.
if (sizeEditActions) {
  sizeEditActions.addEventListener("pointerdown", (e) => {
    e.stopPropagation();
  });
}

// --- Drag state ---
let isDragging = false;
let didDrag = false;
let mouseDownX, mouseDownY;
let lastDragClientX;
let dragReactionDirection = null;
let dragMoveRAF = null;
const DRAG_THRESHOLD = 3;

// --- Reaction state (tracked here to gate input) ---
let isReacting = false;
let isDragReacting = false;

// Cancel signal from main (e.g. state change)
window.hitAPI.onCancelReaction(() => {
  if (clickTimer) { clearTimeout(clickTimer); clickTimer = null; clickCount = 0; firstClickDir = null; }
  isReacting = false;
  isDragReacting = false;
  dragReactionDirection = null;
});

function queueDragMove() {
  if (dragMoveRAF !== null) return;
  dragMoveRAF = requestAnimationFrame(() => {
    dragMoveRAF = null;
    if (!isDragging) return;
    window.hitAPI.dragMove();
  });
}

function clearQueuedDragMove() {
  if (dragMoveRAF === null) return;
  cancelAnimationFrame(dragMoveRAF);
  dragMoveRAF = null;
}

// --- Pointer handlers ---
area.addEventListener("pointerdown", (e) => {
  if (e.button !== 0) return;

  if (sizeEditActive) {
    const corner = hitTestSizeEditCorner(e.clientX, e.clientY);
    if (corner) {
      area.setPointerCapture(e.pointerId);
      sizeEditResizing = true;
      sizeEditCorner = corner;
      didDrag = false;
      area.style.cursor = cursorForSizeEditCorner(corner);
      window.hitAPI.sizeEditResize({
        corner,
        screenX: e.screenX,
        screenY: e.screenY,
        begin: true,
      });
      return;
    }
    if (pointInRect(e.clientX, e.clientY, sizeEditPetRect)) {
      // Move the pet while staying in size-edit mode (no click reactions).
      area.setPointerCapture(e.pointerId);
      isDragging = true;
      didDrag = false;
      mouseDownX = e.clientX;
      mouseDownY = e.clientY;
      lastDragClientX = e.clientX;
      dragReactionDirection = null;
      window.hitAPI.dragLock(true);
      area.classList.add("dragging");
      area.style.cursor = "grabbing";
      return;
    }
    // Outside the pet: keep size-edit mode; Confirm / Cancel / Esc exit.
    return;
  }

  if (miniMode) { didDrag = false; return; }
  area.setPointerCapture(e.pointerId);
  isDragging = true;
  didDrag = false;
  mouseDownX = e.clientX;
  mouseDownY = e.clientY;
  lastDragClientX = e.clientX;
  dragReactionDirection = null;
  window.hitAPI.dragLock(true);
  area.classList.add("dragging");
});

document.addEventListener("pointermove", (e) => {
  if (sizeEditResizing && sizeEditCorner) {
    window.hitAPI.sizeEditResize({
      corner: sizeEditCorner,
      screenX: e.screenX,
      screenY: e.screenY,
      begin: false,
    });
    return;
  }
  if (isDragging) {
    if (!didDrag) {
      const totalDx = e.clientX - mouseDownX;
      const totalDy = e.clientY - mouseDownY;
      if (Math.abs(totalDx) > DRAG_THRESHOLD || Math.abs(totalDy) > DRAG_THRESHOLD) {
        didDrag = true;
        if (!sizeEditActive) {
          startDragReaction(totalDx < 0 ? "left" : (totalDx > 0 ? "right" : null));
        }
      }
    } else if (!sizeEditActive) {
      const stepDx = e.clientX - lastDragClientX;
      if (stepDx !== 0) startDragReaction(stepDx < 0 ? "left" : "right");
    }
    lastDragClientX = e.clientX;
    queueDragMove();
    return;
  }
  if (sizeEditActive) updateSizeEditHoverCursor(e.clientX, e.clientY);
});

function stopDrag() {
  if (!isDragging) return;
  clearQueuedDragMove();
  isDragging = false;
  window.hitAPI.dragLock(false);
  area.classList.remove("dragging");
  if (didDrag) {
    window.hitAPI.dragEnd();
  }
  endDragReaction();
  if (sizeEditActive) updateSizeEditHoverCursor(mouseDownX, mouseDownY);
}

function stopSizeEditResize() {
  if (!sizeEditResizing) return;
  sizeEditResizing = false;
  sizeEditCorner = null;
  if (window.hitAPI.sizeEditResizeEnd) window.hitAPI.sizeEditResizeEnd();
  if (sizeEditActive) area.style.cursor = "default";
}

document.addEventListener("pointerup", (e) => {
  if (e.button !== 0) return;

  if (sizeEditResizing) {
    stopSizeEditResize();
    return;
  }

  const wasDrag = didDrag;
  stopDrag();
  if (wasDrag) return;
  if (sizeEditActive) return;

  // macOS Ctrl-click is the system right-click gesture. Let the OS / our
  // contextmenu handler deal with it; do NOT treat it as the Dashboard
  // shortcut, and do NOT fall through to handleClick (would otherwise
  // leak into the click accumulator).
  if (isMac && e.ctrlKey && !e.metaKey) {
    resetClickAccumulator();
    return;
  }

  // Dashboard shortcut: Cmd-click on mac, Ctrl-click elsewhere.
  const isDashboardShortcut = isMac ? e.metaKey : (e.ctrlKey && !e.metaKey);
  if (isDashboardShortcut) {
    resetClickAccumulator();
    window.hitAPI.showDashboard();
    return;
  }

  handleClick(e.clientX);
});

area.addEventListener("pointercancel", () => {
  stopSizeEditResize();
  stopDrag();
});
area.addEventListener("lostpointercapture", () => {
  if (sizeEditResizing) stopSizeEditResize();
  if (isDragging) stopDrag();
});
window.addEventListener("blur", () => {
  stopSizeEditResize();
  stopDrag();
});

window.addEventListener("keydown", (e) => {
  if (!sizeEditActive) return;
  if (e.key === "Escape") {
    e.preventDefault();
    window.hitAPI.sizeEditCancel();
  }
});

// --- Click reaction logic (2-click = poke, 4-click = flail) ---
const CLICK_WINDOW_MS = 400;

let clickCount = 0;
let clickTimer = null;
let firstClickDir = null;

function _getReaction(name) {
  return _reactions[name] || null;
}

function resetClickAccumulator() {
  if (clickTimer) { clearTimeout(clickTimer); clickTimer = null; }
  clickCount = 0;
  firstClickDir = null;
}

// Fresh-read at reaction timer fire time, NOT closured at click time —
// state / DND may change inside the 400 ms accumulator window.
function canPlayReactionNow() {
  return currentState === "idle" && !dndEnabled && !isReacting;
}

// Sandbox / simple themes author reactions.click (often file "_sandbox").
// Those must work on a single click, and while the agent is busy — otherwise
// Phaser pets never receive pet:event "click" (render window is view-only).
function isSandboxClickFile(file) {
  return file === "_sandbox";
}

function canPlaySimpleClickNow(file) {
  if (dndEnabled) return false;
  if (isSandboxClickFile(file)) return !isReacting;
  return canPlayReactionNow();
}

function handleClick(clientX) {
  if (miniMode) {
    window.hitAPI.exitMiniMode();
    return;
  }
  if (isDragReacting) return;

  const clickReact = _getReaction("click");
  const doubleReact = _getReaction("double");
  const annoyedReact = _getReaction("annoyed");
  const leftReact = _getReaction("clickLeft");
  const rightReact = _getReaction("clickRight");
  const simpleClickOnly = !!(clickReact && clickReact.file && !leftReact && !rightReact && !doubleReact);

  // Immediate single-click path for sandbox / Rive-style reactions.click.
  if (simpleClickOnly) {
    window.hitAPI.revealSessionHud();
    if (!canPlaySimpleClickNow(clickReact.file)) return;
    const duration = Number.isFinite(clickReact.duration) ? clickReact.duration : 400;
    playReaction(clickReact.file, duration);
    return;
  }

  clickCount++;
  if (clickCount === 1) {
    firstClickDir = clientX < area.offsetWidth / 2 ? "left" : "right";
    // First click reveals the session HUD. Lightweight side effect — NOT
    // gated by isReacting (HUD reveal is independent of pet animation).
    window.hitAPI.revealSessionHud();
  }

  if (clickTimer) { clearTimeout(clickTimer); clickTimer = null; }

  if (clickCount >= 4 && doubleReact) {
    clickCount = 0;
    firstClickDir = null;
    if (!canPlayReactionNow()) return;
    const files = doubleReact.files || [doubleReact.file];
    const file = files[Math.floor(Math.random() * files.length)];
    playReaction(file, doubleReact.duration || 3500);
  } else if (clickCount >= 2) {
    clickTimer = setTimeout(() => {
      clickTimer = null;
      clickCount = 0;
      const dir = firstClickDir;
      firstClickDir = null;
      if (!canPlayReactionNow()) return;
      if (annoyedReact && Math.random() < 0.5) {
        playReaction(annoyedReact.file, annoyedReact.duration || 3500);
      } else if (leftReact && rightReact) {
        const react = dir === "left" ? leftReact : rightReact;
        playReaction(react.file, react.duration || 2500);
      } else if (clickReact && clickReact.file) {
        playReaction(clickReact.file, clickReact.duration || 400);
      }
    }, CLICK_WINDOW_MS);
  } else {
    clickTimer = setTimeout(() => {
      clickTimer = null;
      clickCount = 0;
      firstClickDir = null;
      // Themes with only reactions.click already fired above; this branch is
      // for mixed themes that also have poke/flail bindings — single click
      // still delivers reactions.click after the accumulator window.
      if (clickReact && clickReact.file && canPlaySimpleClickNow(clickReact.file)) {
        playReaction(clickReact.file, clickReact.duration || 400);
      }
    }, CLICK_WINDOW_MS);
  }
}

function playReaction(svg, duration) {
  if (!svg) return;
  const ms = Math.max(0, Number(duration) || 0);
  // Sandbox clicks must not lock out rapid flaps (game pets).
  if (isSandboxClickFile(svg)) {
    window.hitAPI.playClickReaction(svg, ms);
    return;
  }
  isReacting = true;
  window.hitAPI.playClickReaction(svg, ms);
  // Local timer to ungate input after duration
  setTimeout(() => { isReacting = false; }, ms);
}

// --- Drag reaction ---
function startDragReaction(direction) {
  if (dndEnabled) return;
  if (isDragReacting && dragReactionDirection === direction) return;

  if (isReacting) {
    isReacting = false;
  }

  isDragReacting = true;
  dragReactionDirection = direction;
  window.hitAPI.startDragReaction(direction);
}

function endDragReaction() {
  if (!isDragReacting) return;
  isDragReacting = false;
  dragReactionDirection = null;
  window.hitAPI.endDragReaction();
}

// --- OS file drop → open terminal at that directory (#459, Windows/Linux only) ---
// macOS is OUT: the pet windows live at screen-saver level so they stay above
// fullscreen apps, and macOS drag-destination search never delivers drag
// events to windows at that level (real-machine bisect, 2026-06-11 — lowering
// only the hit window doesn't help either, the overlapping screen-saver render
// window still blocks the search; ignoresMouseEvents passes mouse events
// through but NOT drag destinations). Don't re-attempt without changing the
// window-level model; listeners are simply not registered on mac.
//
// Affordance gating lives HERE (not only in main): in mini mode dragover must
// not preventDefault, so the OS shows "no drop" instead of a copy cursor that
// would then do nothing. Main re-checks mini (and platform) as the second layer.
function dragHasFiles(e) {
  const types = e.dataTransfer && e.dataTransfer.types;
  if (!types) return false;
  for (const t of types) { if (t === "Files") return true; }
  return false;
}

if (!isMac) {
  area.addEventListener("dragover", (e) => {
    if (miniMode || !dragHasFiles(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  });

  area.addEventListener("drop", (e) => {
    if (!dragHasFiles(e)) return;
    e.preventDefault();
    if (miniMode) return;
    const paths = [];
    for (const file of e.dataTransfer.files || []) {
      const p = window.hitAPI.getPathForFile(file);
      if (typeof p === "string" && p) paths.push(p);
    }
    if (paths.length) window.hitAPI.dropPaths(paths);
  });

  // Main confirmed the drop opened a terminal → react. Routed back through the
  // local playReaction so isReacting gating stays consistent. Best-effort with a
  // fallback chain: double (Clawd) → clickLeft/clickRight poke (Calico) →
  // nothing (Cloudling only ships a drag reaction; no new theme capability is
  // invented for drops).
  window.hitAPI.onDropAccepted(() => {
    if (!canPlayReactionNow()) return;
    const doubleReact = _getReaction("double");
    if (doubleReact) {
      const files = doubleReact.files || [doubleReact.file];
      playReaction(files[Math.floor(Math.random() * files.length)], doubleReact.duration || 3500);
      return;
    }
    const left = _getReaction("clickLeft");
    const right = _getReaction("clickRight");
    const poke = left && right ? (Math.random() < 0.5 ? left : right) : (left || right);
    if (poke) playReaction(poke.file, poke.duration || 2500);
  });
}

// --- Right-click context menu ---
document.addEventListener("contextmenu", (e) => {
  e.preventDefault();
  if (sizeEditActive) return;
  window.hitAPI.showContextMenu();
});
