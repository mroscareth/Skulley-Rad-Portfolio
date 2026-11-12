// La forma de Skulley para que nada atraviese el piso (lib/numeritoCabeza.js).
// Cálculo puro, sin three: lo corre nubePiso.worker.js (son ~146 mil vértices
// y en el hilo principal eran 300 ms de tirón al montar) y, si no hay Worker,
// el hilo principal en un rato libre.
//
// Con el bind "attached" de three, un vértice en mundo es Σ peso · hueso.
// matrixWorld · boneInverse · bindMatrix · posición. Se guarda cada vértice en
// el espacio de cada hueso que lo mueve (p_k = boneInverse_k · bindMatrix · p),
// así en cualquier pose su altura es Σ peso_k · (fila y de la matriz_k · p_k):
// exacta, también donde dos huesos reparten el peso (la punta del pie al
// doblarse, la quijada y los labios).
//
// No hacen falta todos: de cada grupo de vértices movidos por los mismos huesos
// basta su contorno, el punto más extremo en cada una de las direcciones
// repartidas en la esfera, medido en el espacio de cada uno de esos huesos. El
// punto más bajo en cualquier pose es uno de esos.

const RIGIDO = 0.999

function lector({ array, itemSize, normalized }) {
  let escala = 1
  if (normalized) {
    if (array instanceof Int8Array) escala = 1 / 127
    else if (array instanceof Uint8Array) escala = 1 / 255
    else if (array instanceof Int16Array) escala = 1 / 32767
    else if (array instanceof Uint16Array) escala = 1 / 65535
  }
  return (i, k) => array[i * itemSize + k] * escala
}

function direccionesEsfera(n) {
  const out = new Float64Array(n * 3)
  const dorado = Math.PI * (3 - Math.sqrt(5))
  for (let i = 0; i < n; i++) {
    const y = 1 - (2 * (i + 0.5)) / n
    const r = Math.sqrt(1 - y * y)
    out[i * 3] = Math.cos(dorado * i) * r
    out[i * 3 + 1] = y
    out[i * 3 + 2] = Math.sin(dorado * i) * r
  }
  return out
}

function aplica(e, o, x, y, z, out) {
  out[0] = e[o] * x + e[o + 4] * y + e[o + 8] * z + e[o + 12]
  out[1] = e[o + 1] * x + e[o + 5] * y + e[o + 9] * z + e[o + 13]
  out[2] = e[o + 2] * x + e[o + 6] * y + e[o + 10] * z + e[o + 14]
}

// Cada punto elegido es un registro de PASO números: [influencias, y por cada
// una (hasta 4): hueso, peso, x, y, z]. `dominante` dice de qué hueso es.
export const PASO = 21

// mallas: [{ pos, si?, sw?, bind?, inversos? }] (atributos { array, itemSize,
// normalized }). Devuelve, por malla, { datos: Float32Array, dominante:
// Int32Array } (hueso -1 = la malla misma, sin piel).
export function calcularNube(mallas, { rigidos = 362, mezclados = 146 } = {}) {
  const Dr = direccionesEsfera(rigidos)
  const Dm = direccionesEsfera(mezclados)
  const t1 = [0, 0, 0]
  const t2 = [0, 0, 0]
  return mallas.map((malla) => {
    const pos = lector(malla.pos)
    const n = malla.pos.array.length / malla.pos.itemSize
    const piel = Boolean(malla.si && malla.sw && malla.bind && malla.inversos)
    const si = piel ? lector(malla.si) : null
    const sw = piel ? lector(malla.sw) : null
    // Grupos por los huesos que mueven al vértice (la "firma").
    const grupos = new Map()
    for (let i = 0; i < n; i++) {
      let firma = '-1'
      let huesos = [-1]
      if (piel) {
        const inf = []
        for (let k = 0; k < 4; k++) { const w = sw(i, k); if (w > 1e-3) inf.push(si(i, k)) }
        if (!inf.length) inf.push(si(i, 0))
        huesos = [...new Set(inf)].sort((a, b) => a - b)
        firma = huesos.join(',')
      }
      let g = grupos.get(firma)
      if (!g) grupos.set(firma, (g = { huesos, vertices: [] }))
      g.vertices.push(i)
    }

    const registros = []
    const dominantes = []
    for (const g of grupos.values()) {
      const m = g.vertices.length
      // La posición de cada vértice en el espacio de cada hueso del grupo.
      const espacios = g.huesos.map((h) => {
        const arr = new Float64Array(m * 3)
        for (let j = 0; j < m; j++) {
          const i = g.vertices[j]
          if (h < 0) { arr[j * 3] = pos(i, 0); arr[j * 3 + 1] = pos(i, 1); arr[j * 3 + 2] = pos(i, 2); continue }
          aplica(malla.bind, 0, pos(i, 0), pos(i, 1), pos(i, 2), t1)
          aplica(malla.inversos, h * 16, t1[0], t1[1], t1[2], t2)
          arr[j * 3] = t2[0]; arr[j * 3 + 1] = t2[1]; arr[j * 3 + 2] = t2[2]
        }
        return arr
      })
      // Un grupo de un solo hueso con pesos completos es rígido.
      let rigido = g.huesos.length === 1
      if (rigido && piel) {
        for (let j = 0; j < m && rigido; j++) {
          const i = g.vertices[j]
          let max = 0
          for (let k = 0; k < 4; k++) max = Math.max(max, sw(i, k))
          let total = 0
          for (let k = 0; k < 4; k++) total += sw(i, k)
          if (max / Math.max(total, 1e-9) < RIGIDO) rigido = false
        }
      }
      const D = rigido ? Dr : Dm
      const nd = D.length / 3
      const elegidos = new Set()
      for (const arr of espacios) {
        for (let d = 0; d < nd; d++) {
          const dx = D[d * 3], dy = D[d * 3 + 1], dz = D[d * 3 + 2]
          let mejor = -Infinity, cual = 0
          for (let j = 0; j < m; j++) {
            const s = arr[j * 3] * dx + arr[j * 3 + 1] * dy + arr[j * 3 + 2] * dz
            if (s > mejor) { mejor = s; cual = j }
          }
          elegidos.add(cual)
        }
      }
      for (const j of elegidos) {
        const i = g.vertices[j]
        const r = new Array(PASO).fill(0)
        if (!piel) {
          r[0] = 1
          r[1] = -1; r[2] = 1
          r[3] = espacios[0][j * 3]; r[4] = espacios[0][j * 3 + 1]; r[5] = espacios[0][j * 3 + 2]
          registros.push(r)
          dominantes.push(-1)
          continue
        }
        // Las influencias del vértice, con los pesos normalizados.
        const inf = new Map()
        let total = 0
        for (let k = 0; k < 4; k++) {
          const w = sw(i, k)
          if (w <= 1e-3) continue
          const h = si(i, k)
          inf.set(h, (inf.get(h) || 0) + w)
          total += w
        }
        let c = 0, dom = -1, wdom = -1
        for (const [h, w] of inf) {
          const e = g.huesos.indexOf(h)
          const o = 1 + c * 5
          r[o] = h
          r[o + 1] = w / total
          r[o + 2] = espacios[e][j * 3]; r[o + 3] = espacios[e][j * 3 + 1]; r[o + 4] = espacios[e][j * 3 + 2]
          if (w > wdom) { wdom = w; dom = h }
          c++
        }
        r[0] = c
        registros.push(r)
        dominantes.push(dom)
      }
    }
    const datos = new Float32Array(registros.length * PASO)
    registros.forEach((r, k) => datos.set(r, k * PASO))
    return { datos, dominante: Int32Array.from(dominantes) }
  })
}
