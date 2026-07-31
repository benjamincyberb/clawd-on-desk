// Shared dashed-frame + corner-handle overlay for SVG / Pixi / Rive renderers.
// Visual-only (pointer-events: none); hit-renderer owns the interaction.
(function initSizeEditOverlay() {
  const STYLE_ID = "clawd-size-edit-style";
  const FRAME_CLASS = "size-edit-frame";
  const CORNERS = ["nw", "ne", "sw", "se"];
  let frameEl = null;

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
.${FRAME_CLASS} {
  position: fixed;
  inset: 0;
  z-index: 9999;
  border: 2px dashed rgba(255, 255, 255, 0.92);
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.45), inset 0 0 0 1px rgba(0, 0, 0, 0.25);
  pointer-events: none;
  box-sizing: border-box;
}
.${FRAME_CLASS} .size-edit-handle {
  position: absolute;
  width: 12px;
  height: 12px;
  margin: -6px;
  border: 2px solid rgba(255, 255, 255, 0.95);
  background: rgba(40, 120, 255, 0.92);
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.45);
  box-sizing: border-box;
  pointer-events: none;
}
.${FRAME_CLASS} .size-edit-handle-nw { left: 0; top: 0; }
.${FRAME_CLASS} .size-edit-handle-ne { right: 0; top: 0; }
.${FRAME_CLASS} .size-edit-handle-sw { left: 0; bottom: 0; }
.${FRAME_CLASS} .size-edit-handle-se { right: 0; bottom: 0; }
`;
    document.head.appendChild(style);
  }

  function showOverlay(handleSize) {
    ensureStyles();
    if (frameEl) return;
    frameEl = document.createElement("div");
    frameEl.className = FRAME_CLASS;
    frameEl.setAttribute("aria-hidden", "true");
    const size = Number(handleSize);
    for (const corner of CORNERS) {
      const handle = document.createElement("div");
      handle.className = `size-edit-handle size-edit-handle-${corner}`;
      if (Number.isFinite(size) && size > 0) {
        handle.style.width = `${size}px`;
        handle.style.height = `${size}px`;
        handle.style.margin = `${-size / 2}px`;
      }
      frameEl.appendChild(handle);
    }
    document.body.appendChild(frameEl);
  }

  function hideOverlay() {
    if (!frameEl) return;
    frameEl.remove();
    frameEl = null;
  }

  if (window.electronAPI && typeof window.electronAPI.onSizeEditMode === "function") {
    window.electronAPI.onSizeEditMode((payload) => {
      if (payload && payload.active) showOverlay(payload.handleSize);
      else hideOverlay();
    });
  }
})();
