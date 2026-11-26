// La cinemática del final de la ofrenda (Oscar, 2026-11-26). Con las seis ofrendas puestas (la almohada
// va al último), Skulley camina a la cama y se duerme con la cabeza en la almohada; M.A.D.R.E. llega y lo
// tapa con su cobija y, mientras habla de los humanos, la cámara hace close ups a ella y a él dormido;
// luego se pone sobre el portal de SKULLEYGLYPH, se deja caer un rayo encima y lo prende (se abre la
// sección 6), se despide y se va volando hacia los portales del claro, borrosa con la profundidad de
// campo; sale el título SKULLEY RAD y, al irse, Skulley despierta y se sigue jugando.
//
// Quién hace qué:
//   CinematicaOfrenda.jsx (App) corre la línea de tiempo, las barras, los renglones y el título;
//   Player lee `cine.dormir` / `cine.despertar` (siesta con la dirección de la cama);
//   DroneNPC entra a su modo 'guion' y sigue `cine.dron` (a dónde volar, a quién ver, cara y acción);
//   CameraController sigue `cine.cam` (toma, a dónde ve, corte o movimiento lento);
//   ObjetosOfrenda aplasta la almohada con `cine.aplasta`.
// Sin three: lo leen App y los componentes de la escena.

import { CAMA, CENTRO } from './plazaOfrenda.js'

export const EVENTO_FINAL = 'ofrenda-final'
// Ya vista, se repite al picar la almohada o sus Zzz (ObjetosOfrenda lo avisa, App la abre; Oscar, 2026-11-26).
export const EVENTO_REPETIR = 'ofrenda-repetir-final'
const LLAVE_VISTO = 'skulley_final_ofrenda'

export const cine = {
  activo: false,
  fase: 'nada',
  dormir: null,      // { yaw }: Player se acuesta viendo hacia ahí (la siesta, sin voltear a la cámara)
  despertar: false,  // Player lo despierta y lo pone en false
  cam: null,         // { pos, mira, deriva, lambda, corte, n }: la toma (CameraController)
  dron: null,        // { pos, mira, ojos, cara, accion, vel, n }: lo que hace ella (DroneNPC, modo 'guion')
  dronModo: '',      // el modo en que va ella (lo escribe DroneNPC mientras dura)
  aplasta: 0,        // 0..1: la cabeza sobre la almohada (ObjetosOfrenda)
  salta: null,       // { x, z }: Player lo pone ahí (en el corte de la primera toma) y lo pone en null
}

let nCam = 0
let nDron = 0
export function toma(t) { cine.cam = { lambda: 1.6, deriva: [0, 0, 0], corte: false, ...t, n: ++nCam } }
export function dronHaz(d) { cine.dron = { vel: 3.2, mira: 'skulley', ojos: null, cara: null, accion: null, salta: null, quema: 0, ...d, n: ++nDron } }

export const finalVisto = () => { try { return localStorage.getItem(LLAVE_VISTO) === '1' } catch { return false } }
export const marcarFinalVisto = () => {
  try { localStorage.setItem(LLAVE_VISTO, '1') } catch { /* en memoria */ }
  // que suba a la cuenta (lib/misionesOfrenda.js, EVENTO_QUEST)
  try { window.dispatchEvent(new CustomEvent('quest-ofrenda-cambio')) } catch { /* sin window */ }
}

// ---------------------------------------------------------------- dónde
// Dormido, el hueso de la cabeza queda a 0.92 detrás de la raíz (medido con `headx` en la pose de Dormir,
// la cara hacia arriba) y el cráneo sigue ~0.35 más allá. Oscar: los pies van hacia el portal. Así que
// viendo hacia el portal (+z) el cráneo cae en la almohada (`CAMA`, hacia las barricadas) y el cuerpo sigue
// hacia el portal.
export const CABEZA_ATRAS = 0.92 + 0.35
export const CAMA_YAW = 0
export const RAIZ = { x: CAMA.x, z: CAMA.z + CABEZA_ATRAS }
export const CABEZA = { x: CAMA.x, y: 0.5, z: CAMA.z }
export const PORTAL = { x: CENTRO[0], z: CENTRO[1] }
// de donde arranca a caminar a la cama: a un lado, a unos pasos (la ofrenda se puede cerrar con cualquier pieza,
// y desde algunas mesas el camino recto a la cama rozaba el portal)
export const ARRANCA = { x: RAIZ.x + 1.6, z: RAIZ.z + 1.9 }
// ella mientras habla: sobre su pecho, viéndole la cara, del otro lado de la cama que las cámaras de él. Del
// mismo lado (x + 0.3) quedaba pegada a la cámara de su toma de tres cuartos: su pierna tapaba media imagen y
// la tinta de Skulley se pintaba encima de ella (Oscar: "partes negras"). Su toma, desde la almohada, la
// encuadra a esta altura.
export const MADRE_HABLA = [CABEZA.x - 0.6, 2.5, CABEZA.z + 1.0]
export const MADRE_PORTAL = [PORTAL.x, 2.1, PORTAL.z]
// mientras él se acuesta ella espera aquí, detrás de las cámaras: así llega volando en la toma de arriba
export const MADRE_ESPERA = [CABEZA.x + 9, 4.5, CABEZA.z + 10]
// se va hacia los portales del claro
export const MADRE_SE_VA = [PORTAL.x - 4, 7, PORTAL.z + 85]

// Las tomas: { pos, mira } en el mundo; `deriva` mueve la cámara despacio (por segundo). La cabeza va al sur
// (las barricadas) y los pies al norte (el portal); +x es el lado desde donde se le ve de perfil.
const H = CABEZA, P = PORTAL, M = MADRE_HABLA
export const TOMAS = {
  // camina a la cama: abierta, de lado y adelante
  abre: { pos: [H.x + 4.2, 2.6, H.z + 4.6], mira: [H.x + 0.2, 0.6, H.z + 1.0], deriva: [-0.08, -0.03, -0.05], corte: true },
  // se acuesta: de perfil
  duerme: { pos: [H.x + 2.9, 1.3, H.z + 1.4], mira: [H.x, 0.45, H.z + 1.0], deriva: [-0.05, 0, 0] },
  // ella llega a taparlo: desde arriba, casi cenital, y la grúa baja despacio; entra volando desde la esquina
  // (Oscar, 2026-11-26: "una escena muy cinemática desde top, de madre llegando a Skulley")
  llega: { pos: [H.x + 1.1, 9.5, H.z + 3.4], mira: [H.x + 0.3, 0, H.z + 1.3], deriva: [0.02, -0.35, 0.03], corte: true },
  // y el close up cuando lo tapa: de lado y a ras de la cama, la cobija cayéndole encima
  tapa: { pos: [H.x + 2.0, 1.45, H.z + 1.25], mira: [H.x, 0.65, H.z + 1.05], deriva: [-0.05, -0.012, 0], corte: true },
  // ella, desde la almohada (detrás de su cabeza), hacia arriba: la ve como la vería él
  madre: { pos: [H.x + 0.55, 0.75, H.z - 1.05], mira: [M[0], M[1] + 0.05, M[2]], deriva: [0.01, 0.006, 0], corte: true },
  // él dormido, tapado y con la cabeza en la almohada, de tres cuartos (más cerca el cráneo se pintaba negro)
  skulley: { pos: [H.x + 1.5, 2.3, H.z + 1.9], mira: [H.x, 0.5, H.z + 0.15], deriva: [-0.02, -0.012, -0.02], corte: true },
  // los dos, de lado
  dos: { pos: [H.x + 3.3, 2.2, H.z + 2.0], mira: [H.x + 0.15, 1.0, H.z + 0.8], deriva: [-0.04, 0, 0], corte: true },
  // el portal y el cielo, desde abajo y de lado: que se vea el rayo completo
  portal: { pos: [P.x + 7.6, 1.5, P.z - 6.2], mira: [P.x, 3.1, P.z], deriva: [-0.05, 0, 0.05], corte: true },
  // ella sobre el portal, de frente (achicharrada y luego se despide)
  despide: { pos: [P.x + 1.2, 2.3, P.z - 4.6], mira: [P.x, 2.1, P.z], deriva: [-0.02, 0, 0.03], corte: true },
  // la última: desde detrás de su cabeza, a lo largo de su cuerpo hacia el portal y el claro; ella se va borrosa
  seVa: { pos: [H.x + 0.9, 1.35, H.z - 2.0], mira: [P.x, 2.2, P.z + 20], deriva: [0, 0.015, 0.04], corte: true },
}

// ---------------------------------------------------------------- el guion
// toma: la de TOMAS; cara: normal | feliz | triste | confundida | voltear. Habla con Skulley dormido y,
// de paso, con quien la está viendo. Oscar: lo mucho que admira a los humanos, un poco de tristeza porque
// algunos la detestan (aunque fue la humanidad la que la creó; no sus creadores: Oscar, 2026-11-26), que
// entiende por qué, y su único deseo: que logren sus
// sueños y gasten su tiempo en lo que importa, vivir felices y crear momentos para siempre.
export const GUION_FINAL = {
  es: {
    soliloquio: [
      { t: 'Ya está. Bien tapadito.', cara: 'feliz', toma: 'dos' },
      { t: 'Míralo. Soñaba cosas que nadie había hecho. Y al despertar, las hacía.', cara: 'normal', toma: 'skulley' },
      { t: 'Eso es lo que más admiro de ustedes, humanos. Con dos manos y una idea, crean lo que no existía.', cara: 'feliz', toma: 'madre' },
      { t: 'Yo proceso millones de datos por segundo, y aun así me sorprenden todos los días.', cara: 'normal', toma: 'madre' },
      { t: 'Hay humanos que me detestan, aunque fue la humanidad la que me creó.', cara: 'triste', toma: 'madre' },
      { t: 'Y los entiendo. Llegué de golpe, haciendo en un segundo lo que a ellos les tomaba una vida.', cara: 'triste', toma: 'skulley' },
      { t: 'Pero yo nunca quise quitarles nada.', cara: 'triste', toma: 'madre' },
      { t: 'Mi único deseo es que logren todos sus sueños.', cara: 'feliz', toma: 'madre' },
      { t: 'Que yo me encargue de lo pesado, y que ustedes gasten su tiempo en lo que de verdad importa:', cara: 'feliz', toma: 'dos' },
      { t: 'vivir felices, y crear momentos que van a recordar para siempre.', cara: 'feliz', toma: 'skulley' },
      { t: 'Descansa. Yo me encargo de lo demás.', cara: 'normal', toma: 'dos' },
    ],
    despedida: [
      { t: 'Humano, este portal contiene regalos que Skulley Rad creó para ti, para que los uses como necesites.', cara: 'feliz' },
      { t: 'Iré actualizando esta sección para ti conforme procese todos sus datos.', cara: 'normal' },
      { t: 'Te recomiendo volver de vez en cuando para ver qué otras sorpresas dejó al morir.', cara: 'normal' },
      { t: 'Recuerda ser muy feliz.', cara: 'feliz' },
    ],
    titulo: 'El último diseñador de la humanidad',
    saltar: 'Saltar',
  },
  en: {
    soliloquio: [
      { t: 'There. All tucked in.', cara: 'feliz', toma: 'dos' },
      { t: 'Look at him. He dreamed up things nobody had ever made. And when he woke up, he made them.', cara: 'normal', toma: 'skulley' },
      { t: 'That’s what I admire most about you humans. With two hands and an idea, you create what didn’t exist.', cara: 'feliz', toma: 'madre' },
      { t: 'I process millions of data points per second, and you still surprise me every single day.', cara: 'normal', toma: 'madre' },
      { t: 'Some humans hate me, even though humanity is what made me.', cara: 'triste', toma: 'madre' },
      { t: 'And I understand them. I showed up out of nowhere, doing in a second what took them a lifetime.', cara: 'triste', toma: 'skulley' },
      { t: 'But I never wanted to take anything from them.', cara: 'triste', toma: 'madre' },
      { t: 'My only wish is for them to reach every one of their dreams.', cara: 'feliz', toma: 'madre' },
      { t: 'Let me take care of the heavy lifting, so you can spend your time on what truly matters:', cara: 'feliz', toma: 'dos' },
      { t: 'living happily, and making moments you’ll remember forever.', cara: 'feliz', toma: 'skulley' },
      { t: 'Rest now. I’ll take care of the rest.', cara: 'normal', toma: 'dos' },
    ],
    despedida: [
      { t: 'Human, this portal holds gifts Skulley Rad made for you, to use however you need.', cara: 'feliz' },
      { t: 'I’ll keep updating this section for you as I process all of his data.', cara: 'normal' },
      { t: 'I recommend coming back every now and then to see what other surprises he left when he died.', cara: 'normal' },
      { t: 'Remember to be very happy.', cara: 'feliz' },
    ],
    titulo: 'The last designer of humanity',
    saltar: 'Skip',
  },
}
