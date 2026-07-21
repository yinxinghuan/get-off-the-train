export type Phase = 'playing' | 'paused' | 'level-clear' | 'fail-cinematic' | 'game-over'

export interface InputVector { x: number; z: number }

export interface HudState {
  timeLeft: number
  distance: number
  falls: number
  braced: boolean
  swayWarning: boolean
  swayDirection: -1 | 1
}

export type StationEvent = 'normal' | 'police' | 'pig' | 'zombie' | 'inflow' | 'all-exit' | 'rescue' | 'construction-shift' | 'office-evac' | 'haunted' | 'animal-rescue' | 'robot-expo' | 'afterparty' | 'blackout' | 'red-alert' | 'nurse-train' | 'firefighter-train' | 'cleaner-train' | 'executive-train' | 'student-train' | 'chef-train' | 'security-train' | 'undead-duo' | 'night-creatures' | 'farm-duo' | 'cowboy-viking' | 'courier-rush' | 'rough-section' | 'leak-night' | 'fog-night'

export interface LevelConfig {
  name: string
  subtitle: string
  time: number
  passengers: number
  swayPeriod: number
  warning: number
  impulse: number
  roll: number
  wander: number
  fallChance: number
  swayFallChance: number
  variant: 'commuter' | 'long-seat' | 'ad-wrap' | 'narrow-door' | 'maintenance'
  stationEvent: StationEvent
  boardingCount: number
  alightingCount: number
}

export const LEVELS: LevelConfig[] = [
  { name: '普通早班', subtitle: '先看懂人群，再找缝前进', time: 18, passengers: 9, swayPeriod: 6.8, warning: 1.15, impulse: 2.0, roll: 2.2, wander: 0.55, fallChance: 0.08, swayFallChance: 0.12, variant: 'commuter', stationEvent: 'normal', boardingCount: 0, alightingCount: 2 },
  { name: '纵座快线', subtitle: '有人下车，也有人刚上来', time: 17, passengers: 12, swayPeriod: 6.1, warning: 1.0, impulse: 2.35, roll: 2.7, wander: 0.66, fallChance: 0.11, swayFallChance: 0.16, variant: 'long-seat', stationEvent: 'normal', boardingCount: 2, alightingCount: 3 },
  { name: '广告包车', subtitle: '上下车客流开始打乱通道', time: 16, passengers: 14, swayPeriod: 5.5, warning: 0.85, impulse: 2.7, roll: 3.2, wander: 0.78, fallChance: 0.14, swayFallChance: 0.21, variant: 'ad-wrap', stationEvent: 'normal', boardingCount: 1, alightingCount: 4 },
  { name: '老式窄门', subtitle: '门口横穿最频繁', time: 15, passengers: 16, swayPeriod: 4.9, warning: 0.72, impulse: 3.05, roll: 3.8, wander: 0.90, fallChance: 0.17, swayFallChance: 0.26, variant: 'narrow-door', stationEvent: 'normal', boardingCount: 3, alightingCount: 5 },
  { name: '末班施工车', subtitle: '强晃动更容易摔倒', time: 14, passengers: 18, swayPeriod: 4.4, warning: 0.62, impulse: 3.4, roll: 4.4, wander: 1.0, fallChance: 0.20, swayFallChance: 0.31, variant: 'maintenance', stationEvent: 'normal', boardingCount: 2, alightingCount: 6 },
]

const ENDLESS_NAMES = ['怪物早班', '幽灵换乘', '失控区间', '终点不存在']
const ENDLESS_SUBTITLES = ['怪物乘客开始抢吊环', '人群更轻，也更容易滑倒', '预警继续缩短', '只要没迟到，就继续挤']
const endlessCache = new Map<number, LevelConfig>()
type SpecialStationEvent = Exclude<StationEvent, 'normal'>
const SPECIAL_EVENTS: SpecialStationEvent[] = [
  'police', 'pig', 'zombie', 'inflow', 'all-exit', 'rescue', 'construction-shift', 'office-evac', 'haunted',
  'animal-rescue', 'robot-expo', 'afterparty', 'blackout', 'red-alert', 'nurse-train', 'firefighter-train',
  'cleaner-train', 'executive-train', 'student-train', 'chef-train', 'security-train', 'undead-duo',
  'night-creatures', 'farm-duo', 'cowboy-viking', 'courier-rush', 'rough-section', 'leak-night', 'fog-night',
]
const SPECIAL_COPY: Record<SpecialStationEvent, { name: string; subtitle: string }> = {
  police: { name: '警察专列', subtitle: '前一站似乎刚封锁过什么' },
  pig: { name: '猪猪专列', subtitle: '农场观光团好像坐错了车' },
  zombie: { name: '丧尸末班车', subtitle: '上一站的灯好像灭过一次' },
  inflow: { name: '持续上客', subtitle: '绿门不断涌入逆向人流' },
  'all-exit': { name: '全员下车', subtitle: '所有人都在抢着下车' },
  rescue: { name: '救援队专列', subtitle: '前方事故刚解除，救援队正在返程' },
  'construction-shift': { name: '施工队专列', subtitle: '隧道夜班刚收工，工具还没放稳' },
  'office-evac': { name: '高管专列', subtitle: '附近大楼刚响过警报' },
  haunted: { name: '幽灵骷髅专列', subtitle: '午夜活动刚刚散场' },
  'animal-rescue': { name: '猫狗专列', subtitle: '救助站今晚临时搬家' },
  'robot-expo': { name: '机器人专列', subtitle: '会展中心刚刚清场' },
  afterparty: { name: '朋克说唱专列', subtitle: '地下演出刚散场，大家还没醒' },
  blackout: { name: '停电区间', subtitle: '隧道供电中断，只剩一盏灯还亮着' },
  'red-alert': { name: '红色警报', subtitle: '广播没有解释原因，整节车厢突然变红' },
  'nurse-train': { name: '护士专列', subtitle: '医院夜班刚刚交接' },
  'firefighter-train': { name: '消防员专列', subtitle: '他们刚从一次出勤回来' },
  'cleaner-train': { name: '清洁工专列', subtitle: '这趟车似乎提前开始保洁' },
  'executive-train': { name: '高管包车', subtitle: '董事会散场得比地铁还晚' },
  'student-train': { name: '学生专列', subtitle: '补习班刚刚统一下课' },
  'chef-train': { name: '厨师专列', subtitle: '附近餐厅同时结束了晚班' },
  'security-train': { name: '保安专列', subtitle: '会展中心正在集体换岗' },
  'undead-duo': { name: '骷髅木乃伊专列', subtitle: '博物馆的夜班似乎不太寻常' },
  'night-creatures': { name: '吸血鬼狼人专列', subtitle: '今晚的月亮好像格外圆' },
  'farm-duo': { name: '牛羊专列', subtitle: '郊外牧场临时借用了车厢' },
  'cowboy-viking': { name: '牛仔维京专列', subtitle: '历史主题演出刚刚结束' },
  'courier-rush': { name: '快递专列', subtitle: '最后一批包裹终于送完了' },
  'rough-section': { name: '台风之夜', subtitle: '风雨让前方轨道持续晃动' },
  'leak-night': { name: '漏雨之夜', subtitle: '车顶开始滴水，小心脚下积水' },
  'fog-night': { name: '雾夜末班车', subtitle: '远处车门正在雾里忽隐忽现' },
}

export function getLevelConfig(index: number): LevelConfig {
  if (LEVELS[index]) return LEVELS[index]
  const cached = endlessCache.get(index)
  if (cached) return cached
  const extra = index - LEVELS.length
  const specialOrdinal = extra % 2 === 0 ? Math.floor(extra / 2) : -1
  const specialIndex = specialOrdinal < 0 ? -1 : (specialOrdinal * 7 + Math.floor(specialOrdinal / SPECIAL_EVENTS.length) * 11) % SPECIAL_EVENTS.length
  const stationEvent: StationEvent = specialIndex >= 0 ? SPECIAL_EVENTS[specialIndex] : 'normal'
  const specialCopy = stationEvent === 'normal' ? null : SPECIAL_COPY[stationEvent]
  const basePassengers = Math.min(20, 19 + Math.floor(extra / 3))
  const flowTier = Math.floor(extra / 5)
  const normalBoarding = Math.min(7, 2 + flowTier + (index * 7 % 3))
  const normalAlighting = Math.min(12, 5 + flowTier * 2 + (index * 5 % 3))
  const storyBoarding = Math.min(7, 3 + flowTier + (index % 2))
  const storyAlighting = Math.min(12, 6 + flowTier * 2 + ((index + 1) % 3))
  const config: LevelConfig = {
    name: specialCopy ? `第 ${index + 1} 节 · ${specialCopy.name}` : `第 ${index + 1} 节 · ${ENDLESS_NAMES[extra % ENDLESS_NAMES.length]}`,
    subtitle: specialCopy?.subtitle ?? ENDLESS_SUBTITLES[extra % ENDLESS_SUBTITLES.length],
    time: stationEvent === 'all-exit' ? 18 : stationEvent !== 'normal' ? 17 : Math.max(10, 14 - Math.floor(extra / 5) * 0.5),
    passengers: stationEvent === 'inflow' ? 10 : stationEvent === 'pig' ? Math.min(16, basePassengers) : basePassengers,
    swayPeriod: Math.max(2.65, 4.25 - extra * 0.13) * (stationEvent === 'rough-section' ? 0.65 : 1),
    warning: Math.max(0.36, 0.60 - extra * 0.020),
    impulse: Math.min(4.8, 3.55 + extra * 0.10),
    roll: Math.min(6.5, 4.6 + extra * 0.13),
    wander: Math.min(1.28, 1.02 + extra * 0.025),
    fallChance: Math.min(0.32, 0.21 + extra * 0.012),
    swayFallChance: Math.min(0.46, 0.32 + extra * 0.014),
    variant: (['maintenance', 'ad-wrap', 'narrow-door', 'long-seat'] as const)[extra % 4],
    stationEvent,
    boardingCount: stationEvent === 'all-exit' ? 0 : stationEvent === 'inflow' ? Math.min(14, 10 + flowTier) : stationEvent === 'normal' ? normalBoarding : storyBoarding,
    alightingCount: stationEvent === 'all-exit' ? 99 : stationEvent === 'inflow' ? Math.min(8, 5 + flowTier) : stationEvent === 'normal' ? normalAlighting : storyAlighting,
  }
  endlessCache.set(index, config)
  return config
}
