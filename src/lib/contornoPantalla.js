import * as THREE from 'three'

// Contorno de silueta (hull invertido) con el grosor medido en PANTALLA.
//
// Antes cada hull se inflaba una cantidad fija en unidades del mundo: de lejos
// quedaba de menos de un pixel (se rompía y se veía transparente) y de cerca
// engordaba hasta 5 o 6 px (Skulley en Customize, Argus y el drone en los
// diálogos). Ahora el vértice se empuja en el espacio de la vista lo justo para
// que en pantalla mida `grosorContorno(alto)` px de CSS, donde `alto` es lo que
// mide el personaje en pantalla: crece poco con él (raíz 0.4) y queda entre
// `min` y `max`. Así se lee igual en el juego, en un diálogo o en Customize, y
// nunca baja de `minDev` pixeles reales (con la resolución adaptable el canvas
// puede ir a 0.6 del DPR).
export const CONTORNO = { px: 2.8, ref: 400, exp: 0.4, min: 1.8, max: 3.6, minDev: 1.5 }

export function grosorContorno(altoCss) {
  const g = CONTORNO.px * Math.pow(Math.max(altoCss, 1) / CONTORNO.ref, CONTORNO.exp)
  return Math.min(CONTORNO.max, Math.max(CONTORNO.min, g))
}

export function crearUniformContorno() {
  return { value: 0.004 }
}

const _v = new THREE.Vector3()

// `uniform.value` = desplazamiento en coordenadas normalizadas de pantalla por
// unidad de w, el que el shader convierte a la distancia de cada vértice. Sirve
// para perspectiva, ortográfica y la mezcla de las dos de Customize: todo sale
// de la matriz de proyección. Regresa lo alto que se ve el personaje (px CSS).
export function medirContorno(uniform, camera, size, dpr, centro, altoMundo) {
  _v.copy(centro).applyMatrix4(camera.matrixWorldInverse)
  const e = camera.projectionMatrix.elements
  const w = Math.max(1e-4, e[11] * _v.z + e[15])
  const altoCss = altoMundo * e[5] * size.height / (2 * w)
  const px = Math.max(grosorContorno(altoCss) * dpr, CONTORNO.minDev)
  uniform.value = 2 * px / Math.max(1, size.height * dpr)
  return altoCss
}

// Va en lugar de `#include <project_vertex>`. `normalPiel` es la normal ya con la
// piel (la de three, o la promediada que ponen Argus y el drone en
// beginnormal_vertex); `normalSinPiel`, la de una malla sin esqueleto (las
// piezas del despiece). `factor`: grosor extra por vértice (Argus adelgaza los
// dientes y quita el de la boca por dentro).
export function glslContorno({ normalPiel = 'objectNormal', normalSinPiel = 'normal', factor = '1.0' } = {}) {
  return `#include <project_vertex>
  {
    #ifdef USE_SKINNING
      vec3 nContorno = ${normalPiel};
    #else
      vec3 nContorno = ${normalSinPiel};
    #endif
    vec3 nVista = normalize( normalMatrix * nContorno );
    float wContorno = projectionMatrix[2][3] * mvPosition.z + projectionMatrix[3][3];
    mvPosition.xyz += nVista * ( uContorno * ( ${factor} ) * wContorno / projectionMatrix[1][1] );
    gl_Position = projectionMatrix * mvPosition;
  }`
}
