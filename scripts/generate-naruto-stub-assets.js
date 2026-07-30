#!/usr/bin/env node
"use strict";

/**
 * Spec scaffold: minimal Storm-colored SVG stubs for themes/naruto.
 * Replace with AI pipeline embeds later — these only make the theme loadable.
 */

const fs = require("fs");
const path = require("path");

const REPO_ROOT = path.join(__dirname, "..");
const MANIFEST_PATH = path.join(REPO_ROOT, "assets", "source", "naruto", "manifest.json");
const OUT_DIR = path.join(REPO_ROOT, "themes", "naruto", "assets");

const ACTIONS = ["idle", "thinking", "working", "attention", "error", "sleeping"];

function stubSvg(stage, action) {
  const p = stage.palette || {};
  const suit = p.suit || "#F06B1F";
  const suitDark = p.suitDark || "#C44E12";
  const skin = p.skin || "#FFE8D6";
  const hair = p.hair || "#F5C842";
  const accent = p.accent || "#1C1C22";
  const chakra = p.chakra || "#4DB8FF";
  const outline = "#1A1208";

  const sleepy = action === "sleeping";
  const err = action === "error";
  const thinking = action === "thinking";
  const attention = action === "attention";
  const working = action === "working";

  const eyeY = sleepy ? 7.2 : 6.8;
  const eyeOpen = sleepy
    ? `<path d="M5.2 ${eyeY}h1.6M9.2 ${eyeY}h1.6" stroke="${outline}" stroke-width="0.35" stroke-linecap="round"/>`
    : err
      ? `<path d="M5.1 6.4l1.8 1.8M6.9 6.4l-1.8 1.8M9.1 6.4l1.8 1.8M10.9 6.4l-1.8 1.8" stroke="${outline}" stroke-width="0.32" stroke-linecap="round"/>`
      : `<circle cx="6" cy="${eyeY}" r="0.55" fill="${outline}"/><circle cx="10" cy="${eyeY}" r="0.55" fill="${outline}"/>`;

  const mouth = attention
    ? `<path d="M7 9.2c0.6 0.7 1.4 0.7 2 0" fill="none" stroke="${outline}" stroke-width="0.32" stroke-linecap="round"/>`
    : err
      ? `<path d="M7.2 9.6c0.5-0.5 1.1-0.5 1.6 0" fill="none" stroke="${outline}" stroke-width="0.32" stroke-linecap="round"/>`
      : `<ellipse cx="8" cy="9.3" rx="0.7" ry="0.35" fill="${outline}"/>`;

  const arms = working
    ? `<g id="arms">
      <path d="M3.5 12.5 Q2.2 10.5 4.2 9.2" fill="none" stroke="${skin}" stroke-width="1.1" stroke-linecap="round"/>
      <path d="M12.5 12.5 Q13.8 10.5 11.8 9.2" fill="none" stroke="${skin}" stroke-width="1.1" stroke-linecap="round"/>
      <circle cx="4.1" cy="9.1" r="0.55" fill="${skin}" stroke="${outline}" stroke-width="0.2"/>
      <circle cx="11.9" cy="9.1" r="0.55" fill="${skin}" stroke="${outline}" stroke-width="0.2"/>
    </g>`
    : thinking
      ? `<g id="arms">
      <path d="M12.2 12.8 Q13.5 10.2 10.8 8.6" fill="none" stroke="${skin}" stroke-width="1.1" stroke-linecap="round"/>
      <circle cx="10.7" cy="8.5" r="0.55" fill="${skin}" stroke="${outline}" stroke-width="0.2"/>
    </g>`
      : `<g id="arms">
      <ellipse cx="3.8" cy="13.5" rx="1.1" ry="1.6" fill="${suit}" stroke="${outline}" stroke-width="0.28"/>
      <ellipse cx="12.2" cy="13.5" rx="1.1" ry="1.6" fill="${suit}" stroke="${outline}" stroke-width="0.28"/>
    </g>`;

  const aura = stage.id === "kurama" || stage.id === "sixpaths" || stage.id === "kcm"
    ? `<circle cx="8" cy="11" r="9" fill="${chakra}" opacity="0.12"/>`
    : stage.id === "sage" || stage.id === "genin"
      ? `<circle cx="8" cy="11" r="8.2" fill="${chakra}" opacity="0.06"/>`
      : "";

  const headband = (stage.accessories || []).includes("headband")
    ? `<rect x="4.2" y="4.6" width="7.6" height="1.1" rx="0.2" fill="${accent}" stroke="${outline}" stroke-width="0.2"/>
       <rect x="6.6" y="4.75" width="2.8" height="0.8" rx="0.1" fill="#C0C4C8" stroke="${outline}" stroke-width="0.15"/>`
    : "";

  const orbs = (stage.accessories || []).includes("truthSeekerOrbs")
    ? `<g opacity="0.85">
      <circle cx="8" cy="2.2" r="0.55" fill="${accent}"/>
      <circle cx="12.8" cy="4.5" r="0.55" fill="${accent}"/>
      <circle cx="13.5" cy="9.5" r="0.55" fill="${accent}"/>
      <circle cx="11.5" cy="14.2" r="0.55" fill="${accent}"/>
      <circle cx="4.5" cy="14.2" r="0.55" fill="${accent}"/>
      <circle cx="2.5" cy="9.5" r="0.55" fill="${accent}"/>
    </g>`
    : "";

  const clone = (stage.accessories || []).includes("cloneAfterimage")
    ? `<g opacity="0.28" transform="translate(3.2,0.4)">
      <ellipse cx="8" cy="19.2" rx="3.2" ry="0.7" fill="${outline}" opacity="0.15"/>
      <ellipse cx="8" cy="14.5" rx="3.4" ry="4.2" fill="${suit}"/>
      <circle cx="8" cy="7.2" r="2.6" fill="${skin}"/>
    </g>`
    : "";

  const bodyY = sleepy ? 1.2 : 0;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="-8 -6 32 32" width="256" height="256">
<!-- naruto:${stage.id}:${action} stub (scripts/generate-naruto-stub-assets.js) — replace via AI pipeline -->
<style><![CDATA[
@keyframes breathe { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-0.25px); } }
#body-js { animation: breathe 2.4s ease-in-out infinite; transform-box: fill-box; transform-origin: center bottom; }
]]></style>
${aura}
${clone}
${orbs}
<g id="shadow-js">
  <ellipse cx="8" cy="19.4" rx="3.6" ry="0.75" fill="${outline}" opacity="0.22"/>
</g>
<g id="body-js" transform="translate(0 ${bodyY})">
  <!-- legs -->
  <ellipse cx="6.2" cy="18.2" rx="1.3" ry="1.5" fill="${accent}" stroke="${outline}" stroke-width="0.28"/>
  <ellipse cx="9.8" cy="18.2" rx="1.3" ry="1.5" fill="${accent}" stroke="${outline}" stroke-width="0.28"/>
  <!-- torso -->
  <path d="M4.2 11.2 Q4 16.8 6 18.6 L10 18.6 Q12 16.8 11.8 11.2 Z" fill="${suit}" stroke="${outline}" stroke-width="0.32"/>
  <path d="M5 11.4 L8 17.2 L11 11.4" fill="${suitDark}" opacity="0.35"/>
  ${arms}
  <!-- head -->
  <circle cx="8" cy="7" r="3.1" fill="${skin}" stroke="${outline}" stroke-width="0.32"/>
  <!-- hair -->
  <path d="M5.2 5.2 Q4.4 3.2 5.8 2.4 Q6.6 3.6 7.2 4.2 Q7.6 2.2 8.2 1.8 Q8.8 2.2 9 4.1 Q9.8 2.8 11 2.6 Q11.6 4 10.8 5.3 Q11.8 5.6 11.6 6.6 Q10.2 6.2 8 6.1 Q5.8 6.2 4.5 6.7 Q4.4 5.7 5.2 5.2 Z"
        fill="${hair}" stroke="${outline}" stroke-width="0.28"/>
  ${headband}
  <!-- whiskers -->
  <path d="M4.6 7.4h1.3M4.7 8.1h1.2M4.8 8.8h1.1M10.1 7.4h1.3M10.1 8.1h1.2M10.1 8.8h1.1"
        stroke="${outline}" stroke-width="0.22" stroke-linecap="round" opacity="0.75"/>
  <g id="eyes-js">${eyeOpen}</g>
  ${mouth}
  ${(stage.accessories || []).includes("sageMarkings")
    ? `<ellipse cx="5.3" cy="7.5" rx="0.55" ry="0.9" fill="${chakra}" opacity="0.85"/><ellipse cx="10.7" cy="7.5" rx="0.55" ry="0.9" fill="${chakra}" opacity="0.85"/>`
    : ""}
</g>
</svg>
`;
}

function main() {
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
  fs.mkdirSync(OUT_DIR, { recursive: true });
  let written = 0;
  for (const stage of manifest.stages) {
    for (const action of ACTIONS) {
      if (stage.noKnock && action === "working") {
        // kurama: still write a working stub that matches idle so file refs exist
      }
      const file = path.join(OUT_DIR, `${stage.id}-${action}.svg`);
      fs.writeFileSync(file, stubSvg(stage, action), "utf8");
      written += 1;
    }
  }
  console.log(`wrote ${written} stub svg(s) → ${path.relative(REPO_ROOT, OUT_DIR)}`);
}

main();
