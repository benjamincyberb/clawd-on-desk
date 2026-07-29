"use strict";

const test = require("node:test");
const assert = require("node:assert");

const createCodexPetMain = require("../src/codex-pet-main");

// Build a codexPetMain with a stubbed petdex client + just enough of the other
// dependencies for the petdex methods to run. The heavy adopt path reuses
// materializeAndActivateImportedPet, which calls syncThemes + applyCommand.
function makeRuntime(overrides = {}) {
  const applyCalls = [];
  const runtime = createCodexPetMain({
    app: { getPath: () => "user-data", isReady: () => false },
    dialog: { async showMessageBox() { return { response: 1 }; } },
    shell: {},
    settingsController: {
      get: () => "clawd",
      async applyCommand(command, payload) {
        applyCalls.push({ command, payload });
        return { status: "ok" };
      },
    },
    themeLoader: { getThemeMetadata: () => ({ name: "Homelander" }) },
    codexPetAdapter: {
      // Pretend the installed package materialized into this theme.
      syncCodexPetThemes: () => ({
        themes: [{ themeId: "codex-pet-homelander", packageDir: "/pets/homelander" }],
      }),
      readManagedMarker: () => null,
    },
    codexPetImporter: {
      ERR_REPLACE_DECLINED: "ERR_CLAWD_CODEX_PET_REPLACE_DECLINED",
    },
    petdexClient: overrides.petdexClient,
  });
  return { runtime, applyCalls };
}

const SAMPLE_MANIFEST = {
  generatedAt: "2026-07-17T00:00:00.000Z",
  total: 1,
  pets: [
    {
      slug: "homelander",
      displayName: "Homelander",
      kind: "character",
      submittedBy: "Serhat",
      spritesheetUrl: "https://assets.petdex.dev/pets/homelander-x/sprite.webp",
      zipUrl: "https://assets.petdex.dev/pets/homelander-x/zip.zip",
    },
  ],
};

test("browsePetdexPets returns a trimmed pet list", async () => {
  const { runtime } = makeRuntime({
    petdexClient: {
      fetchPetdexManifest: async () => SAMPLE_MANIFEST,
      searchPetdexPets: (manifest, query, opts) => {
        assert.equal(query, "home");
        assert.equal(opts.limit, 60);
        return manifest.pets;
      },
    },
  });
  const result = await runtime.browsePetdexPets({ query: "home" });
  assert.equal(result.status, "ok");
  assert.equal(result.total, 1);
  assert.equal(result.pets[0].slug, "homelander");
  // Download URLs are not leaked to the renderer, only display metadata + preview.
  assert.equal(result.pets[0].zipUrl, undefined);
});

test("browsePetdexPets surfaces fetch errors", async () => {
  const { runtime } = makeRuntime({
    petdexClient: {
      fetchPetdexManifest: async () => { throw new Error("offline"); },
      searchPetdexPets: () => [],
    },
  });
  const result = await runtime.browsePetdexPets({});
  assert.equal(result.status, "error");
  assert.match(result.message, /offline/);
});

test("adoptPetdexPet installs, materializes, and activates the theme", async () => {
  const installCalls = [];
  const { runtime, applyCalls } = makeRuntime({
    petdexClient: {
      fetchPetdexManifest: async () => SAMPLE_MANIFEST,
      findPetdexPet: (manifest, slug) => manifest.pets.find((p) => p.slug === slug) || null,
      installPetdexPet: async (opts) => {
        installCalls.push(opts.pet.slug);
        return {
          packageDir: "/pets/homelander",
          packageInfo: { id: "homelander", displayName: "Homelander" },
        };
      },
    },
  });

  const result = await runtime.adoptPetdexPet("homelander");
  assert.equal(result.status, "ok");
  assert.equal(result.themeId, "codex-pet-homelander");
  assert.equal(result.imported.slug, "homelander");
  assert.deepEqual(installCalls, ["homelander"]);
  // It must switch the active theme to the newly materialized one.
  assert.equal(applyCalls[0].command, "setThemeSelection");
  assert.equal(applyCalls[0].payload.themeId, "codex-pet-homelander");
});

test("adoptPetdexPet rejects a blank slug", async () => {
  const { runtime } = makeRuntime({ petdexClient: {} });
  const result = await runtime.adoptPetdexPet("   ");
  assert.equal(result.status, "error");
  assert.match(result.message, /slug is required/);
});

test("adoptPetdexPet reports an unknown slug", async () => {
  const { runtime } = makeRuntime({
    petdexClient: {
      fetchPetdexManifest: async () => SAMPLE_MANIFEST,
      findPetdexPet: () => null,
    },
  });
  const result = await runtime.adoptPetdexPet("ghost");
  assert.equal(result.status, "error");
  assert.match(result.message, /not found: ghost/);
});
