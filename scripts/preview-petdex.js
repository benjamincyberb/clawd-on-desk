"use strict";

/**
 * Tiny static preview server for PetDex + Cultivator State Viewer.
 *
 * Routes:
 *   /              → PetDex gallery
 *   /dex           → PetDex gallery
 *   /cultivator    → Cultivator State Viewer
 *   /states        → Cultivator State Viewer
 *   /*             → files from repo root
 *
 * Usage:
 *   npm run preview:petdex
 *   node scripts/preview-petdex.js --port=8766
 */

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { URL } = require("node:url");

const REPO_ROOT = path.resolve(__dirname, "..");
const DEFAULT_PORT = 8766;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".wav": "audio/wav",
  ".mp3": "audio/mpeg",
  ".ico": "image/x-icon",
  ".map": "application/json",
};

function parseArgs(argv) {
  let port = DEFAULT_PORT;
  for (const arg of argv) {
    if (arg.startsWith("--port=")) {
      const n = Number(arg.slice("--port=".length));
      if (Number.isFinite(n) && n > 0) port = n;
    }
  }
  return { port };
}

function safeJoin(root, urlPath) {
  const decoded = decodeURIComponent(urlPath.split("?")[0]);
  const cleaned = decoded.replace(/^\/+/, "");
  const abs = path.resolve(root, cleaned);
  const rootWithSep = root.endsWith(path.sep) ? root : root + path.sep;
  if (abs !== root && !abs.startsWith(rootWithSep)) return null;
  return abs;
}

function sendFile(res, filePath) {
  fs.stat(filePath, (err, st) => {
    if (err || !st.isFile()) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not found");
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    const type = MIME[ext] || "application/octet-stream";
    res.writeHead(200, {
      "Content-Type": type,
      "Cache-Control": "no-store",
    });
    fs.createReadStream(filePath).pipe(res);
  });
}

function resolveRoute(pathname) {
  if (pathname === "/" || pathname === "/dex" || pathname === "/dex/") {
    return path.join(REPO_ROOT, "assets", "source", "petdex", "index.html");
  }
  if (
    pathname === "/cultivator" ||
    pathname === "/cultivator/" ||
    pathname === "/states" ||
    pathname === "/states/"
  ) {
    return path.join(REPO_ROOT, "assets", "source", "cultivator", "state-viewer.html");
  }
  return null;
}

function rebuild() {
  // Fresh catalog each server start
  const petdex = require("./build-petdex.js");
  const catalog = petdex.buildCatalog();
  fs.mkdirSync(petdex.OUT_DIR, { recursive: true });
  fs.writeFileSync(petdex.OUT_HTML, petdex.buildHtml(catalog), "utf8");
  console.log(`built ${path.relative(REPO_ROOT, petdex.OUT_HTML)} (${catalog.pets.length} pets)`);

  try {
    const viewer = require("./build-cultivator-state-viewer.js");
    const themePath = path.join(REPO_ROOT, "themes", "cultivator", "theme.json");
    const theme = JSON.parse(fs.readFileSync(themePath, "utf8"));
    const stateCatalog = viewer.buildCatalog(theme);
    fs.mkdirSync(path.dirname(viewer.OUT_HTML), { recursive: true });
    fs.writeFileSync(viewer.OUT_HTML, viewer.buildHtml(stateCatalog), "utf8");
    console.log(`built ${path.relative(REPO_ROOT, viewer.OUT_HTML)}`);
  } catch (err) {
    console.warn("state-viewer build skipped:", err && err.message ? err.message : err);
  }
}

function main() {
  const { port } = parseArgs(process.argv.slice(2));
  rebuild();

  const server = http.createServer((req, res) => {
    const url = new URL(req.url || "/", `http://127.0.0.1:${port}`);
    const routed = resolveRoute(url.pathname);
    if (routed) {
      sendFile(res, routed);
      return;
    }
    const filePath = safeJoin(REPO_ROOT, url.pathname);
    if (!filePath) {
      res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Forbidden");
      return;
    }
    sendFile(res, filePath);
  });

  server.listen(port, "127.0.0.1", () => {
    console.log(`PetDex preview on http://127.0.0.1:${port}/`);
    console.log(`  /              PetDex gallery`);
    console.log(`  /dex           PetDex gallery`);
    console.log(`  /cultivator    Cultivator State Viewer`);
    console.log(`  /states        Cultivator State Viewer`);
  });
}

if (require.main === module) {
  main();
}

module.exports = { resolveRoute, safeJoin };
