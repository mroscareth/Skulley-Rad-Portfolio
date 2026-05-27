import * as THREE from 'three'

// Inverted-hull outline material (black by default), matched to the character
// outline thickness. Unlike the player outline (which expands in OBJECT space
// because it's skinned at scale ~1), this expands in VIEW space so the rim
// thickness stays constant in world units no matter how the mesh is scaled at
// runtime — orbs are scaled by radius (~0.18–0.55) and the portal torus by the
// group scale. View-space expansion keeps a uniform ~0.03 world-unit rim.
export default function makeHullOutline({ color = 0x000000, thickness = 0.03, depthWrite = true, transparent = false } = {}) {
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
    // project_vertex already computed `mvPosition` (view space) and gl_Position.
    // Push the vertex outward along the view-space normal, then re-project.
    // NOTE: use the raw `normal` attribute (always declared for built-in
    // materials) rather than `objectNormal` — the latter is only defined when
    // USE_SKINNING/USE_ENVMAP is set, so it's missing on these unskinned meshes
    // and would break shader compilation (→ outline never renders).
    shader.vertexShader = shader.vertexShader.replace(
      '#include <project_vertex>',
      `#include <project_vertex>
      vec3 outlineNormalView = normalize(normalMatrix * normal);
      mvPosition.xyz += outlineNormalView * outlineThickness;
      gl_Position = projectionMatrix * mvPosition;`
    )
  }
  return mat
}
