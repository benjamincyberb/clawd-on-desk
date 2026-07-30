"use strict";

/**
 * Build a PetDex-style gallery of built-in desk pets (themes).
 *
 * Usage:
 *   node scripts/build-petdex.js
 *   npm run preview:petdex
 *
 * Open via preview server:
 *   http://127.0.0.1:8766/
 *   http://127.0.0.1:8766/dex
 */

const fs = require("node:fs");
const path = require("node:path");

const REPO_ROOT = path.resolve(__dirname, "..");
const THEMES_DIR = path.join(REPO_ROOT, "themes");
const OUT_DIR = path.join(REPO_ROOT, "assets", "source", "petdex");
const OUT_HTML = path.join(OUT_DIR, "index.html");

/** Skip scaffold / non-shipped themes */
const SKIP_IDS = new Set(["template"]);

/**
 * Soft radial wash behind each pet — PetDex-style color halo.
 * Keys match theme folder ids.
 */
const PET_PALETTE = {
  clawd: { glow: "#ffb4a2", wash: "#fff1ec", accent: "#e85d4c", blurb: "Original pixel crab — Claude Code mascot" },
  calico: { glow: "#f6d6a8", wash: "#fff8ee", accent: "#d97706", blurb: "Calico cat with APNG desk animations" },
  cloudling: { glow: "#b8d4ff", wash: "#eef4ff", accent: "#3b82f6", blurb: "Scripted SVG cloud companion" },
  cultivator: { glow: "#f0d48a", wash: "#fffaf0", accent: "#b45309", blurb: "Merit cultivator — knock the wooden fish" },
};

const FEATURED_ID = "cultivator";

function exists(p) {
  try {
    return fs.existsSync(p);
  } catch {
    return false;
  }
}

function listFiles(dir) {
  if (!exists(dir)) return [];
  try {
    return fs.readdirSync(dir).filter((name) => !name.startsWith("."));
  } catch {
    return [];
  }
}

function resolveAssetsDir(themeId, themeDir) {
  // Built-in clawd still ships assets from repo root assets/svg
  if (themeId === "clawd") {
    const legacy = path.join(REPO_ROOT, "assets", "svg");
    if (exists(legacy)) return legacy;
  }
  const local = path.join(themeDir, "assets");
  if (exists(local)) return local;
  return local;
}

function webPathFromRepo(absPath) {
  const rel = path.relative(REPO_ROOT, absPath).split(path.sep).join("/");
  return `/${rel}`;
}

function countStates(theme) {
  const states = theme.states && typeof theme.states === "object" ? theme.states : {};
  return Object.keys(states).length;
}

function collectStateFiles(theme) {
  const states = theme.states && typeof theme.states === "object" ? theme.states : {};
  const files = new Set();
  for (const list of Object.values(states)) {
    if (!Array.isArray(list)) continue;
    for (const file of list) {
      if (typeof file === "string" && file) files.add(file);
    }
  }
  // Merit cultivator stage visuals
  const stages = (((theme.meritCultivator || {}).stages) || []);
  for (const stage of stages) {
    const visuals = stage && stage.visuals && stage.visuals.states;
    if (!visuals || typeof visuals !== "object") continue;
    for (const list of Object.values(visuals)) {
      if (!Array.isArray(list)) continue;
      for (const file of list) {
        if (typeof file === "string" && file) files.add(file);
      }
    }
  }
  return [...files];
}

function resolvePreviewFile(theme, assetsDir) {
  if (typeof theme.preview === "string" && theme.preview) {
    const abs = path.join(assetsDir, theme.preview);
    if (exists(abs)) return theme.preview;
  }
  const idle = theme.states && Array.isArray(theme.states.idle) ? theme.states.idle[0] : null;
  if (idle && exists(path.join(assetsDir, idle))) return idle;
  const files = listFiles(assetsDir);
  const svg = files.find((f) => /\.svg$/i.test(f));
  return svg || null;
}

function isAnimatablePreview(file) {
  return typeof file === "string" && /\.svg$/i.test(file);
}

function buildCatalog() {
  const entries = fs.readdirSync(THEMES_DIR, { withFileTypes: true });
  const pets = [];
  let no = 1;

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const id = entry.name;
    if (SKIP_IDS.has(id)) continue;
    const themeDir = path.join(THEMES_DIR, id);
    const jsonPath = path.join(themeDir, "theme.json");
    if (!exists(jsonPath)) continue;

    let theme;
    try {
      theme = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
    } catch {
      continue;
    }

    const assetsDir = resolveAssetsDir(id, themeDir);
    const assetFiles = listFiles(assetsDir);
    const stateFiles = collectStateFiles(theme);
    const missingAssets = stateFiles.filter((f) => !exists(path.join(assetsDir, f)));
    const previewFile = resolvePreviewFile(theme, assetsDir);
    const palette = PET_PALETTE[id] || {
      glow: "#d1d5db",
      wash: "#f3f4f6",
      accent: "#6b7280",
      blurb: theme.description || "",
    };
    const stages = (((theme.meritCultivator || {}).stages) || []).length;
    const stateCount = countStates(theme);
    const href =
      id === "cultivator"
        ? "/cultivator"
        : null;

    pets.push({
      no,
      id,
      name: theme.name || id,
      author: theme.author || "unknown",
      version: theme.version || "—",
      description: theme.description || palette.blurb || "",
      blurb: palette.blurb || theme.description || "",
      repo: theme.repo || null,
      featured: id === FEATURED_ID,
      builtin: true,
      stateCount,
      assetCount: assetFiles.length,
      missingCount: missingAssets.length,
      stages,
      previewFile,
      previewRel: previewFile ? webPathFromRepo(path.join(assetsDir, previewFile)) : null,
      previewIsSvg: isAnimatablePreview(previewFile),
      assetsWebRoot: webPathFromRepo(assetsDir),
      glow: palette.glow,
      wash: palette.wash,
      accent: palette.accent,
      status: missingAssets.length ? "partial" : "ready",
      href,
      tags: [
        stages ? "merit" : null,
        theme.rendering && theme.rendering.svgChannel === "object" ? "object-svg" : null,
        theme.eyeTracking && theme.eyeTracking.enabled ? "eye-tracking" : null,
      ].filter(Boolean),
    });
    no += 1;
  }

  // Stable PetDex order: featured first, then alpha
  pets.sort((a, b) => {
    if (a.featured !== b.featured) return a.featured ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  pets.forEach((p, i) => {
    p.no = i + 1;
  });

  return {
    builtAt: new Date().toISOString(),
    title: "Clawd PetDex",
    subtitle: "Pick a companion — built-in desk pets in this repo",
    pets,
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
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${escapeHtml(catalog.title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&family=IBM+Plex+Mono:wght@500&display=swap" rel="stylesheet"/>
<style>
  :root {
    --bg: #f4f6f8;
    --card: #ffffff;
    --ink: #111827;
    --muted: #6b7280;
    --line: #e5e7eb;
    --soft: #f9fafb;
    --accent: #111827;
    --star: #f59e0b;
    --ok: #059669;
    --warn: #d97706;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    min-height: 100vh;
    font-family: "Outfit", "SF Pro Text", sans-serif;
    color: var(--ink);
    background:
      radial-gradient(1200px 500px at 10% -10%, #ffffff 0%, transparent 55%),
      radial-gradient(900px 420px at 90% 0%, #e8eef8 0%, transparent 50%),
      var(--bg);
  }
  .page {
    max-width: 1180px;
    margin: 0 auto;
    padding: 28px 24px 64px;
  }
  .brand-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 22px;
  }
  .brand {
    display: flex;
    align-items: baseline;
    gap: 10px;
  }
  .brand h1 {
    margin: 0;
    font-size: 28px;
    letter-spacing: -0.04em;
    font-weight: 700;
  }
  .brand .dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: #22c55e;
    box-shadow: 0 0 0 4px rgba(34,197,94,0.15);
  }
  .brand-meta {
    color: var(--muted);
    font-size: 13px;
  }
  .nav-links {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
  }
  .nav-links a {
    color: var(--muted);
    text-decoration: none;
    font-size: 13px;
    font-weight: 600;
    padding: 8px 12px;
    border-radius: 999px;
    border: 1px solid transparent;
  }
  .nav-links a:hover {
    color: var(--ink);
    border-color: var(--line);
    background: var(--card);
  }
  .toolbar {
    display: grid;
    grid-template-columns: 1fr auto auto;
    gap: 10px;
    margin-bottom: 22px;
  }
  @media (max-width: 720px) {
    .toolbar { grid-template-columns: 1fr; }
  }
  .search {
    display: flex;
    align-items: center;
    gap: 10px;
    background: var(--card);
    border: 1px solid var(--line);
    border-radius: 999px;
    padding: 12px 16px;
    box-shadow: 0 1px 0 rgba(17,24,39,0.02);
  }
  .search svg { flex: 0 0 auto; color: #9ca3af; }
  .search input {
    border: 0;
    outline: 0;
    width: 100%;
    font: inherit;
    font-size: 14px;
    background: transparent;
    color: var(--ink);
  }
  .search input::placeholder { color: #9ca3af; }
  .tool-btn, .sort {
    appearance: none;
    border: 1px solid var(--line);
    background: var(--card);
    border-radius: 999px;
    padding: 0 16px;
    height: 46px;
    font: inherit;
    font-size: 13px;
    font-weight: 600;
    color: var(--ink);
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 8px;
  }
  .sort { padding-right: 12px; }
  .count-line {
    margin: 0 0 16px;
    color: var(--muted);
    font-size: 13px;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
    gap: 16px;
  }
  .card {
    position: relative;
    display: flex;
    flex-direction: column;
    background: var(--card);
    border: 1px solid var(--line);
    border-radius: 18px;
    padding: 14px 14px 16px;
    text-decoration: none;
    color: inherit;
    transition: transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease;
    box-shadow: 0 1px 0 rgba(17,24,39,0.03);
    min-height: 320px;
    cursor: pointer;
  }
  .card:hover {
    transform: translateY(-2px);
    border-color: #d1d5db;
    box-shadow: 0 12px 28px rgba(17,24,39,0.08);
  }
  .card-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-height: 22px;
    margin-bottom: 4px;
  }
  .no {
    font-family: "IBM Plex Mono", ui-monospace, monospace;
    font-size: 11px;
    letter-spacing: 0.04em;
    color: #9ca3af;
    font-weight: 500;
  }
  .featured {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.06em;
    color: #b45309;
    background: #fff7ed;
    border: 1px solid #fed7aa;
    border-radius: 999px;
    padding: 3px 8px;
  }
  .stage {
    position: relative;
    height: 168px;
    border-radius: 14px;
    overflow: hidden;
    display: grid;
    place-items: center;
    margin-bottom: 14px;
    background: var(--wash, #f3f4f6);
  }
  .stage::before {
    content: "";
    position: absolute;
    width: 132px;
    height: 132px;
    border-radius: 50%;
    background: radial-gradient(circle at 50% 45%, var(--glow, #ddd) 0%, transparent 68%);
    opacity: 0.95;
  }
  .stage object, .stage img {
    position: relative;
    width: 132px;
    height: 132px;
    object-fit: contain;
    pointer-events: none;
  }
  .stage .missing {
    position: relative;
    color: #9ca3af;
    font-size: 12px;
  }
  .name-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 6px;
  }
  .name {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 17px;
    font-weight: 700;
    letter-spacing: -0.02em;
  }
  .status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--ok);
    box-shadow: 0 0 0 3px rgba(5,150,105,0.12);
  }
  .status-dot.partial {
    background: var(--warn);
    box-shadow: 0 0 0 3px rgba(217,119,6,0.12);
  }
  .metric {
    font-family: "IBM Plex Mono", ui-monospace, monospace;
    font-size: 12px;
    color: var(--muted);
    white-space: nowrap;
  }
  .desc {
    margin: 0 0 14px;
    color: #4b5563;
    font-size: 13px;
    line-height: 1.45;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    min-height: 2.9em;
  }
  .tags {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 12px;
    min-height: 22px;
  }
  .tag {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: #6b7280;
    background: var(--soft);
    border: 1px solid var(--line);
    border-radius: 999px;
    padding: 3px 8px;
  }
  .footer {
    margin-top: auto;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }
  .by {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.08em;
    color: #9ca3af;
    text-transform: uppercase;
  }
  .cta {
    font-size: 12px;
    font-weight: 700;
    color: var(--accent-color, #111827);
  }
  .empty {
    grid-column: 1 / -1;
    text-align: center;
    padding: 48px 16px;
    color: var(--muted);
    border: 1px dashed var(--line);
    border-radius: 18px;
    background: rgba(255,255,255,0.5);
  }
  .foot-note {
    margin-top: 28px;
    color: #9ca3af;
    font-size: 12px;
  }
</style>
</head>
<body>
  <div class="page">
    <div class="brand-row">
      <div class="brand">
        <span class="dot" aria-hidden="true"></span>
        <div>
          <h1>PetDex</h1>
          <div class="brand-meta">${escapeHtml(catalog.subtitle)}</div>
        </div>
      </div>
      <nav class="nav-links">
        <a href="/">Pets</a>
        <a href="/cultivator">Cultivator States</a>
      </nav>
    </div>

    <div class="toolbar">
      <label class="search">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
          <circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>
        </svg>
        <input id="q" type="search" placeholder="Try 'wooden fish' or 'calico' or 'cloud'" autocomplete="off"/>
      </label>
      <button class="tool-btn" id="filterBtn" type="button" title="Toggle featured only">Filters</button>
      <select class="sort" id="sort">
        <option value="featured">Sort: Featured first</option>
        <option value="name">Sort: Name</option>
        <option value="states">Sort: Most states</option>
        <option value="assets">Sort: Most assets</option>
      </select>
    </div>

    <p class="count-line" id="countLine"></p>
    <div class="grid" id="grid"></div>
    <p class="foot-note">Built ${escapeHtml(catalog.builtAt)} · Scans <code>themes/*/theme.json</code> (skips template)</p>
  </div>
<script>
const DATA = ${dataJson};
let featuredOnly = false;

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function matches(pet, q) {
  if (!q) return true;
  const hay = [pet.name, pet.id, pet.author, pet.description, pet.blurb, ...(pet.tags || [])]
    .join(" ")
    .toLowerCase();
  return hay.includes(q);
}

function sortPets(list, mode) {
  const arr = list.slice();
  if (mode === "name") arr.sort((a, b) => a.name.localeCompare(b.name));
  else if (mode === "states") arr.sort((a, b) => b.stateCount - a.stateCount || a.name.localeCompare(b.name));
  else if (mode === "assets") arr.sort((a, b) => b.assetCount - a.assetCount || a.name.localeCompare(b.name));
  else arr.sort((a, b) => (b.featured - a.featured) || a.name.localeCompare(b.name));
  return arr;
}

function previewHtml(pet) {
  if (!pet.previewRel) return '<div class="missing">no preview</div>';
  const src = pet.previewRel + "?t=" + Date.now();
  if (pet.previewIsSvg) {
    return '<object type="image/svg+xml" data="' + src + '" width="132" height="132"></object>';
  }
  return '<img src="' + src + '" alt="' + escapeHtml(pet.name) + '" width="132" height="132"/>';
}

function cardHtml(pet) {
  const href = pet.href || ("#" + pet.id);
  const featured = pet.featured ? '<span class="featured">★ FEATURED</span>' : '<span></span>';
  const tags = (pet.tags || []).map((t) => '<span class="tag">' + escapeHtml(t) + '</span>').join("");
  const cta = pet.href ? "Open states →" : "Built-in";
  const metric = pet.stages
    ? ("↓ " + pet.stages + " stages")
    : ("↓ " + pet.stateCount + " states");
  return (
    '<a class="card" href="' + href + '" style="--glow:' + pet.glow + ';--wash:' + pet.wash + ';--accent-color:' + pet.accent + '">' +
      '<div class="card-top"><span class="no">NO. ' + String(pet.no).padStart(3, "0") + '</span>' + featured + '</div>' +
      '<div class="stage">' + previewHtml(pet) + '</div>' +
      '<div class="name-row">' +
        '<div class="name"><span class="status-dot ' + (pet.status === "partial" ? "partial" : "") + '"></span>' + escapeHtml(pet.name) + '</div>' +
        '<div class="metric">' + metric + '</div>' +
      '</div>' +
      '<p class="desc">' + escapeHtml(pet.description || pet.blurb) + '</p>' +
      '<div class="tags">' + tags +
        '<span class="tag">' + pet.assetCount + ' files</span>' +
        (pet.missingCount ? '<span class="tag">missing ' + pet.missingCount + '</span>' : '') +
      '</div>' +
      '<div class="footer">' +
        '<span class="by">BY ' + escapeHtml(pet.author) + '</span>' +
        '<span class="cta">' + cta + '</span>' +
      '</div>' +
    '</a>'
  );
}

function render() {
  const q = (document.getElementById("q").value || "").trim().toLowerCase();
  const sort = document.getElementById("sort").value;
  let list = DATA.pets.filter((p) => matches(p, q));
  if (featuredOnly) list = list.filter((p) => p.featured);
  list = sortPets(list, sort);
  document.getElementById("countLine").textContent =
    list.length + " companion" + (list.length === 1 ? "" : "s") +
    (featuredOnly ? " · featured only" : "") +
    " · " + DATA.pets.length + " built-in total";
  const grid = document.getElementById("grid");
  if (!list.length) {
    grid.innerHTML = '<div class="empty">No pets match that search.</div>';
    return;
  }
  grid.innerHTML = list.map(cardHtml).join("");
}

document.getElementById("q").addEventListener("input", render);
document.getElementById("sort").addEventListener("change", render);
document.getElementById("filterBtn").addEventListener("click", () => {
  featuredOnly = !featuredOnly;
  document.getElementById("filterBtn").textContent = featuredOnly ? "Filters · Featured" : "Filters";
  render();
});
render();
</script>
</body>
</html>
`;
}

function main() {
  const catalog = buildCatalog();
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(OUT_HTML, buildHtml(catalog), "utf8");
  console.log(`wrote ${path.relative(REPO_ROOT, OUT_HTML)}`);
  console.log(
    `pets=${catalog.pets.length}: ${catalog.pets.map((p) => p.id).join(", ")}`
  );
  console.log("");
  console.log("Serve with:");
  console.log("  npm run preview:petdex");
  console.log("  http://127.0.0.1:8766/");
  console.log("  http://127.0.0.1:8766/dex");
}

if (require.main === module) {
  main();
}

module.exports = { buildCatalog, buildHtml, OUT_HTML, OUT_DIR };
