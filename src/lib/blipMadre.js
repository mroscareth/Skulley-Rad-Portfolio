import { getSfxBus } from './sfx.js'

// El "bip" de cuando M.A.D.R.E. escribe en su diálogo (DialogoMadre), como el
// texto de los videojuegos. Sintetizado por el bus de SFX (respeta volumen y
// mute): un pulso cuadrado cortito con filtro, en notas de una pentatónica alta
// para que no canse. Nada debajo de ~600 Hz (bocinas de laptop y celular).
const NOTAS = [784, 880, 988, 1175, 1319]
// Los diálogos se oyen por encima de la música (lib/mezcla.js). Con 0.045 cada
// bip quedaba 22 dB debajo de la canción y no se oía.
const PICO = 0.36

export function blipMadre(fuerza = 1) {
  const bus = getSfxBus()
  if (!bus) return
  const { ctx, out } = bus
  const t = ctx.currentTime
  const osc = ctx.createOscillator()
  osc.type = 'square'
  osc.frequency.value = NOTAS[Math.floor(Math.random() * NOTAS.length)] * (0.99 + Math.random() * 0.02)
  const filtro = ctx.createBiquadFilter()
  filtro.type = 'lowpass'
  filtro.frequency.value = 2600
  const g = ctx.createGain()
  g.gain.setValueAtTime(0, t)
  g.gain.linearRampToValueAtTime(PICO * fuerza, t + 0.004)
  g.gain.exponentialRampToValueAtTime(0.0008, t + 0.05)
  osc.connect(filtro)
  filtro.connect(g)
  g.connect(out)
  osc.start(t)
  osc.stop(t + 0.06)
}
