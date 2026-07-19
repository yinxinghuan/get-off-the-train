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

export interface LevelConfig {
  name: string
  subtitle: string
  time: number
  passengers: number
  swayPeriod: number
  warning: number
  impulse: number
  roll: number
  variant: 'commuter' | 'long-seat' | 'ad-wrap' | 'narrow-door' | 'maintenance'
}

export const LEVELS: LevelConfig[] = [
  { name: '普通早班', subtitle: '先学会在人缝里侧身', time: 20, passengers: 18, swayPeriod: 6.8, warning: 1.15, impulse: 2.0, roll: 2.2, variant: 'commuter' },
  { name: '纵座快线', subtitle: '走道更长，人群开始移动', time: 18, passengers: 24, swayPeriod: 6.1, warning: 1.0, impulse: 2.35, roll: 2.7, variant: 'long-seat' },
  { name: '广告包车', subtitle: '视线更乱，背包更多', time: 16, passengers: 31, swayPeriod: 5.5, warning: 0.85, impulse: 2.7, roll: 3.2, variant: 'ad-wrap' },
  { name: '老式窄门', subtitle: '门只开一半，别被卡住', time: 14, passengers: 39, swayPeriod: 4.9, warning: 0.72, impulse: 3.05, roll: 3.8, variant: 'narrow-door' },
  { name: '末班施工车', subtitle: '最短预警，最多障碍', time: 12, passengers: 48, swayPeriod: 4.4, warning: 0.62, impulse: 3.4, roll: 4.4, variant: 'maintenance' },
]

const ENDLESS_NAMES = ['怪物早班', '幽灵换乘', '失控区间', '终点不存在']
const ENDLESS_SUBTITLES = ['怪物乘客开始抢吊环', '人群更轻，也更容易滑倒', '预警继续缩短', '只要没迟到，就继续挤']

export function getLevelConfig(index: number): LevelConfig {
  if (LEVELS[index]) return LEVELS[index]
  const extra = index - LEVELS.length
  return {
    name: `第 ${index + 1} 节 · ${ENDLESS_NAMES[extra % ENDLESS_NAMES.length]}`,
    subtitle: ENDLESS_SUBTITLES[extra % ENDLESS_SUBTITLES.length],
    time: Math.max(10, 12 - Math.floor(extra / 4) * 0.5),
    passengers: Math.min(58, 50 + Math.floor(extra * 1.35)),
    swayPeriod: Math.max(3.45, 4.35 - extra * 0.11),
    warning: Math.max(0.44, 0.60 - extra * 0.018),
    impulse: Math.min(4.5, 3.5 + extra * 0.09),
    roll: Math.min(6.0, 4.5 + extra * 0.12),
    variant: (['maintenance', 'ad-wrap', 'narrow-door', 'long-seat'] as const)[extra % 4],
  }
}
