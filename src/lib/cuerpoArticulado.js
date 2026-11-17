/**
 * Varias piezas rígidas unidas por bisagras que caen y se asientan sobre un
 * piso plano: los lentes que se le caen a Skulley al picárselos (PicarOjos en
 * SkulleyFallRig), el armazón y sus dos patas (Oscar, 2026-11-17: "sí, con
 * bisagras"; rígidos casi siempre quedaban bocabajo con las patas al cielo).
 *
 * Dinámica basada en posiciones con pasos chicos (XPBD de un paso por
 * subpaso): cada pieza es un grupo de partículas (los puntos de su casco
 * convexo, con la masa de los vértices que les quedan más cerca) que se
 * mantiene rígido por emparejamiento de forma (shape matching, con la rotación
 * de Müller et al. 2016); la bisagra son dos partículas del eje que comparten
 * el armazón y la pata, y un tope que no deja abrir de más ni cerrar de más.
 * El piso empuja, frena con fricción y rebota los golpes fuertes. Al quedarse
 * quieto, se duerme.
 *
 * Sin React ni Three, para probarse en Node. Vectores [x, y, z], cuaterniones
 * [x, y, z, w] (los de three), matrices 3×3 por filas.
 */

export const ARTICULADO = {
  SUBPASOS: 16,         // por cuadro de 60 Hz (con dt más grande, más, hasta el tope)
  SUBPASOS_MAX: 40,
  ITERACIONES: 2,
  REBOTE: 0.3,
  REBOTE_MIN_VEL: 0.9,  // u/s: más despacio no rebota
  FRICCION: 0.6,
  AMORTIGUA: 0.1,       // por segundo, en el aire
  AMORTIGUA_PISO: 1.5,  // por segundo, la parte de la velocidad de lo que toca el piso
  BISAGRA_ROCE: 4.0,    // por segundo: lo que frena el giro de la bisagra
  DUERME_VEL: 0.04,     // u/s de la partícula más rápida
  DUERME_S: 0.5,
}

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]

export function quatAMat(q) {
  const [x, y, z, w] = q
  return [
    1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w),
    2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w),
    2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y),
  ]
}
const mulMV = (m, v) => [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]]
const mulMtV = (m, v) => [m[0] * v[0] + m[3] * v[1] + m[6] * v[2], m[1] * v[0] + m[4] * v[1] + m[7] * v[2], m[2] * v[0] + m[5] * v[1] + m[8] * v[2]]
function quatMul(a, b) {
  return [
    a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
    a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
    a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
    a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
  ]
}
const quatEje = (eje, ang) => { const s = Math.sin(ang / 2); return [eje[0] * s, eje[1] * s, eje[2] * s, Math.cos(ang / 2)] }
const normQ = (q) => { const l = Math.hypot(q[0], q[1], q[2], q[3]) || 1; return [q[0] / l, q[1] / l, q[2] / l, q[3] / l] }

// La rotación más cercana a A (columnas a0, a1, a2), partiendo de q (Müller 2016).
function rotacionDe(A, q, vueltas = 6) {
  for (let k = 0; k < vueltas; k++) {
    const R = quatAMat(q)
    const r0 = [R[0], R[3], R[6]], r1 = [R[1], R[4], R[7]], r2 = [R[2], R[5], R[8]]
    const c0 = cross(r0, A[0]), c1 = cross(r1, A[1]), c2 = cross(r2, A[2])
    const den = Math.abs(dot(r0, A[0]) + dot(r1, A[1]) + dot(r2, A[2])) + 1e-9
    const om = [(c0[0] + c1[0] + c2[0]) / den, (c0[1] + c1[1] + c2[1]) / den, (c0[2] + c1[2] + c2[2]) / den]
    const w = Math.hypot(om[0], om[1], om[2])
    if (w < 1e-9) break
    q = normQ(quatMul(quatEje([om[0] / w, om[1] / w, om[2] / w], w), q))
  }
  return q
}

/** Los puntos del casco convexo (los que pueden tocar un plano): el más lejano
 *  en muchas direcciones repartidas en la esfera. Regresa índices. */
export function indicesDeApoyo(puntos, direcciones = 240) {
  const elegidos = new Set()
  const oro = Math.PI * (3 - Math.sqrt(5))
  for (let k = 0; k < direcciones; k++) {
    const y = 1 - (2 * (k + 0.5)) / direcciones
    const r = Math.sqrt(1 - y * y)
    const d = [Math.cos(oro * k) * r, y, Math.sin(oro * k) * r]
    let mejor = -Infinity, cual = 0
    for (let i = 0; i < puntos.length; i++) {
      const s = dot(puntos[i], d)
      if (s > mejor) { mejor = s; cual = i }
    }
    elegidos.add(cual)
  }
  return [...elegidos]
}

/**
 * @param {Array<{puntos: number[][]}>} partes piezas en su reposo (mismas
 *   coordenadas para todas); la 0 manda (el armazón).
 * @param {Array<{a: number, b: number, eje: number[][], dir: number[], cierra: number, abre: number}>} bisagras
 *   `eje`: dos puntos del eje (en reposo); `dir`: hacia dónde gira la pieza b
 *   al cerrarse, como signo del ángulo alrededor de eje[1] − eje[0]
 *   (ver `anguloBisagra`); `cierra` / `abre`: los topes, en radianes (cierra
 *   ≥ 0, abre ≤ 0 un poco).
 */
export function crearArticulado(partes, bisagras, { masaTotal = 1 } = {}) {
  const X = [], V = [], P = [], W = [], dueños = []   // posición, velocidad, previa, 1/masa, cuántos grupos la usan
  const grupos = partes.map(() => ({ idx: [], Q: [], m: [], c0: [0, 0, 0], q: [0, 0, 0, 1], c: [0, 0, 0], M: 0 }))
  let total = 0
  for (const p of partes) total += p.puntos.length
  const masaVertice = masaTotal / Math.max(1, total)
  const reposo = []
  partes.forEach((parte, g) => {
    const apoyos = indicesDeApoyo(parte.puntos)
    const masas = new Array(apoyos.length).fill(0)
    // la masa de cada vértice, a su partícula más cercana
    for (const v of parte.puntos) {
      let mejor = Infinity, cual = 0
      for (let k = 0; k < apoyos.length; k++) {
        const a = parte.puntos[apoyos[k]]
        const d = (a[0] - v[0]) ** 2 + (a[1] - v[1]) ** 2 + (a[2] - v[2]) ** 2
        if (d < mejor) { mejor = d; cual = k }
      }
      masas[cual] += masaVertice
    }
    apoyos.forEach((i, k) => {
      const id = X.length
      X.push(parte.puntos[i].slice()); reposo.push(parte.puntos[i].slice())
      V.push([0, 0, 0]); P.push([0, 0, 0]); W.push(masas[k] > 0 ? 1 / masas[k] : 1 / masaVertice); dueños.push(1)
      grupos[g].idx.push(id); grupos[g].m.push(Math.max(masas[k], masaVertice))
    })
  })
  // el eje de cada bisagra: dos partículas que comparten las dos piezas
  const bis = bisagras.map((b) => {
    const ids = b.eje.map((e) => {
      const id = X.length
      X.push(e.slice()); reposo.push(e.slice()); V.push([0, 0, 0]); P.push([0, 0, 0]); dueños.push(2)
      const mb = grupos[b.b].m.reduce((s, x) => s + x, 0)
      // pesadas en los dos grupos: así el eje manda en la pata
      W.push(1 / Math.max(mb, masaVertice))
      grupos[b.a].idx.push(id); grupos[b.a].m.push(mb)
      grupos[b.b].idx.push(id); grupos[b.b].m.push(mb)
      return id
    })
    const e0 = b.eje[0], e1 = b.eje[1]
    const eje = [e1[0] - e0[0], e1[1] - e0[1], e1[2] - e0[2]]
    const l = Math.hypot(eje[0], eje[1], eje[2]) || 1
    return { ...b, ids, ejeLocal: [eje[0] / l, eje[1] / l, eje[2] / l], angulo: 0 }
  })
  for (const g of grupos) {
    g.M = g.m.reduce((s, x) => s + x, 0)
    for (let k = 0; k < g.idx.length; k++) {
      const p = reposo[g.idx[k]]
      g.c0[0] += g.m[k] * p[0]; g.c0[1] += g.m[k] * p[1]; g.c0[2] += g.m[k] * p[2]
    }
    g.c0 = g.c0.map((v) => v / g.M)
    g.Q = g.idx.map((i) => [reposo[i][0] - g.c0[0], reposo[i][1] - g.c0[1], reposo[i][2] - g.c0[2]])
  }

  const cuerpo = { X, V, grupos, bisagras: bis, dormido: false, quieto: 0, golpes: 0, golpe: 0 }

  /** Pone todo en la pose `R` (cuaternión), trasladado `t`, con velocidad
   *  `v` y giro `w` alrededor del centro de masa. */
  cuerpo.colocar = (q, t, v = [0, 0, 0], w = [0, 0, 0]) => {
    const R = quatAMat(q)
    let cm = [0, 0, 0], mt = 0
    for (let i = 0; i < X.length; i++) {
      const p = mulMV(R, reposo[i])
      X[i] = [p[0] + t[0], p[1] + t[1], p[2] + t[2]]
      const m = 1 / W[i]
      cm = [cm[0] + m * X[i][0], cm[1] + m * X[i][1], cm[2] + m * X[i][2]]; mt += m
    }
    cm = cm.map((c) => c / mt)
    for (let i = 0; i < X.length; i++) {
      const r = [X[i][0] - cm[0], X[i][1] - cm[1], X[i][2] - cm[2]]
      const wr = cross(w, r)
      V[i] = [v[0] + wr[0], v[1] + wr[1], v[2] + wr[2]]
    }
    for (const g of grupos) g.q = q.slice()
    cuerpo.dormido = false
    cuerpo.quieto = 0
    emparejar()
  }

  // Cada grupo vuelve a su forma (su centro y su giro de este momento); las
  // partículas compartidas toman el promedio.
  const acum = X.map(() => [0, 0, 0])
  const cuenta = X.map(() => 0)
  function emparejar() {
    for (let i = 0; i < X.length; i++) { acum[i][0] = acum[i][1] = acum[i][2] = 0; cuenta[i] = 0 }
    for (const g of grupos) {
      const c = [0, 0, 0]
      for (let k = 0; k < g.idx.length; k++) { const x = X[g.idx[k]]; c[0] += g.m[k] * x[0]; c[1] += g.m[k] * x[1]; c[2] += g.m[k] * x[2] }
      c[0] /= g.M; c[1] /= g.M; c[2] /= g.M
      const A = [[0, 0, 0], [0, 0, 0], [0, 0, 0]]
      for (let k = 0; k < g.idx.length; k++) {
        const x = X[g.idx[k]], Q = g.Q[k], m = g.m[k]
        const d = [x[0] - c[0], x[1] - c[1], x[2] - c[2]]
        for (let j = 0; j < 3; j++) { A[j][0] += m * d[0] * Q[j]; A[j][1] += m * d[1] * Q[j]; A[j][2] += m * d[2] * Q[j] }
      }
      g.q = rotacionDe(A, g.q)
      g.c = c
      const R = quatAMat(g.q)
      for (let k = 0; k < g.idx.length; k++) {
        const i = g.idx[k]
        const r = mulMV(R, g.Q[k])
        acum[i][0] += c[0] + r[0]; acum[i][1] += c[1] + r[1]; acum[i][2] += c[2] + r[2]; cuenta[i]++
      }
    }
    for (let i = 0; i < X.length; i++) {
      if (!cuenta[i]) continue
      X[i][0] = acum[i][0] / cuenta[i]; X[i][1] = acum[i][1] / cuenta[i]; X[i][2] = acum[i][2] / cuenta[i]
    }
  }

  // El ángulo de cada bisagra (0 = como vienen, abiertos; positivo, cerrando)
  // y el tope: la pata se gira alrededor del eje lo que se pasó.
  function topes() {
    for (const b of bis) {
      const A = grupos[b.a], B = grupos[b.b]
      const Ra = quatAMat(A.q), Rb = quatAMat(B.q)
      // giro relativo de b en el marco de a, alrededor del eje
      const rel = (() => {
        // Rrel = Raᵀ · Rb
        const m = []
        for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) m[i * 3 + j] = Ra[i] * Rb[j] + Ra[3 + i] * Rb[3 + j] + Ra[6 + i] * Rb[6 + j]
        return m
      })()
      // ángulo alrededor del eje local: del vector perpendicular al eje
      const e = b.ejeLocal
      const perp = Math.abs(e[0]) < 0.9 ? cross(e, [1, 0, 0]) : cross(e, [0, 1, 0])
      const pl = Math.hypot(perp[0], perp[1], perp[2]); const u = perp.map((x) => x / pl)
      const ru = mulMV(rel, u)
      const vu = cross(e, u)
      const ang = Math.atan2(dot(ru, vu), dot(ru, u)) * b.dir
      b.angulo = ang
      const lim = Math.max(b.abre, Math.min(b.cierra, ang))
      if (lim === ang) continue
      // El tope gira a las dos piezas alrededor del eje, cada una según su
      // inercia alrededor de él (girando solo la pata, el tope empujaba sin
      // reacción y el armazón se iba acelerando solo).
      const ejeM = mulMV(Ra, e)
      const piv = X[b.ids[0]].slice()
      const inercia = (G, excluir) => {
        let I = 0
        for (let k = 0; k < G.idx.length; k++) {
          const i = G.idx[k]
          if (excluir(i)) continue
          const r = [X[i][0] - piv[0], X[i][1] - piv[1], X[i][2] - piv[2]]
          const ax = dot(r, ejeM)
          I += G.m[k] * Math.max(0, dot(r, r) - ax * ax)
        }
        return I
      }
      const propio = (i) => dueños[i] > 1
      const delEje = (i) => b.ids.includes(i)
      const Ib = inercia(B, propio), Ia = inercia(A, delEje)
      const falta = (lim - ang) * b.dir
      const girar = (G, ang2, excluir) => {
        if (Math.abs(ang2) < 1e-9) return
        const R = quatAMat(quatEje(ejeM, ang2))
        for (let k = 0; k < G.idx.length; k++) {
          const i = G.idx[k]
          if (excluir(i)) continue
          const r = [X[i][0] - piv[0], X[i][1] - piv[1], X[i][2] - piv[2]]
          const g = mulMV(R, r)
          X[i] = [piv[0] + g[0], piv[1] + g[1], piv[2] + g[2]]
        }
        G.q = normQ(quatMul(quatEje(ejeM, ang2), G.q))
      }
      const reparto = Ia / Math.max(1e-12, Ia + Ib)
      girar(B, falta * reparto, propio)
      girar(A, -falta * (1 - reparto), delEje)
    }
  }

  /** Avanza `dt` segundos con gravedad `g` (u/s²) sobre el piso `piso`. */
  cuerpo.paso = (dt, g, piso) => {
    if (cuerpo.dormido || dt <= 0) return
    const n = Math.min(ARTICULADO.SUBPASOS_MAX, Math.max(1, Math.ceil(dt * 60 * ARTICULADO.SUBPASOS)))
    const h = dt / n
    const N = X.length
    for (let s = 0; s < n; s++) {
      const vy0 = new Array(N)
      for (let i = 0; i < N; i++) {
        V[i][1] -= g * h
        vy0[i] = V[i][1]
        P[i][0] = X[i][0]; P[i][1] = X[i][1]; P[i][2] = X[i][2]
        X[i][0] += V[i][0] * h; X[i][1] += V[i][1] * h; X[i][2] += V[i][2] * h
      }
      const toca = new Array(N).fill(false)
      for (let it = 0; it < ARTICULADO.ITERACIONES; it++) {
        emparejar()
        topes()
        // piso: empuja y frena (fricción de Coulomb sobre el desplazamiento)
        for (let i = 0; i < N; i++) {
          const pen = piso - X[i][1]
          if (pen <= 0) continue
          X[i][1] = piso
          toca[i] = true
          const dx = X[i][0] - P[i][0], dz = X[i][2] - P[i][2]
          const dl = Math.hypot(dx, dz)
          if (dl < 1e-9) continue
          const frena = Math.min(1, (ARTICULADO.FRICCION * pen) / dl)
          X[i][0] -= dx * frena; X[i][2] -= dz * frena
        }
      }
      let golpe = 0
      const amort = Math.exp(-ARTICULADO.AMORTIGUA * h)
      const amortPiso = Math.exp(-ARTICULADO.AMORTIGUA_PISO * h)
      for (let i = 0; i < N; i++) {
        V[i][0] = (X[i][0] - P[i][0]) / h * amort
        V[i][1] = (X[i][1] - P[i][1]) / h * amort
        V[i][2] = (X[i][2] - P[i][2]) / h * amort
        if (toca[i]) {
          // rebote de los golpes fuertes, con la velocidad con que llegó
          if (-vy0[i] > ARTICULADO.REBOTE_MIN_VEL) { V[i][1] = Math.max(V[i][1], -vy0[i] * ARTICULADO.REBOTE); golpe = Math.max(golpe, -vy0[i]) }
          V[i][0] *= amortPiso; V[i][2] *= amortPiso
        }
      }
      // el roce de la bisagra: la pata pierde giro respecto al armazón
      roceBisagras(h)
      if (golpe > 0) { cuerpo.golpes++; cuerpo.golpe = golpe }
    }
    let vmax = 0
    for (let i = 0; i < N; i++) vmax = Math.max(vmax, Math.hypot(V[i][0], V[i][1], V[i][2]))
    let alguno = false
    for (let i = 0; i < N; i++) if (X[i][1] <= piso + 1e-4) { alguno = true; break }
    cuerpo.quieto = alguno && vmax < ARTICULADO.DUERME_VEL ? cuerpo.quieto + dt : 0
    // solo se duerme bien apoyado: el centro de masa adentro de lo que toca el
    // piso (si no, se está empezando a vencer despacio)
    if (cuerpo.quieto > ARTICULADO.DUERME_S && !apoyado(piso)) cuerpo.quieto = ARTICULADO.DUERME_S * 0.5
    if (cuerpo.quieto > ARTICULADO.DUERME_S) {
      cuerpo.dormido = true
      for (let i = 0; i < N; i++) V[i] = [0, 0, 0]
    }
  }

  // ¿El centro de masa cae adentro del casco de lo que toca el piso? Con
  // holgura: el peso de cada pata llega al armazón por el eje de su bisagra
  // (así se acoplan) y no desde su propio centro, y el equilibrio del modelo
  // queda a un par de centímetros del de verdad (medido en Node).
  function apoyado(piso, margen = -0.025) {
    let cx = 0, cz = 0, mt = 0
    const toca = []
    for (let i = 0; i < X.length; i++) {
      const m = 1 / W[i]
      cx += m * X[i][0]; cz += m * X[i][2]; mt += m
      if (X[i][1] <= piso + 0.002) toca.push([X[i][0], X[i][2]])
    }
    cx /= mt; cz /= mt
    if (toca.length < 3) return false
    toca.sort((a, b) => a[0] - b[0] || a[1] - b[1])
    const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
    const lo = [], up = []
    for (const p of toca) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p) }
    for (let k = toca.length - 1; k >= 0; k--) { const p = toca[k]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p) }
    const H = lo.slice(0, -1).concat(up.slice(0, -1))
    if (H.length < 3) return false
    for (let k = 0; k < H.length; k++) {
      const a = H[k], b = H[(k + 1) % H.length]
      const ex = b[0] - a[0], ey = b[1] - a[1], l = Math.hypot(ex, ey) || 1
      if ((-(cx - a[0]) * ey + (cz - a[1]) * ex) / l < margen) return false
    }
    return true
  }

  // La pata pierde parte de lo que se mueve respecto a su eje (el roce de la
  // bisagra): así no es un columpio.
  function roceBisagras(h) {
    const k = 1 - Math.exp(-ARTICULADO.BISAGRA_ROCE * h)
    if (k <= 0) return
    for (const b of bis) {
      const B = grupos[b.b]
      let vb = [0, 0, 0]
      for (let j = 0; j < B.idx.length; j++) { const i = B.idx[j]; const m = B.m[j]; vb = [vb[0] + m * V[i][0], vb[1] + m * V[i][1], vb[2] + m * V[i][2]] }
      vb = vb.map((x) => x / B.M)
      const ve = V[b.ids[0]], vf = V[b.ids[1]]
      const d = [((ve[0] + vf[0]) / 2 - vb[0]) * k, ((ve[1] + vf[1]) / 2 - vb[1]) * k, ((ve[2] + vf[2]) / 2 - vb[2]) * k]
      for (let j = 0; j < B.idx.length; j++) {
        const i = B.idx[j]
        if (dueños[i] > 1) continue
        V[i][0] += d[0]; V[i][1] += d[1]; V[i][2] += d[2]
      }
    }
  }

  /** El centro y el giro de cada pieza (para dibujarla). */
  cuerpo.piezas = () => grupos.map((g) => ({ c: g.c.slice(), q: g.q.slice(), c0: g.c0.slice() }))
  return cuerpo
}

/** Ángulo de una bisagra (para revisar). */
export const anguloBisagra = (cuerpo, k) => cuerpo.bisagras[k].angulo
