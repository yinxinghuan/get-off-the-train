import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrthographicCamera } from '@react-three/drei'
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
  protectedUntil: number
  phase: number
  homeX: number
  homeZ: number
  player: boolean
}

interface Obstacle { x: number; z: number; r: number }

const DOOR_X = 5.15
const CAR_MIN_X = -7.65
const CAR_MAX_X = 7.65
const CAR_MIN_Z = -2.42
const CAR_MAX_Z = 2.28

function mulberry32(seed: number) {
  return () => {
    let t = seed += 0x6D2B79F5
    t = Math.imul(t ^ t >>> 15, t | 1)
    t ^= t + Math.imul(t ^ t >>> 7, t | 61)
    return ((t ^ t >>> 14) >>> 0) / 4294967296
  }
}

function addFloorArrow(root: THREE.Group, x: number, z: number, scale = 1) {
  const stem = box(0.22 * scale, 0.025, 0.72 * scale, C.yellow, x, 0.19, z)
  const head = new THREE.Mesh(new THREE.ConeGeometry(0.34 * scale, 0.55 * scale, 3), toon(C.yellow))
  head.rotation.x = Math.PI / 2
  head.rotation.z = Math.PI
  head.position.set(x, 0.205, z - 0.55 * scale)
  root.add(stem, head)
}

function buildTrain(config: LevelConfig) {
  const root = new THREE.Group()
  const handles: THREE.Group[] = []
  const obstacles: Obstacle[] = []
  const bench = config.variant === 'ad-wrap' ? 0x9b5b43 : config.variant === 'maintenance' ? 0x5a5148 : C.green
  const wall = config.variant === 'long-seat' ? 0xd8c7a3 : C.paper

  root.add(box(16.4, 0.32, 5.55, C.ink, 0, -0.04, 0))
  root.add(box(16.05, 0.18, 5.18, C.floor, 0, 0.12, 0))
  root.add(box(16.2, 0.75, 0.18, C.aubergine, 0, 0.52, CAR_MAX_Z + 0.32, true))

  // Far wall: deliberately segmented around the open door.
  const doorHalf = config.variant === 'narrow-door' ? 0.67 : 1.04
  const leftLen = DOOR_X - doorHalf - (-8.1)
  const rightStart = DOOR_X + doorHalf
  root.add(box(leftLen, 1.6, 0.18, wall, -8.1 + leftLen / 2, 1.0, CAR_MIN_Z - 0.31, true))
  root.add(box(8.1 - rightStart, 1.6, 0.18, wall, rightStart + (8.1 - rightStart) / 2, 1.0, CAR_MIN_Z - 0.31, true))

  // Open door leaves, threshold and danger stripes.
  root.add(box(0.18, 2.45, 0.32, C.red, DOOR_X - doorHalf - 0.12, 1.35, CAR_MIN_Z - 0.28, true))
  root.add(box(0.18, 2.45, 0.32, C.red, DOOR_X + doorHalf + 0.12, 1.35, CAR_MIN_Z - 0.28, true))
  root.add(box(doorHalf * 2.15, 0.08, 0.58, C.yellow, DOOR_X, 0.23, CAR_MIN_Z - 0.38, true))
  for (let i = -3; i <= 3; i++) root.add(box(0.12, 0.035, 0.5, i % 2 ? C.ink : C.red, DOOR_X + i * 0.23, 0.29, CAR_MIN_Z - 0.39))

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

  for (const x of [-5.5, -2.7, 0.1, 2.9, 4.5]) addFloorArrow(root, x, 0.4 - (x + 5.5) * 0.35, 0.72)

  return { root, handles, obstacles, doorHalf }
}

function dispose(root: THREE.Object3D) {
  root.traverse((o) => {
    const m = o as THREE.Mesh
    if (m.geometry) m.geometry.dispose()
  })
}

function World({ level, config, active, input, reducedMotion, onHud, onOutcome }: Props) {
  const { scene } = useThree()
  const train = useMemo(() => buildTrain(config), [config])
  const fx = useMemo(() => new THREE.Group(), [])
  const state = useRef({
    bodies: [] as Body[], player: null as Body | null, time: 0, timeLeft: config.time,
    nextSway: config.swayPeriod, warningSent: false, swayDirection: (level % 2 ? -1 : 1) as -1 | 1,
    swayKick: 0, falls: 0, braceTime: 0, braced: false, hudT: 0, ended: false, lastFrame: 0,
  })

  useEffect(() => {
    const S = state.current
    scene.add(train.root, fx)
    const playerGroup = makePlayer()
    playerGroup.position.set(-6.45, 0.24, 1.2)
    train.root.add(playerGroup)
    const player: Body = { group: playerGroup, x: -6.45, z: 1.2, vx: 0, vz: 0, r: 0.38, mass: 1, stability: 2.25, fallenUntil: 0, protectedUntil: 0, phase: 0, homeX: -6.45, homeZ: 1.2, player: true }
    S.player = player
    S.bodies.push(player)

    const rand = mulberry32(9017 + level * 103)
    let made = 0
    const cols = 9
    const rows = 6
    for (let row = 0; row < rows && made < config.passengers; row++) {
      for (let col = 0; col < cols && made < config.passengers; col++) {
        const x = -6.6 + col * 1.58 + (rand() - 0.5) * 0.28
        const z = -1.34 + row * 0.54 + (rand() - 0.5) * 0.12
        if (Math.hypot(x + 6.45, z - 1.2) < 1.25 || (Math.abs(x - DOOR_X) < 1.2 && z < -0.7)) continue
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
          group, x, z, vx: 0, vz: 0, r: broad ? 0.49 : style.body === 'small' ? 0.32 : 0.40,
          mass: broad ? 1.72 : ghost ? 0.58 : style.body === 'small' ? 0.72 : 1.05,
          stability: ghost ? 1.55 : broad ? 2.9 : 1.8 + rand() * 1.2, fallenUntil: 0, protectedUntil: 0,
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
  }, [scene, train, fx, config.passengers, level])

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
          b.fallenUntil = S.time + (b.player ? 0.95 : 0.8 + ((b.phase * 97) % 0.6))
          b.protectedUntil = b.fallenUntil + 0.26
          if (b.player) { S.falls++; sound.fall() }
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

    const player = S.player
    for (const b of S.bodies) {
      const fallen = b.fallenUntil > S.time
      if (b.player) {
        if (!fallen) {
          // Input follows the screen, not the train's world axes: the camera looks
          // down the car's X axis, so screen-down advances +X and screen-right is -Z.
          const targetVx = input.current.z * 4.1
          const targetVz = -input.current.x * 4.1
          b.vx += (targetVx - b.vx) * Math.min(1, 18 * dt)
          b.vz += (targetVz - b.vz) * Math.min(1, 18 * dt)
        }
      } else if (!fallen) {
        const wander = 0.18 + ((b.phase * 13) % 0.34)
        const tx = b.homeX + Math.sin(S.time * 0.48 + b.phase) * 0.34
        const tz = b.homeZ + Math.cos(S.time * 0.55 + b.phase) * 0.22
        b.vx += THREE.MathUtils.clamp(tx - b.x, -1, 1) * wander * dt
        b.vz += THREE.MathUtils.clamp(tz - b.z, -1, 1) * wander * dt
      }
      const damping = Math.exp(-(fallen ? 2.4 : 5.6) * dt)
      b.vx *= damping
      b.vz *= damping
      b.x += b.vx * dt
      b.z += b.vz * dt

      b.x = THREE.MathUtils.clamp(b.x, CAR_MIN_X + b.r, CAR_MAX_X - b.r)
      const inDoor = Math.abs(b.x - DOOR_X) < train.doorHalf - b.r * 0.3
      if (!inDoor || b.z > CAR_MIN_Z + 0.2) b.z = Math.max(b.z, CAR_MIN_Z + b.r)
      b.z = Math.min(b.z, CAR_MAX_Z - b.r)

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
          if (Math.abs(rel) > 3.2) {
            const victim = a.mass < b.mass ? a : b
            if (S.time > victim.protectedUntil) victim.fallenUntil = S.time + (victim.player ? 0.95 : 0.85)
          }
        }
      }
    }

    for (const b of S.bodies) {
      const fallen = b.fallenUntil > S.time
      b.group.position.set(b.x, 0.24, b.z)
      const targetRot = fallen ? (b.vz >= 0 ? 1.35 : -1.35) : 0
      b.group.rotation.x = THREE.MathUtils.lerp(b.group.rotation.x, targetRot, Math.min(1, dt * (fallen ? 10 : 7)))
      if (!fallen) {
        const speed = Math.hypot(b.vx, b.vz)
        if (speed > 0.08) b.group.rotation.y = Math.atan2(b.vx, b.vz)
        const rig = b.group.userData.rig as { legL?: THREE.Group; legR?: THREE.Group; armL?: THREE.Group; armR?: THREE.Group } | undefined
        const swing = Math.sin(S.time * 7 + b.phase) * Math.min(0.46, speed * 0.16)
        if (rig?.legL) rig.legL.rotation.x = swing
        if (rig?.legR) rig.legR.rotation.x = -swing
        if (rig?.armL) rig.armL.rotation.x = -swing * 0.75
        if (rig?.armR) rig.armR.rotation.x = swing * 0.75
      }
    }

    if (player.z < CAR_MIN_Z - 0.48 && Math.abs(player.x - DOOR_X) < train.doorHalf) {
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
        distance: Math.hypot(DOOR_X - player.x, CAR_MIN_Z - 0.65 - player.z),
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
    <Canvas className="got__canvas" shadows dpr={[1, 1.65]} gl={{ antialias: true, alpha: false }}>
      <color attach="background" args={[C.ink]} />
      <fog attach="fog" args={[C.ink, 20, 42]} />
      <OrthographicCamera makeDefault position={[14, 15, 0.4]} zoom={44} near={0.1} far={100} onUpdate={(camera) => camera.lookAt(0, 0.6, 0)} />
      <hemisphereLight args={[C.paper, C.aubergine, 1.4]} />
      <directionalLight position={[-6, 14, 9]} intensity={3.4} color={C.paper} castShadow shadow-mapSize={[1024, 1024]} shadow-camera-left={-12} shadow-camera-right={12} shadow-camera-top={10} shadow-camera-bottom={-10} />
      <directionalLight position={[8, 6, -9]} intensity={1.25} color={C.cyan} />
      <World {...props} />
    </Canvas>
  )
}
