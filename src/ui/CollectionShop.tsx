import { Canvas, useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import type { CSSProperties } from 'react'
import * as THREE from 'three'
import { HERO_COLORS, HERO_COSTS, HERO_IDS, makePlayer, type HeroId } from '../game/models'
import { heroName, t } from '../i18n'
import { ChevronIcon, CloseIcon, CoinIcon, LockIcon } from './Icons'

interface Props {
  coins: number
  unlocked: HeroId[]
  selected: HeroId
  preview: HeroId
  loading: boolean
  onPreview: (hero: HeroId) => void
  onChoose: (hero: HeroId) => void
  onClose: () => void
}

function heroCategory(hero: HeroId) {
  if (hero === 'cat' || hero === 'dog') return t('animal')
  if (hero === 'zombie' || hero === 'vampire') return t('monster')
  return t('human')
}

function PreviewHero({ heroId, side }: { heroId: HeroId; side: -1 | 0 | 1 }) {
  const root = useRef<THREE.Group>(null)
  const hero = useMemo(() => {
    const model = makePlayer(heroId)
    // The in-game hero carries a navigation light. Studio previews use only
    // the shared three-point rig so neighboring models cannot light each other.
    model.traverse((object) => {
      if (object instanceof THREE.Light) object.visible = false
    })
    return model
  }, [heroId])
  useEffect(() => () => {
    hero.traverse((object) => {
      const mesh = object as THREE.Mesh
      if (mesh.geometry) mesh.geometry.dispose()
    })
  }, [hero])
  useFrame(({ clock }, dt) => {
    if (!root.current) return
    if (side === 0) root.current.rotation.y += dt * 0.36
    root.current.position.y = -0.53 + Math.abs(Math.sin(clock.elapsedTime * 2.7 + side)) * (side === 0 ? 0.055 : 0.025)
  })
  return (
    <group ref={root} position={[side * 1.55, -0.53, side === 0 ? 0.25 : -0.45]} scale={side === 0 ? 1.72 : 0.92}>
      <primitive object={hero} dispose={null} />
    </group>
  )
}

function HeroStage({ preview }: { preview: HeroId }) {
  const index = HERO_IDS.indexOf(preview)
  const previous = HERO_IDS[(index - 1 + HERO_IDS.length) % HERO_IDS.length]
  const next = HERO_IDS[(index + 1) % HERO_IDS.length]
  return <><PreviewHero heroId={previous} side={-1} /><PreviewHero heroId={preview} side={0} /><PreviewHero heroId={next} side={1} /></>
}

export function CollectionShop({ coins, unlocked, selected, preview, loading, onPreview, onChoose, onClose }: Props) {
  const isUnlocked = unlocked.includes(preview)
  const price = HERO_COSTS[preview]
  const shortfall = Math.max(0, price - coins)
  const disabled = loading || (!isUnlocked && shortfall > 0)
  const actionLabel = loading
    ? t('saving')
    : selected === preview
      ? t('equipped')
      : isUnlocked
        ? t('equip')
        : shortfall > 0
          ? `${t('needCoins')} ${shortfall}`
          : `${t('unlock')} · ${price}`
  const currentIndex = HERO_IDS.indexOf(preview)
  const move = (direction: -1 | 1) => {
    const nextIndex = (currentIndex + direction + HERO_IDS.length) % HERO_IDS.length
    onPreview(HERO_IDS[nextIndex])
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
      event.preventDefault()
      move(event.key === 'ArrowLeft' ? -1 : 1)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })

  return (
    <div className="got-collection" role="dialog" aria-modal="true" aria-label={t('collection')}>
      <section className="got-collection__panel">
        <header className="got-collection__header">
          <div><h2>{t('collection')}</h2><p>{t('collectionHint')}</p></div>
          <span className="got-collection__coins"><CoinIcon size={17} /><b>{coins}</b></span>
          <button className="got-collection__close" aria-label={t('closeCollection')} onClick={onClose}><CloseIcon /></button>
        </header>

        <div className="got-collection__stage" style={{ '--hero-color': HERO_COLORS[preview] } as CSSProperties}>
          <div className="got-collection__platform" aria-hidden="true" />
          <Canvas camera={{ position: [0, 2.35, 6.2], fov: 35 }} dpr={[1, 1.45]} gl={{ alpha: true, antialias: true }} onCreated={({ gl }) => { gl.toneMapping = THREE.ACESFilmicToneMapping; gl.toneMappingExposure = 0.96 }}>
            <hemisphereLight args={[0xffedd1, 0x443b46, 0.32]} />
            <directionalLight position={[3, 5, 4]} intensity={1.35} color={0xffedc7} />
            <directionalLight position={[-3, 2, -2]} intensity={0.38} color={0x8bd5cd} />
            <HeroStage preview={preview} />
          </Canvas>
          <button type="button" className="got-collection__step got-collection__step--prev" onClick={() => move(-1)} aria-label={t('previousHero')}><ChevronIcon /></button>
          <button type="button" className="got-collection__step got-collection__step--next" onClick={() => move(1)} aria-label={t('nextHero')}><ChevronIcon /></button>
          <div className="got-collection__index" aria-label={`${currentIndex + 1} / ${HERO_IDS.length}`}><b>{currentIndex + 1}</b><span>/</span>{HERO_IDS.length}</div>
        </div>

        <div className="got-collection__identity">
          <span>{heroCategory(preview)}</span>
          <strong>{heroName(preview)}</strong>
          <small className={isUnlocked ? 'is-owned' : 'is-locked'}>
            {selected === preview ? t('equipped') : isUnlocked ? t('owned') : <><LockIcon size={14} />{price} {t('coins')}</>}
          </small>
        </div>

        <div className="got-collection__rail" aria-hidden="true">
          {HERO_IDS.map((hero) => <i key={hero} className={hero === preview ? 'is-active' : unlocked.includes(hero) ? 'is-owned' : ''} />)}
        </div>

        <button className="got-btn got-collection__action" disabled={disabled || selected === preview} onClick={() => onChoose(preview)}>
          {!isUnlocked && shortfall === 0 && <CoinIcon size={20} />}{actionLabel}
        </button>
      </section>
    </div>
  )
}
