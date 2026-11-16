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
export { URL_LENTES, URL_BOXERS, URL_CORRER, ACCESORIOS, ACCESORIOS_EVENT, getAccesorios, setAccesorio, mostrarAccesorios } from './accesoriosEstado.js'

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

// ---------------------------------------------------------------------------
// Bóxers (Oscar, 2026-11-16): blancos con corazoncitos rojos. A diferencia de
// los lentes van con varios huesos: la pelvis (root.x), cada muslo
// (thigh_twist) y, en medio, prop_cadera, un hueso del .blend que gira la
// mitad que el muslo para que la tela de la ingle no se doble. Ese hueso no
// existe en el personaje: en la GPU su peso se reparte entre pelvis y muslo,
// y la tela (telaProp.js, solo en Player) calcula el de verdad.
// ---------------------------------------------------------------------------

const TINTA_CORAZON = '#d4142e'
const TELA = '#f3efe7'

function corazon(ctx, x, y, s, rot) {
  ctx.save()
  ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s)
  ctx.beginPath()
  ctx.moveTo(0, 0.42)
  ctx.bezierCurveTo(-0.62, 0.02, -0.5, -0.52, 0, -0.2)
  ctx.bezierCurveTo(0.5, -0.52, 0.62, 0.02, 0, 0.42)
  ctx.closePath()
  ctx.fill()
  ctx.restore()
}

let texturasBoxers = null
function texturas() {
  if (texturasBoxers) return texturasBoxers
  const S = 256
  // Un mosaico con dos corazones (a medio paso, como tela estampada), cada uno
  // con su giro; los que tocan la orilla se repiten del otro lado para que el
  // mosaico no tenga costura.
  const c = document.createElement('canvas'); c.width = S; c.height = S
  const ctx = c.getContext('2d')
  ctx.fillStyle = TELA; ctx.fillRect(0, 0, S, S)
  ctx.fillStyle = TINTA_CORAZON
  const pos = [[0.25, 0.27, -0.28], [0.75, 0.77, 0.24]]
  for (const [u, v, r] of pos) {
    for (const dx of [-1, 0, 1]) for (const dy of [-1, 0, 1]) corazon(ctx, (u + dx) * S, (v + dy) * S, S * 0.36, r)
  }
  const tela = new THREE.CanvasTexture(c)
  tela.wrapS = tela.wrapT = THREE.RepeatWrapping
  tela.colorSpace = THREE.SRGBColorSpace
  tela.anisotropy = 4
  // El elástico: blanco con dos rayas rojas (su v va de 0 abajo a 1 arriba).
  const e = document.createElement('canvas'); e.width = 16; e.height = 64
  const ex = e.getContext('2d')
  ex.fillStyle = TELA; ex.fillRect(0, 0, 16, 64)
  ex.fillStyle = TINTA_CORAZON
  ex.fillRect(0, 64 * (1 - 0.34) - 3, 16, 6)
  ex.fillRect(0, 64 * (1 - 0.70) - 3, 16, 6)
  const elastico = new THREE.CanvasTexture(e)
  elastico.wrapS = elastico.wrapT = THREE.RepeatWrapping
  elastico.colorSpace = THREE.SRGBColorSpace
  texturasBoxers = { tela, elastico }
  return texturasBoxers
}

function materialBoxers(nombre) {
  const t = texturas()
  const base = { roughness: 0.85, metalness: 0, side: THREE.DoubleSide }
  let m
  if (nombre === 'Boxers_Elastico') m = new THREE.MeshStandardMaterial({ ...base, map: t.elastico })
  else if (nombre === 'Boxers_Interior') m = new THREE.MeshStandardMaterial({ ...base, color: 0xe6e1d8 })
  else m = new THREE.MeshStandardMaterial({ ...base, map: t.tela })
  m.name = nombre
  return m
}

// Huesos que usa el GLB de los bóxers, con el nombre que les deja GLTFLoader.
const HUESOS_BOXERS = ['rootx', 'thigh_twistl', 'thigh_twistr', 'prop_caderal', 'prop_caderar']
// Para la GPU: prop_cadera.l = mitad pelvis + mitad muslo izquierdo.
const MITAD_DE = { 3: 1, 4: 2 }

/**
 * Pega los bóxers a una escena del personaje recién clonada (en reposo y sin
 * padre). Las tres partes del GLB (tela, elástico, interior) van en una sola
 * malla `Egg_Boxers` con tres materiales, para que el despiece la tire entera.
 * Su esqueleto son tres huesos del personaje (pelvis y muslos); los inversos
 * son su reposo en el espacio de la escena (character.glb trae la escala de
 * cada pieza en sus inverseBindMatrices y no sirven). Deja en
 * `userData.tela` lo que necesita la física.
 */
export function ponerBoxers(escena, gltfBoxers) {
  if (!escena || !gltfBoxers?.scene) return []
  if (escena.userData.__boxers) return escena.userData.__boxers
  const porNombre = {}
  escena.traverse((o) => { if (o.isBone) porNombre[o.name] = o })
  if (!porNombre.rootx || !porNombre.thigh_twistl || !porNombre.thigh_twistr) return []
  escena.updateMatrixWorld(true)
  gltfBoxers.scene.updateMatrixWorld(true)
  const raizInv = new THREE.Matrix4().copy(escena.matrixWorld).invert()
  const reposo = (b) => new THREE.Matrix4().multiplyMatrices(raizInv, b.matrixWorld)

  const geos = []; const mats = []; const cpuIdx = []; const cpuW = []
  const v = new THREE.Vector3()
  gltfBoxers.scene.traverse((o) => {
    if (!o.isSkinnedMesh || !o.geometry) return
    o.skeleton.update()
    const g = o.geometry
    const n = g.attributes.position.count
    const pos = new Float32Array(n * 3)
    // La posición de reposo sale del propio skinning del GLB (no depende de
    // cómo exporte Blender las inverseBindMatrices).
    for (let i = 0; i < n; i++) {
      o.getVertexPosition(i, v)
      v.applyMatrix4(o.matrixWorld)
      pos[i * 3] = v.x; pos[i * 3 + 1] = v.y; pos[i * 3 + 2] = v.z
    }
    const si = g.attributes.skinIndex; const sw = g.attributes.skinWeight
    const nombres = o.skeleton.bones.map((b) => b.name)
    const ci = new Uint8Array(n * 4); const cw = new Float32Array(n * 4)
    for (let i = 0; i < n; i++) {
      let k = 0
      for (let c = 0; c < 4; c++) {
        const w = sw.getComponent(i, c)
        if (w <= 1e-5) continue
        const h = HUESOS_BOXERS.indexOf(nombres[si.getComponent(i, c)])
        if (h < 0) continue
        ci[i * 4 + k] = h; cw[i * 4 + k] = w; k++
      }
      let s = 0; for (let c = 0; c < 4; c++) s += cw[i * 4 + c]
      if (s > 0) for (let c = 0; c < 4; c++) cw[i * 4 + c] /= s
      else { ci[i * 4] = 0; cw[i * 4] = 1 }
    }
    const ng = new THREE.BufferGeometry()
    ng.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    ng.setAttribute('normal', g.attributes.normal.clone().applyNormalMatrix(new THREE.Matrix3().getNormalMatrix(o.matrixWorld)))
    if (g.attributes.uv) ng.setAttribute('uv', g.attributes.uv.clone())
    if (g.index) ng.setIndex(g.index.clone())
    geos.push(ng); mats.push(materialBoxers(o.material?.name)); cpuIdx.push(ci); cpuW.push(cw)
  })
  if (!geos.length) return []
  const geo = mergeGeometries(geos, true)
  if (!geo) return []
  const n = geo.attributes.position.count
  const idx = new Uint8Array(n * 4); const w = new Float32Array(n * 4)
  { let o = 0; for (let k = 0; k < cpuIdx.length; k++) { idx.set(cpuIdx[k], o); w.set(cpuW[k], o); o += cpuIdx[k].length } }
  // Pesos para la GPU sin la física: prop_cadera repartido mitad y mitad.
  const lbsI = new Uint16Array(n * 4); const lbsW = new Float32Array(n * 4)
  for (let i = 0; i < n; i++) {
    const acc = [0, 0, 0]
    for (let c = 0; c < 4; c++) {
      const h = idx[i * 4 + c]; const ww = w[i * 4 + c]
      if (ww <= 0) continue
      if (h <= 2) acc[h] += ww
      else { acc[0] += ww * 0.5; acc[MITAD_DE[h]] += ww * 0.5 }
    }
    for (let c = 0; c < 3; c++) { lbsI[i * 4 + c] = c; lbsW[i * 4 + c] = acc[c] }
  }
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(lbsI, 4))
  geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(lbsW, 4))
  const huesos = [porNombre.rootx, porNombre.thigh_twistl, porNombre.thigh_twistr]
  const reposos = huesos.map(reposo)
  const esqueleto = new THREE.Skeleton(huesos, reposos.map((m) => m.clone().invert()))
  const sm = new THREE.SkinnedMesh(geo, mats)
  sm.name = 'Egg_Boxers'
  sm.userData.accesorio = 'boxers'
  sm.frustumCulled = false
  escena.add(sm)
  sm.updateMatrixWorld(true)
  sm.bind(esqueleto, new THREE.Matrix4())
  sm.userData.tela = {
    reposo: Float32Array.from(geo.attributes.position.array),
    normalReposo: Float32Array.from(geo.attributes.normal.array),
    cpuIdx: idx, cpuW: w, lbsI, lbsW,
    huesos, reposos,
    rodillas: [porNombre.leg_stretchl, porNombre.leg_stretchr],
  }
  const hechos = [sm]
  escena.userData.__boxers = hechos
  if (import.meta.env.DEV && typeof window !== 'undefined') {
    ;(window.__boxers ||= []).push({ escena, sm })
  }
  return hechos
}
