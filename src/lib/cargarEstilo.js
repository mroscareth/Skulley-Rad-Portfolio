import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'

// Los GLB de los props pintados (public/3dmodels/estilo/props_<grupo>.glb), cada uno una vez y con su
// propio LoadingManager: el preloader de la home no los espera.
const cargas = new Map()

export function cargarGrupoEstilo(grupo, version = 1) {
  const llave = `${grupo}?v=${version}`
  if (cargas.has(llave)) return cargas.get(llave)
  const manager = new THREE.LoadingManager()
  const draco = new DRACOLoader(manager)
  draco.setDecoderPath(`${import.meta.env.BASE_URL || '/'}three/draco/gltf/`)
  const loader = new GLTFLoader(manager)
  loader.setDRACOLoader(draco)
  const p = new Promise((res) => {
    loader.load(`${import.meta.env.BASE_URL}3dmodels/estilo/props_${llave}`,
      (gltf) => { setTimeout(() => draco.dispose(), 0); res(gltf) },
      undefined,
      () => res(null))
  })
  cargas.set(llave, p)
  return p
}

/** Una copia de un nodo del GLB en su propio marco (sin el lugar que tenía en la fila del exportador). */
export function copiaLocal(nodo) {
  const c = nodo.clone(true)
  c.position.set(0, 0, 0)
  c.quaternion.identity()
  c.scale.set(1, 1, 1)
  c.updateMatrixWorld(true)
  return c
}

/** Junta en un grupo los nodos de la raíz cuyo nombre empieza con `prefijo` (el prop y sus neones),
 * corridos para que el origen sea el del nodo `base`. */
export function juntarNodos(escena, prefijo, base) {
  const nodoBase = escena.getObjectByName(base)
  if (!nodoBase) return null
  const g = new THREE.Group()
  const o = nodoBase.position.clone()
  for (const n of escena.children) {
    if (!n.name.startsWith(prefijo)) continue
    const c = n.clone(true)
    c.position.sub(o)
    g.add(c)
  }
  g.updateMatrixWorld(true)
  return g
}
