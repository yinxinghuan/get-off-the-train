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

const materials = new Map<string, THREE.MeshStandardMaterial>()

// Kept as `toon()` for compatibility with the existing model builders, but
// the material now matches the shared Block Party low-poly PBR treatment:
// flat polygon normals, high roughness, no metalness and no emissive body.
export function toon(hex: number, transparent = false, opacity = 1) {
  const key = `${hex}-${transparent}-${opacity}`
  if (!materials.has(key)) {
    materials.set(key, new THREE.MeshStandardMaterial({
      color: hex,
      roughness: 0.88,
      metalness: 0,
      flatShading: true,
      transparent,
      opacity,
      depthWrite: !transparent || opacity >= 0.95,
    }))
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

export interface CharacterRig {
  pose: THREE.Group
  upperBody?: THREE.Group
  head?: THREE.Group
  hipY?: number
  legL?: THREE.Group
  legR?: THREE.Group
  shinL?: THREE.Group
  shinR?: THREE.Group
  footL?: THREE.Group
  footR?: THREE.Group
  armL?: THREE.Group
  armR?: THREE.Group
  forearmL?: THREE.Group
  forearmR?: THREE.Group
}

export type PassengerActivity = 'natural' | 'strap-left' | 'strap-right' | 'reading' | 'calling' | 'phone'
export type ProfessionKind = 'businessman' | 'office-woman' | 'student' | 'elder' | 'shopkeeper' | 'chef' | 'cop' | 'nurse' | 'firefighter' | 'construction' | 'delivery' | 'executive' | 'courier' | 'janitor' | 'barista' | 'security'

export const PROFESSION_KINDS: ProfessionKind[] = [
  'businessman', 'office-woman', 'student', 'elder', 'shopkeeper', 'chef', 'cop', 'nurse',
  'firefighter', 'construction', 'delivery', 'executive', 'courier', 'janitor', 'barista', 'security',
]

export function makeCharacter(style: CharacterStyle, player = false) {
  const g = new THREE.Group()
  const pose = new THREE.Group()
  g.add(pose)
  const s = style.body === 'broad' ? 1.13 : style.body === 'small' ? 0.82 : 1
  const legH = style.body === 'small' ? 0.55 : 0.82
  const thighH = legH * 0.52
  const shinH = legH - thighH
  const upperArmH = 0.38
  const forearmH = 0.36
  const hipY = 0.18 + legH
  const torsoY = 0.18 + legH + 0.39
  const headY = torsoY + 0.73
  const ol = player
  const upperBody = new THREE.Group()
  upperBody.position.y = hipY

  const legL = new THREE.Group()
  const legR = new THREE.Group()
  const shinL = new THREE.Group()
  const shinR = new THREE.Group()
  const footL = box(0.29 * s, 0.14, 0.45, C.ink, 0, -shinH + 0.03, 0.07, false)
  const footR = box(0.29 * s, 0.14, 0.45, C.ink, 0, -shinH + 0.03, 0.07, false)
  legL.position.set(-0.19 * s, hipY, 0)
  legR.position.set(0.19 * s, hipY, 0)
  shinL.position.y = -thighH
  shinR.position.y = -thighH
  legL.add(box(0.28 * s, thighH, 0.35, style.bottom, 0, -thighH / 2, 0, ol), shinL)
  legR.add(box(0.28 * s, thighH, 0.35, style.bottom, 0, -thighH / 2, 0, ol), shinR)
  shinL.add(box(0.25 * s, shinH, 0.31, style.bottom, 0, -shinH / 2, 0, ol), footL)
  shinR.add(box(0.25 * s, shinH, 0.31, style.bottom, 0, -shinH / 2, 0, ol), footR)
  const armL = new THREE.Group()
  const armR = new THREE.Group()
  const forearmL = new THREE.Group()
  const forearmR = new THREE.Group()
  armL.position.set(-0.57 * s, torsoY - hipY + 0.31, 0)
  armR.position.set(0.57 * s, torsoY - hipY + 0.31, 0)
  forearmL.position.y = -upperArmH
  forearmR.position.y = -upperArmH
  armL.add(box(0.23, upperArmH, 0.34, style.top, 0, -upperArmH / 2, 0, ol), forearmL)
  armR.add(box(0.23, upperArmH, 0.34, style.top, 0, -upperArmH / 2, 0, ol), forearmR)
  forearmL.add(box(0.21, forearmH, 0.31, style.top, 0, -forearmH / 2, 0, ol), box(0.23, 0.16, 0.30, style.skin, 0, -forearmH - 0.02, 0, false))
  forearmR.add(box(0.21, forearmH, 0.31, style.top, 0, -forearmH / 2, 0, ol), box(0.23, 0.16, 0.30, style.skin, 0, -forearmH - 0.02, 0, false))
  pose.add(legL, legR, upperBody)
  upperBody.add(armL, armR)
  upperBody.add(box(0.92 * s, 0.78, 0.48, style.top, 0, torsoY - hipY, 0, ol))
  const head = new THREE.Group()
  head.position.y = headY - hipY
  head.add(box(0.54, 0.58, 0.48, style.skin, 0, 0, 0, ol))
  head.add(box(0.58, 0.18, 0.52, style.hair, 0, 0.32, -0.01, ol))
  head.add(box(0.09, 0.11, 0.035, C.ink, -0.14, 0.01, 0.255))
  head.add(box(0.09, 0.11, 0.035, C.ink, 0.14, 0.01, 0.255))
  upperBody.add(head)

  if (style.feature === 'tie') upperBody.add(box(0.12, 0.48, 0.06, style.accent, 0, torsoY + 0.05 - hipY, 0.27, ol))
  if (style.feature === 'vest') upperBody.add(box(0.62 * s, 0.56, 0.06, style.accent, 0, torsoY - 0.02 - hipY, 0.27, ol))
  if (style.feature === 'scarf') upperBody.add(box(0.64, 0.14, 0.55, style.accent, 0, headY - 0.37 - hipY, 0, ol))
  if (style.feature === 'bag') {
    upperBody.add(box(0.72 * s, 0.62, 0.25, style.accent, 0, torsoY - hipY, -0.36, ol))
    upperBody.add(box(0.10, 0.74, 0.06, C.ink, -0.27, torsoY - hipY, 0.27, false))
    upperBody.add(box(0.10, 0.74, 0.06, C.ink, 0.27, torsoY - hipY, 0.27, false))
  }
  if (style.feature === 'hat') {
    head.add(box(0.66, 0.18, 0.56, style.accent, 0, 0.39, 0, ol))
    head.add(box(0.48, 0.06, 0.22, style.accent, 0, 0.34, 0.34, ol))
  }
  if (style.feature === 'bun') {
    head.add(cyl(0.22, 0.22, style.hair, 0, 0.49, -0.04, ol, 7))
  }
  g.userData.rig = { pose, upperBody, head, hipY, legL, legR, shinL, shinR, footL, footR, armL, armR, forearmL, forearmR } satisfies CharacterRig
  g.scale.setScalar(0.58)
  return g
}

export function applyPassengerActivity(g: THREE.Group, activity: PassengerActivity) {
  const rig = g.userData.rig as CharacterRig
  g.userData.activity = activity
  if (activity === 'reading' && rig.upperBody) {
    const book = new THREE.Group()
    const left = box(0.34, 0.42, 0.045, 0x7b3b32, -0.18, 0, 0)
    const right = box(0.34, 0.42, 0.045, 0x8f493d, 0.18, 0, 0)
    const pages = box(0.60, 0.32, 0.018, C.paper, 0, 0, 0.035)
    book.add(left, right, pages)
    book.position.set(0, 0.34, 0.48)
    book.rotation.x = -0.42
    rig.upperBody.add(book)
    g.userData.activityProp = book
  }
  if ((activity === 'calling' || activity === 'phone') && rig.forearmR) {
    const phone = box(0.16, 0.32, 0.065, C.ink, 0, -0.38, 0.22)
    rig.forearmR.add(phone)
    g.userData.activityProp = phone
  }
  return g
}

function poseAsSeated(g: THREE.Group, activity: 'reading' | 'phone' | 'rest') {
  const rig = g.userData.rig as CharacterRig
  g.scale.setScalar(0.58)
  // A real seated silhouette: thighs leave the hips horizontally toward the
  // aisle, knees bend to vertical shins, and shoes project beyond the toes.
  // The seated shin stretch compensates for the gameplay character scale so
  // feet reach the carriage floor instead of hovering inside the bench.
  if (rig.legL) rig.legL.rotation.x = -Math.PI / 2
  if (rig.legR) rig.legR.rotation.x = -Math.PI / 2
  if (rig.shinL) { rig.shinL.rotation.x = Math.PI / 2; rig.shinL.scale.y = 1.92 }
  if (rig.shinR) { rig.shinR.rotation.x = Math.PI / 2; rig.shinR.scale.y = 1.92 }
  if (rig.footL) { rig.footL.position.z = 0.16; rig.footL.scale.z = 1.35 }
  if (rig.footR) { rig.footR.position.z = 0.16; rig.footR.scale.z = 1.35 }
  if (rig.armL) { rig.armL.rotation.x = -0.56; rig.armL.rotation.z = -0.10 }
  if (rig.armR) { rig.armR.rotation.x = -0.56; rig.armR.rotation.z = 0.10 }
  if (rig.forearmL) rig.forearmL.rotation.x = -0.72
  if (rig.forearmR) rig.forearmR.rotation.x = -0.72
  if (rig.upperBody) {
    rig.upperBody.rotation.x = 0.08
    if (activity === 'reading') applyPassengerActivity(g, 'reading')
    if (activity === 'phone') applyPassengerActivity(g, 'phone')
  }
  g.userData.seated = true
  return g
}

export function makeSeatedPassenger(style: CharacterStyle, activity: 'reading' | 'phone' | 'rest' = 'rest') {
  return poseAsSeated(makeCharacter(style), activity)
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

const professionStyles: Record<ProfessionKind, CharacterStyle> = {
  businessman: { skin: C.skin3, top: 0x465260, bottom: 0x343b47, hair: 0x2e2520, accent: C.cyan, body: 'broad', feature: 'tie' },
  'office-woman': { skin: C.skin1, top: 0x705276, bottom: 0x44374d, hair: 0x6b4423, accent: C.cyan, body: 'normal', feature: 'bun' },
  student: { skin: C.skin2, top: 0x47705a, bottom: 0x344b60, hair: 0x6b4423, accent: C.cyan, body: 'small', feature: 'bag' },
  elder: { skin: C.skin2, top: 0x70777d, bottom: 0x584937, hair: 0xb7b1aa, accent: C.cyan, body: 'normal', feature: 'bun' },
  shopkeeper: { skin: C.skin1, top: 0xe0d6bd, bottom: 0x3f5063, hair: 0x2e2520, accent: C.cyan, body: 'normal', feature: 'vest' },
  chef: { skin: C.skin1, top: 0xe9e2d1, bottom: 0x4b5360, hair: 0x2e2520, accent: C.red, body: 'normal', feature: 'scarf' },
  cop: { skin: C.skin2, top: 0x274f72, bottom: 0x243d57, hair: 0x2e2520, accent: 0xe5c24f, body: 'normal', feature: 'vest' },
  nurse: { skin: C.skin1, top: 0xe9e4d8, bottom: 0xd8d4ca, hair: 0x6b4423, accent: C.red, body: 'normal', feature: 'vest' },
  firefighter: { skin: C.skin3, top: 0xd28a25, bottom: 0x4b4235, hair: 0x2e2520, accent: C.yellow, body: 'broad', feature: 'vest' },
  construction: { skin: C.skin3, top: 0xd16b32, bottom: 0x40556a, hair: 0x2e2520, accent: C.yellow, body: 'broad', feature: 'vest' },
  delivery: { skin: C.skin2, top: 0xd54f3f, bottom: 0x384657, hair: 0x231d25, accent: C.cyan, body: 'normal', feature: 'bag' },
  executive: { skin: C.skin1, top: 0x282f3a, bottom: 0x282f3a, hair: 0x231d25, accent: C.red, body: 'broad', feature: 'tie' },
  courier: { skin: C.skin3, top: 0x3f7b70, bottom: 0x3b4652, hair: 0x2e2520, accent: 0xd68a45, body: 'normal', feature: 'bag' },
  janitor: { skin: C.skin4, top: 0x35617b, bottom: 0x31576f, hair: 0x231d25, accent: C.yellow, body: 'normal', feature: 'hat' },
  barista: { skin: C.skin2, top: 0x364c42, bottom: 0x4d4137, hair: 0x6b4423, accent: 0xa9774a, body: 'small', feature: 'vest' },
  security: { skin: C.skin4, top: 0x343d4b, bottom: 0x28323d, hair: 0x231d25, accent: 0xe5c24f, body: 'broad', feature: 'hat' },
}

/** Shared Sky Leap / Block Party profession roster rebuilt on this game's articulated fall rig. */
export function makeProfessionPassenger(kind: ProfessionKind) {
  const g = makeCharacter(professionStyles[kind])
  const rig = g.userData.rig as CharacterRig
  const upper = rig.upperBody ?? rig.pose
  const head = rig.head ?? upper
  const chest = (color: number, x = 0) => upper.add(box(0.18, 0.18, 0.055, color, x, 0.47, 0.28))
  const helmet = (color: number) => {
    head.add(box(0.68, 0.18, 0.58, color, 0, 0.40, 0))
    head.add(box(0.50, 0.07, 0.28, color, 0, 0.35, 0.28))
  }

  if (kind === 'nurse') {
    upper.add(box(0.34, 0.10, 0.055, C.red, 0, 0.47, 0.29), box(0.10, 0.34, 0.055, C.red, 0, 0.47, 0.29))
    head.add(box(0.48, 0.14, 0.30, C.paper, 0, 0.43, 0.08), box(0.10, 0.18, 0.04, C.red, 0, 0.44, 0.25))
  }
  if (kind === 'cop') { helmet(0x274f72); chest(0xe5c24f, 0.25) }
  if (kind === 'firefighter') {
    helmet(C.red)
    upper.add(box(0.98, 0.10, 0.055, C.yellow, 0, 0.54, 0.29), box(0.98, 0.10, 0.055, C.yellow, 0, 0.18, 0.29))
  }
  if (kind === 'construction') { helmet(C.yellow); upper.add(box(0.14, 0.65, 0.055, C.yellow, -0.28, 0.38, 0.29), box(0.14, 0.65, 0.055, C.yellow, 0.28, 0.38, 0.29)) }
  if (kind === 'chef') {
    head.add(box(0.58, 0.18, 0.48, C.paper, 0, 0.42, 0), box(0.46, 0.26, 0.40, C.paper, 0, 0.61, 0), box(0.58, 0.18, 0.48, C.paper, 0, 0.79, 0))
  }
  if (kind === 'delivery' || kind === 'courier') {
    upper.add(box(0.78, 0.86, 0.28, kind === 'delivery' ? C.red : C.cyan, 0, 0.38, -0.38))
    helmet(kind === 'delivery' ? C.red : C.cyan)
  }
  if (kind === 'executive' && rig.forearmR) {
    rig.forearmR.add(box(0.48, 0.38, 0.18, 0x5b3f2d, 0, -0.58, 0.02), box(0.18, 0.10, 0.08, 0xe5c24f, 0, -0.34, 0.02))
  }
  if (kind === 'janitor') { chest(C.paper, -0.23); upper.add(box(0.16, 0.46, 0.16, C.yellow, 0.58, 0.02, 0.12)) }
  if (kind === 'barista') { upper.add(box(0.68, 0.62, 0.055, 0x8a593b, 0, 0.32, 0.29)); if (rig.forearmR) rig.forearmR.add(cyl(0.13, 0.28, C.paper, 0, -0.48, 0.18, false, 8)) }
  if (kind === 'security') { helmet(0x343d4b); chest(0xe5c24f, 0.25); upper.add(box(0.16, 0.30, 0.12, C.ink, -0.50, 0.56, 0.18)) }
  if (kind === 'shopkeeper') upper.add(box(0.68, 0.62, 0.055, C.cyan, 0, 0.32, 0.29))
  if (kind === 'elder') upper.add(cyl(0.045, 1.25, 0x765437, 0.68, -0.08, 0.05, false, 7))
  g.userData.profession = kind
  return g
}

export function makeSeatedProfessionPassenger(kind: ProfessionKind, activity: 'reading' | 'phone' | 'rest' = 'rest') {
  return poseAsSeated(makeProfessionPassenger(kind), activity)
}

export type HeroId = 'commuter' | 'cop' | 'nurse' | 'firefighter' | 'chef' | 'courier' | 'zombie' | 'vampire' | 'cat' | 'dog'

export const HERO_IDS: HeroId[] = ['commuter', 'cop', 'nurse', 'firefighter', 'chef', 'courier', 'zombie', 'vampire', 'cat', 'dog']

export const HERO_COSTS: Record<HeroId, number> = {
  commuter: 0,
  cop: 60,
  nurse: 90,
  firefighter: 130,
  chef: 170,
  courier: 220,
  zombie: 270,
  vampire: 330,
  cat: 400,
  dog: 480,
}

export const HERO_COLORS: Record<HeroId, string> = {
  commuter: '#f3f02d',
  cop: '#274f72',
  nurse: '#e9e4d8',
  firefighter: '#d28a25',
  chef: '#efe8d8',
  courier: '#3f7b70',
  zombie: '#88a36c',
  vampire: '#53405c',
  cat: '#c89a55',
  dog: '#8b5b38',
}

function makeAnimalHero(kind: 'cat' | 'dog') {
  const g = new THREE.Group()
  const pose = new THREE.Group()
  const rearL = new THREE.Group()
  const rearR = new THREE.Group()
  const frontL = new THREE.Group()
  const frontR = new THREE.Group()
  const head = new THREE.Group()
  const fur = kind === 'cat' ? 0xc89a55 : 0x8b5b38
  const dark = kind === 'cat' ? 0x6f4b2c : 0x4b3024
  const muzzle = kind === 'cat' ? 0xf0cf9e : 0xd4a16f

  pose.add(box(kind === 'cat' ? 0.82 : 0.94, 0.55, kind === 'cat' ? 1.22 : 1.10, fur, 0, 1.02, -0.08))
  head.position.set(0, 1.20, 0.67)
  head.add(box(kind === 'cat' ? 0.62 : 0.70, 0.62, 0.58, fur, 0, 0, 0))
  head.add(box(0.34, 0.22, 0.22, muzzle, 0, -0.12, 0.38))
  head.add(box(0.10, 0.08, 0.05, C.ink, 0, -0.08, 0.51))
  head.add(box(0.09, 0.11, 0.04, C.ink, -0.16, 0.08, 0.31), box(0.09, 0.11, 0.04, C.ink, 0.16, 0.08, 0.31))
  if (kind === 'cat') {
    const earGeo = new THREE.ConeGeometry(0.17, 0.34, 4)
    head.add(mesh(earGeo, dark, -0.21, 0.42, 0), mesh(earGeo.clone(), dark, 0.21, 0.42, 0))
  } else {
    const earL = box(0.20, 0.42, 0.16, dark, -0.31, 0.08, 0)
    const earR = box(0.20, 0.42, 0.16, dark, 0.31, 0.08, 0)
    earL.rotation.z = -0.24
    earR.rotation.z = 0.24
    head.add(earL, earR)
  }
  pose.add(head)
  const paw = (leg: THREE.Group, x: number, z: number) => {
    leg.position.set(x, 0.86, z)
    leg.add(box(0.24, 0.72, 0.25, dark, 0, -0.34, 0), box(0.29, 0.13, 0.36, muzzle, 0, -0.73, 0.06))
    pose.add(leg)
  }
  paw(frontL, -0.31, 0.38)
  paw(frontR, 0.31, 0.38)
  paw(rearL, -0.31, -0.48)
  paw(rearR, 0.31, -0.48)
  const tail = box(0.16, 0.16, kind === 'cat' ? 0.82 : 0.60, fur, 0, 1.10, -0.92)
  tail.rotation.x = kind === 'cat' ? -0.35 : 0.28
  pose.add(tail)
  pose.add(box(0.72, 0.15, 0.65, C.red, 0, 1.28, 0.28))
  g.add(pose)
  g.userData.rig = { pose, head, legL: rearL, legR: rearR, armL: frontL, armR: frontR } satisfies CharacterRig
  g.scale.setScalar(0.58)
  return g
}

function addHeroMarker(player: THREE.Group, heroId: HeroId) {
  if (heroId !== 'commuter' && heroId !== 'cat' && heroId !== 'dog') {
    player.add(box(0.56, 0.34, 0.18, C.red, 0, 1.30, -0.36))
  }
  const playerLight = new THREE.SpotLight(0xffe7a0, 8.5, 5.2, 0.88, 0.8, 1.45)
  const lightTarget = new THREE.Object3D()
  playerLight.position.set(0, 3.8, -0.18)
  lightTarget.position.set(0, 0.05, 0.22)
  playerLight.target = lightTarget
  playerLight.userData.playerLight = true
  player.add(playerLight, lightTarget)
  player.userData.heroId = heroId
  return player
}

export function makePlayer(heroId: HeroId = 'commuter') {
  let player: THREE.Group
  if (heroId === 'commuter') {
    player = makeCharacter({
      skin: C.skin2, top: C.yellow, bottom: C.aubergine, hair: C.paper,
      accent: C.red, body: 'normal', feature: 'bag',
    })
    player.add(box(0.54, 0.09, 0.055, C.paper, 0, 1.38, -0.51))
  } else if (heroId === 'cat' || heroId === 'dog') {
    player = makeAnimalHero(heroId)
  } else if (heroId === 'zombie' || heroId === 'vampire') {
    player = makeMonsterPassenger(heroId)
  } else {
    player = makeProfessionPassenger(heroId)
  }
  player.scale.setScalar(0.58)
  return addHeroMarker(player, heroId)
}

export type MonsterKind = 'vampire' | 'zombie' | 'mummy' | 'skeleton' | 'ghost' | 'werewolf'
export const MONSTER_KINDS: MonsterKind[] = ['vampire', 'zombie', 'mummy', 'skeleton', 'ghost', 'werewolf']

/** Family-friendly commuter variants of the shared AlterU monster roster. */
export function makeMonsterPassenger(kind: MonsterKind) {
  if (kind === 'ghost') {
    const g = new THREE.Group()
    const pose = new THREE.Group()
    g.add(pose)
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.84, 1.0, 0.48), toon(C.cyan, true, 0.72))
    body.position.y = 1.14; body.castShadow = true; pose.add(body)
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.58, 0.5), toon(0xc7e1df, true, 0.78))
    head.position.y = 1.9; head.castShadow = true; pose.add(head)
    pose.add(box(0.14, 0.18, 0.045, C.ink, -0.16, 1.96, 0.27), box(0.14, 0.18, 0.045, C.ink, 0.16, 1.96, 0.27))
    for (const x of [-0.28, 0, 0.28]) pose.add(box(0.2, 0.42 + (x === 0 ? 0.12 : 0), 0.38, C.cyan, x, 0.48, 0))
    g.position.y = 0.08
    g.scale.setScalar(0.58)
    g.userData.rig = { pose } satisfies CharacterRig
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
  const rig = g.userData.rig as CharacterRig
  const upper = rig.upperBody ?? rig.pose
  const upperAdd = (...objects: THREE.Object3D[]) => {
    for (const object of objects) object.position.y -= rig.hipY ?? 0
    upper.add(...objects)
  }
  if (kind === 'vampire') {
    upperAdd(box(0.12, 0.22, 0.05, C.paper, -0.08, 1.86, 0.28), box(0.12, 0.22, 0.05, C.paper, 0.08, 1.86, 0.28))
    const capeL = box(0.18, 0.72, 0.14, C.red, -0.48, 1.42, -0.18); capeL.rotation.z = -0.28; upperAdd(capeL)
    const capeR = box(0.18, 0.72, 0.14, C.red, 0.48, 1.42, -0.18); capeR.rotation.z = 0.28; upperAdd(capeR)
  }
  if (kind === 'zombie') {
    upper.rotation.z = -0.035
    upperAdd(box(0.33, 0.09, 0.06, C.paper, 0, 1.16, 0.29))
  }
  if (kind === 'mummy') {
    for (let i = 0; i < 5; i++) upperAdd(box(0.98, 0.055, 0.53, i % 2 ? 0xb6aa8f : C.paper, (i % 2 ? 0.03 : -0.03), 0.91 + i * 0.17, 0, false))
  }
  if (kind === 'skeleton') {
    upperAdd(box(0.52, 0.12, 0.055, C.paper, 0, 1.35, 0.29), box(0.42, 0.1, 0.055, C.paper, 0, 1.53, 0.29))
  }
  if (kind === 'werewolf') {
    const earGeo = new THREE.ConeGeometry(0.17, 0.34, 4)
    const earL = mesh(earGeo, 0x33281f, -0.2, 2.35, 0)
    const earR = mesh(earGeo.clone(), 0x33281f, 0.2, 2.35, 0)
    upperAdd(earL, earR, box(0.36, 0.24, 0.24, 0x806950, 0, 1.96, 0.34))
  }
  g.userData.monsterKind = kind
  return g
}
