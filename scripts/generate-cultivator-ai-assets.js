"use strict";

/**
 * Cultivator AI sprite pipeline:
 * 1) Expect idle / thinking / working-sheet PNGs in assets/source/cultivator/generated/
 * 2) Split working sheets into 6 full frames (transparent-gap based)
 * 3) Chroma-key backgrounds to alpha
 * 4) Embed into CSS-animated SVG wrappers (idle/working/thinking)
 * 5) Refresh programmatic attention/error/sleeping fallbacks
 *
 * Prompt constraints live ONLY in REF_STYLE / STAGE_PROMPTS / KNOCK_FRAME_SEQUENCE.
 * Change generation rules here (then update docs/guides/cultivator-asset-pipeline.md).
 * Do not fix bad sheets with lock/composite scripts — regenerate under these constraints.
 * Print prompts: node scripts/generate-cultivator-ai-assets.js --prompts
 */

const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const REPO_ROOT = path.resolve(__dirname, "..");
const MANIFEST_PATH = path.join(REPO_ROOT, "assets", "source", "cultivator", "manifest.json");
const GENERATED_DIR = path.join(REPO_ROOT, "assets", "source", "cultivator", "generated");
const REFERENCE_PATH = path.join(
  REPO_ROOT, "assets", "source", "cultivator", "reference", "chibi-monk-reference.png"
);

const REF_STYLE = "High-quality chibi pixel-art mobile game sprite matching reference: thick black outlines, vibrant colors, soft cel shading, large sparkling eyes, pink blush, full body centered, fully transparent background alpha, NO text, NO UI, NO solid backdrop";

// FX (halo / 佛光 backlight / 祥云 clouds / lotus petals) is composited later in CSS, so
// the character art itself MUST be clean. Baking any aura/ring/clouds/lotus/petals/props
// makes idle→working jump (aura appears in one art but not the split working frames) and
// pollutes the idle body-height anchor used by the splitter. Forbid it everywhere.
// Knock/ambient FX (祥云 / floating petals / soft procedural glow for lower tiers) is
// composited later in CSS. Structural seat props that define a stage identity
// (Buddha lotus throne + ornate mandorla halo) ARE allowed in that stage's art —
// but must be identical across idle and any working variant.
const FORBIDDEN_FX =
  "FORBIDDEN (drawn later in code, never in the art): soft procedural glow-only backlight " +
  "(unless an ornate solid mandorla ring is required for this stage), 祥云 clouds, cloud swirls, " +
  "floating flower petals, sparkles, candle, incense, bell, wooden fish / muyu, mallet, or any side props";

const FORBIDDEN_FX_LOWER =
  "FORBIDDEN (drawn later in code, never in the art): golden halo, Buddha-light backlight, " +
  "aura, glow, radial light, large moral back ring / mandorla, 祥云 clouds, cloud swirls, " +
  "lotus throne / lotus seat, floating flower petals, sparkles, candle, incense, bell, or any side props";

const STAGE_PROMPTS = {
  mortal: `${REF_STYLE}. 凡人: short black hair peasant (NOT bald monk), plain brown hemp clothes, seated cross-legged, wooden fish on the ground. ${FORBIDDEN_FX_LOWER}. Also FORBIDDEN: kasaya, crown, beads`,
  adept: `${REF_STYLE}. 修行者: simple yellow-brown robe, small prayer beads only, seated cross-legged. ${FORBIDDEN_FX_LOWER}. Also FORBIDDEN: kasaya, crown`,
  novice: `${REF_STYLE}. 小和尚: bald young monk, simple yellow robe, prayer beads, seated cross-legged. ${FORBIDDEN_FX_LOWER}. Also FORBIDDEN: kasaya, crown`,
  arhat: `${REF_STYLE}. 罗汉: bald, patchwork kasaya robe, prayer beads, seated cross-legged on the ground. ${FORBIDDEN_FX_LOWER}. Also FORBIDDEN: crown`,
  bodhisattva: `${REF_STYLE}. 男菩萨 MALE bodhisattva: clearly MASCULINE young man face (calm confident, flat chest, NO lipstick, NO feminine makeup, NO female appearance), ornate golden crown/headdress, red grid-pattern kasaya over yellow robe, jeweled necklace, prayer beads, seated cross-legged. ${FORBIDDEN_FX_LOWER}`,
  // Buddha: meditating Tathagata on lotus — NO wooden-fish knock. Ornate mandorla halo +
  // lotus throne ARE baked into the art (stage identity). Working reuses idle + code 祥云.
  buddha: `${REF_STYLE}. 佛祖 如来 Tathagata Buddha, MAGNIFICENT ornate meditation portrait matching traditional 如来: bald head with tight dark-blue snail-shell curls (螺发), rounded ushnisha (肉髻) with golden jewel on top, long elongated earlobes, serene gentle face with faint smile and urna forehead mark. ORNATE golden kasaya: rich saffron-gold robe with elaborate gold trim, red-and-gold grid/patchwork drape over left shoulder, jeweled gold necklace and armlets. Seated cross-legged ON a pink-and-gold lotus throne / 莲花台. REQUIRED BEHIND THE HEAD: a large ornate circular golden mandorla / 光环 (solid decorative ring with concentric filigree geometric patterns and small gemstones, plus soft golden light rays radiating outward) — this halo MUST be clearly visible and magnificent. Meditation mudra, hands in lap. NO wooden fish, NO mallet, NOT knocking. FORBIDDEN in art: 祥云 clouds, floating petals, wooden fish, mallet (祥云 added later in code for working). Also FORBIDDEN: afro hair, western curly hair, crown/headdress`,
};

const KNOCK_FRAME_SEQUENCE =
  "exactly 6 equal-sized FULL-BODY character panels in one horizontal row left-to-right, " +
  "separated by clear wide transparent gaps between panels (panels must not touch or overlap). " +
  "CORE TASK: copy the provided idle portrait into all 6 panels and ONLY animate the knocking arm + mallet — " +
  "this is NOT six different drawings. " +
  "IDLE LOCK: head, face, torso, crossed legs, and seat occupy the SAME pixels " +
  "in every panel at the SAME scale; front view, upright, zero head tilt, zero body lean. " +
  "SIZE LOCK (CRITICAL): the character BODY (head-top down to the seat) is the EXACT same height and width " +
  "in all 6 panels and identical to the idle portrait. Do NOT shrink or zoom the character to make the " +
  "raised mallet fit — the character must NOT get smaller when knocking. Only the right arm + mallet move; " +
  "let the raised mallet extend UP into the transparent top padding rather than scaling the body down. " +
  "The wooden fish keeps the same size and position in every panel too. " +
  "FACE CLEAN: no gray smudges, no noise, no blur, no double-exposure or ghosting on the face. " +
  "SAFE MARGINS: the seated body fills ~68-75% of each panel height and sits on the SAME baseline in every panel; " +
  "leave transparent padding above the head (room for the raised mallet), below the seat, and on both sides. " +
  "CRITICAL: wooden fish (muyu) and mallet MUST stay on the SAME side in ALL 6 panels " +
  "(viewer's left / character's right hand knocking) — never flip left/right between panels. " +
  "FISH ANCHORED: the wooden fish + red cushion are NAILED to one fixed (x,y) spot in all 6 panels — " +
  "identical size and position, they must NOT slide left/right, drift up/down, rotate or resize; " +
  "only the mallet approaches and taps it. " +
  "SEAT LOCK: if the idle portrait includes a lotus throne / 莲花台 under the figure, copy that " +
  "exact same lotus seat into every panel at the SAME pixels — never remove, resize, or shift it. " +
  "FX IN CODE: do NOT draw motion lines, impact stars, Buddha-light halos/backlights, glowing bursts, " +
  "cloud-scroll (ruyi) swirls, or animated cloud puffs — strike feedback (祥云卷纹 cloud-scroll curls, " +
  "golden 佛光 radial backlight, glow, floating petals) is added later in CSS, so keep every frame clean " +
  "(lotus seat is NOT FX — keep it if present in idle). " +
  "Panel poses: (1) raise wooden mallet high, (2) slightly lower, (3) swing mallet down close to fish, " +
  "(4) strike woodfish on lap with tiny yellow spark, (5) recoil slightly up, (6) rest just above the fish. " +
  "Each panel is a COMPLETE full-body character (body+face+robe+props) drawn in one piece — " +
  "NEVER an isolated arm, NEVER split the arm onto a separate layer/panel from the body. " +
  "Fully transparent background, NO text, NO UI, NO panel borders, NO solid backdrop.";

function runNodeScript(scriptRel, args = []) {
  execFileSync(process.execPath, [path.join(REPO_ROOT, scriptRel), ...args], {
    cwd: REPO_ROOT,
    stdio: "inherit",
  });
}

function buildWorkingSheetPrompt(stageId) {
  return `${STAGE_PROMPTS[stageId]}. ONE horizontal sprite sheet: ${KNOCK_FRAME_SEQUENCE} Match the confirmed idle portrait of this stage exactly.`;
}

function listMissing(stageIds) {
  const missing = [];
  for (const stageId of stageIds) {
    for (const asset of ["idle", "thinking"]) {
      const target = path.join(GENERATED_DIR, `${stageId}-${asset}.png`);
      if (!fs.existsSync(target)) missing.push(path.relative(REPO_ROOT, target));
    }
    // Buddha (and any future no-knock stage) reuses idle for working — no sheet required.
    if (stageId === "buddha") continue;
    const sheet = path.join(GENERATED_DIR, `${stageId}-working-sheet.png`);
    if (!fs.existsSync(sheet)) missing.push(path.relative(REPO_ROOT, sheet));
  }
  return missing;
}

function main(argv = process.argv.slice(2)) {
  if (argv.includes("--prompts")) {
    for (const [id, prompt] of Object.entries(STAGE_PROMPTS)) {
      console.log(`\n=== ${id} idle ===\n${prompt}`);
      console.log(`=== ${id} working-sheet ===\n${buildWorkingSheetPrompt(id)}`);
    }
    return;
  }

  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
  const stageIds = manifest.stages.map((s) => s.id);
  const missing = listMissing(stageIds);
  if (missing.length) {
    console.log("Missing PNG sprites (generate with Cursor GenerateImage + reference):");
    for (const m of missing) console.log(`  ${m}`);
    console.log(`reference: ${REFERENCE_PATH}`);
    if (!argv.includes("--force")) process.exit(1);
  }

  runNodeScript("scripts/split-cultivator-spritesheet.js");
  runNodeScript("scripts/make-cultivator-pngs-transparent.js");
  runNodeScript("scripts/embed-cultivator-ai-svgs.js", ["--actions=idle,working,thinking"]);

  const { generateAll, OUT_DIR } = require("./generate-cultivator-assets");
  const files = generateAll({ ...manifest, actions: ["attention", "error", "sleeping"] });
  for (const [name, content] of files) {
    fs.writeFileSync(path.join(OUT_DIR, name), content, "utf8");
  }
  console.log(`refreshed ${files.size} programmatic fallback SVG(s)`);
}

if (require.main === module) main();

module.exports = {
  STAGE_PROMPTS,
  buildWorkingSheetPrompt,
  GENERATED_DIR,
  REFERENCE_PATH,
};
