// Los ventiladores de las GPU de la Renderbox Nano del Estudio (Oscar, 2026-11-24: "cuando nos
// acerquemos a la renderbox, que esté vibrando suavemente y que se escuchen los abanicos de las
// GPU"). Voz continua sintetizada por el bus de SFX (respeta la bocina y el volumen de efectos),
// más fuerte entre más cerca. Oscar la escogió entre varias: el motor acelerado de un camión de la
// basura, más agudo.
//
//   iniciarVentiladores()   ajustarVentiladores(cercania 0–1, paneo −1–1)   pararVentiladores()
//
// Lo continuo va debajo de la música (lib/mezcla.js): a la cercanía 1 se mide contra las canciones
// antes de darlo por bueno. Nada debajo de ~120 Hz (las bocinas de laptop no lo dan).

import { getSfxBus, getNoiseBuffer } from './sfx.js'

// `nivel` a la cercanía 1: medido con ponderación K queda ~3 dB debajo de la música (~−26.5 LUFS
// contra ~−23.6), como lo continuo de la mezcla. `tono` sube motor, formantes y bomba juntos
// (Oscar: el acelerado "no tan grave, un poco más agudo", y de esas, la del medio).
export const VENTILADORES = { nivel: 0.2, tono: 1.46 }

let voz = null

function ruido(ctx) {
  const s = ctx.createBufferSource()
  s.buffer = getNoiseBuffer(ctx)
  s.loop = true
  // cada voz arranca en otro punto del búfer: si no, dos ruidos iguales se cancelan o se suman
  s.loopStart = 0
  return s
}

function filtro(ctx, tipo, f, q = 0.7) {
  const b = ctx.createBiquadFilter()
  b.type = tipo
  b.frequency.value = f
  b.Q.value = q
  return b
}

// Aire: ruido en una banda, con un vaivén lento del caudal.
function aire(ctx, destino, { centro, q, ganancia, vaiven = 0.12, ritmo = 0.23 }) {
  const n = ruido(ctx)
  const bp = filtro(ctx, 'bandpass', centro, q)
  const hp = filtro(ctx, 'highpass', 140)
  const g = ctx.createGain()
  g.gain.value = ganancia
  n.connect(hp).connect(bp).connect(g).connect(destino)
  const lfo = ctx.createOscillator()
  lfo.frequency.value = ritmo
  const lg = ctx.createGain()
  lg.gain.value = ganancia * vaiven
  lfo.connect(lg).connect(g.gain)
  return { fuentes: [n, lfo], nodos: [n, bp, hp, g, lfo, lg] }
}

// Motor: dos dientes de sierra casi iguales (baten como un motor de verdad), saturados, sin el
// fundamental (debajo de lo que dan las bocinas chicas), con dos formantes y el golpe de cada
// explosión: un diente de sierra invertido a `pulso` por segundo en la ganancia.
function motor(ctx, destino, { f, pulso, formantes, ganancia }) {
  const a = ctx.createOscillator(), b = ctx.createOscillator()
  a.type = 'sawtooth'; b.type = 'sawtooth'
  a.frequency.value = f; b.frequency.value = f * 1.012
  const suma = ctx.createGain()
  suma.gain.value = 0.5
  a.connect(suma); b.connect(suma)
  const sat = ctx.createWaveShaper()
  const curva = new Float32Array(1024)
  for (let i = 0; i < curva.length; i++) { const x = (i / (curva.length - 1)) * 2 - 1; curva[i] = Math.tanh(x * 2.2) }
  sat.curve = curva
  const hp = filtro(ctx, 'highpass', 110, 0.8)
  const f1 = ctx.createBiquadFilter(); f1.type = 'peaking'; f1.frequency.value = formantes[0]; f1.Q.value = 1.4; f1.gain.value = 9
  const f2 = ctx.createBiquadFilter(); f2.type = 'peaking'; f2.frequency.value = formantes[1]; f2.Q.value = 2; f2.gain.value = 6
  const lp = filtro(ctx, 'lowpass', 2200, 0.7)
  const am = ctx.createGain()
  am.gain.value = 0.62
  const g = ctx.createGain()
  g.gain.value = ganancia
  suma.connect(sat).connect(hp).connect(f1).connect(f2).connect(lp).connect(am).connect(g).connect(destino)
  const golpe = ctx.createOscillator()
  golpe.type = 'sawtooth'
  golpe.frequency.value = pulso
  const gg = ctx.createGain()
  gg.gain.value = -0.38
  golpe.connect(gg).connect(am.gain)
  // el ralentí se mece tantito: sube y baja las revoluciones juntas
  const deriva = ctx.createOscillator()
  deriva.frequency.value = 0.35
  const dA = ctx.createGain(); dA.gain.value = f * 0.025
  const dB = ctx.createGain(); dB.gain.value = f * 1.012 * 0.025
  const dP = ctx.createGain(); dP.gain.value = pulso * 0.025
  deriva.connect(dA).connect(a.frequency)
  deriva.connect(dB).connect(b.frequency)
  deriva.connect(dP).connect(golpe.frequency)
  const tonales = [{ p: a.frequency, f }, { p: b.frequency, f: f * 1.012 }, { p: golpe.frequency, f: pulso }]
  return { fuentes: [a, b, golpe, deriva], nodos: [a, b, suma, sat, hp, f1, f2, lp, am, g, golpe, gg, deriva, dA, dB, dP], tonales }
}

// El chillido de una bomba hidráulica que sube y baja despacio.
function bomba(ctx, destino, { de, a, ritmo, ganancia }) {
  const o = ctx.createOscillator()
  o.type = 'triangle'
  o.frequency.value = (de + a) / 2
  const g = ctx.createGain()
  g.gain.value = ganancia
  o.connect(g).connect(destino)
  const lfo = ctx.createOscillator()
  lfo.frequency.value = ritmo
  const lg = ctx.createGain()
  lg.gain.value = (a - de) / 2
  lfo.connect(lg).connect(o.frequency)
  return { fuentes: [o, lfo], nodos: [o, g, lfo, lg], tonales: [{ p: o.frequency, f: (de + a) / 2 }] }
}

function armar(ctx, out) {
  const t = ctx.currentTime
  const master = ctx.createGain()
  master.gain.setValueAtTime(0, t)
  const paneo = ctx.createStereoPanner ? ctx.createStereoPanner() : null
  if (paneo) master.connect(paneo).connect(out)
  else master.connect(out)
  const mezcla = ctx.createGain()
  mezcla.connect(master)
  const partes = []
  // Oscar: "es más bien como el sonido del camión de la basura", y con ruido filtrado "se escucha
  // puro ruido". Así que es tono: un motor de diente de sierra con sus armónicos (el grave se sugiere
  // con ellos: nada debajo de ~110 Hz), saturado tantito, pasado por dos formantes y pulsando con
  // cada explosión; encima, el chillido de la bomba hidráulica. El aire queda apenas.
  // el motor acelerado y la bomba que chilla quedito, todo a `tono`
  const k = VENTILADORES.tono
  partes.push(motor(ctx, mezcla, { f: 74 * k, pulso: 37 * k, formantes: [380 * k, 900 * k], ganancia: 0.5 }))
  partes.push(bomba(ctx, mezcla, { de: 620 * k, a: 700 * k, ritmo: 0.25, ganancia: 0.025 }))
  partes.push(aire(ctx, mezcla, { centro: 1000 * k, q: 0.6, ganancia: 0.05, vaiven: 0.15, ritmo: 0.5 }))
  const fuentes = partes.flatMap((p) => p.fuentes)
  const nodos = [master, mezcla, ...(paneo ? [paneo] : []), ...partes.flatMap((p) => p.nodos)]
  fuentes.forEach((f, i) => { try { f.start(t, f.buffer ? (i * 0.137) % 0.9 : undefined) } catch { try { f.start(t) } catch { } } })
  const tonales = partes.flatMap((p) => p.tonales || [])
  return { ctx, master, paneo, fuentes, nodos, tonales, rpm: 1 }
}

export function iniciarVentiladores() {
  pararVentiladores(true)
  const bus = getSfxBus()
  if (!bus) return false
  try { if (bus.ctx.state === 'suspended') bus.ctx.resume().catch(() => { }) } catch { }
  try { voz = armar(bus.ctx, bus.out) } catch { voz = null }
  return !!voz
}

// cercania: 0 lejos (callado), 1 pegado a la caja. Curva para que se note al acercarse y no grite.
// rpm (lib/renderbox.js): con la patada se frena y el motor baja de tono hasta callarse.
export function ajustarVentiladores(cercania = 1, pan = 0, rpm = 1) {
  const v = voz
  if (!v) return
  const c = Math.max(0, Math.min(1, Number(cercania) || 0))
  const r = Math.max(0, Math.min(1, Number(rpm)))
  const nivel = VENTILADORES.nivel * c * c * Math.pow(r, 1.3)
  const t = v.ctx.currentTime
  try {
    v.master.gain.cancelScheduledValues(t)
    v.master.gain.setTargetAtTime(nivel, t, 0.12)
    if (v.paneo) v.paneo.pan.setTargetAtTime(Math.max(-1, Math.min(1, pan)) * 0.7, t, 0.12)
    if (Math.abs(r - v.rpm) > 0.002) {
      const k = 0.3 + 0.7 * r
      for (const { p, f } of v.tonales) p.setTargetAtTime(f * k, t, 0.05)
      v.rpm = r
    }
  } catch { }
}

export function pararVentiladores(ahora = false) {
  const v = voz
  if (!v) return
  voz = null
  try {
    const t = v.ctx.currentTime
    const fin = t + (ahora ? 0.03 : 0.4)
    v.master.gain.cancelScheduledValues(t)
    v.master.gain.setValueAtTime(v.master.gain.value, t)
    v.master.gain.linearRampToValueAtTime(0, fin)
    v.fuentes.forEach((f) => { try { f.stop(fin + 0.05) } catch { } })
  } catch { }
  setTimeout(() => { v.nodos.forEach((n) => { try { n.disconnect() } catch { } }) }, ahora ? 120 : 600)
}

// La vibración: unos décimos de milímetro a la escala del juego, rápida y con dos frecuencias para
// que no se lea como un resorte. Devuelve [x, y, z] para sumarlo a la posición de la caja.
export function vibracionRenderbox(t, cercania = 1, amplitud = 0.006) {
  const a = amplitud * Math.max(0, Math.min(1, cercania))
  return [
    a * (Math.sin(t * 61.0) * 0.6 + Math.sin(t * 97.3) * 0.4),
    a * 0.35 * Math.sin(t * 83.7),
    a * (Math.sin(t * 71.9 + 1.3) * 0.6 + Math.sin(t * 109.1) * 0.4),
  ]
}

// Para medir sin jugar: armar(ctx, salida) en un OfflineAudioContext.
export const vozVentiladores = armar
