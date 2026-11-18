/**
 * Los bóxers sueltos cuando Skulley se despieza en la experiencia completa
 * (Oscar, 2026-11-17: "que se comporten como tela, que no se queden con la
 * forma original"). Vuelan como pieza rígida (caidaPiezas.js) y al tocar el
 * piso se vuelven tela: caen, se doblan y se quedan arrugados en el piso.
 *
 * La malla tiene 2,589 vértices: una partícula por vértice costaba 10 ms por
 * cuadro. Aquí la tela son ~300 nodos (racimos de vértices conectados de una
 * rejilla de `LADO`) con dinámica basada en posiciones y pasos chicos: los
 * nodos vecinos no se estiran, se resisten un poco a doblarse, no se
 * atraviesan entre capas (sin eso el frente y la espalda caían al mismo plano
 * y parpadeaban) y el piso los empuja y los frena. Cada vértice de la malla
 * sigue a sus tres nodos más cercanos con el giro de cada uno (el que mejor
 * empata a sus vecinos), como una piel, y nunca baja del piso. Al quedarse
 * quieta, se duerme.
 *
 * Sin three, para probarse en Node. Vectores [x, y, z], cuaterniones
 * [x, y, z, w], matrices 3×3 por filas.
 */

export const TELA = {
  LADO: 0.05,           // u: tamaño de la rejilla de los nodos
  PIEL_R: 1.6,          // en LADOs: hasta dónde llega un nodo a los vértices
  PIEL_K: 8,            // nodos por vértice
  PASO: 1 / 240,        // tamaño máximo del subpaso
  SUBPASOS_MAX: 48,
  ITERACIONES: 2,
  GROSOR: 0.004,        // u: los nodos se quedan así de arriba del piso
  FRICCION: 0.6,
  AMORTIGUA: 1.2,       // por segundo
  // El aire frena a cada nodo distinto (como frena a la tela según cómo le
  // pega): así en el vuelo pierde la forma de la cadera, ondea y cae floja.
  AIRE_MIN: 1,          // por segundo
  AIRE_MAX: 8,
  // Ya en el piso las capas se quedan tiritando de a poquito (se empujan y
  // se jalan): el freno sube con el tiempo y la deja quieta como la tela.
  RAMPA_DESDE: 0.5,     // s desde que tocó el piso (el freno y MAX_S cuentan desde ahí)
  RAMPA: 10,            // por segundo, cada segundo
  DOBLEZ: 0.015,        // qué tanto se resiste a doblarse (0 = trapo, 1 = cartón)
  SEPARA: 0.4,          // fracción de la arista media: lo más que se acercan dos capas
  ROCE_CAPAS: 0.5,      // 0..1: qué tanto se frenan dos capas que se tocan
  DUERME_VEL: 0.16,     // u/s: lo que se movió el nodo que más se movió en el cuadro (~2 mm a 60 Hz)
  DUERME_S: 0.25,
  MAX_S: 1.8,           // s: aunque se siga moviendo un poquito, se duerme
}

const llave3 = (x, y, z) => x + y * 131072 + z * 17179869184   // 2^17, 2^34: exacto en double

/**
 * `pos`: los vértices de la malla (xyz, en su marco); `indice`: sus
 * triángulos. La forma de reposo sale de ahí. Se arma por partes
 * (`avanza(ms)` regresa true al terminar y deja la tela en `tela`): son
 * ~10 ms y se reparten en los cuadros en que la pieza va volando.
 *
 * `opciones` (la chamarra; los bóxers van sin ellas):
 *  - `lado`: tamaño de la rejilla de nodos (TELA.LADO).
 *  - `simula`: por vértice, 1 si su tela simula; los triángulos con algún
 *    vértice en 0 (el metal) no son tela y esos vértices siguen a los nodos
 *    más cercanos como piel.
 *  - `k`: nodos que sigue cada vértice (TELA.PIEL_K).
 *  - `pegar`: dos nodos que en reposo están a menos de esto quedan amarrados
 *    aunque la malla no los una (la piel y el forro, la solapa encima del
 *    pecho): sin eso cada capa caía por su lado.
 */
export function crearConstructorTela(pos, indice, opciones = {}) {
  const gen = construirTela(pos, indice, opciones)
  const c = {
    listo: false,
    tela: null,
    avanza(ms = Infinity) {
      const fin = performance.now() + ms
      while (!c.listo) {
        const r = gen.next()
        if (r.done) { c.listo = true; c.tela = r.value; break }
        if (performance.now() >= fin) break
      }
      return c.listo
    },
  }
  return c
}

/** La tela de una vez (para Node). */
export function crearTela(pos, indice, opciones = {}) {
  const c = crearConstructorTela(pos, indice, opciones)
  c.avanza()
  return c.tela
}

function* construirTela(pos, indice, opciones = {}) {
  const nV = pos.length / 3
  const simula = opciones.simula || null
  const triSimula = (t) => !simula || (simula[indice[t * 3]] && simula[indice[t * 3 + 1]] && simula[indice[t * 3 + 2]])
  // soldar: los vértices repetidos en las costuras son uno solo
  let x0 = Infinity, y0 = Infinity, z0 = Infinity, ext = 0
  for (let i = 0; i < nV * 3; i += 3) { x0 = Math.min(x0, pos[i]); y0 = Math.min(y0, pos[i + 1]); z0 = Math.min(z0, pos[i + 2]) }
  for (let i = 0; i < nV * 3; i += 3) ext = Math.max(ext, pos[i] - x0, pos[i + 1] - y0, pos[i + 2] - z0)
  const qz = 100000 / Math.max(ext, 1e-9)
  const soldado = new Int32Array(nV)
  const vistos = new Map()
  let nS = 0
  for (let i = 0; i < nV; i++) {
    const k = llave3(Math.round((pos[i * 3] - x0) * qz), Math.round((pos[i * 3 + 1] - y0) * qz), Math.round((pos[i * 3 + 2] - z0) * qz))
    let s = vistos.get(k)
    if (s === undefined) { s = nS++; vistos.set(k, s) }
    soldado[i] = s
  }
  const sp = new Float64Array(nS * 3)
  for (let i = 0; i < nV; i++) { const s = soldado[i] * 3; sp[s] = pos[i * 3]; sp[s + 1] = pos[i * 3 + 1]; sp[s + 2] = pos[i * 3 + 2] }
  yield
  // aristas entre soldados (solo de los triángulos que son tela)
  const tri = indice.length / 3
  const aristas = []
  const usado = new Uint8Array(nS)
  for (let t = 0; t < tri; t++) {
    if (!triSimula(t)) continue
    for (let e = 0; e < 3; e++) {
      const a = soldado[indice[t * 3 + e]], b = soldado[indice[t * 3 + (e + 1) % 3]]
      usado[a] = 1
      if (a !== b) aristas.push(a, b)
    }
  }
  yield
  // racimos: los soldados de cada celda, separados por si no se tocan
  // (dos capas que pasan cerca no se vuelven un nodo)
  const L = opciones.lado || TELA.LADO
  const celda = new Float64Array(nS)
  for (let s = 0; s < nS; s++) celda[s] = llave3(Math.floor((sp[s * 3] - x0) / L), Math.floor((sp[s * 3 + 1] - y0) / L), Math.floor((sp[s * 3 + 2] - z0) / L))
  const padre = Int32Array.from({ length: nS }, (_, i) => i)
  const raiz = (i) => { while (padre[i] !== i) { padre[i] = padre[padre[i]]; i = padre[i] } return i }
  for (let k = 0; k < aristas.length; k += 2) {
    const a = aristas[k], b = aristas[k + 1]
    if (celda[a] !== celda[b]) continue
    const ra = raiz(a), rb = raiz(b)
    if (ra !== rb) padre[ra] = rb
  }
  const nodoDe = new Int32Array(nS).fill(-1)
  const ids = new Map()
  let N = 0
  for (let s = 0; s < nS; s++) {
    if (!usado[s]) continue
    const r = raiz(s)
    let id = ids.get(r)
    if (id === undefined) { id = N++; ids.set(r, id) }
    nodoDe[s] = id
  }
  const xr = new Float64Array(N * 3), cuenta = new Float64Array(N)
  for (let s = 0; s < nS; s++) { const n = nodoDe[s]; if (n < 0) continue; xr[n * 3] += sp[s * 3]; xr[n * 3 + 1] += sp[s * 3 + 1]; xr[n * 3 + 2] += sp[s * 3 + 2]; cuenta[n]++ }
  for (let n = 0; n < N; n++) { xr[n * 3] /= cuenta[n]; xr[n * 3 + 1] /= cuenta[n]; xr[n * 3 + 2] /= cuenta[n] }
  yield
  // vecinos entre nodos (por las aristas de la malla)
  const vec = Array.from({ length: N }, () => new Set())
  for (let k = 0; k < aristas.length; k += 2) {
    const a = nodoDe[aristas[k]], b = nodoDe[aristas[k + 1]]
    if (a !== b) { vec[a].add(b); vec[b].add(a) }
  }
  const dr = (a, b) => Math.hypot(xr[a * 3] - xr[b * 3], xr[a * 3 + 1] - xr[b * 3 + 1], xr[a * 3 + 2] - xr[b * 3 + 2])
  const E = [], B = []
  let suma = 0, cuantas = 0
  for (let a = 0; a < N; a++) for (const b of vec[a]) if (a < b) { const l = dr(a, b); E.push(a, b, l); suma += l; cuantas++ }
  // doblez: cada vecino con el vecino más opuesto (una línea que pasa por el nodo)
  for (let n = 0; n < N; n++) {
    const vs = [...vec[n]]
    for (const a of vs) {
      let mejor = 1, cual = -1
      const ax = xr[a * 3] - xr[n * 3], ay = xr[a * 3 + 1] - xr[n * 3 + 1], az = xr[a * 3 + 2] - xr[n * 3 + 2]
      for (const b of vs) {
        if (b === a) continue
        const bx = xr[b * 3] - xr[n * 3], by = xr[b * 3 + 1] - xr[n * 3 + 1], bz = xr[b * 3 + 2] - xr[n * 3 + 2]
        const cos = (ax * bx + ay * by + az * bz) / (Math.hypot(ax, ay, az) * Math.hypot(bx, by, bz) || 1)
        if (cos < mejor) { mejor = cos; cual = b }
      }
      if (cual > a && mejor < -0.5) B.push(a, cual, dr(a, cual))
    }
  }
  yield
  // Capas encimadas (forro, solapas): amarradas a la distancia de reposo, y
  // vecinas para el giro y la piel. Rejilla de celdas de `pegar`.
  const pegar = opciones.pegar || 0
  // rejilla de los nodos (para pegar capas y para la piel de lo que no simula)
  const rejilla = (lado) => {
    const m = new Map()
    for (let n = 0; n < N; n++) {
      const k = llave3(Math.floor((xr[n * 3] - x0) / lado) + 2, Math.floor((xr[n * 3 + 1] - y0) / lado) + 2, Math.floor((xr[n * 3 + 2] - z0) / lado) + 2)
      let l = m.get(k)
      if (!l) m.set(k, (l = []))
      l.push(n)
    }
    return m
  }
  if (pegar > 0) {
    const m = rejilla(pegar)
    const p2 = pegar * pegar
    for (let a = 0; a < N; a++) {
      const cx = Math.floor((xr[a * 3] - x0) / pegar) + 2, cy = Math.floor((xr[a * 3 + 1] - y0) / pegar) + 2, cz = Math.floor((xr[a * 3 + 2] - z0) / pegar) + 2
      for (let ox = -1; ox <= 1; ox++) for (let oy = -1; oy <= 1; oy++) for (let oz = -1; oz <= 1; oz++) {
        const l = m.get(llave3(cx + ox, cy + oy, cz + oz))
        if (!l) continue
        for (const b of l) {
          if (b <= a || vec[a].has(b)) continue
          const d2 = (xr[a * 3] - xr[b * 3]) ** 2 + (xr[a * 3 + 1] - xr[b * 3 + 1]) ** 2 + (xr[a * 3 + 2] - xr[b * 3 + 2]) ** 2
          if (d2 >= p2) continue
          E.push(a, b, Math.sqrt(d2))
          vec[a].add(b); vec[b].add(a)
        }
      }
    }
  }
  const vecinos = vec.map((s) => Int32Array.from(s))
  // lo que no simula (el metal) sigue al nodo más cercano y a sus vecinos
  const cercano = (() => {
    if (!simula) return null
    const m = rejilla(L)
    return (px, py, pz) => {
      const cx = Math.floor((px - x0) / L) + 2, cy = Math.floor((py - y0) / L) + 2, cz = Math.floor((pz - z0) / L) + 2
      let mejor = -1, dmin = Infinity
      for (let r = 1; r <= 4 && mejor < 0; r++) {
        for (let ox = -r; ox <= r; ox++) for (let oy = -r; oy <= r; oy++) for (let oz = -r; oz <= r; oz++) {
          const l = m.get(llave3(cx + ox, cy + oy, cz + oz))
          if (!l) continue
          for (const n of l) {
            const d = (px - xr[n * 3]) ** 2 + (py - xr[n * 3 + 1]) ** 2 + (pz - xr[n * 3 + 2]) ** 2
            if (d < dmin) { dmin = d; mejor = n }
          }
        }
      }
      return mejor < 0 ? 0 : mejor
    }
  })()
  yield
  // Cada vértice sigue a los nodos de su vecindad (su nodo y dos vueltas de
  // vecinos) a menos de PIEL_R, con un peso suave que llega a cero en la
  // orilla: así dos vértices de junto siguen casi a los mismos nodos y no se
  // abren los triángulos. Lo que guarda es su distancia al centro pesado de
  // esos nodos, que es chica, y la gira con el giro promedio de ellos.
  const K = opciones.k || TELA.PIEL_K
  const R2 = (TELA.PIEL_R * L) ** 2
  const anillo = new Array(N)
  const anilloDe = (n) => {
    if (anillo[n]) return anillo[n]
    const s1 = new Set([n])
    for (const a of vecinos[n]) { s1.add(a); for (const b of vecinos[a]) s1.add(b) }
    return (anillo[n] = Int32Array.from(s1))
  }
  const piel = new Int32Array(nV * K).fill(-1), pesos = new Float32Array(nV * K), offs = new Float32Array(nV * 3)
  const candN = new Int32Array(256), candD = new Float64Array(256)
  for (let i = 0; i < nV; i++) {
    if ((i & 255) === 255) yield
    const px = pos[i * 3], py = pos[i * 3 + 1], pz = pos[i * 3 + 2]
    let n0 = nodoDe[soldado[i]]
    if (n0 < 0) n0 = cercano ? cercano(px, py, pz) : 0
    const an = anilloDe(n0)
    let m = 0
    for (let k = 0; k < an.length && m < 256; k++) {
      const n = an[k]
      const d = (px - xr[n * 3]) ** 2 + (py - xr[n * 3 + 1]) ** 2 + (pz - xr[n * 3 + 2]) ** 2
      if (d < R2 || n === n0) { candN[m] = n; candD[m] = d; m++ }
    }
    // los K más cercanos (pocos: inserción)
    for (let a = 1; a < m; a++) {
      const dn = candN[a], dd = candD[a]
      let b = a - 1
      while (b >= 0 && candD[b] > dd) { candN[b + 1] = candN[b]; candD[b + 1] = candD[b]; b-- }
      candN[b + 1] = dn; candD[b + 1] = dd
    }
    const usar = Math.min(K, m)
    let sw = 0
    for (let k = 0; k < usar; k++) { const u = Math.max(0, 1 - candD[k] / R2); const w = u * u * u + 1e-6; pesos[i * K + k] = w; sw += w }
    let cx = 0, cy = 0, cz = 0
    for (let k = 0; k < usar; k++) {
      const n = candN[k]
      const w = pesos[i * K + k] / sw
      piel[i * K + k] = n; pesos[i * K + k] = w
      cx += w * xr[n * 3]; cy += w * xr[n * 3 + 1]; cz += w * xr[n * 3 + 2]
    }
    offs[i * 3] = px - cx; offs[i * 3 + 1] = py - cy; offs[i * 3 + 2] = pz - cz
  }
  const media = suma / Math.max(1, cuantas)
  return {
    N, K, xr, vecinos,
    x: new Float64Array(N * 3), v: new Float64Array(N * 3), prev: new Float64Array(N * 3), q: new Float64Array(N * 4),
    aristas: Float64Array.from(E), doblez: Float64Array.from(B),
    piel, pesos, offs,
    separa: TELA.SEPARA * media,
    arrastre: Float32Array.from({ length: N }, (_, i) => TELA.AIRE_MIN + (TELA.AIRE_MAX - TELA.AIRE_MIN) * (((Math.sin(i * 12.9898) * 43758.5453) % 1 + 1) % 1)),
    dormida: false, quieto: 0, t: 0,
    _cabeza: new Int32Array(1024), _sig: new Int32Array(N),
  }
}

/** La tela en la pose de la pieza rígida (giro `q` y matriz `R`, origen `t`),
 *  con la velocidad de cada punto del cuerpo rígido (`v + w × (x − centro)`). */
export function colocarTela(tela, R, q, t, v = [0, 0, 0], w = [0, 0, 0], centro = t) {
  const { N, xr, x } = tela
  for (let i = 0; i < N; i++) {
    const bx = xr[i * 3], by = xr[i * 3 + 1], bz = xr[i * 3 + 2]
    const px = t[0] + R[0] * bx + R[1] * by + R[2] * bz
    const py = t[1] + R[3] * bx + R[4] * by + R[5] * bz
    const pz = t[2] + R[6] * bx + R[7] * by + R[8] * bz
    x[i * 3] = px; x[i * 3 + 1] = py; x[i * 3 + 2] = pz
    const rx = px - centro[0], ry = py - centro[1], rz = pz - centro[2]
    tela.v[i * 3] = v[0] + w[1] * rz - w[2] * ry
    tela.v[i * 3 + 1] = v[1] + w[2] * rx - w[0] * rz
    tela.v[i * 3 + 2] = v[2] + w[0] * ry - w[1] * rx
    tela.q[i * 4] = q[0]; tela.q[i * 4 + 1] = q[1]; tela.q[i * 4 + 2] = q[2]; tela.q[i * 4 + 3] = q[3]
  }
  tela.dormida = false; tela.quieto = 0; tela.t = 0
}

function restringir(x, lista, rigidez) {
  for (let k = 0; k < lista.length; k += 3) {
    const a = lista[k] * 3, b = lista[k + 1] * 3, l0 = lista[k + 2]
    const dx = x[b] - x[a], dy = x[b + 1] - x[a + 1], dz = x[b + 2] - x[a + 2]
    const l = Math.sqrt(dx * dx + dy * dy + dz * dz)
    if (l < 1e-12) continue
    const f = (0.5 * rigidez * (l - l0)) / l
    x[a] += dx * f; x[a + 1] += dy * f; x[a + 2] += dz * f
    x[b] -= dx * f; x[b + 1] -= dy * f; x[b + 2] -= dz * f
  }
}

// Las capas no se atraviesan: dos nodos que en reposo estaban lejos no se
// acercan a menos de `separa` (rejilla con hash de ese tamaño).
function separarCapas(tela) {
  const { N, x, prev, xr, separa, _cabeza: cabeza, _sig: sig } = tela
  const H = cabeza.length - 1
  const inv = 1 / separa
  cabeza.fill(-1)
  const llave = (cx, cy, cz) => ((cx * 73856093) ^ (cy * 19349663) ^ (cz * 83492791)) & H
  for (let i = 0; i < N; i++) {
    const h = llave(Math.floor(x[i * 3] * inv), Math.floor(x[i * 3 + 1] * inv), Math.floor(x[i * 3 + 2] * inv))
    sig[i] = cabeza[h]; cabeza[h] = i
  }
  const s2 = separa * separa, lejos2 = 4 * s2
  for (let i = 0; i < N; i++) {
    const cx = Math.floor(x[i * 3] * inv), cy = Math.floor(x[i * 3 + 1] * inv), cz = Math.floor(x[i * 3 + 2] * inv)
    for (let ox = -1; ox <= 1; ox++) for (let oy = -1; oy <= 1; oy++) for (let oz = -1; oz <= 1; oz++) {
      for (let j = cabeza[llave(cx + ox, cy + oy, cz + oz)]; j !== -1; j = sig[j]) {
        if (j <= i) continue
        const dx = x[j * 3] - x[i * 3], dy = x[j * 3 + 1] - x[i * 3 + 1], dz = x[j * 3 + 2] - x[i * 3 + 2]
        const d2 = dx * dx + dy * dy + dz * dz
        if (d2 >= s2 || d2 < 1e-16) continue
        const rx = xr[j * 3] - xr[i * 3], ry = xr[j * 3 + 1] - xr[i * 3 + 1], rz = xr[j * 3 + 2] - xr[i * 3 + 2]
        if (rx * rx + ry * ry + rz * rz < lejos2) continue
        const d = Math.sqrt(d2)
        const f = (0.5 * (separa - d)) / d
        const fx = dx * f, fy = dy * f, fz = dz * f
        x[i * 3] -= fx; x[i * 3 + 1] -= fy; x[i * 3 + 2] -= fz
        x[j * 3] += fx; x[j * 3 + 1] += fy; x[j * 3 + 2] += fz
        // roce entre capas: lo que se deslizan una sobre otra se frena
        const ux = (x[j * 3] - prev[j * 3]) - (x[i * 3] - prev[i * 3])
        const uy = (x[j * 3 + 1] - prev[j * 3 + 1]) - (x[i * 3 + 1] - prev[i * 3 + 1])
        const uz = (x[j * 3 + 2] - prev[j * 3 + 2]) - (x[i * 3 + 2] - prev[i * 3 + 2])
        const k = 0.5 * TELA.ROCE_CAPAS
        x[i * 3] += ux * k; x[i * 3 + 1] += uy * k; x[i * 3 + 2] += uz * k
        x[j * 3] -= ux * k; x[j * 3 + 1] -= uy * k; x[j * 3 + 2] -= uz * k
      }
    }
  }
}

/** Avanza `dt` segundos con gravedad `g` (u/s², hacia −y) sobre el piso `piso`. */
export function pasoTela(tela, dt, g, piso) {
  if (tela.dormida || dt <= 0) return
  const n = Math.min(TELA.SUBPASOS_MAX, Math.max(1, Math.ceil(dt / TELA.PASO - 1e-9)))
  const h = dt / n
  const { N, x, v, prev } = tela
  if (!tela._x0) tela._x0 = new Float64Array(N * 3)
  tela._x0.set(x)
  const suelo = piso + TELA.GROSOR
  const amort = Math.exp(-(TELA.AMORTIGUA + Math.max(0, tela.t - TELA.RAMPA_DESDE) * TELA.RAMPA) * h)
  const aire = tela.arrastre
  let toca = false
  for (let s = 0; s < n; s++) {
    for (let i = 0; i < N * 3; i += 3) {
      v[i + 1] -= g * h
      prev[i] = x[i]; prev[i + 1] = x[i + 1]; prev[i + 2] = x[i + 2]
      x[i] += v[i] * h; x[i + 1] += v[i + 1] * h; x[i + 2] += v[i + 2] * h
    }
    for (let it = 0; it < TELA.ITERACIONES; it++) {
      restringir(x, tela.aristas, 1)
      restringir(x, tela.doblez, TELA.DOBLEZ)
      if (it === TELA.ITERACIONES - 1) separarCapas(tela)
    }
    // piso: empuja y frena (fricción de Coulomb sobre lo que se movió)
    for (let i = 0; i < N * 3; i += 3) {
      const pen = suelo - x[i + 1]
      if (pen <= 0) continue
      x[i + 1] = suelo
      toca = true
      // sin rebote: lo que el piso corrige no se vuelve velocidad hacia arriba
      if (prev[i + 1] < suelo) prev[i + 1] = suelo
      const dx = x[i] - prev[i], dz = x[i + 2] - prev[i + 2]
      const dl = Math.hypot(dx, dz)
      if (dl < 1e-12) continue
      const frena = Math.min(1, (TELA.FRICCION * pen) / dl)
      x[i] -= dx * frena; x[i + 2] -= dz * frena
    }
    for (let i = 0; i < N * 3; i += 3) {
      const a = x[i + 1] > suelo + 1e-6 ? amort * Math.exp(-aire[i / 3] * h) : amort
      v[i] = (x[i] - prev[i]) / h * a
      v[i + 1] = (x[i + 1] - prev[i + 1]) / h * a
      v[i + 2] = (x[i + 2] - prev[i + 2]) / h * a
    }
  }
  // el reloj del freno y del tope empieza cuando toca el piso
  if (toca || tela.t > 0) tela.t += dt
  // lo que se movió en todo el cuadro (las capas tiritan dentro del cuadro y
  // se quedan en su lugar: eso no se ve)
  let dmax = 0
  const x0 = tela._x0
  for (let i = 0; i < N * 3; i += 3) dmax = Math.max(dmax, (x[i] - x0[i]) ** 2 + (x[i + 1] - x0[i + 1]) ** 2 + (x[i + 2] - x0[i + 2]) ** 2)
  tela.mueve = Math.sqrt(dmax) / dt
  tela.quieto = tela.mueve < TELA.DUERME_VEL ? tela.quieto + dt : 0
  if (tela.quieto > TELA.DUERME_S || tela.t > TELA.MAX_S) { tela.dormida = true; v.fill(0) }
}

// El giro de cada nodo: el que mejor lleva su vecindad de reposo a la de
// ahora (emparejamiento de forma, con la rotación de Müller et al. 2016,
// partiendo del giro anterior).
function girosDeNodos(tela) {
  const { N, x, xr, q, vecinos } = tela
  for (let n = 0; n < N; n++) {
    const vs = vecinos[n]
    if (!vs.length) continue
    // A = Σ (x_k − x_n)(xr_k − xr_n)ᵀ, por columnas
    let a00 = 0, a01 = 0, a02 = 0, a10 = 0, a11 = 0, a12 = 0, a20 = 0, a21 = 0, a22 = 0
    for (let k = 0; k < vs.length; k++) {
      const m = vs[k]
      const dx = x[m * 3] - x[n * 3], dy = x[m * 3 + 1] - x[n * 3 + 1], dz = x[m * 3 + 2] - x[n * 3 + 2]
      const rx = xr[m * 3] - xr[n * 3], ry = xr[m * 3 + 1] - xr[n * 3 + 1], rz = xr[m * 3 + 2] - xr[n * 3 + 2]
      a00 += dx * rx; a01 += dx * ry; a02 += dx * rz
      a10 += dy * rx; a11 += dy * ry; a12 += dy * rz
      a20 += dz * rx; a21 += dz * ry; a22 += dz * rz
    }
    let qx = q[n * 4], qy = q[n * 4 + 1], qz = q[n * 4 + 2], qw = q[n * 4 + 3]
    for (let it = 0; it < 3; it++) {
      const r00 = 1 - 2 * (qy * qy + qz * qz), r01 = 2 * (qx * qy - qz * qw), r02 = 2 * (qx * qz + qy * qw)
      const r10 = 2 * (qx * qy + qz * qw), r11 = 1 - 2 * (qx * qx + qz * qz), r12 = 2 * (qy * qz - qx * qw)
      const r20 = 2 * (qx * qz - qy * qw), r21 = 2 * (qy * qz + qx * qw), r22 = 1 - 2 * (qx * qx + qy * qy)
      // Σ r_i × a_i (columnas)
      const ox = (r10 * a20 - r20 * a10) + (r11 * a21 - r21 * a11) + (r12 * a22 - r22 * a12)
      const oy = (r20 * a00 - r00 * a20) + (r21 * a01 - r01 * a21) + (r22 * a02 - r02 * a22)
      const oz = (r00 * a10 - r10 * a00) + (r01 * a11 - r11 * a01) + (r02 * a12 - r12 * a02)
      const den = Math.abs(r00 * a00 + r10 * a10 + r20 * a20 + r01 * a01 + r11 * a11 + r21 * a21 + r02 * a02 + r12 * a12 + r22 * a22) + 1e-12
      const wx = ox / den, wy = oy / den, wz = oz / den
      const ang = Math.hypot(wx, wy, wz)
      if (ang < 1e-9) break
      const s = Math.sin(ang / 2) / ang, c = Math.cos(ang / 2)
      const ex = wx * s, ey = wy * s, ez = wz * s
      // q ← e · q
      const nx = c * qx + ex * qw + ey * qz - ez * qy
      const ny = c * qy - ex * qz + ey * qw + ez * qx
      const nz = c * qz + ex * qy - ey * qx + ez * qw
      const nw = c * qw - ex * qx - ey * qy - ez * qz
      const l = Math.hypot(nx, ny, nz, nw) || 1
      qx = nx / l; qy = ny / l; qz = nz / l; qw = nw / l
    }
    q[n * 4] = qx; q[n * 4 + 1] = qy; q[n * 4 + 2] = qz; q[n * 4 + 3] = qw
  }
}

/** Las posiciones de todos los vértices de la malla (`out`, xyz), ninguno
 *  bajo el piso. */
export function escribirTela(tela, out, piso) {
  girosDeNodos(tela)
  const { x, q, piel, pesos, offs } = tela
  const K = tela.K || TELA.PIEL_K
  const nV = out.length / 3
  const suelo = piso + 0.0005
  for (let i = 0; i < nV; i++) {
    // el centro pesado de sus nodos y el giro promedio de ellos
    let px = 0, py = 0, pz = 0, qx = 0, qy = 0, qz = 0, qw = 0
    const n0 = piel[i * K]
    for (let k = 0; k < K; k++) {
      const n = piel[i * K + k]
      if (n < 0) break
      const w = pesos[i * K + k]
      px += w * x[n * 3]; py += w * x[n * 3 + 1]; pz += w * x[n * 3 + 2]
      const s = q[n * 4] * q[n0 * 4] + q[n * 4 + 1] * q[n0 * 4 + 1] + q[n * 4 + 2] * q[n0 * 4 + 2] + q[n * 4 + 3] * q[n0 * 4 + 3] < 0 ? -w : w
      qx += s * q[n * 4]; qy += s * q[n * 4 + 1]; qz += s * q[n * 4 + 2]; qw += s * q[n * 4 + 3]
    }
    const ql = Math.hypot(qx, qy, qz, qw) || 1
    qx /= ql; qy /= ql; qz /= ql; qw /= ql
    const vx = offs[i * 3], vy = offs[i * 3 + 1], vz = offs[i * 3 + 2]
    const ix = qw * vx + qy * vz - qz * vy, iy = qw * vy + qz * vx - qx * vz
    const iz = qw * vz + qx * vy - qy * vx, iw = -qx * vx - qy * vy - qz * vz
    px += ix * qw - iw * qx - iy * qz + iz * qy
    py += iy * qw - iw * qy - iz * qx + ix * qz
    pz += iz * qw - iw * qz - ix * qy + iy * qx
    out[i * 3] = px; out[i * 3 + 1] = py > suelo ? py : suelo; out[i * 3 + 2] = pz
  }
  return out
}

/** Lo más bajo de unos vértices (xyz). */
export function bajoDe(arr) {
  let min = Infinity
  for (let i = 1; i < arr.length; i += 3) if (arr[i] < min) min = arr[i]
  return min
}
