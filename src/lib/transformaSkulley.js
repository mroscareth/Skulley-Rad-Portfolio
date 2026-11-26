// Skulley se deshace en puntos y se rearma en su lugar, sin quitar el mundo (Oscar, 2026-11-26: al despertar
// del final de la ofrenda se vuelve Poltergeist "con la animación de desintegrar que usamos al viajar a una
// sección... no quiero que deshaga el mundo"). Lo pide App y lo hace home/TransformaSkulley.jsx con los puntos de
// particulasSkulley.js; `alOcultar` corre ya deshecho (ahí se cambia la skin). Sin three: lo importa App.

import { ocultarSkulley } from './inventarioEscena.js'

export const transforma = { pedido: null }

// de sobra: el cambio de skin puede congelar unos segundos el primer cuadro (si compila)
const TOPE_MS = 12000

export function transformarSkulley(alOcultar) {
  return new Promise((listo) => {
    const pedido = { alOcultar, listo, oculto: false }
    transforma.pedido = pedido
    // con la pestaña escondida el loop no corre: que la skin cambie igual y nadie se quede esperando
    window.setTimeout(() => {
      if (transforma.pedido !== pedido) return
      if (!pedido.oculto) { pedido.oculto = true; try { alOcultar?.() } catch { } }
      transforma.pedido = null
      ocultarSkulley(false)
      listo()
    }, TOPE_MS)
  })
}
