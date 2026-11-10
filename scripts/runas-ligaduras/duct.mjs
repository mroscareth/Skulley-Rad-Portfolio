// Ducto: un trazo continuo con el grosor puesto a mano en puntos clave. Sirve
// para que la entrada, el trazo de la runa y la salida sean UNA sola pasada de
// pincel (sin soldaduras), que es lo que hace fluir a la escritura ligada.
import { R } from './brush2.mjs'

const smooth = (e0, e1, x) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t) }
const unit = ([x, y]) => { const l = Math.hypot(x, y) || 1; return [x / l, y / l] }
// Como el pincel: los trazos verticales cargan más tinta que los horizontales.
export const orient = (ty) => R.h + (R.v - R.h) * smooth(0.35, 0.85, Math.abs(ty))
export const FULL = 0.5   // "todo lo que dé el pincel" cuando base = 'orient'

const EASE = {
  lin: (u) => u,
  smooth: (u) => u * u * (3 - 2 * u),
  in: (u) => u * u,            // tarda en cambiar y cambia al final
  out: (u) => 1 - (1 - u) * (1 - u), // cambia pronto y se asienta
}

export class Duct {
  constructor(x, y, r, opt = {}) { this.P = [[x, y]]; this.K = [{ i: 0, r }]; this.opt = opt }
  get cur() { return this.P[this.P.length - 1] }
  get dir() { const n = this.P.length; return n > 1 ? unit([this.P[n - 1][0] - this.P[n - 2][0], this.P[n - 1][1] - this.P[n - 2][1]]) : [1, 0] }

  // Claves de radio: `r` al final del tramo y `mids` = [[fracción del tramo, radio, ease?]].
  _keys(i0, r, mids, e) {
    const i1 = this.P.length - 1
    if (mids?.length) {
      const cum = [0]
      for (let i = i0 + 1; i <= i1; i++) cum.push(cum[cum.length - 1] + Math.hypot(this.P[i][0] - this.P[i - 1][0], this.P[i][1] - this.P[i - 1][1]))
      const L = cum[cum.length - 1]
      for (const [u, rr, ee] of mids) {
        let k = cum.findIndex((c) => c >= u * L)
        if (k < 0) k = cum.length - 1
        this.K.push({ i: i0 + k, r: rr, e: ee })
      }
    }
    if (r != null) this.K.push({ i: i1, r, e })
    return this
  }
  line(x, y, r, mids, e) {
    const [ax, ay] = this.cur, i0 = this.P.length - 1
    const n = Math.max(2, Math.ceil(Math.hypot(x - ax, y - ay) / 0.02))
    for (let k = 1; k <= n; k++) this.P.push([ax + (x - ax) * (k / n), ay + (y - ay) * (k / n)])
    return this._keys(i0, r, mids, e)
  }
  cubic(c1x, c1y, c2x, c2y, x, y, r, mids, e) {
    const [ax, ay] = this.cur, i0 = this.P.length - 1
    for (let k = 1; k <= 64; k++) {
      const t = k / 64, v = 1 - t
      this.P.push([v * v * v * ax + 3 * v * v * t * c1x + 3 * v * t * t * c2x + t * t * t * x, v * v * v * ay + 3 * v * v * t * c1y + 3 * v * t * t * c2y + t * t * t * y])
    }
    return this._keys(i0, r, mids, e)
  }
  // Curva que sale en la dirección que traía el pincel y llega en `endDir`.
  flow(x, y, endDir, r, { k1 = 0.4, k2 = 0.4, mids, e } = {}) {
    const [ax, ay] = this.cur, d = this.dir, L = Math.hypot(x - ax, y - ay), ed = unit(endDir)
    return this.cubic(ax + d[0] * L * k1, ay + d[1] * L * k1, x - ed[0] * L * k2, y - ed[1] * L * k2, x, y, r, mids, e)
  }
  // Recta hasta antes de la esquina y vuelta redonda hacia (tx, ty). El radio
  // `r` cae a media vuelta.
  turn(cx, cy, tx, ty, f, r, mids, e) {
    const [ax, ay] = this.cur
    const d1 = unit([cx - ax, cy - ay]), d2 = unit([tx - cx, ty - cy])
    const p1 = [cx - d1[0] * f, cy - d1[1] * f], p2 = [cx + d2[0] * f, cy + d2[1] * f]
    this.line(p1[0], p1[1], null, mids)
    const i0 = this.P.length - 1
    for (let k = 1; k <= 16; k++) {
      const t = k / 16, v = 1 - t
      this.P.push([v * v * p1[0] + 2 * v * t * cx + t * t * p2[0], v * v * p1[1] + 2 * v * t * cy + t * t * p2[1]])
    }
    if (r != null) this.K.push({ i: i0 + 8, r, e })
    return this
  }
  // Catmull-Rom por los puntos, saliendo en la dirección que traía el pincel.
  spline(points, radii, { endDir, e } = {}) {
    const all = [this.cur, ...points]
    const d = this.dir, l0 = Math.hypot(all[1][0] - all[0][0], all[1][1] - all[0][1])
    const first = [all[0][0] - d[0] * l0, all[0][1] - d[1] * l0]
    const n = all.length, ln = Math.hypot(all[n - 1][0] - all[n - 2][0], all[n - 1][1] - all[n - 2][1])
    const ed = endDir ? unit(endDir) : unit([all[n - 1][0] - all[n - 2][0], all[n - 1][1] - all[n - 2][1]])
    const last = [all[n - 1][0] + ed[0] * ln, all[n - 1][1] + ed[1] * ln]
    for (let i = 0; i < n - 1; i++) {
      const p0 = i === 0 ? first : all[i - 1], p1 = all[i], p2 = all[i + 1], p3 = i + 2 < n ? all[i + 2] : last
      for (let k = 1; k <= 24; k++) {
        const t = k / 24, t2 = t * t, t3 = t2 * t
        const f = (a, b, c, dd) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - dd) * t2 + (-a + 3 * b - 3 * c + dd) * t3)
        this.P.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])])
      }
      if (radii?.[i] != null) this.K.push({ i: this.P.length - 1, r: radii[i], e })
    }
    return this
  }

  circles(weight = 1) {
    const P = this.P, cum = [0]
    for (let i = 1; i < P.length; i++) cum.push(cum[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]))
    const total = cum[cum.length - 1]
    const keys = this.K.map((k) => ({ s: cum[k.i], r: k.r, e: k.e })).sort((a, b) => a.s - b.s)
    const n = Math.max(2, Math.ceil(total / 0.025))
    const pts = [], rad = []
    let si = 0, ki = 0
    for (let k = 0; k <= n; k++) {
      const s = (k / n) * total
      while (si < P.length - 2 && cum[si + 1] < s) si++
      const seg = cum[si + 1] - cum[si], t = seg > 0 ? (s - cum[si]) / seg : 0
      const p = [P[si][0] + (P[si + 1][0] - P[si][0]) * t, P[si][1] + (P[si + 1][1] - P[si][1]) * t]
      while (ki < keys.length - 2 && keys[ki + 1].s < s) ki++
      const a = keys[ki], b = keys[Math.min(keys.length - 1, ki + 1)]
      const u = b.s > a.s ? Math.min(1, Math.max(0, (s - a.s) / (b.s - a.s))) : 1
      let r = a.r + (b.r - a.r) * (EASE[b.e] || EASE.lin)(u)
      if (this.opt.base === 'orient') {
        const d = unit([P[si + 1][0] - P[si][0], P[si + 1][1] - P[si][1]])
        r = Math.min(orient(d[1]), r)
      }
      pts.push(p); rad.push(Math.max(r, 0) * weight)
    }
    const minR = 0.018 * weight
    let i0 = 0, i1 = pts.length - 1
    while (i1 > i0 + 2 && rad[i1] < minR) i1--
    while (i0 < i1 - 2 && rad[i0] < minR) i0++
    return { pts: pts.slice(i0, i1 + 1), rad: rad.slice(i0, i1 + 1) }
  }
}
