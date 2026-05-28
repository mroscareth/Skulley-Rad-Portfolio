import * as THREE from 'three'

// Cel-shading "banding" para materiales PBR (MeshStandardMaterial y cualquiera
// que corra los chunks de luz). En vez de reemplazar el material por
// MeshToonMaterial — lo que perdería color/metalness/envmap/skinning y rompería
// el gold-skin — inyectamos un paso de cuantización en el fragment shader vía
// onBeforeCompile: la luz difusa acumulada se aplana en `steps` bandas planas.
//
// El banding se hace por LUMINANCIA (no por canal) y se reescala el RGB con esa
// razón → conserva el tono/albedo, solo escalona la intensidad. El especular es
// opcional (toon highlight duro); por default off para no reventar con bloom.
//
// Uso:
//   applyToonBanding(material, { steps: 3 })
// Idempotente (guard en userData) — seguro llamarlo varias veces.
// `minBand` (0..1): piso de luminancia para la banda más oscura. 0 = la sombra
// puede llegar a negro puro (ok para materiales emisivos como las esferas).
// Para superficies NO emisivas (personaje) usar ~0.2 para que la sombra sea una
// versión tenue del color en vez de negro silueta. El resultado siempre queda
// acotado (la luminancia final = _toonQ), así que no revienta el color.
// `bandIndirect`: si true (default), banda el difuso TOTAL (directo + IBL) — útil
// para materiales emisivos (esferas) donde casi todo es indirecto. Si false,
// banda SOLO la luz directa y deja el IBL como relleno ambiente suave: esto da
// el corte luz/sombra NÍTIDO del cell shading cuando hay una key light fuerte, y
// el ambiente IBL evita que la sombra caiga a negro (no requiere minBand).
// `rimStrength` (>0 activa el rim light): brillo de borde tipo Fresnel que
// recupera el VOLUMEN en superficies toon (define la silueta, separa del fondo).
// `rimColor` [r,g,b], `rimThreshold` (0..1, qué tan pegado al borde empieza).
export function applyToonBanding(material, {
  steps = 3, specularSteps = 0, minBand = 0, bandIndirect = true,
  rimStrength = 0, rimColor = [1, 1, 1], rimThreshold = 0.6, rimWidth = 0.3,
  // Ink lines internas: oscurece donde la NORMAL cambia rápido (costillas,
  // nariz, pliegues, bordes del normal-map). Independiente de la iluminación
  // → NO entinta el banding de sombras. inkStrength 0 = off.
  inkStrength = 0, inkThreshold = 0.08, inkSoft = 0.12, inkColor = [0, 0, 0],
  inkRefDist = 30,
} = {}) {
  if (!material || !material.isMaterial) return material
  if (material.userData && material.userData.__toonBanded) return material

  const useRim = rimStrength > 0
  const useInk = inkStrength > 0
  const prevOnBeforeCompile = material.onBeforeCompile
  material.onBeforeCompile = (shader, renderer) => {
    try { if (typeof prevOnBeforeCompile === 'function') prevOnBeforeCompile(shader, renderer) } catch { }
    shader.uniforms.uToonSteps = { value: steps }
    shader.uniforms.uToonSpecularSteps = { value: specularSteps }
    shader.uniforms.uToonMinBand = { value: minBand }
    shader.uniforms.uToonRimStrength = { value: rimStrength }
    shader.uniforms.uToonRimColor = { value: new THREE.Color(rimColor[0], rimColor[1], rimColor[2]) }
    shader.uniforms.uToonRimThreshold = { value: rimThreshold }
    shader.uniforms.uToonRimWidth = { value: rimWidth }
    shader.uniforms.uToonInkStrength = { value: inkStrength }
    shader.uniforms.uToonInkThreshold = { value: inkThreshold }
    shader.uniforms.uToonInkSoft = { value: inkSoft }
    shader.uniforms.uToonInkColor = { value: new THREE.Color(inkColor[0], inkColor[1], inkColor[2]) }
    shader.uniforms.uToonInkRefDist = { value: inkRefDist }
    shader.fragmentShader =
      (bandIndirect ? '#define TOON_BAND_INDIRECT\n' : '') +
      (useRim ? '#define TOON_RIM\n' : '') +
      (useInk ? '#define TOON_NORMAL_INK\n' : '') +
      'uniform float uToonSteps;\nuniform float uToonSpecularSteps;\nuniform float uToonMinBand;\n' +
      'uniform float uToonRimStrength;\nuniform vec3 uToonRimColor;\nuniform float uToonRimThreshold;\nuniform float uToonRimWidth;\n' +
      'uniform float uToonInkStrength;\nuniform float uToonInkThreshold;\nuniform float uToonInkSoft;\nuniform vec3 uToonInkColor;\nuniform float uToonInkRefDist;\n' + shader.fragmentShader
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <lights_fragment_end>',
      `#include <lights_fragment_end>
      {
        // Banda el difuso TOTAL (directo + indirecto/IBL) por luminancia. La
        // escena se ilumina sobre todo con Environment (IBL) → ese término vive
        // en indirectDiffuse; bandear solo el directo no haría nada visible.
        // Se reescala el RGB con la razón cuantizada → preserva el tono/albedo.
        #ifdef TOON_BAND_INDIRECT
          vec3 _toonDiff = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;
        #else
          vec3 _toonDiff = reflectedLight.directDiffuse;
        #endif
        float _toonLum = dot(_toonDiff, vec3(0.2126, 0.7152, 0.0722));
        if (_toonLum > 1e-4 && uToonSteps > 0.5) {
          float _toonQ = floor(_toonLum * uToonSteps + 0.5) / uToonSteps;
          _toonQ = max(_toonQ, uToonMinBand); // evita negro puro en sombras
          float _toonScale = _toonQ / _toonLum;
          reflectedLight.directDiffuse *= _toonScale;
          #ifdef TOON_BAND_INDIRECT
            reflectedLight.indirectDiffuse *= _toonScale;
          #endif
        }
        #ifdef TOON_RIM
          // Rim light Fresnel: brillo en bordes que da vuelta a la silueta.
          // Usamos vNormal (normal geometrica interpolada) en vez de la normal
          // perturbada por el normal-map → el rim no se rompe en manchas con
          // el detalle de textura, queda mucho más parejo. Borde SUAVE
          // (smoothstep con ancho) para no verse "mordido".
          vec3 _rimVd = normalize(vViewPosition);
          float _rim = 1.0 - max(dot(normalize(vNormal), _rimVd), 0.0);
          _rim = smoothstep(uToonRimThreshold, min(uToonRimThreshold + uToonRimWidth, 1.0), _rim);
          reflectedLight.directDiffuse += _rim * uToonRimColor * uToonRimStrength;
        #endif
        #ifdef TOON_NORMAL_INK
          // Ink interna: la derivada de pantalla de la normal es grande donde la
          // normal cambia rápido (costillas/nariz/pliegues del normal-map y
          // curvatura fuerte). Como la normal no depende de la luz, NO toca el
          // banding. Oscurecemos el resultado hacia uToonInkColor en esos bordes.
          // Normalizamos por la distancia a cámara: fwidth(normal) crece ~lineal
          // con la distancia (más mundo por píxel), así que dividir entre ella
          // hace la métrica invariante al zoom → líneas parejas cerca/lejos.
          // Usamos vNormal (normal GEOMÉTRICA interpolada, sin el normal-map) →
          // capta los pliegues de la malla (costillas/nariz) sin el ruido de alta
          // frecuencia del normal-map (que es un grunge). Normalizado por distancia.
          float _inkCamDist = length(vViewPosition);
          float _inkE = length(fwidth(vNormal)) * (uToonInkRefDist / max(_inkCamDist, 0.001));
          float _ink = smoothstep(uToonInkThreshold, uToonInkThreshold + uToonInkSoft, _inkE) * uToonInkStrength;
          reflectedLight.directDiffuse = mix(reflectedLight.directDiffuse, uToonInkColor, _ink);
          reflectedLight.indirectDiffuse = mix(reflectedLight.indirectDiffuse, uToonInkColor, _ink);
        #endif
        // Especular en escalones duros (toon highlight) — opcional.
        if (uToonSpecularSteps > 0.5) {
          float _specLum = dot(reflectedLight.directSpecular, vec3(0.2126, 0.7152, 0.0722));
          if (_specLum > 1e-4) {
            float _specQ = floor(_specLum * uToonSpecularSteps + 0.5) / uToonSpecularSteps;
            reflectedLight.directSpecular *= _specQ / _specLum;
          }
        }
      }`
    )
  }

  // Asegura que el programa con banding no comparta cache con la variante sin él.
  const prevKey = typeof material.customProgramCacheKey === 'function'
    ? material.customProgramCacheKey.bind(material)
    : null
  material.customProgramCacheKey = () =>
    (prevKey ? prevKey() : '') + '|toonBand_' + steps + '_' + specularSteps + '_' + minBand +
    '_' + (bandIndirect ? 1 : 0) + '_' + (useRim ? 1 : 0) + '_' + (useInk ? 1 : 0) + '_' + inkRefDist

  material.needsUpdate = true
  if (!material.userData) material.userData = {}
  material.userData.__toonBanded = true
  return material
}
