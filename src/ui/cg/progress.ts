import { HERO_COSTS, HERO_IDS, type HeroId } from '../../game/models'

const BEST_STAGE_KEY = 'get-off-the-train.cg.best-stage'

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
