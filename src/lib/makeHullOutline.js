import * as THREE from 'three'

// Inverted-hull outline material (black by default), matched to the character
// outline thickness. Unlike the player outline (which expands in OBJECT space
// because it's skinned at scale ~1), this expands in VIEW space so the rim
// thickness stays constant in world units no matter how the mesh is scaled at
// runtime — orbs are scaled by radius (~0.18–0.55) and the portal torus by the
// group scale. View-space expansion keeps a uniform ~0.03 world-unit rim.
//
// `objectSpace` opt-in: extrude en local-space (igual que el personaje).
// Ventaja: evita el poke-through interior en mallas cóncavas (el offset escala
// con el mesh y se adapta a la geometría local). Tradeoff: el `thickness` deja
// de estar en unidades de mundo — ahora es en unidades-de-vértice del mesh, así
// que el llamador debe escalarlo según la geometría (ej. bbox.diag * factor).
export default function makeHullOutline({ color = 0x000000, thickness = 0.03, depthWrite = true, transparent = false, objectSpace = false } = {}) {
  const mat = new THREE.MeshBasicMaterial({
    color,
    side: THREE.BackSide,
    fog: false,
    toneMapped: false,
    // depthWrite:false lets the hull sit BEHIND additive glow layers without
    // depth-killing them (needed for the portal, whose glows must show through).
    depthWrite,
    // transparent:true moves the hull into the transparent pass so a high
    // renderOrder can draw it AFTER additive glow layers — otherwise the glow
    // (drawn last) washes the stroke on the near/bottom rim of the portal.
    transparent,
  })
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.outlineThickness = { value: thickness }
    shader.vertexShader = shader.vertexShader.replace(
      '#include <common>',
      `#include <common>
      uniform float outlineThickness;`
    )
    if (objectSpace) {
      // OBJECT-space: extrude `transformed` (local position, vía <begin_vertex>)
      // a lo largo de la normal local ANTES de `project_vertex`. Replica el
      // outline del personaje (Player.jsx). Las normales reales del mesh guían
      // la inflación → menos poke-through en pliegues cóncavos.
      shader.vertexShader = shader.vertexShader.replace(
        '#include <project_vertex>',
        `transformed += normalize(normal) * outlineThickness;
        #include <project_vertex>`
      )
    } else {
      // VIEW-space (default): push en pantalla, constante en world-units.
      shader.vertexShader = shader.vertexShader.replace(
        '#include <project_vertex>',
        `#include <project_vertex>
        vec3 outlineNormalView = normalize(normalMatrix * normal);
        mvPosition.xyz += outlineNormalView * outlineThickness;
        gl_Position = projectionMatrix * mvPosition;`
      )
    }
  }
  return mat
}
