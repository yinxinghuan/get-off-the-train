import * as THREE from 'three'

export const C = {
  ink: 0x1d1022,
  aubergine: 0x3e1747,
  paper: 0xf1e5c5,
  yellow: 0xf3f02d,
  red: 0xed4a37,
  green: 0x2e5b45,
  cyan: 0x65b9ae,
  steel: 0x8a8378,
  floor: 0xc9bfa7,
  skin1: 0xf2c79a,
  skin2: 0xd99d69,
  skin3: 0xb87542,
  skin4: 0x754323,
}

const materials = new Map<string, THREE.MeshToonMaterial>()
const gradient = (() => {
  const data = new Uint8Array([32, 32, 32, 142, 142, 142, 255, 255, 255])
  const texture = new THREE.DataTexture(data, 3, 1, THREE.RedFormat)
  texture.needsUpdate = true
  texture.magFilter = THREE.NearestFilter
  texture.minFilter = THREE.NearestFilter
  return texture
})()

export function toon(hex: number, transparent = false, opacity = 1) {
  const key = `${hex}-${transparent}-${opacity}`
  if (!materials.has(key)) {
    materials.set(key, new THREE.MeshToonMaterial({ color: hex, gradientMap: gradient, transparent, opacity }))
  }
  return materials.get(key)!
}

const inkMat = new THREE.MeshBasicMaterial({ color: C.ink, side: THREE.BackSide })

function mesh(geometry: THREE.BufferGeometry, color: number, x: number, y: number, z: number, outline = false) {
  const group = new THREE.Group()
  if (outline) {
    const shell = new THREE.Mesh(geometry, inkMat)
    shell.scale.setScalar(1.055)
    shell.userData.outlineShell = true
    group.add(shell)
  }
  const body = new THREE.Mesh(geometry, toon(color))
  body.castShadow = true
  body.receiveShadow = true
  group.add(body)
  group.position.set(x, y, z)
  return group
}

export function box(w: number, h: number, d: number, color: number, x: number, y: number, z: number, outline = false) {
  return mesh(new THREE.BoxGeometry(w, h, d), color, x, y, z, outline)
}

export function cyl(r: number, h: number, color: number, x: number, y: number, z: number, outline = false, seg = 8) {
  return mesh(new THREE.CylinderGeometry(r, r, h, seg), color, x, y, z, outline)
}

export interface CharacterStyle {
  skin: number
  top: number
  bottom: number
  hair: number
  accent: number
  body: 'normal' | 'broad' | 'small'
  feature: 'tie' | 'bag' | 'hat' | 'bun' | 'vest' | 'scarf'
}

export function makeCharacter(style: CharacterStyle, player = false) {
  const g = new THREE.Group()
  const s = style.body === 'broad' ? 1.13 : style.body === 'small' ? 0.82 : 1
  const legH = style.body === 'small' ? 0.55 : 0.82
  const torsoY = 0.18 + legH + 0.39
  const headY = torsoY + 0.73
  const ol = player

  const legL = box(0.27 * s, legH, 0.34, style.bottom, -0.19 * s, 0.18 + legH / 2, 0, ol)
  const legR = box(0.27 * s, legH, 0.34, style.bottom, 0.19 * s, 0.18 + legH / 2, 0, ol)
  const armL = box(0.22, 0.74, 0.34, style.top, -0.57 * s, torsoY - 0.04, 0, ol)
  const armR = box(0.22, 0.74, 0.34, style.top, 0.57 * s, torsoY - 0.04, 0, ol)
  g.add(legL, legR, armL, armR)
  g.add(box(0.92 * s, 0.78, 0.48, style.top, 0, torsoY, 0, ol))
  g.add(box(0.54, 0.58, 0.48, style.skin, 0, headY, 0, ol))
  g.add(box(0.58, 0.18, 0.52, style.hair, 0, headY + 0.32, -0.01, ol))
  g.add(box(0.09, 0.11, 0.035, C.ink, -0.14, headY + 0.01, 0.255))
  g.add(box(0.09, 0.11, 0.035, C.ink, 0.14, headY + 0.01, 0.255))

  if (style.feature === 'tie') g.add(box(0.12, 0.48, 0.06, style.accent, 0, torsoY + 0.05, 0.27, ol))
  if (style.feature === 'vest') g.add(box(0.62 * s, 0.56, 0.06, style.accent, 0, torsoY - 0.02, 0.27, ol))
  if (style.feature === 'scarf') g.add(box(0.64, 0.14, 0.55, style.accent, 0, headY - 0.37, 0, ol))
  if (style.feature === 'bag') {
    g.add(box(0.72 * s, 0.62, 0.25, style.accent, 0, torsoY, -0.36, ol))
    g.add(box(0.10, 0.74, 0.06, C.ink, -0.27, torsoY, 0.27, false))
    g.add(box(0.10, 0.74, 0.06, C.ink, 0.27, torsoY, 0.27, false))
  }
  if (style.feature === 'hat') {
    g.add(box(0.66, 0.18, 0.56, style.accent, 0, headY + 0.39, 0, ol))
    g.add(box(0.48, 0.06, 0.22, style.accent, 0, headY + 0.34, 0.34, ol))
  }
  if (style.feature === 'bun') {
    g.add(cyl(0.22, 0.22, style.hair, 0, headY + 0.49, -0.04, ol, 7))
  }
  g.userData.rig = { legL, legR, armL, armR }
  g.scale.setScalar(player ? 0.86 : style.body === 'small' ? 0.82 : 0.84)
  return g
}

const skins = [C.skin1, C.skin2, C.skin3, C.skin4]
const tops = [0x547c6b, 0x77517d, 0x315b71, 0x9c5b46, 0x82744b, 0x4f5663]
const bottoms = [0x343948, 0x514334, 0x3a4d4a, 0x5b4a67]
const hairs = [0x2e2520, 0x6b4423, 0x231d25, 0xc6b46b, 0xb7b1aa]
const accents = [C.cyan, C.yellow, C.red, 0xa77abc, 0xd68a45]
const features: CharacterStyle['feature'][] = ['tie', 'bag', 'hat', 'bun', 'vest', 'scarf']

export function passengerStyle(index: number, level: number): CharacterStyle {
  return {
    skin: skins[(index * 3 + level) % skins.length],
    top: tops[(index * 5 + level * 2) % tops.length],
    bottom: bottoms[(index * 7 + level) % bottoms.length],
    hair: hairs[(index * 2 + level) % hairs.length],
    accent: accents[(index + level * 2) % accents.length],
    body: index % 11 === 0 ? 'broad' : index % 9 === 0 ? 'small' : 'normal',
    feature: features[(index * 5 + level) % features.length],
  }
}

export function makePlayer() {
  const player = makeCharacter({
    skin: C.skin2, top: C.yellow, bottom: C.aubergine, hair: C.paper,
    accent: C.red, body: 'normal', feature: 'bag',
  })
  const ringInk = new THREE.Mesh(new THREE.TorusGeometry(0.68, 0.17, 6, 20), new THREE.MeshBasicMaterial({ color: C.ink }))
  ringInk.rotation.x = Math.PI / 2
  ringInk.position.y = 0.035
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.68, 0.105, 6, 20), new THREE.MeshBasicMaterial({ color: C.yellow }))
  ring.rotation.x = Math.PI / 2
  ring.position.y = 0.052
  const aura = new THREE.Mesh(
    new THREE.TorusGeometry(0.73, 0.20, 8, 28),
    new THREE.MeshBasicMaterial({
      color: 0xfff1a8,
      transparent: true,
      opacity: 0.24,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  )
  aura.rotation.x = Math.PI / 2
  aura.position.y = 0.045
  const playerLight = new THREE.PointLight(0xffe7a0, 2.35, 4.2, 1.65)
  playerLight.position.set(0, 1.15, 0)
  playerLight.userData.playerLight = true
  player.add(aura, ringInk, ring, playerLight)
  player.add(box(0.54, 0.09, 0.055, C.paper, 0, 1.38, -0.51))
  player.scale.setScalar(0.90)
  return player
}

export type MonsterKind = 'vampire' | 'zombie' | 'mummy' | 'skeleton' | 'ghost' | 'werewolf'
export const MONSTER_KINDS: MonsterKind[] = ['vampire', 'zombie', 'mummy', 'skeleton', 'ghost', 'werewolf']

/** Family-friendly commuter variants of the shared AlterU monster roster. */
export function makeMonsterPassenger(kind: MonsterKind) {
  if (kind === 'ghost') {
    const g = new THREE.Group()
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.84, 1.0, 0.48), toon(C.cyan, true, 0.72))
    body.position.y = 1.14; body.castShadow = true; g.add(body)
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.58, 0.5), toon(0xc7e1df, true, 0.78))
    head.position.y = 1.9; head.castShadow = true; g.add(head)
    g.add(box(0.14, 0.18, 0.045, C.ink, -0.16, 1.96, 0.27), box(0.14, 0.18, 0.045, C.ink, 0.16, 1.96, 0.27))
    for (const x of [-0.28, 0, 0.28]) g.add(box(0.2, 0.42 + (x === 0 ? 0.12 : 0), 0.38, C.cyan, x, 0.48, 0))
    g.position.y = 0.08
    g.scale.setScalar(0.82)
    g.userData.monsterKind = kind
    return g
  }

  const styles: Record<Exclude<MonsterKind, 'ghost'>, CharacterStyle> = {
    vampire: { skin: 0xd6d7cf, top: 0x24202b, bottom: 0x24202b, hair: C.ink, accent: C.red, body: 'normal', feature: 'scarf' },
    zombie: { skin: 0x88a36c, top: 0x53613e, bottom: 0x414e58, hair: 0x313628, accent: C.yellow, body: 'normal', feature: 'vest' },
    mummy: { skin: 0xcfc4a9, top: 0xcfc4a9, bottom: 0xb6aa8f, hair: 0xcfc4a9, accent: C.red, body: 'normal', feature: 'scarf' },
    skeleton: { skin: 0xe8dec2, top: C.ink, bottom: 0x39303d, hair: 0xe8dec2, accent: C.yellow, body: 'small', feature: 'vest' },
    werewolf: { skin: 0x6e5944, top: 0x594535, bottom: 0x3d3540, hair: 0x33281f, accent: C.cyan, body: 'broad', feature: 'vest' },
  }
  const g = makeCharacter(styles[kind])
  if (kind === 'vampire') {
    g.add(box(0.12, 0.22, 0.05, C.paper, -0.08, 1.86, 0.28), box(0.12, 0.22, 0.05, C.paper, 0.08, 1.86, 0.28))
    const capeL = box(0.18, 0.72, 0.14, C.red, -0.48, 1.42, -0.18); capeL.rotation.z = -0.28; g.add(capeL)
    const capeR = box(0.18, 0.72, 0.14, C.red, 0.48, 1.42, -0.18); capeR.rotation.z = 0.28; g.add(capeR)
  }
  if (kind === 'zombie') {
    g.rotation.z = -0.035
    g.add(box(0.33, 0.09, 0.06, C.paper, 0, 1.16, 0.29))
  }
  if (kind === 'mummy') {
    for (let i = 0; i < 5; i++) g.add(box(0.98, 0.055, 0.53, i % 2 ? 0xb6aa8f : C.paper, (i % 2 ? 0.03 : -0.03), 0.91 + i * 0.17, 0, false))
  }
  if (kind === 'skeleton') {
    g.add(box(0.52, 0.12, 0.055, C.paper, 0, 1.35, 0.29), box(0.42, 0.1, 0.055, C.paper, 0, 1.53, 0.29))
  }
  if (kind === 'werewolf') {
    const earGeo = new THREE.ConeGeometry(0.17, 0.34, 4)
    const earL = mesh(earGeo, 0x33281f, -0.2, 2.35, 0, true)
    const earR = mesh(earGeo.clone(), 0x33281f, 0.2, 2.35, 0, true)
    g.add(earL, earR, box(0.36, 0.24, 0.24, 0x806950, 0, 1.96, 0.34, true))
  }
  g.userData.monsterKind = kind
  return g
}
