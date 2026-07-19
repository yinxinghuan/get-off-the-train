# 《挤下地铁》技术文档

## 1. 技术栈

- React 18 + TypeScript 5：游戏外壳、屏幕状态、HUD、虚拟摇杆与结果界面。
- Three.js 0.169 + React Three Fiber：第三人称透视跟随相机、PBR 车厢表面、低多边形角色、ACEs 色调映射、动态灯组和阴影。
- Less：美式漫画 UI、粗墨边、硬阴影、网点与响应式布局。
- Web Audio API：用户首次操作后创建振荡器，合成碰撞、晃动、摔倒、过关和失败声音。
- Vite 5：`base: './'` 的可移植构建，产物输出到 `dist/`，可部署在任意子路径。
- 浏览器 API：Pointer Events、Keyboard Events、Page Visibility、`prefers-reduced-motion` 和 localStorage。

## 2. 目录结构

- `src/App.tsx`：四态无限流程、场景内待操作子状态、关卡推进、累计得分、排行榜提交、破纪录通知、暂停恢复与全局输入。
- `src/game/TrainScene.tsx`：车厢建模、动态灯组、人物生成、主循环、碰撞、晃动、摔倒、出口判定和 HUD 采样。
- `src/game/models.ts`：角色色盘与材质、几何图元、人物比例、地面锚点 / 髋部 / 上身 / 四肢分层 rig、髋部枢轴腿和乘客外形 roster。
- `src/game/types.ts`：状态类型、前 5 关数值表与后续无限难度公式。
- `src/ui/Joystick.tsx`：全场景 Pointer Capture 动态摇杆、按帧合并视图更新、首次输入启动和循环虚拟拇指引导。
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

`App.tsx` 维护 `playing / paused / level-clear / game-over`，并用 `runStarted` 区分“真实场景已显示但等待首次输入”和计时中的游戏。首次触摸或方向键输入才解锁声音、记录赛前最高分并启动倒计时；虚拟拇指只是 DOM 演示，不写入物理、分数或平台事件。前 5 关读取手工配置，之后由 `getLevelConfig()` 按封顶公式持续生成，挑战只有失败终点。每关用 `level` 作为 `TrainScene` key，确保所有物理实体和计时器独立重建。高频位置、速度、倒地计时和晃动阶段都留在 `useRef` 中，由 `useFrame` 更新；HUD 以 80 ms 间隔采样，避免逐帧 React 重渲染。

### 屏幕适配与输入

3D Canvas 全屏响应式，55° 透视相机位置为 `(player.x-5.2, 6.05, player.z*0.35)`，视点为 `(player.x+4.8, 0.70, player.z*0.35)`；位置与视点共享相同 `z`，因此水平观察方向严格为世界 `+X`，只增加纵向俯角而不存在侧向透视。出口位于末段右侧壁 `x=6.20,z=2.90`，正前端墙封闭；HUD 出口提示位于右上，地面箭头先沿 `+X` 再折向 `+Z`。HUD 和普通 DOM 按 320×568–430×932 内部重排，不依赖整页 transform。全屏输入面生成 120 px 动态摇杆；60 px 半径内保留触点方向，超过 0.1 死区后在物理层归一化为全速方向，屏幕向上固定映射 `+X`，左右固定映射 `±Z`。WASD / 方向键共用同一输入引用。

### 碰撞、晃动与更新

人物采用二维圆形刚体近似，保留 3D 视觉旋转。每帧限制 `dt<=33ms`，先处理主动速度和阻尼，再处理边界/立柱/行李静态碰撞，最后执行人物两两穿透分离和 35% 法向动量交换。玩家质量为 1.28，保证能推开普通乘客但仍会受宽体乘客和晃动影响。玩家中心进入“门半宽 + 65% 碰撞半径”的侧门引导区后，`z` 上限从车厢右壁放宽到门外 `3.68`；越过 `z=3.26` 且中心位于“门半宽 + 0.4”内即结算。稍宽于视觉门框的容错避免拥挤碰撞把玩家夹在门槛。周期晃动在预警窗口驱动吊环摆动，接触帧向所有人物施加横向冲量；失衡值超过个人稳定阈值时进入倒地、滑动、起身和短保护阶段。玩家松手 180 ms 后进入站稳状态，失衡降低 32%。

关卡配置使用 `wander / fallChance / swayFallChance`，使难度由移动干扰和摔倒风险而非人数主导。乘客出生点通过拒绝采样生成：中心三角分布与两侧站立带混合，并检查玩家起点、门槛、立柱及人物间距，因此不再形成规则横排或单点堆积。非玩家每 1.1–2.8 秒围绕 `homeX/homeZ` 选择目标，穿插 28% 的短暂停顿；接近侧门时目标范围和速度逐步扩大，朝向以最短角平滑跟随实际速度。碰撞法向速度超过 0.55 时，根据关卡概率、门区压力、当前晃动余量和撞击速度决定是否 `knockDown(..., 'forward')`。摔倒状态记录 `fallStarted / fallDuration / fallKind`；世界空间的 `group` 只负责位置、碰撞、光环和灯光，永远不旋转，内部 `pose` 以脚底为枢轴，`upperBody` 以髋部为枢轴，四肢独立运动。五段进度驱动失衡、屈膝、前扑、肩部侧撑落地和起身，物理滑动与倒计时继续，主动输入暂停；起身后玩家保护 1.0 秒、乘客保护 0.45 秒，防止单次拥堵造成连续锁死。

每个人物的 `phase` 只驱动错开的待机呼吸，主角振幅 0.052、其他人物 0.032。移动步态使用每帧真实地面位移累计 `gaitPhase`：主角每 1.05 world-unit、乘客每 0.58 world-unit 完成一轮左右脚。腿从髋部枢轴交替摆动和抬起，骨盆轻微扭转，上身反向补偿，手臂与对侧腿反摆；碰撞导致的侧滑同样累计步态，停止后平滑收腿，消除脚停身滑的“滑冰”感。幽灵等无腿 rig 角色保留距离同步的整体起伏。摔倒分支将步态与呼吸清零，减弱动态模式把振幅降至 35%。

### 场景照明与主角识别

Canvas 使用 ACES Filmic 色调映射和 0.96 曝光，基础半球光强度 0.64、暖主光 1.46、冷轮廓填光 0.54。`buildTrain()` 先用程序化几何建立车厢，再隐藏环境 outline shell，并把环境 MeshToonMaterial 转为带粗糙度/金属度的 MeshStandardMaterial；角色材质不受这次环境转换影响。5 组暖白 PointLight 随车厢滚转；侧门另有强度 2.9 的暖黄灯和强度 1.45 的绿色状态灯。玩家模型自带 2.35 强度、4.2 world-unit 半径的暖色 PointLight 和加法混合光环，形成“主角亮区→出口亮区→较暗车厢”的层级；界面不再绘制固定的玩家头顶标签或站稳徽章。

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
