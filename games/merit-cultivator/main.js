"use strict";

(async function boot() {
  const sdk = window.ClawdGameSdk.create();
  const meritEl = document.getElementById("merit");
  const agentEl = document.getElementById("agent");
  const ringEl = document.getElementById("ring");
  const stageEl = document.getElementById("stage");

  let merit = 0;
  let agentState = "idle";
  let lastPetEmit = 0;

  function render() {
    if (meritEl) meritEl.textContent = String(merit);
    if (agentEl) agentEl.textContent = "agent: " + agentState;
    if (ringEl) {
      ringEl.classList.toggle("working", agentState === "working" || agentState === "juggling");
      ringEl.classList.toggle("thinking", agentState === "thinking");
    }
  }

  async function persist() {
    try {
      await sdk.storage.set("merit", String(merit));
    } catch {
      // ignore quota / offline bridge
    }
  }

  async function bump() {
    merit += 1;
    render();
    if (ringEl) {
      ringEl.classList.add("bump");
      setTimeout(() => ringEl.classList.remove("bump"), 150);
    }
    await persist();

    if (agentState === "working" || agentState === "juggling") {
      const now = Date.now();
      if (now - lastPetEmit > 2000) {
        lastPetEmit = now;
        try {
          await sdk.emitPetEvent({
            type: "celebrate",
            detail: { name: "merit-burst", merit },
          });
        } catch {
          // petEvents may be unavailable outside host
        }
      }
    }
  }

  await sdk.ready();

  try {
    const saved = await sdk.storage.get("merit");
    const n = parseInt(saved || "0", 10);
    if (Number.isFinite(n) && n >= 0) merit = n;
  } catch {
    // ignore
  }

  try {
    const snap = await sdk.getAgentSnapshot();
    agentState = (snap && snap.state) || "idle";
  } catch {
    agentState = "idle";
  }

  sdk.onAgent((snap) => {
    agentState = (snap && snap.state) || "idle";
    render();
  });

  sdk.bindLifecyclePauseResume({
    pause: () => { /* canvas-less; nothing to stop */ },
    resume: () => { render(); },
  });

  if (stageEl) stageEl.addEventListener("click", () => { bump(); });
  render();
})().catch((err) => {
  console.error("[merit-cultivator]", err);
});
