import { HERO_COSTS, HERO_IDS, type HeroId } from '../../game/models'

const BEST_STAGE_KEY = 'get-off-the-train.cg.best-stage'
const BEST_CLEAR_KEY = 'get-off-the-train.cg.best-clear'
const UPGRADE_KEY = 'get-off-the-train.cg.upgrades'

export type UpgradeId = 'grip' | 'hustle' | 'pocket'
export interface Upgrades { grip: number; hustle: number; pocket: number }
export const EMPTY_UPGRADES: Upgrades = { grip: 0, hustle: 0, pocket: 0 }
export const UPGRADE_MAX = 3
const UPGRADE_COSTS = [40, 90, 160]

export type CoinGoal =
  | { kind: 'upgrade'; id: UpgradeId; cost: number }
  | { kind: 'hero'; id: HeroId; cost: number }

export function readBestStage(): number {
  try {
    const n = Number(alteruLocalStorage.getItem(BEST_STAGE_KEY) || 0)
    return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0
  } catch {
    return 0
  }
}

export function writeBestStage(stage: number): void {
  try { alteruLocalStorage.setItem(BEST_STAGE_KEY, String(Math.max(0, Math.floor(stage)))) } catch { /* private mode */ }
}

export function nextLockedHero(unlocked: readonly HeroId[]) {
  const id = HERO_IDS.find((hero) => !unlocked.includes(hero))
  if (!id) return null
  return { id, cost: HERO_COSTS[id] }
}

function readCount(key: string): number {
  try {
    const n = Number(alteruLocalStorage.getItem(key) || 0)
    return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0
  } catch {
    return 0
  }
}

export function readBestClear(): number {
  return readCount(BEST_CLEAR_KEY)
}

export function writeBestClear(car: number): void {
  try { alteruLocalStorage.setItem(BEST_CLEAR_KEY, String(Math.max(0, Math.floor(car)))) } catch { /* private mode */ }
}

export function readUpgrades(): Upgrades {
  try {
    const raw = alteruLocalStorage.getItem(UPGRADE_KEY)
    if (!raw) return { ...EMPTY_UPGRADES }
    const parsed = JSON.parse(raw) as Partial<Upgrades>
    const clamp = (value: unknown) => Math.max(0, Math.min(UPGRADE_MAX, Math.floor(Number(value) || 0)))
    return { grip: clamp(parsed.grip), hustle: clamp(parsed.hustle), pocket: clamp(parsed.pocket) }
  } catch {
    return { ...EMPTY_UPGRADES }
  }
}

export function writeUpgrades(upgrades: Upgrades): void {
  try { alteruLocalStorage.setItem(UPGRADE_KEY, JSON.stringify(upgrades)) } catch { /* private mode */ }
}

export function upgradeCost(rank: number): number | null {
  if (rank >= UPGRADE_MAX) return null
  return UPGRADE_COSTS[Math.max(0, rank)] ?? null
}

export function pocketMultiplier(rank: number): number {
  return 1 + Math.max(0, Math.min(UPGRADE_MAX, rank)) * 0.2
}

/** Cheapest thing the player can buy, or the closest one they cannot yet. */
export function nextCoinGoal(coins: number, unlocked: readonly HeroId[], upgrades: Upgrades): CoinGoal | null {
  const options: CoinGoal[] = []
  for (const id of ['grip', 'hustle', 'pocket'] as const) {
    const cost = upgradeCost(upgrades[id])
    if (cost != null) options.push({ kind: 'upgrade', id, cost })
  }
  const hero = nextLockedHero(unlocked)
  if (hero) options.push({ kind: 'hero', id: hero.id, cost: hero.cost })
  if (!options.length) return null
  const ready = options.filter((option) => coins >= option.cost).sort((a, b) => a.cost - b.cost)
  if (ready.length) return ready[0]
  return options.slice().sort((a, b) => (a.cost - coins) - (b.cost - coins))[0]
}
