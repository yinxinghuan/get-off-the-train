import { heroName, type HeroNameId } from '../../i18n'
import type { HeroId } from '../../game/models'
import { CoinIcon } from '../Icons'
import { nextLockedHero } from './progress'
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

export function CgGoal({
  coins,
  unlocked,
  earned,
  stage,
  bestStage,
  cleared,
}: {
  coins: number
  unlocked: readonly HeroId[]
  earned?: number
  stage: number
  bestStage: number
  cleared?: boolean
}) {
  const next = nextLockedHero(unlocked)
  const left = next ? Math.max(0, next.cost - coins) : 0
  const pct = next ? Math.max(0, Math.min(100, Math.round((coins / next.cost) * 100))) : 100
  return (
    <div className="cg-progress">
      <div className="cg-progress__row">
        <span>CAR {String(stage).padStart(2, '0')}{cleared ? ' CLEAR' : ''}</span>
        <span>BEST {String(Math.max(bestStage, stage)).padStart(2, '0')}</span>
        {earned != null && (
          <strong className="cg-progress__earn"><CoinIcon size={16} />+{earned}</strong>
        )}
      </div>
      {next ? (
        <div className="cg-progress__goal">
          <span>NEXT</span>
          <strong>{heroName(next.id as HeroNameId)}</strong>
          <em>{left === 0 ? 'READY' : `${left} LEFT`}</em>
          <i aria-hidden="true"><b style={{ width: `${pct}%` }} /></i>
        </div>
      ) : (
        <div className="cg-progress__goal">
          <span>NEXT</span>
          <strong>EVERY HERO</strong>
          <em>KEEP GOING</em>
          <i aria-hidden="true"><b style={{ width: '100%' }} /></i>
        </div>
      )}
    </div>
  )
}

export function CgChip({ coins, unlocked }: { coins: number; unlocked: readonly HeroId[] }) {
  const next = nextLockedHero(unlocked)
  const left = next ? Math.max(0, next.cost - coins) : 0
  return (
    <div className="cg-chip">
      <CoinIcon size={16} />
      <strong>{coins}</strong>
      {next ? <span>{heroName(next.id as HeroNameId)} · {left === 0 ? 'READY' : `${left} LEFT`}</span> : <span>ALL HEROES</span>}
    </div>
  )
}
