import { useCallback, useEffect, useState } from 'react'
import { setSfxSilencio } from './sfx.js'

// La bocina de la barra de escritorio (Oscar, 2026-11-13): calla en un clic la
// música (MusicPlayer, con su propio nodo de silencio para no pelear con los
// fundidos ni con el ducking) y los efectos (sfx.js). Se recuerda en la
// pestaña (sessionStorage), así que sobrevive a las secciones y al cambio de
// versión, que recarga. La pantalla principal (/) la borra: ahí manda su
// propia bocina y entrar a una experiencia enciende el sonido como siempre.
// "Conocer la historia" también la quita: la historia es para oírse.
const LLAVE = 'skulley_silencio'
export const EVENTO_SILENCIO = 'sitio-silencio'

let silencio = (() => {
  try {
    if (window.location.pathname === '/') {
      sessionStorage.removeItem(LLAVE)
      return false
    }
    return sessionStorage.getItem(LLAVE) === '1'
  } catch { return false }
})()
setSfxSilencio(silencio)

export const sitioEnSilencio = () => silencio

export function silenciarSitio(si) {
  const v = Boolean(si)
  if (v === silencio) return
  silencio = v
  try {
    if (v) sessionStorage.setItem(LLAVE, '1')
    else sessionStorage.removeItem(LLAVE)
  } catch { /* sin storage: dura lo que la página */ }
  setSfxSilencio(v)
  try { window.dispatchEvent(new CustomEvent(EVENTO_SILENCIO, { detail: { silencio: v } })) } catch { }
}

export function useSilencioSitio() {
  const [si, setSi] = useState(silencio)
  useEffect(() => {
    const onCambio = (e) => setSi(Boolean(e.detail?.silencio))
    window.addEventListener(EVENTO_SILENCIO, onCambio)
    setSi(silencio)
    return () => window.removeEventListener(EVENTO_SILENCIO, onCambio)
  }, [])
  const alternar = useCallback(() => silenciarSitio(!silencio), [])
  return [si, alternar]
}
