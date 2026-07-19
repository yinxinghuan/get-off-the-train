import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { PerspectiveCamera } from '@react-three/drei'
import { MutableRefObject, useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { box, C, cyl, makeCharacter, makeMonsterPassenger, makePlayer, MONSTER_KINDS, passengerStyle, toon } from './models'
import type { HudState, InputVector, LevelConfig } from './types'
import { sound } from '../audio/sound'

interface OutcomeData { timeLeft: number; falls: number }
interface Props {
  level: number
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
  fallKind: 'side' | 'tumble'
  protectedUntil: number
  phase: number
  homeX: number
  homeZ: number
  player: boolean
}

interface Obstacle { x: number; z: number; r: number }

const CAR_MIN_X = -7.65
const CAR_MAX_X = 7.65
const CAR_MIN_Z = -2.42
const CAR_MAX_Z = 2.28
const START_X = -6.45
const START_Z = 0
const EXIT_X = 6.20
const EXIT_Z = CAR_MAX_Z + 0.62
const FORWARD_X = 1
const FORWARD_Z = 0
const RIGHT_X = 0
const RIGHT_Z = 1
const QA_AUTORUN = import.meta.env.DEV && new URLSearchParams(location.search).has('qaRun')
const QA_TUMBLE = import.meta.env.DEV && new URLSearchParams(location.search).has('qaTumble')

function mulberry32(seed: number) {
  return () => {
    let t = seed += 0x6D2B79F5
    t = Math.imul(t ^ t >>> 15, t | 1)
    t ^= t + Math.imul(t ^ t >>> 7, t | 61)
    return ((t ^ t >>> 14) >>> 0) / 4294967296
  }
}

function addFloorArrow(root: THREE.Group, x: number, z: number, scale = 1, rotationY = 0) {
  const arrow = new THREE.Group()
  const stem = box(0.72 * scale, 0.025, 0.22 * scale, C.yellow, 0, 0, 0)
  const head = new THREE.Mesh(new THREE.ConeGeometry(0.34 * scale, 0.55 * scale, 3), toon(C.yellow))
  head.rotation.z = -Math.PI / 2
  head.position.set(0.55 * scale, 0.015, 0)
  arrow.add(stem, head)
  arrow.position.set(x, 0.19, z)
  arrow.rotation.y = rotationY
  root.add(arrow)
}

function buildTrain(config: LevelConfig) {
  const root = new THREE.Group()
  const handles: THREE.Group[] = []
  const carriageLights: THREE.PointLight[] = []
  const obstacles: Obstacle[] = []
  const bench = config.variant === 'ad-wrap' ? 0x3d6680 : config.variant === 'maintenance' ? 0x555d61 : 0x315f76
  const wall = config.variant === 'long-seat' ? 0xd9dddc : 0xcbd0d1

  root.add(box(16.4, 0.32, 5.55, C.ink, 0, -0.04, 0))
  root.add(box(16.05, 0.18, 5.18, 0x62686b, 0, 0.12, 0))
  for (let x = -7.2; x <= 7.2; x += 0.72) root.add(box(0.025, 0.012, 4.96, 0x878d8f, x, 0.218, 0))
  // The left wall remains continuous; the passenger door opens in the right wall.
  root.add(box(16.2, 1.6, 0.18, wall, 0, 1.0, CAR_MIN_Z - 0.31, true))

  // A real subway door sits on the side of the carriage near its far end.
  const exitHalf = config.variant === 'narrow-door' ? 0.76 : 1.22
  const sideStart = CAR_MIN_X - 0.45
  const sideEnd = CAR_MAX_X + 0.45
  const beforeLen = EXIT_X - exitHalf - sideStart
  const afterStart = EXIT_X + exitHalf
  const afterLen = sideEnd - afterStart
  root.add(box(beforeLen, 2.5, 0.22, wall, sideStart + beforeLen / 2, 1.42, CAR_MAX_Z + 0.25, true))
  root.add(box(afterLen, 2.5, 0.22, wall, afterStart + afterLen / 2, 1.42, CAR_MAX_Z + 0.25, true))
  root.add(box(0.24, 2.7, 0.34, C.red, EXIT_X - exitHalf - 0.1, 1.48, CAR_MAX_Z + 0.2, true))
  root.add(box(0.24, 2.7, 0.34, C.red, EXIT_X + exitHalf + 0.1, 1.48, CAR_MAX_Z + 0.2, true))
  root.add(box(exitHalf * 2.65, 0.28, 0.34, C.ink, EXIT_X, 2.76, CAR_MAX_Z + 0.2, true))
  root.add(box(exitHalf * 2.25, 0.16, 0.37, C.yellow, EXIT_X, 2.77, CAR_MAX_Z + 0.16, true))
  root.add(box(exitHalf * 2.12, 0.08, 0.68, C.yellow, EXIT_X, 0.23, CAR_MAX_Z + 0.16, true))
  root.add(box(exitHalf * 2.4, 0.12, 1.3, C.floor, EXIT_X, 0.10, CAR_MAX_Z + 0.94))
  for (let i = -4; i <= 4; i++) root.add(box(0.12, 0.035, 0.58, i % 2 ? C.ink : C.red, EXIT_X + i * exitHalf * 0.22, 0.29, CAR_MAX_Z + 0.14))

  // The forward end is now visibly closed, removing the false suggestion that
  // players should run through the front of the train.
  root.add(box(0.22, 2.5, 5.18, wall, CAR_MAX_X + 0.25, 1.42, 0, true))
  // Parked sliding-door leaves, dark glazing, and signal lamps make the side
  // opening read as a real subway doorway instead of a gap in a toy wall.
  root.add(box(0.38, 2.25, 0.16, 0xaeb4b6, EXIT_X - exitHalf - 0.29, 1.45, CAR_MAX_Z + 0.17))
  root.add(box(0.38, 2.25, 0.16, 0xaeb4b6, EXIT_X + exitHalf + 0.29, 1.45, CAR_MAX_Z + 0.17))
  root.add(box(0.22, 0.72, 0.04, 0x26343c, EXIT_X - exitHalf - 0.29, 1.72, CAR_MAX_Z + 0.075))
  root.add(box(0.22, 0.72, 0.04, 0x26343c, EXIT_X + exitHalf + 0.29, 1.72, CAR_MAX_Z + 0.075))
  for (const x of [EXIT_X - 0.48, EXIT_X, EXIT_X + 0.48]) {
    const signal = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.055, 12), new THREE.MeshStandardMaterial({ color: 0x8ff0aa, emissive: 0x43c96d, emissiveIntensity: 2.8 }))
    signal.rotation.x = Math.PI / 2
    signal.position.set(x, 2.69, CAR_MAX_Z + 0.015)
    signal.userData.ownsMaterial = true
    root.add(signal)
  }
  const exitWarm = new THREE.PointLight(0xffd56a, 2.9, 5.3, 1.55)
  exitWarm.position.set(EXIT_X, 2.12, CAR_MAX_Z + 0.02)
  root.add(exitWarm)
  const exitGreen = new THREE.PointLight(0x66e293, 1.45, 3.5, 1.7)
  exitGreen.position.set(EXIT_X, 2.72, CAR_MAX_Z - 0.12)
  root.add(exitGreen)

  // Benches read as authored subway furniture, with dark end caps.
  const benchSegments = config.variant === 'long-seat' ? [[-3.5, 6.7], [3.0, 2.8]] : [[-4.2, 4.8], [0.0, 2.0]]
  for (const side of [-1, 1]) {
    for (const [x, len] of benchSegments) {
      const z = side * 2.08
      root.add(box(len, 0.42, 0.58, bench, x, 0.54, z, true))
      root.add(box(len, 0.85, 0.16, bench, x, 1.05, z + side * 0.31, true))
      root.add(box(0.16, 0.75, 0.72, C.ink, x - len / 2, 0.67, z))
      root.add(box(0.16, 0.75, 0.72, C.ink, x + len / 2, 0.67, z))
    }
  }

  // Windows and ad cards on the far wall.
  for (const x of [-5.8, -3.2, -0.6, 2.0]) {
    root.add(box(1.65, 0.72, 0.05, C.ink, x, 1.28, CAR_MIN_Z - 0.20))
    root.add(box(1.44, 0.54, 0.045, C.cyan, x, 1.29, CAR_MIN_Z - 0.16))
  }
  const adColors = config.variant === 'ad-wrap' ? [C.red, C.yellow, 0xa77abc, C.cyan] : [C.yellow, C.paper, C.red, C.paper]
  for (let i = 0; i < 4; i++) {
    const x = -5.8 + i * 2.6
    root.add(box(1.35, 0.42, 0.055, adColors[i], x, 2.02, CAR_MIN_Z - 0.16, true))
    root.add(box(0.82, 0.07, 0.02, C.ink, x, 2.07, CAR_MIN_Z - 0.11))
  }
  for (let i = 0; i < 11; i++) root.add(box(0.025, 2.15, 0.025, 0x8f979a, -7.0 + i * 1.38, 1.42, CAR_MIN_Z - 0.13))

  // Route strip + station lights.
  root.add(box(10.8, 0.18, 0.08, C.ink, -0.45, 2.52, CAR_MIN_Z - 0.12))
  root.add(box(10.5, 0.11, 0.05, C.paper, -0.45, 2.53, CAR_MIN_Z - 0.06))
  for (let i = 0; i < 9; i++) root.add(cyl(0.07, 0.04, i > 6 ? C.red : C.yellow, -5.1 + i * 1.17, 2.56, CAR_MIN_Z - 0.02, false, 8))

  // Poles, rail and hanging straps remain visible because the roof is absent.
  root.add(cyl(0.055, 15.0, C.ink, 0, 3.0, 0, false, 8).rotateZ(Math.PI / 2))
  root.add(cyl(0.038, 14.8, C.steel, 0, 3.0, 0, false, 8).rotateZ(Math.PI / 2))
  const poleXs = config.variant === 'commuter' ? [-5.4, -1.9, 1.7] : [-5.6, -2.7, 0.2, 3.0]
  for (const x of poleXs) {
    root.add(cyl(0.11, 2.82, C.ink, x, 1.55, 0, true, 8))
    root.add(cyl(0.075, 2.78, C.steel, x, 1.55, 0, false, 8))
    obstacles.push({ x, z: 0, r: 0.24 })
  }
  for (let i = 0; i < 8; i++) {
    const h = new THREE.Group()
    h.position.set(-5.9 + i * 1.68, 2.92, 0)
    h.add(box(0.055, 0.42, 0.055, C.ink, 0, -0.22, 0))
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.05, 6, 8), toon(i % 3 === 0 ? C.yellow : C.paper))
    ring.rotation.x = Math.PI / 2
    ring.position.y = -0.5
    ring.castShadow = true
    h.add(ring)
    handles.push(h)
    root.add(h)
  }

  // Suspended carriage lamps keep the roofless cutaway readable. The fixtures
  // and their light sources move with the train instead of floating in screen space.
  for (let i = 0; i < 5; i++) {
    const x = -5.6 + i * 2.85
    root.add(box(1.18, 0.09, 0.16, C.ink, x, 3.23, -1.42))
    const tube = new THREE.Mesh(
      new THREE.BoxGeometry(1.02, 0.055, 0.11),
      new THREE.MeshBasicMaterial({ color: i === 3 ? 0xd9decb : 0xffedbd }),
    )
    tube.position.set(x, 3.17, -1.42)
    root.add(tube)
    const lamp = new THREE.PointLight(i === 3 ? 0xc9d9d2 : 0xffdfaa, 1.05, 5.8, 1.7)
    lamp.position.set(x, 2.92, -0.72)
    lamp.userData.phase = i * 1.37
    carriageLights.push(lamp)
    root.add(lamp)
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
  addFloorArrow(root, EXIT_X, 0.75, 0.72, -Math.PI / 2)
  addFloorArrow(root, EXIT_X, 1.55, 0.72, -Math.PI / 2)

  // Environment-only material pass: characters keep their authored low-poly
  // materials, while the carriage gets physically lit rough metal/plastic.
  root.traverse((object) => {
    const m = object as THREE.Mesh
    if (m.userData.outlineShell) { m.visible = false; return }
    if (!(m.material instanceof THREE.MeshToonMaterial)) return
    const color = m.material.color.clone()
    const hex = color.getHex()
    const metal = hex === C.steel || hex === C.ink
    const guide = hex === C.yellow
    m.material = new THREE.MeshStandardMaterial({
      color,
      roughness: metal ? 0.34 : 0.72,
      metalness: metal ? 0.72 : 0.04,
      emissive: guide ? color : new THREE.Color(0x000000),
      emissiveIntensity: guide ? 0.22 : 0,
      transparent: m.material.transparent,
      opacity: m.material.opacity,
    })
    m.userData.ownsMaterial = true
  })

  return { root, handles, carriageLights, obstacles, exitHalf }
}

function dispose(root: THREE.Object3D) {
  root.traverse((o) => {
    const m = o as THREE.Mesh
    if (m.geometry) m.geometry.dispose()
    if (m.userData.ownsMaterial && m.material) (m.material as THREE.Material).dispose()
  })
}

function World({ level, config, active, input, reducedMotion, onHud, onOutcome }: Props) {
  const { scene, camera } = useThree()
  const train = useMemo(() => buildTrain(config), [config])
  const fx = useMemo(() => new THREE.Group(), [])
  const cameraGoal = useRef(new THREE.Vector3())
  const cameraLook = useRef(new THREE.Vector3(START_X + FORWARD_X * 4.8, 0.70, START_Z + FORWARD_Z * 4.8))
  const state = useRef({
    bodies: [] as Body[], player: null as Body | null, time: 0, timeLeft: config.time,
    nextSway: config.swayPeriod, warningSent: false, swayDirection: (level % 2 ? -1 : 1) as -1 | 1,
    swayKick: 0, falls: 0, braceTime: 0, braced: false, hudT: 0, ended: false, lastFrame: 0,
    qaTumbleDone: false,
  })

  useEffect(() => {
    const S = state.current
    scene.add(train.root, fx)
    const playerGroup = makePlayer()
    playerGroup.position.set(START_X, 0.24, START_Z)
    playerGroup.rotation.y = Math.atan2(FORWARD_X, FORWARD_Z)
    train.root.add(playerGroup)
    const player: Body = { group: playerGroup, x: START_X, z: START_Z, vx: 0, vz: 0, r: 0.34, mass: 1.28, stability: 2.25, fallenUntil: 0, fallStarted: 0, fallDuration: 0, fallKind: 'side', protectedUntil: 0, phase: 0, homeX: START_X, homeZ: START_Z, player: true }
    S.player = player
    S.bodies.push(player)
    camera.position.set(START_X - FORWARD_X * 5.2, 6.05, START_Z - FORWARD_Z * 5.2)
    camera.lookAt(cameraLook.current)

    const rand = mulberry32(9017 + level * 103)
    let made = 0
    const cols = 9
    const rows = 6
    for (let row = 0; row < rows && made < config.passengers; row++) {
      for (let col = 0; col < cols && made < config.passengers; col++) {
        const x = -6.6 + col * 1.58 + (rand() - 0.5) * 0.28
        const z = -1.34 + row * 0.54 + (rand() - 0.5) * 0.12
        if (Math.hypot(x - START_X, z - START_Z) < 1.25 || (Math.abs(x - EXIT_X) < train.exitHalf + 0.25 && z > CAR_MAX_Z - 1.15)) continue
        const monsterEvery = level === 3 ? 7 : level === 4 ? 4 : level < 10 ? 3 : 2
        const monsterKind = monsterEvery && made % monsterEvery === 0 ? MONSTER_KINDS[(made / monsterEvery + level) % MONSTER_KINDS.length | 0] : null
        const style = passengerStyle(made, level)
        const group = monsterKind ? makeMonsterPassenger(monsterKind) : makeCharacter(style)
        group.position.set(x, 0.24, z)
        group.rotation.y = (rand() - 0.5) * 0.65
        train.root.add(group)
        const broad = monsterKind === 'werewolf' || (!monsterKind && style.body === 'broad')
        const ghost = monsterKind === 'ghost'
        S.bodies.push({
          group, x, z, vx: 0, vz: 0, r: broad ? 0.44 : style.body === 'small' ? 0.29 : 0.36,
          mass: broad ? 1.72 : ghost ? 0.58 : style.body === 'small' ? 0.72 : 1.05,
          stability: ghost ? 1.55 : broad ? 2.9 : 1.8 + rand() * 1.2,
          fallenUntil: 0, fallStarted: 0, fallDuration: 0, fallKind: 'side', protectedUntil: 0,
          phase: rand() * Math.PI * 2, homeX: x, homeZ: z, player: false,
        })
        made++
      }
    }
    return () => {
      train.root.remove(playerGroup)
      scene.remove(train.root, fx)
      dispose(train.root)
      dispose(fx)
    }
  }, [scene, camera, train, fx, config.passengers, level])

  useFrame(() => {
    const S = state.current
    if (!active || S.ended || !S.player) return
    const now = performance.now()
    if (!S.lastFrame) { S.lastFrame = now; return }
    const dt = Math.min((now - S.lastFrame) / 1000, 0.033)
    S.lastFrame = now
    if (dt <= 0) return
    S.time += dt
    S.timeLeft = Math.max(0, S.timeLeft - dt)
    S.hudT -= dt

    const eventChance = (b: Body, salt: number) => {
      const raw = Math.sin((S.time * 17.13 + b.phase * 9.71 + salt) * 12.9898) * 43758.5453
      return raw - Math.floor(raw)
    }
    const knockDown = (b: Body, kind: 'side' | 'tumble', duration: number) => {
      if (S.time < b.protectedUntil) return false
      b.fallKind = kind
      b.fallStarted = S.time
      b.fallDuration = duration
      b.fallenUntil = S.time + duration
      b.protectedUntil = b.fallenUntil + 0.30
      if (b.player) { S.falls++; kind === 'tumble' ? sound.tumble() : sound.fall() }
      return true
    }

    if (QA_TUMBLE && !S.qaTumbleDone && S.time > 0.9) {
      S.qaTumbleDone = knockDown(S.player, 'tumble', 1.56)
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
          const tumble = eventChance(b, 3.7) < config.swayTumbleChance + nearDoor * 0.16
          knockDown(b, tumble ? 'tumble' : 'side', tumble ? (b.player ? 1.48 : 1.22) : (b.player ? 1.02 : 0.82 + ((b.phase * 97) % 0.52)))
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
      lamp.intensity = (reducedMotion ? 1.0 : slowBreath * looseLamp * impactDip) * 1.24
    }

    const player = S.player
    if (QA_AUTORUN) input.current = player.x < EXIT_X - 0.2 ? { x: 0, z: -1 } : { x: 1, z: 0 }
    for (const b of S.bodies) {
      const fallen = b.fallenUntil > S.time
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
      } else if (!fallen) {
        const nearDoor = THREE.MathUtils.clamp((b.homeX - (EXIT_X - 3.5)) / 3.5, 0, 1)
        const wander = config.wander * (0.55 + ((b.phase * 13) % 0.35))
        const tx = b.homeX + Math.sin(S.time * (0.62 + nearDoor * 0.28) + b.phase) * (0.42 + nearDoor * 0.46)
        const tz = b.homeZ + Math.cos(S.time * (0.70 + nearDoor * 0.35) + b.phase * 1.3) * (0.30 + nearDoor * 0.58)
        b.vx += THREE.MathUtils.clamp(tx - b.x, -1, 1) * wander * dt
        b.vz += THREE.MathUtils.clamp(tz - b.z, -1, 1) * wander * dt
      }
      const damping = Math.exp(-(fallen ? 2.4 : 5.6) * dt)
      b.vx *= damping
      b.vz *= damping
      b.x += b.vx * dt
      b.z += b.vz * dt

      const inExitLane = Math.abs(b.x - EXIT_X) < train.exitHalf + b.r * 0.65
      const maxZ = b.player && inExitLane ? EXIT_Z + 0.78 : CAR_MAX_Z - b.r
      b.x = THREE.MathUtils.clamp(b.x, CAR_MIN_X + b.r, CAR_MAX_X - b.r)
      b.z = THREE.MathUtils.clamp(b.z, CAR_MIN_Z + b.r, maxZ)

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
    }

    // Pairwise circular collision with momentum transfer and crowd pressure.
    for (let i = 0; i < S.bodies.length; i++) {
      const a = S.bodies[i]
      for (let j = i + 1; j < S.bodies.length; j++) {
        const b = S.bodies[j]
        const dx = b.x - a.x, dz = b.z - a.z
        const d2 = dx * dx + dz * dz
        const min = a.r + b.r
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
            const chance = (playerVictim ? config.tumbleChance : config.tumbleChance * 0.48) + nearDoor * 0.20 + S.swayKick * 0.16 + Math.min(0.14, (impact - 0.55) * 0.055)
            if (eventChance(victim, i * 7.3 + j * 3.1) < chance) {
              knockDown(victim, 'tumble', victim.player ? 1.34 + nearDoor * 0.24 : 1.08 + nearDoor * 0.18)
            } else if (impact > 3.2) {
              knockDown(victim, 'side', victim.player ? 1.02 : 0.88)
            }
          }
        }
      }
    }

    for (const b of S.bodies) {
      const fallen = b.fallenUntil > S.time
      const speed = Math.hypot(b.vx, b.vz)
      const motionScale = reducedMotion ? 0.35 : 1
      const idleAir = Math.abs(Math.sin(S.time * 3.2 + b.phase))
      const idleBounce = (b.player ? 0.075 : 0.045) * idleAir * motionScale
      const stepBounce = Math.abs(Math.sin(S.time * 7 + b.phase)) * Math.min(0.065, speed * 0.018) * motionScale
      const tumbleProgress = b.fallKind === 'tumble' && b.fallDuration > 0
        ? THREE.MathUtils.clamp((S.time - b.fallStarted) / b.fallDuration, 0, 1)
        : 0
      const tumbleLift = fallen && b.fallKind === 'tumble' ? Math.sin(tumbleProgress * Math.PI) * 0.48 * motionScale : 0
      b.group.position.set(b.x, 0.24 + (fallen ? tumbleLift : idleBounce + stepBounce), b.z)
      if (fallen && b.fallKind === 'tumble') {
        const dir = b.vz >= 0 ? 1 : -1
        b.group.rotation.x = tumbleProgress * Math.PI * 2 * dir
        b.group.rotation.z = Math.sin(tumbleProgress * Math.PI) * 0.18 * dir
      } else {
        if (!fallen && b.fallKind === 'tumble' && Math.abs(b.group.rotation.x) > Math.PI * 1.5) b.group.rotation.x = 0
        const targetRot = fallen ? (b.vz >= 0 ? 1.35 : -1.35) : 0
        b.group.rotation.x = THREE.MathUtils.lerp(b.group.rotation.x, targetRot, Math.min(1, dt * (fallen ? 10 : 7)))
        b.group.rotation.z = THREE.MathUtils.lerp(b.group.rotation.z, 0, Math.min(1, dt * 9))
      }
      if (!fallen) {
        if (speed > 0.08) b.group.rotation.y = Math.atan2(b.vx, b.vz)
        const rig = b.group.userData.rig as { legL?: THREE.Group; legR?: THREE.Group; armL?: THREE.Group; armR?: THREE.Group } | undefined
        const swing = Math.sin(S.time * 7 + b.phase) * Math.min(0.46, speed * 0.16)
        const readyLift = (0.09 + idleAir * 0.07) * motionScale
        const readyStep = Math.sin(S.time * 3.2 + b.phase) * 0.035 * motionScale
        if (rig?.legL) rig.legL.rotation.x = swing + readyStep
        if (rig?.legR) rig.legR.rotation.x = -swing - readyStep
        if (rig?.armL) rig.armL.rotation.x = -swing * 0.75 - readyLift
        if (rig?.armR) rig.armR.rotation.x = swing * 0.75 - readyLift
      }
    }

    // A stable third-person chase camera keeps the player in the lower-middle
    // foreground while the yellow exit remains ahead at the top of the screen.
    const cameraTrackZ = player.z * 0.35
    cameraGoal.current.set(player.x - 5.2, 6.05, cameraTrackZ)
    camera.position.lerp(cameraGoal.current, 1 - Math.exp(-dt * 7.5))
    cameraLook.current.lerp(
      cameraGoal.current.set(player.x + 4.8, 0.70, cameraTrackZ),
      1 - Math.exp(-dt * 9),
    )
    camera.lookAt(cameraLook.current)

    if (player.z > EXIT_Z + 0.36 && Math.abs(player.x - EXIT_X) < train.exitHalf + 0.4) {
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
        distance: Math.hypot(EXIT_X - player.x, EXIT_Z - player.z),
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
  return (
    <Canvas
      className="got__canvas"
      shadows
      dpr={[1, 1.65]}
      gl={{ antialias: true, alpha: false }}
      onCreated={({ gl }) => { gl.toneMapping = THREE.ACESFilmicToneMapping; gl.toneMappingExposure = 0.96 }}
    >
      <color attach="background" args={[0x0d0b12]} />
      <fog attach="fog" args={[0x0d0b12, 21, 42]} />
      <PerspectiveCamera
        makeDefault
        position={[START_X - FORWARD_X * 5.2, 6.05, START_Z - FORWARD_Z * 5.2]}
        fov={55}
        near={0.15}
        far={100}
      />
      <hemisphereLight args={[0xaeb1bd, 0x2b202b, 0.64]} />
      <directionalLight position={[-6, 12, 8]} intensity={1.46} color={0xffe5b6} castShadow shadow-mapSize={[1024, 1024]} shadow-camera-left={-12} shadow-camera-right={12} shadow-camera-top={10} shadow-camera-bottom={-10} />
      <directionalLight position={[8, 6, -9]} intensity={0.54} color={0x8db9c3} />
      <World {...props} />
    </Canvas>
  )
}
