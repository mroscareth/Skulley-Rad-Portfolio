// La foto de "Conocer la historia" (Oscar: sacar fotos del video en PNG para
// usarlas de wallpaper). Pide al rig un cuadro con el encuadre de ese momento
// (CapturaWallpaper con `encuadre: 'actual'`: 4K horizontal, o vertical en el
// teléfono, con el blanco y negro, la tinta y los puntos a escala) y lo baja
// como PNG con el minuto y segundo en el nombre. Si el canvas no corre
// (pestaña en segundo plano), no se queda colgado.
import { playSfx } from './sfx.js'

const TOPE_MS = 15000

function bajar(blob, nombre) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nombre
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10000)
}

// `ancho`: en teléfonos con poca memoria, la foto vertical más angosta.
export function fotoDeHistoria(personalizaRef, { fondo, t = 0, ancho } = {}) {
  return new Promise((resolve) => {
    const pz = personalizaRef?.current
    if (!pz || pz.captura) { resolve(false); return }
    try { playSfx('click', { volume: 0.5 }) } catch { }
    const s = Math.max(0, Math.floor(t / 1000))
    const nombre = `skulley-rad-historia-${Math.floor(s / 60)}-${String(s % 60).padStart(2, '0')}.png`
    let reloj = 0
    const pedido = {
      encuadre: 'actual',
      fondo,
      ancho,
      fase: 'pedida',
      resolve: (blob) => { clearTimeout(reloj); bajar(blob, nombre); resolve(true) },
      reject: () => { clearTimeout(reloj); resolve(false) },
    }
    reloj = setTimeout(() => {
      if (pz.captura === pedido) pz.captura = null
      resolve(false)
    }, TOPE_MS)
    pz.captura = pedido
  })
}
