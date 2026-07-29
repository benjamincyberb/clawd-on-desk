# 功德桌宠素材标准（Spec / 对外规范）

> **Spec 版本：`1.0.0`** ｜ 最后更新：2026-07 ｜ 语义化版本，破坏性改动升 major。
> 变更记录见文末「附录 A：变更记录」。
>
> **规范用词（RFC 2119 风格）**：**MUST / 必须**＝硬性，违反即判不合格；**SHOULD / 应**＝强烈建议，
> 偏离需在 PR 说明理由；**MAY / 可**＝可选。本页表格中标「硬性/MUST」的数值改动等于改 Spec 版本。

> **本页定位：最终总结性「标准」文档。**
> 把「可以确定下来」的东西一次性钉死：画布 / 尺寸 / 比例 / 命名 / 目录 / 验收阈值 / AI 与代码的边界。
> 目标是**新增形象与动作时不再靠试错**——照本页填空即可；同时作为**对外开放的素材规范**基线。
>
> 三份文档分工（不要混写）：
>
> | 文档 | 定位 | 什么时候看 |
> |------|------|-----------|
> | **本页** `cultivator-asset-standard.md` | **标准 / 规范**（确定值 + 对外基线） | 新增阶段/动作前，先来这里取硬性参数 |
> | [`cultivator-asset-pipeline.md`](./cultivator-asset-pipeline.md) | **操作手册**（how-to + checklist + 脚本） | 真正动手生成、切分、嵌入、排障 |
> | [`cultivator-asset-lessons.md`](./cultivator-asset-lessons.md) | **经验复盘**（为什么这么定） | 想理解某条约束的来龙去脉 |
>
> ### 文档状态一览（整理用）
>
> | 文档 | 状态 | 说明 |
> |------|------|------|
> | `cultivator-asset-standard.md` | **现行权威** | 素材硬标准 + 对外规范 Spec `1.0.0` |
> | `cultivator-asset-pipeline.md` | **现行** | 操作手册；内含「废弃脚本」提示，文档本身未废弃 |
> | `cultivator-asset-lessons.md` | **现行** | 经验复盘；不钉数值，改数值以 standard 为准 |
> | `guide-theme-creation.md` | **现行** | 通用主题作者指南；`meritCultivator` 仅 builtin |
> | `cultivator-promo-brief.md` | **现行（营销）** | 宣传片 brief/分镜，**不是**产品/素材规范 |
> | `merit-cultivator-prd.md` | **⚠️ DEPRECATED** | 早期产品需求 + 2 境界 MVP 快照；数值/素材以本页为准 |
>
> 约束真相源始终是代码常量（`scripts/generate-cultivator-ai-assets.js` 的
> `REF_STYLE` / `STAGE_PROMPTS` / `FORBIDDEN_FX*` / `KNOCK_FRAME_SEQUENCE`，
> `scripts/embed-cultivator-ai-svgs.js` 的 `KNOCK_FX_TIER`（以及已废弃的 `KNOCK_LAYOUT` 分层路径），
> `assets/source/cultivator/manifest.json`）。**改标准 = 改这些常量 + 同步本页。**

---

## 项目功能总览（本 Spec 服务于什么）

「功德修行桌宠」= 内置 `cultivator` 主题，把 AI coding agent 的工作状态可视化为「敲木鱼修行 → 积功德 → 升境界」。素材标准就是为「让任意新形象/新动作稳定接入这套运行时」服务。相关功能模块：

| 模块 | 职责 | 关键文件 |
|------|------|----------|
| 状态感知 | hook/日志把 agent 的 thinking/working/done/error 映射为桌宠状态 | `src/state.js` |
| 功德引擎 | 按秒/按 tick 计分、完成/错误奖励、日结/连续奖励、防抖 flush | `src/merit-engine.js` / `src/merit-engine-core.js` |
| 境界推导 | `resolveStage(merit, stages)` 由功德派生当前境界（`stageIndex` 不落盘） | `src/theme-progression.js` |
| 进度呈现 | builtin-only overlay（随宠物移动/隐藏，不新增窗口）+ 升级仪式 | `src/merit-bridge.js` |
| 主题系统 | 加载/校验/变体合并/SVG 消毒；`meritCultivator` 仅内置生效 | `src/theme-loader.js` / `src/theme-schema.js` |
| 素材流水线 | AI 生图 → 切分 6 帧 → 去背 → SVG+CSS 嵌入 | `scripts/*cultivator*.js` |

**本 Spec 只覆盖「素材」层**（画布/尺寸/风格/命名/FX 边界/验收）。功德事件契约的**历史意图**见
[`merit-cultivator-prd.md`](../project/merit-cultivator-prd.md)（⚠️ DEPRECATED）；主题 schema 全字段见
[`guide-theme-creation.md`](./guide-theme-creation.md)。

> ⚠️ **权威性顺序**：运行时真相以 `manifest.json` / `themes/cultivator/theme.json` / 代码常量为准。
> `merit-cultivator-prd.md` 是**已废弃的历史产品文档**，其「2 境界 / 阈值 1000」等 MVP 描述**已被当前 6 境界
> （`0 / 5 / 50 / 150 / 300 / 500`）取代**；读 PRD 时只取概念，数值以本页 §4（境界）与 §10（功德参数）为准。

---

## 0. 一句话总纲

**角色本体（决定「这是谁」）交给 AI 生图；运动与特效（决定「怎么动」）交给代码。**
边界一旦划错，就会同时丢掉「稳定」和「好看」。所有下列数值都为这条边界服务。

---

## 1. 核心设计法则（不随阶段变）

1. **重生 > 修图**：AI 生图当「抽卡」，把合格线量化 + 便宜重抽，绝不给废卡描边（`lock` / `composite` 已废弃）。
2. **约束可证伪**：每条生图约束必须对应一条验收动作（叠图重合？基线相等？道具同侧？），否则等于没写。
3. **AI / 代码边界固定**：身份结构烤进图，运动氛围留给代码；同一元素在各状态**要么都在、要么都不在**。
4. **锚点思维**：一致性来自锁定一个稳定锚（身体高度 / 坐底基线 / idle 参考图），不逐帧各自调。
5. **目标尺寸验收**：桌宠是小尺寸远观，一切在 64–128px 缩放下「看不看得见」为准，别在大图上判。
6. **单一真相源**：约束集中在常量表，改一处、同步本页。
7. **透明底默认不可信**：AI 的「透明」经常是把棋盘格/纯色烤进像素，去背 + 双背景核对是必查项。

---

## 2. 画布与尺寸（硬性确定值）

### 2.1 运行时坐标系（`manifest.json` → 生成的 `theme.json`，全阶段共用）

| 项 | 确定值 | 说明 |
|----|--------|------|
| `viewBox` | `{ x: -8, y: -6, width: 32, height: 32 }` | 逻辑画布，所有资产共用一套 |
| `layout.contentBox` | `{ x: 0, y: 0, width: 16, height: 20 }` | 可见身体区域（非整张导出画布） |
| `layout.centerX` | `8` | 水平锚 |
| `layout.baselineY` | `20` | 坐/站基线 |
| `layout.visibleHeightRatio` | `0.62` | 可见身体占窗口高度比 |
| `layout.baselineBottomRatio` | `0.06` | 基线到窗口底距离比 |
| `hitBoxes.default` | `{ x: 0, y: 2, w: 16, h: 16 }` | 常规命中框 |
| `hitBoxes.sleeping` | `{ x: 0, y: 6, w: 16, h: 12 }` | 睡眠命中框 |

### 2.2 AI 生图源图尺寸（送进流水线前）

| 资产 | 生图比例 (`aspect_ratio`) | 源画布 | 面板数 | 命名（落 `generated/`） |
|------|--------------------------|--------|--------|--------------------------|
| idle 单图 | `1:1` | 1024×1024（MUST 正方形） | 1 | `{stage}-idle.png` |
| thinking 单图 | `1:1` | 1024×1024（MUST 正方形） | 1 | `{stage}-thinking.png` |
| working 敲击表 | **请求 `16:9`** | 水平长条（宽不限，如 1536×1024） | **恰好 6** 等宽全身面板 | `{stage}-working-sheet.png` → 切分为 `{stage}-working-{1..6}.png` |

- **请求比例 vs 流水线接受尺寸要分清**：向 `GenerateImage` **请求** `16:9`；流水线**接受**任意宽度的水平长条，
  只要能按透明间隔切出 6 个面板。切分器（`split-cultivator-spritesheet.js`）走**透明间隙检测**
  （常量：`MIN_GAP=4`、`ALPHA_THRESHOLD=16`、`PAD=8`、`EXPECTED_FRAMES=6`），检测不到 6 段时回退等宽切分并告警。
- **idle/thinking MUST 为正方形 1024²**：切分器以 idle 的 `max(width,height)` 作为共享输出画布，非正方形会污染基线锚。
- **切分输出帧 = 1024×1024**（对齐 idle 锚画布）。敲击帧内部参考边长同为 1024。
  > ⚠️ `KNOCK_LAYOUT` / `pivotPx` / `fishAnchorPx` 属于已废弃的 **base+arm 分层路径**
  > （`wrapKnockLayeredSvg`），现行 6 帧全身路径不再读取它们；勿再当硬标准扩展。
- **不敲木鱼的阶段（当前仅 buddha）不产 working sheet**：working = 复用 idle 图 + 代码 FX（`noKnock:true`）。
- 角色**身体 SHOULD 占单面板高度 68–75%**；头顶上方（容纳举起木槌）、坐底下方、左右两侧 MUST 留透明 padding。

### 2.3 特效素材尺寸

| 素材 | 确定值 |
|------|--------|
| 可复用祥云环 `fx/cloud-scrolls.png` | AI 生 1024² → **嵌入前降采样到 ~384²**；必须 chroma-key |
| 单张 working SVG 因云环带来的体积增量 | **≲ 0.3 MB** |
| 佛光 / 软光晕 / 莲瓣 | **不出素材**，全部程序化 SVG（`radialGradient` + CSS） |

### 2.4 运行时动画时序（SVG + CSS，硬性）

- 6 帧堆叠，用 **linear + 整点百分比硬切 `opacity`**（`0 / 16.67 / … / 100%`）。**禁止 `step-end`**（尾帧空帧/闪烁）。
- 敲击周期 **1.4s**；离屏冻帧自查在 `currentTime = 756ms`（绽放峰值附近）截图核对佛光 + 云环是否读得出。
- 常驻气场（佛光呼吸、云环自转）在 idle+working 用**完全相同的 CSS**，状态切换不闪跳；事件爆发（敲中绽放、莲瓣飞散）只在 working。

---

## 3. 风格与配色（确定值）

### 3.1 统一画风锚（`REF_STYLE`）

> High-quality chibi pixel-art mobile game sprite：粗黑描边、鲜明色彩、柔和 cel shading、
> 大而闪亮的眼睛、粉色腮红、全身居中、**全透明 alpha 背景**，**无文字 / 无 UI / 无实心底色**。

**必带双参考图**（比任何文字都稳）：当前阶段 `generated/{stage}-idle.png` +
`reference/chibi-monk-reference.png`；换气质的阶段额外喂目标参考图（如 `reference/buddha-ornate-reference.png`）。

### 3.2 主题级配色（`manifest.json.styleGuide`）

| 键 | 值 | 键 | 值 |
|----|----|----|----|
| outline | `#1A1208` | outlineWidth | `0.38` |
| innerRobe | `#F5D76E` | innerRobeDark | `#D4A843` |
| kasayaRed | `#B83232` | kasayaGrid | `#F1C40F` |
| blush | `#F4A6A0` | cloud | `#FFF8F0` |
| bindi | `#C0392B` | | |

各阶段另有 `palette`（robe / robeDark / skin / hair / wood / gold / accent），见 §4 与 `manifest.json`。

---

## 4. 阶段矩阵（唯一权威表）

**功德阈值、外观配饰、FX 强度随境界单调递增。新增阶段照此扩行。**

数值与代码常量 `KNOCK_FX_TIER`（`embed-cultivator-ai-svgs.js`）一一对应：`peak` = 卷纹/佛光爆发峰值不透明度，
`cloudPeak` = AI 祥云环峰值不透明度（`clouds:false` 时为 0），`halo` = 程序化佛光背光，`haloRim` = 光环边缘卷纹，
`petals` = 敲中莲瓣数。**改任一格 = 改 `KNOCK_FX_TIER` + 本表 + Spec 版本**，且沿功德必须单调递增。

| 阶段 | id | 功德阈值 | 本体配饰（烤进图） | 云卷 | 佛光 halo | 边缘卷纹 haloRim | 莲瓣 petals | peak | cloudPeak | 敲木鱼 |
|------|----|---------:|--------------------|:----:|:--------:|:---------------:|-----:|-----:|----------:|:------:|
| 凡人 | `mortal` | 0 | 黑发平民、粗布褐衣、席地坐 | 线条 | ✗ | ✗ | 0 | 0.30 | 0 | ✓ |
| 修行者 | `adept` | 5 | 黄褐简袍、小念珠 | 线条 | ✗ | ✗ | 0 | 0.36 | 0 | ✓ |
| 小和尚 | `novice` | 50 | 光头、黄袍、念珠 | AI 环 | ✓ | ✗ | 0 | 0.42 | 0.80 | ✓ |
| 罗汉 | `arhat` | 150 | 光头、拼布袈裟、念珠 | AI 环 | ✓ | ✓ | 3 | 0.48 | 0.85 | ✓ |
| 菩萨 | `bodhisattva` | 300 | 冠 + 红格袈裟 + 黄袍 + 念珠 | AI 环 | ✓ | ✓ | 5 | 0.52 | 0.90 | ✓ |
| 佛祖 | `buddha` | 500 | 螺发肉髻、华丽袈裟、莲台、**mandorla 光环** | AI 环(环转) | ✗(`bakedHalo`+外扩) | ✗ | 7 | 0.58 | 0.95 | **✗ 万佛朝圣** |

> 佛祖 `halo:false` 但 `bakedHalo:true`：光环美术**烤进角色图**，代码只叠软径向外扩 `halo-bloom`，
> 不再叠常驻 `haloMarkup`，避免双重硬光环。其余阶段 `halo:true` 的佛光**纯程序化**、idle+working 同一 CSS。

- **可烤进角色图的只有「身份结构件」**：佛祖的莲花台 / 华丽袈裟 / mandorla 光环——代码画不出这种美术密度。
- **禁止烤进图（低阶 `FORBIDDEN_FX_LOWER` / 高阶 `FORBIDDEN_FX`）**：金色光环、佛光背光、aura、glow、
  祥云卷纹、莲台（低阶）、飘浮莲瓣、火花、蜡烛、香、钟、任何侧道具。这些一律代码层生成。
- 阈值/配饰为当前发布值；`requiredMerit` 只增不改语义，`stageIndex` 不落盘，由 `resolveStage(merit, stages)` 派生。

---

## 5. 敲击 working sheet 的 6 帧规范（硬性）

### 5.1 六帧动作顺序（`KNOCK_FRAME_SEQUENCE`）

1. 木槌高举 → 2. 略降 → 3. 下摆接近木鱼 → 4. 击中 → 5. 轻微回弹 → 6. 停在木鱼上方。

> **火花的唯一例外**：第 4 帧 MAY 画一点**极小的黄色击中火花**（`KNOCK_FRAME_SEQUENCE` 允许 "tiny yellow spark"），
> 这是帧内**唯一**被容许的 FX。除此之外的一切 FX（佛光/光环/祥云/glow/莲瓣/运动线/光爆）MUST 由代码生成、
> 帧内 MUST NOT 出现。「极小」= 桌宠尺寸下不喧宾夺主，不改变身体像素占用。

### 5.2 五条不可协商约束

1. **IDLE LOCK**：把 idle 复制 6 次，只动敲击手臂 + 木槌；不是画 6 张不同角色。头/脸/躯干/盘腿/坐底在每帧占**相同像素**。
2. **SIZE LOCK**：身体（头顶→坐底）在 6 帧与 idle **完全同大小**；举槌只往上顶进透明 padding，**绝不为容纳木槌缩小角色**。
3. **逐帧全身**：每格是一整只完整角色（身+脸+袍+道具）画在一起；**禁止** base+arm 分层。
4. **道具锚定**：木鱼 + 红垫钉死同一 (x,y)，6 帧同大小同位、不翻转、不滑、不漂、不旋转；固定在**观者左侧**（角色右手敲）。
5. **帧内无 FX**：不画运动线/火爆/祥云/佛光/glow/莲瓣——反馈 FX 全由 CSS 层生成，帧必须干净（第 4 帧极小火花是唯一例外，见 §5.1；莲台不算 FX，idle 有就保留）。

### 5.3 切分归一规则（`split-cultivator-spritesheet.js`）

- 以**身体高度 `bodyMetrics`（头顶→坐底）为锚**归一，不用「含举槌整框高」。
- **6 帧共用一个缩放系数**（各帧身高取**中位数** → 对齐 idle），不逐帧各自缩放。
- ⚠️ idle 锚必须**先 chroma-key**：新 idle 落地后 `candidates/` 与 `generated/` 两份都要去背，否则 `contentBBox` = 整画布、`bottomY≈1023`，working 会被整体放大贴到画布底。

---

## 6. 验收阈值（量化，过不了就重生成）

量化项给出**明确容差**（不是「≈」凭感觉）；工程验收 MUST 用独立度量，不得用 split 内部 `bodyMetrics` 自证自洽。

| 检查 | 通过标准（硬性容差） | 工具 |
|------|----------------------|------|
| 帧数 | 切分产出**恰好 6** 帧；切分器未告警回退 equal-width | `split` 日志 |
| 大小一致 | 每帧 `bodyH / idleBodyH ∈ [0.97, 1.03]`（±3%） | `pipeline.md` 独立度量脚本 |
| 基线锁定 | 各帧 `bottomΔ`（相对 idle）`∈ [-1, +1]` px；`contentH` 差异只来自木槌高低 | 同上 |
| 同侧/不翻转 | 木鱼+木槌 6 帧同在观者左侧，`fishAnchor` 位移 `≤ 1` px | preview 单帧条目检 |
| 同位/脸干净 | idle↔working-1 叠图身体重合；无灰影/重影/裁切 | `build-cultivator-stage-preview.js` → 本地 http server |
| FX 可见性 | 冻帧 756ms，缩到 128px 仍能读出佛光+云环 | 浏览器冻帧截图 |
| 体积 | 单张 working SVG 因云环增量 `≤ 0.3 MB`；云环源 `≤ 384×384` | `stat` / 降采样 |
| 透明底 | 浅底+深底两背景均无假白底 / 近黑残留；`cloud-scrolls.png` 已 chroma-key | 双背景离屏截图 |
| 缺失素材 | `manifest.stages[].id` 对应的 idle/thinking（+非 noKnock 的 sheet）齐全 | `node scripts/generate-cultivator-ai-assets.js`（缺失即 exit 1） |

> Cursor 内置查看器**不渲染 SVG 动画**；「看起来坏了」先用 preview / 冻帧区分是 **CSS 播放** 还是 **图本身漂移**。

---

## 7. 新增「阶段 / 动作 / 形象」标准流程（照填即可）

### 7.1 新增一个阶段

1. `manifest.json.stages` 加一行：`id` / `requiredMerit`（单调递增）/ `name`（en/zh/zh-TW/ko/ja 五语）/ `palette` / `accessories`。
2. `generate-cultivator-ai-assets.js.STAGE_PROMPTS` 加该阶段正向描述 + `FORBIDDEN_FX_LOWER`（或高阶 `FORBIDDEN_FX`）。
3. `embed-cultivator-ai-svgs.js.KNOCK_FX_TIER` 加一行 FX 强度（保持随功德单调递增）。
4. `node scripts/generate-cultivator-ai-assets.js --prompts` 打印 prompt → `GenerateImage` 生 idle/thinking（1:1）+ working sheet（16:9 六格），落 `candidates/`。
5. 去背 → 切分 → 跑 §6 验收 → 过了拷 `generated/` → `node scripts/generate-cultivator-ai-assets.js`（split→transparent→embed）。
6. preview 复核；不过 **重生成**，不修图。

### 7.2 新增一个动作（如念经 chant / 庆祝 celebrate）

- 优先判断能否「一张图 + 代码运动」表达（省素材、免漂移、免体积）；能就走单图 + CSS，别硬凑逐帧。
- 需逐帧时沿用 §2.2 sheet 规范（等宽全身面板 + 透明间隔）与 §5 约束；在 `manifest.actions` 与 embed wrapper 里登记新 action。
- FPS 参考 PRD：动作 20–30 帧 / 2–3s 循环；敲击类 15–20 FPS，静态冥想类 8 FPS。

### 7.3 新增一个形象族（换主题角色）

- 复用本页 §1 法则与 §2 尺寸；重定 `REF_STYLE` 与 styleGuide 配色；换参考图；其余流程不变。

---

## 8. 目录与命名（确定约定）

```text
assets/source/cultivator/
  reference/chibi-monk-reference.png       # 风格参考（必带）
  reference/buddha-ornate-reference.png    # 换气质阶段的目标参考
  generated/{stage}-idle.png               # 流水线输入（验收通过）
  generated/{stage}-thinking.png
  generated/{stage}-working-sheet.png      # → 切分 {stage}-working-{1..6}.png（buddha 无）
  candidates/                              # 仅长期保留 {stage}-idle.png 锚点；raw/preview 用完即清
  fx/cloud-scrolls.png                     # 可复用祥云环（1024²→384²，须 chroma-key）
  manifest.json                            # 阶段矩阵 + viewBox + layout + styleGuide
themes/cultivator/assets/                  # 嵌入后的运行时 SVG（产物，勿手改）
```

命名规范：`{stage}-{action}.png`；帧序 `{stage}-working-{1..6}.png`；action 关键字用英文（`idle`/`thinking`/`working`/`knock`/`chant`/`celebrate`…）。

---

## 9. 资源与状态矩阵（AI vs 程序生成 vs fallback）

每个阶段运行时需要的 SVG 及其来源。**AI**＝AI 生图后嵌入；**程序**＝`generate-cultivator-assets.js` 确定性生成；
**fallback**＝`theme.json` 里 `fallbackTo` 复用其他状态，不出独立素材。

| 运行时 state | 来源 | 素材 / 说明 |
|--------------|------|-------------|
| `idle` | AI | `{stage}-idle.svg`（由 `{stage}-idle.png` 嵌入）；含 `#eyes-js` 时才可眼追（cultivator 当前 `eyeTracking.enabled:false`） |
| `thinking` | AI | `{stage}-thinking.svg` |
| `working` | AI(6 帧) / idle+FX | 非 buddha：6 帧敲击；buddha：复用 idle + 代码 FX |
| `juggling` | 复用 | 指向 `{stage}-working.svg`（多子任务同视觉） |
| `attention` | 程序 | `{stage}-attention.svg`（庆祝/完成） |
| `error` | 程序 | `{stage}-error.svg` |
| `notification` | 复用 | 指向 `attention` |
| `sleeping` | 程序 | `{stage}-sleeping.svg`；`sleepSequence.mode:"direct"` → 无需 yawning/dozing/collapsing/waking |
| `sweeping` / `carrying` | fallback | `fallbackTo:"working"` |

- 单一阶段 MUST 至少产出：`idle` / `thinking` / `working`(或 noKnock 复用) 三个 AI 素材；`attention`/`error`/`sleeping` 由程序脚本刷新。
- **声音**：`stateSounds` 把 `working`/`juggling`/`thinking` 映射到 `knock.wav` 循环；样本 SHOULD 短（~0.6–0.8s），受 mute/DND/隐藏/音量独立门控。
- **mini mode**：cultivator 当前不声明 `miniMode`（`supported` 缺省即关）；新增 mini 素材需齐 8 态（见 §11.3）。

---

## 10. 功德参数（运行时确定值 · 与 PRD 差异）

`themes/cultivator/theme.json.meritCultivator.params` 是**当前发布值**；缺省回落到
`src/theme-progression.js.DEFAULT_MERIT_PARAMS`。素材作者一般不改这里，但升级仪式/overlay 视觉按此触发。

| 参数 | 发布值(theme.json) | 代码缺省 | 含义 |
|------|-------------------:|--------:|------|
| `meritPerSec` | 1 | 1 | 生产状态每秒功德 |
| `meritPerTick` / `meritTickMs` | 1 / 550ms | —/— | 按 tick 计分（敲击节奏） |
| `completionMerit` | 50 | 50 | 任务完成奖励 |
| `errorMerit` | 5 | 5 | 失败奖励 |
| `maxMeritPerSec` | 1 | 1 | 每秒上限（防刷） |
| `minEventCooldownMs` | 1000 | 1000 | 完成事件最小冷却 |
| `dailyBonus` | **0** | 100 | 每日首次奖励（发布版关闭） |
| `streakBonus` | **0** | 500 | 连续 `streakDays` 奖励（发布版关闭） |
| `streakDays` | 7 | 7 | 连续天数阈值 |
| `dailyCap` | 10000 | 10000 | 每日功德上限 |

> **与 PRD 的差异（务必以本表为准）**：PRD 写「2 境界 / 阈值 1000 / 每日奖励 100 / 连续奖励 500」，
> 均为历史 MVP 设想。当前实现是 **6 境界（0/5/50/150/300/500）**，且 `dailyBonus`/`streakBonus` 在发布版**置 0**。
> 境界阈值真相在 `manifest.json` / `theme.json.meritCultivator.stages`，见 §4。

---

## 11. 对外开放的素材规范（第三方主题基线）

面向「其他人做自己的 Clawd 主题」，本节是可直接公开的最小规范。**不依赖功德养成**——
`meritCultivator`（境界进度）是 **builtin-only**，外部主题声明会被忽略；外部作者用普通 `variants` 做外观切换。

### 11.1 交付形态

- 一个文件夹，顶层含 `theme.json`（文件夹名 = theme id，显示名取 `theme.json.name`）。
- 放入用户主题目录：
  - Windows `%APPDATA%/clawd-on-desk/themes/<id>/`
  - macOS `~/Library/Application Support/clawd-on-desk/themes/<id>/`
  - Linux `~/.config/clawd-on-desk/themes/<id>/`
- 避免用内置 id（`clawd` / `calico` / `cloudling` / `cultivator`）。

### 11.2 画布与尺寸规范

- 所有资产共用一套 `viewBox`。栅格格式（GIF/APNG/WebP）**按 viewBox 的 2–3× 导出**（如 viewBox 45×45 → 90×90 或 135×135）。
- 角色在所有帧中位置一致（否则状态切换会跳）。
- 帧动画 4–12 帧起步；静态姿势用单帧 PNG/JPG 亦为一等路径。

### 11.3 格式与能力

| 格式 | 适用 | 眼球追踪 |
|------|------|:-------:|
| SVG | idle / 全动画，无限缩放 + CSS 动画 | ✓（需 `#eyes-js` 等 ID） |
| APNG | 帧动画，带 alpha，质量最佳 | ✗ |
| GIF | 像素风动画（仅二值透明） | ✗ |
| WebP | 照片风动画 | ✗ |
| PNG / JPG | 静态姿势 | ✗ |

- 必备状态：`idle` / `thinking` / `working` / `sleeping`（+ `sleepSequence.mode: full` 时的 `waking`）。
- 眼球追踪：`eyeTracking.enabled:true` 时 idle 必须为含 `#eyes-js` 的 SVG（眼球位移 ≤3px）。
- Mini mode：`miniMode.supported:true` 需齐 8 个 mini 状态；不做就设 `false`。

### 11.4 安全约束（外部主题被视为不可信输入）

- SVG 会被消毒：移除 `<script>`、`onclick` 等事件属性、`javascript:` URL、外部资源 URL、绝对路径、路径穿越。
- `<style>` 里的 CSS 动画允许；`@import` 与不安全 `url(...)` 被剥离；`url(#local-id)` 片段引用允许。
- **不要让外部主题依赖 SVG 内 JavaScript**；`trustedRuntime` 对外部主题一律忽略。

### 11.5 发布前自检

- `node scripts/validate-theme.js path/to/theme` 通过（schema / 资产存在 / 眼追 ID / mini 完整性 / hitbox / variant）。
- 在**目标桌宠尺寸**下核对可见性；浅底 + 深底两种背景核对透明。

### 11.6 版权与 AI 素材来源（MUST）

开放生态里最容易出问题的是版权，硬性要求：

- 主题 MUST 只包含**你拥有权利**的素材：原创、开源（注明兼容许可）或已获授权。
- `theme.json.license` 只是展示字段，**不自动授予权利**；仓库内画风不受项目 AGPL 覆盖（见根 `README` 版权声明）。
- 若素材为 **AI 生成**：MUST 确认所用模型的商用/再分发条款允许；参考图（reference）MUST 是你有权使用的图，禁止喂他人受版权保护的角色/寺庙真人照。
- 建议随主题附 `ATTRIBUTION.md`：逐条列出素材来源、许可、AI 模型与提示要点（参照 `assets/sounds/ATTRIBUTION.md`）。
- 文化敏感元素（佛教符号等）SHOULD 以庄重态度处理，避免恶搞。

### 11.7 最小 `theme.json` 模板（可复制）

```json
{
  "schemaVersion": 1,
  "name": "My Theme",
  "author": "You",
  "version": "1.0.0",
  "viewBox": { "x": -8, "y": -6, "width": 32, "height": 32 },
  "eyeTracking": { "enabled": false, "states": [] },
  "sleepSequence": { "mode": "direct" },
  "states": {
    "idle": ["idle.png"],
    "thinking": ["thinking.png"],
    "working": ["working.png"],
    "attention": ["happy.png"],
    "error": { "fallbackTo": "attention" },
    "notification": { "fallbackTo": "attention" },
    "sleeping": ["sleeping.png"]
  },
  "hitBoxes": { "default": { "x": 0, "y": 2, "w": 16, "h": 16 } },
  "miniMode": { "supported": false }
}
```

- 用同一 `viewBox` 贯穿所有资产；栅格按 2–3× 导出（§11.2）。
- 想眼追：`eyeTracking.enabled:true` + idle 用含 `#eyes-js` 的 SVG。
- 想升境界养成：**做不到**——`meritCultivator` 仅内置生效；外部用 `variants` 表达外观切换。

### 11.8 交付清单（ZIP / 仓库发布前逐条勾）

- [ ] 顶层就是 `theme.json`（不是多套一层 `theme/theme/`）
- [ ] `node scripts/validate-theme.js <dir>` 全绿
- [ ] 所有 `states` 引用的文件都存在、大小写一致（Linux/macOS 敏感）
- [ ] 所有资产同 `viewBox`、角色跨帧位置一致
- [ ] SVG 不依赖内嵌 `<script>`（会被消毒）
- [ ] 浅底/深底两背景核对透明，目标尺寸核对可见性
- [ ] 版权/许可/AI 来源已在 `ATTRIBUTION.md` 交代（§11.6）
- [ ] 未占用内置 id（`clawd`/`calico`/`cloudling`/`cultivator`）
- [ ] README 附一张预览 GIF/截图

---

## 附录 A：变更记录

| Spec 版本 | 日期 | 变更 |
|-----------|------|------|
| `1.0.0` | 2026-07 | 首次成文：钉死画布/尺寸/风格/命名/FX 分层/验收容差；补齐项目功能总览、资源状态矩阵、功德参数、对外治理（版权/模板/交付清单）。标记 `merit-cultivator-prd.md` 为 DEPRECATED；澄清文档状态一览。 |

---

## 相关文档

- 操作手册：[`cultivator-asset-pipeline.md`](./cultivator-asset-pipeline.md)
- 经验复盘：[`cultivator-asset-lessons.md`](./cultivator-asset-lessons.md)
- 主题作者指南：[`guide-theme-creation.md`](./guide-theme-creation.md)
- 产品需求（⚠️ DEPRECATED）：[`../project/merit-cultivator-prd.md`](../project/merit-cultivator-prd.md)
- 宣传片 brief（营销，非规范）：[`../project/cultivator-promo-brief.md`](../project/cultivator-promo-brief.md)
- 主题/状态/UI：[`../project/theme-state-ui.md`](../project/theme-state-ui.md)
