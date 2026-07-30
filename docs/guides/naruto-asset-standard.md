# 火影忍者桌宠素材标准（Spec / 阶段规范）

> **Spec 版本：`0.1.8`** ｜ 最后更新：2026-07 ｜ 美术 = **透明底 standalone chibi 角色**；进行时为三帧、无对手的差异化忍术释放；切帧按透明间隙 + 脚底对齐，禁止等宽硬切邻格。
> 变更记录见文末「附录 A：变更记录」。
>
> **规范用词（RFC 2119 风格）**：**MUST / 必须**＝硬性；**SHOULD / 应**＝强烈建议；**MAY / 可**＝可选。

> **本页定位：火影主题的最终总结性「标准」文档（设计基线）。**
> 进度与素材分层逻辑对齐功德桌宠；数值与坐标系复用 cultivator 发布值；画风锚在用户提供的
> chibi 鸣人参考，**不是**卡牌立绘或 cultivator 的 pixel。
>
> 对照文档：
>
> | 文档 | 定位 |
> |------|------|
> | **本页** `naruto-asset-standard.md` | 火影主题阶段 / 风格 / FX / 版权基线 |
> | [`cultivator-asset-standard.md`](./cultivator-asset-standard.md) | 功德桌宠硬标准（画布、验收容差、流水线边界的母版） |
> | [`cultivator-asset-pipeline.md`](./cultivator-asset-pipeline.md) | 操作手册母版（日后 `*naruto*` 脚本应对齐） |
> | [`cultivator-asset-lessons.md`](./cultivator-asset-lessons.md) | 可迁移经验（重生>修图、AI/代码边界、`<img>`+SMIL） |

> 约束真相源（落地后）：`assets/source/naruto/manifest.json`、未来的
> `themes/naruto/theme.json`、以及（尚未编写的）`scripts/*naruto*` 常量。
> **改标准 = 改这些常量 + 同步本页。**

---

## 0. 一句话总纲

**角色本体（决定「这是谁 / 哪一形态」）交给 AI 生图；运动与特效（决定「怎么动 / 查克拉怎么亮」）交给代码。**
风格锚为用户给出的 chibi 鸣人；桌宠尺寸可读性优先，运行时只展示完整人物。

---

## 1. 核心设计法则（与 cultivator 同构）

1. **重生 > 修图**：AI 生图当「抽卡」，合格线量化 + 便宜重抽。
2. **约束可证伪**：每条生图约束对应一条验收动作。
3. **AI / 代码边界固定**：身份结构烤进图，运动氛围留给代码；同一元素在各状态**要么都在、要么都不在**。
4. **锚点思维**：身体高度 / 坐底基线 / idle 参考图锁定一致性。
5. **目标尺寸验收**：64–128px 远观「看不看得见」为准。
6. **单一真相源**：约束集中在常量表与本页。
7. **透明底默认不可信**：去背 + 浅底/深底双背景核对。

---

## 2. 美术风格锚（standalone chibi Naruto）

### 2.1 风格定义（`REF_STYLE`）

> Chibi Naruto desk-pet sprite: oversized head (~45–55% body height), small body, bold clean
> outlines, vibrant flat cel colors, soft shading, whisker cheeks, spiky yellow hair, orange
> accents, full-body centered, fully transparent alpha background, no text / no UI.
> Desk-pet readable silhouette at small size — avoid micro-detail that vanishes at 64px.

**不是** Storm 卡牌立绘，也不是 cultivator 的 pixel；**是**用户 chibi 参考（`chibi-naruto-ref-rainbow.png` / `chibi-naruto-ref-porch.png`）那种大 Q 版气质，经桌宠剪影简化。

### 2.2 外部参考源（仅参考 · 不入库 · 不随主题分发）

风格真相源：本机项目 `/Users/Admin/Projects/naruto-ssr`
（《究极忍者风暴 4》风格 SSR 抽卡站）。

| 用途 | 外部路径 | 对应阶段 | 入库约定 |
|------|----------|----------|----------|
| chibi 彩虹场景 | 用户提供 `chibi-naruto-ref-rainbow.png` | `kcm`/`sixpaths`/`kurama` mood | 已拷 `reference/` |
| chibi 门廊场景 | 用户提供 `chibi-naruto-ref-porch.png` | `academy`/`genin`/`sage` | 已拷 `reference/` |
| 原始卡图 / 场景图 | 仅供 prompt 参考 | 不作 runtime 主素材 | **MUST NOT** 直接嵌入角色状态 |

运行时源图：`generated/{stage}-{idle,thinking}.png`（1024²）→ `generated/runtime/`（512² 去背版）。
嵌入命令：`npm run embed:naruto-chibi` → 覆盖 `themes/naruto/assets/*.svg`。

### 2.3 版权边界（MUST）

- `naruto-ssr` README 声明角色立绘**仅供个人学习展示**；版权归原作者与 Bandai Namco / 岸本齐史。详见 [`assets/source/naruto/ATTRIBUTION.md`](../../assets/source/naruto/ATTRIBUTION.md)。
- **本地个人实验（用户已授权）**：允许把降采样衍生物嵌入本机 `themes/naruto/assets/`，用于调试气质与进度轴。
- **公开发布 / 对外分发**：MUST NOT 携带原作立绘 / 卡牌 / 场景图；只可使用独立生成的 chibi 角色资产。
- 文化 / IP 敏感：避免恶搞标志性忍界符号到侮辱性程度；本主题为粉丝向桌宠实验。

### 2.4 桌宠适配（硬约束）

- 运行时素材 MUST 是**透明底、单个完整人物**；不得有卡框、场景、地面、投影或棋盘格。
- 验收尺寸仍是 **64–128px**；角色 MUST 占画布高约 68–75%，四周保留透明 padding。
- 生图 MUST 走 **「大头 Q 版 × 桌宠可读剪影」**：粗干净描边、平涂 cel shading、橙/金/蓝查克拉色，**简化碎褶与微纹理**。
- 缩到小尺寸仍 MUST 能读出：护额 / 仙人纹 / 查克拉衣 / 求道玉（按阶段出现）。

---

## 3. 画布与尺寸（复用 cultivator）

与 [`cultivator-asset-standard.md`](./cultivator-asset-standard.md) §2 相同；真相在
[`assets/source/naruto/manifest.json`](../../assets/source/naruto/manifest.json)。

| 项 | 确定值 |
|----|--------|
| `viewBox` | `{ x: -8, y: -6, width: 32, height: 32 }` |
| `layout.contentBox` | `{ x: 0, y: 0, width: 16, height: 20 }` |
| `layout.centerX` / `baselineY` | `8` / `20` |
| `layout.visibleHeightRatio` | `0.62` |
| `layout.baselineBottomRatio` | `0.18` |
| `hitBoxes.default` | `{ x: 0, y: 2, w: 16, h: 16 }` |
| `hitBoxes.sleeping` | `{ x: 0, y: 6, w: 16, h: 12 }` |

### 3.1 AI 生图源图尺寸（落地流水线后）

| 资产 | 请求比例 | 面板数 | 命名 |
|------|----------|--------|------|
| idle / thinking | `1:1`（1024²） | 1 | `{stage}-idle.png` / `{stage}-thinking.png` |
| working 招式图 | `1:1`（1024²） | 1 | `{stage}-working.png` |

- 所有阶段均 MUST 产出独立的 working 招式图；不得复用 idle。
- 身体 SHOULD 占画布高度 68–75%；招式只使用人物单侧的透明 padding，坐底、左右 MUST 留透明 padding。

### 3.2 运行时动画时序

- 3 帧堆叠：linear + 整点百分比硬切 `opacity`。**禁止 `step-end`**。
- working SVG 以轻微 1.15s 上下脉冲表现蓄力；`meritTickMs:550` 仍只控制进度 tick。
- idle「查克拉结界」动效 **MUST 用 SMIL**（主题默认 `eyeTracking.enabled:false` → idle 走 `<img>`，CSS `@keyframes` 不播放）。

---

## 4. 风格与配色（`styleGuide`）

| 键 | 值 | 键 | 值 |
|----|----|----|----|
| outline | `#1A1208` | outlineWidth | `0.38` |
| orange | `#F06B1F` | orangeDark | `#C44E12` |
| blackSuit | `#1C1C22` | chakraBlue | `#4DB8FF` |
| chakraGold | `#FFD84A` | sageOrange | `#E67E22` |
| kuramaRed | `#C0392B` | blush | `#F4A6A0` |

各阶段另有 `palette`（suit / suitDark / skin / hair / accent / chakra），见 §5 与 `manifest.json`。

---

## 5. 阶段矩阵（唯一权威表）

进度轴 = **鸣人力量形态进化**。阈值照搬 cultivator：`0 / 5 / 50 / 150 / 300 / 500`。
`stageIndex` 不落盘，由 `resolveStage(merit, stages)` 派生。
FX 强度随阶段单调递增（对应未来 `SEAL_FX_TIER` / `IDLE_AURA_TIER`）。

| 阶段 | id | 阈值 | 本体配饰（烤进图） | 进行时招式（烤进 working 图） | peak |
|------|----|-----:|--------------------|------------------------------|-----:|
| 学院学生 | `academy` | 0 | 黄发腮须、橙学员服、护额挂脖 | 苦无起手 + 极短橙色轨迹 / 符纸 | 0.30 |
| 下忍·影分身 | `genin` | 5 | 橙黑外套、护额、影分身残影 | 蓝色螺旋丸 + 分身结印支援 | 0.36 |
| 仙人模式 | `sage` | 50 | 仙人纹、竖瞳、红色仙人披风 | 风遁·螺旋手里剑 | 0.42 |
| 九尾查克拉 | `kcm` | 150 | 金色查克拉衣、封印纹、竖瞳 | 金橙尾兽玉 | 0.48 |
| 六道仙人 | `sixpaths` | 300 | 九喇嘛披风、金瞳、**6 求道玉**、黑杖 | 六道螺旋手里剑 + 求道玉环 | 0.54 |
| 尾兽·九尾 | `kurama` | 500 | 九尾耳 / 披风 / 尾状查克拉、螺旋纹 | 赤金终极尾兽玉 + 三尾环流 | 0.60 |

- **可烤进角色图的只有「身份结构件」**：护额、仙人纹、查克拉衣剪影、求道玉定位、九尾/mandorla 光背（`kurama`）。
- idle / thinking **禁止**烤进运动特效：呼吸光晕、查克拉火焰、螺旋丸、尾兽玉、飘叶、bloom 一律不出现。
- working 是唯一允许招式能量体烤进图的状态：招式必须与手势 / 武器像素级绑定，并收在 32×32 画布内；环境粒子和大范围屏幕特效仍留给代码。

### 5.1 每阶段：静态 vs 运行时

#### ① `academy` — 学院学生（阈值 0）

- **静态**：大头 Q 版——黄发、腮须、橙色学员服、护额挂脖未戴；无查克拉特效。气质参考 `characters/naruto.png` 降阶（去护额/去外套肩甲）。
- **运行时**：working=苦无投掷起手（无对手、招式朝右上）；idle 结界=木叶飘落 + 极淡微尘。

#### ② `genin` — 下忍·影分身（阈值 5）

- **静态**：对齐 `characters/naruto.png`——疾风传橙黑外套、戴护额、蓝眼；身侧**半透明影分身残影**烤进图。螺旋丸等事件 FX **不**烤进 idle。
- **运行时**：working=影分身结印 → 蓝色螺旋丸 → 前推释放；**影分身仅属于本阶段**；idle 结界=淡蓝查克拉微光 + 分身残影闪动（SMIL）。

#### ③ `sage` — 仙人模式（阈值 50）

- **静态**：同基线体型 + 眼周橙色仙人纹、竖瞳感；硬阴影不改画风。
- **运行时**：working=风遁·螺旋手里剑；招式盘保持在出手侧，不遮脸；idle 结界=自然能量粒子汇聚 + 地面微尘。

#### ④ `kcm` — 九尾查克拉模式（阈值 150）

- **静态**：金色查克拉外衣、黑色封印纹、竖瞳；外衣边缘小尺寸仍可读「金衣」。
- **运行时**：working=金色高速冲刺 → 双手压缩尾兽玉 → 金色查克拉冲击；idle 结界=金色查克拉火焰呼吸 + 封印纹发光。

#### ⑤ `sixpaths` — 六道仙人模式（阈值 300）

- **静态**：对齐 `war/sixpaths.png` 鸣人侧——橙金外衣 / 九喇嘛披风勾玉、金瞳；**六个求道玉**环绕定位烤进图。
- **运行时**：working=六颗求道玉环绕 → 六角术式结阵 → 黑杖六道光刃；idle 结界=求道玉慢转（SMIL）+ 勾玉发光。

#### ⑥ `kurama` — 尾兽模式·九尾（阈值 500）

- **静态**：取 `jinchuriki` / `sixpaths` 神级压迫感——九尾查克拉轮廓或羁绊模式、螺旋纹、**mandorla 级查克拉光背烤进图**（`bakedAura`）。
- **运行时**：working=赤金终极尾兽玉；三条紧凑尾状查克拉围绕身体，不裁切人物；idle 结界=极盛 bloom + 九尾摆动 + 光爆。

### 5.2 idle 结界 motif（单调递增）

| 阶段 | idle 结界标志 |
|------|----------------|
| `academy` | 木叶飘落 + 极淡微尘（禁止程序几何宠物） |
| `genin` | 淡蓝查克拉微光 + 分身残影闪动 |
| `sage` | 自然能量粒子汇聚（SMIL）+ 地面微尘 |
| `kcm` | 金色查克拉火焰呼吸 + 封印纹发光 — **无求道玉** |
| `sixpaths` | 求道玉慢转 + 披风勾玉发光 — **无九尾 bloom** |
| `kurama` | 极盛 bloom + 九尾摆动 + 光爆 — **无重复硬光背**（已 `bakedAura`） |

结界 **MUST NOT** 泄漏进 thinking / attention / error / sleeping。

---

## 6. 招式 working 规范

working 表示 AI agent 正在进行任务：鸣人**面对无形目标自行释放招式**，不是敲木鱼，也不需要画敌人。

1. 每阶段 MUST 产出 **恰好 3 帧**：起势 → 招式成型 → 释放 / 回收。
2. 三帧 MUST 共享同一身体比例、脚底基线与水平锚；招式可以变大，人物不得随帧缩放。
3. 人物必须完整可见，身体保持 68–75% 画布高；招式只占空出的单侧区域，绝不裁切脸 / 手 / 鞋。
4. 方向统一：人物向观者右侧出招；目标不可见。
5. 招式可烤入 working 图（螺旋丸、手里剑、尾兽玉、紧凑的查克拉尾）；**不得**烤入 idle / thinking。
6. 运行时把三帧叠入一个 SVG，以 **linear + 0/33.33/66.67/100% 硬切 opacity** 循环 1.4s；禁止 `step-end`。
7. 大范围 bloom、屏幕震动、额外粒子等仍由 SVG / 运行时层叠加，保证同一套姿势可读。

### 6.1 当前六阶段动作表

| 阶段 | 3 帧动作 |
|------|-----------|
| `academy` | 苦无持握 → 抛掷 → 跟手复位 |
| `genin` | 影分身结印 → 蓝色螺旋丸成型 → 前推释放；只有本阶段出现分身 |
| `sage` | 自然能量汇聚 → 风遁·螺旋手里剑成型 → 投掷风刃 |
| `kcm` | 金色高速冲刺 → 双手压缩尾兽玉 → 金色查克拉冲击 |
| `sixpaths` | 六颗求道玉环绕 → 求道玉六角术式 → 黑杖六道光刃 |
| `kurama` | 查克拉尾起势 → **巨型终极尾兽玉蓄力** → 九尾巨像赤红爆发 |

---

## 7. 验收阈值

复用 cultivator §6 容差（`bodyH` ±3%、基线 ±1px、浅底+深底透明核对等）。额外：

| 检查 | 通过标准 |
|------|----------|
| 风格 | 64–128px 下仍读得出大头 Q 版角色轮廓；不是卡牌、场景或 pixel |
| 阶段可读 | 缩略后能区分护额 / 仙人纹 / 金衣 / 求道玉 / 九尾光背 |
| 版权（发布前） | 公开发布包不得含 `reference/` 原作全图或 SSR 嵌入 SVG；见 ATTRIBUTION.md |

---

## 8. 资源与状态矩阵

| 运行时 state | 来源 | 说明 |
|--------------|------|------|
| `idle` | AI + 程序结界 | `{stage}-idle.svg` + per-stage 查克拉结界 SMIL |
| `thinking` | AI | `{stage}-thinking.svg` |
| `working` | AI | `{stage}-working.svg`：无对手的对应阶段招式释放 |
| `juggling` | 复用 | → `{stage}-working.svg` |
| `attention` | 程序 | 庆祝/完成 |
| `error` | 程序 | 失败反馈 |
| `notification` | 复用 | → `attention` |
| `sleeping` | 程序 | `sleepSequence.mode:"direct"` |
| `sweeping` / `carrying` | fallback | `fallbackTo:"working"` |

- 单一阶段 MUST 至少产出：`idle` / `thinking` / `working` 三个 AI 素材。
- 声音（落地时）：`stateSounds` 把 working/juggling 映射到对应招式蓄力 / 查克拉循环音；受 mute/DND/隐藏门控。
- mini mode：本主题当前不声明（与 cultivator 一致）。

---

## 9. 进度参数（运行时确定值）

复用 cultivator 发布值（`theme.json.meritCultivator.params` 落地时照抄）：

| 参数 | 值 |
|------|---:|
| `meritPerSec` | 1 |
| `meritPerTick` / `meritTickMs` | 1 / 550 |
| `completionMerit` | 50 |
| `errorMerit` | 5 |
| `maxMeritPerSec` | 1 |
| `minEventCooldownMs` | 1000 |
| `dailyBonus` / `streakBonus` | 0 / 0 |
| `streakDays` | 7 |
| `dailyCap` | 10000 |

引擎：`normalizeMeritCultivator` 对 **任意 builtin** 主题生效（不硬编码 `cultivator` id）；进度桶 `prefs.meritProgress[themeId]`，与功德主题互不干扰。

---

## 10. 目录与命名

```text
assets/source/naruto/
  ATTRIBUTION.md
  reference/chibi-naruto-ref-*.png  # 用户提供的风格参考
  generated/{stage}-{idle,thinking}.png  # 1024² 独立生成角色
  generated/runtime/*.png             # 去棋盘格并降采样的 alpha PNG
  manifest.json
themes/naruto/
  theme.json
  assets/{stage}-{action}.svg  # 当前：独立 chibi 人物嵌入
scripts/make-naruto-pngs-transparent.py
scripts/embed-naruto-chibi-assets.js
```

> 当前桌宠美术 = **独立 chibi 人物**；透明底，卡牌和场景不进入运行时。

命名：`{stage}-{action}.png`；
action 关键字：`idle` / `thinking` / `working` / `attention` / `error` / `sleeping`。

阶段 id（稳定，勿随意改）：`academy` / `genin` / `sage` / `kcm` / `sixpaths` / `kurama`。

---

## 11. 新增阶段 / 动作标准流程（落地后）

1. `manifest.json.stages` 加行（阈值单调递增、五语 name、palette、accessories）。
2. 未来 `STAGE_PROMPTS` + `FORBIDDEN_FX*` + `SEAL_FX_TIER` / `IDLE_AURA_TIER` 同步。
3. 生图 → 去背 → 切分 → §7 验收 → embed → preview。
4. 优先「一张图 + 代码运动」；能避免逐帧就避免。

---

## 附录 A：变更记录

| Spec 版本 | 日期 | 变更 |
|-----------|------|------|
| `0.1.8` | 2026-07 | 修复 working 邻格残影：切帧改为透明间隙检测 + 脚底/基座对齐 + 边角碎块清理；SVG 改用 `visibility` discrete 硬切，禁止等宽硬切邻格。 |
| `0.1.7` | 2026-07 | working 压缩为三帧；下忍、仙人、九尾查克拉、六道分别重绘为分身结印/风遁手里剑/高速冲击/求道玉术式，只有下忍保留分身。 |
| `0.1.6` | 2026-07 | working 升级为每阶段六帧招式动画；九尾为巨像显现 + 巨型赤黑尾兽玉终极招式。 |
| `0.1.5` | 2026-07 | working 改为六阶段无对手的华丽忍术释放：苦无、螺旋丸、风遁手里剑、尾兽玉、六道大招、九尾终极尾兽玉。 |
| `0.1.4` | 2026-07 | 彻底移除卡牌 / 场景嵌入；生成 6 阶段 × idle/thinking 独立 chibi 人物，去棋盘格后嵌入 runtime SVG。 |
| `0.1.3` | 2026-07 | 早期错误尝试：以用户 chibi 场景作为嵌入源；已废弃。 |
| `0.1.2` | 2026-07 | 用 naruto-ssr 立绘替换几何 stub：`embed:naruto-ssr`；reference/generated + ATTRIBUTION；本地实验允许嵌入，公开发布仍禁止。 |
| `0.1.1` | 2026-07 | 脚手架：`themes/naruto/theme.json` + stub SVG；`kurama` working 复用 idle（noKnock）。 |
| `0.1.0` | 2026-07 | 首次成文（spec-only）。 |

---

## 相关文档

- 功德母版标准：[`cultivator-asset-standard.md`](./cultivator-asset-standard.md)
- 功德流水线：[`cultivator-asset-pipeline.md`](./cultivator-asset-pipeline.md)
- 可迁移经验：[`cultivator-asset-lessons.md`](./cultivator-asset-lessons.md)
- 主题作者指南：[`guide-theme-creation.md`](./guide-theme-creation.md)
- 源 manifest：[`../../assets/source/naruto/manifest.json`](../../assets/source/naruto/manifest.json)
