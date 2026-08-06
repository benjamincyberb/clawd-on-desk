"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { sanitizeAgentSnapshot, buildCsp } = require("../src/game-host");

describe("game-host sanitizeAgentSnapshot", () => {
  it("trims and caps session fields", () => {
    const snap = sanitizeAgentSnapshot({
      state: "working-extra-long-state-name-that-should-truncate",
      sessions: [
        {
          id: "a".repeat(200),
          agentId: "claude-code",
          state: "working",
          label: "L".repeat(200),
          secret: "nope",
        },
        { id: "", agentId: "x" },
      ],
      merit: { stage: "novice", points: 3, internal: true },
    });
    assert.equal(snap.state.length, 32);
    assert.equal(snap.sessions.length, 1);
    assert.equal(snap.sessions[0].id.length, 128);
    assert.equal(snap.sessions[0].label.length, 128);
    assert.equal(snap.sessions[0].secret, undefined);
    assert.equal(snap.merit.stage, "novice");
    assert.equal(snap.merit.points, 3);
    assert.equal(snap.merit.internal, undefined);
  });

  it("defaults idle with empty input", () => {
    assert.deepEqual(sanitizeAgentSnapshot(null).state, "idle");
    assert.deepEqual(sanitizeAgentSnapshot({}).sessions, []);
  });
});

describe("game-host buildCsp", () => {
  it("locks connect-src by default", () => {
    const csp = buildCsp({ network: false, agentFeed: true });
    assert.match(csp, /connect-src 'self'/);
    assert.doesNotMatch(csp, /https:/);
  });

  it("allows https when network capability is on", () => {
    const csp = buildCsp({ network: true });
    assert.match(csp, /connect-src 'self' https: wss:/);
  });
});
