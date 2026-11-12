import { irisCubrir, irisWaiting } from './irisTransition.js'

// El cambio entre la versión rápida y la completa recarga la página, pero se ve
// como una transición del sitio (Oscar: "nuestras cortinillas y preloaders"):
//   1. antes de irse, los puntos tapan la pantalla en un color (irisCubrir) y
//      sale la mascota caminando (irisWaiting), el preloader de escena;
//   2. el color queda en la pestaña: el boot-shim de index.html arranca pintado
//      igual y con la mascota, así la recarga no parpadea;
//   3. la otra versión monta tapada en ese color (cortinaDeLlegada + irisTapar
//      en App.jsx) y abre el iris cuando está lista.
const LLAVE = 'skulley_cortina'

export async function cambiarDeVersion(color, irse) {
  try { sessionStorage.setItem(LLAVE, JSON.stringify(color)) } catch { /* sin storage: solo se pierde el color del shim */ }
  await irisCubrir({ color })
  irisWaiting(true)
  irse()
}

// El color con el que llegó esta página (o null), leído una sola vez.
export function cortinaDeLlegada() {
  try {
    const c = JSON.parse(sessionStorage.getItem(LLAVE) || 'null')
    sessionStorage.removeItem(LLAVE)
    return Array.isArray(c) && c.length === 3 ? c : null
  } catch { return null }
}
