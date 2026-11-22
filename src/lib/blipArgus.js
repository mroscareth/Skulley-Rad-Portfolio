import { getSfxBus } from './sfx.js'

// La voz de Argus cuando escribe en su escena del trato (ZoidianDialog): más
// grave y redonda que el bip de M.A.D.R.E. (blipMadre), un "blop" de triángulo
// que cae un poco de tono, en una pentatónica media. Sintetizado por el bus de
// SFX (respeta volumen y mute). Nada debajo de ~330 Hz (bocinas de laptop y celular).
const NOTAS = [392, 440, 523, 587, 659]
// Los diálogos se oyen por encima de la música (lib/mezcla.js). Con 0.11 cada
// bip quedaba 16 dB debajo de la canción.
const PICO = 0.44

export function blipArgus(fuerza = 1) {
  const bus = getSfxBus()
  if (!bus) return
  const { ctx, out } = bus
  const t = ctx.currentTime
  const f0 = NOTAS[Math.floor(Math.random() * NOTAS.length)] * (0.98 + Math.random() * 0.04)
  const osc = ctx.createOscillator()
  osc.type = 'triangle'
  osc.frequency.setValueAtTime(f0 * 1.12, t)
  osc.frequency.exponentialRampToValueAtTime(f0 * 0.86, t + 0.07)
  const filtro = ctx.createBiquadFilter()
  filtro.type = 'lowpass'
  filtro.frequency.value = 1900
  const g = ctx.createGain()
  g.gain.setValueAtTime(0, t)
  g.gain.linearRampToValueAtTime(PICO * fuerza, t + 0.006)
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.085)
  osc.connect(filtro)
  filtro.connect(g)
  g.connect(out)
  osc.start(t)
  osc.stop(t + 0.1)
}
