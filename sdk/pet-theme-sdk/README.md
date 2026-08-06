# @clawd/pet-theme-sdk

Helpers for **clawd-pet.v1** sandboxed desk-pet themes.

Sandbox themes run arbitrary Phaser/HTML/JS inside a transparent pet window with:

- `sandbox: true` + `contextIsolation: true`
- **no** `electronAPI` / Node / fs
- a narrow `window.clawdPet` bridge

## Browser usage

```html
<script src="vendor/clawd-pet-sdk.js"></script>
<script>
  const sdk = window.ClawdPetSdk.create();
  await sdk.ready();
  sdk.onState((p) => console.log(p.state));
  sdk.onCursor((p) => console.log(p.x, p.y));
  sdk.onClick(() => { /* burst */ });
</script>
```

## Events (`sdk.on(name, handler)`)

| Event | Payload |
|-------|---------|
| `state` | `{ state, visual }` |
| `cursor` | `{ x, y, inside }` (CSS px in pet window) |
| `click` | `{ duration }` |
| `drag-start` | `{ direction }` (`left`/`right`/null) |
| `drag-end` | `{}` |
| `dnd` | `{ enabled }` |
| `mini` | `{ enabled, edge }` |
| `theme-config` | sanitized theme config |

## Outbound

- `ready()` — tell the host the theme booted
- `getInfo()` / `getAgentSnapshot()`
- `emitPetEvent({ type, detail })` — allowlisted types only (`easter-egg`, `notify`, `celebrate`)
- `storage.get/set/delete/keys/clear`

Phase 1 does **not** bridge sound, tint, or accessories — handle visuals in theme code.
