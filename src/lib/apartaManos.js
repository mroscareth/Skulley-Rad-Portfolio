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
    lados[lado] = { torso, manga }
  }
  return { sm, huesos, lados, M: huesos.map(() => new THREE.Matrix4()) }
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
      }
    },
    // que: { boxers, pantalones, chamarra, hoodie, inflada } (true = va puesta); un booleano solo es los bóxers
    aplicar(dt, que) {
      const objeto = typeof que === 'object' && que
      let conBoxers = objeto ? !!que.boxers : !!que
      let conPantalones = objeto ? !!que.pantalones : false
      let puestas = []
      if (objeto) {
        for (const id of ['chamarra', 'hoodie', 'inflada']) if (que[id] && prendas[id]) puestas.push(prendas[id])
      }
      // window.__sinApartar (desarrollo): sin la capa, para medir contra qué se compara
      if (import.meta.env.DEV && typeof window !== 'undefined' && window.__sinApartar) { conBoxers = false; conPantalones = false; puestas = [] }
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
      }
    },
  }
}
