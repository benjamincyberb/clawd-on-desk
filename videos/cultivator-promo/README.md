# Cultivator Promo (HyperFrames)

~25.5s / 1920×1080 宣传片工程，脚本见 [`docs/project/cultivator-promo-brief.md`](../../docs/project/cultivator-promo-brief.md)。

## Commands

FFmpeg 若不在系统 PATH，可先：

```bash
export PATH="$PWD/../../.tools:$PATH"   # 仓库根下的静态 ffmpeg
```

```bash
cd videos/cultivator-promo
npm run check          # lint + runtime gate
npm run dev            # Studio preview
npx hyperframes@0.7.77 snapshot --at 1.2,3.5,7,10.2,13,17,21
npm run render -- --quality high --output output.mp4   # 确认预览后再渲
```

## Layout

- `BRIEF.md` / `frame.md` — 意图与视觉规格
- `index.html` — 成片 composition
- `assets/` — knock.wav、祥云、六境 PNG、敲木鱼逐帧
- `snapshots/` — 抽帧（可 gitignore）
