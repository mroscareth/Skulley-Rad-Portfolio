// Argus, el NPC del juego de esferas (components/ZoidianNPC.jsx), y su escena del
// trato (components/ZoidianDialog.jsx). Estado compartido sin three: App y el
// diálogo van en el chunk de entrada.
//
// El diálogo le avisa al NPC por `avisarArgus`:
//   { dialogo: true | false }   empieza / termina la escena (con true no hay idles
//                               de variedad, empujón ni saludo automático; con
//                               false se limpian la cara y la mirada pedidas)
//   { escena: true | false }    una escena con M.A.D.R.E. (DroneNPC): sin idles de
//                               variedad, empujón ni saludo
//   { dice, dura, tecleo }      dice ese texto en su globo (`dura` en segundos)
//   { quemar: true }            le cayó el rayo de M.A.D.R.E.: se chamusca
//   { accion, cara, mirar }     por renglón; solo cuenta lo que venga definido y
//                               `null` lo borra. accion: un clip (Trato, Senalar,
//                               Presumir, Encogerse, Celebrar, Saludo, Risa,
//                               Impresionado…); cara: neutral, feliz, carcajada,
//                               sorpresa, furia, aburrido, sospecha, apretados,
//                               encoge; mirar: 'skulley', 'camara', 'dron' o [x, y, z].
// y `argus.hablaUltimo` es el performance.now() de la última letra que dijo
// (mueve la quijada con el clip Hablar).
import { escuchar as escucharJuego } from './juegoEsferas.js'
import scoreStore from './scoreStore.js'
import { crearHumor } from './humorNpc.js'

export const argus = {
  hablaUltimo: 0,
  // Skulley está dentro de su radio (lo escribe ZoidianNPC): solo así se abre la escena
  cerca: false,
  // dónde está parado y hacia dónde ve: los de ZoidianNPC en HomeScene (si se mueve, cambia aquí)
  pos: { x: 0, y: 0, z: 12.9 },
  rotY: Math.PI,
  // alto del modelo en la escena (targetHeight de HomeScene)
  alto: 3.2,
  // en su escena del trato con el jugador / en una escena con M.A.D.R.E. (los
  // escribe ZoidianNPC; DroneNPC corta la suya si se abre el trato)
  dialogo: false,
  escena: false,
}

const oyentes = new Set()
export function escucharArgus(fn) {
  oyentes.add(fn)
  return () => oyentes.delete(fn)
}
export function avisarArgus(msg) {
  for (const fn of oyentes) {
    try { fn(msg) } catch { }
  }
}

// Lo que recuerda de la última vez (Oscar, 2026-11-23: que se sientan vivos): si le
// dijiste "Ahora no" o cuánto hiciste en tu última partida, para saludarte con eso.
// ZoidianDialog lo lee al abrir y anota "Ahora no"; el fin de partida anota aquí
// los puntos: al acabarse el reloj ('tiempo', que ya no manda 'fin') o con END
// GAME ('fin'). En memoria: una recarga lo olvida.
argus.memoria = { ultimo: null, puntos: null }
escucharJuego((tipo) => {
  if (tipo !== 'fin' && tipo !== 'tiempo') return
  argus.memoria.ultimo = 'jugo'
  argus.memoria.puntos = scoreStore.get()
})

// Su humor (Oscar, 2026-11-23: "haz que Argus también se enoje si lo picas
// mucho"): el mismo de M.A.D.R.E. (lib/humorNpc.js), con su propia cuenta.
// ZoidianNPC pregunta al picarlo (si no habla, lo dice en su viñeta, con cara de
// furia) y ZoidianDialog toma el saludo y avisa cómo se cerró.
const humor = crearHumor()
export const animoArgus = humor.estado
export const argusEnojado = humor.enojado
export const picarArgus = humor.picar
export const picarArgusLejos = humor.picarLejos
export const tomarSaludoArgus = humor.tomarSaludo
export const cerrarConArgus = humor.cerrar
// desarrollo: window.__humorArgus da sus cuentas (molestia, cortes, enojadoHasta…)
if (import.meta.env?.DEV && typeof window !== 'undefined') window.__humorArgus = animoArgus
