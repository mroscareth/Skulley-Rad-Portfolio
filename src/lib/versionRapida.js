// Las tres puertas del sitio y sus URLs (Oscar, 2026-11-12):
//   /        la pantalla principal (el preloader de los tres botones). Siempre:
//            entrar ahí borra la versión que la pestaña tenía elegida.
//   /world   la experiencia completa, el mundo 3D.
//   /simple  la versión rápida: el sitio completo (App.jsx) con QuickHome en
//            lugar de la escena 3D. Las secciones, su preloader, las
//            transiciones y la navegación son las mismas (pedido de Oscar).
//
// Las secciones (/about, /work/…) son las mismas URLs en las dos versiones:
// se abren en la que la pestaña eligió (sessionStorage), y si no eligió
// ninguna, en la completa. Por eso recargar /about sigue en la simple.
//
// Para Google, /world y /simple son el home: su canonical es / (ver
// api/page-prerender.php) y no van en el sitemap.
//
// ?rapida=1 era la URL de la simple hasta el 2026-11-12: llega a /simple.
const LLAVE = 'skulley_rapida'

const BASE = (typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL) || '/'
export const RUTA_PRINCIPAL = BASE
export const RUTA_COMPLETA = `${BASE}world`
export const RUTA_SIMPLE = `${BASE}simple`

// La ruta sin la base y sin diagonales en las orillas ('' es la principal).
export function rutaRelativa(pathname = typeof window !== 'undefined' ? window.location.pathname : '/') {
  let rel = pathname || '/'
  const base = BASE.endsWith('/') ? BASE : `${BASE}/`
  if (rel.startsWith(base)) rel = rel.slice(base.length)
  return rel.replace(/^\/+|\/+$/g, '')
}

// 'principal' | 'completa' | 'simple' | null (una sección).
export function puertaDeRuta(pathname) {
  const rel = rutaRelativa(pathname)
  if (rel === '') return 'principal'
  if (rel === 'world') return 'completa'
  if (rel === 'simple') return 'simple'
  return null
}

// La puerta con la que llegó esta página, leída una sola vez.
export const PUERTA_DE_LLEGADA = typeof window === 'undefined' ? null : puertaDeRuta()

export const VERSION_RAPIDA = typeof window !== 'undefined' && (() => {
  try {
    const q = new URLSearchParams(window.location.search)
    if (PUERTA_DE_LLEGADA === 'principal' && q.get('rapida') === '1') {
      q.delete('rapida')
      const resto = q.toString()
      window.history.replaceState(window.history.state, '', `${RUTA_SIMPLE}${resto ? `?${resto}` : ''}${window.location.hash}`)
      sessionStorage.setItem(LLAVE, '1')
      return true
    }
    if (PUERTA_DE_LLEGADA === 'simple') {
      sessionStorage.setItem(LLAVE, '1')
      return true
    }
    if (PUERTA_DE_LLEGADA === 'principal' || PUERTA_DE_LLEGADA === 'completa' || q.get('full') === '1') {
      sessionStorage.removeItem(LLAVE)
      return false
    }
    return sessionStorage.getItem(LLAVE) === '1'
  } catch { return PUERTA_DE_LLEGADA === 'simple' }
})()

// La home rápida necesita una pantalla de escritorio: ancha y no muy alta. En
// una ventana angosta o casi cuadrada Skulley no cabía y el TLDR se apretaba;
// ahí la versión rápida es la de teléfono (lib/mobileExperience.js).
export const RAPIDA_ANCHA = '(min-width: 1024px) and (min-aspect-ratio: 5/4)'

export function rapidaAncha() {
  try { return window.matchMedia(RAPIDA_ANCHA).matches } catch { return true }
}

// Desde la pantalla principal o la experiencia completa.
export function entrarARapida() {
  try { sessionStorage.setItem(LLAVE, '1') } catch { /* sin storage: la URL basta */ }
  window.location.assign(RUTA_SIMPLE)
}

export function salirDeRapida() {
  try { sessionStorage.removeItem(LLAVE) } catch { /* sin storage */ }
}
