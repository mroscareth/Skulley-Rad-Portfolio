// Lo sólido del bosque del home (troncos, menhires, peñascos): círculos en el
// piso. Los registra BosquePintado cuando arma el bosque; Player los usa para que
// Skulley resbale por su orilla en vez de atravesarlos, y HomeOrbs y la predicción
// de la patada (orbPhysics) para que las esferas reboten en ellos.
// Sin three: Player y orbPhysics lo leen igual en el navegador y en Node.

// Celdas de CELDA × CELDA metros con los círculos que las tocan.
const CELDA = 6
let circulos = []
let celdas = new Map()
let radioMax = 0

const llave = (cx, cz) => cx * 73856093 ^ cz * 19349663

/** Pone la lista de círculos ({ x, z, r }). Reemplaza la anterior. */
export function setObstaculos(lista) {
  circulos = (lista || []).filter((c) => c && c.r > 0)
  celdas = new Map()
  radioMax = 0
  for (const c of circulos) {
    radioMax = Math.max(radioMax, c.r)
    const x0 = Math.floor((c.x - c.r) / CELDA), x1 = Math.floor((c.x + c.r) / CELDA)
    const z0 = Math.floor((c.z - c.r) / CELDA), z1 = Math.floor((c.z + c.r) / CELDA)
    for (let cx = x0; cx <= x1; cx++) {
      for (let cz = z0; cz <= z1; cz++) {
        const k = llave(cx, cz)
        let l = celdas.get(k)
        if (!l) { l = []; celdas.set(k, l) }
        l.push(c)
      }
    }
  }
}

export function getObstaculos() { return circulos }

/** Recorre los círculos que pueden tocar un disco de radio `r` en (x, z). */
export function cercanos(x, z, r, fn) {
  if (!circulos.length) return
  const x0 = Math.floor((x - r) / CELDA), x1 = Math.floor((x + r) / CELDA)
  const z0 = Math.floor((z - r) / CELDA), z1 = Math.floor((z + r) / CELDA)
  for (let cx = x0; cx <= x1; cx++) {
    for (let cz = z0; cz <= z1; cz++) {
      const l = celdas.get(llave(cx, cz))
      if (!l) continue
      for (let i = 0; i < l.length; i++) fn(l[i])
    }
  }
}

/** Saca el punto `p` ({x, z}) de los círculos, más un margen `r` (el cuerpo de
 * quien camina). Lo deja en la orilla: así resbala alrededor en vez de frenar en
 * seco. Devuelve true si lo movió. */
export function sacarDeObstaculos(p, r = 0) {
  if (!circulos.length) return false
  let movido = false
  // Dos pasadas: entre dos troncos juntos, salir de uno puede meterlo en el otro.
  for (let pasada = 0; pasada < 2; pasada++) {
    cercanos(p.x, p.z, r + 0.01, (c) => {
      const lim = c.r + r
      const dx = p.x - c.x, dz = p.z - c.z
      const d2 = dx * dx + dz * dz
      if (d2 >= lim * lim) return
      const d = Math.sqrt(d2) || 1e-4
      p.x = c.x + (dx / d) * lim
      p.z = c.z + (dz / d) * lim
      movido = true
    })
  }
  return movido
}

// Lo que se camina: el claro, el camino al norte y la plaza del glifo (una unión
// de dos discos y una franja). El bosque es la orilla. BosquePintado lo pone con
// las medidas de su siembra; sin bosque (null) no hay orilla.
let claro = null

/** { radio, ancho, glifo: [x, z], radioGlifo } */
export function setClaro(c) { claro = c }
export function getClaro() { return claro }

// El punto más cercano de la unión (cada pieza es convexa: basta el más cercano
// de los tres). `r` es el margen de quien camina o rueda.
const _q = { x: 0, z: 0 }
function alClaro(x, z, r) {
  const c = claro
  const d0 = Math.hypot(x, z)
  const r0 = c.radio - r
  if (d0 <= r0) return null
  const [gx, gz] = c.glifo
  const dg = Math.hypot(x - gx, z - gz)
  const rg = c.radioGlifo - r
  if (dg <= rg) return null
  const w = c.ancho - r
  const zA = gz, zB = -c.radio * 0.5
  if (Math.abs(x) <= w && z >= zA && z <= zB) return null
  let bx = x * r0 / d0, bz = z * r0 / d0
  let bd = (x - bx) ** 2 + (z - bz) ** 2
  const gxp = gx + (x - gx) * rg / dg, gzp = gz + (z - gz) * rg / dg
  const g2 = (x - gxp) ** 2 + (z - gzp) ** 2
  if (g2 < bd) { bx = gxp; bz = gzp; bd = g2 }
  const fx = Math.max(-w, Math.min(w, x)), fz = Math.max(zA, Math.min(zB, z))
  const f2 = (x - fx) ** 2 + (z - fz) ** 2
  if (f2 < bd) { bx = fx; bz = fz }
  _q.x = bx; _q.z = bz
  return _q
}

/** Regresa `p` ({x, z}) a lo que se camina, con margen `r`. True si lo movió. */
export function sacarAlClaro(p, r = 0) {
  if (!claro) return false
  const q = alClaro(p.x, p.z, r)
  if (!q) return false
  p.x = q.x; p.z = q.z
  return true
}

/** Para las esferas: si se salió, la regresa a la orilla y rebota lo que iba
 * hacia afuera (restitución `e`). Devuelve la velocidad con la que pegó (0 si no). */
export function claroBounce(p, v, r, e = 0.6) {
  if (!claro) return 0
  const q = alClaro(p.x, p.z, r)
  if (!q) return 0
  const dx = p.x - q.x, dz = p.z - q.z
  const d = Math.hypot(dx, dz) || 1e-4
  const nx = dx / d, nz = dz / d
  p.x = q.x; p.z = q.z
  const vn = v.x * nx + v.z * nz
  if (vn <= 0) return 1e-3
  v.x -= (1 + e) * vn * nx
  v.z -= (1 + e) * vn * nz
  return vn
}

if (import.meta.env?.DEV && typeof window !== 'undefined') {
  window.__obstaculosHome = { get: getObstaculos, sacarDeObstaculos, getClaro, sacarAlClaro }
}
