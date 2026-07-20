import { Canvas, useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import type { CSSProperties } from 'react'
import * as THREE from 'three'
import { HERO_COLORS, HERO_COSTS, HERO_IDS, makePlayer, type HeroId } from '../game/models'
import { heroName, t } from '../i18n'
import { CloseIcon, CoinIcon, LockIcon } from './Icons'

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

function PreviewHero({ heroId }: { heroId: HeroId }) {
  const root = useRef<THREE.Group>(null)
  const hero = useMemo(() => makePlayer(heroId), [heroId])
  useEffect(() => () => {
    hero.traverse((object) => {
      const mesh = object as THREE.Mesh
      if (mesh.geometry) mesh.geometry.dispose()
    })
  }, [hero])
  useFrame(({ clock }, dt) => {
    if (!root.current) return
    root.current.rotation.y += dt * 0.42
    root.current.position.y = -0.38 + Math.abs(Math.sin(clock.elapsedTime * 2.7)) * 0.04
  })
  return <group ref={root} scale={1.55}><primitive object={hero} dispose={null} /></group>
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

  return (
    <div className="got-collection" role="dialog" aria-modal="true" aria-label={t('collection')}>
      <section className="got-collection__panel">
        <header className="got-collection__header">
          <div><h2>{t('collection')}</h2><p>{t('collectionHint')}</p></div>
          <span className="got-collection__coins"><CoinIcon size={17} /><b>{coins}</b></span>
          <button className="got-collection__close" aria-label={t('closeCollection')} onClick={onClose}><CloseIcon /></button>
        </header>

        <div className="got-collection__preview" style={{ '--hero-color': HERO_COLORS[preview] } as CSSProperties}>
          <Canvas camera={{ position: [3.1, 2.8, 4.2], fov: 34 }} dpr={[1, 1.4]} gl={{ alpha: true, antialias: true }}>
            <ambientLight intensity={1.25} />
            <directionalLight position={[3, 5, 4]} intensity={2.3} color={0xffedc7} />
            <directionalLight position={[-3, 2, -2]} intensity={0.85} color={0x8bd5cd} />
            <PreviewHero heroId={preview} />
          </Canvas>
          <div className="got-collection__identity"><span>{heroCategory(preview)}</span><strong>{heroName(preview)}</strong></div>
        </div>

        <div className="got-collection__grid">
          {HERO_IDS.map((hero) => {
            const owned = unlocked.includes(hero)
            const active = hero === preview
            const equipped = hero === selected
            return (
              <button
                key={hero}
                type="button"
                className={`got-hero-card${active ? ' is-active' : ''}${equipped ? ' is-equipped' : ''}`}
                onClick={() => onPreview(hero)}
                aria-pressed={active}
              >
                <span className="got-hero-card__swatch" style={{ background: HERO_COLORS[hero] }} aria-hidden="true" />
                <span className="got-hero-card__copy"><b>{heroName(hero)}</b><small>{heroCategory(hero)}</small></span>
                <span className="got-hero-card__state">
                  {equipped ? t('equipped') : owned ? t('owned') : <><LockIcon size={13} />{HERO_COSTS[hero]}</>}
                </span>
              </button>
            )
          })}
        </div>

        <button className="got-btn got-collection__action" disabled={disabled || selected === preview} onPointerDown={() => onChoose(preview)}>
          {!isUnlocked && shortfall === 0 && <CoinIcon size={20} />}{actionLabel}
        </button>
      </section>
    </div>
  )
}
