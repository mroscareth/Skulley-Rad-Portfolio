// Las explosiones del home (la bola de fuego al llegar, la carga sin láser): Player
// las avisa con su centro, su alcance y su fuerza (0 a 1), en el mismo momento en
// que empuja a las esferas; lo que reacciona en el piso las escucha (los pétalos de
// PetalosCamino vuelan y se queman). Sin three.

const oyentes = new Set()

/** fn({ x, y, z, radio, fuerza }). Devuelve con qué dejar de escuchar. */
export function escucharExplosiones(fn) {
  oyentes.add(fn)
  return () => oyentes.delete(fn)
}

export function avisarExplosion(e) {
  for (const fn of oyentes) {
    try { fn(e) } catch { }
  }
}
