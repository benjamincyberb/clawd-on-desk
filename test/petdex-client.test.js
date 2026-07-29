"use strict";

const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const petdex = require("../src/petdex-client");
const adapter = require("../src/codex-pet-adapter");

const FIXTURE_DIR = path.join(__dirname, "fixtures", "codex-pets", "tiny-atlas-png");

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "clawd-petdex-"));
}

function sampleManifest() {
  return {
    generatedAt: "2026-07-17T01:58:36.452Z",
    total: 2,
    pets: [
      {
        slug: "homelander",
        displayName: "Homelander",
        kind: "character",
        submittedBy: "Serhat",
        spritesheetUrl: "https://assets.petdex.dev/pets/homelander-x/sprite.webp",
        petJsonUrl: "https://assets.petdex.dev/pets/homelander-x/petjson.json",
        zipUrl: "https://assets.petdex.dev/pets/homelander-x/zip.zip",
      },
      {
        slug: "boba",
        displayName: "Boba",
        kind: "food",
        submittedBy: "crafter",
        spritesheetUrl: "https://assets.petdex.dev/pets/boba-y/sprite.webp",
        petJsonUrl: "",
        zipUrl: "https://assets.petdex.dev/pets/boba-y/zip.zip",
      },
    ],
  };
}

// Build a minimal Codex-pet zip the same way the importer test does, using the
// checked-in tiny-atlas fixture so validation passes end to end.
function makeZip(entries) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  const zlib = require("node:zlib");
  for (const entry of entries) {
    const name = Buffer.from(entry.name, "utf8");
    const raw = Buffer.isBuffer(entry.data) ? entry.data : Buffer.from(entry.data || "");
    const compressed = zlib.deflateRawSync(raw);
    const crc = crc32(raw);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(8, 8);
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(0, 12);
    local.writeUInt32LE(crc >>> 0, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    localParts.push(local, name, compressed);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(0, 14);
    central.writeUInt32LE(crc >>> 0, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(raw.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    centralParts.push(central, name);
    offset += local.length + name.length + compressed.length;
  }
  const centralBuf = Buffer.concat(centralParts);
  const localBuf = Buffer.concat(localParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralBuf.length, 12);
  end.writeUInt32LE(localBuf.length, 16);
  end.writeUInt16LE(0, 20);
  return Buffer.concat([localBuf, centralBuf, end]);
}

function crc32(buf) {
  let crc = ~0;
  for (let i = 0; i < buf.length; i += 1) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return ~crc;
}

test("parsePetdexManifest reads the {generatedAt,total,pets} shape", () => {
  const manifest = petdex.parsePetdexManifest(Buffer.from(JSON.stringify(sampleManifest())));
  assert.equal(manifest.total, 2);
  assert.equal(manifest.pets[0].slug, "homelander");
  assert.equal(manifest.pets[0].displayName, "Homelander");
  assert.equal(manifest.pets[0].zipUrl, "https://assets.petdex.dev/pets/homelander-x/zip.zip");
});

test("parsePetdexManifest also accepts a bare pets array", () => {
  const manifest = petdex.parsePetdexManifest(JSON.stringify(sampleManifest().pets));
  assert.equal(manifest.total, 2);
  assert.equal(manifest.pets[1].slug, "boba");
});

test("parsePetdexManifest drops entries without slug or download url", () => {
  const manifest = petdex.parsePetdexManifest(
    JSON.stringify({ pets: [{ displayName: "no slug" }, { slug: "x" }, sampleManifest().pets[0]] })
  );
  assert.equal(manifest.total, 1);
  assert.equal(manifest.pets[0].slug, "homelander");
});

test("parsePetdexManifest rejects malformed input", () => {
  assert.throws(() => petdex.parsePetdexManifest("not json"), /invalid petdex manifest/);
  assert.throws(() => petdex.parsePetdexManifest(JSON.stringify({ nope: 1 })), /missing a pets array/);
});

test("findPetdexPet matches slug case-insensitively", () => {
  const manifest = sampleManifest();
  assert.equal(petdex.findPetdexPet(manifest, "HOMELANDER").slug, "homelander");
  assert.equal(petdex.findPetdexPet(manifest, "missing"), null);
});

test("searchPetdexPets filters by slug/name/kind and respects limit", () => {
  const manifest = sampleManifest();
  assert.equal(petdex.searchPetdexPets(manifest, "food").length, 1);
  assert.equal(petdex.searchPetdexPets(manifest, "food")[0].slug, "boba");
  assert.equal(petdex.searchPetdexPets(manifest, "").length, 2);
  assert.equal(petdex.searchPetdexPets(manifest, "", { limit: 1 }).length, 1);
});

test("resolvePetDownloadUrl prefers the zip, then pet.json", () => {
  assert.equal(
    petdex.resolvePetDownloadUrl({ slug: "a", zipUrl: "https://x/z.zip", petJsonUrl: "https://x/p.json" }),
    "https://x/z.zip"
  );
  assert.equal(
    petdex.resolvePetDownloadUrl({ slug: "a", zipUrl: "", petJsonUrl: "https://x/p.json" }),
    "https://x/p.json"
  );
  assert.throws(() => petdex.resolvePetDownloadUrl({ slug: "a" }), /no installable download url/i);
});

test("fetchPetdexManifest uses the injected fetcher", async () => {
  const calls = [];
  const manifest = await petdex.fetchPetdexManifest({
    fetchBuffer: async (href) => {
      calls.push(href);
      return Buffer.from(JSON.stringify(sampleManifest()));
    },
  });
  assert.equal(calls[0], petdex.DEFAULT_MANIFEST_URL);
  assert.equal(manifest.total, 2);
});

test("installPetdexPet downloads the zip and materializes a Clawd theme", async () => {
  const spritesheet = fs.readFileSync(path.join(FIXTURE_DIR, "spritesheet.png"));
  const petJson = JSON.stringify({
    id: "tiny-atlas-png",
    displayName: "Tiny Atlas",
    description: "fixture",
    spritesheetPath: "spritesheet.png",
  });
  const zip = makeZip([
    { name: "pet.json", data: petJson },
    { name: "spritesheet.png", data: spritesheet },
  ]);

  const codexPetsDir = makeTempDir();
  const userThemesDir = makeTempDir();

  const result = await petdex.installPetdexPet({
    manifest: sampleManifest(),
    slug: "homelander",
    codexPetsDir,
    fetchBuffer: async (href, opts) => {
      assert.equal(href, "https://assets.petdex.dev/pets/homelander-x/zip.zip");
      assert.equal(opts.kind, "zip");
      return zip;
    },
  });

  assert.equal(result.pet.slug, "homelander");
  assert.ok(fs.existsSync(path.join(result.packageDir, "pet.json")));

  // The installed package must be materializable into a Clawd theme.
  const sync = adapter.syncCodexPetThemes({ codexPetsDir, userThemesDir });
  assert.equal(sync.imported, 1);
  const themeDir = path.join(userThemesDir, sync.themes[0].themeId);
  assert.ok(fs.existsSync(path.join(themeDir, "theme.json")));
});

test("installPetdexPet errors clearly for an unknown slug", async () => {
  await assert.rejects(
    petdex.installPetdexPet({ manifest: sampleManifest(), slug: "ghost", codexPetsDir: makeTempDir() }),
    /petdex pet not found: ghost/
  );
});
