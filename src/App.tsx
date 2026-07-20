import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import TrainScene from './game/TrainScene'
import { getLevelConfig, type HudState, type InputVector, type Phase } from './game/types'
import { HERO_COSTS, HERO_IDS, type HeroId } from './game/models'
import { sound } from './audio/sound'
import { locale, t } from './i18n'
import { ArrowIcon, CoinIcon, CollectionIcon, CrownIcon, PauseIcon, TrainIcon } from './ui/Icons'
import { Joystick } from './ui/Joystick'
import { CollectionShop } from './ui/CollectionShop'
import { Leaderboard } from './shared/leaderboard/Leaderboard'
import { useGameScore, type LeaderboardEntry } from './shared/leaderboard/useGameScore'
import { telegramId, useGameEvent } from './shared/runtime'
import { useGameSave } from './shared/save'

const BEST_KEY = 'get-off-the-train.best.v1'
const POSTER_URL = 'https://yinxinghuan.github.io/games/posters/get-off-the-train.png'
const QA_LEVEL = import.meta.env.DEV ? Math.max(0, Number(new URLSearchParams(location.search).get('qaLevel') || 1) - 1) : 0
const QA_AUTORUN = import.meta.env.DEV && new URLSearchParams(location.search).has('qaRun')
const QA_ACTIVE = import.meta.env.DEV && (new URLSearchParams(location.search).has('qaLevel') || QA_AUTORUN)
const qaHeroParam = import.meta.env.DEV ? new URLSearchParams(location.search).get('qaHero') : null
const QA_HERO = qaHeroParam && HERO_IDS.includes(qaHeroParam as HeroId) ? qaHeroParam as HeroId : null
const QA_SCORE = import.meta.env.DEV ? Math.max(0, Number(new URLSearchParams(location.search).get('qaScore') || 0)) : 0
const QA_FAIL_AFTER = import.meta.env.DEV ? Math.max(0, Number(new URLSearchParams(location.search).get('qaFailAfter') || 0)) : 0
const initialHud: HudState = { timeLeft: getLevelConfig(QA_LEVEL).time, distance: 12, falls: 0, braced: false, swayWarning: false, swayDirection: 1 }
interface CollectionSave { coins: number; unlocked: HeroId[]; selected: HeroId; _lastActive?: number }
const DEFAULT_COLLECTION: CollectionSave = { coins: 0, unlocked: ['commuter'], selected: 'commuter' }
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

function ChampionPill({ champion, onOpen }: { champion: LeaderboardEntry | null; onOpen: () => void }) {
  return (
    <button type="button" className="got-champ" onPointerDown={(ev) => { ev.preventDefault(); sound.tap(); onOpen() }} aria-label={t('leaderboard')}>
      <CrownIcon size={21} />
      {champion ? (
        <>
          <span className="got-champ__avatar" aria-hidden="true">
            {champion.avatar_url ? <img src={champion.avatar_url} alt="" draggable={false} /> : <span>{(champion.name || '?').slice(0, 1).toUpperCase()}</span>}
          </span>
          <span className="got-champ__name">{champion.name || t('leaderboard')}</span>
          <strong>{Math.round(champion.score).toLocaleString()}</strong>
        </>
      ) : <span className="got-champ__fallback">{t('board')}</span>}
      <ArrowIcon size={17} />
    </button>
  )
}

export default function App() {
  const [phase, setPhase] = useState<Phase>('playing')
  const [level, setLevel] = useState(QA_LEVEL)
  // Endless configs are generated objects. Memoizing by level prevents each
  // 80 ms HUD sample from rebuilding the entire Three.js world from scratch.
  const config = useMemo(() => getLevelConfig(level), [level])
  const copy = levelCopy(level, config)
  const [hud, setHud] = useState(initialHud)
  const [score, setScore] = useState(QA_SCORE)
  const [levelScore, setLevelScore] = useState(0)
  const [totalFalls, setTotalFalls] = useState(0)
  const [best, setBest] = useState(() => Number(localStorage.getItem(BEST_KEY) || 0))
  const [reducedMotion, setReducedMotion] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches)
  const [runStarted, setRunStarted] = useState(QA_ACTIVE)
  const [showGuide, setShowGuide] = useState(!QA_ACTIVE)
  const [showBoard, setShowBoard] = useState(false)
  const [showCollection, setShowCollection] = useState(false)
  const [previewHero, setPreviewHero] = useState<HeroId>(QA_HERO ?? 'commuter')
  const [levelCoins, setLevelCoins] = useState(0)
  const input = useRef<InputVector>({ x: 0, z: 0 })
  const phaseBeforePause = useRef<Phase>('playing')
  const [leaderboardRows, setLeaderboardRows] = useState<LeaderboardEntry[]>([])
  const [leaderboardLoaded, setLeaderboardLoaded] = useState(false)
  const [champion, setChampion] = useState<LeaderboardEntry | null>(null)
  const preRunBest = useRef(0)
  const { canRank, submitScore, fetchLeaderboard } = useGameScore()
  const events = useGameEvent()
  const { savedData, persist } = useGameSave<CollectionSave>('get-off-the-train.collection.v1')
  const [collectionMirror, setCollectionMirror] = useState<CollectionSave | undefined>(undefined)

  useEffect(() => {
    if (collectionMirror !== undefined || savedData === undefined) return
    const unlocked = Array.isArray(savedData?.unlocked)
      ? savedData.unlocked.filter((hero): hero is HeroId => HERO_IDS.includes(hero as HeroId))
      : []
    if (!unlocked.includes('commuter')) unlocked.unshift('commuter')
    const selected = savedData?.selected && unlocked.includes(savedData.selected) ? savedData.selected : 'commuter'
    setCollectionMirror({
      coins: Math.max(0, Math.floor(Number(savedData?.coins) || 0)),
      unlocked,
      selected,
    })
    setPreviewHero(selected)
  }, [collectionMirror, savedData])

  const selectedHero = QA_HERO ?? collectionMirror?.selected ?? 'commuter'

  const refreshLeaderboard = useCallback(async () => {
    if (!canRank) return []
    const rows = await fetchLeaderboard()
    setLeaderboardRows(rows)
    setLeaderboardLoaded(true)
    setChampion(rows[0] ?? null)
    return rows
  }, [canRank, fetchLeaderboard])

  useEffect(() => { refreshLeaderboard().catch(() => {}) }, [refreshLeaderboard])

  const snapshotPreRunBest = useCallback(() => {
    if (!telegramId) { preRunBest.current = 0; return }
    const me = leaderboardRows.find((row) => String(row.user_id) === String(telegramId))
    preRunBest.current = canRank && !leaderboardLoaded ? Number.POSITIVE_INFINITY : me ? Number(me.score) || 0 : 0
  }, [canRank, leaderboardLoaded, leaderboardRows])

  const sendBeatNotify = useCallback(async (myScore: number) => {
    if (!canRank || !telegramId || !events.canEmit || myScore <= preRunBest.current) return
    try {
      const fresh = await refreshLeaderboard()
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
          message: { template: locale === 'zh' ? `{sender_name} 刚刚以 ${Math.round(myScore)} 分超过了你在《挤下地铁》中的纪录。` : `{sender_name} squeezed past your record with ${Math.round(myScore)} points on Get Off the Train!`, variables: ['sender_name'] },
        }],
      })
    } catch { /* leaderboard notifications never block results */ }
  }, [canRank, events, refreshLeaderboard])

  const restartRun = useCallback(() => {
    sound.unlock()
    snapshotPreRunBest()
    input.current = { x: 0, z: 0 }
    setLevel(0); setScore(0); setLevelScore(0); setTotalFalls(0)
    setLevelCoins(0); setShowCollection(false)
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
      setLevelCoins(0)
      const finalScore = score
      setBest((old) => { const value = Math.max(old, finalScore); localStorage.setItem(BEST_KEY, String(value)); return value })
      submitScore(finalScore).then(() => sendBeatNotify(finalScore)).catch(() => {})
      setPhase('game-over')
      return
    }
    const earned = Math.ceil(data.timeLeft * 100) + 1000 + Math.max(0, 3 - data.falls) * 250 + level * 120
    const earnedCoins = 30 + Math.min(level + 1, 10) * 5 + (data.falls === 0 ? 10 : 0)
    setLevelScore(earned)
    setLevelCoins(earnedCoins)
    setScore((current) => current + earned)
    if (collectionMirror) {
      const nextCollection = { ...collectionMirror, coins: collectionMirror.coins + earnedCoins }
      setCollectionMirror(nextCollection)
      persist(nextCollection)
      sound.coins()
    }
    setPhase('level-clear')
  }, [collectionMirror, level, persist, score, sendBeatNotify, submitScore, totalFalls])

  useEffect(() => {
    if (!QA_FAIL_AFTER || !runStarted || phase !== 'playing') return
    const timer = window.setTimeout(() => handleOutcome('fail', { timeLeft: config.time, falls: 0 }), QA_FAIL_AFTER * 1000)
    return () => window.clearTimeout(timer)
  }, [config.time, handleOutcome, phase, runStarted])

  const nextLevel = () => {
    const next = level + 1
    setLevel(next)
    setHud({ ...initialHud, timeLeft: getLevelConfig(next).time })
    setShowCollection(false)
    setPhase('playing')
  }

  const openCollection = () => {
    sound.tap()
    setPreviewHero(selectedHero)
    // Mount after the opening pointer gesture finishes so its trailing click
    // cannot land on a newly-created character card underneath the finger.
    window.setTimeout(() => setShowCollection(true), 0)
  }

  const chooseHero = (hero: HeroId) => {
    if (!collectionMirror) return
    const owned = collectionMirror.unlocked.includes(hero)
    const price = HERO_COSTS[hero]
    if (!owned && collectionMirror.coins < price) return
    const nextCollection: CollectionSave = {
      ...collectionMirror,
      coins: owned ? collectionMirror.coins : collectionMirror.coins - price,
      unlocked: owned ? collectionMirror.unlocked : [...collectionMirror.unlocked, hero],
      selected: hero,
    }
    setCollectionMirror(nextCollection)
    persist(nextCollection)
    owned ? sound.equip() : sound.unlockHero()
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
      <TrainScene key={level} level={level} heroId={selectedHero} config={config} active={phase === 'playing' && runStarted} input={input} reducedMotion={reducedMotion} onHud={setHud} onOutcome={handleOutcome} />
      <div className="got__halftone" aria-hidden="true" />
      <div className="got__frame" aria-hidden="true" />

      <div className={`got-timer${hud.timeLeft < 5 ? ' is-danger' : ''}`} role="timer" aria-label={`${t('time')} ${Math.ceil(hud.timeLeft)}, ${t('distance')} ${hud.distance.toFixed(1)} ${t('meters')}`}>
        <div className="got-timer__time"><strong>{Math.ceil(hud.timeLeft)}</strong><small>s</small></div>
        <span className="got-timer__distance">{t('distance')} {hud.distance.toFixed(1)}{t('meters')}</span>
      </div>
      {showGuide && <div className="got-mission" role="status"><TrainIcon size={16} /><span>{t('mission')}</span></div>}
      {!showGuide && <div key={`level-intro-${level}`} className="got-level-intro" aria-hidden="true"><TrainIcon size={17} /><b>{String(level + 1).padStart(2, '0')} · {copy.name}</b></div>}
      <button className="got-pause" aria-label={t('pause')} onPointerDown={pause}><PauseIcon /></button>

      {phase === 'playing' && (
        <>
          {hud.swayWarning && <div className="got-warning"><span>{hud.swayDirection > 0 ? t('right') : t('left')}</span><strong>{t('warning')}</strong></div>}
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
                {phase === 'level-clear' && <div><span>{t('coinReward')}</span><strong className="got-stats__coins"><CoinIcon size={18} />+{levelCoins}</strong></div>}
                <div><span>{t('falls')}</span><strong>{totalFalls}</strong></div>
                <div><span>{t('totalScore')}</span><strong>{score}</strong></div>
                {phase === 'game-over' && <div><span>{t('best')}</span><strong>{Math.max(best, score)}</strong></div>}
              </div>
            )}
            {phase === 'paused' && <ActionButton onPress={() => setPhase('playing')}>{t('resume')} <ArrowIcon /></ActionButton>}
            {phase === 'level-clear' && <ActionButton onPress={nextLevel}>{t('next')} <ArrowIcon /></ActionButton>}
            {phase === 'game-over' && <ActionButton onPress={restartRun}>{t('retry')} <ArrowIcon /></ActionButton>}
            <ChampionPill champion={champion} onOpen={() => setShowBoard(true)} />
            <button className="got-btn got-btn--secondary" onClick={openCollection}><CollectionIcon />{t('collection')}<span className="got-btn__balance"><CoinIcon size={16} />{collectionMirror?.coins ?? 0}</span></button>
            {phase === 'paused' && <ActionButton secondary onPress={restartRun}>{t('restart')}</ActionButton>}
            {phase === 'paused' && <ActionButton secondary onPress={() => setReducedMotion((value) => !value)}>{t('reduced')}</ActionButton>}
          </section>
        </div>
      )}

      {showBoard && <Leaderboard fetchEntries={fetchLeaderboard} onClose={() => setShowBoard(false)} />}
      {showCollection && (
        <CollectionShop
          coins={collectionMirror?.coins ?? 0}
          unlocked={collectionMirror?.unlocked ?? ['commuter']}
          selected={collectionMirror?.selected ?? 'commuter'}
          preview={previewHero}
          loading={!collectionMirror}
          onPreview={setPreviewHero}
          onChoose={chooseHero}
          onClose={() => setShowCollection(false)}
        />
      )}
      <span className="got__brand" aria-hidden="true">AIGRAM // {locale.toUpperCase()}</span>
    </main>
  )
}
