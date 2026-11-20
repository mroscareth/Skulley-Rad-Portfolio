// El drone de M.A.D.R.E. que anda por la home (components/drone/DroneNPC.jsx).
// Estado compartido sin three: App y el diálogo lo leen y van en el chunk de
// entrada. El NPC escribe `pos` cada cuadro (la cámara del diálogo la mira) y
// lee lo demás.
export const dron = {
  montado: false,
  pos: { x: 0, y: 0, z: 0 },
  // el castigo de la tercera trampa: { alGolpe, pedido }
  castigo: null,
}

const oyentes = new Set()
// El diálogo le pide caras y acciones al drone: { cara } | { accion } | { voltear: true }
export function escucharDron(fn) {
  oyentes.add(fn)
  return () => oyentes.delete(fn)
}
export function avisarDron(msg) {
  for (const fn of oyentes) {
    try { fn(msg) } catch { }
  }
}

// La tercera trampa (App): si el drone está en la escena, vuela hacia Skulley,
// invoca el rayo y llama `alGolpe` en el cuadro en que azota. Sin drone regresa
// false y App sigue con su tiempo de siempre.
export function castigarConDron(alGolpe) {
  if (!dron.montado) return false
  dron.castigo = { alGolpe, pedido: performance.now() }
  return true
}
