// ¿Esta visita se lleva la versión de teléfono?
//
// El sitio completo monta dos contextos WebGL (la escena de home y el retrato),
// el personaje riggeado dos veces y el mundo entero alrededor. Un teléfono no
// lo sostiene, así que ahí servimos otro árbol: el cartel + los capítulos.
//
// Dos decisiones que parecen detalles y no lo son:
//
//   1. El criterio es el LADO CORTO de la pantalla, no `innerWidth`. Un iPhone
//      acostado mide 844×390: con un gate por ancho se saldría de la versión
//      de teléfono a media visita, remontando el árbol entero.
//
//   2. Se evalúa UNA sola vez, al cargar, igual que `?pose=1` y `/help` en
//      App.jsx. Nunca reactivo: girar el aparato no debe cambiar de sitio.
//
// `pointer: coarse` es lo que de verdad separa un teléfono de una ventana
// angosta en el escritorio. `window.__isMobilePerf` (lo calcula el boot inline
// de index.html) NO sirve acá como criterio: su heurística incluye laptops con
// GPU integrada, que sí pueden con la experiencia completa.

const PHONE_MAX_SIDE_PX = 640

function readOverride() {
  try {
    const q = new URLSearchParams(window.location.search)
    if (q.get('full') === '1') return false
    if (q.get('mobile') === '1') return true
  } catch { /* URL rara: decide la pantalla */ }
  return null
}

// APAGADO (2026-10-26, decisión de Oscar): el cartel no convenció — se veía
// plano y sin atractivo — así que ningún teléfono cae solo en esta versión.
// Hoy solo se entra a propósito con ?mobile=1, para poder seguir trabajándola
// sin que nadie se la encuentre. El día que el rediseño pase, poner esto en
// true y el gate vuelve a decidir por pantalla (abajo está el criterio
// completo, intacto). El mismo interruptor existe en el boot inline de
// index.html: los dos tienen que cambiar juntos.
const AUTO_DETECT = false

function detect() {
  if (typeof window === 'undefined') return false

  const override = readOverride()
  if (override !== null) return override

  if (!AUTO_DETECT) return false

  // El boot inline de index.html ya lo calculó, antes de que existiera React
  // (y de ahí decide si vale la pena precargar el HDRI). Mismo criterio, un
  // solo lugar: si está, manda ese valor.
  if (typeof window.__isPhoneExperience === 'boolean') return window.__isPhoneExperience

  let coarse = false
  try {
    coarse = typeof window.matchMedia === 'function'
      && window.matchMedia('(pointer: coarse)').matches
  } catch { /* sin matchMedia: que mande el tamaño */ }
  if (!coarse) return false

  const shortSide = Math.min(window.innerWidth || 0, window.innerHeight || 0)
  return shortSide > 0 && shortSide <= PHONE_MAX_SIDE_PX
}

let cached = null

/** True en teléfonos. Congelado en la primera llamada; `?full=1` / `?mobile=1` lo fuerzan. */
export function isPhoneExperience() {
  if (cached === null) cached = detect()
  return cached
}

export default isPhoneExperience
