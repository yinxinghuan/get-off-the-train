import * as THREE from 'three'
import { cloneCharacterAsset } from './assetLibrary'

export const C = {
  ink: 0x1d1022,
  aubergine: 0x3e1747,
  paper: 0xf1e5c5,
  yellow: 0xf3f02d,
  red: 0xed4a37,
  green: 0x2e5b45,
  cyan: 0x65b9ae,
  steel: 0x8a8378,
  stainless: 0xc2c9cb,
  floor: 0xc9bfa7,
}

const materials = new Map<string, THREE.MeshStandardMaterial>()

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

export interface CharacterRig {
  pose: THREE.Group
  upperBody?: THREE.Group
  head?: THREE.Group
  hipY?: number
  seatedLegX?: number
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

export const HUMAN_LIBRARY_IDS = [
  'commuter', 'shopkeeper', 'granny', 'oldman', 'blonde', 'kid', 'businessman', 'officeWoman', 'student', 'darkWoman', 'worker', 'teen', 'fitWoman', 'chef', 'bigGuy',
  'cop', 'nurse', 'firefighter', 'construction', 'delivery', 'cowboy', 'punk', 'rapper', 'biker', 'goth',
  'executive', 'courier', 'janitor', 'barista', 'securityGuard', 'swat', 'viking', 'combatMech', 'minotaur', 'paramedic',
] as const
export const MONSTER_LIBRARY_IDS = ['vampire', 'werewolf', 'zombie', 'ghost', 'skeleton', 'mummy'] as const
export const ANIMAL_LIBRARY_IDS = ['pig', 'cow', 'cat', 'fox', 'chicken', 'frog', 'dog', 'sheep', 'rabbit', 'bear', 'duck'] as const
export const HERO_IDS = [...HUMAN_LIBRARY_IDS, ...MONSTER_LIBRARY_IDS, ...ANIMAL_LIBRARY_IDS] as const
export type HeroId = (typeof HERO_IDS)[number]
export type AnimalKind = (typeof ANIMAL_LIBRARY_IDS)[number]

export const HERO_COSTS = Object.fromEntries(HERO_IDS.map((id, index) => [id, index === 0 ? 0 : Math.min(945, 45 + index * 18)])) as Record<HeroId, number>

const heroAccent = (id: HeroId) => ANIMAL_LIBRARY_IDS.includes(id as AnimalKind)
  ? '#c18b52'
  : MONSTER_LIBRARY_IDS.includes(id as (typeof MONSTER_LIBRARY_IDS)[number])
    ? '#6f8f73'
    : id === 'combatMech' ? '#62b8b0' : id === 'viking' || id === 'minotaur' ? '#a66a3f' : '#d6a74a'
export const HERO_COLORS = Object.fromEntries(HERO_IDS.map(id => [id, heroAccent(id)])) as Record<HeroId, string>

function makeCatalogCharacter(id: HeroId) {
  const g = new THREE.Group()
  const pose = new THREE.Group()
  const asset = cloneCharacterAsset(id)
  const bounds = new THREE.Box3().setFromObject(asset)
  const center = bounds.getCenter(new THREE.Vector3())
  asset.position.set(-center.x, -bounds.min.y, -center.z)
  if (ANIMAL_LIBRARY_IDS.includes(id as AnimalKind)) {
    asset.rotation.y = -Math.PI / 2
    const height = Math.max(0.01, bounds.max.y - bounds.min.y)
    const horizontal = Math.max(0.01, bounds.max.x - bounds.min.x, bounds.max.z - bounds.min.z)
    const bulky = id === 'cow' || id === 'bear' || id === 'pig'
    // Preserve the species silhouette without letting long or squat animals
    // dominate the aisle. Height stays slightly generous while ground size is capped.
    asset.scale.setScalar(Math.min(1.48 / height, (bulky ? 2.18 : 2.02) / horizontal))
  }
  pose.add(asset)
  g.add(pose)

  const legL = asset.getObjectByName('rig_legL') as THREE.Group | undefined
  const legR = asset.getObjectByName('rig_legR') as THREE.Group | undefined
  const armL = asset.getObjectByName('rig_armL') as THREE.Group | undefined
  const armR = asset.getObjectByName('rig_armR') as THREE.Group | undefined
  const hipY = legL?.position.y ?? legR?.position.y ?? 1
  g.userData.rig = { pose, hipY, seatedLegX: -0.72, legL, legR, armL, armR } satisfies CharacterRig
  g.userData.libraryId = id
  g.scale.setScalar(0.58)
  return g
}

export function applyPassengerActivity(g: THREE.Group, activity: PassengerActivity) {
  const rig = g.userData.rig as CharacterRig
  g.userData.activity = activity
  if (activity === 'reading') {
    const book = new THREE.Group()
    book.add(
      box(0.34, 0.42, 0.045, 0x7b3b32, -0.18, 0, 0),
      box(0.34, 0.42, 0.045, 0x8f493d, 0.18, 0, 0),
      box(0.60, 0.32, 0.018, C.paper, 0, 0, 0.035),
    )
    book.position.set(0, 1.38, 0.48)
    book.rotation.x = -0.42
    rig.pose.add(book)
    g.userData.activityProp = book
  }
  if (activity === 'calling' || activity === 'phone') {
    const phone = box(0.16, 0.32, 0.065, C.ink, 0, -0.68, 0.22)
    ;(rig.armR ?? rig.pose).add(phone)
    if (!rig.armR) phone.position.set(0.46, 1.62, 0.30)
    g.userData.activityProp = phone
  }
  return g
}

function poseAsSeated(g: THREE.Group, activity: 'reading' | 'phone' | 'rest') {
  const rig = g.userData.rig as CharacterRig
  const seatedLegX = rig.seatedLegX ?? -0.72
  if (rig.legL) rig.legL.rotation.x = seatedLegX
  if (rig.legR) rig.legR.rotation.x = seatedLegX
  if (rig.armL) { rig.armL.rotation.x = -0.42; rig.armL.rotation.z = -0.10 }
  if (rig.armR) { rig.armR.rotation.x = -0.42; rig.armR.rotation.z = 0.10 }
  if (activity === 'reading') applyPassengerActivity(g, 'reading')
  if (activity === 'phone') applyPassengerActivity(g, 'phone')
  g.userData.seated = true
  return g
}

export function makeLibraryPassenger(id: HeroId) {
  return makeCatalogCharacter(id)
}

export function makeSeatedLibraryPassenger(id: HeroId, activity: 'reading' | 'phone' | 'rest' = 'rest') {
  return poseAsSeated(makeCatalogCharacter(id), activity)
}

function addHeroLight(player: THREE.Group, heroId: HeroId) {
  const playerLight = new THREE.SpotLight(0xfff0d8, 5.4, 5.2, 0.88, 0.82, 1.45)
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
  return addHeroLight(makeCatalogCharacter(heroId), heroId)
}

export function isBroadLibraryCharacter(id: HeroId) {
  return ['businessman', 'worker', 'bigGuy', 'firefighter', 'construction', 'rapper', 'biker', 'executive', 'securityGuard', 'swat', 'viking', 'combatMech', 'minotaur', 'werewolf', 'cow', 'bear'].includes(id)
}

export function isSmallLibraryCharacter(id: HeroId) {
  return ['kid', 'teen', 'student', 'barista', 'skeleton', 'chicken', 'frog', 'duck', 'rabbit'].includes(id)
}
