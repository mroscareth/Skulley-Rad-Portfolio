import * as THREE from 'three'

// Despiece de Skulley en piezas rígidas, agrupadas por hueso.
//
// La REGLA de agrupado es la del desarme del juego (`limbOf` dentro de
// `splitGeometryByBoneGroups`, en Player.jsx): cráneo, mandíbula, dientes,
// ojos, párpados, cejas y pelo caen todos en un solo grupo 'head', y cada otro
// hueso es su propia pieza. Está copiada tal cual a propósito — es la decisión
// de diseño de cómo se parte el personaje y no se reinventa acá.
//
// Lo que SÍ cambia respecto del juego, y es necesario: allá el agrupado corre
// por malla, una a la vez. Como el GLB trae 33 mallas separadas (el cráneo, los
// ojos, las pupilas y el pelo son mallas distintas), el grupo 'head' de cada
// malla terminaba siendo una pieza aparte: coinciden en el sitio, pero caen
// cada una por su lado. Acá los grupos se juntan ENTRE mallas, así que la
// cabeza viaja entera —con ojos y pelo— como pidió Oscar (2026-10-29).
//
// NOTA DE DUPLICACIÓN: Player.jsx sigue teniendo su propia copia de esta
// lógica. Si cambia la regla de qué pertenece a la cabeza, hay que cambiarla en
// los dos lados. No se extrajo de Player.jsx para no abrir el archivo del juego
// en un trabajo de la versión de teléfono.

/**
 * Hueso → grupo. Port literal de `limbOf` en Player.jsx.
 *
 * Los `c_` son los huesos de control del rig (párpados, cejas, targets de los
 * ojos): todos son cara, así que entran a la cabeza.
 */
export function limbOf(name) {
  const n = (name || '').toLowerCase()
  if (!n) return 'bone:__unnamed__'
  if (
    n === 'headx' ||
    n.startsWith('c_') ||
    /^(head|skull|jaw|teeth|tongue|eye|brow|lip|lash|nose|ear|chin|hair|mohawk|crest|horn|mask|helmet|hat)/.test(n)
  ) return 'head'
  return `bone:${n}`
}

/**
 * El grupo que se usa acá: `limbOf` más dos reglas propias de esta versión.
 *
 * Una mano se va entera, con sus dedos, y un pie con los suyos. En
 * `limbOf` cada falange es su propio hueso y por tanto su propia pieza; en
 * escritorio eso no se ve porque el tope de 14 piezas deja fuera las
 * chiquitas, pero acá no hay tope (ver el final del archivo) y los dedos
 * salían volando sueltos. Pedido de Oscar (2026-10-29): los dedos no se
 * separan de las manos.
 *
 * Nombres del rig (Auto-Rig Pro, lado al final): `handl`, `index1_basel`,
 * `index1l`…`index3l`, `middle*`, `pinky*`, `thumb1l`…`thumb3l`; `footl`,
 * `toes_01l`. Igual con `r`.
 */
function grupoDe(name) {
  const n = (name || '').toLowerCase()
  const lado = n.slice(-1)
  if (lado === 'l' || lado === 'r') {
    if (/^(hand|thumb|index|middle|ring|pinky)/.test(n)) return `hand:${lado}`
    if (/^(foot|toes?)(_\d+)?[lr]$/.test(n)) return `foot:${lado}`
  }
  return limbOf(name)
}

/**
 * Congela un SkinnedMesh en su pose actual, en coordenadas de MUNDO.
 *
 * El detalle que no es opcional: el GLB usa KHR_mesh_quantization, así que
 * `position` viene como Int16 normalizado. Clonar la geometría y escribir
 * floats encima los trunca a 0/±1 y todas las piezas colapsan al origen. Por
 * eso el atributo se reemplaza por un Float32Array nuevo.
 *
 * Las normales se TRANSFORMAN con la matriz normal, no se recalculan:
 * computeVertexNormals devuelve normales de faceta y el banding toon las
 * convierte en parches oscuros.
 */
function bakeSkinned(mesh) {
  const srcGeo = mesh.geometry
  const srcPos = srcGeo?.attributes?.position
  if (!srcPos) return null

  try { mesh.skeleton?.update?.() } catch { }
  try { mesh.updateMatrixWorld(true) } catch { }

  const count = srcPos.count
  const mw = mesh.matrixWorld
  const geo = srcGeo.clone()
  try { geo.deleteAttribute('skinIndex') } catch { }
  try { geo.deleteAttribute('skinWeight') } catch { }

  const posArr = new Float32Array(count * 3)
  geo.setAttribute('position', new THREE.BufferAttribute(posArr, 3, false))

  const applyBone = typeof mesh.applyBoneTransform === 'function'
    ? mesh.applyBoneTransform.bind(mesh)
    : (typeof mesh.boneTransform === 'function' ? mesh.boneTransform.bind(mesh) : null)

  const v = new THREE.Vector3()
  for (let i = 0; i < count; i += 1) {
    v.fromBufferAttribute(srcPos, i)
    if (applyBone) applyBone(i, v)
    v.applyMatrix4(mw)
    posArr[i * 3 + 0] = v.x
    posArr[i * 3 + 1] = v.y
    posArr[i * 3 + 2] = v.z
  }

  const srcN = srcGeo.attributes?.normal
  if (srcN) {
    const nArr = new Float32Array(count * 3)
    const nm = new THREE.Matrix3().getNormalMatrix(mw)
    const n = new THREE.Vector3()
    for (let i = 0; i < count; i += 1) {
      n.fromBufferAttribute(srcN, i).applyMatrix3(nm).normalize()
      nArr[i * 3 + 0] = n.x
      nArr[i * 3 + 1] = n.y
      nArr[i * 3 + 2] = n.z
    }
    geo.setAttribute('normal', new THREE.BufferAttribute(nArr, 3, false))
  }
  return geo
}

/** Grupo de cada vértice: gana el hueso con más peso. Port de Player.jsx. */
function groupsPerVertex(mesh, bakedGeo) {
  const si = mesh.geometry?.getAttribute('skinIndex')
  const sw = mesh.geometry?.getAttribute('skinWeight')
  const bones = mesh.skeleton?.bones
  const pos = bakedGeo.getAttribute('position')
  if (!si || !sw || !bones?.length || !pos || si.count !== pos.count) return null

  const boneGroup = new Array(bones.length)
  for (let i = 0; i < bones.length; i += 1) boneGroup[i] = grupoDe(bones[i]?.name)

  const out = new Array(pos.count)
  for (let v = 0; v < pos.count; v += 1) {
    let best = -1, bestW = -1
    for (let k = 0; k < 4; k += 1) {
      const w = sw.getComponent(v, k)
      if (w > bestW) { bestW = w; best = si.getComponent(v, k) }
    }
    out[v] = (best >= 0 && best < boneGroup.length) ? boneGroup[best] : 'torso'
  }
  return out
}

/** Sub-geometría con los triángulos dados, reindexando los vértices. */
function subGeometry(bakedGeo, triIdx) {
  const attrs = bakedGeo.attributes || {}
  const oldToNew = new Map()
  const newIdx = new Uint32Array(triIdx.length)
  let n = 0
  for (let i = 0; i < triIdx.length; i += 1) {
    const old = triIdx[i]
    let nv = oldToNew.get(old)
    if (nv === undefined) { nv = n; oldToNew.set(old, n); n += 1 }
    newIdx[i] = nv
  }
  const dst = new THREE.BufferGeometry()
  Object.keys(attrs).forEach((k) => {
    if (k === 'skinIndex' || k === 'skinWeight') return
    const a = attrs[k]
    if (!a?.array || typeof a.itemSize !== 'number') return
    const Ctor = a.array.constructor
    const na = new Ctor(n * a.itemSize)
    for (const [o, d] of oldToNew.entries()) {
      for (let j = 0; j < a.itemSize; j += 1) na[d * a.itemSize + j] = a.array[o * a.itemSize + j]
    }
    dst.setAttribute(k, new THREE.BufferAttribute(na, a.itemSize, a.normalized))
  })
  dst.setIndex(new THREE.BufferAttribute(newIdx, 1))
  if (!dst.getAttribute('normal')) { try { dst.computeVertexNormals() } catch { } }
  return dst
}

/**
 * Despieza el personaje completo.
 *
 * Devuelve una lista de piezas; cada una es un THREE.Group que puede moverse y
 * girar como un cuerpo. La cabeza es UNA pieza aunque por dentro traiga varias
 * mallas (cráneo, ojos, pupilas, pelo), cada una con su material original.
 *
 * @param {THREE.Object3D} root raíz del personaje ya clonado y materializado
 * @returns {{ group: THREE.Group, home: THREE.Vector3, id: string }[]}
 */
export function bakeCharacterPieces(root) {
  if (!root) return []
  root.updateMatrixWorld(true)

  // Todas las mallas visibles, no solo las skinneadas. Egg_EnergyBall, la bola
  // de energía, es una malla normal sin skin: si solo se horneaban las
  // skinneadas, en el quiebre se escondía con el personaje entero y no volvía.
  // El desarme de escritorio también la mueve a las piezas (Player.jsx, "Non-
  // skinned path").
  const mallas = []
  root.traverse((o) => {
    if (!(o.isSkinnedMesh || o.isMesh) || o.visible === false) return
    mallas.push(o)
  })
  const skinned = mallas.filter((o) => o.isSkinnedMesh)
  if (!mallas.length) return []

  // groupId → [{ geo, material }], acumulado a través de TODAS las mallas.
  const porGrupo = new Map()
  // `nombre` es el de la malla original: con él la home encuentra la mandíbula
  // (Egg_Jaw) dentro de la cabeza para abrirla.
  const push = (id, geo, material, nombre = '') => {
    let arr = porGrupo.get(id)
    if (!arr) { arr = []; porGrupo.set(id, arr) }
    arr.push({ geo, material, nombre })
  }

  // SOLO se corta la malla más grande. Es la regla de `isPrimarySkinned` en
  // Player.jsx (la malla con más triángulos, y al menos 800).
  //
  // No es un detalle de rendimiento: cortar una malla por grupos de huesos la
  // abre: los triángulos del corte se van a otra pieza y quedan bordes
  // dentados y huecos, porque la geometría no tiene tapa ahí. En una malla
  // grande el corte cae dentro del cuerpo y no se nota; en las chicas —un
  // hueso suelto, los ojos, el pelo— la rompe a la vista. Por eso todas las
  // demás se quedan ENTERAS, cada una asignada al grupo de su hueso dominante.
  let best = null
  let bestTri = 0
  for (const m of skinned) {
    const idx = m.geometry?.getIndex()
    const tri = idx ? idx.count / 3 : (m.geometry?.getAttribute('position')?.count || 0) / 3
    if (tri > bestTri) { bestTri = tri; best = m }
  }

  for (const mesh of mallas) {
    // bakeSkinned también sirve para una malla normal: sin applyBoneTransform
    // solo la pasa a mundo con su matrixWorld.
    const baked = bakeSkinned(mesh)
    if (!baked) continue
    const mat = Array.isArray(mesh.material) ? (mesh.material[0] || mesh.material) : mesh.material

    const gpv = groupsPerVertex(mesh, baked)
    const idx = baked.getIndex()

    // Sin skinning utilizable o sin índice: la malla entera es una pieza, con
    // el grupo de su hueso dominante si se puede deducir.
    if (!gpv || !idx) {
      push(`mesh:${mesh.uuid}`, baked, mat, mesh.name)
      continue
    }

    if (mesh !== best || bestTri < 800) {
      // Malla entera, al grupo que tenga más vértices suyos. Así los ojos, las
      // pupilas y el pelo entran completos al grupo 'head' en vez de quedar
      // cortados entre varias piezas.
      const cuenta = new Map()
      for (let v = 0; v < gpv.length; v += 1) {
        cuenta.set(gpv[v], (cuenta.get(gpv[v]) || 0) + 1)
      }
      let dominante = `mesh:${mesh.uuid}`
      let maximo = -1
      cuenta.forEach((n, g) => { if (n > maximo) { maximo = n; dominante = g } })
      push(dominante, baked, mat, mesh.name)
      continue
    }

    // Triángulo al grupo que tenga 2 de 3 vértices (empate → el primero).
    const arr = idx.array
    const buckets = new Map()
    for (let t = 0; t < Math.floor(arr.length / 3); t += 1) {
      const a = arr[t * 3], b = arr[t * 3 + 1], c = arr[t * 3 + 2]
      const ga = gpv[a], gb = gpv[b], gc = gpv[c]
      const g = (ga === gb || ga === gc) ? ga : (gb === gc ? gb : ga)
      let bk = buckets.get(g)
      if (!bk) { bk = []; buckets.set(g, bk) }
      bk.push(a, b, c)
    }

    if (buckets.size <= 1) {
      // Toda la malla es un solo grupo: se empuja entera, sin reindexar.
      const only = buckets.keys().next().value ?? `mesh:${mesh.uuid}`
      push(only, baked, mat, mesh.name)
      continue
    }

    buckets.forEach((triIdx, groupId) => {
      if (triIdx.length < 3) return
      push(groupId, subGeometry(baked, triIdx), mat, mesh.name)
    })
  }

  // Cada grupo se vuelve un Group recentrado en su propio centro, para que gire
  // sobre sí mismo y no alrededor del origen del personaje.
  const piezas = []
  const box = new THREE.Box3()
  const center = new THREE.Vector3()

  porGrupo.forEach((partes, id) => {
    if (!partes.length) return
    box.makeEmpty()
    for (const p of partes) {
      p.geo.computeBoundingBox()
      if (p.geo.boundingBox) box.union(p.geo.boundingBox)
    }
    if (box.isEmpty()) return
    box.getCenter(center)

    const group = new THREE.Group()
    for (const p of partes) {
      p.geo.translate(-center.x, -center.y, -center.z)
      try { p.geo.computeBoundingSphere() } catch { }
      const m = new THREE.Mesh(p.geo, p.material)
      m.name = p.nombre
      m.frustumCulled = false
      // Para que el pase de normales las entinte igual que al personaje.
      // En userData, que es donde lo buscan CharacterNormalPass (ink lines),
      // SilhouetteShadow (sombra) y el desarme de Player.jsx. Como propiedad
      // suelta de la malla ninguno de los tres la reconocía como pieza.
      m.userData.__disassembleOwned = true
      group.add(m)
    }
    group.position.copy(center)
    piezas.push({ group, home: center.clone(), id })
  })

  // Sin tope de piezas, a propósito (decisión de Oscar, 2026-10-29).
  //
  // El desarme de escritorio se queda con las 14 más grandes (TARGET_PIECES en
  // Player.jsx) y acá se probó igual, primero descartando el resto y luego
  // fusionándolo a la pieza más cercana. Las dos fallaron: descartando, los
  // brazos desaparecían; fusionando, la mano se iba pegada a otro bloque y el
  // antebrazo quedaba con la muñeca hueca. En escritorio el desarme dura dos
  // segundos y nadie lo nota; acá el personaje está en pantalla todo el scroll.
  //
  // Lo que de verdad causaba el "costilla por costilla" no era la cantidad
  // sino cortar todas las mallas (ver la regla de la malla grande arriba).
  // Con las mallas chicas enteras, cada pieza es un hueso limpio y no hace
  // falta recortar nada.
  return piezas
}

export default bakeCharacterPieces
