// La versión rápida de escritorio: la segunda puerta del preloader de scroll,
// para quien no quiere jugar. Es el sitio completo (App.jsx) con QuickHome en
// lugar de la escena 3D: las secciones, su preloader, las transiciones y la
// navegación son las mismas (pedido de Oscar).
//
// Se elige con ?rapida=1 y se queda en la pestaña (sessionStorage): al navegar
// la URL pierde el parámetro y recargar tiene que seguir en ella. ?full=1 o
// "Experiencia completa" (salirDeRapida) la apagan.
const LLAVE = 'skulley_rapida'

export const VERSION_RAPIDA = typeof window !== 'undefined' && (() => {
  try {
    const q = new URLSearchParams(window.location.search)
    if (q.get('full') === '1') {
      sessionStorage.removeItem(LLAVE)
      return false
    }
    if (q.get('rapida') === '1') {
      sessionStorage.setItem(LLAVE, '1')
      return true
    }
    return sessionStorage.getItem(LLAVE) === '1'
  } catch { return false }
})()

// La home rápida necesita una pantalla de escritorio: ancha y no muy alta. En
// una ventana angosta o casi cuadrada Skulley no cabía y el TLDR se apretaba;
// ahí la versión rápida es la de teléfono (lib/mobileExperience.js).
export const RAPIDA_ANCHA = '(min-width: 1024px) and (min-aspect-ratio: 5/4)'

export function rapidaAncha() {
  try { return window.matchMedia(RAPIDA_ANCHA).matches } catch { return true }
}

// Desde la experiencia completa (el botón de la esquina en la home).
export function entrarARapida(base = '/') {
  try { sessionStorage.setItem(LLAVE, '1') } catch { /* sin storage: la URL basta */ }
  window.location.assign(`${base}?rapida=1`)
}

export function salirDeRapida() {
  try { sessionStorage.removeItem(LLAVE) } catch { /* sin storage */ }
}
