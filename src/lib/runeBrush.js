// Pincel y pluma de las runas de SKULLEYGLYPH. Lo usa scripts/gen-runes.mjs para
// generar la fuente y el atlas de los shaders; el navegador no lo carga.
//
// Desde la v2.2 (2026-11-10, ver typography.md) cada runa se pinta en dos pasos:
//  1. El pincel (strokeSpine) da el camino de cada trazo y su presión: un
//     extremo grueso y otro afilado, nunca grueso-delgado-grueso (pedido de
//     Oscar). Los caminos con esquinas van de un solo grosor y las figuras
//     cerradas dan la vuelta completa: sin bolas ni costuras.
//  2. La pluma plana (penBoxes) pinta ese camino con una punta casi vertical:
//     de lado deja todo su alto (horizontales gruesas) y al bajar solo su canto
//     (verticales y diagonales delgadas), como la letra china en bloque que
//     trajo Oscar de referencia.
// Coordenadas en una caja de 4 × 6 con la Y hacia abajo; la línea base está en y = 6.

const sub = (a, b) => [a[0] - b[0], a[1] - b[1]]
const add = (a, b) => [a[0] + b[0], a[1] + b[1]]
const mul = (a, k) => [a[0] * k, a[1] * k]
const len = (a) => Math.hypot(a[0], a[1])
const norm = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l] }
const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]
const smooth = (e0, e1, x) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t) }

// Punta sin cuello: llega al grosor completo sin hombro y a la punta con pendiente.
export const TIP = { p: 1.75, sweep: 1.55, len: [1.7, 2.6], frac: 0.3 }
export const tipW = (x, p = TIP.p) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), p)

// Radio del pincel: los trazos verticales cargan más tinta que los horizontales.
export const R = { v: 0.46, h: 0.31 }
const UNI = 0.41   // grosor de los caminos con esquinas (entre el vertical y el horizontal)

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
 * Camino central del trazo y la presión del pincel (radio) en cada punto.
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
    // Un camino con esquinas va de un solo grosor: el que cambiaba con la
    // dirección dejaba una bola en cada esquina, como dos trazos encimados.
    const corner = !s.kind && !s.smooth && !s.bend && s.end !== 'hane' && s.p.length > 2
    const base = s.r ?? (corner ? UNI : (R.h + (R.v - R.h) * smooth(0.35, 0.85, Math.abs(tang[i][1]))))
    let r = base
    if (s.kind === 'sweep') r = base * 1.08 * tipW((1 - t) / 0.94, TIP.sweep)      // gota que se afila
    else if (s.kind === 'rise') r = base * (0.3 + 0.92 * Math.pow(t, 0.85))   // nace fino, remata grueso
    else if (s.kind === 'dot') r = base * (0.36 + 0.68 * t)                   // pico de cresta
    else {
      // Arranque o remate en diagonal: el grosor sube o baja en línea recta en
      // ese tramo (con la pluma, una orilla recta y la otra sesgada).
      if (s.startTaper) r *= Math.min(1, d / s.startTaper)
      if (s.endTaper) r *= Math.min(1, (total - d) / s.endTaper)
      if (s.end === 'harai') { const L = s.taperLen ?? Math.min(TIP.len[1], Math.max(TIP.len[0], TIP.frac * total)); r *= 1 - (s.taper ?? 1) * (1 - tipW((total - d) / L)) }
      if (hookFrom != null) r *= d < hookFrom ? 1 - 0.15 * smooth(hookFrom - 0.5, hookFrom, d) : 0.85 - 0.73 * ((d - hookFrom) / (total - hookFrom))
    }
    // Nace dentro de otro trazo: entra fino y la unión queda soldada.
    if (s.start === 'join') r *= 0.5 + 0.5 * smooth(0, 0.5, d)
    return Math.max(r * (s.scale ?? 1) * weight, 0)
  })
  // Un solo pico: sube hasta el más grueso y de ahí solo baja.
  let peak = 0
  for (let i = 1; i < n; i++) if (rad[i] > rad[peak] + 1e-6) peak = i
  for (let i = peak + 1; i < n; i++) rad[i] = Math.min(rad[i], rad[i - 1])
  for (let i = peak - 1; i >= 0; i--) rad[i] = Math.min(rad[i], rad[i + 1])
  // La punta acaba donde al pincel ya no le queda tinta: sin el palito con
  // bolita que dejaba un radio mínimo.
  const minR = (s.minR ?? 0.018) * weight
  let a = 0, b = n - 1
  while (b > a + 2 && rad[b] < minR) b--
  while (a < b - 2 && rad[a] < minR) a++
  return { pts: pts.slice(a, b + 1), rad: rad.slice(a, b + 1) }
}

// ── Pluma plana ──────────────────────────────────────────────────────────
// h = medio alto de la punta y w = medio ancho, a presión completa (peso
// Medium); angle = inclinación (da el corte sesgado de los remates); ref = radio
// del pincel que cuenta como presión completa; blade = alto de las cuchillas;
// dotMax = un acento más corto que esto es un punto redondo.
export const NIB = { h: 0.68, w: 0.085, angle: 0.1, ref: 0.46, blade: 0.34, dotMax: 0.7 }

/**
 * Lo que deja la pluma: rectángulos [x, y, medio ancho, medio alto, giro,
 * redondo] a lo largo de cada trazo (los acentos más cortos son puntos).
 */
export function penBoxes(ss, weight, nib = NIB) {
  const out = []
  for (const s of ss) {
    const { pts, rad } = strokeSpine(s, { step: 0.012, weight })
    const n = pts.length
    let total = 0
    for (let i = 1; i < n; i++) total += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])
    if (s.kind === 'dot' && total < nib.dotMax) {
      const c = pts[Math.floor(n * 0.6)]
      out.push([c[0], c[1], nib.h * weight * 0.55, nib.h * weight * 0.55, 0, true])
      continue
    }
    // Para el remate en diagonal: lo más grueso del trazo (hasta el alto de la punta).
    const pFull = Math.min(1, Math.max(...rad) / (nib.ref * weight))
    for (let i = 0; i < n; i++) {
      const p = Math.min(1.15, rad[i] / (nib.ref * weight))
      if (s.kind === 'dot') {
        // Gotas y picos: la punta atraviesa el trazo y deja una media luna
        // filosa, afilada en las dos puntas y con una orilla casi recta.
        const a = pts[Math.min(n - 1, i + 1)], b = pts[Math.max(0, i - 1)]
        const ang = Math.atan2(a[1] - b[1], a[0] - b[0])
        const t = i / (n - 1), leaf = Math.pow(Math.sin(Math.PI * Math.min(1, t * 0.94 + 0.03)), 0.6)
        const half = nib.h * weight * nib.blade, off = half * 0.85 * (1 - leaf)
        out.push([pts[i][0] - Math.sin(ang) * off, pts[i][1] + Math.cos(ang) * off, nib.w * weight * 0.5, half * leaf, ang])
      } else {
        // Remate en diagonal: al afilarse, la orilla de abajo sigue recta y la
        // de arriba baja hasta clavarse en una punta.
        const full = nib.h * weight * pFull, cur = nib.h * weight * Math.min(p, pFull), drop = full - cur
        out.push([pts[i][0] - Math.sin(nib.angle) * drop, pts[i][1] + Math.cos(nib.angle) * drop, nib.w * weight * Math.max(0.35, p), cur, nib.angle])
      }
    }
  }
  return out
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

// Figura cerrada de un trazo: arranca a media orilla (en una esquina asomaba el
// remate del inicio), da toda la vuelta y se afila encima de ese mismo tramo.
export const closed = (pts) => {
  const m = lerp(pts[0], pts[1], 0.5)
  const end = lerp(m, pts[1], 0.6)
  return Br([m, ...pts.slice(1), pts[0], m, end], { fillet: 0.5, taperLen: Math.hypot(end[0] - m[0], end[1] - m[1]) })
}
export const triUp = (x0, y0, x1, y1) => closed([[x0, y1], [(x0 + x1) / 2, y0], [x1, y1]])
export const triDown = (x0, y0, x1, y1) => closed([[x0, y0], [x1, y0], [(x0 + x1) / 2, y1]])
export const diamond = (cx, cy, rx, ry) => closed([[cx, cy - ry], [cx + rx, cy], [cx, cy + ry], [cx - rx, cy]])
export const box = (x0, y0, x1, y1) => closed([[x0, y0], [x1, y0], [x1, y1], [x0, y1]])
export const capBox = (x0, y0, x1, y1) => Br([[x0, y1], [x0, y0], [x1, y0], [x1, y1]], { fillet: 0.5 })   // ⊓

const flipStroke = (s, fx, fy) => ({
  ...s,
  p: s.p.map(([x, y]) => [fx ? 4 - x : x, fy ? 6 - y : y]),
  ...(s.hook ? { hook: [fx ? -s.hook[0] : s.hook[0], fy ? -s.hook[1] : s.hook[1]] } : {}),
  ...(s.bend != null ? { bend: fx !== fy ? -s.bend : s.bend } : {}),
})
export const rot180 = (ss) => ss.map((s) => flipStroke(s, true, true))
export const mirrorX = (ss) => ss.map((s) => flipStroke(s, true, false))
