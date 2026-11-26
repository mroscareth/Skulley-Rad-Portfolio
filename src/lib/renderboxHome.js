// La Renderbox del claro (Oscar, 2026-11-24): su computadora de verdad, en la orilla del claro de
// cara a la cámara. Zumba y tiembla al acercarse y una patada de Skulley la apaga o la prende
// (lib/renderbox.js). Sin three: HomeScene la patea con la misma cuenta que al drone y Player la
// choca con los obstáculos.

import { crearRenderbox } from './renderbox.js'

// Entre los portales de Contacto y Memorias, en la orilla del claro (en medio, detrás de Argus, él la
// tapaba), de frente al centro: su cable se va al bosque.
const X = 23.5 * Math.sin((252 * Math.PI) / 180)
const Z = -23.5 * Math.cos((252 * Math.PI) / 180)

export const RENDERBOX_CLARO = {
  x: X,
  z: Z,
  giro: Math.atan2(-X, -Z), // su frente (+z del GLB) hacia el centro del claro
  escala: 3.6,     // la del GLB está en metros reales: así le llega al pecho a Skulley
  brilloVentiladores: 1.8, // de noche, sobre el azul, el brillo azul de los ventiladores no se leía
  // Es negra mate y de noche se perdía en el azul; aclarada, las manchas de la acuarela se veían como
  // vaca (Oscar). Se queda el detalle fino (la rejilla, las orillas) sobre un gris pizarra parejo.
  pizarra: '#4a4f5c',
  detalle: 1.5,
  // Oscar, 2026-11-25: aun así "se ven manchadas". El promedio se toma de más cerca (`mip`: el detalle
  // que queda es más fino) y solo pasa el detalle fuerte (la rejilla, las orillas, los tornillos): lo
  // que se aparta del promedio menos que `umbral` (las pinceladas de la acuarela) se queda en el gris.
  mip: 3,
  umbral: 0.07,
  oye: [4, 22],    // a qué distancia de Skulley se oye a todo y deja de oírse
}

// Donde no crece el pasto pintado: la Renderbox y su Cintiq (Oscar, 2026-11-25: "el pasto atraviesa la
// Wacom"). La Cintiq va en el marco de la Renderbox (props_claro.glb, su cuerpo en x −1.06, z +0.03 m).
export function zonasSinPasto() {
  const C = RENDERBOX_CLARO
  const lx = -1.06 * C.escala, lz = 0.03 * C.escala
  const cs = Math.cos(C.giro), sn = Math.sin(C.giro)
  return [
    { x: C.x, z: C.z, r: 2.2 },
    { x: C.x + cs * lx + sn * lz, z: C.z - sn * lx + cs * lz, r: 2.2 },
  ]
}

export const renderboxClaro = {
  montado: false,
  rb: crearRenderbox(),
  radio: 1,        // lo pone el componente al medir la caja
  alto: 1.7,
}

/** La patada de Skulley (los mismos datos que patadaAlDron): si la alcanza, la apaga o la prende y
 * regresa dónde pegó para las chispas de Player. */
export function patadaARenderbox(pie, dir, radio, skip, base, mitad) {
  const R = renderboxClaro
  if (!R.montado || !dir || (skip && skip.has('renderbox'))) return null
  const b = base || pie
  const fx = RENDERBOX_CLARO.x - b.x
  const fz = RENDERBOX_CLARO.z - b.z
  const d = Math.hypot(fx, fz)
  if (d - R.radio > radio) return null
  if (d > R.radio) {
    const ang = Math.acos(Math.max(-1, Math.min(1, (fx * dir.x + fz * dir.z) / d)))
    if (ang - Math.asin(Math.min(1, R.radio / d)) > (mitad ?? 1.31)) return null
  }
  if (skip) skip.add('renderbox')
  // de qué lado le pega (se ladea al otro): el signo del giro entre la patada y el centro
  const lado = fx * dir.z - fz * dir.x
  R.rb.patear(lado >= 0 ? 1 : -1)
  const k = d > 1e-4 ? R.radio / d : 0
  return { x: RENDERBOX_CLARO.x - fx * k, y: R.alto * 0.35, z: RENDERBOX_CLARO.z - fz * k, power: 0.9, color: '' }
}
