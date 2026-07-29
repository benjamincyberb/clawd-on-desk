# Cultivator 素材流水线：生图约束与排障

功德修行主题（`themes/cultivator`）的 idle / thinking / working 素材走 AI 生图 → 切分 → 透明化 → SVG 嵌入。  
**原则：出问题优先按约束重新生成合规图，不要用 lock / composite / 局部修图当主路径。**

> 本页是**操作手册**（how-to + checklist）。确定值 / 尺寸 / 对外规范的「标准」见
> [`cultivator-asset-standard.md`](./cultivator-asset-standard.md)；「为什么这么做 / 踩过哪些坑」的经验复盘见
> [`cultivator-asset-lessons.md`](./cultivator-asset-lessons.md)。

相关脚本真相源：

| 角色 | 路径 |
|------|------|
| Prompt 常量（唯一） | [`scripts/generate-cultivator-ai-assets.js`](../../scripts/generate-cultivator-ai-assets.js) |
| 切分 working sheet（**现行**） | [`scripts/split-cultivator-spritesheet.js`](../../scripts/split-cultivator-spritesheet.js) |
| 去底 | [`scripts/make-cultivator-pngs-transparent.js`](../../scripts/make-cultivator-pngs-transparent.js) |
| 嵌入 SVG | [`scripts/embed-cultivator-ai-svgs.js`](../../scripts/embed-cultivator-ai-svgs.js) |
| 浏览器预览（Cursor 看不了 SVG） | [`scripts/build-cultivator-stage-preview.js`](../../scripts/build-cultivator-stage-preview.js) |

废弃补救 / 废弃路径（**不要当主流程**；脚本与分层 API 已标 DEPRECATED）：

- `scripts/lock-cultivator-working-to-idle.js` — 会切裂头部 / 产生鬼影
- `scripts/composite-cultivator-knock-on-idle.js` — 道具合成无法保证与 idle 像素一致
- `embed` 内 `wrapKnockLayeredSvg` / `readLayeredKnockAssets` / `KNOCK_LAYOUT` /
  `{stage}-base.png` / `{stage}-arm.png` / `-knock-layout.json` — base+arm 分层，embed **不再走**

---

## Working：逐帧全身（唯一支持路径）

敲木鱼**只用 6 张完整全身帧**做逐帧动画。每帧都是一整只角色（身+脸+袍+道具），
**禁止** base+arm 分层（胳膊一块、身体一块）：

```text
generated/{stage}-working-{1..6}.png  # 6 张完整全身帧，与 idle 同一角色、同一大小
→ embed-cultivator-ai-svgs.js wrapWorkingFramesInSvg
→ themes/cultivator/assets/{stage}-working.svg
```

### 大小一致（最重要，硬性）

- 角色**身体大小（头顶→坐底）在 6 帧和 idle 完全一致**；不能静态正常、敲击时变小。
- 举起木槌**只往上顶到透明 padding**，不得为了容纳木槌而缩放整只角色。
- `split-cultivator-spritesheet.js` 的归一**以身体高度（`bodyMetrics`）为锚**，
  不再用「含举起木槌的整框高度/宽度」；否则举槌帧整框更高更宽，会把人缩小。
- **6 帧共用一个缩放系数**（各帧身体高度取**中位数** → 对齐 idle），**不逐帧各自缩放**。
  原图 6 格本就同一比例，逐帧缩放只会因举槌帧的头顶/手臂误检测把本来一致的原图缩成一大一小。
- 底边（坐底 `bottomY`）与坐姿重心 `baseCenterX` 对齐 idle，做到零漂移。
- ⚠️ **idle 锚必须先 chroma-key**：`loadIdleAnchor` 从 `candidates/{stage}-idle.png`（其次 generated）
  读锚，用 `contentBBox` 求 `bottomY`。若该 idle 背景没去干净，`contentBBox` = 整张画布，
  `bottomY≈1023` → working 会被整体放大并贴到画布底。新 idle 落地后**candidates 与 generated 两份都要跑
  `make-cultivator-pngs-transparent.js`**。
- 验收别用 split 内部同一套 `bodyMetrics` 自证自洽（会永远显示 ratio≈1.0 骗人）；用独立度量：
  切分后各帧内容框 `bottomY` 应全等（基线锁死），`contentH` 差异只来自木槌高低，不来自身体缩放。

### 分层方案已废弃（DEPRECATED）

`wrapKnockLayeredSvg` / `{stage}-base.png` / `{stage}-arm.png` / `-knock-layout.json` /
`KNOCK_LAYOUT` / `readLayeredKnockAssets` **仅作历史保留，embed 主路径不再调用**。
现行唯一敲击路径是 6 帧全身（`wrapWorkingFramesInSvg`）。如需回归分层，先在
[`cultivator-asset-standard.md`](./cultivator-asset-standard.md) 改回约定并升 Spec 版本。

预览：`node scripts/build-cultivator-stage-preview.js --stage=<id>` →
`candidates/preview-{stage}.html`（叠图对比 idle vs working 是否同位同大小）。

生图建议（对抗随机）：双 ref（idle + chibi-monk）+ edit idle；木鱼块+红垫锁左下恰好一个；多候选择优。

---

## 各阶段交互与祥云 FX 分层

**交互统一**：多数阶段是同一套 6 帧敲木鱼（高举→下摆→击中→回弹），
差异只在 **佛光/敲中反馈 FX** 的强弱。**角色 PNG 默认干净**：不画光环/佛光/祥云/飘浮莲瓣/
烛/钟/任何背光道具（`FORBIDDEN_FX_LOWER`），这些 FX 由 embed 的 CSS 层生成。
**佛祖例外**：
- **不敲木鱼**：working = idle 打坐图 + **万佛朝圣式**代码 FX（`wrapNoKnockWorkingSvg`），无 6 帧 sheet。
  - 祥云环缓慢自转 + 呼吸缩放（`cloud-orbit`）
  - 软径向光晕外扩（`halo-bloom`，叠在烤进图的华丽光环背后）
  - 莲瓣持续上飘（`petal-drift`）
- **华丽袈裟 + 莲花台 + 华丽光环（mandorla）烤进角色图**（参考 `reference/buddha-ornate-reference.png`）；
  代码不再叠常驻 `haloMarkup`（`bakedHalo:true`），避免双重硬光环。
- `fx/cloud-scrolls.png` **必须 chroma-key**（AI 常把棋盘格烤进像素；未去背会在 working 里整块白底/棋盘露馅）。

FX 语言（**不画进 PNG**，由 embed 层叠在角色身后）。选型原则：**用最合适的工具画每种 FX**——
光晕用程序化径向渐变（清晰、可无限缩放、零素材成本），云卷用 AI 生成的美术层（比手写线条丰富得多）：

- **佛光背光（持久光环，程序化）**：柔和金色**径向光晕**（`radialGradient`，中心亮→边缘透明），
  由 `haloMarkup` 生成、`halo-breathe` 缓慢呼吸。**idle 与 working 用完全相同的光环 CSS**，
  所以状态切换时光环不闪、不跳。只有 `halo:true` 的阶段（novice+）才有光环；mortal/adept idle 干净无光环。
  **不透明度/半径已上调**（旧值太淡在桌宠上几乎不可见）：`haloStyleRules` rest≈0.34+peak·0.5、
  bright≈0.6+peak·0.55，`haloMarkup` 半径 9.8、渐变中心近实心 → 桌面上确实读得出佛光。
- **佛光边缘卷纹**（`haloRim`）：光环边缘点缀极简静态卷纹线条，同样随光环持久存在。
- **祥云卷纹（敲中爆发，AI 美术层）**：`novice+` 用**一张可复用的 AI 金色如意云卷环形素材**
  （`assets/source/cultivator/fx/cloud-scrolls.png`，透明底 + 透明中心）叠在角色**身后**，
  敲中时由 `knock-cloud`（scale + fade）从中心向外**绽放**再淡出。`cloudLayerMarkup` 生成、
  `cloudScale`/`cloudPeak` 按阶段放大。**这是刻意不烤进 6 帧**：烤进帧会破坏 body 锚点/统一缩放
  （见「大小一致」节），也无法做绽放动画。素材从 1024²**降采样到 384²**再嵌入，避免 SVG 体积爆炸。
  低阶（mortal/adept）无 AI 云环，回退到 `SCROLL_CURL_PATH` 细线条卷纹。
- **莲瓣（敲中爆发）**：顶阶 working 敲中时小莲瓣沿环向外。

要点：**光环 = 常驻气场（idle+working 一致，程序化）；祥云卷纹/莲瓣 = 仅 working 的敲击反馈爆发
（云环用 AI 美术层绽放）**。

`KNOCK_FX_TIER`（`scripts/embed-cultivator-ai-svgs.js`）驱动，**随功德单调递增**：

| 阶段 | 功德 | 云卷 | 佛光 | 边缘卷纹 | 莲瓣 | 云峰值 | 观感 |
|------|-----:|:----:|:----:|:-------:|-----:|-----:|------|
| mortal 凡人 | 0 | 线条 | ✗ | ✗ | 0 | 0.30 | 淡金细线卷纹，最克制 |
| adept 修行者 | 5 | 线条 | ✗ | ✗ | 0 | 0.36 | 暖金细线卷纹稍显 |
| novice 小和尚 | 50 | AI环 | ✓ | ✗ | 0 | 0.80 | **首现柔和佛光** + 云环绽放 |
| arhat 罗汉 | 150 | AI环 | ✓ | ✓ | 3 | 0.85 | 金佛光 + 边缘卷纹 + **首现莲瓣** |
| bodhisattva 菩萨 | 300 | AI环 | ✓ | ✓ | 5 | 0.90 | 盛金佛光 + 云环 + 莲瓣 |
| buddha 佛祖 | 500 | AI环(环转) | 烤进图+外扩 | ✗ | 7 | 0.95 | **不敲木鱼**；working=万佛朝圣（祥云环转+光晕外扩+莲瓣） |

规则：**不用火花四溅、不用木鱼位移、不闪全屏、云环不堆成真实雾云**；佛光从中心向外扩散，
高阶更大更暖 + 边缘卷纹 + 莲瓣。改 FX 只改 `KNOCK_FX_TIER`（+ 需要时换 `fx/cloud-scrolls.png`），保持单调递增。

> 冻帧自查：`themes/cultivator/assets/` 起本地 http server，打开任意 working SVG，用
> `document.getAnimations().forEach(a=>{a.currentTime=756;a.pause()})` 冻结到敲中绽放峰值截图，
> 即可离屏核对佛光 + 云环是否读得出（756ms ≈ 1.4s 周期里 `knock-cloud` 的峰值附近）。

---

## 并发生成清单（各阶段独立，可并行）

每个阶段的 working sheet **只依赖自己的 idle**，阶段之间无耦合，可并发跑多次 GenerateImage。
每次调用固定用：`aspect_ratio: 16:9` + 该阶段 working-sheet prompt（`--prompts`）+ 双参考图
（`generated/{stage}-idle.png` + `reference/chibi-monk-reference.png`）。

| 阶段 | idle 参考 | 角色约束要点（详见 STAGE_PROMPTS） | 配饰 |
|------|-----------|-----------------------------------|------|
> 角色默认干净：**禁光环/佛光/祥云/飘浮莲瓣/烛/钟/背光**（低阶 `FORBIDDEN_FX_LOWER`）。
> **佛祖例外**：华丽袈裟 + 莲花台 + **华丽光环**烤进图；working 不敲木鱼，只叠代码祥云脉冲。

| 阶段 | idle 参考 | 角色约束要点（详见 STAGE_PROMPTS） | 本体配饰 |
|------|-----------|-----------------------------------|------|
| mortal | `mortal-idle.png` | 黑发平民、粗布褐衣、席地坐；禁袈裟/冠/念珠 | — |
| adept | `adept-idle.png` | 黄褐简袍、仅小念珠、席地坐；禁袈裟/冠 | beads |
| novice | `novice-idle.png` | 光头小和尚、黄袍、念珠、席地坐；禁袈裟/冠 | beads |
| arhat | `arhat-idle.png` | 光头、拼布袈裟、念珠、席地坐；禁冠 | kasaya/beads |
| bodhisattva | `bodhisattva-idle.png` | 冠 + 红格袈裟 + 黄袍 + 念珠、席地坐 | crown/kasaya/beads |
| buddha | `buddha-idle.png` | 螺发肉髻、华丽袈裟、莲台、**华丽光环 mandorla**；无木鱼 | robe+lotus+halo |

并发流程：

1. 对每个阶段各发一次 GenerateImage（可同一批并行），落到 `candidates/{stage}-working-sheet.png`。
2. 逐阶段跑 `node scripts/split-cultivator-spritesheet.js --stage=<id>`（身体锚归一）。
3. 跑「大小一致量化验收」脚本，`ratio≈1.0 && bottomΔ≈0` 才算过；未过就**重生该阶段**。
4. 全过后拷到 `generated/`，`node scripts/embed-cultivator-ai-svgs.js --actions=working` 一次性嵌入。
5. 逐阶段开 preview 复核：同位、同大小、木鱼不动、同侧、脸干净。

**通用硬约束（所有阶段共享，吸收既往问题）**：大小一致（身体=idle，不缩）、逐帧全身（禁分层胳膊）、
木鱼钉死不动、道具同侧不翻转、帧内无 FX、脸干净无重影。任一不过 → **重生成，不修图**。

---

## 流水线总览

```text
1. Cursor GenerateImage
   - idle / thinking 单图
   - working：一张 16:9 水平 6 格 spritesheet（每格完整全身，与 idle 同大小）
   - 参考图: 当前阶段 idle + assets/source/cultivator/reference/chibi-monk-reference.png
   - 输出落到 assets/source/cultivator/generated/{stage}-*.png
     （candidates/ 仅调试暂存，验收通过后再拷到 generated/）

2. node scripts/generate-cultivator-ai-assets.js 全量：split（身体锚归一）→ transparent → embed
   （或仅 node scripts/embed-cultivator-ai-svgs.js --actions=working）

3. 预览验收
   node scripts/build-cultivator-stage-preview.js --stage=<id>
   用本地 http.server 打开（见下方），重点看 idle↔working 同位、同大小
```

打印当前 prompt（改约束后先跑这个核对）：

```bash
node scripts/generate-cultivator-ai-assets.js --prompts
```

---

## 生图硬约束 checklist

每次生成 **working sheet** 前对照；缺任一条就重生成，不要事后修。

### 画布与排版

- [ ] 一张水平 spritesheet，`aspect_ratio: 16:9`
- [ ] 恰好 **6 个等宽全角色面板**，从左到右
- [ ] 面板之间有 **清晰透明间隔**，面板互不接触、不重叠
- [ ] 全透明背景；无文字、无 UI、无面板边框、无实心底色

### Idle 锁定（最重要）

- [ ] 任务表述是：**把 idle 复制 6 次，只动敲击手臂 + 木槌**；不是画 6 张不同角色
- [ ] 必带 reference：当前阶段 `{stage}-idle.png` + `chibi-monk-reference.png`
- [ ] 6 帧同一角色、同一 scale、同一位置、同一角度（正面直立，头身不歪）
- [ ] 头 / 脸 / 躯干 / 盘腿 / 坐底在每帧占用 **相同像素区域**；只允许右前臂 + 木槌变化（角色本体无光环/祥云可锁）
- [ ] 脸部干净：无灰色脏影、噪点、模糊、重影 / double-exposure

### 大小一致（最重要，硬性）

- [ ] 角色**身体（头顶→坐底）在 6 帧与 idle 完全同大小**；静态与敲击不得变大变小
- [ ] 举槌**只向上顶进透明 padding**，不得为容纳木槌而缩放整只角色
- [ ] 6 帧坐底在**同一基线**、坐姿重心水平对齐；木鱼大小/位置每帧一致
- [ ] split 后跑验收脚本，`bodyH/idleBodyH ≈ 1.0`（见「验收」节）

### 逐帧全身（硬性）

- [ ] 每格都是**一整只完整角色**（身+脸+袍+道具）画在一起
- [ ] **禁止**胳膊一块、身体一块；**禁止** base+arm 分层拼合

### 道具与边距

- [ ] 木鱼 + 木槌固定在 **观者左侧**（角色右手敲），6 帧不左右翻转
- [ ] **木鱼 + 红垫钉死在同一 (x,y)**：6 帧同大小同位，**不左右滑、不上下漂、不旋转不缩放**；只有木槌靠近轻敲
- [ ] 帧内**不画**火花 / 光爆 / 动态祥云 / 运动线（反馈 FX 由 CSS 生成，帧必须干净）
- [ ] 坐姿身体约占面板高度 **68–75%**
- [ ] 头/光环上方留足 padding（容纳举起的木槌）、脚/云下方、左右两侧留透明 padding

### 6 帧动作顺序

1. 木槌高举  
2. 略降  
3. 下摆接近木鱼  
4. 击中（可有极小火花）  
5. 轻微回弹  
6. 停在木鱼上方  

### Idle / thinking 单图

- [ ] 风格与阶段外观遵循 `STAGE_PROMPTS[stageId]`（`--prompts` 可见）
- [ ] 透明底、角色居中、安全边距同 working

---

## 验收：preview HTML

Cursor 内置查看器 **不支持 SVG**。拆分后必须用浏览器预览：

```bash
node scripts/build-cultivator-stage-preview.js --stage=arhat
cd assets/source/cultivator/candidates
python3 -m http.server 8765
# 打开 http://127.0.0.1:8765/preview-arhat.html
```

预览页应检查：

1. **Idle vs working-1 半透明叠图**：头身是否重合（漂移一眼可见）
2. **动画区**：敲击只动手臂，身体不抖、不变大变小
3. **单帧条**：6 帧左右道具是否同侧、脸是否干净、是否裁切

`file://` 在部分自动化浏览器工具里不可用；本地调试优先 `http://127.0.0.1:...`。

### 大小一致量化验收（split 之后跑）

`bodyH/idleBodyH` 应全部 ≈ 1.0、`bottomΔ` ≈ 0；否则说明归一又退回「整框缩放」：

```bash
node -e '
const fs=require("fs");
const {decodePng}=require("./scripts/make-cultivator-pngs-transparent.js");
const S=process.argv[1]||"mortal";
function bh(p){const {width:W,height:H,rgba}=decodePng(fs.readFileSync(p));const rc=Array(H).fill(0);
 let a=W,b=-1,c=H,d=-1;for(let y=0;y<H;y++){let n=0;for(let x=0;x<W;x++){if(rgba[(y*W+x)*4+3]>16){n++;if(x<a)a=x;if(x>b)b=x;if(y<c)c=y;if(y>d)d=y;}}rc[y]=n;}
 const w=Math.max(12,Math.round((b-a+1)*0.14));let t=c;for(let y=c;y<=d;y++){if(rc[y]>=w){t=y;break;}}return {bodyH:d-t+1,bottomY:d};}
const g="assets/source/cultivator/generated/";const idle=bh(g+S+"-idle.png");
for(let i=1;i<=6;i++){const m=bh(g+S+"-working-"+i+".png");
 console.log("f"+i,"ratio",(m.bodyH/idle.bodyH).toFixed(3),"bottomΔ",m.bottomY-idle.bottomY);}
' mortal
```

---

## 排障速查

| 症状 | 根因 | 处置 |
|------|------|------|
| working 相对 idle 抖动 / 漂移 / 大小不一 | 独立生图未锁 idle | **重生成** working sheet；prompt 强调 copy-idle-6-times + idle reference。**禁止** lock/composite 修图（会切脸） |
| 木鱼/木槌左右翻转 | same-side 约束未生效 | 强化「viewer's left, never flip」后重生成 |
| 木鱼左右滑 / 上下漂 / 变大 | fish-anchor 约束未生效，或帧重心随手臂偏移 | 强化「FISH ANCHORED 同 (x,y)」后重生成；split 归一按 `baseCenterX`（坐底重心）对齐，勿改成整框中心 |
| 敲击时角色变小 | split 用「含举槌整框高」缩放 | 归一必须按 `bodyMetrics` 身体高度锚（见「大小一致」） |
| 敲击帧一大一小交替 | split 逐帧各自缩放，举槌帧误检测 | 6 帧共用一个缩放系数（身高中位数 → idle）；见「大小一致」 |
| working 整体变大 / 贴到画布最底 | idle 锚（candidates）没去背，`contentBBox`=整画布 → `bottomY≈1023` | 新 idle 落地后 candidates+generated **两份都 chroma-key**，再 split |
| idle 有光环 / working 没光环（或反之），状态切换闪跳 | 光环烤进了某个状态的 PNG | 角色 PNG 一律干净；光环由 `haloMarkup`+`halo-breathe` 常驻，idle/working 用同一 CSS |
| 帧里自带祥云/火花且逐帧漂移 | 生成把 FX 画进 PNG | prompt 写明「FX IN CODE」，帧只画角色；FX 由 embed 的 CSS 层生成 |
| 敲击时祥云/佛光「都没有」 | 旧程序化云卷是发丝细线 + 佛光不透明度过低，桌宠尺寸下几乎不可见 | 佛光半径/不透明度已上调（`haloStyleRules`/`haloMarkup`）；祥云改用 AI 云环美术层（`fx/cloud-scrolls.png`）由 `knock-cloud` 绽放。缺 `fx/cloud-scrolls.png` 会静默回退到细线卷纹 |
| working SVG 体积暴涨 | AI 云环素材未降采样就 base64 内嵌 | 云环素材嵌入前降采样到 ~384²（见「FX 分层」），单张 working SVG 增量应 ≲0.3MB |
| 验收显示 ratio≈1.0 但肉眼仍不一致 | 验收用了 split 内部同一套 `bodyMetrics`（自证自洽） | 用独立度量：切分后各帧 `bottomY` 全等、`contentH` 差异只来自木槌 |
| 脸部脏影 / 重影 | 生成噪声 | 重生成；写明 no gray smudge / double-exposure |
| 光环或木槌被裁 | 安全边距不足 | 提高 padding、降低角色占比后重生成 |
| 动画空帧 / 末帧闪烁 | CSS `step-end` 尾帧百分比问题 | 使用 `embed` / preview 里的 **linear + 硬 opacity 切**；不要改回 step-end |
| Cursor 看不了 SVG /「看起来像播放坏了」 | 工具限制或实际帧漂移 | 先开 preview HTML 区分「播放 CSS」vs「图本身」 |
| prefs 里改了 merit 一启动又变回佛祖 | 运行中的 Clawd 写回 prefs | 先完全退出 Clawd 再改 `clawd-prefs.json`；调试可用 Settings 里的 stage select / knock 按钮 |

---

## Agent 操作约定

1. **改约束只改** `scripts/generate-cultivator-ai-assets.js` 的 `REF_STYLE` / `STAGE_PROMPTS` / `KNOCK_FRAME_SEQUENCE`，并同步更新本页 checklist。
2. 生图前跑 `--prompts`，用输出的 working-sheet prompt + idle reference 调用 GenerateImage。
3. 生成结果先落 `candidates/`，preview 通过后再拷到 `generated/` 并跑 `generate-cultivator-ai-assets.js`（或等价 split → transparent → embed）。
4. 若预览仍漂移：**再生成**，不要堆修图脚本。
5. 调试阶段可用 Settings Theme 页的 stage select +「敲木鱼」按钮；正式路径不依赖 `debugStageId`。

---

## 目录约定

```text
assets/source/cultivator/
  reference/chibi-monk-reference.png   # 风格参考
  generated/                           # 流水线输入（验收通过）
  candidates/                          # 仅保留各阶段 `{stage}-idle.png` 锚点副本（调试 WIP / preview / raw 勿长期堆放）
  fx/cloud-scrolls.png                 # 可复用祥云环（须 chroma-key）
  reference/                           # 生图参考（chibi-monk、佛祖华丽参考等）
themes/cultivator/assets/              # 嵌入后的运行时 SVG
```
