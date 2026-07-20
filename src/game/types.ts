export type Phase = 'playing' | 'paused' | 'level-clear' | 'game-over'

export interface InputVector { x: number; z: number }

export interface HudState {
  timeLeft: number
  distance: number
  falls: number
  braced: boolean
  swayWarning: boolean
  swayDirection: -1 | 1
}

export type StationEvent = 'normal' | 'police' | 'pig' | 'zombie' | 'inflow' | 'all-exit' | 'rescue' | 'construction-shift' | 'office-evac' | 'haunted' | 'animal-rescue' | 'robot-expo' | 'afterparty' | 'blackout' | 'red-alert'

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
  { name: '普通早班', subtitle: '先看懂人群，再找缝前进', time: 28, passengers: 9, swayPeriod: 6.8, warning: 1.15, impulse: 2.0, roll: 2.2, wander: 0.55, fallChance: 0.08, swayFallChance: 0.12, variant: 'commuter', stationEvent: 'normal', boardingCount: 0, alightingCount: 1 },
  { name: '纵座快线', subtitle: '有人下车，也有人刚上来', time: 27, passengers: 12, swayPeriod: 6.1, warning: 1.0, impulse: 2.35, roll: 2.7, wander: 0.66, fallChance: 0.11, swayFallChance: 0.16, variant: 'long-seat', stationEvent: 'normal', boardingCount: 2, alightingCount: 2 },
  { name: '广告包车', subtitle: '上下车客流开始打乱通道', time: 26, passengers: 14, swayPeriod: 5.5, warning: 0.85, impulse: 2.7, roll: 3.2, wander: 0.78, fallChance: 0.14, swayFallChance: 0.21, variant: 'ad-wrap', stationEvent: 'normal', boardingCount: 1, alightingCount: 3 },
  { name: '老式窄门', subtitle: '门口横穿最频繁', time: 25, passengers: 16, swayPeriod: 4.9, warning: 0.72, impulse: 3.05, roll: 3.8, wander: 0.90, fallChance: 0.17, swayFallChance: 0.26, variant: 'narrow-door', stationEvent: 'normal', boardingCount: 3, alightingCount: 2 },
  { name: '末班施工车', subtitle: '强晃动更容易摔倒', time: 24, passengers: 18, swayPeriod: 4.4, warning: 0.62, impulse: 3.4, roll: 4.4, wander: 1.0, fallChance: 0.20, swayFallChance: 0.31, variant: 'maintenance', stationEvent: 'normal', boardingCount: 2, alightingCount: 3 },
]

const ENDLESS_NAMES = ['怪物早班', '幽灵换乘', '失控区间', '终点不存在']
const ENDLESS_SUBTITLES = ['怪物乘客开始抢吊环', '人群更轻，也更容易滑倒', '预警继续缩短', '只要没迟到，就继续挤']
const endlessCache = new Map<number, LevelConfig>()
const SPECIAL_EVENTS: StationEvent[] = ['police', 'pig', 'zombie', 'inflow', 'all-exit', 'rescue', 'construction-shift', 'office-evac', 'haunted', 'animal-rescue', 'robot-expo', 'afterparty', 'blackout', 'red-alert']

export function getLevelConfig(index: number): LevelConfig {
  if (LEVELS[index]) return LEVELS[index]
  const cached = endlessCache.get(index)
  if (cached) return cached
  const extra = index - LEVELS.length
  const specialSlot = extra % 3 === 0 ? Math.floor(extra / 3) : -1
  const stationEvent = specialSlot >= 0 ? SPECIAL_EVENTS[specialSlot % SPECIAL_EVENTS.length] : 'normal'
  const specialName = stationEvent === 'police' ? '警察专列'
    : stationEvent === 'pig' ? '猪猪专列'
      : stationEvent === 'zombie' ? '丧尸末班车'
        : stationEvent === 'inflow' ? '持续上客'
          : stationEvent === 'all-exit' ? '全员下车'
            : stationEvent === 'rescue' ? '救援队返程'
              : stationEvent === 'construction-shift' ? '夜班施工队'
                : stationEvent === 'office-evac' ? '写字楼紧急疏散'
                  : stationEvent === 'haunted' ? '午夜化装舞会'
                    : stationEvent === 'animal-rescue' ? '动物救助转运'
                      : stationEvent === 'robot-expo' ? '机器人展会散场'
                        : stationEvent === 'afterparty' ? '地下派对散场'
                          : stationEvent === 'blackout' ? '停电区间'
                            : stationEvent === 'red-alert' ? '红色警报' : ''
  const basePassengers = Math.min(20, 19 + Math.floor(extra / 3))
  const config: LevelConfig = {
    name: specialName ? `第 ${index + 1} 节 · ${specialName}` : `第 ${index + 1} 节 · ${ENDLESS_NAMES[extra % ENDLESS_NAMES.length]}`,
    subtitle: stationEvent === 'police' ? '前一站似乎刚封锁过什么'
      : stationEvent === 'pig' ? '农场观光团好像坐错了车'
        : stationEvent === 'zombie' ? '上一站的灯好像灭过一次'
            : stationEvent === 'inflow' ? '绿门不断涌入逆向人流'
            : stationEvent === 'all-exit' ? '所有人都在抢着下车'
              : stationEvent === 'rescue' ? '前方事故刚解除，救援队正在返程'
                : stationEvent === 'construction-shift' ? '隧道夜班刚收工，工具还没放稳'
                  : stationEvent === 'office-evac' ? '附近大楼刚响过警报'
                    : stationEvent === 'haunted' ? '午夜活动刚刚散场'
                      : stationEvent === 'animal-rescue' ? '救助站今晚临时搬家'
                        : stationEvent === 'robot-expo' ? '会展中心刚刚清场'
                          : stationEvent === 'afterparty' ? '地下演出刚散场，大家还没醒'
                            : stationEvent === 'blackout' ? '隧道供电中断，只剩一盏灯还亮着'
                              : stationEvent === 'red-alert' ? '广播没有解释原因，整节车厢突然变红' : ENDLESS_SUBTITLES[extra % ENDLESS_SUBTITLES.length],
    time: stationEvent === 'all-exit' ? 28 : stationEvent !== 'normal' ? 27 : Math.max(20, 24 - Math.floor(extra / 5) * 0.5),
    passengers: stationEvent === 'inflow' ? 10 : stationEvent === 'pig' ? Math.min(16, basePassengers) : basePassengers,
    swayPeriod: Math.max(3.45, 4.35 - extra * 0.11),
    warning: Math.max(0.44, 0.60 - extra * 0.018),
    impulse: Math.min(4.5, 3.5 + extra * 0.09),
    roll: Math.min(6.0, 4.5 + extra * 0.12),
    wander: Math.min(1.28, 1.02 + extra * 0.025),
    fallChance: Math.min(0.32, 0.21 + extra * 0.012),
    swayFallChance: Math.min(0.46, 0.32 + extra * 0.014),
    variant: (['maintenance', 'ad-wrap', 'narrow-door', 'long-seat'] as const)[extra % 4],
    stationEvent,
    boardingCount: stationEvent === 'all-exit' ? 0 : stationEvent === 'inflow' ? 9 : stationEvent === 'normal' ? 1 + (index * 7 % 3) : 2,
    alightingCount: stationEvent === 'all-exit' ? 99 : stationEvent === 'inflow' ? 1 : stationEvent === 'normal' ? 1 + (index * 5 % 3) : 2,
  }
  endlessCache.set(index, config)
  return config
}
