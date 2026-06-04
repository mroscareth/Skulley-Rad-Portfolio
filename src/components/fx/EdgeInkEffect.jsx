import { useMemo, useRef, useEffect } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Effect, BlendFunction } from 'postprocessing'

// Toon ink lines (estilo planetono / Hi-Fi Rush). Detección de bordes por
// LAPLACIANO sobre un buffer de normales geométricas EXCLUSIVO del personaje
// (lo rinde CharacterNormalPass). El Laplaciano (centro vs promedio de vecinos)
// solo se dispara en creases/pliegues reales — NO en superficies curvas suaves
// (manos/dedos no se llenan de negro). Como usa normales geométricas y no la
// imagen iluminada, NO toca el banding de sombras ni el ruido del normal-map.
//
// `bufferRef`: holder { current: THREE.Texture|null, scale: number } compartido
// con su CharacterNormalPass. `scale` (tamaño del personaje en pantalla) sube el
// threshold al alejar → menos líneas (no más finas) → limpio sin amontonar.
// Reutilizable en cualquier EffectComposer (escena principal y retrato).
export default function EdgeInkEffect({
  bufferRef,
  enabled = true,
  thickness = 1.3,
  strength = 0.9,
  threshold = 0.3,
  soft = 0.16,
  color = [0, 0, 0],
  scaleFloor = 0.4,
  maskSilhouette = false,
  singleLine = false,
  // Contorno de silueta por BORDE INTERNO. Se entinta el último anillo de
  // píxeles del personaje (donde un vecino cae en el fondo). Es CONTINUO por
  // construcción (cada pixel del borde se entinta → sin huecos al alejar) y
  // BARATO: solo corre sobre la geometría (región chica), no sobre el fondo.
  // Es un borde INTERNO → nunca agranda la silueta hacia afuera, así que no se
  // percibe que "crece". Complementa al hull: de cerca el hull manda (grueso),
  // de lejos (cuando el hull se vuelve sub-pixel y se rompe) este lo rellena.
  silhouette = false,
  silhouetteWidth = 2.0,     // grosor del borde interno en px (≈ constante en pantalla)
  silhouetteStrength = 1.0,
}) {
  const effectRef = useRef()
  const uniformsRef = useRef({
    uEdgeThickness: new THREE.Uniform(thickness),
    uEdgeStrength: new THREE.Uniform(strength),
    uEdgeThreshold: new THREE.Uniform(threshold),
    uEdgeSoft: new THREE.Uniform(soft),
    uEdgeColor: new THREE.Uniform(new THREE.Color(color[0], color[1], color[2])),
    uResolution: new THREE.Uniform(new THREE.Vector2(1, 1)),
    uNormalBuffer: new THREE.Uniform(null),
    uMaskSilhouette: new THREE.Uniform(maskSilhouette ? 1.0 : 0.0),
    uSingleLine: new THREE.Uniform(singleLine ? 1.0 : 0.0),
    uSilhouette: new THREE.Uniform(silhouette ? 1.0 : 0.0),
    uOutlineWidth: new THREE.Uniform(silhouetteWidth),
    uOutlineStrength: new THREE.Uniform(silhouetteStrength),
  })
  const { size } = useThree()
  useFrame(() => {
    const u = uniformsRef.current
    const sc = bufferRef?.scale ?? 1
    u.uEdgeThickness.value = thickness
    u.uEdgeStrength.value = strength
    // Al alejar (sc<1): sube el threshold → solo creases fuertes (líneas crisp,
    // menos cantidad). NO se tocan grosor ni opacidad (eso da borrón/desvanecido).
    u.uEdgeThreshold.value = threshold / Math.max(sc, scaleFloor)
    u.uEdgeSoft.value = soft
    u.uEdgeColor.value.setRGB(color[0], color[1], color[2])
    u.uNormalBuffer.value = bufferRef?.current || null
    u.uMaskSilhouette.value = maskSilhouette ? 1.0 : 0.0
    u.uSingleLine.value = singleLine ? 1.0 : 0.0
    u.uSilhouette.value = silhouette ? 1.0 : 0.0
    // Ancho PROPORCIONAL al tamaño del personaje en pantalla (scale 0.2–1) →
    // mismo % del personaje a cualquier zoom → el contorno NUNCA "crece" relativo
    // al char (regla dura). De lejos queda fino (proporcional); el 8-tap + el
    // LinearFilter del normal-buffer lo mantienen CONTINUO en vez de mordido.
    u.uOutlineWidth.value = silhouetteWidth * THREE.MathUtils.clamp(sc, 0.25, 1)
    u.uOutlineStrength.value = silhouetteStrength
  })
  useEffect(() => {
    uniformsRef.current.uResolution.value.set(size.width, size.height)
  }, [size])
  useMemo(() => {
    const frag = `
      uniform float uEdgeThickness;
      uniform float uEdgeStrength;
      uniform float uEdgeThreshold;
      uniform float uEdgeSoft;
      uniform vec3 uEdgeColor;
      uniform vec2 uResolution;
      uniform sampler2D uNormalBuffer;
      uniform float uMaskSilhouette;
      uniform float uSingleLine;
      uniform float uSilhouette;
      uniform float uOutlineWidth;
      uniform float uOutlineStrength;
      // "Fondo" (0 geometría, 1 fondo) en un uv. El normal-pass deja el fondo en
      // (0,0,0) → dot≈0; la geometría tiene normales codificadas → dot≈0.75. El
      // smoothstep + LinearFilter del buffer dan valor parcial en el borde → AA.
      float edgeInkBg(vec2 uv) {
        vec3 n = texture2D(uNormalBuffer, uv).rgb;
        return 1.0 - smoothstep(0.001, 0.05, dot(n, n));
      }
      void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outColor) {
        vec2 t = vec2(uEdgeThickness) / uResolution;
        vec3 nC = texture2D(uNormalBuffer, uv).rgb;
        // Solo donde hay geometría (el normal-pass deja ~0 en el fondo). EARLY-OUT:
        // el fondo (la mayor parte de la pantalla) no hace NADA más → barato.
        if (dot(nC, nC) < 0.001) { outColor = inputColor; return; }
        vec3 nL = texture2D(uNormalBuffer, uv - vec2(t.x, 0.0)).rgb;
        vec3 nR = texture2D(uNormalBuffer, uv + vec2(t.x, 0.0)).rgb;
        vec3 nU = texture2D(uNormalBuffer, uv + vec2(0.0, t.y)).rgb;
        vec3 nD = texture2D(uNormalBuffer, uv - vec2(0.0, t.y)).rgb;
        float maskOk = 1.0;
        if (uMaskSilhouette > 0.5) {
          float bg = step(dot(nL, nL), 0.001) + step(dot(nR, nR), 0.001)
                   + step(dot(nU, nU), 0.001) + step(dot(nD, nD), 0.001);
          if (bg > 0.5) maskOk = 0.0;
        }
        float d;
        if (uSingleLine > 0.5) {
          // GRADIENTE (1ra derivada): pico único en el doblez (una sola línea).
          float dL = distance(nC, nL);
          float dR = distance(nC, nR);
          float dU = distance(nC, nU);
          float dD = distance(nC, nD);
          d = max(max(dL, dR), max(dU, dD)) * 2.0;
        } else {
          // LAPLACIANO: desviación del centro vs el promedio de vecinos (2da
          // derivada). ~0 en superficies curvas suaves; SOLO se dispara en creases.
          vec3 navg = (nL + nR + nU + nD) * 0.25;
          d = distance(nC, navg) * 4.0;
        }
        float e = smoothstep(uEdgeThreshold, uEdgeThreshold + uEdgeSoft, d) * maskOk;
        vec3 col = mix(inputColor.rgb, uEdgeColor, e * uEdgeStrength);

        // ── Contorno de silueta por BORDE INTERNO ──────────────────────────────
        // Solo corre aquí (sobre geometría = región chica) → costo despreciable.
        // Si un vecino a uOutlineWidth cae en el fondo, este pixel es del borde →
        // se entinta con cobertura SUAVE. Continuo por construcción (cada pixel del
        // contorno se entinta → sin huecos al alejar). Borde INTERNO → no agranda
        // la silueta hacia afuera. 8 taps (cardinales + diagonales) → contorno
        // parejo en cualquier orientación.
        if (uSilhouette > 0.5) {
          vec2 ow = vec2(uOutlineWidth) / uResolution;
          vec2 owd = ow * 0.70710678;
          float rim = 0.0;
          rim = max(rim, edgeInkBg(uv + vec2( ow.x, 0.0)));
          rim = max(rim, edgeInkBg(uv + vec2(-ow.x, 0.0)));
          rim = max(rim, edgeInkBg(uv + vec2(0.0,  ow.y)));
          rim = max(rim, edgeInkBg(uv + vec2(0.0, -ow.y)));
          rim = max(rim, edgeInkBg(uv + vec2( owd.x,  owd.y)));
          rim = max(rim, edgeInkBg(uv + vec2(-owd.x,  owd.y)));
          rim = max(rim, edgeInkBg(uv + vec2( owd.x, -owd.y)));
          rim = max(rim, edgeInkBg(uv + vec2(-owd.x, -owd.y)));
          col = mix(col, uEdgeColor, rim * uOutlineStrength);
        }

        outColor = vec4(col, inputColor.a);
      }
    `
    const e = new Effect('EdgeInk', frag, {
      blendFunction: BlendFunction.NORMAL,
      uniforms: new Map(Object.entries(uniformsRef.current)),
    })
    effectRef.current = e
    return e
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  if (!enabled) return null
  return <primitive object={effectRef.current} />
}
