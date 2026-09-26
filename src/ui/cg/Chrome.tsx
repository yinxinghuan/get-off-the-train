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
const UPGRADE_BLURB: Record<UpgradeId, string> = {
  grip: 'Fewer falls on sway',
  hustle: 'Faster push through crowd',
  pocket: 'More coins per ride',
}

function goalName(goal: NonNullable<ReturnType<typeof nextCoinGoal>>) {
  return goal.kind === 'hero' ? heroName(goal.id as HeroNameId) : UPGRADE_LABEL[goal.id]
}

function LockIcon() {
  return (
    <svg className="cg-upgrade__icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8 11V8a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      <rect x="6" y="11" width="12" height="9" rx="2" fill="none" stroke="currentColor" strokeWidth="2.4" />
    </svg>
  )
}

function UpgradeIcon({ id }: { id: UpgradeId }) {
  if (id === 'pocket') return <CoinIcon size={18} />
  if (id === 'hustle') {
    return (
      <svg className="cg-upgrade__icon" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 15l4-4 3 3 6-7" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M13 7h6v6" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }
  return (
    <svg className="cg-upgrade__icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 4v16" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M7 10h7a3 3 0 0 1 0 6H7" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function CgLadder({ bestClear }: { bestClear: number }) {
  const nextCar = Math.min(bestClear + 1, 5)
  return (
    <div className="cg-ladder" aria-label="Cars">
      {[1, 2, 3, 4, 5].map((car) => (
        <span key={car} className={car <= bestClear ? 'is-done' : car === nextCar ? 'is-next' : 'is-lock'}>{String(car).padStart(2, '0')}</span>
      ))}
      <em>{bestClear >= 5 ? 'ENDLESS OPEN' : `CLEAR ${String(nextCar).padStart(2, '0')}`}</em>
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
        const maxed = rank >= UPGRADE_MAX
        const locked = !maxed && !ready
        return (
          <button
            key={id}
            type="button"
            className={maxed ? 'is-max' : ready ? 'is-ready' : 'is-short'}
            disabled={!ready}
            aria-label={`${UPGRADE_LABEL[id]}, ${UPGRADE_BLURB[id]}, rank ${rank} of ${UPGRADE_MAX}, ${maxed ? 'maxed' : `${cost} coins`}`}
            onClick={() => onBuy(id)}
          >
            {locked ? <LockIcon /> : <UpgradeIcon id={id} />}
            <b>{UPGRADE_LABEL[id]}</b>
            <small>{UPGRADE_BLURB[id]}</small>
            <span className="cg-rank">
              <i className="cg-pips" aria-hidden="true">
                {[0, 1, 2].map((pip) => <em key={pip} className={pip < rank ? 'is-on' : ''} />)}
              </i>
              <em>RANK {rank}</em>
            </span>
            <strong>{maxed ? 'MAX' : cost}</strong>
          </button>
        )
      })}
    </div>
  )
}

export function CgPoster({ made, car, name, spare }: { made: boolean; car: number; name: string; spare: number }) {
  const spareLabel = made ? `${Math.max(0, Math.ceil(spare))}s SPARE` : 'DOORS SHUT'
  return (
    <aside className={`cg-poster${made ? ' is-made' : ' is-miss'}`}>
      <div className="cg-poster__stage">
        <svg viewBox="0 0 180 96" aria-hidden="true">
          <rect x="8" y="28" width="164" height="52" rx="8" fill="#fff8ee" stroke="#1a1612" strokeWidth="3" />
          <rect x="8" y="28" width="164" height="10" rx="4" fill="#f5c518" stroke="#1a1612" strokeWidth="3" />
          <rect x="18" y="44" width="22" height="16" rx="3" fill="#2f7f76" stroke="#1a1612" strokeWidth="2" />
          <rect x="46" y="44" width="22" height="16" rx="3" fill="#2f7f76" stroke="#1a1612" strokeWidth="2" />
          <rect x="112" y="44" width="22" height="16" rx="3" fill="#2f7f76" stroke="#1a1612" strokeWidth="2" />
          <rect x="140" y="44" width="22" height="16" rx="3" fill="#2f7f76" stroke="#1a1612" strokeWidth="2" />
          <rect x="78" y="42" width="26" height="38" rx="3" fill={made ? '#f5c518' : '#d4534a'} stroke="#1a1612" strokeWidth="3" />
          <path d="M91 50 v22" fill="none" stroke="#1a1612" strokeWidth="2" />
          <circle cx="58" cy="62" r="7" fill="#1a1612" />
          <path d="M50 86c1-12 6-16 8-16s7 4 8 16" fill="#1a1612" />
          <rect x="14" y="78" width="152" height="4" rx="2" fill="#1a1612" />
        </svg>
        <b className="cg-poster__stamp">{made ? 'MADE IT' : 'MISSED'}</b>
      </div>
      <p className="cg-poster__meta">
        <strong>CAR {String(car).padStart(2, '0')}</strong>
        <span>{name}</span>
      </p>
      <em className="cg-poster__spare">{spareLabel}</em>
    </aside>
  )
}

export function CgNext({ bestClear, onStart }: { bestClear: number; onStart: (level: number) => void }) {
  if (bestClear < 1) return null
  const next = Math.min(bestClear + 1, 8)
  return (
    <button type="button" className="cg-next__go" onClick={() => onStart(next - 1)}>NEXT CAR {String(next).padStart(2, '0')}</button>
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
