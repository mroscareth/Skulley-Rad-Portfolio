/**
 * Las piezas de Skulley cuando se despieza en la experiencia completa (el rayo
 * de la esfera corrupta, el castigo de M.A.D.R.E., el empujón de Argus, el
 * easter egg): cada pieza es un cuerpo rígido que cae, gira, rebota y se
 * asienta en el piso. Oscar, 2026-11-17: atravesaban el piso, "se ve chafa".
 *
 * Antes cada pieza era un punto con una distancia fija al piso, así que al
 * girar se metía. Aquí toca el piso con los puntos de su casco convexo (los
 * únicos que pueden tocar un plano), con impulsos que rebotan los golpes
 * fuertes y frenan con fricción de Coulomb, y la inercia sale de sus
 * vértices. Los puntos del casco salen de 400 direcciones, y entre ellas se
 * escapan vértices (hasta 6 mm en las bandas del torso): por eso, cerca del
 * piso, cada subpaso busca además el vértice de verdad más bajo (con las
 * celdas cuesta casi nada) y, si queda abajo de los apoyos, se vuelve uno.
 * Se duerme cuando se queda quieta apoyada: con el centro de masa sobre lo
 * que toca el piso.
 *
 * Sin three, para probarse en Node con las piezas reales. Vectores [x, y, z],
 * cuaterniones [x, y, z, w] (los de three), matrices 3×3 por filas. Nada se
 * crea dentro del paso: corre cada cuadro con veinte piezas.
 */

export const CAIDA = {
  PASO_MAX: 1 / 240,     // tamaño máximo del subpaso
  SUBPASOS_MAX: 24,      // un cuadro de 100 ms (el tope de Player) en pasos de 1/240
  ITERACIONES: 8,        // vueltas de impulsos por subpaso
  REBOTE: 0.3,
  REBOTE_MIN_VEL: 2,     // u/s: más despacio no rebota, se asienta
  FRICCION: 0.75,
  // En el aire, el mismo freno que tenían antes (0.992 y 0.985 por cuadro a
  // 60 Hz): sin él las piezas salían volando el doble de lejos.
  AMORTIGUA_LINEAL: 0.48,   // por segundo
  AMORTIGUA_GIRO: 0.9,
  AMORTIGUA_GIRO_PISO: 7,   // por segundo, tocando el piso: rueda y se frena
  // Ya casi quieta en el piso se frena más, para que se quede y no se arrastre.
  REPOSO_VEL: 0.6,       // u/s
  REPOSO: 10,            // por segundo
  DUERME_VEL: 0.07,      // u/s del centro y de la orilla de la pieza (~1 mm por cuadro)
  DUERME_S: 0.2,
  HOLGURA: 0.0005,       // u: un apoyo a esta altura del piso ya cuenta como contacto
  TOCA: 0.002,           // u: a esta altura del piso un apoyo cuenta como apoyado
  APOYO_MARGEN: 0.012,   // fracción del tamaño: el centro de masa puede quedar así de fuera
}

const _dirs = new Map()
function direccionesEsfera(n) {
  let d = _dirs.get(n)
  if (d) return d
  d = new Float64Array(n * 3)
  const oro = Math.PI * (3 - Math.sqrt(5))
  for (let k = 0; k < n; k++) {
    const y = 1 - (2 * (k + 0.5)) / n
    const r = Math.sqrt(1 - y * y)
    d[k * 3] = Math.cos(oro * k) * r; d[k * 3 + 1] = y; d[k * 3 + 2] = Math.sin(oro * k) * r
  }
  _dirs.set(n, d)
  return d
}

/**
 * Los puntos de una pieza en celdas, cada una con la caja de sus puntos: así
 * el punto más lejano en una dirección (`soporte`) solo revisa las celdas
 * cuya caja podría pasar al mejor hasta ahora.
 */
export function armarCeldas(pos) {
  const n = pos.length / 3
  let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity
  for (let i = 0; i < n * 3; i += 3) {
    const x = pos[i], y = pos[i + 1], z = pos[i + 2]
    if (x < x0) x0 = x; if (x > x1) x1 = x
    if (y < y0) y0 = y; if (y > y1) y1 = y
    if (z < z0) z0 = z; if (z > z1) z1 = z
  }
  const ex = Math.max(x1 - x0, 1e-9), ey = Math.max(y1 - y0, 1e-9), ez = Math.max(z1 - z0, 1e-9)
  // pocas celdas con pocos puntos (con 800 o menos, una sola: se revisan todos)
  const C = n <= 800 ? 1 : Math.min(2000, Math.round(Math.sqrt(n * 8)))
  const lado = Math.cbrt((ex * ey * ez) / C)
  const nx = C === 1 ? 1 : Math.max(1, Math.min(64, Math.round(ex / lado)))
  const ny = C === 1 ? 1 : Math.max(1, Math.min(64, Math.round(ey / lado)))
  const nz = C === 1 ? 1 : Math.max(1, Math.min(64, Math.round(ez / lado)))
  const total = nx * ny * nz
  const celdaDe = new Int32Array(n)
  const cuenta = new Int32Array(total + 1)
  for (let i = 0; i < n; i++) {
    const cx = Math.min(nx - 1, ((pos[i * 3] - x0) / ex * nx) | 0)
    const cy = Math.min(ny - 1, ((pos[i * 3 + 1] - y0) / ey * ny) | 0)
    const cz = Math.min(nz - 1, ((pos[i * 3 + 2] - z0) / ez * nz) | 0)
    const c = (cz * ny + cy) * nx + cx
    celdaDe[i] = c
    cuenta[c + 1]++
  }
  for (let c = 0; c < total; c++) cuenta[c + 1] += cuenta[c]
  const orden = new Int32Array(n)
  const lleno = cuenta.slice(0, total)
  for (let i = 0; i < n; i++) orden[lleno[celdaDe[i]]++] = i
  const ini = [], fin = [], cajas = []
  for (let c = 0; c < total; c++) {
    if (cuenta[c + 1] === cuenta[c]) continue
    let a0 = Infinity, b0 = Infinity, c0 = Infinity, a1 = -Infinity, b1 = -Infinity, c1 = -Infinity
    for (let k = cuenta[c]; k < cuenta[c + 1]; k++) {
      const i = orden[k] * 3
      const x = pos[i], y = pos[i + 1], z = pos[i + 2]
      if (x < a0) a0 = x; if (x > a1) a1 = x
      if (y < b0) b0 = y; if (y > b1) b1 = y
      if (z < c0) c0 = z; if (z > c1) c1 = z
    }
    ini.push(cuenta[c]); fin.push(cuenta[c + 1]); cajas.push(a0, b0, c0, a1, b1, c1)
  }
  return { pos, orden, ini: Int32Array.from(ini), fin: Int32Array.from(fin), cajas: Float64Array.from(cajas), cota: new Float64Array(ini.length) }
}

/** El índice del punto más lejano en la dirección (dx, dy, dz). Exacto. */
export function soporte(celdas, dx, dy, dz) {
  const { pos, orden, ini, fin, cajas, cota } = celdas
  const nc = ini.length
  const ox = dx > 0 ? 3 : 0, oy = dy > 0 ? 4 : 1, oz = dz > 0 ? 5 : 2
  let arriba = 0
  for (let c = 0; c < nc; c++) {
    const k = c * 6
    const u = cajas[k + ox] * dx + cajas[k + oy] * dy + cajas[k + oz] * dz
    cota[c] = u
    if (u > cota[arriba]) arriba = c
  }
  let mejor = -Infinity, cual = 0
  for (let k = ini[arriba]; k < fin[arriba]; k++) {
    const i = orden[k]
    const s = pos[i * 3] * dx + pos[i * 3 + 1] * dy + pos[i * 3 + 2] * dz
    if (s > mejor) { mejor = s; cual = i }
  }
  for (let c = 0; c < nc; c++) {
    if (c === arriba || cota[c] <= mejor) continue
    for (let k = ini[c]; k < fin[c]; k++) {
      const i = orden[k]
      const s = pos[i * 3] * dx + pos[i * 3 + 1] * dy + pos[i * 3 + 2] * dz
      if (s > mejor) { mejor = s; cual = i }
    }
  }
  return cual
}

/**
 * Busca los vértices del casco convexo: el más lejano en muchas direcciones
 * repartidas en la esfera. Va por partes (`avanza(direcciones)` regresa true
 * al terminar; la primera vuelta arma las celdas, que quedan en `celdas`)
 * para repartirlo en varios cuadros mientras la pieza va en el aire.
 */
export function crearBuscadorApoyos(pos, { direcciones = 400 } = {}) {
  const D = direccionesEsfera(direcciones)
  const elegidos = new Set()
  let d = 0
  const b = {
    listo: pos.length === 0,
    celdas: null,
    avanza(cuantas = Infinity) {
      if (b.listo) return true
      if (!b.celdas) { b.celdas = armarCeldas(pos); return false }
      const hasta = Math.min(direcciones, d + cuantas)
      for (; d < hasta; d++) elegidos.add(soporte(b.celdas, D[d * 3], D[d * 3 + 1], D[d * 3 + 2]))
      if (d >= direcciones) b.listo = true
      return b.listo
    },
    indices: () => [...elegidos],
  }
  return b
}

/** Los índices del casco de una vez (para Node y para piezas chicas). */
export function indicesDeApoyo(pos, opciones) {
  const b = crearBuscadorApoyos(pos, opciones)
  while (!b.avanza()) { /* la primera vuelta arma las celdas */ }
  return b.indices()
}

function inv3(m) {
  const [a, b, c, d, e, f, g, h, i] = m
  const A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g
  const det = a * A + b * B + c * C
  if (Math.abs(det) < 1e-30) return [0, 0, 0, 0, 0, 0, 0, 0, 0]
  const k = 1 / det
  return [
    A * k, -(b * i - c * h) * k, (b * f - c * e) * k,
    B * k, (a * i - c * g) * k, -(a * f - c * d) * k,
    C * k, -(a * h - b * g) * k, (a * e - b * d) * k,
  ]
}

/**
 * Lo que la física necesita de una pieza, en el marco de su malla (el de
 * `mesh.position` / `mesh.quaternion`): su centro de masa, sus apoyos
 * relativos a él, la inversa de su inercia (masa 1: con un solo piso la masa
 * no cambia nada) y su tamaño. La masa va pareja en los vértices.
 * `apoyos`: índices de `indicesDeApoyo` (si no, se buscan aquí), o 'caja'
 * para empezar con las esquinas de su caja (ver `ponerApoyos`).
 */
export function describirPieza(pos, { apoyos = null, muestra = 6000 } = {}) {
  const n = pos.length / 3
  // centro e inercia de una muestra pareja (con 30 mil vértices sobran)
  const salto = Math.max(1, Math.ceil(n / muestra)) * 3
  let cx = 0, cy = 0, cz = 0, m = 0
  for (let i = 0; i < pos.length; i += salto) { cx += pos[i]; cy += pos[i + 1]; cz += pos[i + 2]; m++ }
  cx /= m || 1; cy /= m || 1; cz /= m || 1
  let xx = 0, yy = 0, zz = 0, xy = 0, xz = 0, yz = 0
  for (let i = 0; i < pos.length; i += salto) {
    const x = pos[i] - cx, y = pos[i + 1] - cy, z = pos[i + 2] - cz
    xx += y * y + z * z; yy += x * x + z * z; zz += x * x + y * y
    xy -= x * y; xz -= x * z; yz -= y * z
  }
  const desc = { com: [cx, cy, cz], apoyos: null, nAp: 0, iInv: null, tam: 0, alcance: 0 }
  if (apoyos === 'caja') {
    // provisional mientras se buscan los de verdad: las esquinas de la caja,
    // que envuelven a la pieza (puede flotar un poco, nunca meterse)
    let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity
    for (let i = 0; i < pos.length; i += 3) {
      const x = pos[i], y = pos[i + 1], z = pos[i + 2]
      if (x < x0) x0 = x; if (x > x1) x1 = x
      if (y < y0) y0 = y; if (y > y1) y1 = y
      if (z < z0) z0 = z; if (z > z1) z1 = z
    }
    const esq = []
    for (let k = 0; k < 8; k++) esq.push((k & 1 ? x1 : x0) - cx, (k & 2 ? y1 : y0) - cy, (k & 4 ? z1 : z0) - cz)
    fijarApoyos(desc, esq, 8)
  } else {
    const idx = apoyos || indicesDeApoyo(pos)
    const rel = []
    for (let k = 0; k < idx.length; k++) { const i = idx[k] * 3; rel.push(pos[i] - cx, pos[i + 1] - cy, pos[i + 2] - cz) }
    fijarApoyos(desc, rel, idx.length)
  }
  const mi = 1 / (m || 1)
  // un piso de inercia: una pieza casi plana o casi una línea no gira infinito
  const e = 1e-4 * desc.tam * desc.tam
  desc.iInv = inv3([xx * mi + e, xy * mi, xz * mi, xy * mi, yy * mi + e, yz * mi, xz * mi, yz * mi, zz * mi + e])
  return desc
}

// Los apoyos (relativos al centro de masa) con lugar para los que se agreguen.
function fijarApoyos(desc, rel, n) {
  const cap = n + 64
  desc.apoyos = new Float64Array(cap * 3)
  desc.apoyos.set(rel.length > cap * 3 ? rel.slice(0, cap * 3) : rel)
  desc.nAp = n
  let tam = 0
  for (let k = 0; k < n; k++) tam = Math.max(tam, Math.hypot(rel[k * 3], rel[k * 3 + 1], rel[k * 3 + 2]))
  desc.tam = Math.max(tam, 1e-4)
  // hasta dónde puede llegar un vértice que no es apoyo (con holgura)
  desc.alcance = desc.tam * 1.03 + 0.002
}

export function crearPieza(desc) {
  const c = {
    desc,
    p: [0, 0, 0], q: [0, 0, 0, 1], v: [0, 0, 0], w: [0, 0, 0],
    R: [1, 0, 0, 0, 1, 0, 0, 0, 1], Iw: desc.iInv.slice(),
    dormido: false, quieto: 0, tocando: false,
    golpes: 0, golpe: 0,
    celdas: null,           // las de todos sus vértices, para buscar el más bajo
    extra: new Set(),       // vértices que se volvieron apoyo por estar abajo
    agregados: 0,
  }
  reservar(c)
  return c
}

// por contacto: brazo, velocidad con que llegó, impulsos acumulados
function reservar(c) {
  const cap = c.desc.apoyos.length / 3
  c._r = new Float64Array(cap * 3); c._vn0 = new Float64Array(cap); c._jn = new Float64Array(cap)
  c._jt = new Float64Array(cap * 2); c._kn = new Float64Array(cap)
}

/** Desde aquí busca en cada subpaso el vértice de verdad más bajo (`celdas`
 *  de `armarCeldas` o del buscador, sobre los mismos vértices). */
export function ponerCeldas(c, celdas) { c.celdas = celdas }

/** Cambia los apoyos provisionales (la caja) por los del casco, ya buscados
 *  (`indices` sobre `pos`, los mismos vértices de `describirPieza`), más los
 *  que ya se habían agregado por quedar abajo. */
export function ponerApoyos(c, pos, indices) {
  const m = c.desc.com
  const todos = new Set(indices)
  for (const i of c.extra) todos.add(i)
  const rel = []
  for (const i of todos) rel.push(pos[i * 3] - m[0], pos[i * 3 + 1] - m[1], pos[i * 3 + 2] - m[2])
  c.extra = todos
  fijarApoyos(c.desc, rel, todos.size)
  reservar(c)
}

function agregarApoyo(c, i, bx, by, bz) {
  const d = c.desc
  if (d.nAp * 3 >= d.apoyos.length) {
    const mas = new Float64Array(d.apoyos.length * 2)
    mas.set(d.apoyos)
    d.apoyos = mas
    const r = c._r, vn0 = c._vn0, jn = c._jn, jt = c._jt, kn = c._kn
    reservar(c)
    c._r.set(r); c._vn0.set(vn0); c._jn.set(jn); c._jt.set(jt); c._kn.set(kn)
  }
  d.apoyos[d.nAp * 3] = bx; d.apoyos[d.nAp * 3 + 1] = by; d.apoyos[d.nAp * 3 + 2] = bz
  d.nAp++
  c.extra.add(i)
  c.agregados++
}

function aMatriz(q, R) {
  const [x, y, z, w] = q
  R[0] = 1 - 2 * (y * y + z * z); R[1] = 2 * (x * y - z * w); R[2] = 2 * (x * z + y * w)
  R[3] = 2 * (x * y + z * w); R[4] = 1 - 2 * (x * x + z * z); R[5] = 2 * (y * z - x * w)
  R[6] = 2 * (x * z - y * w); R[7] = 2 * (y * z + x * w); R[8] = 1 - 2 * (x * x + y * y)
}

// R · I⁻¹ · Rᵀ
const _a = new Float64Array(9)
function inerciaMundo(c) {
  const R = c.R, B = c.desc.iInv, out = c.Iw
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) _a[i * 3 + j] = R[i * 3] * B[j] + R[i * 3 + 1] * B[3 + j] + R[i * 3 + 2] * B[6 + j]
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) out[i * 3 + j] = _a[i * 3] * R[j * 3] + _a[i * 3 + 1] * R[j * 3 + 1] + _a[i * 3 + 2] * R[j * 3 + 2]
}

/** La pieza en la pose de su malla (posición y giro del origen de la malla),
 *  con velocidad `v` y giro `w`. */
export function colocarPieza(c, origen, q, v = [0, 0, 0], w = [0, 0, 0]) {
  c.q[0] = q[0]; c.q[1] = q[1]; c.q[2] = q[2]; c.q[3] = q[3]
  aMatriz(c.q, c.R)
  const m = c.desc.com, R = c.R
  c.p[0] = origen[0] + R[0] * m[0] + R[1] * m[1] + R[2] * m[2]
  c.p[1] = origen[1] + R[3] * m[0] + R[4] * m[1] + R[5] * m[2]
  c.p[2] = origen[2] + R[6] * m[0] + R[7] * m[1] + R[8] * m[2]
  c.v[0] = v[0]; c.v[1] = v[1]; c.v[2] = v[2]
  c.w[0] = w[0]; c.w[1] = w[1]; c.w[2] = w[2]
  c.dormido = false; c.quieto = 0
}

/** Dónde va el origen de la malla (para dibujarla): p − R · com. */
export function origenDePieza(c, out) {
  const m = c.desc.com, R = c.R
  out[0] = c.p[0] - (R[0] * m[0] + R[1] * m[1] + R[2] * m[2])
  out[1] = c.p[1] - (R[3] * m[0] + R[4] * m[1] + R[5] * m[2])
  out[2] = c.p[2] - (R[6] * m[0] + R[7] * m[1] + R[8] * m[2])
  return out
}

export function despertar(c) { c.dormido = false; c.quieto = 0 }

/** Avanza `dt` segundos con gravedad `g` (u/s², hacia −y) sobre el piso `piso`. */
export function pasoPieza(c, dt, g, piso) {
  if (c.dormido || dt <= 0) return
  const n = Math.min(CAIDA.SUBPASOS_MAX, Math.max(1, Math.ceil(dt / CAIDA.PASO_MAX - 1e-9)))
  const h = dt / n
  const p = c.p, q = c.q, v = c.v, w = c.w, R = c.R, I = c.Iw
  const tam = c.desc.tam
  const al = Math.exp(-CAIDA.AMORTIGUA_LINEAL * h)
  const ar = Math.exp(-CAIDA.REPOSO * h)
  let tocoAlguna = false
  for (let s = 0; s < n; s++) {
    v[1] -= g * h
    p[0] += v[0] * h; p[1] += v[1] * h; p[2] += v[2] * h
    const qx = q[0], qy = q[1], qz = q[2], qw = q[3], wx = w[0], wy = w[1], wz = w[2]
    q[0] += 0.5 * h * (wx * qw + wy * qz - wz * qy)
    q[1] += 0.5 * h * (wy * qw + wz * qx - wx * qz)
    q[2] += 0.5 * h * (wz * qw + wx * qy - wy * qx)
    q[3] += 0.5 * h * (-wx * qx - wy * qy - wz * qz)
    const ql = Math.hypot(q[0], q[1], q[2], q[3]) || 1
    q[0] /= ql; q[1] /= ql; q[2] /= ql; q[3] /= ql
    aMatriz(q, R)
    // lejos del piso: ni se buscan contactos
    let k = 0, hondo = 0
    if (p[1] - c.desc.alcance <= piso + CAIDA.HOLGURA) {
      inerciaMundo(c)
      k = contactos(c, piso)
      for (let j = 0; j < k; j++) hondo = Math.max(hondo, piso - (p[1] + c._r[j * 3 + 1]))
    }
    if (k) {
      tocoAlguna = true
      resolver(c, k)
      let golpe = 0
      for (let j = 0; j < k; j++) golpe = Math.max(golpe, -c._vn0[j])
      if (golpe > CAIDA.REBOTE_MIN_VEL) { c.golpes++; c.golpe = golpe }
      // lo que quedó metido sale de golpe, sin agregar velocidad (la holgura
      // es hacia arriba: los apoyos cuentan desde antes de tocar)
      if (hondo > 0) p[1] += hondo
    }
    const ag = Math.exp(-(k ? CAIDA.AMORTIGUA_GIRO_PISO : CAIDA.AMORTIGUA_GIRO) * h)
    v[0] *= al; v[1] *= al; v[2] *= al
    w[0] *= ag; w[1] *= ag; w[2] *= ag
    if (k && Math.hypot(v[0], v[1], v[2]) < CAIDA.REPOSO_VEL && Math.hypot(w[0], w[1], w[2]) * tam < CAIDA.REPOSO_VEL) {
      v[0] *= ar; v[2] *= ar; w[0] *= ar; w[1] *= ar; w[2] *= ar
    }
  }
  c.tocando = tocoAlguna
  const lento = Math.hypot(v[0], v[1], v[2]) < CAIDA.DUERME_VEL && Math.hypot(w[0], w[1], w[2]) * tam < CAIDA.DUERME_VEL
  c.quieto = tocoAlguna && lento ? c.quieto + dt : 0
  // solo se duerme bien apoyada (si no, se está empezando a vencer despacio)
  if (c.quieto > CAIDA.DUERME_S && fueraDelApoyo(c, piso) > CAIDA.APOYO_MARGEN * tam) c.quieto = CAIDA.DUERME_S * 0.5
  if (c.quieto > CAIDA.DUERME_S) {
    c.dormido = true
    v[0] = v[1] = v[2] = 0; w[0] = w[1] = w[2] = 0
  }
}

// Los apoyos debajo del piso (más el vértice de verdad más bajo, si queda
// abajo de todos los apoyos): brazo, velocidad con que llega y masa efectiva.
function contactos(c, piso) {
  const ap = c.desc.apoyos, p = c.p, v = c.v, w = c.w, R = c.R
  let k = 0, minAp = Infinity
  const nA = c.desc.nAp
  for (let a = 0; a < nA; a++) {
    const bx = ap[a * 3], by = ap[a * 3 + 1], bz = ap[a * 3 + 2]
    const y = p[1] + R[3] * bx + R[4] * by + R[5] * bz
    if (y < minAp) minAp = y
    if (y > piso + CAIDA.HOLGURA) continue
    k = anotar(c, k, bx, by, bz)
  }
  // el más bajo de todos los vértices: el que queda más lejos hacia abajo,
  // en el marco de la pieza Rᵀ·(0, −1, 0)
  if (c.celdas && minAp - 0.02 * c.desc.tam <= piso + CAIDA.HOLGURA) {
    const i = soporte(c.celdas, -R[3], -R[4], -R[5])
    if (!c.extra.has(i)) {
      const pos = c.celdas.pos, m = c.desc.com
      const bx = pos[i * 3] - m[0], by = pos[i * 3 + 1] - m[1], bz = pos[i * 3 + 2] - m[2]
      const y = p[1] + R[3] * bx + R[4] * by + R[5] * bz
      if (y < minAp - 1e-7) {
        agregarApoyo(c, i, bx, by, bz)
        if (y <= piso + CAIDA.HOLGURA) k = anotar(c, k, bx, by, bz)
      }
    }
  }
  return k
}

function anotar(c, k, bx, by, bz) {
  const R = c.R, v = c.v, w = c.w, I = c.Iw
  const rx = R[0] * bx + R[1] * by + R[2] * bz
  const ry = R[3] * bx + R[4] * by + R[5] * bz
  const rz = R[6] * bx + R[7] * by + R[8] * bz
  c._r[k * 3] = rx; c._r[k * 3 + 1] = ry; c._r[k * 3 + 2] = rz
  // velocidad del punto hacia el piso (para el rebote)
  c._vn0[k] = v[1] + w[2] * rx - w[0] * rz
  c._jn[k] = 0; c._jt[k * 2] = 0; c._jt[k * 2 + 1] = 0
  // masa efectiva en la normal: 1/m + n·((I⁻¹(r×n))×r), con n = y
  const cx = -rz, cz = rx                    // r × (0,1,0)
  const ix = I[0] * cx + I[2] * cz, iz = I[6] * cx + I[8] * cz
  c._kn[k] = 1 + (iz * rx - ix * rz)
  return k + 1
}

// Impulsos secuenciales: la normal acumulada y nunca negativa (el piso empuja,
// no jala) y la fricción de Coulomb en un disco de μ·jn.
function resolver(c, k) {
  const v = c.v, w = c.w, I = c.Iw
  const rr = c._r, vn0 = c._vn0, jn = c._jn, jt = c._jt, kn = c._kn
  for (let it = 0; it < CAIDA.ITERACIONES; it++) {
    for (let j = 0; j < k; j++) {
      const rx = rr[j * 3], ry = rr[j * 3 + 1], rz = rr[j * 3 + 2]
      const vy = v[1] + w[2] * rx - w[0] * rz
      const objetivo = vn0[j] < -CAIDA.REBOTE_MIN_VEL ? -CAIDA.REBOTE * vn0[j] : 0
      const nuevo = Math.max(0, jn[j] + (objetivo - vy) / kn[j])
      const dj = nuevo - jn[j]
      jn[j] = nuevo
      if (dj !== 0) {
        v[1] += dj
        // Δw = I⁻¹ (r × (0, dj, 0)) = I⁻¹ (−rz·dj, 0, rx·dj)
        const tx = -rz * dj, tz = rx * dj
        w[0] += I[0] * tx + I[2] * tz; w[1] += I[3] * tx + I[5] * tz; w[2] += I[6] * tx + I[8] * tz
      }
      const vx = v[0] + w[1] * rz - w[2] * ry
      const vz = v[2] + w[0] * ry - w[1] * rx
      const vt = Math.hypot(vx, vz)
      if (vt < 1e-9 && jt[j * 2] === 0 && jt[j * 2 + 1] === 0) continue
      let ex = 1, ez = 0
      if (vt > 1e-9) { ex = vx / vt; ez = vz / vt }
      // masa efectiva en esa dirección
      const cx = ry * ez, cy = rz * ex - rx * ez, cz = -ry * ex   // r × t
      const ix = I[0] * cx + I[1] * cy + I[2] * cz, iy = I[3] * cx + I[4] * cy + I[5] * cz, iz = I[6] * cx + I[7] * cy + I[8] * cz
      const kt = 1 + ((iy * rz - iz * ry) * ex + (ix * ry - iy * rx) * ez)
      const ox = jt[j * 2], oz = jt[j * 2 + 1]
      let nx = ox - (vt / kt) * ex, nz = oz - (vt / kt) * ez
      const tope = CAIDA.FRICCION * jn[j]
      const nl = Math.hypot(nx, nz)
      if (nl > tope) { const f = tope / (nl || 1); nx *= f; nz *= f }
      jt[j * 2] = nx; jt[j * 2 + 1] = nz
      const dx = nx - ox, dz = nz - oz
      if (dx !== 0 || dz !== 0) {
        v[0] += dx; v[2] += dz
        // r × (dx, 0, dz)
        const tx = ry * dz, ty = rz * dx - rx * dz, tz = -ry * dx
        w[0] += I[0] * tx + I[1] * ty + I[2] * tz; w[1] += I[3] * tx + I[4] * ty + I[5] * tz; w[2] += I[6] * tx + I[7] * ty + I[8] * tz
      }
    }
  }
}

/**
 * Qué tan fuera queda el centro de masa (visto desde arriba) de lo que toca
 * el piso: 0 si cae adentro del casco de los apoyos que tocan; si toca en uno
 * o dos puntos (una curva, un filo), la distancia a ellos.
 */
export function fueraDelApoyo(c, piso) {
  const ap = c.desc.apoyos, R = c.R, p = c.p
  const pts = []
  for (let a = 0; a < c.desc.nAp * 3; a += 3) {
    const bx = ap[a], by = ap[a + 1], bz = ap[a + 2]
    const y = p[1] + R[3] * bx + R[4] * by + R[5] * bz
    if (y > piso + CAIDA.TOCA) continue
    pts.push([R[0] * bx + R[1] * by + R[2] * bz, R[6] * bx + R[7] * by + R[8] * bz])
  }
  if (!pts.length) return Infinity
  // centro de masa en (0, 0): los puntos ya son relativos a él
  const segDist = (a, b) => {
    const ex = b[0] - a[0], ez = b[1] - a[1]
    const l2 = ex * ex + ez * ez
    const t = l2 > 1e-18 ? Math.max(0, Math.min(1, -(a[0] * ex + a[1] * ez) / l2)) : 0
    return Math.hypot(a[0] + ex * t, a[1] + ez * t)
  }
  pts.sort((a, b) => a[0] - b[0] || a[1] - b[1])
  const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
  const lo = [], up = []
  for (const pt of pts) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], pt) <= 0) lo.pop(); lo.push(pt) }
  for (let k = pts.length - 1; k >= 0; k--) { const pt = pts[k]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], pt) <= 0) up.pop(); up.push(pt) }
  const H = lo.slice(0, -1).concat(up.slice(0, -1))
  if (H.length === 0) return Math.hypot(pts[0][0], pts[0][1])
  if (H.length < 3) return segDist(H[0], H[H.length - 1])
  let dentro = true, minD = Infinity
  for (let k = 0; k < H.length; k++) {
    const a = H[k], b = H[(k + 1) % H.length]
    if (cr(a, b, [0, 0]) < 0) dentro = false
    minD = Math.min(minD, segDist(a, b))
  }
  return dentro ? 0 : minD
}

/** La altura del apoyo más bajo con la malla en la pose `q` (cuaternión) y
 *  su origen a la altura `origenY` (para el rearmado, que no es física). */
export function bajoEnPose(desc, q, origenY) {
  const [x, y, z, w] = q
  const r3 = 2 * (x * y + z * w), r4 = 1 - 2 * (x * x + z * z), r5 = 2 * (y * z - x * w)
  const m = desc.com, ap = desc.apoyos
  let min = Infinity
  for (let i = 0; i < desc.nAp * 3; i += 3) {
    const yy = r3 * (m[0] + ap[i]) + r4 * (m[1] + ap[i + 1]) + r5 * (m[2] + ap[i + 2])
    if (yy < min) min = yy
  }
  return origenY + min
}

/** Ya dormida, la revisa con todos sus vértices (`pos`, en el marco de la
 *  malla): si alguno quedó bajo el piso, la sube eso. Regresa cuánto la
 *  subió (con el vértice más bajo de cada subpaso, nada). */
export function asentar(c, pos, piso) {
  const bajo = masBajo(c, pos)
  if (!(bajo < piso)) return 0
  c.p[1] += piso - bajo
  return piso - bajo
}

/** El punto más bajo de unos puntos (xyz, en el marco de la malla) con la
 *  pieza como está ahora (para revisar que nada quede metido en el piso). */
export function masBajo(c, pos) {
  const R = c.R, m = c.desc.com, p = c.p
  let min = Infinity
  for (let i = 0; i < pos.length; i += 3) {
    const bx = pos[i] - m[0], by = pos[i + 1] - m[1], bz = pos[i + 2] - m[2]
    const y = p[1] + R[3] * bx + R[4] * by + R[5] * bz
    if (y < min) min = y
  }
  return min
}
