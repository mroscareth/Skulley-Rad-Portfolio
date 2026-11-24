import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { prepararCordones } from './cordonesHoodie.js'
export { pasoCordones } from './cordonesHoodie.js'

// Props de Skulley hechos en Blender (Character/SkulleyRad.blend). Cada GLB trae
// el prop en la pose de reposo, en las coordenadas del personaje: aquí se
// vuelve una pieza más del personaje, una SkinnedMesh con todo su peso en un
// hueso. Así hereda lo que ya tienen las piezas del cuerpo sin código aparte:
// el banding toon y el brillo duro (se los pone quien clona los materiales),
// el contorno de silueta (Player arma hulls para cada SkinnedMesh), la tinta
// (CharacterNormalPass solo entinta SkinnedMesh), los fundidos de opacidad y
// el despiece (Player despieza los nodos Egg_*: por eso se llama Egg_Lentes).
// Estado (cuáles van puestos) y URLs, en un módulo sin three
export { URL_LENTES, URL_LENTES3D, URL_BOXERS, URL_CHAMARRA, URL_HOODIE, URL_TENIS, URL_INFLADA, URL_BOTAS, URL_PANTALONES, URL_MUNEQUERAS, URL_BEANIE, URL_CORRER, URL_IDLE, conClipsDelBlend, ACCESORIOS, ACCESORIOS_EVENT, getAccesorios, setAccesorio, mostrarAccesorios, tapadoPorProp } from './accesoriosEstado.js'

const MATERIALES_LENTES = {
  Lentes_Armazon: { color: 0x121212, roughness: 0.32, metalness: 0 },
  Lentes_Mica: { color: 0x0c1813, roughness: 0.12, metalness: 0 },
  // Los remaches, plateados (Oscar). Con metalness 1 y sin un reflejo que
  // tomar (el toon apaga el del HDRI) salían negros: plateado de caricatura.
  Lentes_Metal: { color: 0xd4d8de, roughness: 0.3, metalness: 0 },
}
const LENTES = { id: 'lentes', malla: 'Egg_Lentes', materiales: MATERIALES_LENTES, base: 'Lentes_Armazon' }

// Lentes 3D de cartón (Oscar, 2026-11-19: "de esos blancos cuadrados con un
// lente rojo y otro azul"), de scripts/skulley-anim/lentes3d.py: entran igual
// que los Lentes. Las micas son opacas: translúcidas habría que ordenarlas y
// dibujarlas aparte de lo opaco (y recompilar con los fundidos de Skulley).
const MATERIALES_LENTES3D = {
  Lentes3D_Armazon: { color: 0xeeece6, roughness: 0.6, metalness: 0 },
  // la roja del ojo izquierdo de Skulley, la azul del derecho (como los de anáglifo)
  Lentes3D_Rojo: { color: 0xe3122c, roughness: 0.2, metalness: 0 },
  Lentes3D_Azul: { color: 0x1668ff, roughness: 0.2, metalness: 0 },
}
const LENTES3D = { id: 'lentes3d', malla: 'Egg_Lentes3D', materiales: MATERIALES_LENTES3D, base: 'Lentes3D_Armazon' }

// La Flying V amarilla del solo de guitarra (Oscar, 2026-11-23, primero azul; el amarillo, de su muestra;
// scripts/skulley-anim/guitarra.py): no es un prop de
// Customize, la saca el idle (lib/siestaSkulley.js). Entra como los lentes, colgada de un hueso (el pecho).
const MATERIALES_GUITARRA = {
  Guitarra_Cuerpo: { color: 0xeca323, roughness: 0.45, metalness: 0 },
  Guitarra_Canto: { color: 0xf7d27a, roughness: 0.45, metalness: 0 },
  Guitarra_Negro: { color: 0x121212, roughness: 0.4, metalness: 0 },
  Guitarra_Madera: { color: 0x8a5a35, roughness: 0.7, metalness: 0 },
  Guitarra_Diapason: { color: 0x3a1f17, roughness: 0.7, metalness: 0 },
  Guitarra_Metal: { color: 0xd4d8de, roughness: 0.3, metalness: 0 },
  Guitarra_Blanco: { color: 0xf2efe8, roughness: 0.5, metalness: 0 },
}
const GUITARRA = { id: 'guitarra', malla: 'Egg_Guitarra', materiales: MATERIALES_GUITARRA, base: 'Guitarra_Cuerpo' }
// su púa (Oscar: "como si estuviera tocando con una púa"), colgada del pulgar derecho entre él y el índice
const PUA = { id: 'pua', malla: 'Egg_GuitarraPua', materiales: { Pua: { color: 0xf5ff00, roughness: 0.4, metalness: 0 } }, base: 'Pua' }

function material(cfg, nombre) {
  const p = cfg.materiales[nombre] || cfg.materiales[cfg.base]
  const m = new THREE.MeshStandardMaterial(p)
  m.name = cfg.materiales[nombre] ? nombre : cfg.base
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
  return ponerEnCabeza(escena, gltfLentes, LENTES, hueso)
}

/** Los lentes 3D como `Egg_Lentes3D`, igual que los Lentes (armazón y micas en una malla). */
export function ponerLentes3D(escena, gltf, hueso = 'headx') {
  return ponerEnCabeza(escena, gltf, LENTES3D, hueso)
}

/** La guitarra del solo como `Egg_Guitarra`, colgada del pecho (`spine_03x`), y su púa como `Egg_GuitarraPua`,
 *  del pulgar (`thumb3r`); `userData.deIdle`: las muestra el idle, no Customize. */
export function ponerGuitarra(escena, gltf, gltfPua = null) {
  const hechos = [...ponerEnCabeza(escena, gltf, GUITARRA, 'spine_03x')]
  if (gltfPua) hechos.push(...ponerEnCabeza(escena, gltfPua, PUA, 'thumb3r'))
  for (const m of hechos) m.userData.deIdle = true
  return hechos
}

function ponerEnCabeza(escena, gltfLentes, cfg, hueso) {
  const llave = `__${cfg.id}`
  if (!escena || !gltfLentes?.scene) return []
  if (escena.userData[llave]) return escena.userData[llave]
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
    mats.push(material(cfg, o.material?.name))
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
  sm.name = cfg.malla
  sm.userData.accesorio = cfg.id
  sm.frustumCulled = false
  escena.add(sm)
  sm.updateMatrixWorld(true)
  // bindMode 'attached': three anula la matriz de la malla, así que dónde
  // cuelga no importa; manda el hueso.
  sm.bind(esqueleto, new THREE.Matrix4())
  const hechos = [sm]
  escena.userData[llave] = hechos
  if (import.meta.env.DEV && typeof window !== 'undefined') {
    // window.__lentes / __lentes3d: las escenas que ya los traen (para revisar dónde se dibujan)
    ;(window[llave] ||= []).push({ escena, hechos })
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
  // El elástico: blanco con dos rayas rojas. Su v va de 0 arriba a 1 abajo
  // (3 cm de banda) y el canvas se voltea: la fila de arriba es v = 1. De
  // 3 mm casi no se veían; van de 5 mm.
  const e = document.createElement('canvas'); e.width = 16; e.height = 64
  const ex = e.getContext('2d')
  ex.fillStyle = TELA; ex.fillRect(0, 0, 16, 64)
  ex.fillStyle = TINTA_CORAZON
  for (const v of [0.3, 0.68]) ex.fillRect(0, 64 * (1 - v) - 5, 16, 10)
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

// ---------------------------------------------------------------------------
// Chamarra de piel (Oscar, 2026-11-17): abierta, con solapas, tres picos de
// tornillo en cada hombro, cierre y broches. Sale de scripts/skulley-anim/
// chamarra.py (procedural). Va con los huesos del torso, el cuello y los
// brazos (19); el GLB trae su propia lista de huesos y aquí se empata por
// nombre con los del personaje. Tiene grosor (cara de afuera y forro), así que
// sus materiales van de un solo lado. Con la chamarra, apartaManos abre los
// brazos lo justo para que las mangas no se metan al costado.
// ---------------------------------------------------------------------------

const MATERIALES_CHAMARRA = {
  // mate (Oscar): con 0.34 el brillo se veía de plástico
  Chamarra_Piel: { color: 0x19191c, roughness: 0.68, metalness: 0 },
  Chamarra_Forro: { color: 0x2a2220, roughness: 0.8, metalness: 0 },
  // plateado de caricatura, como los remaches de los lentes (con metalness 1 salen negros)
  Chamarra_Metal: { color: 0xd4d8de, roughness: 0.28, metalness: 0 },
  // el estampado de la espalda (la imagen de Oscar): su textura viene en el GLB;
  // es un cuadro y lo transparente se recorta (el pico se sale del círculo)
  Chamarra_Estampado: { color: 0xffffff, roughness: 0.68, metalness: 0, alphaTest: 0.5 },
  // el parche del pecho (la carita con copete de Oscar), igual: textura del GLB y recorte
  Chamarra_Parche: { color: 0xffffff, roughness: 0.68, metalness: 0, alphaTest: 0.5 },
}
const ORDEN_CHAMARRA = ['Chamarra_Piel', 'Chamarra_Forro', 'Chamarra_Metal', 'Chamarra_Estampado', 'Chamarra_Parche']

const CHAMARRA = { id: 'chamarra', malla: 'Egg_Chamarra', materiales: MATERIALES_CHAMARRA, orden: ORDEN_CHAMARRA, mapa: ['Chamarra_Estampado', 'Chamarra_Parche'] }

/**
 * Pone una prenda (chamarra, hoodie) en una escena del personaje recién clonada
 * (en reposo y sin padre), como `cfg.malla`: una malla con un grupo por
 * material (las partes del GLB con el mismo material se juntan). La posición de
 * reposo sale del propio skinning del GLB, igual que los bóxers. `cfg.mapa`:
 * materiales que conservan la textura del GLB (con su UV).
 */
function ponerPrenda(escena, gltf, cfg) {
  const llave = `__${cfg.id}`
  if (!escena || !gltf?.scene) return []
  if (escena.userData[llave]) return escena.userData[llave]
  const porNombre = {}
  escena.traverse((o) => { if (o.isBone) porNombre[o.name] = o })
  escena.updateMatrixWorld(true)
  gltf.scene.updateMatrixWorld(true)
  const raizInv = new THREE.Matrix4().copy(escena.matrixWorld).invert()
  // huesos del .blend que el personaje no trae (prop_cadera de los pantalones): la prenda los arma aquí
  if (cfg.huesos) cfg.huesos(porNombre, raizInv)
  const huesos = []
  const indiceDe = new Map()
  const porMaterial = new Map()
  const mapas = {}
  const conUV = !!cfg.mapa
  const v = new THREE.Vector3()
  gltf.scene.traverse((o) => {
    if (!o.isSkinnedMesh || !o.geometry) return
    o.skeleton.update()
    const g = o.geometry
    const n = g.attributes.position.count
    const pos = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) {
      o.getVertexPosition(i, v)
      v.applyMatrix4(o.matrixWorld)
      pos[i * 3] = v.x; pos[i * 3 + 1] = v.y; pos[i * 3 + 2] = v.z
    }
    const si = g.attributes.skinIndex; const sw = g.attributes.skinWeight
    const nombres = o.skeleton.bones.map((b) => b.name)
    const ci = new Uint16Array(n * 4); const cw = new Float32Array(n * 4)
    for (let i = 0; i < n; i++) {
      let k = 0
      for (let c = 0; c < 4; c++) {
        const w = sw.getComponent(i, c)
        const hueso = porNombre[nombres[si.getComponent(i, c)]]
        if (w <= 1e-5 || !hueso) continue
        let h = indiceDe.get(hueso)
        if (h === undefined) { h = huesos.length; huesos.push(hueso); indiceDe.set(hueso, h) }
        ci[i * 4 + k] = h; cw[i * 4 + k] = w; k++
      }
      let s = 0; for (let c = 0; c < 4; c++) s += cw[i * 4 + c]
      if (s > 0) for (let c = 0; c < 4; c++) cw[i * 4 + c] /= s
      else cw[i * 4] = 1
    }
    const ng = new THREE.BufferGeometry()
    ng.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    ng.setAttribute('normal', g.attributes.normal.clone().applyNormalMatrix(new THREE.Matrix3().getNormalMatrix(o.matrixWorld)))
    if (conUV) ng.setAttribute('uv', g.attributes.uv ? g.attributes.uv.clone() : new THREE.BufferAttribute(new Float32Array(n * 2), 2))
    ng.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(ci, 4))
    ng.setAttribute('skinWeight', new THREE.Float32BufferAttribute(cw, 4))
    if (g.index) ng.setIndex(g.index.clone())
    const nombre = cfg.materiales[o.material?.name] ? o.material.name : cfg.orden[0]
    if (cfg.mapa?.includes(nombre) && o.material?.map) mapas[nombre] = o.material.map
    if (!porMaterial.has(nombre)) porMaterial.set(nombre, [])
    porMaterial.get(nombre).push(ng)
  })
  if (!huesos.length) return []
  const geos = []; const mats = []
  for (const nombre of cfg.orden) {
    const lista = porMaterial.get(nombre)
    if (!lista) continue
    const g = lista.length > 1 ? mergeGeometries(lista, false) : lista[0]
    if (!g) continue
    geos.push(g)
    const m = new THREE.MeshStandardMaterial(cfg.materiales[nombre])
    if (mapas[nombre]) m.map = mapas[nombre]
    m.name = nombre
    mats.push(m)
  }
  const geo = mergeGeometries(geos, true)
  if (!geo) return []
  const reposos = huesos.map((b) => new THREE.Matrix4().multiplyMatrices(raizInv, b.matrixWorld))
  // huesos propios de la prenda (los cordones del hoodie), antes del esqueleto
  const extra = cfg.preparar ? cfg.preparar(geo, mats.map((m) => m.name), huesos, reposos, porNombre, raizInv) : null
  const esqueleto = new THREE.Skeleton(huesos, reposos.map((m) => m.clone().invert()))
  const sm = new THREE.SkinnedMesh(geo, mats)
  sm.name = cfg.malla
  sm.userData.accesorio = cfg.id
  if (extra) sm.userData.cordones = extra
  sm.frustumCulled = false
  escena.add(sm)
  sm.updateMatrixWorld(true)
  sm.bind(esqueleto, new THREE.Matrix4())
  const hechos = [sm]
  escena.userData[llave] = hechos
  if (import.meta.env.DEV && typeof window !== 'undefined') {
    ;(window[llave] ||= []).push({ escena, sm })
  }
  return hechos
}

/** La chamarra como `Egg_Chamarra` (las dos partes de piel del GLB se juntan). */
export function ponerChamarra(escena, gltf) {
  return ponerPrenda(escena, gltf, CHAMARRA)
}

/**
 * Opciones de telaSuelta para la chamarra despiezada (Oscar: "que tampoco sea
 * rígida, como los bóxers"). Simula solo la piel de afuera; el forro (a medio
 * centímetro) y el metal (picos, dientes, broches) la siguen como piel. Las
 * solapas, que en la piel de afuera no se tocan con el pecho, quedan amarradas
 * a él (`pegar`). Nodos más grandes que los de los bóxers: la chamarra tiene 7
 * veces sus vértices (medido: 507 nodos, 1.4 ms el paso y 2 ms escribir la
 * malla, hasta que se duerme a los ~2.5 s; con las dos capas eran 5.4 ms).
 */
export function opcionesTelaChamarra(mesh) {
  return opcionesTela(mesh, 'Chamarra_Piel')
}

function opcionesTela(mesh, material) {
  const g = mesh?.geometry
  if (!g?.index) return {}
  const simula = new Uint8Array(g.attributes.position.count)
  const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
  for (const gr of g.groups) {
    if (mats[gr.materialIndex]?.name !== material) continue
    for (let k = gr.start; k < gr.start + gr.count; k++) simula[g.index.getX(k)] = 1
  }
  return { simula, lado: 0.06, k: 5, pegar: 0.014 }
}

// ---------------------------------------------------------------------------
// Hoodie (Oscar, 2026-11-17): negro, pegado al cuerpo, con resorte y puños
// acanalados, capucha caída y cordones; SKULLEYRAD en SKULLEYGLYPH a lo largo
// de las dos mangas. Sale de scripts/skulley-anim/hoodie.py. Como la chamarra:
// 19 huesos del torso, el cuello y los brazos, con grosor (tela y forro), y
// apartaManos abre los brazos para que las mangas no se metan al costado. La
// tela de afuera trae la textura del GLB (negro con el texto); lo demás va de
// color. La capucha va en su propio material para que la tela suelta la lleve
// como piel y no cuente como costado del torso.
// ---------------------------------------------------------------------------

const MATERIALES_HOODIE = {
  // el negro lo pone la textura (con el texto de las mangas)
  Hoodie_Tela: { color: 0xffffff, roughness: 0.9, metalness: 0 },
  Hoodie_Capucha: { color: 0x121214, roughness: 0.9, metalness: 0 },
  Hoodie_Forro: { color: 0x26262b, roughness: 0.95, metalness: 0 },
  Hoodie_Puno: { color: 0x0f0f11, roughness: 0.9, metalness: 0 },
  Hoodie_Cordon: { color: 0x141416, roughness: 0.7, metalness: 0 },
  Hoodie_Punta: { color: 0x5a5c62, roughness: 0.4, metalness: 0 },
}
const HOODIE = {
  id: 'hoodie', malla: 'Egg_Hoodie', materiales: MATERIALES_HOODIE, mapa: ['Hoodie_Tela'],
  // los cordones se mecen (cordonesHoodie.js): una cadena de huesos propios por cordón
  preparar: prepararCordones,
  orden: ['Hoodie_Tela', 'Hoodie_Capucha', 'Hoodie_Forro', 'Hoodie_Puno', 'Hoodie_Cordon', 'Hoodie_Punta'],
}

/** El hoodie como `Egg_Hoodie`. */
export function ponerHoodie(escena, gltf) {
  return ponerPrenda(escena, gltf, HOODIE)
}

/**
 * Opciones de telaSuelta para el hoodie despiezado (Oscar: "es tela, que no sea
 * rígida cuando el personaje se despieza"). Como la chamarra: simula la tela de
 * afuera; el forro, la capucha, el resorte, los puños y los cordones la siguen
 * como piel.
 */
export function opcionesTelaHoodie(mesh) {
  return opcionesTela(mesh, 'Hoodie_Tela')
}

// ---------------------------------------------------------------------------
// Chamarra inflada (Oscar, 2026-11-17): de plumas, amarilla, pegada al cuerpo
// con gajos chicos y redondos, cuello de rollo, cierre negro y una fila de
// picos de tela cyan (el del pelo) en el lado de afuera de cada manga. Sale de
// scripts/skulley-anim/inflada.py. Como el hoodie: 19 huesos, tela y forro, y
// apartaManos abre los brazos para que las mangas no se metan al costado. El
// cuello va en su propio material (la tela suelta lo lleva como piel); los
// picos siguen la tela en la base y son rígidos hacia la punta. La X magenta de
// Oscar va grande en la espalda y chica en el pecho: rejillas pegadas a la tela
// con la imagen del GLB, y lo transparente se recorta (como el estampado de la
// chamarra).
// ---------------------------------------------------------------------------

const MATERIALES_INFLADA = {
  Inflada_Tela: { color: 0xffcc1a, roughness: 0.6, metalness: 0 },
  Inflada_Cuello: { color: 0xffcc1a, roughness: 0.6, metalness: 0 },
  // casi el amarillo de la tela: en los pliegues de la axila y del codo se asoma
  Inflada_Forro: { color: 0xe0b312, roughness: 0.8, metalness: 0 },
  Inflada_Puno: { color: 0xffcc1a, roughness: 0.7, metalness: 0 },
  Inflada_Cierre: { color: 0x141416, roughness: 0.5, metalness: 0 },
  // el cyan del pelo por defecto (characterColors.js, hair); Oscar los quiso de ese azul
  Inflada_Picos: { color: 0x00ebff, roughness: 0.9, metalness: 0 },
  // la X: su textura viene en el GLB
  Inflada_Estampado: { color: 0xffffff, roughness: 0.6, metalness: 0, alphaTest: 0.5 },
}
const INFLADA = {
  id: 'inflada', malla: 'Egg_Inflada', materiales: MATERIALES_INFLADA, mapa: ['Inflada_Estampado'],
  orden: ['Inflada_Tela', 'Inflada_Cuello', 'Inflada_Forro', 'Inflada_Puno', 'Inflada_Cierre', 'Inflada_Picos', 'Inflada_Estampado'],
}

/** La chamarra inflada como `Egg_Inflada`. */
export function ponerInflada(escena, gltf) {
  return ponerPrenda(escena, gltf, INFLADA)
}

/** Opciones de telaSuelta para la inflada despiezada: simula la tela de afuera; lo demás la sigue como piel. */
export function opcionesTelaInflada(mesh) {
  return opcionesTela(mesh, 'Inflada_Tela')
}

// ---------------------------------------------------------------------------
// Tenis (Oscar, 2026-11-17): tipo Converse de bota, lona negra y suela crema
// con línea negra. Salen de scripts/skulley-anim/tenis.py con la piel del pie y
// la espinilla (foot, toes_01, leg_twist, leg_twist_2, leg_stretch). No
// envuelven al pie (un bloque con dedos de 14 cm que los dejaba cuadrados):
// tienen forma propia y el pie se oculta mientras los trae puestos, por eso
// marcan Egg_Foot_L/R con `ocultaCon` (quien los pinta lo respeta, también en
// sus contornos y en el despiece). El GLB trae los dos en una malla y aquí se
// parten en Egg_TenisL y Egg_TenisR: el despiece tira una pieza por nodo Egg_*
// y juntos caían como un solo cuerpo de pie a pie.
// ---------------------------------------------------------------------------

const MATERIALES_TENIS = {
  Tenis_Lona: { color: 0x353538, roughness: 0.85, metalness: 0 },
  Tenis_Forro: { color: 0x454549, roughness: 0.9, metalness: 0 },
  Tenis_Suela: { color: 0xe7ddc5, roughness: 0.6, metalness: 0 },
  Tenis_Agujetas: { color: 0xf0e8d7, roughness: 0.8, metalness: 0 },
  // ojillos plateados de caricatura (con metalness 1 y sin reflejo salen negros)
  Tenis_Metal: { color: 0xdddee1, roughness: 0.35, metalness: 0 },
}
const TENIS = {
  id: 'tenis', malla: 'Egg_Tenis', materiales: MATERIALES_TENIS,
  orden: ['Tenis_Lona', 'Tenis_Forro', 'Tenis_Suela', 'Tenis_Agujetas', 'Tenis_Metal'],
}
const PIES = /^Egg_Foot_[LR]$/
// La tinta de los pliegues llenaba de líneas las agujetas y los ojillos y no se
// veía el detalle (Oscar): no entran al buffer de normales (CharacterNormalPass).
const SIN_TINTA_TENIS = ['Tenis_Agujetas', 'Tenis_Metal']

/** Copia de una malla con solo los triángulos cuyo centro cumple `quedan(x, y, z)`. */
function partirMalla(g, quedan) {
  const pos = g.attributes.position
  const idx = g.index
  const mapa = new Int32Array(pos.count).fill(-1)
  const viejos = []
  const nuevo = []
  const grupos = []
  for (const gr of g.groups) {
    const ini = nuevo.length
    for (let k = gr.start; k < gr.start + gr.count; k += 3) {
      const a = idx.getX(k), b = idx.getX(k + 1), c = idx.getX(k + 2)
      const x = (pos.getX(a) + pos.getX(b) + pos.getX(c)) / 3
      const y = (pos.getY(a) + pos.getY(b) + pos.getY(c)) / 3
      const z = (pos.getZ(a) + pos.getZ(b) + pos.getZ(c)) / 3
      if (!quedan(x, y, z)) continue
      for (const v of [a, b, c]) {
        if (mapa[v] < 0) { mapa[v] = viejos.length; viejos.push(v) }
        nuevo.push(mapa[v])
      }
    }
    if (nuevo.length > ini) grupos.push([ini, nuevo.length - ini, gr.materialIndex])
  }
  const ng = new THREE.BufferGeometry()
  for (const [nombre, attr] of Object.entries(g.attributes)) {
    const n = attr.itemSize
    const arr = new attr.array.constructor(viejos.length * n)
    for (let i = 0; i < viejos.length; i++) for (let c = 0; c < n; c++) arr[i * n + c] = attr.array[viejos[i] * n + c]
    ng.setAttribute(nombre, new THREE.BufferAttribute(arr, n, attr.normalized))
  }
  ng.setIndex(nuevo)
  for (const [s, n, m] of grupos) ng.addGroup(s, n, m)
  return ng
}

/**
 * Calzado (tenis, botas): el GLB trae el par en una malla y aquí se parte en
 * `<malla>L` y `<malla>R`; los pies quedan marcados para ocultarse con él
 * (`ocultaCon` junta los ids de todo el calzado que los tapa). `tapa`: qué
 * piezas del cuerpo oculta (las muñequeras no ocultan nada).
 */
function ponerCalzado(escena, gltf, cfg, sinTinta, tapa = PIES) {
  const llave = `__${cfg.id}Par`
  if (!escena) return []
  if (escena.userData[llave]) return escena.userData[llave]
  const [par] = ponerPrenda(escena, gltf, cfg)
  if (!par) return []
  // el izquierdo va en x > 0 (en las coordenadas del personaje)
  const hechos = [[`${cfg.malla}L`, (x) => x > 0], [`${cfg.malla}R`, (x) => x <= 0]].map(([nombre, quedan]) => {
    const sm = new THREE.SkinnedMesh(partirMalla(par.geometry, quedan), par.material)
    sm.name = nombre
    sm.userData.accesorio = cfg.id
    sm.userData.sinTinta = sinTinta
    sm.frustumCulled = false
    escena.add(sm)
    sm.updateMatrixWorld(true)
    sm.bind(par.skeleton, new THREE.Matrix4())
    return sm
  })
  escena.remove(par)
  par.geometry.dispose()
  if (tapa) escena.traverse((o) => {
    if (!tapa.test(o.name)) return
    o.traverse((h) => {
      const antes = h.userData.ocultaCon
      const ids = Array.isArray(antes) ? antes : antes ? [antes] : []
      if (!ids.includes(cfg.id)) h.userData.ocultaCon = [...ids, cfg.id]
    })
  })
  escena.userData[`__${cfg.id}`] = hechos
  escena.userData[llave] = hechos
  return hechos
}

/** Los tenis como `Egg_TenisL` y `Egg_TenisR`; los pies quedan marcados para ocultarse con ellos. */
export function ponerTenis(escena, gltf) {
  return ponerCalzado(escena, gltf, TENIS, SIN_TINTA_TENIS)
}

// ---------------------------------------------------------------------------
// Botas (Oscar, 2026-11-18): tenis-bota futurista, azul con suela blanca,
// calcetín gris carbón, lengüeta grande y dos correas con hebillas amarillas.
// Salen de scripts/skulley-anim/botas.py con la piel del pie y la espinilla
// (el frente dobla como bisagra en el tobillo: ver el script). Como los tenis:
// el par se parte en izquierda y derecha y los pies se ocultan con ellas.
// ---------------------------------------------------------------------------

const MATERIALES_BOTAS = {
  Botas_Azul: { color: 0x3045da, roughness: 0.55, metalness: 0 },
  Botas_Cuello: { color: 0x292a2e, roughness: 0.75, metalness: 0 },
  Botas_Suela: { color: 0xe7e7ea, roughness: 0.6, metalness: 0 },
  Botas_Amarillo: { color: 0xf5ff00, roughness: 0.5, metalness: 0 },
  Botas_Forro: { color: 0x38383c, roughness: 0.85, metalness: 0 },
  Botas_Perforado: { color: 0x161f6f, roughness: 0.6, metalness: 0 },
  Botas_Huella: { color: 0x959599, roughness: 0.7, metalness: 0 },
}
const BOTAS = {
  id: 'botas', malla: 'Egg_Botas', materiales: MATERIALES_BOTAS,
  orden: ['Botas_Azul', 'Botas_Cuello', 'Botas_Suela', 'Botas_Amarillo', 'Botas_Forro', 'Botas_Perforado', 'Botas_Huella'],
}
// los puntitos perforados y el dibujo de la suela se llenarían de tinta
const SIN_TINTA_BOTAS = ['Botas_Perforado', 'Botas_Huella']

/** Las botas como `Egg_BotasL` y `Egg_BotasR`; los pies quedan marcados para ocultarse con ellas. */
export function ponerBotas(escena, gltf) {
  return ponerCalzado(escena, gltf, BOTAS, SIN_TINTA_BOTAS)
}

// ---------------------------------------------------------------------------
// Muñequeras de picos (Oscar, 2026-11-18): aro negro grueso en segmentos, con
// picos triangulares planos del lado del dorso y del meñique (el cuerpo solo se
// acerca al antebrazo por la palma y el pulgar), escalón y tornillo en cada
// pico, cinchos y la correa tejida por dentro. Salen de scripts/skulley-anim/
// munequeras.py, rígidas: todo su peso en forearm_twist, que gira con la
// muñeca sin doblarse. Su hueco libra la manga de la chamarra; el puño del
// hoodie y el de la inflada no caben (se excluyen). Como el calzado, el par se
// parte en Egg_MunequeraL y Egg_MunequeraR para que el despiece tire dos piezas.
// ---------------------------------------------------------------------------

const MATERIALES_MUNEQUERAS = {
  Munequera_Placa: { color: 0x202024, roughness: 0.45, metalness: 0 },
  Munequera_Correa: { color: 0x34343a, roughness: 0.9, metalness: 0 },
  Munequera_Pico: { color: 0x27272c, roughness: 0.4, metalness: 0 },
  // el escalón de cada pico, un poco más claro para que se lea la placa encima
  Munequera_Escalon: { color: 0x44444d, roughness: 0.25, metalness: 0 },
  // tornillos plateados de caricatura (con metalness 1 y sin reflejo salen negros)
  Munequera_Metal: { color: 0xd4d8de, roughness: 0.3, metalness: 0 },
  Munequera_Cincho: { color: 0x121214, roughness: 0.6, metalness: 0 },
}
const MUNEQUERAS = {
  id: 'munequeras', malla: 'Egg_Munequera', materiales: MATERIALES_MUNEQUERAS,
  orden: ['Munequera_Placa', 'Munequera_Correa', 'Munequera_Pico', 'Munequera_Escalon', 'Munequera_Metal', 'Munequera_Cincho'],
}
// los tornillos y los cinchos son chiquitos: la tinta de los pliegues los llenaría de negro
const SIN_TINTA_MUNEQUERAS = ['Munequera_Metal', 'Munequera_Cincho']

/** Las muñequeras como `Egg_MunequeraL` y `Egg_MunequeraR` (no ocultan nada del cuerpo). */
export function ponerMunequeras(escena, gltf) {
  const hechas = ponerCalzado(escena, gltf, MUNEQUERAS, SIN_TINTA_MUNEQUERAS, null)
  try { prepararMangasCenidas(escena) } catch (e) { if (import.meta.env.DEV) console.warn('[mangas ceñidas]', e) }
  return hechas
}

// Con el hoodie y la inflada, la muñequera aprieta la manga (Oscar, 2026-11-18: "déjalas en su tamaño normal
// para todos"; con el hueco de 10 cm que pedía el puño del hoodie le parecieron demasiado grandes). El puño
// del hoodie llega a 9.5 cm del eje del antebrazo y el de la inflada a 7.8; el hueco mide 6.9. Desde 3 cm
// antes del aro, lo de la manga se aprieta hacia el eje, de `dentro` (más afuera que el antebrazo y la mano
// al doblarse) a `fuera` (medio centímetro menos que el hueco), conservando el orden de las capas; los picos
// de la inflada no cuentan para la escala pero también entran. Mismo cálculo que munequeras.py (cenido,
// CINE_*), medido allá cuadro por cuadro. Medidas en metros, en el marco de forearm_twist en reposo.
// Pasando la cara de enfrente del aro (y1) la manga se suelta y el puño vuelve a abrirse: ceñido hasta la
// punta, la mano al doblarse se metía en el final del puño del hoodie caminando.
const CINE = { y0: -0.008, y1: 0.06, desde: 0.03, lleno: 0.003, suelta: [0.0015, 0.006], dentro: 0.058, fuera: 0.064, picos: ['Inflada_Picos'] }
const CON_MANGAS = ['hoodie', 'inflada']

function suave(a, b, x) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

/**
 * Para cada prenda con mangas que ya esté en la escena (hoodie, inflada), arma sus posiciones con las mangas
 * ceñidas y deja en `escena.userData.cenirMangas(estado)` el cambio entre unas y otras: se ciñen cuando van
 * puestas junto con las muñequeras. Escribe encima de las posiciones (el contorno comparte la geometría).
 */
function prepararMangasCenidas(escena) {
  const porNombre = {}
  escena.traverse((o) => { if (o.isBone) porNombre[o.name] = o })
  escena.updateMatrixWorld(true)
  const raizInv = new THREE.Matrix4().copy(escena.matrixWorld).invert()
  const marcos = {}
  for (const s of ['l', 'r']) {
    const b = porNombre[`forearm_twist${s}`]
    if (!b) return
    const R = new THREE.Matrix4().multiplyMatrices(raizInv, b.matrixWorld)
    const t = new THREE.Vector3(), q = new THREE.Quaternion(), e = new THREE.Vector3()
    R.decompose(t, q, e)
    const marco = new THREE.Matrix4().compose(t, q, new THREE.Vector3(1, 1, 1))
    marcos[s] = { marco, inv: marco.clone().invert() }
  }
  const mallas = []
  escena.traverse((o) => { if (o.isSkinnedMesh && CON_MANGAS.includes(o.userData?.accesorio) && !o.geometry.userData.posCenida) mallas.push(o) })
  for (const m of mallas) {
    const g = m.geometry
    const pos = g.attributes.position, si = g.attributes.skinIndex, sw = g.attributes.skinWeight
    const nombres = m.skeleton.bones.map((b) => b.name)
    const mats = Array.isArray(m.material) ? m.material : [m.material]
    const esPico = new Uint8Array(pos.count)
    if (g.index) {
      for (const gr of g.groups) {
        if (!CINE.picos.includes(mats[gr.materialIndex]?.name)) continue
        for (let k = gr.start; k < gr.start + gr.count; k++) esPico[g.index.getX(k)] = 1
      }
    }
    const original = Float32Array.from(pos.array)
    const cenida = Float32Array.from(pos.array)
    const p = new THREE.Vector3()
    for (const s of ['l', 'r']) {
      const brazo = new RegExp(`^(arm|forearm|hand).*${s}$`)
      const esBrazo = nombres.map((n) => brazo.test(n))
      const lado = []
      for (let i = 0; i < pos.count; i++) {
        let w = 0
        for (let c = 0; c < 4; c++) if (esBrazo[si.getComponent(i, c)]) w += sw.getComponent(i, c)
        if (w < 0.5) continue
        p.fromBufferAttribute(pos, i).applyMatrix4(marcos[s].inv)
        lado.push([i, p.x, p.y, p.z])
      }
      const yLleno = CINE.y0 - CINE.lleno
      let rmax = 0
      for (const [i, x, y, z] of lado) if (y >= yLleno && !esPico[i]) rmax = Math.max(rmax, Math.hypot(x, z))
      if (rmax <= CINE.fuera) continue
      const k = (CINE.fuera - CINE.dentro) / (rmax - CINE.dentro)
      for (const [i, x, y, z] of lado) {
        const w = suave(CINE.y0 - CINE.desde, yLleno, y) * (1 - suave(CINE.y1 + CINE.suelta[0], CINE.y1 + CINE.suelta[1], y))
        const r = Math.hypot(x, z)
        if (w <= 0 || r <= CINE.dentro) continue
        const r2 = Math.min(CINE.dentro + (r - CINE.dentro) * k, CINE.fuera)
        const f = (r + w * (r2 - r)) / r
        p.set(x * f, y, z * f).applyMatrix4(marcos[s].marco)
        cenida[i * 3] = p.x; cenida[i * 3 + 1] = p.y; cenida[i * 3 + 2] = p.z
      }
    }
    g.userData.posOriginal = original
    g.userData.posCenida = cenida
    g.userData.cenida = false
  }
  const todas = []
  escena.traverse((o) => { if (o.isSkinnedMesh && o.geometry?.userData?.posCenida && !todas.some((t) => t.geometry === o.geometry)) todas.push(o) })
  escena.userData.cenirMangas = (estado) => {
    for (const m of todas) {
      const quiere = !!estado?.munequeras && !!estado?.[m.userData.accesorio]
      const g = m.geometry
      if (g.userData.cenida === quiere) continue
      g.attributes.position.array.set(quiere ? g.userData.posCenida : g.userData.posOriginal)
      g.attributes.position.needsUpdate = true
      g.userData.cenida = quiere
    }
  }
}

// ---------------------------------------------------------------------------
// Pantalones de mezclilla (Oscar, 2026-11-18): grises deslavados, rectos, rotos
// de las rodillas con hilos blancos, la cintura pegada a la pelvis y dos vueltas
// de rollo arriba de las botas. Salen de scripts/skulley-anim/pantalones.py con
// la textura deslavada en el GLB (JPEG). Van con la pelvis (y su spine_01), los
// muslos, las espinillas y prop_cadera: el hueso del .blend que gira la mitad
// que el muslo, en la ingle, para que la tela no se aplaste al subir la pierna.
// El personaje no lo trae; aquí es un hueso que calcula su matriz cada vez que
// se actualiza la del muslo (HuesoMitad), así que Player, el retrato y el rig lo
// tienen sin código por cuadro. Repartido mitad pelvis, mitad muslo (como los
// bóxers en la GPU) la tela de la ingle se metía: con la rodilla arriba, la
// mezcla lineal de dos giros corta por dentro del arco. Se excluyen con los
// bóxers (no caben debajo).
// ---------------------------------------------------------------------------

const MATERIALES_PANTALONES = {
  // el gris deslavado, las costuras, las bolsas y lo deshilachado del roto los pone la textura
  Pantalones_Mezclilla: { color: 0xffffff, roughness: 0.85, metalness: 0 },
  // el revés de la mezclilla: adentro y los rollos de la bastilla
  Pantalones_Forro: { color: 0xb0b2b6, roughness: 0.9, metalness: 0 },
  // canto del roto e hilos atravesados
  Pantalones_Hilos: { color: 0xf0eee6, roughness: 0.9, metalness: 0 },
  // botón y remaches, plateados de caricatura (con metalness 1 y sin reflejo salen negros)
  Pantalones_Metal: { color: 0xd4d8de, roughness: 0.3, metalness: 0 },
}

const IDENTIDAD = new THREE.Quaternion()

/**
 * prop_cadera del .blend (Copy Transforms 0.5 del thigh_twist): cada vez que se
 * actualiza, su matriz es la de la pelvis más la mitad del giro del muslo
 * respecto a ella, alrededor de la articulación de la cadera. Su reposo es la
 * identidad en el espacio de la escena del personaje (ponerPrenda le saca a
 * cada hueso su reposo de matrixWorld). Va colgado del muslo para que se
 * actualice después de él.
 */
class HuesoMitad extends THREE.Bone {
  constructor(pelvis, muslo, raizInv) {
    super()
    // un clon (Object3D.clone llama al constructor sin nada) se queda como hueso normal
    if (!pelvis || !muslo) return
    this.pelvis = pelvis
    this.muslo = muslo
    this.invPelvis = new THREE.Matrix4().multiplyMatrices(raizInv, pelvis.matrixWorld).invert()
    const reposoMuslo = new THREE.Matrix4().multiplyMatrices(raizInv, muslo.matrixWorld)
    this.invMuslo = reposoMuslo.clone().invert()
    this.pivote = new THREE.Vector3().setFromMatrixPosition(reposoMuslo)
    this.matrixAutoUpdate = false
    this._a = new THREE.Matrix4(); this._b = new THREE.Matrix4(); this._h = new THREE.Matrix4()
    this._t = new THREE.Vector3(); this._s = new THREE.Vector3(); this._r = new THREE.Vector3()
    this._q = new THREE.Quaternion()
  }

  calcular() {
    // lo que se movieron la pelvis y el muslo desde el reposo (del reposo de la escena al mundo)
    const sp = this._a.multiplyMatrices(this.pelvis.matrixWorld, this.invPelvis)
    const sm = this._b.multiplyMatrices(this.muslo.matrixWorld, this.invMuslo)
    // el muslo respecto a la pelvis, en el reposo de la escena: un giro alrededor de la cadera
    const d = this._h.copy(sp).invert().multiply(sm)
    d.decompose(this._t, this._q, this._s)
    this._r.copy(this.pivote).applyMatrix4(d).sub(this.pivote).multiplyScalar(0.5)   // lo que se corrió la cadera, a la mitad
    // (slerpQuaternions(IDENTIDAD, this._q) no: copia la identidad encima de this._q antes de mezclar)
    this._q.slerp(IDENTIDAD, 0.5)
    // h(x) = q½ (x − c) + c + r/2
    d.makeRotationFromQuaternion(this._q)
    this._t.copy(this.pivote).applyQuaternion(this._q).negate().add(this.pivote).add(this._r)
    d.setPosition(this._t)
    this.matrixWorld.multiplyMatrices(sp, d)
  }

  updateMatrixWorld(force) {
    if (!this.pelvis) return super.updateMatrixWorld(force)
    this.calcular()
    for (const c of this.children) c.updateMatrixWorld(force)
  }

  updateWorldMatrix(padres, hijos) {
    if (!this.pelvis) return super.updateWorldMatrix(padres, hijos)
    if (padres && this.parent) this.parent.updateWorldMatrix(true, false)
    this.calcular()
    if (hijos) for (const c of this.children) c.updateWorldMatrix(false, true)
  }
}

/** Arma prop_caderal y prop_caderar (los nombres que les deja GLTFLoader) colgados de cada muslo. */
function huesosCadera(porNombre, raizInv) {
  const pelvis = porNombre.rootx
  if (!pelvis) return
  for (const s of ['l', 'r']) {
    const nombre = `prop_cadera${s}`
    const muslo = porNombre[`thigh_twist${s}`]
    if (porNombre[nombre] || !muslo) continue
    const h = new HuesoMitad(pelvis, muslo, raizInv)
    h.name = nombre
    muslo.add(h)
    h.calcular()
    porNombre[nombre] = h
  }
}

const PANTALONES = {
  id: 'pantalones', malla: 'Egg_Pantalones', materiales: MATERIALES_PANTALONES, mapa: ['Pantalones_Mezclilla'],
  huesos: huesosCadera,
  orden: ['Pantalones_Mezclilla', 'Pantalones_Forro', 'Pantalones_Hilos', 'Pantalones_Metal'],
}

/** Los pantalones como `Egg_Pantalones`. */
export function ponerPantalones(escena, gltf) {
  return ponerPrenda(escena, gltf, PANTALONES)
}

/**
 * Opciones de telaSuelta para los pantalones despiezados: como las prendas,
 * simula la mezclilla de afuera; el revés, los rollos, la pretina, los hilos y
 * el metal la siguen como piel.
 */
export function opcionesTelaPantalones(mesh) {
  return opcionesTela(mesh, 'Pantalones_Mezclilla')
}

// ---------------------------------------------------------------------------
// Beanie (Oscar, 2026-11-18): largo, de tejido negro, con la copa aguada que
// cae hacia atrás, el dobladillo enrollado y una etiqueta blanca con
// SKULLEYRAD en SKULLEYGLYPH. Sale de scripts/skulley-anim/beanie.py, todo en
// head.x: va rígido con la cabeza, igual que el cráneo y los lentes, así que lo
// que libra en reposo libra en cualquier animación. Las costillas del tejido y
// la etiqueta son texturas del GLB. El mohawk no cabe: se oculta mientras va
// puesto (Oscar escogió esconderlo), con `ocultaCon` en la malla del pelo, como
// los pies con los tenis; con la skin Inferno, el pelo escondido no arde.
// ---------------------------------------------------------------------------

const MATERIALES_BEANIE = {
  // el negro y las costillas los pone la textura
  Beanie_Tejido: { color: 0xffffff, roughness: 0.95, metalness: 0 },
  Beanie_Dobladillo: { color: 0xffffff, roughness: 0.95, metalness: 0 },
  Beanie_Etiqueta: { color: 0xffffff, roughness: 0.8, metalness: 0 },
}
const BEANIE = {
  id: 'beanie', malla: 'Egg_Beanie', materiales: MATERIALES_BEANIE,
  mapa: ['Beanie_Tejido', 'Beanie_Dobladillo', 'Beanie_Etiqueta'],
  orden: ['Beanie_Tejido', 'Beanie_Dobladillo', 'Beanie_Etiqueta'],
}

/** El beanie como `Egg_Beanie`; la malla del pelo (material Hair) queda marcada para ocultarse con él. */
export function ponerBeanie(escena, gltf) {
  const hechos = ponerPrenda(escena, gltf, BEANIE)
  if (!hechos.length) return hechos
  escena.traverse((o) => {
    if (!o.isMesh || o.userData?.accesorio) return
    const mats = Array.isArray(o.material) ? o.material : [o.material]
    if (!mats.some((m) => /^Hair$/i.test(m?.name || ''))) return
    const antes = o.userData.ocultaCon
    const ids = Array.isArray(antes) ? antes : antes ? [antes] : []
    if (!ids.includes('beanie')) o.userData.ocultaCon = [...ids, 'beanie']
  })
  return hechos
}

/** Opciones de telaSuelta para el beanie despiezado: simula la copa; el dobladillo y la etiqueta la siguen como piel. */
export function opcionesTelaBeanie(mesh) {
  return opcionesTela(mesh, 'Beanie_Tejido')
}
