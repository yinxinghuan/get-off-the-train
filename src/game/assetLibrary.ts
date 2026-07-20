import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

const files = import.meta.glob('../assets/characters/*.glb', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>

const urls = new Map<string, string>()
for (const [file, url] of Object.entries(files)) {
  const name = file.split('/').pop()?.replace(/\.glb$/, '')
  const id = name?.split('__')[1]
  if (id) urls.set(id, url)
}

const models = new Map<string, THREE.Group>()

export async function preloadCharacterLibrary() {
  const loader = new GLTFLoader()
  models.clear()
  await Promise.all([...urls].map(async ([id, url]) => {
    let lastError: unknown
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const gltf = await loader.loadAsync(url)
        models.set(id, gltf.scene)
        return
      } catch (error) {
        lastError = error
        await new Promise(resolve => setTimeout(resolve, 120 * (attempt + 1)))
      }
    }
    throw lastError
  }))
  if (models.size !== urls.size || models.size !== 52) {
    throw new Error(`Character library incomplete: loaded ${models.size}/${urls.size}, expected 52`)
  }
}

export function cloneCharacterAsset(id: string) {
  const source = models.get(id)
  if (!source) throw new Error(`Character asset not loaded: ${id}`)
  const clone = source.clone(true)
  clone.traverse((object) => {
    const mesh = object as THREE.Mesh
    if (!mesh.isMesh) return
    mesh.geometry = mesh.geometry.clone()
    if (Array.isArray(mesh.material)) mesh.material = mesh.material.map(material => material.clone())
    else mesh.material = mesh.material.clone()
    mesh.castShadow = true
    mesh.receiveShadow = true
  })
  return clone
}

export function characterAssetCount() {
  return models.size
}
