import * as THREE from 'three'
import { addAfterEffect, addEffect } from '@react-three/fiber'

// Cada esqueleto se calcula una sola vez por cuadro (2026-11-22). three lo
// recalcula en cada render() y marca su textura de huesos para resubirla: el
// home dibuja a Skulley en varios pases por cuadro (la escena con el composer, el
// pase de normales de la tinta, la sombra), y con sus props son 52 esqueletos y
// 5,345 huesos. Medido en el Brave de Oscar: 146 cálculos y ~144 texturas subidas
// por cuadro, cuando basta uno por esqueleto.
// Dentro de un cuadro de R3F (entre sus efectos de antes y de después) se calcula
// en el primer pase y los demás lo reusan. Fuera de un cuadro (un render suelto
// desde un efecto) se calcula siempre, como antes.
// Regla que esto pide: nada mueve huesos después del primer pase que dibuja al
// personaje (CharacterNormalPass y la sombra van en prioridad 0.5, el composer en 1);
// lo que posa (mixer, Player, IK, CameraAim) va en prioridad 0 o menos.

let cuadro = 0
let dentro = false
addEffect(() => { cuadro++; dentro = true })
addAfterEffect(() => { cuadro++; dentro = false })

const proto = THREE.Skeleton.prototype
const original = proto.update.__original || proto.update
function porCuadro() {
  if (dentro && this.__cuadro === cuadro) return
  this.__cuadro = cuadro
  original.call(this)
}
porCuadro.__original = original
proto.update = porCuadro

if (import.meta.env.DEV && typeof window !== 'undefined') {
  // Para comparar: false regresa al de three (un cálculo por pase).
  window.__esqueletoPorCuadro = (si = true) => { proto.update = si ? porCuadro : original; return si }
}
