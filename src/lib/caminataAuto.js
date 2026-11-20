// Skulley camina solo hasta un punto y se voltea hacia otro (la escena del trato
// de Argus lo lleva hasta él). Player lo lee en cada cuadro con `pasoCaminata`:
// regresa la dirección en el mundo (con su fuerza, 0..1) mientras falta camino
// y, ya llegado, el ángulo hacia donde debe voltear. Sin three: lo pide el
// diálogo, que va en el chunk de entrada.

export const caminata = {
  activa: false,
  x: 0,
  z: 0,
  // hacia dónde voltea al llegar
  mx: 0,
  mz: 0,
  llego: false,
  desde: 0,
}

// cuánto le falta para darse por llegado (unidades del mundo)
const LLEGA = 0.35
// frena los últimos tramos para no pasarse
const FRENA = 1.4
const FUERZA_MIN = 0.45
// si en este tiempo no llega (algo lo tapó), se da por llegado donde esté
const TOPE_MS = 4500

export function caminarA(x, z, mx, mz) {
  caminata.activa = true
  caminata.x = x
  caminata.z = z
  caminata.mx = mx
  caminata.mz = mz
  caminata.llego = false
  caminata.desde = performance.now()
}

export function soltarCaminata() {
  caminata.activa = false
  caminata.llego = false
}

const salida = { x: 0, z: 0, mirar: null }

// `pos`: la posición simulada de Skulley. null si no hay caminata.
export function pasoCaminata(pos) {
  if (!caminata.activa) return null
  const dx = caminata.x - pos.x
  const dz = caminata.z - pos.z
  const d = Math.hypot(dx, dz)
  if (!caminata.llego && (d < LLEGA || performance.now() - caminata.desde > TOPE_MS)) caminata.llego = true
  if (!caminata.llego) {
    const f = Math.max(FUERZA_MIN, Math.min(1, d / FRENA))
    salida.x = (dx / d) * f
    salida.z = (dz / d) * f
    salida.mirar = null
    return salida
  }
  salida.x = 0
  salida.z = 0
  salida.mirar = Math.atan2(caminata.mx - pos.x, caminata.mz - pos.z)
  return salida
}
