// Agregar y quitar del carrito (pedido de Oscar, 2026-11-10): de la familia del
// hechizo de los marquees (pips digitales, campanitas, polvo de ruido, eco) pero
// más corto, porque se pica muchas veces seguidas. Agregar es un glitch que sube
// y un acorde mayor que brilla, y cada pieza de más lo sube un grado, para que
// llenar el carrito se sienta como ir ganando. Quitar es lo contrario: el glitch
// baja y dos notas menores se desinflan; vaciar la pieza cierra con una tercera
// nota. Sintetizado por el bus de SFX (respeta volumen y mute), nada debajo de
// ~600 Hz.

import { getSfxBus, getNoiseBuffer } from './sfx.js'

// Mayor de do, de C6 a C7: el grado lo da la cantidad de piezas.
const ESCALA = [1047, 1175, 1319, 1397, 1568, 1760, 1976, 2093]
const grado = (n) => ESCALA[Math.max(0, Math.min(ESCALA.length - 1, n))]

// Nivel de cada uno a la salida del bus, medido contra el clic que sonaba antes
// (pico 0.16 con el volumen de efectos al 50 %): los dos quedan en ~0.24, un
// poco arriba para que se oigan bien en bocinas de laptop. Quitar lleva más
// ganancia porque el triángulo grave suena menos que las campanitas.
const NIVEL_AGREGAR = 2.2
const NIVEL_QUITAR = 4.2

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
  env(g.gain, t, 0.03, 0.002, 0.028)
  o.connect(g); g.connect(out)
  o.start(t)
  suelta([o, g], t + 0.05)
}

// Campanita con brillo: dos senos apenas desafinados (el batido la hace
// centellear) más el parcial inarmónico de vibráfono.
function campana(ctx, out, t, f, pico, dur) {
  for (const [k, p, d] of [[1, pico, dur], [1.004, pico * 0.6, dur], [2.76, pico * 0.22, dur * 0.4]]) {
    const o = ctx.createOscillator()
    o.type = 'sine'
    o.frequency.setValueAtTime(f * k, t)
    const g = ctx.createGain()
    env(g.gain, t, p, 0.003, d)
    o.connect(g); g.connect(out)
    o.start(t)
    suelta([o, g], t + d + 0.05)
  }
}

// Nota que se desinfla: triángulo que se dobla hacia abajo mientras se apaga.
function caida(ctx, out, t, f, doblez, pico, dur) {
  const o = ctx.createOscillator()
  o.type = 'triangle'
  o.frequency.setValueAtTime(f, t)
  o.frequency.exponentialRampToValueAtTime(f * doblez, t + dur)
  const g = ctx.createGain()
  env(g.gain, t, pico, 0.006, dur)
  o.connect(g); g.connect(out)
  o.start(t)
  suelta([o, g], t + dur + 0.05)
}

function polvo(ctx, out, t, de, a, dur, pico) {
  const src = ctx.createBufferSource()
  src.buffer = getNoiseBuffer(ctx)
  src.loop = true
  const bp = ctx.createBiquadFilter()
  bp.type = 'bandpass'
  bp.Q.value = 6
  bp.frequency.setValueAtTime(de, t)
  bp.frequency.exponentialRampToValueAtTime(a, t + dur)
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(pico, t + dur * 0.3)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  src.connect(bp); bp.connect(g); g.connect(out)
  src.start(t, Math.random() * 0.5)
  suelta([src, bp, g], t + dur + 0.05)
}

// Eco más corto y seco que el del hechizo: con clics seguidos no se embarra.
function eco(ctx, out, nivel) {
  const entrada = ctx.createGain()
  entrada.gain.value = nivel
  const delay = ctx.createDelay(0.3)
  delay.delayTime.value = 0.085
  const vuelta = ctx.createGain()
  vuelta.gain.value = 0.26
  const tono = ctx.createBiquadFilter()
  tono.type = 'lowpass'
  tono.frequency.value = 4800
  entrada.connect(out)
  entrada.connect(delay)
  delay.connect(tono); tono.connect(vuelta); vuelta.connect(delay)
  tono.connect(out)
  setTimeout(() => { for (const n of [entrada, delay, vuelta, tono]) { try { n.disconnect() } catch { } } }, 1600)
  return entrada
}

function abrir() {
  const bus = getSfxBus()
  if (!bus) return null
  try { if (bus.ctx.state === 'suspended') bus.ctx.resume().catch(() => { }) } catch { }
  return bus
}

/** cantidad: cuántas piezas de esa variante hay ya en el carrito. */
export function playCarritoAgregar(cantidad = 1) {
  const bus = abrir()
  if (!bus) return
  const { ctx, out } = bus
  try {
    const t0 = ctx.currentTime + 0.005
    const sal = eco(ctx, out, NIVEL_AGREGAR)
    const f = grado(cantidad - 1)
    pip(ctx, sal, t0, f * 0.7)
    pip(ctx, sal, t0 + 0.03, f * 1.05)
    ;[1, 1.26, 1.5, 2].forEach((k, i) => {
      const ultima = i === 3
      campana(ctx, sal, t0 + 0.065 + i * 0.045, f * k, ultima ? 0.07 : 0.055, ultima ? 0.6 : 0.28)
    })
    polvo(ctx, sal, t0 + 0.05, 3200, 9500, 0.32, 0.035)
  } catch { }
}

/** quedan: cuántas piezas de esa variante siguen en el carrito (0 = se fue). */
export function playCarritoQuitar(quedan = 0) {
  const bus = abrir()
  if (!bus) return
  const { ctx, out } = bus
  try {
    const t0 = ctx.currentTime + 0.005
    const sal = eco(ctx, out, NIVEL_QUITAR)
    const f = grado(quedan)
    pip(ctx, sal, t0, f * 1.7)
    pip(ctx, sal, t0 + 0.03, f * 1.15)
    caida(ctx, sal, t0 + 0.06, f * 1.5, 0.93, 0.07, 0.12)
    caida(ctx, sal, t0 + 0.15, f * 1.19, quedan > 0 ? 0.88 : 0.95, 0.07, quedan > 0 ? 0.26 : 0.12)
    if (quedan <= 0) caida(ctx, sal, t0 + 0.24, f, 0.7, 0.075, 0.42)
    polvo(ctx, sal, t0 + 0.04, 6500, 1800, quedan > 0 ? 0.26 : 0.45, 0.03)
  } catch { }
}
