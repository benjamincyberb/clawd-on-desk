# Rive demo / sample assets

## Default spike demo

`demo.riv` is the classic **login Teddy** character (JcToon, CC BY) — specifically
the **transparent** `auth-teddy` variant (the login-screen export paints an opaque
artboard fill and is unsuitable as a desk pet). State machine `Login Machine` with:

| Input | Type | Desk-pet mapping |
|-------|------|------------------|
| `numLook` | number 0–100 | cursor X → look left/right |
| `isHandsUp` / `isPrivateField` | boolean | hover / working / sleeping |
| `isChecking` / `isFocus` | boolean | thinking / notification |
| `trigSuccess` / `successTrigger` | trigger | attention / click |
| `trigFail` / `failTrigger` | trigger | error |

Used by:

- Dev spike: `CLAWD_RIVE_SPIKE=1` / `CLAWD_RENDER_BACKEND=rive`
- Open theme scaffold: copied to `themes/template-rive/assets/pet.riv`

## Other local samples

| File | Notes |
|------|--------|
| `auth-teddy.riv` | Transparent teddy source (same bytes as `demo.riv`) |
| `skills.riv` | Previous demo — Level / Hovering skills UI |
| `off_road_car.riv` / `rocket.riv` | Official public samples (animation / button) |

Refresh the runtime with `npm run vendor:rive` (runtime only; demo assets are local).

User themes ship their own `.riv` under `assets/`. See
`docs/guides/guide-theme-creation.md` → **Rive Themes**.
