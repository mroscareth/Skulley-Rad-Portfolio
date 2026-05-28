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
      void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outColor) {
        vec2 t = vec2(uEdgeThickness) / uResolution;
        vec3 nC = texture2D(uNormalBuffer, uv).rgb;
        // Solo donde hay geometría (el normal-pass deja ~0 en el fondo).
        if (dot(nC, nC) < 0.001) { outColor = inputColor; return; }
        vec3 nL = texture2D(uNormalBuffer, uv - vec2(t.x, 0.0)).rgb;
        vec3 nR = texture2D(uNormalBuffer, uv + vec2(t.x, 0.0)).rgb;
        vec3 nU = texture2D(uNormalBuffer, uv + vec2(0.0, t.y)).rgb;
        vec3 nD = texture2D(uNormalBuffer, uv - vec2(0.0, t.y)).rgb;
        // Si algún vecino cae en el fondo (sin geometría), estamos en el borde
        // de SILUETA → el hull outline ya lo cubre; no entintar (evita la doble
        // línea paralela al contorno). Solo aplica con uMaskSilhouette=1.
        if (uMaskSilhouette > 0.5) {
          float bg = step(dot(nL, nL), 0.001) + step(dot(nR, nR), 0.001)
                   + step(dot(nU, nU), 0.001) + step(dot(nD, nD), 0.001);
          if (bg > 0.5) { outColor = inputColor; return; }
        }
        float d;
        if (uSingleLine > 0.5) {
          // GRADIENTE (1ra derivada): máxima diferencia entre el centro y sus
          // vecinos. En un crease la normal cambia abrupto → pico único en el
          // doblez (una sola línea, no las dos rims del surco como el Laplaciano).
          // En superficies suaves la diferencia es baja y pareja → se filtra con
          // el threshold. Multiplicado por 2.0 para que el rango de threshold
          // útil quede similar al modo Laplaciano.
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
        float e = smoothstep(uEdgeThreshold, uEdgeThreshold + uEdgeSoft, d);
        outColor = vec4(mix(inputColor.rgb, uEdgeColor, e * uEdgeStrength), inputColor.a);
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
