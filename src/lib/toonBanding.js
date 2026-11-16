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
// `rimDirection` [x,y,z] en espacio de VISTA (opcional): limita el rim al lado
// de donde viene la luz, como un contraluz real. null = todo el contorno.
// Piso de sombra compartido por todos los materiales: cambiarlo no recompila nada.
// Con Skulley aislado sube, y la banda más oscura deja de caer a negro.
export const toonPisoGlobal = { value: 0 }

// La luz de la llama de la mano (LlamaMano, Oscar 2026-11-15): una pointLight
// real no se veía en Skulley, porque el banding aplana lo que cae en la banda
// iluminada y una luz verde no rebota en un cuerpo rojo. Así que cada material
// con banding trae su "derrame": donde la cara mira a la llama y está cerca, se
// tiñe de su color en bandas duras. Cada material tiene sus uniforms y
// LlamaMano le enlaza los suyos (`uniformsLlama`) a los de su personaje.
const LLAMA_UNIFORMS = new WeakMap()

// Brillo duro (`especularDuro`, Oscar 2026-11-15: con un color casi negro "se
// ven los brillos 3D"): el especular del GLB (roughness 0.65) y el reflejo del
// HDRI pasaban suaves, sin banda, y con un albedo oscuro el difuso casi no
// existe, así que ese brillo suave era todo lo que se veía (y el DotScreen lo
// volvía puntos). Ahora es una mancha plana donde el brillo pasa el umbral.
// Umbral y nivel van relativos a la luz que llega (el sombreado sin albedo),
// así la mancha mide lo mismo con las luces del juego, del retrato o del rig.
export const toonBrillo = { umbral: { value: 0.036 }, nivel: { value: 0.14 } }
if (import.meta.env?.DEV && typeof window !== 'undefined') window.__toonBrillo = toonBrillo
export function uniformsLlama(material) {
  return LLAMA_UNIFORMS.get(material) || null
}

export function applyToonBanding(material, {
  steps = 3, specularSteps = 0, minBand = 0, bandIndirect = true,
  rimStrength = 0, rimColor = [1, 1, 1], rimThreshold = 0.6, rimWidth = 0.3, rimDirection = null,
  // Ink lines internas: oscurece donde la NORMAL cambia rápido (costillas,
  // nariz, pliegues, bordes del normal-map). Independiente de la iluminación
  // → NO entinta el banding de sombras. inkStrength 0 = off.
  inkStrength = 0, inkThreshold = 0.08, inkSoft = 0.12, inkColor = [0, 0, 0],
  inkRefDist = 30,
  especularDuro = false,
} = {}) {
  if (!material || !material.isMaterial) return material
  if (material.userData && material.userData.__toonBanded) return material

  const useRim = rimStrength > 0
  const rimDir = useRim && Array.isArray(rimDirection)
    ? new THREE.Vector3(rimDirection[0], rimDirection[1], rimDirection[2]).normalize()
    : null
  const useInk = inkStrength > 0
  // Posición (mundo), color y (fuerza, alcance, umbral) de la llama; fuerza 0 = apagada.
  const llama = {
    uLlamaPos: { value: new THREE.Vector3() },
    uLlamaColor: { value: new THREE.Color(0, 0, 0) },
    uLlamaParams: { value: new THREE.Vector3(0, 1, 0.5) },
  }
  LLAMA_UNIFORMS.set(material, llama)
  const prevOnBeforeCompile = material.onBeforeCompile
  material.onBeforeCompile = (shader, renderer) => {
    try { if (typeof prevOnBeforeCompile === 'function') prevOnBeforeCompile(shader, renderer) } catch { }
    Object.assign(shader.uniforms, llama)
    shader.uniforms.uToonBrilloUmbral = toonBrillo.umbral
    shader.uniforms.uToonBrilloNivel = toonBrillo.nivel
    shader.uniforms.uToonSteps = { value: steps }
    shader.uniforms.uToonSpecularSteps = { value: specularSteps }
    shader.uniforms.uToonMinBand = { value: minBand }
    shader.uniforms.uToonPisoGlobal = toonPisoGlobal
    shader.uniforms.uToonRimStrength = { value: rimStrength }
    shader.uniforms.uToonRimColor = { value: new THREE.Color(rimColor[0], rimColor[1], rimColor[2]) }
    shader.uniforms.uToonRimThreshold = { value: rimThreshold }
    shader.uniforms.uToonRimWidth = { value: rimWidth }
    shader.uniforms.uToonRimDir = { value: rimDir || new THREE.Vector3(0, 0, 1) }
    shader.uniforms.uToonInkStrength = { value: inkStrength }
    shader.uniforms.uToonInkThreshold = { value: inkThreshold }
    shader.uniforms.uToonInkSoft = { value: inkSoft }
    shader.uniforms.uToonInkColor = { value: new THREE.Color(inkColor[0], inkColor[1], inkColor[2]) }
    shader.uniforms.uToonInkRefDist = { value: inkRefDist }
    shader.fragmentShader =
      (bandIndirect ? '#define TOON_BAND_INDIRECT\n' : '') +
      (useRim ? '#define TOON_RIM\n' : '') +
      (rimDir ? '#define TOON_RIM_DIRECTIONAL\n' : '') +
      (useInk ? '#define TOON_NORMAL_INK\n' : '') +
      (especularDuro ? '#define TOON_BRILLO_DURO\n' : '') +
      'uniform float uToonBrilloUmbral;\nuniform float uToonBrilloNivel;\n' +
      'uniform float uToonSteps;\nuniform float uToonSpecularSteps;\nuniform float uToonMinBand;\nuniform float uToonPisoGlobal;\n' +
      'uniform float uToonRimStrength;\nuniform vec3 uToonRimColor;\nuniform float uToonRimThreshold;\nuniform float uToonRimWidth;\nuniform vec3 uToonRimDir;\n' +
      'uniform float uToonInkStrength;\nuniform float uToonInkThreshold;\nuniform float uToonInkSoft;\nuniform vec3 uToonInkColor;\nuniform float uToonInkRefDist;\n' +
      'uniform vec3 uLlamaPos;\nuniform vec3 uLlamaColor;\nuniform vec3 uLlamaParams;\n' + shader.fragmentShader
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
        // Cuantizar la SOMBRA (nivel de luz) INDEPENDIENTE del albedo: se divide
        // entre la luminancia del color base. Bandear la luminancia final (luz ×
        // albedo) colapsa en colores oscuros — todo cae al piso uToonMinBand y se
        // ve plano/sin escalones, dominando el specular/normal-map (look PBR
        // crudo). Cuantizando el shade y re-multiplicando por el albedo, un color
        // oscuro/negro también muestra los escalones de luz, proporcionales a su
        // tono, y NO se lava a gris.
        float _toonAlbLum = max(dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722)), 0.02);
        float _toonShade = _toonLum / _toonAlbLum;
        if (_toonShade > 1e-4 && uToonSteps > 0.5) {
          float _toonQ = floor(_toonShade * uToonSteps + 0.5) / uToonSteps;
          _toonQ = max(_toonQ, max(uToonMinBand, uToonPisoGlobal)); // piso de sombra (evita negro puro)
          float _toonScale = _toonQ / _toonShade;
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
          // Con cámara ortográfica la dirección de vista es constante (0,0,1):
          // ahí vViewPosition es la POSICIÓN del fragmento, y usarla deformaba
          // el Fresnel según dónde cayera el pixel en pantalla.
          vec3 _rimN = normalize(vNormal);
          vec3 _rimVd = isOrthographic ? vec3(0.0, 0.0, 1.0) : normalize(vViewPosition);
          float _rim = 1.0 - max(dot(_rimN, _rimVd), 0.0);
          _rim = smoothstep(uToonRimThreshold, min(uToonRimThreshold + uToonRimWidth, 1.0), _rim);
          #ifdef TOON_RIM_DIRECTIONAL
            // Contraluz: solo el lado que mira hacia la luz del rim.
            _rim *= smoothstep(0.05, 0.3, dot(_rimN, uToonRimDir));
          #endif
          reflectedLight.directDiffuse += _rim * uToonRimColor * uToonRimStrength;
        #endif
        // El derrame de la llama de la mano: cerca y de cara a ella, la
        // superficie toma su color (no se suma: verde sobre rojo da café). Dos
        // bandas duras como el resto del toon; el color va un poco arriba del
        // brillo de lo que tiñe, para que se lea como luz y no como pintura
        // (Oscar: "aumentaría un poco el brillo").
        if (uLlamaParams.x > 0.0) {
          vec3 _llL = (viewMatrix * vec4(uLlamaPos, 1.0)).xyz - geometryPosition;
          float _llD = length(_llL);
          float _llX = clamp(_llD / max(uLlamaParams.y, 1e-4), 0.0, 1.0);
          float _llT = (1.0 - _llX * _llX);
          _llT *= _llT * smoothstep(0.0, 0.35, dot(geometryNormal, _llL / max(_llD, 1e-5)));
          float _llA = _llT > uLlamaParams.z ? 1.0 : (_llT > uLlamaParams.z * 0.45 ? 0.4 : 0.0);
          if (_llA > 0.0) {
            vec3 _llBase = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;
            // Al brillo del canal más fuerte y no a la luminancia: el rojo del
            // cuerpo tiene poca luminancia y el verde salía apagado, y mezclado
            // daba naranja. Con piso, para que sobre un color casi negro
            // también se lea como luz.
            float _llVal = max(max(_llBase.r, _llBase.g), _llBase.b);
            vec3 _llTinte = uLlamaColor * max(_llVal * 1.25, 0.22);
            reflectedLight.directDiffuse += (_llTinte - _llBase) * (_llA * uLlamaParams.x);
          }
        }
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
        #ifdef TOON_BRILLO_DURO
        {
          // Brillo duro: mancha plana donde el brillo, medido contra la luz
          // que llega, pasa el umbral; el reflejo del HDRI se va (era el
          // brillo gris de las orillas).
          float _brLum = dot(reflectedLight.directSpecular, vec3(0.2126, 0.7152, 0.0722));
          float _brLuz = max(_toonShade, 1e-3);
          float _brMancha = smoothstep(uToonBrilloUmbral * 0.92, uToonBrilloUmbral * 1.08, _brLum / _brLuz);
          vec3 _brTono = _brLum > 1e-6 ? reflectedLight.directSpecular / _brLum : vec3(1.0);
          reflectedLight.directSpecular = _brTono * (_brMancha * uToonBrilloNivel * _brLuz);
          reflectedLight.indirectSpecular = vec3(0.0);
        }
        #endif
      }`
    )
  }

  // Asegura que el programa con banding no comparta cache con la variante sin él.
  const prevKey = typeof material.customProgramCacheKey === 'function'
    ? material.customProgramCacheKey.bind(material)
    : null
  material.customProgramCacheKey = () =>
    (prevKey ? prevKey() : '') + '|toonBand_' + steps + '_' + specularSteps + '_' + minBand +
    '_' + (bandIndirect ? 1 : 0) + '_' + (useRim ? 1 : 0) + (rimDir ? 'd' : '') + '_' + (useInk ? 1 : 0) + '_' + inkRefDist +
    (especularDuro ? '_brillo' : '')

  material.needsUpdate = true
  if (!material.userData) material.userData = {}
  material.userData.__toonBanded = true
  return material
}
