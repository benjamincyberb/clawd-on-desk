# Naruto theme art attribution

## Source

Desk-pet rasters under `reference/` and `generated/` were derived from the local
project **naruto-ssr** (`/Users/Admin/Projects/naruto-ssr`) for personal learning
and local Clawd experimentation.

| File | Origin |
|------|--------|
| `reference/storm-naruto-base.png` | `naruto-ssr/public/characters/naruto.png` |
| `reference/storm-sixpaths-mood.png` | `naruto-ssr/public/war/sixpaths.png` |
| `reference/storm-jinchuriki-mood.png` | `naruto-ssr/public/war/jinchuriki.png` |
| `reference/storm-valley-mood.png` | `naruto-ssr/public/war/valley.png` |
| `generated/*-512.png` | Downscaled / cropped derivatives of the above |

## Copyright

Character and promotional art depict *Naruto* IP. Rights belong to the original
authors and rights holders (including Masashi Kishimoto / Shueisha / Bandai Namco
as applicable). The naruto-ssr README states assets are for personal learning
display only.

**Do not redistribute** `themes/naruto/assets/*` embeds or `reference/` / `generated/`
rasters as a public Clawd theme pack without a clear license to do so. Prefer
original AI desk-pet reinterpretations (see `docs/guides/naruto-asset-standard.md`)
for any shared/release build.

## Pipeline

```bash
# After refreshing copies from naruto-ssr into reference/ + generated/*-512.png:
npm run embed:naruto-ssr
```
