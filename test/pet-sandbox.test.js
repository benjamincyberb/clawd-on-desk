"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert");
const path = require("node:path");

const petSandbox = require("../src/pet-sandbox");

describe("pet-sandbox protocol + CSP + relay", () => {
  it("buildCsp locks down defaults and gates connect-src on network", () => {
    const locked = petSandbox.buildCsp({ network: false });
    assert.ok(locked.includes("default-src 'none'"));
    assert.ok(locked.includes("script-src 'self' 'unsafe-eval' 'wasm-unsafe-eval'"));
    assert.ok(locked.includes("connect-src 'self'"));
    assert.ok(!locked.includes("https:"));

    const open = petSandbox.buildCsp({ network: true });
    assert.ok(open.includes("connect-src 'self' https: wss:"));
  });

  it("resolveProtocolPath allows package files and rejects traversal / bad ext", () => {
    const root = path.join(__dirname, "fixtures-does-not-need-to-exist");
    const ok = petSandbox.resolveProtocolPath(root, "clawd-pet://demo/index.html");
    assert.strictEqual(ok.ok, true);
    assert.ok(ok.filePath.endsWith(`${path.sep}index.html`));

    const vendor = petSandbox.resolveProtocolPath(root, "clawd-pet://demo/vendor/phaser.min.js");
    assert.strictEqual(vendor.ok, true);

    const trav = petSandbox.resolveProtocolPath(root, "clawd-pet://demo/..%2fetc%2fpasswd");
    // URL parser may decode; either way must fail closed
    assert.strictEqual(trav.ok, false);
    assert.ok(trav.status === 403 || trav.status === 400);

    const dots = petSandbox.resolveProtocolPath(root, "clawd-pet://demo/../secret.js");
    assert.strictEqual(dots.ok, false);

    const badExt = petSandbox.resolveProtocolPath(root, "clawd-pet://demo/hack.sh");
    assert.strictEqual(badExt.ok, false);
    assert.strictEqual(badExt.status, 403);
  });

  it("relay allowlist maps channels and drops non-allowlisted", () => {
    const sent = [];
    petSandbox.setDeps({
      getRenderWindow: () => ({
        isDestroyed: () => false,
        webContents: {
          send: (ch, envelope) => sent.push({ ch, envelope }),
        },
      }),
    });
    petSandbox.setActiveTheme({
      _id: "demo",
      _themeDir: "/tmp/demo",
      renderBackend: "sandbox",
      sandbox: { entry: "index.html", engine: "phaser", network: false },
    });

    assert.strictEqual(petSandbox.relayToSandbox("state-change", ["working", "x.svg"]), true);
    assert.strictEqual(petSandbox.relayToSandbox("pixi-cursor", [{ x: 10, y: 20 }]), true);
    assert.strictEqual(petSandbox.relayToSandbox("play-sound", [{ url: "nope" }]), true); // dropped
    assert.strictEqual(petSandbox.relayToSandbox("play-click-reaction", ["f.svg", 400]), true);

    const events = sent.map((s) => s.envelope.event);
    assert.deepStrictEqual(events, ["state", "cursor", "click"]);
    assert.strictEqual(sent[0].envelope.payload.state, "working");
    assert.strictEqual(sent[1].envelope.payload.x, 10);
    assert.strictEqual(sent[2].envelope.payload.duration, 400);

    petSandbox.clearActive();
  });

  it("sanitizeRelayPayload strips oversized / unknown fields", () => {
    const state = petSandbox.sanitizeRelayPayload("state-change", ["idle", "a".repeat(1000)]);
    assert.strictEqual(state.state, "idle");
    assert.ok(state.visual.length <= 256);

    const cursor = petSandbox.sanitizeRelayPayload("pixi-cursor", [{ x: 1.5, y: 2.5, evil: true }]);
    assert.deepStrictEqual(cursor, { x: 1.5, y: 2.5, inside: true });
  });

  it("getSandboxWebPreferences enables sandbox isolation without node", () => {
    const prefs = petSandbox.getSandboxWebPreferences("/tmp/preload.js", { themeId: "x" });
    assert.strictEqual(prefs.sandbox, true);
    assert.strictEqual(prefs.contextIsolation, true);
    assert.strictEqual(prefs.nodeIntegration, false);
    assert.ok(prefs.additionalArguments.some((a) => a.includes("--clawd-pet-sandbox=1")));
  });

  it("buildSandboxEntryUrl builds clawd-pet URL", () => {
    const url = petSandbox.buildSandboxEntryUrl({
      _id: "orbit",
      renderBackend: "sandbox",
      sandbox: { entry: "index.html" },
    });
    assert.strictEqual(url, "clawd-pet://orbit/index.html");
    assert.strictEqual(petSandbox.buildSandboxEntryUrl({ renderBackend: "svg" }), null);
  });
});
