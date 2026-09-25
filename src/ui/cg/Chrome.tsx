import { heroName, type HeroNameId } from '../../i18n'
import type { HeroId } from '../../game/models'
import { CoinIcon } from '../Icons'
import { nextCoinGoal, upgradeCost, UPGRADE_MAX, type UpgradeId, type Upgrades } from './progress'
import type { CoachStep } from './tutorial'

function Keys({ arrows = false }: { arrows?: boolean }) {
  return (
    <span className="cg-keys" aria-hidden="true">
      <span className="cg-keys__wasd">
        <kbd>W</kbd>
        <span><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd></span>
      </span>
      {arrows && (
        <span className="cg-keys__wasd">
          <kbd>↑</kbd>
          <span><kbd>←</kbd><kbd>↓</kbd><kbd>→</kbd></span>
        </span>
      )}
    </span>
  )
}

const COPY: Record<CoachStep, { kicker: string; title: string }> = {
  move: { kicker: '1 / 4', title: 'MOVE' },
  sway: { kicker: '2 / 4', title: 'LET GO' },
  fall: { kicker: '3 / 4', title: 'GET UP' },
  door: { kicker: '4 / 4', title: 'EXIT' },
}

export function CgCoach({ step, onSkip }: { step: CoachStep; onSkip: () => void }) {
  const copy = COPY[step]
  return (
    <div className={`cg-coach cg-coach--${step}`} role="dialog" aria-label={copy.title}>
      {step === 'door' && <span className="cg-coach__arrow" aria-hidden="true" />}
      <div className="cg-coach__card">
        <span className="cg-coach__kicker">{copy.kicker}</span>
        <div className="cg-coach__body">
          {step === 'move' && <Keys arrows />}
          {step === 'sway' && (
            <span className="cg-glyph" aria-hidden="true">
              <i className="cg-glyph__train" />
              <b />
            </span>
          )}
          {step === 'fall' && (
            <span className="cg-glyph cg-glyph--fall" aria-hidden="true">
              <i />
            </span>
          )}
          {step === 'door' && (
            <span className="cg-glyph cg-glyph--door" aria-hidden="true">
              <i />
              <b>↑</b>
            </span>
          )}
          <strong>{copy.title}</strong>
        </div>
        <button type="button" className="cg-coach__skip" onClick={onSkip}>SKIP</button>
      </div>
    </div>
  )
}

export function CgLegend() {
  return (
    <div className="cg-legend" aria-hidden="true">
      <Keys arrows />
      <span><kbd>P</kbd> pause</span>
      <span><kbd>M</kbd> mute</span>
    </div>
  )
}

const UPGRADE_LABEL: Record<UpgradeId, string> = { grip: 'GRIP', hustle: 'HUSTLE', pocket: 'POCKET' }

function goalName(goal: NonNullable<ReturnType<typeof nextCoinGoal>>) {
  return goal.kind === 'hero' ? heroName(goal.id as HeroNameId) : UPGRADE_LABEL[goal.id]
}

export function CgGoal({
  coins,
  unlocked,
  upgrades,
  earned,
  stage,
  bestStage,
  bestClear,
  cleared,
}: {
  coins: number
  unlocked: readonly HeroId[]
  upgrades: Upgrades
  earned?: number
  stage: number
  bestStage: number
  bestClear: number
  cleared?: boolean
}) {
  const next = nextCoinGoal(coins, unlocked, upgrades)
  const left = next ? Math.max(0, next.cost - coins) : 0
  const pct = next ? Math.max(0, Math.min(100, Math.round((coins / next.cost) * 100))) : 100
  const nextCar = Math.min(bestClear + 1, 5)
  return (
    <div className="cg-progress">
      <div className="cg-progress__row">
        <span>CAR {String(stage).padStart(2, '0')}{cleared ? ' CLEAR' : ''}</span>
        <span>BEST {String(Math.max(bestStage, stage)).padStart(2, '0')}</span>
        {earned != null && (
          <strong className="cg-progress__earn"><CoinIcon size={16} />+{earned}</strong>
        )}
      </div>
      <div className="cg-ladder" aria-label="Cars">
        {[1, 2, 3, 4, 5].map((car) => (
          <span key={car} className={car <= bestClear ? 'is-done' : car === nextCar ? 'is-next' : 'is-lock'}>{String(car).padStart(2, '0')}</span>
        ))}
        <em>{bestClear >= 5 ? 'ENDLESS OPEN' : `CLEAR ${String(nextCar).padStart(2, '0')}`}</em>
      </div>
      {next ? (
        <div className="cg-progress__goal">
          <span>NEXT</span>
          <strong>{goalName(next)}</strong>
          <em>{left === 0 ? 'READY' : `${left} LEFT`}</em>
          <i aria-hidden="true"><b style={{ width: `${pct}%` }} /></i>
        </div>
      ) : (
        <div className="cg-progress__goal">
          <span>NEXT</span>
          <strong>ALL BOUGHT</strong>
          <em>KEEP GOING</em>
          <i aria-hidden="true"><b style={{ width: '100%' }} /></i>
        </div>
      )}
    </div>
  )
}

export function CgUpgrades({
  coins,
  upgrades,
  onBuy,
}: {
  coins: number
  upgrades: Upgrades
  onBuy: (id: UpgradeId) => void
}) {
  return (
    <div className="cg-upgrades">
      {(['grip', 'hustle', 'pocket'] as const).map((id) => {
        const rank = upgrades[id]
        const cost = upgradeCost(rank)
        const ready = cost != null && coins >= cost
        return (
          <button key={id} type="button" className={rank >= UPGRADE_MAX ? 'is-max' : ready ? 'is-ready' : ''} disabled={cost == null || coins < cost} onClick={() => onBuy(id)}>
            <b>{UPGRADE_LABEL[id]} {rank || ''}</b>
            <span>{cost == null ? 'MAX' : `${cost}`}</span>
          </button>
        )
      })}
    </div>
  )
}

export function CgStarts({ bestClear, onStart }: { bestClear: number; onStart: (level: number) => void }) {
  if (bestClear < 1) return null
  const cars = []
  for (let car = 2; car <= Math.min(bestClear + 1, 8); car++) cars.push(car)
  return (
    <div className="cg-starts">
      <span>RIDE</span>
      {cars.map((car) => (
        <button key={car} type="button" onClick={() => onStart(car - 1)}>{String(car).padStart(2, '0')}</button>
      ))}
    </div>
  )
}

export function CgChip({ coins, unlocked, upgrades }: { coins: number; unlocked: readonly HeroId[]; upgrades: Upgrades }) {
  const next = nextCoinGoal(coins, unlocked, upgrades)
  const left = next ? Math.max(0, next.cost - coins) : 0
  return (
    <div className="cg-chip">
      <CoinIcon size={16} />
      <strong>{coins}</strong>
      {next ? <span>{goalName(next)} · {left === 0 ? 'READY' : `${left} LEFT`}</span> : <span>ALL BOUGHT</span>}
    </div>
  )
}
