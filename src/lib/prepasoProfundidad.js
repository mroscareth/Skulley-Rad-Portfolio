import * as THREE from 'three'
import { RenderPass } from 'postprocessing'

// Prepaso de profundidad para el RenderPass de un EffectComposer de
// postprocessing (el del rig de Skulley: teléfono, preloader de escritorio,
// versión simple).
//
// Skulley se dibuja DoubleSide. Sus mallas son cerradas, pero las caras de
// atrás se rasterizan igual y, como dentro de una malla los triángulos no van
// de adelante hacia atrás, muchas pagan el shader completo (toon, skin, cuatro
// luces) antes de que la cara de enfrente las tape. En la primera pantalla del
// teléfono era casi la mitad de lo que costaba el cráneo (rendimiento.md,
// 2026-11-15).
//
// El prepaso dibuja antes, solo en profundidad y con un material barato, las
// mallas que pide `incluye`. Después la escena se dibuja como siempre encima de
// esa profundidad, y lo que queda detrás ya no pasa la prueba y no se sombrea.
// El cuadro sale idéntico: el fragmento que se ve es el más cercano y siempre
// pasa (la profundidad del prepaso va un poco atrás con polygonOffset, por si
// los dos shaders redondean distinto); los que no pasan nunca se veían. Medido
// pixel por pixel en el mismo cuadro: 0 distintos.
//
// Por eso solo sirven mallas opacas que escriben profundidad, sin discard
// (alphaTest, alphaHash, planos de corte) y cuyo material no mueva los vértices
// en el shader (el skin y el toon no los mueven). Cada malla del prepaso vuelve
// a pasar por el skinning: en una pieza chica en pantalla cuesta lo mismo que
// ahorra. `activo(camara)` lo apaga cuando no conviene (Skulley chico en
// cuadro).
//
// De paso quita un borrado doble: el RenderPass trae su ClearPass y el
// EffectComposer de @react-three/postprocessing pone `autoClear` en true, así
// que three volvía a borrar el mismo buffer al dibujar la escena. Se queda solo
// el de three, que además fuerza las máscaras de color y profundidad antes de
// borrar (el ClearPass dependía del estado que dejara el último dibujo).
//
// Devuelve la función que lo quita, o null si el composer no tiene RenderPass.
export function instalarPrepaso(composer, { raiz, incluye, activo = () => true }) {
  const pase = composer?.passes?.find((p) => p instanceof RenderPass)
  if (!pase) return null
  const materiales = {}
  for (const side of [THREE.FrontSide, THREE.BackSide, THREE.DoubleSide]) {
    materiales[side] = new THREE.MeshBasicMaterial({
      colorWrite: false,
      side,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 2,
    })
  }
  const sirve = (o) => {
    const m = o.material
    return m && !Array.isArray(m) && !m.transparent && m.depthWrite && m.depthTest && m.colorWrite
      && m.depthFunc === THREE.LessEqualDepth && !m.alphaTest && !m.alphaHash && !m.polygonOffset
      && !m.displacementMap && !m.wireframe && !m.clippingPlanes?.length && incluye(o)
  }
  // Pares [objeto, material original | null si se ocultó], reusados cada cuadro.
  const cambios = []
  // La primera vez que hay mallas que sirven, el prepaso corre aunque no toque
  // (el cuadro sale igual): así su programa se compila al cargar y no a media
  // escena, en el primer acercamiento.
  let compilado = false
  const dibujaPrepaso = (renderer, camara) => {
    const r = raiz()
    if (!r?.visible || (compilado && !activo(camara))) return false
    let n = 0
    r.traverseVisible((o) => {
      if (!(o.isMesh || o.isPoints || o.isLine || o.isSprite)) return
      if (o.isMesh && sirve(o)) {
        cambios.push(o, o.material)
        o.material = materiales[o.material.side]
        n++
      } else {
        cambios.push(o, null)
        o.visible = false
      }
    })
    // Con autoClear: borra el buffer igual que lo habría hecho la escena.
    if (n) {
      renderer.render(r, camara)
      compilado = true
    }
    for (let i = 0; i < cambios.length; i += 2) {
      const m = cambios[i + 1]
      if (m) cambios[i].material = m
      else cambios[i].visible = true
    }
    cambios.length = 0
    return n > 0
  }

  const tenia = Object.prototype.hasOwnProperty.call(pase, 'render')
  const original = pase.render
  const borraba = pase.clear
  pase.clear = false
  pase.render = function (renderer, inputBuffer, outputBuffer, deltaTime, stencilTest) {
    const sigue = () => original.call(this, renderer, inputBuffer, outputBuffer, deltaTime, stencilTest)
    if (!renderer.autoClear) {
      // Sin autoClear el único borrado es el del ClearPass.
      this.clear = true
      try { return sigue() } finally { this.clear = false }
    }
    if (this.overrideMaterialManager !== null || this.selection !== null) return sigue()
    renderer.setRenderTarget(this.renderToScreen ? null : inputBuffer)
    if (!dibujaPrepaso(renderer, this.camera)) return sigue()
    renderer.autoClear = false
    try { return sigue() } finally { renderer.autoClear = true }
  }

  return () => {
    if (tenia) pase.render = original
    else delete pase.render
    pase.clear = borraba
    for (const m of Object.values(materiales)) m.dispose()
  }
}
