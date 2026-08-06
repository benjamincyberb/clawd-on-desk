"use strict";

(async function boot() {
  const sdk = window.ClawdGameSdk.create();
  await sdk.ready();

  const stateLabel = { value: "idle" };

  class MainScene extends Phaser.Scene {
    create() {
      this.add.text(24, 24, "Clawd Phaser Starter", {
        fontFamily: "ui-monospace, monospace",
        fontSize: "22px",
        color: "#e8eef7",
      });
      this.status = this.add.text(24, 64, "agent: idle", {
        fontFamily: "ui-monospace, monospace",
        fontSize: "16px",
        color: "#9db0c7",
      });
      this.add.text(24, 120, "Click to bump score (saved via clawdGame.storage)", {
        fontFamily: "ui-monospace, monospace",
        fontSize: "14px",
        color: "#6f849c",
      });
      this.scoreText = this.add.text(24, 160, "score: 0", {
        fontFamily: "ui-monospace, monospace",
        fontSize: "18px",
        color: "#c6f6d5",
      });
      this.score = 0;
      sdk.storage.get("score").then((v) => {
        const n = parseInt(v || "0", 10);
        if (Number.isFinite(n)) {
          this.score = n;
          this.scoreText.setText("score: " + this.score);
        }
      }).catch(() => {});
      this.input.on("pointerdown", () => {
        this.score += 1;
        this.scoreText.setText("score: " + this.score);
        sdk.storage.set("score", String(this.score)).catch(() => {});
      });
    }
    update() {
      if (this.status) this.status.setText("agent: " + stateLabel.value);
    }
  }

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: "game",
    width: 720,
    height: 480,
    backgroundColor: "#0f1419",
    scene: MainScene,
    scale: { mode: Phaser.Scale.RESIZE },
  });

  sdk.attachPhaserGame(game);
  sdk.onAgent((snap) => {
    stateLabel.value = (snap && snap.state) || "idle";
  });
  try {
    const snap = await sdk.getAgentSnapshot();
    stateLabel.value = (snap && snap.state) || "idle";
  } catch { /* ignore */ }
})();
