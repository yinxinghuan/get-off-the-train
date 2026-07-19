# 《挤下地铁》技术文档

## 1. 技术栈

- React 18 + TypeScript 5：游戏外壳、屏幕状态、HUD、虚拟摇杆与结果界面。
- Three.js 0.169 + React Three Fiber：第三人称透视跟随相机、3 阶 toon 材质、实时 3D 车厢、角色和阴影。
- Less：美式漫画 UI、粗墨边、硬阴影、网点与响应式布局。
- Web Audio API：用户首次操作后创建振荡器，合成碰撞、晃动、摔倒、过关和失败声音。
- Vite 5：`base: './'` 的可移植构建，产物输出到 `dist/`，可部署在任意子路径。
- 浏览器 API：Pointer Events、Keyboard Events、Page Visibility、`prefers-reduced-motion` 和 localStorage。

## 2. 目录结构

- `src/App.tsx`：四态无限流程、场景内待操作子状态、关卡推进、累计得分、排行榜提交、破纪录通知、暂停恢复与全局输入。
- `src/game/TrainScene.tsx`：车厢建模、人物生成、主循环、碰撞、晃动、摔倒、出口判定和 HUD 采样。
- `src/game/models.ts`：有限色盘、toon 材质、几何图元、现有人物比例复用与乘客外形 roster。
- `src/game/types.ts`：状态类型、前 5 关数值表与后续无限难度公式。
- `src/ui/Joystick.tsx`：全场景 Pointer Capture 动态摇杆、首次输入启动和循环幽灵手指 SVG。
- `src/ui/Icons.tsx`：统一 24×24 墨线 SVG 图标家族。
- `src/audio/sound.ts`：限流的合成音效与静音状态。
- `src/i18n/index.ts`：按 `game_locale` / 浏览器语言切换 zh/en 的轻量双语字典。
- `src/game-id.ts`：由平台脚本注入的永久 UUID，全局写入 `window.__GAME_UUID__`。
- `src/shared/leaderboard/`：平台最高分 hook 与符合头像/姓名规则的漫画排行榜。
- `src/shared/runtime/`：Aigram bridge、永久 UUID、事件与通知调用所需的最小运行时。
- `src/app.less`：漫画视觉 token、HUD、覆盖层、摇杆、窄屏与减弱动态规则。
- `doc/requirements.md` / `doc/visual.md`：玩法蓝图与最终视觉合同。
- `scripts/generate_poster.py`：调用 Aigram transit 生成叙事海报，并在顶部安全区叠加确定性标题。

## 3. 核心模块

### 状态管理与主循环

`App.tsx` 维护 `playing / paused / level-clear / game-over`，并用 `runStarted` 区分“真实场景已显示但等待首次输入”和计时中的游戏。首次触摸或方向键输入才解锁声音、记录赛前最高分并启动倒计时；幽灵手指只是 DOM 演示，不写入物理、分数或平台事件。前 5 关读取手工配置，之后由 `getLevelConfig()` 按封顶公式持续生成，挑战只有失败终点。每关用 `level` 作为 `TrainScene` key，确保所有物理实体和计时器独立重建。高频位置、速度、倒地计时和晃动阶段都留在 `useRef` 中，由 `useFrame` 更新；HUD 以 80 ms 间隔采样，避免逐帧 React 重渲染。

### 屏幕适配与输入

3D Canvas 全屏响应式，55° 透视相机以主角位置减去路线前向量 5.2 world-unit 为目标位置，并用指数插值跟随；视点始终落在主角前方 4.8 world-unit，使主角在下方中央、出口在上方。HUD 和普通 DOM 按 320×568–430×932 内部重排，不依赖整页 transform。全屏输入面在每次 `pointerdown` 记录落指原点并显示 108 px 动态摇杆；屏幕向上向量投影到“出生点→车门”的固定前向量，横向投影到其垂直右向量。WASD / 方向键共用同一输入引用。

### 碰撞、晃动与更新

人物采用二维圆形刚体近似，保留 3D 视觉旋转。每帧限制 `dt<=33ms`，先处理主动速度和阻尼，再处理边界/立柱/行李静态碰撞，最后执行人物两两穿透分离和 35% 法向动量交换。周期晃动在预警窗口驱动吊环摆动，接触帧向所有人物施加横向冲量；失衡值超过个人稳定阈值时进入倒地、滑动、起身和短保护阶段。玩家松手 180 ms 后进入站稳状态，失衡降低 32%。

### 音频、多语言、排行榜与通知

音效使用短振荡器包络，不加载远程音频；碰撞按 80 ms 限流。所有关键 UI 文案从 `src/i18n/index.ts` 读取。最高总分使用专属 localStorage key `get-off-the-train.best.v1`，并在失败时通过永久 UUID `7cc693d3-6ca5-414e-8dbe-7fb66de752f2` 提交平台 best-score 排行榜。平台内其他玩家的头像姓名调用 `openAigramProfile()`；破纪录时只对一位本次刚超过的真实玩家发送 `score_beat` 事件。平台外不展示虚构排名，改为进入 AlterU 的明确 CTA。

## 4. 扩展点

- 调整关卡时间、人数、晃动周期和冲量：修改 `src/game/types.ts` 的 `LEVELS` 与 `getLevelConfig()` 封顶公式。
- 改碰撞、速度、倒地或出口公式：修改 `src/game/TrainScene.tsx` 的 `useFrame` 更新段。
- 新增车厢结构或障碍：在 `buildTrain()` 添加 variant 分支，同时向 `obstacles` 注册碰撞圆。
- 新增人物职业、肤色、服装、体型或怪兽：扩展 `src/game/models.ts` 的 `CharacterStyle`、色盘、`passengerStyle()` 与 `monsterStyle()`。
- 换漫画色盘、排版、网点、按钮或响应式断点：修改 `src/app.less` 与 `doc/visual.md`。
- 改文案或增加语言：扩展 `src/i18n/index.ts`，保持所有字典键一致。
- 改音效映射：调整 `src/audio/sound.ts` 与 `doc/requirements.md` 的声音参数。
- 改排行榜或通知：修改 `src/shared/leaderboard/` 与 `src/App.tsx` 的结算提交段，不得更换 UUID 或复用其他游戏的 key。
- 改发布信息或封面：修改 `meta.json`、`public/poster.png`，并同名覆盖 games repo 的 `posters/get-off-the-train.png`。
