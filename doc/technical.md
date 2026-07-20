# 《挤下地铁》技术文档

## 1. 技术栈

- React 18 + TypeScript 5：游戏外壳、屏幕状态、HUD、虚拟摇杆、结果界面与角色收藏商店。
- Three.js 0.169 + React Three Fiber：第三人称透视跟随相机、PBR 车厢表面、低多边形角色、ACEs 色调映射、动态灯组和阴影。
- Less：《Block Hop / 跳一跳》式奶油胶囊 UI、圆润字形、小硬影与响应式布局。
- Web Audio API：用户首次操作后创建振荡器，合成碰撞、晃动、摔倒、过关和失败声音。
- Vite 5：`base: './'` 的可移植构建，产物输出到 `dist/`，可部署在任意子路径。
- 浏览器与平台 API：Pointer Events、Keyboard Events、Page Visibility、`prefers-reduced-motion`、localStorage 与 Aigram session-scoped 云存档。

## 2. 目录结构

- `src/App.tsx`：四态无限流程、稳定关卡配置、金币奖励、角色收藏镜像状态、排行榜提交、破纪录通知、暂停恢复与全局输入。
- `src/game/TrainScene.tsx`：车厢建模、动态灯组、人物生成、主循环、碰撞、晃动、摔倒、出口判定和 HUD 采样。
- `src/game/models.ts`：角色色盘与材质、10 名可选主角、猫狗四足 rig、人物分段骨架、16 种职业乘客、6 种怪物及阅读/电话/吊环姿态工厂。
- `src/game/types.ts`：状态类型、前 5 关数值表、无限难度公式与按关卡编号缓存。
- `src/ui/Joystick.tsx`：全场景 Pointer Capture 动态摇杆、按帧合并视图更新、首次输入启动和循环虚拟拇指引导。
- `src/ui/Icons.tsx`：统一 24×24 墨线 SVG 图标家族。
- `src/ui/CollectionShop.tsx`：单 Canvas 的三角色 3D 轮播舞台、金币余额、循环切换、购买/装备/不足状态。
- `src/audio/sound.ts`：限流的合成音效与静音状态。
- `src/i18n/index.ts`：按 `game_locale` / 浏览器语言切换 zh/en 的轻量双语字典。
- `src/game-id.ts`：由平台脚本注入的永久 UUID，全局写入 `window.__GAME_UUID__`。
- `src/shared/leaderboard/`：平台最高分 hook 与符合头像/姓名规则的奶油圆角排行榜。
- `src/shared/runtime/`：Aigram bridge、永久 UUID、事件与通知调用所需的最小运行时。
- `src/shared/save/`：角色收藏的 localStorage 即时写入与 1 秒防抖平台云同步。
- `src/app.less`：奶油胶囊视觉 token、HUD、圆角覆盖层、摇杆、窄屏与减弱动态规则。
- `doc/requirements.md` / `doc/visual.md`：玩法蓝图与最终视觉合同。
- `scripts/generate_poster.py`：调用 Aigram transit 生成叙事海报，并在顶部安全区叠加确定性标题。

## 3. 核心模块

### 状态管理与主循环

`App.tsx` 维护 `playing / paused / level-clear / game-over`，并用 `runStarted` 区分“真实场景已显示但等待首次输入”和计时中的游戏。首次触摸或方向键输入才解锁声音、记录赛前最高分并启动倒计时；虚拟拇指只是 DOM 演示，不写入物理、分数或平台事件。前 5 关读取手工配置，之后由 `getLevelConfig()` 按封顶公式生成并缓存在 `endlessCache`；`App` 还用 `useMemo([level])` 固定当前配置，避免 80 ms HUD 更新改变引用并重建世界。每关用 `level` 作为 `TrainScene` key，确保只有关卡变化才独立重建物理实体和计时器。高频位置、速度、倒地计时和晃动阶段留在 `useRef`，由 `useFrame` 更新；HUD 以 80 ms 间隔采样。暂停、过关、失败、排行榜与角色收藏共用奶油圆角卡、圆润系统字体、2.5–4 px 柔墨边和 3–6 px 小硬影。

每次过关由 `App` 计算 `30 + min(level+1,10)×5 + 零摔倒10` 金币。`useGameSave<CollectionSave>()` 只负责首次加载与写入；`collectionMirror` 从 `savedData` 一次性播种，之后所有余额、解锁与装备的读改写都经过同一 mirror，再调用 `persist()` 作为副作用，避免第二次购买读取旧 `savedData` 覆盖第一次购买。存档包含 `coins / unlocked / selected` 全字段；本地同步写入，Aigram 云端按永久 UUID 防抖同步。商店入口在完整 click 后延迟一个任务挂载，杜绝松手穿透；轮播只创建一个 Canvas，并按当前索引同时生成上一名、当前与下一名三个真实模型，中央模型以 1.72 倍舞台缩放持续呼吸/转身，两侧以 0.92 倍缩放提供视觉预告。左右 SVG 箭头与键盘方向键循环修改 `previewHero`，购买/装备按钮只作用于中央角色。切换角色时 `TrainScene` 只替换现有玩家的 `group` 并复制位置、旋转和可见性，不重置当前关卡物理进度。

### 屏幕适配与输入

3D Canvas 全屏响应式，55° 透视相机位置为 `(player.x-5.2, 6.05, player.z*0.35)`，视点为 `(player.x+4.8, 0.70, player.z*0.35)`；位置与视点共享相同 `z`，因此水平观察方向严格为世界 `+X`，只增加纵向俯角而不存在侧向透视。两扇候选出口位于末段 `x=6.20` 的左右侧壁，正前端墙封闭；首关开启右侧，此后由 `level % 2` 确定性交替。世界空间 3D 箭头和地面路径根据 `exitSide` 转向，不再使用 DOM 出口标签。HUD 和普通 DOM 按 320×568–430×932 内部重排，不依赖整页 transform。全屏输入面生成 120 px 动态摇杆；60 px 半径内保留触点方向，超过 0.1 死区后在物理层归一化为全速方向，屏幕向上固定映射 `+X`，左右固定映射 `±Z`。WASD / 方向键共用同一输入引用。

### 碰撞、晃动与更新

人物采用二维圆形刚体近似，保留 3D 视觉旋转。每帧限制 `dt<=33ms`，先处理主动速度和阻尼，再处理边界/立柱/行李静态碰撞，最后执行人物两两穿透分离和 35% 法向动量交换。玩家质量为 1.28，保证能推开普通乘客但仍会受宽体乘客和晃动影响。只有 `exitSide` 指向的绿色开门侧会在玩家进入“门半宽 + 65% 碰撞半径”的引导区后放宽对应 `z` 边界，并在越过门外阈值且中心位于“门半宽 + 0.4”内时结算；红灯闭门侧始终使用车厢墙边界，因此不可穿越。稍宽于视觉门框的容错避免拥挤碰撞把玩家夹在门槛。周期晃动在预警窗口驱动吊环摆动，接触帧向所有人物施加横向冲量；失衡值超过个人稳定阈值时进入倒地、滑动、起身和短保护阶段。玩家松手 180 ms 后进入站稳状态，失衡降低 32%。

`buildTrain()` 根据每段长椅长度以 0.72–0.96 world-unit 间距生成 `seatSlots`，保存座位中心与面向通道的 yaw；同时沿每段长椅前沿以 0.32 world-unit 间隔注册半径 0.17 的重叠静态碰撞圆，形成覆盖空座位与座椅缝隙的连续碰撞带。玩家半径 0.22，因此不能从相邻碰撞圆之间穿入长椅。关卡初始化时确定性随机留出 1–2 个空槽，其余从 `PROFESSION_KINDS` 选择职业并用 `makeSeatedProfessionPassenger()` 填满；函数把髋部对齐到 `y=0.75` 座面，大腿局部 `rotation.x=-π/2` 水平朝通道，小腿用 `+π/2` 抵消父级旋转并沿局部 y 拉长 1.92 倍，使鞋落到地面；鞋组向前移 0.16 并把深度放大 1.35 倍，确保鞋尖伸出坐垫。每个坐席以 `seated / preparing / rising / departed` 状态机更新：默认在面朝方向 0.52 world-unit 处注册半径 0.18 的静态膝脚碰撞；被选中的 1–3 名下车者在确定性时间点进入 0.72 秒准备和 0.58 秒起身插值，活动道具同步缩小并隐藏，根节点从座位滑到 `|z|=1.40`。跨入通道后取消膝脚碰撞、恢复站立骨架比例，并以 `exiting` 行为加入动态 `Body` 数组；它先沿 `+X` 移动到 `x≈6.1`，再转向 `exitSide` 对应的本关绿灯侧门，参与普通碰撞、步态、晃动和摔倒。越过门外后标记 `departed` 并从渲染与碰撞循环跳过。

配置乘客数现在直接表示通道站立人数，前 5 关为 9 / 12 / 14 / 16 / 18，第 6 关起封顶 20。初始化时先分出 `clamp(round(n×16%),2,4)` 名 `wandering` 乘客，其余标记为 `stationary`：换位者从中央通道出发，在前后 1.2–2.8、横向不超过 0.8 world-unit 的范围内反复选点，以 0.28–0.44 world-unit/s 移动，每次抵达停留 1.6–4.0 秒；静止者在座椅前、立柱或吊环下采样并面向通道。静止者按确定性比例得到单手吊环、阅读、通话、看手机或自然站姿，活动写入 `group.userData.activity`，主循环把上臂、前臂、头部和上身平滑插值到各自目标关节角；吊环乘客还会对齐实际吊带 x 坐标。玩家推挤、车辆冲量和摔倒仍可让任何站立者被动物理位移。碰撞法向速度超过 0.55 时，根据关卡概率、门区压力、当前晃动余量和撞击速度决定是否 `knockDown(..., 'forward')`。摔倒状态记录 `fallStarted / fallDuration / fallKind`；世界空间的 `group` 只负责位置、碰撞和局部灯，永远不旋转，内部 `pose` 以脚底为枢轴，`upperBody` 以髋部为枢轴，`head` 以颈部为枢轴，上臂、前臂、手掌、大腿与小腿为嵌套关节。原始归一化时间 `rawP` 被分段重映射：前 46% 物理时间推进到姿态 0.58，接着 9% 推进到 0.68，最后 45% 完成剩余恢复；`key()` 在 11 个姿态节点间使用 Catmull–Rom 三次插值。人形玩家使用完整关节曲线；猫狗把前后肢映射到相同 rig 键，复用步态与侧摔时序。所有人物外层视觉缩放为 0.58，猫狗保持更低更长的自然轮廓；玩家与普通乘客碰撞半径均为 0.22。主角不创建任何 Torus 脚底环，只保留红色通勤识别件与随身柔边 SpotLight 光域。

站立人物的 `phase` 驱动错开的待机呼吸，主角振幅 0.052、站立乘客 0.032；默认静止者不累计步态。只有玩家、少量 `wandering` 乘客或碰撞造成的实际位移会累计 `gaitPhase`：主角每 1.05 world-unit、乘客每 0.58 world-unit 完成一轮左右脚。腿从髋部枢轴交替摆动和抬起，骨盆轻微扭转，上身反向补偿，手臂与对侧腿反摆；停止后平滑收腿。静止者在同一段关节更新中叠加吊环、阅读、通话与看手机目标角度，保留 2°–5° 的错相微动。坐席乘客使用独立的低幅胸口呼吸，不套用站立弹跳。摔倒分支将步态与呼吸清零，减弱动态模式把振幅降至 35%。

### 场景照明与主角识别

Canvas 使用 ACES Filmic 色调映射和 0.96 曝光，基础半球光强度 0.36、暖主光 1.05、冷轮廓填光 0.28。`models.ts` 保留 `toon()` 函数名以避免改写所有模型工厂，但其实际返回与共享《Block Party》角色一致的 `MeshStandardMaterial`：`roughness=0.88 / metalness=0 / flatShading=true / emissive=0`，透明怪物另关闭深度写入；狼人耳朵等残留 outline shell 已移除。`buildTrain(config, exitSide)` 仍把车厢节点内的 StandardMaterial按金属/塑料规则重新实例化，只有显式标记 `userData.guide=true` 的地面箭头才获得 0.22 弱自发光，普通黄色吊环、广告和门槛不再误发光。正确侧的状态灯与绿色 3D 箭头继续使用功能性 emissive。5 组暖白 PointLight 随车厢滚转；所有可选玩家模型携带一个局部 SpotLight 与同组 target：光源位于 `(0,3.8,-0.18)`，目标位于 `(0,0.05,0.22)`，参数为 `intensity=8.5 / distance=5.2 / angle=0.88 / penumbra=0.80 / decay=1.45`。因为光源与 target 都是玩家 group 子节点，人物移动、碰撞和换装后光域都会同步跟随；高位柔边顶光在地面形成约 3.2–3.8 world-unit 的暖色光团，同时保留人物侧暗面。角色商店在创建预览模型后隐藏所有 `THREE.Light`，仅使用 0.32 半球光、1.35 暖主光和 0.38 冷填光的统一摄影棚灯组，因此三个轮播角色不会互相补光。界面和场景不绘制玩家脚底圈、固定头顶标签、二维出口标签或站稳徽章。

### 音频、多语言、排行榜与通知

音效使用短振荡器包络，不加载远程音频；碰撞按 80 ms 限流。所有关键 UI 文案从 `src/i18n/index.ts` 读取。最高总分使用专属 localStorage key `get-off-the-train.best.v1`，并在失败时通过永久 UUID `7cc693d3-6ca5-414e-8dbe-7fb66de752f2` 提交平台 best-score 排行榜。平台内其他玩家的头像姓名调用 `openAigramProfile()`；破纪录时只对一位本次刚超过的真实玩家发送 `score_beat` 事件。平台外不展示虚构排名，改为进入 AlterU 的明确 CTA。

## 4. 扩展点

- 调整关卡时间、人数、晃动周期和冲量：修改 `src/game/types.ts` 的 `LEVELS` 与 `getLevelConfig()` 封顶公式。
- 改碰撞、速度、倒地或出口公式：修改 `src/game/TrainScene.tsx` 的 `useFrame` 更新段。
- 新增车厢结构或障碍：在 `buildTrain()` 添加 variant 分支，同时向 `obstacles` 注册碰撞圆。
- 新增人物职业、肤色、服装、体型、生活姿态或怪兽：扩展 `src/game/models.ts` 的 `PROFESSION_KINDS`、`professionStyles`、`makeProfessionPassenger()`、`applyPassengerActivity()` 与怪物工厂。
- 新增可收藏主角、动物或调整价格：扩展 `src/game/models.ts` 的 `HeroId / HERO_IDS / HERO_COSTS / makePlayer()`，同步 `src/i18n/index.ts` 名称；角色必须暴露兼容 `CharacterRig`，并在 `CollectionShop` 真实预览。
- 调整坐席起身人数、触发时间、准备/起身时长或下车速度：修改 `src/game/TrainScene.tsx` 中 `riserCount`、`scheduledAt`、`preparing / rising` 状态机和 `exiting` 行为参数，同时同步 `doc/requirements.md`。
- 调整左右开门规律、红绿门灯、世界空间 3D 箭头或门槛碰撞：修改 `src/game/TrainScene.tsx` 的 `exitSide`、`buildTrain(config, exitSide)` 与侧边界/过关判定，同时同步 `doc/requirements.md` 和 `doc/visual.md`。
- 换奶油胶囊界面的色盘、圆润排版、按钮或响应式断点：修改 `src/app.less` 与 `doc/visual.md`；不要同步给 3D 场景套平面滤镜。
- 调整车厢明暗、灯光呼吸、冲击闪烁或主角随身光：修改 `src/game/TrainScene.tsx` 与 `src/game/models.ts` 的灯光参数；不要恢复脚底 Torus。
- 调整金币公式、购买/装备流程或存档字段：修改 `src/App.tsx` 的 `CollectionSave / collectionMirror` 与 `src/shared/save/`，所有读改写必须继续基于 mirror 而不是 `savedData`。
- 改文案或增加语言：扩展 `src/i18n/index.ts`，保持所有字典键一致。
- 改音效映射：调整 `src/audio/sound.ts` 与 `doc/requirements.md` 的声音参数。
- 改排行榜或通知：修改 `src/shared/leaderboard/` 与 `src/App.tsx` 的结算提交段，不得更换 UUID 或复用其他游戏的 key。
- 改发布信息或封面：修改 `meta.json`、`public/poster.png`，并同名覆盖 games repo 的 `posters/get-off-the-train.png`。
