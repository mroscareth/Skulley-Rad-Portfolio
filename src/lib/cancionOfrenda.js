// La canción rota de la ofrenda (Oscar, 2026-11-24): "Dia de los Skulley"
// suena en la plaza del portal de SKULLEYGLYPH en pedazos, y con cada ofrenda
// que se pone (ofrendas.js) se recompone, hasta quedar completa con las seis.
//
// Se toca en vivo desde la canción entera, sin hornear versiones:
// - La canción se parte en compases (120 BPM en 4/4, medido: el primer tiempo
//   fuerte cae en RITMO.inicio y cada compás dura 2 s). Cada compás tiene un
//   lugar fijo en la fila de regreso (ruido por frase de 4 compases más ruido
//   por compás, así regresan en islas y no sueltos); con k ofrendas suenan los
//   primeros `cobertura(k)` y nunca quedan más de HUECO_MAX compases callados
//   seguidos. Lo que ya sonó nunca se vuelve a callar al subir de nivel.
// - Antes de cada isla crece el fantasma: la reverb al revés de la historia
//   (la voz de M.A.D.R.E., reverbAlReves.js) hecha sobre la canción entera,
//   así lo que falta se oye como un eco que llega hacia atrás y se corta en
//   seco cuando entra la música.
// - En los huecos, a veces, el compás que debería sonar se asoma al revés,
//   bajito.
// - Las islas acaban en tartamudeo (repite el último octavo), en frenazo de
//   cinta (el tono se cae) o en corte, y por dentro a veces se brincan un
//   dieciseisavo o tocan un tiempo al revés.
// - Mientras más rota, más apagada (pasabajos), más chueca (wow de cinta en el
//   detune) y más cola de reverb. Con las seis: la canción limpia.
//
// La música del reproductor y esta se cruzan por distancia (zonaOfrenda.js,
// cruce de igual potencia entre `empieza` y `llena`); desde `presencia` se
// asoma de lejos, bajita y apagada. Todo sale por la ganancia de la música del
// reproductor (`destino`), así la bocina, el TTS, la historia y la despedida
// la callan igual que a la música.
//
// En desarrollo: window.__cancionOfrenda (estado, islas) con
// window.__ofrendas.nivel(n) y window.__zonaOfrenda(d).

import { impulsoReverb } from './reverbAlReves.js'
import { TOTAL_OFRENDAS } from './ofrendas.js'
import { ZONA_OFRENDA, distanciaOfrenda } from './zonaOfrenda.js'

export const RITMO = { pulso: 0.5, compas: 2, inicio: 0.164 }
const HUECO_MAX = 5
const ADELANTO_S = 3
const TICK_MS = 40
// El fantasma: reverb al revés más larga que la de la voz (la canción no es una
// frase) con el mismo resonador de M.A.D.R.E. en 170 Hz, más suave.
const FANTASMA = {
  sr: 24000, entra: 1.5, fuerza: 0.85,
  ir: { largo: 1.8, caida: 3, nota: 170, realimenta: 0.9, brilloPeine: 1400, brilloSala: 2800, peine: 0.35, sala: 0.85 },
}
// La cola de los pedazos: sala de verdad, en vivo.
const COLA = { largo: 2.6, caida: 2.6, nota: 170, realimenta: 0.88, brilloPeine: 1400, brilloSala: 3200, peine: 0.12, sala: 1 }
const ECO_VOLUMEN = 0.24
const PRESENCIA = 0.14
const LEJOS_HZ = 420

// Lo roto según la parte de la ofrenda que ya está (f de 0 a 1).
export function nivelCancion(k) {
  const f = Math.max(0, Math.min(1, k / TOTAL_OFRENDAS))
  const queda = 1 - f
  const completa = f >= 1
  return {
    cobertura: completa ? 1 : 0.2 + 0.8 * Math.pow(f, 0.9),
    corte: completa ? 22050 : 1500 * Math.pow(14000 / 1500, Math.pow(f, 1.2)),
    wow: 38 * Math.pow(queda, 1.4),
    envio: 0.45 * queda,
    tartamudeo: 0.7 * queda,
    frenazo: 0.5 * queda,
    eco: 0.45 * queda,
    hueco: 0.4 * Math.pow(queda, 1.5),
    reves: 0.3 * Math.pow(queda, 1.5),
  }
}

function azarCon(...n) {
  let s = 0x9e3779b9
  for (const v of n) s = Math.imul(s ^ (v | 0), 0x85ebca6b) + 0x632be59b
  return () => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const suave = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t) }

// Qué compases suenan con cada nivel, y sus islas. Determinista: la canción
// siempre se rompe igual.
export function armarRoturas(duracion) {
  const n = Math.max(1, Math.floor((duracion - RITMO.inicio) / RITMO.compas))
  const ini = (b) => (b === 0 ? 0 : RITMO.inicio + b * RITMO.compas)
  const fin = (b) => (b === n - 1 ? duracion : RITMO.inicio + (b + 1) * RITMO.compas)
  const az = azarCon(24, 11, 2026)
  const frase = Array.from({ length: Math.ceil(n / 4) }, () => az())
  const u = Array.from({ length: n }, (_, b) => 0.4 * frase[b >> 2] + 0.6 * az())
  const orden = u.map((v, b) => [v, b]).sort((a, c) => a[0] - c[0])
  const fila = new Float32Array(n)
  orden.forEach(([, b], i) => { fila[b] = i / n })
  const niveles = []
  let antes = new Uint8Array(n)
  for (let k = 0; k <= TOTAL_OFRENDAS; k++) {
    const cob = nivelCancion(k).cobertura
    const suena = new Uint8Array(n)
    for (let b = 0; b < n; b++) suena[b] = antes[b] || fila[b] < cob ? 1 : 0
    // Ningún hueco más largo que HUECO_MAX (dando la vuelta a la canción):
    // se prende el compás que va primero en la fila.
    for (let vuelta = 0; vuelta < n; vuelta++) {
      let peor = null
      for (let b = 0; b < n; b++) {
        if (suena[b] || suena[(b - 1 + n) % n] === 0) continue
        let largo = 0
        while (largo < n && !suena[(b + largo) % n]) largo++
        if (largo > HUECO_MAX && (!peor || largo > peor.largo)) peor = { b, largo }
      }
      if (!peor) {
        if (!suena.some(Boolean)) suena[orden[0][1]] = 1
        else break
        continue
      }
      let mejor = -1
      for (let i = 1; i < peor.largo - 1; i++) {
        const b = (peor.b + i) % n
        if (mejor < 0 || fila[b] < fila[mejor]) mejor = b
      }
      suena[mejor < 0 ? peor.b : mejor] = 1
    }
    const islas = []
    const islaDe = new Int16Array(n).fill(-1)
    for (let b = 0; b < n; b++) {
      if (!suena[b]) continue
      if (b > 0 && suena[b - 1]) { islas[islas.length - 1].b1 = b } else islas.push({ b0: b, b1: b })
      islaDe[b] = islas.length - 1
    }
    niveles.push({ suena, islas, islaDe })
    antes = suena
  }
  return { n, ini, fin, niveles }
}

function soltar(param, t, s) {
  try {
    if (param.cancelAndHoldAtTime) param.cancelAndHoldAtTime(t)
    else { param.cancelScheduledValues(t); param.setValueAtTime(param.value, t) }
    param.linearRampToValueAtTime(0, t + s)
  } catch { /* nodo ya parado */ }
}

export class CancionOfrenda {
  constructor(ctx, destino, principal) {
    this.ctx = ctx
    this.principal = principal
    this.url = null
    this.nivel = 0
    this.anular = false
    this.alCambiarZona = null
    this.enZona = false
    this.listo = false
    this.cargando = false
    this.corriendo = false
    this.velocidad = 1
    this.tBase = 0
    this.ctxBase = 0
    this.sonando = false
    this.sigG = 0
    this.cubiertos = new Set()
    this.fuentes = new Set()
    this.trozos = new Map()
    this.ultimo = { of: -1, pr: -1, hz: -1, envio: -1, wow: -1 }

    const salida = ctx.createGain()
    salida.gain.value = 0
    salida.connect(destino)
    const filtro = ctx.createBiquadFilter()
    filtro.type = 'lowpass'
    filtro.frequency.value = LEJOS_HZ
    filtro.Q.value = 0.5
    filtro.connect(salida)
    const bus = ctx.createGain()
    bus.connect(filtro)
    const envio = ctx.createGain()
    envio.gain.value = 0
    const sala = ctx.createConvolver()
    sala.normalize = false
    // La sala viene con energía 1, pero concentrada abajo de brilloSala, que es
    // donde vive la música: ahí sonaba ~7 dB más fuerte que lo seco (medido,
    // los pedazos del nivel 0 salían 2 a 7 dB arriba de la canción). Se baja lo
    // que el pasabajos de un polo le quita al ruido blanco.
    const ir = impulsoReverb(ctx.sampleRate, COLA)
    const a = Math.exp((-2 * Math.PI * COLA.brilloSala) / ctx.sampleRate)
    const kSala = Math.sqrt((1 - a) / (1 + a))
    const impulso = ctx.createBuffer(2, ir[0].length, ctx.sampleRate)
    for (let c = 0; c < 2; c++) {
      for (let i = 0; i < ir[c].length; i++) ir[c][i] *= kSala
      impulso.copyToChannel(ir[c], c)
    }
    sala.buffer = impulso
    bus.connect(envio)
    envio.connect(sala)
    sala.connect(filtro)
    // El wow de la cinta: dos senos lentos al detune de cada pedazo. Los
    // osciladores corren siempre (cuestan nada) para que el wow siga igual de
    // una isla a otra.
    const wow = ctx.createGain()
    wow.gain.value = 0
    const lfo1 = ctx.createOscillator()
    lfo1.frequency.value = 0.55
    const lfo2 = ctx.createOscillator()
    lfo2.frequency.value = 2.7
    const lfo2g = ctx.createGain()
    lfo2g.gain.value = 0.3
    lfo1.connect(wow)
    lfo2.connect(lfo2g)
    lfo2g.connect(wow)
    lfo1.start()
    lfo2.start()
    Object.assign(this, { salida, filtro, bus, envio, sala, wow, lfos: [lfo1, lfo2] })

    this.intervalo = setInterval(() => this.tick(), TICK_MS)
  }

  destruir() {
    clearInterval(this.intervalo)
    this.callar(0.05)
    try { this.lfos.forEach((o) => o.stop()) } catch { /* ya parados */ }
    try { this.salida.disconnect() } catch { /* ya suelto */ }
  }

  ponerPista(url) {
    if (url === this.url) return
    this.url = url
    this.listo = false
    this.buf = null
    this.fantasma = null
  }

  async cargar() {
    if (!this.url || this.cargando || this.listo) return
    this.cargando = true
    const url = this.url
    try {
      const bytes = await fetch(url, { cache: 'force-cache' }).then((r) => {
        if (!r.ok) throw new Error('ofrenda: no llegó la canción')
        return r.arrayBuffer()
      })
      const buf = await this.ctx.decodeAudioData(bytes)
      if (url !== this.url) return
      const fantasma = await this.armarFantasma(buf)
      if (url !== this.url) return
      this.buf = buf
      this.fantasma = fantasma
      this.D = buf.duration
      this.roturas = armarRoturas(buf.duration)
      this.listo = true
    } catch (e) {
      console.warn('[cancionOfrenda]', e)
      this.fallo = true
    } finally {
      this.cargando = false
    }
  }

  // reverse(conv(reverse(x), h)) = conv(x, h al revés) adelantada lo que mide h:
  // sin voltear la canción (55 MB) ni el resultado. A 24 kHz: es un lavado de
  // reverb, no necesita más.
  async armarFantasma(buf) {
    const Off = window.OfflineAudioContext || window.webkitOfflineAudioContext
    if (!Off) return null
    const sr = FANTASMA.sr
    const ir = impulsoReverb(sr, FANTASMA.ir)
    const m = ir[0].length
    const off = new Off(2, Math.ceil(buf.duration * sr) + m, sr)
    const impulso = off.createBuffer(2, m, sr)
    for (let c = 0; c < 2; c++) {
      const v = new Float32Array(m)
      for (let i = 0; i < m; i++) v[i] = ir[c][m - 1 - i]
      impulso.copyToChannel(v, c)
    }
    const conv = off.createConvolver()
    conv.normalize = false
    conv.buffer = impulso
    const fuente = off.createBufferSource()
    fuente.buffer = buf
    fuente.connect(conv)
    conv.connect(off.destination)
    fuente.start()
    const y = await off.startRendering()
    // Igual de fuerte que la canción (rms de una muestra de cada uno).
    const rms = (d, paso) => { let e = 0, k = 0; for (let i = 0; i < d.length; i += paso) { e += d[i] * d[i]; k++ } return Math.sqrt(e / (k || 1)) }
    const g = FANTASMA.fuerza * rms(buf.getChannelData(0), 97) / (rms(y.getChannelData(0), 47) || 1)
    for (let c = 0; c < 2; c++) {
      const d = y.getChannelData(c)
      for (let i = 0; i < d.length; i++) d[i] *= g
    }
    y.adelanto = (m - 1) / sr
    return y
  }

  // ── Reloj de la canción (en segundos de canción, sin dar la vuelta) ──
  T(ahora = this.ctx.currentTime) {
    return this.corriendo ? this.tBase + (ahora - this.ctxBase) * this.velocidad : this.tBase
  }
  ctxDe(T) { return this.ctxBase + (T - this.tBase) / this.velocidad }
  tiempo() { return this.D ? ((this.T() % this.D) + this.D) % this.D : 0 }

  ponerCorriendo(si) {
    si = Boolean(si)
    if (si === this.corriendo) return
    const ahora = this.ctx.currentTime
    this.tBase = this.T(ahora)
    this.ctxBase = ahora
    this.corriendo = si
    if (!si) this.callar(0.25)
  }

  ponerVelocidad(v) {
    if (v === this.velocidad) return
    const ahora = this.ctx.currentTime
    this.tBase = this.T(ahora)
    this.ctxBase = ahora
    this.velocidad = v
    if (this.sonando) { this.callar(0.12); this.sonando = false }
  }

  ponerNivel(k) {
    if (k === this.nivel) return
    const sube = k > this.nivel
    this.nivel = k
    // Se recompone en el acto: lo programado se va y vuelve a entrar con el
    // nivel nuevo, tras un fantasma que crece (al subir).
    if (this.sonando) { this.callar(0.35); this.sonando = false; this.alzar = sube }
  }

  callar(s = 0.2) {
    const ahora = this.ctx.currentTime
    for (const f of this.fuentes) {
      soltar(f.g.gain, ahora, s)
      try { f.src.stop(ahora + s + 0.02) } catch { /* no había empezado */ }
    }
    this.fuentes.clear()
    this.cubiertos.clear()
    this.sonando = false
  }

  // ── Mezcla con la música del reproductor ──
  mezclar() {
    const d = this.anular ? Infinity : distanciaOfrenda()
    const Z = ZONA_OFRENDA
    const m = 1 - suave(Z.llena, Z.empieza, d)
    const pres = 1 - suave(Z.empieza, Z.presencia, d)
    const cerca = 1 - suave(Z.llena, Z.presencia, d)
    const listo = this.listo && this.fantasma
    const niv = nivelCancion(this.nivel)
    const of = listo && this.corriendo ? Math.max(Math.sin((m * Math.PI) / 2), PRESENCIA * pres) : 0
    const pr = listo ? Math.cos((m * Math.PI) / 2) : 1
    const hz = Math.min(niv.corte, LEJOS_HZ * Math.pow(niv.corte / LEJOS_HZ, cerca))
    const t = this.ctx.currentTime
    const U = this.ultimo
    const poner = (param, v, llave, tau = 0.12) => {
      if (Math.abs(v - U[llave]) < (llave === 'hz' ? 5 : 0.002)) return
      U[llave] = v
      try { param.setTargetAtTime(v, t, tau) } catch { /* contexto cerrado */ }
    }
    poner(this.salida.gain, of, 'of')
    if (this.principal) poner(this.principal.gain, pr, 'pr')
    poner(this.filtro.frequency, hz, 'hz')
    poner(this.envio.gain, niv.envio, 'envio', 0.4)
    poner(this.wow.gain, niv.wow, 'wow', 0.4)
    const zona = listo && (this.enZona ? m > 0.45 : m > 0.55)
    if (zona !== this.enZona) {
      this.enZona = zona
      try { this.alCambiarZona?.(zona) } catch { /* el reproductor se desmontó */ }
    }
    return { d, of }
  }

  tick() {
    const { d, of } = this.mezclar()
    if (!this.listo) {
      if (this.url && !this.fallo && d < ZONA_OFRENDA.carga) this.cargar()
      return
    }
    const audible = this.corriendo && of > 0.0005 && d < ZONA_OFRENDA.presencia + 4
    if (!audible) {
      if (this.sonando) this.callar(0.3)
      return
    }
    const ahora = this.ctx.currentTime
    if (!this.sonando) this.arrancar(ahora)
    for (let guarda = 0; guarda < 64; guarda++) {
      const g = this.sigG
      if (this.ctxDe(this.tCompas(g)) > ahora + ADELANTO_S) break
      this.programarCompas(g)
      this.sigG = g + 1
    }
  }

  tCompas(g) {
    const { n, ini } = this.roturas
    const v = Math.floor(g / n)
    return v * this.D + ini(g - v * n)
  }
  compasDe(T) {
    const { n, ini } = this.roturas
    const v = Math.floor(T / this.D)
    const pos = T - v * this.D
    let b = n - 1
    while (b > 0 && ini(b) > pos) b--
    return v * n + b
  }

  arrancar(ahora) {
    this.sonando = true
    this.cubiertos.clear()
    const alzar = this.alzar
    this.alzar = false
    // Entra un poco adelante para que nada empiece en el pasado.
    const T0 = this.T(ahora + (alzar ? 0.8 : 0.06))
    const g = this.compasDe(T0)
    const { n, niveles } = this.roturas
    const niv = niveles[this.nivel] || niveles[0]
    const b = ((g % n) + n) % n
    if (niv.suena[b]) {
      if (alzar) this.programarFantasma(T0, 0.8, 1.05)
      this.programarIsla(g, T0, true)
    } else {
      this.programarCompas(g)
    }
    this.sigG = g + 1
  }

  programarCompas(g) {
    if (this.cubiertos.has(g)) return
    const { n, niveles } = this.roturas
    const niv = niveles[this.nivel] || niveles[0]
    const b = ((g % n) + n) % n
    if (niv.suena[b]) {
      this.programarIsla(g, this.tCompas(g), false)
      return
    }
    const p = nivelCancion(this.nivel)
    const az = azarCon(g, this.nivel, 7)
    if (az() < p.eco) this.programarEco(g, az)
    if (niv.suena[(b + 1) % n]) {
      const Tisla = this.tCompas(g + 1)
      this.programarFantasma(Tisla, Math.min(FANTASMA.entra, Tisla - this.tCompas(g)), FANTASMA.fuerza)
    }
  }

  // La isla que contiene al compás g, desde T0 (a medio compás si `aMedias`).
  programarIsla(g, T0, aMedias) {
    const { n, niveles, fin } = this.roturas
    const niv = niveles[this.nivel] || niveles[0]
    const b = ((g % n) + n) % n
    const isla = niv.islas[niv.islaDe[b]]
    if (!isla) return
    const v = Math.floor(g / n)
    for (let x = b; x <= isla.b1; x++) this.cubiertos.add(v * n + x)
    const T1 = v * this.D + fin(isla.b1)
    const r = this.velocidad
    const ahora = this.ctx.currentTime
    const c0 = Math.max(this.ctxDe(T0), ahora + 0.01)
    const pos0 = T0 - v * this.D + (c0 - this.ctxDe(T0)) * r
    const c1 = this.ctxDe(T1)
    if (c1 <= c0 + 0.02) return
    const p = nivelCancion(this.nivel)
    const az = azarCon(g, this.nivel, Math.floor(T0 * 8))
    // Entrando a media isla sube en 0.12 s desde c0; si no, en 4 ms que
    // acaban justo en el tiempo fuerte.
    const entra = aMedias ? 0.12 : 0.004
    const cIni = aMedias ? c0 : c0 - entra
    const posIni = Math.max(0, aMedias ? pos0 : pos0 - entra * r)

    const src = this.ctx.createBufferSource()
    src.buffer = this.buf
    src.playbackRate.value = r
    this.ponerWow(src)
    const ga = this.ctx.createGain()
    src.connect(ga)
    ga.connect(this.bus)
    ga.gain.setValueAtTime(0, cIni)
    ga.gain.linearRampToValueAtTime(1, cIni + entra)

    // Por dentro: un dieciseisavo que se brinca o un tiempo al revés.
    const mudos = []
    const islaFin = isla.b1
    for (let x = Math.max(b, isla.b0 + 1); x < islaFin; x++) {
      const Tb = v * this.D + this.roturas.ini(x)
      if (az() < p.hueco) {
        const q = Math.floor(az() * 16)
        const a = Tb + q * (RITMO.pulso / 4)
        mudos.push({ a, z: a + RITMO.pulso / 4 })
      } else if (az() < p.reves) {
        const j = 1 + Math.floor(az() * 3)
        const a = Tb + j * RITMO.pulso
        mudos.push({ a, z: a + RITMO.pulso, reves: true })
      }
    }
    for (const mu of mudos) {
      const ca = this.ctxDe(mu.a)
      const cz = this.ctxDe(mu.z)
      if (ca < cIni + entra + 0.02 || cz > c1 - 0.6) continue
      ga.gain.setValueAtTime(1, ca - 0.003)
      ga.gain.linearRampToValueAtTime(0, ca)
      ga.gain.setValueAtTime(0, cz)
      ga.gain.linearRampToValueAtTime(1, cz + 0.003)
      if (mu.reves) this.programarTrozoAlReves(mu.a - v * this.D, mu.z - mu.a, ca, 1, false)
    }

    // El final de la isla.
    const fallo = az()
    const ultimo = isla.b1 === n - 1
    if (!ultimo && fallo < p.tartamudeo) {
      const s = az() < 0.5 ? RITMO.pulso / 2 : RITMO.pulso / 4
      const veces = 3 + Math.floor(az() * 3)
      const corte = c1 - s / r
      ga.gain.setValueAtTime(1, corte - 0.004)
      ga.gain.linearRampToValueAtTime(0, corte)
      src.start(cIni, posIni)
      src.stop(corte + 0.01)
      this.registrar(src, ga)
      this.programarTartamudeo(fin(isla.b1) - s, s, veces, corte)
    } else if (!ultimo && fallo < p.tartamudeo + p.frenazo) {
      src.playbackRate.setValueAtTime(r, c1 - 0.3)
      src.playbackRate.exponentialRampToValueAtTime(0.15 * r, c1 + 0.25)
      ga.gain.setValueAtTime(1, c1 - 0.05)
      ga.gain.linearRampToValueAtTime(0, c1 + 0.25)
      src.start(cIni, posIni)
      src.stop(c1 + 0.3)
      this.registrar(src, ga)
    } else {
      ga.gain.setValueAtTime(1, c1 - 0.004)
      ga.gain.linearRampToValueAtTime(0, c1 + 0.004)
      src.start(cIni, posIni)
      src.stop(c1 + 0.02)
      this.registrar(src, ga)
    }
  }

  programarTartamudeo(pos, s, veces, c) {
    const r = this.velocidad
    const src = this.ctx.createBufferSource()
    src.buffer = this.buf
    src.loop = true
    src.loopStart = pos
    src.loopEnd = pos + s
    src.playbackRate.value = r
    this.ponerWow(src)
    const ga = this.ctx.createGain()
    src.connect(ga)
    ga.connect(this.bus)
    const paso = s / r
    for (let i = 0; i < veces; i++) ga.gain.setValueAtTime(Math.pow(0.78, i), c + i * paso)
    ga.gain.setValueAtTime(Math.pow(0.78, veces - 1), c + veces * paso - 0.004)
    ga.gain.linearRampToValueAtTime(0, c + veces * paso)
    src.start(c, pos)
    src.stop(c + veces * paso + 0.01)
    this.registrar(src, ga)
  }

  // El fantasma que crece hasta Tisla (`entra` segundos de canción).
  programarFantasma(Tisla, entra, fuerza) {
    if (!this.fantasma || entra < 0.2) return
    const r = this.velocidad
    const ahora = this.ctx.currentTime
    const cS = this.ctxDe(Tisla - entra)
    const cE = this.ctxDe(Tisla)
    if (cE < ahora + 0.1) return
    const desde = Math.max(cS, ahora + 0.01)
    if (cE - 0.015 - desde < 0.03) return
    // Desde la posición de la isla hacia atrás: antes del inicio de la canción
    // el fantasma también existe (es la reverb al revés de su primer compás).
    const posIsla = ((Tisla % this.D) + this.D) % this.D
    const pos = Math.max(0, posIsla - entra + this.fantasma.adelanto + (desde - cS) * r)
    const src = this.ctx.createBufferSource()
    src.buffer = this.fantasma
    src.playbackRate.value = r
    const ga = this.ctx.createGain()
    src.connect(ga)
    ga.connect(this.bus)
    // Exponencial, como el Supernatural: casi nada al principio y todo al final.
    const piso = 0.0008
    const llega = cE - 0.015
    const enDesde = piso * Math.pow(fuerza / piso, Math.max(0, (desde - cS) / Math.max(0.01, llega - cS)))
    ga.gain.setValueAtTime(Math.max(piso, enDesde), desde)
    ga.gain.exponentialRampToValueAtTime(fuerza, llega)
    ga.gain.linearRampToValueAtTime(0, cE + 0.03)
    src.start(desde, Math.min(pos, this.fantasma.duration - 0.01))
    src.stop(cE + 0.05)
    this.registrar(src, ga)
  }

  // En un hueco: el compás que debería sonar se asoma al revés, bajito.
  programarEco(g, az) {
    const T = this.tCompas(g)
    const pulsos = az() < 0.6 ? 1 : 2
    const j = Math.floor(az() * (5 - pulsos))
    const a = T + j * RITMO.pulso
    const pos = (((a % this.D) + this.D) % this.D)
    const c = this.ctxDe(a)
    if (c < this.ctx.currentTime + 0.02) return
    this.programarTrozoAlReves(pos, pulsos * RITMO.pulso, c, ECO_VOLUMEN, true)
  }

  programarTrozoAlReves(pos, dur, c, volumen, suaveEntrada) {
    const buf = this.trozoAlReves(pos, dur)
    if (!buf) return
    const r = this.velocidad
    const src = this.ctx.createBufferSource()
    src.buffer = buf
    src.playbackRate.value = r
    this.ponerWow(src)
    const ga = this.ctx.createGain()
    src.connect(ga)
    ga.connect(this.bus)
    const largo = dur / r
    ga.gain.setValueAtTime(0, c)
    ga.gain.linearRampToValueAtTime(volumen, c + (suaveEntrada ? largo * 0.6 : 0.004))
    ga.gain.setValueAtTime(volumen, c + largo - 0.006)
    ga.gain.linearRampToValueAtTime(0, c + largo)
    src.start(c)
    src.stop(c + largo + 0.01)
    this.registrar(src, ga)
  }

  trozoAlReves(pos, dur) {
    const llave = `${Math.round(pos * 1000)}:${Math.round(dur * 1000)}`
    const hay = this.trozos.get(llave)
    if (hay) return hay
    const sr = this.buf.sampleRate
    const a = Math.max(0, Math.floor(pos * sr))
    const largo = Math.min(Math.floor(dur * sr), this.buf.length - a)
    if (largo < 64) return null
    const sale = this.ctx.createBuffer(this.buf.numberOfChannels, largo, sr)
    const borde = Math.min(Math.floor(0.004 * sr), largo >> 2)
    for (let ch = 0; ch < this.buf.numberOfChannels; ch++) {
      const d = this.buf.getChannelData(ch)
      const o = sale.getChannelData(ch)
      for (let i = 0; i < largo; i++) o[i] = d[a + largo - 1 - i]
      for (let i = 0; i < borde; i++) { const k = i / borde; o[i] *= k; o[largo - 1 - i] *= k }
    }
    if (this.trozos.size > 32) this.trozos.delete(this.trozos.keys().next().value)
    this.trozos.set(llave, sale)
    return sale
  }

  ponerWow(src) {
    try {
      this.wow.connect(src.detune)
      src.addEventListener('ended', () => { try { this.wow.disconnect(src.detune) } catch { /* ya suelto */ } }, { once: true })
    } catch { /* sin detune: se queda derecho */ }
  }

  registrar(src, g) {
    const f = { src, g }
    this.fuentes.add(f)
    src.addEventListener('ended', () => {
      this.fuentes.delete(f)
      try { g.disconnect() } catch { /* ya suelto */ }
    }, { once: true })
  }

  estado() {
    return {
      listo: this.listo, cargando: this.cargando, nivel: this.nivel, corriendo: this.corriendo,
      sonando: this.sonando, enZona: this.enZona, velocidad: this.velocidad,
      tiempo: Math.round(this.tiempo() * 100) / 100, duracion: this.D,
      distancia: distanciaOfrenda(), fuentes: this.fuentes.size,
      salida: this.salida.gain.value, principal: this.principal?.gain.value, filtro: Math.round(this.filtro.frequency.value),
    }
  }
}
