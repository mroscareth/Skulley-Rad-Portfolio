import { irisCubrir, irisWaiting } from './irisTransition.js'
import { RUTA_PRINCIPAL, salirDeRapida } from './versionRapida.js'
import { despedirMusica, esperarSilencio } from './musicaLobby.js'

// El cambio entre la pantalla principal, la versión rápida y la completa recarga
// la página, pero se ve como una transición del sitio (Oscar: "nuestras
// cortinillas y preloaders"):
//   1. antes de irse, la música baja (despedirMusica, Oscar: en la carga ya
//      hay silencio), los puntos tapan la pantalla en un color (irisCubrir) y
//      sale la mascota caminando (irisWaiting), el preloader de escena;
//   2. el color queda en la pestaña: el boot-shim de index.html arranca pintado
//      igual y con la mascota, así la recarga no parpadea;
//   3. la otra página monta tapada en ese color (cortinaDeLlegada + irisTapar
//      en App.jsx) y abre el iris cuando está lista.
const LLAVE = 'skulley_cortina'

// El azul del home y de la pantalla principal.
export const AZUL_PRINCIPAL = [2, 45, 214]

let yendose = false

export async function cambiarDeVersion(color, irse) {
  if (yendose) return
  yendose = true
  try { sessionStorage.setItem(LLAVE, JSON.stringify(color)) } catch { /* sin storage: solo se pierde el color del shim */ }
  // Si el navegador regresa a esta página desde su caché (atrás), volvería
  // tapada por la cortinilla: mejor se carga de nuevo.
  window.addEventListener('pageshow', (e) => { if (e.persisted) window.location.reload() }, { once: true })
  despedirMusica()
  await irisCubrir({ color })
  await esperarSilencio()
  irisWaiting(true)
  irse()
}

// A la pantalla principal (/), siempre posible desde cualquier versión.
// `recargar`: el atrás del navegador ya dejó la URL en /.
export function volverAlInicio({ recargar = false } = {}) {
  return cambiarDeVersion(AZUL_PRINCIPAL, () => {
    salirDeRapida()
    if (recargar) window.location.reload()
    else window.location.assign(RUTA_PRINCIPAL)
  })
}

// El color con el que llegó esta página (o null), leído una sola vez.
export function cortinaDeLlegada() {
  try {
    const c = JSON.parse(sessionStorage.getItem(LLAVE) || 'null')
    sessionStorage.removeItem(LLAVE)
    return Array.isArray(c) && c.length === 3 ? c : null
  } catch { return null }
}
