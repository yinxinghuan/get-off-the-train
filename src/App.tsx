import { useCallback, useEffect, useRef, useState } from 'react'
import TrainScene from './game/TrainScene'
import { getLevelConfig, type HudState, type InputVector, type Phase } from './game/types'
import { sound } from './audio/sound'
import { locale, t } from './i18n'
import { ArrowIcon, BalanceIcon, ExitAheadIcon, PauseIcon, TrainIcon } from './ui/Icons'
import { Joystick } from './ui/Joystick'
import { Leaderboard } from './shared/leaderboard/Leaderboard'
import { useGameScore, type LeaderboardEntry } from './shared/leaderboard/useGameScore'
import { telegramId, useGameEvent } from './shared/runtime'

const BEST_KEY = 'get-off-the-train.best.v1'
const POSTER_URL = 'https://yinxinghuan.github.io/games/posters/get-off-the-train.png'
const QA_LEVEL = import.meta.env.DEV ? Math.max(0, Number(new URLSearchParams(location.search).get('qaLevel') || 1) - 1) : 0
const QA_AUTORUN = import.meta.env.DEV && new URLSearchParams(location.search).has('qaRun')
const QA_ACTIVE = import.meta.env.DEV && (new URLSearchParams(location.search).has('qaLevel') || QA_AUTORUN)
const initialHud: HudState = { timeLeft: getLevelConfig(QA_LEVEL).time, distance: 12, falls: 0, braced: false, swayWarning: false, swayDirection: 1 }
const EN_LEVELS = [
  ['COMMUTER LOCAL', 'Learn to turn sideways through the gaps'],
  ['LONG-SEAT EXPRESS', 'A longer aisle and a moving crowd'],
  ['AD-WRAP CAR', 'More visual noise and more backpacks'],
  ['OLD NARROW DOOR', 'The exit only opens halfway'],
  ['LAST TRAIN WORKS', 'Shortest warning, most obstacles'],
] as const

function levelCopy(index: number, config: ReturnType<typeof getLevelConfig>) {
  if (locale === 'zh') return { name: config.name, subtitle: config.subtitle }
  if (EN_LEVELS[index]) return { name: EN_LEVELS[index][0], subtitle: EN_LEVELS[index][1] }
  return { name: `CAR ${index + 1} · MONSTER RUSH`, subtitle: index % 2 ? 'Shorter warning. Heavier crowd.' : 'The line ends only when you miss.' }
}

function ActionButton({ children, onPress, secondary = false }: { children: React.ReactNode; onPress: () => void; secondary?: boolean }) {
  return <button className={`got-btn${secondary ? ' got-btn--secondary' : ''}`} onPointerDown={(ev) => { ev.preventDefault(); sound.tap(); onPress() }}>{children}</button>
}

export default function App() {
  const [phase, setPhase] = useState<Phase>('playing')
  const [level, setLevel] = useState(QA_LEVEL)
  const config = getLevelConfig(level)
  const copy = levelCopy(level, config)
  const [hud, setHud] = useState(initialHud)
  const [score, setScore] = useState(0)
  const [levelScore, setLevelScore] = useState(0)
  const [totalFalls, setTotalFalls] = useState(0)
  const [best, setBest] = useState(() => Number(localStorage.getItem(BEST_KEY) || 0))
  const [reducedMotion, setReducedMotion] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches)
  const [runStarted, setRunStarted] = useState(QA_ACTIVE)
  const [showGuide, setShowGuide] = useState(!QA_ACTIVE)
  const [showBoard, setShowBoard] = useState(false)
  const input = useRef<InputVector>({ x: 0, z: 0 })
  const phaseBeforePause = useRef<Phase>('playing')
  const latestRows = useRef<LeaderboardEntry[]>([])
  const preRunBest = useRef(0)
  const { submitScore, fetchLeaderboard } = useGameScore()
  const events = useGameEvent()

  useEffect(() => {
    if (!QA_AUTORUN || phase !== 'playing') return
    input.current = { x: 0, z: -1 }
    return () => { input.current = { x: 0, z: 0 } }
  }, [level, phase])

  useEffect(() => {
    let alive = true
    fetchLeaderboard().then((rows) => {
      if (!alive) return
      latestRows.current = rows
    }).catch(() => {})
    return () => { alive = false }
  }, [fetchLeaderboard])

  const snapshotPreRunBest = useCallback(() => {
    if (!telegramId) { preRunBest.current = 0; return }
    const me = latestRows.current.find((row) => String(row.user_id) === String(telegramId))
    preRunBest.current = me ? Number(me.score) || 0 : 0
  }, [])

  const sendBeatNotify = useCallback(async (myScore: number) => {
    if (!telegramId || !events.canEmit || myScore <= preRunBest.current) return
    try {
      const fresh = await fetchLeaderboard()
      const meId = String(telegramId)
      const beaten = fresh
        .filter((row) => String(row.user_id) !== meId)
        .map((row) => ({ id: String(row.user_id), score: Number(row.score) || 0 }))
        .filter((row) => row.score < myScore && row.score > preRunBest.current)
        .sort((a, b) => b.score - a.score)[0]
      if (!beaten) return
      events.trigger('score_beat', {
        actions: [{
          type: 'notify',
          target_user_id: beaten.id,
          image: { ref_url: POSTER_URL, prompt: 'American comic-book rush-hour subway crowd pushing toward a closing yellow door.' },
          message: { template: `{sender_name} squeezed past your record — ${Math.round(myScore)} pts on Get Off the Train!`, variables: ['sender_name'] },
        }],
      })
    } catch { /* leaderboard notifications never block results */ }
  }, [events, fetchLeaderboard])

  const restartRun = useCallback(() => {
    sound.unlock()
    snapshotPreRunBest()
    input.current = { x: 0, z: 0 }
    setLevel(0); setScore(0); setLevelScore(0); setTotalFalls(0)
    setHud({ ...initialHud, timeLeft: getLevelConfig(0).time })
    setRunStarted(true)
    setShowGuide(false)
    setPhase('playing')
  }, [snapshotPreRunBest])

  const beginFromInput = useCallback(() => {
    sound.unlock()
    setShowGuide(false)
    setRunStarted((started) => {
      if (!started) snapshotPreRunBest()
      return true
    })
  }, [snapshotPreRunBest])

  const handleOutcome = useCallback((kind: 'clear' | 'fail', data: { timeLeft: number; falls: number }) => {
    input.current = { x: 0, z: 0 }
    const nextFalls = totalFalls + data.falls
    setTotalFalls(nextFalls)
    if (kind === 'fail') {
      const finalScore = score
      setBest((old) => { const value = Math.max(old, finalScore); localStorage.setItem(BEST_KEY, String(value)); return value })
      submitScore(finalScore).then(() => sendBeatNotify(finalScore)).catch(() => {})
      setPhase('game-over')
      return
    }
    const earned = Math.ceil(data.timeLeft * 100) + 1000 + Math.max(0, 3 - data.falls) * 250 + level * 120
    setLevelScore(earned)
    setScore((current) => current + earned)
    setPhase('level-clear')
  }, [level, score, sendBeatNotify, submitScore, totalFalls])

  const nextLevel = () => {
    const next = level + 1
    setLevel(next)
    setHud({ ...initialHud, timeLeft: getLevelConfig(next).time })
    setPhase('playing')
  }

  const pause = useCallback(() => {
    if (phase === 'playing') { phaseBeforePause.current = phase; input.current = { x: 0, z: 0 }; setPhase('paused') }
  }, [phase])

  useEffect(() => {
    const down = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape' || ev.key.toLowerCase() === 'p') { ev.preventDefault(); phase === 'paused' ? setPhase(phaseBeforePause.current) : pause(); return }
      const key = ev.key.toLowerCase()
      if (['a', 'd', 'w', 's', 'arrowleft', 'arrowright', 'arrowup', 'arrowdown'].includes(key)) beginFromInput()
      if (key === 'a' || key === 'arrowleft') input.current.x = -1
      if (key === 'd' || key === 'arrowright') input.current.x = 1
      if (key === 'w' || key === 'arrowup') input.current.z = -1
      if (key === 's' || key === 'arrowdown') input.current.z = 1
    }
    const up = (ev: KeyboardEvent) => {
      const key = ev.key.toLowerCase()
      if ((key === 'a' || key === 'arrowleft') && input.current.x < 0) input.current.x = 0
      if ((key === 'd' || key === 'arrowright') && input.current.x > 0) input.current.x = 0
      if ((key === 'w' || key === 'arrowup') && input.current.z < 0) input.current.z = 0
      if ((key === 's' || key === 'arrowdown') && input.current.z > 0) input.current.z = 0
    }
    window.addEventListener('keydown', down); window.addEventListener('keyup', up)
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up) }
  }, [beginFromInput, phase, pause])

  useEffect(() => {
    const onVisibility = () => { if (document.hidden && phase === 'playing') pause() }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [phase, pause])

  return (
    <main className={`got${hud.swayWarning ? ' got--warning' : ''}${phase === 'game-over' ? ' got--failed' : ''}`}>
      <TrainScene key={level} level={level} config={config} active={phase === 'playing' && runStarted} input={input} reducedMotion={reducedMotion} onHud={setHud} onOutcome={handleOutcome} />
      <div className="got__halftone" aria-hidden="true" />
      <div className="got__frame" aria-hidden="true" />

      <header className="got-hud">
        <div className="got-hud__cell"><span>{t('level')}</span><strong>{level + 1}<small>∞</small></strong></div>
        <div className={`got-hud__cell got-hud__cell--time${hud.timeLeft < 5 ? ' is-danger' : ''}`}><span>{t('time')}</span><strong>{hud.timeLeft.toFixed(1)}<small>s</small></strong></div>
        <div className="got-hud__cell"><span>{t('distance')}</span><strong>{hud.distance.toFixed(1)}<small>{t('meters')}</small></strong></div>
      </header>
      <div className="got-level-tag"><TrainIcon size={18} /><b>{copy.name}</b><span>{runStarted ? copy.subtitle : t('dragUp')}</span></div>
      <div className="got-exit-cue" aria-hidden="true"><ExitAheadIcon size={18} /><b>{t('exitAhead')}</b></div>
      <button className="got-pause" aria-label={t('pause')} onPointerDown={pause}><PauseIcon /></button>
      {phase === 'playing' && <div className="got-player-label" aria-hidden="true"><b>{t('you')}</b><span /></div>}

      {phase === 'playing' && (
        <>
          {hud.swayWarning && <div className="got-warning"><span>{hud.swayDirection > 0 ? t('right') : t('left')}</span><strong>{t('warning')}</strong></div>}
          {hud.braced && <div className="got-braced"><BalanceIcon size={18} /> {t('brace')}</div>}
          <Joystick input={input} enabled={phase === 'playing'} showGuide={showGuide} onFirstInput={beginFromInput} />
        </>
      )}

      {(phase === 'paused' || phase === 'level-clear' || phase === 'game-over') && (
        <div className="got-overlay">
          <section className={`got-panel got-panel--${phase}`}>
            <span className="got-panel__eyebrow">{phase === 'paused' ? `${t('level')} ${level + 1}` : copy.name}</span>
            <h2>{phase === 'paused' ? t('pause') : phase === 'level-clear' ? t('clear') : t('miss')}</h2>
            {phase !== 'paused' && <p>{phase === 'level-clear' ? t('clearCopy') : t('missCopy')}</p>}
            {phase !== 'paused' && (
              <div className="got-stats">
                {phase === 'level-clear' && <div><span>{t('remaining')}</span><strong>{hud.timeLeft.toFixed(1)}s</strong></div>}
                {phase === 'level-clear' && <div><span>{t('levelScore')}</span><strong>{levelScore}</strong></div>}
                <div><span>{t('falls')}</span><strong>{totalFalls}</strong></div>
                <div><span>{t('totalScore')}</span><strong>{score}</strong></div>
                {phase === 'game-over' && <div><span>{t('best')}</span><strong>{Math.max(best, score)}</strong></div>}
              </div>
            )}
            {phase === 'paused' && <ActionButton onPress={() => setPhase('playing')}>{t('resume')} <ArrowIcon /></ActionButton>}
            {phase === 'level-clear' && <ActionButton onPress={nextLevel}>{t('next')} <ArrowIcon /></ActionButton>}
            {phase === 'game-over' && <ActionButton onPress={restartRun}>{t('retry')} <ArrowIcon /></ActionButton>}
            {phase === 'game-over' && <ActionButton secondary onPress={() => setShowBoard(true)}>{t('board')}</ActionButton>}
            {phase === 'paused' && <ActionButton secondary onPress={restartRun}>{t('restart')}</ActionButton>}
            {phase === 'paused' && <ActionButton secondary onPress={() => setReducedMotion((value) => !value)}>{t('reduced')}</ActionButton>}
          </section>
        </div>
      )}

      {showBoard && <Leaderboard fetchEntries={fetchLeaderboard} onClose={() => setShowBoard(false)} />}
      <span className="got__brand" aria-hidden="true">AIGRAM // {locale.toUpperCase()}</span>
    </main>
  )
}
