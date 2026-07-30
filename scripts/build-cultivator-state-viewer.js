"use strict";

/**
 * Build a PetDex-style State Viewer for Cultivator assets.
 *
 * Shows every stage × action, which live SVG the app is using, whether the
 * source PNG exists, and a large preview so generation issues are obvious.
 *
 * Usage:
 *   node scripts/build-cultivator-state-viewer.js
 *   npm run preview:cultivator-states
 *
 * Then serve the repo root and open:
 *   http://127.0.0.1:8766/assets/source/cultivator/state-viewer.html
 */

const fs = require("node:fs");
const path = require("node:path");

const REPO_ROOT = path.resolve(__dirname, "..");
const THEME_JSON = path.join(REPO_ROOT, "themes", "cultivator", "theme.json");
const LIVE_DIR = path.join(REPO_ROOT, "themes", "cultivator", "assets");
const GENERATED_DIR = path.join(REPO_ROOT, "assets", "source", "cultivator", "generated");
const OUT_HTML = path.join(REPO_ROOT, "assets", "source", "cultivator", "state-viewer.html");

const ACTIONS = [
  { id: "idle", label: "Idle", blurb: "打坐 / 空闲循环" },
  { id: "thinking", label: "Thinking", blurb: "思考（当前复用 working 敲木鱼）" },
  { id: "working", label: "Working", blurb: "敲木鱼 / 任务进行中", frames: 6 },
  { id: "attention", label: "Attention", blurb: "完成提醒" },
  { id: "error", label: "Error", blurb: "出错" },
  { id: "sleeping", label: "Sleeping", blurb: "睡眠" },
];

const ALIASES = {
  juggling: "working",
  notification: "attention",
};

function exists(p) {
  try {
    return fs.existsSync(p);
  } catch {
    return false;
  }
}

function fileSize(p) {
  try {
    return fs.statSync(p).size;
  } catch {
    return 0;
  }
}

function formatBytes(n) {
  if (!n) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

function resolveLiveFile(theme, stageId, actionId) {
  const stages = (((theme.meritCultivator || {}).stages) || []);
  const stage = stages.find((s) => s.id === stageId);
  const visuals = stage && stage.visuals && stage.visuals.states;
  if (visuals && Array.isArray(visuals[actionId]) && visuals[actionId][0]) {
    return visuals[actionId][0];
  }
  // mortal / base states
  const base = theme.states && theme.states[actionId];
  if (Array.isArray(base) && base[0]) {
    // base files are mortal-*; remap to stage if not mortal
    const mortalFile = base[0];
    if (stageId === "mortal") return mortalFile;
    return mortalFile.replace(/^mortal-/, `${stageId}-`);
  }
  return `${stageId}-${actionId}.svg`;
}

function sourcePngs(stageId, actionId) {
  if (actionId === "working") {
    const frames = [];
    for (let i = 1; i <= 6; i += 1) {
      const name = `${stageId}-working-${i}.png`;
      const abs = path.join(GENERATED_DIR, name);
      frames.push({
        name,
        rel: `./generated/${name}`,
        exists: exists(abs),
        bytes: fileSize(abs),
      });
    }
    const sheet = `${stageId}-working-sheet.png`;
    const sheetAbs = path.join(GENERATED_DIR, sheet);
    return {
      kind: "frames",
      frames,
      sheet: {
        name: sheet,
        rel: `./generated/${sheet}`,
        exists: exists(sheetAbs),
        bytes: fileSize(sheetAbs),
      },
    };
  }
  const name = `${stageId}-${actionId}.png`;
  const abs = path.join(GENERATED_DIR, name);
  return {
    kind: "single",
    file: {
      name,
      rel: `./generated/${name}`,
      exists: exists(abs),
      bytes: fileSize(abs),
    },
  };
}

function buildCatalog(theme) {
  const stages = (((theme.meritCultivator || {}).stages) || []).map((s) => ({
    id: s.id,
    nameZh: (s.name && (s.name.zh || s.name.en)) || s.id,
    nameEn: (s.name && s.name.en) || s.id,
    requiredMerit: s.requiredMerit,
  }));

  const entries = [];
  for (const stage of stages) {
    for (const action of ACTIONS) {
      const liveFile = resolveLiveFile(theme, stage.id, action.id);
      const liveAbs = path.join(LIVE_DIR, liveFile);
      const liveOk = exists(liveAbs);
      // thinking currently points at working SVG in theme — inspect working source
      const aliasedToWorking = action.id === "thinking" && /working\.svg$/.test(liveFile);
      const sourceActionId = aliasedToWorking ? "working" : action.id;
      const source = sourcePngs(stage.id, sourceActionId);
      let sourceOk = false;
      let sourceNote = "";
      if (source.kind === "frames") {
        const okFrames = source.frames.filter((f) => f.exists).length;
        sourceOk = okFrames === 6;
        sourceNote = sourceOk ? `6 frames` : `${okFrames}/6 frames`;
        if (stage.id === "buddha") {
          // Buddha working is no-knock idle reuse; frames optional
          sourceOk = exists(path.join(GENERATED_DIR, "buddha-idle.png"));
          sourceNote = sourceOk ? "no-knock (idle)" : "missing idle";
        }
      } else {
        sourceOk = source.file.exists;
        sourceNote = sourceOk ? formatBytes(source.file.bytes) : "missing PNG";
      }

      let status = "ok";
      if (!liveOk) status = "missing-live";
      else if (!sourceOk && (action.id === "attention" || action.id === "error" || action.id === "sleeping")) {
        // attention/error/sleeping may be derived from idle in pipeline
        status = "derived";
      } else if (!sourceOk) {
        status = "missing-source";
      }

      entries.push({
        key: `${stage.id}:${action.id}`,
        stageId: stage.id,
        stageNameZh: stage.nameZh,
        stageNameEn: stage.nameEn,
        actionId: action.id,
        actionLabel: action.label,
        blurb: action.blurb,
        frames: action.frames || 0,
        liveFile,
        liveRel: `../../../themes/cultivator/assets/${liveFile}`,
        liveOk,
        liveBytes: fileSize(liveAbs),
        source,
        sourceOk,
        sourceNote,
        aliasedToWorking,
        status,
      });
    }
  }

  return {
    builtAt: new Date().toISOString(),
    themeName: theme.name || "Cultivator",
    stages,
    actions: ACTIONS,
    aliases: ALIASES,
    entries,
  };
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildHtml(catalog) {
  const dataJson = JSON.stringify(catalog).replace(/</g, "\\u003c");
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${escapeHtml(catalog.themeName)} · State Viewer</title>
<style>
  :root {
    --bg: #eef3f8;
    --card: #ffffff;
    --ink: #12151a;
    --muted: #6b7280;
    --line: #d7dee8;
    --accent: #3b82f6;
    --accent-soft: #e8f1ff;
    --ok: #059669;
    --warn: #d97706;
    --bad: #dc2626;
    --checker-a: #eceff3;
    --checker-b: #f7f8fa;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    min-height: 100vh;
    font-family: "SF Pro Text", "Segoe UI", system-ui, -apple-system, sans-serif;
    color: var(--ink);
    background: var(--bg);
  }
  .page {
    max-width: 1180px;
    margin: 0 auto;
    padding: 28px 24px 48px;
  }
  .top {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 20px;
  }
  .eyebrow {
    margin: 0 0 6px;
    font-size: 11px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: #8aa0b8;
    font-weight: 600;
  }
  h1 {
    margin: 0;
    font-size: 28px;
    letter-spacing: -0.03em;
  }
  .meta {
    color: var(--muted);
    font-size: 13px;
    margin-top: 6px;
  }
  .stage-tabs {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .stage-tab {
    appearance: none;
    border: 1px solid var(--line);
    background: var(--card);
    color: var(--ink);
    border-radius: 999px;
    padding: 8px 14px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
  }
  .stage-tab.active {
    background: var(--accent-soft);
    border-color: #b7d0f8;
    color: #1d4ed8;
  }
  .layout {
    display: grid;
    grid-template-columns: minmax(320px, 1.05fr) minmax(360px, 1.2fr);
    gap: 18px;
    align-items: start;
  }
  @media (max-width: 920px) {
    .layout { grid-template-columns: 1fr; }
  }
  .hero, .card {
    background: var(--card);
    border: 1px solid var(--line);
    border-radius: 18px;
  }
  .hero {
    padding: 22px;
    position: sticky;
    top: 16px;
  }
  .hero-label {
    margin: 0;
    font-size: 11px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: #8aa0b8;
    font-weight: 600;
  }
  .hero-title-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-top: 8px;
  }
  .hero-title {
    margin: 0;
    font-size: 30px;
    letter-spacing: -0.03em;
  }
  .pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    border-radius: 999px;
    padding: 6px 10px;
    font-size: 12px;
    font-weight: 600;
    background: #f3f6fa;
    color: #334155;
    white-space: nowrap;
  }
  .hero-blurb {
    margin: 8px 0 0;
    color: var(--muted);
    font-size: 14px;
  }
  .preview-box {
    margin-top: 18px;
    border-radius: 16px;
    border: 1px solid var(--line);
    background:
      repeating-conic-gradient(var(--checker-a) 0% 25%, var(--checker-b) 0% 50%)
      50% / 18px 18px;
    min-height: 340px;
    display: grid;
    place-items: center;
    overflow: hidden;
  }
  .preview-box object,
  .preview-box img {
    width: min(300px, 72%);
    height: min(300px, 72%);
    object-fit: contain;
  }
  .preview-box object { background: transparent; }
  .compare {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    margin-top: 14px;
  }
  .compare-panel {
    border: 1px solid var(--line);
    border-radius: 12px;
    padding: 10px;
    background: #fbfcfe;
  }
  .compare-panel h3 {
    margin: 0 0 8px;
    font-size: 11px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--muted);
  }
  .compare-panel .thumb {
    border-radius: 10px;
    border: 1px solid var(--line);
    background:
      repeating-conic-gradient(var(--checker-a) 0% 25%, var(--checker-b) 0% 50%)
      50% / 12px 12px;
    height: 140px;
    display: grid;
    place-items: center;
    overflow: hidden;
  }
  .compare-panel .thumb img,
  .compare-panel .thumb object {
    width: 120px;
    height: 120px;
    object-fit: contain;
  }
  .facts {
    margin-top: 14px;
    display: grid;
    gap: 6px;
    font-size: 13px;
    color: #334155;
  }
  .facts code {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 12px;
    background: #f3f6fa;
    padding: 1px 6px;
    border-radius: 6px;
  }
  .badge {
    display: inline-flex;
    align-items: center;
    border-radius: 999px;
    padding: 2px 8px;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.02em;
  }
  .badge.ok { background: #d1fae5; color: var(--ok); }
  .badge.warn { background: #ffedd5; color: var(--warn); }
  .badge.bad { background: #fee2e2; color: var(--bad); }
  .badge.muted { background: #eef2f7; color: #64748b; }
  .grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
  }
  @media (max-width: 640px) {
    .grid { grid-template-columns: 1fr; }
  }
  .state-card {
    display: grid;
    grid-template-columns: 1fr 88px;
    gap: 12px;
    align-items: center;
    padding: 14px;
    border-radius: 16px;
    border: 1px solid var(--line);
    background: var(--card);
    cursor: pointer;
    text-align: left;
    width: 100%;
    font: inherit;
    color: inherit;
  }
  .state-card:hover { border-color: #b7c7db; }
  .state-card.active {
    background: var(--accent-soft);
    border-color: #93c5fd;
  }
  .state-card h3 {
    margin: 0;
    font-size: 15px;
  }
  .state-card p {
    margin: 4px 0 0;
    font-size: 12px;
    color: var(--muted);
  }
  .state-card .badges {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-top: 8px;
  }
  .state-card .thumb {
    width: 88px;
    height: 88px;
    border-radius: 12px;
    border: 1px solid var(--line);
    background:
      repeating-conic-gradient(var(--checker-a) 0% 25%, var(--checker-b) 0% 50%)
      50% / 10px 10px;
    display: grid;
    place-items: center;
    overflow: hidden;
  }
  .state-card .thumb img,
  .state-card .thumb object {
    width: 72px;
    height: 72px;
    object-fit: contain;
  }
  .hint {
    margin-top: 14px;
    color: var(--muted);
    font-size: 12px;
    line-height: 1.5;
  }
  .frames {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 12px;
  }
  .frames img {
    width: 56px;
    height: 56px;
    object-fit: contain;
    border-radius: 8px;
    border: 1px solid var(--line);
    background:
      repeating-conic-gradient(var(--checker-a) 0% 25%, var(--checker-b) 0% 50%)
      50% / 8px 8px;
  }
  .frames img.missing {
    opacity: 0.35;
    outline: 1px dashed var(--bad);
  }
</style>
</head>
<body>
  <div class="page">
    <div class="top">
      <div>
        <p class="eyebrow"><a href="/" style="color:inherit;text-decoration:none">← PetDex</a> · State Viewer</p>
        <h1>${escapeHtml(catalog.themeName)}</h1>
        <p class="meta">核对「正在使用的 live SVG」与「生成源 PNG」· ← → 切换 · 空格换阶段</p>
      </div>
      <div class="stage-tabs" id="stageTabs"></div>
    </div>
    <div class="layout">
      <section class="hero" id="hero"></section>
      <section>
        <div class="grid" id="grid"></div>
        <p class="hint">
          <strong>IN USE</strong> = <code>themes/cultivator/assets/*.svg</code>（桌宠实际加载）·
          <strong>SOURCE</strong> = <code>assets/source/cultivator/generated/*.png</code>·
          attention / error / sleeping 常由 idle 派生，缺独立 PNG 属正常。
          Built ${escapeHtml(catalog.builtAt)}
        </p>
      </section>
    </div>
  </div>
<script>
const DATA = ${dataJson};
let stageId = DATA.stages[0] ? DATA.stages[0].id : "mortal";
let selectedKey = null;

function byStage(id) {
  return DATA.entries.filter((e) => e.stageId === id);
}

function statusBadge(entry) {
  if (entry.status === "missing-live") return '<span class="badge bad">MISSING LIVE</span>';
  if (entry.status === "missing-source") return '<span class="badge warn">NO SOURCE</span>';
  if (entry.status === "derived") return '<span class="badge muted">DERIVED</span>';
  return '<span class="badge ok">OK</span>';
}

function thumbHtml(entry, size) {
  if (!entry.liveOk) {
    return '<div class="thumb" style="color:#94a3b8;font-size:11px">missing</div>';
  }
  // Prefer live SVG via <object> so SMIL/CSS animations play
  return '<div class="thumb"><object type="image/svg+xml" data="' + entry.liveRel + '?t=' + Date.now() + '" width="' + size + '" height="' + size + '"></object></div>';
}

function renderTabs() {
  const el = document.getElementById("stageTabs");
  el.innerHTML = DATA.stages.map((s) => {
    const cls = s.id === stageId ? "stage-tab active" : "stage-tab";
    return '<button class="' + cls + '" data-stage="' + s.id + '">' + s.nameZh + '</button>';
  }).join("");
  el.querySelectorAll("button").forEach((btn) => {
    btn.addEventListener("click", () => {
      stageId = btn.getAttribute("data-stage");
      const first = byStage(stageId)[0];
      selectedKey = first ? first.key : null;
      render();
    });
  });
}

function renderGrid() {
  const el = document.getElementById("grid");
  const entries = byStage(stageId);
  if (!selectedKey && entries[0]) selectedKey = entries[0].key;
  el.innerHTML = entries.map((e) => {
    const active = e.key === selectedKey ? " active" : "";
    const alias = e.aliasedToWorking ? '<span class="badge muted">→ working</span>' : "";
    return (
      '<button class="state-card' + active + '" data-key="' + e.key + '">' +
        '<div>' +
          '<h3>' + e.actionLabel + '</h3>' +
          '<p>' + e.liveFile + (e.frames ? (' · ' + e.frames + ' frames') : '') + '</p>' +
          '<div class="badges">' + statusBadge(e) +
            (e.liveOk ? '<span class="badge ok">IN USE</span>' : '') +
            (e.sourceOk ? '<span class="badge muted">SOURCE</span>' : '<span class="badge warn">NO PNG</span>') +
            alias +
          '</div>' +
        '</div>' +
        thumbHtml(e, 72) +
      '</button>'
    );
  }).join("");
  el.querySelectorAll(".state-card").forEach((btn) => {
    btn.addEventListener("click", () => {
      selectedKey = btn.getAttribute("data-key");
      render();
    });
  });
}

function sourcePreview(entry) {
  if (entry.source.kind === "frames") {
    if (entry.stageId === "buddha") {
      const idle = "./generated/buddha-idle.png";
      return '<img src="' + idle + '" alt="buddha idle"/>';
    }
    const first = entry.source.frames.find((f) => f.exists);
    return first ? '<img src="' + first.rel + '" alt="frame"/>' : '<span style="color:#94a3b8;font-size:12px">no frames</span>';
  }
  if (entry.source.file && entry.source.file.exists) {
    return '<img src="' + entry.source.file.rel + '" alt="source"/>';
  }
  return '<span style="color:#94a3b8;font-size:12px">no PNG</span>';
}

function frameStrip(entry) {
  if (entry.source.kind !== "frames" || entry.stageId === "buddha") return "";
  return '<div class="frames">' + entry.source.frames.map((f, i) => {
    if (!f.exists) return '<img class="missing" alt="missing ' + (i+1) + '" title="missing"/>';
    return '<img src="' + f.rel + '" alt="f' + (i+1) + '" title="' + f.name + '"/>';
  }).join("") + '</div>';
}

function renderHero() {
  const el = document.getElementById("hero");
  const entry = DATA.entries.find((e) => e.key === selectedKey) || byStage(stageId)[0];
  if (!entry) {
    el.innerHTML = "<p>No entries</p>";
    return;
  }
  const framePill = entry.frames
    ? '<span class="pill">▶ ' + entry.frames + ' frames</span>'
    : '<span class="pill">static</span>';
  el.innerHTML =
    '<p class="hero-label">State Viewer · ' + entry.stageNameZh + ' / ' + entry.stageNameEn + '</p>' +
    '<div class="hero-title-row"><h2 class="hero-title">' + entry.actionLabel + '</h2>' + framePill + '</div>' +
    '<p class="hero-blurb">' + entry.blurb + '</p>' +
    '<div class="preview-box">' +
      (entry.liveOk
        ? '<object type="image/svg+xml" data="' + entry.liveRel + '?t=' + Date.now() + '" width="300" height="300"></object>'
        : '<div style="color:#94a3b8">live SVG missing</div>') +
    '</div>' +
    '<div class="compare">' +
      '<div class="compare-panel"><h3>In use (live SVG)</h3><div class="thumb">' +
        (entry.liveOk ? '<object type="image/svg+xml" data="' + entry.liveRel + '?t=' + Date.now() + '"></object>' : '—') +
      '</div></div>' +
      '<div class="compare-panel"><h3>Source PNG</h3><div class="thumb">' + sourcePreview(entry) + '</div></div>' +
    '</div>' +
    frameStrip(entry) +
    '<div class="facts">' +
      '<div>' + statusBadge(entry) +
        (entry.liveOk ? ' <span class="badge ok">IN USE</span>' : '') +
        (entry.aliasedToWorking ? ' <span class="badge muted">thinking → working</span>' : '') +
      '</div>' +
      '<div>Live file: <code>' + entry.liveFile + '</code> · ' + (entry.liveOk ? (Math.round(entry.liveBytes/1024) + ' KB') : 'missing') + '</div>' +
      '<div>Source: <code>' + entry.sourceNote + '</code></div>' +
      '<div>Path: <code>themes/cultivator/assets/' + entry.liveFile + '</code></div>' +
    '</div>';
}

function render() {
  renderTabs();
  renderGrid();
  renderHero();
}

document.addEventListener("keydown", (e) => {
  const entries = byStage(stageId);
  const idx = entries.findIndex((x) => x.key === selectedKey);
  if (e.key === "ArrowRight" || e.key === "ArrowDown") {
    e.preventDefault();
    const next = entries[(Math.max(idx, 0) + 1) % entries.length];
    selectedKey = next.key;
    render();
  } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
    e.preventDefault();
    const prev = entries[(Math.max(idx, 0) - 1 + entries.length) % entries.length];
    selectedKey = prev.key;
    render();
  } else if (e.key === " ") {
    e.preventDefault();
    const si = DATA.stages.findIndex((s) => s.id === stageId);
    stageId = DATA.stages[(si + 1) % DATA.stages.length].id;
    selectedKey = byStage(stageId)[0].key;
    render();
  }
});

selectedKey = byStage(stageId)[0] ? byStage(stageId)[0].key : null;
render();
</script>
</body>
</html>
`;
}

function main() {
  const theme = JSON.parse(fs.readFileSync(THEME_JSON, "utf8"));
  const catalog = buildCatalog(theme);
  fs.mkdirSync(path.dirname(OUT_HTML), { recursive: true });
  fs.writeFileSync(OUT_HTML, buildHtml(catalog), "utf8");
  const missingLive = catalog.entries.filter((e) => !e.liveOk).length;
  const missingSource = catalog.entries.filter((e) => e.status === "missing-source").length;
  console.log(`wrote ${path.relative(REPO_ROOT, OUT_HTML)}`);
  console.log(`stages=${catalog.stages.length} entries=${catalog.entries.length} missingLive=${missingLive} missingSource=${missingSource}`);
  console.log("");
  console.log("Serve from repo root, then open:");
  console.log("  python3 -m http.server 8766");
  console.log("  http://127.0.0.1:8766/assets/source/cultivator/state-viewer.html");
}

if (require.main === module) {
  main();
}

module.exports = { buildCatalog, buildHtml, OUT_HTML };
