import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import TrainScene from './game/TrainScene'
import { getLevelConfig, type HudState, type InputVector, type LevelConfig, type Phase, type StationEvent } from './game/types'
import { HERO_COSTS, HERO_IDS, type HeroId } from './game/models'
import { sound } from './audio/sound'
import { locale, t } from './i18n'
import { ArrowIcon, CoinIcon, CollectionIcon, CrownIcon, MutedIcon, PauseIcon, SoundIcon, TrainIcon } from './ui/Icons'
import { Joystick } from './ui/Joystick'
import { CrazyGamesFrame } from './ui/CrazyGamesFrame'
import { useGuestDesk } from './ui/cg/desk'
import { CgChip, CgCoach, CgLadder, CgLegend, CgNext, CgPoster, CgUpgrades } from './ui/cg/Chrome'
import { pocketMultiplier, readBestClear, readBestStage, readUpgrades, upgradeCost, writeBestClear, writeBestStage, writeUpgrades, EMPTY_UPGRADES, type UpgradeId } from './ui/cg/progress'
import { useCoach } from './ui/cg/tutorial'
import { useCgKeys } from './ui/cg/useCgKeys'
import { CollectionShop } from './ui/CollectionShop'
import { Leaderboard } from './shared/leaderboard/Leaderboard'
import { useGameScore, type LeaderboardEntry } from './shared/leaderboard/useGameScore'
import { getTelegramId, useGameEvent, isInAigramNow, isCrazyGamesBuild } from './shared/runtime'
import { useGameSave } from './shared/save'

const BEST_KEY = 'get-off-the-train.best.v1'
const POSTER_URL = 'https://yinxinghuan.github.io/games/posters/get-off-the-train.png'
const QA_LEVEL = import.meta.env.DEV ? Math.max(0, Number(new URLSearchParams(location.search).get('qaLevel') || 1) - 1) : 0
const QA_AUTORUN = import.meta.env.DEV && new URLSearchParams(location.search).has('qaRun')
const QA_ACTIVE = import.meta.env.DEV && (new URLSearchParams(location.search).has('qaLevel') || QA_AUTORUN)
const qaHeroParam = import.meta.env.DEV ? new URLSearchParams(location.search).get('qaHero') : null
const QA_HERO = qaHeroParam && HERO_IDS.includes(qaHeroParam as HeroId) ? qaHeroParam as HeroId : null
const QA_SCORE = import.meta.env.DEV ? Math.max(0, Number(new URLSearchParams(location.search).get('qaScore') || 0)) : 0
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
const EN_SPECIAL: Partial<Record<StationEvent, [string, string]>> = {
  police: ['POLICE SPECIAL', 'Something at the last stop was just sealed off.'],
  pig: ['PIG EXCURSION', 'The farm tour seems to have boarded the wrong train.'],
  zombie: ['ZOMBIE LAST TRAIN', 'The lights went out at the previous station.'],
  inflow: ['INBOUND SURGE', 'The green door keeps pouring people into your path.'],
  'all-exit': ['EVERYONE OFF', 'Every passenger is racing for the same door.'],
  rescue: ['RESCUE CREW TRAIN', 'The incident ahead has only just been cleared.'],
  'construction-shift': ['CONSTRUCTION TRAIN', 'The tunnel shift ended with tools still loose.'],
  'office-evac': ['EXECUTIVE TRAIN', 'A nearby tower alarm has just gone silent.'],
  haunted: ['GHOST & SKELETON TRAIN', 'Whatever the event was, it ended after midnight.'],
  'animal-rescue': ['CAT & DOG TRAIN', 'The rescue center is moving tonight.'],
  'robot-expo': ['ROBOT TRAIN', 'The convention center has just emptied.'],
  afterparty: ['PUNK & RAPPER TRAIN', 'The underground show ended minutes ago.'],
  blackout: ['BLACKOUT SECTION', 'Tunnel power failed. One lamp is still alive.'],
  'red-alert': ['RED ALERT', 'No announcement explains why the whole car turned red.'],
  'nurse-train': ['NURSE TRAIN', 'The hospital night shift just changed over.'],
  'firefighter-train': ['FIREFIGHTER TRAIN', 'They have just returned from a call.'],
  'cleaner-train': ['CLEANER TRAIN', 'This car seems to have started cleaning early.'],
  'executive-train': ['EXECUTIVE CHARTER', 'The board meeting ran later than the trains.'],
  'student-train': ['STUDENT TRAIN', 'Every cram school finished at once.'],
  'chef-train': ['CHEF TRAIN', 'The nearby restaurants all closed together.'],
  'security-train': ['SECURITY TRAIN', 'The convention center is changing shifts.'],
  'undead-duo': ['SKELETON & MUMMY TRAIN', 'The museum night shift feels unusual.'],
  'night-creatures': ['VAMPIRE & WEREWOLF TRAIN', 'The moon looks especially full tonight.'],
  'farm-duo': ['COW & SHEEP TRAIN', 'A country farm borrowed the carriage.'],
  'cowboy-viking': ['COWBOY & VIKING TRAIN', 'A history show has just ended.'],
  'courier-rush': ['COURIER TRAIN', 'The final parcels have finally arrived.'],
  'rough-section': ['TYPHOON NIGHT', 'Wind and rain keep shaking the track ahead.'],
  'leak-night': ['LEAKY NIGHT', 'Water is dripping. Watch the puddles underfoot.'],
  'fog-night': ['FOG LAST TRAIN', 'The far doors keep fading into the mist.'],
}

function guestEase(config: LevelConfig, level: number): LevelConfig {
  // Car 01 is a long, forgiving clock. Each later car, including car 06 onward, steps down.
  const steps: Array<Partial<LevelConfig>> = [
    { time: 15, passengers: 7, alightingCount: 1, boardingCount: 0, fallChance: 0.04, swayFallChance: 0.06, impulse: 1.25, roll: 1.4, warning: 1.35, wander: 0.34, swayPeriod: 7.2 },
    { time: 14, passengers: 8, alightingCount: 2, boardingCount: 1, fallChance: 0.06, swayFallChance: 0.08, impulse: 1.5, roll: 1.65, warning: 1.15, wander: 0.4, swayPeriod: 6.6 },
    { time: 13, passengers: 9, alightingCount: 2, boardingCount: 1, fallChance: 0.07, swayFallChance: 0.09, impulse: 1.7, roll: 1.9, warning: 1.05, wander: 0.46, swayPeriod: 6.1 },
    { time: 12.5, passengers: 10, alightingCount: 2, boardingCount: 1, fallChance: 0.08, swayFallChance: 0.11, impulse: 1.9, roll: 2.1, warning: 0.95, wander: 0.52, swayPeriod: 5.7 },
    { time: 12, passengers: 12, alightingCount: 3, boardingCount: 2, fallChance: 0.1, swayFallChance: 0.13, impulse: 2.1, roll: 2.3, warning: 0.85, wander: 0.58, swayPeriod: 5.3 },
  ]
  const named = steps[level]
  if (named) return { ...config, ...named }
  const extra = level - (steps.length - 1)
  const last = steps[steps.length - 1]
  return {
    ...config,
    time: Math.max(8, 11 - (level - 5) * 0.5),
    passengers: Math.min(18, (last.passengers ?? 13) + extra),
    alightingCount: Math.min(6, (last.alightingCount ?? 3) + Math.floor(extra / 2)),
    boardingCount: Math.min(4, (last.boardingCount ?? 2) + Math.floor(extra / 3)),
    fallChance: Math.min(0.22, (last.fallChance ?? 0.11) + extra * 0.015),
    swayFallChance: Math.min(0.28, (last.swayFallChance ?? 0.14) + extra * 0.015),
    impulse: Math.min(3.4, (last.impulse ?? 2.15) + extra * 0.12),
    roll: Math.min(4, (last.roll ?? 2.4) + extra * 0.12),
    warning: Math.max(0.55, (last.warning ?? 0.8) - extra * 0.04),
    wander: Math.min(1, (last.wander ?? 0.6) + extra * 0.04),
    swayPeriod: Math.max(3.8, (last.swayPeriod ?? 5.2) - extra * 0.18),
  }
}

function levelCopy(index: number, config: ReturnType<typeof getLevelConfig>) {
  if (locale === 'zh') return { name: config.name, subtitle: config.subtitle }
  if (EN_LEVELS[index]) return { name: EN_LEVELS[index][0], subtitle: EN_LEVELS[index][1] }
  const special = EN_SPECIAL[config.stationEvent]
  if (special) return { name: special[0], subtitle: special[1] }
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
  const config = useMemo(() => {
    const base = getLevelConfig(level)
    return isCrazyGamesBuild ? guestEase(base, level) : base
  }, [level])
  const copy = levelCopy(level, config)
  const [hud, setHud] = useState(initialHud)
  const [score, setScore] = useState(QA_SCORE)
  const [levelScore, setLevelScore] = useState(0)
  const [totalFalls, setTotalFalls] = useState(0)
  const [best, setBest] = useState(() => Number(alteruLocalStorage.getItem(BEST_KEY) || 0))
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
  const desk = useGuestDesk()
  useEffect(() => {
    if (!isCrazyGamesBuild) return
    const apply = () => {
      const next = Math.min(2.16, Math.max(0.84, window.innerHeight / 510))
      document.documentElement.style.setProperty('--cg-s', next.toFixed(3))
    }
    apply()
    window.addEventListener('resize', apply)
    return () => window.removeEventListener('resize', apply)
  }, [])
  const coach = useCoach(hud, phase)
  const [muted, setMuted] = useState(() => sound.isMuted())
  const [bestStage, setBestStage] = useState(() => (isCrazyGamesBuild ? readBestStage() : 0))
  const [bestClear, setBestClear] = useState(() => (isCrazyGamesBuild ? readBestClear() : 0))
  const [upgrades, setUpgrades] = useState(() => (isCrazyGamesBuild ? readUpgrades() : EMPTY_UPGRADES))
  const [runId, setRunId] = useState(0)
  const toggleMute = useCallback(() => { setMuted(sound.toggle()) }, [])
  const rememberStage = useCallback((stage: number) => {
    if (!isCrazyGamesBuild) return
    setBestStage((prev) => {
      const next = Math.max(prev, stage)
      if (next !== prev) writeBestStage(next)
      return next
    })
  }, [])
  const rememberClear = useCallback((car: number) => {
    if (!isCrazyGamesBuild) return
    setBestClear((prev) => {
      const next = Math.max(prev, car)
      if (next !== prev) writeBestClear(next)
      return next
    })
  }, [])

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

  useEffect(() => { if (!isInAigramNow()) return; refreshLeaderboard().catch(() => {}) }, [refreshLeaderboard])

  const snapshotPreRunBest = useCallback(() => {
    if (!getTelegramId()!) { preRunBest.current = 0; return }
    const me = leaderboardRows.find((row) => String(row.user_id) === String(getTelegramId()!))
    preRunBest.current = canRank && !leaderboardLoaded ? Number.POSITIVE_INFINITY : me ? Number(me.score) || 0 : 0
  }, [canRank, leaderboardLoaded, leaderboardRows])

  const sendBeatNotify = useCallback(async (myScore: number) => {
    if (!canRank || !getTelegramId()! || !events.canEmit || myScore <= preRunBest.current) return
    try {
      const fresh = await refreshLeaderboard()
      const meId = String(getTelegramId()!)
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
    if (isCrazyGamesBuild) { sound.resumeLoop(); setRunId((n) => n + 1) }
    snapshotPreRunBest()
    input.current = { x: 0, z: 0 }
    setLevel(0); setScore(0); setLevelScore(0); setTotalFalls(0)
    setLevelCoins(0); setShowCollection(false)
    setHud({ ...initialHud, timeLeft: getLevelConfig(0).time })
    setRunStarted(true)
    setShowGuide(false)
    setPhase('playing')
  }, [snapshotPreRunBest])

  const beginAt = useCallback((index: number) => {
    sound.unlock()
    sound.resumeLoop()
    setRunId((n) => n + 1)
    snapshotPreRunBest()
    input.current = { x: 0, z: 0 }
    setLevel(Math.max(0, index))
    setScore(0); setLevelScore(0); setTotalFalls(0)
    setLevelCoins(0); setShowCollection(false)
    setHud({ ...initialHud, timeLeft: getLevelConfig(Math.max(0, index)).time })
    setRunStarted(true)
    setShowGuide(false)
    setPhase('playing')
  }, [snapshotPreRunBest])

  const buyUpgrade = useCallback((id: UpgradeId) => {
    if (!isCrazyGamesBuild || !collectionMirror) return
    const cost = upgradeCost(upgrades[id])
    if (cost == null || collectionMirror.coins < cost) return
    const nextUpgrades = { ...upgrades, [id]: upgrades[id] + 1 }
    setUpgrades(nextUpgrades)
    writeUpgrades(nextUpgrades)
    const nextCollection = { ...collectionMirror, coins: collectionMirror.coins - cost }
    setCollectionMirror(nextCollection)
    persist(nextCollection)
    sound.tap()
  }, [collectionMirror, persist, upgrades])

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
      if (isCrazyGamesBuild) {
        const earnedCoins = Math.round((18 + level * 10) * pocketMultiplier(upgrades.pocket))
        setLevelCoins(earnedCoins)
        rememberStage(level + 1)
        if (collectionMirror) {
          const nextCollection = { ...collectionMirror, coins: collectionMirror.coins + earnedCoins }
          setCollectionMirror(nextCollection)
          persist(nextCollection)
          sound.coins()
        }
      } else {
        setLevelCoins(0)
      }
      const finalScore = score
      setBest((old) => { const value = Math.max(old, finalScore); alteruLocalStorage.setItem(BEST_KEY, String(value)); return value })
      submitScore(finalScore).then(() => sendBeatNotify(finalScore)).catch(() => {})
      setPhase('game-over')
      return
    }
    const earned = Math.ceil(data.timeLeft * 100) + 1000 + Math.max(0, 3 - data.falls) * 250 + level * 120
    const baseCoins = 30 + Math.min(level + 1, 10) * 5 + (data.falls === 0 ? 10 : 0)
    const earnedCoins = isCrazyGamesBuild ? Math.round(baseCoins * pocketMultiplier(upgrades.pocket)) : baseCoins
    setLevelScore(earned)
    setLevelCoins(earnedCoins)
    setScore((current) => current + earned)
    if (collectionMirror) {
      const nextCollection = { ...collectionMirror, coins: collectionMirror.coins + earnedCoins }
      setCollectionMirror(nextCollection)
      persist(nextCollection)
      sound.coins()
    }
    if (isCrazyGamesBuild) { rememberStage(level + 1); rememberClear(level + 1) }
    setPhase('level-clear')
  }, [collectionMirror, level, persist, rememberClear, rememberStage, score, sendBeatNotify, submitScore, totalFalls, upgrades.pocket])

  const handleFailureStart = useCallback(() => {
    input.current = { x: 0, z: 0 }
    setPhase('fail-cinematic')
  }, [])

  const nextLevel = () => {
    const next = level + 1
    setLevel(next)
    setHud({ ...initialHud, timeLeft: getLevelConfig(next).time })
    setShowCollection(false)
    setPhase('playing')
    if (isCrazyGamesBuild) sound.resumeLoop()
    rememberStage(next + 1)
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

  const replayTips = () => {
    coach.replay()
    restartRun()
    setRunStarted(false)
    setShowGuide(true)
  }

  const panelActions = (
    <>
      {phase === 'paused' && <ActionButton onPress={() => setPhase('playing')}>{t('resume')} <ArrowIcon /></ActionButton>}
      {phase === 'level-clear' && <ActionButton onPress={nextLevel}>{t('next')} <ArrowIcon /></ActionButton>}
      {phase === 'game-over' && <ActionButton onPress={restartRun}>{t('retry')} <ArrowIcon /></ActionButton>}
      <ChampionPill champion={champion} onOpen={() => setShowBoard(true)} />
      <button className="got-btn got-btn--secondary" onClick={openCollection}><CollectionIcon />{t('collection')}<span className="got-btn__balance"><CoinIcon size={16} />{collectionMirror?.coins ?? 0}</span></button>
      {phase === 'paused' && <ActionButton secondary onPress={restartRun}>{t('restart')}</ActionButton>}
      {phase === 'paused' && isCrazyGamesBuild && <ActionButton secondary onPress={replayTips}>REPLAY TIPS</ActionButton>}
      {phase === 'paused' && <ActionButton secondary onPress={() => setReducedMotion((value) => !value)}>{t('reduced')}</ActionButton>}
    </>
  )

  useCgKeys(input, {
    phase,
    showGuide,
    showBoard,
    showCollection,
    coach: coach.step,
    beginFromInput,
    pause,
    resume: () => setPhase('playing'),
    nextLevel,
    restartRun,
    toggleMute,
    advanceCoach: coach.advance,
  })

  useEffect(() => {
    if (!isCrazyGamesBuild) return
    const arm = () => sound.unlock()
    window.addEventListener('pointerdown', arm)
    window.addEventListener('keydown', arm)
    return () => {
      window.removeEventListener('pointerdown', arm)
      window.removeEventListener('keydown', arm)
    }
  }, [])

  useEffect(() => {
    if (isCrazyGamesBuild) return
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
    <>
    {isCrazyGamesBuild && <CrazyGamesFrame />}
    <main className={`got${hud.swayWarning ? ' got--warning' : ''}${phase === 'fail-cinematic' ? ' got--failure-shot' : ''}${phase === 'game-over' ? ' got--failed' : ''}${isCrazyGamesBuild ? ' got--cg' : ''}${desk ? ' got--desk' : ''}`}>
      <TrainScene key={isCrazyGamesBuild ? `${level}:${runId}` : level} level={level} heroId={selectedHero} config={config} active={(phase === 'playing' || phase === 'fail-cinematic') && runStarted} input={input} reducedMotion={reducedMotion} onHud={setHud} onFailureStart={handleFailureStart} onOutcome={handleOutcome} desk={desk} rateStable={isCrazyGamesBuild} coachStep={coach.step} upgrades={isCrazyGamesBuild ? upgrades : undefined} />
      <div className="got__halftone" aria-hidden="true" />
      <div className="got__frame" aria-hidden="true" />

      {phase !== 'fail-cinematic' && isCrazyGamesBuild && (
        <div className="cg-stack">
          <div className={`got-timer${hud.timeLeft < 5 ? ' is-danger' : ''}`} role="timer" aria-label={`${t('time')} ${Math.ceil(hud.timeLeft)}, ${t('distance')} ${hud.distance.toFixed(1)} ${t('meters')}`}>
            <div className="got-timer__time"><strong>{Math.ceil(hud.timeLeft)}</strong><small>s</small></div>
            <span className="got-timer__distance">{t('distance')} {hud.distance.toFixed(1)}{t('meters')}</span>
          </div>
          {phase === 'playing' && <CgChip coins={collectionMirror?.coins ?? 0} unlocked={collectionMirror?.unlocked ?? ['commuter']} upgrades={upgrades} />}
        </div>
      )}
      {phase !== 'fail-cinematic' && !isCrazyGamesBuild && <div className={`got-timer${hud.timeLeft < 5 ? ' is-danger' : ''}`} role="timer" aria-label={`${t('time')} ${Math.ceil(hud.timeLeft)}, ${t('distance')} ${hud.distance.toFixed(1)} ${t('meters')}`}>
        <div className="got-timer__time"><strong>{Math.ceil(hud.timeLeft)}</strong><small>s</small></div>
        <span className="got-timer__distance">{t('distance')} {hud.distance.toFixed(1)}{t('meters')}</span>
      </div>}
      {showGuide && !isCrazyGamesBuild && <div className="got-mission" role="status"><TrainIcon size={16} /><span>{t('mission')}</span></div>}
      {isCrazyGamesBuild && phase === 'playing' && (
        <div key={`cg-stage-${level}`} className="cg-stage" aria-hidden="true">
          <em>CAR {String(level + 1).padStart(2, '0')}</em>
          <strong>{copy.name}</strong>
          <small>{copy.subtitle}</small>
        </div>
      )}
      {!showGuide && !isCrazyGamesBuild && (
        <div key={`level-intro-${level}`} className={`got-level-intro${config.stationEvent === 'normal' ? '' : ` got-level-intro--special got-level-intro--${config.stationEvent}`}`} aria-hidden="true">
          <TrainIcon size={17} />
          {config.stationEvent === 'normal' ? <b>{String(level + 1).padStart(2, '0')} · {copy.name}</b> : (
            <span className="got-level-intro__copy">
              <em>{t('specialStation')}</em>
              <b>{copy.name}</b>
              <small>{copy.subtitle}</small>
            </span>
          )}
        </div>
      )}
      {isCrazyGamesBuild && phase !== 'fail-cinematic' && (
        <div className="cg-tools">
          <div className="cg-vol">
            <button type="button" aria-label="Quieter" onPointerDown={(ev) => { ev.preventDefault(); ev.stopPropagation(); sound.unlock(); sound.nudgeVolume(-0.15) }}>−</button>
            <button type="button" className="cg-mute" aria-label={muted ? 'Unmute' : 'Mute'} onPointerDown={(ev) => { ev.preventDefault(); ev.stopPropagation(); sound.unlock(); toggleMute() }}>{muted ? <MutedIcon /> : <SoundIcon />}</button>
            <button type="button" aria-label="Louder" onPointerDown={(ev) => { ev.preventDefault(); ev.stopPropagation(); sound.unlock(); sound.nudgeVolume(0.15) }}>+</button>
          </div>
          <button className="got-pause" aria-label={t('pause')} onPointerDown={pause}><PauseIcon /></button>
        </div>
      )}
      {!isCrazyGamesBuild && phase !== 'fail-cinematic' && <button className="got-pause" aria-label={t('pause')} onPointerDown={pause}><PauseIcon /></button>}

      {phase === 'fail-cinematic' && <div className="got-fail-shot" role="status" aria-live="assertive"><span>{t('doorsClosed')}</span></div>}

      {phase === 'playing' && (
        <>
          {hud.swayWarning && <div className="got-warning"><span>{hud.swayDirection > 0 ? t('right') : t('left')}</span><strong>{t('warning')}</strong></div>}
          <Joystick input={input} enabled={phase === 'playing'} showGuide={showGuide && !isCrazyGamesBuild} onFirstInput={beginFromInput} />
          {coach.step && <CgCoach step={coach.step} onSkip={() => { sound.tap(); coach.skip() }} />}
          {!coach.step && desk && <CgLegend />}
        </>
      )}

      {(phase === 'paused' || phase === 'level-clear' || phase === 'game-over') && (
        <div className="got-overlay">
          <section className={`got-panel got-panel--${phase}`}>
            {!(isCrazyGamesBuild && phase !== 'paused') && <span className="got-panel__eyebrow">{phase === 'paused' ? `${t('level')} ${level + 1}` : copy.name}</span>}
            {!(isCrazyGamesBuild && phase !== 'paused') && <h2>{phase === 'paused' ? t('pause') : phase === 'level-clear' ? t('clear') : t('miss')}</h2>}
            {phase !== 'paused' && !isCrazyGamesBuild && <p>{phase === 'level-clear' ? t('clearCopy') : t('missCopy')}</p>}
            {phase !== 'paused' && !isCrazyGamesBuild && (
              <div className="got-stats">
                {phase === 'level-clear' && <div><span>{t('remaining')}</span><strong>{hud.timeLeft.toFixed(1)}s</strong></div>}
                {phase === 'level-clear' && <div><span>{t('levelScore')}</span><strong>{levelScore}</strong></div>}
                {phase === 'level-clear' && <div><span>{t('coinReward')}</span><strong className="got-stats__coins"><CoinIcon size={18} />+{levelCoins}</strong></div>}
                <div><span>{t('falls')}</span><strong>{totalFalls}</strong></div>
                <div><span>{t('totalScore')}</span><strong>{score}</strong></div>
                {phase === 'game-over' && <div><span>{t('best')}</span><strong>{Math.max(best, score)}</strong></div>}
              </div>
            )}
            {phase !== 'paused' && isCrazyGamesBuild && (
              <div className="cg-result__main">
                <span className="got-panel__eyebrow">{copy.name}</span>
                <h2>{phase === 'level-clear' ? t('clear') : t('miss')}</h2>
                <div className="cg-metrics">
                  <span><small>CAR</small><b>{String(level + 1).padStart(2, '0')}</b></span>
                  <span><small>BEST CAR</small><b>{String(Math.max(bestStage, level + 1)).padStart(2, '0')}</b></span>
                  <span><small>{t('falls')}</small><b>{totalFalls}</b></span>
                  <span><small>BEST SCORE</small><b>{Math.max(best, score)}</b></span>
                </div>
                <div className="cg-reward"><CoinIcon size={22} /><b>+{levelCoins}</b><small>COINS</small></div>
                <CgLadder bestClear={bestClear} />
                <CgUpgrades coins={collectionMirror?.coins ?? 0} upgrades={upgrades} onBuy={buyUpgrade} />
                {phase === 'game-over' && <CgNext bestClear={bestClear} onStart={beginAt} />}
              </div>
            )}
            {isCrazyGamesBuild ? (
              <div className="got-panel__actions">
                {phase !== 'paused' && <CgPoster made={phase === 'level-clear'} car={level + 1} name={copy.name} spare={hud.timeLeft} />}
                {panelActions}
              </div>
            ) : panelActions}
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
      {!isCrazyGamesBuild && <span className="got__brand" aria-hidden="true">AIGRAM // {locale.toUpperCase()}</span>}
    </main>
    </>
  )
}
