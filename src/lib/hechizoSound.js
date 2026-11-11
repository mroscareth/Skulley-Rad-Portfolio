// El hechizo del easter egg de los marquees (pedido de Oscar, 2026-11-10): al
// glitchear de las runas a las letras suena un tartamudeo digital de cuatro pips
// (lo que tiembla) y luego un arpegio de campanitas que sube con polvo de hada
// (ruido agudo que barre hacia arriba), todo con eco. De regreso a las runas el
// arpegio baja y el polvo cae. Sintetizado por el bus de SFX (respeta volumen y
// mute) y sin nada debajo de ~600 Hz.

import { getSfxBus, getNoiseBuffer } from './sfx.js'

// Pentatónica de do, de C6 a E7: cualquier orden suena a magia y nunca desafina.
const NOTAS = [1047, 1175, 1319, 1568, 1760, 2093, 2349, 2637]

function env(param, t, pico, ataque, fin) {
  param.setValueAtTime(0.0001, t)
  param.exponentialRampToValueAtTime(pico, t + ataque)
  param.exponentialRampToValueAtTime(0.0001, t + fin)
}

function suelta(nodos, t) {
  nodos[0].onended = () => { for (const n of nodos) { try { n.disconnect() } catch { } } }
  nodos[0].stop(t)
}

function pip(ctx, out, t, f) {
  const o = ctx.createOscillator()
  o.type = 'square'
  o.frequency.setValueAtTime(f, t)
  const g = ctx.createGain()
  env(g.gain, t, 0.035, 0.002, 0.03)
  o.connect(g); g.connect(out)
  o.start(t)
  suelta([o, g], t + 0.05)
}

// Campanita: fundamental más un parcial inarmónico (2.76×), como un vibráfono chico.
function campana(ctx, out, t, f, pico) {
  for (const [k, p, dur] of [[1, pico, 0.55], [2.76, pico * 0.28, 0.22]]) {
    const o = ctx.createOscillator()
    o.type = 'sine'
    o.frequency.setValueAtTime(f * k * (1 + (Math.random() - 0.5) * 0.006), t)
    const g = ctx.createGain()
    env(g.gain, t, p, 0.004, dur)
    o.connect(g); g.connect(out)
    o.start(t)
    suelta([o, g], t + dur + 0.05)
  }
}

function polvo(ctx, out, t, de, a, dur) {
  const src = ctx.createBufferSource()
  src.buffer = getNoiseBuffer(ctx)
  src.loop = true
  const bp = ctx.createBiquadFilter()
  bp.type = 'bandpass'
  bp.Q.value = 7
  bp.frequency.setValueAtTime(de, t)
  bp.frequency.exponentialRampToValueAtTime(a, t + dur)
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(0.05, t + dur * 0.35)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  src.connect(bp); bp.connect(g); g.connect(out)
  src.start(t, Math.random() * 0.5)
  suelta([src, bp, g], t + dur + 0.05)
}

function eco(ctx, out) {
  const entrada = ctx.createGain()
  const delay = ctx.createDelay(0.5)
  delay.delayTime.value = 0.13
  const vuelta = ctx.createGain()
  vuelta.gain.value = 0.34
  const tono = ctx.createBiquadFilter()
  tono.type = 'lowpass'
  tono.frequency.value = 5200
  entrada.connect(out)
  entrada.connect(delay)
  delay.connect(tono); tono.connect(vuelta); vuelta.connect(delay)
  tono.connect(out)
  setTimeout(() => { for (const n of [entrada, delay, vuelta, tono]) { try { n.disconnect() } catch { } } }, 2600)
  return entrada
}

/** regreso = false: de runas a letras (sube). true: de letras a runas (baja). */
export function playHechizo(regreso = false) {
  const bus = getSfxBus()
  if (!bus) return
  const { ctx, out } = bus
  try { if (ctx.state === 'suspended') ctx.resume().catch(() => { }) } catch { }
  try {
    const t0 = ctx.currentTime + 0.005
    const sal = eco(ctx, out)
    for (let i = 0; i < 4; i += 1) pip(ctx, sal, t0 + i * 0.04, 700 + Math.random() * 1900)
    const notas = regreso ? [...NOTAS].reverse() : NOTAS
    const fuerza = regreso ? 0.75 : 1
    notas.forEach((f, i) => campana(ctx, sal, t0 + 0.09 + i * 0.038, f, 0.07 * fuerza))
    if (regreso) polvo(ctx, sal, t0 + 0.06, 9000, 2800, 0.6)
    else polvo(ctx, sal, t0 + 0.06, 2800, 9000, 0.6)
  } catch { }
}
