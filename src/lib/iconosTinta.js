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
   lineas  trazos de tinta encima de la cara, { d, w } */
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
