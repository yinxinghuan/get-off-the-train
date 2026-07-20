import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { PerspectiveCamera } from '@react-three/drei'
import { MutableRefObject, useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { ANIMAL_LIBRARY_IDS, applyPassengerActivity, box, C, cyl, HERO_IDS, HUMAN_LIBRARY_IDS, isBroadLibraryCharacter, isSmallLibraryCharacter, makeLibraryPassenger, makePlayer, makeSeatedLibraryPassenger, MONSTER_LIBRARY_IDS, toon } from './models'
import type { CharacterRig, HeroId, PassengerActivity } from './models'
import type { HudState, InputVector, LevelConfig } from './types'
import { sound } from '../audio/sound'

interface OutcomeData { timeLeft: number; falls: number }
interface Props {
  level: number
  heroId: HeroId
  config: LevelConfig
  active: boolean
  input: MutableRefObject<InputVector>
  reducedMotion: boolean
  onHud: (hud: HudState) => void
  onOutcome: (kind: 'clear' | 'fail', data: OutcomeData) => void
}

interface Body {
  group: THREE.Group
  x: number
  z: number
  vx: number
  vz: number
  r: number
  mass: number
  stability: number
  fallenUntil: number
  fallStarted: number
  fallDuration: number
  fallKind: 'side' | 'forward'
  protectedUntil: number
  phase: number
  homeX: number
  homeZ: number
  targetX: number
  targetZ: number
  nextWander: number
  pauseUntil: number
  wanderSpeed: number
  gaitPhase: number
  lastX: number
  lastZ: number
  player: boolean
  behavior: 'player' | 'stationary' | 'wandering' | 'boarding' | 'exiting' | 'departed'
  exitAt: number
}

interface Obstacle { x: number; z: number; r: number }
interface SeatSlot { x: number; z: number; yaw: number }
interface SeatedVisual {
  group: THREE.Group
  phase: number
  baseY: number
  baseUpperX: number
  x: number
  z: number
  r: number
  seatX: number
  seatZ: number
  aisleZ: number
  state: 'seated' | 'preparing' | 'rising' | 'departed'
  scheduledAt: number
  transitionStarted: number
}

const CAR_MIN_X = -7.65
const CAR_MAX_X = 7.65
const CAR_MIN_Z = -2.42
const CAR_MAX_Z = 2.28
const START_X = -6.45
const START_Z = 0
const EXIT_X = 6.20
const FORWARD_X = 1
const FORWARD_Z = 0
const RIGHT_X = 0
const RIGHT_Z = 1
const QA_AUTORUN = import.meta.env.DEV && new URLSearchParams(location.search).has('qaRun')
const QA_FALL = import.meta.env.DEV && new URLSearchParams(location.search).has('qaFall')
const QA_FALL_KIND = import.meta.env.DEV && new URLSearchParams(location.search).get('qaFall') === 'side' ? 'side' : 'forward'
const QA_WALK = import.meta.env.DEV && new URLSearchParams(location.search).has('qaWalk')
const QA_SEAT_VIEW = import.meta.env.DEV && new URLSearchParams(location.search).has('qaSeatView')
const QA_SEAT_COLLISION = import.meta.env.DEV && new URLSearchParams(location.search).has('qaSeatCollision')
const QA_SEAT_STAND = import.meta.env.DEV && new URLSearchParams(location.search).has('qaSeatStand')
const QA_WRONG_DOOR = import.meta.env.DEV && new URLSearchParams(location.search).has('qaWrongDoor')
const QA_SPEED = import.meta.env.DEV ? THREE.MathUtils.clamp(Number(new URLSearchParams(location.search).get('qaSpeed') || 1), 1, 5) : 1

function mulberry32(seed: number) {
  return () => {
    let t = seed += 0x6D2B79F5
    t = Math.imul(t ^ t >>> 15, t | 1)
    t ^= t + Math.imul(t ^ t >>> 7, t | 61)
    return ((t ^ t >>> 14) >>> 0) / 4294967296
  }
}

function themedPassengerId(config: LevelConfig): HeroId | null {
  if (config.stationEvent === 'police') return 'cop'
  if (config.stationEvent === 'pig') return 'pig'
  if (config.stationEvent === 'zombie') return 'zombie'
  return null
}

function passengerRoster(config: LevelConfig, level: number): readonly HeroId[] {
  const themed = themedPassengerId(config)
  if (themed) return [themed]
  if (config.stationEvent === 'rescue') return ['firefighter', 'paramedic']
  if (config.stationEvent === 'construction-shift') return ['construction', 'worker']
  if (config.stationEvent === 'office-evac') return ['executive', 'officeWoman']
  if (config.stationEvent === 'haunted') return ['ghost', 'skeleton']
  if (config.stationEvent === 'animal-rescue') return ['cat', 'dog']
  if (config.stationEvent === 'robot-expo') return ['combatMech']
  if (config.stationEvent === 'afterparty') return ['punk', 'rapper']
  if (config.stationEvent === 'nurse-train') return ['nurse']
  if (config.stationEvent === 'firefighter-train') return ['firefighter']
  if (config.stationEvent === 'cleaner-train') return ['janitor']
  if (config.stationEvent === 'executive-train') return ['executive']
  if (config.stationEvent === 'student-train') return ['student']
  if (config.stationEvent === 'chef-train') return ['chef']
  if (config.stationEvent === 'security-train') return ['securityGuard']
  if (config.stationEvent === 'undead-duo') return ['skeleton', 'mummy']
  if (config.stationEvent === 'night-creatures') return ['vampire', 'werewolf']
  if (config.stationEvent === 'farm-duo') return ['cow', 'sheep']
  if (config.stationEvent === 'cowboy-viking') return ['cowboy', 'viking']
  if (config.stationEvent === 'courier-rush') return ['courier', 'delivery']
  const ordinary = HUMAN_LIBRARY_IDS.slice(0, 30)
  if (level === 0) return ordinary.slice(0, 15)
  if (level === 1) return ordinary
  if (level === 2) return [...ordinary, ...MONSTER_LIBRARY_IDS]
  return HERO_IDS
}

interface StationLighting {
  background: number
  fog: number
  fogNear: number
  fogFar: number
  sky: number
  ground: number
  hemi: number
  main: number
  mainColor: number
  fill: number
  fillColor: number
  rim: number
  rimColor: number
  lampColor: number
  lampTube: number
  lampStrength: number
  litLamp?: number
}

function stationLighting(event: LevelConfig['stationEvent']): StationLighting {
  const base: StationLighting = { background: 0x111a22, fog: 0x111a22, fogNear: 23, fogFar: 46, sky: 0xffffff, ground: 0x51636b, hemi: 0.55, main: 3.05, mainColor: 0xffffff, fill: 0.18, fillColor: 0xdfe8ff, rim: 0.28, rimColor: 0xfff0d8, lampColor: 0xffdfaa, lampTube: 0xffedbd, lampStrength: 1.24 }
  if (event === 'blackout') return { ...base, background: 0x070a0e, fog: 0x070a0e, sky: 0x26313a, ground: 0x090b0e, hemi: 0.16, main: 0.62, mainColor: 0xa9bac2, fill: 0.04, rim: 0.08, lampColor: 0xffd783, lampTube: 0xffe5a3, lampStrength: 0.92, litLamp: 2 }
  if (event === 'red-alert') return { ...base, background: 0x1b0709, fog: 0x1b0709, sky: 0x7d181c, ground: 0x21080a, hemi: 0.30, main: 1.72, mainColor: 0xd5292e, fill: 0.36, fillColor: 0x7f0f17, rim: 0.34, rimColor: 0xff3a32, lampColor: 0xff2428, lampTube: 0xff4b45, lampStrength: 1.34 }
  if (event === 'police' || event === 'robot-expo') return { ...base, sky: 0xdcecff, mainColor: 0xe5f2ff, fill: 0.28, fillColor: 0x73a8d9, lampColor: 0xc7e5ff, lampTube: 0xe5f4ff }
  if (event === 'rescue' || event === 'construction-shift') return { ...base, mainColor: 0xffe0b2, rim: 0.38, rimColor: 0xff9a4d, lampColor: 0xffbc6a, lampTube: 0xffd391 }
  if (event === 'zombie' || event === 'haunted') return { ...base, background: 0x0d1717, fog: 0x0d1717, sky: 0x8fb99a, ground: 0x23332c, hemi: 0.42, main: 2.35, mainColor: 0xc8e3bc, fillColor: 0x57916d, lampColor: 0x9fcf9b, lampTube: 0xc4e1b4 }
  if (event === 'afterparty') return { ...base, sky: 0xdab9ff, mainColor: 0xf0d6ff, fill: 0.34, fillColor: 0x7651bd, rim: 0.42, rimColor: 0xff68c8, lampColor: 0xc896ff, lampTube: 0xe3c7ff }
  if (event === 'fog-night') return { ...base, background: 0x56656a, fog: 0x718086, fogNear: 5.5, fogFar: 20, sky: 0xc8d4d6, ground: 0x465256, hemi: 0.48, main: 2.55, mainColor: 0xe5efed, fill: 0.30, fillColor: 0x8faeb4, rim: 0.38, rimColor: 0xffe0b4, lampColor: 0xffdeb0, lampTube: 0xffedc9 }
  if (event === 'leak-night') return { ...base, background: 0x0d1820, fog: 0x0d1820, sky: 0xc6dce4, ground: 0x344b54, hemi: 0.48, main: 2.75, mainColor: 0xd6e8eb, fill: 0.28, fillColor: 0x6492a2, rim: 0.32, rimColor: 0xffddb0, lampColor: 0xd5e7e5, lampTube: 0xe8f0e8 }
  return base
}

function addFloorArrow(root: THREE.Group, x: number, z: number, scale = 1, rotationY = 0) {
  const arrow = new THREE.Group()
  const stem = box(0.72 * scale, 0.025, 0.22 * scale, C.yellow, 0, 0, 0)
  const head = new THREE.Mesh(new THREE.ConeGeometry(0.34 * scale, 0.55 * scale, 3), toon(C.yellow))
  head.rotation.z = -Math.PI / 2
  head.position.set(0.55 * scale, 0.015, 0)
  arrow.add(stem, head)
  arrow.traverse((object) => {
    if ((object as THREE.Mesh).isMesh) object.userData.guide = true
  })
  arrow.position.set(x, 0.19, z)
  arrow.rotation.y = rotationY
  root.add(arrow)
}

function buildTrain(config: LevelConfig, exitSide: -1 | 1) {
  const root = new THREE.Group()
  const handles: THREE.Group[] = []
  const carriageLights: THREE.PointLight[] = []
  const obstacles: Obstacle[] = []
  const seatSlots: SeatSlot[] = []
  const weatherDrops: THREE.Mesh[] = []
  const puddles: Array<{ x: number; z: number; r: number }> = []
  const lighting = stationLighting(config.stationEvent)
  const bench = config.variant === 'ad-wrap' ? 0x3d6680 : config.variant === 'maintenance' ? 0x555d61 : 0x315f76
  const wall = config.variant === 'long-seat' ? 0xd9dddc : 0xcbd0d1

  root.add(box(16.4, 0.32, 5.55, C.ink, 0, -0.04, 0))
  root.add(box(16.05, 0.18, 5.18, 0x62686b, 0, 0.12, 0))
  for (let x = -7.2; x <= 7.2; x += 0.72) root.add(box(0.025, 0.012, 4.96, 0x878d8f, x, 0.218, 0))
  const exitHalf = config.variant === 'narrow-door' ? 0.76 : 1.22
  const exitZ = exitSide > 0 ? CAR_MAX_Z + 0.62 : CAR_MIN_Z - 0.62
  const sideStart = CAR_MIN_X - 0.45
  const sideEnd = CAR_MAX_X + 0.45
  const beforeLen = EXIT_X - exitHalf - sideStart
  const afterStart = EXIT_X + exitHalf
  const afterLen = sideEnd - afterStart
  const exitArrow = new THREE.Group()
  const exitArrowBaseY = 1.34

  for (const side of [-1, 1] as const) {
    const isOpen = side === exitSide
    const wallZ = side > 0 ? CAR_MAX_Z + 0.25 : CAR_MIN_Z - 0.25
    const insideZ = wallZ - side * 0.10
    root.add(box(beforeLen, 2.5, 0.22, wall, sideStart + beforeLen / 2, 1.42, wallZ, true))
    root.add(box(afterLen, 2.5, 0.22, wall, afterStart + afterLen / 2, 1.42, wallZ, true))
    root.add(box(0.24, 2.7, 0.34, C.red, EXIT_X - exitHalf - 0.1, 1.48, wallZ, true))
    root.add(box(0.24, 2.7, 0.34, C.red, EXIT_X + exitHalf + 0.1, 1.48, wallZ, true))
    root.add(box(exitHalf * 2.65, 0.28, 0.34, C.stainless, EXIT_X, 2.76, wallZ, true))
    root.add(box(exitHalf * 2.25, 0.16, 0.37, isOpen ? C.yellow : C.red, EXIT_X, 2.77, wallZ - side * 0.04, true))
    root.add(box(exitHalf * 2.12, 0.08, 0.68, isOpen ? C.yellow : C.red, EXIT_X, 0.23, wallZ - side * 0.04, true))
    root.add(box(exitHalf * 2.4, 0.12, 1.3, C.floor, EXIT_X, 0.10, wallZ + side * 0.75))
    for (let i = -4; i <= 4; i++) root.add(box(0.12, 0.035, 0.58, i % 2 ? C.ink : C.red, EXIT_X + i * exitHalf * 0.22, 0.29, wallZ - side * 0.06))

    const leafOffset = isOpen ? exitHalf + 0.29 : exitHalf * 0.52
    for (const direction of [-1, 1] as const) {
      const leafX = EXIT_X + direction * leafOffset
      root.add(box(isOpen ? 0.38 : exitHalf * 0.94, 2.25, 0.16, 0xaeb4b6, leafX, 1.45, insideZ))
      root.add(box(isOpen ? 0.22 : exitHalf * 0.54, 0.72, 0.04, 0x26343c, leafX, 1.72, insideZ - side * 0.095))
    }

    const signalColor = isOpen ? 0x8ff0aa : 0xff7a6d
    const signalEmissive = isOpen ? 0x43c96d : 0xe23535
    for (const x of [EXIT_X - 0.48, EXIT_X, EXIT_X + 0.48]) {
      const signal = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.055, 12), new THREE.MeshStandardMaterial({ color: signalColor, emissive: signalEmissive, emissiveIntensity: 2.8 }))
      signal.rotation.x = Math.PI / 2
      signal.position.set(x, 2.69, wallZ - side * 0.23)
      signal.userData.ownsMaterial = true
      root.add(signal)
    }
    const statusLight = new THREE.PointLight(isOpen ? 0x66e293 : 0xff554f, isOpen ? 1.55 : 0.72, isOpen ? 3.7 : 2.7, 1.7)
    statusLight.position.set(EXIT_X, 2.48, wallZ - side * 0.20)
    root.add(statusLight)
    if (isOpen) {
      const exitWarm = new THREE.PointLight(0xffd56a, 2.9, 5.3, 1.55)
      exitWarm.position.set(EXIT_X, 2.12, wallZ - side * 0.23)
      root.add(exitWarm)
    }
  }

  const arrowMat = new THREE.MeshStandardMaterial({ color: 0x7aff9d, emissive: 0x159d55, emissiveIntensity: 1.35, roughness: 0.42, metalness: 0.18 })
  const arrowStem = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.18, 0.25), arrowMat)
  const arrowHead = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.58, 4), arrowMat)
  arrowHead.rotation.z = -Math.PI / 2
  arrowHead.position.x = 0.61
  exitArrow.add(arrowStem, arrowHead)
  exitArrow.position.set(EXIT_X, exitArrowBaseY, exitSide * 1.38)
  exitArrow.rotation.y = exitSide > 0 ? -Math.PI / 2 : Math.PI / 2
  exitArrow.traverse((object) => { const mesh = object as THREE.Mesh; if (mesh.isMesh) { mesh.castShadow = true; mesh.userData.ownsMaterial = true } })
  root.add(exitArrow)

  // The forward end is now visibly closed, removing the false suggestion that
  // players should run through the front of the train.
  root.add(box(0.22, 2.5, 5.18, wall, CAR_MAX_X + 0.25, 1.42, 0, true))
  // Benches read as authored subway furniture, with dark end caps.
  const benchSegments = config.variant === 'long-seat' ? [[-3.5, 6.7], [3.0, 2.8]] : [[-4.2, 4.8], [0.0, 2.0]]
  for (const side of [-1, 1]) {
    for (const [x, len] of benchSegments) {
      const z = side * 2.08
      root.add(box(len, 0.42, 0.58, bench, x, 0.54, z, true))
      root.add(box(len, 0.85, 0.16, bench, x, 1.05, z + side * 0.31, true))
      root.add(box(0.16, 0.75, 0.72, C.stainless, x - len / 2, 0.67, z))
      root.add(box(0.16, 0.75, 0.72, C.stainless, x + len / 2, 0.67, z))
      // Dense circles along the bench front approximate a continuous collider.
      // They keep the player out of both occupied and empty seat geometry.
      for (let colliderX = x - len / 2 + 0.12; colliderX <= x + len / 2 - 0.12; colliderX += 0.32) {
        obstacles.push({ x: colliderX, z: side * 2.00, r: 0.17 })
      }
      const seatCount = Math.max(1, Math.floor((len - 0.2) / 0.72))
      const seatSpacing = len / seatCount
      for (let seat = 0; seat < seatCount; seat++) {
        seatSlots.push({
          x: x - len / 2 + seatSpacing * (seat + 0.5),
          z,
          yaw: side < 0 ? 0 : Math.PI,
        })
      }
    }
  }

  // Both sides share the same window, advertising and panel rhythm. Only the
  // station-side door state and signal color are allowed to differ.
  const adColors = config.variant === 'ad-wrap' ? [C.red, C.yellow, 0xa77abc, C.cyan] : [C.yellow, C.paper, C.red, C.paper]
  for (const side of [-1, 1] as const) {
    const wallZ = side > 0 ? CAR_MAX_Z + 0.25 : CAR_MIN_Z - 0.25
    const insideZ = wallZ - side * 0.09
    for (const x of [-5.8, -3.2, -0.6, 2.0]) {
      root.add(box(1.65, 0.72, 0.05, C.stainless, x, 1.28, insideZ))
      root.add(box(1.44, 0.54, 0.045, C.cyan, x, 1.29, insideZ - side * 0.04))
    }
    for (let i = 0; i < 4; i++) {
      const x = -5.8 + i * 2.6
      root.add(box(1.35, 0.42, 0.055, adColors[i], x, 2.02, insideZ - side * 0.04, true))
      root.add(box(0.82, 0.07, 0.02, C.ink, x, 2.07, insideZ - side * 0.09))
    }
    for (let i = 0; i < 11; i++) root.add(box(0.025, 2.15, 0.025, 0x8f979a, -7.0 + i * 1.38, 1.42, insideZ))
    root.add(box(10.8, 0.18, 0.08, C.stainless, -0.45, 2.52, insideZ))
    root.add(box(10.5, 0.11, 0.05, C.paper, -0.45, 2.53, insideZ - side * 0.06))
    for (let i = 0; i < 9; i++) root.add(cyl(0.07, 0.04, i > 6 ? C.red : C.yellow, -5.1 + i * 1.17, 2.56, insideZ - side * 0.10, false, 8).rotateX(Math.PI / 2))
  }

  // Poles, rail and hanging straps remain visible because the roof is absent.
  root.add(cyl(0.055, 15.0, C.stainless, 0, 3.0, 0, false, 8).rotateZ(Math.PI / 2))
  root.add(cyl(0.026, 14.8, 0xe8edef, 0, 3.0, -0.022, false, 8).rotateZ(Math.PI / 2))
  const poleXs = config.variant === 'commuter' ? [-5.4, -1.9, 1.7] : [-5.6, -2.7, 0.2, 3.0]
  for (const x of poleXs) {
    root.add(cyl(0.11, 2.82, C.stainless, x, 1.55, 0, true, 8))
    root.add(cyl(0.055, 2.78, 0xe8edef, x - 0.035, 1.55, -0.035, false, 8))
    obstacles.push({ x, z: 0, r: 0.24 })
  }
  for (let i = 0; i < 8; i++) {
    const h = new THREE.Group()
    h.position.set(-5.9 + i * 1.68, 2.92, 0)
    h.add(box(0.055, 1.0, 0.055, C.stainless, 0, -0.55, 0))
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.05, 6, 8), toon(i % 3 === 0 ? C.yellow : C.paper))
    ring.rotation.x = Math.PI / 2
    ring.position.y = -1.13
    ring.castShadow = true
    h.add(ring)
    handles.push(h)
    root.add(h)
  }

  // Suspended carriage lamps keep the roofless cutaway readable. The fixtures
  // and their light sources move with the train instead of floating in screen space.
  for (let i = 0; i < 5; i++) {
    const x = -5.6 + i * 2.85
    root.add(box(1.18, 0.09, 0.16, C.stainless, x, 3.23, -1.42))
    const tube = new THREE.Mesh(
      new THREE.BoxGeometry(1.02, 0.055, 0.11),
      new THREE.MeshBasicMaterial({ color: lighting.litLamp === undefined || lighting.litLamp === i ? lighting.lampTube : 0x202428 }),
    )
    tube.position.set(x, 3.17, -1.42)
    root.add(tube)
    const enabled = lighting.litLamp === undefined || lighting.litLamp === i
    const lamp = new THREE.PointLight(lighting.lampColor, enabled ? 1.05 : 0, 5.8, 1.7)
    lamp.position.set(x, 2.92, -0.72)
    lamp.userData.phase = i * 1.37
    lamp.userData.baseIntensity = enabled ? lighting.lampStrength : 0
    carriageLights.push(lamp)
    root.add(lamp)
  }

  if (config.stationEvent === 'leak-night') {
    const dropGeometry = new THREE.CylinderGeometry(0.012, 0.018, 0.20, 5)
    const dropMaterial = new THREE.MeshStandardMaterial({ color: 0x9fd4df, transparent: true, opacity: 0.72, roughness: 0.18, metalness: 0.04 })
    for (let i = 0; i < 28; i++) {
      const drop = new THREE.Mesh(dropGeometry, dropMaterial)
      drop.position.set(-6.6 + ((i * 37) % 132) / 10, 0.35 + ((i * 47) % 270) / 100, -1.48 + ((i * 29) % 296) / 100)
      drop.userData.speed = 1.55 + (i % 7) * 0.17
      drop.userData.ownsMaterial = i === 0
      weatherDrops.push(drop)
      root.add(drop)
    }
    const puddleLayout = [[-4.7, -0.42, 0.48], [-2.2, 0.54, 0.58], [0.35, -0.48, 0.52], [2.65, 0.45, 0.60], [4.75, -0.20, 0.46]] as const
    for (const [x, z, r] of puddleLayout) {
      const puddleGeometry = new THREE.CircleGeometry(r, 18)
      const puddlePositions = puddleGeometry.attributes.position as THREE.BufferAttribute
      for (let vertex = 1; vertex < puddlePositions.count; vertex++) {
        const wobble = 0.84 + 0.12 * Math.sin(vertex * 2.37 + Math.abs(x) * 1.9) + 0.06 * Math.sin(vertex * 4.11)
        puddlePositions.setXY(vertex, puddlePositions.getX(vertex) * wobble, puddlePositions.getY(vertex) * wobble)
      }
      puddlePositions.needsUpdate = true
      puddleGeometry.computeVertexNormals()
      const puddle = new THREE.Mesh(
        puddleGeometry,
        new THREE.MeshStandardMaterial({ color: 0x5e8e9b, transparent: true, opacity: 0.38, roughness: 0.16, metalness: 0.08, depthWrite: false }),
      )
      puddle.rotation.x = -Math.PI / 2
      puddle.scale.set(1.0, 0.58 + ((Math.abs(x) * 17) % 24) / 100, 1)
      puddle.position.set(x, 0.228, z)
      puddle.userData.ownsMaterial = true
      root.add(puddle)
      puddles.push({ x, z, r })
    }
  }

  // Variant-specific clutter changes the collision map.
  if (config.variant === 'maintenance') {
    for (const [x, z, s] of [[-1.1, -0.78, 0.72], [2.2, 0.85, 0.62], [4.0, 0.35, 0.55]] as const) {
      root.add(box(s * 1.25, s, s, 0x9b5b43, x, 0.18 + s / 2, z, true))
      root.add(box(s, 0.08, s + 0.03, C.yellow, x, 0.25 + s, z))
      obstacles.push({ x, z, r: s * 0.72 })
    }
  }
  if (config.variant === 'ad-wrap') {
    for (const [x, z] of [[-2.2, 0.62], [1.6, -0.68]] as const) {
      root.add(box(0.7, 0.52, 0.34, C.aubergine, x, 0.45, z, true))
      obstacles.push({ x, z, r: 0.45 })
    }
  }

  for (const x of [-5.5, -2.7, 0.1, 2.9, 4.75]) addFloorArrow(root, x, 0, 0.72)
  addFloorArrow(root, EXIT_X, exitSide * 0.75, 0.72, exitSide > 0 ? -Math.PI / 2 : Math.PI / 2)
  addFloorArrow(root, EXIT_X, exitSide * 1.55, 0.72, exitSide > 0 ? -Math.PI / 2 : Math.PI / 2)

  // Environment-only material pass: characters keep their authored low-poly
  // materials, while the carriage gets physically lit rough metal/plastic.
  root.traverse((object) => {
    const m = object as THREE.Mesh
    if (m.userData.outlineShell) { m.visible = false; return }
    if (!(m.material instanceof THREE.MeshStandardMaterial)) return
    const color = m.material.color.clone()
    const hex = color.getHex()
    const stainless = hex === C.stainless || hex === 0xe8edef
    const metal = stainless || hex === C.steel
    const guide = m.userData.guide === true
    m.material = new THREE.MeshStandardMaterial({
      color,
      roughness: stainless ? (hex === 0xe8edef ? 0.22 : 0.34) : metal ? 0.48 : 0.86,
      metalness: stainless ? (hex === 0xe8edef ? 0.58 : 0.66) : metal ? 0.38 : 0,
      flatShading: true,
      emissive: guide ? color : new THREE.Color(0x000000),
      emissiveIntensity: guide ? 0.22 : 0,
      transparent: m.material.transparent,
      opacity: m.material.opacity,
    })
    m.userData.ownsMaterial = true
  })

  return { root, handles, carriageLights, obstacles, seatSlots, poleXs, exitHalf, exitSide, exitZ, exitArrow, exitArrowBaseY, weatherDrops, puddles }
}

function dispose(root: THREE.Object3D) {
  root.traverse((o) => {
    const m = o as THREE.Mesh
    if (m.geometry) m.geometry.dispose()
    if (m.userData.ownsMaterial && m.material) (m.material as THREE.Material).dispose()
  })
}

function World({ level, heroId, config, active, input, reducedMotion, onHud, onOutcome }: Props) {
  const { scene, camera } = useThree()
  const exitSide = level % 2 === 0 ? 1 : -1
  const train = useMemo(() => buildTrain(config, exitSide), [config, exitSide])
  const fx = useMemo(() => new THREE.Group(), [])
  const cameraGoal = useRef(new THREE.Vector3())
  const cameraLook = useRef(new THREE.Vector3(START_X + FORWARD_X * 4.8, 0.70, START_Z + FORWARD_Z * 4.8))
  const state = useRef({
    bodies: [] as Body[], seated: [] as SeatedVisual[], player: null as Body | null, time: 0, timeLeft: config.time,
    nextSway: config.swayPeriod, warningSent: false, swayDirection: (level % 2 ? -1 : 1) as -1 | 1,
    swayKick: 0, falls: 0, braceTime: 0, braced: false, hudT: 0, ended: false, lastFrame: 0,
    qaFallDone: false, lastSeatBump: Number.NEGATIVE_INFINITY, nextWetSlip: 1.8,
    boardingsSpawned: 0,
    nextBoardingAt: config.stationEvent === 'inflow' ? 3.2 : 3.7 + ((level * 17) % 10) / 10,
  })

  useEffect(() => {
    const S = state.current
    scene.add(train.root, fx)
    const playerGroup = makePlayer(heroId)
    playerGroup.position.set(START_X, 0.24, START_Z)
    playerGroup.rotation.y = Math.atan2(FORWARD_X, FORWARD_Z)
    train.root.add(playerGroup)
    const player: Body = {
      group: playerGroup, x: START_X, z: START_Z, vx: 0, vz: 0, r: 0.22, mass: 1.28, stability: 2.25,
      fallenUntil: 0, fallStarted: 0, fallDuration: 0, fallKind: 'side', protectedUntil: 0, phase: 0,
      homeX: START_X, homeZ: START_Z, targetX: START_X, targetZ: START_Z, nextWander: 0, pauseUntil: 0,
      wanderSpeed: 0, gaitPhase: 0, lastX: START_X, lastZ: START_Z, player: true, behavior: 'player',
      exitAt: Number.POSITIVE_INFINITY,
    }
    S.player = player
    S.bodies.push(player)
    camera.position.set(START_X - FORWARD_X * 5.2, 6.05, START_Z - FORWARD_Z * 5.2)
    camera.lookAt(cameraLook.current)

    const rand = mulberry32(9017 + level * 103)
    if (!QA_WALK) {
      const emptyCount = 1 + ((level * 7 + 3) % 2)
      const emptySeats = new Set<number>()
      while (emptySeats.size < Math.min(emptyCount, train.seatSlots.length)) emptySeats.add(Math.floor(rand() * train.seatSlots.length))
      train.seatSlots.forEach((slot, index) => {
        if (emptySeats.has(index)) return
        const activityRoll = (index * 7 + level * 3) % 20
        const activity = activityRoll < 6 ? 'reading' : activityRoll < 15 ? 'phone' : 'rest'
        const seatRoster = passengerRoster(config, level)
        const passengerId = seatRoster[(index * 5 + level * 3) % seatRoster.length]
        const group = makeSeatedLibraryPassenger(passengerId, activity)
        const rig = group.userData.rig as CharacterRig
        const baseY = 0.75 - (rig.hipY ?? 1) * group.scale.y
        group.position.set(slot.x, baseY, slot.z)
        group.rotation.y = slot.yaw
        train.root.add(group)
        const footReach = 0.52
        S.seated.push({
          group,
          phase: rand() * Math.PI * 2,
          baseY,
          baseUpperX: rig.upperBody?.rotation.x ?? 0,
          x: slot.x + Math.sin(slot.yaw) * footReach,
          z: slot.z + Math.cos(slot.yaw) * footReach,
          r: 0.18,
          seatX: slot.x,
          seatZ: slot.z,
          aisleZ: Math.sign(slot.z) * 1.40,
          state: 'seated',
          scheduledAt: Number.POSITIVE_INFINITY,
          transitionStarted: 0,
        })
      })

      const eligibleRisers = S.seated
        .filter((seat) => seat.seatX >= -3.8 && seat.seatX <= 4.6)
        .sort((a, b) => a.seatX - b.seatX)
      const riserCount = Math.min(
        config.stationEvent === 'all-exit' ? config.alightingCount : Math.max(1, Math.ceil(config.alightingCount * 0.55)),
        eligibleRisers.length,
      )
      const chosen = new Set<SeatedVisual>()
      for (let i = 0; i < riserCount && chosen.size < eligibleRisers.length; i++) {
        let pick = Math.floor((i + 1) * eligibleRisers.length / (riserCount + 1))
        while (chosen.has(eligibleRisers[pick]) && pick + 1 < eligibleRisers.length) pick++
        const seat = eligibleRisers[pick]
        if (!seat || chosen.has(seat)) continue
        chosen.add(seat)
        const allExit = config.stationEvent === 'all-exit'
        const interval = allExit ? 0.28 + rand() * 0.14 : 2.8 + rand() * 1.6
        seat.scheduledAt = (QA_SEAT_STAND ? 0.85 : allExit ? 2.0 : 4.2 + rand() * 1.8) + i * interval
      }
    }

    const passengerTarget = QA_WALK ? 0 : Math.min(20, config.passengers)
    const moverTarget = Math.min(4, Math.max(2, Math.round(passengerTarget * 0.16)))
    const standingExitCount = config.stationEvent === 'all-exit'
      ? passengerTarget
      : Math.max(0, config.alightingCount - Math.max(1, Math.ceil(config.alightingCount * 0.55)))
    let made = 0
    let attempts = 0
    while (made < passengerTarget && attempts < 2400) {
      attempts++
      const behavior: Body['behavior'] = made < moverTarget ? 'wandering' : 'stationary'
      const roster = passengerRoster(config, level)
      const passengerId = roster[(level * passengerTarget + made) % roster.length]
      const activityRoll = ((made - moverTarget) * 11 + level * 5 + 100) % 100
      const activity: PassengerActivity = behavior === 'wandering'
        ? 'natural'
        : activityRoll < 21 ? 'strap-left'
          : activityRoll < 42 ? 'strap-right'
            : activityRoll < 60 ? 'reading'
              : activityRoll < 78 ? 'calling'
                : activityRoll < 90 ? 'phone' : 'natural'
      const broad = isBroadLibraryCharacter(passengerId)
      const small = isSmallLibraryCharacter(passengerId)
      const ghost = passengerId === 'ghost'
      const nonHuman = (MONSTER_LIBRARY_IDS as readonly string[]).includes(passengerId) || (ANIMAL_LIBRARY_IDS as readonly string[]).includes(passengerId)
      const r = broad ? 0.27 : small ? 0.18 : 0.22
      const strapStand = activity === 'strap-left' || activity === 'strap-right'
      const poleStand = behavior === 'stationary' && !strapStand && rand() >= 0.66
      const poleX = poleStand ? train.poleXs[Math.floor(rand() * train.poleXs.length)] : 0
      const strapX = strapStand ? train.handles[(made + level) % train.handles.length].position.x : 0
      const x = behavior === 'wandering' ? -5.8 + rand() * 8.6 : strapStand ? strapX + (rand() - 0.5) * 0.18 : poleStand ? poleX + (rand() - 0.5) * 0.84 : -6.45 + rand() * 11.95
      const z = behavior === 'wandering'
        ? (rand() * 2 - 1) * 0.48
        : strapStand ? (activity === 'strap-left' ? -1 : 1) * (0.30 + rand() * 0.18)
        : (rand() < 0.5 ? -1 : 1) * (poleStand ? 0.38 + rand() * 0.30 : 0.86 + rand() * 0.44)
      if (Math.hypot(x - START_X, z - START_Z) < 1.35) continue
      if (Math.abs(x - EXIT_X) < train.exitHalf + 0.32 && Math.abs(z) > 1.05) continue
      if (train.obstacles.some((o) => Math.hypot(x - o.x, z - o.z) < r + o.r + 0.10)) continue
      if (S.bodies.some((other) => Math.hypot(x - other.x, z - other.z) < r + other.r + 0.16)) continue

      const group = makeLibraryPassenger(passengerId)
      applyPassengerActivity(group, nonHuman ? 'natural' : activity)
      group.userData.libraryId = passengerId
      group.position.set(x, 0.24, z)
      group.rotation.y = behavior === 'wandering' ? Math.PI / 2 : (z < 0 ? 0 : Math.PI) + (rand() - 0.5) * 0.16
      train.root.add(group)
      const targetX = behavior === 'wandering' ? THREE.MathUtils.clamp(x + 1.2 + rand() * 1.6, CAR_MIN_X + 0.6, EXIT_X - 0.75) : x
      const targetZ = behavior === 'wandering' ? THREE.MathUtils.clamp(z + (rand() - 0.5) * 0.8, -0.72, 0.72) : z
      S.bodies.push({
        group, x, z, vx: 0, vz: 0, r,
        mass: broad ? 1.72 : ghost ? 0.58 : small ? 0.72 : 1.05,
        stability: ghost ? 1.55 : broad ? 2.9 : 1.8 + rand() * 1.2,
        fallenUntil: 0, fallStarted: 0, fallDuration: 0, fallKind: 'side', protectedUntil: 0,
        phase: rand() * Math.PI * 2, homeX: x, homeZ: z, targetX, targetZ,
        nextWander: Number.POSITIVE_INFINITY, pauseUntil: behavior === 'wandering' ? 0.8 + rand() * 1.5 : Number.POSITIVE_INFINITY,
        wanderSpeed: behavior === 'wandering' ? 0.28 + rand() * 0.16 : 0,
        gaitPhase: rand() * Math.PI * 2, lastX: x, lastZ: z, player: false, behavior,
        exitAt: config.stationEvent === 'all-exit'
          ? 2.8 + made * (0.18 + rand() * 0.08)
          : made >= passengerTarget - standingExitCount
            ? 5.4 + (made - (passengerTarget - standingExitCount)) * (1.7 + rand() * 1.1)
            : Number.POSITIVE_INFINITY,
      })
      made++
    }
    return () => {
      train.root.remove(playerGroup)
      scene.remove(train.root, fx)
      dispose(train.root)
      dispose(fx)
    }
  }, [scene, camera, train, fx, config, level])

  useEffect(() => {
    const player = state.current.player
    if (!player || player.group.userData.heroId === heroId) return
    const oldGroup = player.group
    const replacement = makePlayer(heroId)
    replacement.position.copy(oldGroup.position)
    replacement.rotation.copy(oldGroup.rotation)
    replacement.visible = oldGroup.visible
    train.root.add(replacement)
    train.root.remove(oldGroup)
    oldGroup.traverse((object) => {
      const mesh = object as THREE.Mesh
      if (mesh.geometry) mesh.geometry.dispose()
    })
    player.group = replacement
  }, [heroId, train.root])

  useFrame(() => {
    const S = state.current
    if (!active || S.ended || !S.player) return
    const now = performance.now()
    if (!S.lastFrame) { S.lastFrame = now; return }
    const dt = Math.min((now - S.lastFrame) / 1000, 0.033) * QA_SPEED
    S.lastFrame = now
    if (dt <= 0) return
    S.time += dt
    S.timeLeft = Math.max(0, S.timeLeft - dt)
    S.hudT -= dt

    const eventChance = (b: Body, salt: number) => {
      const raw = Math.sin((S.time * 17.13 + b.phase * 9.71 + salt) * 12.9898) * 43758.5453
      return raw - Math.floor(raw)
    }
    const knockDown = (b: Body, kind: 'side' | 'forward', duration: number) => {
      if (S.time < b.protectedUntil) return false
      b.fallKind = kind
      b.fallStarted = S.time
      b.fallDuration = duration
      b.fallenUntil = S.time + duration
      b.protectedUntil = b.fallenUntil + (b.player ? 1.0 : 0.45)
      if (b.player) { S.falls++; kind === 'forward' ? sound.trip() : sound.fall() }
      return true
    }

    if (QA_FALL && !S.qaFallDone && S.time > 0.9) {
      S.qaFallDone = knockDown(S.player, QA_FALL_KIND, QA_FALL_KIND === 'side' ? 1.10 : 1.26)
    }

    if (config.stationEvent === 'leak-night' && S.time >= S.nextWetSlip) {
      S.nextWetSlip += 2.4
      const wetPlayer = S.player
      const playerSpeed = Math.hypot(wetPlayer.vx, wetPlayer.vz)
      const onPuddle = train.puddles.some((puddle) => Math.hypot(wetPlayer.x - puddle.x, wetPlayer.z - puddle.z) < puddle.r + wetPlayer.r)
      if (onPuddle && playerSpeed > 1.6) {
        if (eventChance(wetPlayer, 57.4) < 0.55) knockDown(wetPlayer, 'side', 1.10)
        else wetPlayer.vz += S.swayDirection * 0.45
      }
    }

    const mag = Math.hypot(input.current.x, input.current.z)
    S.braceTime = mag < 0.12 ? S.braceTime + dt : 0
    S.braced = S.braceTime > 0.18 && S.player.fallenUntil <= S.time

    const warningNow = S.time >= S.nextSway - config.warning && S.time < S.nextSway
    if (warningNow && !S.warningSent) {
      S.warningSent = true
      sound.warn()
    }
    if (S.time >= S.nextSway) {
      const dir = S.swayDirection
      S.swayDirection = (dir * -1) as -1 | 1
      S.swayKick = 1
      sound.sway()
      for (const b of S.bodies) {
        b.vz += dir * config.impulse / b.mass
        if (S.time < b.protectedUntil) continue
        const opposite = Math.max(0, -dir * b.vz)
        const braceFactor = b.player && S.braced ? 0.68 : 1
        const loss = config.impulse * (0.78 + opposite * 0.22) / b.mass * braceFactor
        if (loss > b.stability) {
          const nearDoor = THREE.MathUtils.clamp((b.x - (EXIT_X - 3.2)) / 3.2, 0, 1)
          const forwardFall = eventChance(b, 3.7) < config.swayFallChance + nearDoor * 0.16
          knockDown(
            b,
            forwardFall ? 'forward' : 'side',
            forwardFall
              ? (b.player ? 1.18 + nearDoor * 0.16 : 1.00 + nearDoor * 0.12)
              : (b.player ? 1.10 : 0.94 + ((b.phase * 97) % 0.12)),
          )
        }
      }
      S.nextSway += config.swayPeriod * (0.92 + ((level * 31 + Math.floor(S.time)) % 17) / 100)
      S.warningSent = false
    }

    S.swayKick = Math.max(0, S.swayKick - dt * 2.45)
    const warningLean = warningNow ? Math.sin((S.nextSway - S.time) * 12) * 0.35 : 0
    const roll = THREE.MathUtils.degToRad(config.roll) * (S.swayKick + warningLean) * (reducedMotion ? 0.4 : 1)
    train.root.rotation.x = THREE.MathUtils.lerp(train.root.rotation.x, roll * -S.swayDirection, Math.min(1, dt * 10))
    for (let i = 0; i < train.handles.length; i++) {
      train.handles[i].rotation.z = Math.sin(S.time * 2.5 + i * 0.16) * 0.04 + train.root.rotation.x * -2.6
    }
    for (let i = 0; i < train.carriageLights.length; i++) {
      const lamp = train.carriageLights[i]
      const slowBreath = 0.78 + Math.sin(S.time * 0.72 + lamp.userData.phase) * 0.10
      const looseLamp = i === 3 ? 0.76 + Math.sin(S.time * 2.15) * 0.17 : 1
      const impactDip = S.swayKick > 0.55 && (i + Math.floor(S.time * 18)) % 3 === 0 ? 0.38 : 1
      const baseIntensity = Number(lamp.userData.baseIntensity) || 0
      lamp.intensity = (reducedMotion ? 1.0 : slowBreath * looseLamp * impactDip) * baseIntensity
    }
    for (const drop of train.weatherDrops) {
      drop.position.y -= dt * Number(drop.userData.speed)
      if (drop.position.y < 0.27) drop.position.y = 3.05 + ((drop.position.x * 19 + drop.position.z * 23) % 0.42)
    }
    const arrowMotion = reducedMotion ? 0.35 : 1
    const arrowPulse = 1 + Math.sin(S.time * Math.PI * 2 * 1.35) * 0.045 * arrowMotion
    train.exitArrow.position.y = train.exitArrowBaseY + Math.sin(S.time * Math.PI * 2 * 1.35) * 0.08 * arrowMotion
    train.exitArrow.scale.setScalar(arrowPulse)
    for (const seated of S.seated) {
      const rig = seated.group.userData.rig as CharacterRig
      if (seated.state === 'departed') continue
      if (seated.state === 'seated' && S.time >= seated.scheduledAt) {
        seated.state = 'preparing'
        seated.transitionStarted = S.time
        sound.seatRise()
      }
      if (seated.state === 'preparing') {
        const raw = THREE.MathUtils.clamp((S.time - seated.transitionStarted) / 0.72, 0, 1)
        const p = raw * raw * (3 - 2 * raw)
        seated.group.position.y = seated.baseY
        if (rig.upperBody) rig.upperBody.rotation.x = seated.baseUpperX + p * 0.43
        if (rig.head) rig.head.rotation.x = -p * 0.16
        const seatedLegX = rig.seatedLegX ?? -Math.PI / 2
        if (rig.legL) rig.legL.rotation.x = THREE.MathUtils.lerp(seatedLegX, -1.12, p)
        if (rig.legR) rig.legR.rotation.x = THREE.MathUtils.lerp(seatedLegX, -1.04, p)
        if (rig.shinL) rig.shinL.rotation.x = THREE.MathUtils.lerp(Math.PI / 2, 1.34, p)
        if (rig.shinR) rig.shinR.rotation.x = THREE.MathUtils.lerp(Math.PI / 2, 1.22, p)
        const prop = seated.group.userData.activityProp as THREE.Object3D | undefined
        if (prop) {
          const propScale = THREE.MathUtils.lerp(1, 0.24, p)
          prop.scale.setScalar(propScale)
          if (raw > 0.9) prop.visible = false
        }
        if (raw >= 1) {
          seated.state = 'rising'
          seated.transitionStarted = S.time
        }
        continue
      }
      if (seated.state === 'rising') {
        const raw = THREE.MathUtils.clamp((S.time - seated.transitionStarted) / 0.58, 0, 1)
        const p = raw * raw * (3 - 2 * raw)
        seated.group.position.x = seated.seatX
        seated.group.position.z = THREE.MathUtils.lerp(seated.seatZ, seated.aisleZ, p)
        seated.group.position.y = THREE.MathUtils.lerp(seated.baseY, 0.24, p)
        if (rig.pose) rig.pose.rotation.z = 0
        if (rig.upperBody) rig.upperBody.rotation.x = THREE.MathUtils.lerp(seated.baseUpperX + 0.43, 0, p)
        if (rig.head) rig.head.rotation.x = THREE.MathUtils.lerp(-0.16, 0, p)
        if (rig.legL) rig.legL.rotation.x = THREE.MathUtils.lerp(-1.12, -0.08, p)
        if (rig.legR) rig.legR.rotation.x = THREE.MathUtils.lerp(-1.04, 0.10, p)
        if (rig.shinL) { rig.shinL.rotation.x = THREE.MathUtils.lerp(1.34, 0.08, p); rig.shinL.scale.y = THREE.MathUtils.lerp(1.92, 1, p) }
        if (rig.shinR) { rig.shinR.rotation.x = THREE.MathUtils.lerp(1.22, 0, p); rig.shinR.scale.y = THREE.MathUtils.lerp(1.92, 1, p) }
        if (rig.footL) { rig.footL.position.z = THREE.MathUtils.lerp(0.16, 0.07, p); rig.footL.scale.z = THREE.MathUtils.lerp(1.35, 1, p) }
        if (rig.footR) { rig.footR.position.z = THREE.MathUtils.lerp(0.16, 0.07, p); rig.footR.scale.z = THREE.MathUtils.lerp(1.35, 1, p) }
        if (rig.armL) rig.armL.rotation.set(THREE.MathUtils.lerp(-0.56, 0, p), 0, THREE.MathUtils.lerp(-0.10, 0, p))
        if (rig.armR) rig.armR.rotation.set(THREE.MathUtils.lerp(-0.56, 0, p), 0, THREE.MathUtils.lerp(0.10, 0, p))
        if (rig.forearmL) rig.forearmL.rotation.x = THREE.MathUtils.lerp(-0.72, 0, p)
        if (rig.forearmR) rig.forearmR.rotation.x = THREE.MathUtils.lerp(-0.72, 0, p)
        if (raw >= 1) {
          seated.group.position.set(seated.seatX, 0.24, seated.aisleZ)
          seated.group.rotation.y = Math.PI / 2
          seated.group.userData.seated = false
          seated.group.userData.activity = 'natural'
          S.bodies.push({
            group: seated.group, x: seated.seatX, z: seated.aisleZ, vx: 0, vz: 0, r: 0.22,
            mass: 1.05, stability: 2.0, fallenUntil: 0, fallStarted: 0, fallDuration: 0, fallKind: 'side',
            protectedUntil: S.time + 0.35, phase: seated.phase, homeX: seated.seatX, homeZ: seated.aisleZ,
            targetX: EXIT_X, targetZ: Math.sign(seated.aisleZ) * 0.62, nextWander: Number.POSITIVE_INFINITY,
            pauseUntil: 0, wanderSpeed: Math.min(1.15, 0.78 + level * 0.06), gaitPhase: 0,
            lastX: seated.seatX, lastZ: seated.aisleZ, player: false, behavior: 'exiting',
            exitAt: Number.POSITIVE_INFINITY,
          })
          seated.state = 'departed'
        }
        continue
      }
      const rate = 2.7 + (Math.sin(seated.phase) + 1) * 0.25
      const breath = Math.sin(S.time * rate + seated.phase)
      const seatedMotion = reducedMotion ? 0.35 : 1
      seated.group.position.y = seated.baseY + Math.max(0, breath) * 0.012 * seatedMotion
      rig.pose.rotation.z = breath * 0.018 * seatedMotion
      if (rig.upperBody) {
        rig.upperBody.rotation.x = seated.baseUpperX + Math.max(0, breath) * 0.012 * seatedMotion
        rig.upperBody.rotation.z = -breath * 0.012 * seatedMotion
      }
    }

    if (S.boardingsSpawned < config.boardingCount && S.time >= S.nextBoardingAt) {
      const index = S.boardingsSpawned
      const roster = passengerRoster(config, level)
      const passengerId = roster[(level * 13 + index * 7 + 3) % roster.length]
      const broad = isBroadLibraryCharacter(passengerId)
      const small = isSmallLibraryCharacter(passengerId)
      const ghost = passengerId === 'ghost'
      const group = makeLibraryPassenger(passengerId)
      applyPassengerActivity(group, 'natural')
      group.userData.libraryId = passengerId
      const x = EXIT_X
      const z = train.exitZ + train.exitSide * (0.55 + index % 2 * 0.10)
      group.position.set(x, 0.24, z)
      group.rotation.y = train.exitSide > 0 ? Math.PI : 0
      train.root.add(group)
      const targetX = THREE.MathUtils.clamp(4.25 - (index % 7) * 1.08, -2.8, 4.25)
      const targetZ = (index % 2 ? -1 : 1) * (0.38 + index % 3 * 0.12)
      S.bodies.push({
        group, x, z, vx: 0, vz: 0, r: broad ? 0.27 : small ? 0.18 : 0.22,
        mass: broad ? 1.72 : ghost ? 0.58 : small ? 0.72 : 1.05,
        stability: ghost ? 1.55 : broad ? 2.9 : 2.1,
        fallenUntil: 0, fallStarted: 0, fallDuration: 0, fallKind: 'side', protectedUntil: S.time + 0.35,
        phase: (index * 2.17 + level) % (Math.PI * 2), homeX: targetX, homeZ: targetZ,
        targetX, targetZ, nextWander: Number.POSITIVE_INFINITY, pauseUntil: 0,
        wanderSpeed: config.stationEvent === 'inflow' ? 0.92 : 0.78,
        gaitPhase: 0, lastX: x, lastZ: z, player: false, behavior: 'boarding', exitAt: Number.POSITIVE_INFINITY,
      })
      S.boardingsSpawned++
      const lateFlow = THREE.MathUtils.clamp((level - 5) / 15, 0, 1)
      S.nextBoardingAt += config.stationEvent === 'inflow'
        ? 0.82 + (1 - lateFlow) * 0.23 + ((index * 7 + level) % 4) * 0.10
        : 1.60 + (1 - lateFlow) * 0.80 + ((index * 11 + level) % 4) * 0.15
      sound.boarding()
    }

    const player = S.player
    if (QA_AUTORUN) input.current = QA_SEAT_COLLISION
      ? { x: -1, z: 0 }
      : player.x < EXIT_X - 0.2 ? { x: QA_WALK ? 0.24 : 0, z: QA_WALK ? -0.97 : -1 } : { x: QA_WRONG_DOOR ? -train.exitSide : train.exitSide, z: 0 }
    for (const b of S.bodies) {
      if (b.behavior === 'departed') continue
      const fallen = b.fallenUntil > S.time
      let npcWalking = false
      if (!b.player && b.behavior !== 'boarding' && b.behavior !== 'exiting' && S.time >= b.exitAt) {
        b.behavior = 'exiting'
        b.wanderSpeed = Math.min(1.18, 0.82 + level * 0.035)
        b.homeX = b.x
        b.homeZ = b.z
        b.nextWander = Number.POSITIVE_INFINITY
      }
      if (b.player) {
        if (!fallen) {
          // Temple-run style mapping: dragging toward the top of the screen moves
          // along the camera's forward route to the door; horizontal drag strafes.
          const rawMag = Math.hypot(input.current.x, input.current.z)
          const stickX = rawMag > 0.1 ? input.current.x / rawMag : 0
          const stickZ = rawMag > 0.1 ? input.current.z / rawMag : 0
          const forward = -stickZ
          const targetVx = (FORWARD_X * forward + RIGHT_X * stickX) * 4.1
          const targetVz = (FORWARD_Z * forward + RIGHT_Z * stickX) * 4.1
          b.vx += (targetVx - b.vx) * Math.min(1, 18 * dt)
          b.vz += (targetVz - b.vz) * Math.min(1, 18 * dt)
        }
      } else if (!fallen && b.behavior === 'boarding') {
        const outsideDoor = Math.abs(b.z) > 1.05
        const targetX = outsideDoor ? EXIT_X - 0.08 : b.targetX
        const targetZ = outsideDoor ? train.exitSide * 0.68 : b.targetZ
        const dx = targetX - b.x
        const dz = targetZ - b.z
        const distance = Math.hypot(dx, dz)
        if (distance > 0.10) {
          const desiredVx = dx / distance * b.wanderSpeed
          const desiredVz = dz / distance * b.wanderSpeed
          const steer = Math.min(1, dt * 5.2)
          b.vx += (desiredVx - b.vx) * steer
          b.vz += (desiredVz - b.vz) * steer
          npcWalking = true
        } else if (!outsideDoor) {
          b.behavior = config.stationEvent === 'inflow' && (Math.floor(b.phase * 10) % 3 === 0) ? 'wandering' : 'stationary'
          b.homeX = b.x
          b.homeZ = b.z
          b.nextWander = b.behavior === 'wandering' ? S.time + 1.2 : Number.POSITIVE_INFINITY
          b.pauseUntil = S.time + 0.8
        }
      } else if (!fallen && b.behavior === 'exiting') {
        const laneSeed = Math.sin((b.phase * 9.71 + 41.2) * 12.9898) * 43758.5453
        const laneOffset = ((laneSeed - Math.floor(laneSeed)) - 0.5) * train.exitHalf * 0.92
        const doorLaneX = EXIT_X + laneOffset
        const turningToDoor = b.x >= doorLaneX - 0.25
        const targetX = turningToDoor ? doorLaneX : doorLaneX - 0.10
        const targetZ = turningToDoor ? train.exitZ + train.exitSide * 0.72 : Math.sign(b.homeZ) * 0.62
        const dx = targetX - b.x
        const dz = targetZ - b.z
        const distance = Math.hypot(dx, dz)
        if (distance > 0.08) {
          const desiredVx = dx / distance * b.wanderSpeed
          const desiredVz = dz / distance * b.wanderSpeed
          const steer = Math.min(1, dt * 4.4)
          b.vx += (desiredVx - b.vx) * steer
          b.vz += (desiredVz - b.vz) * steer
          npcWalking = true
        }
        const beyondExit = train.exitSide > 0 ? b.z > train.exitZ + 0.48 : b.z < train.exitZ - 0.48
        if (beyondExit && Math.abs(b.x - EXIT_X) < train.exitHalf + 0.45) {
          b.behavior = 'departed'
          b.group.visible = false
          b.x = CAR_MAX_X + 12
          b.z = CAR_MAX_Z + 12
          b.vx = 0
          b.vz = 0
          continue
        }
      } else if (!fallen && b.behavior === 'wandering') {
        const toTarget = Math.hypot(b.targetX - b.x, b.targetZ - b.z)
        if (toTarget < 0.12) {
          if (!Number.isFinite(b.nextWander)) b.nextWander = S.time + 1.6 + eventChance(b, 13.7) * 2.4
          if (S.time >= b.nextWander) {
            const forwardBias = eventChance(b, 14.2) < 0.68 ? 1 : -1
            b.targetX = THREE.MathUtils.clamp(b.x + forwardBias * (1.2 + eventChance(b, 15.1) * 1.6), CAR_MIN_X + 0.55, EXIT_X - 0.72)
            b.targetZ = THREE.MathUtils.clamp(b.z + (eventChance(b, 16.9) - 0.5) * 1.6, -0.78, 0.78)
            b.wanderSpeed = 0.28 + config.wander * 0.10 + eventChance(b, 18.3) * 0.06
            b.nextWander = Number.POSITIVE_INFINITY
          }
        } else if (S.time >= b.pauseUntil) {
          const dx = b.targetX - b.x
          const dz = b.targetZ - b.z
          const distance = Math.hypot(dx, dz)
          if (distance > 0.12) {
            const desiredVx = dx / distance * b.wanderSpeed
            const desiredVz = dz / distance * b.wanderSpeed
            const steer = Math.min(1, dt * 2.8)
            b.vx += (desiredVx - b.vx) * steer
            b.vz += (desiredVz - b.vz) * steer
            npcWalking = true
          }
        }
      }
      const dampingRate = fallen ? 2.4 : b.player ? 5.6 : npcWalking ? 1.1 : 4.8
      const damping = Math.exp(-dampingRate * dt)
      b.vx *= damping
      b.vz *= damping
      b.x += b.vx * dt
      b.z += b.vz * dt

      const inExitLane = Math.abs(b.x - EXIT_X) < train.exitHalf + b.r * 0.65
      const canUseExit = (b.player || b.behavior === 'exiting' || b.behavior === 'boarding') && inExitLane
      const minZ = canUseExit && train.exitSide < 0 ? train.exitZ - 0.78 : CAR_MIN_Z + b.r
      const maxZ = canUseExit && train.exitSide > 0 ? train.exitZ + 0.78 : CAR_MAX_Z - b.r
      b.x = THREE.MathUtils.clamp(b.x, CAR_MIN_X + b.r, CAR_MAX_X - b.r)
      b.z = THREE.MathUtils.clamp(b.z, minZ, maxZ)

      for (const o of train.obstacles) {
        const dx = b.x - o.x, dz = b.z - o.z
        const d = Math.hypot(dx, dz) || 0.001
        const min = b.r + o.r
        if (d < min) {
          const push = min - d
          b.x += dx / d * push
          b.z += dz / d * push
          const vn = b.vx * dx / d + b.vz * dz / d
          if (vn < 0) { b.vx -= vn * dx / d * 1.35; b.vz -= vn * dz / d * 1.35 }
        }
      }
      if (b.player) {
        for (let seatIndex = 0; seatIndex < S.seated.length; seatIndex++) {
          const o = S.seated[seatIndex]
          if (o.state !== 'seated' && o.state !== 'preparing') continue
          const dx = b.x - o.x, dz = b.z - o.z
          const d = Math.hypot(dx, dz) || 0.001
          const min = b.r + o.r
          if (d >= min) continue
          const nx = dx / d, nz = dz / d
          b.x += nx * (min - d)
          b.z += nz * (min - d)
          const vn = b.vx * nx + b.vz * nz
          if (vn < 0) {
            const impact = -vn
            b.vx -= vn * nx * 1.28
            b.vz -= vn * nz * 1.28
            if (impact > 0.75 && S.time - S.lastSeatBump > 0.22) {
              S.lastSeatBump = S.time
              sound.bump()
              if (eventChance(b, 23.4 + seatIndex * 1.7) < 0.12) knockDown(b, 'forward', 1.18)
            }
          }
        }
      }
    }

    // Pairwise circular collision with momentum transfer and crowd pressure.
    for (let i = 0; i < S.bodies.length; i++) {
      const a = S.bodies[i]
      if (a.behavior === 'departed') continue
      for (let j = i + 1; j < S.bodies.length; j++) {
        const b = S.bodies[j]
        if (b.behavior === 'departed') continue
        const dx = b.x - a.x, dz = b.z - a.z
        const d2 = dx * dx + dz * dz
        // Passengers leaving together naturally compress into a door queue;
        // slightly softer NPC-to-NPC spacing prevents a permanent human wall.
        const bothExiting = a.behavior === 'exiting' && b.behavior === 'exiting'
        const min = (a.r + b.r) * (bothExiting ? 0.76 : 1)
        if (d2 >= min * min) continue
        const d = Math.sqrt(d2) || 0.001
        const nx = dx / d, nz = dz / d
        const invA = 1 / a.mass, invB = 1 / b.mass
        const pen = min - d
        a.x -= nx * pen * invA / (invA + invB)
        a.z -= nz * pen * invA / (invA + invB)
        b.x += nx * pen * invB / (invA + invB)
        b.z += nz * pen * invB / (invA + invB)
        const rel = (b.vx - a.vx) * nx + (b.vz - a.vz) * nz
        if (rel < 0) {
          const impulse = -(1.35 * rel) / (invA + invB)
          a.vx -= impulse * nx * invA * 0.35; a.vz -= impulse * nz * invA * 0.35
          b.vx += impulse * nx * invB * 0.35; b.vz += impulse * nz * invB * 0.35
          if ((a.player || b.player) && Math.abs(rel) > 0.55) sound.bump()
          const impact = Math.abs(rel)
          if (impact > 0.55) {
            const playerVictim = a.player ? a : b.player ? b : null
            const victim = playerVictim ?? (a.mass < b.mass ? a : b)
            const nearDoor = THREE.MathUtils.clamp((victim.x - (EXIT_X - 3.2)) / 3.2, 0, 1)
            const chance = (playerVictim ? config.fallChance : config.fallChance * 0.48) + nearDoor * 0.20 + S.swayKick * 0.16 + Math.min(0.14, (impact - 0.55) * 0.055)
            if (eventChance(victim, i * 7.3 + j * 3.1) < chance) {
              knockDown(victim, 'forward', victim.player ? 1.18 + nearDoor * 0.16 : 1.00 + nearDoor * 0.12)
            } else if (impact > 3.2) {
              knockDown(victim, 'side', victim.player ? 1.10 : 0.94)
            }
          }
        }
      }
    }

    for (const b of S.bodies) {
      if (b.behavior === 'departed') continue
      const fallen = b.fallenUntil > S.time
      const speed = Math.hypot(b.vx, b.vz)
      const travelled = Math.hypot(b.x - b.lastX, b.z - b.lastZ)
      b.lastX = b.x
      b.lastZ = b.z
      const locomoting = !fallen && speed > 0.08 && travelled > 0.0004
      if (locomoting) {
        const strideLength = b.player ? 1.05 : 0.58
        b.gaitPhase = (b.gaitPhase + travelled / strideLength * Math.PI * 2) % (Math.PI * 2)
      }
      const motionScale = reducedMotion ? 0.35 : 1
      const idleAir = Math.abs(Math.sin(S.time * 3.2 + b.phase))
      const idleBounce = locomoting ? 0 : (b.player ? 0.052 : 0.032) * idleAir * motionScale
      const stepBounce = locomoting ? Math.abs(Math.sin(b.gaitPhase)) * (b.player ? 0.038 : 0.026) * motionScale : 0
      b.group.position.set(b.x, 0.24 + (fallen ? 0 : idleBounce + stepBounce), b.z)
      // The world-space anchor never rotates: collision, floor marker, and player
      // light stay on the floor while only the articulated body pose falls.
      b.group.rotation.x = 0
      b.group.rotation.z = 0
      const rig = b.group.userData.rig as CharacterRig | undefined
      const pose = rig?.pose
      if (pose) {
        const rawP = b.fallDuration > 0 ? THREE.MathUtils.clamp((S.time - b.fallStarted) / b.fallDuration, 0, 1) : 1
        // Human falls accelerate into contact, barely pause, then spend the
        // remaining time on a readable recovery instead of moving in slow motion.
        const p = rawP < 0.46
          ? rawP / 0.46 * 0.58
          : rawP < 0.55
            ? 0.58 + (rawP - 0.46) / 0.09 * 0.10
            : 0.68 + (rawP - 0.55) / 0.45 * 0.32
        const key = (frames: Array<[number, number]>) => {
          let index = 1
          while (index < frames.length && p > frames[index][0]) index++
          const i1 = Math.max(0, index - 1)
          const i2 = Math.min(index, frames.length - 1)
          const a = frames[i1]
          const b = frames[i2]
          if (b[0] === a[0]) return b[1]
          const u = THREE.MathUtils.clamp((p - a[0]) / (b[0] - a[0]), 0, 1)
          const v0 = frames[Math.max(0, i1 - 1)][1]
          const v1 = a[1]
          const v2 = b[1]
          const v3 = frames[Math.min(frames.length - 1, i2 + 1)][1]
          const u2 = u * u
          const u3 = u2 * u
          return 0.5 * ((2 * v1) + (-v0 + v2) * u + (2 * v0 - 5 * v1 + 4 * v2 - v3) * u2 + (-v0 + 3 * v1 - 3 * v2 + v3) * u3)
        }
        if (fallen) {
          const sideDir = b.vz >= 0 ? 1 : -1
          const fallMotion = reducedMotion ? 0.65 : 1
          const nearLeg = sideDir > 0 ? rig.legR : rig.legL
          const farLeg = sideDir > 0 ? rig.legL : rig.legR
          const nearShin = sideDir > 0 ? rig.shinR : rig.shinL
          const farShin = sideDir > 0 ? rig.shinL : rig.shinR
          const nearArm = sideDir > 0 ? rig.armR : rig.armL
          const farArm = sideDir > 0 ? rig.armL : rig.armR
          const nearForearm = sideDir > 0 ? rig.forearmR : rig.forearmL
          const farForearm = sideDir > 0 ? rig.forearmL : rig.forearmR
          pose.rotation.y = 0
          if (rig.upperBody) rig.upperBody.rotation.y = sideDir * key([[0, 0], [0.24, 0.03], [0.58, -0.18], [0.76, -0.22], [0.91, -0.08], [1, 0]]) * fallMotion
          if (rig.head) {
            rig.head.rotation.x = key([[0, 0], [0.17, 0.08], [0.30, 0.24], [0.45, 0.38], [0.58, 0.44], [0.68, 0.40], [0.78, 0.29], [0.88, 0.16], [0.96, 0.04], [1, 0]]) * fallMotion
            rig.head.rotation.z = -sideDir * key([[0, 0], [0.30, 0.05], [0.58, 0.14], [0.68, 0.15], [0.88, 0.06], [1, 0]]) * fallMotion
          }
          if (rig.legL) { rig.legL.position.y = rig.hipY ?? rig.legL.position.y; rig.legL.position.z = 0 }
          if (rig.legR) { rig.legR.position.y = rig.hipY ?? rig.legR.position.y; rig.legR.position.z = 0 }

          if (b.fallKind === 'forward') {
            // Eleven continuous poses: balance loss, catch step, progressive knee
            // load, staggered palms, shoulder settle, hold, kneel, push and rise.
            pose.rotation.x = key([[0, 0], [0.08, -0.03], [0.17, -0.10], [0.30, -0.19], [0.45, -0.27], [0.58, -0.29], [0.68, -0.27], [0.78, -0.23], [0.88, -0.14], [0.96, -0.04], [1, 0]]) * fallMotion
            pose.rotation.z = sideDir * key([[0, 0], [0.08, 0.02], [0.17, 0.06], [0.30, 0.13], [0.45, 0.27], [0.58, 0.35], [0.68, 0.34], [0.78, 0.29], [0.88, 0.18], [0.96, 0.05], [1, 0]]) * fallMotion
            pose.position.y = key([[0, 0], [0.08, 0.01], [0.17, 0.03], [0.30, 0.08], [0.45, 0.16], [0.58, 0.21], [0.68, 0.20], [0.78, 0.17], [0.88, 0.11], [0.96, 0.03], [1, 0]]) * fallMotion
            pose.position.z = key([[0, 0], [0.08, -0.04], [0.17, -0.10], [0.30, -0.16], [0.58, -0.20], [0.68, -0.19], [0.78, -0.15], [0.88, -0.09], [0.96, -0.02], [1, 0]]) * fallMotion
            pose.position.x = sideDir * key([[0, 0], [0.17, 0.03], [0.30, 0.07], [0.45, 0.12], [0.68, 0.14], [0.78, 0.12], [0.88, 0.07], [0.96, 0.02], [1, 0]]) * fallMotion
            if (rig.upperBody) {
              rig.upperBody.rotation.x = key([[0, 0], [0.08, -0.03], [0.17, -0.13], [0.30, -0.34], [0.45, -0.61], [0.58, -0.72], [0.68, -0.68], [0.78, -0.51], [0.88, -0.28], [0.96, -0.07], [1, 0]]) * fallMotion
              rig.upperBody.rotation.z = sideDir * key([[0, 0], [0.17, 0.07], [0.30, 0.20], [0.45, 0.47], [0.58, 0.75], [0.68, 0.82], [0.78, 0.66], [0.88, 0.36], [0.96, 0.09], [1, 0]]) * fallMotion
              rig.upperBody.position.y = (rig.hipY ?? 0) + key([[0, 0], [0.17, -0.03], [0.30, -0.08], [0.45, -0.16], [0.68, -0.18], [0.78, -0.14], [0.88, -0.08], [0.96, -0.02], [1, 0]]) * fallMotion
            }
            const nearArmReach = key([[0, 0], [0.06, 0.08], [0.14, 0.42], [0.27, 0.96], [0.42, 1.34], [0.55, 1.46], [0.68, 1.35], [0.78, 1.03], [0.88, 0.58], [0.96, 0.10], [1, 0]]) * fallMotion
            const farArmReach = key([[0, 0], [0.10, 0.03], [0.20, 0.26], [0.34, 0.76], [0.49, 1.18], [0.61, 1.34], [0.68, 1.30], [0.78, 0.98], [0.88, 0.54], [0.96, 0.09], [1, 0]]) * fallMotion
            if (nearArm) { nearArm.rotation.x = nearArmReach; nearArm.rotation.z = sideDir * key([[0, 0], [0.42, 0.18], [0.55, 0.08], [0.72, 0.02], [0.93, 0], [1, 0]]) * fallMotion }
            if (farArm) { farArm.rotation.x = farArmReach; farArm.rotation.z = -sideDir * key([[0, 0], [0.34, 0.12], [0.49, 0.40], [0.61, 0.62], [0.72, 0.56], [0.84, 0.28], [1, 0]]) * fallMotion }
            if (nearForearm) nearForearm.rotation.x = key([[0, 0], [0.17, -0.16], [0.38, -0.48], [0.55, -0.88], [0.70, -0.66], [0.84, -0.34], [1, 0]]) * fallMotion
            if (farForearm) farForearm.rotation.x = key([[0, 0], [0.24, -0.08], [0.43, -0.34], [0.61, -0.74], [0.72, -0.58], [0.84, -0.28], [1, 0]]) * fallMotion
            if (nearLeg) { nearLeg.rotation.x = key([[0, 0], [0.10, 0.42], [0.24, -0.52], [0.58, -0.68], [0.74, -0.62], [0.84, -0.92], [0.93, -0.34], [1, 0]]) * fallMotion; nearLeg.rotation.z = sideDir * key([[0, 0], [0.58, 0.10], [0.84, 0.22], [1, 0]]) * fallMotion }
            if (farLeg) { farLeg.rotation.x = key([[0, 0], [0.10, -0.30], [0.24, -0.38], [0.58, 0.18], [0.74, 0.26], [0.84, -0.18], [1, 0]]) * fallMotion; farLeg.rotation.z = -sideDir * key([[0, 0], [0.58, 0.18], [0.84, 0.08], [1, 0]]) * fallMotion }
            if (nearShin) nearShin.rotation.x = key([[0, 0], [0.24, 1.04], [0.58, 1.28], [0.74, 1.18], [0.84, 1.48], [0.93, 0.58], [1, 0]]) * fallMotion
            if (farShin) farShin.rotation.x = key([[0, 0], [0.24, 0.72], [0.58, 0.92], [0.74, 0.84], [0.84, 0.62], [1, 0]]) * fallMotion
          } else {
            // Side falls cross-step, sit through the hip and let the forearm take
            // the last load; the torso bends separately instead of toppling rigidly.
            pose.rotation.x = key([[0, 0], [0.09, 0.02], [0.18, 0.05], [0.31, 0.09], [0.46, 0.13], [0.59, 0.14], [0.68, 0.13], [0.78, 0.10], [0.88, 0.06], [0.96, 0.02], [1, 0]]) * fallMotion
            pose.rotation.z = sideDir * key([[0, 0], [0.09, 0.03], [0.18, 0.08], [0.31, 0.17], [0.46, 0.31], [0.59, 0.38], [0.68, 0.37], [0.78, 0.31], [0.88, 0.19], [0.96, 0.05], [1, 0]]) * fallMotion
            pose.position.y = key([[0, 0], [0.09, 0.01], [0.18, 0.04], [0.31, 0.10], [0.46, 0.18], [0.59, 0.23], [0.68, 0.22], [0.78, 0.19], [0.88, 0.12], [0.96, 0.03], [1, 0]]) * fallMotion
            pose.position.z = 0
            pose.position.x = sideDir * key([[0, 0], [0.18, 0.03], [0.31, 0.08], [0.46, 0.14], [0.68, 0.16], [0.78, 0.14], [0.88, 0.08], [0.96, 0.02], [1, 0]]) * fallMotion
            if (rig.upperBody) {
              rig.upperBody.rotation.x = key([[0, 0], [0.18, 0.04], [0.31, 0.10], [0.46, 0.18], [0.59, 0.22], [0.68, 0.20], [0.78, 0.15], [0.88, 0.08], [0.96, 0.02], [1, 0]]) * fallMotion
              rig.upperBody.rotation.z = sideDir * key([[0, 0], [0.18, 0.08], [0.31, 0.25], [0.46, 0.55], [0.59, 0.84], [0.68, 0.91], [0.78, 0.73], [0.88, 0.40], [0.96, 0.10], [1, 0]]) * fallMotion
              rig.upperBody.position.y = (rig.hipY ?? 0) + key([[0, 0], [0.18, -0.02], [0.31, -0.06], [0.46, -0.13], [0.68, -0.16], [0.78, -0.13], [0.88, -0.07], [0.96, -0.02], [1, 0]]) * fallMotion
            }
            if (nearArm) { nearArm.rotation.x = key([[0, 0], [0.30, -0.54], [0.50, -0.86], [0.70, -0.72], [0.82, -0.34], [1, 0]]) * fallMotion; nearArm.rotation.z = sideDir * key([[0, 0], [0.30, 0.16], [0.50, 0.08], [0.82, 0], [1, 0]]) * fallMotion }
            if (farArm) { farArm.rotation.x = key([[0, 0], [0.30, -0.26], [0.50, -0.52], [0.70, -0.44], [0.82, -0.18], [1, 0]]) * fallMotion; farArm.rotation.z = -sideDir * key([[0, 0], [0.30, 0.42], [0.50, 0.64], [0.70, 0.58], [0.82, 0.28], [1, 0]]) * fallMotion }
            if (nearForearm) nearForearm.rotation.x = key([[0, 0], [0.30, -0.42], [0.50, -0.92], [0.70, -0.76], [0.82, -0.34], [1, 0]]) * fallMotion
            if (farForearm) farForearm.rotation.x = key([[0, 0], [0.30, -0.24], [0.50, -0.58], [0.70, -0.48], [0.82, -0.22], [1, 0]]) * fallMotion
            if (nearLeg) { nearLeg.rotation.x = key([[0, 0], [0.30, -0.56], [0.50, -0.72], [0.70, -0.68], [0.82, -0.96], [0.92, -0.38], [1, 0]]) * fallMotion; nearLeg.rotation.z = sideDir * key([[0, 0], [0.50, 0.18], [0.82, 0.24], [1, 0]]) * fallMotion }
            if (farLeg) { farLeg.rotation.x = key([[0, 0], [0.30, 0.22], [0.50, 0.38], [0.70, 0.34], [0.82, -0.14], [1, 0]]) * fallMotion; farLeg.rotation.z = -sideDir * key([[0, 0], [0.50, 0.14], [0.82, 0.06], [1, 0]]) * fallMotion }
            if (nearShin) nearShin.rotation.x = key([[0, 0], [0.30, 0.84], [0.50, 1.22], [0.70, 1.12], [0.82, 1.46], [0.92, 0.62], [1, 0]]) * fallMotion
            if (farShin) farShin.rotation.x = key([[0, 0], [0.30, 0.52], [0.50, 0.76], [0.70, 0.68], [0.82, 0.48], [1, 0]]) * fallMotion
          }
        } else {
          pose.rotation.x = 0
          pose.rotation.y = 0
          pose.rotation.z = 0
          pose.position.set(0, 0, 0)
          if (rig.upperBody) {
            rig.upperBody.rotation.x = 0
            rig.upperBody.rotation.y = 0
            rig.upperBody.rotation.z = 0
            rig.upperBody.position.set(0, rig.hipY ?? 0, 0)
          }
          if (rig.head) rig.head.rotation.set(0, 0, 0)
          if (rig.shinL) rig.shinL.rotation.set(0, 0, 0)
          if (rig.shinR) rig.shinR.rotation.set(0, 0, 0)
          if (rig.forearmL) rig.forearmL.rotation.set(0, 0, 0)
          if (rig.forearmR) rig.forearmR.rotation.set(0, 0, 0)
        }
      }
      if (!fallen) {
        if (speed > 0.08 && (b.player || b.behavior === 'wandering' || b.behavior === 'exiting')) {
          const desiredYaw = Math.atan2(b.vx, b.vz)
          const yawDelta = Math.atan2(Math.sin(desiredYaw - b.group.rotation.y), Math.cos(desiredYaw - b.group.rotation.y))
          b.group.rotation.y += yawDelta * Math.min(1, dt * (b.player ? 11 : 4.8))
        }
        const swingMax = b.player ? 0.56 : 0.42
        const swing = locomoting ? Math.sin(b.gaitPhase) * Math.min(swingMax, speed * (b.player ? 0.16 : 0.72)) : 0
        const gaitSin = Math.sin(b.gaitPhase)
        const footLift = b.player ? 0.12 : 0.075
        const readyLift = (0.09 + idleAir * 0.07) * motionScale
        const readyStep = Math.sin(S.time * 3.2 + b.phase) * 0.035 * motionScale
        const poseBlend = Math.min(1, dt * 10)
        const activity = (!b.player && !locomoting ? b.group.userData.activity : 'natural') as PassengerActivity
        const gesture = Math.sin(S.time * 1.8 + b.phase) * 0.035 * motionScale
        const legLTarget = locomoting ? swing : readyStep
        const legRTarget = locomoting ? -swing : -readyStep
        const armLTarget = locomoting ? -swing * 0.72 : activity === 'reading' ? -0.92 + gesture : activity === 'phone' ? -0.30 : -readyLift
        const armRTarget = locomoting ? swing * 0.72 : activity === 'reading' ? -0.92 - gesture : activity === 'calling' ? -0.18 : activity === 'phone' ? -0.92 + gesture : -readyLift
        const armLZ = activity === 'strap-left' ? 2.88 + gesture : activity === 'reading' ? 0.20 : 0
        const armRZ = activity === 'strap-right' ? -2.88 - gesture : activity === 'calling' ? -2.28 - gesture : activity === 'reading' ? -0.20 : activity === 'phone' ? -0.22 : 0
        const forearmLTarget = locomoting ? Math.max(0, -gaitSin) * -0.18 : activity === 'reading' ? -1.08 : activity === 'strap-left' ? -0.12 : -readyLift * 0.35
        const forearmRTarget = locomoting ? Math.max(0, gaitSin) * -0.18 : activity === 'reading' ? -1.08 : activity === 'calling' ? -1.34 : activity === 'phone' ? -1.12 : activity === 'strap-right' ? -0.12 : -readyLift * 0.35
        if (rig?.legL) rig.legL.rotation.x = THREE.MathUtils.lerp(rig.legL.rotation.x, legLTarget, poseBlend)
        if (rig?.legR) rig.legR.rotation.x = THREE.MathUtils.lerp(rig.legR.rotation.x, legRTarget, poseBlend)
        if (rig?.armL) rig.armL.rotation.x = THREE.MathUtils.lerp(rig.armL.rotation.x, armLTarget, poseBlend)
        if (rig?.armR) rig.armR.rotation.x = THREE.MathUtils.lerp(rig.armR.rotation.x, armRTarget, poseBlend)
        if (rig?.shinL) rig.shinL.rotation.x = THREE.MathUtils.lerp(rig.shinL.rotation.x, locomoting ? Math.max(0, gaitSin) * 0.42 : 0, poseBlend)
        if (rig?.shinR) rig.shinR.rotation.x = THREE.MathUtils.lerp(rig.shinR.rotation.x, locomoting ? Math.max(0, -gaitSin) * 0.42 : 0, poseBlend)
        if (rig?.forearmL) rig.forearmL.rotation.x = THREE.MathUtils.lerp(rig.forearmL.rotation.x, forearmLTarget, poseBlend)
        if (rig?.forearmR) rig.forearmR.rotation.x = THREE.MathUtils.lerp(rig.forearmR.rotation.x, forearmRTarget, poseBlend)
        if (rig?.legL) rig.legL.position.y = THREE.MathUtils.lerp(rig.legL.position.y, (rig.hipY ?? 0) + (locomoting ? Math.max(0, gaitSin) * footLift : 0), poseBlend)
        if (rig?.legR) rig.legR.position.y = THREE.MathUtils.lerp(rig.legR.position.y, (rig.hipY ?? 0) + (locomoting ? Math.max(0, -gaitSin) * footLift : 0), poseBlend)
        if (pose) pose.rotation.y = THREE.MathUtils.lerp(pose.rotation.y, locomoting ? gaitSin * 0.055 * motionScale : 0, poseBlend)
        if (rig?.upperBody) {
          rig.upperBody.rotation.x = THREE.MathUtils.lerp(rig.upperBody.rotation.x, activity === 'reading' || activity === 'phone' ? 0.10 : 0, poseBlend)
          rig.upperBody.rotation.y = THREE.MathUtils.lerp(rig.upperBody.rotation.y, locomoting ? -gaitSin * 0.085 * motionScale : 0, poseBlend)
        }
        if (rig?.head) {
          rig.head.rotation.x = THREE.MathUtils.lerp(rig.head.rotation.x, activity === 'reading' || activity === 'phone' ? 0.16 : 0, poseBlend)
          rig.head.rotation.z = THREE.MathUtils.lerp(rig.head.rotation.z, activity === 'calling' ? -0.08 : 0, poseBlend)
        }
        if (rig?.legL) rig.legL.rotation.z = 0
        if (rig?.legR) rig.legR.rotation.z = 0
        if (rig?.armL) rig.armL.rotation.z = THREE.MathUtils.lerp(rig.armL.rotation.z, armLZ, poseBlend)
        if (rig?.armR) rig.armR.rotation.z = THREE.MathUtils.lerp(rig.armR.rotation.z, armRZ, poseBlend)
        if (rig?.forearmL) rig.forearmL.rotation.z = 0
        if (rig?.forearmR) rig.forearmR.rotation.z = 0
      }
    }

    // A stable third-person chase camera keeps the player in the lower-middle
    // foreground while the green exit arrow remains ahead at the top of the screen.
    const cameraTrackZ = player.z * 0.35
    cameraGoal.current.set(QA_SEAT_VIEW ? -2.20 : player.x - 5.2, QA_SEAT_VIEW ? 3.50 : 6.05, QA_SEAT_VIEW ? 0.40 : cameraTrackZ)
    camera.position.lerp(cameraGoal.current, 1 - Math.exp(-dt * 7.5))
    cameraLook.current.lerp(
      cameraGoal.current.set(QA_SEAT_VIEW ? -4.20 : player.x + 4.8, QA_SEAT_VIEW ? 0.66 : 0.70, QA_SEAT_VIEW ? -1.78 : cameraTrackZ),
      1 - Math.exp(-dt * 9),
    )
    camera.lookAt(cameraLook.current)

    const playerBeyondExit = train.exitSide > 0 ? player.z > train.exitZ + 0.36 : player.z < train.exitZ - 0.36
    if (playerBeyondExit && Math.abs(player.x - EXIT_X) < train.exitHalf + 0.4) {
      S.ended = true
      sound.win()
      onOutcome('clear', { timeLeft: S.timeLeft, falls: S.falls })
      return
    }
    if (S.timeLeft <= 0) {
      S.ended = true
      sound.lose()
      onOutcome('fail', { timeLeft: 0, falls: S.falls })
      return
    }

    if (S.hudT <= 0) {
      S.hudT = 0.08
      onHud({
        timeLeft: S.timeLeft,
        distance: Math.hypot(EXIT_X - player.x, train.exitZ - player.z),
        falls: S.falls,
        braced: S.braced,
        swayWarning: warningNow,
        swayDirection: S.swayDirection,
      })
    }
  })

  return null
}

export default function TrainScene(props: Props) {
  const lighting = stationLighting(props.config.stationEvent)
  return (
    <Canvas
      className="got__canvas"
      shadows
      dpr={[1, 1.65]}
      gl={{ antialias: true, alpha: false }}
      onCreated={({ gl }) => { gl.toneMapping = THREE.ACESFilmicToneMapping; gl.toneMappingExposure = 1.0; gl.shadowMap.type = THREE.PCFSoftShadowMap }}
    >
      <color attach="background" args={[lighting.background]} />
      <fog attach="fog" args={[lighting.fog, lighting.fogNear, lighting.fogFar]} />
      <PerspectiveCamera
        makeDefault
        position={[START_X - FORWARD_X * 5.2, 6.05, START_Z - FORWARD_Z * 5.2]}
        fov={55}
        near={0.15}
        far={100}
      />
      <hemisphereLight args={[lighting.sky, lighting.ground, lighting.hemi]} />
      <directionalLight position={[-6.5, 16, 8]} intensity={lighting.main} color={lighting.mainColor} castShadow shadow-mapSize={[2048, 2048]} shadow-camera-left={-12} shadow-camera-right={12} shadow-camera-top={10} shadow-camera-bottom={-10} shadow-camera-near={0.5} shadow-camera-far={60} shadow-bias={-0.0004} shadow-radius={2.4} />
      <directionalLight position={[9, 5, -3]} intensity={lighting.fill} color={lighting.fillColor} />
      <directionalLight position={[5, 7, -10]} intensity={lighting.rim} color={lighting.rimColor} />
      <World {...props} />
    </Canvas>
  )
}
