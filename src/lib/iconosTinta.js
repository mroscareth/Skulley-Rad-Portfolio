// Íconos de tinta (propuesta "Tinta sólida", 2026-11-21): formas vectoriales
// en una retícula de 24, giradas en 3D con su costado de un solo negro. Las
// definiciones son las de la propuesta; las que Oscar dibuja en Illustrator
// (diseno/iconos-tinta/iconos-tinta.ai) llevan `ilustrador: true` y se pintan
// como allá (trazo centrado). Sin dependencias: devuelve el SVG como texto.

const TINTA = '#0a0510'
const R = 24
const estado = { grosor: 5, giro: 1 }
let cuentaRecortes = 0

function f(n) { return Math.round(n * 1000) / 1000; }
function circulo(cx, cy, r) {
  return 'M' + f(cx - r) + ' ' + f(cy) + 'a' + r + ' ' + r + ' 0 1 0 ' + f(2 * r) + ' 0a' + r + ' ' + r + ' 0 1 0 ' + f(-2 * r) + ' 0Z';
}
function elipse(cx, cy, rx, ry) {
  return 'M' + f(cx - rx) + ' ' + f(cy) + 'a' + rx + ' ' + ry + ' 0 1 0 ' + f(2 * rx) + ' 0a' + rx + ' ' + ry + ' 0 1 0 ' + f(-2 * rx) + ' 0Z';
}
function redondo(x, y, w, h, r) {
  return 'M' + f(x + r) + ' ' + y + 'H' + f(x + w - r) + 'A' + r + ' ' + r + ' 0 0 1 ' + f(x + w) + ' ' + f(y + r) +
    'V' + f(y + h - r) + 'A' + r + ' ' + r + ' 0 0 1 ' + f(x + w - r) + ' ' + f(y + h) +
    'H' + f(x + r) + 'A' + r + ' ' + r + ' 0 0 1 ' + x + ' ' + f(y + h - r) +
    'V' + f(y + r) + 'A' + r + ' ' + r + ' 0 0 1 ' + f(x + r) + ' ' + y + 'Z';
}
function dientesEngrane() {
  var d = '';
  for (var k = 0; k < 8; k++) {
    var a = k * Math.PI / 4 + Math.PI / 8;
    d += 'M' + f(12 + 6 * Math.cos(a)) + ' ' + f(12 + 6 * Math.sin(a)) + 'L' + f(12 + 9.3 * Math.cos(a)) + ' ' + f(12 + 9.3 * Math.sin(a));
  }
  return d;
}

var BOCINA ='M3 9.2C3 8.5 3.5 8 4.2 8H7L12 3.8C12.6 3.3 13.5 3.7 13.5 4.5V19.5C13.5 20.3 12.6 20.7 12 20.2L7 16H4.2C3.5 16 3 15.5 3 14.8Z';

/* Cada ícono son capas de atrás hacia adelante. Por capa:
   formas  rellenos (con hoyos por evenodd)
   trazos  líneas gruesas de cara blanca, { d, w } en unidades de 24
   tinta   rellenos de tinta encima de la cara
   lineas  trazos de tinta encima de la cara, { d, w }
   rejilla si las coordenadas no vienen en 24 (32 o 256): se escalan a 24 */
var ICONOS = {
  /* Skulley: el que Oscar ajustó en Illustrator (2026-11-21, mesa 1 de diseno/iconos-tinta/iconos-tinta.ai). */
  calavera: { n: 'Skulley', hoy: 'nuevo: la marca', ilustrador: true, capas: [
    { formas: ['M18.584 15.152c-0.205 0.798-0.64 1.52-1.189 2.129c-0.481 0.547-1.055 1.035-1.416 1.655c-0.399 0.666-0.588 1.115-1.103 1.711c-0.893 1.032-2.383 1.548-3.726 1.596c-1.725 0.061-3.787-0.636-4.529-2.317c-0.316-0.715-0.348-1.205-0.682-1.909c-0.387-0.81-1.053-1.46-1.365-2.304c-0.631-1.604-0.365-3.472 0.481-4.949C6.66 7.924 10.36 6.681 13.456 7.492c3.371 0.77 6.025 4.144 5.132 7.642L18.584 15.152z'],
      tinta: ['M6.66 14.67c0 0.492 0.398 0.89 0.89 0.89s0.89-0.398 0.89-0.89c0 0 0-0.001 0-0.001c0-0.492-0.398-0.89-0.89-0.89S6.66 14.178 6.66 14.67C6.66 14.669 6.66 14.67 6.66 14.67zM12.82 14.57c0 0.602 0.488 1.09 1.09 1.09S15 15.172 15 14.57S14.512 13.48 13.91 13.48S12.82 13.968 12.82 14.57zM9.806 16.225c0.423-0.084 0.812 0.579 0.928 0.92c0.177 0.55-0.179 0.829-0.668 0.848C9.681 18.022 9.175 17.965 9.031 17.65c-0.241-0.504 0.3-1.264 0.76-1.421L9.806 16.225z'],
      lineas: [{ d: 'M5.16 14.52c0 1.237 0.869 2.24 1.94 2.24s1.94-1.003 1.94-2.24S8.171 12.28 7.1 12.28S5.16 13.283 5.16 14.52L5.16 14.52zM11.09 14.42c0 1.342 1.061 2.43 2.37 2.43s2.37-1.088 2.37-2.43c0 0 0 0 0 0c0-1.342-1.061-2.43-2.37-2.43C12.151 11.99 11.09 13.078 11.09 14.42C11.09 14.42 11.09 14.42 11.09 14.42z', w: 0.3 }] },
    { formas: ['M16.497 8.985c-0.167-4.316-3.834-5.405-3.834-5.405l0.007 0.843c-1.773-0.732-3.41-0.743-3.41-0.743l0.111 1.819C8.239 4.83 6.66 5.183 6.66 5.183c0.054 4.324 3.216 5.79 3.216 5.79c0.968-2.596 4.45-3.751 6.621-1.911c0 0-0.001-0.029-0.006-0.081L16.497 8.985z'] }
  ] },
  casa: { n: 'Volver al inicio', hoy: 'HomeIcon', capas: [
    { formas: ['M11.2 3.1C11.7 2.7 12.3 2.7 12.8 3.1L21.5 10.6C22.1 11.1 21.7 12.1 20.9 12.1H19.6V19.8C19.6 20.7 18.9 21.4 18 21.4H14.6V15.8C14.6 15.3 14.2 14.9 13.7 14.9H10.3C9.8 14.9 9.4 15.3 9.4 15.8V21.4H6C5.1 21.4 4.4 20.7 4.4 19.8V12.1H3.1C2.3 12.1 1.9 11.1 2.5 10.6Z'] }
  ] },
  play: { n: 'Conocer la historia', hoy: 'PlayIcon', capas: [
    { formas: ['M6.5 4.4C6.5 3.2 7.8 2.5 8.8 3.1L19.9 10.4C20.8 11 20.8 12.4 19.9 13L8.8 20.3C7.8 20.9 6.5 20.2 6.5 19Z'] }
  ] },
  pausa: { n: 'Pausa', hoy: 'PauseIcon', capas: [
    { formas: [redondo(5, 3, 5.6, 18, 1.8), redondo(13.4, 3, 5.6, 18, 1.8)] }
  ] },
  control: { n: 'Experiencia completa', hoy: 'GamepadIcon', capas: [
    { formas: ['M7 6.4H17C20 6.4 22 8.9 22 12.4V15.4C22 17.9 20.6 19.4 18.8 19.4C17.6 19.4 16.8 18.7 16.2 17.7L15.4 16.4H8.6L7.8 17.7C7.2 18.7 6.4 19.4 5.2 19.4C3.4 19.4 2 17.9 2 15.4V12.4C2 8.9 4 6.4 7 6.4Z'],
      tinta: ['M7.6 9.2H9.6V10.9H11.3V12.9H9.6V14.6H7.6V12.9H5.9V10.9H7.6Z' + circulo(15.2, 12.9, 1.25) + circulo(17.9, 10.6, 1.25)] }
  ] },
  cuadricula: { n: 'Versión simple', hoy: 'Squares2X2Icon', capas: [
    { formas: [redondo(3, 3, 7.6, 7.6, 2.2), redondo(13.4, 3, 7.6, 7.6, 2.2), redondo(3, 13.4, 7.6, 7.6, 2.2), redondo(13.4, 13.4, 7.6, 7.6, 2.2)] }
  ] },
  nota: { n: 'Música', hoy: 'MusicalNoteIcon', capas: [
    { formas: ['M8 6.6L20 3.4V16.2H18.2V7.9L9.8 10.2V18.2H8Z', elipse(6.4, 18.2, 3.4, 2.7), elipse(16.6, 16.2, 3.4, 2.7)] }
  ] },
  bocina: { n: 'Sonido', hoy: 'SpeakerWaveIcon', capas: [
    { formas: [BOCINA], trazos: [{ d: 'M16.9 9.3C17.9 10.9 17.9 13.1 16.9 14.7', w: 2.2 }, { d: 'M19.7 6.7C21.9 9.9 21.9 14.1 19.7 17.3', w: 2.2 }] }
  ] },
  mudo: { n: 'Sin sonido', hoy: 'SpeakerXMarkIcon', capas: [
    { formas: [BOCINA], trazos: [{ d: 'M16.6 9.5L21.2 14.5M21.2 9.5L16.6 14.5', w: 2.4 }] }
  ] },
  usuario: { n: 'Mi cuenta', hoy: 'UserIcon', capas: [
    { formas: [circulo(12, 7.4, 4.4), 'M3.8 20.1C4.4 15.8 7.8 13.2 12 13.2C16.2 13.2 19.6 15.8 20.2 20.1C20.3 20.8 19.8 21.4 19.1 21.4H4.9C4.2 21.4 3.7 20.8 3.8 20.1Z'] }
  ] },
  carrito: { n: 'Carrito', hoy: 'ShoppingCartIcon', capas: [
    { formas: ['M6.4 6.2H20.8C21.5 6.2 22 6.9 21.8 7.5L20.1 13.1C19.9 13.8 19.3 14.2 18.6 14.2H8.1Z', circulo(9.4, 20, 1.9), circulo(17.8, 20, 1.9)],
      trazos: [{ d: 'M2.2 3.6H4.4C5 3.6 5.5 4 5.6 4.6L7.8 15.2C7.9 15.8 8.4 16.2 9 16.2H19.4', w: 2.1 }] }
  ] },
  menu: { n: 'Menú', hoy: 'Bars3Icon', capas: [
    { trazos: [{ d: 'M4.5 6H19.5M4.5 12H19.5M4.5 18H19.5', w: 3 }] }
  ] },
  cerrar: { n: 'Cerrar', hoy: 'XMarkIcon', capas: [
    { trazos: [{ d: 'M6 6L18 18M18 6L6 18', w: 3.6 }] }
  ] },
  atras: { n: 'Regresar', hoy: 'ArrowLeftIcon', capas: [
    { trazos: [{ d: 'M19.5 12H5.5M11.2 5.6L4.8 12L11.2 18.4', w: 3.4 }] }
  ] },
  playera: { n: 'Personalizar', hoy: 'PaintBrushIcon', capas: [
    { formas: ['M8.4 3C9 4.5 10.3 5.3 12 5.3C13.7 5.3 15 4.5 15.6 3L21.2 5.6C21.8 5.9 22 6.6 21.7 7.1L20 10.2C19.7 10.7 19.1 10.9 18.6 10.6L17.6 10.1V19.9C17.6 20.7 17 21.3 16.2 21.3H7.8C7 21.3 6.4 20.7 6.4 19.9V10.1L5.4 10.6C4.9 10.9 4.3 10.7 4 10.2L2.3 7.1C2 6.6 2.2 5.9 2.8 5.6Z'] }
  ] },
  lentes: { n: 'Props', hoy: 'LentesIcon', capas: [
    { trazos: [{ d: 'M10.4 9.6H13.6', w: 2.2 }] },
    { formas: ['M2.2 7.8H10.8V11.4C10.8 14.3 9.3 16.2 6.8 16.2C4.3 16.2 2.7 14.5 2.3 11.8Z', 'M13.2 7.8H21.8L21.7 11.8C21.3 14.5 19.7 16.2 17.2 16.2C14.7 16.2 13.2 14.3 13.2 11.4Z'],
      tinta: ['M3.9 9.4H9.2V11.4C9.2 13.4 8.3 14.6 6.8 14.6C5.3 14.6 4.3 13.6 4 11.7ZM14.8 9.4H20.1L20 11.7C19.7 13.6 18.7 14.6 17.2 14.6C15.7 14.6 14.8 13.4 14.8 11.4Z'] }
  ] },
  camara: { n: 'Foto de la historia', hoy: 'CameraIcon', capas: [
    { formas: ['M4.5 7H7.6L9 4.8C9.3 4.3 9.8 4 10.4 4H13.6C14.2 4 14.7 4.3 15 4.8L16.4 7H19.5C20.9 7 22 8.1 22 9.5V17.5C22 18.9 20.9 20 19.5 20H4.5C3.1 20 2 18.9 2 17.5V9.5C2 8.1 3.1 7 4.5 7Z' + circulo(12, 13.4, 4.4)] },
    { formas: [circulo(12, 13.4, 2.2)] }
  ] },
  pantalla: { n: 'Wallpaper 4K', hoy: 'ComputerDesktopIcon', capas: [
    { formas: ['M10 16H14L14.6 19.4H16.4C17 19.4 17.4 19.8 17.4 20.4C17.4 21 17 21.4 16.4 21.4H7.6C7 21.4 6.6 21 6.6 20.4C6.6 19.8 7 19.4 7.6 19.4H9.4Z'] },
    { formas: [redondo(2, 3.4, 20, 13.6, 2.2)], tinta: ['M5.2 6.6H18.8V13.8H5.2Z'] }
  ] },
  dado: { n: 'Al azar', hoy: 'DiceIcon', capas: [
    { formas: [redondo(3, 3, 18, 18, 3.6)], tinta: [circulo(7.9, 7.9, 1.75) + circulo(12, 12, 1.75) + circulo(16.1, 16.1, 1.75)] }
  ] },
  corazon: { n: 'Redes', hoy: 'HeartIcon', capas: [
    { formas: ['M12 21.2C7 17.6 2.5 14 2.5 8.9C2.5 5.9 4.8 3.6 7.6 3.6C9.4 3.6 11 4.5 12 6C13 4.5 14.6 3.6 16.4 3.6C19.2 3.6 21.5 5.9 21.5 8.9C21.5 14 17 17.6 12 21.2Z'] }
  ] },
  boleto: { n: 'Boletos', hoy: 'TicketIcon', capas: [
    { formas: ['M3.5 5H20.5C21.3 5 22 5.7 22 6.5V9.6C20.7 9.6 19.6 10.7 19.6 12C19.6 13.3 20.7 14.4 22 14.4V17.5C22 18.3 21.3 19 20.5 19H3.5C2.7 19 2 18.3 2 17.5V14.4C3.3 14.4 4.4 13.3 4.4 12C4.4 10.7 3.3 9.6 2 9.6V6.5C2 5.7 2.7 5 3.5 5Z'],
      lineas: [{ d: 'M15.6 7.2V8.6M15.6 11.3V12.7M15.6 15.4V16.8', w: 1.5 }] }
  ] },
  engrane: { n: 'Ajustes', hoy: 'Cog6ToothIcon', capas: [
    { formas: [circulo(12, 12, 7.3) + circulo(12, 12, 2.9)], trazos: [{ d: dientesEngrane(), w: 3.8 }] }
  ] },
  rayo: { n: 'Poder', hoy: 'BoltIcon', capas: [
    { formas: ['M13.6 2L4.6 13.4C4.2 13.9 4.6 14.6 5.2 14.6H10.6L9.4 21.4C9.3 22 10 22.3 10.4 21.8L19.4 10.4C19.8 9.9 19.4 9.2 18.8 9.2H13.4L14.6 2.6C14.7 2 14 1.7 13.6 2Z'] }
  ] },
  reiniciar: { n: 'Reiniciar', hoy: 'ArrowPathIcon', capas: [
    { trazos: [{ d: 'M19 12A7 7 0 1 1 12 5', w: 2.8 }], formas: ['M11.2 1.4L17.2 5L11.2 8.6Z'] }
  ] },
  info: { n: 'Controles', hoy: 'InformationCircleIcon', capas: [
    { formas: [circulo(12, 12, 9.8)], tinta: [circulo(12, 7.4, 1.6) + redondo(10.5, 10.4, 3, 8, 1.4)] }
  ] },
  chispa: { n: 'Skin dorada', hoy: 'SparklesIcon', capas: [
    { formas: ['M12 2C12.9 7.6 16.4 11.1 22 12C16.4 12.9 12.9 16.4 12 22C11.1 16.4 7.6 12.9 2 12C7.6 11.1 11.1 7.6 12 2Z'] }
  ] },
  mundo: { n: 'Idioma', hoy: 'hoy solo texto (ESP / ENG)', capas: [
    { formas: [circulo(12, 12, 10)], lineas: [{ d: 'M12 2a4.3 10 0 1 0 0 20a4.3 10 0 1 0 0-20ZM2 12H22M3.34 7H20.66M3.34 17H20.66', w: 1.4 }] }
  ] },
  estrella: { n: 'Work', hoy: 'hoy solo texto', capas: [
    { formas: ['M12 2.6L14.704 8.879L21.511 9.51L16.375 14.021L17.878 20.69L12 17.2L6.122 20.69L7.625 14.021L2.489 9.51L9.296 8.879Z'] }
  ] },
  sonrisa: { n: 'About', hoy: 'hoy solo texto', capas: [
    { formas: [circulo(12, 12, 9.6)], tinta: [elipse(9, 9.8, 1.2, 1.9) + elipse(15, 9.8, 1.2, 1.9)], lineas: [{ d: 'M7.6 14C9 16.9 15 16.9 16.4 14', w: 1.8 }] }
  ] },
  bolsa: { n: 'Store', hoy: 'hoy solo texto', capas: [
    { trazos: [{ d: 'M8.6 9V6.6C8.6 4.6 10.1 3.1 12 3.1C13.9 3.1 15.4 4.6 15.4 6.6V9', w: 2.2 }] },
    { formas: ['M5.2 7.6H18.8C19.4 7.6 19.9 8 20 8.6L21 19.4C21.1 20.5 20.2 21.4 19.1 21.4H4.9C3.8 21.4 2.9 20.5 3 19.4L4 8.6C4.1 8 4.6 7.6 5.2 7.6Z'] }
  ] },
  globo: { n: 'Contact', hoy: 'hoy solo texto', capas: [
    { formas: ['M6 3.5H18C20 3.5 21.5 5 21.5 7V13C21.5 15 20 16.5 18 16.5H10.8L6.2 20.6C5.8 21 5.2 20.7 5.2 20.2V16.5C3.6 16.2 2.5 14.8 2.5 13V7C2.5 5 4 3.5 6 3.5Z'] }
  ] },
  lapiz: { n: 'Blog', hoy: 'hoy solo texto', capas: [
    { formas: ['M15.732 4.732L17.5 2.964C17.9 2.56 18.6 2.56 19 2.964L21.036 5C21.44 5.4 21.44 6.1 21.036 6.5L19.268 8.268Z'] },
    { formas: ['M7.268 20.268L3.025 20.975L3.732 16.732L15.732 4.732L19.268 8.268Z'],
      tinta: ['M3.025 20.975L4.6 20.7L3.3 19.4Z'],
      lineas: [{ d: 'M7.268 20.268L3.732 16.732', w: 1.2 }] }
  ] },
  x: { n: 'X', hoy: 'footer, hoy solo texto', capas: [
    { formas: ['M2.333 2L8.5 2L13.155 9.072L19.167 2L21.833 2L14.32 10.84L21.667 22L15.5 22L10.845 14.928L4.833 22L2.167 22L9.68 13.16Z'] }
  ] },
  instagram: { n: 'Instagram', hoy: 'footer, hoy solo texto', capas: [
    { formas: [redondo(2, 2, 20, 20, 5.6) + circulo(12, 12, 4.8) + circulo(16.9, 7.1, 1.4)] }
  ] },
  linkedin: { n: 'LinkedIn', hoy: 'footer, hoy solo texto', capas: [
    { formas: [redondo(2, 2, 20, 20, 4.3) + 'M5.167 10H8V19H5.167Z' + circulo(6.583, 6.75, 1.75) +
      'M10.167 10H13V11.333C13.833 10.333 15 9.667 16.5 9.667C18.333 9.667 19.167 11 19.167 13.333V19H16.167V14C16.167 12.833 15.667 12.167 14.667 12.167C13.667 12.167 13.167 13 13.167 14.167V19H10.167Z'] }
  ] },

  behance: { n: 'Behance', hoy: 'behance.svg', capas: [
    { formas: ['M2 6H8.2C10.4 6 11.8 7.1 11.8 8.9C11.8 10 11.2 10.8 10.3 11.2C11.6 11.6 12.4 12.6 12.4 14C12.4 16.2 10.8 17.6 8.3 17.6H2ZM4.8 8.3V10.4H7.8C8.6 10.4 9 10 9 9.3C9 8.7 8.6 8.3 7.8 8.3ZM4.8 12.5V15.3H8C8.9 15.3 9.4 14.8 9.4 13.9C9.4 13 8.9 12.5 8 12.5Z',
      'M18.1 9.4C20.6 9.4 22.1 11.2 22.1 13.9V14.6H16.3C16.4 15.6 17.1 16.2 18.2 16.2C19 16.2 19.5 15.9 19.8 15.4H22C21.5 17 20.1 18 18.2 18C15.6 18 13.9 16.3 13.9 13.7C13.9 11.1 15.6 9.4 18.1 9.4ZM16.3 13H19.8C19.7 12 19.1 11.3 18.1 11.3C17.1 11.3 16.5 12 16.3 13Z',
      redondo(15.4, 6.4, 5.4, 1.8, 0.7)] }
  ] },

  /* Fase 1, lo que faltaba (2026-11-22): el resto de los íconos del sitio. */
  chevronDer: { n: 'Siguiente', hoy: 'ChevronRightIcon', capas: [{ trazos: [{ d: 'M9 4.5L16.5 12L9 19.5', w: 3.4 }] }] },
  chevronIzq: { n: 'Anterior', hoy: 'ChevronLeftIcon', capas: [{ trazos: [{ d: 'M15 4.5L7.5 12L15 19.5', w: 3.4 }] }] },
  chevronAbajo: { n: 'Abajo', hoy: 'ChevronDownIcon', capas: [{ trazos: [{ d: 'M4.5 8.5L12 16L19.5 8.5', w: 3.4 }] }] },
  mas: { n: 'Más', hoy: 'PlusIcon', capas: [{ trazos: [{ d: 'M12 4.5V19.5M4.5 12H19.5', w: 3.6 }] }] },
  menos: { n: 'Menos', hoy: 'MinusIcon', capas: [{ trazos: [{ d: 'M4.5 12H19.5', w: 3.6 }] }] },
  palomita: { n: 'Listo', hoy: 'CheckIcon', capas: [{ trazos: [{ d: 'M4.5 12.6L9.6 17.6L19.5 6.6', w: 3.6 }] }] },
  palomitaCirculo: { n: 'Hecho', hoy: 'CheckCircleIcon', capas: [
    { formas: [circulo(12, 12, 9.8)] },
    { trazos: [{ d: 'M7.4 12.4L10.6 15.5L16.8 8.8', w: 2.8 }] }
  ] },
  descargar: { n: 'Descargar', hoy: 'ArrowDownTrayIcon', capas: [
    { trazos: [{ d: 'M3.6 15.2V18.4C3.6 19.5 4.5 20.4 5.6 20.4H18.4C19.5 20.4 20.4 19.5 20.4 18.4V15.2', w: 3 }] },
    { trazos: [{ d: 'M12 3.4V14.4M7 9.6L12 14.6L17 9.6', w: 3 }] }
  ] },
  candado: { n: 'Bloqueado', hoy: 'LockClosedIcon', capas: [
    { trazos: [{ d: 'M7.6 10.6V7.8C7.6 5.3 9.6 3.4 12 3.4C14.4 3.4 16.4 5.3 16.4 7.8V10.6', w: 2.6 }] },
    { formas: [redondo(4, 10, 16, 11.4, 2.4)], tinta: [circulo(12, 14.4, 1.7) + 'M11.1 15H12.9L13.3 18.2H10.7Z'] }
  ] },
  adelante: { n: 'Adelantar', hoy: 'ForwardIcon', capas: [
    { formas: ['M2.8 5.8C2.8 4.9 3.8 4.4 4.5 4.9L12.3 10.8C12.9 11.3 12.9 12.7 12.3 13.2L4.5 19.1C3.8 19.6 2.8 19.1 2.8 18.2Z'] },
    { formas: ['M11.8 5.8C11.8 4.9 12.8 4.4 13.5 4.9L21.3 10.8C21.9 11.3 21.9 12.7 21.3 13.2L13.5 19.1C12.8 19.6 11.8 19.1 11.8 18.2Z'] }
  ] },
  retroceder: { n: 'Regresar', hoy: 'BackwardIcon', capas: [
    { formas: ['M21.2 5.8C21.2 4.9 20.2 4.4 19.5 4.9L11.7 10.8C11.1 11.3 11.1 12.7 11.7 13.2L19.5 19.1C20.2 19.6 21.2 19.1 21.2 18.2Z'] },
    { formas: ['M12.2 5.8C12.2 4.9 11.2 4.4 10.5 4.9L2.7 10.8C2.1 11.3 2.1 12.7 2.7 13.2L10.5 19.1C11.2 19.6 12.2 19.1 12.2 18.2Z'] }
  ] },
  detener: { n: 'Detener', hoy: 'StopIcon', capas: [{ formas: [redondo(4.6, 4.6, 14.8, 14.8, 2.6)] }] },
  pausaCirculo: { n: 'En pausa', hoy: 'PauseCircleIcon', capas: [
    { formas: [circulo(12, 12, 9.8)], tinta: [redondo(8.4, 7.4, 2.6, 9.2, 0.9) + redondo(13, 7.4, 2.6, 9.2, 0.9)] }
  ] },
  reloj: { n: 'Tiempo', hoy: 'ClockIcon', capas: [
    { formas: [circulo(12, 12, 9.8)], tinta: ['M11.1 6.4H12.9V11.5L16.2 13.5L15.3 15L11.1 12.5Z'] }
  ] },
  pregunta: { n: 'Ayuda', hoy: 'QuestionMarkCircleIcon', capas: [
    { formas: [circulo(12, 12, 9.8)],
      tinta: ['M8.8 9.3C8.8 7.3 10.2 6 12.1 6C14 6 15.4 7.3 15.4 9C15.4 10.4 14.6 11.2 13.5 11.8C12.9 12.2 12.8 12.5 12.8 13.1V13.7H11V12.9C11 11.7 11.5 11 12.5 10.4C13.3 9.9 13.6 9.6 13.6 9C13.6 8.2 13 7.7 12.1 7.7C11.2 7.7 10.6 8.3 10.6 9.3Z' + circulo(11.9, 16.5, 1.25)] }
  ] },
  video: { n: 'Cámara', hoy: 'VideoCameraIcon', capas: [
    { formas: [redondo(2, 6, 13.6, 12, 2.4), 'M16.6 10.2L21 7.5C21.5 7.2 22 7.5 22 8.1V15.9C22 16.5 21.5 16.8 21 16.5L16.6 13.8Z'] }
  ] },
  basura: { n: 'Quitar', hoy: 'TrashIcon', capas: [
    { trazos: [{ d: 'M3.6 6.2H20.4', w: 2.6 }, { d: 'M9 5.6V4.4C9 3.8 9.4 3.4 10 3.4H14C14.6 3.4 15 3.8 15 4.4V5.6', w: 2.2 }] },
    { formas: ['M5.4 8.6H18.6L17.6 19.6C17.5 20.6 16.7 21.4 15.7 21.4H8.3C7.3 21.4 6.5 20.6 6.4 19.6Z'],
      tinta: [redondo(9.2, 11, 1.6, 7.6, 0.8) + redondo(13.2, 11, 1.6, 7.6, 0.8)] }
  ] },
  enlace: { n: 'Copiar enlace', hoy: 'LinkIcon', capas: [
    { trazos: [{ d: 'M11.2 6.9L13 5.1C14.8 3.3 17.6 3.3 19.3 5.1C21.1 6.8 21.1 9.6 19.3 11.4L17.5 13.2', w: 2.8 },
      { d: 'M12.8 17.1L11 18.9C9.2 20.7 6.4 20.7 4.7 18.9C2.9 17.2 2.9 14.4 4.7 12.6L6.5 10.8', w: 2.8 }] },
    { trazos: [{ d: 'M9.2 14.8L14.8 9.2', w: 2.8 }] }
  ] },
  externo: { n: 'Abrir aparte', hoy: 'ArrowTopRightOnSquareIcon', capas: [
    { trazos: [{ d: 'M10.4 5.4H6.4C5.3 5.4 4.4 6.3 4.4 7.4V17.6C4.4 18.7 5.3 19.6 6.4 19.6H16.6C17.7 19.6 18.6 18.7 18.6 17.6V13.6', w: 2.6 }] },
    { trazos: [{ d: 'M11 13L19.8 4.2M14 4.2H19.8V10', w: 2.8 }] }
  ] },
  compartir: { n: 'Compartir', hoy: 'ShareIcon', capas: [
    { trazos: [{ d: 'M8.2 10.8L15.8 6.8M8.2 13.2L15.8 17.2', w: 2.4 }] },
    { formas: [circulo(6, 12, 3.3), circulo(18, 5.6, 3.3), circulo(18, 18.4, 3.3)] }
  ] },
  trofeo: { n: 'Récord', hoy: 'TrophyIcon', capas: [
    { trazos: [{ d: 'M7 5.8H5.4C4.2 5.8 3.5 6.7 3.7 7.8C4 9.6 5.4 10.8 7.3 11M17 5.8H18.6C19.8 5.8 20.5 6.7 20.3 7.8C20 9.6 18.6 10.8 16.7 11', w: 2 }] },
    { formas: ['M7 3.4H17V9.4C17 12.2 14.8 14.4 12 14.4C9.2 14.4 7 12.2 7 9.4Z', 'M10.6 13.6H13.4V17.6H10.6Z', redondo(6.8, 17.2, 10.4, 4, 1.4)] }
  ] },
  lista: { n: 'Lista', hoy: 'QueueListIcon', capas: [
    { formas: [redondo(3, 3.4, 18, 6, 1.8)], trazos: [{ d: 'M4.4 13.4H19.6M4.4 18.6H19.6', w: 2.8 }] }
  ] },
  intercambiar: { n: 'Aleatorio', hoy: 'ArrowsRightLeftIcon', capas: [
    { trazos: [{ d: 'M20 16.2H5M8.4 12.8L5 16.2L8.4 19.6', w: 2.6 }] },
    { trazos: [{ d: 'M4 7.8H19M15.6 4.4L19 7.8L15.6 11.2', w: 2.6 }] }
  ] },
  encoger: { n: 'Achicar', hoy: 'ArrowsPointingInIcon', capas: [
    { trazos: [{ d: 'M4 4L9.4 9.4M9.4 4.8V9.4H4.8M20 4L14.6 9.4M14.6 4.8V9.4H19.2M4 20L9.4 14.6M4.8 14.6H9.4V19.2M20 20L14.6 14.6M19.2 14.6H14.6V19.2', w: 2.4 }] }
  ] },
  deshacer: { n: 'Deshacer', hoy: 'ArrowUturnLeftIcon', capas: [
    { trazos: [{ d: 'M8.8 14.4L4.4 10L8.8 5.6M5 10H14.4C17.4 10 19.6 12.2 19.6 15C19.6 17.8 17.4 20 14.4 20H11', w: 2.8 }] }
  ] },
  salir: { n: 'Cerrar sesión', hoy: 'ArrowRightOnRectangleIcon', capas: [
    { trazos: [{ d: 'M13.4 4.4H6.4C5.3 4.4 4.4 5.3 4.4 6.4V17.6C4.4 18.7 5.3 19.6 6.4 19.6H13.4', w: 2.6 }] },
    { trazos: [{ d: 'M9.6 12H20.4M16.8 8.2L20.6 12L16.8 15.8', w: 2.8 }] }
  ] },
  mira: { n: 'Centrar', hoy: 'ViewfinderCircleIcon', capas: [
    { trazos: [{ d: 'M3.6 8.6V5.6C3.6 4.5 4.5 3.6 5.6 3.6H8.6M15.4 3.6H18.4C19.5 3.6 20.4 4.5 20.4 5.6V8.6M20.4 15.4V18.4C20.4 19.5 19.5 20.4 18.4 20.4H15.4M8.6 20.4H5.6C4.5 20.4 3.6 19.5 3.6 18.4V15.4', w: 2.6 }],
      formas: [circulo(12, 12, 3.8)] }
  ] },
  lupa: { n: 'Buscar', hoy: 'MagnifyingGlassIcon', capas: [
    { trazos: [{ d: 'M15.4 15.4L20.6 20.6', w: 3.4 }] },
    { formas: [circulo(10.2, 10.2, 7.2) + circulo(10.2, 10.2, 4.2)] }
  ] },
  lupaMas: { n: 'Acercar', hoy: 'MagnifyingGlassPlusIcon', capas: [
    { trazos: [{ d: 'M15.4 15.4L20.6 20.6', w: 3.4 }] },
    { formas: [circulo(10.2, 10.2, 7.4)], tinta: ['M9.3 6.6H11.1V9.3H13.8V11.1H11.1V13.8H9.3V11.1H6.6V9.3H9.3Z'] }
  ] },
  mano: { n: 'Mover', hoy: 'HandRaisedIcon', capas: [
    { formas: [redondo(6.4, 6.2, 2.8, 8.8, 1.4), redondo(9.5, 3, 2.8, 10, 1.4), redondo(12.6, 3.6, 2.8, 9.6, 1.4), redondo(15.7, 5.6, 2.8, 8.6, 1.4),
      'M6.4 11.2H18.5V15.4C18.5 19 16 21.6 12.4 21.6C9.7 21.6 7.8 20.3 6.8 18L4 12.8C3.5 12 3.8 11.1 4.6 10.8C5.3 10.5 6 10.8 6.4 11.4Z'] }
  ] },
  telefono: { n: 'Teléfono', hoy: 'DevicePhoneMobileIcon', capas: [
    { formas: [redondo(6, 2, 12, 20, 2.6)], tinta: [redondo(9.8, 17.6, 4.4, 1.7, 0.85)] }
  ] },
  /* Los de las prendas y las partes del cuerpo: las mismas siluetas de antes
     (retícula de 32), ya aprobadas, ahora en tinta. */
  patada: { n: 'Patada', hoy: 'KickIcon (Phosphor sneaker-move)', rejilla: 256, capas: [
    { formas: ['M70.8,184H32a8,8,0,0,1,0-16H70.8a8,8,0,1,1,0,16Zm32,16H48a8,8,0,0,0,0,16h54.8a8,8,0,1,0,0-16Zm128.36-33.37-28.63-14.31A47.74,47.74,0,0,1,176,109.39V80a8,8,0,0,0-7.93-8A48.05,48.05,0,0,1,120,24.07a8,8,0,0,0-12.83-6.44L45.11,64.68a4,4,0,0,0-.41,6l51.44,51.44a8.19,8.19,0,0,1,.6,11.09,8,8,0,0,1-11.71.43l-53-53a4,4,0,0,0-6.44,1.09,16,16,0,0,0,3.12,18.22L142.4,213.66a8,8,0,0,0,5.66,2.34H224a16,16,0,0,0,16-16V180.94A15.92,15.92,0,0,0,231.16,166.63Z'] }
  ] },
  lentes3d: { n: 'Lentes 3D', hoy: 'Lentes3DIcon', rejilla: 32, capas: [
    { formas: ['M3.6 9h24.8c.9 0 1.6.7 1.6 1.6v9.8c0 .9-.7 1.6-1.6 1.6h-8.6l-1-3.4c-.3-1-1.3-1.7-2.4-1.7h-.8c-1.1 0-2.1.7-2.4 1.7l-1 3.4H3.6c-.9 0-1.6-.7-1.6-1.6v-9.8C2 9.7 2.7 9 3.6 9zM4.6 11.4h7.6c.4 0 .8.4.8.8v4.6l-.9 2.8H4.6c-.4 0-.8-.4-.8-.8v-6.6c0-.4.4-.8.8-.8zM27.4 11.4h-7.6c-.4 0-.8.4-.8.8v4.6l.9 2.8h7.5c.4 0 .8-.4.8-.8v-6.6c0-.4-.4-.8-.8-.8z'],
      tinta: ['M27.4 11.4h-7.6c-.4 0-.8.4-.8.8v4.6l.9 2.8h7.5c.4 0 .8-.4.8-.8v-6.6c0-.4-.4-.8-.8-.8z'] }
  ] },
  boxers: { n: 'Bóxers', hoy: 'BoxersIcon', rejilla: 32, capas: [
    { formas: ['M5.2 6.5h21.6c.7 0 1.2.5 1.2 1.2v1.9c0 .7-.5 1.2-1.2 1.2H5.2c-.7 0-1.2-.5-1.2-1.2V7.7c0-.7.5-1.2 1.2-1.2z'] },
    { formas: ['M4.7 12h22.6l1.4 11.4c.1.7-.4 1.3-1.1 1.4l-9.4.8c-.6.1-1.2-.4-1.3-1L16 17.2l-.9 7.4c-.1.6-.7 1.1-1.3 1l-9.4-.8c-.7-.1-1.2-.7-1.1-1.4z'],
      tinta: ['M9.6 20.6l2.3-2.2c.6-.6.6-1.5 0-2-.5-.5-1.4-.5-1.9 0l-.4.4-.4-.4c-.5-.5-1.4-.5-1.9 0-.6.5-.6 1.4 0 2z'] }
  ] },
  chamarra: { n: 'Chamarra', hoy: 'ChamarraIcon', rejilla: 32, capas: [
    { formas: ['M5.6 7.9l.7-2.9 1.4 2.3zM8.4 6.8l.6-2.9 1.5 2.2zM11.1 5.9l.5-2.9 1.6 2.1zM26.4 7.9l-.7-2.9-1.4 2.3zM23.6 6.8l-.6-2.9-1.5 2.2zM20.9 5.9l-.5-2.9-1.6 2.1z'] },
    { formas: ['M8.6 6.2L12.6 5 16 10.5 19.4 5l4 1.2 4.2 2.4c.7.4 1.1 1 1.2 1.8L30 23.6c.1.8-.4 1.4-1.2 1.5l-2.2.3c-.7.1-1.3-.4-1.4-1.1L24 14.5v11.9c0 .7-.6 1.2-1.2 1.2H9.2c-.6 0-1.2-.5-1.2-1.2V14.5l-1.2 9.8c-.1.7-.7 1.2-1.4 1.1l-2.2-.3c-.8-.1-1.3-.7-1.2-1.5l1.2-13.2c.1-.8.5-1.4 1.2-1.8z'],
      tinta: ['M15.2 12h1.6v15.6h-1.6z'] }
  ] },
  hoodie: { n: 'Hoodie', hoy: 'HoodieIcon', rejilla: 32, capas: [
    { formas: ['M11 6.6C11.6 4.4 13.6 3 16 3s4.4 1.4 5 3.6l2.6.8 4 2.2c.7.4 1.1 1 1.2 1.8L30 23.6c.1.8-.4 1.4-1.2 1.5l-2.2.3c-.7.1-1.3-.4-1.4-1.1L24 14.5v11.9c0 .7-.6 1.2-1.2 1.2H9.2c-.6 0-1.2-.5-1.2-1.2V14.5l-1.2 9.8c-.1.7-.7 1.2-1.4 1.1l-2.2-.3c-.8-.1-1.3-.7-1.2-1.5l1.2-13.2c.1-.8.5-1.4 1.2-1.8l4-2.2z'],
      tinta: ['M13.2 7.4C13.6 5.8 14.7 5 16 5s2.4.8 2.8 2.4L16 10.2zM14 10.6h1v4.6h-1zM17 10.6h1v4.6h-1zM8 24.2h16v.9H8z'] }
  ] },
  tenis: { n: 'Tenis', hoy: 'TenisIcon', rejilla: 32, capas: [
    { formas: ['M5 22V6.4C5 5.6 5.6 5 6.4 5h6.2c.8 0 1.4.6 1.4 1.4v5l4 2.6 7.2 2.4c2.3.8 3.8 2.9 3.8 5.3V22z'],
      tinta: ['M15.2 12.4h1.6v1.4h-1.6zM17.8 14.2h1.6v1.4h-1.6zM20.4 16h1.6v1.4h-1.6z'] },
    { formas: ['M3 23.2h26c.6 0 1 .4 1 1v1.4c0 1.3-1.1 2.4-2.4 2.4H4.4C3.1 28 2 26.9 2 25.6v-1.4c0-.6.4-1 1-1z'], tinta: ['M4 25.2v.9h24v-.9z'] }
  ] },
  inflada: { n: 'Inflada', hoy: 'InfladaIcon', rejilla: 32, capas: [
    { formas: ['M4.4 9.4L1.7 9.9l2.3 1.6zM3.9 13.4l-2.6.5 2.2 1.6zM3.4 17.4l-2.4.6 2.1 1.4zM27.6 9.4l2.7.5-2.3 1.6zM28.1 13.4l2.6.5-2.2 1.6zM28.6 17.4l2.4.6-2.1 1.4z'] },
    { formas: ['M8.6 6.6L12 5.4c1 1.2 2.4 1.8 4 1.8s3-.6 4-1.8l3.4 1.2 4.2 2.4c.7.4 1.1 1 1.2 1.8L30 23.6c.1.8-.4 1.4-1.2 1.5l-2.2.3c-.7.1-1.3-.4-1.4-1.1L24 14.5v11.9c0 .7-.6 1.2-1.2 1.2H9.2c-.6 0-1.2-.5-1.2-1.2V14.5l-1.2 9.8c-.1.7-.7 1.2-1.4 1.1l-2.2-.3c-.8-.1-1.3-.7-1.2-1.5l1.2-13.2c.1-.8.5-1.4 1.2-1.8z'],
      tinta: ['M15.6 8.4h.8v19.2h-.8zM8 12.6h7v.8H8zM17 12.6h7v.8h-7zM8 17h7v.8H8zM17 17h7v.8h-7zM8 21.4h7v.8H8zM17 21.4h7v.8h-7z'] },
    { formas: ['M11.4 4.6c1 1.5 2.7 2.4 4.6 2.4s3.6-.9 4.6-2.4l1.3.6c-1.3 2.1-3.4 3.3-5.9 3.3s-4.6-1.2-5.9-3.3z'] }
  ] },
  botas: { n: 'Botas', hoy: 'BotasIcon', rejilla: 32, capas: [
    { formas: ['M7 21.6V5.2C7 4.5 7.5 4 8.2 4h6.2c.7 0 1.2.5 1.2 1.2v8.2l5.2 2.4 6.8 3c1 .5 1.6 1.4 1.6 2.5v.3z'] },
    { formas: ['M3.6 22.8h26.6c.5 0 .8.5.6 1l-1.2 2.6c-.5 1-1.5 1.6-2.6 1.6H5c-1.1 0-2-.9-2-2v-2.6c0-.3.3-.6.6-.6z'], tinta: ['M4.6 25h23.6v.8H4.6z'] },
    { formas: ['M5.6 8.6h11.6v3.2H5.6z', 'M15.2 13.4l2.4-1.3 3.8 6.6-2.4 1.3z'], tinta: ['M12.8 9.5h2.2v1.4h-2.2z'] }
  ] },
  pantalones: { n: 'Pantalones', hoy: 'PantalonesIcon', rejilla: 32, capas: [
    { formas: ['M8.6 3h14.8c.4 0 .7.3.7.7v2.6c0 .4-.3.7-.7.7H8.6c-.4 0-.7-.3-.7-.7V3.7c0-.4.3-.7.7-.7z'], tinta: [circulo(16, 5, 0.9)] },
    { formas: ['M8 7.8h16l1.5 17.2h-6.3L16 12.6 12.8 25H6.5z'], tinta: ['M9.2 16c.6-.8 2.8-.8 3.4 0-.6.8-2.8.8-3.4 0zM19.4 16c.6-.8 2.8-.8 3.4 0-.6.8-2.8.8-3.4 0z'] },
    { formas: ['M6.2 25.6h6.8v2.6c0 .4-.3.7-.7.7H6.9c-.4 0-.7-.3-.7-.7zM19 25.6h6.8v2.6c0 .4-.3.7-.7.7h-5.4c-.4 0-.7-.3-.7-.7z'] }
  ] },
  munequeras: { n: 'Muñequeras', hoy: 'MunequerasIcon', rejilla: 32, capas: [
    { formas: ['M23.8 18.1L29.3 12.7 21.7 12.2zM21.9 12.4L22 4.7 16.2 9.8zM16.5 9.8L11.1 4.3 10.6 11.9zM10.8 11.7L3.1 11.6 8.2 17.4zM8.2 17.1L2.7 22.5 10.3 23z'] },
    { formas: ['M16 9.2a8.4 8.4 0 1 0 0 16.8a8.4 8.4 0 1 0 0-16.8zM16 12.7a4.9 4.9 0 1 1 0 9.8a4.9 4.9 0 1 1 0-9.8z'] }
  ] },
  beanie: { n: 'Beanie', hoy: 'BeanieIcon', rejilla: 32, capas: [
    { formas: ['M6.4 17.6C6.4 10.4 10.4 5 16.6 5c4.8 0 8.6 2.4 11 6.2 1.6 2.6 1.4 5.2-.4 6.4z'] },
    { formas: ['M5.4 18.8h21.2c.8 0 1.4.6 1.4 1.4v4.4c0 .8-.6 1.4-1.4 1.4H5.4c-.8 0-1.4-.6-1.4-1.4v-4.4c0-.8.6-1.4 1.4-1.4z'],
      tinta: ['M7.6 20.2h.9v4.4h-.9zM10.2 20.2h.9v4.4h-.9zM12.8 20.2h.9v4.4h-.9zM15.4 20.2h.9v4.4h-.9zM18.4 20.6h5.4v3.4h-5.4z'] }
  ] },
  torso: { n: 'Torso', hoy: 'TorsoIcon', rejilla: 32, capas: [
    { formas: ['M11 4.5L4.6 7.4 2 13.6l4.5 2L8 14.2v12.3c0 .6.4 1 1 1h14c.6 0 1-.4 1-1V14.2l1.5 1.4 4.5-2-2.6-6.2L21 4.5c-.6 1.8-2.6 3-5 3s-4.4-1.2-5-3z'] }
  ] },
  munecas: { n: 'Muñecas', hoy: 'MunecasIcon', rejilla: 32, capas: [
    { formas: ['M12.5 3h7l.8 6.2A7 7 0 0 1 23 15a7 7 0 0 1-2.7 5.8L19.5 29h-7l-.8-8.2A7 7 0 0 1 9 15a7 7 0 0 1 2.7-5.8z'] },
    { formas: [circulo(16, 15, 4.6)], tinta: ['M15.4 12h1.2v3.3l2.2 1.3-.6 1-2.8-1.6z'] }
  ] },
  piernas: { n: 'Piernas', hoy: 'PiernasIcon', rejilla: 32, capas: [
    { formas: ['M8.6 3h14.8c.5 0 .9.4 1 .9l2 23.9c0 .6-.4 1.2-1 1.2h-5c-.5 0-.9-.3-1-.8L16 13.6l-3.4 14.6c-.1.5-.5.8-1 .8h-5c-.6 0-1-.6-1-1.2l2-23.9c.1-.5.5-.9 1-.9z'] }
  ] },
  pies: { n: 'Pies', hoy: 'PiesIcon', rejilla: 32, capas: [
    { formas: ['M9 5h6c.6 0 1 .4 1 1v8.4l8.3 3c2.2.8 3.7 2.9 3.7 5.2V24H4v-2.6c0-1 .3-2 .9-2.8L8 14.2V6c0-.6.4-1 1-1z'] },
    { formas: ['M4 25.4h24V27c0 .6-.4 1-1 1H5c-.6 0-1-.4-1-1z'] }
  ] }
};


/* La pose: cada ícono es una placa que mira un poco hacia arriba a la
   izquierda (giro y cabeceo) con un ladeo propio. Proyección paralela, así
   que la cara es una transformación afín y el costado es la normal de la
   placa proyectada: siempre cae abajo a la derecha. Cada ícono saca su
   variación de su nombre, para que no se vean todos iguales. */
function hash(s) {
  var h = 2166136261;
  for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function poseDe(nombre, giro) {
  var h = hash(nombre || '');
  var a = ((h & 255) / 255) * 2 - 1;
  var b = (((h >>> 8) & 255) / 255) * 2 - 1;
  var c = (((h >>> 16) & 255) / 255) * 2 - 1;
  var fija = ICONOS[nombre] && ICONOS[nombre].pose;
  if (fija) return { giro: fija.giro * giro, cabeceo: fija.cabeceo * giro, ladeo: fija.ladeo * giro };
  return { giro: (28 + 7 * a) * giro, cabeceo: (20 + 5 * b) * giro, ladeo: 8 * c * giro };
}
function medidas(tam, o, nombre) {
  var giro = o.giro != null ? o.giro : estado.giro;
  var grosor = o.grosor != null ? o.grosor : estado.grosor;
  var p = poseDe(nombre, giro);
  var th = -p.giro * Math.PI / 180, ph = p.cabeceo * Math.PI / 180, r = p.ladeo * Math.PI / 180;
  var a11 = Math.cos(th), a21 = Math.sin(th) * Math.sin(ph), a22 = Math.cos(ph);
  var cr = Math.cos(r), sr = Math.sin(r);
  var M = { a: a11 * cr, b: a21 * cr + a22 * sr, c: -a11 * sr, d: -a21 * sr + a22 * cr };
  var ex = grosor * -Math.sin(th), ey = grosor * Math.cos(th) * Math.sin(ph);
  var pad = 1.4;
  var C = R + pad * 2 + Math.max(ex, ey);
  var porU = tam / C;
  var escala = Math.sqrt(Math.abs(M.a * M.d - M.b * M.c)) || 1;
  var W = Math.min(3.8, Math.max(1, tam * 0.022)) / porU;
  return {
    pad: pad, C: C, W: W, Wcara: W / escala, ex: ex, ey: ey,
    cara: 'translate(' + f(C / 2 - ex / 2) + ' ' + f(C / 2 - ey / 2) + ') matrix(' + f(M.a) + ' ' + f(M.b) + ' ' + f(M.c) + ' ' + f(M.d) + ' 0 0) translate(-12 -12)'
  };
}

/* Una capa en tinta: la cara engordada W hacia afuera. */
function capaEnTinta(capa, W) {
  var s = '';
  (capa.formas || []).forEach(function (d) {
    s += '<path d="' + d + '" fill-rule="evenodd" stroke-width="' + f(W * 2) + '"/>';
  });
  (capa.trazos || []).forEach(function (t) {
    s += '<path d="' + t.d + '" fill="none" stroke-width="' + f(t.w + W * 2) + '"/>';
  });
  return s;
}

/* El ícono: por capa, el costado (copias en tinta a pasos más cortos que
   la tinta, sin brillos), luego la cara y los detalles de tinta encima. */
function svgIcono(nombre, tam, o) {
  o = o || {};
  var m = medidas(tam, o, nombre);
  var cara = o.cara || '#ffffff';
  var capas = ICONOS[nombre].capas;
  var rej = ICONOS[nombre].rejilla;
  if (rej) {
    m.cara += ' scale(' + f(R / rej) + ')';
    m.Wcara *= rej / R;
  }
  var s = ICONOS[nombre].escala;
  if (s) {
    m.cara += ' translate(12 24) scale(' + s + ') translate(-12 -24)';
    m.Wcara /= s;
  }
  var largo = Math.hypot(m.ex, m.ey);
  var paso = Math.max(0.03, m.W * 0.45);
  var n = largo > 0.01 ? Math.ceil(largo / paso) : 0;
  if (ICONOS[nombre].ilustrador) return svgComoIllustrator(nombre, tam, m, cara, n);
  /* Todas las piezas son placas del mismo grosor en el mismo plano: los
     costados de todas van detrás de todas las caras. Cada cara lleva su
     contorno, que es lo que la separa de la pieza de atrás. */
  var tintaAtras = '';
  var cuerpo = '';
  var g = '<g fill="' + TINTA + '" stroke="' + TINTA + '" stroke-linejoin="round" stroke-linecap="round">';
  capas.forEach(function (capa) {
    var tinta = capaEnTinta(capa, m.Wcara);
    for (var i = n; i >= 1; i--) {
      var k = i / n;
      tintaAtras += '<g transform="translate(' + f(m.ex * k) + ' ' + f(m.ey * k) + ') ' + m.cara + '">' + tinta + '</g>';
    }
    var frente = g + tinta + '</g>';
    (capa.formas || []).forEach(function (d) { frente += '<path d="' + d + '" fill="' + cara + '" fill-rule="evenodd"/>'; });
    (capa.trazos || []).forEach(function (t) {
      frente += '<path d="' + t.d + '" fill="none" stroke="' + cara + '" stroke-width="' + t.w + '" stroke-linejoin="round" stroke-linecap="round"/>';
    });
    (capa.tinta || []).forEach(function (d) { frente += '<path d="' + d + '" fill="' + TINTA + '" fill-rule="evenodd"/>'; });
    /* Los detalles de adentro siempre más finos que el contorno de afuera
       (65 %) y recortados a la cara, para que mueran limpios en la orilla. */
    if (capa.lineas && capa.lineas.length) {
      var lineas = capa.lineas.map(function (l) { return l.d; }).join('');
      var recorte = '';
      if (capa.formas && capa.formas.length) {
        var id = 'rc' + (++cuentaRecortes);
        frente += '<clipPath id="' + id + '">' + capa.formas.map(function (d) { return '<path d="' + d + '" clip-rule="evenodd"/>'; }).join('') + '</clipPath>';
        recorte = ' clip-path="url(#' + id + ')"';
      }
      frente += '<path d="' + lineas + '" fill="none" stroke="' + TINTA + '" stroke-width="' + f(m.Wcara * 0.65) + '" stroke-linecap="round" stroke-linejoin="round"' + recorte + '/>';
    }
    cuerpo += '<g transform="' + m.cara + '">' + frente + '</g>';
  });
  return '<svg viewBox="0 0 ' + f(m.C) + ' ' + f(m.C) + '" aria-hidden="true" focusable="false">' + g + tintaAtras + '</g>' + cuerpo + '</svg>';
}

/* Íconos que Oscar dibuja en Illustrator: se pintan como allá. Cada forma
   con su relleno y su trazo CENTRADO encima, en el orden del archivo, con
   su grosor (5 pt en la mesa de 240 = 2.08 % del tamaño; los aros de los
   ojos van igual). El costado sigue detrás de todas las caras y llega a la
   orilla de afuera del trazo. */
function svgComoIllustrator(nombre, tam, m, cara, n) {
  var pxBase = Math.min(3.8, Math.max(1, tam * 0.022));
  var pxIl = Math.max(1, tam * 5 / 240);
  var Wc = m.Wcara * pxIl / pxBase;
  var capas = ICONOS[nombre].capas;
  var g = '<g fill="' + TINTA + '" stroke="' + TINTA + '" stroke-linejoin="round" stroke-linecap="round">';
  var atras = '', cuerpo = '';
  capas.forEach(function (capa) {
    var tinta = capaEnTinta(capa, Wc / 2);
    for (var i = n; i >= 1; i--) {
      var k = i / n;
      atras += '<g transform="translate(' + f(m.ex * k) + ' ' + f(m.ey * k) + ') ' + m.cara + '">' + tinta + '</g>';
    }
    var frente = '';
    (capa.trazos || []).forEach(function (t) {
      frente += '<path d="' + t.d + '" fill="none" stroke="' + TINTA + '" stroke-width="' + f(t.w + Wc) + '" stroke-linejoin="round" stroke-linecap="round"/>';
      frente += '<path d="' + t.d + '" fill="none" stroke="' + cara + '" stroke-width="' + f(Math.max(0, t.w - Wc)) + '" stroke-linejoin="round" stroke-linecap="round"/>';
    });
    (capa.formas || []).forEach(function (d) {
      frente += '<path d="' + d + '" fill="' + cara + '" fill-rule="evenodd" stroke="' + TINTA + '" stroke-width="' + f(Wc) + '" stroke-linejoin="round"/>';
    });
    (capa.tinta || []).forEach(function (d) { frente += '<path d="' + d + '" fill="' + TINTA + '" fill-rule="evenodd"/>'; });
    if (capa.lineas && capa.lineas.length) {
      var recorte = '';
      if (capa.formas && capa.formas.length) {
        var id = 'rc' + (++cuentaRecortes);
        frente += '<clipPath id="' + id + '">' + capa.formas.map(function (d) { return '<path d="' + d + '" clip-rule="evenodd"/>'; }).join('') + '</clipPath>';
        recorte = ' clip-path="url(#' + id + ')"';
      }
      frente += '<path d="' + capa.lineas.map(function (l) { return l.d; }).join('') + '" fill="none" stroke="' + TINTA + '" stroke-width="' + f(Wc) + '" stroke-linecap="round" stroke-linejoin="round"' + recorte + '/>';
    }
    cuerpo += '<g transform="' + m.cara + '">' + frente + '</g>';
  });
  return '<svg viewBox="0 0 ' + f(m.C) + ' ' + f(m.C) + '" aria-hidden="true" focusable="false">' + g + atras + '</g>' + cuerpo + '</svg>';
}


export { ICONOS }

// nombre: llave de ICONOS. tam: px. opciones: { cara, giro (0 = de frente), grosor }.
export function svgTinta(nombre, tam, opciones) {
  if (!ICONOS[nombre]) return ''
  return svgIcono(nombre, tam, opciones || {})
}
