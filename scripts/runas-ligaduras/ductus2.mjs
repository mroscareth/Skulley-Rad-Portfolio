// Ligaduras por ductus, con grosor continuo (pedido de Oscar): el hilo arranca
// con el grosor exacto con que termina la runa y llega con el grosor exacto con
// que empieza la siguiente, siguiendo la dirección del trazo en los dos
// extremos. No hay costura: el trazo se adelgaza hasta volverse hilo y el hilo
// engorda hasta volverse el primer trazo de la otra.
//
// Salidas, según cómo acaba la runa:
//   tip   remate afilado: se corta donde ya está delgado y el hilo sigue la curva
//   press apretón: el hilo sale con todo el grosor y se va adelgazando
//   cusp  punta: el hilo cambia de dirección en la punta, con el grosor de ahí
//   peel  desprendimiento: nace dentro del trazo, con su grosor, y se separa
// Entradas:
//   smooth llega en la dirección del trazo (curva única hasta él)
//   cusp   llega de frente al arranque (unión en punta) y se carga al caer
//   at: 'end' entra por el final del trazo, en contra de su dirección (el
//          gancho de la K recibe a la S). Va en PAIR_ENTRY, por par.
import { circlesWith } from './bench.mjs'
import { Duct } from './duct.mjs'
import { measure, spine2 } from './forms.mjs'

export const RT = 0.07      // hilo (peso Medium)
const STEP = 0.03
const unit = ([x, y]) => { const l = Math.hypot(x, y) || 1; return [x / l, y / l] }

export const DUCTUS = {
  // La cola del rayo da vuelta en la punta y sale hacia arriba a la derecha en
  // un arco bajo (dibujado por Oscar, 2026-11-10) que entra al gancho de la K.
  S: { order: [1], marks: [0], entry: { stroke: 1, mode: 'smooth' }, exit: { stroke: 1, mode: 'cusp', dir: [0.86, -0.5] } },
  K: { order: [0, 1, 2], marks: [3], entry: { stroke: 0, mode: 'cusp', arrive: [0.22, -0.98] }, exit: { stroke: 2, mode: 'press' } },
  U: { order: [0], marks: [1], entry: { stroke: 0, mode: 'cusp', arrive: [0.22, -0.98] }, exit: { stroke: 0, mode: 'cusp', dir: [0.5, 0.86] } },
  LL: { order: [0, 1], marks: [2], entry: { stroke: 0, mode: 'smooth' }, exit: { stroke: 1, mode: 'tip' } },
  // El anillo acaba a la izquierda subiendo: el pincel sigue por encima y se
  // desprende en el hombro derecho.
  E: { order: [1], marks: [0, 2], entry: { stroke: 1, mode: 'smooth' }, exit: { stroke: 1, mode: 'peel', at: 0.27 } },
  // Primero el triángulo y al final la barra, como el palito de la t.
  Y: { order: [1, 0], entry: { stroke: 1, mode: 'smooth' }, exit: { stroke: 0, mode: 'tip' } },
  R: { order: [0, 1], entry: { stroke: 0, mode: 'smooth' }, exit: { stroke: 1, mode: 'press' } },
  // La base acaba a la izquierda: el pincel da vuelta en la punta y regresa por debajo.
  A: { order: [0], marks: [1, 2, 3], entry: { stroke: 0, mode: 'smooth' }, exit: { stroke: 0, mode: 'cusp', dir: [1, 0.32] } },
  // Empieza por la barra de abajo: sigue la base que trae la runa anterior.
  D: { order: [2, 1, 0], entry: { stroke: 2, mode: 'smooth' } },
}

// [k1, k2] = qué tanto sigue el hilo la salida / la llegada.
export const PAIR_K = {
  'S>K': [0.42, 0.42],
  'K>U': [0.2, 0.5], 'U>LL': [0.32, 0.5], 'LL>E': [0.4, 0.34], 'E>Y': [0.35, 0.42],
  'Y>R': [0.4, 0.55], 'R>A': [0.32, 0.5], 'A>D': [0.42, 0.4],
}

// Entradas que dependen de la runa anterior.
export const PAIR_ENTRY = {
  'S>K': { stroke: 0, at: 'end', mode: 'smooth' },
}

const spineOf = (s) => spine2(s, { step: STEP, weight: 1 })
const dirAt = (pts, i, back = false) => {
  const n = pts.length, k = 4
  return back ? unit([pts[i][0] - pts[Math.max(0, i - k)][0], pts[i][1] - pts[Math.max(0, i - k)][1]])
    : unit([pts[Math.min(n - 1, i + k)][0] - pts[i][0], pts[Math.min(n - 1, i + k)][1] - pts[i][1]])
}

// Dónde y cómo se levanta el pincel. cut = índice donde se corta el trazo.
function exitOf(stroke, ex) {
  const { pts, rad } = spineOf(stroke)
  const n = pts.length
  if (ex.mode === 'press') return { p: pts[n - 1], r: rad[n - 1], d: dirAt(pts, n - 1, true) }
  if (ex.mode === 'peel') {
    const i = Math.round(ex.at * (n - 1))
    return { p: pts[i], r: rad[i], d: dirAt(pts, i) }
  }
  // tip / cusp: se corta donde el remate ya mide lo del hilo (o un poco más).
  const target = ex.mode === 'tip' ? RT * 1.7 : RT
  let i = n - 1
  while (i > 1 && rad[i] < target) i--
  return { p: pts[i], r: rad[i], d: ex.mode === 'cusp' ? unit(ex.dir) : dirAt(pts, i, true), cut: i }
}

function entryOf(stroke, en) {
  const { pts, rad } = spineOf(stroke)
  if (en.at === 'end') {
    const n = pts.length, t = dirAt(pts, n - 1, true)
    return { p: pts[n - 1], r: rad[n - 1], d: en.arrive ? unit(en.arrive) : [-t[0], -t[1]] }
  }
  return { p: pts[0], r: rad[0], d: en.mode === 'cusp' ? unit(en.arrive) : dirAt(pts, 0) }
}

// El trazo cortado (para el remate que se vuelve hilo).
const cutStroke = (s, cut) => ({ circles: (weight) => { const sp = spine2(s, { step: STEP, weight }); return { pts: sp.pts.slice(0, cut + 1), rad: sp.rad.slice(0, cut + 1) } } })

export function wordDuctus2(seq, weight, { air = 0.45 } = {}) {
  const gs = seq.map((g) => ({ ...g, du: DUCTUS[g.name], m: measure(g.strokes, weight), weld: [], strokesJoined: [...g.strokes] }))
  let cursor = 0
  gs.forEach((g, i) => {
    g.dx = cursor - g.m.left
    g.joined = !!gs[i + 1] && g.du.joins !== false
    cursor += g.m.right - g.m.left + (g.joined ? air : 0)
  })
  const threads = []
  gs.forEach((A, i) => {
    if (!A.joined) return
    const B = gs[i + 1], key = `${A.name}>${B.name}`, k = PAIR_K[key] || [0.4, 0.4]
    const ex = exitOf(A.strokes[A.du.exit.stroke], A.du.exit)
    const enDef = PAIR_ENTRY[key] || B.du.entry
    const en = entryOf(B.strokes[enDef.stroke], enDef)
    if (ex.cut != null) A.strokesJoined[A.du.exit.stroke] = cutStroke(A.strokes[A.du.exit.stroke], ex.cut)
    const P = [ex.p[0] + A.dx, ex.p[1]], Q = [en.p[0] + B.dx, en.p[1]]
    const L = Math.hypot(Q[0] - P[0], Q[1] - P[1])
    // Grosor: el de la salida, se suelta hasta el hilo, viaja fino y se carga
    // hasta el arranque de la siguiente.
    // El cambio de grosor pasa pegado a las runas, en distancias fijas: se
    // suelta en el primer tramo (OUT) y se carga solo al final (IN; corto si
    // llega en punta, porque ahí el pincel cae de golpe).
    const OUT = A.du.exit.mode === 'press' ? 0.75 : 0.6
    const IN = enDef.mode === 'cusp' ? 0.42 : 0.95
    const fOut = Math.min(0.38, OUT / L), fIn = 1 - Math.min(0.4, IN / L)
    const mids = []
    if (ex.r > RT * 1.3) mids.push([fOut, RT, 'smooth'])
    mids.push([Math.max(fOut + 0.02, fIn), RT])
    const d = new Duct(P[0], P[1], ex.r)
      .cubic(P[0] + ex.d[0] * L * k[0], P[1] + ex.d[1] * L * k[0], Q[0] - en.d[0] * L * k[1], Q[1] - en.d[1] * L * k[1], Q[0], Q[1], en.r, mids, 'in')
    threads.push({ key, duct: d, P, Q, rOut: ex.r, rIn: en.r })
    A.weld.push(d); B.weld.push(d)
  })
  const glyphs = gs.map((g) => {
    const sh = (cs) => cs.map(([x, y, r]) => [x + g.dx, y, r])
    return { name: g.name, x0: g.m.left + g.dx, x1: g.m.right + g.dx, body: sh(circlesWith(g.strokesJoined, weight, spine2)), weld: circlesWith(g.weld, weight, spine2) }
  })
  return { glyphs, width: cursor, threads }
}

export { exitOf, entryOf }
