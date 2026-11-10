// Pincel de las runas de SKULLEYGLYPH. Lo usa scripts/gen-runes.mjs para
// generar la fuente y el atlas de los shaders; el navegador no lo carga.
//
// Cada trazo es una gota de pincel: un extremo grueso y redondo, el otro
// afilado. El grosor sube y luego baja, o solo baja, o solo sube; nunca
// grueso-delgado-grueso (pedido de Oscar). Coordenadas en una caja de 4 × 6
// con la Y hacia abajo; la línea base está en y = 6.

const sub = (a, b) => [a[0] - b[0], a[1] - b[1]]
const add = (a, b) => [a[0] + b[0], a[1] + b[1]]
const mul = (a, k) => [a[0] * k, a[1] * k]
const len = (a) => Math.hypot(a[0], a[1])
const norm = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l] }
const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]
const smooth = (e0, e1, x) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t) }

// Radio del pincel: los trazos verticales cargan más tinta que los horizontales.
export const R = { v: 0.46, h: 0.31 }

function fillet(pts, radius) {
  if (pts.length < 3) return pts
  const out = [pts[0]]
  for (let i = 1; i < pts.length - 1; i++) {
    const a = pts[i - 1], b = pts[i], c = pts[i + 1]
    const d1 = norm(sub(a, b)), d2 = norm(sub(c, b))
    const r = Math.min(radius, len(sub(a, b)) / 2, len(sub(c, b)) / 2)
    const p1 = add(b, mul(d1, r)), p2 = add(b, mul(d2, r))
    for (let k = 0; k <= 8; k++) { const t = k / 8; out.push(add(add(mul(p1, (1 - t) * (1 - t)), mul(b, 2 * t * (1 - t))), mul(p2, t * t))) }
  }
  out.push(pts[pts.length - 1])
  return out
}
function catmull(pts, per = 12) {
  const out = []
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)]
    for (let k = 0; k < per; k++) {
      const t = k / per, t2 = t * t, t3 = t2 * t
      const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3)
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])])
    }
  }
  out.push(pts[pts.length - 1])
  return out
}
function bent(p0, p1, bend) {
  const d = norm(sub(p1, p0)); const n = [-d[1], d[0]]
  const c = add(lerp(p0, p1, 0.5), mul(n, bend))
  const out = []
  for (let k = 0; k <= 16; k++) { const t = k / 16; out.push(add(add(mul(p0, (1 - t) * (1 - t)), mul(c, 2 * t * (1 - t))), mul(p1, t * t))) }
  return out
}
function resample(path, step) {
  const segs = []; let total = 0
  for (let i = 0; i < path.length - 1; i++) { const l = len(sub(path[i + 1], path[i])); segs.push(l); total += l }
  const n = Math.max(2, Math.ceil(total / step)); const out = []
  let si = 0, acc = 0
  for (let k = 0; k <= n; k++) {
    const target = (k / n) * total
    while (si < segs.length - 1 && acc + segs[si] < target) { acc += segs[si]; si++ }
    const t = segs[si] > 0 ? (target - acc) / segs[si] : 0
    out.push(lerp(path[si], path[si + 1], Math.min(1, t)))
  }
  return { pts: out, total }
}

/**
 * Camino central del trazo y el radio del pincel en cada punto.
 * `weight` engorda o adelgaza todo el trazo (los tres pesos de la fuente).
 */
export function strokeSpine(s, { step = 0.03, weight = 1 } = {}) {
  const ctrl = s.p.map((q) => [...q])
  let hookFrom = null
  let path
  if (s.end === 'hane') {
    // Gancho: al llegar abajo el pincel da un giro corto y sale afilándose
    // hacia arriba a la izquierda, como una púa que nace del tallo.
    const last = ctrl[ctrl.length - 1], prev = ctrl[ctrl.length - 2]
    const dir = norm(sub(last, prev))
    const hk = norm(s.hook || [-0.88, -0.48])
    const straight = ctrl.length > 2 ? fillet(ctrl, s.fillet ?? 0.7) : ctrl
    const c1 = add(add(last, mul(dir, 0.3)), mul(hk, 0.1))
    const tip = add(last, mul(hk, s.hookLen ?? 1.15))
    const turn = []
    for (let k = 1; k <= 14; k++) { const t = k / 14; turn.push(add(add(mul(last, (1 - t) * (1 - t)), mul(c1, 2 * t * (1 - t))), mul(tip, t * t))) }
    let acc = 0
    for (let i = 0; i < straight.length - 1; i++) acc += len(sub(straight[i + 1], straight[i]))
    hookFrom = acc
    path = straight.concat(turn)
  } else if (s.smooth && ctrl.length > 2) path = catmull(ctrl)
  else if (s.bend && ctrl.length === 2) path = bent(ctrl[0], ctrl[1], s.bend)
  else path = fillet(ctrl, s.fillet ?? 0.7)
  const { pts, total } = resample(path, step)
  const n = pts.length
  const tang = pts.map((_, i) => norm(sub(pts[Math.min(n - 1, i + 1)], pts[Math.max(0, i - 1)])))
  const rad = pts.map((_, i) => {
    const t = i / (n - 1), d = t * total
    const base = s.r ?? (R.h + (R.v - R.h) * smooth(0.35, 0.85, Math.abs(tang[i][1])))
    let r = base
    if (s.kind === 'sweep') r = base * (1.08 - 0.84 * smooth(0.1, 1, t))      // gota que se afila
    else if (s.kind === 'rise') r = base * (0.3 + 0.92 * Math.pow(t, 0.85))   // nace fino, remata grueso
    else if (s.kind === 'dot') r = base * (0.36 + 0.68 * t)                   // pico de cresta
    else {
      if (s.end === 'harai') r *= 1 - (s.taper ?? 0.8) * smooth(Math.max(0, 1 - 1.6 / total), 1, t)
      if (hookFrom != null) r *= d < hookFrom ? 1 - 0.15 * smooth(hookFrom - 0.5, hookFrom, d) : 0.85 - 0.73 * ((d - hookFrom) / (total - hookFrom))
    }
    // Nace dentro de otro trazo: entra fino y la unión queda soldada.
    if (s.start === 'join') r *= 0.5 + 0.5 * smooth(0, 0.5, d)
    return Math.max(r * (s.scale ?? 1) * weight, 0.05 * weight)
  })
  // Un solo pico: sube hasta el más grueso y de ahí solo baja.
  let peak = 0
  for (let i = 1; i < n; i++) if (rad[i] > rad[peak] + 1e-6) peak = i
  for (let i = peak + 1; i < n; i++) rad[i] = Math.min(rad[i], rad[i - 1])
  for (let i = peak - 1; i >= 0; i--) rad[i] = Math.min(rad[i], rad[i + 1])
  return { pts, rad }
}

// Vocabulario del pincel.
export const Sw = (x1, y1, x2, y2, o = {}) => ({ p: [[x1, y1], [x2, y2]], kind: 'sweep', bend: 0.3, r: R.v, ...o })   // grueso → punta
export const Ri = (x1, y1, x2, y2, o = {}) => ({ p: [[x1, y1], [x2, y2]], kind: 'rise', bend: -0.25, r: R.v, ...o })  // fino → grueso
export const Dr = (x1, y1, x2, y2, o = {}) => ({ p: [[x1, y1], [x2, y2]], kind: 'dot', bend: 0.12, r: R.v * 0.95, ...o }) // gota / pico
export const Br = (pts, o = {}) => ({ p: pts, end: 'harai', ...o })                                                        // camino que se afila
export const Bh = (x1, x2, y, o = {}) => ({ p: [[x1, y], [x2, y - 0.12]], end: 'harai', taper: 0.55, bend: -0.06, ...o })  // barra
export const Hk = (pts, o = {}) => ({ p: pts, end: 'hane', ...o })                                                         // tallo con gancho
export const Cv = (pts, o = {}) => ({ p: pts, smooth: true, end: 'harai', ...o })                                          // curva

// Arco de elipse (ensō, copas, arcos). Ángulos con la Y hacia abajo.
export const arc = (cx, cy, rx, ry, from, span, n = 15) => Array.from({ length: n }, (_, i) => {
  const a = from + (i / (n - 1)) * span
  return [cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]
})

// Figura cerrada de un trazo: arranca gruesa en la primera esquina y cierra
// afilándose antes de tocarla, como el ensō pero con esquinas.
export const closed = (pts, gap = 0.18) => Br([...pts, lerp(pts[pts.length - 1], pts[0], 1 - gap)], { fillet: 0.5 })
export const triUp = (x0, y0, x1, y1) => closed([[x0, y1], [(x0 + x1) / 2, y0], [x1, y1]])
export const triDown = (x0, y0, x1, y1) => closed([[x0, y0], [x1, y0], [(x0 + x1) / 2, y1]])
export const diamond = (cx, cy, rx, ry) => closed([[cx, cy - ry], [cx + rx, cy], [cx, cy + ry], [cx - rx, cy]], 0.22)
export const box = (x0, y0, x1, y1) => closed([[x0, y0], [x1, y0], [x1, y1], [x0, y1]], 0.2)
export const capBox = (x0, y0, x1, y1) => Br([[x0, y1], [x0, y0], [x1, y0], [x1, y1]], { fillet: 0.5 })   // ⊓

const flipStroke = (s, fx, fy) => ({
  ...s,
  p: s.p.map(([x, y]) => [fx ? 4 - x : x, fy ? 6 - y : y]),
  ...(s.hook ? { hook: [fx ? -s.hook[0] : s.hook[0], fy ? -s.hook[1] : s.hook[1]] } : {}),
  ...(s.bend != null ? { bend: fx !== fy ? -s.bend : s.bend } : {}),
})
export const rot180 = (ss) => ss.map((s) => flipStroke(s, true, true))
export const mirrorX = (ss) => ss.map((s) => flipStroke(s, true, false))
