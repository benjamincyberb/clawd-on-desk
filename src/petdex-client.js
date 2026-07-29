"use strict";

// Petdex integration for Clawd on Desk.
//
// Petdex (https://petdex.dev) is a public gallery of animated coding-agent pets.
// Its pet package format is identical to the Codex Pet atlas Clawd already
// ingests (1536x1872 webp/png, 8x9 grid of 192x208 frames, pet.json with
// { id, displayName, description, spritesheetPath }). So this module is a thin
// client: it fetches the Petdex manifest, lets callers browse/search it, and
// installs a chosen pet by delegating the download to the existing
// codex-pet-importer (which then materializes a Clawd theme via the adapter).
//
// The heavy lifting — SSRF guards, redirect handling, size caps, zip
// extraction, spritesheet validation, theme materialization — all lives in
// codex-pet-importer / codex-pet-adapter and is reused as-is.

const importer = require("./codex-pet-importer");

// Where the redirect at petdex.dev/api/manifest ultimately points. Callers may
// override via options.manifestUrl; the importer's downloadHttpsBuffer follows
// the 307 from the api path too, but resolving directly avoids one hop.
const DEFAULT_MANIFEST_URL = "https://petdex.dev/api/manifest";
const MAX_MANIFEST_BYTES = 8 * 1024 * 1024;

function parsePetdexManifest(buffer) {
  let text;
  if (Buffer.isBuffer(buffer)) {
    if (buffer.length > MAX_MANIFEST_BYTES) {
      throw new Error(`petdex manifest exceeds ${MAX_MANIFEST_BYTES} bytes`);
    }
    text = buffer.toString("utf8");
  } else if (typeof buffer === "string") {
    text = buffer;
  } else {
    throw new Error("petdex manifest must be a Buffer or string");
  }

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    throw new Error(`invalid petdex manifest JSON: ${err.message}`);
  }

  const rawPets = Array.isArray(parsed) ? parsed : parsed && parsed.pets;
  if (!Array.isArray(rawPets)) {
    throw new Error("petdex manifest is missing a pets array");
  }

  const pets = [];
  for (const entry of rawPets) {
    const pet = normalizePetEntry(entry);
    if (pet) pets.push(pet);
  }

  return {
    generatedAt: parsed && typeof parsed.generatedAt === "string" ? parsed.generatedAt : null,
    total: pets.length,
    pets,
  };
}

function normalizePetEntry(entry) {
  if (!entry || typeof entry !== "object") return null;
  const slug = typeof entry.slug === "string" ? entry.slug.trim() : "";
  if (!slug) return null;
  const zipUrl = typeof entry.zipUrl === "string" ? entry.zipUrl.trim() : "";
  const spritesheetUrl = typeof entry.spritesheetUrl === "string" ? entry.spritesheetUrl.trim() : "";
  const petJsonUrl = typeof entry.petJsonUrl === "string" ? entry.petJsonUrl.trim() : "";
  // A pet is only installable if it exposes at least a zip (preferred) or a
  // spritesheet we can pair with a synthesized pet.json.
  if (!zipUrl && !spritesheetUrl) return null;

  return {
    slug,
    displayName: typeof entry.displayName === "string" && entry.displayName.trim()
      ? entry.displayName.trim()
      : slug,
    kind: typeof entry.kind === "string" ? entry.kind.trim() : "",
    submittedBy: typeof entry.submittedBy === "string" ? entry.submittedBy.trim() : "",
    spritesheetUrl,
    petJsonUrl,
    zipUrl,
  };
}

function findPetdexPet(manifest, slug) {
  const pets = manifestPets(manifest);
  const needle = String(slug || "").trim().toLowerCase();
  if (!needle) return null;
  return pets.find((pet) => pet.slug.toLowerCase() === needle) || null;
}

function searchPetdexPets(manifest, query, options = {}) {
  const pets = manifestPets(manifest);
  const needle = String(query || "").trim().toLowerCase();
  const limit = Number.isFinite(options.limit) && options.limit > 0 ? Math.floor(options.limit) : 50;
  const matched = !needle
    ? pets
    : pets.filter((pet) => {
        return (
          pet.slug.toLowerCase().includes(needle) ||
          pet.displayName.toLowerCase().includes(needle) ||
          pet.kind.toLowerCase().includes(needle)
        );
      });
  return matched.slice(0, limit);
}

function manifestPets(manifest) {
  if (Array.isArray(manifest)) return manifest;
  if (manifest && Array.isArray(manifest.pets)) return manifest.pets;
  return [];
}

// Resolve the best download URL for a pet: prefer the self-contained zip, fall
// back to the pet.json URL (the importer pairs it with the spritesheet).
function resolvePetDownloadUrl(pet) {
  if (!pet || typeof pet !== "object") throw new Error("pet is required");
  if (pet.zipUrl) return pet.zipUrl;
  if (pet.petJsonUrl) return pet.petJsonUrl;
  throw new Error(`petdex pet "${pet.slug || "?"}" has no installable download URL`);
}

async function fetchPetdexManifest(options = {}) {
  const manifestUrl = options.manifestUrl || DEFAULT_MANIFEST_URL;
  const fetchBuffer = options.fetchBuffer
    || ((href) => importer.downloadHttpsBuffer(href, {
      lookup: options.lookup,
      request: options.request,
      maxBytes: MAX_MANIFEST_BYTES,
    }));
  const buffer = await fetchBuffer(manifestUrl, { maxBytes: MAX_MANIFEST_BYTES, kind: "manifest" });
  return parsePetdexManifest(buffer);
}

// Install a Petdex pet into the Codex pets directory. Returns the importer
// result ({ packageDir, ... }). The caller is responsible for running
// syncCodexPetThemes afterwards (or relying on Clawd's startup sync) to
// materialize the Clawd theme.
async function installPetdexPet(options = {}) {
  const pet = options.pet || (options.manifest && options.slug
    ? findPetdexPet(options.manifest, options.slug)
    : null);
  if (!pet) {
    throw new Error(
      options.slug
        ? `petdex pet not found: ${options.slug}`
        : "installPetdexPet requires a pet or (manifest + slug)"
    );
  }

  const downloadUrl = resolvePetDownloadUrl(pet);
  const result = await importer.importCodexPetFromUrl(downloadUrl, {
    codexPetsDir: options.codexPetsDir,
    confirmReplaceExistingPackage: options.confirmReplaceExistingPackage,
    lookup: options.lookup,
    request: options.request,
    fetchBuffer: options.fetchBuffer,
  });
  return { pet, ...result };
}

module.exports = {
  DEFAULT_MANIFEST_URL,
  MAX_MANIFEST_BYTES,
  parsePetdexManifest,
  normalizePetEntry,
  findPetdexPet,
  searchPetdexPets,
  resolvePetDownloadUrl,
  fetchPetdexManifest,
  installPetdexPet,
};
