// Las cuatro bandas del fuego de la skin Inferno, de la orilla al centro: honda,
// media, clara y centro. Las comparten el cuerpo (skinShaders.js, modo 4), las
// llamas de la mano y del mohawk (LlamaMano, vía forcedColors.fuego de la skin),
// la bola de fuego y su explosión (el color del orbe) y su muestrario, para que
// todo sea el mismo fuego. El centro va crema y no blanco, como el de la llama
// de la mano (Oscar: blanco no). Dos variantes (Oscar, 2026-11-16): llamas rojas
// y azules, que se escogen en Customize y se recuerdan en el navegador.
export const PALETAS_INFERNO = {
  rojo: ['#7a1200', '#ff4a00', '#ff9a00', '#ffe08a'],
  azul: ['#0b1f73', '#1c5cff', '#38c6ff', '#d6f4ff'],
}
export const PALETA_INFERNO = PALETAS_INFERNO.rojo

const LLAVE_VARIANTE = 'skulley_inferno_color'
export const VARIANTE_INFERNO_EVENT = 'inferno-variante'

export function varianteInferno() {
  try {
    const v = localStorage.getItem(LLAVE_VARIANTE)
    return v && PALETAS_INFERNO[v] ? v : 'rojo'
  } catch { return 'rojo' }
}

export function paletaInferno() {
  return PALETAS_INFERNO[varianteInferno()]
}

export function guardarVarianteInferno(v) {
  if (!PALETAS_INFERNO[v]) return
  try { localStorage.setItem(LLAVE_VARIANTE, v) } catch { }
  try { window.dispatchEvent(new CustomEvent(VARIANTE_INFERNO_EVENT, { detail: v })) } catch { }
}

// Un color sRGB en hexadecimal a componentes lineales (lo que usan los shaders de
// three y THREE.Color por dentro).
export function linealDeHex(hex) {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const s = c / 255
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  })
}

// Componentes sRGB de 0 a 1 (para el muestrario, que no pasa por el manejo de
// color de three).
export function srgbDeHex(hex) {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
}

// `vec3(r, g, b)` de GLSL, en lineal (lineal = false: tal cual, para el muestrario).
export function vec3DeHex(hex, lineal = true) {
  const v = lineal ? linealDeHex(hex) : srgbDeHex(hex)
  return `vec3(${v.map((x) => x.toFixed(4)).join(', ')})`
}
