// Formas unidas de las runas de SKULLEYRAD (prototipo). Cada runa recibe sus
// orillas (m.left / m.right) y si tiene vecina antes y después, y regresa:
//   body: trazos que se unen tal cual (los ductos ya son una sola pasada)
//   weld: trazos que se sueldan al cuerpo con unión suave (filete de tinta)
// Todas las uniones cruzan la orilla a la misma altura (PY), en horizontal y
// con el mismo grosor (RP): así cualquier runa embona con cualquiera.
import { core, strokes, circlesWith } from './bench.mjs'
import * as b2 from './brush3.mjs'
import { Duct, FULL } from './duct.mjs'

const { R, Br } = b2
export const PY = 5.95    // altura del hilo en la orilla entre dos runas
export const RP = 0.105   // radio del hilo en la orilla (peso Medium)
export const RT = 0.085   // lo más fino, justo después de levantar el pincel
const U = strokes.UPPER

export const spine2 = b2.strokeSpine
export function measure(ss, weight) {
  const cs = circlesWith(ss, weight, spine2)
  const xs = cs.flatMap(([x, , r]) => [x - r, x + r])
  const { lsb, rsb } = core.sidebearings(cs)
  return { left: Math.min(...xs) - lsb, right: Math.max(...xs) + rsb }
}

export const FORMS = {
  // El rayo: la última diagonal se afila bajando, da vuelta de horquilla abajo
  // y su cola cuelga hacia la siguiente. La unión es la cola del mismo rayo.
  S(m, { next }) {
    const [pico, bolt] = U.S
    if (!next) return { body: [pico, bolt] }
    const d = new Duct(2.95, 1.4, FULL, { base: 'orient' })
    d.turn(1.05, 3.45, 2.95, 3.45, 0.3, FULL)
    d.turn(2.95, 3.45, 1.0, 5.4, 0.3, FULL)
    d.turn(1.0, 5.4, 2.2, 5.72, 0.2, 0.14, [[0.2, FULL]])
    d.flow(m.right, PY, [1, 0], RP, { k1: 0.35, k2: 0.45, mids: [[0.4, RT]] })
    return { body: [pico, d] }
  },

  // El tallo se escribe de abajo hacia arriba: el hilo llega por la base, da
  // vuelta de talón y sube cargándose (el gancho suelto desaparece). La pierna
  // ya no remata en mazo: se carga a media bajada y se afila al acostarse.
  K(m, { prev, next }) {
    const [stem, arm, leg, tri] = U.K
    const body = [arm, tri]
    if (prev) {
      const heel = new Duct(m.left, PY, RP)
      heel.cubic(m.left + 0.85, PY, 1.1, 5.72, 1.1, 4.5, 0.27, [[0.45, 0.14]])
      heel.line(1.1, 0.3, 0.46, [[0.38, 0.46]])
      body.push(heel)
    } else body.push(stem)
    if (next) {
      const tail = new Duct(1.6, 3.2, 0.14)
      tail.cubic(2.45, 4.2, m.right - 1.05, PY, m.right, PY, RP, [[0.4, 0.47], [0.8, RT]])
      body.push(tail)
    } else body.push(leg)
    return { body }
  },

  // La copa abre dos alas desde su fondo: el hilo sube cargándose hasta
  // fundirse con el fondo de la copa y sale del otro lado afilándose.
  U(m, { prev, next }) {
    const weld = []
    if (prev) weld.push(new Duct(m.left, PY, RP).cubic(m.left + 0.8, PY, 1.3, 5.52, 2.0, 5.52, 0.32, [[0.5, 0.16]]))
    if (next) weld.push(new Duct(2.1, 5.74, 0.1).cubic(2.9, 5.76, m.right - 0.8, PY, m.right, PY, RP, [[0.5, RT]]))
    return { body: U.U, weld }
  },

  // Doble L: la onda de abajo nace del hilo y, en vez de rematar hacia arriba,
  // su último descenso cuelga hacia la siguiente. La de arriba conserva su remate.
  LL(m, { prev, next }) {
    const [w1, w2, drop] = strokes.LIGATURES.LL
    const r = R.v * 0.9
    if (!prev && !next) return { body: [w1, w2, drop] }
    const d = prev ? new Duct(m.left, PY, RP).cubic(m.left + 0.55, PY, 0.15, 5.6, 0.45, 4.9, 0.3, [[0.45, 0.16]]) : new Duct(0.3, 5.14, r)
    if (next) d.spline([[1, 3.9], [2, 4.02], [2.2, 5.39], [3.25, 5.86], [m.right, PY]], [r, r, 0.22, RT, RP], { endDir: [1, 0] })
    else d.spline([[1, 3.9], [2, 4.02], [2.2, 5.39], [3, 5.76], [3.7, 4.52]], [r, r, r, r * 0.8, 0])
    return { body: [w1, drop, d] }
  },

  // El pico de abajo abre los pies: el hilo sube y se carga hasta su cabeza,
  // bajo el anillo, y la salida baja de ahí afilándose.
  E(m, { prev, next }) {
    const [top, ring, bot] = U.E
    const body = [top, ring], weld = []
    if (prev) body.push(new Duct(m.left, PY, RP).cubic(m.left + 0.9, PY, 1.9, 5.85, 2.0, 5.12, 0.42, [[0.6, 0.16]]))
    else body.push(bot)
    if (next) weld.push(new Duct(prev ? 1.55 : 2.0, prev ? 5.9 : 5.8, 0.09).flow(m.right, PY, [1, 0], RP, { mids: [[0.5, RT]] }))
    return { body, weld }
  },

  // El triángulo se amarra al hilo: el hilo sube por el lado derecho, cruza
  // arriba, baja por el izquierdo y sale. Sus colas se cruzan en la punta.
  Y(m, { prev, next }) {
    const [bar, tri] = U.Y
    if (!prev && !next) return { body: [bar, tri] }
    const d = prev
      ? new Duct(m.left, PY, RP, { base: 'orient' }).flow(2.2, 5.13, [0.33, -0.944], 0.2, { k1: 0.5, k2: 0.3, mids: [[0.55, 0.14]] })
      : new Duct(2.1, 5.4, 0.08, { base: 'orient' })
    d.turn(3.4, 1.7, 0.6, 1.7, 0.5, FULL, [[0.4, FULL]])
    d.turn(0.6, 1.7, 2.01, 5.74, 0.5, FULL)
    if (next) { d.line(1.8, 5.13, 0.17, [[0.45, FULL]]); d.flow(m.right, PY, [1, 0], RP, { k1: 0.3, k2: 0.5, mids: [[0.35, 0.11], [0.6, RT]] }) }
    else d.line(1.92, 5.45, 0, [[0.5, FULL]])
    return { body: [bar, d] }
  },

  // La gota de abajo es el golpe de pincel: el hilo llega cargándose, aprieta
  // en la base y sale hacia arriba en punta. La salida es una cola que se
  // despega del golpe.
  R(m, { prev, next }) {
    const [roof, drop] = U.R
    const body = [roof], weld = []
    if (prev) body.push(new Duct(m.left, PY, RP).cubic(m.left + 0.9, PY, 1.4, 5.68, 1.95, 5.66, 0.24, [[0.5, 0.14]]).turn(2.42, 5.64, 1.75, 4.3, 0.34, 0.43).line(1.75, 4.3, 0))
    else body.push(drop)
    if (next) weld.push(new Duct(2.2, 5.82, 0.1).cubic(2.9, 5.86, m.right - 0.8, PY, m.right, PY, RP, [[0.5, RT]]))
    return { body, weld }
  },

  // El triángulo abre las piernas: el hilo entra subiendo por la izquierda,
  // baja por la derecha y sale. La base va aparte, entre los pies.
  A(m, { prev, next }) {
    const [tri, ...crest] = U.A
    if (!prev && !next) return { body: [tri, ...crest] }
    const d = prev
      ? new Duct(m.left, PY, RP, { base: 'orient' }).flow(0.62, 4.9, [0.418, -0.909], 0.23, { k1: 0.5, k2: 0.35, mids: [[0.5, 0.14]] })
      : new Duct(0.3, 5.6, FULL, { base: 'orient' })
    d.turn(2, 1.9, 3.38, 4.9, 0.5, FULL, [[0.45, FULL]])
    if (next) { d.line(3.38, 4.9, 0.18, [[0.5, FULL]]); d.flow(m.right, PY, [1, 0], RP, { k1: 0.35, k2: 0.5, mids: [[0.35, 0.11], [0.6, RT]] }) }
    else d.line(3.7, 5.6, FULL)
    const base = Br([[3.15, 5.5], [0.95, 5.53]], { r: 0.25, taperLen: 1.9 })
    return { body: [...crest, d, base] }
  },

  // La barra de abajo empieza con la entrada del pincel: el hilo sube en S y
  // se vuelve la barra.
  D(m, { prev }) {
    const [top, ring, bot] = U.D
    if (!prev) return { body: [top, ring, bot] }
    const d = new Duct(m.left, PY, RP).cubic(m.left + 0.8, PY, 0.45, 5.1, 1.35, 5.07, 0.31, [[0.5, 0.18]])
    d.line(3.7, 4.97, 0.14, [[0.3, 0.31]], 'in')
    return { body: [top, ring, d] }
  },
}

/** La palabra con las formas unidas. Regresa los grupos por runa. */
export function wordJoined(seq, weight) {
  const glyphs = []
  let cursor = 0
  seq.forEach((g, i) => {
    const m = measure(g.strokes, weight)
    const form = FORMS[g.name](m, { prev: i > 0, next: i < seq.length - 1 })
    const dx = cursor - m.left
    const shift = (ss) => circlesWith(ss || [], weight, spine2).map(([x, y, r]) => [x + dx, y, r])
    glyphs.push({ name: g.name, x0: cursor, x1: cursor + m.right - m.left, body: shift(form.body), weld: shift(form.weld) })
    cursor += m.right - m.left
  })
  return { glyphs, width: cursor }
}

/** Campo de la palabra: cada runa suelda lo suyo y entre runas la unión es dura. */
export function fieldJoined(word, view, ppu, k = 0.2) {
  const w = Math.ceil((view.x1 - view.x0) * ppu), h = Math.ceil((view.y1 - view.y0) * ppu)
  const opts = { x0: view.x0, y0: view.y0, w, h, ppu, band: 0.6, center: 0.5 }
  const f = new Float32Array(w * h).fill(0.6)
  const smin = (a, b) => { const hh = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - hh * hh * k * 0.25 }
  for (const g of word.glyphs) {
    const fa = core.distanceField(g.body, opts)
    const fb = g.weld.length ? core.distanceField(g.weld, opts) : null
    for (let i = 0; i < f.length; i++) { const v = fb ? smin(fa[i], fb[i]) : fa[i]; if (v < f[i]) f[i] = v }
  }
  return { f, w, h }
}
