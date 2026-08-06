# @clawd/game-sdk

Thin helpers around `window.clawdGame` (Clawd Game API v1). Engine-neutral;
official starter templates use **Phaser**.

See:

- [`docs/guides/game-api-v1.md`](../../docs/guides/game-api-v1.md)
- [`docs/guides/guide-game-creation.md`](../../docs/guides/guide-game-creation.md)
- [`templates/phaser-starter/`](./templates/phaser-starter/)

## Usage in a game package

```html
<script src="vendor/clawd-game-sdk.js"></script>
<script>
  const sdk = window.ClawdGameSdk.create();
  await sdk.ready();
  sdk.onAgent((snap) => { /* … */ });
  sdk.bindLifecyclePauseResume({
    pause: () => game.scene.pause(),
    resume: () => game.scene.resume(),
  });
</script>
```

Copy `src/browser.js` (or the built UMD bundle) into your game's `vendor/`
folder — games cannot `require()` Node modules inside the sandbox.
