// Argus, el NPC del juego de esferas (components/ZoidianNPC.jsx), y su escena del
// trato (components/ZoidianDialog.jsx). Estado compartido sin three: App y el
// diálogo van en el chunk de entrada.
//
// El diálogo le avisa al NPC por `avisarArgus`:
//   { dialogo: true | false }   empieza / termina la escena (con true no hay idles
//                               de variedad, empujón ni saludo automático; con
//                               false se limpian la cara y la mirada pedidas)
//   { accion, cara, mirar }     por renglón; solo cuenta lo que venga definido y
//                               `null` lo borra. accion: un clip (Trato, Senalar,
//                               Presumir, Encogerse, Celebrar, Saludo, Risa,
//                               Impresionado…); cara: neutral, feliz, carcajada,
//                               sorpresa, furia, aburrido, sospecha, apretados,
//                               encoge; mirar: 'skulley', 'camara' o [x, y, z].
// y `argus.hablaUltimo` es el performance.now() de la última letra que dijo
// (mueve la quijada con el clip Hablar).
export const argus = {
  hablaUltimo: 0,
  // Skulley está dentro de su radio (lo escribe ZoidianNPC): solo así se abre la escena
  cerca: false,
  // dónde está parado y hacia dónde ve: los de ZoidianNPC en HomeScene (si se mueve, cambia aquí)
  pos: { x: 0, y: 0, z: 12.9 },
  rotY: Math.PI,
  // alto del modelo en la escena (targetHeight de HomeScene)
  alto: 3.2,
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
