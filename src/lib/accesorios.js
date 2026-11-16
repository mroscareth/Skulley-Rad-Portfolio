import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

// Props de Skulley hechos en Blender (Character/SkulleyRad.blend). Cada GLB trae
// el prop en la pose de reposo, en las coordenadas del personaje: aquí se
// vuelve una pieza más del personaje, una SkinnedMesh con todo su peso en un
// hueso. Así hereda lo que ya tienen las piezas del cuerpo sin código aparte:
// el banding toon y el brillo duro (se los pone quien clona los materiales),
// el contorno de silueta (Player arma hulls para cada SkinnedMesh), la tinta
// (CharacterNormalPass solo entinta SkinnedMesh), los fundidos de opacidad y
// el despiece (Player despieza los nodos Egg_*: por eso se llama Egg_Lentes).
// Estado (cuáles van puestos) y URLs, en un módulo sin three
export { URL_LENTES, URL_CORRER, ACCESORIOS, ACCESORIOS_EVENT, getAccesorios, setAccesorio, mostrarAccesorios } from './accesoriosEstado.js'

const MATERIALES_LENTES = {
  Lentes_Armazon: { color: 0x121212, roughness: 0.32, metalness: 0 },
  Lentes_Mica: { color: 0x0c1813, roughness: 0.12, metalness: 0 },
  Lentes_Metal: { color: 0xd9d9df, roughness: 0.25, metalness: 1 },
}

function material(nombre) {
  const p = MATERIALES_LENTES[nombre] || MATERIALES_LENTES.Lentes_Armazon
  const m = new THREE.MeshStandardMaterial(p)
  m.name = nombre
  return m
}

/**
 * Pega los lentes al hueso de la cabeza (`headx`) de una escena del personaje
 * recién clonada, todavía en su pose de reposo y sin padre. No usa el
 * esqueleto de las piezas: en character.glb (cuantizado con gltf-transform)
 * cada pieza trae su propia escala metida en sus inverseBindMatrices. Los
 * lentes llevan un esqueleto propio de un solo hueso, la cabeza, cuyo inverso
 * es su matriz de reposo; así, en cualquier pose, quedan en
 * cabeza(ahora) · cabeza(reposo)⁻¹ · lentes(reposo). Las tres partes (armazón,
 * micas, remaches) van en una sola malla con tres materiales, para que el
 * despiece la tire entera. Regresa las mallas creadas; si ya los tiene, no los
 * duplica.
 */
export function ponerLentes(escena, gltfLentes, hueso = 'headx') {
  if (!escena || !gltfLentes?.scene) return []
  if (escena.userData.__lentes) return escena.userData.__lentes
  let cabeza = null
  escena.traverse((o) => { if (!cabeza && o.isBone && o.name === hueso) cabeza = o })
  if (!cabeza) return []
  escena.updateMatrixWorld(true)
  gltfLentes.scene.updateMatrixWorld(true)
  const raizInv = new THREE.Matrix4().copy(escena.matrixWorld).invert()
  const cabezaReposo = new THREE.Matrix4().multiplyMatrices(raizInv, cabeza.matrixWorld)
  const esqueleto = new THREE.Skeleton([cabeza], [cabezaReposo.clone().invert()])
  const geos = []
  const mats = []
  gltfLentes.scene.traverse((o) => {
    if (!o.isMesh || !o.geometry) return
    const g = o.geometry.clone()
    g.applyMatrix4(o.matrixWorld)          // reposo, en las coordenadas de la escena del personaje
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k)
    geos.push(g)
    mats.push(material(o.material?.name || 'Lentes_Armazon'))
  })
  if (!geos.length) return []
  const geo = mergeGeometries(geos, true)
  if (!geo) return []
  const n = geo.attributes.position.count
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(new Uint16Array(n * 4), 4))
  const peso = new Float32Array(n * 4)
  for (let k = 0; k < n; k++) peso[k * 4] = 1
  geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(peso, 4))
  const sm = new THREE.SkinnedMesh(geo, mats)
  sm.name = 'Egg_Lentes'
  sm.userData.accesorio = 'lentes'
  sm.frustumCulled = false
  escena.add(sm)
  sm.updateMatrixWorld(true)
  // bindMode 'attached': three anula la matriz de la malla, así que dónde
  // cuelga no importa; manda el hueso.
  sm.bind(esqueleto, new THREE.Matrix4())
  const hechos = [sm]
  escena.userData.__lentes = hechos
  if (import.meta.env.DEV && typeof window !== 'undefined') {
    // window.__lentes: las escenas que ya los traen (para revisar dónde se dibujan)
    ;(window.__lentes ||= []).push({ escena, hechos })
  }
  return hechos
}
