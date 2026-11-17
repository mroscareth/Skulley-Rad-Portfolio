/**
 * Un cuerpo rígido que cae y se asienta sobre un piso plano: los lentes que se
 * le caen a Skulley cuando se los picas (PicarOjos en SkulleyFallRig).
 * Oscar, 2026-11-17: con el acomodo a mano a veces se quedaban parados en una
 * pata, "y eso en el mundo real no pasa". Aquí nada se acomoda a mano: caen con
 * gravedad, giran, chocan con el piso en sus puntos de apoyo (impulsos con
 * rebote y fricción) y se quedan quietos donde la física los deja, que solo
 * puede ser una pose apoyada en tres o más puntos con el centro de masa
 * adentro.
 *
 * Sin React ni Three, para probarse con números en Node. Vectores [x, y, z],
 * cuaterniones [x, y, z, w] (los de three), matrices 3×3 por filas.
 *
 * - `puntos`: los vértices del objeto en su marco (centrado en su centro de
 *   masa; de ellos sale la inercia, cada uno con la misma masa).
 * - `apoyos`: los que pueden tocar el piso (los del casco convexo): se sacan
 *   solos con `puntosDeApoyo(puntos)`.
 */

export const RIGIDO = {
  SUBPASOS: 6,          // por cuadro (máximo; con dt chico, menos)
  PASO_MAX: 1 / 240,
  ITERACIONES: 6,       // vueltas de impulsos por subpaso
  REBOTE: 0.3,
  REBOTE_MIN_VEL: 0.9,  // u/s: más despacio que esto no rebota (se asienta)
  FRICCION: 0.6,
  AMORTIGUA_LINEAL: 0.05,   // por segundo, en el aire
  AMORTIGUA_GIRO: 0.15,
  AMORTIGUA_GIRO_PISO: 2.0, // por segundo, tocando el piso (rueda y se frena)
  DUERME_VEL: 0.03,     // u/s y rad/s (escalado por el tamaño) para quedarse quieto
  DUERME_S: 0.4,
  HOLGURA: 0.0005,      // de penetración que se deja sin corregir
}

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const len = (a) => Math.hypot(a[0], a[1], a[2])

function mat3Inv(m) {
  const [a, b, c, d, e, f, g, h, i] = m
  const A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g
  const det = a * A + b * B + c * C
  if (Math.abs(det) < 1e-18) return [0, 0, 0, 0, 0, 0, 0, 0, 0]
  const k = 1 / det
  return [
    A * k, -(b * i - c * h) * k, (b * f - c * e) * k,
    B * k, (a * i - c * g) * k, -(a * f - c * d) * k,
    C * k, -(a * h - b * g) * k, (a * e - b * d) * k,
  ]
}
const mat3MulVec = (m, v) => [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]]

function quatToMat3(q) {
  const [x, y, z, w] = q
  return [
    1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w),
    2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w),
    2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y),
  ]
}

/** Los puntos del casco convexo que pueden tocar un plano: el más lejano en
 *  muchas direcciones repartidas en la esfera. */
export function puntosDeApoyo(puntos, direcciones = 400) {
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
  return [...elegidos].map((i) => puntos[i].slice())
}

export function crearCuerpoRigido(puntos, { apoyos = puntosDeApoyo(puntos), masa = 1 } = {}) {
  // inercia en el marco del cuerpo (masas iguales en los puntos)
  const mi = masa / Math.max(1, puntos.length)
  let xx = 0, yy = 0, zz = 0, xy = 0, xz = 0, yz = 0, tam = 0
  for (const p of puntos) {
    xx += mi * (p[1] * p[1] + p[2] * p[2])
    yy += mi * (p[0] * p[0] + p[2] * p[2])
    zz += mi * (p[0] * p[0] + p[1] * p[1])
    xy -= mi * p[0] * p[1]; xz -= mi * p[0] * p[2]; yz -= mi * p[1] * p[2]
    tam = Math.max(tam, len(p))
  }
  const iCuerpoInv = mat3Inv([xx, xy, xz, xy, yy, yz, xz, yz, zz])
  const c = {
    p: [0, 0, 0], q: [0, 0, 0, 1], v: [0, 0, 0], w: [0, 0, 0],
    apoyos, tam, invM: 1 / masa, dormido: false, quieto: 0, tocando: false,
    golpes: 0, golpe: 0,   // cuántos golpes contra el piso y la velocidad del último
  }

  const inerciaMundoInv = (R) => {
    // R · I⁻¹ · Rᵀ
    const Rt = [R[0], R[3], R[6], R[1], R[4], R[7], R[2], R[5], R[8]]
    const a = []
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) a[i * 3 + j] = R[i * 3] * iCuerpoInv[j] + R[i * 3 + 1] * iCuerpoInv[3 + j] + R[i * 3 + 2] * iCuerpoInv[6 + j]
    const b = []
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) b[i * 3 + j] = a[i * 3] * Rt[j] + a[i * 3 + 1] * Rt[3 + j] + a[i * 3 + 2] * Rt[6 + j]
    return b
  }

  const impulso = (r, J, Iinv) => {
    c.v[0] += J[0] * c.invM; c.v[1] += J[1] * c.invM; c.v[2] += J[2] * c.invM
    const dw = mat3MulVec(Iinv, cross(r, J))
    c.w[0] += dw[0]; c.w[1] += dw[1]; c.w[2] += dw[2]
  }
  const masaEfectiva = (r, n, Iinv) => c.invM + dot(n, cross(mat3MulVec(Iinv, cross(r, n)), r))

  /** Avanza `dt` segundos. `g`: gravedad (u/s²), `piso`: altura del piso. */
  c.paso = (dt, g, piso) => {
    if (c.dormido || dt <= 0) return
    const n = Math.min(RIGIDO.SUBPASOS, Math.max(1, Math.ceil(dt / RIGIDO.PASO_MAX)))
    const h = dt / n
    const N = [0, 1, 0]
    for (let s = 0; s < n; s++) {
      c.v[1] -= g * h
      // posición y giro
      c.p[0] += c.v[0] * h; c.p[1] += c.v[1] * h; c.p[2] += c.v[2] * h
      const [qx, qy, qz, qw] = c.q, [wx, wy, wz] = c.w
      c.q[0] += 0.5 * h * (wx * qw + wy * qz - wz * qy)
      c.q[1] += 0.5 * h * (wy * qw + wz * qx - wx * qz)
      c.q[2] += 0.5 * h * (wz * qw + wx * qy - wy * qx)
      c.q[3] += 0.5 * h * (-wx * qx - wy * qy - wz * qz)
      const ql = Math.hypot(c.q[0], c.q[1], c.q[2], c.q[3]) || 1
      c.q[0] /= ql; c.q[1] /= ql; c.q[2] /= ql; c.q[3] /= ql
      const R = quatToMat3(c.q)
      const Iinv = inerciaMundoInv(R)
      // los apoyos debajo del piso
      const toques = []
      let hondo = 0
      for (const a of c.apoyos) {
        const r = mat3MulVec(R, a)
        const y = c.p[1] + r[1]
        if (y <= piso + RIGIDO.HOLGURA) {
          // de cada uno, con qué velocidad venía al piso (para el rebote)
          const vp = [c.v[0] + c.w[1] * r[2] - c.w[2] * r[1], c.v[1] + c.w[2] * r[0] - c.w[0] * r[2], c.v[2] + c.w[0] * r[1] - c.w[1] * r[0]]
          toques.push({ r, vn0: vp[1], jn: 0 })
          hondo = Math.max(hondo, piso - y)
        }
      }
      c.tocando = toques.length > 0
      for (let it = 0; it < RIGIDO.ITERACIONES && toques.length; it++) {
        for (const t of toques) {
          const r = t.r
          const vp = [c.v[0] + c.w[1] * r[2] - c.w[2] * r[1], c.v[1] + c.w[2] * r[0] - c.w[0] * r[2], c.v[2] + c.w[0] * r[1] - c.w[1] * r[0]]
          // normal (acumulado y nunca negativo: el piso empuja, no jala)
          const e = -t.vn0 > RIGIDO.REBOTE_MIN_VEL ? RIGIDO.REBOTE : 0
          const objetivo = t.vn0 < 0 ? -e * t.vn0 : 0
          let dj = (objetivo - vp[1]) / masaEfectiva(r, N, Iinv)
          const nuevo = Math.max(0, t.jn + dj)
          dj = nuevo - t.jn
          t.jn = nuevo
          if (dj !== 0) impulso(r, [0, dj, 0], Iinv)
          // fricción de Coulomb, hasta FRICCION × lo que empuja el piso
          const vp2 = [c.v[0] + c.w[1] * r[2] - c.w[2] * r[1], c.v[1] + c.w[2] * r[0] - c.w[0] * r[2], c.v[2] + c.w[0] * r[1] - c.w[1] * r[0]]
          const vt = [vp2[0], 0, vp2[2]]
          const vtl = len(vt)
          if (vtl > 1e-6) {
            const T = [vt[0] / vtl, 0, vt[2] / vtl]
            let jt = -vtl / masaEfectiva(r, T, Iinv)
            const tope = RIGIDO.FRICCION * t.jn
            jt = Math.max(-tope, Math.min(tope, jt))
            impulso(r, [T[0] * jt, 0, T[2] * jt], Iinv)
          }
        }
      }
      // un golpe que se oye: lo más rápido que llegó un apoyo al piso
      let golpe = 0
      for (const t of toques) golpe = Math.max(golpe, -t.vn0)
      if (golpe > RIGIDO.REBOTE_MIN_VEL) { c.golpes++; c.golpe = golpe }
      // lo que quedó metido en el piso sale de golpe (sin agregar velocidad)
      if (hondo > RIGIDO.HOLGURA) c.p[1] += hondo - RIGIDO.HOLGURA
      // aire y roce
      const al = Math.exp(-RIGIDO.AMORTIGUA_LINEAL * h)
      const ag = Math.exp(-(c.tocando ? RIGIDO.AMORTIGUA_GIRO_PISO : RIGIDO.AMORTIGUA_GIRO) * h)
      c.v[0] *= al; c.v[1] *= al; c.v[2] *= al
      c.w[0] *= ag; c.w[1] *= ag; c.w[2] *= ag
    }
    // quieto un rato, apoyado: se duerme (y ya no cuesta nada)
    const lento = len(c.v) < RIGIDO.DUERME_VEL * Math.max(1, c.tam * 4) && len(c.w) < RIGIDO.DUERME_VEL * 4
    c.quieto = c.tocando && lento ? c.quieto + dt : 0
    if (c.quieto > RIGIDO.DUERME_S) { c.dormido = true; c.v = [0, 0, 0]; c.w = [0, 0, 0] }
  }
  return c
}
