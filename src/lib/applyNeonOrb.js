import * as THREE from 'three'

// Neon-orb shading: cuantiza el emissive por NdotV (ángulo entre la normal y
// la cámara) en bandas tipo cell-shading. Las orbs originales se veían como
// DISCOS 2D porque el emissive plano no varía por píxel — sin diffuse (color
// negro para evitar wash del IBL), no había nada que diera lectura esférica.
//
// Este injection mantiene la saturación neón (no toca chroma, solo escala el
// emissive) y produce 3 anillos concéntricos visibles: centro caliente →
// rim oscuro. Combinado con bloom: el centro brillante genera el halo, el
// rim aterriza la silueta. Lectura "bombilla toon", no disco plano.
//
// Knobs:
// - steps (3..5): cuántas bandas. 3 = look planetono. 4-5 = más volumen, más blando.
// - rimMul (0..1): intensidad de la banda más oscura (al rim). 0.4 = rim notable.
// - coreMul (>1): intensidad de la banda más brillante (al centro). 1.8 = hot core.
// - power (>0): curva NdotV antes de cuantizar. >1 concentra la banda brillante al
//   centro (look "spot caliente"). <1 la expande. Default 1.4 = núcleo definido.
export function applyNeonOrb(material, {
  steps = 3,
  rimMul = 0.45,
  coreMul = 1.8,
  power = 1.4,
} = {}) {
  if (!material || !material.isMaterial) return material
  if (material.userData && material.userData.__neonOrb) return material

  const prevOnBeforeCompile = material.onBeforeCompile
  material.onBeforeCompile = (shader, renderer) => {
    try { if (typeof prevOnBeforeCompile === 'function') prevOnBeforeCompile(shader, renderer) } catch {}
    shader.uniforms.uNeonSteps = { value: steps }
    shader.uniforms.uNeonRimMul = { value: rimMul }
    shader.uniforms.uNeonCoreMul = { value: coreMul }
    shader.uniforms.uNeonPower = { value: power }
    shader.fragmentShader =
      'uniform float uNeonSteps;\nuniform float uNeonRimMul;\nuniform float uNeonCoreMul;\nuniform float uNeonPower;\n' +
      shader.fragmentShader
    // Inyectamos DESPUÉS de emissivemap_fragment — para ese punto
    // totalEmissiveRadiance ya tiene `emissive * emissiveIntensity`.
    // Lo escalamos por una banda quantizada según NdotV: centro caliente,
    // rim oscuro, escalones cell-shaded (no gradient suave).
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <emissivemap_fragment>',
      `#include <emissivemap_fragment>
      {
        vec3 _orbN = normalize(vNormal);
        vec3 _orbV = normalize(vViewPosition);
        float _orbNdotV = clamp(dot(_orbN, _orbV), 0.0, 1.0);
        // Curva: power>1 concentra la banda alta hacia el centro (look "spot").
        float _orbT = pow(_orbNdotV, uNeonPower);
        // Cuantización por banda — escalones nítidos, no gradient.
        float _orbBand = floor(_orbT * uNeonSteps + 0.5) / uNeonSteps;
        // Multiplicador final: lerp rim→core. No toca chroma (multiplicador
        // escalar) → la saturación neón se preserva.
        float _orbMul = mix(uNeonRimMul, uNeonCoreMul, _orbBand);
        totalEmissiveRadiance *= _orbMul;
      }`
    )
  }

  const prevKey = typeof material.customProgramCacheKey === 'function'
    ? material.customProgramCacheKey.bind(material)
    : null
  material.customProgramCacheKey = () =>
    (prevKey ? prevKey() : '') + '|neonOrb_' + steps + '_' + rimMul + '_' + coreMul + '_' + power

  material.needsUpdate = true
  if (!material.userData) material.userData = {}
  material.userData.__neonOrb = true
  return material
}
