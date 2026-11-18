import * as THREE from 'three'

// Con los bóxers puestos, las manos no los atraviesan (Oscar, 2026-11-16).
// Al caminar el clip pasa las manos rozando la cadera (a 12 cm del centro,
// más adentro que la pelvis) y se metían hasta 9.6 cm en la tela; en el idle
// la derecha, 2.8 cm. Esto es una capa después del mixer y de las poses
// (patada, láser): mide qué tanto entra cada mano en el volumen de los bóxers
// y abre el brazo desde el hombro (arm_stretch, que lleva consigo los huesos
// de giro, el antebrazo y la mano) justo lo necesario. Es continua (empuja lo
// que se mete, sin mínimo fijo). Abrirse de golpe en cada paso se veía como
// brinco (Oscar): abre en unos cuadros (ABRE_S), con unos centímetros de
// anticipación para que eso no deje pasar la mano (MARGEN), y sostiene la
// apertura casi un segundo (SOSTIENE_S): caminando se queda abierto parejo.
//
// El volumen vive en el reposo de cada hueso (metros, y hacia arriba, el
// frente en +z): un elipse de cadera en la pelvis y un cilindro por pierna en
// cada muslo, del tamaño de los bóxers ya holgados.

// Medido sobre la tela en reposo: cadera ±0.2195 de ancho, frente 0.187 y
// atrás 0.201 desde su centro; pierna 0.12–0.13 del eje del muslo.
const CADERA = { y0: 0.57, y1: 0.75, A: 0.2195, Bf: 0.187, Bb: 0.201, cz: -0.004 }
const PIERNA = { r: 0.125, tMax: 0.72 }
const VOL_BOXERS = { cadera: CADERA, pierna: PIERNA }
// Con los pantalones (2026-11-18), su volumen: más angosto que el de los bóxers. Medido en reposo sobre la
// tela (pantalones.py): cadera ±0.192 de la entrepierna a la pretina, frente y atrás 0.162 desde su centro;
// pierna 0.085 del eje del muslo (el tubo recto mide 0.076 de ancho y 0.08 de fondo) hasta la rodilla. En
// Blender, caminando, las manos se metían hasta 7.3 cm.
const VOL_PANTALONES = { cadera: { y0: 0.57, y1: 0.735, A: 0.192, Bf: 0.162, Bb: 0.162, cz: -0.006 }, pierna: { r: 0.085, tMax: 1.0 } }
const MARGEN = 0.014
const ABRE_S = 0.07
const SOSTIENE_S = 0.9
const ITER = 3

const DEDOS = ['index', 'middle', 'pinky', 'thumb']

// Con la chamarra (Oscar, 2026-11-17): los clips pasan los brazos casi pegados
// al torso (se hicieron para el esqueleto sin ropa) y la manga se metía en el
// costado; caminando, el brazo derecho pedía hasta 20° (el clip lo lleva más
// pegado que el izquierdo, que pide 8) y en el idle 13°; corriendo, nada.
// Se mide con vértices reales de la chamarra: la cara de la manga que mira al
// cuerpo contra el costado del torso (distancia a lo largo de su normal). Las
// muestras se escogen en reposo, en metros, igual que el prototipo con que se
// validó en Blender (scripts/skulley-anim): con esto la manga dejó de cruzar
// el costado en todos los cuadros de idle, caminar y correr.
const MANGA = {
  margen: 0.006,       // la manga se queda a 6 mm del costado
  cerca: 0.07,         // más lejos que esto del costado no cuenta
  union: 0.03,         // en reposo, a menos de esto del torso es la axila (unida), no se mide
  brazoMin: 0.9,       // peso de huesos del brazo para ser manga
  torsoMax: 0.15,      // y para ser torso
  torsoX: 0.09, torsoY: [0.70, 1.22],
  mangaX: 0.15,
  nManga: 60, nTorso: 320,
}

// El hoodie (2026-11-17) va igual, con su tela de afuera: en Blender pedía caminando 15° el brazo izquierdo
// y 21° el derecho, en el idle 3° y 6° y corriendo 3° en cuatro cuadros (hoodie.py, apertura_necesaria).
// La inflada (2026-11-17) igual: caminando 18° y 21°, en el idle 3° y 15° y corriendo 3° (inflada.py).

// Las muñequeras de picos (2026-11-18). Llevan picos en toda la vuelta (Oscar), y el cuerpo pasa por el
// lado de la palma y del pulgar a ~10 cm del eje del antebrazo caminando: sin ropa también hay que abrir.
// Contra el cuerpo se mide al revés que las mangas: puntos reales de las piezas del cuerpo (tórax, pelvis y
// piernas) contra el perfil de la muñequera en el marco de forearm_twist (el radio
// más lejano del aro y de los picos por ángulo, sacado de su malla), y sale hacia afuera del eje. Con ropa,
// su orilla de afuera (aro y picos) se mide además contra el volumen de los bóxers o de los pantalones, como
// las manos, y contra el costado de la chamarra hasta la bastilla (z 61–73 cm cruzaba caminando; el costado
// de las mangas empieza en 0.70 m). Lo que pedía en Blender, en revisar_munequeras.py (apertura_necesaria).
const MUNEQUERA = {
  costadoY: [0.55, 1.22],  // costado de la prenda que se mide contra la muñequera (m)
  nCostado: 360,
  rMin: 0.085,             // de su orilla de afuera: más lejos que esto del eje del antebrazo (m)
  sectores: 36,            // una muestra por sector y tercio (la más lejana del eje)
  bins: 180,               // perfil: radio más lejano por ángulo alrededor del eje (2° cada uno)
  margen: 0.015,           // el cuerpo se queda a 1.5 cm: la apertura va unos cuadros atrás (con 1.2, a 144 Hz se metía 3 mm)
  // tórax, pelvis y piernas (la cabeza y los pies no le quedan cerca)
  huesosCuerpo: /^(spine|root|thigh|leg|neck)/,
  rejilla: 0.005,          // vértices del cuerpo a menos de esto cuentan como uno (m)
  racimo: 0.03,            // tamaño de los racimos con que se descartan (m)
  tope: 0.5,               // lo más que abren (rad)
}

/** Muestras de una prenda (chamarra, hoodie) para el apartado: por lado, manga que mira al cuerpo y costado del torso. */
function muestrasPrenda(escena, id, material) {
  let sm = null
  escena.traverse((o) => { if (!sm && o.isSkinnedMesh && o.userData?.accesorio === id) sm = o })
  if (!sm) return null
  const g = sm.geometry
  const pos = g.attributes.position, nor = g.attributes.normal
  const si = g.attributes.skinIndex, sw = g.attributes.skinWeight
  const huesos = sm.skeleton.bones
  const esBrazo = huesos.map((b) => /^(fore)?arm_/.test(b.name))
  // la cara de afuera: el grupo de su material de afuera
  const piel = new Set()
  const idx = g.index
  for (const gr of g.groups) {
    const m = Array.isArray(sm.material) ? sm.material[gr.materialIndex] : sm.material
    if (m?.name !== material) continue
    for (let k = gr.start; k < gr.start + gr.count; k++) piel.add(idx ? idx.getX(k) : k)
  }
  const brazo = (i) => {
    let s = 0
    for (let c = 0; c < 4; c++) if (esBrazo[si.getComponent(i, c)]) s += sw.getComponent(i, c)
    return s
  }
  const muestra = (i) => ({
    i,
    p: new THREE.Vector3().fromBufferAttribute(pos, i),
    n: new THREE.Vector3().fromBufferAttribute(nor, i),
    h: [0, 1, 2, 3].map((c) => si.getComponent(i, c)),
    w: [0, 1, 2, 3].map((c) => sw.getComponent(i, c)),
    // se mueve con el brazo (la axila): hay que recalcularla al abrirlo
    mueve: brazo(i) > 1e-4,
  })
  const espaciar = (lista, n) => {
    lista.sort((a, b) => a - b)
    const paso = Math.max(1, Math.floor(lista.length / n))
    return lista.filter((_, k) => k % paso === 0)
  }
  const lados = {}
  for (const [lado, s] of [['l', 1], ['r', -1]]) {
    let torso = []
    for (const i of piel) {
      const x = pos.getX(i) * s, y = pos.getY(i)
      if (x >= MANGA.torsoX && y >= MANGA.torsoY[0] && y <= MANGA.torsoY[1] && brazo(i) <= MANGA.torsoMax) torso.push(i)
    }
    torso = espaciar(torso, MANGA.nTorso).map(muestra)
    let manga = []
    const p = new THREE.Vector3()
    for (const i of piel) {
      if (pos.getX(i) * s < MANGA.mangaX || nor.getX(i) * s > -0.15 || brazo(i) < MANGA.brazoMin) continue
      p.fromBufferAttribute(pos, i)
      let d2 = Infinity
      for (const t of torso) d2 = Math.min(d2, p.distanceToSquared(t.p))
      if (d2 < MANGA.union * MANGA.union) continue
      manga.push(i)
    }
    manga = espaciar(manga, MANGA.nManga).map(muestra)
    let costado = []
    for (const i of piel) {
      const x = pos.getX(i) * s, y = pos.getY(i)
      if (x >= MANGA.torsoX && y >= MUNEQUERA.costadoY[0] && y <= MUNEQUERA.costadoY[1] && brazo(i) <= MANGA.torsoMax) costado.push(i)
    }
    costado = espaciar(costado, MUNEQUERA.nCostado).map(muestra)
    lados[lado] = { torso, manga, costado }
  }
  return { sm, huesos, lados, M: huesos.map(() => new THREE.Matrix4()) }
}

/**
 * El marco de un hueso en reposo sin su escala: el esqueleto de character.glb va en otras unidades que la
 * escena (×100), y en su marco tal cual un margen de 6 mm salía de 60 cm. Con este, las medidas quedan en
 * metros de la escena. `post` lleva del reposo del hueso a este marco: en cada cuadro, hueso · post.
 */
function marcoSinEscala(reposo) {
  const t = new THREE.Vector3(), q = new THREE.Quaternion(), e = new THREE.Vector3()
  reposo.decompose(t, q, e)
  const marco = new THREE.Matrix4().compose(t, q, new THREE.Vector3(1, 1, 1))
  return { inv: marco.clone().invert(), post: reposo.clone().invert().multiply(marco) }
}

/**
 * Muestras de la orilla de afuera de una muñequera (aro y picos): en el marco del hueso forearm_twist en
 * reposo, por sector alrededor del eje y tercio a lo largo de él, el vértice más lejano del eje.
 */
function muestrasMunequera(escena, s, B, reposoDe) {
  let sm = null
  const nombre = `Egg_Munequera${s.toUpperCase()}`
  escena.traverse((o) => { if (!sm && o.isSkinnedMesh && o.name === nombre) sm = o })
  const hueso = B[`forearm_twist${s}`]
  if (!sm || !hueso) return null
  const { inv } = marcoSinEscala(reposoDe(hueso))
  const pos = sm.geometry.attributes.position
  const p = new THREE.Vector3()
  const loc = []
  let y0 = Infinity, y1 = -Infinity
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i).applyMatrix4(inv)
    loc.push([p.y, Math.hypot(p.x, p.z), Math.atan2(p.z, p.x)])
    y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y)
  }
  const mejor = new Map()
  for (let i = 0; i < loc.length; i++) {
    const [y, r, a] = loc[i]
    if (r < MUNEQUERA.rMin) continue
    const sec = Math.min(MUNEQUERA.sectores - 1, Math.floor((a + Math.PI) / (2 * Math.PI) * MUNEQUERA.sectores))
    const ter = Math.min(2, Math.floor((y - y0) / Math.max(1e-6, y1 - y0) * 3))
    const k = sec * 3 + ter
    const m = mejor.get(k)
    if (!m || r > loc[m][1]) mejor.set(k, i)
  }
  return { malla: sm, idx: [...mejor.values()] }
}

/**
 * Perfil de una muñequera en el marco de forearm_twist en reposo: el radio más lejano del eje por ángulo,
 * del aro (lo que está en las caras de las placas) y de los picos (lo que sale más allá del aro), con el
 * rango a lo largo del eje de cada uno. Cada ángulo toma el máximo de sus vecinos.
 */
function perfilMunequera(escena, s, B, reposoDe) {
  let sm = null
  const nombre = `Egg_Munequera${s.toUpperCase()}`
  escena.traverse((o) => { if (!sm && o.isSkinnedMesh && o.name === nombre) sm = o })
  const hueso = B[`forearm_twist${s}`]
  if (!sm || !hueso) return null
  const { inv, post } = marcoSinEscala(reposoDe(hueso))
  const pos = sm.geometry.attributes.position
  const N = MUNEQUERA.bins
  const p = new THREE.Vector3()
  const loc = []
  let y0 = Infinity, y1 = -Infinity
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i).applyMatrix4(inv)
    const r = Math.hypot(p.x, p.z)
    const b = Math.min(N - 1, Math.floor((Math.atan2(p.z, p.x) + Math.PI) / (2 * Math.PI) * N))
    loc.push([p.y, r, b])
    y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y)
  }
  const placa = (y1 - y0) * 0.3
  const aro = new Float32Array(N), pico = new Float32Array(N)
  for (const [y, r, b] of loc) if (y < y0 + placa || y > y1 - placa) aro[b] = Math.max(aro[b], r)
  let ys0 = Infinity, ys1 = -Infinity, rmax = 0
  for (const [y, r, b] of loc) {
    rmax = Math.max(rmax, r)
    if (r > aro[b] + 0.002) { pico[b] = Math.max(pico[b], r); ys0 = Math.min(ys0, y); ys1 = Math.max(ys1, y) }
  }
  const dilata = (a) => Float32Array.from(a, (_, k) => Math.max(a[(k + N - 1) % N], a[k], a[(k + 1) % N]))
  return {
    hueso, post, aro: dilata(aro), pico: dilata(pico), y0, y1, ys0, ys1, N,
    centro: new THREE.Vector3(0, (y0 + y1) / 2, 0), radio: Math.hypot(rmax, (y1 - y0) / 2),
  }
}

/**
 * Puntos de las piezas del cuerpo (sin brazos ni props), cada uno pegado a su hueso dominante: en cada
 * cuadro, hueso · posición en su reposo. Son todos los vértices (los repetidos a menos de `rejilla`, uno):
 * con una muestra la punta de un pico, que es angosta, se colaba entre puntos hasta 1.7 cm. Por hueso, en
 * racimos de `racimo` con su esfera, para descartar sin revisar sus puntos lo que queda lejos.
 */
function muestrasCuerpo(escena, reposoDe) {
  const mallas = []
  escena.traverse((o) => {
    if (!o.isSkinnedMesh || o.userData?.accesorio || /_outline$/.test(o.name || '') || !o.geometry?.attributes?.skinIndex) return
    mallas.push(o)
  })
  const raizInv = new THREE.Matrix4().copy(escena.matrixWorld).invert()
  const porHueso = new Map()
  const p = new THREE.Vector3()
  const R = MUNEQUERA.rejilla, C = MUNEQUERA.racimo
  for (const m of mallas) {
    const si = m.geometry.attributes.skinIndex, sw = m.geometry.attributes.skinWeight
    for (let i = 0; i < si.count; i++) {
      let mejor = 0, w = -1
      for (let c = 0; c < 4; c++) { const ww = sw.getComponent(i, c); if (ww > w) { w = ww; mejor = si.getComponent(i, c) } }
      const b = m.skeleton.bones[mejor]
      if (!b || !MUNEQUERA.huesosCuerpo.test(b.name)) continue
      if (!porHueso.has(b)) porHueso.set(b, { hueso: b, ...marcoSinEscala(reposoDe(b)), celdas: new Map() })
      const g = porHueso.get(b)
      m.getVertexPosition(i, p).applyMatrix4(m.matrixWorld).applyMatrix4(raizInv).applyMatrix4(g.inv)
      if (!Number.isFinite(p.x)) continue
      const llave = `${Math.round(p.x / R)},${Math.round(p.y / R)},${Math.round(p.z / R)}`
      if (!g.celdas.has(llave)) g.celdas.set(llave, [p.x, p.y, p.z])
    }
  }
  const grupos = []
  for (const g of porHueso.values()) {
    const porRacimo = new Map()
    for (const q of g.celdas.values()) {
      const llave = `${Math.floor(q[0] / C)},${Math.floor(q[1] / C)},${Math.floor(q[2] / C)}`
      if (!porRacimo.has(llave)) porRacimo.set(llave, [])
      porRacimo.get(llave).push(q)
    }
    const local = [], racimos = []
    const centro = new THREE.Vector3(), cr = new THREE.Vector3()
    let n = 0
    for (const lista of porRacimo.values()) {
      cr.set(0, 0, 0)
      for (const q of lista) { cr.x += q[0]; cr.y += q[1]; cr.z += q[2] }
      cr.multiplyScalar(1 / lista.length)
      let r = 0
      for (const q of lista) r = Math.max(r, Math.hypot(q[0] - cr.x, q[1] - cr.y, q[2] - cr.z))
      racimos.push(cr.x, cr.y, cr.z, r, local.length, local.length + lista.length * 3)
      for (const q of lista) { local.push(q[0], q[1], q[2]); centro.x += q[0]; centro.y += q[1]; centro.z += q[2]; n++ }
    }
    if (!n) continue
    centro.multiplyScalar(1 / n)
    let radio = 0
    for (let k = 0; k < racimos.length; k += 6) radio = Math.max(radio, Math.hypot(racimos[k] - centro.x, racimos[k + 1] - centro.y, racimos[k + 2] - centro.z) + racimos[k + 3])
    grupos.push({ hueso: g.hueso, post: g.post, local: Float32Array.from(local), racimos: Float32Array.from(racimos), centro, radio })
  }
  return grupos
}

export function crearApartaManos(escena, reposoDe) {
  const B = {}
  escena.traverse((o) => { if (o.isBone) B[o.name] = o })
  if (!B.rootx || !B.thigh_twistl || !B.thigh_twistr || !B.arm_stretchl || !B.arm_stretchr) return null
  const R = {
    raiz: reposoDe(B.rootx).invert(),
    musloL: reposoDe(B.thigh_twistl).invert(),
    musloR: reposoDe(B.thigh_twistr).invert(),
  }
  const cadera = [B.thigh_twistl, B.thigh_twistr].map((b) => new THREE.Vector3().setFromMatrixPosition(reposoDe(b)))
  const rodilla = ['leg_stretchl', 'leg_stretchr'].map((n, k) => {
    const b = B[n]
    if (!b) return cadera[k].clone().add(new THREE.Vector3(0, -0.244, 0.082))
    return new THREE.Vector3().setFromMatrixPosition(reposoDe(b))
  })
  const lados = ['l', 'r'].map((s) => {
    const puntos = []
    const h = B[`hand${s}`]
    if (h) puntos.push({ a: h, r: 0.045 })
    for (const d of DEDOS) {
      const cadena = [1, 2, 3].map((k) => B[`${d}${k}${s}`]).filter(Boolean)
      cadena.forEach((b) => puntos.push({ a: b, r: d === 'thumb' ? 0.024 : 0.022 }))
      if (cadena.length >= 2) puntos.push({ a: cadena[cadena.length - 1], b: cadena[cadena.length - 2], r: 0.02 })
      if (h && cadena[0]) puntos.push({ a: h, b: cadena[0], mitad: true, r: 0.045 })
    }
    if (B[`forearm_twist${s}`]) puntos.push({ a: B[`forearm_twist${s}`], r: 0.038 })
    // Vértices reales de la mano (las piezas de character.glb de mano y dedos):
    // con esferas en las articulaciones el volumen salía grueso y al correr
    // abría los brazos 44° sin que las manos tocaran la tela.
    const muestras = []
    escena.traverse((o) => {
      const si = o.isSkinnedMesh && o.geometry?.attributes?.skinIndex
      if (!si || o.userData?.accesorio) return
      const b = o.skeleton?.bones?.[si.getX(0)]
      const m = b && /^(hand|index|middle|pinky|thumb)\d*(?:_base)?([lr])$/.exec(b.name)
      if (m && m[2] === s) muestras.push(o)
    })
    const total = muestras.reduce((a, o) => a + o.geometry.attributes.position.count, 0)
    const paso = Math.max(1, Math.ceil(total / 90))
    const vertices = muestras.map((o) => {
      const n = o.geometry.attributes.position.count
      const idx = []
      for (let i = 0; i < n; i += paso) idx.push(i)
      return { malla: o, idx }
    })
    return { s, brazo: B[`arm_stretch${s}`], puntos, vertices, crudo: new THREE.Quaternion(), rv: new THREE.Vector3(), sostiene: new THREE.Vector3(), necesita: 0, tieneCrudo: false }
  })

  for (const lado of lados) {
    lado.munequera = muestrasMunequera(escena, lado.s, B, reposoDe)
    lado.perfil = perfilMunequera(escena, lado.s, B, reposoDe)
  }
  const cuerpo = lados.some((l) => l.perfil) ? muestrasCuerpo(escena, reposoDe) : []

  const prendas = {
    chamarra: muestrasPrenda(escena, 'chamarra', 'Chamarra_Piel'),
    hoodie: muestrasPrenda(escena, 'hoodie', 'Hoodie_Tela'),
    inflada: muestrasPrenda(escena, 'inflada', 'Inflada_Tela'),
  }
  const M = { raiz: new THREE.Matrix4(), l: new THREE.Matrix4(), r: new THREE.Matrix4() }
  const Mi = { raiz: new THREE.Matrix4(), l: new THREE.Matrix4(), r: new THREE.Matrix4() }
  const p = new THREE.Vector3(), q = new THREE.Vector3(), u = new THREE.Vector3(), n = new THREE.Vector3()
  const eAx = new THREE.Vector3(), ePt = new THREE.Vector3(), eDir = new THREE.Vector3()
  const hombro = new THREE.Vector3(), eje = new THREE.Vector3(), mejorN = new THREE.Vector3(), mejorP = new THREE.Vector3()
  const qa = new THREE.Quaternion(), qp = new THREE.Quaternion(), qw = new THREE.Quaternion()

  const matrices = () => {
    M.raiz.multiplyMatrices(B.rootx.matrixWorld, R.raiz); Mi.raiz.copy(M.raiz).invert()
    M.l.multiplyMatrices(B.thigh_twistl.matrixWorld, R.musloL); Mi.l.copy(M.l).invert()
    M.r.multiplyMatrices(B.thigh_twistr.matrixWorld, R.musloR); Mi.r.copy(M.r).invert()
  }

  // Lo más que se mete una esfera (centro en mundo, radio en metros) en el volumen (bóxers o pantalones) y hacia dónde salir.
  const hondura = (c, rad, esc, salida, vol = VOL_BOXERS) => {
    const CADERA = vol.cadera, PIERNA = vol.pierna
    let peor = 0
    const rr = rad + MARGEN
    u.copy(c).applyMatrix4(Mi.raiz)
    if (u.y > CADERA.y0 - rr && u.y < CADERA.y1 + rr) {
      const dz = u.z - CADERA.cz
      const Bz = dz > 0 ? CADERA.Bf : CADERA.Bb
      const s = Math.sqrt((u.x / CADERA.A) ** 2 + (dz / Bz) ** 2)
      const rp = Math.hypot(u.x, dz)
      if (s > 1e-4) {
        const d = rp / s + rr - rp
        if (d > peor) {
          peor = d
          salida.set(u.x / (CADERA.A * CADERA.A), 0, dz / (Bz * Bz)).normalize().transformDirection(M.raiz)
        }
      }
    }
    for (let k = 0; k < 2; k++) {
      const Mk = k ? M.r : M.l, Mik = k ? Mi.r : Mi.l
      u.copy(c).applyMatrix4(Mik)
      const a = cadera[k], b = rodilla[k]
      eAx.subVectors(b, a)
      const L2 = eAx.lengthSq()
      const t = ((u.x - a.x) * eAx.x + (u.y - a.y) * eAx.y + (u.z - a.z) * eAx.z) / L2
      if (t < 0 || t > PIERNA.tMax) continue
      ePt.copy(a).addScaledVector(eAx, t)
      eDir.subVectors(u, ePt)
      const dist = eDir.length()
      const d = PIERNA.r + rr - dist
      if (d > peor && dist > 1e-5) {
        peor = d
        salida.copy(eDir).multiplyScalar(1 / dist).transformDirection(Mk)
      }
    }
    return peor * esc
  }

  const centro = (pt, out) => {
    out.setFromMatrixPosition(pt.a.matrixWorld)
    if (pt.b) {
      q.setFromMatrixPosition(pt.b.matrixWorld)
      if (pt.mitad) out.lerp(q, 0.5)
      else out.addScaledVector(q.sub(out).negate(), 0.9)   // la punta: un tramo más allá de la última falange
    }
    return out
  }

  // Muestras de la prenda donde van ahora (mundo): posición y normal con el
  // skinning de sus cuatro huesos.
  const tp = [], tn = [], mp = []
  const diag = {}
  const sk = new THREE.Vector3(), sn = new THREE.Vector3()
  const piel = (prenda, m, outP, outN) => {
    outP.set(0, 0, 0); if (outN) outN.set(0, 0, 0)
    for (let c = 0; c < 4; c++) {
      const w = m.w[c]
      if (w <= 0) continue
      const Mb = prenda.M[m.h[c]]
      outP.addScaledVector(sk.copy(m.p).applyMatrix4(Mb), w)
      if (outN) outN.addScaledVector(sn.copy(m.n).transformDirection(Mb), w)
    }
    if (outN) outN.normalize()
    return outP
  }
  // Lo más que se mete la manga de un lado en el costado de la prenda (mundo) y hacia dónde salir.
  // `todo`: la primera vuelta del cuadro calcula todo el costado; las siguientes
  // (con el brazo ya girado) solo lo que se mueve con él.
  let cuadro = 0
  const cajaMin = new THREE.Vector3(), cajaMax = new THREE.Vector3()
  let celInicio = new Int32Array(0), celDe = new Int32Array(0), celLista = new Int32Array(0), celPos = new Int32Array(0)
  const honduraManga = (prenda, s, esc, salida, punto, todo) => {
    const L = prenda.lados[s]
    const { huesos, M: Ms } = prenda
    const bi = prenda.sm.skeleton.boneInverses
    for (let k = 0; k < huesos.length; k++) Ms[k].multiplyMatrices(huesos[k].matrixWorld, bi[k])
    while (tp.length < L.torso.length) { tp.push(new THREE.Vector3()); tn.push(new THREE.Vector3()) }
    while (mp.length < L.manga.length) mp.push(new THREE.Vector3())
    const cerca = MANGA.cerca * esc
    cajaMin.set(Infinity, Infinity, Infinity); cajaMax.set(-Infinity, -Infinity, -Infinity)
    for (let k = 0; k < L.torso.length; k++) {
      if (todo || L.torso[k].mueve) piel(prenda, L.torso[k], tp[k], tn[k])
      cajaMin.min(tp[k]); cajaMax.max(tp[k])
    }
    // rejilla de celdas del tamaño de `cerca`: cada punto de la manga solo
    // revisa su celda y las vecinas (antes, las 400 muestras del costado)
    const ox = cajaMin.x - cerca, oy = cajaMin.y - cerca, oz = cajaMin.z - cerca
    const nx = Math.max(1, Math.ceil((cajaMax.x - ox + cerca) / cerca) + 1)
    const ny = Math.max(1, Math.ceil((cajaMax.y - oy + cerca) / cerca) + 1)
    const nz = Math.max(1, Math.ceil((cajaMax.z - oz + cerca) / cerca) + 1)
    const nCel = nx * ny * nz
    if (celInicio.length < nCel + 1) celInicio = new Int32Array(nCel + 1)
    if (celDe.length < L.torso.length) { celDe = new Int32Array(L.torso.length); celLista = new Int32Array(L.torso.length) }
    celInicio.fill(0, 0, nCel + 1)
    for (let j = 0; j < L.torso.length; j++) {
      const c = (Math.floor((tp[j].x - ox) / cerca) * ny + Math.floor((tp[j].y - oy) / cerca)) * nz + Math.floor((tp[j].z - oz) / cerca)
      celDe[j] = c; celInicio[c + 1]++
    }
    for (let c = 0; c < nCel; c++) celInicio[c + 1] += celInicio[c]
    if (celPos.length < nCel) celPos = new Int32Array(nCel)
    celPos.set(celInicio.subarray(0, nCel))
    for (let j = 0; j < L.torso.length; j++) celLista[celPos[celDe[j]]++] = j
    cajaMin.subScalar(cerca); cajaMax.addScalar(cerca)
    const cerca2 = cerca * cerca
    const margen = MANGA.margen * esc
    let peor = 0
    for (let k = 0; k < L.manga.length; k++) {
      const pm = piel(prenda, L.manga[k], mp[k], null)
      // lejos del costado (el antebrazo casi siempre): ni buscarle pareja
      if (pm.x < cajaMin.x || pm.y < cajaMin.y || pm.z < cajaMin.z || pm.x > cajaMax.x || pm.y > cajaMax.y || pm.z > cajaMax.z) continue
      let mejor = -1, dmin = cerca2
      const cx = Math.floor((pm.x - ox) / cerca), cy = Math.floor((pm.y - oy) / cerca), cz = Math.floor((pm.z - oz) / cerca)
      for (let ix = Math.max(0, cx - 1); ix <= Math.min(nx - 1, cx + 1); ix++) {
        for (let iy = Math.max(0, cy - 1); iy <= Math.min(ny - 1, cy + 1); iy++) {
          for (let iz = Math.max(0, cz - 1); iz <= Math.min(nz - 1, cz + 1); iz++) {
            const c = (ix * ny + iy) * nz + iz
            for (let q2 = celInicio[c]; q2 < celInicio[c + 1]; q2++) {
              const j = celLista[q2]
              const d = pm.distanceToSquared(tp[j])
              if (d < dmin) { dmin = d; mejor = j }
            }
          }
        }
      }
      if (mejor < 0) continue
      const h = margen - u.subVectors(pm, tp[mejor]).dot(tn[mejor])
      if (h > peor) {
        peor = h; salida.copy(tn[mejor]); punto.copy(pm)
        if (import.meta.env.DEV) diag[s] = { manga: L.manga[k].i, torso: L.torso[mejor].i, h: h / esc }
      }
    }
    return peor
  }

  // Lo más que se mete la orilla de una muñequera en el costado de una prenda, hasta la bastilla (mundo),
  // y hacia dónde salir: como la manga, contra la muestra del costado más cercana, a lo largo de su normal.
  const cp = [], cn = [], mp2 = [], cercanos = []
  const honduraMunequera = (prenda, lado, esc, salida, punto) => {
    const lista = prenda.lados[lado.s].costado
    if (!lista?.length || !lado.munequera) return 0
    // primero la muñequera y su caja: del costado solo cuenta lo que cae cerca de ella
    const { malla, idx } = lado.munequera
    while (mp2.length < idx.length) mp2.push(new THREE.Vector3())
    const cerca = MANGA.cerca * esc
    cajaMin.set(Infinity, Infinity, Infinity); cajaMax.set(-Infinity, -Infinity, -Infinity)
    for (let k = 0; k < idx.length; k++) {
      malla.getVertexPosition(idx[k], mp2[k]).applyMatrix4(malla.matrixWorld)
      cajaMin.min(mp2[k]); cajaMax.max(mp2[k])
    }
    cajaMin.subScalar(cerca); cajaMax.addScalar(cerca)
    const { huesos, M: Ms } = prenda
    const bi = prenda.sm.skeleton.boneInverses
    for (let k = 0; k < huesos.length; k++) Ms[k].multiplyMatrices(huesos[k].matrixWorld, bi[k])
    while (cp.length < lista.length) { cp.push(new THREE.Vector3()); cn.push(new THREE.Vector3()) }
    cercanos.length = 0
    for (let k = 0; k < lista.length; k++) {
      const c = piel(prenda, lista[k], cp[k], null)
      if (c.x < cajaMin.x || c.y < cajaMin.y || c.z < cajaMin.z || c.x > cajaMax.x || c.y > cajaMax.y || c.z > cajaMax.z) continue
      piel(prenda, lista[k], cp[k], cn[k])
      cercanos.push(k)
    }
    if (!cercanos.length) return 0
    const cerca2 = cerca * cerca, margen = MANGA.margen * esc
    let peor = 0
    for (let k = 0; k < idx.length; k++) {
      const pm = mp2[k]
      let mejor = -1, dmin = cerca2
      for (let q2 = 0; q2 < cercanos.length; q2++) {
        const j = cercanos[q2]
        const d = pm.distanceToSquared(cp[j])
        if (d < dmin) { dmin = d; mejor = j }
      }
      if (mejor < 0) continue
      const h = margen - u.subVectors(pm, cp[mejor]).dot(cn[mejor])
      if (h > peor) { peor = h; salida.copy(cn[mejor]); punto.copy(pm) }
    }
    return peor
  }

  // Lo más que se mete el cuerpo en el perfil de una muñequera (mundo) y hacia dónde salir: del punto del
  // cuerpo hacia el eje del antebrazo, en el plano del aro.
  const fw = new THREE.Matrix4(), bw = new THREE.Matrix4(), invHueso = new THREE.Matrix4()
  const cc = new THREE.Vector3(), gc = new THREE.Vector3(), pw = new THREE.Vector3(), pl = new THREE.Vector3()
  const honduraCuerpo = (lado, esc, salida, punto) => {
    const pf = lado.perfil
    if (!pf || !cuerpo.length) return 0
    fw.multiplyMatrices(pf.hueso.matrixWorld, pf.post)
    invHueso.copy(fw).invert()
    cc.copy(pf.centro).applyMatrix4(fw)
    const m = MUNEQUERA.margen
    let peor = 0
    for (const g of cuerpo) {
      bw.multiplyMatrices(g.hueso.matrixWorld, g.post)
      gc.copy(g.centro).applyMatrix4(bw)
      if (gc.distanceTo(cc) > (g.radio + pf.radio + m) * esc) continue
      const L = g.local, Rc = g.racimos
      for (let c = 0; c < Rc.length; c += 6) {
       gc.set(Rc[c], Rc[c + 1], Rc[c + 2]).applyMatrix4(bw)
       if (gc.distanceTo(cc) > (Rc[c + 3] + pf.radio + m) * esc) continue
       for (let k = Rc[c + 4]; k < Rc[c + 5]; k += 3) {
        pw.set(L[k], L[k + 1], L[k + 2]).applyMatrix4(bw)
        pl.copy(pw).applyMatrix4(invHueso)
        const y = pl.y
        if (y < pf.y0 - m || y > pf.y1 + m) continue
        const r = Math.hypot(pl.x, pl.z)
        const b = Math.min(pf.N - 1, Math.floor((Math.atan2(pl.z, pl.x) + Math.PI) / (2 * Math.PI) * pf.N))
        let lim = pf.aro[b]
        if (y > pf.ys0 - m && y < pf.ys1 + m) lim = Math.max(lim, pf.pico[b])
        const d = (lim + m - r) * esc
        if (lim > 0 && d > peor && r > 1e-6) {
          peor = d
          salida.set(-pl.x / r, 0, -pl.z / r).transformDirection(fw)
          punto.copy(pw)
        }
       }
      }
    }
    return peor
  }

  // La apertura de las muñequeras va aparte y encima de la de las mangas y las manos: un solo ángulo por
  // brazo, abriéndolo desde el hombro en el plano del frente del torso (como lo mide revisar_munequeras.py
  // en Blender). Metidas en el giro de siempre, cada contacto pedía un eje distinto (el pico contra la
  // cadera, la manga contra el costado) y lo sostenido cambiaba de dirección: con la chamarra brincaba
  // hasta 3.7° de un cuadro a otro. Con un ángulo, sostener y suavizar es como en las manos.
  const pechoReposoInv = reposoDe(B.spine_03x || B.rootx).invert()
  const frente = new THREE.Vector3(), mq = new THREE.Vector3(), muN = new THREE.Vector3(), muP = new THREE.Vector3()
  const qBase = new THREE.Quaternion(), mPecho = new THREE.Matrix4()
  const pruebaMunequera = (lado, esc, puestas, vol) => {
    let peor = 0
    if (vol && lado.munequera) {
      const { malla, idx } = lado.munequera
      for (let k = 0; k < idx.length; k++) {
        malla.getVertexPosition(idx[k], p).applyMatrix4(malla.matrixWorld)
        const d = hondura(p, 0, esc, n, vol)
        if (d > peor) { peor = d; muN.copy(n); muP.copy(p) }
      }
    }
    for (const prenda of puestas) {
      const d = honduraMunequera(prenda, lado, esc, n, p)
      if (d > peor) { peor = d; muN.copy(n); muP.copy(p) }
    }
    const d = honduraCuerpo(lado, esc, n, p)
    if (d > peor) { peor = d; muN.copy(n); muP.copy(p) }
    return peor
  }
  const abrirMas = (lado, ang) => {
    const br = lado.brazo
    br.quaternion.copy(qBase)
    if (Math.abs(ang) > 1e-7) {
      br.parent.getWorldQuaternion(qp)
      qa.setFromAxisAngle(frente, ang)
      qw.copy(qp).multiply(br.quaternion).premultiply(qa)
      br.quaternion.copy(qp.invert()).multiply(qw)
    }
    br.updateMatrixWorld(true)
  }
  const aperturaMunequera = (lado, esc, puestas, vol, decae, abre) => {
    // el frente del torso en mundo (en reposo, +z de la escena) y hacia qué lado abre cada brazo
    const pecho = B.spine_03x || B.rootx
    mPecho.multiplyMatrices(pecho.matrixWorld, pechoReposoInv)
    frente.set(0, 0, 1).transformDirection(mPecho)
    const signo = lado.s === 'l' ? 1 : -1
    qBase.copy(lado.brazo.quaternion)
    hombro.setFromMatrixPosition(lado.brazo.matrixWorld)
    let a = 0
    for (let it = 0; it < ITER; it++) {
      abrirMas(lado, a * signo)
      const peor = pruebaMunequera(lado, esc, puestas, vol)
      if (peor <= 1e-5) break
      // abrir un radián mueve el punto en frente × (punto − hombro): lo que de eso va hacia afuera
      mq.subVectors(muP, hombro)
      const palanca = u.crossVectors(frente, mq).multiplyScalar(signo).dot(muN)
      if (palanca < 0.02 * esc) break
      a = Math.min(MUNEQUERA.tope, a + peor / palanca)
    }
    lado.abdPide = a
    lado.abdSost = Math.max((lado.abdSost || 0) * decae, a)
    lado.abd = (lado.abd || 0) + (lado.abdSost - (lado.abd || 0)) * abre
    abrirMas(lado, lado.abd * signo)
  }

  // Gira el brazo en mundo (rotación vector rv, en el espacio del padre del brazo).
  const girar = (lado, rv) => {
    const br = lado.brazo
    br.quaternion.copy(lado.crudo)
    const ang = rv.length()
    if (ang > 1e-6) {
      br.parent.getWorldQuaternion(qp)
      eje.copy(rv).multiplyScalar(1 / ang).applyQuaternion(qp)
      qa.setFromAxisAngle(eje, ang)
      qw.copy(qp).multiply(br.quaternion)
      qw.premultiply(qa)
      br.quaternion.copy(qp.invert()).multiply(qw)
    }
    br.updateMatrixWorld(true)
  }

  return {
    lados,
    // puntos del cuerpo contra los que se miden las muñequeras (para revisar en Node o en desarrollo)
    cuerpo,
    chamarra: prendas.chamarra,
    hoodie: prendas.hoodie,
    inflada: prendas.inflada,
    // (desarrollo) el peor punto de la manga en la última medición, por lado
    diag,
    // Antes del mixer: si el mixer no corre este cuadro, el brazo regresa a lo que dejó.
    restaurar() {
      for (const l of lados) if (l.tieneCrudo) l.brazo.quaternion.copy(l.crudo)
    },
    // Sin capa y sin memoria (el rig, en la historia: ahí mandan el numerito y
    // sus poses, y la apertura no debe irse apagando encima de ellas). Va
    // después del mixer: `restaurar` ya regresó el brazo este cuadro.
    soltar() {
      for (const l of lados) {
        l.tieneCrudo = false
        l.rv.set(0, 0, 0); l.sostiene.set(0, 0, 0); l.necesita = 0; l.previa = null
        l.abd = 0; l.abdSost = 0; l.abdPide = 0
      }
    },
    // que: { boxers, pantalones, chamarra, hoodie, inflada, munequeras } (true = va puesta); un booleano solo es los bóxers
    aplicar(dt, que) {
      const objeto = typeof que === 'object' && que
      let conBoxers = objeto ? !!que.boxers : !!que
      let conPantalones = objeto ? !!que.pantalones : false
      let conMunequeras = objeto ? !!que.munequeras : false
      let puestas = []
      if (objeto) {
        for (const id of ['chamarra', 'hoodie', 'inflada']) if (que[id] && prendas[id]) puestas.push(prendas[id])
      }
      // window.__sinApartar (desarrollo): sin la capa, para medir contra qué se compara
      if (import.meta.env.DEV && typeof window !== 'undefined' && window.__sinApartar) { conBoxers = false; conPantalones = false; conMunequeras = false; puestas = [] }
      // las manos contra un volumen: el de los bóxers o, si no, el de los pantalones (se excluyen)
      const vol = conBoxers ? VOL_BOXERS : conPantalones ? VOL_PANTALONES : null
      conBoxers = !!vol
      const conPrenda = puestas.length > 0
      const activo = conBoxers || conPrenda
      B.rootx.updateWorldMatrix(true, false)
      B.thigh_twistl.updateWorldMatrix(true, false)
      B.thigh_twistr.updateWorldMatrix(true, false)
      matrices()
      const esc = Math.hypot(M.raiz.elements[0], M.raiz.elements[1], M.raiz.elements[2])
      const t = Math.max(dt, 0)
      const decae = Math.exp(-t / SOSTIENE_S)
      const abre = 1 - Math.exp(-t / ABRE_S)
      cuadro++
      for (const lado of lados) {
        lado.brazo.updateWorldMatrix(true, true)
        lado.crudo.copy(lado.brazo.quaternion); lado.tieneCrudo = true
        const necesita = new THREE.Vector3()
        // Solo con una prenda (chamarra, hoodie), las mangas se miden un cuadro sí y
        // otro no: la apertura se sostiene casi un segundo y así cuesta la mitad.
        if (activo && conPrenda && !conBoxers && (cuadro & 1) && lado.previa) {
          necesita.copy(lado.previa)
        } else if (activo) {
          for (let it = 0; it < ITER; it++) {
            girar(lado, necesita)
            let peor = 0
            for (const prenda of puestas) {
              const d = honduraManga(prenda, lado.s, esc, n, p, it === 0)
              if (d > peor) { peor = d; mejorN.copy(n); mejorP.copy(p) }
            }
            if (conBoxers && lado.vertices.length) {
              for (const { malla, idx } of lado.vertices) {
                for (let k = 0; k < idx.length; k++) {
                  malla.getVertexPosition(idx[k], p).applyMatrix4(malla.matrixWorld)
                  const d = hondura(p, 0, esc, n, vol)
                  if (d > peor) { peor = d; mejorN.copy(n); mejorP.copy(p) }
                }
              }
            } else if (conBoxers) {
              for (const pt of lado.puntos) {
                centro(pt, p)
                const d = hondura(p, pt.r, esc, n, vol)
                if (d > peor) { peor = d; mejorN.copy(n); mejorP.copy(p) }
              }
            }
            if (peor <= 1e-5) break
            // Girar por el eje q × n mueve el punto hacia n a razón de |q × n|
            // por radián: el ángulo es lo que se mete entre eso.
            hombro.setFromMatrixPosition(lado.brazo.matrixWorld)
            q.subVectors(mejorP, hombro)
            eje.crossVectors(q, mejorN)
            const lp = eje.length()
            if (lp < 1e-6) break
            // a coordenadas del padre del brazo, para que se pueda suavizar
            lado.brazo.parent.getWorldQuaternion(qp)
            eje.multiplyScalar(1 / lp).applyQuaternion(qp.invert())
            necesita.addScaledVector(eje, peor / lp)
          }
          ;(lado.previa ||= new THREE.Vector3()).copy(necesita)
        }
        // lo más que ha necesitado hace poco, y hacia allá se abre suave
        lado.sostiene.multiplyScalar(decae)
        if (necesita.length() >= lado.sostiene.length()) lado.sostiene.copy(necesita)
        lado.rv.lerp(lado.sostiene, abre)
        girar(lado, lado.rv)
        lado.necesita = necesita.length()
        // y encima, lo que pidan las muñequeras
        if (conMunequeras && lado.perfil) aperturaMunequera(lado, esc, puestas, vol, decae, abre)
        else { lado.abd = 0; lado.abdSost = 0; lado.abdPide = 0 }
      }
    },
  }
}
