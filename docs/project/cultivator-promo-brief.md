# Cultivator 宣传片 Brief + 分镜（日日礼佛版）

> **定位：营销 / 创意 brief（非产品规范、非素材标准）。**
> 素材尺寸、境界阈值、验收阈值请读 [`../guides/cultivator-asset-standard.md`](../guides/cultivator-asset-standard.md)。
>
> 状态：HyperFrames 工程已开工 — 见 [`videos/cultivator-promo/`](../../videos/cultivator-promo/)。`npx hyperframes check` 已通过；预览后可 render MP4。
> 规格：约 36 秒 · 16:9（1920×1080）· 中文字幕优先（可静音看懂）· VO 可选

---

## 1. Creative brief

### 一句话定位

别临时抱佛脚了。Agent 每天干活，桌宠每天礼佛。

### 核心洞察

当代人有礼佛 / 求安心的需求，但「出事才抱佛脚」羞耻且无效感强。Cultivator 桌宠把礼佛变成**无感日课**：你写代码、agent 跑任务时，它已经在桌角敲木鱼、攒功课——不是临时求保佑，是每天都在拜。

### 受众

- 日常使用 Claude Code / Cursor / Codex 等 AI coding agent 的开发者
- 对礼佛、日课、心安有共鸣，但讨厌说教与「临时抱佛脚」的人
- 喜欢短视频梗、愿意截图转发的受众

### 主卖点

和工作流绑定的日课礼佛搭子；不用专门腾时间，agent 一开工它就开拜。

### 情绪与调性

先吐槽再反转，轻松治愈，能截图转。木鱼 / 六境皮肤当作日课与「功课见长」的符号，不当信仰说教或游戏喊麦。

### 关键词

不临时抱佛脚 · 日日礼佛 · 日课 · 敲木鱼 · 功德++ · 功课见长 · 打卡

### 禁止项

- 恐吓式因果、算命贩卖焦虑
- 沉重法会腔、产品说明书腔
- 戏谑亵渎信仰（可以俏皮，不能嘲讽信仰本身）
- 空泛「圆满 / Level Up」喊麦；升级用「打卡 / 功课见长」

### CTA

`开源桌宠 · 日日礼佛，不抱佛脚`  
片尾点名 Clawd；repo / 下载链接占位，开拍前填实。

### 产品锚点（事实，不写进主字幕百科）

- 主题：`themes/cultivator`
- 六境皮肤：凡人 → 修行者 → 小和尚 → 罗汉 → 菩萨 → 佛祖（见 `meritCultivator.stages`）
- agent 状态联动：thinking / working 等触发木鱼 loop（`knock.wav`）
- Clawd 仅片尾身份锚点，不抢主钩子

---

## 2. 可截图金句

优先保留，适合封面 / 二创 / 静音传播：

1. 「又想临时抱佛脚？」
2. 「不用。它每天都在拜。」
3. 「Agent 敲代码，它敲木鱼。」
4. 「日课，不是补考。」
5. 「开源桌宠 · 日日礼佛，不抱佛脚」

竖屏封面备选（若二次裁 9:16）：

- 主标：`别抱佛脚了，天天拜。`
- 副标：`AI 干活 · 桌宠礼佛`

---

## 3. Beat sheet（~36s）

```text
Hook 吐槽抱佛脚 (0–4s)
  → Flip 它天天在拜 (4–8s)
  → Sync Agent/木鱼对仗 (8–14s)
  → Score 日课不是补考 (14–18s)
  → Glow-up 六境换装 (18–26s)
  → Flex 今日功课打卡 (26–31s)
  → CTA (31–36s)
```

节奏原则：

- 前 8 秒只做吐槽 → 反转，不堆功能
- 中间靠对仗句传播
- 六境快切压缩到约 8s，当换装秀
- 片尾 5s 只留 CTA

---

## 4. 逐镜脚本（定稿）

总长约 **36s**。大字幕扛传播；VO 可弱化或去掉。木鱼点在切镜与功德反馈上。

| # | 时间 | 画面 | 大字幕 | VO（可选） | 音效 |
|---|------|------|--------|------------|------|
| 1 | 0:00–0:04 | 桌角凡人 `idle`；角落淡入模糊终端报错 / `deadline` 字样（虚焦，不抢戏） | **又想临时抱佛脚？** | （停半拍）又想抱佛脚了？ | 环境静；可选极轻叹垫底 |
| 2 | 0:04–0:08 | 硬切：agent 状态亮起 → 桌宠 `working`，木鱼开敲；镜头微推近 | **不用。它每天都在拜。** | 不用。它——每天都在拜。 | `knock.wav` 入点，稳定 loop |
| 3 | 0:08–0:14 | 分屏或画中画：左终端滚动 / 右桌宠敲木鱼；功德数字从角落弹出连跳 | **Agent 敲代码，它敲木鱼。** | Agent 敲代码，它敲木鱼。 | 木鱼对齐字幕节拍（约每 0.7s，与 `knock.wav` 一致） |
| 4 | 0:14–0:18 | 任务完成反馈：`+50` / 功德闪一下；桌宠合十或完成态微笑感 | **日课，不是补考。** | 这是日课，不是补考。 | 完成叮一声轻音 + 木鱼停半拍再续 |
| 5 | 0:18–0:26 | 六境皮肤快切（凡人→修行者→小和尚→罗汉→菩萨→佛祖），每镜约 1.2s，当「功课见长换装」 | **功课见长，越拜越精神。** | 用着用着，功课见长。 | 每切一境一记木鱼；后半加极轻祥云垫乐 |
| 6 | 0:26–0:31 | 升级光效 / 祥云（`cloud-scrolls` 或 motion 补）；正中大字 | **今日功课，打卡。** | 今日功课——打卡。 | 一声清亮木鱼收束（非轰鸣） |
| 7 | 0:31–0:36 | Clawd + cultivator 桌宠定妆；底部 CTA；repo 占位 | **开源桌宠 · 日日礼佛，不抱佛脚** | （可无 VO，只留字幕） | 木鱼淡出，垫乐收 |

### 镜 5 六境切序（素材文件提示）

| 顺序 | 境界 | 建议静帧 / 动画源 |
|------|------|-------------------|
| 1 | 凡人 | `themes/cultivator/assets/mortal-idle.svg` 或 `mortal-working.svg` |
| 2 | 修行者 | `adept-idle.svg` / `adept-working.svg` |
| 3 | 小和尚 | `novice-idle.svg` / `novice-working.svg` |
| 4 | 罗汉 | `arhat-idle.svg` / `arhat-working.svg` |
| 5 | 菩萨 | `bodhisattva-idle.svg` / `bodhisattva-working.svg` |
| 6 | 佛祖 | `buddha-idle.svg` / `buddha-working.svg` |

亦可使用 `assets/source/cultivator/generated/*-idle.png` 作高清静帧备用。

### 完整 VO 连读稿（可选录制）

> （停半拍）又想抱佛脚了？不用。它——每天都在拜。Agent 敲代码，它敲木鱼。这是日课，不是补考。用着用着，功课见长。今日功课——打卡。

约 45–55 字量级口播，留白给木鱼与字幕；片尾 CTA 建议无 VO。

---

## 5. 素材清单

### ready（仓库内已有）

| 素材 | 路径 | 用途 |
|------|------|------|
| 六境 SVG 状态组 | `themes/cultivator/assets/{mortal,adept,novice,arhat,bodhisattva,buddha}-*.svg` | 镜 1–6 角色画面 |
| 主题与境界定义 | `themes/cultivator/theme.json` → `meritCultivator.stages` | 名称 / 切序依据 |
| 木鱼音效（CC0） | `assets/sounds/knock.wav` | loop / 切镜点；署名见 `assets/sounds/ATTRIBUTION.md` |
| 祥云 FX | `assets/source/cultivator/fx/cloud-scrolls.png` | 镜 6 光效层 |
| Generated 静帧 | `assets/source/cultivator/generated/*` | 高清备用 / 海报 |
| 境界中文名 | theme.json `name.zh` | 字幕辅助（可选小字，不抢大金句） |

### needs-capture（待实机录屏）

| 素材 | 说明 |
|------|------|
| 桌角凡人 idle 实机 | 透明窗桌宠坐真实桌面，约 4–6s |
| Agent 开工 → working + 木鱼 | Claude / Cursor / Codex 任一触发 thinking/working，同步桌宠敲木鱼 |
| 功德 overlay / +merit | 若产品 overlay 可见则录；否则 HyperFrames 用动效数字代替 |
| 完成反馈瞬间 | 任务结束时桌宠状态切换 + 数字跳变（可剪辑拼） |

录屏建议：16:9 或更高再裁；桌宠尽量大、背景干净；系统通知关掉。

### needs-generate（HyperFrames / 设计补）

| 素材 | 说明 |
|------|------|
| 大字幕动效 | 金句入场（硬切或轻弹入），静音可读 |
| 虚焦报错 / deadline 层 | 镜 1 氛围，不抢桌宠 |
| 分屏/画中画构图 | 镜 3 终端 + 桌宠 |
| `+50` / 功德连跳 UI | 若无实机 overlay，用 HTML/CSS 仿 |
| 六境快切转场 | 约 1.2s/境，可配闪白或木鱼切点 |
| 升级光效 | 祥云 + 轻粒子；忌重金属游戏爆屏 |
| 垫乐 | 极轻、东方感或干净电子铺底；不压木鱼 |
| 完成叮 | 短、轻，与 `knock.wav` 不抢频 |
| 片尾 CTA 板 | 产品名 + 金句 + repo 占位 |
| 竖屏安全区裁切 | 若发短视频再出 9:16 版 |

---

## 6. HyperFrames 交接备注

### 建议 workflow

- 主流程：`/general-video`（多镜、有梗字幕、非纯官网 tour）
- 若先做 5–8s 钩子单镜测试：可用 `/motion-graphics`
- 开工前安装 skills：

```bash
npx skills add heygen-com/hyperframes --full-depth
# 或非交互核心集：
npx hyperframes skills update
```

### 工程规格

| 项 | 值 |
|----|-----|
| 画幅 | 1920×1080（16:9） |
| 时长 | ~36s |
| 帧率 | 30fps（或项目默认） |
| 字幕 | 中文大字幕优先；VO 可选轨 |
| 必用本地音 | `assets/sounds/knock.wav` |
| 调性参考 | 本文件 §1–4，勿回退成纯「修行说明书」或恐吓因果 |

### `frame.md` / 视觉方向（给 agent 的短指令）

- 桌宠是视觉主角；终端 / 报错只作虚焦或分屏配角
- 配色干净、略暖，留白多；忌紫霓虹赛博默认皮
- 字幕大、短、可截图；每镜一句主字幕
- 木鱼是节奏锚，不要铺满人声鸡汤

### 验收（成片前对照）

- [ ] 36s 内钩子说清：日日礼佛 vs 临时抱佛脚
- [ ] ≥3 条字幕可独立当 meme
- [ ] 趣味与礼佛并存：好笑但不冒犯信仰
- [ ] 未出现恐吓因果 / 法会说教 / Level Up 喊麦
- [ ] 木鱼与切镜、功德反馈对齐

### 下一步（本文档之外）

1. 补 `needs-capture` 实机素材  
2. `npx hyperframes init` 建工程，按本脚本写 composition  
3. `preview` → `lint` → `render` 出 MP4  

---

## 参考

- 主题：`themes/cultivator/theme.json`
- 产品需求（功能事实，片中文案以本 brief 为准）：`docs/project/merit-cultivator-prd.md`
- 木鱼署名：`assets/sounds/ATTRIBUTION.md`
