# 《挤下地铁》技术文档

## 1. 技术栈

- React 18 + TypeScript 5：游戏外壳、屏幕状态、HUD、虚拟摇杆与结果界面。
- Three.js 0.169 + React Three Fiber：第三人称透视跟随相机、实时 3D 车厢、角色、ACEs 色调映射、动态灯组和阴影。
- Less：美式漫画 UI、粗墨边、硬阴影、网点与响应式布局。
- Web Audio API：用户首次操作后创建振荡器，合成碰撞、晃动、摔倒、过关和失败声音。
- Vite 5：`base: './'` 的可移植构建，产物输出到 `dist/`，可部署在任意子路径。
- 浏览器 API：Pointer Events、Keyboard Events、Page Visibility、`prefers-reduced-motion` 和 localStorage。

## 2. 目录结构

- `src/App.tsx`：四态无限流程、场景内待操作子状态、关卡推进、累计得分、排行榜提交、破纪录通知、暂停恢复与全局输入。
- `src/game/TrainScene.tsx`：车厢建模、动态灯组、人物生成、主循环、碰撞、晃动、摔倒、出口判定和 HUD 采样。
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

3D Canvas 全屏响应式，55° 透视相机位置为 `(player.x-5.2, 5.35, player.z*0.35)`，视点为 `(player.x+4.8, 0.85, player.z*0.35)`；位置与视点共享相同 `z`，因此水平观察方向严格为世界 `+X`，只增加纵向俯角而不存在侧向透视。出口位于末段右侧壁 `x=6.20,z=2.90`，正前端墙封闭；HUD 出口提示位于右上，地面箭头先沿 `+X` 再折向 `+Z`。HUD 和普通 DOM 按 320×568–430×932 内部重排，不依赖整页 transform。全屏输入面在每次 `pointerdown` 记录落指原点并显示 108 px 动态摇杆；屏幕向上固定映射 `+X`，左右固定映射 `±Z`。WASD / 方向键共用同一输入引用。

### 碰撞、晃动与更新

人物采用二维圆形刚体近似，保留 3D 视觉旋转。每帧限制 `dt<=33ms`，先处理主动速度和阻尼，再处理边界/立柱/行李静态碰撞，最后执行人物两两穿透分离和 35% 法向动量交换。玩家质量为 1.28，保证能推开普通乘客但仍会受宽体乘客和晃动影响。玩家中心进入“门半宽 + 65% 碰撞半径”的侧门引导区后，`z` 上限从车厢右壁放宽到门外 `3.68`；越过 `z=3.26` 且中心位于“门半宽 + 0.4”内即结算。稍宽于视觉门框的容错避免拥挤碰撞把玩家夹在门槛。周期晃动在预警窗口驱动吊环摆动，接触帧向所有人物施加横向冲量；失衡值超过个人稳定阈值时进入倒地、滑动、起身和短保护阶段。玩家松手 180 ms 后进入站稳状态，失衡降低 32%。

每个人物的 `phase` 同时驱动待机呼吸与步伐弹跳：站立高度用 `abs(sin(time*3.2+phase))` 生成，主角振幅 0.075、其他人物 0.045；速度大于 0 时叠加最高 0.065 的 7 Hz 步伐高度。普通角色的 rig 同步加入手臂备战抬起和腿部轻交替，幽灵等无 rig 怪物仍保留整体上下起伏。摔倒分支把两种弹跳清零，减弱动态模式把振幅降至 35%。

### 场景照明与主角识别

Canvas 使用 ACES Filmic 色调映射和 1.05 曝光，基础半球光强度 0.78、暖主光 1.72、冷轮廓填光 0.68。`buildTrain()` 在车体节点内生成 5 组暖白 PointLight 和可见灯管，因此光源会与车厢一起滚转；灯组基准强度 1.05、照射半径 5.8，每帧以 0.72 Hz 缓慢调整灯强，其中一盏松动灯增加 2.15 Hz 起伏，冲击峰值按灯位短暂降至 38%。玩家模型关闭 `makeCharacter()` 的外描边分支，自带 2.35 强度、4.2 world-unit 半径的暖色 PointLight，并叠加一个关闭深度写入的加法混合光环；局部光会照亮地板和身边乘客，DOM 的“你 / YOU”标签作为远距离和遮挡情况下的第二识别通道。

### 音频、多语言、排行榜与通知

音效使用短振荡器包络，不加载远程音频；碰撞按 80 ms 限流。所有关键 UI 文案从 `src/i18n/index.ts` 读取。最高总分使用专属 localStorage key `get-off-the-train.best.v1`，并在失败时通过永久 UUID `7cc693d3-6ca5-414e-8dbe-7fb66de752f2` 提交平台 best-score 排行榜。平台内其他玩家的头像姓名调用 `openAigramProfile()`；破纪录时只对一位本次刚超过的真实玩家发送 `score_beat` 事件。平台外不展示虚构排名，改为进入 AlterU 的明确 CTA。

## 4. 扩展点

- 调整关卡时间、人数、晃动周期和冲量：修改 `src/game/types.ts` 的 `LEVELS` 与 `getLevelConfig()` 封顶公式。
- 改碰撞、速度、倒地或出口公式：修改 `src/game/TrainScene.tsx` 的 `useFrame` 更新段。
- 新增车厢结构或障碍：在 `buildTrain()` 添加 variant 分支，同时向 `obstacles` 注册碰撞圆。
- 新增人物职业、肤色、服装、体型或怪兽：扩展 `src/game/models.ts` 的 `CharacterStyle`、色盘、`passengerStyle()` 与 `monsterStyle()`。
- 换漫画界面的色盘、排版、网点、按钮或响应式断点：修改 `src/app.less` 与 `doc/visual.md`；不要同步给 3D 场景套漫画滤镜。
- 调整车厢明暗、灯光呼吸、冲击闪烁或主角光环：修改 `src/game/TrainScene.tsx` 与 `src/game/models.ts` 的灯光参数。
- 改文案或增加语言：扩展 `src/i18n/index.ts`，保持所有字典键一致。
- 改音效映射：调整 `src/audio/sound.ts` 与 `doc/requirements.md` 的声音参数。
- 改排行榜或通知：修改 `src/shared/leaderboard/` 与 `src/App.tsx` 的结算提交段，不得更换 UUID 或复用其他游戏的 key。
- 改发布信息或封面：修改 `meta.json`、`public/poster.png`，并同名覆盖 games repo 的 `posters/get-off-the-train.png`。
