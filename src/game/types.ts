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
  wander: number
  fallChance: number
  swayFallChance: number
  variant: 'commuter' | 'long-seat' | 'ad-wrap' | 'narrow-door' | 'maintenance'
}

export const LEVELS: LevelConfig[] = [
  { name: '普通早班', subtitle: '先看懂人群，再找缝前进', time: 28, passengers: 9, swayPeriod: 6.8, warning: 1.15, impulse: 2.0, roll: 2.2, wander: 0.55, fallChance: 0.08, swayFallChance: 0.12, variant: 'commuter' },
  { name: '纵座快线', subtitle: '乘客开始随机换位', time: 27, passengers: 12, swayPeriod: 6.1, warning: 1.0, impulse: 2.35, roll: 2.7, wander: 0.66, fallChance: 0.11, swayFallChance: 0.16, variant: 'long-seat' },
  { name: '广告包车', subtitle: '碰撞开始让人失衡', time: 26, passengers: 14, swayPeriod: 5.5, warning: 0.85, impulse: 2.7, roll: 3.2, wander: 0.78, fallChance: 0.14, swayFallChance: 0.21, variant: 'ad-wrap' },
  { name: '老式窄门', subtitle: '门口横穿最频繁', time: 25, passengers: 16, swayPeriod: 4.9, warning: 0.72, impulse: 3.05, roll: 3.8, wander: 0.90, fallChance: 0.17, swayFallChance: 0.26, variant: 'narrow-door' },
  { name: '末班施工车', subtitle: '强晃动更容易摔倒', time: 24, passengers: 18, swayPeriod: 4.4, warning: 0.62, impulse: 3.4, roll: 4.4, wander: 1.0, fallChance: 0.20, swayFallChance: 0.31, variant: 'maintenance' },
]

const ENDLESS_NAMES = ['怪物早班', '幽灵换乘', '失控区间', '终点不存在']
const ENDLESS_SUBTITLES = ['怪物乘客开始抢吊环', '人群更轻，也更容易滑倒', '预警继续缩短', '只要没迟到，就继续挤']

export function getLevelConfig(index: number): LevelConfig {
  if (LEVELS[index]) return LEVELS[index]
  const extra = index - LEVELS.length
  return {
    name: `第 ${index + 1} 节 · ${ENDLESS_NAMES[extra % ENDLESS_NAMES.length]}`,
    subtitle: ENDLESS_SUBTITLES[extra % ENDLESS_SUBTITLES.length],
    time: Math.max(20, 24 - Math.floor(extra / 5) * 0.5),
    passengers: Math.min(20, 19 + Math.floor(extra / 3)),
    swayPeriod: Math.max(3.45, 4.35 - extra * 0.11),
    warning: Math.max(0.44, 0.60 - extra * 0.018),
    impulse: Math.min(4.5, 3.5 + extra * 0.09),
    roll: Math.min(6.0, 4.5 + extra * 0.12),
    wander: Math.min(1.28, 1.02 + extra * 0.025),
    fallChance: Math.min(0.32, 0.21 + extra * 0.012),
    swayFallChance: Math.min(0.46, 0.32 + extra * 0.014),
    variant: (['maintenance', 'ad-wrap', 'narrow-door', 'long-seat'] as const)[extra % 4],
  }
}
