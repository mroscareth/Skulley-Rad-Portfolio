// Un jugador automático para el juego de esferas: escoge una esfera, camina con
// WASD hasta quedar detrás de ella, apunta con el mouse hacia el portal de su
// color, carga la patada lo justo y la suelta. Lee la escena real (esferas,
// cámara, Skulley) desde el store de R3F que cuelga de cualquier objeto.
import { tecla } from './rig.mjs'

// Se instala en la página una vez que el mundo está listo.
export async function instalar(ctx) {
  return ctx.page.evaluate(async () => {
    const V = (window.__vid = window.__vid || {})
    const busca = () => {
      for (const { escena } of (window.__lentes || [])) {
        let o = escena
        while (o && !o.__r3f) o = o.parent
        const s = o?.__r3f?.root?.getState?.()
        if (!s) continue
        let g = null
        s.scene.traverse((x) => { if (!g && x.userData && x.userData.orbs) g = x })
        if (g) { V.st = s; V.grupo = g; return true }
      }
      return false
    }
    if (!busca()) return 'sin escena'
    V.P = await import('/src/lib/orbPhysics.js')
    V.K = await import('/src/components/fx/KickAimIndicator.jsx')
    const { sectionColors } = await import('/src/lib/appHelpers.js')
    V.portales = [0, 1, 2, 3, 4].map((i) => {
      const a = (i * 2 * Math.PI) / 5
      return { id: 'section' + (i + 1), x: Math.round(16 * Math.sin(a) * 100) / 100, z: Math.round(-16 * Math.cos(a) * 100) / 100, color: String(sectionColors['section' + (i + 1)]).toLowerCase() }
    })
    V.orbs = () => V.grupo.userData.orbs || []
    V.estado = () => {
      const cam = V.st.camera
      const f = cam.position.clone()
      cam.getWorldDirection(f)
      f.y = 0
      f.normalize()
      const p = window.__laserDbg?.()?.player || [0, 0, 0]
      const k = window.__kickDbg?.() || {}
      return {
        p: [p[0], p[2]],
        f: [f.x, f.z],
        argus: window.__argusCollider || null,
        charge: k.charge || 0,
        charging: !!k.charging,
        kt: k.t,
        orbs: V.orbs().map((s, i) => ({
          i, x: s.pos.x, y: s.pos.y, z: s.pos.z, vx: s.vel.x, vy: s.vel.y, vz: s.vel.z, r: s.radius,
          color: String(s.color || '').toLowerCase(),
          malo: !!(s._isCursed || s._dorada || s._isDragging || s._thunderHidden || s._inactiva || (s.spawnCooldown > 0)),
          cursed: !!s._isCursed, dorada: !!s._dorada, fuera: !!(s._thunderHidden || s._inactiva),
        })),
        portales: V.portales,
      }
    }
    V.pantalla = (x, y, z) => {
      const v = V.st.camera.position.clone().set(x, y, z).project(V.st.camera)
      const r = V.st.gl.domElement.getBoundingClientRect()
      return [r.left + ((v.x + 1) / 2) * r.width, r.top + ((1 - v.y) / 2) * r.height]
    }
    // Con Skulley donde está: hacia dónde apuntar (floor point) y con cuánta
    // carga para que la esfera `i` se detenga en (tx, tz).
    V.plan = (i, tx, tz) => {
      const s = V.orbs()[i]
      const p = window.__laserDbg().player
      const base = { x: p[0], y: p[1], z: p[2] }
      const ux = tx - s.pos.x, uz = tz - s.pos.z
      const D = Math.hypot(ux, uz)
      const want = Math.atan2(ux, uz)
      const ang0 = Math.atan2(s.pos.x - base.x, s.pos.z - base.z)
      let mejor = null
      for (let da = -0.6; da <= 0.6; da += 0.005) {
        const a = ang0 + da
        const dir = { x: Math.sin(a), y: 0, z: Math.cos(a) }
        const center = { x: base.x + dir.x * 0.6, y: s.pos.y, z: base.z + dir.z * 0.6 }
        const k = V.P.kickContact(s, center, dir, 20, V.K.kickReachFor(0.6), base, V.K.KICK_HALF_ANGLE)
        if (!k) continue
        let e = Math.atan2(k.vx, k.vz) - want
        while (e > Math.PI) e -= 2 * Math.PI
        while (e < -Math.PI) e += 2 * Math.PI
        if (!mejor || Math.abs(e) < Math.abs(mejor.e)) mejor = { a, e, dir }
      }
      if (!mejor) return null
      const { dir } = mejor
      let best = null
      for (let c = 0.02; c <= 1.0001; c += 0.01) {
        const S = 5 + 33 * Math.pow(c, 1.3)
        const center = { x: base.x + dir.x * 0.6, y: s.pos.y, z: base.z + dir.z * 0.6 }
        const k = V.P.kickContact(s, center, dir, S, V.K.kickReachFor(c), base, V.K.KICK_HALF_ANGLE)
        if (!k) continue
        const r = V.P.simulateOrbPath(s.pos, { x: k.vx, y: k.vy, z: k.vz }, s.radius, V.orbs(), s, 10, false, null)
        const along = V.lejos(r, s.pos, ux / D, uz / D)
        const err = Math.abs(along - D)
        if (!best || err < best.err) best = { c, err, along, v: [k.vx, k.vz] }
      }
      return { aim: [base.x + dir.x * 7, base.z + dir.z * 7], angErr: mejor.e, ...best, D, base: [base.x, base.z] }
    }
    // Lo más lejos que llega sobre la línea: si rebota en el domo y regresa,
    // cuenta lo que se pasó, no donde quedó.
    V.lejos = (r, o, ux, uz) => {
      let m = -1e9
      const pt = r.points
      for (let n = 0; n < pt.length; n += 3) m = Math.max(m, (pt[n] - o.x) * ux + (pt[n + 2] - o.z) * uz)
      return m
    }
    // Ya pateada: la misma velocidad horizontal, girada hacia el centro del
    // portal y escalada para que se detenga ahí.
    V.corrige = (i, tx, tz) => {
      const s = V.orbs()[i]
      const h = Math.hypot(s.vel.x, s.vel.z)
      if (h < 0.5) return null
      const dx = tx - s.pos.x, dz = tz - s.pos.z
      const D = Math.hypot(dx, dz)
      const ux = dx / D, uz = dz / D
      const sim = (k) => V.lejos(V.P.simulateOrbPath(s.pos, { x: ux * h * k, y: s.vel.y, z: uz * h * k }, s.radius, V.orbs(), s, 12, false, null), s.pos, ux, uz)
      let lo = 0.1, hi = 4
      for (let n = 0; n < 30; n++) {
        const m = (lo + hi) / 2
        const along = sim(m)
        if (along < D) lo = m
        else hi = m
      }
      const k = (lo + hi) / 2
      const giro = Math.acos(Math.max(-1, Math.min(1, (s.vel.x * ux + s.vel.z * uz) / h)))
      // Nunca de más: si la física se fue por otro lado, se queda como salió.
      if (k < 0.8 || k > 1.25 || giro > 0.28) return { k: +k.toFixed(3), giro: +(giro * 57.3).toFixed(1), nada: true }
      s.vel.x = ux * h * k
      s.vel.z = uz * h * k
      return { k: +k.toFixed(3), giro: +(giro * 57.3).toFixed(1) }
    }
    return 'ok'
  })
}

const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1])

export class Jugador {
  constructor(ctx, m, { correr = true, log = true, distArgus = 4.2, maxD = 13, minD = 3.5, soloColor = true, disparos = [] } = {}) {
    this.ctx = ctx
    this.m = m
    this.op = { correr, log, distArgus, maxD, minD, soloColor }
    this.fase = 'elige'
    this.teclas = new Set()
    this.cambio = -1e9
    this.t0fase = 0
    this.obj = null
    this.capturas = 0
    this.pateadas = 0
    this.disparos = disparos.slice()
    this.pausaHasta = 0
  }

  log(...a) { if (this.op.log) console.log('  [jugador]', ...a) }

  async pon(t, quiero) {
    const q = new Set(quiero)
    if ([...q].join() === [...this.teclas].join()) return
    for (const k of [...this.teclas]) if (!q.has(k)) { await tecla(this.ctx, k, 'up'); this.teclas.delete(k) }
    for (const k of q) if (!this.teclas.has(k)) { await tecla(this.ctx, k, 'down'); this.teclas.add(k) }
    this.cambio = t
  }

  ir(t, x, y, dur) {
    const t0 = Math.max(t, this.m.fin + 16)
    return this.m.ir(t0, x, y, dur)
  }

  // Teclas para caminar en la dirección del mundo (dx, dz).
  teclasPara(e, dx, dz, run) {
    const [fx, fz] = e.f
    const rx = -fz, rz = fx
    const n = Math.hypot(dx, dz) || 1
    const xi = (dx * rx + dz * rz) / n
    const zi = (dx * fx + dz * fz) / n
    const k = []
    if (zi > 0.38) k.push('w')
    if (zi < -0.38) k.push('s')
    if (xi > 0.38) k.push('d')
    if (xi < -0.38) k.push('a')
    if (run && k.length) k.push('Shift')
    return k
  }

  elige(e) {
    const p = e.p
    let best = null
    const rech = {}
    const no = (k) => { rech[k] = (rech[k] || 0) + 1 }
    for (const o of e.orbs) {
      if (o.malo) { no('malo'); continue }
      if (Math.hypot(o.vx, o.vz) > 0.25 || o.y > o.r + 0.05) { no('mueve'); continue }
      const po = e.portales.find((pp) => pp.color === o.color)
      if (!po) { no('color'); continue }
      const Dp = Math.hypot(po.x - o.x, po.z - o.z)
      if (Dp < this.op.minD) { no('cerca'); continue }
      // Lejos de su portal: primero un pase que la deje a ~7 de él.
      const pase = Dp > this.op.maxD
      const ux0 = (po.x - o.x) / Dp, uz0 = (po.z - o.z) / Dp
      const meta = pase ? { x: o.x + ux0 * (Dp - 7), z: o.z + uz0 * (Dp - 7) } : { x: po.x, z: po.z }
      const D = Math.hypot(meta.x - o.x, meta.z - o.z)
      if (pase) {
        let mala = false
        for (const pp of e.portales) if (dist([meta.x, meta.z], [pp.x, pp.z]) < 4.2) mala = true
        if (e.argus && dist([meta.x, meta.z], [e.argus.x, e.argus.z]) < 3.5) mala = true
        if (mala || D > this.op.maxD + 2) { no('pase'); continue }
      }
      const ux = (meta.x - o.x) / D, uz = (meta.z - o.z) / D
      const st = [o.x - ux * (o.r + 0.95), o.z - uz * (o.r + 0.95)]
      let pen = 0
      // El punto de parada: lejos de portales, de Argus y dentro del domo.
      for (const pp of e.portales) if (dist(st, [pp.x, pp.z]) < 3.4) pen += 100
      if (e.argus && dist(st, [e.argus.x, e.argus.z]) < this.op.distArgus) pen += 100
      if (Math.hypot(st[0], st[1]) > 22) pen += 100
      // El camino de la esfera, limpio de otras esferas (y de la corrupta).
      for (const q of e.orbs) {
        if (q.i === o.i || q.fuera) continue
        const ax = q.x - o.x, az = q.z - o.z
        const al = ax * ux + az * uz
        const sd = Math.abs(ax * uz - az * ux)
        if (al > -0.2 && al < D + 0.5 && sd < q.r + o.r + 0.35) pen += q.cursed ? 100 : 30
        // Nada más en el abanico de la patada.
        if (dist([q.x, q.z], st) < 3.0 && al < 0.6) pen += q.cursed ? 100 : 25
      }
      if (e.argus) {
        const ax = e.argus.x - o.x, az = e.argus.z - o.z
        const al = ax * ux + az * uz
        if (al > 0 && al < D && Math.abs(ax * uz - az * ux) < e.argus.r + 1) pen += 100
      }
      const score = dist(p, st) + pen + D * 0.15 + (pase ? 7 : 0)
      if (pen >= 90) no('pen' + pen)
      if (!best || score < best.score) best = { score, o, po, st, D, meta, pase }
    }
    this.rech = rech
    return best && best.score < 90 ? best : null
  }

  // Dirección para caminar a `meta` esquivando portales, Argus y la esfera.
  rumbo(e, meta, orbe) {
    const p = e.p
    let dx = meta[0] - p[0], dz = meta[1] - p[1]
    const d = Math.hypot(dx, dz) || 1
    dx /= d; dz /= d
    const empuja = (cx, cz, r, peso) => {
      const ax = p[0] - cx, az = p[1] - cz
      const a = Math.hypot(ax, az)
      if (a > r || a < 1e-3) return
      const w = peso * (1 - a / r)
      dx += (ax / a) * w; dz += (az / a) * w
    }
    for (const pp of e.portales) empuja(pp.x, pp.z, 4.2, 2.2)
    if (e.argus) empuja(e.argus.x, e.argus.z, this.op.distArgus + 1.2, 2.5)
    for (const q of e.orbs) {
      if (q.fuera) continue
      if (orbe && q.i === orbe.i) {
        // Rodear la esfera objetivo si vamos del lado equivocado.
        if (d > 0.6) empuja(q.x, q.z, q.r + 1.1, 2.4)
      } else if (d > 1.0) empuja(q.x, q.z, q.r + 0.9, 1.2)
    }
    return [dx, dz]
  }

  async paso(t) {
    const e = await this.ctx.page.evaluate(() => window.__vid.estado())
    this.ultimo = e
    // Disparos programados (bola de fuego): [t, x, z] apunta a ese punto.
    if (this.disparos.length && this.fase === 'elige' && t >= this.disparos[0][0]) {
      const [, dur = 900] = this.disparos.shift()
      await this.pon(t, [])
      // Apunta a la esfera más cercana que no sea la corrupta.
      const cerca = e.orbs.filter((o) => !o.fuera && !o.cursed).sort((a, b) => dist(e.p, [a.x, a.z]) - dist(e.p, [b.x, b.z]))[0]
      if (cerca) {
        const [sx, sy] = await this.ctx.page.evaluate((x, y, z) => window.__vid.pantalla(x, y, z), cerca.x, 0, cerca.z)
        this.ir(t, sx, sy, 380)
      }
      this.fase = 'fuego'
      this.t0fase = t
      this.fuegoDur = dur
      return
    }
    if (this.fase === 'fuego') {
      if (t - this.t0fase > 420 && !this.teclas.has('e')) await this.pon(t, ['e'])
      if (t - this.t0fase > 420 + this.fuegoDur) { await this.pon(t, []); this.fase = 'espera'; this.t0fase = t; this.esperaMs = 900 }
      return
    }
    if (this.fase === 'espera') {
      if (t - this.t0fase > this.esperaMs) this.fase = 'elige'
      return
    }
    if (this.fase === 'elige') {
      const b = this.elige(e)
      if (!b) {
        await this.pon(t, [])
        if (!this.ultRech || t - this.ultRech > 2000) { this.ultRech = t; this.log('nada:', JSON.stringify(this.rech)) }
        return
      }
      this.obj = b
      this.fase = 'camina'
      this.t0fase = t
      this.log(b.pase ? 'pase' : 'tiro', b.o.i, b.o.color, '→', b.po.id, 'D', b.D.toFixed(1))
      return
    }
    const o = e.orbs[this.obj.o.i]
    if (this.fase === 'camina') {
      // La esfera se movió (la empujó otra): volver a escoger.
      if (dist([o.x, o.z], [this.obj.o.x, this.obj.o.z]) > 0.5 || o.malo) { this.fase = 'elige'; return }
      const d = dist(e.p, this.obj.st)
      if (t - this.t0fase > 9000) { this.log('no llegué'); await this.pon(t, []); this.fase = 'elige'; return }
      // Mientras camina, la mano ya va hacia el portal.
      if (!this.mouseListo && d < 6) {
        this.mouseListo = true
        const [sx, sy] = await this.ctx.page.evaluate((x, z) => window.__vid.pantalla(x, 0, z), this.obj.meta.x, this.obj.meta.z)
        this.ir(t, sx, sy, 600)
      }
      if (d < 0.32) {
        await this.pon(t, [])
        this.fase = 'asienta'
        this.t0fase = t
        return
      }
      const [dx, dz] = this.rumbo(e, this.obj.st, o)
      const run = this.op.correr && d > 3.5
      const quiero = this.teclasPara(e, dx, dz, run)
      // Sin parpadeo: cambiar teclas a lo mucho cada 110 ms (salvo para frenar).
      if (t - this.cambio > 110 || d < 1.0) await this.pon(t, quiero)
      return
    }
    if (this.fase === 'asienta') {
      if (t - this.t0fase < 260) return
      const pl = await this.ctx.page.evaluate((i, x, z) => window.__vid.plan(i, x, z), o.i, this.obj.meta.x, this.obj.meta.z)
      if (!pl || pl.err > 2.5 || Math.abs(pl.angErr) > 0.05) {
        this.log('sin plan', JSON.stringify(pl))
        // Se acomoda otra vez.
        this.fase = dist(e.p, this.obj.st) > 0.5 ? 'camina' : 'elige'
        this.t0fase = t
        return
      }
      this.pl = pl
      const [sx, sy] = await this.ctx.page.evaluate((x, z) => window.__vid.pantalla(x, 0, z), pl.aim[0], pl.aim[1])
      const llega = this.ir(t, sx, sy, 380)
      this.fase = 'apunta'
      this.cargaEn = llega + 60
      return
    }
    if (this.fase === 'apunta') {
      if (t >= this.cargaEn) { await this.pon(t, [' ']); this.fase = 'carga'; this.t0fase = t }
      return
    }
    if (this.fase === 'carga') {
      // La cámara todavía se acomoda: la mano sigue el punto del piso.
      if (t >= this.m.fin) {
        const [sx, sy] = await this.ctx.page.evaluate((x, z) => window.__vid.pantalla(x, 0, z), this.pl.aim[0], this.pl.aim[1])
        const q = this.m.posFinal()
        if (Math.hypot(sx - q.x, sy - q.y) > 1.5) { this.ir(t, sx, sy, 70); this.ultAjuste = t }
      }
      const quieta = !this.ultAjuste || t - this.ultAjuste > 220
      const lista = quieta && t - this.t0fase > 700 && e.charge >= this.pl.c - 0.004 && e.charge < this.pl.c + 0.05
      if (lista || t - this.t0fase > 4500) {
        await this.pon(t, [])
        this.fase = 'vuelo'
        this.t0fase = t
        this.corregido = false
        this.ultAjuste = 0
        this.pateadas++
      }
      return
    }
    if (this.fase === 'vuelo') {
      const h = Math.hypot(o.vx, o.vz)
      if (!this.corregido && h > 1.5) {
        this.corregido = true
        const r = await this.ctx.page.evaluate((i, x, z) => window.__vid.corrige(i, x, z), o.i, this.obj.meta.x, this.obj.meta.z)
        const aim = await this.ctx.page.evaluate(() => { const k = window.__kickDbg(); return k.aim ? [k.aim.dx, k.aim.dz] : null })
        const pd = [this.pl.aim[0] - this.pl.base[0], this.pl.aim[1] - this.pl.base[1]]
        const dAng = aim ? (Math.atan2(aim[0], aim[1]) - Math.atan2(pd[0], pd[1])) * 57.3 : null
        this.log('patada', this.pateadas, 'yaw-err', dAng?.toFixed(1), 'plan v', this.pl.v.map((v) => v.toFixed(1)).join(','), 'real', o.vx.toFixed(2), o.vz.toFixed(2), 'tras', Math.round(t - this.t0fase), 'ms corrige', JSON.stringify(r))
      }
      if (t - this.t0fase > 900) {
        this.mouseListo = false
        this.fase = 'espera'
        this.t0fase = t
        this.esperaMs = 500
      }
    }
  }
}
