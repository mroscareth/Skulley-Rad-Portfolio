import * as THREE from 'three'

// Física de tela de los props (los bóxers, Oscar 2026-11-16: "que usen físicas
// para que se muevan naturales con el personaje").
//
// No es una tela libre: cada partícula persigue su posición animada (la piel
// de pelvis, prop_cadera y muslo que trae el GLB) con un resorte, tiene
// inercia y gravedad, y no se aleja de ella más que `HOLGURA` (cero en el
// elástico, que va pegado a la cadera). Encima choca contra los fémures
// (cápsulas) y la pelvis (elipsoide): al correr el muslo sube 76° y barre por
// donde está la tela del frente, y con pesos solos lo atravesaba.
//
// Las partículas son los vértices soldados por posición (el GLB parte los
// vértices en las costuras de UV y de material: sueltos se abrían). Mientras
// corre, la GPU dibuja la malla con un solo hueso (la pelvis) y las posiciones
// las escribe esto cada cuadro, en el espacio de reposo de la pelvis; así el
// contorno, la tinta y el despiece, que comparten la geometría, la siguen
// solos. Apagada, regresan los pesos de siempre y la posición de reposo.

// Cada cuadro integra exactamente su tiempo, en pasos de a lo más PASO. Con
// pasos fijos, a más de 60 cuadros por segundo había cuadros sin paso: la tela
// se quedaba atrás un cuadro y alcanzaba de golpe (Oscar: "al caminar brinca
// mucho").
const PASO = 1 / 60
const MAX_PASOS = 4
// Sobria a propósito: con 3.2 Hz, rebote de 0.5 y 2.5 cm de holgura el
// dobladillo daba latigazos en cada zancada.
const FRECUENCIA = 4.5       // Hz del resorte que la lleva a su posición animada
const AMORTIGUA = 0.75       // 1 = sin rebote; menos, rebota
const GRAVEDAD = 0.3 * 9.8   // m/s², poca: la forma ya trae la caída
const INERCIA = 0.25         // parte del movimiento de la cadera (avance y giro) que la tela no sigue de inmediato
const HOLGURA = 0.02         // m que se puede alejar de su posición animada (dobladillo)
const FIJA_DESDE = 0.70      // m de alto (reposo): de ahí para arriba va pegada (el elástico)
const LIBRE_DESDE = 0.545    // m: de ahí para abajo, toda la holgura
const RADIO_FEMUR = 0.056    // m: el muslo (0.050 a la altura del dobladillo, medido) más el grueso de la tela
const PELVIS = { c: [0, 0.6575, -0.005], r: [0.172, 0.072, 0.163] }
// La pierna del bóxer cuelga. Girando completa con el muslo, en el idle (el
// muslo derecho 29° adelante y 20° afuera de la pelvis) el dobladillo se
// levantaba como pantalla de lámpara. Lo que lleva el muslo gira solo una
// parte de su giro respecto a la pelvis (de COLGAR_MIN para arriba) y, si así
// el muslo llega a la tela del dobladillo por dentro, empuja la pierna entera
// lo que se mete (hasta EMPUJE; más allá, la pierna gira más con él). El
// hueco por dentro se mide de la malla en cada dirección. Lo que no se hizo:
// dejar que solo el choque la sacara (la doblaba en pico y el muslo parecía
// salirse por el frente) ni trasladar cada anillo centrado en el muslo
// (regresaba el ala: el muslo abierto la empujaba afuera aunque no la tocara).
const COLGAR_MIN = 0.4
const EMPUJE = 0.03          // m que el muslo puede empujar el dobladillo antes de que la pierna gire más
const MARGEN_COLGAR = 0.006  // m de aire entre el muslo (con su radio de choque) y la tela
const SECTORES = 16

const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t) }

export class TelaProp {
  constructor(malla) {
    const d = malla.userData.tela
    this.malla = malla
    this.d = d
    const geo = malla.geometry
    const n = geo.attributes.position.count
    const rep = d.reposo
    // soldar por posición
    const llave = new Map(); const parte = new Int32Array(n); const primera = []
    for (let i = 0; i < n; i++) {
      const k = `${Math.round(rep[i * 3] * 2e4)},${Math.round(rep[i * 3 + 1] * 2e4)},${Math.round(rep[i * 3 + 2] * 2e4)}`
      let p = llave.get(k)
      if (p === undefined) { p = primera.length; llave.set(k, p); primera.push(i) }
      parte[i] = p
    }
    const P = primera.length
    this.n = n; this.P = P; this.parte = parte; this.primera = primera
    this.pr = new Float32Array(P * 3)
    for (let p = 0; p < P; p++) for (let c = 0; c < 3; c++) this.pr[p * 3 + c] = rep[primera[p] * 3 + c]
    // triángulos y vecinos, en partículas
    const ix = geo.index.array
    const tris = []
    const vec = Array.from({ length: P }, () => new Set())
    for (let t = 0; t < ix.length; t += 3) {
      const a = parte[ix[t]], b = parte[ix[t + 1]], c = parte[ix[t + 2]]
      if (a === b || b === c || a === c) continue
      tris.push(a, b, c)
      vec[a].add(b); vec[a].add(c); vec[b].add(a); vec[b].add(c); vec[c].add(a); vec[c].add(b)
    }
    this.tris = Uint32Array.from(tris)
    this.vIni = new Uint32Array(P + 1)
    let tot = 0; for (let p = 0; p < P; p++) { this.vIni[p] = tot; tot += vec[p].size }
    this.vIni[P] = tot
    this.vLis = new Uint32Array(tot)
    for (let p = 0; p < P; p++) { let o = this.vIni[p]; for (const q of vec[p]) this.vLis[o++] = q }
    // holgura de cada partícula
    this.r = new Float32Array(P)
    for (let p = 0; p < P; p++) {
      const y = this.pr[p * 3 + 1]
      this.r[p] = y >= FIJA_DESDE ? 0 : HOLGURA * ss(FIJA_DESDE, LIBRE_DESDE, y)
    }
    // con qué choca cada una (bit 0 pelvis, 1 fémur izquierdo, 2 derecho):
    // solo con lo que le queda cerca
    this.choques = new Uint8Array(P)
    for (let p = 0; p < P; p++) {
      const x = this.pr[p * 3], y = this.pr[p * 3 + 1]
      let m = 0
      if (y > 0.55) m |= 1
      if (x > -0.03) m |= 2
      if (x < 0.03) m |= 4
      this.choques[p] = m
    }
    // estado
    this.x = new Float32Array(P * 3); this.v = new Float32Array(P * 3)
    this.T = new Float32Array(P * 3); this.tmp = new Float32Array(P * 3)
    this.bind = new Float32Array(P * 3); this.nor = new Float32Array(P * 3)
    // de qué lado de cada fémur quedó cada partícula (pose animada y tela)
    this.ladoT = new Float32Array(P * 6); this.ladoX = new Float32Array(P * 6)
    // reposo de los huesos (relativo a la raíz de la escena)
    this.Rinv = d.reposos.map((m) => m.clone().invert())
    this.Rel0 = [1, 2].map((s) => new THREE.Matrix4().multiplyMatrices(this.Rinv[0], d.reposos[s]))
    this.cadera = [1, 2].map((s) => new THREE.Vector3().setFromMatrixPosition(d.reposos[s]))
    this.rodilla = d.rodillas.map((b, k) => {
      if (!b) return this.cadera[k].clone().add(new THREE.Vector3(0, -0.24, 0.08))
      // reposo de la rodilla en el espacio de la escena = reposo del muslo · (muslo⁻¹ · rodilla) ahora mismo
      const m = new THREE.Matrix4().copy(d.huesos[1 + k].matrixWorld).invert().multiply(b.matrixWorld)
      return new THREE.Vector3().setFromMatrixPosition(new THREE.Matrix4().multiplyMatrices(d.reposos[1 + k], m))
    })
    // El dobladillo de cada pierna: dónde queda el eje del muslo a esa altura y,
    // por dirección alrededor de él (SECTORES, 0 = afuera, en el plano del
    // piso), cuánto hay del eje a la tela por dentro.
    this.dobladillo = [0, 1].map((k) => {
      const a = this.cadera[k], b = this.rodilla[k], sg = Math.sign(a.x) || 1
      const eje = new THREE.Vector3().subVectors(b, a)
      const L2 = eje.lengthSq()
      let ymin = Infinity
      for (let p = 0; p < P; p++) if (this.pr[p * 3] * sg > 0.01) ymin = Math.min(ymin, this.pr[p * 3 + 1])
      const hueco = new Float32Array(SECTORES).fill(Infinity)
      let tMed = 0, nT = 0
      for (let p = 0; p < P; p++) {
        const i = p * 3
        if (this.pr[i] * sg <= 0.01 || this.pr[i + 1] > ymin + 0.012) continue
        const t = ((this.pr[i] - a.x) * eje.x + (this.pr[i + 1] - a.y) * eje.y + (this.pr[i + 2] - a.z) * eje.z) / L2
        tMed += t; nT++
        const rx = (this.pr[i] - a.x - eje.x * t) * sg, rz = this.pr[i + 2] - a.z - eje.z * t
        const sec = Math.round(Math.atan2(rz, rx) / (2 * Math.PI) * SECTORES + SECTORES) % SECTORES
        hueco[sec] = Math.min(hueco[sec], Math.hypot(rx, rz))
      }
      for (let it = 0; it < SECTORES && hueco.includes(Infinity); it++) {
        for (let s = 0; s < SECTORES; s++) {
          if (hueco[s] !== Infinity) continue
          const v = Math.min(hueco[(s + 1) % SECTORES], hueco[(s + SECTORES - 1) % SECTORES])
          if (v !== Infinity) hueco[s] = v
        }
      }
      return { sg, hueco, punto: a.clone().addScaledVector(eje, nT ? tMed / nT : 0.67) }
    })
    this.colgar = new Float32Array(2)   // la parte del giro que sigue cada pierna (para revisar)
    this.empuje = new Float32Array(6)   // lo que el muslo empuja cada pierna, en mundo
    this.metido = new Float32Array(3)   // _hueco: lo que se mete el muslo y hacia dónde (reposo de la tela)
    // 0–2 piel (pelvis y muslos), 3–4 prop_cadera (mitad), 5–6 muslos colgando
    this.M = Array.from({ length: 7 }, () => new THREE.Matrix4())
    this._m = new THREE.Matrix4(); this._c = new THREE.Vector3()
    this.Mi = Array.from({ length: 3 }, () => new THREE.Matrix4())
    this._a = new THREE.Matrix4(); this._b = new THREE.Matrix4()
    this._p0 = new THREE.Vector3(); this._p1 = new THREE.Vector3(); this._q0 = new THREE.Quaternion(); this._q1 = new THREE.Quaternion()
    this._s0 = new THREE.Vector3(); this._s1 = new THREE.Vector3()
    this.M0prev = new THREE.Matrix4()
    this.caderaPrev = new THREE.Vector3()
    this.D = new THREE.Matrix4()
    this.activa = false
    this.nueva = true
  }

  // Pesos de un solo hueso para la GPU (la pelvis) y empieza desde la pose animada.
  activar() {
    if (this.activa) return
    const g = this.malla.geometry
    const si = g.attributes.skinIndex.array; const sw = g.attributes.skinWeight.array
    si.fill(0); sw.fill(0)
    for (let i = 0; i < this.n; i++) sw[i * 4] = 1
    g.attributes.skinIndex.needsUpdate = true; g.attributes.skinWeight.needsUpdate = true
    this.activa = true
    this.nueva = true
  }

  // De regreso a la piel de siempre, en reposo (el retrato, el warm-up, apagada).
  desactivar() {
    if (!this.activa) return
    const g = this.malla.geometry
    g.attributes.skinIndex.array.set(this.d.lbsI); g.attributes.skinWeight.array.set(this.d.lbsW)
    g.attributes.position.array.set(this.d.reposo); g.attributes.normal.array.set(this.d.normalReposo)
    for (const k of ['skinIndex', 'skinWeight', 'position', 'normal']) g.attributes[k].needsUpdate = true
    this.activa = false
  }

  _matrices() {
    const { huesos } = this.d
    for (let j = 0; j < 3; j++) this.M[j].multiplyMatrices(huesos[j].matrixWorld, this.Rinv[j])
    for (let s = 0; s < 2; s++) {
      // prop_cadera: la mitad del giro del muslo respecto a la pelvis
      this._fraccion(s, 0.5, this.M[3 + s])
      // colgando: lo menos que deja al muslo empujando a lo más EMPUJE
      let f = COLGAR_MIN
      if (this._hueco(s, f) > EMPUJE) {
        let lo = f, hi = 1
        for (let it = 0; it < 7; it++) { const m = 0.5 * (lo + hi); if (this._hueco(s, m) <= EMPUJE) hi = m; else lo = m }
        f = hi
      }
      this.colgar[s] = f
      // y lo que empuja, a mundo (la pierna se mueve entera eso)
      const e = this._hueco(s, f)
      this._fraccion(s, f, this.M[5 + s])
      const o = s * 3
      if (e > 0) {
        const db = this.dobladillo[s], m = this.metido
        this._c.set(db.punto.x + m[0] * e * db.sg, db.punto.y, db.punto.z + m[2] * e).applyMatrix4(this.M[5 + s])
        this._p0.copy(db.punto).applyMatrix4(this.M[5 + s])
        this.empuje[o] = this._c.x - this._p0.x; this.empuje[o + 1] = this._c.y - this._p0.y; this.empuje[o + 2] = this._c.z - this._p0.z
      } else {
        this.empuje[o] = this.empuje[o + 1] = this.empuje[o + 2] = 0
      }
    }
    for (let j = 0; j < 3; j++) this.Mi[j].copy(this.M[j]).invert()
  }

  // La matriz de piel de un muslo que sigue `f` de su giro respecto a la pelvis.
  _fraccion(s, f, out) {
    const { huesos } = this.d
    const Pw = huesos[0].matrixWorld
    const rel = this._b.copy(Pw).invert().multiply(huesos[1 + s].matrixWorld)
    this.Rel0[s].decompose(this._p0, this._q0, this._s0)
    rel.decompose(this._p1, this._q1, this._s1)
    this._p0.lerp(this._p1, f); this._q0.slerp(this._q1, f); this._s0.lerp(this._s1, f)
    rel.compose(this._p0, this._q0, this._s0)
    return out.multiplyMatrices(Pw, rel).multiply(this.Rinv[1 + s])
  }

  // Con la pierna siguiendo `f`, cuánto se mete el muslo en la tela del
  // dobladillo (negativo: le sobra aire). El muslo de verdad, visto desde la
  // tela en su reposo, cruza el plano del dobladillo en un elipse (más largo
  // entre más inclinado: con el muslo adelante, lo que llega primero al frente
  // es lo de cerca de la rodilla); se compara contra el hueco en cada
  // dirección. Deja en `metido` hacia dónde se mete más (unitario, en el
  // plano del piso; x hacia afuera).
  _hueco(s, f) {
    const db = this.dobladillo[s], m = this.metido
    this._fraccion(s, f, this._m).invert()
    const A = this._c.copy(this.cadera[s]).applyMatrix4(this.M[1 + s]).applyMatrix4(this._m)
    const B = this._p0.copy(this.rodilla[s]).applyMatrix4(this.M[1 + s]).applyMatrix4(this._m)
    let ux = B.x - A.x, uy = B.y - A.y, uz = B.z - A.z
    const L = Math.hypot(ux, uy, uz) || 1
    ux /= L; uy /= L; uz /= L
    const cosA = Math.max(Math.abs(uy), 0.2)
    const t = Math.min(L, Math.max(0, (db.punto.y - A.y) / (uy || -1e-6)))
    // dónde cruza el eje, respecto al centro del dobladillo (x hacia afuera)
    const qx = (A.x + ux * t - db.punto.x) * db.sg, qz = A.z + uz * t - db.punto.z
    // hacia dónde se inclina, en el piso
    const hx = ux * db.sg, hz = uz, hl = Math.hypot(hx, hz) || 1
    const ra = RADIO_FEMUR / cosA, rb = RADIO_FEMUR
    let peor = -Infinity
    for (let k = 0; k < SECTORES; k++) {
      const ang = (k / SECTORES) * 2 * Math.PI, nx = Math.cos(ang), nz = Math.sin(ang)
      const c = (nx * hx + nz * hz) / hl, sn = (nz * hx - nx * hz) / hl
      const e = qx * nx + qz * nz + Math.sqrt(ra * ra * c * c + rb * rb * sn * sn) + MARGEN_COLGAR - db.hueco[k]
      if (e > peor) { peor = e; m[0] = nx; m[1] = 0; m[2] = nz }
    }
    return peor
  }

  _objetivos() {
    const { cpuIdx, cpuW, reposo } = this.d
    const T = this.T
    T.fill(0)
    for (let p = 0; p < this.P; p++) {
      const v = this.primera[p]
      const x = reposo[v * 3], y = reposo[v * 3 + 1], z = reposo[v * 3 + 2]
      let tx = 0, ty = 0, tz = 0
      for (let c = 0; c < 4; c++) {
        const w = cpuW[v * 4 + c]
        if (w <= 0) continue
        let j = cpuIdx[v * 4 + c]
        if (j === 1 || j === 2) {
          // lo que lleva el muslo va colgando (M[5], M[6]) y empujado por él
          const o = (j - 1) * 3
          tx += w * this.empuje[o]; ty += w * this.empuje[o + 1]; tz += w * this.empuje[o + 2]
          j += 4
        }
        const e = this.M[j].elements
        tx += w * (e[0] * x + e[4] * y + e[8] * z + e[12])
        ty += w * (e[1] * x + e[5] * y + e[9] * z + e[13])
        tz += w * (e[2] * x + e[6] * y + e[10] * z + e[14])
      }
      T[p * 3] = tx; T[p * 3 + 1] = ty; T[p * 3 + 2] = tz
    }
  }

  // Empuja fuera de la pelvis y de los fémures, en el reposo de cada hueso
  // (ahí la pelvis es un elipsoide fijo y cada fémur una cápsula fija).
  // Del fémur sale por el lado por donde venía (`lado`, uno para la pose
  // animada y otro para la tela): al correr, el muslo sube 76° contra el frente
  // y la pose animada le pasa por el centro; sacándola por lo más cerca, la
  // tela brincaba al otro lado del muslo.
  _choca(p, x, lado) {
    const i = p * 3
    const mask = this.choques[p]
    for (let h = 0; h < 3; h++) {
      if (!(mask & (1 << h))) continue
      const e = this.Mi[h].elements
      const X = x[i], Y = x[i + 1], Z = x[i + 2]
      const ux = e[0] * X + e[4] * Y + e[8] * Z + e[12]
      const uy = e[1] * X + e[5] * Y + e[9] * Z + e[13]
      const uz = e[2] * X + e[6] * Y + e[10] * Z + e[14]
      let nx, ny, nz
      if (h === 0) {
        const c = PELVIS.c, rr = PELVIS.r
        const ex = (ux - c[0]) / rr[0], ey = (uy - c[1]) / rr[1], ez = (uz - c[2]) / rr[2]
        const l = Math.sqrt(ex * ex + ey * ey + ez * ez)
        if (l >= 1 || l < 1e-6) continue
        nx = c[0] + ex / l * rr[0]; ny = c[1] + ey / l * rr[1]; nz = c[2] + ez / l * rr[2]
      } else {
        const a = this.cadera[h - 1], b = this.rodilla[h - 1]
        const abx = b.x - a.x, aby = b.y - a.y, abz = b.z - a.z
        let t = ((ux - a.x) * abx + (uy - a.y) * aby + (uz - a.z) * abz) / (abx * abx + aby * aby + abz * abz)
        t = t < 0 ? 0 : t > 1 ? 1 : t
        const cx = a.x + abx * t, cy = a.y + aby * t, cz = a.z + abz * t
        let dx = ux - cx, dy = uy - cy, dz = uz - cz
        const l = Math.sqrt(dx * dx + dy * dy + dz * dz)
        const o = (p * 2 + h - 1) * 3
        const px = lado[o], py = lado[o + 1], pz = lado[o + 2]
        if (l > 1e-6) { dx /= l; dy /= l; dz /= l }
        if (l >= RADIO_FEMUR) { lado[o] = dx; lado[o + 1] = dy; lado[o + 2] = dz; continue }
        // adentro: si quedó del otro lado del eje, sale por donde venía
        if ((px !== 0 || py !== 0 || pz !== 0) && (l <= 1e-6 || dx * px + dy * py + dz * pz < 0)) { dx = px; dy = py; dz = pz }
        else if (l <= 1e-6) continue
        lado[o] = dx; lado[o + 1] = dy; lado[o + 2] = dz
        nx = cx + dx * RADIO_FEMUR; ny = cy + dy * RADIO_FEMUR; nz = cz + dz * RADIO_FEMUR
      }
      const f = this.M[h].elements
      x[i] = f[0] * nx + f[4] * ny + f[8] * nz + f[12]
      x[i + 1] = f[1] * nx + f[5] * ny + f[9] * nz + f[13]
      x[i + 2] = f[2] * nx + f[6] * ny + f[10] * nz + f[14]
    }
  }

  /** Un cuadro de física. `dt` en segundos. */
  paso(dt) {
    if (!this.activa) this.activar()
    const raiz = this.d.huesos[0]
    for (const b of this.d.huesos) b.updateWorldMatrix(true, false)
    this._matrices()
    this._objetivos()
    const T = this.T, x = this.x, v = this.v, r = this.r, P = this.P
    const esc = Math.hypot(this.M[0].elements[0], this.M[0].elements[1], this.M[0].elements[2])
    // lo que se movió la pelvis desde el cuadro anterior (avance y giro)
    const D = this.D.multiplyMatrices(this.M[0], this.M0prev)
    // cuánto se movió la cadera de verdad (la traslación de D crece con el giro
    // lejos del origen y no sirve para esto)
    const cadera = this._p1.setFromMatrixPosition(raiz.matrixWorld)
    const salto = cadera.distanceTo(this.caderaPrev)
    this.caderaPrev.copy(cadera)
    const reinicia = this.nueva || dt > 0.1 || salto > 0.5 * esc
    if (reinicia) this.ladoT.fill(0)
    // La pose animada también sale de los fémures (al correr la piel los cruza):
    // si el resorte jalara hacia adentro y el choque sacara, temblaría.
    for (let p = 0; p < P; p++) if (r[p] > 0) this._choca(p, T, this.ladoT)
    if (reinicia) {
      x.set(T); v.fill(0); this.nueva = false
      this.ladoX.set(this.ladoT)
    } else {
      // la tela acompaña ese movimiento menos la parte de inercia
      const e = D.elements, k = 1 - INERCIA
      for (let p = 0; p < P; p++) {
        if (r[p] === 0) continue
        const i = p * 3
        const X = x[i], Y = x[i + 1], Z = x[i + 2]
        x[i] += (e[0] * X + e[4] * Y + e[8] * Z + e[12] - X) * k
        x[i + 1] += (e[1] * X + e[5] * Y + e[9] * Z + e[13] - Y) * k
        x[i + 2] += (e[2] * X + e[6] * Y + e[10] * Z + e[14] - Z) * k
        const VX = v[i], VY = v[i + 1], VZ = v[i + 2]
        v[i] += (e[0] * VX + e[4] * VY + e[8] * VZ - VX) * k
        v[i + 1] += (e[1] * VX + e[5] * VY + e[9] * VZ - VY) * k
        v[i + 2] += (e[2] * VX + e[6] * VY + e[10] * VZ - VZ) * k
      }
      const n = Math.min(MAX_PASOS, Math.max(1, Math.ceil(dt / PASO - 1e-6)))
      const h = dt / n
      const w = 2 * Math.PI * FRECUENCIA, w2 = w * w, c = 2 * AMORTIGUA * w
      const g = -GRAVEDAD * esc
      const tmp = this.tmp
      for (let s = 0; s < n; s++) {
        for (let p = 0; p < P; p++) {
          if (r[p] === 0) continue
          const i = p * 3
          for (let k3 = 0; k3 < 3; k3++) {
            const a = w2 * (T[i + k3] - x[i + k3]) - c * v[i + k3] + (k3 === 1 ? g : 0)
            v[i + k3] += a * h
            x[i + k3] += v[i + k3] * h
          }
        }
        // la desviación se suaviza con los vecinos: la tela se mueve en paños, no por puntos
        for (let p = 0; p < P; p++) {
          const i = p * 3
          let ax = 0, ay = 0, az = 0
          const a = this.vIni[p], b = this.vIni[p + 1]
          for (let q = a; q < b; q++) { const j3 = this.vLis[q] * 3; ax += x[j3] - T[j3]; ay += x[j3 + 1] - T[j3 + 1]; az += x[j3 + 2] - T[j3 + 2] }
          const m = b > a ? 1 / (b - a) : 0
          tmp[i] = 0.5 * (x[i] - T[i]) + 0.5 * ax * m
          tmp[i + 1] = 0.5 * (x[i + 1] - T[i + 1]) + 0.5 * ay * m
          tmp[i + 2] = 0.5 * (x[i + 2] - T[i + 2]) + 0.5 * az * m
        }
        for (let p = 0; p < P; p++) {
          if (r[p] === 0) continue
          const i = p * 3
          const lim = r[p] * esc
          let dx = tmp[i], dy = tmp[i + 1], dz = tmp[i + 2]
          const l = Math.hypot(dx, dy, dz)
          if (l > lim) {
            const k = lim / (l || 1); dx *= k; dy *= k; dz *= k
            // contra el tope pierde la velocidad que lo llevaba hacia afuera
            const vn = (v[i] * dx + v[i + 1] * dy + v[i + 2] * dz) / (lim || 1)
            if (vn > 0) { const f = vn / (lim || 1); v[i] -= dx * f; v[i + 1] -= dy * f; v[i + 2] -= dz * f }
          }
          x[i] = T[i] + dx; x[i + 1] = T[i + 1] + dy; x[i + 2] = T[i + 2] + dz
          this._choca(p, x, this.ladoX)
        }
      }
    }
    // lo del elástico, pegado siempre
    for (let p = 0; p < P; p++) {
      if (r[p] !== 0) continue
      const i = p * 3
      x[i] = T[i]; x[i + 1] = T[i + 1]; x[i + 2] = T[i + 2]; v[i] = v[i + 1] = v[i + 2] = 0
    }
    this.M0prev.copy(this.M[0]).invert()
    this._escribe()
  }

  _escribe() {
    const g = this.malla.geometry
    const pos = g.attributes.position.array, nrm = g.attributes.normal.array
    const e = this.Mi[0].elements, x = this.x, bind = this.bind, nor = this.nor
    for (let p = 0; p < this.P; p++) {
      const i = p * 3
      const X = x[i], Y = x[i + 1], Z = x[i + 2]
      bind[i] = e[0] * X + e[4] * Y + e[8] * Z + e[12]
      bind[i + 1] = e[1] * X + e[5] * Y + e[9] * Z + e[13]
      bind[i + 2] = e[2] * X + e[6] * Y + e[10] * Z + e[14]
    }
    nor.fill(0)
    const t = this.tris
    for (let k = 0; k < t.length; k += 3) {
      const a = t[k] * 3, b = t[k + 1] * 3, c = t[k + 2] * 3
      const ux = bind[b] - bind[a], uy = bind[b + 1] - bind[a + 1], uz = bind[b + 2] - bind[a + 2]
      const vx = bind[c] - bind[a], vy = bind[c + 1] - bind[a + 1], vz = bind[c + 2] - bind[a + 2]
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx
      nor[a] += nx; nor[a + 1] += ny; nor[a + 2] += nz
      nor[b] += nx; nor[b + 1] += ny; nor[b + 2] += nz
      nor[c] += nx; nor[c + 1] += ny; nor[c + 2] += nz
    }
    for (let p = 0; p < this.P; p++) {
      const i = p * 3
      const l = Math.hypot(nor[i], nor[i + 1], nor[i + 2]) || 1
      nor[i] /= l; nor[i + 1] /= l; nor[i + 2] /= l
    }
    const parte = this.parte
    for (let v = 0; v < this.n; v++) {
      const i = parte[v] * 3, o = v * 3
      pos[o] = bind[i]; pos[o + 1] = bind[i + 1]; pos[o + 2] = bind[i + 2]
      nrm[o] = nor[i]; nrm[o + 1] = nor[i + 1]; nrm[o + 2] = nor[i + 2]
    }
    g.attributes.position.needsUpdate = true
    g.attributes.normal.needsUpdate = true
  }
}

/** La tela de una malla con `userData.tela` (se crea una vez por malla). */
export function telaDe(malla) {
  if (!malla?.userData?.tela) return null
  return (malla.userData.telaSim ||= new TelaProp(malla))
}
