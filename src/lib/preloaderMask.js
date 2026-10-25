// Máscara del Skulley de fondo del preloader: lo disuelve hacia la izquierda
// (para que el texto mande) y hacia arriba y abajo.
//
// En PÍXELES, no en porcentajes: el contenedor cambia de ancho por
// breakpoint y la zona de desvanecido tiene que medir lo mismo en todos.
// La rampa horizontal aproxima un smoothstep sobre 520px: un degradado
// lineal corto se lee como una banda con borde (el ojo detecta el quiebre de
// la derivada, no el del color). Misma idea en el eje vertical.

// [px desde el borde izquierdo, alfa]
const MASK_X = [
  [0, 0], [90, 0.02], [160, 0.08], [225, 0.18], [285, 0.34],
  [345, 0.54], [405, 0.74], [460, 0.9], [500, 0.98], [520, 1],
]
// [px desde arriba, alfa]
const MASK_TOP = [[0, 0], [55, 0.35], [110, 0.85], [150, 1]]
// [px desde abajo, alfa]
const MASK_BOTTOM = [[190, 1], [120, 0.85], [55, 0.3], [0, 0]]

const color = (a) => (a === 0 ? 'transparent' : a === 1 ? '#000' : `rgba(0,0,0,${a})`)

export const PRELOADER_MASK = [
  `linear-gradient(to right, ${MASK_X.map(([p, a]) => `${color(a)} ${p}px`).join(', ')})`,
  `linear-gradient(to bottom, ${[
    ...MASK_TOP.map(([p, a]) => `${color(a)} ${p}px`),
    ...MASK_BOTTOM.map(([q, a]) => `${color(a)} ${q === 0 ? '100%' : `calc(100% - ${q}px)`}`),
  ].join(', ')})`,
].join(', ')
