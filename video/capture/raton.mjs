// Mouse con mano humana para las tomas: curvas suaves (bezier con el punto de
// control corrido a un lado), velocidad de jerk mínimo, un pasón chico en los
// trayectos largos con su corrección, y un temblor leve de la mano. Todo con
// el tiempo falso del cuadro: cada cuadro se pide `aplicar(t)` y manda el
// evento con la posición de esa hora.

const mulberry = (a) => () => {
  a |= 0; a = (a + 0x6D2B79F5) | 0
  let t = Math.imul(a ^ (a >>> 15), 1 | a)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
const minJerk = (u) => u * u * u * (10 - 15 * u + 6 * u * u)

export class Raton {
  constructor(ctx, x = 960, y = 540, semilla = 7) {
    this.ctx = ctx
    this.x = x; this.y = y
    this.r = mulberry(semilla)
    this.movs = []   // {t0, dur, puntos:[p0,c1,c2,p3]}
    this.eventos = [] // {t, tipo, ...}
    this.boton = false
    this.ultimo = null
    this.fin = 0
  }

  // Programa un trayecto que empieza en `t0` (ms de la toma) y llega a (x, y).
  ir(t0, x, y, dur) {
    const desde = this.posFinal()
    const dx = x - desde.x, dy = y - desde.y
    const dist = Math.hypot(dx, dy)
    if (dur == null) dur = 260 + 110 * Math.log2(1 + dist / 40) + this.r() * 80
    const nx = -dy / (dist || 1), ny = dx / (dist || 1)
    const lado = (this.r() < 0.5 ? -1 : 1) * dist * (0.08 + this.r() * 0.12)
    const largo = dist > 260
    // Pasón: el trayecto apunta un poco más allá y luego corrige.
    const pas = largo ? 0.035 + this.r() * 0.03 : 0
    const tx = x + dx * pas + (this.r() - 0.5) * 6, ty = y + dy * pas + (this.r() - 0.5) * 6
    const c1 = { x: desde.x + dx * 0.3 + nx * lado, y: desde.y + dy * 0.3 + ny * lado }
    const c2 = { x: desde.x + dx * 0.75 + nx * lado * 0.4, y: desde.y + dy * 0.75 + ny * lado * 0.4 }
    const d1 = largo ? dur * 0.82 : dur
    this.movs.push({ t0, dur: d1, p: [desde, c1, c2, { x: tx, y: ty }] })
    if (largo) {
      const d2 = dur * 0.3
      this.movs.push({ t0: t0 + d1, dur: d2, p: [{ x: tx, y: ty }, { x: tx, y: ty }, { x, y }, { x, y }] })
    }
    this.fin = Math.max(this.fin, t0 + dur + (largo ? dur * 0.12 : 0))
    return this.fin
  }

  clic(t) {
    this.eventos.push({ t, tipo: 'mousePressed' })
    this.eventos.push({ t: t + 70 + this.r() * 40, tipo: 'mouseReleased' })
    return t + 120
  }
  bajar(t) { this.eventos.push({ t, tipo: 'mousePressed' }); return t }
  soltar(t) { this.eventos.push({ t, tipo: 'mouseReleased' }); return t }
  ruedaEn(t, deltaY) { this.eventos.push({ t, tipo: 'mouseWheel', deltaY }); return t }

  posFinal() {
    const m = this.movs[this.movs.length - 1]
    return m ? m.p[3] : { x: this.x, y: this.y }
  }

  posEn(t) {
    let pos = { x: this.x, y: this.y }
    for (const m of this.movs) {
      if (t < m.t0) break
      const u = Math.min(1, (t - m.t0) / m.dur)
      const e = minJerk(u)
      const [a, b, c, d] = m.p
      const k = 1 - e
      pos = {
        x: k * k * k * a.x + 3 * k * k * e * b.x + 3 * k * e * e * c.x + e * e * e * d.x,
        y: k * k * k * a.y + 3 * k * k * e * b.y + 3 * k * e * e * c.y + e * e * e * d.y,
      }
    }
    // Temblor de la mano: dos senos lentos, menos de un pixel y medio.
    pos.x += Math.sin(t * 0.0021 + 1.3) * 0.9 + Math.sin(t * 0.0057) * 0.5
    pos.y += Math.sin(t * 0.0017 + 0.4) * 0.8 + Math.sin(t * 0.0049 + 2) * 0.4
    return pos
  }

  async aplicar(t) {
    const p = this.posEn(t)
    const { client } = this.ctx
    const pendientes = this.eventos.filter((e) => !e.hecho && e.t <= t).sort((a, b) => a.t - b.t)
    if (!this.ultimo || Math.abs(p.x - this.ultimo.x) > 0.2 || Math.abs(p.y - this.ultimo.y) > 0.2) {
      await client.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: p.x, y: p.y, button: this.boton ? 'left' : 'none', buttons: this.boton ? 1 : 0 })
      this.ultimo = p
    }
    for (const e of pendientes) {
      e.hecho = true
      if (e.tipo === 'mouseWheel') {
        await client.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: p.x, y: p.y, deltaX: 0, deltaY: e.deltaY })
        continue
      }
      this.boton = e.tipo === 'mousePressed'
      await client.send('Input.dispatchMouseEvent', { type: e.tipo, x: p.x, y: p.y, button: 'left', buttons: this.boton ? 1 : 0, clickCount: 1 })
    }
  }
}
