"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  normalizeRiveBindings,
  computeInputOps,
} = require("../src/rive-bindings");

function opFor(ops, input) {
  return ops.find((o) => o.input === input) || null;
}

test("normalizeRiveBindings: explicit object form", () => {
  const bindings = normalizeRiveBindings({
    bindings: {
      istracking: { from: "hover" },
      Strenght: { from: "state", map: { idle: 0, thinking: 50, working: 100 }, default: 0 },
      numLook: { from: "pointerX", range: [0, 100], default: 50 },
      isHandsUp: { from: "stateIn", states: ["working", "juggling"] },
      Blink: { on: { click: true } },
      trigSuccess: { on: { enterStates: ["attention"], click: false } },
    },
  });
  assert.equal(bindings.length, 6);
  const byName = Object.fromEntries(bindings.map((b) => [b.input, b]));
  assert.equal(byName.istracking.kind, "bool");
  assert.equal(byName.istracking.source, "hover");
  assert.equal(byName.Strenght.kind, "number");
  assert.equal(byName.Strenght.source, "state");
  assert.equal(byName.numLook.kind, "number");
  assert.deepEqual(byName.numLook.range, [0, 100]);
  assert.equal(byName.isHandsUp.kind, "bool");
  assert.deepEqual(byName.isHandsUp.states, ["working", "juggling"]);
  assert.equal(byName.Blink.kind, "trigger");
  assert.equal(byName.Blink.click, true);
  assert.deepEqual(byName.trigSuccess.enterStates, ["attention"]);
});

test("normalizeRiveBindings: array form and dropping invalid entries", () => {
  const bindings = normalizeRiveBindings({
    bindings: [
      { input: "hoverBool", from: "hover" },
      { input: "", from: "hover" },
      { input: "unknownSrc", from: "nope" },
      { input: "noTrigger", on: {} },
      { input: "c", from: "constant", value: true },
    ],
  });
  const names = bindings.map((b) => b.input);
  assert.deepEqual(names, ["hoverBool", "c"]);
});

test("normalizeRiveBindings: legacy inputs/stateLevels adapter", () => {
  const bindings = normalizeRiveBindings({
    inputs: { level: "Level", hover: "Hovering", bump: "bump" },
    stateLevels: { idle: 0, thinking: 1, working: 2 },
  });
  const byName = Object.fromEntries(bindings.map((b) => [b.input, b]));
  assert.equal(byName.Hovering.source, "hover");
  assert.equal(byName.Level.source, "state");
  assert.deepEqual(byName.Level.map, { idle: 0, thinking: 1, working: 2 });
  assert.equal(byName.bump.kind, "trigger");
  assert.equal(byName.bump.click, true);
});

test("normalizeRiveBindings: explicit bindings win over legacy", () => {
  const bindings = normalizeRiveBindings({
    inputs: { hover: "Hovering" },
    bindings: { istracking: { from: "hover" } },
  });
  assert.equal(bindings.length, 1);
  assert.equal(bindings[0].input, "istracking");
});

test("computeInputOps: hover bool follows ctx.hover", () => {
  const bindings = normalizeRiveBindings({ bindings: { t: { from: "hover" } } });
  assert.equal(opFor(computeInputOps(bindings, { hover: true }), "t").set, true);
  assert.equal(opFor(computeInputOps(bindings, { hover: false }), "t").set, false);
});

test("computeInputOps: state number map with default fallback", () => {
  const bindings = normalizeRiveBindings({
    bindings: { S: { from: "state", map: { idle: 0, working: 100 }, default: 7 } },
  });
  assert.equal(opFor(computeInputOps(bindings, { state: "working" }), "S").set, 100);
  assert.equal(opFor(computeInputOps(bindings, { state: "idle" }), "S").set, 0);
  assert.equal(opFor(computeInputOps(bindings, { state: "sleeping" }), "S").set, 7);
});

test("computeInputOps: stateIn bool membership", () => {
  const bindings = normalizeRiveBindings({
    bindings: { hands: { from: "stateIn", states: ["working", "juggling"] } },
  });
  assert.equal(opFor(computeInputOps(bindings, { state: "working" }), "hands").set, true);
  assert.equal(opFor(computeInputOps(bindings, { state: "idle" }), "hands").set, false);
});

test("computeInputOps: pointerX scales through range, null → default", () => {
  const bindings = normalizeRiveBindings({
    bindings: { look: { from: "pointerX", range: [0, 100], default: 50 } },
  });
  assert.equal(opFor(computeInputOps(bindings, { pointerX01: 0 }), "look").set, 0);
  assert.equal(opFor(computeInputOps(bindings, { pointerX01: 1 }), "look").set, 100);
  assert.equal(opFor(computeInputOps(bindings, { pointerX01: 0.25 }), "look").set, 25);
  assert.equal(opFor(computeInputOps(bindings, { pointerX01: null }), "look").set, 50);
});

test("computeInputOps: pointerX clamps out-of-range 0..1", () => {
  const bindings = normalizeRiveBindings({
    bindings: { look: { from: "pointerX", range: [0, 100] } },
  });
  assert.equal(opFor(computeInputOps(bindings, { pointerX01: 2 }), "look").set, 100);
  assert.equal(opFor(computeInputOps(bindings, { pointerX01: -1 }), "look").set, 0);
});

test("computeInputOps: triggers only fire on matching cause", () => {
  const bindings = normalizeRiveBindings({
    bindings: {
      click: { on: { click: true } },
      onEnter: { on: { enterStates: ["attention"] } },
    },
  });
  // click cause fires the click trigger, not the state trigger
  let ops = computeInputOps(bindings, { cause: "click", state: "attention" });
  assert.ok(opFor(ops, "click"));
  assert.ok(opFor(ops, "click").fire);
  assert.equal(opFor(ops, "onEnter"), null);

  // state cause into attention fires onEnter, not click
  ops = computeInputOps(bindings, { cause: "state", state: "attention" });
  assert.ok(opFor(ops, "onEnter"));
  assert.equal(opFor(ops, "click"), null);

  // state cause into a non-listed state fires nothing
  ops = computeInputOps(bindings, { cause: "state", state: "idle" });
  assert.equal(ops.length, 0);

  // pointer cause fires no triggers
  ops = computeInputOps(bindings, { cause: "pointer", state: "attention" });
  assert.equal(ops.length, 0);
});

test("computeInputOps: bool/number ops emit regardless of cause", () => {
  const bindings = normalizeRiveBindings({
    bindings: {
      t: { from: "hover" },
      S: { from: "state", map: { idle: 3 } },
    },
  });
  const ops = computeInputOps(bindings, { cause: "pointer", state: "idle", hover: true });
  assert.equal(opFor(ops, "t").set, true);
  assert.equal(opFor(ops, "S").set, 3);
});
